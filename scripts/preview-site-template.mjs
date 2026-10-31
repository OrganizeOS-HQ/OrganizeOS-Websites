// OrganizeOS fork: the site-template preview tool (website templates wave 1,
// Task A1). It renders a site template through the publish path and checks it
// against the phone bar (OrganizeOS spec
// 2026-10-30-website-template-inventory-design.md, section 2, rule 9):
//
//   corepack pnpm preview:template <template-id> [--palette <file>] [--no-events]
//
// 1. A stub of the OrganizeOS public API on a fixed port
//    (site-templates/preview/stub-api.mjs in the builder) answers the events
//    read with three sample events, so the event cards show, and every other
//    catalog request, the forms among them, with {"data": []}. The first
//    event's cover is the previewed template's own thumbnail photo, which the
//    dump (step 3) names; a template whose images do not hold its thumbnail
//    gets the spike fixture's picture. With --no-events the events read is
//    empty too: the blocks' empty state.
// 2. @organizeos/site-components and the CLI are built: the CLI's prebuild
//    copies the blocks package's lib/ into the site.
// 3. The dump (dump.preview.tsx in the builder's site-templates/preview/)
//    applies the template through the builder's apply path and writes the
//    bundle the publish workflow syncs, with the template's files.
// 4. In a temp folder, the publish workflow's build: `webstudio build` for
//    React Router on Vercel (with --no-assets: the dump copied the files),
//    `npm install`, `react-router build`, served by react-router-serve.
// 5. Chromium takes a full-page screenshot of each page at 1440, 820, 390
//    and 320 (the owner sees 1440 and 390; 820 is the tablet range and 320
//    the smallest phone, for review) and, at 320, 390, 479, 767, 768 and
//    991, checks sideways scroll, text under 14px (at 390 and 320), console
//    errors and failed requests; at those widths and 820 it also checks for
//    clipped text, text that runs past its own box or a box around it (three
//    unbreakable headings overlapping in their columns scroll nothing). That
//    check is a heuristic, with known limits: it also reports text that runs
//    past a scroll container on purpose (a row that scrolls sideways) or a
//    clipped track (a Marquee's), and it does not look past an absolutely or
//    fixed positioned element, so such an element's text placed outside its
//    parent is not reported. Templates use neither kind of scroller yet; a
//    finding on one is read by eye before it is fixed.
//
// Writes previews/<template-id>/<run>/<page-key>-<width>.png and
// previews/<template-id>/<run>/report.json, where the run is the palette
// ("default" is the template's own, otherwise the palette file's name),
// followed by ".no-events" for a --no-events run. The report says which
// events answer the run used. Exits 1 when a check fails, 2 when the tool
// cannot run, 130 or 143 when SIGINT or SIGTERM stops it. The temp folder, the
// servers, the browser and every command still running are stopped however
// the tool ends (short of SIGKILL).

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
import { answerStubRequest } from "../apps/builder/app/builder/features/organizeos-panel/site-templates/preview/stub-api.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builderDir = join(repoRoot, "apps/builder");
const dumpConfig =
  "app/builder/features/organizeos-panel/site-templates/preview/vitest.preview.config.ts";

// The dump writes this port into the bundle's Resources, so it is fixed.
const STUB_API_PORT = 4599;
const STUB_API_BASE_URL = `http://127.0.0.1:${STUB_API_PORT}/api/public/v1`;

const SCREENSHOT_WIDTHS = [1440, 820, 390, 320];
/**
 * Each breakpoint's edge, the narrowest tablet (768, an iPad held upright,
 * just above the phone breakpoint) and the smallest phone.
 */
const OVERFLOW_WIDTHS = [320, 390, 479, 767, 768, 991];
const SMALL_TEXT_WIDTHS = [390, 320];
/** The overflow widths and the tablet's, where columns are narrowest. */
const CLIPPED_TEXT_WIDTHS = [...OVERFLOW_WIDTHS, 820];
const MIN_FONT_SIZE = 14;
const VIEWPORT_HEIGHT = 900;

const usage =
  "Usage: corepack pnpm preview:template <template-id> [--palette <file>] [--no-events]";

/** Each signal the tool stops on, and its exit code. */
const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 };
/** How long a stopped command has to exit before it is killed. */
const STOP_GRACE_MS = 5000;

/** What to undo when the tool ends, in the order it was set up. */
const stopping = [];
/** The commands still running, each the leader of its own process group. */
const running = new Set();
/** The cleanup's promise, once it has started. */
let cleanup;
/** The signal that stopped the tool: the failures it causes are not faults. */
let stoppedBy;

/**
 * Undoes `stopping`, last first, once however the tool ends. A step that
 * fails is reported and the others still run, so the error that ended the
 * tool is the one it reports.
 */
const stopAll = () => {
  cleanup ??= (async () => {
    for (const stop of stopping.toReversed()) {
      try {
        await stop();
      } catch (error) {
        console.error(
          `Cleanup failed: ${error instanceof Error ? error.message : error}`
        );
      }
    }
  })();
  return cleanup;
};

/**
 * A command in a process group of its own, so that stopping it also stops
 * what it started (npm's scripts, vitest's workers) and a signal from the
 * terminal reaches only this tool, which stops it.
 */
const spawnCommand = (command, args, options) => {
  if (cleanup !== undefined) {
    throw new Error("The tool is stopping");
  }
  const child = spawn(command, args, { ...options, detached: true });
  running.add(child);
  child.once("exit", () => running.delete(child));
  child.once("error", () => running.delete(child));
  return child;
};

/** A command's process group ended: SIGTERM, then SIGKILL if it lingers. */
const stopCommand = (child) =>
  new Promise((resolveStop) => {
    if (
      child.pid === undefined ||
      child.exitCode !== null ||
      child.signalCode !== null
    ) {
      resolveStop();
      return;
    }
    const signalGroup = (signal) => {
      try {
        process.kill(-child.pid, signal);
      } catch {
        // the group has already gone
      }
    };
    const timer = setTimeout(() => signalGroup("SIGKILL"), STOP_GRACE_MS);
    child.once("exit", () => {
      clearTimeout(timer);
      resolveStop();
    });
    signalGroup("SIGTERM");
  });

const stopCommands = () => Promise.all(Array.from(running, stopCommand));

/** A command's output, shown only when it fails. */
const run = (command, args, { cwd = repoRoot, env = {} } = {}) =>
  new Promise((resolveRun, reject) => {
    const child = spawnCommand(command, args, {
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
      if (stoppedBy === undefined) {
        process.stderr.write(Buffer.concat(output));
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });

/**
 * The stub API, answering the events read as `stub.events` says, with
 * `stub.coverImage` as the sample cover. It reads `stub` on each request, so
 * the cover can be set once the dump has named the template's thumbnail.
 */
const startStubApi = (stub) =>
  new Promise((resolveServer, reject) => {
    const server = createServer(async (request, response) => {
      try {
        const { status, contentType, body } = await answerStubRequest(
          request.url ?? "/",
          { apiBaseUrl: STUB_API_BASE_URL, ...stub }
        );
        response.writeHead(status, { "content-type": contentType });
        response.end(body);
      } catch (error) {
        console.error(
          `The stub API failed: ${error instanceof Error ? error.message : error}`
        );
        response.writeHead(500);
        response.end();
      }
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

/**
 * react-router-serve on the site's server build, once it answers: its
 * origin. The server runs until the commands are stopped.
 */
const serveSite = async (siteDir) => {
  const { buildManifest } = JSON.parse(
    await readFile(
      join(siteDir, ".vercel", "react-router-build-result.json"),
      "utf8"
    )
  );
  const [serverBundle] = Object.values(buildManifest.serverBundles);
  const port = await getFreePort();
  const server = spawnCommand(
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
  let spawnError;
  server.once("error", (error) => {
    spawnError = error;
  });
  const output = [];
  server.stdout.on("data", (chunk) => output.push(chunk));
  server.stderr.on("data", (chunk) => output.push(chunk));
  const origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; ; attempt += 1) {
    if (
      spawnError !== undefined ||
      server.exitCode !== null ||
      server.signalCode !== null ||
      attempt === 150
    ) {
      await stopCommand(server);
      if (stoppedBy === undefined) {
        process.stderr.write(Buffer.concat(output));
      }
      throw new Error(
        spawnError === undefined
          ? "react-router-serve did not start"
          : `react-router-serve did not start: ${spawnError.message}`
      );
    }
    try {
      await fetch(origin);
      break;
    } catch {
      await delay(200);
    }
  }
  return origin;
};

/**
 * Playwright's own Chromium when it is installed, else the newest Chromium
 * build in PLAYWRIGHT_BROWSERS_PATH (another Playwright version's).
 * Playwright's own SIGINT and SIGTERM handlers exit as soon as the browser has
 * closed, before the rest of the cleanup, so they are off: the tool's own
 * handlers close the browser.
 */
const launchChromium = async () => {
  const options = { handleSIGINT: false, handleSIGTERM: false };
  try {
    return await chromium.launch(options);
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
    return await chromium.launch({ ...options, executablePath });
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

/**
 * In the page: each visible text smaller than the minimum, with its size. The
 * fork's AGPL source offer, which every published page ends with, is not the
 * template's text and is 12px by owner decision (2026-10-15), so it is left
 * out.
 */
const findSmallText = (minFontSize) => {
  const found = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent.replace(/\s+/g, " ").trim();
    const element = node.parentElement;
    if (
      text === "" ||
      element === null ||
      element.closest(
        "script, style, noscript, template, [data-organizeos-source-offer]"
      ) !== null ||
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

/**
 * In the page: each visible text wider than the box it is set in, by how far
 * it runs past, rounded up. The boxes are the text's element, if it is not
 * inline, and each element around it up to the body, their padding boxes:
 * text that runs past one overlaps its neighbour or is cut off. An element
 * can grow to an unbreakable heading and run past its column itself, so the
 * text's own element is not enough. The walk stops at an element positioned
 * out of the flow (absolute or fixed), which may sit past its parent on
 * purpose. Words are measured, not the spaces between them: the space a line
 * wraps at hangs past the box, which is not clipping. Text inside an element
 * clipped on purpose (`clip`, as visually hidden text is) is left out, as is
 * a run of less than a pixel, which is rounding.
 */
const findClippedText = () => {
  const found = [];
  const isClippedOnPurpose = (element) => {
    for (let item = element; item !== null; item = item.parentElement) {
      if (getComputedStyle(item).clip !== "auto") {
        return true;
      }
    }
    return false;
  };
  const edges = new Map();
  /** An element's padding box, left and right, or undefined when inline. */
  const edgesOf = (element) => {
    if (edges.has(element) === false) {
      const { display } = getComputedStyle(element);
      if (display === "inline" || display === "contents") {
        edges.set(element, undefined);
      } else {
        const left = element.getBoundingClientRect().left + element.clientLeft;
        edges.set(element, { left, right: left + element.clientWidth });
      }
    }
    return edges.get(element);
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent.replace(/\s+/g, " ").trim();
    const element = node.parentElement;
    if (
      text === "" ||
      element === null ||
      element.closest("script, style, noscript, template") !== null ||
      element.checkVisibility({ visibilityProperty: true }) === false ||
      isClippedOnPurpose(element)
    ) {
      continue;
    }
    const boxes = [];
    for (let item = element; item !== null; item = item.parentElement) {
      const box = edgesOf(item);
      if (box !== undefined) {
        boxes.push({ element: item, ...box });
      }
      const { position } = getComputedStyle(item);
      if (
        item === document.body ||
        position === "absolute" ||
        position === "fixed"
      ) {
        break;
      }
    }
    const range = document.createRange();
    let worst;
    for (const word of node.textContent.matchAll(/\S+/g)) {
      range.setStart(node, word.index);
      range.setEnd(node, word.index + word[0].length);
      for (const rect of range.getClientRects()) {
        if (rect.width === 0) {
          continue;
        }
        for (const box of boxes) {
          const past = Math.max(rect.right - box.right, box.left - rect.left);
          if (past >= 1 && (worst === undefined || past > worst.past)) {
            worst = { past, element: box.element };
          }
        }
      }
    }
    if (worst !== undefined) {
      const tag = (item) => item.tagName.toLowerCase();
      const where =
        worst.element === element
          ? "its box"
          : `the ${tag(worst.element)} around it`;
      found.push(
        `${tag(element)} "${text.slice(0, 80)}" runs ${Math.ceil(worst.past)}px past ${where}`
      );
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
  const clippedText = CLIPPED_TEXT_WIDTHS.includes(width)
    ? (await page.evaluate(findClippedText)).map(
        (entry) => `${width}px: ${entry}`
      )
    : [];
  if (screenshotPath !== undefined) {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
  await context.close();
  return { overflow, smallText, clippedText, consoleErrors, failedRequests };
};

const parseArguments = () => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      palette: { type: "string" },
      "no-events": { type: "boolean", default: false },
    },
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
    events: values["no-events"] ? "none" : "sample",
  };
};

const main = async () => {
  const { templateId, paletteFile, paletteName, events } = parseArguments();
  const runName = events === "none" ? `${paletteName}.no-events` : paletteName;
  const outDir = join(repoRoot, "previews", templateId, runName);
  const siteDir = await mkdtemp(join(tmpdir(), `preview-${templateId}-`));
  stopping.push(
    // retried: a stopped command's last processes may still be writing
    () => rm(siteDir, { recursive: true, force: true, maxRetries: 3 }),
    stopCommands
  );
  try {
    const stub = { events, coverImage: undefined };
    const stubApi = await startStubApi(stub);
    stopping.push(() => stubApi.close());

    console.info("Building the blocks and the CLI");
    await run("corepack", [
      "pnpm",
      "--filter",
      "@organizeos/site-components...",
      "build",
    ]);
    await run("corepack", ["pnpm", "--filter", "webstudio", "build"]);

    console.info(
      `Applying ${templateId} (palette: ${paletteName}, events: ${events})`
    );
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
    const thumbnail = JSON.parse(
      await readFile(join(siteDir, "preview-thumbnail.json"), "utf8")
    );
    stub.coverImage = thumbnail.file ?? undefined;

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
    const origin = await serveSite(siteDir);

    const browser = await launchChromium();
    stopping.push(() => browser.close());
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    const pages = JSON.parse(
      await readFile(join(siteDir, "preview-pages.json"), "utf8")
    );
    const widths = [
      ...new Set([...SCREENSHOT_WIDTHS, ...OVERFLOW_WIDTHS]),
    ].sort((a, b) => b - a);
    const report = { events, pages: [] };
    for (const { key, path } of pages) {
      console.info(`Checking ${key} (${path})`);
      const pageReport = {
        key,
        overflow: {},
        smallText: new Set(),
        clippedText: new Set(),
        consoleErrors: new Set(),
        failedRequests: new Set(),
      };
      for (const width of widths) {
        const result = await inspectPage(
          browser,
          new URL(path, origin).href,
          width,
          SCREENSHOT_WIDTHS.includes(width)
            ? join(outDir, `${key}-${width}.png`)
            : undefined
        );
        if (OVERFLOW_WIDTHS.includes(width)) {
          pageReport.overflow[width] = result.overflow;
        }
        for (const name of [
          "smallText",
          "clippedText",
          "consoleErrors",
          "failedRequests",
        ]) {
          for (const entry of result[name]) {
            pageReport[name].add(entry);
          }
        }
      }
      report.pages.push({
        key,
        overflow: pageReport.overflow,
        smallText: [...pageReport.smallText],
        clippedText: [...pageReport.clippedText],
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
        ...page.clippedText.map((entry) => `clipped text at ${entry}`),
        ...page.consoleErrors.map((entry) => `console error: ${entry}`),
        ...page.failedRequests.map((entry) => `failed request: ${entry}`),
      ];
      for (const fault of faults) {
        console.error(`${page.key}: ${fault}`);
      }
      failed = failed || faults.length > 0;
    }
    console.info(`Screenshots: ${outDir}`);
    console.info(`Report: ${join(outDir, "report.json")}`);
    return failed ? 1 : 0;
  } finally {
    await stopAll();
  }
};

// Node's default for these signals exits at once, skipping the cleanup.
for (const [signal, exitCode] of Object.entries(SIGNAL_EXIT_CODES)) {
  process.on(signal, async () => {
    // a repeated signal: the cleanup is already under way
    if (stoppedBy !== undefined) {
      return;
    }
    stoppedBy = signal;
    console.error(`${signal}: stopping`);
    await stopAll();
    process.exit(exitCode);
  });
}

try {
  process.exitCode = await main();
} catch (error) {
  // after a signal, main fails on the commands it stopped
  if (stoppedBy === undefined) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  }
}
