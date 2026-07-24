# Astro Bauhaus redesign verification

Verified on 2026-07-24 from base commit `6d10232dbe2609a166d3f00ba3278043d2b81d8a`.

## Runtime and commands

The shell did not expose a system Node executable. Verification used Codex's bundled primary runtime, which is compatible with the project's native Rolldown binding:

```sh
export PATH="/Users/huifan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/huifan/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"
export NODE_PATH="/Users/huifan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"
node --version
# v24.14.0
pnpm --version
# 11.9.0
```

The installed browser and bundled automation runtime were:

- Google Chrome 147.0.7727.102 at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- Playwright 1.61.1 from the bundled primary runtime.
- Headless Chromium mode, device scale factor 1.

The clean dependency and baseline repository checks were:

```sh
pnpm install --frozen-lockfile
# Already up to date; exit 0.

pnpm run verify
# 7 test files and 53 tests passed.
# Astro check: 26 files, 0 errors, 0 warnings, 0 hints.
# Astro build: 4 pages built; exit 0.

git diff --check
# No output; exit 0.

git status --short --branch
# ## feat/astro-bauhaus
```

An initial attempt that put `/Applications/Codex.app/Contents/Resources/cua_node/bin` first in `PATH` failed before tests because macOS rejected the Rolldown native binding: the OpenAI-signed app Node process and the native module did not have matching signing identities. Repeating the commands with the bundled primary runtime path above passed without changing dependencies or project code.

The production build was served and inspected with:

```sh
pnpm exec astro preview --host 127.0.0.1 --port 4321
node docs/verification/browser-check.mjs
# 6 page checks, 6 full-page screenshots, 6 exact-viewport screenshots,
# 0 failed layouts, 3 keyboard routes, 0 failed keyboard routes,
# reduced-motion checks passed, print assertions passed; exit 0.
```

`docs/verification/browser-check.mjs` is dependency-free within this repository. It uses Playwright from `NODE_PATH` and the installed Chrome executable, and writes its machine-readable result to `docs/verification/assets/browser-results.json`.

## Responsive visual inspection

Home, Publications, and CV were captured in two distinct forms at both required viewport sizes:

- Exact-viewport PNGs contain only the visible browser viewport and are exactly 1440 x 1000 or 390 x 844 pixels.
- Full-page JPEGs preserve the complete document for end-to-end layout inspection and are taller than the configured viewport.

The harness reads each viewport PNG's IHDR width and height from the screenshot buffer and throws before writing a passing result if either dimension differs from the configured viewport. All six stored results report `viewportDimensionsMatch: true`. A separate `sips` check confirmed the same pixel dimensions on disk. Both artifact sets were directly inspected in addition to the browser assertions.

| Page | Configured viewport | Viewport PNG pixels | Full-page JPEG pixels | HTML client / scroll width | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Home | 1440 x 1000 | 1440 x 1000 | 1440 x 3996 | 1440 / 1440 | Pass |
| Publications | 1440 x 1000 | 1440 x 1000 | 1440 x 3107 | 1440 / 1440 | Pass |
| CV | 1440 x 1000 | 1440 x 1000 | 1440 x 3695 | 1440 / 1440 | Pass |
| Home | 390 x 844 | 390 x 844 | 390 x 4307 | 390 / 390 | Pass |
| Publications | 390 x 844 | 390 x 844 | 390 x 3720 | 390 / 390 | Pass |
| CV | 390 x 844 | 390 x 844 | 390 x 4788 | 390 / 390 | Pass |

Across all six page/viewport combinations, the automated scan found zero elements outside the viewport width, zero overflow-clipped text nodes, zero text elements below 11 px, zero broken images, and zero overlapping top-level content regions. The Home portrait loaded at its natural 720 x 720 dimensions in both viewports. Mobile top-level content positions increased in DOM order on every page; no CSS reordering changed the reading order.

Direct visual inspection found no clipping, overlap, unreadable text, broken portrait treatment, or excessive red/yellow/blue coverage. Primary colors remain limited to identity and navigation marks, small status/selection accents, the portrait geometry, and the Home status panel; the ivory/black content field remains dominant.

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

## Keyboard and focus

Playwright pressed `Tab` through every visible focusable element on each production route, waiting for smooth scrolling and the skip-link transition before sampling the focused rectangle and computed focus style. It then reloaded each route, focused the skip link with `Tab`, and activated it with `Enter`.

| Route | Focusable targets | Primary nav | Publication links | Contact links | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Home | 19 | 3 | 3 | 8 | Pass |
| Publications | 18 | 3 | 5 | 8 | Pass |
| CV | 18 | 3 | 5 | 8 | Pass |

All 55 focus stops matched DOM order, matched `:focus-visible`, had a non-zero 3 px outline, and completed scrolling into the viewport. The first stop on every route was the skip link; after its transition it was onscreen, and activation set focus to `#main-content` and the URL fragment to `#main-content`. The brand and page-action links were included in the full sequence in addition to the table categories. External links were focused but not activated.

## Reduced motion

The Home hero was measured once with `prefers-reduced-motion: no-preference` and once with `prefers-reduced-motion: reduce`:

- Normal preference: all seven reveal targets computed `animation-name: rise-in`, `animation-duration: 0.42s`, and staggered delays from 0 to 0.18 s; root scrolling computed `smooth`.
- Reduced motion: all seven targets computed `animation-name: none` and `animation-duration: 0s`; root scrolling computed `auto`.

This proves the reveal effect exists in the normal mode and is suppressed, rather than merely completed before inspection, in reduced-motion mode.

## CV print verification

The CV was printed by Chrome through Playwright with print media, reduced motion, print backgrounds, and CSS page sizing. The resulting artifact is [cv-print.pdf](assets/cv-print.pdf): four US Letter pages, 612 x 792 points, generated by Chrome/Skia.

Browser-level print assertions confirmed:

- `.site-header`, `.site-footer`, `.skip-link`, `.cv-contact`, `.eyebrow`, and selected-work decorations all computed `display: none`.
- The document background computed white and all visible text computed black; there were zero disallowed foreground or background colors.
- All 16 CV entries/skill rows/publication entries computed `break-inside: avoid`.
- All five section bodies computed `break-before: avoid`, keeping each heading with following content.

The PDF was also rendered to four 144-DPI PNG pages with bundled Poppler and directly inspected. The final pagination is:

1. CV identity and Education.
2. Research Projects, Teaching, and the first Skills row.
3. Remaining Skills rows and the 2026-2024 publications.
4. The 2023 and 2019 publications.

The rendered pages are strict black on white with no site header/footer, action links, colored badges, or decorative geometry. No CV entry is split across pages, every section heading is followed by substantive content, and no text is clipped or overlapping. The email remains as substantive identity text in the CV intro; the separate contact-action block is hidden.

The PDF inspection commands were:

```sh
POPPLER_BIN=/Users/huifan/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/bin
"$POPPLER_BIN/pdfinfo" docs/verification/assets/cv-print.pdf
"$POPPLER_BIN/pdftoppm" -png -r 144 docs/verification/assets/cv-print.pdf tmp/pdfs/cv-final
"$POPPLER_BIN/pdftotext" -layout docs/verification/assets/cv-print.pdf tmp/pdfs/cv-final.txt
```

## Correction made during verification

The first generated print PDF exposed one defect: page 1 contained only the CV identity while Education was unnecessarily deferred to page 2, leaving most of page 1 blank. Systematic comparison showed that `break-after: avoid` on the `<h2>` grid cell applied to the complete grid row during Chromium print fragmentation.

A regression assertion was changed first and observed failing:

```sh
pnpm test -- tests/styles.test.mjs
# 1 failed, 52 passed: the new grid-row pagination expectation was absent.
```

The minimal correction in `src/styles/print.css` restores normal breaking after the grid-cell heading and applies `break-before: avoid` to `.cv-section__body`, binding the body to its heading without treating the complete section row as unbreakable. The focused test then passed with all 53 tests green. The site was rebuilt, the full browser harness reran with exit 0, and the final PDF render confirmed Education now appears on page 1.

The final post-correction gate was repeated with the same bundled runtime:

```sh
pnpm install --frozen-lockfile
# Already up to date; exit 0.

pnpm run verify
# 7 test files and 53 tests passed.
# Astro check: 27 files, 0 errors, 0 warnings, 0 hints.
# Astro build: 4 pages built; exit 0.

git diff --check
# No output; exit 0.
```

## Limitations

- Browser behavior was verified in installed Google Chrome 147 through Playwright, not Safari, Firefox, Edge, or assistive-technology screen readers.
- Print verification used Chrome's real PDF print renderer plus Poppler rendering rather than the interactive macOS print-preview window.
- External destinations were not opened; their keyboard focus, visible outline, labels, and DOM order were verified locally.
