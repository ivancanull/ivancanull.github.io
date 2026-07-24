import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("legacy cleanup", () => {
  it("removes the Jekyll and template-only surface", () => {
    for (const path of [
      "Gemfile",
      "_layouts",
      "_includes",
      "_posts",
      "_talks",
      "_portfolio",
      "_pages",
      "talkmap",
      "markdown_generator",
    ]) {
      expect(existsSync(path), path).toBe(false);
    }
  });
});
