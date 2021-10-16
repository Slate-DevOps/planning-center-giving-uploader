import { Pco } from "../index.ts";
import { Observer } from "../../importerWatcher.ts";
import { validateObject } from "../../utils.ts";

/**
 * Class Sources holds tuples of ids and names of sources that have been stored in planning center
 * It can be used verify that a source exists
 */
export class Sources extends Pco {
  sources: { id: string; name: string }[];

  constructor(observers: Observer[], token?: string) {
    super(observers, "giving/v2/payment_sources", token);
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
      return 2401;
    }
  }

  async idLookup(sourceId: string): Promise<string | undefined> {
    const source = this.sources.find((elem) => {
      return elem.id === sourceId;
    });
    let sourceName;

    if (source !== undefined) {
      sourceName = source.name;
    } else {
      const res = await this.getExact(`/${sourceId}`);
      sourceName = res
        ? validateObject<string>(res, ["data", "attributes", "name"])
        : undefined;
    }

    return sourceName;
  }
}
