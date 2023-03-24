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
  ): void {
    for (const obs of this.observers) {
      obs.update(this, message, code, object);
    }
  }
}

export enum StatusCode {
  error = 1,
  error_donation = 2,
  error_duplicate_profile = 3,
  success_donation = 100,
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
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): void;
}
