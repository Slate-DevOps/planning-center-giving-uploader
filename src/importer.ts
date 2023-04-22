import { Observer, StatusCode, Subject } from "./importerWatcher.ts";
import { PCO } from "./pco/pco.ts";
import * as ssf from "https://cdn.skypack.dev/ssf?dts";
import { xlsx } from "../denoReplacements/xlsx.ts";
const { read, utils } = xlsx;
import { Donation } from "./pco/giving/donations/donation.ts";
import { validateProperty } from "https://deno.land/x/typescript_utils@v0.0.1/utils.ts";

/**
 * Importer class provides a way to import some csv files containing donation info into PCO or pull new donations from PayPal.
 */
export class Importer extends Subject {
  IsSetup: boolean;
  token: string;
  PCO: PCO;

  /**
   * Creates an Importer object with the given list of Observers and token if present
   * @param observers array of Observers
   * @param token Optional token to be used to import from PCO
   */
  constructor(observers: Observer[], token?: string) {
    super(observers);
    this.IsSetup = false;
    this.token = token ? token : '';
    this.PCO = new PCO(observers, token);
  }

  /**
   * Needs to be called before anything is run
   * @returns A promise that is completed when setup is complete
   */
  private setup(): Promise<unknown> {
    this.IsSetup = true;
    return this.PCO.Giving.donations.setup();
  }

  async parseDataAndPost(args: {
    data: string;
    batch?: string;
    source?: string;
    method?: string;
    fund?: string;
  }): Promise<void> {
    if (!this.IsSetup) {
      await this.setup();
    }
    const enc = new TextEncoder();
    const workBook = read(enc.encode(args.data), { type: "buffer" });
    for (const sheet in workBook.Sheets) {
      await this.postData({
        jsonData: utils.sheet_to_json(workBook.Sheets[sheet]),
        batch: args.batch,
        source: args.source,
        method: args.method,
        fund: args.fund,
      });
    }
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
          StatusCode.failed_donation,
          err,
        );
        continue;
      }

      try {
        await this.PCO.Giving.donations.postDonation(donation);
      } catch (err) {
        this.notify(
          "error encountered during donation upload",
          StatusCode.failed_donation,
          err,
        );
        continue;
      }

      this.notify(
        "successfully uploaded donation",
        StatusCode.successful_donation,
      );
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
      fullName = validateProperty<string>(row, [
        "Name",
        "Full Name",
        "Full_Name",
      ]);
    } catch (_err) {
      fullName = validateProperty<string>(row, ["First Name"]) +
        " " +
        validateProperty<string>(row, ["Last Name"]);
    }

    let email = "";
    try {
      email = validateProperty<string>(row, [
        "email",
        "email address",
      ]);
    } catch (_err) {
      // Tolerate missing email address
    }

    if (!fullName) {
      this.notify("Row missing full name", StatusCode.error);
      throw Error("Row missing full name");
    }

    try {
      uuid = await this.PCO.People.person.getUUID(fullName, email);
    } catch (err) {
      this.notify(
        "error encountered during uuid search",
        StatusCode.error,
        err,
      );
      throw Error("error encountered during uuid search");
    }

    const amount = validateProperty<number>(row, ["Amount", "Total Paid", " Amount "]);
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
    date.setDate(date.getDate() + 1); // Fix off by one error (presumably due to some timezone nonsense)
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
}
