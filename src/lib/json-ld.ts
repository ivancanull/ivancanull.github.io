export function serializeJsonLd(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("JSON-LD value must be serializable");
  }

  return serialized.replace(/</g, "\\u003c");
}
