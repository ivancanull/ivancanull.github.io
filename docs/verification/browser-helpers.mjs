import { accessSync, constants } from "node:fs";

export const layoutViewports = [
  { name: "desktop", width: 1440, height: 1000, captureArtifacts: true },
  { name: "mobile", width: 390, height: 844, captureArtifacts: true },
  { name: "small", width: 320, height: 568, captureArtifacts: false },
  { name: "tablet", width: 768, height: 1024, captureArtifacts: false },
];

function executableExists(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function readPngDimensions(buffer) {
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    throw new Error("Viewport screenshot is not a valid PNG file");
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

export function browserCandidates(platform = process.platform) {
  if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    ];
  }

  if (platform === "linux") {
    return [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
    ];
  }

  return [];
}

export function resolveBrowserExecutable({
  explicitPath,
  platform = process.platform,
  exists = executableExists,
} = {}) {
  const candidates = explicitPath ? [explicitPath] : browserCandidates(platform);
  const executable = candidates.find((candidate) => exists(candidate));
  if (executable) {
    return executable;
  }

  const explicitDetail = explicitPath ? ` The configured path does not exist or is not executable: ${explicitPath}.` : "";
  throw new Error(
    `No supported browser executable was found.${explicitDetail} Install Google Chrome or Chromium, or set BROWSER_EXECUTABLE_PATH to an executable Chrome/Chromium path.`,
  );
}

export function validateRouteEvidence(actual, expected) {
  if (actual.status < 200 || actual.status >= 300) {
    throw new Error(`${expected.path} expected a 2xx response, received HTTP ${actual.status}`);
  }
  if (actual.title !== expected.title) {
    throw new Error(`${expected.path} expected title "${expected.title}", received "${actual.title}"`);
  }
  if (actual.heading !== expected.heading) {
    throw new Error(`${expected.path} expected heading "${expected.heading}", received "${actual.heading}"`);
  }
  if (!actual.bodyText.includes(expected.stableContent)) {
    throw new Error(`${expected.path} is missing stable content: "${expected.stableContent}"`);
  }

  return { ...actual, passed: true };
}

export function validateExpectedCount(label, actual, expected) {
  if (!Number.isInteger(expected) || expected <= 0) {
    throw new Error(`${label} must define a positive expected count`);
  }
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, found ${actual}`);
  }

  return { actual, expected };
}

function searchable(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

function pagesContaining(pageSearchText, token) {
  const needle = searchable(token);
  if (!needle) {
    throw new Error("PDF evidence tokens must not be empty");
  }

  return pageSearchText.flatMap((page, index) => page.includes(needle) ? [index + 1] : []);
}

export function selectUniquePdfEndToken(pageTexts, candidates) {
  const pageSearchText = pageTexts.map(searchable);
  const endToken = candidates.find((candidate) => pagesContaining(pageSearchText, candidate).length === 1);
  if (!endToken) {
    throw new Error("Protected entry has no trailing token that identifies exactly one PDF page");
  }

  return endToken;
}

export function validatePdfEvidence(pageTexts, expectations) {
  if (pageTexts.length !== expectations.expectedPageCount) {
    throw new Error(`Expected ${expectations.expectedPageCount} PDF pages, found ${pageTexts.length}`);
  }
  if (!expectations.sections?.length || !expectations.protectedEntries?.length) {
    throw new Error("PDF section and protected-entry expectations must not be empty");
  }

  const pageSearchText = pageTexts.map(searchable);
  const educationPages = pagesContaining(pageSearchText, expectations.educationHeading);
  if (educationPages.length !== 1 || educationPages[0] !== 1) {
    throw new Error(`Education must appear on page 1; found on page(s): ${educationPages.join(", ") || "none"}`);
  }

  const sections = expectations.sections.map(({ heading, firstContent }) => {
    const headingPages = pagesContaining(pageSearchText, heading);
    const contentPages = pagesContaining(pageSearchText, firstContent);
    const sharedPages = headingPages.filter((page) => contentPages.includes(page));
    if (headingPages.length !== 1 || contentPages.length !== 1 || sharedPages.length !== 1) {
      throw new Error(
        `Section "${heading}" does not share a page with following content "${firstContent}"`,
      );
    }
    return { heading, firstContent, page: sharedPages[0] };
  });

  const protectedEntries = expectations.protectedEntries.map(({ label, startToken, endToken }) => {
    const startPages = pagesContaining(pageSearchText, startToken);
    const endPages = pagesContaining(pageSearchText, endToken);
    if (startPages.length !== 1) {
      throw new Error(`Protected entry "${label}" appears on ${startPages.length} pages`);
    }
    if (endPages.length !== 1) {
      throw new Error(`Protected entry "${label}" trailing content appears on ${endPages.length} pages`);
    }
    if (startPages[0] !== endPages[0]) {
      throw new Error(`Protected entry "${label}" spans pages ${startPages[0]} and ${endPages[0]}`);
    }
    return { label, startToken, endToken, page: startPages[0] };
  });

  return {
    pageCount: pageTexts.length,
    educationPage: educationPages[0],
    sections,
    protectedEntries,
  };
}
