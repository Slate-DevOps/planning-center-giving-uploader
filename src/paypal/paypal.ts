import { validateObject } from "https://deno.land/x/typescript_utils@v0.0.1/utils.ts";

function diffDays(day1: Date, day2: Date): number {
  const diff = day1.valueOf() - day2.valueOf();
  return diff / 1000 / 60 / 60 / 24;
}

/**
 * Gets the transactions from paypal using the credentials provided in the .env file and
 * returns the information needed to put it in planning center
 */
export async function getTransactions(
  startDate: string,
): Promise<
  {
    date: string;
    full_name: string;
    amount: string;
    email: string;
    fund: string;
    transactionId: string;
  }[]
> {
  const transactions: {
    date: string;
    full_name: string;
    amount: string;
    email: string;
    fund: string;
    transactionId: string;
  }[] = [];
  //we need to do this to get a token from paypal to be able to access the transactions
  const res = await getToken();
  const token = await res.json();
  const accessToken = validateObject<string>(token, ["access_token"]);
  //Generate the information needed to set the time frame to get last months donations
  const dateSpan: { start: Date; end: Date }[] = [];

  if (diffDays(new Date(), new Date(startDate)) < 31) {
    const sDate = new Date(startDate);
    sDate.setSeconds(sDate.getSeconds() + 1);
    dateSpan.push({
      start: sDate,
      end: new Date(),
    });
  } else {
    const sDate = new Date(startDate);
    const eDate = new Date(startDate);
    sDate.setSeconds(sDate.getSeconds() + 1);
    eDate.setDate(eDate.getDate() + 30);
    dateSpan.push({
      start: sDate,
      end: eDate,
    });
  }
  for (
    let date = dateSpan[0].end;
    date.toDateString() !== new Date().toDateString();
    date = dateSpan[dateSpan.length - 1].end
  ) {
    if (diffDays(new Date(), new Date(date)) < 31) {
      dateSpan.push({ start: date, end: new Date() });
    } else {
      const eDate = date;
      eDate.setDate(eDate.getDate() + 30);
      dateSpan.push({
        start: date,
        end: eDate,
      });
    }
  }
  for (let index = 0; index < dateSpan.length; index++) {
    //what we need to send to paypal to get the first page of last months transactions
    let uri = `api-m.paypal.com/v1/reporting/transactions?start_date=${
      dateSpan[
        index
      ].start.toISOString()
    }&end_date=${
      dateSpan[
        index
      ].end.toISOString()
    }&fields=all&page_size=100`;
    while (uri) {
      const temp = `https://${uri}`;
      let res;
      try {
        const response = await fetch(temp, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
        res = await response.json();
      } catch (_err) {
        return transactions;
      }

      validateObject<{
        transaction_info: {
          transaction_id: string;
          transaction_initiation_date: string;
          transaction_amount: {
            value: string;
          };
        };
        payer_info: {
          email_address: string;
          payer_name: {
            given_name: string;
            surname: string;
          };
        };
        shipping_info: {
          name: string;
        };
        cart_info: {
          item_details?: [{ item_name: string }];
        };
      }[]>(res, ["transaction_details"]).forEach(
        (trans) => {
          /* Check that the transaction is increasing value and that it has a name. Paypay will send all transactions so
        doing this we can get rid of transactions that are not donations */
          if (
            Number(trans.transaction_info.transaction_amount.value) > 0 &&
            trans.shipping_info.name
          ) {
            const fund = trans.cart_info.item_details !== undefined &&
                trans.cart_info.item_details[0].item_name !== undefined
              ? trans.cart_info.item_details[0].item_name
              : "general";
            transactions.push({
              date: trans.transaction_info.transaction_initiation_date,
              full_name: trans.shipping_info.name.replace(",", ""),
              amount: trans.transaction_info.transaction_amount.value,
              email: trans.payer_info.email_address,
              fund: fund,
              transactionId: trans.transaction_info.transaction_id,
            });
          }
        },
      );
      uri = "";
      validateObject<{ href: string; rel: string }[]>(res, ["links"])
        .forEach((link: { href: string; rel: string }) => {
          if (link.rel === "next") {
            uri = link.href.slice(8);
          }
        });
    }
  }
  return transactions;
}

/**
 * we need to do this to get a token from paypal to be able to access the transactions
 * For more info goto https://developer.paypal.com/docs/api/get-an-access-token-curl/
 */
export async function getToken(): Promise<Response> {
  const url = new URL("https://api-m.paypal.com/v1/oauth2/token");
  url.searchParams.append("grant_type", "client_credentials");
  return await fetch(url, {
    method: "post",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en_US",
      "content-type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " +
        btoa(`${Deno.env.get("PYPID")}:${Deno.env.get("PPS")}`),
    },
  });
}
