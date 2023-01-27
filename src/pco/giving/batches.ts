import { PCO } from "../pco.ts";
import { Observer } from "../../importerWatcher.ts";
import { validateObject } from "https://deno.land/x/typescript_utils@v0.0.1/utils.ts";
import { PcoObject } from "../pcoObject.ts"

/**
 * Class Batches holds tuples of ids and names of batches that have been stored in planning center
 * It can be used to create new batches and verify that a batch exists
 */
export class Batches extends PcoObject {
  batches: { id: string; name: string }[];

  constructor(PCO: PCO, observers: Observer[], token?: string) {
    super(PCO, observers, "giving/v2/batches", token);
    this.batches = [];
  }

  /**
   * loads all batches from PCO into attribute batches
   */
  async loadBatches(): Promise<void> {
    this.batches = []; // clear old batches

    const res = (await this.getAll()) as {
      id: string;
      attributes: { description: string };
    }[];

    for (const b of res) {
      this.batches.push({
        id: b.id,
        name: b.attributes.description,
      });
    }
  }

  /**
   * Adds a new batch to PCO. Tracks created batches in attribute batches.
   *
   * @param {string} name - Name for the new batch
   *
   * @returns {Promise<any>} - The data about the batch that was sent as a response
   */
  async makeNewBatch(
    name: string,
  ): Promise<{ id: string; name: string } | undefined> {
    //The json payload to be sent to PCO
    const payload = {
      data: {
        type: "Batch",
        attributes: {
          description: name,
        },
      },
    };

    const res = await this.postNew(payload, "batch");

    if (res === undefined) {
      throw new Error("res is undefined");
    }

    const id = validateObject<string>(res, ["data", "id"]);
    const batchName = validateObject<string>(res, [
      "data",
      "attributes",
      "description",
    ]);

    //Add the new batch to the batches array
    this.batches.push({ id, name: batchName });
    return { id, name: batchName };
  }

  /**
   * Checks if the parameter batchName is an existing batch. If a batch with a matching name cannot be found it will create a new batch
   *
   * @param {string} batchName The name of the batch to look for
   *
   * @returns {Promise<number | undefined>} A promise containing either a number or undefined
   */
  async handleBatch(batchName: string): Promise<string | undefined> {
    let batch = this.batches.find((elem) => {
      return elem.name === batchName;
    });
    let batchId;

    if (batch !== undefined) {
      batchId = batch.id;
    } else {
      try {
        batch = await this.makeNewBatch(batchName);
      } catch (_err) {
        return;
      }
      batchId = batch?.id;
    }
    return batchId;
  }
}
