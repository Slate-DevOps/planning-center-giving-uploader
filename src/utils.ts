/**
 * Formats a date for use by PCO.
 * @param {string} date - the date in any format parsable by Date()
 * @returns {string} - the date in the format required by PCO
 */
export function formatDate(date: string): string {
    return new Date(date).toISOString();
}

export function validateProperty<Type>(
  object: unknown,
  prop: string | string[],
): Type {
  if (Array.isArray(prop)) {
    const tempProp = hasOwnPropertyInArray(object, prop);
    if (typeof tempProp === "string") {
      prop = tempProp;
    } else {
      throw Error(`Property in: ${prop}, does not exist on ${object}`);
    }
  }
  if (hasOwnProperty(object, prop)) {
    return object[prop] as Type;
  } else {
    throw Error(`Property: ${prop}, does not exist on ${object}`);
  }
}

export function validateObject<Type>(object: unknown, props: string[]): Type {
  let value = object;
  for (const prop of props) {
    value = validateProperty<Type>(value, prop);
  }
  return value as Type;
}

export function hasOwnProperty<X extends unknown, Y extends PropertyKey>(
  obj: X,
  prop: Y,
): obj is X & Record<Y, unknown> {
  return (
    obj && typeof obj === "object" && prop in (obj as Record<string, unknown>)
  );
}

export function hasOwnPropertyInArray<X extends unknown>(
  obj: X,
  prop: string[],
): string | void {
  for (const property of prop) {
    if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj as Record<string, unknown>)) {
        if (key.toLowerCase() === property.toLowerCase()) {
          return key;
        }
      }
    }
  }
}