import { Observer } from "../../importerWatcher.ts";
import { Email } from "./email.ts";
import { Person } from "./person.ts";
import { PCO } from "../pco.ts"


export class People{
    email: Email;
    person: Person;

    constructor(PCO: PCO, observers: Observer[], token?: string){
        console.log("We made it!")
        this.email = new Email(PCO, observers, token);
        this.person = new Person(PCO, observers, token);
    }
}
