import { Observer, StatusCode } from "../../importerWatcher.ts";
import { Pco } from "../pco.ts";
import { formatDate, validateObject } from "../../utils.ts";

interface Person {
  first: string;
  given: string;
  last: string;
  uuid: string;
  child: boolean;
}

export class People extends Pco {
  /**
   * @param observers
   * @param token
   */
  constructor(observers: Observer[], token?: string) {
    super(observers, "people/v2/", token);
  }

  /**
   * Adds the email to a specific uuid
   * @param userId uuid to attach email to
   * @param email email to be attached to uuid
   * @returns void promise when complete
   */
  async addEmail(userId: string, email: string): Promise<void> {
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

    await this.postNew(payload, "email", `people/${userId}/emails`);
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

    if (person.email !== "") this.addEmail(uuid, person.email);

    return uuid;
  }

  /**
   * Searches for a person in PCO.
   * @param {object} params - Contains information about the person
   * @param {string=} params.anniversary - query on a specific anniversary
   * @param {string=} params.birthdate - query on a specific birthdate
   * @param {boolean=} params.child - query on a specific child
   * @param {string=} params.created_at - query on a specific created_at // TODO: not implemented
   * @param {string=} params.first_name - query on a specific first_name
   * @param {string=} params.gender - query on a specific gender
   * @param {string=} params.given_name - query on a specific given_name
   * @param {number=} params.grade - query on a specific grade
   * @param {number=} params.graduation_year - query on a specific graduation_year
   * @param {string=} params.id - query on a specific id // TODO: not implemented
   * @param {string=} params.inactivated_at - query on a specific inactivated_at // TODO: not implemented
   * @param {string=} params.last_name - query on a specific last_name
   * @param {string=} params.medical_notes - query on a specific medical_notes
   * @param {string=} params.membership - query on a specific membership
   * @param {string=} params.middle_name - query on a specific middle_name
   * @param {string=} params.nickname - query on a specific nickname
   * @param {string=} params.people_permissions - query on a specific people_permissions
   * @param {number=} params.remote_id - query on a specific remote_id
   * @param {string=} params.school_type - query on a specific school_type
   * @param {boolean=} params.site_administrator - query on a specific site_administrator
   * @param {string=} params.status - query on a specific status
   * @param {string=} params.updated_at - query on a specific updated_at // TODO: not implemented
   *
   * @returns {object|false} - uuids for found persons or false if not found
   */
  async search(params: { [x: string]: string }): Promise<string[]> {
    // doing this cause they aren't using querystring
    let searchString = "";
    Object.keys(params).forEach((key) => {
      searchString = searchString + `&where[${key}]=${params[key]}`;
    });
    searchString = searchString.replace("&", "?");
    let res;
    try {
      res = await this.fetcher.get(`people?${searchString}`);
    } catch (err) {
      if (
        err !== undefined &&
        (err as Response).status.toString() === "429"
      ) {
        this.notify(
          `Waiting for PCO to input more data`,
          StatusCode.inprogress,
        );
        await new Promise((r) => setTimeout(r, 20000));
        return this.search(params);
      }
    }

    const uuids: string[] = [];

    if (res !== undefined) {
      validateObject<{ id: string }[]>(res, ["data"]).forEach((
        elem: { id: string },
      ) => uuids.push(elem.id));
    }

    return uuids;
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
      const obj = validateObject<{ relationships: { person: { data: { id: string } } } }[]>(
        res,
        ["data"],
      )
      obj.forEach(
        (elem: { relationships: { person: { data: { id: string } } } }) =>
          uuids.push(elem.relationships.person.data.id),
      );
    }
    return uuids;
  }

  /**
   * Get's a person's information from PCO
   * @param {string} uuid - the person's ID from PCO (i.e., what was returned by a search)
   * @returns {any} - the person { firstName, givenName, lastName, uuid }
   */
  async getPerson(uuid: string): Promise<Person | undefined> {
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
    //search for person
    let uuids = [];
    try {
      uuids = await this.searchOnEmail(email);
      this.notify("seached for uuids on email", StatusCode.success, uuids);
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
        let persons: [string, Person][] = [];
        for (const id of uuids) {
          const p = await this.getPerson(id);
          if (p) persons.push([uuid, p]);
        }
        persons = persons.filter((person) => !person[1].child);
        if (persons.length === 1) {
          this.notify(
            `Found person with email matching ${email}, ${persons[0][1].uuid}`,
            StatusCode.success,
          );
          return persons[0][1].uuid;
        }

        persons = persons.filter(
          (person) => (person[1].first || person[1].given) && person[1].last,
        );
        const filteredPersons = persons.filter(
          (person) =>
            person[1].first.toLowerCase() === first.toLowerCase() &&
            person[1].last.toLowerCase() === last.toLowerCase(),
        );

        if (filteredPersons.length !== 1) {
          if (filteredPersons.length > 1) {
            this.notify(
              `Multiple people with name matching: ${fullName} and email: ${email} \nConsider merging their profiles before re-running import`,
              StatusCode.error,
            );
          }
          throw Error(`Error: unable to locate uuid ${filteredPersons}`);
        }

        uuid = filteredPersons[0][1].uuid;
      }
    }

    this.notify(
      `Found person with email matching ${email}, ${uuid}`,
      StatusCode.success,
    );
    return uuid;
  }
}
