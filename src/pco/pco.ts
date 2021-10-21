import { Observer, StatusCode, Subject } from "../importerWatcher.ts";
import { validateObject } from "../utils.ts";
import { axil } from "../axil.ts";

export class Pco extends Subject {
  fetcher: axil;

  constructor(observers: Observer[], axiosURL: string, token?: string) {
    super(observers);
    const baseURL = `https://api.planningcenteronline.com/${axiosURL}`
    const Authorization = token ? `Bearer ${token}` : "Basic " +
        btoa(`${Deno.env.get("PCOID")}:${Deno.env.get("PCOS")}`);
    this.fetcher = new axil(baseURL, new Headers({ Authorization }));
  }

  async getExact(uriAddOn: string): Promise<Response | undefined> {
    try {
      return await this.fetcher.get(uriAddOn);
    } catch (err) {
      if (err && (err as Response).status.toString() === "429") {
        await new Promise((r) => setTimeout(r, 20000));
        return this.getExact(uriAddOn);
      } else {
        this.notify(
          `Error getting object from Planning center at address: ${
            this.fetcher.baseURL + uriAddOn
          }`,
          StatusCode.error,
          err,
        );
        return;
      }
    }
  }

  async getAll(uriAddOn?: string): Promise<unknown[]> {
    if (uriAddOn === undefined) {
      uriAddOn = "";
    }
    let data: unknown[] = [];

    let more = true;

    for (let c = 0; more;) {
      const uri = `?per_page=100&offset=${c}`;

      try {
        const res = await this.fetcher.get(uriAddOn + uri);
        data = data.concat(validateObject<unknown[]>(res, ["data"]));
        c += validateObject<number>(res, ["meta", "count"]);
        more = c < validateObject<number>(res, ["meta", "total_count"]);
      } catch (_err) {
        more = false;
      }
    }
    return data;
  }

  async getNextMatch<Type>(
    uriPrefix: string,
    uriPostfix: string,
    searchFn: (data: Type) => boolean,
  ): Promise<Type | undefined> {
    let more = true;

    for (let c = 0; more;) {
      const uri = `?per_page=100&offset=${c}`;
      const res = await this.fetcher.get(uriPrefix + uri + uriPostfix);

      for (const t of validateObject<unknown[]>(res, ["data"])) {
        if (searchFn(t as Type)) return t as Type;
      }

      try {
        c += validateObject<number>(res, ["meta", "count"]);
        more = c < validateObject<number>(res, ["meta", "total_count"]);
      } catch (_err) {
        more = false;
      }
    }
  }

  async postNew(
    payload: unknown,
    objectName: string,
    uriAddOn?: string,
  ): Promise<Response | undefined> {
    if (this.fetcher.baseURL === undefined) {
      return;
    }

    if (uriAddOn === undefined) {
      uriAddOn = "";
    }
    try {
      const res = await this.fetcher.post(uriAddOn, payload);
      this.notify(
        `Created new ${objectName} in Planning center`,
        StatusCode.created,
        res,
      );
      return res;
    } catch (err) {
      if (err && (err as Response).status.toString() === "429") {
        await new Promise((r) => setTimeout(r, 20000));
        return this.postNew(payload, objectName, uriAddOn);
      } else {
        this.notify(
          `Error posting new ${objectName} in Planning center to ${
            this.fetcher.baseURL + uriAddOn
          }`,
          StatusCode.error,
          err,
        );
        throw Error(
          `Error posting new ${objectName} in Planning center to ${
            this.fetcher.baseURL + uriAddOn
          }`,
        );
      }
    }
  }
}
