# Ph.D. Profile Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the background line texture, show Huifan Zhang's completed Ph.D., and link Prof. Pingqiang Zhou's faculty page from centralized CV data.

**Architecture:** Keep factual content in the existing YAML sources and extend the validated education-entry model with an optional advisor object. Render that object semantically in the CV component, while limiting the visual change to the body background declaration.

**Tech Stack:** Astro 7, TypeScript, YAML, Zod, Vitest, CSS, Playwright Core

---

### Task 1: Update degree and advisor content

**Files:**
- Modify: `tests/content.test.ts`
- Modify: `tests/output.test.ts`
- Modify: `src/lib/content.ts`
- Modify: `src/data/site.yml`
- Modify: `src/data/cv.yml`
- Modify: `src/pages/cv.astro`

- [ ] **Step 1: Write failing content and output tests**

Add assertions that the loaded content uses the completed degree and period, contains a structured advisor, and rejects an invalid advisor URL:

```ts
expect(site.role).toBe("Ph.D. in Electronic Science and Technology");
expect(cv.education[0]).toMatchObject({
  degree: "Ph.D. in Electronic Science and Technology",
  period: "2020 – 2026",
  advisor: {
    name: "Prof. Pingqiang Zhou",
    url: "https://faculty.sist.shanghaitech.edu.cn/faculty/zhoupq/home.html",
  },
});
expect(`${siteSource}\n${cvSource}`).not.toMatch(/Ph\.D\. Candidate|Expected Jul\./);

const invalidAdvisor = cvSource.replace(
  "https://faculty.sist.shanghaitech.edu.cn/faculty/zhoupq/home.html",
  "http://faculty.example.edu/advisor",
);
expect(() =>
  loadPortfolioContent({ siteSource, publicationSource, cvSource: invalidAdvisor }),
).toThrow(/cv\.yml.*HTTPS/s);
```

Add an output assertion for the advisor link:

```ts
const advisorLink = cvHtml.match(/<a\b[^>]*>\s*Prof\. Pingqiang Zhou\s*<\/a>/i)?.[0] ?? "";
expect(getAttribute(advisorLink, "href")).toBe(
  "https://faculty.sist.shanghaitech.edu.cn/faculty/zhoupq/home.html",
);
expect(getAttribute(advisorLink, "target")).toBe("_blank");
expect(getAttribute(advisorLink, "rel")?.split(/\s+/)).toEqual(
  expect.arrayContaining(["noopener", "noreferrer"]),
);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm test -- tests/content.test.ts tests/output.test.ts
```

Expected: FAIL because the content still says `Ph.D. Candidate`, the old period contains `Expected`, and `advisor` is not part of the schema or output.

- [ ] **Step 3: Extend the schema and update centralized data**

Define an HTTPS-only validator beside the existing URL validators:

```ts
const httpsUrl = requiredString.refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}, "Must be a valid HTTPS URL");
```

Then change the education entry in `src/lib/content.ts` to accept:

```ts
advisor: z
  .object({
    name: requiredString,
    url: httpsUrl,
  })
  .strict()
  .optional(),
```

Update `src/data/site.yml`:

```yaml
role: Ph.D. in Electronic Science and Technology
```

Update the first entry in `src/data/cv.yml`:

```yaml
- degree: Ph.D. in Electronic Science and Technology
  institution: ShanghaiTech University, Shanghai, China
  period: 2020 – 2026
  advisor:
    name: Prof. Pingqiang Zhou
    url: https://faculty.sist.shanghaitech.edu.cn/faculty/zhoupq/home.html
```

- [ ] **Step 4: Render the optional advisor link**

Replace the old free-text detail output in `src/pages/cv.astro` with:

```astro
{entry.advisor && (
  <p>
    Advisor:{" "}
    <a href={entry.advisor.url} target="_blank" rel="noopener noreferrer">
      {entry.advisor.name}
    </a>
  </p>
)}
```

Keep the existing optional `detail` field and rendering support for future education entries; remove only the first entry's old advisor `detail` value from `cv.yml`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
pnpm test -- tests/content.test.ts tests/output.test.ts
```

Expected: PASS with completed-degree content and a secure advisor link.

- [ ] **Step 6: Commit the content update**

```bash
git add tests/content.test.ts tests/output.test.ts src/lib/content.ts src/data/site.yml src/data/cv.yml src/pages/cv.astro
git commit -m "content: update completed PhD profile"
```

### Task 2: Remove the background lines and verify the site

**Files:**
- Modify: `tests/styles.test.mjs`
- Modify: `src/styles/global.css`
- Modify if generated evidence changes: `docs/verification/astro-bauhaus-redesign.md`
- Modify if generated evidence changes: `docs/verification/assets/*`

- [ ] **Step 1: Write the failing background test**

Add a focused assertion that extracts the body rule and rejects the repeated line texture:

```js
it("uses a plain ivory page background without repeated vertical lines", () => {
  const bodyRule = globalCss.match(/body\s*{([^}]*)}/s)?.[1] ?? "";

  expect(bodyRule).toMatch(/background:\s*var\(--color-ivory\)/);
  expect(bodyRule).not.toMatch(/linear-gradient|background-size|\/\s*6\.25rem/);
});
```

- [ ] **Step 2: Run the style test and verify RED**

Run:

```bash
pnpm test -- tests/styles.test.mjs
```

Expected: FAIL because the body uses a repeating `linear-gradient` spaced every `6.25rem`.

- [ ] **Step 3: Apply the minimal visual change**

Replace the body background stack in `src/styles/global.css` with:

```css
background: var(--color-ivory);
```

Do not change component grids, borders, colors, spacing, typography, or print styles.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
pnpm test -- tests/styles.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run complete automated and browser verification**

Run:

```bash
pnpm run verify
pnpm run verify:browser
git diff --check
```

Expected: all unit/output tests pass, Astro reports no diagnostics, four routes build, all 12 route/viewport layout checks pass, keyboard/reduced-motion checks pass, and the four-page CV PDF keeps entries intact.

- [ ] **Step 6: Inspect and commit verification changes**

Inspect the Home and CV screenshots at mobile and desktop sizes, confirm the background is plain ivory and the updated degree/advisor render correctly, then commit only intended source, test, and regenerated evidence files:

```bash
git add src/styles/global.css tests/styles.test.mjs docs/verification
git commit -m "style: simplify profile background"
```
