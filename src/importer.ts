import { getTransactions } from "./paypal/paypal.ts";
import { People } from "./pco/people/people.ts";
import { Donations } from "./pco/giving/donations/donations.ts";
import { Observer, StatusCode } from "./importerWatcher.ts";
import { Pco } from "./pco/pco.ts";
import * as ssf from "https://cdn.skypack.dev/ssf?dts";
import { xlsx } from "../denoReplacements/xlsx.ts";
const { read, utils } = xlsx;
import { Donation } from "./pco/giving/donations/donation.ts";
import { validateObject, validateProperty } from "./utils.ts";

/**
 * Importer class provides a way to import some csv files containing donation info into PCO or pull new donations from PayPal.
 */
export class Importer extends Pco {
  IsSetup: boolean;
  Donate: Donations;
  people: People;

  /**
   * Creates an Importer object with the given list of Observers and token if present
   * @param observers array of Observers
   * @param token Optional token to be used to import from PCO
   */
  constructor(observers: Observer[], token?: string) {
    super(observers, "", token);
    this.IsSetup = false;
    this.Donate = new Donations(observers, token);
    this.people = new People(observers, token);
  }

  /**
   * Needs to be called before anything is run
   * @returns A promise that is completed when setup is complete
   */
  private setup(): Promise<unknown> {
    this.IsSetup = true;
    return this.Donate.setup();
  }

  private async parseAndPost(args: {
    path: string;
    batch?: string;
    source?: string;
    method?: string;
    fund?: string;
  }): Promise<void> {
    this.notify("loading file", StatusCode.inprogress);
    const fileData = await Deno.readFile(args.path);
    const workBook = read(fileData, { type: "buffer" });
    for (const sheet in workBook.Sheets) {
      await this.postData({
        jsonData: utils.sheet_to_json(workBook.Sheets[sheet]),
        batch: args.batch,
        source: args.source,
        method: args.method,
        fund: args.fund,
      });
    }
    this.notify("file loaded", StatusCode.success);
  }

  private async postData(args: {
    jsonData: unknown[];
    batch?: string;
    source?: string;
    method?: string;
    fund?: string;
  }) {
    for (const row of args.jsonData) {
      let donation;
      try {
        donation = await this.validateRow(row, {
          batch: args.batch,
          source: args.source,
          method: args.method,
          fund: args.fund,
        });
      } catch (err) {
        this.notify(
          "error encountered during donation creation",
          StatusCode.error,
          err,
        );
        continue;
      }

      try {
        await this.Donate.postDonation(donation);
        this.notify("successfully imported donation", StatusCode.success);
      } catch (err) {
        this.notify(
          "error encountered during donation upload",
          StatusCode.error,
          err,
        );
      }
    }
  }

  private async validateRow(
    row: unknown,
    args: {
      batch?: string;
      source?: string;
      method?: string;
      fund?: string;
    },
  ): Promise<Donation> {
    let fullName, uuid, date;
    try {
      fullName = validateProperty<string>(row, ["Name", "Full Name", "Full_Name"]);
    } catch (_err) {
      fullName = validateProperty<string>(row, ["First Name"]) +
        " " +
        validateProperty<string>(row, ["Last Name"]);
    }

    const email = validateProperty<string>(row, [
      "email",
      "email address",
    ]);

    if (fullName) {
      try {
        uuid = await this.people.getUUID(fullName, email);
        this.notify("uuid found", StatusCode.success);
      } catch (err) {
        this.notify(
          "error encountered during uuid search",
          StatusCode.error,
          err,
        );
        throw Error("error encountered during uuid search");
      }
    } else {
      this.notify("Row missing full name", StatusCode.error);
      throw Error("Row missing full name");
    }

    const amount = validateProperty<number>(row, ["Amount", "Total Paid"]);
    args.batch = args.batch
      ? args.batch
      : validateProperty<string>(row, ["Batch"]);
    args.source = args.source
      ? args.source
      : validateProperty<string>(row, ["Payment source"]);
    args.method = args.method
      ? args.method
      : validateProperty<string>(row, ["Payment method"]);
    args.fund = args.fund ? args.fund : validateProperty<string>(row, ["Fund"]);
    const dateVal = validateProperty<string | number>(row, [
      "timestamp",
      "date",
      "received date",
    ]);
    if (typeof dateVal === "number") {
      const prDt = ssf.parse_date_code(dateVal);
      date = new Date(prDt.y, prDt.m - 1, prDt.d, prDt.H, prDt.M, prDt.S);
    } else {
      date = new Date(dateVal);
    }
    return new Donation(
      uuid,
      date.toISOString(),
      args.source,
      args.method,
      args.batch,
      amount * 100,
      args.fund,
    );
  }

  /**
   * Reads donation data from a csv file in the format provided by PayPal
   * @param path Path to a csv file to be imported
   * @returns A promise that completes when all data has been imported
   */
  async readDataPP(path: string): Promise<void> {
    if (!this.IsSetup) {
      await this.setup();
    }
    const batch = `[imported] PayPal data imported on ${
      new Date().toDateString()
    }`;
    await this.parseAndPost({
      path: path,
      batch,
      source: "PayPal",
      method: "card",
      fund: "general",
    });
  }

  /**
   * This method pulls data from planning center to try to determine the most recent PayPal donation. It then uses
   * the PayPal API to grab all transactions that occur after the last PayPal donation. The donations are then put into planning center
   * @returns
   */
  async getPayPal(): Promise<void> {
    if (!this.IsSetup) {
      this.notify("Loading in PCO data", StatusCode.inprogress);
      await this.setup();
    }

    //Find the most recent
    this.notify(
      "Getting Most recent PayPal Donation from PCO",
      StatusCode.inprogress,
    );
    const mostRecent = await this.Donate.getMostRecent("3022");
    const res = await this.Donate.getExact(`donations/${mostRecent}`);

    if (!res) {
      throw Error("Error fetching donation");
    }

    const RecDate = new Date(
      validateObject<string>(res, [
        "data",
        "attributes",
        "received_at",
      ]),
    );
    const CurDate = new Date();
    this.notify("Getting Donations from Paypal", StatusCode.inprogress);
    const data = await getTransactions(RecDate.toISOString());
    const batch =
      `PayPal import from ${RecDate.toISOString()} to ${CurDate.toISOString()} [API]`;

    await this.postData({
      jsonData: data,
      batch,
      source: "PayPal",
      method: "card",
      fund: "general",
    });
  }

  async readDataT2T(path: string): Promise<void> {
    if (!this.IsSetup) {
      await this.setup();
    }
    const batch = `[imported] T2T imported on ${new Date().toDateString()}`;
    await this.parseAndPost({
      path: path,
      batch,
      source: "TextToTithe",
      method: "card",
    });
  }

  async readDataUni(path: string): Promise<void> {
    if (!this.IsSetup) {
      await this.setup();
    }

    await this.parseAndPost({ path: path });
  }
}
