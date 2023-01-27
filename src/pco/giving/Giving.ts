import { Observer } from "../../importerWatcher.ts";
import { PCO } from "../pco.ts"
import { Batches } from "./batches.ts";
import { Donations } from "./donations/donations.ts";
import { Funds } from "./funds.ts";
import { Sources } from "./sources.ts";


export class Giving{
    batches: Batches;
    donations: Donations;
    funds: Funds;
    sources: Sources;


    constructor(PCO: PCO, observers: Observer[], token?: string){
        this.batches = new Batches(PCO, observers, token);
        this.donations = new Donations(PCO, observers, token);
        this.funds = new Funds(PCO, observers, token);
        this.sources = new Sources(PCO, observers, token);
    }
}