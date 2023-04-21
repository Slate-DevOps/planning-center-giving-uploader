import { PCO } from "../pco.ts";
import { Observer, StatusCode } from "../../importerWatcher.ts";
import { PcoObject } from "../pcoObject.ts"
/**
 * Class Funds holds tuples of ids and names of funds that have been stored in planning center
 * It can be used verify that a fund exists
 */
export class Funds extends PcoObject {
  funds: { id: string; name: string }[];

  constructor(PCO: PCO, observers: Observer[], token?: string) {
    super(PCO, observers, "giving/v2/funds", token);
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
    // Transform something like 'Tithes & Offerings' to 'tithes-offerings'
    const canonicalize = function (name: string) {
      return name.replace(/[^\w\s]|_/g, '') // remove non-alphanumeric characters
        .replace(/\s+/g, '-')      // replace consecutive whitespace with a single dash
        .toLowerCase()             // convert the resulting string to lowercase
    };
    const fundId = this.funds.find((elem) => canonicalize(fund) === canonicalize(elem.name));

    if (fundId) {
      return parseInt(fundId.id);
    } else {
      this.notify(
        `invalid fund: ${fund}`,
        StatusCode.error,
      );
      throw new Error(`Fund with name ${fund} does not exist in ${this.funds.map(elem => elem.name).join()}`);
    }
  }
}
