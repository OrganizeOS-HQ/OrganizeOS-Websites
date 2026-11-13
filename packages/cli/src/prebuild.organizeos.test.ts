// OrganizeOS fork: builder variables in the published CSS (docs/ORGANIZEOS-FORK.md section 7).
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { bundleVersion } from "@webstudio-is/protocol";
import type { Instance } from "@webstudio-is/sdk";
import { prebuild } from "./prebuild";

/**
 * A builder variable is a --name declaration on Global Root, and a bound
 * property stores var(--name) (spec 4.1, 10). This pins what prebuild and
 * generateCss already do with them: Global Root prints as the :root rule and
 * stays out of atomic conversion, with atomic styles on and off.
 */

// OrganizeOS fork: Vitest's module runner has no import.meta.resolve, and it
// resolves @organizeos/site-components with the webstudio condition, to the
// package's source. Hand the CLI that source: it finds the package's build
// from there, as it does when it runs from source (organizeos-components.ts).
vi.mock("./organizeos-components", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./organizeos-components")>();
  return {
    ...actual,
    resolveOrganizeosComponentsModule: () =>
      actual.resolveOrganizeosComponentsModule(
        () =>
          new URL(
            "../../sdk-components-organizeos/src/components.ts",
            import.meta.url
          ).href
      ),
  };
});

const originalCwd = process.cwd();
const originalFetch = globalThis.fetch;
let tempDir: string;
let consoleInfo: ReturnType<typeof vi.spyOn>;
const rootFolderId = "root";
const slowPrebuildTestTimeout = 15_000;

/** prebuild.test.ts's site data, cut to what these cases set. */
const createSiteData = (instances: Array<[string, Omit<Instance, "type">]>) => {
  const pages = [
    {
      id: "home",
      name: "Home",
      title: "Home",
      path: "",
      rootInstanceId: "root",
      meta: {},
    },
  ];
  return {
    bundleVersion,
    origin: "https://assets.example",
    projectDomain: "example.com",
    projectTitle: "Example",
    user: { email: "owner@example.com" },
    page: pages[0],
    pages,
    assets: [],
    build: {
      id: "build-id",
      projectId: "project-id",
      version: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      pages: {
        meta: { siteName: "Site", contactEmail: "" },
        compiler: { atomicStyles: true },
        redirects: [],
        homePageId: pages[0].id,
        rootFolderId,
        pages,
        folders: [
          {
            id: rootFolderId,
            name: "Root",
            slug: "",
            children: pages.map((page) => page.id),
          },
        ],
      },
      props: [],
      instances: instances.map(([id, instance]) => [
        id,
        { type: "instance", ...instance },
      ]),
      dataSources: [],
      resources: [],
      styleSources: [],
      styleSourceSelections: [],
      styles: [],
      breakpoints: [],
    },
  };
};

const writeSiteData = async (siteData: ReturnType<typeof createSiteData>) => {
  await writeFile(".webstudio/data.json", JSON.stringify(siteData), "utf8");
};

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "webstudio-prebuild-"));
  process.chdir(tempDir);
  consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
  await mkdir(".webstudio", { recursive: true });
});

afterEach(async () => {
  consoleInfo.mockRestore();
  process.chdir(originalCwd);
  globalThis.fetch = originalFetch;
  vi.unstubAllGlobals();
  await rm(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Two variables on Global Root, and a box whose colour uses one. */
const publishedCss = async (atomicStyles: boolean) => {
  const siteData = createSiteData([
    [
      "root",
      {
        id: "root",
        component: "Box",
        children: [{ type: "id", value: "box" }],
      },
    ],
    ["box", { id: "box", component: "Box", children: [] }],
  ]);
  siteData.build.breakpoints = [["base", { id: "base", label: "" }]] as never;
  siteData.build.styleSources = [
    ["root-local", { type: "local", id: "root-local" }],
    ["box-local", { type: "local", id: "box-local" }],
  ] as never;
  // Global Root is virtual: there is no :root instance
  siteData.build.styleSourceSelections = [
    [":root", { instanceId: ":root", values: ["root-local"] }],
    ["box", { instanceId: "box", values: ["box-local"] }],
  ] as never;
  siteData.build.styles = [
    [
      "root-local:base:--brand:",
      {
        styleSourceId: "root-local",
        breakpointId: "base",
        property: "--brand",
        value: { type: "unparsed", value: "#1597b0" },
      },
    ],
    [
      "root-local:base:--gap:",
      {
        styleSourceId: "root-local",
        breakpointId: "base",
        property: "--gap",
        value: { type: "unit", unit: "px", value: 8 },
      },
    ],
    [
      "box-local:base:color:",
      {
        styleSourceId: "box-local",
        breakpointId: "base",
        property: "color",
        value: { type: "var", value: "brand" },
      },
    ],
  ] as never;
  siteData.build.pages.compiler.atomicStyles = atomicStyles;
  await writeSiteData(siteData);
  await prebuild({ assets: false, template: ["defaults"] });
  return readFile("app/__generated__/index.css", "utf8");
};

describe.each([true, false])("published CSS with atomicStyles %s", (atomic) => {
  test(
    "Global Root's --* declarations reach the :root rule",
    async () => {
      const css = await publishedCss(atomic);
      expect(css).toMatch(/:root \{[^}]*--brand: #1597b0/);
      expect(css).toMatch(/:root \{[^}]*--gap: 8px/);
    },
    slowPrebuildTestTimeout
  );

  test(
    "a bound property prints var(--name)",
    async () => {
      const css = await publishedCss(atomic);
      expect(css).toMatch(/\{[^}]*color: var\(--brand\)/);
    },
    slowPrebuildTestTimeout
  );
});
