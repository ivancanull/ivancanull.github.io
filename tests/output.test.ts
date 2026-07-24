import { describe, expect, it } from "vitest";
import html from "../dist/index.html?raw";
import { isExternalHttpUrl, selectedPublications, site } from "../src/lib/content";

function getAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match?.[1] ?? match?.[2];
}

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
