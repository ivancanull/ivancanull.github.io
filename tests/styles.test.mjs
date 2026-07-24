import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalCss = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
const printCss = readFileSync(new URL("../src/styles/print.css", import.meta.url), "utf8");

function relativeLuminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function colorToken(name) {
  return globalCss.match(new RegExp(`--color-${name}:\\s*(#[\\da-f]{6})`, "i"))?.[1];
}

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

  it("uses high-contrast text and a separate red cue for the active navigation link", () => {
    const textLuminance = relativeLuminance(colorToken("charcoal"));
    const backgroundLuminance = relativeLuminance(colorToken("ivory"));
    const contrast =
      (Math.max(textLuminance, backgroundLuminance) + 0.05) /
      (Math.min(textLuminance, backgroundLuminance) + 0.05);

    expect(contrast).toBeGreaterThanOrEqual(4.5);
    expect(globalCss).toMatch(
      /\.site-nav__link--active\s*{[^}]*color:\s*var\(--color-charcoal\)/s,
    );
    expect(globalCss).toMatch(
      /\.site-nav__link--active::after\s*{[^}]*background:\s*var\(--color-red\)/s,
    );
  });

  it("uses AA-contrast normal text for research-area numbers", () => {
    const foregroundLuminance = relativeLuminance(colorToken("charcoal"));
    const backgroundLuminance = relativeLuminance(colorToken("ivory"));
    const contrast =
      (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
      (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);

    expect(contrast).toBeGreaterThanOrEqual(4.5);
    expect(globalCss).toMatch(
      /\.research-area__number\s*{[^}]*color:\s*var\(--color-charcoal\)/s,
    );
  });
});

describe("print stylesheet", () => {
  it("uses a compact black-on-white document treatment and removes motion", () => {
    expect(printCss).toMatch(/color:\s*(?:#000(?:000)?|black)\b/i);
    expect(printCss).toMatch(/background:\s*(?:#fff(?:fff)?|white)\b/i);
    expect(printCss).toMatch(/font-size:\s*(?:10|11)pt\b/i);
    expect(printCss).toMatch(/animation(?:-duration)?:\s*(?:none|0s)\b/i);
    expect(printCss).toMatch(/transition(?:-duration)?:\s*(?:none|0s)\b/i);
    expect(printCss).toMatch(
      /\.cv-section\s+h2\s+span\s*{[^}]*color:\s*(?:#000(?:000)?|black)\s*!important/is,
    );
  });

  it("keeps each section heading with the content that follows it", () => {
    expect(printCss).toMatch(
      /\.cv-section\s+h2\s*{[^}]*(?:break-after:\s*avoid|page-break-after:\s*avoid)/is,
    );
  });

  it("hides chrome and decorations while preserving substantive CV content", () => {
    expect(printCss).toMatch(/\.site-header[\s\S]*\.site-footer[\s\S]*display:\s*none\b/i);
    expect(printCss).toMatch(/\.cv-contact[\s\S]*display:\s*none\b/i);
    expect(printCss).not.toMatch(/\.cv-section[^{]*{[^}]*display:\s*none\b/is);
    expect(printCss).not.toMatch(/\.publication-item\s*{[^}]*display:\s*none\b/is);
    expect(printCss).toMatch(/(?:break-inside|page-break-inside):\s*avoid\b/i);
  });

  it("prints useful HTTP URLs but not mailto destinations", () => {
    expect(printCss).toMatch(/a\[href\^=["']https?:\/\/["']\]::after/i);
    expect(printCss).toMatch(/a\[href\^=["']mailto:["']\]::after[^{]*{[^}]*content:\s*none\b/is);
  });
});
