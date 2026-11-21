import { describe, expect, it } from "vitest";
import html from "../dist/index.html?raw";
import publicationsHtml from "../dist/publications/index.html?raw";
import cvHtml from "../dist/cv/index.html?raw";
import notFoundHtml from "../dist/404.html?raw";
import { cv, isExternalHttpUrl, publications, selectedPublications, site } from "../src/lib/content";

function getAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match?.[1] ?? match?.[2];
}

const asHtmlText = (value: string) => value.replaceAll("&", "&amp;");

function elementsWithClass(className: string) {
  return [
    ...html.matchAll(
      new RegExp(
        `<([a-z][\\w-]*)\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`,
        "gi",
      ),
    ),
  ].map((match) => match[0]);
}

function elementsWithClassIn(source: string, className: string) {
  return [
    ...source.matchAll(
      new RegExp(
        `<([a-z][\\w-]*)\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`,
        "gi",
      ),
    ),
  ].map((match) => match[0]);
}

function metadata(source: string) {
  const title = source.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  const descriptionTag = source
    .match(/<meta\b[^>]*>/gi)
    ?.find((tag) => getAttribute(tag, "name") === "description");
  const canonicalTag = source
    .match(/<link\b[^>]*>/gi)
    ?.find((tag) => getAttribute(tag, "rel")?.split(/\s+/).includes("canonical"));

  return {
    title,
    description: getAttribute(descriptionTag ?? "", "content"),
    canonical: getAttribute(canonicalTag ?? "", "href"),
  };
}

describe("built site shell", () => {
  it("uses the deployed homepage as its canonical URL", () => {
    const canonicalLink = html
      .match(/<link\b[^>]*>/gi)
      ?.find((tag) => getAttribute(tag, "rel")?.split(/\s+/).includes("canonical"));

    expect(canonicalLink).toBeDefined();
    expect(getAttribute(canonicalLink ?? "", "href")).toBe(
      "https://ivancanull.github.io/",
    );
  });

  it("provides a skip link and the primary page landmarks", () => {
    expect(html).toMatch(/<a[^>]+href=["']#main-content["'][^>]*>/);
    expect(html).toMatch(/<header(?:\s|>)/);
    expect(html).toMatch(/<main[^>]+id=["']main-content["'][^>]*>/);
    expect(html).toMatch(/<footer(?:\s|>)/);
  });

  it("renders only the intended primary navigation routes", () => {
    const navigation = html.match(/<nav\b[\s\S]*?<\/nav>/)?.[0] ?? "";
    const routes = [...navigation.matchAll(/href=["']([^"']+)["']/g)].map((match) => match[1]);

    expect(routes).toHaveLength(3);
    expect(new Set(routes)).toEqual(new Set(["/", "/publications/", "/cv/"]));
    expect(navigation).not.toMatch(/Talks|Portfolio/i);
  });

  it("marks Home as the active navigation link", () => {
    const navigation = html.match(/<nav\b[\s\S]*?<\/nav>/)?.[0] ?? "";
    const homeLink = navigation.match(/<a\b[^>]*href=["']\/["'][^>]*>/)?.[0] ?? "";

    expect(homeLink).toMatch(/aria-current=["']page["']/);
  });

  it("prevents the generated 404 page from being indexed", () => {
    const robotsTag = notFoundHtml
      .match(/<meta\b[^>]*>/gi)
      ?.find((tag) => getAttribute(tag, "name") === "robots");

    expect(getAttribute(robotsTag ?? "", "content")).toBe("noindex, nofollow");
  });
});

describe("built hiring homepage", () => {
  it("presents Huifan Zhang's research identity and hiring availability", () => {
    const hero =
      html.match(
        /<section\b[^>]*class=["'][^"']*\bhero\b[^"']*["'][^>]*>[\s\S]*?<\/section>/i,
      )?.[0] ?? "";
    const heading = hero.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);

    expect(getAttribute(heading?.[0] ?? "", "id")).toBe("site-title");
    expect(heading?.[1]).toBe(site.name);
    expect(hero).toContain(site.role);
    expect(hero).toContain(site.institution);
    expect(hero).toContain(site.availability);
    expect(hero).toContain(site.tagline);
    expect(hero).toContain(site.summary);
    expect(site.availability).toBe("Seeking postdoctoral research opportunities in EDA");

    const portrait = hero.match(/<img\b[^>]*>/i)?.[0] ?? "";
    expect(getAttribute(portrait, "src")).toBe(site.portrait.src);
    expect(getAttribute(portrait, "alt")).toBe(site.portrait.alt);
    const actions = [...hero.matchAll(/<a\b[^>]*>\s*(Publications|CV)\s*<\/a>/gi)];
    expect(actions.map((action) => [action[1], getAttribute(action[0], "href")])).toEqual([
      ["Publications", "/publications/"],
      ["CV", "/cv/"],
    ]);
  });

  it("renders the three validated research areas as numbered ordered-list items", () => {
    const areas = elementsWithClass("research-area");

    expect(areas).toHaveLength(3);
    expect(areas.map((area) => area.match(/research-area__number[^>]*>\s*(\d{2})\s*</i)?.[1])).toEqual([
      "01",
      "02",
      "03",
    ]);
    expect(
      areas.map((area) => site.researchAreas.findIndex(({ title }) => area.includes(title))),
    ).toEqual([0, 1, 2]);
    const list = html.match(/<ol\b[^>]*class=["'][^"']*\bresearch-areas\b[^>]*>/i)?.[0] ?? "";
    expect(getAttribute(list, "role")).toBe("list");
  });

  it("renders exactly the selected publications in site.yml order", () => {
    const items = elementsWithClass("publication-item");

    expect(items).toHaveLength(3);
    expect(
      items.map((item) => selectedPublications.findIndex(({ title }) => item.includes(title))),
    ).toEqual([0, 1, 2]);
    expect(items[0]).toContain("Efficient RF Passive Components Modeling");
    for (const [index, publication] of selectedPublications.entries()) {
      expect(items[index]).toContain(String(publication.year));
      expect(items[index]).toContain(publication.authors);
      expect(items[index]).toContain(publication.venue.replaceAll("&", "&amp;"));
      expect(items[index]).toMatch(/Selected work/i);
      expect(items[index]).not.toContain(publication.summary);
    }
  });

  it("uses semantic homepage sections and the shared contact links", () => {
    for (const heading of ["Research focus", "Selected work", "Contact"]) {
      expect(html).toMatch(new RegExp(`<h2\\b[^>]*>\\s*${heading}\\s*<\\/h2>`, "i"));
    }

    expect(html).toMatch(/<ul\b[^>]*class=["'][^"']*\bcontact-links\b/i);
    const hrefs = [...html.matchAll(/<a\b[^>]*>/gi)].map((match) =>
      getAttribute(match[0], "href"),
    );
    for (const link of site.links) {
      expect(hrefs).toContain(link.url.replaceAll("&", "&amp;"));
    }
  });

  it("opens only external publication links in a secured new tab", () => {
    const publicationLinks = elementsWithClass("publication-link").map(
      (link) => link.match(/<a\b[^>]*>/i)?.[0] ?? "",
    );

    expect(publicationLinks).not.toHaveLength(0);
    for (const expected of selectedPublications.flatMap((publication) => publication.links)) {
      const link = publicationLinks.find(
        (candidate) => getAttribute(candidate, "href") === expected.url.replaceAll("&", "&amp;"),
      );

      expect(link).toBeDefined();
      if (isExternalHttpUrl(expected.url)) {
        expect(getAttribute(link ?? "", "target")).toBe("_blank");
        expect(getAttribute(link ?? "", "rel")?.split(/\s+/)).toEqual(
          expect.arrayContaining(["noopener", "noreferrer"]),
        );
        expect(getAttribute(link ?? "", "aria-label")).toMatch(/opens in a new tab/i);
      } else {
        expect(getAttribute(link ?? "", "target")).toBeUndefined();
        expect(getAttribute(link ?? "", "rel")).toBeUndefined();
        expect(getAttribute(link ?? "", "aria-label")).not.toMatch(/opens in a new tab/i);
      }
    }
  });
});

describe("built publications page", () => {
  it("builds the route with unique metadata and active navigation", () => {
    expect(publicationsHtml).toMatch(/<!doctype html>/i);
    const pageMetadata = metadata(publicationsHtml);

    expect(pageMetadata.title).toBe("Publications | Huifan Zhang");
    expect(pageMetadata.description).toMatch(/RF|EDA|photonics/i);
    expect(pageMetadata.canonical).toBe("https://ivancanull.github.io/publications/");
    expect(pageMetadata).not.toEqual(metadata(html));
    const navigation = publicationsHtml.match(/<nav\b[\s\S]*?<\/nav>/i)?.[0] ?? "";
    const activeLink = navigation.match(/<a\b[^>]*aria-current=["']page["'][^>]*>/i)?.[0] ?? "";
    expect(getAttribute(activeLink, "href")).toBe("/publications/");
  });

  it("renders all publications once in newest-first year groups", () => {
    const items = elementsWithClassIn(publicationsHtml, "publication-item");

    expect(items).toHaveLength(5);
    for (const publication of publications) {
      expect(items.filter((item) => item.includes(publication.title))).toHaveLength(1);
    }
    expect(
      [...publicationsHtml.matchAll(/<h2\b[^>]*class=["'][^"']*\bpublication-year__heading\b[^"']*["'][^>]*>\s*(\d{4})\s*<\/h2>/gi)].map(
        (match) => Number(match[1]),
      ),
    ).toEqual([2026, 2025, 2024, 2023, 2019]);
  });

  it("gives every DOI link a unique accessible name containing its publication title", () => {
    const doiLinks = [...publicationsHtml.matchAll(/<a\b[^>]*>\s*DOI\s*<\/a>/gi)].map(
      (match) => match[0],
    );
    const accessibleNames = doiLinks.map((link) => getAttribute(link, "aria-label"));

    expect(doiLinks).toHaveLength(publications.length);
    expect(accessibleNames).toEqual(
      publications.map(({ title }) => `DOI for ${title} (opens in a new tab)`),
    );
    expect(new Set(accessibleNames)).toHaveLength(publications.length);
  });

  it("links securely to Google Scholar", () => {
    const scholar = [...publicationsHtml.matchAll(/<a\b[^>]*>\s*Google Scholar\s*<\/a>/gi)][0]?.[0] ?? "";

    expect(getAttribute(scholar, "href")).toMatch(/^https:\/\/scholar\.google\.com\//);
    expect(getAttribute(scholar, "target")).toBe("_blank");
    expect(getAttribute(scholar, "rel")?.split(/\s+/)).toEqual(
      expect.arrayContaining(["noopener", "noreferrer"]),
    );
  });
});

describe("built CV page", () => {
  it("builds the route with unique metadata, active navigation, and print CSS", () => {
    expect(cvHtml).toMatch(/<!doctype html>/i);
    const pageMetadata = metadata(cvHtml);

    expect(pageMetadata.title).toBe("CV | Huifan Zhang");
    expect(pageMetadata.description).toMatch(/curriculum vitae|research/i);
    expect(pageMetadata.canonical).toBe("https://ivancanull.github.io/cv/");
    expect(pageMetadata).not.toEqual(metadata(html));
    expect(pageMetadata).not.toEqual(metadata(publicationsHtml));
    const navigation = cvHtml.match(/<nav\b[\s\S]*?<\/nav>/i)?.[0] ?? "";
    const activeLink = navigation.match(/<a\b[^>]*aria-current=["']page["'][^>]*>/i)?.[0] ?? "";
    expect(getAttribute(activeLink, "href")).toBe("/cv/");
    const printLink = cvHtml
      .match(/<link\b[^>]*>/gi)
      ?.find((tag) => getAttribute(tag, "rel")?.split(/\s+/).includes("stylesheet") && getAttribute(tag, "media") === "print");
    expect(getAttribute(printLink ?? "", "href")).toMatch(/print[^"']*\.css$/);
  });

  it("renders the required CV sections in order", () => {
    const headings = [...cvHtml.matchAll(/<h2\b[^>]*>\s*<span[^>]*>\d{2}<\/span>\s*([^<]+)\s*<\/h2>/gi)].map(
      (match) => match[1].trim(),
    );

    expect(headings).toEqual(["Education", "Research Projects", "Teaching", "Skills", "Publications"]);

    const sections = [...cvHtml.matchAll(/<section\b[^>]*class=["'][^"']*\bcv-section\b[^"']*["'][^>]*>/gi)].map(
      (match) => match[0],
    );
    expect(sections).toHaveLength(5);
    expect(sections.map((section) => getAttribute(section, "aria-labelledby"))).toEqual([
      "education",
      "research-projects",
      "teaching",
      "skills",
      "publications",
    ]);
    for (const headingId of sections.map((section) => getAttribute(section, "aria-labelledby"))) {
      expect(cvHtml).toMatch(new RegExp(`<h2\\b[^>]*id=["']${headingId}["']`, "i"));
    }
  });

  it("represents every CV data entry and all compact publications", () => {
    for (const entry of cv.education) {
      expect(cvHtml).toContain(entry.degree);
      expect(cvHtml).toContain(entry.institution);
      expect(cvHtml).toContain(entry.period);
      if (entry.detail) expect(cvHtml).toContain(entry.detail);
    }
    for (const project of cv.projects) {
      expect(cvHtml).toContain(project.title);
      expect(cvHtml).toContain(asHtmlText(project.organization));
      expect(cvHtml).toContain(project.period);
      for (const highlight of project.highlights) expect(cvHtml).toContain(highlight);
    }
    for (const teaching of cv.teaching) {
      for (const value of Object.values(teaching)) expect(cvHtml).toContain(value);
    }
    for (const [category, values] of Object.entries(cv.skills)) {
      expect(cvHtml).toContain(category);
      for (const value of values) expect(cvHtml).toContain(value);
    }

    const items = elementsWithClassIn(cvHtml, "publication-item");
    expect(items).toHaveLength(5);
    expect(cvHtml).toContain("publication-list--compact");
    for (const publication of publications) expect(cvHtml).toContain(publication.title);
  });

  it("renders the completed Ph.D. and a secure descriptive advisor link", () => {
    expect(cvHtml).toContain("Ph.D. in Electronic Science and Technology");
    expect(cvHtml).toContain("2020 – 2026");
    expect(cvHtml).not.toMatch(/Candidate|Expected/);

    const advisorLink = [...cvHtml.matchAll(/<a\b[^>]*>\s*Prof\. Pingqiang Zhou\s*<\/a>/gi)][0]?.[0] ?? "";
    expect(cvHtml).toMatch(/Advisor:\s*<a\b/i);
    expect(getAttribute(advisorLink, "href")).toBe(
      "https://faculty.sist.shanghaitech.edu.cn/faculty/zhoupq/home.html",
    );
    expect(getAttribute(advisorLink, "target")).toBe("_blank");
    expect(getAttribute(advisorLink, "rel")?.split(/\s+/)).toEqual(
      expect.arrayContaining(["noopener", "noreferrer"]),
    );
    expect(getAttribute(advisorLink, "aria-label")).toBe(
      "Prof. Pingqiang Zhou (opens in a new tab)",
    );
  });

  it("renders the data-driven identity and contact details without client JavaScript", () => {
    expect(cvHtml).toContain(site.name);
    expect(cvHtml).toContain(site.role);
    expect(cvHtml).toContain(site.institution);
    expect(cvHtml).toContain(site.location);
    expect(cvHtml).toContain(site.email);
    for (const link of site.links) expect(cvHtml).toContain(link.url.replaceAll("&", "&amp;"));
    expect(cvHtml).not.toMatch(/<script\b[^>]*(?:type=["']module["']|src=)/i);
  });
});
