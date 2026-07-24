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
      test: "vitest run",
      "test:output": "vitest run tests/output.test.ts",
      verify: "pnpm run test && pnpm run check && pnpm run build",
    });
  });
});
