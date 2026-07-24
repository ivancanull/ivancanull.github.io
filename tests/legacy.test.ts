import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("legacy cleanup", () => {
  it("removes the Jekyll and template-only surface", () => {
    for (const path of [
      "Gemfile",
      "Dockerfile",
      "docker-compose.yaml",
      ".devcontainer/devcontainer.json",
      "_config.yml",
      "_config_docker.yml",
      "_layouts",
      "_includes",
      "_data",
      "_drafts",
      "_posts",
      "_publications",
      "_talks",
      "_teaching",
      "_portfolio",
      "_pages",
      "_sass",
      "assets",
      "images",
      "talkmap",
      "talkmap.ipynb",
      "talkmap.py",
      "talkmap_out.ipynb",
      "markdown_generator",
      "scripts/cv_markdown_to_json.py",
      "scripts/update_cv_json.sh",
      ".github/ISSUE_TEMPLATE/bug_report.md",
      ".github/ISSUE_TEMPLATE/feature_request.md",
      ".github/workflows/scrape_talks.yml",
      "CONTRIBUTING.md",
    ]) {
      expect(existsSync(path), path).toBe(false);
    }
  });
});
