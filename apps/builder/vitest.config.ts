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

const browserProject = (
  group: "core" | "app",
  name: string,
  include: string[],
  exclude: string[] = []
) => ({
  extends: "./vitest.config.ts",
  test: {
    name: `${group}-browser-${name}`,
    include,
    exclude: [nodeTestGlob, ...exclude],
    setupFiles: ["./vitest.browser-setup.ts"],
    browser: {
      provider: "playwright" as const,
      enabled: true,
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: "chromium" as const }],
      commands: { keepRequestInterception },
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

const projects = [
  serverProject,
  browserProject("core", "builder-settings", [
    "app/builder/features/{settings-panel,style-panel}/**/*.{test,spec}.{ts,tsx}",
  ]),
  // OrganizeOS fork: the CMS panels run as a project of their own, so each
  // builder leg stays inside its step limit (fork doc section 7).
  browserProject("core", "builder-cms", [
    "app/builder/features/{cms-panel,organizeos-panel}/**/*.{test,spec}.{ts,tsx}",
  ]),
  browserProject(
    "core",
    "builder-features",
    ["app/builder/features/**/*.{test,spec}.{ts,tsx}"],
    [
      "app/builder/features/{settings-panel,style-panel}/**/*.{test,spec}.{ts,tsx}",
      "app/builder/features/{cms-panel,organizeos-panel}/**/*.{test,spec}.{ts,tsx}",
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
