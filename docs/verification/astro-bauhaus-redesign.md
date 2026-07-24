# Astro Bauhaus redesign verification

Verified on 2026-07-24 from parent commit `01f4e086a4cc68a45da25e933f1cc9c826a52395`.

## Runtime and commands

Portable prerequisites are Node.js 22.13 or newer, pnpm 11, and an installed Chrome/Chromium-family browser. This verification run used Node.js 24.14.0, pnpm 11.9.0, and Google Chrome 147.0.7727.102 in headless Chromium mode with device scale factor 1.

```sh
node --version
# v24.14.0
pnpm --version
# 11.9.0
```

Browser/PDF automation is provided by exact repository dev dependencies, so no global Node module path or Playwright browser download is required:

- `playwright-core` 1.61.1 drives an already installed browser.
- `pdfjs-dist` 5.4.624 extracts per-page text and page geometry from the generated PDF.
- The harness checks common Google Chrome, Chromium, Edge, and Chrome Canary paths on macOS and common Chrome/Chromium paths on Linux.
- For another installation location, set `BROWSER_EXECUTABLE_PATH=/absolute/path/to/chrome`.
- If no executable is available, the harness stops with installation and environment-variable guidance.

The clean dependency and baseline repository checks were:

```sh
pnpm install --frozen-lockfile
# Already up to date; exit 0.

pnpm run verify
# 8 test files and 77 tests passed.
# Astro check: 29 files, 0 errors, 0 warnings, 0 hints.
# Astro build: 4 pages built; exit 0.

git diff --check
# No output; exit 0.

git status --short --branch
# ## feat/astro-bauhaus
```

The portable production-browser verification command is:

```sh
pnpm install --frozen-lockfile
pnpm run verify:browser
# 12 page/layout checks, 6 full-page screenshots, 6 exact-viewport screenshots,
# 0 failed layouts, 3 keyboard routes, 0 failed keyboard routes,
# reduced-motion, print-style, and PDF pagination assertions passed; exit 0.
```

`pnpm run verify:browser` builds the site, starts and stops `astro preview` when the configured base URL is not already available, discovers the browser executable, and writes machine-readable evidence to `docs/verification/assets/browser-results.json`. `VERIFICATION_BASE_URL` can target an already running deployment.

## Responsive visual inspection

Home, Publications, and CV were captured in two distinct forms at the exact 1440 x 1000 and 390 x 844 screenshot sizes. The same routes receive layout-only checks at 320 x 568 and 768 x 1024, covering every representative width required by the design specification without adding redundant artifacts.

- Exact-viewport PNGs contain only the visible browser viewport and are exactly 1440 x 1000 or 390 x 844 pixels.
- Full-page JPEGs preserve the complete document for end-to-end layout inspection and are taller than the configured viewport.

Before either screenshot type is captured, the harness awaits every document animation's `finished` promise. The separate normal/reduced-motion contexts remain unchanged and still measure the authored animation behavior. Two consecutive browser runs produced identical SHA-256 hashes for all 12 screenshots.

The harness reads each viewport PNG's IHDR width and height from the screenshot buffer and throws before writing a passing result if either dimension differs from the configured viewport. All six stored results report `viewportDimensionsMatch: true`. A separate `sips` check confirmed the same pixel dimensions on disk. Both artifact sets were directly inspected in addition to the browser assertions.

| Page | Configured viewport | Viewport PNG pixels | Full-page JPEG pixels | HTML client / scroll width | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Home | 1440 x 1000 | 1440 x 1000 | 1440 x 3976 | 1440 / 1440 | Pass |
| Publications | 1440 x 1000 | 1440 x 1000 | 1440 x 3107 | 1440 / 1440 | Pass |
| CV | 1440 x 1000 | 1440 x 1000 | 1440 x 3695 | 1440 / 1440 | Pass |
| Home | 390 x 844 | 390 x 844 | 390 x 4266 | 390 / 390 | Pass |
| Publications | 390 x 844 | 390 x 844 | 390 x 3720 | 390 / 390 | Pass |
| CV | 390 x 844 | 390 x 844 | 390 x 4788 | 390 / 390 | Pass |
| Home | 320 x 568 | Not captured | Not captured | 320 / 320 | Pass |
| Publications | 320 x 568 | Not captured | Not captured | 320 / 320 | Pass |
| CV | 320 x 568 | Not captured | Not captured | 320 / 320 | Pass |
| Home | 768 x 1024 | Not captured | Not captured | 768 / 768 | Pass |
| Publications | 768 x 1024 | Not captured | Not captured | 768 / 768 | Pass |
| CV | 768 x 1024 | Not captured | Not captured | 768 / 768 | Pass |

Across all 12 page/viewport combinations, the automated scan found zero elements outside the viewport width, zero overflow-clipped text nodes, zero text elements below 11 px, zero broken images, and zero overlapping top-level content regions. The Home portrait loaded at its natural 720 x 720 dimensions at all four widths. Top-level content positions increased in DOM order on every page; no CSS reordering changed the reading order.

Direct visual inspection found a uniform plain ivory page background with no repeated vertical-line texture, and no clipping, overlap, unreadable text, broken portrait treatment, or excessive red/yellow/blue coverage. Primary colors remain limited to identity and navigation marks, small status/selection accents, the portrait geometry, and the Home status panel; the ivory/black content field remains dominant.

Exact-viewport artifacts:

- [Home desktop viewport](assets/home-desktop-viewport.png)
- [Home mobile viewport](assets/home-mobile-viewport.png)
- [Publications desktop viewport](assets/publications-desktop-viewport.png)
- [Publications mobile viewport](assets/publications-mobile-viewport.png)
- [CV desktop viewport](assets/cv-desktop-viewport.png)
- [CV mobile viewport](assets/cv-mobile-viewport.png)

Full-page artifacts:

- [Home desktop full page](assets/home-desktop.jpg)
- [Home mobile full page](assets/home-mobile.jpg)
- [Publications desktop full page](assets/publications-desktop.jpg)
- [Publications mobile full page](assets/publications-mobile.jpg)
- [CV desktop full page](assets/cv-desktop.jpg)
- [CV mobile full page](assets/cv-mobile.jpg)

## Route identity

Every `page.goto` response is required to be HTTP 2xx before layout evidence is collected. The harness then checks a stable exact document title, exact `<h1>`, and route-specific content token:

| Route | HTTP | Title | Heading | Stable content | Result |
| --- | ---: | --- | --- | --- | --- |
| Home | 200 | Huifan Zhang | Huifan Zhang | Machine learning for RF circuits | Pass |
| Publications | 200 | Publications \| Huifan Zhang | Publications | Efficient RF Passive Components Modeling | Pass |
| CV | 200 | CV \| Huifan Zhang | Huifan Zhang | Research Projects | Pass |

These checks run at all four viewport widths and again before keyboard/print inspection. Unit fixtures prove that an HTTP 404 and a 200 fallback/Home document both fail the route validator, so a missing route cannot produce passing layout evidence.

## Keyboard and focus

Playwright pressed `Tab` through every visible focusable element on each production route, waiting for smooth scrolling and the skip-link transition before sampling the focused rectangle and computed focus style. It then reloaded each route, focused the skip link with `Tab`, and activated it with `Enter`.

| Route | Focusable targets | Primary nav | Publication links | Contact links | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Home | 19 | 3 | 3 | 8 | Pass |
| Publications | 18 | 3 | 5 | 8 | Pass |
| CV | 19 | 3 | 5 | 8 | Pass |

All 56 focus stops matched DOM order, matched `:focus-visible`, had a non-zero 3 px outline, and completed scrolling into the viewport. The first stop on every route was the skip link; after its transition it was onscreen, and activation set focus to `#main-content` and the URL fragment to `#main-content`. The brand, page-action, and CV advisor links were included in the full sequence in addition to the table categories. External links were focused but not activated.

## Reduced motion

The Home hero was measured once with `prefers-reduced-motion: no-preference` and once with `prefers-reduced-motion: reduce`:

- Normal preference: all seven reveal targets computed `animation-name: rise-in`, `animation-duration: 0.42s`, and staggered delays from 0 to 0.18 s; root scrolling computed `smooth`.
- Reduced motion: all seven targets computed `animation-name: none` and `animation-duration: 0s`; root scrolling computed `auto`.

This proves the reveal effect exists in the normal mode and is suppressed, rather than merely completed before inspection, in reduced-motion mode.

## CV print verification

The CV was printed by Chrome through Playwright with print media, reduced motion, print backgrounds, and CSS page sizing. The resulting artifact is [cv-print.pdf](assets/cv-print.pdf): four US Letter pages, 612 x 792 points, generated by Chrome/Skia.

Browser-level print assertions confirmed:

- `.site-header`, `.site-footer`, `.skip-link`, `.cv-contact`, and `.eyebrow` each had the expected non-zero count of 1; selected-work decorations had the expected count of 3; every matched node computed `display: none`.
- The document background computed white and all visible text computed black; there were zero disallowed foreground or background colors.
- The protected entry set had the expected non-zero count of 16, and every entry/skill row/publication computed `break-inside: avoid`.
- The section-body set had the expected non-zero count of 5, and every body computed `break-before: avoid`.

The generated PDF is then parsed in-process by `pdfjs-dist`. Behavioral assertions confirmed:

- Exactly four pages, each exactly US Letter at 612 x 792 points.
- Education and its first entry appear on page 1. The original mostly blank page-1 regression would fail this check.
- Education is on page 1; Research Projects, Teaching, and Skills headings share page 2 with their first content; Publications shares page 3 with its first entry.
- Each of the 16 protected entries has a stable start token and a trailing-content token on the same PDF page: 2 on page 1, 7 on page 2, 5 on page 3, and 2 on page 4. Each selected token identifies exactly one page; when a final field is repeated elsewhere, the harness combines adjacent trailing fields into a unique suffix without dropping the entry's final content.
- The first Education entry contains the exact completed degree `Ph.D. in Electronic Science and Technology`; its trailing token is the structured advisor destination `https://faculty.sist.shanghaitech.edu.cn/faculty/zhoupq/home.html` on the same first page.

The PDF was also rendered to four 144-DPI PNG pages with bundled Poppler and directly inspected. The final pagination is:

1. CV identity and Education.
2. Research Projects, Teaching, and the first Skills row.
3. Remaining Skills rows and the 2026-2024 publications.
4. The 2023 and 2019 publications.

The rendered pages are strict black on white with no site header/footer, action links, colored badges, or decorative geometry. No CV entry is split across pages, every section heading is followed by substantive content, and no text is clipped or overlapping. The email remains as substantive identity text in the CV intro; the separate contact-action block is hidden.

The optional Poppler commands used for the separate visual rendering were:

```sh
pdfinfo docs/verification/assets/cv-print.pdf
pdftoppm -png -r 144 docs/verification/assets/cv-print.pdf tmp/pdfs/cv-final
pdftotext -layout docs/verification/assets/cv-print.pdf tmp/pdfs/cv-final.txt
```

## Correction made during verification

The first generated print PDF exposed one defect: page 1 contained only the CV identity while Education was unnecessarily deferred to page 2, leaving most of page 1 blank. Systematic comparison showed that `break-after: avoid` on the `<h2>` grid cell applied to the complete grid row during Chromium print fragmentation.

A regression assertion was changed first and observed failing:

```sh
pnpm test -- tests/styles.test.mjs
# 1 failed, 52 passed: the new grid-row pagination expectation was absent.
```

The minimal correction in `src/styles/print.css` restores normal breaking after the grid-cell heading and applies `break-before: avoid` to `.cv-section__body`, binding the body to its heading without treating the complete section row as unbreakable. The focused test then passed with all 53 tests green. The site was rebuilt, the full browser harness reran with exit 0, and the final PDF render confirmed Education now appears on page 1.

## Verification harness regression coverage

Focused helper tests were written before the new verification logic. The first run failed because `browser-helpers.mjs` did not exist:

```sh
pnpm exec vitest run tests/browser-verification-helpers.test.mjs
# RED: 1 failed suite; missing browser-helpers.mjs.
```

After the minimal helper implementation, all ten focused tests passed. The fixtures cover valid/invalid PNG headers, explicit missing-browser guidance, HTTP 404 and fallback-route rejection, positive/exact count enforcement, the expected four-page PDF, the old Education-on-page-2 regression, orphaned section content, duplicated protected entries, and vacuous PDF expectations.

```sh
pnpm exec vitest run tests/browser-verification-helpers.test.mjs
# GREEN: 1 file and 10 tests passed.
```

The protected-entry contract was then strengthened from checking a label alone to requiring unique start and trailing-content tokens on the same page. The revised fixtures initially produced three expected failures because the helper still accepted label strings and included an explicit entry split across pages. After the validator learned the new contract, all 11 focused tests passed and the split fixture failed with page-specific evidence when its start and end moved apart.

The first full browser run under that stronger contract exposed a separate evidence defect: the first Teaching entry selected `2019` as its trailing token because it was unique among exact DOM fields, while normalized PDF text also contained a 2019 publication on page 4. A focused regression test was added first and failed because unique PDF-aware suffix selection did not exist. The minimal implementation now prefers the shortest trailing suffix that identifies exactly one PDF page, selecting `2019 ShanghaiTech University` for that entry while still including its final field.

```sh
pnpm exec vitest run tests/browser-verification-helpers.test.mjs
# RED: 1 failed, 11 passed; selectUniquePdfEndToken was not implemented.
# GREEN: 1 file and 12 tests passed.
```

The browser harness was then executed twice through the repository script. Both runs passed all route, layout, keyboard, motion, print-style, and parsed-PDF checks, and all 12 screenshot hashes were identical between runs.

The final post-correction gate was repeated with the pinned repository dependencies:

```sh
pnpm install --frozen-lockfile
# Already up to date; exit 0.

pnpm run verify
# 8 test files and 77 tests passed.
# Astro check: 29 files, 0 errors, 0 warnings, 0 hints.
# Astro build: 4 pages built; exit 0.

git diff --check
# No output; exit 0.
```

## Final review regressions

Final review added test-first coverage for the narrow heading, portrait fallback, DOI names, 404 metadata, and the missing responsive widths. The relevant RED evidence was:

```sh
pnpm exec vitest run tests/styles.test.mjs tests/browser-verification-helpers.test.mjs
# RED: 2 failed; the 320px heading override and 320/768 viewport configuration were absent.

pnpm run verify:browser
# RED: /publications/ failed at 320px; HTML client / scroll width was 320 / 321.

pnpm exec vitest run tests/content.test.ts
# RED: publicAssetExists was undefined.

pnpm exec vitest run tests/output.test.ts
# RED: DOI links all exposed "DOI (opens in a new tab)" and the 404 robots value was absent.
```

The narrow intro type now scales to 3.5rem inside the existing 22.5rem breakpoint. The portrait path is checked against `public/` during the Astro build; a missing path omits both the image and social-image metadata and uses the existing Bauhaus geometry instead. DOI accessible names include their publication titles while the visible text remains `DOI`, and the generated 404 carries `noindex, nofollow`.

Focused GREEN runs passed 22 style/browser-helper tests, 19 content tests, and 18 output tests. The final full browser run checked all three routes at 320, 390, 768, and 1440 pixels with zero failed layouts while retaining exactly the six specified screenshot pairs.

## Plain-background and profile-evidence refresh

Two focused assertions were added against the single standalone screen `body` rule. The RED run captured the intended legacy behavior: the body did not use a plain ivory declaration and still contained both `linear-gradient` and the repeated `6.25rem` texture size, while the other 22 focused tests passed.

```sh
pnpm exec vitest run tests/styles.test.mjs tests/browser-verification-helpers.test.mjs
# RED: 2 failed, 22 passed; the standalone body rule still contained the vertical-line gradient.
# GREEN: 2 files and 24 tests passed after replacing only that background stack.
```

The PDF helper fixtures now model the live completed degree and the advisor's structured HTTPS destination rather than the former candidate label and plain advisor-name suffix. Fresh Home, Publications, and CV desktop/mobile artifacts and `cv-print.pdf` were generated. Direct inspection of the Home and CV full-page and viewport captures confirmed the uniform ivory screen background and unchanged component grids, borders, palette, typography, spacing, and geometry. Direct inspection of all four rendered PDF pages confirmed the exact completed degree, visible advisor link and URL, intact entries, and unchanged four-page pagination.

The final production-browser results contain 12 passing layout checks across 320, 390, 768, and 1440 pixels with matching client/scroll widths and no overflow, clipping, undersized text, broken images, flow overlaps, or DOM/visual-order mismatch. All 56 keyboard stops, the normal/reduced-motion assertions, print-style checks, 16 protected entries, 5 section bodies, and four US Letter PDF pages passed.

## Limitations

- Browser behavior was verified in installed Google Chrome 147 through Playwright, not Safari, Firefox, Edge, or assistive-technology screen readers.
- Print verification used Chrome's real PDF print renderer plus Poppler rendering rather than the interactive macOS print-preview window.
- External destinations were not opened; their keyboard focus, visible outline, labels, and DOM order were verified locally.
