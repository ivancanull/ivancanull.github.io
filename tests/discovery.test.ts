import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

function readIfPresent(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

describe("built discovery files", () => {
  it("links the SVG favicon from the document shell", () => {
    const home = readIfPresent("dist/index.html");

    expect(home).toMatch(/<link\b[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.svg["']/i);
  });

  it("builds a useful 404 page", () => {
    const page = readIfPresent("dist/404.html");

    expect(page).not.toBe("");
    expect(page).toMatch(/<h1\b[^>]*>\s*Page not found\s*<\/h1>/i);
    expect(page).toMatch(/<a\b[^>]*href=["']\/["'][^>]*>/i);
  });

  it("publishes crawling instructions and a sitemap index", () => {
    const robots = readIfPresent("dist/robots.txt");

    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://ivancanull.github.io/sitemap-index.xml");
    expect(existsSync("dist/sitemap-index.xml")).toBe(true);
  });

  it("publishes the geometric Bauhaus favicon", () => {
    const favicon = readIfPresent("dist/favicon.svg");

    expect(favicon).toMatch(/<circle\b[^>]*fill=["']#d93a2f["']/i);
    expect(favicon).toMatch(/<rect\b[^>]*fill=["']#1559a6["']/i);
    expect(favicon).toMatch(/<(?:line|path|rect)\b[^>]*(?:stroke|fill)=["']#171713["']/i);
  });
});

describe("GitHub Pages deployment", () => {
  it("uses valid YAML with least-privilege Pages permissions", () => {
    const workflowPath = ".github/workflows/deploy.yml";
    expect(existsSync(workflowPath)).toBe(true);
    if (!existsSync(workflowPath)) return;

    const workflow = parse(readFileSync(workflowPath, "utf8"));
    expect(workflow.permissions).toEqual({
      contents: "read",
      pages: "write",
      "id-token": "write",
    });
  });

  it("uses current stable action majors and uploads the verified build", () => {
    const workflowPath = ".github/workflows/deploy.yml";
    expect(existsSync(workflowPath)).toBe(true);
    if (!existsSync(workflowPath)) return;

    const workflow = parse(readFileSync(workflowPath, "utf8"));
    const buildSteps = workflow.jobs.build.steps;

    expect(buildSteps.map((step: { uses?: string }) => step.uses).filter(Boolean)).toEqual([
      "actions/checkout@v7",
      "pnpm/action-setup@v6",
      "actions/setup-node@v7",
      "actions/configure-pages@v6",
      "actions/upload-pages-artifact@v5",
    ]);
    expect(buildSteps.map((step: { run?: string }) => step.run).filter(Boolean)).toEqual([
      "pnpm install --frozen-lockfile",
      "pnpm run verify",
    ]);
    expect(buildSteps.at(-1).with.path).toBe("dist");
    expect(workflow.jobs.deploy.needs).toBe("build");
    expect(workflow.jobs.deploy.environment.name).toBe("github-pages");
    expect(workflow.jobs.deploy.steps).toEqual(
      expect.arrayContaining([expect.objectContaining({ uses: "actions/deploy-pages@v5" })]),
    );
  });
});
