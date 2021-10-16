import { Pco } from "../index.ts";
import { Observer } from "../../importerWatcher.ts";
import { validateObject } from "../../utils.ts";

/**
 * Class Funds holds tuples of ids and names of funds that have been stored in planning center
 * It can be used verify that a fund exists
 */
export class Funds extends Pco {
  funds: { id: string; name: string }[];

  constructor(observers: Observer[], token?: string) {
    super(observers, "giving/v2/funds", token);
    this.funds = [];
  }

  /**
   * loads all funds from PCO into attribute funds
   */
  async loadfunds(): Promise<void> {
    this.funds = []; // clear old funds

    const res = (await this.getAll()) as {
      id: string;
      attributes: { name: string };
    }[];

    for (const f of res) {
      this.funds.push({ id: f.id, name: f.attributes.name });
    }
  }

  /**
   * Turns the string into the fund ID number
   * @param {string} fund
   *
   * @returns {number} the ID number belonging to the fund of name
   */
  handleFund(fund: string): number {
    const fundId = this.funds.find((elem) => elem.name === fund);

    if (fundId) {
      return parseInt(fundId.id);
    } else {
      return 59012;
    }
  }

  async idLookup(fundId: string): Promise<string | undefined> {
    const fund = this.funds.find((elem) => {
      return elem.id === fundId;
    });
    let fundName;

    if (fund !== undefined) {
      fundName = fund.name;
    } else {
      const res = await this.getExact(`/${fundId}`);
      fundName = res
        ? validateObject<string>(res, ["data", "attributes", "name"])
        : undefined;
    }

    return fundName;
  }
}
