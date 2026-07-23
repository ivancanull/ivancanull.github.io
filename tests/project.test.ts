import { describe, expect, it } from "vitest";
import pkg from "../package.json";

describe("project configuration", () => {
  it("exposes the required checked build commands", () => {
    expect(pkg.scripts).toMatchObject({
      dev: "astro dev",
      build: "astro build",
      preview: "astro preview",
      check: "astro check",
      test: "vitest run",
      verify: "pnpm run check && pnpm run test && pnpm run build",
    });
  });
});
