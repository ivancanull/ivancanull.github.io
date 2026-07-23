import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

export default function buildSite() {
  execFileSync(process.execPath, ["node_modules/astro/bin/astro.mjs", "build"], {
    cwd: projectRoot,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
    stdio: "pipe",
  });
}
