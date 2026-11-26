import { resolve } from "node:path";
import type { Page } from "playwright";
import { defineConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";

const nodeTestGlob = "**/*.{server,node}.{test,spec}.{ts,tsx}";

// OrganizeOS fork: keeps each browser page's request interception on from its
// first test file to its last. Every vi.mock is a Playwright route, so a file
// that mocks turns interception on and its cleanup turns it off; a request the
// next file's iframe sends while it turns off can be left paused for good, and
// the session stalls. One route that matches no request keeps it on.
// vitest.browser-setup.ts calls this before each file.
const pagesKeepingInterception = new WeakSet<Page>();
const keepRequestInterception: BrowserCommand<[]> = async (context) => {
  if (context.provider.name !== "playwright") {
    return;
  }
  const { page } = context as unknown as { page: Page };
  if (pagesKeepingInterception.has(page)) {
    return;
  }
  pagesKeepingInterception.add(page);
  await page.route("**/__vitest_keep_request_interception__", (route) =>
    route.fallback()
  );
};

// OrganizeOS fork: lets a test read and write the system clipboard through
// navigator.clipboard, to see what a real copy or cut key leaves there.
const grantClipboard: BrowserCommand<[]> = async (context) => {
  if (context.provider.name !== "playwright") {
    return;
  }
  const { page } = context as unknown as { page: Page };
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
};

const browserProject = (
  group: "core" | "app",
  name: string,
  include: string[],
  exclude: string[] = [],
  setupFiles: string[] = []
) => ({
  extends: "./vitest.config.ts",
  test: {
    name: `${group}-browser-${name}`,
    include,
    exclude: [nodeTestGlob, ...exclude],
    setupFiles: ["./vitest.browser-setup.ts", ...setupFiles],
    browser: {
      provider: "playwright" as const,
      enabled: true,
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: "chromium" as const }],
      commands: { keepRequestInterception, grantClipboard },
    },
  },
});

const serverProject = {
  extends: "./vitest.config.ts",
  test: {
    name: "core-server",
    include: [nodeTestGlob],
    environment: "node",
  },
};

// OrganizeOS fork: the CMS panels run as three projects, so each builder leg
// stays inside its step limit (fork doc section 7): the rich-text field's
// tests, its generated sweeps, and everything else in the two panels. A file
// joins a project by its name; scripts/check-every-test-runs.mjs fails when
// two projects collect one file. The line rules' tests run as two more
// projects, the assertion files and the grids, for the same reason.
const cmsPanelTests =
  "app/builder/features/{cms-panel,organizeos-panel}/**/*.{test,spec}.{ts,tsx}";
const richTextTests =
  "app/builder/features/cms-panel/native/rich-text-*.{test,spec}.{ts,tsx}";
const richTextSweeps = [
  "app/builder/features/cms-panel/native/rich-text-toolbar-corpus-*.{test,spec}.{ts,tsx}",
  "app/builder/features/cms-panel/native/rich-text-fuzz.{test,spec}.{ts,tsx}",
];
const richTextLineTests =
  "app/builder/features/cms-panel/native/rich-text-line-*.{test,spec}.{ts,tsx}";
const richTextLineGrids = [
  "app/builder/features/cms-panel/native/rich-text-line-grid-*.{test,spec}.{ts,tsx}",
  "app/builder/features/cms-panel/native/rich-text-line-clicks.{test,spec}.{ts,tsx}",
  "app/builder/features/cms-panel/native/rich-text-line-mount.{test,spec}.{ts,tsx}",
  "app/builder/features/cms-panel/native/rich-text-line-layout.{test,spec}.{ts,tsx}",
];
// The grids run as five projects by file, each leg under its 400 s bound on
// CI by the files' measured times (Task 22).
const lineGrid = (names: string[]) =>
  names.map(
    (name) =>
      `app/builder/features/cms-panel/native/rich-text-line-${name}.{test,spec}.{ts,tsx}`
  );
const richTextLineGridLegs: Array<[string, string[]]> = [
  [
    "a",
    lineGrid([
      "grid-twin-edge",
      "grid-shift-nowait-ltr-1",
      "grid-meeting",
      "grid-clipboard",
      "mount",
    ]),
  ],
  [
    "b",
    lineGrid([
      "grid-shift-nowait-rtl-2",
      "grid-1510-list",
      "grid-1510-other",
      "grid-node",
      "grid-twin-backward",
    ]),
  ],
  [
    "c",
    lineGrid([
      "grid-1510-mirror",
      "grid-unreached",
      "grid-removal",
      "grid-walks",
      "clicks",
    ]),
  ],
  [
    "d",
    lineGrid([
      "grid-points",
      "grid-shift-nowait-ltr-2",
      "grid-removal-2",
      "layout",
      "grid-twin-forward",
    ]),
  ],
  [
    "e",
    lineGrid([
      "grid-walks-nowait",
      "grid-shift-nowait-rtl-1",
      "grid-1510-quote",
      "grid-paste-node",
      "grid-enter-heading",
    ]),
  ],
];
const richTextNet =
  "./app/builder/features/cms-panel/native/rich-text-line-invariant-setup.ts";

const projects = [
  serverProject,
  browserProject("core", "builder-settings", [
    "app/builder/features/{settings-panel,style-panel}/**/*.{test,spec}.{ts,tsx}",
  ]),
  browserProject("core", "builder-cms", [cmsPanelTests], [richTextTests]),
  browserProject(
    "core",
    "builder-cms-rich-text",
    [richTextTests],
    [...richTextSweeps, richTextLineTests],
    [richTextNet]
  ),
  browserProject(
    "core",
    "builder-cms-rich-text-sweeps",
    richTextSweeps,
    [],
    [richTextNet]
  ),
  browserProject(
    "core",
    "builder-cms-rich-text-lines",
    [richTextLineTests],
    richTextLineGrids,
    [richTextNet]
  ),
  ...richTextLineGridLegs.map(([leg, include]) =>
    browserProject(
      "core",
      `builder-cms-rich-text-grids-${leg}`,
      include,
      [],
      [richTextNet]
    )
  ),
  browserProject(
    "core",
    "builder-features",
    ["app/builder/features/**/*.{test,spec}.{ts,tsx}"],
    [
      "app/builder/features/{settings-panel,style-panel}/**/*.{test,spec}.{ts,tsx}",
      cmsPanelTests,
    ]
  ),
  browserProject("app", "builder-shared", [
    "app/builder/shared/**/*.{test,spec}.{ts,tsx}",
    "app/builder/*.{test,spec}.{ts,tsx}",
  ]),
  browserProject("app", "shared-heavy", [
    "app/shared/{copy-paste,instance-utils,sync}/**/*.{test,spec}.{ts,tsx}",
  ]),
  browserProject(
    "app",
    "shared",
    ["app/shared/**/*.{test,spec}.{ts,tsx}"],
    ["app/shared/{copy-paste,instance-utils,sync}/**/*.{test,spec}.{ts,tsx}"]
  ),
  browserProject("app", "canvas-dashboard", [
    "app/{canvas,dashboard}/**/*.{test,spec}.{ts,tsx}",
  ]),
];

export default defineConfig({
  optimizeDeps: {
    entries: ["app/**/*.{test,spec}.{ts,tsx}"],
    include: [
      "react/jsx-dev-runtime",
      "react-router-dom",
      "css.escape",
      "@lexical/react/LexicalComposer",
      "@lexical/react/LexicalContentEditable",
      "@lexical/react/LexicalErrorBoundary",
      "@lexical/react/LexicalHistoryPlugin",
      "@lexical/react/LexicalLinkPlugin",
      "@lexical/react/LexicalRichTextPlugin",
      // OrganizeOS fork: the native CMS's Lexical entry points (fork doc section 7).
      "@lexical/react/LexicalListPlugin",
      "@lexical/selection",
    ],
  },
  resolve: {
    alias: [
      {
        find: "~",
        replacement: resolve("app"),
      },
    ],
    conditions: ["webstudio", "browser", "development|production"],
  },
  ssr: {
    resolve: {
      conditions: ["webstudio", "node", "development|production"],
    },
  },
  test: {
    silent: "passed-only",
    workspace: projects,
  },
});
