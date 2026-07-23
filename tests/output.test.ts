import { describe, expect, it } from "vitest";
import html from "../dist/index.html?raw";

describe("built site shell", () => {
  it("uses the deployed homepage as its canonical URL", () => {
    expect(html).toMatch(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/ivancanull\.github\.io\/["'][^>]*>/,
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

    expect(routes).toEqual(["/", "/publications/", "/cv/"]);
    expect(navigation).not.toMatch(/Talks|Portfolio/i);
  });

  it("marks Home as the active navigation link", () => {
    const navigation = html.match(/<nav\b[\s\S]*?<\/nav>/)?.[0] ?? "";
    const homeLink = navigation.match(/<a\b[^>]*href=["']\/["'][^>]*>/)?.[0] ?? "";

    expect(homeLink).toMatch(/aria-current=["']page["']/);
  });
});
