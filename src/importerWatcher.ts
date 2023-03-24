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
    errorCode?: ErrorCode,
  ): void {
    for (const obs of this.observers) {
      obs.update(this, message, code, object, errorCode);
    }
  }
}

export enum StatusCode {
  success = 1,
  inprogress = 2,
  error = 3,
  created = 4,
  read = 5,
  updated = 6,
  deleted = 7,
}

export enum ErrorCode {
  generic = 1,
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
    errorCode?: ErrorCode,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): void;
}
