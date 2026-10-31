// OrganizeOS fork: the site-template preview tool (website templates wave 1,
// Task A1). It renders a site template through the publish path and checks it
// against the phone bar (OrganizeOS spec
// 2026-10-30-website-template-inventory-design.md, section 2, rule 9):
//
//   corepack pnpm preview:template <template-id> [--palette <file>]
//
// 1. A stub of the OrganizeOS public API on a fixed port answers
//    {"data": []} to every catalog request: an org with no events or forms.
// 2. @organizeos/site-components and the CLI are built: the CLI's prebuild
//    copies the blocks package's lib/ into the site.
// 3. The dump (dump.preview.tsx in the builder's site-templates/preview/)
//    applies the template through the builder's apply path and writes the
//    bundle the publish workflow syncs, with the template's files.
// 4. In a temp folder, the publish workflow's build: `webstudio build` for
//    React Router on Vercel (with --no-assets: the dump copied the files),
//    `npm install`, `react-router build`, served by react-router-serve.
// 5. Chromium takes a full-page screenshot of each page at 1440 and 390 and,
//    at 320, 390, 479, 767 and 991, checks sideways scroll, text under 14px
//    (at 390 and 320), console errors and failed requests.
//
// Writes previews/<template-id>/<palette>/<page-key>-<width>.png ("default"
// is the template's own palette, otherwise the palette file's name) and
// previews/<template-id>/report.json. Exits 1 when a check fails, 2 when the
// tool cannot run.

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builderDir = join(repoRoot, "apps/builder");
const dumpConfig =
  "app/builder/features/organizeos-panel/site-templates/preview/vitest.preview.config.ts";

// The dump writes this port into the bundle's Resources, so it is fixed.
const STUB_API_PORT = 4599;
const STUB_API_BASE_URL = `http://127.0.0.1:${STUB_API_PORT}/api/public/v1`;

const SCREENSHOT_WIDTHS = [1440, 390];
/** Each breakpoint's edge, and the smallest phone. */
const OVERFLOW_WIDTHS = [320, 390, 479, 767, 991];
const SMALL_TEXT_WIDTHS = [390, 320];
const MIN_FONT_SIZE = 14;
const VIEWPORT_HEIGHT = 900;

const usage =
  "Usage: corepack pnpm preview:template <template-id> [--palette <file>]";

/** A command's output, shown only when it fails. */
const run = (command, args, { cwd = repoRoot, env = {} } = {}) =>
  new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = [];
    child.stdout.on("data", (chunk) => output.push(chunk));
    child.stderr.on("data", (chunk) => output.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      process.stderr.write(Buffer.concat(output));
      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });

const startStubApi = () =>
  new Promise((resolveServer, reject) => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [] }));
    });
    server.once("error", (error) =>
      reject(
        error.code === "EADDRINUSE"
          ? new Error(
              `The stub API needs port ${STUB_API_PORT}, which is taken`
            )
          : error
      )
    );
    server.listen(STUB_API_PORT, "127.0.0.1", () => resolveServer(server));
  });

const getFreePort = () =>
  new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });

/** react-router-serve on the site's server build, once it answers. */
const serveSite = async (siteDir) => {
  const { buildManifest } = JSON.parse(
    await readFile(
      join(siteDir, ".vercel", "react-router-build-result.json"),
      "utf8"
    )
  );
  const [serverBundle] = Object.values(buildManifest.serverBundles);
  const port = await getFreePort();
  const server = spawn(
    join(siteDir, "node_modules", ".bin", "react-router-serve"),
    [serverBundle.file],
    {
      cwd: siteDir,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        NODE_ENV: "production",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const output = [];
  server.stdout.on("data", (chunk) => output.push(chunk));
  server.stderr.on("data", (chunk) => output.push(chunk));
  const origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; ; attempt += 1) {
    if (server.exitCode !== null || attempt === 150) {
      server.kill();
      process.stderr.write(Buffer.concat(output));
      throw new Error("react-router-serve did not start");
    }
    try {
      await fetch(origin);
      break;
    } catch {
      await delay(200);
    }
  }
  return { origin, stop: () => server.kill() };
};

/**
 * Playwright's own Chromium when it is installed, else the newest Chromium
 * build in PLAYWRIGHT_BROWSERS_PATH (another Playwright version's).
 */
const launchChromium = async () => {
  try {
    return await chromium.launch();
  } catch (error) {
    if (String(error?.message).includes("Executable doesn't exist") === false) {
      throw error;
    }
    const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
    const builds =
      browsersPath !== undefined && existsSync(browsersPath)
        ? readdirSync(browsersPath)
            .filter((name) => /^chromium-\d+$/.test(name))
            .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)))
        : [];
    const executablePath = builds
      .flatMap((build) => [
        join(browsersPath, build, "chrome-linux64", "chrome"),
        join(browsersPath, build, "chrome-linux", "chrome"),
      ])
      .find((path) => existsSync(path));
    if (executablePath === undefined) {
      throw new Error(
        "Playwright has no Chromium here. Install it: corepack pnpm exec playwright install chromium",
        { cause: error }
      );
    }
    return await chromium.launch({ executablePath });
  }
};

/** In the page: lazy images loaded, fonts and every image decoded. */
const loadEverything = async () => {
  const backgroundUrls = new Set();
  for (const element of document.querySelectorAll("*")) {
    const { backgroundImage } = getComputedStyle(element);
    for (const [, url] of backgroundImage.matchAll(/url\("?([^")]+)"?\)/g)) {
      backgroundUrls.add(url);
    }
  }
  const decode = (image) => image.decode().catch(() => undefined);
  for (const image of document.images) {
    image.loading = "eager";
  }
  await Promise.all([
    document.fonts.ready,
    ...Array.from(document.images, decode),
    ...Array.from(backgroundUrls, (url) => {
      const image = new Image();
      image.src = url;
      return decode(image);
    }),
  ]);
};

/** In the page: each visible text smaller than the minimum, with its size. */
const findSmallText = (minFontSize) => {
  const found = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent.replace(/\s+/g, " ").trim();
    const element = node.parentElement;
    if (
      text === "" ||
      element === null ||
      element.closest("script, style, noscript, template") !== null ||
      element.checkVisibility({ visibilityProperty: true }) === false
    ) {
      continue;
    }
    const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
    if (fontSize < minFontSize) {
      found.push(`${fontSize}px "${text.slice(0, 80)}"`);
    }
  }
  return found;
};

/** One page at one width: its screenshot if asked, and what it shows. */
const inspectPage = async (browser, url, width, screenshotPath) => {
  // a desktop window of the phone's width: no mobile zoom-out to hide a
  // sideways scroll
  const context = await browser.newContext({
    viewport: { width, height: VIEWPORT_HEIGHT },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push(`${request.url()} (${request.failure()?.errorText})`)
  );
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(loadEverything);
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  const smallText = SMALL_TEXT_WIDTHS.includes(width)
    ? (await page.evaluate(findSmallText, MIN_FONT_SIZE)).map(
        (entry) => `${width}px: ${entry}`
      )
    : [];
  if (screenshotPath !== undefined) {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
  await context.close();
  return { overflow, smallText, consoleErrors, failedRequests };
};

const parseArguments = () => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { palette: { type: "string" } },
  });
  if (
    positionals.length !== 1 ||
    /^[a-z0-9-]+$/.test(positionals[0]) === false
  ) {
    throw new Error(usage);
  }
  // pnpm runs the script from the repository root; a relative palette path
  // is the caller's
  const paletteFile =
    values.palette === undefined
      ? undefined
      : resolve(process.env.INIT_CWD ?? process.cwd(), values.palette);
  return {
    templateId: positionals[0],
    paletteFile,
    paletteName:
      paletteFile === undefined ? "default" : basename(paletteFile, ".json"),
  };
};

const main = async () => {
  const { templateId, paletteFile, paletteName } = parseArguments();
  const outDir = join(repoRoot, "previews", templateId);
  const screenshotDir = join(outDir, paletteName);
  const siteDir = await mkdtemp(join(tmpdir(), `preview-${templateId}-`));
  const stopping = [() => rm(siteDir, { recursive: true, force: true })];
  try {
    const stubApi = await startStubApi();
    stopping.push(() => stubApi.close());

    console.info("Building the blocks and the CLI");
    await run("corepack", [
      "pnpm",
      "--filter",
      "@organizeos/site-components...",
      "build",
    ]);
    await run("corepack", ["pnpm", "--filter", "webstudio", "build"]);

    console.info(`Applying ${templateId} (palette: ${paletteName})`);
    await run(
      "corepack",
      ["pnpm", "exec", "vitest", "run", "--config", dumpConfig],
      {
        cwd: builderDir,
        env: {
          PREVIEW_TEMPLATE_ID: templateId,
          PREVIEW_API_BASE_URL: STUB_API_BASE_URL,
          PREVIEW_OUT_DIR: siteDir,
          PREVIEW_PALETTE_FILE: paletteFile ?? "",
        },
      }
    );

    console.info("Building the site");
    await run(
      "node",
      [
        join(repoRoot, "packages/cli/bin.js"),
        "build",
        "--template",
        "react-router",
        "--template",
        "react-router-vercel",
        "--no-assets",
      ],
      { cwd: siteDir }
    );
    await run("npm", ["install"], { cwd: siteDir });
    // the site's Vercel runtime is not here; serve it with the React Router
    // server of the version the site installed
    const { version } = JSON.parse(
      await readFile(
        join(siteDir, "node_modules/react-router/package.json"),
        "utf8"
      )
    );
    await run(
      "npm",
      ["install", "--no-save", `@react-router/serve@${version}`],
      {
        cwd: siteDir,
      }
    );
    await run(join(siteDir, "node_modules/.bin/react-router"), ["build"], {
      cwd: siteDir,
    });
    const site = await serveSite(siteDir);
    stopping.push(site.stop);

    const browser = await launchChromium();
    stopping.push(() => browser.close());
    await rm(screenshotDir, { recursive: true, force: true });
    await mkdir(screenshotDir, { recursive: true });
    const pages = JSON.parse(
      await readFile(join(siteDir, "preview-pages.json"), "utf8")
    );
    const widths = [
      ...new Set([...SCREENSHOT_WIDTHS, ...OVERFLOW_WIDTHS]),
    ].sort((a, b) => b - a);
    const report = { pages: [] };
    for (const { key, path } of pages) {
      console.info(`Checking ${key} (${path})`);
      const pageReport = {
        key,
        overflow: {},
        smallText: new Set(),
        consoleErrors: new Set(),
        failedRequests: new Set(),
      };
      for (const width of widths) {
        const result = await inspectPage(
          browser,
          new URL(path, site.origin).href,
          width,
          SCREENSHOT_WIDTHS.includes(width)
            ? join(screenshotDir, `${key}-${width}.png`)
            : undefined
        );
        if (OVERFLOW_WIDTHS.includes(width)) {
          pageReport.overflow[width] = result.overflow;
        }
        for (const name of ["smallText", "consoleErrors", "failedRequests"]) {
          for (const entry of result[name]) {
            pageReport[name].add(entry);
          }
        }
      }
      report.pages.push({
        key,
        overflow: pageReport.overflow,
        smallText: [...pageReport.smallText],
        consoleErrors: [...pageReport.consoleErrors],
        failedRequests: [...pageReport.failedRequests],
      });
    }
    await writeFile(
      join(outDir, "report.json"),
      `${JSON.stringify(report, null, 2)}\n`
    );

    let failed = false;
    for (const page of report.pages) {
      const faults = [
        ...Object.entries(page.overflow)
          .filter(([, overflows]) => overflows)
          .map(([width]) => `scrolls sideways at ${width}px`),
        ...page.smallText.map((entry) => `small text at ${entry}`),
        ...page.consoleErrors.map((entry) => `console error: ${entry}`),
        ...page.failedRequests.map((entry) => `failed request: ${entry}`),
      ];
      for (const fault of faults) {
        console.error(`${page.key}: ${fault}`);
      }
      failed = failed || faults.length > 0;
    }
    console.info(`Screenshots: ${screenshotDir}`);
    console.info(`Report: ${join(outDir, "report.json")}`);
    return failed ? 1 : 0;
  } finally {
    for (const stop of stopping.reverse()) {
      await stop();
    }
  }
};

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
}
