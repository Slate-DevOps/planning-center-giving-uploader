import { Observer, StatusCode } from "../../importerWatcher.ts";
import { PCO } from "../pco.ts";
import { formatDate, validateObject } from "https://deno.land/x/typescript_utils@v0.0.1/utils.ts";
import { PcoObject } from "../pcoObject.ts"

interface person {
  first: string;
  given: string;
  last: string;
  uuid: string;
  child: boolean;
}

export class Person extends PcoObject {
  /**
   * @param observers
   * @param token
   */
  constructor(PCO: PCO, observers: Observer[], token?: string) {
    super(PCO, observers, "people/v2/", token);
  }

  /**
   * Creates a person in PCO. Operates under the name BotBot.
   * @param {object} person - Contains information about the person
   * @param {string=} person.first - first name
   * @param {string=} person.nickname - nickname
   * @param {string=} person.middle - middle name
   * @param {string=} person.last - last name
   * @param {string=} person.birthday - birthday
   * @param {string=} person.anniversary - anniversary
   * @param {string=} person.gender - gender // TODO: find out what this can be
   * @param {string=} person.grade - grade in school
   * @param {string=} param.email - email
   *
   * @returns {string} - uuid for created person
   */
  async create(person: {
    first: string;
    last: string;
    birthday: string;
    email: string;
    nickname?: string;
    middle?: string;
    anniversary?: string;
    gender?: string;
    grade?: string;
    status?: string;
  }): Promise<string> {
    const payload = {
      data: {
        type: "Person",
        attributes: {
          first_name: person.first,
          nickname: person.nickname ? person.nickname : "",
          middle_name: person.middle ? person.middle : "",
          last_name: person.last,
          birthdate: "",
          child: "",
          anniversary: "",
          gender: person.gender ? person.gender : "",
          grade: person.grade ? person.grade : "",
          status: person.status ? person.status : "",
          site_administrator: false,
        },
      },
    };

    if (person.birthday !== "") {
      payload.data.attributes["birthdate"] = formatDate(person.birthday);

      const curDate = new Date();
      curDate.setFullYear(curDate.getFullYear() - 18);
      const bDay = new Date(person.birthday);
      payload.data.attributes["child"] = String(bDay > curDate);
    }
    if (typeof person.anniversary !== "undefined") {
      payload.data.attributes["anniversary"] = formatDate(
        <string> person.anniversary,
      );
    }

    const res = await this.postNew(payload, "person", "people");
    const uuid = res ? validateObject<string>(res, ["data", "id"]) : "";

    if (person.email !== "") this.PCO.People.email.postEmail(uuid, person.email);

    return uuid;
  }

  /**
   * Get's a person's information from PCO
   * @param {string} uuid - the person's ID from PCO (i.e., what was returned by a search)
   * @returns {any} - the person { firstName, givenName, lastName, uuid }
   */
  async getPerson(uuid: string): Promise<person | undefined> {
    const res = await this.getExact(`people/${uuid}`);
    const person = validateObject<
      {
        first_name: string;
        given_name: string;
        last_name: string;
        child: boolean;
      }
    >(res, ["data", "attributes"]);
    return res
      ? {
        first: person.first_name,
        given: person.given_name,
        last: person.last_name,
        uuid: uuid,
        child: person.child,
      }
      : undefined;
  }

  /**
   * getUUID gets the PCO UUID given a full name and an email. It attempts to parse the full name into first, middle, and
   * last as makes sense.
   * SIDE EFFECT: if the person does not exist, the function will create them.
   *
   * @param {string} fullName
   * @param {string} email
   *
   * @returns {Promise<string>} the PCO UUID
   */
  async getUUID(fullName: string, email: string): Promise<string> {
    if (email == "") {
      return this.getUUIDFromName(fullName);
    }

    //search for person
    let uuids = [];
    try {
      uuids = await this.PCO.People.email.searchOnEmail(email);
    } catch (err) {
      this.notify(
        `Error searching for email matching ${email}`,
        StatusCode.error,
        err,
      );
      throw Error(`Error searching for email matching ${email}`);
    }
    let uuid = "";

    //Found an exact one email match
    if (uuids.length === 1) {
      uuid = uuids[0];
    } else {
      // get first, middle, last names from payment
      let first = "",
        middle = "",
        last = "";

      const split = fullName.split(" ");
      if (split.length === 1) {
        last = split[0];
      } else if (split.length === 2) {
        first = split[0];
        last = split[1];
      } else {
        first = split[0];
        middle = split[1];
        last = split[2];
      }

      if (uuids.length === 0) {
        const birthday = "1900-01-01";
        try {
          uuid = await this.create({ first, last, birthday, email, middle });
        } catch (err) {
          this.notify(
            `Error creating new person for with email ${email}`,
            StatusCode.error,
            err,
          );
          throw Error(`Error creating new person for with email ${email}`);
        }
      } else {
        // must now get the names of those UUIDs (really wish PCO had sent them back the first time...) and look for the right one
        // bail out if none match since we can't make an assumption of where to send like when we only had one UUID
        let persons: [string, person][] = [];
        for (const id of uuids) {
          const p = await this.getPerson(id);
          if (p) persons.push([uuid, p]);
        }
        persons = persons.filter((person) => !person[1].child);
        if (persons.length === 1) {
          return persons[0][1].uuid;
        }

        persons = persons.filter(
          (person) => (person[1].first || person[1].given) && person[1].last,
        );
        const filteredPersons = persons.filter(
          (person) =>
            (person[1].first.toLowerCase() === first.toLowerCase() || person[1].first.toLowerCase() === `${first.toLowerCase()} ${middle.toLowerCase()}`) &&
            person[1].last.toLowerCase() === last.toLowerCase() || `${person[1].first.toLowerCase()} ${person[1].last.toLowerCase()}` === `${first.toLowerCase()} ${middle.toLowerCase()}`,
        );

        if (filteredPersons.length == 0) {
          this.notify(
            `Multiple people had the email '${email}' attached to their profile, but it's unclear which profile is the correct one.`,
            StatusCode.error_duplicate_profile,
          );
          throw Error(`Error: unable to locate uuid for '${first} ${middle} ${last}' and '${email}'`);
        } else if (filteredPersons.length > 1) {
          this.notify(
            `Multiple people were named '${fullName}' and had the email '${email}'. Consider merging their profiles before re-running the import.`,
            StatusCode.error_duplicate_profile,
          );
          throw Error(`Error: unable to locate uuid for '${first} ${middle} ${last}' and '${email}'`);
        }

        uuid = filteredPersons[0][1].uuid;
      }
    }
    return uuid;
  }

  /**
   * getUUIDFromName gets the PCO UUID given a full name. It attempts to parse the full name into first, middle, and last as makes sense.
   * SIDE EFFECT: if the person does not exist, the function will create them.
   *
   * @param {string} fullName
   *
   * @returns {Promise<string>} the PCO UUID
   */
  async getUUIDFromName(fullName: string): Promise<string> {

    //search for person
    let uuids = [];
    try {
      uuids = await this.PCO.People.email.searchOnName(fullName);
    } catch (err) {
      this.notify(
        `Unable to find existing person with name matching ${fullName}`,
        StatusCode.error,
        err,
      );
    }
    let uuid = "";

    // Found an exact one match
    if (uuids.length === 1) {
      uuid = uuids[0];
    } else {
      // get first, middle, last names from payment
      let first = "",
        middle = "",
        last = "";

      const split = fullName.split(" ");
      if (split.length === 1) {
        last = split[0];
      } else if (split.length === 2) {
        first = split[0];
        last = split[1];
      } else {
        first = split[0];
        middle = split[1];
        last = split[2];
      }

      try {
        uuid = await this.create({ first, last, birthday: "", email: "", middle });
      } catch (err) {
        this.notify(
          `Error creating new person for with name ${fullName}`,
          StatusCode.error,
          err,
        );
        throw Error(`Error creating new person for with name ${fullName}`);
      }
    }

    return uuid;
  }
}
