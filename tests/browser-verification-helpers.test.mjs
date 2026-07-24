import { describe, expect, it } from "vitest";
import {
  readPngDimensions,
  resolveBrowserExecutable,
  selectUniquePdfEndToken,
  validateExpectedCount,
  validatePdfEvidence,
  validateRouteEvidence,
} from "../docs/verification/browser-helpers.mjs";

describe("browser verification helpers", () => {
  it("reads dimensions from a PNG IHDR chunk", () => {
    const png = Buffer.alloc(24);
    Buffer.from("89504e470d0a1a0a", "hex").copy(png);
    png.writeUInt32BE(1440, 16);
    png.writeUInt32BE(1000, 20);

    expect(readPngDimensions(png)).toEqual({ width: 1440, height: 1000 });
  });

  it("rejects a non-PNG screenshot buffer", () => {
    expect(() => readPngDimensions(Buffer.alloc(24))).toThrow(/not a valid PNG/i);
  });

  it("resolves an explicit browser and explains a missing prerequisite", () => {
    expect(
      resolveBrowserExecutable({ explicitPath: "/opt/chrome", exists: (path) => path === "/opt/chrome" }),
    ).toBe("/opt/chrome");
    expect(() =>
      resolveBrowserExecutable({ explicitPath: "/missing/chrome", exists: () => false }),
    ).toThrow(/Install Google Chrome or Chromium.*BROWSER_EXECUTABLE_PATH/i);
  });

  it("rejects missing routes and fallback content", () => {
    const expected = {
      path: "/publications/",
      title: "Publications | Huifan Zhang",
      heading: "Publications",
      stableContent: "Efficient RF Passive Components Modeling",
    };

    expect(() =>
      validateRouteEvidence(
        { status: 404, title: "404 | Huifan Zhang", heading: "Page not found", bodyText: "Not found" },
        expected,
      ),
    ).toThrow(/expected a 2xx response/i);
    expect(() =>
      validateRouteEvidence(
        { status: 200, title: "Huifan Zhang", heading: "Huifan Zhang", bodyText: "Portfolio home" },
        expected,
      ),
    ).toThrow(/expected title/i);
  });

  it("accepts stable route identity evidence", () => {
    const expected = {
      path: "/cv/",
      title: "CV | Huifan Zhang",
      heading: "Huifan Zhang",
      stableContent: "Research Projects",
    };
    const actual = {
      status: 200,
      title: "CV | Huifan Zhang",
      heading: "Huifan Zhang",
      bodyText: "Education Research Projects Teaching Skills Publications",
    };

    expect(validateRouteEvidence(actual, expected)).toEqual({ ...actual, passed: true });
  });

  it("requires positive expected counts and exact actual counts", () => {
    expect(validateExpectedCount("protected entries", 16, 16)).toEqual({ actual: 16, expected: 16 });
    expect(() => validateExpectedCount("protected entries", 0, 0)).toThrow(/positive expected count/i);
    expect(() => validateExpectedCount("protected entries", 15, 16)).toThrow(/expected 16, found 15/i);
  });
});

describe("PDF verification evidence", () => {
  const expectations = {
    expectedPageCount: 4,
    educationHeading: "01 Education",
    sections: [
      { heading: "01 Education", firstContent: "Ph.D. Candidate in Electronic Science and Technology" },
      { heading: "02 Research Projects", firstContent: "AI-Driven Electromagnetic Simulation" },
      { heading: "05 Publications", firstContent: "Efficient RF Passive Components Modeling" },
    ],
    protectedEntries: [
      {
        label: "Ph.D. Candidate in Electronic Science and Technology",
        startToken: "Ph.D. Candidate in Electronic Science and Technology",
        endToken: "Advisor Prof. Pingqiang Zhou",
      },
      {
        label: "B.Eng. in Electronic Engineering",
        startToken: "B.Eng. in Electronic Engineering",
        endToken: "2016 2020",
      },
      {
        label: "AI-Driven Electromagnetic Simulation",
        startToken: "AI-Driven Electromagnetic Simulation",
        endToken: "Delivered over 200 speedup",
      },
      {
        label: "Efficient RF Passive Components Modeling",
        startToken: "Efficient RF Passive Components Modeling",
        endToken: "asp-dac66049.2026.11420493",
      },
    ],
  };
  const passingPages = [
    "Huifan Zhang 01 Education Ph.D. Candidate in Electronic Science and Technology Advisor Prof. Pingqiang Zhou B.Eng. in Electronic Engineering 2016 2020",
    "02 Research Projects AI-Driven Electromagnetic Simulation Delivered over 200 speedup",
    "05 Publications Efficient RF Passive Components Modeling asp-dac66049.2026.11420493",
    "Remaining publications",
  ];

  it("combines trailing fields when the final field is ambiguous across PDF pages", () => {
    const pages = [
      "Teaching Assistant UPenn ShanghaiTech Joint Summer Camp 2019 ShanghaiTech University",
      "Another entry ShanghaiTech University",
      "2019 conference publication",
    ];

    expect(
      selectUniquePdfEndToken(pages, ["ShanghaiTech University", "2019 ShanghaiTech University"]),
    ).toBe("2019 ShanghaiTech University");
  });

  it("accepts the expected pagination and unique protected entries", () => {
    const result = validatePdfEvidence(passingPages, expectations);

    expect(result.pageCount).toBe(4);
    expect(result.educationPage).toBe(1);
    expect(result.sections).toHaveLength(3);
    expect(result.protectedEntries).toHaveLength(4);
  });

  it("rejects the original mostly blank first-page regression", () => {
    const pages = [
      "Huifan Zhang",
      "01 Education Ph.D. Candidate in Electronic Science and Technology Advisor Prof. Pingqiang Zhou B.Eng. in Electronic Engineering 2016 2020 02 Research Projects AI-Driven Electromagnetic Simulation Delivered over 200 speedup",
      "05 Publications Efficient RF Passive Components Modeling asp-dac66049.2026.11420493",
      "Remaining publications",
    ];

    expect(() => validatePdfEvidence(pages, expectations)).toThrow(/Education.*page 1/i);
  });

  it("rejects orphaned section headings and split protected entries", () => {
    const orphaned = [
      "Huifan Zhang 01 Education",
      "Ph.D. Candidate in Electronic Science and Technology Advisor Prof. Pingqiang Zhou B.Eng. in Electronic Engineering 2016 2020 02 Research Projects AI-Driven Electromagnetic Simulation Delivered over 200 speedup",
      "05 Publications Efficient RF Passive Components Modeling asp-dac66049.2026.11420493",
      "Remaining publications",
    ];
    expect(() => validatePdfEvidence(orphaned, expectations)).toThrow(/does not share a page/i);

    const duplicated = [...passingPages];
    duplicated[3] += " B.Eng. in Electronic Engineering";
    expect(() => validatePdfEvidence(duplicated, expectations)).toThrow(/appears on 2 pages/i);
  });

  it("rejects a protected entry whose trailing content spills to another page", () => {
    const split = [...passingPages];
    split[0] = split[0].replace(" Advisor Prof. Pingqiang Zhou", "");
    split[1] += " Advisor Prof. Pingqiang Zhou";

    expect(() => validatePdfEvidence(split, expectations)).toThrow(/spans pages 1 and 2/i);
  });

  it("rejects vacuous section and entry expectations", () => {
    expect(() =>
      validatePdfEvidence(passingPages, { ...expectations, sections: [], protectedEntries: [] }),
    ).toThrow(/must not be empty/i);
  });
});
