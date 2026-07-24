# Astro Bauhaus Redesign

## Purpose

Rebuild `ivancanull.github.io` as a concise English-language academic portfolio for international research and employment opportunities. The site should communicate Huifan Zhang's research focus, strongest results, availability, and contact paths within roughly ten seconds while remaining easy to maintain from a small set of structured data files.

## Goals

- Replace the inherited Academic Pages/Jekyll template with a small Astro static site.
- Use a restrained Bauhaus visual language without compromising academic credibility or readability.
- Keep only Home, Publications, and CV as primary pages.
- Store personal information, publications, and CV entries in three centralized YAML files.
- Preserve the public routes `/`, `/publications/`, and `/cv/`.
- Continue publishing at `https://ivancanull.github.io` through GitHub Pages.
- Produce static HTML with minimal client-side JavaScript.
- Meet responsive, keyboard-accessibility, reduced-motion, and WCAG AA contrast requirements.

## Non-goals

- A content-management system or authenticated editing interface.
- A blog, talks archive, portfolio, teaching page, or template guide.
- Automatic publication import from Google Scholar, ORCID, or external APIs.
- User-selectable themes, dark mode, animation-heavy interactions, or bilingual content.
- Long-term compatibility with both Jekyll and Astro.

## Information Architecture

### Home (`/`)

The homepage is optimized for research hiring and collaboration. Its reading order is:

1. Name, role, institution, availability, and direct contact actions.
2. One-sentence research positioning statement.
3. Three research areas: AI-assisted RF circuit synthesis, machine learning for EDA, and optical neural-network architecture.
4. Three or four selected publications or project outcomes.
5. A short education and current-status summary.
6. Email, GitHub, Google Scholar, and ORCID links.

### Publications (`/publications/`)

Publications appear in reverse chronological order and are grouped by year. Each entry shows title, authors, venue, year, and optional PDF, DOI, code, and project links. Selected works receive a small text marker rather than a separate visual card style.

### CV (`/cv/`)

The CV renders Education, Research Projects, Teaching, Skills, and Publications from shared data. The page is optimized for screen reading and printing. It does not duplicate facts in page markup.

## Technical Architecture

Astro builds a fully static site. No UI framework is included. Components are server-rendered at build time, and browser JavaScript is added only if a mobile navigation behavior cannot be achieved accessibly with HTML and CSS.

Proposed source structure:

```text
src/
  components/
    BauhausMark.astro
    ContactLinks.astro
    CVSection.astro
    PublicationList.astro
    ResearchAreas.astro
    SiteFooter.astro
    SiteHeader.astro
  data/
    cv.yml
    publications.yml
    site.yml
  layouts/
    BaseLayout.astro
  pages/
    404.astro
    cv.astro
    index.astro
    publications.astro
  styles/
    global.css
    print.css
public/
  favicon.svg
  images/
  robots.txt
astro.config.mjs
package.json
```

Components have narrow responsibilities. `BaseLayout` owns document metadata and the shared shell. `SiteHeader` and `SiteFooter` own global navigation. `PublicationList` and `CVSection` transform validated data into semantic markup. `BauhausMark` contains decorative geometry and is hidden from assistive technology.

## Content Model

### `site.yml`

Contains identity, role, institution, availability text, positioning statement, research areas, profile image metadata, social links, and selected-work identifiers.

### `publications.yml`

Contains a list of publications with stable IDs and these fields:

- Required: `id`, `title`, `authors`, `venue`, `year`, and `type`.
- Optional: `doi`, `pdf`, `code`, `project`, `abstract`, and `selected`.

### `cv.yml`

Contains education, research projects, teaching, and skills. Date ranges remain display strings so anticipated graduation and partial dates can be expressed accurately.

Astro loads the three YAML files at build time. A schema validates required fields, valid URLs, unique publication IDs, and numeric publication years. Invalid required data fails the build with the file and field name. Optional links or sections are omitted cleanly when absent.

The same publication objects feed the homepage, Publications page, and CV. The homepage selects entries by stable IDs from `site.yml`, preventing duplicated publication text.

## Visual System

The site uses Bauhaus principles as a system of proportion, geometry, and function rather than as decorative imitation.

- Background: warm ivory.
- Primary foreground: charcoal black.
- Functional accents: red for availability and primary emphasis, blue for links and navigation state, yellow for small geometric markers.
- Large areas remain neutral; primary colors occupy limited, purposeful regions.
- Strong rules, numbered labels, and asymmetric alignment establish hierarchy.
- Desktop layouts use a 12-column grid with deliberate empty space.
- Mobile layouts collapse to a single reading column without changing semantic order.
- Portrait treatment uses a circular crop integrated with simple geometric forms.
- `Archivo` is self-hosted as the main typeface; `IBM Plex Mono` is self-hosted for labels, years, and publication numbering.

## Interaction and Motion

- Navigation always exposes Home, Publications, and CV.
- The active page is conveyed through text and shape, not color alone.
- External links have visible labels; icon-only links are avoided.
- Initial page load may reveal major sections once with short staggered movement.
- Hover and focus states use restrained shifts in underline or background geometry.
- No looping animation, parallax, scroll hijacking, or animated cursor is permitted.
- `prefers-reduced-motion: reduce` disables nonessential transitions and reveal effects.

## Responsive and Accessible Behavior

- Layouts are verified at representative widths of 320, 768, and 1440 pixels.
- Content does not depend on hover, color, or pointer precision.
- Headings follow a logical hierarchy and pages include a skip link and landmark regions.
- Keyboard focus remains clearly visible.
- Decorative geometry uses `aria-hidden="true"` and cannot enter the tab order.
- The profile image has meaningful alternative text.
- Text and interactive controls meet WCAG AA contrast targets.
- Publication links have descriptive accessible names.
- The CV includes print styles that remove navigation and decorative geometry while preserving content hierarchy.

## Metadata and Discovery

`BaseLayout` produces a unique title and description for every page, a canonical URL, Open Graph metadata, favicon references, and basic Person structured data. The build also includes `robots.txt`, a sitemap, and a useful 404 page.

## Deployment

A GitHub Actions workflow runs for pushes to `master` and manual dispatches. It performs dependency installation from a lockfile, data/schema validation, `astro check`, and a production build before deploying the generated `dist/` directory to GitHub Pages.

The Astro configuration uses the canonical site URL `https://ivancanull.github.io` and no base path. Deployment documentation includes the one-time GitHub Pages setting required to use GitHub Actions as the source.

## Migration and Cleanup

Implementation proceeds in this order:

1. Inventory and migrate the current profile, five real publications, CV, profile image, and relevant downloadable files.
2. Build and verify the Astro pages while the current site remains recoverable through Git history.
3. Add the production workflow and verify the built routes locally.
4. Remove the Jekyll layouts, includes, collections, sample posts, sample talks, portfolio entries, guide pages, Ruby configuration, and generated helper assets.
5. Replace the template README with short editing, preview, validation, and deployment instructions for the Astro site.

The migration preserves current source history rather than retaining two live implementations. No automatic redirect is required for removed template-only routes because they contain sample content; the three real public routes remain unchanged.

## Error Handling

- Invalid YAML or schema violations stop the build with an actionable error.
- Missing optional URLs render no empty button or placeholder.
- Missing profile imagery falls back to a geometry-only hero rather than a broken image.
- Failed production builds prevent deployment and leave the currently published site unchanged.
- External links use safe attributes and are checked during verification where tooling permits.

## Verification

Implementation is complete only when:

- Data validation, `astro check`, and the production build pass.
- `/`, `/publications/`, `/cv/`, and `/404.html` render from the production build.
- All five existing real publications are present and no template sample content remains.
- Homepage selected works and CV publications are generated from `publications.yml`.
- Desktop and mobile screenshots show no clipping, overflow, overlap, or illegible text.
- Keyboard navigation, visible focus, reduced motion, semantic landmarks, and image alternative text are verified.
- The CV prints without navigation or decorative clutter.
- Repository documentation accurately explains how to update each YAML file and preview the site.

## Success Criteria

A new visitor can identify Huifan Zhang's research domains, strongest outcomes, current opportunity status, and contact paths within roughly ten seconds. A maintainer can add a publication or update a CV entry by editing one YAML record and running documented validation commands. The final repository contains one active build system, three primary content files, and no inherited Academic Pages sample sections.
