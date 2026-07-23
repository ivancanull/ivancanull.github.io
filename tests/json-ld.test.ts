import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "../src/lib/json-ld";

describe("JSON-LD serialization", () => {
  it("escapes less-than characters before embedding JSON in HTML", () => {
    expect(serializeJsonLd({ name: "</script><script>alert(1)</script>" })).toBe(
      '{"name":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}',
    );
  });
});
