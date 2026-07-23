import { describe, expect, it } from "vitest";
import {
  cv,
  publications,
  resolveSelectedPublications,
  selectedPublications,
  site,
} from "../src/lib/content";

describe("portfolio content", () => {
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

  it("rejects duplicate publication IDs with an actionable error", () => {
    expect(() =>
      resolveSelectedPublications(
        [
          { id: "duplicate" },
          { id: "duplicate" },
        ],
        ["duplicate"],
      ),
    ).toThrow('Duplicate publication ID: "duplicate"');
  });

  it("rejects unknown selected publication IDs with an actionable error", () => {
    expect(() => resolveSelectedPublications([{ id: "known" }], ["missing"])).toThrow(
      'Unknown selected publication ID: "missing"',
    );
  });
});
