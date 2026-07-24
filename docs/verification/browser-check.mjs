import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const baseUrl = process.env.VERIFICATION_BASE_URL ?? "http://127.0.0.1:4321";
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const assetsDirectory = resolve("docs/verification/assets");

mkdirSync(assetsDirectory, { recursive: true });

const routes = [
  { name: "home", path: "/" },
  { name: "publications", path: "/publications/" },
  { name: "cv", path: "/cv/" },
];

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

async function waitForPage(page, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
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

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const results = {
  generatedAt: new Date().toISOString(),
  runtime: {
    playwright: require("playwright/package.json").version,
    browserType: "Chromium via installed Google Chrome",
    chromePath,
  },
  screenshots: [],
  keyboard: [],
};

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "no-preference" });
    const page = await context.newPage();
    for (const route of routes) {
      await waitForPage(page, route.path);
      const filename = `${route.name}-${viewport.name}.jpg`;
      await page.screenshot({
        path: resolve(assetsDirectory, filename),
        fullPage: true,
        type: "jpeg",
        quality: 82,
      });
      results.screenshots.push({
        route: route.path,
        viewport,
        artifact: `docs/verification/assets/${filename}`,
        layout: await collectLayout(page),
      });
    }
    await context.close();
  }

  for (const route of routes) {
    const context = await browser.newContext({ viewport: viewports[0], reducedMotion: "no-preference" });
    const page = await context.newPage();
    await waitForPage(page, route.path);
    results.keyboard.push({ route: route.path, ...(await verifyKeyboard(page)) });
    await context.close();
  }

  const normalContext = await browser.newContext({ viewport: viewports[0], reducedMotion: "no-preference" });
  const normalPage = await normalContext.newPage();
  await waitForPage(normalPage, "/");
  const normalAnimations = await animationStyles(normalPage);
  const normalScrollBehavior = await normalPage.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  await normalContext.close();

  const reducedContext = await browser.newContext({ viewport: viewports[0], reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await waitForPage(reducedPage, "/");
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

  const printContext = await browser.newContext({ viewport: viewports[0] });
  const printPage = await printContext.newPage();
  await printPage.emulateMedia({ media: "print", reducedMotion: "reduce" });
  await waitForPage(printPage, "/cv/");
  const printState = await printPage.evaluate(() => {
    const hiddenSelectors = [
      ".site-header",
      ".site-footer",
      ".skip-link",
      ".cv-contact",
      ".eyebrow",
      ".publication-item__selected",
    ];
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
    const protectedEntries = [...document.querySelectorAll(".cv-entry, .publication-item, .skill-list > div")].map(
      (element) => ({
        label: element.querySelector("h3, dt")?.textContent?.replace(/\s+/g, " ").trim() || "entry",
        breakInside: getComputedStyle(element).breakInside,
      }),
    );
    const protectedHeadings = [...document.querySelectorAll(".cv-section h2")].map((element) => ({
      label: element.textContent?.replace(/\s+/g, " ").trim(),
      breakAfter: getComputedStyle(element).breakAfter,
    }));
    const protectedSectionBodies = [...document.querySelectorAll(".cv-section__body")].map((element) => ({
      label: element.closest(".cv-section")?.querySelector("h2")?.textContent?.replace(/\s+/g, " ").trim(),
      breakBefore: getComputedStyle(element).breakBefore,
    }));
    return {
      hidden: Object.fromEntries(
        hiddenSelectors.map((selector) => [
          selector,
          [...document.querySelectorAll(selector)].every((element) => getComputedStyle(element).display === "none"),
        ]),
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
  });
  const pdfPath = resolve(assetsDirectory, "cv-print.pdf");
  await printPage.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });
  results.print = { ...printState, artifact: "docs/verification/assets/cv-print.pdf" };
  await printContext.close();

  writeFileSync(resolve(assetsDirectory, "browser-results.json"), `${JSON.stringify(results, null, 2)}\n`);
} finally {
  await browser.close();
}

const failedLayouts = results.screenshots.filter(({ layout }) =>
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
  !Object.values(results.print.hidden).every(Boolean) ||
  results.print.bodyColor !== "rgb(0, 0, 0)" ||
  results.print.disallowedTextColors.length > 0 ||
  results.print.disallowedBackgrounds.length > 0 ||
  !results.print.allEntriesAvoidBreaks ||
  !results.print.allSectionBodiesAvoidOrphans;

console.log(
  JSON.stringify(
    {
      screenshots: results.screenshots.length,
      failedLayouts: failedLayouts.map(({ route, viewport }) => `${route} ${viewport.name}`),
      keyboardRoutes: results.keyboard.length,
      failedKeyboard: failedKeyboard.map(({ route }) => route),
      reducedMotion: results.reducedMotion,
      failedPrint,
      printArtifact: results.print.artifact,
    },
    null,
    2,
  ),
);

if (failedLayouts.length > 0 || failedKeyboard.length > 0 || !results.reducedMotion.revealExistsWithoutPreference || !results.reducedMotion.revealSuppressedWithReduction || failedPrint) {
  process.exitCode = 1;
}
