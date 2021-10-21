import { Importer } from "./importer.ts";
import { Observer, StatusCode, Subject } from "./importerWatcher.ts";
import {cron} from 'https://deno.land/x/deno_cron/cron.ts';

class obsNothing implements Observer {
  update(
    from: Subject,
    message: string,
    code: StatusCode,
    object?: unknown,
  ): void {}
}

const main = async () => {
  const importer = new Importer([new obsNothing()]);
    try {
      await importer.getPayPal();
    } catch (err) {
      console.error(`Error loading PayPal data from PayPal: ${err}`);
    }
    console.info("done");
};

cron(Deno.env.get("scheduleA"), () => {
    main();
});

cron(Deno.env.get("scheduleB"), () => {
    main();
});