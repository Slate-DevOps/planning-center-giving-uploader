import { Batches } from "../batches.ts";
import { Funds } from "../funds.ts";
import { Sources } from "../sources.ts";
import { Donation } from "./donation.ts";

import { Pco } from "../../pco.ts";
import { Observer } from "../../../importerWatcher.ts";
import { validateObject } from "../../../utils.ts";

export enum PCO_TRANSACTION_METHODS {
  cash = "cash",
  card = "card",
  check = "check",
}

/**
 * Donations loads up the avaliable batches, funds, and sources so that donations can be inserted into planning center.
 */
export class Donations extends Pco {
  batches: Batches;
  funds: Funds;
  sources: Sources;

  constructor(observers: Observer[], token?: string) {
    super(observers, "giving/v2/", token);
    this.batches = new Batches(observers, token);
    this.funds = new Funds(observers, token);
    this.sources = new Sources(observers, token);
  }

  /**
   * Setup must be run before any other method. It loads all the data needed from planning center.
   */
  async setup(): Promise<void> {
    await this.batches.loadBatches();
    await this.funds.loadfunds();
    await this.sources.loadsources();
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
    const batchId = await this.batches.handleBatch(donation.batch);

    const payload = {
      data: {
        type: "Donation",
        attributes: {
          payment_source_id: this.sources.handleSource(donation.source),
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
                id: `${this.funds.handleFund(donation.fund)}`,
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
    if (method in PCO_TRANSACTION_METHODS) {
      return method;
    }
    throw Error("Invalid Method");
  }
}