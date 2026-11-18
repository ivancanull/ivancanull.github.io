# Huifan Zhang's research portfolio

An Astro-powered academic portfolio for Huifan Zhang's research, publications, and curriculum vitae.

## Prerequisites

- Node.js 22.13 or newer
- pnpm 11

## Install

Install the locked dependency set:

```sh
pnpm install --frozen-lockfile
```

## Develop

Start the local development server:

```sh
pnpm run dev
```

Astro prints the local preview address in the terminal and reloads the site as files change.

## Edit content

The portfolio's content is maintained in three YAML files:

- `src/data/site.yml` contains Huifan's identity, availability, research areas, portrait, contact links, and selected publication IDs.
- `src/data/publications.yml` contains the full publication catalog, links, summaries, years, and selected-work flags.
- `src/data/cv.yml` contains education, research projects, teaching experience, and skills.

Keep publication IDs unique. When changing selected publications, update both the `selected` field in `publications.yml` and the ordered `selectedPublications` list in `site.yml`.

## Verify

Run the tests, Astro type checks, and production build before publishing:

```sh
pnpm run verify
```

The static site is written to `dist/`.

For production-browser, accessibility, screenshot, and PDF checks, install Google Chrome or Chromium and run:

```sh
pnpm run verify:browser
```

The command builds the site, starts a local preview, and uses the installed browser without downloading a Playwright browser bundle. Common macOS and Linux browser paths are detected automatically. Set `BROWSER_EXECUTABLE_PATH=/absolute/path/to/chrome` when the executable is elsewhere.

## GitHub Pages deployment

The workflow in `.github/workflows/deploy.yml` verifies and deploys the site after a push to `main`. It can also be started manually from the Actions tab.

For the one-time repository setup, open **Settings > Pages** and set **Source** to **GitHub Actions**. A successful workflow publishes `dist/` to `https://ivancanull.github.io`.
