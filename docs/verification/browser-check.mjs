import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { chromium } from "playwright-core";
import {
  layoutViewports,
  readPngDimensions,
  resolveBrowserExecutable,
  selectUniquePdfEndToken,
  validateExpectedCount,
  validatePdfEvidence,
  validateRouteEvidence,
} from "./browser-helpers.mjs";

const require = createRequire(import.meta.url);
const astroPackage = require("astro/package.json");
const astroCliPath = resolve(dirname(require.resolve("astro/package.json")), astroPackage.bin.astro);

const baseUrl = process.env.VERIFICATION_BASE_URL ?? "http://127.0.0.1:4321";
const baseUrlObject = new URL(baseUrl);
const browserExecutablePath = resolveBrowserExecutable({
  explicitPath: process.env.BROWSER_EXECUTABLE_PATH,
});
const assetsDirectory = resolve("docs/verification/assets");

mkdirSync(assetsDirectory, { recursive: true });

const routes = [
  {
    name: "home",
    path: "/",
    title: "Huifan Zhang",
    heading: "Huifan Zhang",
    stableContent: "Machine learning for RF circuits",
  },
  {
    name: "publications",
    path: "/publications/",
    title: "Publications | Huifan Zhang",
    heading: "Publications",
    stableContent: "Efficient RF Passive Components Modeling",
  },
  {
    name: "cv",
    path: "/cv/",
    title: "CV | Huifan Zhang",
    heading: "Huifan Zhang",
    stableContent: "Research Projects",
  },
];

const hiddenSelectorExpectations = [
  { selector: ".site-header", expectedCount: 1 },
  { selector: ".site-footer", expectedCount: 1 },
  { selector: ".skip-link", expectedCount: 1 },
  { selector: ".cv-contact", expectedCount: 1 },
  { selector: ".eyebrow", expectedCount: 1 },
  { selector: ".publication-item__selected", expectedCount: 3 },
];
const expectedProtectedEntryCount = 16;
const expectedSectionBodyCount = 5;

async function waitForPage(page, route) {
  const response = await page.goto(new URL(route.path, baseUrlObject).href, { waitUntil: "networkidle" });
  if (!response) {
    throw new Error(`${route.path} did not produce an HTTP navigation response`);
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise((resolveImage) => {
              image.addEventListener("load", resolveImage, { once: true });
              image.addEventListener("error", resolveImage, { once: true });
            }),
      ),
    );
  });

  const identity = await page.evaluate(() => ({
    title: document.title,
    heading: document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    bodyText: document.body.textContent?.replace(/\s+/g, " ").trim() ?? "",
  }));
  const evidence = validateRouteEvidence({ status: response.status(), ...identity }, route);
  return {
    status: evidence.status,
    title: evidence.title,
    heading: evidence.heading,
    stableContent: route.stableContent,
    stableContentPresent: true,
    passed: true,
  };
}

async function waitForCaptureAnimations(page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
}

async function extractPdfPages(pdfBuffer) {
  const document = await getDocument({
    data: new Uint8Array(pdfBuffer),
    disableFontFace: true,
    useSystemFonts: true,
  }).promise;
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      pages.push({
        page: pageNumber,
        width: viewport.width,
        height: viewport.height,
        text: textContent.items.map((item) => "str" in item ? item.str : "").join(" "),
      });
    }
  } finally {
    await document.destroy();
  }
  return pages;
}

async function startPreviewIfNeeded() {
  try {
    await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) });
    return null;
  } catch {
    if (!['127.0.0.1', 'localhost', '::1'].includes(baseUrlObject.hostname)) {
      throw new Error(`VERIFICATION_BASE_URL is unreachable and cannot be started locally: ${baseUrl}`);
    }
  }

  const preview = spawn(
    process.execPath,
    [
      astroCliPath,
      "preview",
      "--host",
      baseUrlObject.hostname,
      "--port",
      baseUrlObject.port || "4321",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let previewOutput = "";
  preview.stdout.on("data", (chunk) => { previewOutput += chunk; });
  preview.stderr.on("data", (chunk) => { previewOutput += chunk; });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (preview.exitCode !== null) {
      throw new Error(`Astro preview exited before it was ready:\n${previewOutput.trim()}`);
    }
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(500) });
      if (response.status >= 200) {
        return preview;
      }
    } catch {
      // Preview is still starting.
    }
    await delay(100);
  }

  preview.kill("SIGTERM");
  throw new Error(`Timed out waiting for Astro preview at ${baseUrl}:\n${previewOutput.trim()}`);
}

async function collectLayout(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const label = (element) =>
      element.getAttribute("aria-label") ||
      element.textContent?.replace(/\s+/g, " ").trim().slice(0, 100) ||
      element.tagName.toLowerCase();
    const rectFor = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top + scrollY),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom + scrollY),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };

    const overflowingElements = [...document.body.querySelectorAll("*")]
      .filter(visible)
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.left < -1 || rect.right > innerWidth + 1)
      .map(({ element, rect }) => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className : "",
        label: label(element),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      }));

    const clippedText = [...document.body.querySelectorAll("p, li, h1, h2, h3, dt, dd, a, span")]
      .filter((element) => visible(element) && (element.textContent?.trim().length ?? 0) > 0)
      .filter((element) => {
        const style = getComputedStyle(element);
        const clipsX = style.overflowX === "hidden" || style.overflowX === "clip";
        const clipsY = style.overflowY === "hidden" || style.overflowY === "clip";
        return (clipsX && element.scrollWidth > element.clientWidth + 1) ||
          (clipsY && element.scrollHeight > element.clientHeight + 1);
      })
      .map((element) => ({ tag: element.tagName.toLowerCase(), label: label(element) }));

    const tooSmallText = [...document.body.querySelectorAll("p, li, h1, h2, h3, dt, dd, a, span")]
      .filter((element) => visible(element) && (element.textContent?.trim().length ?? 0) > 0)
      .filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 11)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        label: label(element),
        fontSize: getComputedStyle(element).fontSize,
      }));

    const flowElements = [...document.querySelectorAll("main > header, main > section, main > aside, main > div")]
      .filter(visible)
      .map((element, domIndex) => ({
        domIndex,
        label: element.getAttribute("aria-label") || element.querySelector("h1, h2")?.textContent?.trim() || element.className,
        ...rectFor(element),
      }));
    const flowOverlaps = flowElements.slice(1).flatMap((current, index) => {
      const previous = flowElements[index];
      return current.top < previous.bottom - 1
        ? [{ previous: previous.label, current: current.label, overlap: previous.bottom - current.top }]
        : [];
    });

    return {
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight },
      dimensions: {
        htmlClientWidth: document.documentElement.clientWidth,
        htmlScrollWidth: document.documentElement.scrollWidth,
        bodyClientWidth: document.body.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        bodyScrollHeight: document.body.scrollHeight,
      },
      overflowingElements,
      clippedText,
      tooSmallText,
      brokenImages: [...document.images]
        .filter((image) => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0)
        .map((image) => ({ src: image.currentSrc || image.src, alt: image.alt })),
      portrait: document.querySelector(".hero__portrait img")
        ? {
            src: document.querySelector(".hero__portrait img").currentSrc,
            naturalWidth: document.querySelector(".hero__portrait img").naturalWidth,
            naturalHeight: document.querySelector(".hero__portrait img").naturalHeight,
            rect: rectFor(document.querySelector(".hero__portrait img")),
          }
        : null,
      flowElements,
      flowOverlaps,
      visualOrderMatchesDom: flowElements.every(
        (element, index) => index === 0 || element.top >= flowElements[index - 1].top,
      ),
    };
  });
}

async function verifyKeyboard(page) {
  await page.evaluate(() => {
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");
    const candidates = [...document.querySelectorAll(focusableSelector)].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    candidates.forEach((element, index) => element.setAttribute("data-verification-focus-index", String(index)));
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute("tabindex");
  });

  const expected = await page.locator("[data-verification-focus-index]").evaluateAll((elements) =>
    elements.map((element) => ({
      index: Number(element.getAttribute("data-verification-focus-index")),
      category: element.classList.contains("skip-link")
        ? "skip"
        : element.classList.contains("site-brand")
          ? "brand"
          : element.classList.contains("site-nav__link")
            ? "navigation"
            : element.closest(".publication-item__links")
              ? "publication"
              : element.classList.contains("contact-link")
                ? "contact"
                : "other",
      label: element.getAttribute("aria-label") || element.textContent?.replace(/\s+/g, " ").trim() || "",
      href: element.getAttribute("href"),
    })),
  );

  const sequence = [];
  for (let index = 0; index < expected.length; index += 1) {
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => {
      const rect = document.activeElement.getBoundingClientRect();
      return rect.top >= -1 && rect.left >= -1 && rect.bottom <= innerHeight + 1 && rect.right <= innerWidth + 1;
    });
    sequence.push(
      await page.evaluate(() => {
        const element = document.activeElement;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          index: Number(element.getAttribute("data-verification-focus-index")),
          label: element.getAttribute("aria-label") || element.textContent?.replace(/\s+/g, " ").trim() || "",
          href: element.getAttribute("href"),
          focusVisible: element.matches(":focus-visible"),
          outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
          inViewport: rect.top >= -1 && rect.left >= -1 && rect.bottom <= innerHeight + 1 && rect.right <= innerWidth + 1,
          rect: {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
          },
          scrollY: Math.round(scrollY),
        };
      }),
    );
  }

  const categories = Object.fromEntries(
    ["skip", "brand", "navigation", "publication", "contact", "other"].map((category) => {
      const indexes = expected.filter((item) => item.category === category).map((item) => item.index);
      return [
        category,
        {
          count: indexes.length,
          allReachedInOrder: indexes.every((expectedIndex) => sequence[expectedIndex]?.index === expectedIndex),
          allFocusVisible: indexes.every((expectedIndex) => sequence[expectedIndex]?.focusVisible),
          allOutlined: indexes.every((expectedIndex) => !sequence[expectedIndex]?.outline.startsWith("0px")),
        },
      ];
    }),
  );

  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute("tabindex");
  });
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => document.activeElement.getBoundingClientRect().top >= 0);
  const skipBeforeActivation = await page.evaluate(() => ({
    isSkipLink: document.activeElement?.classList.contains("skip-link"),
    focusVisible: document.activeElement?.matches(":focus-visible"),
    top: Math.round(document.activeElement?.getBoundingClientRect().top ?? -999),
  }));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  const skipAfterActivation = await page.evaluate(() => ({
    activeId: document.activeElement?.id,
    hash: location.hash,
    mainTop: Math.round(document.querySelector("main")?.getBoundingClientRect().top ?? -999),
  }));

  return {
    expected,
    sequence,
    logicalOrder: sequence.every((item, index) => item.index === index),
    everyTargetFocusVisible: sequence.every((item) => item.focusVisible && !item.outline.startsWith("0px")),
    everyTargetScrolledIntoView: sequence.every((item) => item.inViewport),
    categories,
    skipBeforeActivation,
    skipAfterActivation,
  };
}

async function animationStyles(page) {
  return page.locator(".hero__copy > *, .hero__portrait").evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        label: element.className || element.tagName.toLowerCase(),
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        animationDelay: style.animationDelay,
      };
    }),
  );
}

const previewProcess = await startPreviewIfNeeded();
let browser;
const results = {
  generatedAt: new Date().toISOString(),
  runtime: {
    playwrightCore: require("playwright-core/package.json").version,
    pdfjs: require("pdfjs-dist/package.json").version,
    browserType: "Chromium via an installed Chrome/Chromium executable",
    browserExecutablePath,
  },
  layoutChecks: [],
  screenshots: [],
  keyboard: [],
};

try {
  browser = await chromium.launch({ executablePath: browserExecutablePath, headless: true });
  for (const viewport of layoutViewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "no-preference" });
    const page = await context.newPage();
    for (const route of routes) {
      const routeEvidence = await waitForPage(page, route);
      await waitForCaptureAnimations(page);
      const layout = await collectLayout(page);
      results.layoutChecks.push({
        route: route.path,
        viewport,
        routeEvidence,
        layout,
      });

      if (viewport.captureArtifacts) {
        const fullPageFilename = `${route.name}-${viewport.name}.jpg`;
        await page.screenshot({
          path: resolve(assetsDirectory, fullPageFilename),
          fullPage: true,
          type: "jpeg",
          quality: 82,
        });

        await page.evaluate(() => scrollTo(0, 0));
        const viewportFilename = `${route.name}-${viewport.name}-viewport.png`;
        const viewportScreenshot = await page.screenshot({
          path: resolve(assetsDirectory, viewportFilename),
          fullPage: false,
          type: "png",
        });
        const viewportImageDimensions = readPngDimensions(viewportScreenshot);
        if (
          viewportImageDimensions.width !== viewport.width ||
          viewportImageDimensions.height !== viewport.height
        ) {
          throw new Error(
            `${viewportFilename} is ${viewportImageDimensions.width}x${viewportImageDimensions.height}; expected ${viewport.width}x${viewport.height}`,
          );
        }

        results.screenshots.push({
          route: route.path,
          viewport,
          fullPageArtifact: `docs/verification/assets/${fullPageFilename}`,
          viewportArtifact: `docs/verification/assets/${viewportFilename}`,
          viewportImageDimensions,
          viewportDimensionsMatch: true,
        });
      }
    }
    await context.close();
  }

  for (const route of routes) {
    const context = await browser.newContext({ viewport: layoutViewports[0], reducedMotion: "no-preference" });
    const page = await context.newPage();
    const routeEvidence = await waitForPage(page, route);
    results.keyboard.push({ route: route.path, routeEvidence, ...(await verifyKeyboard(page)) });
    await context.close();
  }

  const normalContext = await browser.newContext({ viewport: layoutViewports[0], reducedMotion: "no-preference" });
  const normalPage = await normalContext.newPage();
  await waitForPage(normalPage, routes[0]);
  const normalAnimations = await animationStyles(normalPage);
  const normalScrollBehavior = await normalPage.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  await normalContext.close();

  const reducedContext = await browser.newContext({ viewport: layoutViewports[0], reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await waitForPage(reducedPage, routes[0]);
  const reducedAnimations = await animationStyles(reducedPage);
  const reducedScrollBehavior = await reducedPage.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  await reducedContext.close();

  results.reducedMotion = {
    normalAnimations,
    normalScrollBehavior,
    reducedAnimations,
    reducedScrollBehavior,
    revealExistsWithoutPreference: normalAnimations.some(
      (animation) => animation.animationName === "rise-in" && animation.animationDuration !== "0s",
    ),
    revealSuppressedWithReduction: reducedAnimations.every(
      (animation) => animation.animationName === "none" || animation.animationDuration === "0s",
    ),
  };

  const printContext = await browser.newContext({ viewport: layoutViewports[0] });
  const printPage = await printContext.newPage();
  await printPage.emulateMedia({ media: "print", reducedMotion: "reduce" });
  const printRouteEvidence = await waitForPage(printPage, routes[2]);
  const printState = await printPage.evaluate((hiddenExpectations) => {
    const visibleElements = [...document.body.querySelectorAll("*")].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    const disallowedTextColors = visibleElements
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className : "",
        color: getComputedStyle(element).color,
      }))
      .filter(({ color }) => color !== "rgb(0, 0, 0)" && color !== "rgba(0, 0, 0, 0)");
    const disallowedBackgrounds = visibleElements
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className : "",
        background: getComputedStyle(element).backgroundColor,
      }))
      .filter(({ background }) =>
        background !== "rgb(255, 255, 255)" &&
        background !== "rgba(0, 0, 0, 0)" &&
        background !== "transparent",
      );
    const protectedEntryDrafts = [...document.querySelectorAll(".cv-entry, .publication-item, .skill-list > div")].map(
      (element) => {
        const label = element.querySelector("h3, dt")?.textContent?.replace(/\s+/g, " ").trim() || "entry";
        const textCandidates = [
          ...element.querySelectorAll(
            ".cv-entry__heading > p, .cv-entry > p, .cv-entry li, dd, .publication-item__authors, .publication-item__venue",
          ),
        ].map((candidate) => candidate.textContent?.replace(/\s+/g, " ").trim() ?? "");
        const linkCandidates = [...element.querySelectorAll('a[href^="http://"], a[href^="https://"]')]
          .map((link) => link.getAttribute("href") ?? "");
        return {
          label,
          candidates: [label, ...textCandidates, ...linkCandidates].filter(Boolean),
          breakInside: getComputedStyle(element).breakInside,
        };
      },
    );
    const protectedEntries = protectedEntryDrafts.map(({ label, candidates, breakInside }) => {
      const contentCandidates = candidates.filter((candidate) => candidate !== label);
      return {
        label,
        startToken: label,
        endTokenCandidates: contentCandidates
          .map((_, index) => contentCandidates.slice(index).join(" "))
          .reverse(),
        breakInside,
      };
    });
    const protectedHeadings = [...document.querySelectorAll(".cv-section h2")].map((element) => ({
      label: element.textContent?.replace(/\s+/g, " ").trim(),
      breakAfter: getComputedStyle(element).breakAfter,
    }));
    const protectedSectionBodies = [...document.querySelectorAll(".cv-section__body")].map((element) => ({
      label: element.closest(".cv-section")?.querySelector("h2")?.textContent?.replace(/\s+/g, " ").trim(),
      firstContent: element.querySelector("h3, dt")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      breakBefore: getComputedStyle(element).breakBefore,
    }));
    return {
      hidden: Object.fromEntries(
        hiddenExpectations.map(({ selector, expectedCount }) => {
          const elements = [...document.querySelectorAll(selector)];
          return [
            selector,
            {
              actualCount: elements.length,
              expectedCount,
              allHidden: elements.every((element) => getComputedStyle(element).display === "none"),
            },
          ];
        }),
      ),
      htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      disallowedTextColors,
      disallowedBackgrounds,
      protectedEntries,
      protectedHeadings,
      protectedSectionBodies,
      allEntriesAvoidBreaks: protectedEntries.every((entry) => entry.breakInside === "avoid"),
      allSectionBodiesAvoidOrphans: protectedSectionBodies.every((body) => body.breakBefore === "avoid"),
    };
  }, hiddenSelectorExpectations);

  for (const [selector, hidden] of Object.entries(printState.hidden)) {
    validateExpectedCount(`Print-hidden selector ${selector}`, hidden.actualCount, hidden.expectedCount);
    if (!hidden.allHidden) {
      throw new Error(`Print-hidden selector ${selector} still has visible elements`);
    }
  }
  validateExpectedCount(
    "Protected CV entries",
    printState.protectedEntries.length,
    expectedProtectedEntryCount,
  );
  validateExpectedCount(
    "CV section bodies",
    printState.protectedSectionBodies.length,
    expectedSectionBodyCount,
  );
  if (printState.protectedEntries.some(({ label, startToken, endTokenCandidates }) =>
    !label || label === "entry" || !startToken || !endTokenCandidates.length
  )) {
    throw new Error("Every protected CV entry must expose stable start and trailing PDF token candidates");
  }
  if (printState.protectedSectionBodies.some(({ label, firstContent }) => !label || !firstContent)) {
    throw new Error("Every CV section must expose a heading and following-content PDF token");
  }

  const pdfPath = resolve(assetsDirectory, "cv-print.pdf");
  const pdfBuffer = await printPage.pdf({ printBackground: true, preferCSSPageSize: true });
  const pdfPages = await extractPdfPages(pdfBuffer);
  const pdfPageTexts = pdfPages.map(({ text }) => text);
  const protectedEntries = printState.protectedEntries.map(({ endTokenCandidates, ...entry }) => ({
    ...entry,
    endToken: selectUniquePdfEndToken(pdfPageTexts, endTokenCandidates),
  }));
  const pdfPageSizes = pdfPages.map(({ page, width, height }) => ({ page, width, height }));
  if (pdfPageSizes.some(({ width, height }) => Math.abs(width - 612) > 0.1 || Math.abs(height - 792) > 0.1)) {
    throw new Error(`CV PDF must use US Letter pages (612x792 points): ${JSON.stringify(pdfPageSizes)}`);
  }
  const pdfBehavior = validatePdfEvidence(
    pdfPageTexts,
    {
      expectedPageCount: 4,
      educationHeading: printState.protectedSectionBodies[0].label,
      sections: printState.protectedSectionBodies.map(({ label, firstContent }) => ({
        heading: label,
        firstContent,
      })),
      protectedEntries: protectedEntries.map(({ label, startToken, endToken }) => ({
        label,
        startToken,
        endToken,
      })),
    },
  );
  writeFileSync(pdfPath, pdfBuffer);
  results.print = {
    ...printState,
    protectedEntries,
    routeEvidence: printRouteEvidence,
    expectedProtectedEntryCount,
    expectedSectionBodyCount,
    pdfBehavior: {
      ...pdfBehavior,
      format: "US Letter",
      expectedPageCount: 4,
      pageSizes: pdfPageSizes,
    },
    artifact: "docs/verification/assets/cv-print.pdf",
  };
  await printContext.close();

  writeFileSync(resolve(assetsDirectory, "browser-results.json"), `${JSON.stringify(results, null, 2)}\n`);
} finally {
  await browser?.close();
  if (previewProcess) {
    previewProcess.kill("SIGTERM");
  }
}

const failedLayouts = results.layoutChecks.filter(({ layout }) =>
  layout.dimensions.htmlScrollWidth > layout.dimensions.htmlClientWidth ||
  layout.dimensions.bodyScrollWidth > layout.dimensions.bodyClientWidth ||
  layout.overflowingElements.length > 0 ||
  layout.clippedText.length > 0 ||
  layout.tooSmallText.length > 0 ||
  layout.brokenImages.length > 0 ||
  layout.flowOverlaps.length > 0 ||
  !layout.visualOrderMatchesDom,
);
const failedKeyboard = results.keyboard.filter(
  (route) =>
    !route.logicalOrder ||
    !route.everyTargetFocusVisible ||
    !route.everyTargetScrolledIntoView ||
    !route.skipBeforeActivation.isSkipLink ||
    !route.skipBeforeActivation.focusVisible ||
    route.skipBeforeActivation.top < 0 ||
    route.skipAfterActivation.activeId !== "main-content" ||
    route.skipAfterActivation.hash !== "#main-content",
);
const failedPrint =
  !Object.values(results.print.hidden).every(
    ({ actualCount, expectedCount, allHidden }) => actualCount === expectedCount && allHidden,
  ) ||
  results.print.protectedEntries.length !== results.print.expectedProtectedEntryCount ||
  results.print.protectedSectionBodies.length !== results.print.expectedSectionBodyCount ||
  results.print.bodyColor !== "rgb(0, 0, 0)" ||
  results.print.disallowedTextColors.length > 0 ||
  results.print.disallowedBackgrounds.length > 0 ||
  !results.print.allEntriesAvoidBreaks ||
  !results.print.allSectionBodiesAvoidOrphans ||
  results.print.pdfBehavior.pageCount !== results.print.pdfBehavior.expectedPageCount ||
  results.print.pdfBehavior.educationPage !== 1;

console.log(
  JSON.stringify(
    {
      pageChecks: results.layoutChecks.length,
      fullPageScreenshots: results.screenshots.length,
      exactViewportScreenshots: results.screenshots.filter(({ viewportDimensionsMatch }) => viewportDimensionsMatch).length,
      failedLayouts: failedLayouts.map(({ route, viewport }) => `${route} ${viewport.name}`),
      keyboardRoutes: results.keyboard.length,
      failedKeyboard: failedKeyboard.map(({ route }) => route),
      reducedMotion: results.reducedMotion,
      failedPrint,
      pdfBehavior: results.print.pdfBehavior,
      printArtifact: results.print.artifact,
    },
    null,
    2,
  ),
);

if (failedLayouts.length > 0 || failedKeyboard.length > 0 || !results.reducedMotion.revealExistsWithoutPreference || !results.reducedMotion.revealSuppressedWithReduction || failedPrint) {
  process.exitCode = 1;
}
