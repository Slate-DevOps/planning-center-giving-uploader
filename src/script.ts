import "https://deno.land/x/dotenv@v3.0.0/load.ts"
import { Importer } from "./importer.ts";
import { Observer, StatusCode, Subject } from "./importerWatcher.ts";

const __dirname = new URL(".", import.meta.url).pathname;

const mailtext = {
  subject: ``,
  text: ``,
  newpeople: `Created new people with the following info:`,
  errors: `Encountered errors on these transactions:`,
  total: 0,
};

const ppCsvPath = `file://${__dirname}../data/${Deno.env.get("PAYDATA")}`;
// const t2tCsvPath = `file://${__dirname}../data/${Deno.env.get("T2TDATA")}`;
const uniCsvPath = `file://${__dirname}../data/${Deno.env.get("UNIDATA")}`;
const t2tCsvPath =
  "C:/Users/ljjb9/Documents/Slate Church/terence/DenoTerence/data/testT2Tbook.csv";

class obsNothing implements Observer {
  update(
    _from: Subject,
    message: string,
    code: StatusCode,
    object?: unknown,
  ): void {
    console.log(`Message: ${message}\nCode: ${code}\n`);
    if (object) {
      console.log(object);
    }
  }
}

const main = async () => {
  mailtext.total = 0;
  const importer = new Importer([new obsNothing()]);
  mailtext.subject = `PC upload summary for ${new Date().toDateString()}`;
  mailtext.text =
    `Hey Slate finance! Its the PC giving bot here with a summary of when the planning center donation upload program was run on ${
      new Date().toDateString()
    }.`;

  if (Deno.env.get("GETPAYPAL") === "Y") {
    try {
      await importer.getPayPal();
    } catch (err) {
      console.error(`Error loading PayPal data from PayPal: ${err}`);
    }
  }
  if (Deno.env.get("PAYDATA") !== "?") {
    try {
      await importer.readDataPP(ppCsvPath);
    } catch (err) {
      console.error(`Error loading PayPal data from file: ${err}`);
    }
  }
  if (Deno.env.get("T2TDATA") !== "?") {
    try {
      await importer.readDataT2T(t2tCsvPath);
    } catch (err) {
      console.error(`Error loading T2T data from file + ${err}`);
    }
  }
  if (Deno.env.get("UNIDATA") !== "?") {
    try {
      await importer.readDataUni(uniCsvPath);
    } catch (err) {
      console.error(`Error loading UNI data from file + ${err}`);
    }
  }
  console.info("done");

  // const transporter = nodemailer.createTransport({
  //   service: 'gmail',
  //   auth: {
  //     user: `${process.env.EML}`,
  //     pass: `${process.env.EMLPS}`
  //   }
  // });

  // const emailInfo = mail.mailOptions(mailtext);

  /*
  transporter.sendMail(emailInfo, function (err: Error | null) {
    if (err) {
      logger.error(err);
    } else {
      logger.info('Email sent: ');
    }
  });
  */
};

main();
