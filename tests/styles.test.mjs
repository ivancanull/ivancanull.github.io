import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalCss = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

describe("global styles", () => {
  it("keeps authored hex colors within the Bauhaus palette", () => {
    const palette = new Set(["#f4f0e6", "#171713", "#d93a2f", "#1559a6", "#efc33d"]);
    const authoredColors = [...globalCss.matchAll(/#[\da-f]{3,8}\b/gi)].map((match) =>
      match[0].toLowerCase(),
    );

    expect(authoredColors.filter((color) => !palette.has(color))).toEqual([]);
  });

  it("derives translucent colors from palette tokens", () => {
    expect(globalCss).not.toMatch(/\brgba?\(/i);
  });
});
