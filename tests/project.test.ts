import { describe, expect, it } from "vitest";
import pkg from "../package.json";

describe("project configuration", () => {
  it("requires a Node version supported by Astro and pnpm", () => {
    expect(pkg.engines?.node).toBe(">=22.13.0");
  });

  it("exposes the required checked build commands", () => {
    expect(pkg.scripts).toMatchObject({
      dev: "astro dev",
      build: "astro build",
      preview: "astro preview",
      check: "astro check",
      test: "vitest run --exclude tests/output.test.ts",
      "test:output": "astro build && vitest run tests/output.test.ts",
      verify: "pnpm run test && pnpm run test:output && pnpm run check",
    });
  });
});
