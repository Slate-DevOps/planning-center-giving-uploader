import { Observer } from "../../importerWatcher.ts";
import { validateObject } from "https://deno.land/x/typescript_utils@v0.0.1/utils.ts";
import { PCO } from "../pco.ts";
import { PcoObject } from "../pcoObject.ts"

export class Email extends PcoObject {

  constructor(PCO: PCO, observers: Observer[], token?: string) {
    super(PCO, observers, "people/v2/", token);
  }

  /**
   * Adds the email to a specific uuid
   * @param userId uuid to attach email to
   * @param email email to be attached to uuid
   * @returns void promise when complete
   */
  async postEmail(uuid: string, email: string): Promise<Response | undefined> {
    const payload = {
      data: {
        type: "Email",
        attributes: {
          address: email,
          location: "primary", // TODO: should we make this configurable?
          primary: false,
        },
      },
    };

    return await this.postNew(payload, "email", `people/${uuid}/emails`);
  }

  /**
   * Searches for a person in PCO via email. Operates under the name BotBot.
   * @param {string} address - the address to search for
   * @returns {Array} - uuids for found persons or false if not found
   */
  async searchOnEmail(address: string): Promise<string[]> {
    const res = await this.getExact(`emails?where[address]=${address}`);
    const uuids: string[] = [];

    if (res) {
      const obj = validateObject<
        { relationships: { person: { data: { id: string } } } }[]
      >(
        res,
        ["data"],
      );
      obj.forEach(
        (elem: { relationships: { person: { data: { id: string } } } }) =>
          uuids.push(elem.relationships.person.data.id),
      );
    }

    // Remove duplicates (this happens if the same email address is attached to the same profile twice)
    var unique_uuids = uuids.filter(function(elem, index, self) {
        return index === self.indexOf(elem);
    })

    return unique_uuids;
  }
}
