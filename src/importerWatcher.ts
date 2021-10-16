export class Subject {
  observers: Observer[];

  constructor(observers: Observer[]) {
    this.observers = observers;
  }

  // Attach an observer to the subject.
  attach(observer: Observer): void {
    this.observers.push(observer);
  }

  // Detach an observer from the subject.
  detach(observer: Observer): void {
    this.observers.splice(this.observers.indexOf(observer), 1);
  }

  // Notify all observers about an event.
  notify(
    message: string,
    code: StatusCode,
    object?: unknown,
    type?: Type,
  ): void {
    for (const obs of this.observers) {
      obs.update(this, message, code, object, type);
    }
  }
}

export enum StatusCode {
  inprogress = 2,
  error = 3,
  success = 1,
  created = 4,
  read = 5,
  updated = 6,
  deleted = 7,
}

export enum Type {
  donation = 1,
  batch = 2,
  person = 3,
}

/**
 * The Observer interface declares the update method, used by subjects.
 */
export interface Observer {
  // Receive update from subject.
  update(
    from: Subject,
    message: string,
    code: StatusCode,
    object?: unknown,
    type?: Type,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): void;
}
