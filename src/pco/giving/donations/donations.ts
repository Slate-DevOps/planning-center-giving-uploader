import { Donation } from "./donation.ts";
import { PcoObject } from "../../pcoObject.ts"
import { PCO } from "../../pco.ts";
import { Observer } from "../../../importerWatcher.ts";
import { validateObject } from "https://deno.land/x/typescript_utils@v0.0.1/utils.ts";

export enum PCO_TRANSACTION_METHODS {
  cash = "cash",
  card = "card",
  check = "check",
}

/**
 * Donations loads up the avaliable batches, funds, and sources so that donations can be inserted into planning center.
 */
export class Donations extends PcoObject {

  constructor(PCO: PCO, observers: Observer[], token?: string) {
    super(PCO, observers, "giving/v2/", token);
  }

  /**
   * Setup must be run before any other method. It loads all the data needed from planning center.
   */
  async setup(): Promise<void> {
    await this.PCO.Giving.batches.loadBatches();
    await this.PCO.Giving.funds.loadfunds();
    await this.PCO.Giving.sources.loadsources();
  }

  /**
   * Creates a donation in PCO.
   * Operates under the name BotBot.
   * @param {Object} donation - the donation
   * @param {string} donation.uuid - the uuid of the giver
   * @param {string} donation.date - the date the transaction occurred
   * @param {string} donation.source - the donation's source (one of PCO_PAYMENT_SOURCES)
   * @param {string} donation.method - the method used (one of PCO_TRANSACTION_METHODS)
   * @param {string} donation.batch - the id of the donation's batch
   * @param {number} donation.amount - the amount being donated in cents
   * @param {string} donation.fund - the fund (one of PCO_FUNDS)
   * @param {string} donation.transactionId - the transaction's ID for error purposes
   * @param {string=} donation.label - the label to be attached to the donation
   *                                   NOTE: must be one of the pre-saved labels
   *
   * @returns {Promise<string>} - uuid of donation created
   */
  async postDonation(donation: Donation): Promise<string | undefined> {
    const batchId = await this.PCO.Giving.batches.handleBatch(donation.batch);

    const payload = {
      data: {
        type: "Donation",
        attributes: {
          payment_source_id: this.PCO.Giving.sources.handleSource(donation.source),
          payment_method: this.handleMethod(donation.method),
          received_at: donation.date,
          person_id: donation.uuid,
        },
        relationships: {},
      },
      included: [
        {
          type: "Designation",
          attributes: { amount_cents: donation.amount },
          relationships: {
            fund: {
              data: {
                type: "Fund",
                id: `${this.PCO.Giving.funds.handleFund(donation.fund)}`,
              },
            },
          },
        },
      ],
    };

    const res = await this.postNew(
      payload,
      "Donation",
      `batches/${batchId}/donations?include=designations,labels`,
    );
    return res ? validateObject<string>(res, ["data", "id"]) : undefined;
  }

  async getMostRecent(sourceID: string): Promise<string | undefined> {
    const res = await this.getNextMatch<{
      id: string;
      relationships: { payment_source: { data: { id: string } } };
    }>(
      "donations",
      "&where[payment_method]=card&order=-received_at", //TODO: remove hadcoded payment method
      (data) => {
        return data.relationships.payment_source.data.id === sourceID;
      },
    );
    return res ? res.id : undefined;
  }

  handleMethod(method: string): string {
    method = method.toLowerCase();
    if (method == 'cheque') {
      return 'check';
    }
    if (method in PCO_TRANSACTION_METHODS) {
      return method;
    }
    throw Error(`Invalid Method: ${method}`);
  }
}
