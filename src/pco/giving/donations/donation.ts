export class Donation {
  uuid: string;
  date: string;
  source: string;
  method: string;
  batch: string;
  amount: number;
  fund: string;
  transactionId?: string;

  constructor(
    uuid: string,
    date: string,
    source: string,
    method: string,
    batch: string,
    amount: number,
    fund: string,
    transactionId?: string,
  ) {
    this.uuid = uuid;
    this.date = date;
    this.source = source;
    this.method = method;
    this.batch = batch;
    this.amount = amount;
    this.fund = fund;
    this.transactionId = transactionId;
  }
}
