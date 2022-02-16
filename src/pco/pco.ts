// deno-lint-ignore-file camelcase
import { Observer } from "../importerWatcher.ts";
import { People } from "./people/People.ts";
import { Giving } from "./giving/Giving.ts";



export class PCO {
  Calendar: unknown;
  CheckIns: unknown;
  Giving: Giving;
  Groups: unknown;
  People: People;
  Services: unknown;

  constructor(observers: Observer[], token?: string){
    this.Giving = new Giving(this, observers, token);
    this.People = new People(this, observers, token);
  }
}


