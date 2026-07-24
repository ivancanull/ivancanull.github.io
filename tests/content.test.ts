import { describe, expect, it } from "vitest";
import cvSource from "../src/data/cv.yml?raw";
import publicationSource from "../src/data/publications.yml?raw";
import siteSource from "../src/data/site.yml?raw";
import {
  cv,
  isExternalHttpUrl,
  isSupportedLinkUrl,
  loadPortfolioContent,
  publications,
  resolveSelectedPublications,
  selectedPublications,
  site,
} from "../src/lib/content";

describe("portfolio content", () => {
  it("classifies external HTTP links using normalized URL protocols", () => {
    expect(isExternalHttpUrl("HTTPS://example.com/profile")).toBe(true);
    expect(isExternalHttpUrl("hTtP://example.com/profile")).toBe(true);
    expect(isExternalHttpUrl("mailto:person@example.com")).toBe(false);
  });

  it("loads Huifan Zhang's identity and contact routes", () => {
    expect(site.name).toBe("Huifan Zhang");
    expect(site.email).toBe("zhanghf@shanghaitech.edu.cn");
    expect(site.links.map((link) => link.label)).toEqual(["Email", "GitHub", "Google Scholar", "ORCID"]);
  });

  it("sorts publications newest first and resolves selected IDs", () => {
    expect(publications).toHaveLength(5);
    expect(publications.map((item) => item.year)).toEqual([2026, 2025, 2024, 2023, 2019]);
    expect(selectedPublications.map((item) => item.id)).toEqual(site.selectedPublications);
  });

  it("contains the complete CV section set", () => {
    expect(cv.education).toHaveLength(2);
    expect(cv.projects).toHaveLength(2);
    expect(cv.teaching.length).toBeGreaterThanOrEqual(4);
    expect(Object.keys(cv.skills)).toEqual(["Programming", "EDA / Simulation", "Languages"]);
  });

  it("rejects a CV without the education required by the homepage", () => {
    const emptyEducation = cvSource.replace(/education:\n[\s\S]*?\nprojects:/, "education: []\n\nprojects:");

    expect(() =>
      loadPortfolioContent({ siteSource, publicationSource, cvSource: emptyEducation }),
    ).toThrow(/cv\.yml.*education/s);
  });

  it("accepts mailto links in publication content", () => {
    const publicationWithMailto = publicationSource.replace(
      "url: https://doi.org/10.1109/asp-dac66049.2026.11420493",
      "url: mailto:papers@example.edu",
    );

    const content = loadPortfolioContent({
      siteSource,
      publicationSource: publicationWithMailto,
      cvSource,
    });

    expect(content.publications[0].links[0].url).toBe("mailto:papers@example.edu");
    expect(isExternalHttpUrl(content.publications[0].links[0].url)).toBe(false);
  });

  it("rejects duplicate publication IDs with an actionable error", () => {
    expect(() =>
      resolveSelectedPublications(
        [
          { id: "duplicate", selected: true },
          { id: "duplicate", selected: true },
        ],
        ["duplicate"],
      ),
    ).toThrow('Duplicate publication ID: "duplicate"');
  });

  it("rejects unknown selected publication IDs with an actionable error", () => {
    expect(() => resolveSelectedPublications([{ id: "known", selected: false }], ["missing"])).toThrow(
      'Unknown selected publication ID: "missing"',
    );
  });

  it.each(["https://", "https://exa mple.com", "mailto:", "mailto:not-an-email", "ftp://example.com"])(
    "rejects malformed or unsupported link URL %s",
    (url) => {
      expect(isSupportedLinkUrl(url)).toBe(false);
    },
  );

  it("rejects duplicate selected IDs and selected flag/list mismatches", () => {
    expect(() => resolveSelectedPublications([{ id: "selected", selected: true }], ["selected", "selected"])).toThrow(
      'Duplicate selected publication ID: "selected"',
    );
    expect(() => resolveSelectedPublications([{ id: "listed", selected: false }], ["listed"])).toThrow(
      'Selected publication mismatch: "listed" is listed in site.yml but selected is false',
    );
    expect(() => resolveSelectedPublications([{ id: "flagged", selected: true }], [])).toThrow(
      'Selected publication mismatch: "flagged" is selected in publications.yml but missing from site.yml',
    );
  });

  it.each(["site.yml", "publications.yml", "cv.yml"])(
    "includes %s in YAML parsing diagnostics",
    (filename) => {
      const sources = { siteSource, publicationSource, cvSource };
      const sourceKey = {
        "site.yml": "siteSource",
        "publications.yml": "publicationSource",
        "cv.yml": "cvSource",
      }[filename] as keyof typeof sources;

      expect(() => loadPortfolioContent({ ...sources, [sourceKey]: "invalid: [" })).toThrow(filename);
    },
  );

  it("includes the source filename and field path in schema diagnostics", () => {
    const whitespaceName = siteSource.replace("name: Huifan Zhang", 'name: "   "');

    expect(() => loadPortfolioContent({ siteSource: whitespaceName, publicationSource, cvSource })).toThrow(
      /site\.yml.*name/s,
    );
  });
});
