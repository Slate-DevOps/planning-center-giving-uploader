import { PCO } from "../pco.ts";
import { Observer } from "../../importerWatcher.ts";
import { PcoObject } from "../pcoObject.ts"

/**
 * Class Sources holds tuples of ids and names of sources that have been stored in planning center
 * It can be used verify that a source exists
 */
export class Sources extends PcoObject {
  sources: { id: string; name: string }[];

  constructor(PCO: PCO, observers: Observer[], token?: string) {
    super(PCO, observers, "giving/v2/payment_sources", token);
    this.sources = [];
  }

  /**
   * loads all sources from PCO into atribute sources
   *
   * @returns {Promise<Array>} - list of sources
   */
  async loadsources(): Promise<void> {
    this.sources = []; // clear old sources

    const res = (await this.getAll()) as {
      id: string;
      attributes: { name: string };
    }[];
    for (const s of res) {
      this.sources.push({ id: s.id, name: s.attributes.name });
    }
  }

  /**
   * Turns the string into the source ID number
   * @param {string} source
   */
  handleSource(source: string): number {
    const sourceId = this.sources.find((elem) => elem.name === source);

    if (sourceId) {
      return parseInt(sourceId.id);
    } else {
      throw new Error(`Source with name ${source} does not exist`);
    }
  }
}
