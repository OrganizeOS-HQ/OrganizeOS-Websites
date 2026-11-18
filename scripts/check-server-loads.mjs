// OrganizeOS fork: the builder's server build must load the way production
// loads it, where Node does not load an ES module through require(). Imports
// each server bundle of `apps/builder/build/server` (made by
// `VERCEL=1 pnpm --filter @webstudio-is/builder build`) in a fresh Node
// process with require of ES modules turned off and NODE_ENV=production, and
// fails when there is no bundle or any bundle fails to load.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const serverDir = resolve(import.meta.dirname, "../apps/builder/build/server");

const bundles = existsSync(serverDir)
  ? readdirSync(serverDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(serverDir, entry.name, "index.js"))
      .filter((path) => existsSync(path))
  : [];

if (bundles.length === 0) {
  console.error(
    `No server bundle in ${serverDir}. Build first: VERCEL=1 pnpm --filter @webstudio-is/builder build`
  );
  process.exit(1);
}

let failed = 0;
for (const bundle of bundles) {
  const result = spawnSync(
    process.execPath,
    [
      "--no-experimental-require-module",
      "--input-type=module",
      "-e",
      `await import(${JSON.stringify(pathToFileURL(bundle).href)});`,
    ],
    {
      env: { ...process.env, NODE_ENV: "production" },
      encoding: "utf8",
      timeout: 120_000,
    }
  );
  if (result.status === 0) {
    console.info(`Loads: ${bundle}`);
  } else {
    failed += 1;
    console.error(`Does not load: ${bundle}`);
    console.error(result.stderr || result.error?.message || "");
  }
}

if (failed > 0) {
  process.exit(1);
}
