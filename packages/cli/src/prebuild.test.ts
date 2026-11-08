import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import {
  defaultTreeAdapter,
  parse as parseHtml,
  type DefaultTreeAdapterMap,
} from "parse5";
import { build } from "esbuild";
import { loadConfigFromFile, transformWithEsbuild } from "vite";
import * as React from "react";
import type { ComponentType } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { log } from "@clack/prompts";
import { parse as parseModule } from "acorn";
import { simple as walkSimple } from "acorn-walk";
import {
  findPausedExpressions,
  orgScriptMayRun,
  templateIconCodes,
  type PublishedPage,
} from "@organizeos/site-components/org-script";
import * as organizeosPage from "@organizeos/site-components/page";
import {
  bundleVersion,
  type PublishedProjectBundle,
} from "@webstudio-is/protocol";
import { isProtectedResourceReentry } from "@webstudio-is/sdk/protected-resource-fetch";
import type { Asset, DataSource, Instance, Prop } from "@webstudio-is/sdk";
import {
  createDocumentGraph,
  type AssetFileDocument,
} from "@webstudio-is/content-engine";
import {
  createAssetIndex,
  createCanonicalAssetFileEntry,
  createContentRuntimeArtifact,
} from "@webstudio-is/content-engine/compiler";
import { contentEngineLimits } from "@webstudio-is/content-engine/limits";
import { createPublishedAssetResourceFetch } from "@webstudio-is/content-engine/runtime";
import {
  createStructuredAssetQueryResourceBody,
  encodeDataSourceVariable,
  encodeDataVariableId,
  getAllPages,
  getPagePath,
  replaceFormActionsWithResources,
  ROOT_INSTANCE_ID,
  SYSTEM_VARIABLE_ID,
  type Resource,
  type ResourceRequest,
  type WebstudioFragment,
  type WsComponentMeta,
} from "@webstudio-is/sdk";
import { migrateResourceFormInstancesMutable } from "@webstudio-is/project-migrations";
import {
  hasHistoricalFormComponentIdentityVersion,
  migratePages,
} from "@webstudio-is/project-migrations/pages";
import { canvasComponentLibraries } from "@webstudio-is/sdk-components-registry/canvas";
import * as blockTemplates from "@organizeos/site-components/templates";
import * as baseTemplates from "@webstudio-is/sdk-components-react/templates";
import * as baseComponents from "@webstudio-is/sdk-components-react/components";
import {
  SITE_TEMPLATES,
  renderSiteTemplate,
} from "@organizeos/site-components/site-templates";
import { renderTemplate } from "@webstudio-is/template";
import {
  findTreeInstanceIdsExcludingStaticHidden,
  generateRemixRoute,
  showAttribute,
} from "@webstudio-is/react-sdk";
import { submitManagedForm } from "@webstudio-is/sdk-components-react";
import {
  formBotFieldName,
  formIdFieldName,
  getManagedFormFailure,
  managedFormArrayNamesFieldName,
  managedFormIdFieldName,
  managedFormRequestParamName,
  type EmailResourceLoadOptions,
} from "@webstudio-is/sdk/runtime";
import { createProtectedResourceFetch } from "@webstudio-is/sdk/protected-resource-fetch";
import {
  generateRedirectsModule,
  getAssetResourcePrerenderPaths,
  materializeAssetIndex,
  prebuild,
} from "./prebuild";
import { generateResponseHeadersModule } from "./response-headers";
import {
  checkGeneratedModule,
  findGeneratedCodeProblems,
} from "./organizeos-generated-code";
import { dropOrgScript } from "./organizeos-org-script";
import {
  ORGANIZEOS_PAGE_MODULE,
  findModuleClosure,
  resolveOrganizeosComponentsModule,
} from "./organizeos-components";

// OrganizeOS fork: the check of each module prebuild generates, observed
vi.mock("./organizeos-generated-code", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./organizeos-generated-code")>();
  return {
    ...actual,
    checkGeneratedModule: vi.fn(actual.checkGeneratedModule),
  };
});

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

// OrganizeOS fork: while org script is paused, publishing refuses a build that
// would materialize MDX (D7, refuseMdxWhilePaused) and leaves out what the
// pause covers (dropOrgScript, organizeos-org-script.ts), a bound Content Block
// `src` and a ws:element whose tag the builder does not offer among it. A few
// of upstream's cases below publish exactly that, to cover what upstream builds
// once the switch is on (MDX materialization, an XML page of ws:element). Each
// of them publishes as if org script may run (publishAsIfOrgScriptMayRun); the
// fork's own cases run with the pause in place.
const orgScript = vi.hoisted(() => ({ mayRun: false }));
vi.mock("./organizeos-org-script", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./organizeos-org-script")>();
  return {
    ...actual,
    // observed, and set aside by one case to test the module check alone
    dropOrgScript: vi.fn(
      <Bundle extends Parameters<typeof actual.dropOrgScript>[0]>(
        bundle: Bundle,
        options: Parameters<typeof actual.dropOrgScript>[1] = {}
      ) =>
        actual.dropOrgScript(
          bundle,
          orgScript.mayRun ? { ...options, mayRun: true } : options
        )
    ),
    refuseMdxWhilePaused: (
      bundle: Parameters<typeof actual.refuseMdxWhilePaused>[0],
      options: Parameters<typeof actual.refuseMdxWhilePaused>[1] = {}
    ) =>
      actual.refuseMdxWhilePaused(
        bundle,
        orgScript.mayRun ? { ...options, mayRun: true } : options
      ),
  };
});
/** For upstream's cases that publish what the pause covers (see orgScript). */
const publishAsIfOrgScriptMayRun = () => {
  orgScript.mayRun = true;
};

const createSsgAssetResourceFetch = (options: {
  deploymentId: string;
  artifact: Parameters<typeof createContentRuntimeArtifact>[0];
  runtimeAssets: Parameters<
    typeof createPublishedAssetResourceFetch
  >[0]["runtimeAssets"];
}) =>
  createPublishedAssetResourceFetch({
    ...options,
    artifact: createContentRuntimeArtifact(options.artifact),
    baseUrl: "https://webstudio.local",
  });

const originalCwd = process.cwd();
const execFileAsync = promisify(execFile);
const originalFetch = globalThis.fetch;
let tempDir: string;
let consoleInfo: ReturnType<typeof vi.spyOn>;
const rootFolderId = "root";
const elementComponent = "ws:element";
const slowPrebuildTestTimeout = 15_000;

const loadGeneratedIndexAction = async () => {
  await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
  await build({
    stdin: {
      contents: 'export { action } from "./app/routes/_index"',
      resolveDir: tempDir,
    },
    outfile: join(tempDir, "action.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    loader: { ".css": "text" },
  });
  return import(pathToFileURL(join(tempDir, "action.mjs")).href);
};

const runGeneratedCommand = async (
  command: "react-router" | "remix" | "tsc" | "vite" | "vike",
  args: string[]
) => {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name.startsWith("VITEST")) {
      delete env[name];
    }
  }
  env.NODE_ENV = "production";
  env.NODE_OPTIONS = "--conditions=webstudio";
  env.WEBSTUDIO_LOCAL_CLI_BOOTSTRAPPED = "1";
  await execFileAsync(join(originalCwd, `node_modules/.bin/${command}`), args, {
    cwd: tempDir,
    env,
  });
};

const prerenderSsg = async () => {
  await runGeneratedCommand("vike", ["build"]);
  await runGeneratedCommand("vike", ["prerender"]);
};

const linkPackagedPreviewDependencies = async () => {
  const sourceNodeModules = join(originalCwd, "node_modules");
  const targetNodeModules = join(tempDir, "node_modules");
  const webstudioScope = "@webstudio-is";
  const routerPackage = "sdk-components-react-router";

  await mkdir(targetNodeModules, { recursive: true });
  for (const entry of await readdir(sourceNodeModules)) {
    if (entry === webstudioScope) {
      continue;
    }
    await symlink(
      join(sourceNodeModules, entry),
      join(targetNodeModules, entry),
      "dir"
    );
  }

  const targetScope = join(targetNodeModules, webstudioScope);
  await mkdir(targetScope, { recursive: true });
  for (const entry of await readdir(join(sourceNodeModules, webstudioScope))) {
    if (entry === routerPackage) {
      continue;
    }
    await symlink(
      join(sourceNodeModules, webstudioScope, entry),
      join(targetScope, entry),
      "dir"
    );
  }

  const sourcePackage = join(originalCwd, "..", "sdk-components-react-router");
  const targetPackage = join(targetScope, routerPackage);
  await mkdir(join(targetPackage, "lib"), { recursive: true });
  const packageJson = JSON.parse(
    await readFile(join(sourcePackage, "package.json"), "utf8")
  ) as { exports: { ".": Record<string, string> } };
  delete packageJson.exports["."].webstudio;
  await writeFile(
    join(targetPackage, "package.json"),
    JSON.stringify(packageJson)
  );
  await build({
    entryPoints: [join(sourcePackage, "src", "components.ts")],
    outfile: join(targetPackage, "lib", "components.js"),
    bundle: true,
    format: "esm",
    packages: "external",
  });
};

type Redirects = Array<{ old: string; new: string; status?: "301" | "302" }>;
type GeneratedRouteModule = {
  loader: (args: {
    request: Request;
    params?: Record<string, string | undefined>;
    context?: Record<string, unknown>;
  }) => Response | Promise<Response>;
};

const importGeneratedRoute = async (path: string) => {
  await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
  return (await import(
    `${pathToFileURL(join(tempDir, path)).href}?test=${crypto.randomUUID()}`
  )) as GeneratedRouteModule;
};

const expectGeneratedRedirectFallback = async (path: string) => {
  const routeModule = await importGeneratedRoute(path);
  const redirectResponse = await routeModule.loader({
    request: new Request("https://example.com/dl.php?filename=file.pdf"),
  });
  expect(redirectResponse.status).toBe(301);
  expect(redirectResponse.headers.get("Location")).toBe("/downloads/file.pdf");

  try {
    await routeModule.loader({
      request: new Request("https://example.com/not-a-redirect"),
    });
    throw new Error("Expected unmatched request to throw a 404 response.");
  } catch (error) {
    expect(error).toBeInstanceOf(Response);
    expect((error as Response).status).toBe(404);
  }
};

const getFilePaths = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return getFilePaths(path);
      }
      return [path];
    })
  );
  return paths.flat();
};

/**
 * OrganizeOS fork: the page's server module builds the request `name` makes
 * and loads it as one of the page's resources (upstream's request graph).
 */
const expectRequest = (resources: string, name: string | undefined) => {
  expect(name).toBeDefined();
  expect(resources).toMatch(
    new RegExp(`const ${name} = \\([^)]*\\): ResourceRequest => \\{`)
  );
  expect(resources).toMatch(
    new RegExp(`outputName: "${name}", [^\\n]*createRequest: ${name},`)
  );
};

/** Runs a TSX module as CommonJS, resolving its imports from `imports`. */
const runModule = async (
  code: string,
  imports: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const { code: js } = await transformWithEsbuild(code, "module.tsx", {
    loader: "tsx",
    format: "cjs",
    jsx: "automatic",
  });
  const module = { exports: {} as Record<string, unknown> };
  const load = (id: string) => {
    if (id in imports === false) {
      throw Error(`"${id}" is not available to the module`);
    }
    return imports[id];
  };
  new Function("module", "exports", "require", js)(
    module,
    module.exports,
    load
  );
  return module.exports;
};

const getImportSources = async (source: string) => {
  const result = await build({
    stdin: { contents: source, loader: "tsx" },
    bundle: false,
    format: "esm",
    metafile: true,
    write: false,
  });
  return Object.values(result.metafile.outputs).flatMap((output) =>
    output.imports.map(({ path }) => path)
  );
};

const findElementsByTagName = (
  node: DefaultTreeAdapterMap["node"],
  tagName: string
): DefaultTreeAdapterMap["element"][] => {
  const elements: DefaultTreeAdapterMap["element"][] = [];
  if (defaultTreeAdapter.isElementNode(node) && node.tagName === tagName) {
    elements.push(node);
  }
  if ("childNodes" in node) {
    for (const child of node.childNodes) {
      elements.push(...findElementsByTagName(child, tagName));
    }
  }
  return elements;
};

const getTextContent = (node: DefaultTreeAdapterMap["node"]): string => {
  if (defaultTreeAdapter.isTextNode(node)) {
    return node.value;
  }
  if ("childNodes" in node) {
    return node.childNodes.map(getTextContent).join("");
  }
  return "";
};

/**
 * OrganizeOS fork: a generated route module as the site ships it, run with
 * runModule. Its generated neighbours are the real ones prebuild wrote (the
 * page's server module, the asset query runtime, the form fetch), and the sdk
 * and react-router are the real packages; the client module, the stylesheet,
 * the sitemap, the assets and the constants are stood in, and `imports`
 * replaces any of them.
 */
const loadGeneratedRoute = async (
  file: string,
  generated: string,
  imports: Record<string, unknown> = {}
) => {
  const generatedDir = join("app", "__generated__");
  const sdk = await import("@webstudio-is/sdk");
  const server = await runModule(
    await readFile(join(generatedDir, `${generated}.server.tsx`), "utf8"),
    {
      "@webstudio-is/sdk": sdk,
      "@webstudio-is/sdk/to-string":
        await import("@webstudio-is/sdk/to-string"),
      "@webstudio-is/react-sdk": await import("@webstudio-is/react-sdk"),
    }
  );
  const assetQueryRuntime = await runModule(
    await readFile(
      join(generatedDir, "$resources.asset-query-runtime.ts"),
      "utf8"
    ),
    {}
  );
  const managedFormFetch = await runModule(
    await readFile(
      join(generatedDir, "$resources.managed-form-fetch.server.ts"),
      "utf8"
    ),
    {
      "@webstudio-is/sdk/protected-resource-fetch":
        await import("@webstudio-is/sdk/protected-resource-fetch"),
      "@webstudio-is/sdk/protected-resource-fetch-node":
        await import("@webstudio-is/sdk/protected-resource-fetch-node"),
    }
  );
  return runModule(await readFile(file, "utf8"), {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "react-dom/server": await import("react-dom/server"),
    "react-router": await import("react-router"),
    "@webstudio-is/sdk/runtime": await import("@webstudio-is/sdk/runtime"),
    "@webstudio-is/sdk/form/server":
      await import("@webstudio-is/sdk/form/server"),
    "@webstudio-is/sdk/form": await import("@webstudio-is/sdk/form"),
    "@webstudio-is/wsauth": await import("@webstudio-is/wsauth"),
    "@webstudio-is/react-sdk/runtime":
      await import("@webstudio-is/react-sdk/runtime"),
    [`../__generated__/${generated}`]: {
      projectId: "project-id",
      Page: () => null,
      breakpoints: [],
    },
    [`../__generated__/${generated}.server`]: server,
    "../constants.mjs": {},
    "../__generated__/index.css?url": { default: "" },
    "../__generated__/$resources.sitemap.xml": { sitemap: [] },
    "../__generated__/$resources.assets": { assets: {}, assetUrlsByPath: {} },
    "../__generated__/$resources.wsauth.server": { authRoutes: [] },
    "../__generated__/$resources.asset-query-runtime": assetQueryRuntime,
    "../__generated__/$resources.managed-form-fetch.server": managedFormFetch,
    "../organizeos-resource-cache": {
      siteResourceCache: (
        await import("../templates/react-router/app/organizeos-resource-cache")
      ).createResourceCache(),
    },
    "../__organizeos__/page.js": { PageShareCodeCarrier: () => null },
    ...imports,
  });
};

const createSiteData = (
  overrides: {
    assets?: Asset[];
    pages?: Array<{
      id: string;
      name: string;
      title: string;
      path: string;
      rootInstanceId: string;
      meta: Record<string, unknown>;
      isDraft?: boolean;
    }>;
    instances?: Array<
      [
        string,
        (
          | Omit<Instance, "type">
          | {
              type?: "instance";
              id: string;
              component: string;
              tag?: string;
              // OrganizeOS fork: the Event List cases below hold expressions,
              // and the org script cases text
              children: Array<{
                type: "id" | "expression" | "text";
                value: string;
              }>;
            }
        ),
      ]
    >;
    // OrganizeOS fork: the fork's cases below build some of these as plain
    // records; the bundle schema checks them when prebuild reads the bundle.
    props?: Array<[string, Prop | Record<string, unknown>]>;
    dataSources?: Array<[string, DataSource | Record<string, unknown>]>;
    resources?: Array<[string, Resource | Record<string, unknown>]>;
    pageMeta?: Record<string, unknown>;
    redirects?: Redirects;
    formComponentIdentityVersion?: number;
  } = {}
) => {
  const pages = overrides.pages ?? [
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
    user: {
      email: "owner@example.com",
    },
    page: pages[0],
    pages,
    assets: overrides.assets ?? [
      {
        id: "asset-image",
        projectId: "project-id",
        name: "image.png",
        type: "image",
        format: "png",
        size: 1,
        meta: {
          width: 1,
          height: 1,
        },
        description: "",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ],
    build: {
      id: "build-id",
      projectId: "project-id",
      version: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      pages: {
        formComponentIdentityVersion: overrides.formComponentIdentityVersion,
        meta: {
          siteName: "Site",
          contactEmail: "",
          ...overrides.pageMeta,
        },
        compiler: {
          atomicStyles: true,
        },
        redirects: overrides.redirects ?? [
          {
            old: "/dl.php?filename=file.pdf",
            new: "/downloads/file.pdf",
          },
          {
            old: "/über",
            new: "/ueber",
            status: "302",
          },
        ],
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
      props: overrides.props ?? [],
      instances: (
        overrides.instances ?? [
          [
            "root",
            {
              id: "root",
              component: "Box",
              children: [],
            },
          ],
        ]
      ).map(([id, instance]) => [id, { type: "instance", ...instance }]),
      dataSources: overrides.dataSources ?? [],
      resources: overrides.resources ?? [],
      styleSources: [],
      styleSourceSelections: [],
      styles: [],
      breakpoints: [],
    },
  };
};

const createCodeTextSiteData = (
  selections: Array<{
    id: string;
    code?: string;
    language?: string | { type: "expression"; value: string };
    theme?: string | { type: "expression"; value: string };
    lang?: string;
    children?: Instance["children"];
  }>
) => {
  const instances: Array<[string, Omit<Instance, "type">]> = [
    [
      "root",
      {
        id: "root",
        component: "Box",
        children: selections.map(({ id }) => ({ type: "id", value: id })),
      },
    ],
  ];
  const props: Array<[string, Prop]> = [];
  for (const selection of selections) {
    instances.push([
      selection.id,
      {
        id: selection.id,
        component: "CodeText",
        children: selection.children ?? [],
      },
    ]);
    for (const [name, value] of [
      ["code", selection.code],
      ["language", selection.language],
      ["theme", selection.theme],
      ["lang", selection.lang],
    ] as const) {
      if (value === undefined) {
        continue;
      }
      const id = `${selection.id}-${name}`;
      props.push([
        id,
        {
          id,
          instanceId: selection.id,
          name,
          ...(typeof value === "string"
            ? { type: "string" as const, value }
            : value),
        },
      ]);
    }
  }
  return createSiteData({ instances, props });
};

const writeSiteData = async (
  siteData: ReturnType<typeof createSiteData> = createSiteData()
) => {
  await writeFile(".webstudio/data.json", JSON.stringify(siteData), "utf8");
};

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "webstudio-prebuild-"));
  process.chdir(tempDir);
  consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
  await mkdir(".webstudio", { recursive: true });
  await writeSiteData();
});

afterEach(async () => {
  orgScript.mayRun = false;
  consoleInfo.mockRestore();
  process.chdir(originalCwd);
  globalThis.fetch = originalFetch;
  vi.unstubAllGlobals();
  await rm(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("generateRedirectsModule", () => {
  test("generates an empty redirects data module", () => {
    expect(generateRedirectsModule(undefined)).toEqual(`
    export const redirects = [];
    `);
  });

  test("preserves redirect sources exactly as data", () => {
    const redirects = [
      {
        old: "/dl.php?filename=file.pdf",
        new: "/downloads/file.pdf",
      },
      {
        old: "/path?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3Dc",
        new: "/target",
        status: "302",
      },
      {
        old: "/über",
        new: "/ueber",
      },
      {
        old: "/%E6%B8%AF%E8%81%9E",
        new: "/news",
      },
      {
        old: "/path%20with%20spaces",
        new: "/spaces",
      },
      {
        old: "/old#section",
        new: "/new#target",
      },
    ] satisfies Redirects;

    expect(generateRedirectsModule(redirects)).toEqual(`
    export const redirects = [
  {
    "old": "/dl.php?filename=file.pdf",
    "new": "/downloads/file.pdf",
    "status": 301
  },
  {
    "old": "/path?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3Dc",
    "new": "/target",
    "status": "302"
  },
  {
    "old": "/über",
    "new": "/ueber",
    "status": 301
  },
  {
    "old": "/%E6%B8%AF%E8%81%9E",
    "new": "/news",
    "status": 301
  },
  {
    "old": "/path%20with%20spaces",
    "new": "/spaces",
    "status": 301
  },
  {
    "old": "/old#section",
    "new": "/new#target",
    "status": 301
  }
];
    `);
  });
});

const indexedDocument: AssetFileDocument = {
  _id: "post-1",
  _type: "asset.file",
  name: "post.md",
  path: "post.md",
  key: "post",
  extension: "md",
  mimeType: "text/markdown",
  size: 10,
  revision: "post-revision",
  contentRef: "post.md",
  properties: { slug: "post", title: "Prerendered post" },
};

const createAssetForIndexedDocument = (document: AssetFileDocument): Asset => ({
  id: document._id,
  projectId: "project-1",
  name: document.contentRef,
  type: "file",
  format: document.extension,
  size: document.size,
  meta: {},
  createdAt: "2026-01-01T00:00:00.000Z",
});

const createTestAssetIndex = (
  documents: AssetFileDocument | AssetFileDocument[] = indexedDocument,
  contents: Record<string, string> = {}
) =>
  createAssetIndex({
    projectId: "project-1",
    entries: (Array.isArray(documents) ? documents : [documents]).map(
      (document) => ({
        ...createCanonicalAssetFileEntry({
          projectId: "project-1",
          document,
        }),
        content: contents[document.contentRef],
      })
    ),
  });

const createQueryResource = (
  content: "none" | "full" | "markdown-body-ref" = "none"
): Resource => ({
  id: "posts",
  name: "Posts",
  control: "system",
  method: "post",
  url: '"/$resources/assets"',
  headers: [],
  body: createStructuredAssetQueryResourceBody({
    where: { all: [] },
    sort: [],
    limit: "100",
    offset: "0",
    output: { mode: "all", includeMetadata: true },
    content: { mode: content },
  }),
});

test("embeds one shared content database in a server module", async () => {
  const index = await createTestAssetIndex();
  await mkdir("public", { recursive: true });
  await mkdir("app/__generated__", { recursive: true });

  await materializeAssetIndex({
    index,
    runtimeAssets: { "post-1": { url: "/assets/post.md" } },
    includeDocumentRuntimeAssets: false,
    generatedDirectory: "app/__generated__",
    deploymentId: "build-1",
  });

  await expect(stat("public/assets/db")).rejects.toMatchObject({
    code: "ENOENT",
  });
  const manifestModule = await readFile(
    "app/__generated__/$resources.asset-query-manifest.ts",
    "utf8"
  );
  expect(manifestModule).toContain('assetQueryDeploymentId = "build-1"');
  expect(manifestModule).toContain('"documents"');
  expect(manifestModule).toContain('"properties"');
  expect(manifestModule).not.toContain('"fieldCatalog"');
  expect(manifestModule).not.toContain('"database"');
  expect(manifestModule).not.toContain('"integrity"');
  const runtimeModule = await readFile(
    "app/__generated__/$resources.asset-query-runtime.ts",
    "utf8"
  );
  expect(runtimeModule).toContain('from "./$resources.asset-query-vendor.js"');
  expect(runtimeModule).toContain("assetQueryDatabase");
  await expect(
    stat("app/__generated__/$resources.asset-query-vendor.js")
  ).resolves.toBeDefined();
});

test("rejects a corrupted content database before generating runtime files", async () => {
  const index = await createTestAssetIndex();
  const corrupted = {
    ...index,
    documents: index.documents.map((document) => ({
      ...document,
      name: `${document.name}-corrupted`,
    })),
  };
  await mkdir("app/__generated__", { recursive: true });

  await expect(
    materializeAssetIndex({
      index: corrupted,
      runtimeAssets: { "post-1": { url: "/assets/post.md" } },
      includeDocumentRuntimeAssets: false,
      generatedDirectory: "app/__generated__",
      deploymentId: "build-1",
    })
  ).rejects.toThrow("Content artifact checksum is invalid");
  await expect(
    stat("app/__generated__/$resources.asset-query-vendor.js")
  ).rejects.toMatchObject({ code: "ENOENT" });
});

test("does not require URLs for documents that do not use runtime asset fields", async () => {
  const index = await createTestAssetIndex();
  await mkdir("app/__generated__", { recursive: true });

  await materializeAssetIndex({
    index,
    runtimeAssets: {},
    includeDocumentRuntimeAssets: false,
    generatedDirectory: "app/__generated__",
    deploymentId: "build-1",
  });
  const runtimeModule = await readFile(
    "app/__generated__/$resources.asset-query-runtime.ts",
    "utf8"
  );
  expect(runtimeModule).toContain("const runtimeAssets = {};");
});

test("embeds document runtime data when a query uses runtime fields", async () => {
  const index = await createTestAssetIndex();
  await mkdir("app/__generated__", { recursive: true });

  await materializeAssetIndex({
    index,
    runtimeAssets: { "post-1": { url: "/assets/post.md" } },
    includeDocumentRuntimeAssets: true,
    generatedDirectory: "app/__generated__",
    deploymentId: "build-1",
  });

  await expect(
    readFile("app/__generated__/$resources.asset-query-runtime.ts", "utf8")
  ).resolves.toContain('"post-1"');
});

test("rejects missing document runtime data when a query uses runtime fields", async () => {
  const index = await createTestAssetIndex();
  await mkdir("app/__generated__", { recursive: true });

  await expect(
    materializeAssetIndex({
      index,
      runtimeAssets: {},
      includeDocumentRuntimeAssets: true,
      generatedDirectory: "app/__generated__",
      deploymentId: "build-1",
    })
  ).rejects.toThrow("Published asset runtime data is unavailable for post-1");
});

test("rejects a content database without a referenced published asset", async () => {
  const index = await createAssetIndex({
    projectId: "project-1",
    entries: [
      {
        ...createCanonicalAssetFileEntry({
          projectId: "project-1",
          document: indexedDocument,
        }),
        content: "# Post",
      },
    ],
    assetReferences: {
      "post.md": [{ start: 0, end: 1, assetId: "image-1" }],
    },
  });
  await mkdir("app/__generated__", { recursive: true });

  await expect(
    materializeAssetIndex({
      index,
      runtimeAssets: { "post-1": { url: "/assets/post.md" } },
      includeDocumentRuntimeAssets: false,
      generatedDirectory: "app/__generated__",
      deploymentId: "build-1",
    })
  ).rejects.toThrow(
    "Published referenced asset URL is unavailable for image-1"
  );
});

test("executes and hydrates an asset query from an embedded SSG database", async () => {
  const source = "# Prerendered post\n";
  const index = await createTestAssetIndex(
    {
      ...indexedDocument,
      size: new TextEncoder().encode(source).byteLength,
    },
    { "post.md": source }
  );
  const runtimeFetch = createSsgAssetResourceFetch({
    deploymentId: "build-1",
    artifact: index,
    runtimeAssets: { "post-1": { url: "/assets/post.md" } },
  });

  const response = await runtimeFetch("/$resources/assets", {
    method: "POST",
    body: JSON.stringify({
      query: {
        where: {
          all: [
            {
              field: ["properties", "slug"],
              operator: "eq",
              value: "post",
            },
          ],
        },
        limit: 1,
        output: { mode: "all", includeMetadata: true },
        content: { mode: "full" },
      },
    }),
  });

  expect({
    status: response?.status,
    body: await response?.json(),
  }).toMatchObject({
    status: 200,
    body: {
      items: [
        {
          id: "post-1",
          properties: { title: "Prerendered post" },
          content: { text: source },
        },
      ],
    },
  });
});

test("hydrates encoded filenames from an embedded SSG database", async () => {
  const contentRef = "post!-你好.md";
  const source = "# Encoded filename\n";
  const index = await createTestAssetIndex(
    {
      ...indexedDocument,
      contentRef,
      size: new TextEncoder().encode(source).byteLength,
    },
    { [contentRef]: source }
  );
  const runtimeFetch = createSsgAssetResourceFetch({
    deploymentId: "build-encoded",
    artifact: index,
    runtimeAssets: { "post-1": { url: `/assets/${contentRef}` } },
  });

  const response = await runtimeFetch("/$resources/assets", {
    method: "POST",
    body: JSON.stringify({
      query: {
        where: { all: [{ field: ["id"], operator: "eq", value: "post-1" }] },
        limit: 1,
        content: { mode: "full" },
      },
    }),
  });

  expect(response?.status).toBe(200);
  await expect(response?.json()).resolves.toMatchObject({
    items: [{ content: { text: source } }],
  });
});

describe("prebuild", () => {
  // OrganizeOS fork: the sitemap reads excludePageFromSearch without
  // evaluating it, as upstream does since webstudio-is/webstudio#6614.
  test("the sitemap reads each page's excludePageFromSearch without evaluating it", async () => {
    const page = (
      id: string,
      path: string,
      excludePageFromSearch?: string
    ) => ({
      id,
      name: id,
      title: `"${id}"`,
      path,
      rootInstanceId: "root",
      meta:
        excludePageFromSearch === undefined ? {} : { excludePageFromSearch },
    });
    // A value that runs code never gets this far: input validation stops the
    // build first (organizeos-code-check.ts). A bound value keeps the page.
    await writeSiteData(
      createSiteData({
        pages: [
          page("home", ""),
          page("hidden", "/hidden", "true"),
          page("bound", "/bound", `$ws$system.search.hide === "1"`),
        ],
      })
    );
    await prebuild({ assets: false, template: ["defaults"] });
    const sitemap = await readFile(
      "app/__generated__/$resources.sitemap.xml.ts",
      "utf8"
    );
    expect(sitemap).toContain('"path": "/bound"');
    expect(sitemap).not.toContain('"path": "/hidden"');
  });

  test.each([true, false])(
    "imports managed Form formatting only when used (%s)",
    async (hasErrors) => {
      const siteData = createSiteData({
        props: hasErrors
          ? [
              [
                "result-action",
                {
                  id: "result-action",
                  instanceId: "root",
                  name: "onResultChange",
                  type: "action",
                  value: [
                    {
                      type: "execute",
                      args: ["result"],
                      code: `${encodeDataVariableId("errors")} = result.errors`,
                    },
                  ],
                },
              ],
            ]
          : [],
        instances: [
          [
            "root",
            {
              id: "root",
              component: "ResourceForm",
              children: hasErrors ? [{ type: "id", value: "error" }] : [],
            },
          ],
          [
            "error",
            {
              id: "error",
              component: "ws:element",
              tag: "div",
              label: "Error Message",
              children: [
                {
                  type: "text",
                  placeholder: true,
                  value: "Sorry, something went wrong.",
                },
              ],
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          "errors",
          {
            id: "errors",
            type: "variable",
            name: "errors",
            scopeInstanceId: "root",
            value: { type: "json", value: [] },
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: ["react-router"] });
      const source = await readFile("app/__generated__/_index.tsx", "utf8");
      const result = await build({
        stdin: { contents: source, loader: "tsx" },
        format: "esm",
        metafile: true,
        tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true } },
        write: false,
      });
      const imports = Object.values(result.metafile.outputs).flatMap((output) =>
        output.imports.map(({ path }) => path)
      );
      // OrganizeOS fork: while org script is paused an action reads no
      // member, so publishing leaves this one out and the error message
      // keeps its text (docs/ORGANIZEOS-FORK.md section 10)
      expect(imports.includes("@webstudio-is/sdk")).toBe(
        hasErrors && orgScriptMayRun()
      );
    }
  );

  test("uses the private Email binding when a TRPC token is present without an Email Service URL", async () => {
    await prebuild({
      assets: false,
      template: ["react-router", "react-router-cloudflare"],
    });
    await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
    const adapterBundle = await build({
      entryPoints: [
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
      ],
      bundle: true,
      format: "esm",
      platform: "node",
      conditions: ["webstudio"],
      write: false,
    });
    const adapter = (await import(
      /* @vite-ignore */
      `data:text/javascript;base64,${Buffer.from(
        adapterBundle.outputFiles[0].text
      ).toString("base64")}`
    )) as {
      createManagedFormEmailSender: (input: {
        context: unknown;
        formData: FormData;
        projectId: string;
      }) => EmailResourceLoadOptions["sendEmail"];
    };
    const bindingSendEmail = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      data: { id: "sent" },
    });
    const sendEmail = adapter.createManagedFormEmailSender({
      context: {
        cloudflare: {
          env: {
            EMAIL_SERVICE: { sendEmail: bindingSendEmail },
            TRPC_SERVER_API_TOKEN: "unrelated-trpc-token",
          },
        },
      },
      formData: new FormData(),
      projectId: "project-id",
    });
    expect(sendEmail).toBeDefined();
    await expect(
      sendEmail!(
        {
          name: "Email",
          url: "",
          method: "post",
          searchParams: [],
          headers: [],
          control: "email",
          email: {
            recipientMode: "project",
            recipients: [{ address: "owner@example.com" }],
            subject: "Submission",
            body: "Submitted fields",
            includeAttachments: false,
          },
        },
        {}
      )
    ).resolves.toMatchObject({ ok: true, data: { id: "sent" } });
    expect(bindingSendEmail).toHaveBeenCalledExactlyOnceWith("project-id", {
      to: [{ address: "owner@example.com" }],
      subject: "Submission",
      text: "Submitted fields",
    });
  });

  test("generates a private Email binding adapter only for Cloudflare sites", async () => {
    await prebuild({
      assets: false,
      template: ["react-router", "react-router-cloudflare"],
    });
    const cloudflareAdapter = await readFile(
      "app/__generated__/$resources.managed-form-fetch.server.ts",
      "utf8"
    );
    expect(cloudflareAdapter).toContain("cloudflare?.env;");
    expect(cloudflareAdapter).toContain("env?.EMAIL_SERVICE;");
    expect(cloudflareAdapter).toContain(
      "createCloudflareManagedFormEmailSender"
    );
    expect(cloudflareAdapter).toContain("EMAIL_SERVICE_URL");
    expect(cloudflareAdapter).toContain("TRPC_SERVER_API_TOKEN");
    expect(cloudflareAdapter).not.toContain("EMAIL_SERVICE_TOKEN");
    expect(cloudflareAdapter).toContain(
      "createCloudflareManagedFormEmailSenderWithUrl"
    );
    expect(cloudflareAdapter.indexOf("EMAIL_SERVICE_URL")).toBeLessThan(
      cloudflareAdapter.indexOf("EMAIL_SERVICE;")
    );
    expect(cloudflareAdapter).toContain("service, formData, projectId");

    await prebuild({ assets: false, template: ["react-router"] });
    const nodeAdapter = await readFile(
      "app/__generated__/$resources.managed-form-fetch.server.ts",
      "utf8"
    );
    expect(nodeAdapter).toContain(
      "createManagedFormEmailSender = (_input: { context: unknown; formData: FormData; projectId: string }) => undefined"
    );
    expect(nodeAdapter).not.toContain("EMAIL_SERVICE");
  });

  test.each(["saas", undefined] as const)(
    "allows sibling API hosts but blocks published site aliases on Cloudflare (%s)",
    async (destination) => {
      const siteData = createSiteData();
      siteData.projectDomain = "project.wstd.io";
      await writeFile(
        ".webstudio/data.json",
        JSON.stringify({
          ...siteData,
          build: {
            ...siteData.build,
            deployment: {
              destination,
              domains: ["site.example.com", "alias.example.net"],
            },
          },
        })
      );
      await prebuild({
        assets: false,
        template: ["react-router", "react-router-cloudflare"],
      });
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      const bundle = await build({
        entryPoints: [
          join(
            tempDir,
            "app/__generated__/$resources.managed-form-fetch.server.ts"
          ),
        ],
        bundle: true,
        format: "esm",
        platform: "node",
        conditions: ["webstudio"],
        write: false,
      });
      const adapter = (await import(
        /* @vite-ignore */
        `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
      )) as {
        createManagedFormResourceFetch: (input: {
          request: Request;
          context: unknown;
          projectDomain: string;
        }) => typeof fetch & { validateDestination: (url: URL) => void };
      };
      const metadataBundle = await build({
        stdin: {
          contents: 'export { projectId } from "./app/__generated__/_index";',
          resolveDir: tempDir,
        },
        platform: "node",
        conditions: ["webstudio"],
        bundle: true,
        format: "esm",
        write: false,
      });
      const { projectId } = await import(
        /* @vite-ignore */
        `data:text/javascript;base64,${Buffer.from(metadataBundle.outputFiles[0].text).toString("base64")}`
      );
      expect(projectId).toBe(siteData.build.projectId);
      vi.stubGlobal(
        "fetch",
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init);
          const receivingProjectId =
            new URL(request.url).hostname === "api.example.com"
              ? "other-project"
              : projectId;
          return new Response(null, {
            status: isProtectedResourceReentry(request, receivingProjectId)
              ? 508
              : 200,
          });
        }
      );
      const protectedFetch = adapter.createManagedFormResourceFetch({
        request: new Request("https://site.example.com"),
        context: {},
        projectDomain: siteData.projectDomain,
      });

      try {
        expect((await protectedFetch("https://api.example.com")).status).toBe(
          200
        );
        expect(
          (await protectedFetch("https://unknown-alias.example.com")).status
        ).toBe(508);
      } finally {
        vi.unstubAllGlobals();
      }
      expect(() =>
        protectedFetch.validateDestination(new URL("https://api.example.com"))
      ).not.toThrow();
      for (const hostname of [
        "site.example.com",
        "alias.example.net",
        "project.wstd.io",
      ]) {
        expect(() =>
          protectedFetch.validateDestination(new URL(`https://${hostname}`))
        ).toThrow();
      }
    }
  );

  test("publishes configured file-input attributes", async () => {
    await writeSiteData(
      createSiteData({
        instances: [
          [
            "root",
            {
              id: "root",
              component: "ResourceForm",
              children: [{ type: "id", value: "upload" }],
            },
          ],
          [
            "upload",
            {
              id: "upload",
              component: "ws:element",
              tag: "input",
              children: [],
            },
          ],
        ],
        props: [
          ...(["type", "name", "accept"] as const).map(
            (name) =>
              [
                name,
                {
                  id: name,
                  instanceId: "upload",
                  name,
                  type: "string" as const,
                  value:
                    name === "type"
                      ? "file"
                      : name === "name"
                        ? "attachments"
                        : "image/*,.pdf",
                },
              ] as [string, Prop]
          ),
          ...(["required", "multiple"] as const).map(
            (name) =>
              [
                name,
                {
                  id: name,
                  instanceId: "upload",
                  name,
                  type: "boolean" as const,
                  value: true,
                },
              ] as [string, Prop]
          ),
        ],
      })
    );

    await prebuild({ assets: false, template: ["react-router"] });

    const page = await readFile("app/__generated__/_index.tsx", "utf8");
    expect(page).toContain('type={"file"}');
    expect(page).toContain('name={"attachments"}');
    expect(page).toContain('accept={"image/*,.pdf"}');
    expect(page).toContain("required={true}");
    expect(page).toContain("multiple={true}");
  });

  test("preserves the legacy Contact recipients without a separate Form confirmation", async () => {
    const siteData = createSiteData({
      pageMeta: {
        contactEmail: '"Team, West" <team@example.com>',
        emailSender: "Owner <owner@example.com>",
      },
    });
    await writeSiteData(siteData);
    await prebuild({
      assets: false,
      template: ["react-router"],
      preserveRouteTemplates: true,
    });
    const generated = await readFile(
      "app/__generated__/_index.server.tsx",
      "utf8"
    );
    expect(generated).toContain(
      'export const contactEmail = "\\"Team, West\\" <team@example.com>"'
    );
    expect(generated).not.toContain("export const emailDefaults");
  });
  test("rejects Assets queries without a content database without changing generated files", async () => {
    const siteData = createSiteData();
    siteData.build.resources = [["posts", createQueryResource()]];
    siteData.build.dataSources = [
      [
        "posts-data",
        {
          id: "posts-data",
          type: "resource",
          name: "posts",
          resourceId: "posts",
          scopeInstanceId: "root",
        },
      ],
    ];
    await writeSiteData(siteData);
    const existingFiles = [
      "app/routes/_index.tsx",
      "app/__generated__/index.ts",
    ];
    for (const file of existingFiles) {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, "previous build");
    }

    await expect(
      prebuild({ assets: false, template: ["defaults"] })
    ).rejects.toThrow(
      "Assets queries require a content database. Sync the project again before building."
    );
    for (const file of existingFiles) {
      await expect(readFile(file, "utf8")).resolves.toBe("previous build");
    }
  });

  test("publishes custom headers and refreshes them on incremental builds", async () => {
    const projectSettings = {
      meta: {
        customHeaders: [
          {
            name: "Content-Security-Policy",
            value: "frame-ancestors https://example.com",
          },
          { name: "X-Frame-Options", value: "DENY" },
        ],
      },
      compiler: {},
    };
    const data = createSiteData();
    const bundle = { ...data, build: { ...data.build, projectSettings } };
    await writeFile(".webstudio/data.json", JSON.stringify(bundle));
    await prebuild({
      assets: false,
      template: ["defaults"],
      preserveRouteTemplates: true,
    });
    const file = "app/__generated__/$resources.headers.server.ts";
    await expect(readFile(file, "utf8")).resolves.toBe(
      generateResponseHeadersModule(projectSettings)
    );

    bundle.build.projectSettings.meta.customHeaders = [];
    await writeFile(".webstudio/data.json", JSON.stringify(bundle));
    await prebuild({
      assets: false,
      template: ["defaults"],
      incremental: true,
    });
    await expect(readFile(file, "utf8")).resolves.toBe(
      generateResponseHeadersModule()
    );
  });

  test.each(["defaults", "react-router", "ssg"])(
    "does not scaffold a default root favicon with the %s template",
    async (template) => {
      await writeSiteData(
        createSiteData({ pageMeta: { faviconAssetId: "asset-image" } })
      );
      await prebuild({ assets: false, template: [template] });

      await expect(stat("public/favicon.ico")).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(
        readFile("app/__generated__/_index.tsx", "utf8")
      ).resolves.toContain('"image.png"');
      const headPath =
        template === "ssg" ? "pages/index/+Head.tsx" : "app/routes/_index.tsx";
      await expect(readFile(headPath, "utf8")).resolves.toContain(
        template === "ssg" ? 'rel="icon"' : 'rel: "icon"'
      );
    }
  );

  test.each([true, false, undefined])(
    "requires direct MDX source content (available: %s)",
    async (hasSource) => {
      // OrganizeOS fork: MDX publishes only with the switch on (orgScript)
      publishAsIfOrgScriptMayRun();
      const source = "# Published from MDX";
      const article: AssetFileDocument = {
        ...indexedDocument,
        _id: "article",
        name: "article.mdx",
        path: "article.mdx",
        key: "article",
        extension: "mdx",
        mimeType: "text/mdx",
        size: new TextEncoder().encode(source).byteLength,
        revision: "article-revision",
        contentRef: "article.mdx",
        properties: {},
      };
      const siteData = createSiteData({
        assets: [createAssetForIndexedDocument(article)],
        instances: [
          [
            "root",
            {
              id: "root",
              component: "Box",
              children: [{ type: "id", value: "content" }],
            },
          ],
          [
            "content",
            {
              id: "content",
              component: "ws:block",
              children: [{ type: "id", value: "content-templates" }],
            },
          ],
          [
            "content-templates",
            {
              id: "content-templates",
              component: "ws:block-template",
              children: [],
            },
          ],
        ],
        props: [
          [
            "content-src",
            {
              id: "content-src",
              instanceId: "content",
              name: "src",
              type: "asset",
              value: "article",
            },
          ],
        ],
      });
      const siteDataWithIndex = {
        ...siteData,
        assetIndex:
          hasSource === undefined
            ? undefined
            : await createTestAssetIndex(
                article,
                hasSource
                  ? {
                      "article.mdx": source,
                    }
                  : {}
              ),
      };
      await writeSiteData(siteDataWithIndex);

      if (!hasSource) {
        await expect(
          prebuild({ assets: false, template: ["react-router"] })
        ).rejects.toThrow(
          hasSource === undefined
            ? "require a content database"
            : 'Published MDX Asset "article" could not be loaded'
        );
        return;
      }

      await prebuild({ assets: false, template: ["react-router"] });

      const generatedPage = await readFile(
        "app/__generated__/_index.tsx",
        "utf8"
      );
      expect(generatedPage).toContain("Published from MDX");
      expect(generatedPage).not.toContain("fetch(");
    }
  );

  test("materializes Content Blocks introduced by an MDX template", async () => {
    // OrganizeOS fork: MDX publishes only with the switch on (orgScript)
    publishAsIfOrgScriptMayRun();
    const outerSource = '<ws.element ws:name="Nested" />';
    const innerSource = "# Nested published content";
    const createMdxDocument = (
      id: string,
      source: string
    ): AssetFileDocument => ({
      ...indexedDocument,
      _id: id,
      name: `${id}.mdx`,
      path: `${id}.mdx`,
      key: id,
      extension: "mdx",
      mimeType: "text/mdx",
      size: new TextEncoder().encode(source).byteLength,
      revision: `${id}-revision`,
      contentRef: `${id}.mdx`,
      properties: {},
    });
    const outer = createMdxDocument("outer", outerSource);
    const inner = createMdxDocument("inner", innerSource);
    const siteData = createSiteData({
      assets: [outer, inner].map(createAssetForIndexedDocument),
      instances: [
        [
          "root",
          {
            id: "root",
            component: "Box",
            children: [{ type: "id", value: "outer-block" }],
          },
        ],
        [
          "outer-block",
          {
            id: "outer-block",
            component: "ws:block",
            children: [{ type: "id", value: "templates" }],
          },
        ],
        [
          "templates",
          {
            id: "templates",
            component: "ws:block-template",
            children: [{ type: "id", value: "nested-block" }],
          },
        ],
        [
          "nested-block",
          {
            id: "nested-block",
            component: "ws:block",
            label: "Nested",
            children: [{ type: "id", value: "nested-templates" }],
          },
        ],
        [
          "nested-templates",
          {
            id: "nested-templates",
            component: "ws:block-template",
            children: [],
          },
        ],
      ],
      props: [
        [
          "outer-source",
          {
            id: "outer-source",
            instanceId: "outer-block",
            name: "src",
            type: "asset",
            value: "outer",
          },
        ],
        [
          "inner-source",
          {
            id: "inner-source",
            instanceId: "nested-block",
            name: "src",
            type: "asset",
            value: "inner",
          },
        ],
      ],
    });
    const siteDataWithIndex = {
      ...siteData,
      assetIndex: await createTestAssetIndex([outer, inner], {
        "outer.mdx": outerSource,
        "inner.mdx": innerSource,
      }),
    };
    await writeSiteData(siteDataWithIndex);

    await prebuild({ assets: false, template: ["react-router"] });

    await expect(
      readFile("app/__generated__/_index.tsx", "utf8")
    ).resolves.toContain("Nested published content");
  });

  test("warns and stops excessive published Content Block expansion", async () => {
    // OrganizeOS fork: MDX publishes only with the switch on (orgScript)
    publishAsIfOrgScriptMayRun();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const source = "# Published";
    const article: AssetFileDocument = {
      ...indexedDocument,
      _id: "article",
      name: "article.mdx",
      path: "article.mdx",
      key: "article",
      extension: "mdx",
      mimeType: "text/mdx",
      size: new TextEncoder().encode(source).byteLength,
      revision: "article-revision",
      contentRef: "article.mdx",
      properties: {},
    };
    const blockIds = Array.from(
      { length: contentEngineLimits.candidateDocuments + 1 },
      (_, index) => `content-${index}`
    );
    const siteData = createSiteData({
      assets: [createAssetForIndexedDocument(article)],
      instances: [
        [
          "root",
          {
            id: "root",
            component: "Box",
            children: blockIds.map((value) => ({ type: "id", value })),
          },
        ],
        ...blockIds.map(
          (id) =>
            [id, { id, component: "ws:block", children: [] }] as [
              string,
              Omit<Instance, "type">,
            ]
        ),
      ],
      props: blockIds.map((instanceId) => [
        `${instanceId}-source`,
        {
          id: `${instanceId}-source`,
          instanceId,
          name: "src",
          type: "asset",
          value: "article",
        },
      ]),
    });
    const siteDataWithIndex = {
      ...siteData,
      assetIndex: await createTestAssetIndex(article, {
        "article.mdx": source,
      }),
    };
    await writeSiteData(siteDataWithIndex);

    await prebuild({ assets: false, template: ["react-router"] });

    expect(
      warn.mock.calls
        .map(([message]) => JSON.parse(String(message)))
        .find(
          ({ message }) =>
            message ===
            "Published MDX Content Block count exceeds the safe limit"
        )
    ).toMatchObject({
      type: "webstudio-build-warning",
      feature: "content-block-mdx",
      code: "invalid-mdx",
      severity: "error",
    });
  });

  test("materializes finite dynamic MDX candidates without publishing unrelated files", async () => {
    // OrganizeOS fork: MDX publishes only with the switch on, and the pause
    // leaves out a bound Content Block src (orgScript)
    publishAsIfOrgScriptMayRun();
    const createDocument = (
      id: string,
      extension: "json" | "mdx",
      properties?: Record<string, string>
    ): AssetFileDocument => ({
      ...indexedDocument,
      _id: id,
      name: `${id}.${extension}`,
      path: `${id}.${extension}`,
      key: id,
      extension,
      mimeType: extension === "mdx" ? "text/mdx" : "application/json",
      revision: `${id}-revision`,
      contentRef: `${id}.${extension}`,
      properties: properties ?? {},
    });
    const post = createDocument("post", "json", {
      category: "published",
      mdx: "article",
    });
    const privatePost = createDocument("private-post", "json", {
      category: "private",
      mdx: "private",
    });
    const article = createDocument("article", "mdx");
    const privateArticle = createDocument("private", "mdx");
    const documents = [post, privatePost, article, privateArticle];
    const sourceExpression = `${encodeDataSourceVariable(
      "posts-data"
    )}.data.properties.mdx`;
    const siteData = createSiteData({
      assets: [
        ...documents.map(createAssetForIndexedDocument),
        {
          id: "dynamic-background",
          projectId: "project-1",
          name: "dynamic.png",
          type: "image",
          format: "png",
          size: 1,
          meta: { width: 1, height: 1 },
          description: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      instances: [
        [
          "root",
          {
            id: "root",
            component: "Box",
            children: [{ type: "id", value: "content" }],
          },
        ],
        [
          "content",
          {
            id: "content",
            component: "ws:block",
            children: [{ type: "id", value: "templates" }],
          },
        ],
        [
          "templates",
          {
            id: "templates",
            component: "ws:block-template",
            children: [{ type: "id", value: "dynamic-card" }],
          },
        ],
        [
          "dynamic-card",
          {
            id: "dynamic-card",
            component: "ws:element",
            tag: "section",
            label: "Dynamic card",
            children: [],
          },
        ],
      ],
      props: [
        [
          "content-src",
          {
            id: "content-src",
            instanceId: "content",
            name: "src",
            type: "expression",
            value: sourceExpression,
          },
        ],
      ],
    });
    siteData.build.dataSources = [
      [
        "posts-data",
        {
          type: "resource",
          id: "posts-data",
          scopeInstanceId: "root",
          name: "posts",
          resourceId: "posts",
        },
      ],
    ];
    siteData.build.resources = [
      [
        "posts",
        {
          ...createQueryResource(),
          body: createStructuredAssetQueryResourceBody({
            where: {
              all: [
                {
                  field: ["properties", "category"],
                  operator: "eq",
                  value: '"published"',
                },
              ],
            },
            sort: [],
            limit: "100",
            offset: "0",
            output: { mode: "all", includeMetadata: true },
            content: { mode: "none" },
          }),
        },
      ],
    ];
    siteData.build.styleSources = [
      ["dynamic-style", { type: "local", id: "dynamic-style" }],
    ] as never;
    siteData.build.styleSourceSelections = [
      [
        "dynamic-card",
        { instanceId: "dynamic-card", values: ["dynamic-style"] },
      ],
    ] as never;
    siteData.build.breakpoints = [["base", { id: "base", label: "" }]] as never;
    siteData.build.styles = [
      [
        "dynamic-background-style",
        {
          styleSourceId: "dynamic-style",
          breakpointId: "base",
          property: "backgroundImage",
          value: {
            type: "layers",
            value: [
              {
                type: "image",
                value: { type: "asset", value: "dynamic-background" },
              },
            ],
          },
        },
      ],
    ] as never;
    const siteDataWithIndex = {
      ...siteData,
      assetIndex: await createTestAssetIndex(documents, {
        "article.mdx":
          '# Public article\n\n<ws.element ws:name="Dynamic card" />',
        "private.mdx": "# Private article",
      }),
    };
    await writeSiteData(siteDataWithIndex);

    await prebuild({ assets: false, template: ["react-router"] });

    const generatedPage = await readFile(
      "app/__generated__/_index.tsx",
      "utf8"
    );
    expect(generatedPage).toContain("Public article");
    expect(generatedPage).not.toContain("Private article");
    expect(generatedPage).toContain('=== "article"');
    expect(generatedPage).toContain("<section");
    expect(generatedPage).not.toContain('"dynamic.png"');
  });

  test("rejects a dynamic MDX source without a content database", async () => {
    // OrganizeOS fork: the pause leaves out a bound Content Block src, so
    // only with the switch on is there a dynamic source to reject (orgScript)
    publishAsIfOrgScriptMayRun();
    const siteData = createSiteData({
      instances: [
        [
          "root",
          {
            id: "root",
            component: "Box",
            children: [{ type: "id", value: "content" }],
          },
        ],
        ["content", { id: "content", component: "ws:block", children: [] }],
      ],
      props: [
        [
          "content-src",
          {
            id: "content-src",
            instanceId: "content",
            name: "src",
            type: "expression",
            value: "post.body",
          },
        ],
      ],
    });
    await writeSiteData(siteData);

    await expect(
      prebuild({ assets: false, template: ["react-router"] })
    ).rejects.toThrow("require a content database");
  });

  test("excludes resources in statically hidden subtrees", async () => {
    const siteData = createSiteData({
      instances: [
        [
          "root",
          {
            id: "root",
            component: "Body",
            children: [
              { type: "id", value: "hidden" },
              { type: "id", value: "visible" },
              { type: "id", value: "dynamic" },
            ],
          },
        ],
        [
          "hidden",
          {
            id: "hidden",
            component: "Box",
            children: [{ type: "id", value: "hidden-child" }],
          },
        ],
        [
          "hidden-child",
          { id: "hidden-child", component: "Box", children: [] },
        ],
        ["visible", { id: "visible", component: "Box", children: [] }],
        ["dynamic", { id: "dynamic", component: "Box", children: [] }],
      ],
      props: [
        [
          "hidden-show",
          {
            id: "hidden-show",
            instanceId: "hidden",
            name: showAttribute,
            type: "boolean",
            value: false,
          },
        ],
        [
          "dynamic-show",
          {
            id: "dynamic-show",
            instanceId: "dynamic",
            name: showAttribute,
            type: "expression",
            value: "false",
          },
        ],
      ],
    });
    const resourceNames = ["hidden", "hidden-child", "visible", "dynamic"];
    siteData.build.dataSources = resourceNames.map((name) => [
      `${name}-data-source`,
      {
        id: `${name}-data-source`,
        scopeInstanceId: name,
        type: "resource",
        name,
        resourceId: `${name}-resource`,
      },
    ]);
    siteData.build.resources = resourceNames.map((name) => [
      `${name}-resource`,
      {
        id: `${name}-resource`,
        name,
        url: JSON.stringify(`https://example.com/${name}`),
        method: "get",
        headers: [],
      },
    ]);
    await writeSiteData(siteData);

    await prebuild({
      assets: false,
      template: ["react-router"],
      preserveRouteTemplates: true,
    });

    const generatedServer = await readFile(
      "app/__generated__/_index.server.tsx",
      "utf8"
    );
    expect(generatedServer).not.toContain("https://example.com/hidden");
    expect(generatedServer).not.toContain("https://example.com/hidden-child");
    expect(generatedServer).toContain("https://example.com/visible");
    expect(generatedServer).toContain("https://example.com/dynamic");
  });

  test("imports only configured Code Text language and theme assets", async () => {
    await writeSiteData(
      createCodeTextSiteData([
        {
          id: "code-1",
          code: "const answer = 42;",
          language: "javascript",
          theme: "github-light",
        },
        {
          id: "code-2",
          code: "const answer = 42;",
          language: "javascript",
          theme: "nord",
        },
      ])
    );

    await prebuild({ assets: false, template: ["react-router"] });

    const generatedPage = await readFile(
      "app/__generated__/_index.tsx",
      "utf8"
    );
    const importSources = await getImportSources(generatedPage);
    expect(
      importSources.filter((source) => source === "@shikijs/langs/javascript")
    ).toHaveLength(1);
    expect(importSources).toEqual(
      expect.arrayContaining([
        "@shikijs/themes/github-light",
        "@shikijs/themes/nord",
        "@webstudio-is/sdk-components-react/code-text",
      ])
    );
    expect(importSources).not.toContain("@shikijs/langs/css");
    expect(importSources).not.toContain("@shikijs/themes/dracula");
  });

  test("generates lazy loaders for bound selections", async () => {
    await writeSiteData(
      createCodeTextSiteData([
        {
          id: "code-1",
          code: "const answer = 42;",
          language: { type: "expression", value: '"javascript"' },
          theme: { type: "expression", value: '"github-light"' },
        },
      ])
    );

    await prebuild({ assets: false, template: ["react-router"] });

    const generatedPage = await readFile(
      "app/__generated__/_index.tsx",
      "utf8"
    );
    const importSources = await getImportSources(generatedPage);
    expect(importSources).toEqual(
      expect.arrayContaining(["shiki/langs", "shiki/themes"])
    );
    expect(importSources).not.toContain("@shikijs/langs/javascript");
    expect(importSources).not.toContain("@shikijs/themes/github-light");
    expect(generatedPage).not.toContain("import.meta.env.SSR");
    expect(generatedPage).not.toContain("await Promise.all");
    expect(generatedPage).toContain("suspense: true");
    expect(generatedPage).toContain("loader?.().then");
  });

  test("prerenders configured and legacy Code Text in SSG output", async () => {
    await writeSiteData(
      createCodeTextSiteData([
        {
          id: "code-highlighted",
          code: "const answer = 42;",
          language: "javascript",
          theme: "github-light",
        },
        {
          id: "code-plaintext",
          code: "plain <value>",
          language: "plaintext",
          theme: "nord",
        },
        {
          id: "code-legacy",
          lang: "en",
          children: [{ type: "text", value: "legacy <code>" }],
        },
      ])
    );

    await prebuild({ assets: false, template: ["ssg"] });

    const generatedPage = await readFile(
      "app/__generated__/_index.tsx",
      "utf8"
    );
    const importSources = await getImportSources(generatedPage);
    expect(importSources).toEqual(
      expect.arrayContaining([
        "@shikijs/langs/javascript",
        "@shikijs/themes/github-light",
        "@shikijs/themes/nord",
      ])
    );
    expect(importSources).not.toContain("@shikijs/langs/plaintext");
    expect(importSources).not.toContain("@shikijs/langs/css");
    expect(importSources).not.toContain("@shikijs/themes/dracula");
    expect(
      JSON.parse(await readFile("package.json", "utf8")).dependencies
    ).toMatchObject({
      "@shikijs/langs": "4.4.1",
      "@shikijs/themes": "4.4.1",
      shiki: "4.4.1",
    });

    await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
    await prerenderSsg();

    const html = parseHtml(await readFile("dist/client/index.html", "utf8"));
    const codeElements = findElementsByTagName(html, "code");
    const [highlightedCode, plaintextCode, legacyCode] = codeElements;
    if (
      highlightedCode === undefined ||
      plaintextCode === undefined ||
      legacyCode === undefined
    ) {
      throw new Error("Expected three prerendered Code Text elements");
    }
    expect(
      Object.fromEntries(
        highlightedCode.attrs.map(({ name, value }) => [name, value])
      )
    ).toMatchObject({
      class: "w-code-text",
    });
    expect(
      Object.fromEntries(
        highlightedCode.attrs.map(({ name, value }) => [name, value])
      )
    ).not.toHaveProperty("tabindex");
    expect(
      findElementsByTagName(highlightedCode, "span").length
    ).toBeGreaterThan(0);
    expect(getTextContent(highlightedCode)).toBe("const answer = 42;");

    expect(
      Object.fromEntries(
        plaintextCode.attrs.map(({ name, value }) => [name, value])
      )
    ).toMatchObject({
      class: "w-code-text",
      style: expect.stringContaining(
        "--w-code-text-theme-background:#2e3440ff"
      ),
    });
    expect(getTextContent(plaintextCode)).toBe("plain <value>");

    expect(
      Object.fromEntries(
        legacyCode.attrs.map(({ name, value }) => [name, value])
      )
    ).toMatchObject({ class: "w-code-text", lang: "en" });
    expect(findElementsByTagName(legacyCode, "span").length).toBeGreaterThan(0);
    expect(getTextContent(legacyCode)).toBe("legacy <code>");
  }, 60_000);

  test("prerenders bound Code Text while keeping catalog chunks lazy", async () => {
    await writeSiteData(
      createCodeTextSiteData([
        {
          id: "code-bound",
          code: "const answer = 42;",
          language: { type: "expression", value: '"javascript"' },
          theme: { type: "expression", value: '"github-light"' },
        },
      ])
    );

    await prebuild({ assets: false, template: ["ssg"] });
    await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
    await prerenderSsg();

    const htmlSource = await readFile("dist/client/index.html", "utf8");
    expect(htmlSource).toMatch(/^<!DOCTYPE html><html/);
    const html = parseHtml(htmlSource);
    const [codeElement] = findElementsByTagName(html, "code");
    if (codeElement === undefined) {
      throw new Error("Expected a prerendered Code Text element");
    }
    expect(findElementsByTagName(codeElement, "span").length).toBeGreaterThan(
      0
    );
    expect(getTextContent(codeElement)).toBe("const answer = 42;");

    const clientPaths = await getFilePaths("dist/client");
    const catalogChunks = clientPaths.filter(
      (path) => path.includes("/chunks/") && path.endsWith(".js")
    );
    expect(catalogChunks.length).toBeGreaterThan(100);
    const referencedChunks = catalogChunks.filter((chunk) => {
      const filename = chunk.split("/").at(-1);
      return filename !== undefined && htmlSource.includes(filename);
    });
    expect(referencedChunks).toHaveLength(1);
  }, 60_000);

  test("emits the identity marker only for local previews", async () => {
    await prebuild({
      assets: false,
      template: ["react-router"],
      previewIdentity: true,
    });

    await expect(
      readFile("public/__webstudio/preview.json", "utf8")
    ).resolves.toBe(JSON.stringify({ projectId: "project-id", version: 1 }));
  });

  test("does not add the local preview marker to deployable builds", async () => {
    await prebuild({
      assets: false,
      template: ["react-router"],
      preserveRouteTemplates: true,
    });

    await expect(
      readFile("public/__webstudio/preview.json", "utf8")
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("incrementally replaces only changed generated files", async () => {
    const siteData = createSiteData({
      pages: [
        {
          id: "home",
          name: "Home",
          title: "Home",
          path: "",
          rootInstanceId: "root",
          meta: {},
        },
        {
          id: "pricing",
          name: "Pricing",
          title: "Pricing",
          path: "/pricing",
          rootInstanceId: "root",
          meta: {},
        },
        {
          id: "about",
          name: "About",
          title: "About",
          path: "/about",
          rootInstanceId: "root",
          meta: {},
        },
      ],
    });
    await writeSiteData(siteData);
    await prebuild({
      assets: false,
      template: ["react-router"],
      preserveRouteTemplates: true,
    });
    const unchangedFile = "app/__generated__/[about]._index.tsx";
    const unchangedTime = new Date("2000-01-01T00:00:00.000Z");
    await utimes(unchangedFile, unchangedTime, unchangedTime);
    const pricingFile = "app/__generated__/[pricing]._index.tsx";
    const pricingRoute = "app/routes/[pricing]._index.tsx";
    const templateRoute = "app/routes/[robots.txt].tsx";
    await writeFile("app/routes/custom.tsx", "custom", "utf8");

    siteData.build.version += 1;
    siteData.build.pages.pages = siteData.build.pages.pages.filter(
      (page) => page.id !== "pricing"
    );
    await writeSiteData(siteData);
    await prebuild({
      assets: false,
      template: ["react-router"],
      incremental: true,
    });

    siteData.build.version += 1;
    await writeSiteData(siteData);
    await prebuild({
      assets: false,
      template: ["react-router"],
      incremental: true,
    });

    expect((await stat(unchangedFile)).mtimeMs).toBe(unchangedTime.getTime());
    await expect(
      readFile("app/__generated__/_index.tsx", "utf8")
    ).resolves.toContain(
      `export const projectVersion = ${siteData.build.version};`
    );
    await expect(readFile(pricingFile, "utf8")).rejects.toThrow("ENOENT");
    await expect(readFile(pricingRoute, "utf8")).rejects.toThrow("ENOENT");
    await expect(readFile(templateRoute, "utf8")).resolves.toContain(
      "User-agent"
    );
    await expect(readFile("app/routes/custom.tsx", "utf8")).resolves.toBe(
      "custom"
    );
  });

  test("rejects generated manifests that point outside owned output", async () => {
    const outsideFile = "outside.ts";
    await writeSiteData(createSiteData());
    await prebuild({
      assets: false,
      template: ["react-router"],
      preserveRouteTemplates: true,
    });
    await writeFile(outsideFile, "preserve", "utf8");
    await writeFile(
      ".webstudio/generated-files.json",
      JSON.stringify([outsideFile]),
      "utf8"
    );

    await expect(
      prebuild({
        assets: false,
        template: ["react-router"],
        incremental: true,
      })
    ).rejects.toThrow("Generated files manifest is invalid.");
    await expect(readFile(outsideFile, "utf8")).resolves.toBe("preserve");
  });

  test("excludes draft pages from published output", async () => {
    await writeSiteData(
      createSiteData({
        pages: [
          {
            id: "home",
            name: "Home",
            title: "Home",
            path: "",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "published",
            name: "Published",
            title: "Published",
            path: "/published",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "draft",
            name: "Draft",
            title: "Draft",
            path: "/draft",
            rootInstanceId: "root",
            meta: {},
            isDraft: true,
          },
        ],
      })
    );

    await prebuild({ assets: false, template: ["react-router"] });

    await expect(
      readFile("app/routes/[published]._index.tsx", "utf8")
    ).resolves.toContain("../__generated__/[published]._index");
    await expect(
      readFile("app/routes/[draft]._index.tsx", "utf8")
    ).rejects.toThrow("ENOENT");
    await expect(
      readFile("app/__generated__/[draft]._index.tsx", "utf8")
    ).rejects.toThrow("ENOENT");
    await expect(
      readFile("app/__generated__/$resources.sitemap.xml.ts", "utf8")
    ).resolves.not.toContain('"path": "/draft"');
    await expect(
      readFile("app/routes/[sitemap.xml]._index.tsx", "utf8")
    ).resolves.toContain("sitemap.map");
  });

  test(
    "types an empty generated sitemap",
    async () => {
      await writeSiteData(
        createSiteData({
          pages: [
            {
              id: "draft",
              name: "Draft",
              title: "Draft",
              path: "/draft",
              rootInstanceId: "root",
              meta: {},
              isDraft: true,
            },
          ],
        })
      );

      await prebuild({
        assets: false,
        template: ["react-router"],
      });
      await writeFile(
        "sitemap-typecheck.ts",
        `import { sitemap } from "./app/__generated__/$resources.sitemap.xml";
sitemap.map((page) => page.path);`
      );
      await runGeneratedCommand("tsc", [
        "--ignoreConfig",
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--moduleResolution",
        "bundler",
        "--module",
        "esnext",
        "--target",
        "es2022",
        "sitemap-typecheck.ts",
      ]);
    },
    slowPrebuildTestTimeout
  );

  test("generates draft routes for local verification without publishing them", async () => {
    await writeSiteData(
      createSiteData({
        pages: [
          {
            id: "home",
            name: "Home",
            title: "Home",
            path: "",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "draft",
            name: "Draft",
            title: "Draft",
            path: "/draft",
            rootInstanceId: "root",
            meta: {},
            isDraft: true,
          },
        ],
      })
    );

    await prebuild({
      assets: false,
      template: ["react-router"],
      includeDraftPages: true,
    });

    await expect(
      readFile("app/routes/[draft]._index.tsx", "utf8")
    ).resolves.toContain("../__generated__/[draft]._index");
    await expect(
      readFile("app/__generated__/[draft]._index.tsx", "utf8")
    ).resolves.toContain('export const siteName = "Site"');
    await expect(
      readFile("app/__generated__/$resources.sitemap.xml.ts", "utf8")
    ).resolves.not.toContain('"path": "/draft"');
  });

  test("uses the local asset base in generated asset resources", async () => {
    await writeSiteData(
      createSiteData({
        assets: [
          {
            id: "asset-audio",
            projectId: "project-id",
            name: "audio.mp3",
            type: "file",
            format: "mp3",
            size: 1,
            meta: {},
            description: "",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      })
    );

    await prebuild({
      assets: false,
      template: ["defaults"],
    });

    const assetsModule = await readFile(
      "app/__generated__/$resources.assets.ts",
      "utf8"
    );
    expect(assetsModule).toContain('"url": "/assets/audio.mp3"');
    expect(assetsModule).toContain("export const assetUrlsByPath");
    expect(assetsModule).toContain('"/audio.mp3": "/assets/audio.mp3"');
    expect(assetsModule).not.toContain("/cgi/");

    const route = await readFile("app/routes/_index.tsx", "utf8");
    expect(route).toContain("assetUrlsByPath");
    expect(route).toContain("assetUrlsByPath,");
  });

  test("scaffolds generated files and stores redirects as data", async () => {
    await mkdir("app/__generated__", { recursive: true });
    await mkdir("app/routes", { recursive: true });
    await writeFile("app/__generated__/stale.ts", "stale", "utf8");
    await writeFile("app/routes/stale.tsx", "stale", "utf8");

    await prebuild({
      assets: false,
      template: ["defaults"],
    });

    const redirectsModule = await readFile(
      "app/__generated__/$resources.redirects.ts",
      "utf8"
    );
    expect(redirectsModule).toEqual(
      generateRedirectsModule([
        {
          old: "/dl.php?filename=file.pdf",
          new: "/downloads/file.pdf",
        },
        {
          old: "/über",
          new: "/ueber",
          status: "302",
        },
      ])
    );

    const assetsModule = await readFile(
      "app/__generated__/$resources.assets.ts",
      "utf8"
    );
    expect(assetsModule).toContain("export const assets");
    expect(assetsModule).toContain('"asset-image"');
    expect(assetsModule).toContain("image.png");
    expect(assetsModule).not.toContain("assets/query");
    expect(assetsModule).not.toContain("properties");
    await expect(
      readFile("app/__generated__/$resources.sitemap.xml.ts", "utf8")
    ).resolves.toContain('"path": "/"');
    await expect(
      readFile("app/__generated__/$resources.wsauth.server.ts", "utf8")
    ).resolves.toContain("wsauth");
    await expect(readFile(".webstudio/auth.json", "utf8")).resolves.toContain(
      "{}"
    );

    const routeTemplate = await readFile("app/routes/_index.tsx", "utf8");
    expect(routeTemplate).toContain("../__generated__/_index");
    expect(routeTemplate).toContain("../__generated__/_index.server");
    expect(routeTemplate).not.toContain("__CLIENT__");
    expect(routeTemplate).not.toContain("__SERVER__");
    await expectGeneratedRedirectFallback("app/routes/$.tsx");

    await expect(
      readFile("app/__generated__/stale.ts", "utf8")
    ).rejects.toThrow("ENOENT");
    await expect(readFile("app/routes/stale.tsx", "utf8")).rejects.toThrow(
      "ENOENT"
    );

    const generatedPaths = await getFilePaths("app");
    expect(generatedPaths).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("dl.php"),
        expect.stringContaining("filename=file.pdf"),
        expect.stringContaining("über"),
      ])
    );
  });

  test("selects react-router templates", async () => {
    await prebuild({
      assets: false,
      template: ["react-router", "react-router-vercel"],
    });

    await expect(readFile("app/routes.ts", "utf8")).resolves.toContain(
      "react-router"
    );
    await expect(readFile("app/root.tsx", "utf8")).resolves.toContain(
      "react-router"
    );
    await expect(readFile("app/routes/_index.tsx", "utf8")).resolves.toContain(
      'from "react-router"'
    );
    await expect(readFile("vite.config.ts", "utf8")).resolves.toContain(
      'process.env.WEBSTUDIO_LOCAL_CLI_BOOTSTRAPPED === "1"'
    );
    await expect(readFile("vite.config.ts", "utf8")).resolves.toContain(
      '["webstudio"]'
    );
    await expect(readFile("vite.config.ts", "utf8")).resolves.toContain(
      'noExternal: ["nanoid"]'
    );
    await expect(
      readFile("app/__generated__/$resources.redirects.ts", "utf8")
    ).resolves.toContain("/dl.php?filename=file.pdf");
    // OrganizeOS fork: published images are served as originals
    // (templates/react-router-vercel/app/constants.mjs, ORGANIZEOS-FORK.md
    // section 8), where upstream builds /_vercel/image URLs.
    const constants = await readFile("app/constants.mjs", "utf8");
    expect(constants).toContain("return props.src;");
    expect(constants).not.toContain("return `/_vercel/image?");
    await expect(readFile("app/routes/[_image].$.ts", "utf8")).rejects.toThrow(
      "ENOENT"
    );
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    expect(packageJson.engines).toEqual({ node: ">=22.12.0" });
    expect(packageJson.devEngines).toEqual({
      runtime: {
        name: "node",
        version: ">=22.12.0",
        onFail: "error",
      },
    });
    await expect(readFile(".npmrc", "utf8")).resolves.toContain(
      "engine-strict=true"
    );
    expect(packageJson.dependencies).not.toHaveProperty(
      "@webstudio-is/asset-resource"
    );
    expect(packageJson.dependencies).not.toHaveProperty(
      "@webstudio-is/content-engine"
    );
    expect(packageJson.dependencies).not.toHaveProperty("h3");
    expect(packageJson.dependencies).not.toHaveProperty("ipx");
    expect(packageJson.dependencies).not.toHaveProperty(
      "@webstudio-is/content-engine"
    );
  });

  // OrganizeOS fork: the OrganizeOS blocks ship inside the site as a copy of
  // their build (organizeos-components.ts).
  const organizeosDir = join("app", "__organizeos__");

  const expectCopyToBeTheClosure = async () => {
    const entryPath = resolveOrganizeosComponentsModule();
    // the components module, and the page module every html route mounts
    const modules = new Set([
      ...(await findModuleClosure(entryPath)).modules,
      ...(
        await findModuleClosure(
          join(dirname(entryPath), ORGANIZEOS_PAGE_MODULE)
        )
      ).modules,
    ]);
    const copied = await getFilePaths(organizeosDir);
    expect(copied.map((path) => relative(organizeosDir, path)).sort()).toEqual(
      [
        ...[...modules].map((path) => relative(dirname(entryPath), path)),
        // the package's, so the copy carries its license
        "LICENSE",
      ].sort()
    );
  };

  test("imports the OrganizeOS blocks from the copy of their build", async () => {
    await writeSiteData(
      createSiteData({
        instances: [
          [
            "root",
            {
              id: "root",
              component: "Box",
              children: [{ type: "id", value: "signup" }],
            },
          ],
          [
            "signup",
            {
              id: "signup",
              component: "@organizeos/site-components:SignupForm",
              children: [],
            },
          ],
        ],
      })
    );

    await prebuild({
      assets: false,
      template: ["react-router", "react-router-vercel"],
    });

    // The page module sits in app/__generated__/ and imports the block by a
    // path relative to that folder, which reaches the copy.
    const pagePath = join("app", "__generated__", "_index.tsx");
    const page = await readFile(pagePath, "utf8");
    const importSource = page.match(
      /import \{ SignupForm as \w+ \} from "([^"]+)";/
    )?.[1];
    expect(importSource).toBe("../__organizeos__/components.js");
    await expect(
      readFile(join(dirname(pagePath), importSource as string), "utf8")
    ).resolves.toEqual(
      await readFile(resolveOrganizeosComponentsModule(), "utf8")
    );
    // Everything the copy imports came with it, and nothing else did.
    await expectCopyToBeTheClosure();
  });

  test("imports the Share Code Carrier, an Event List's root, from the copy of the build", async () => {
    await writeSiteData(
      createSiteData({
        instances: [
          [
            "root",
            {
              id: "root",
              component: "Box",
              children: [{ type: "id", value: "events" }],
            },
          ],
          [
            "events",
            {
              id: "events",
              component: "@organizeos/site-components:ShareCodeCarrier",
              children: [],
            },
          ],
        ],
      })
    );

    await prebuild({
      assets: false,
      template: ["react-router", "react-router-vercel"],
    });

    const pagePath = join("app", "__generated__", "_index.tsx");
    const page = await readFile(pagePath, "utf8");
    const [, localName, importSource] =
      page.match(/import \{ ShareCodeCarrier as (\w+) \} from "([^"]+)";/) ??
      [];
    expect(importSource).toBe("../__organizeos__/components.js");
    // the page renders it
    expect(page).toContain(`<${localName}`);
    // and the copy of the build exports it
    const copy = await readFile(
      join(dirname(pagePath), importSource as string),
      "utf8"
    );
    expect(copy).toMatch(/export \{[^}]*\bas ShareCodeCarrier\b[^}]*\}/);
    await expectCopyToBeTheClosure();
  });

  test("a second prebuild in the same folder leaves no stale file in the OrganizeOS copy", async () => {
    await prebuild({
      assets: false,
      template: ["react-router", "react-router-vercel"],
    });
    await writeFile(join(organizeosDir, "stale.js"), "stale", "utf8");
    await mkdir(join(organizeosDir, "removed"), { recursive: true });
    await writeFile(join(organizeosDir, "removed", "part.js"), "stale", "utf8");

    await prebuild({
      assets: false,
      template: ["react-router", "react-router-vercel"],
    });

    await expectCopyToBeTheClosure();
  });

  // OrganizeOS fork: a site carries the fork's AGPL code, so the copy ships
  // its license and every html page links the fork's source
  // (route-templates/html.tsx, organizeos-components.ts).
  describe("offers the fork's source", () => {
    const repository = "https://github.com/OrganizeOS-HQ/OrganizeOS-Websites";
    const sha = "0123456789abcdef0123456789abcdef01234567";

    /** The generated html route's links function, the head it renders. */
    const prebuildLinks = async () => {
      await prebuild({
        assets: false,
        template: ["react-router", "react-router-vercel"],
      });
      const route = await readFile(join("app", "routes", "_index.tsx"), "utf8");
      const start = route.indexOf("export const links: LinksFunction");
      return {
        route,
        links: route.slice(start, route.indexOf("\n};\n", start)),
      };
    };

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    test("every html page links the license and the fork at the commit the publish workflow built", async () => {
      vi.stubEnv("GITHUB_REPOSITORY", "OrganizeOS-HQ/OrganizeOS-Websites");
      vi.stubEnv("GITHUB_SHA", sha);

      const { route, links } = await prebuildLinks();

      expect(route).toContain(
        `const organizeosSourceUrl = "${repository}/tree/${sha}";`
      );
      expect(route).not.toContain("__ORGANIZEOS_SOURCE_URL__");
      expect(links).toContain(
        `{ rel: "license", href: "https://www.gnu.org/licenses/agpl-3.0.html" },`
      );
      expect(links).toContain(
        `{ rel: "code-repository", href: organizeosSourceUrl }`
      );
    });

    test("without a commit it links the fork's repository", async () => {
      vi.stubEnv("GITHUB_REPOSITORY", undefined);
      vi.stubEnv("GITHUB_SHA", undefined);

      const { route } = await prebuildLinks();

      expect(route).toContain(`const organizeosSourceUrl = "${repository}";`);
    });

    test("the copy of the blocks carries the package's LICENSE", async () => {
      await prebuild({
        assets: false,
        template: ["react-router", "react-router-vercel"],
      });

      await expect(
        readFile(join(organizeosDir, "LICENSE"), "utf8")
      ).resolves.toEqual(
        await readFile(
          new URL("../../sdk-components-organizeos/LICENSE", import.meta.url),
          "utf8"
        )
      );
    });

    // Owner decision of 2026-11-07: the source offer is the two head links
    // above (license and code-repository) and nothing in the body. This
    // replaces the decision of 2026-10-15, which added a visible "Source" link
    // at the end of the body.
    describe("renders no visible source offer in the body", () => {
      /** Code with its whitespace collapsed, so prettier's wrapping is no part of a test. */
      const compact = (code: string) => code.replace(/\s+/g, " ");

      test("no html route has the source offer's wrapper, text or anchor", async () => {
        const { route } = await prebuildLinks();

        expect(route).not.toContain("data-organizeos-source-offer");
        expect(route).not.toContain("SourceOffer");
        expect(route).not.toContain("Source code of this site");
        expect(compact(route)).not.toMatch(/>\s*Source\s*<\/a>/);
        // the head links stay the offer: the route still names the source URL
        expect(route).toContain("const organizeosSourceUrl =");
      });

      test("the page is rendered through the wrapper that appends the share-code carrier after the page's own children", async () => {
        const { route } = await prebuildLinks();
        const code = compact(route);

        expect(code).toContain(
          "<PageWithShareCode key={url} system={system} />"
        );
        expect(code).not.toContain("<Page key={url}");
        const children = code.indexOf("page.props.children");
        const carrier = code.indexOf("<PageShareCodeCarrier", children);
        expect(children).toBeGreaterThan(-1);
        expect(carrier).toBeGreaterThan(children);
      });

      // The tests above read the route's text. These render it: the
      // PageWithShareCode the site ships, around the generated Page, whose
      // root is the real Body of @webstudio-is/sdk-components-react-router.
      // Only react-router's Scripts and ScrollRestoration are stand-ins (the
      // real ones need a router); they render the <script> elements the real
      // Body puts after its children.
      describe("rendered", () => {
        type Wrapper = ComponentType<{ system: unknown }>;

        /**
         * The route's PageWithShareCode, as the site ships it, around
         * `Page`, with the page's share-code carrier from `pageModule`: the
         * package's own page module unless a test stands in for it.
         */
        const loadWrapper = async (
          route: string,
          Page: unknown,
          pageModule: unknown = organizeosPage
        ) => {
          const start = route.indexOf("const organizeosSourceUrl");
          const wrapper = route.indexOf("const PageWithShareCode", start);
          const end = route.indexOf("\n};\n", wrapper) + "\n};\n".length;
          const reactImport = route.match(
            /import \{[^}]*\bisValidElement\b[^}]*\} from "react";/
          )?.[0];
          const [carrierImport, carrierSource] =
            route.match(/import \{ PageShareCodeCarrier \} from "([^"]+)";/) ??
            [];
          expect(start).toBeGreaterThan(-1);
          expect(wrapper).toBeGreaterThan(start);
          expect(end).toBeGreaterThan(wrapper);
          expect(reactImport).toBeDefined();
          expect(carrierImport).toBeDefined();
          const exports = await runModule(
            [
              reactImport,
              carrierImport,
              `import { Page } from "./page";`,
              route.slice(start, end),
              `export { PageWithShareCode };`,
            ].join("\n"),
            {
              react: React,
              "react/jsx-runtime": jsxRuntime,
              "./page": { Page },
              [carrierSource as string]: pageModule,
            }
          );
          return exports.PageWithShareCode as Wrapper;
        };

        /** The generated Page of the home page, rendering `Body` as its root. */
        const loadGeneratedPage = async (Body: unknown) => {
          const exports = await runModule(
            await readFile(join("app", "__generated__", "_index.tsx"), "utf8"),
            {
              react: React,
              "react/jsx-runtime": jsxRuntime,
              "@webstudio-is/react-sdk/runtime":
                await import("@webstudio-is/react-sdk/runtime"),
              "@webstudio-is/sdk-components-react-router": { Body },
            }
          );
          return exports.Page;
        };

        /** The real Body, with react-router's script elements stood in. */
        const importBody = async () => {
          vi.resetModules();
          vi.doMock("react-router", async (importOriginal) => ({
            ...(await importOriginal<typeof import("react-router")>()),
            Scripts: () =>
              React.createElement("script", { "data-scripts": "" }),
            ScrollRestoration: () =>
              React.createElement("script", { "data-scroll-restoration": "" }),
          }));
          const { Body } =
            await import("@webstudio-is/sdk-components-react-router");
          return Body;
        };

        afterEach(() => {
          vi.doUnmock("react-router");
          vi.resetModules();
        });

        const renderInHtml = (element: React.ReactElement) =>
          renderToStaticMarkup(
            React.createElement(
              "html",
              null,
              React.createElement("head"),
              element
            )
          );

        test("the body holds the page's content and the scripts and no source offer", async () => {
          await writeSiteData(
            createSiteData({
              instances: [
                [
                  "root",
                  {
                    id: "root",
                    component: "Body",
                    children: [
                      { type: "id", value: "first" },
                      { type: "id", value: "second" },
                    ],
                  },
                ],
                [
                  "first",
                  {
                    id: "first",
                    component: elementComponent,
                    tag: "p",
                    children: [],
                  },
                ],
                [
                  "second",
                  {
                    id: "second",
                    component: elementComponent,
                    tag: "p",
                    children: [],
                  },
                ],
              ],
            })
          );
          const { route } = await prebuildLinks();
          const PageWithShareCode = await loadWrapper(
            route,
            await loadGeneratedPage(await importBody())
          );

          const html = renderInHtml(
            React.createElement(PageWithShareCode, { system: {} })
          );

          // <body> comes right after <head> and nothing follows it: nothing is
          // a sibling of the page's root under <html>
          expect(html).toMatch(/^<html><head><\/head><body[ >]/);
          expect(html).toMatch(/<\/body><\/html>$/);
          const body = html.slice(
            html.indexOf("<body"),
            html.lastIndexOf("</body>")
          );
          expect(body).not.toContain("data-organizeos-source-offer");
          expect(body).not.toMatch(/<a[ >]/);
          // the page's two paragraphs, then the scripts
          expect(body).toMatch(
            /^<body[^>]*><p [^>]*><\/p><p [^>]*><\/p><script data-scripts=""><\/script><script data-scroll-restoration=""><\/script>$/
          );
        });

        test("the page's share-code carrier renders once, as the last child, and adds nothing to the markup", async () => {
          const { route } = await prebuildLinks();
          const Page = () =>
            React.createElement(
              "body",
              null,
              React.createElement("p", { id: "content" })
            );
          // a stand-in that shows where the route renders the carrier
          const PageWithShareCode = await loadWrapper(route, Page, {
            PageShareCodeCarrier: () =>
              React.createElement("i", { "data-carrier": "" }),
          });
          expect(
            renderInHtml(React.createElement(PageWithShareCode, { system: {} }))
          ).toMatch(
            /<body><p id="content"><\/p><i data-carrier=""><\/i><\/body>/
          );

          // the package's carrier renders nothing, so the body is the page's
          // own content
          const html = renderInHtml(
            React.createElement(await loadWrapper(route, Page), { system: {} })
          );
          expect(html).toMatch(/<body><p id="content"><\/p><\/body>/);
        });

        test("it renders what Page renders when that is not an element", async () => {
          const { route } = await prebuildLinks();
          const PageWithShareCode = await loadWrapper(route, () => null);

          expect(
            renderToStaticMarkup(
              React.createElement(PageWithShareCode, { system: {} })
            )
          ).toBe("");
        });
      });

      test("the xml and text routes do not carry it", async () => {
        await writeSiteData(
          createSiteData({
            pages: [
              {
                id: "home",
                name: "Home",
                title: "Home",
                path: "",
                rootInstanceId: "root",
                meta: {},
              },
              {
                id: "feed",
                name: "Feed",
                title: "Feed",
                path: "/feed.xml",
                rootInstanceId: "xml-root",
                meta: { documentType: "xml" },
              },
              {
                id: "notes",
                name: "Notes",
                title: "Notes",
                path: "/notes.txt",
                rootInstanceId: "root",
                meta: { documentType: "text" },
              },
            ],
            instances: [
              ["root", { id: "root", component: "Box", children: [] }],
              [
                "xml-root",
                {
                  id: "xml-root",
                  component: "Box",
                  children: [{ type: "id", value: "xml-feed" }],
                },
              ],
              [
                "xml-feed",
                {
                  id: "xml-feed",
                  component: elementComponent,
                  tag: "rss",
                  children: [],
                },
              ],
            ],
          })
        );
        await prebuild({
          assets: false,
          template: ["react-router", "react-router-vercel"],
        });

        const html = await readFile(
          join("app", "routes", "_index.tsx"),
          "utf8"
        );
        const xml = await readFile(
          join("app", "routes", "[feed.xml]._index.tsx"),
          "utf8"
        );
        const text = await readFile(
          join("app", "routes", "[notes.txt]._index.tsx"),
          "utf8"
        );

        expect(html).not.toContain("data-organizeos-source-offer");
        expect(xml).not.toContain("data-organizeos-source-offer");
        expect(text).not.toContain("data-organizeos-source-offer");
      });
    });
  });

  // OrganizeOS fork: every html page mounts the page's share-code carrier from
  // the copy of the blocks' build (route-templates/html.tsx,
  // organizeos-components.ts, ORGANIZEOS-FORK.md §8).
  describe("mounts the page's share-code carrier", () => {
    const page = (id: string, path: string, meta = {}) => ({
      id,
      name: id,
      title: id,
      path,
      rootInstanceId: "root",
      meta,
    });

    test("every html route imports the page's share-code carrier from the copy of the build and renders it", async () => {
      await writeSiteData(
        createSiteData({
          pages: [page("home", ""), page("another", "/another-page")],
        })
      );
      await prebuild({
        assets: false,
        template: ["react-router", "react-router-vercel"],
      });

      const builtPage = join(
        dirname(resolveOrganizeosComponentsModule()),
        ORGANIZEOS_PAGE_MODULE
      );
      for (const routeFile of ["_index.tsx", "[another-page]._index.tsx"]) {
        const routePath = join("app", "routes", routeFile);
        const route = await readFile(routePath, "utf8");
        expect(route, routeFile).not.toContain("__ORGANIZEOS_PAGE__");
        // what the generated route holds, its comments aside
        const code = route
          .split("\n")
          .filter((line) => line.trim().startsWith("//") === false)
          .join("\n");
        const [carrierImport, importSource] =
          code.match(/^import \{ PageShareCodeCarrier \} from "([^"]+)";$/m) ??
          [];
        expect(carrierImport, routeFile).toBe(
          'import { PageShareCodeCarrier } from "../__organizeos__/page.js";'
        );
        const start = code.indexOf("const PageWithShareCode");
        expect(
          code.slice(start, code.indexOf("\n};\n", start) + "\n};".length),
          routeFile
        ).toBe(
          [
            "const PageWithShareCode = ({ system }: ComponentProps<typeof Page>) => {",
            "  const page = Page({ system });",
            "  if (isValidElement<{ children?: ReactNode }>(page) === false) {",
            "    return page;",
            "  }",
            "  return cloneElement(",
            "    page,",
            "    undefined,",
            "    ...Children.toArray(page.props.children),",
            '    <PageShareCodeCarrier key="organizeos-share-code" />',
            "  );",
            "};",
          ].join("\n")
        );
        // the import reaches the copy, which is the package's built page
        // module and exports the carrier
        const copy = await readFile(
          join(dirname(routePath), importSource as string),
          "utf8"
        );
        expect(copy).toEqual(await readFile(builtPage, "utf8"));
        expect(copy).toMatch(
          /export \{[^}]*\bas PageShareCodeCarrier\b[^}]*\}/
        );
      }
      // the page module came with everything it imports, and nothing else did
      await expectCopyToBeTheClosure();
    });

    test("the xml and text routes do not import it", async () => {
      await writeSiteData(
        createSiteData({
          pages: [
            page("home", ""),
            page("feed", "/feed.xml", { documentType: "xml" }),
            page("notes", "/notes.txt", { documentType: "text" }),
          ],
        })
      );
      await prebuild({
        assets: false,
        template: ["react-router", "react-router-vercel"],
      });

      const html = await readFile(join("app", "routes", "_index.tsx"), "utf8");
      expect(html).toContain("<PageShareCodeCarrier");
      for (const routeFile of [
        "[feed.xml]._index.tsx",
        "[notes.txt]._index.tsx",
      ]) {
        const route = await readFile(join("app", "routes", routeFile), "utf8");
        expect(route, routeFile).not.toContain("PageShareCodeCarrier");
        expect(route, routeFile).not.toContain("__organizeos__/page.js");
        expect(route, routeFile).not.toContain("__ORGANIZEOS_PAGE__");
      }
    });
  });

  // OrganizeOS fork: a page loads a data source only when its scope is on the
  // page or is :root. The builder now scopes a Signup Form's Forms binding to
  // the block's own root, so only the page that holds the block loads Forms;
  // older pre-deploy branches wrote it at :root, and an unscoped binding
  // loads nowhere.
  describe("compiles a Signup Form's data from the Forms preset", () => {
    const formsBinding = {
      type: "resource",
      id: "forms-binding",
      name: "OrganizeOS Forms",
      resourceId: "forms-resource",
    };

    // With `secondPage`, the site has a second page without the block.
    const writeSignupForm = (
      binding: Record<string, unknown>,
      { secondPage = false }: { secondPage?: boolean } = {}
    ) =>
      writeSiteData(
        createSiteData({
          ...(secondPage && {
            pages: [
              {
                id: "home",
                name: "Home",
                title: "Home",
                path: "",
                rootInstanceId: "root",
                meta: {},
              },
              {
                id: "about",
                name: "About",
                title: "About",
                path: "/about",
                rootInstanceId: "about-root",
                meta: {},
              },
            ],
          }),
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Box",
                children: [{ type: "id", value: "signup" }],
              },
            ],
            [
              "signup",
              {
                id: "signup",
                component: "@organizeos/site-components:SignupForm",
                children: [],
              },
            ],
            ...(secondPage
              ? [
                  [
                    "about-root",
                    { id: "about-root", component: "Box", children: [] },
                  ] satisfies [string, unknown],
                ]
              : []),
          ],
          props: [
            [
              "signup-data",
              {
                id: "signup-data",
                instanceId: "signup",
                name: "data",
                type: "expression",
                value: `${encodeDataSourceVariable(formsBinding.id)}.data`,
              },
            ],
          ],
          dataSources: [[formsBinding.id, binding]],
          resources: [
            [
              "forms-resource",
              {
                id: "forms-resource",
                name: "OrganizeOS Forms",
                method: "get",
                url: `"https://app.example.org/api/public/v1/forms"`,
                headers: [
                  { name: "Authorization", value: `"Bearer osk_test"` },
                ],
              },
            ],
          ],
        })
      );

    const prebuildPage = async (pageFile = "_index") => {
      await prebuild({
        assets: false,
        template: ["react-router", "react-router-vercel"],
      });
      const generatedDir = join("app", "__generated__");
      return {
        page: await readFile(join(generatedDir, `${pageFile}.tsx`), "utf8"),
        // the page's resources module, which its loader runs on the server
        resources: await readFile(
          join(generatedDir, `${pageFile}.server.tsx`),
          "utf8"
        ),
      };
    };

    test("to the Forms resource when the binding is scoped at :root", async () => {
      await writeSignupForm({ ...formsBinding, scopeInstanceId: ":root" });

      const { page, resources } = await prebuildPage();

      const [, variable, request] =
        page.match(/let (\w+) = useResource\("(\w+)"\)/) ?? [];
      expect(variable).toBeDefined();
      expect(page).toContain(`data={${variable}?.data}`);
      expectRequest(resources, request);
      expect(resources).toContain(
        `url: "https://app.example.org/api/public/v1/forms",`
      );
      expect(resources).toContain(
        `{ name: "Authorization", value: "Bearer osk_test" },`
      );
    });

    test("to the Forms resource on the page that holds the block, when the binding is scoped to the block's root", async () => {
      await writeSignupForm(
        { ...formsBinding, scopeInstanceId: "signup" },
        { secondPage: true }
      );

      const { page, resources } = await prebuildPage();

      const [, variable, request] =
        page.match(/let (\w+) = useResource\("(\w+)"\)/) ?? [];
      expect(variable).toBeDefined();
      expect(page).toContain(`data={${variable}?.data}`);
      expectRequest(resources, request);
      expect(resources).toContain(
        `url: "https://app.example.org/api/public/v1/forms",`
      );
      expect(resources).toContain(
        `{ name: "Authorization", value: "Bearer osk_test" },`
      );
    });

    test("to no request on a page without the block, when the binding is scoped to the block's root", async () => {
      await writeSignupForm(
        { ...formsBinding, scopeInstanceId: "signup" },
        { secondPage: true }
      );

      const { page, resources } = await prebuildPage("[about]._index");

      expect(page).not.toContain("SignupForm");
      expect(page).not.toContain("useResource(");
      expect(resources).not.toContain("/v1/forms");
      expect(resources).not.toContain("OrganizeOS Forms");
      expect(resources).not.toContain("): ResourceRequest =>");
    });

    test("to undefined when the binding has no scope", async () => {
      await writeSignupForm(formsBinding);

      const { page, resources } = await prebuildPage();

      expect(page).toContain("data={undefined?.data}");
      expect(page).not.toContain("useResource(");
      expect(resources).not.toContain("/v1/forms");
      expect(resources).not.toContain("OrganizeOS Forms");
    });
  });

  // OrganizeOS fork: an Event List's Upcoming Events binding is scoped to the
  // block's root, so only the page that holds the block loads the events. The
  // collection reads the list only when the loader's `ok` is true, so it agrees
  // with the two state boxes, which show on `ok` too. The condition is
  // parenthesized: the page iterates `Object.entries(<bind> ?? {})`, and `??`
  // binds tighter than `?:`, so unparenthesized it guards only the `[]` branch
  // and a 200 without a list throws during render.
  describe("compiles an Event List's data from the Upcoming Events preset", () => {
    const upcomingBinding = {
      type: "resource",
      id: "upcoming-binding",
      name: "OrganizeOS Upcoming Events",
      resourceId: "upcoming-resource",
      scopeInstanceId: "list",
    };
    const variable = encodeDataSourceVariable(upcomingBinding.id);
    const eventParameter = encodeDataSourceVariable("event-parameter");

    // The collection's list: an Event List's, or an Event Card's first event.
    const eventListData = `${variable}.data.data`;
    const eventCardData = `${variable}.data.data.slice(0, 1)`;

    // What the page's collection iterates: the argument of its
    // `Object.entries(`, without the `// @ts-ignore` line before it.
    const getIterated = (page: string) =>
      page
        .match(
          /Object\.entries\(\s*(?:\/\/[^\n]*\n)?([\s\S]*?)\s*\)\.map\(/
        )?.[1]
        .trim();

    const writeEventList = ({
      secondPage = false,
      list = eventListData,
    }: { secondPage?: boolean; list?: string } = {}) =>
      writeSiteData(
        createSiteData({
          ...(secondPage && {
            pages: [
              {
                id: "home",
                name: "Home",
                title: "Home",
                path: "",
                rootInstanceId: "root",
                meta: {},
              },
              {
                id: "about",
                name: "About",
                title: "About",
                path: "/about",
                rootInstanceId: "about-root",
                meta: {},
              },
            ],
          }),
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Box",
                children: [{ type: "id", value: "list" }],
              },
            ],
            [
              "list",
              {
                id: "list",
                component: "ws:element",
                tag: "div",
                children: [
                  { type: "id", value: "events" },
                  { type: "id", value: "empty" },
                  { type: "id", value: "unavailable" },
                ],
              },
            ],
            [
              "events",
              {
                id: "events",
                component: "ws:collection",
                children: [{ type: "id", value: "card" }],
              },
            ],
            [
              "card",
              {
                id: "card",
                component: "ws:element",
                tag: "article",
                children: [{ type: "id", value: "title" }],
              },
            ],
            [
              "title",
              {
                id: "title",
                component: "ws:element",
                tag: "h3",
                children: [
                  { type: "expression", value: `${eventParameter}.title` },
                ],
              },
            ],
            [
              "empty",
              {
                id: "empty",
                component: "ws:element",
                tag: "p",
                children: [],
              },
            ],
            [
              "unavailable",
              {
                id: "unavailable",
                component: "ws:element",
                tag: "p",
                children: [],
              },
            ],
            ...(secondPage
              ? [
                  [
                    "about-root",
                    { id: "about-root", component: "Box", children: [] },
                  ] satisfies [string, unknown],
                ]
              : []),
          ],
          props: [
            [
              "events-item",
              {
                id: "events-item",
                instanceId: "events",
                name: "item",
                type: "parameter",
                value: "event-parameter",
              },
            ],
            [
              "events-data",
              {
                id: "events-data",
                instanceId: "events",
                name: "data",
                type: "expression",
                value: `(${variable}.ok === true ? ${list} : [])`,
              },
            ],
            [
              "empty-show",
              {
                id: "empty-show",
                instanceId: "empty",
                name: "data-ws-show",
                type: "expression",
                value: `${variable}.ok === true && ${variable}.data.data.length === 0`,
              },
            ],
            [
              "unavailable-show",
              {
                id: "unavailable-show",
                instanceId: "unavailable",
                name: "data-ws-show",
                type: "expression",
                value: `${variable}.ok === false`,
              },
            ],
          ],
          dataSources: [
            [upcomingBinding.id, upcomingBinding],
            [
              "event-parameter",
              {
                type: "parameter",
                id: "event-parameter",
                name: "event",
                scopeInstanceId: "events",
              },
            ],
          ],
          resources: [
            [
              "upcoming-resource",
              {
                id: "upcoming-resource",
                name: "Upcoming Events",
                method: "get",
                url: `"https://app.example.org/api/public/v1/events?upcoming=true"`,
                headers: [
                  { name: "Authorization", value: `"Bearer osk_test"` },
                ],
              },
            ],
          ],
        })
      );

    const prebuildPage = async (pageFile = "_index") => {
      await prebuild({
        assets: false,
        template: ["react-router", "react-router-vercel"],
      });
      const generatedDir = join("app", "__generated__");
      return {
        page: await readFile(join(generatedDir, `${pageFile}.tsx`), "utf8"),
        resources: await readFile(
          join(generatedDir, `${pageFile}.server.tsx`),
          "utf8"
        ),
      };
    };

    test("to a loader that fetches Upcoming Events, and a collection over the guarded list", async () => {
      await writeEventList({ secondPage: true });

      const { page, resources } = await prebuildPage();

      const [, variable, request] =
        page.match(/let (\w+) = useResource\("(\w+)"\)/) ?? [];
      expect(variable).toBeDefined();
      // the list is read only when the loader says `ok`, and the whole
      // condition is what `?? {}` guards
      expect(page).toContain("Object.entries(");
      expect(getIterated(page)).toBe(
        `(${variable}?.ok === true ? ${variable}?.data?.data : []) ?? {}`
      );
      expect(page).toContain(".map(([_key, event]: any) => {");
      expect(page).toContain("{renderText(event?.title)}");
      // the boxes show on the loader's `ok`
      expect(page).toContain(
        `{(${variable}?.ok === true && ${variable}?.data?.data?.length === 0) &&`
      );
      expect(page).toContain(`{(${variable}?.ok === false) &&`);
      // and the loader requests Upcoming Events, query included
      expectRequest(resources, request);
      expect(resources).toContain(
        `url: "https://app.example.org/api/public/v1/events?upcoming=true",`
      );
      expect(resources).toContain(
        `{ name: "Authorization", value: "Bearer osk_test" },`
      );
    });

    test("with an Event Card's first event only", async () => {
      await writeEventList({ list: eventCardData });

      const { page } = await prebuildPage();

      const [, variable] =
        page.match(/let (\w+) = useResource\("(\w+)"\)/) ?? [];
      expect(getIterated(page)).toBe(
        `(${variable}?.ok === true ? ${variable}?.data?.data?.slice?.(0, 1) : []) ?? {}`
      );
    });

    // The published page's render must not throw on a body without a list: the
    // block degrades to nothing, and the page still renders.
    describe.each([
      ["an Event List", eventListData, 2],
      ["an Event Card", eventCardData, 1],
    ])("%s's iteration", (_case, list, items) => {
      const iterate = async (result: unknown) => {
        await writeEventList({ list });
        const { page } = await prebuildPage();
        const [, variable] =
          page.match(/let (\w+) = useResource\("(\w+)"\)/) ?? [];
        return new Function(
          variable,
          `return Object.entries(${getIterated(page)});`
        )(result) as unknown[];
      };

      test("covers the events of a successful read", async () => {
        const events = [{ title: "a" }, { title: "b" }];
        expect(
          await iterate({ ok: true, data: { data: events } })
        ).toHaveLength(items);
      });

      test.each([
        ["a 200 whose body is not JSON", { ok: true, data: "<html></html>" }],
        ["a 200 whose body has no list", { ok: true, data: {} }],
        ["a 200 whose list is null", { ok: true, data: { data: null } }],
        ["a 200 whose body is null", { ok: true, data: null }],
        ["a 503", { ok: false, data: { error: "unavailable" } }],
        [
          "a 429, with its retryAfter",
          { ok: false, data: { error: "rate_limited", retryAfter: 30 } },
        ],
        ["a Resource that has not loaded", undefined],
      ])("is empty, and does not throw, after %s", async (_name, result) => {
        expect(await iterate(result)).toEqual([]);
      });
    });

    test("to no request on a page without the block", async () => {
      await writeEventList({ secondPage: true });

      const { page, resources } = await prebuildPage("[about]._index");

      expect(page).not.toContain("Object.entries(");
      expect(page).not.toContain("useResource(");
      expect(resources).not.toContain("upcoming=true");
      expect(resources).not.toContain("Upcoming Events");
      expect(resources).not.toContain("): ResourceRequest =>");
    });
  });

  // OrganizeOS fork: a page with a Product Grid and a Product Card publishes
  // the package's three shop components, keeps each card's "/shop/" + slug
  // link and its bound image while org script is paused, and loads the two
  // blocks' Resources on that page only.
  describe("publishes a page with the Shop blocks", () => {
    const ns = "@organizeos/site-components";
    const gridVariable = encodeDataSourceVariable("grid-binding");
    const cardVariable = encodeDataSourceVariable("card-binding");
    const product = encodeDataSourceVariable("product-parameter");
    const cardProduct = encodeDataSourceVariable("card-product-parameter");
    const resource = (id: string, name: string, query = "") => ({
      id,
      name,
      method: "get",
      url: `"https://app.example.org/api/public/v1/products${query}"`,
      headers: [{ name: "Authorization", value: `"Bearer osk_test"` }],
    });
    const element = (
      id: string,
      component: string,
      children: string[],
      tag?: string
    ) => [
      id,
      {
        id,
        component,
        ...(tag === undefined ? {} : { tag }),
        children: children.map((value) => ({ type: "id", value })),
      },
    ];
    const prop = (
      id: string,
      instanceId: string,
      name: string,
      type: string,
      value: unknown
    ) => [id, { id, instanceId, name, type, value }];

    const writeShopPage = () =>
      writeSiteData(
        createSiteData({
          pages: [
            {
              id: "home",
              name: "Home",
              title: "Home",
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
            {
              id: "about",
              name: "About",
              title: "About",
              path: "/about",
              rootInstanceId: "about-root",
              meta: {},
            },
          ],
          instances: [
            element("root", "Box", ["grid", "card-root"]),
            element("grid", `${ns}:ProductGrid`, ["products"]),
            element("products", "ws:collection", ["card"]),
            element("card", "ws:element", ["image", "amount"], "a"),
            element("image", "Image", []),
            element("amount", `${ns}:Price`, []),
            element("card-root", `${ns}:ProductCard`, ["product"]),
            element("product", "ws:collection", ["card-link"]),
            element("card-link", "ws:element", [], "a"),
            element("about-root", "Box", []),
          ] as never,
          props: [
            prop("grid-columns", "grid", "columns", "string", "4"),
            prop(
              "products-item",
              "products",
              "item",
              "parameter",
              "product-parameter"
            ),
            prop(
              "products-data",
              "products",
              "data",
              "expression",
              `(${gridVariable}.ok === true ? ${gridVariable}.data.data.slice(0, 6) : [])`
            ),
            prop(
              "card-href",
              "card",
              "href",
              "expression",
              `"/shop/" + ${product}.slug`
            ),
            prop("card-reload", "card", "reloadDocument", "boolean", true),
            prop(
              "image-src",
              "image",
              "src",
              "expression",
              `${product}.image_url`
            ),
            prop(
              "amount-cents",
              "amount",
              "cents",
              "expression",
              `${product}.price_from_cents`
            ),
            prop(
              "amount-currency",
              "amount",
              "currency",
              "expression",
              `${product}.currency`
            ),
            prop(
              "product-item",
              "product",
              "item",
              "parameter",
              "card-product-parameter"
            ),
            prop(
              "product-data",
              "product",
              "data",
              "expression",
              `(${cardVariable}.ok === true ? ${cardVariable}.data.data.slice(0, 1) : [])`
            ),
            prop(
              "card-link-href",
              "card-link",
              "href",
              "expression",
              `"/shop/" + ${cardProduct}.slug`
            ),
          ] as never,
          dataSources: [
            [
              "grid-binding",
              {
                type: "resource",
                id: "grid-binding",
                name: "OrganizeOS Products",
                resourceId: "products-resource",
                scopeInstanceId: "grid",
              },
            ],
            [
              "card-binding",
              {
                type: "resource",
                id: "card-binding",
                name: "OrganizeOS Product",
                resourceId: "card-resource",
                scopeInstanceId: "card-root",
              },
            ],
            [
              "product-parameter",
              {
                type: "parameter",
                id: "product-parameter",
                name: "product",
                scopeInstanceId: "products",
              },
            ],
            [
              "card-product-parameter",
              {
                type: "parameter",
                id: "card-product-parameter",
                name: "product",
                scopeInstanceId: "product",
              },
            ],
          ] as never,
          resources: [
            ["products-resource", resource("products-resource", "Products")],
            [
              "card-resource",
              resource(
                "card-resource",
                "Product",
                "?id=34efeec7-ef26-4210-946f-866b46b94f46"
              ),
            ],
          ] as never,
        })
      );

    const prebuildPage = async (pageFile = "_index") => {
      await prebuild({
        assets: false,
        template: ["react-router", "react-router-vercel"],
      });
      const generatedDir = join("app", "__generated__");
      return {
        page: await readFile(join(generatedDir, `${pageFile}.tsx`), "utf8"),
        resources: await readFile(
          join(generatedDir, `${pageFile}.server.tsx`),
          "utf8"
        ),
      };
    };

    test("imports Product Grid, Product Card and Price from the copy of the build", async () => {
      await writeShopPage();
      const { page } = await prebuildPage();
      const copy = await readFile(
        join("app", "__organizeos__", "components.js"),
        "utf8"
      );
      const imported = new Map(
        (
          page.match(
            /import \{([^}]*)\} from "\.\.\/__organizeos__\/components\.js";/
          )?.[1] ?? ""
        )
          .split(",")
          .map((entry) => entry.trim().split(" as "))
          .map(([name, local]) => [name, local])
      );
      for (const name of ["ProductGrid", "ProductCard", "Price"]) {
        const localName = imported.get(name);
        expect(localName, name).toBeDefined();
        expect(page, name).toContain(`<${localName}`);
        expect(copy, name).toMatch(
          new RegExp(`export \\{[^}]*\\bas ${name}\\b[^}]*\\}`)
        );
      }
      await expectCopyToBeTheClosure();
    });

    test("keeps each card's /shop/ link and its bound image while org script is paused", async () => {
      expect(orgScriptMayRun()).toBe(false);
      await writeShopPage();
      const { page } = await prebuildPage();
      expect(page).toContain(`"/shop/" + product?.slug`);
      expect(page).toContain("src={product?.image_url");
      expect(page).toContain("cents={product?.price_from_cents}");
    });

    test("loads the grid's and the card's Resources on that page, and neither elsewhere", async () => {
      await writeShopPage();
      const { resources } = await prebuildPage();
      expect(resources).toMatch(/rootIds: \[[^\]]*"products-resource"/);
      expect(resources).toMatch(/rootIds: \[[^\]]*"card-resource"/);
      expect(resources).toContain(
        `url: "https://app.example.org/api/public/v1/products",`
      );
      expect(resources).toContain(
        `url: "https://app.example.org/api/public/v1/products?id=34efeec7-ef26-4210-946f-866b46b94f46",`
      );

      const about = await prebuildPage("[about]._index");
      expect(about.page).not.toContain("ProductGrid");
      expect(about.page).not.toContain("useResource(");
      expect(about.resources).not.toContain("/v1/products");
      expect(about.resources).not.toContain("products-resource");
      expect(about.resources).not.toContain("card-resource");
    });
  });

  // OrganizeOS fork: every page route's loader fetches its resources through
  // the site's one in-memory cache, which the react-router template carries
  // (templates/react-router/app/organizeos-resource-cache.ts).
  describe("routes resource fetches through the site's resource cache", () => {
    const cacheModule = join("app", "organizeos-resource-cache.ts");
    const routes = [
      {
        documentType: "html",
        file: join("app", "routes", "_index.tsx"),
        // with the cachedFetch it called before behind the cache
        fallback: `return siteResourceCache(input, init, (input, init) =>\n    cachedFetch(projectId, input, init)\n  );`,
      },
      {
        documentType: "xml",
        file: join("app", "routes", "[feed.xml]._index.tsx"),
        fallback: "return siteResourceCache(input, init);",
      },
      {
        documentType: "text",
        file: join("app", "routes", "[notes.txt]._index.tsx"),
        fallback: "return siteResourceCache(input, init);",
      },
    ];

    /** The last statement of a route's customFetch: its fallback. */
    const getFallback = (route: string) => {
      const start = route.indexOf("const customFetch: typeof fetch");
      const body = route.slice(start, route.indexOf("\n};\n", start));
      return body.slice(body.lastIndexOf("\n  return ")).trim();
    };

    beforeEach(async () => {
      await writeSiteData(
        createSiteData({
          pages: [
            {
              id: "home",
              name: "Home",
              title: "Home",
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
            {
              id: "feed",
              name: "Feed",
              title: "Feed",
              path: "/feed.xml",
              rootInstanceId: "xml-root",
              meta: { documentType: "xml" },
            },
            {
              id: "notes",
              name: "Notes",
              title: "Notes",
              path: "/notes.txt",
              rootInstanceId: "root",
              meta: { documentType: "text" },
            },
          ],
          instances: [
            ["root", { id: "root", component: "Box", children: [] }],
            [
              "xml-root",
              {
                id: "xml-root",
                component: "Box",
                children: [{ type: "id", value: "xml-feed" }],
              },
            ],
            [
              "xml-feed",
              {
                id: "xml-feed",
                component: elementComponent,
                tag: "rss",
                children: [],
              },
            ],
          ],
        })
      );
      await prebuild({
        assets: false,
        template: ["react-router", "react-router-vercel"],
      });
    });

    test("copies the cache module into the site unchanged", async () => {
      await expect(readFile(cacheModule, "utf8")).resolves.toEqual(
        await readFile(
          new URL(
            "../templates/react-router/app/organizeos-resource-cache.ts",
            import.meta.url
          ),
          "utf8"
        )
      );
    });

    test.each(routes)(
      "the $documentType route falls back to the site's shared cache and makes none of its own",
      async ({ file, fallback }) => {
        const route = await readFile(file, "utf8");

        expect(route).toContain(
          `import { siteResourceCache } from "../organizeos-resource-cache";`
        );
        // The import, from app/routes/, reaches the copied module.
        expect(join(dirname(file), "../organizeos-resource-cache.ts")).toBe(
          cacheModule
        );
        expect(getFallback(route)).toBe(fallback);
        // One cache per server instance, shared by every route.
        expect(route).not.toContain("createResourceCache");
      }
    );

    // Upstream 0.309.0 posts a form through the generated protected fetch
    // (createManagedFormResourceFetch); only the GETs a deprecated Webhook
    // Form depends on go through customFetch, and so through the cache, as
    // the loader's do.
    test("the form action posts through the protected fetch, never the cache", async () => {
      const route = await readFile(routes[0].file, "utf8");
      const action = route.slice(route.indexOf("export const action"));

      expect(action).toContain(
        "const protectedFetch = createManagedFormResourceFetch({"
      );
      expect(action.match(/resourceFetch: protectedFetch,/g)).toHaveLength(2);
      expect(action).toContain("fallback: customFetch,");
      expect(action).not.toContain("siteResourceCache");
    });
  });

  // OrganizeOS fork: page authentication runs on every host in all three
  // react-router route templates (ORGANIZEOS-FORK.md section 8). Upstream
  // skipped it when the request host was projectDomain or a subdomain of it;
  // here projectDomain is the org's platform subdomain label ("acme"), so
  // "acme.organizeos.org", the site's primary public host, skipped it.
  describe("routes challenge a protected path on the project's own host", () => {
    const realm = "Acme Club";
    const login = "member";
    const password = "secret";
    const routes = [
      {
        documentType: "html",
        file: join("app", "routes", "_index.tsx"),
        generated: "_index",
        path: "/",
      },
      {
        documentType: "xml",
        file: join("app", "routes", "[feed.xml]._index.tsx"),
        generated: "[feed.xml]._index",
        path: "/feed.xml",
      },
      {
        documentType: "text",
        file: join("app", "routes", "[notes.txt]._index.tsx"),
        generated: "[notes.txt]._index",
        path: "/notes.txt",
      },
    ];
    const projectHosts = [
      "acme.organizeos.org",
      "acme",
      "acme.organizeos.org:443",
    ];

    beforeEach(async () => {
      const siteData = createSiteData({
        pageMeta: { siteName: realm },
        pages: [
          {
            id: "home",
            name: "Home",
            title: "Home",
            path: "",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "feed",
            name: "Feed",
            title: "Feed",
            path: "/feed.xml",
            rootInstanceId: "xml-root",
            meta: { documentType: "xml" },
          },
          {
            id: "notes",
            name: "Notes",
            title: "Notes",
            path: "/notes.txt",
            rootInstanceId: "root",
            meta: { documentType: "text" },
          },
        ],
        instances: [
          ["root", { id: "root", component: "Box", children: [] }],
          [
            "xml-root",
            {
              id: "xml-root",
              component: "Box",
              children: [{ type: "id", value: "xml-feed" }],
            },
          ],
          [
            "xml-feed",
            {
              id: "xml-feed",
              component: elementComponent,
              tag: "rss",
              children: [],
            },
          ],
        ],
      });
      // In this fork Project.domain is the org's platform subdomain label.
      siteData.projectDomain = "acme";
      await writeSiteData(siteData);
      await prebuild({
        assets: false,
        template: ["react-router", "react-router-vercel"],
      });
    });

    /** What the generated client module exports, as the route imports it. */
    const readClientExports = async (generated: string) => {
      const source = await readFile(
        join("app", "__generated__", `${generated}.tsx`),
        "utf8"
      );
      const read = (name: string) => {
        const match = source.match(new RegExp(`export const ${name} = (.*);`));
        return JSON.parse(match?.[1] ?? "null") as unknown;
      };
      return {
        projectId: read("projectId"),
        projectDomain: read("projectDomain"),
        siteName: read("siteName"),
      };
    };

    /**
     * A route's loader as the site ships it, with the real wsauth guarding
     * the path, the generated server module and the sdk's resource loading;
     * the client module, the stylesheet and the site data stood in.
     */
    const loadLoader = async ({
      file,
      generated,
      path,
    }: (typeof routes)[number]) => {
      const { authenticateRequest, createBasicAuthRoute } =
        await import("@webstudio-is/wsauth");
      const exports = await loadGeneratedRoute(file, generated, {
        "@webstudio-is/wsauth": { authenticateRequest },
        [`../__generated__/${generated}`]: {
          ...(await readClientExports(generated)),
          Page: () => null,
          breakpoints: [],
        },
        "../__generated__/$resources.wsauth.server": {
          authRoutes: [createBasicAuthRoute({ route: path, login, password })],
        },
      });
      return (host: string, authorization?: string) =>
        (exports.loader as (arg: unknown) => Promise<unknown>)({
          request: new Request(`https://site.example${path}`, {
            headers: {
              "x-forwarded-host": host,
              ...(authorization === undefined ? {} : { authorization }),
            },
          }),
          params: {},
          context: { EXCLUDE_FROM_SEARCH: false },
        });
    };

    test("the generated client module exports the project domain and the site name", async () => {
      for (const { generated } of routes) {
        expect(await readClientExports(generated)).toMatchObject({
          projectDomain: "acme",
          siteName: realm,
        });
      }
    });

    describe.each(routes)("the $documentType route", (route) => {
      test.each(projectHosts)(
        "answers 401 with the site's realm on %s",
        async (host) => {
          const load = await loadLoader(route);

          const thrown = await load(host).then(
            () => undefined,
            (error: unknown) => error
          );

          expect(thrown).toBeInstanceOf(Response);
          const response = thrown as Response;
          expect(response.status).toBe(401);
          expect(response.headers.get("WWW-Authenticate")).toBe(
            `Basic realm="${realm}"`
          );
          expect(response.headers.get("Cache-Control")).toBe(
            "private, no-store"
          );
        }
      );

      test("answers 401 with the site's realm on a custom domain", async () => {
        const load = await loadLoader(route);

        const thrown = await load("club.example.org").then(
          () => undefined,
          (error: unknown) => error
        );

        expect((thrown as Response).status).toBe(401);
        expect((thrown as Response).headers.get("WWW-Authenticate")).toBe(
          `Basic realm="${realm}"`
        );
      });

      test.each(projectHosts)(
        "serves the page to the right password on %s",
        async (host) => {
          const load = await loadLoader(route);
          const credentials = Buffer.from(`${login}:${password}`).toString(
            "base64"
          );

          const result = await load(host, `Basic ${credentials}`);

          // html answers with react-router's data() (no status means 200);
          // xml and text with a Response
          const status =
            result instanceof Response
              ? result.status
              : ((result as { init: { status?: number } }).init.status ?? 200);
          expect(status).toBe(200);
        }
      );

      test("never compares the request host with the project domain", async () => {
        const source = await readFile(route.file, "utf8");
        const start = source.indexOf("const authenticateProductionRequest");
        const authenticate = source.slice(
          start,
          source.indexOf("\n};\n", start)
        );

        expect(start).toBeGreaterThan(-1);
        // no `=== projectDomain`, `projectDomain !== undefined &&` and the like
        expect(source).not.toMatch(
          /[=!]==?\s*projectDomain|projectDomain\s*[=!]==?/
        );
        expect(source).not.toContain("startsWith(`${projectDomain}.`)");
        // every request is authenticated, and a 401 carries the site's realm
        expect(authenticate).toContain(
          "authenticateRequest(request, authRoutes)"
        );
        expect(authenticate).toContain("thrown.status === 401");
        expect(authenticate).toContain("withSiteRealm(thrown)");
        expect(source).toContain('`Basic realm="${authRealm()}"`');
      });
    });

    // Upstream 0.309.0 put the host skip back into wsauth itself:
    // authenticateProjectRequest(request, routes, projectDomain) skips a
    // request whose host is projectDomain or under it, which is the org's own
    // host here. So no template may call it, the defaults (not on the publish
    // path) included.
    test("no route template imports authenticateProjectRequest", async () => {
      const templatesDir = fileURLToPath(
        new URL("../templates", import.meta.url)
      );
      const templateFiles = (
        await Promise.all(
          ["react-router", "defaults"].map((template) =>
            getFilePaths(join(templatesDir, template, "app", "route-templates"))
          )
        )
      ).flat();
      expect(templateFiles.map((file) => relative(templatesDir, file))).toEqual(
        expect.arrayContaining([
          join("react-router", "app", "route-templates", "html.tsx"),
          join("react-router", "app", "route-templates", "xml.tsx"),
          join("react-router", "app", "route-templates", "text.tsx"),
          join("defaults", "app", "route-templates", "html.tsx"),
          join("defaults", "app", "route-templates", "xml.tsx"),
          join("defaults", "app", "route-templates", "text.tsx"),
        ])
      );
      for (const file of templateFiles) {
        expect(await readFile(file, "utf8"), file).not.toContain(
          "authenticateProjectRequest"
        );
      }
      // nor does any route prebuild wrote
      for (const { file } of routes) {
        expect(await readFile(file, "utf8"), file).not.toContain(
          "authenticateProjectRequest"
        );
      }
    });

    // As production serves it: the OrganizeOS proxy fetches the deployment
    // origin, so the request's URL is the *.vercel.app host and the org's
    // host comes as x-forwarded-host (client/lib/websites2/site-proxy.ts).
    test("a protected html, xml or text path answers 401 on the project's own host", async () => {
      const deployment = "https://acme-site-abc123.vercel.app";
      const asRequest = (path: string, init: RequestInit = {}) =>
        new Request(`${deployment}${path}`, {
          ...init,
          headers: { "x-forwarded-host": "acme.organizeos.org" },
        });
      for (const route of routes) {
        const { createBasicAuthRoute } = await import("@webstudio-is/wsauth");
        const exports = await loadGeneratedRoute(route.file, route.generated, {
          [`../__generated__/${route.generated}`]: {
            ...(await readClientExports(route.generated)),
            Page: () => null,
            breakpoints: [],
          },
          "../__generated__/$resources.wsauth.server": {
            authRoutes: [
              createBasicAuthRoute({ route: route.path, login, password }),
            ],
          },
        });
        const calls = [
          (exports.loader as (arg: unknown) => Promise<unknown>)({
            request: asRequest(route.path),
            params: {},
            context: { EXCLUDE_FROM_SEARCH: false },
          }),
          ...(route.documentType === "html"
            ? [
                (exports.action as (arg: unknown) => Promise<unknown>)({
                  request: asRequest(route.path, {
                    method: "POST",
                    body: new FormData(),
                  }),
                  params: {},
                  context: {},
                }),
              ]
            : []),
        ];
        for (const call of calls) {
          const thrown = await call.then(
            () => undefined,
            (error: unknown) => error
          );
          expect(thrown, route.documentType).toBeInstanceOf(Response);
          expect((thrown as Response).status, route.documentType).toBe(401);
          expect(
            (thrown as Response).headers.get("WWW-Authenticate"),
            route.documentType
          ).toBe(`Basic realm="${realm}"`);
        }
      }
    });
  });

  // OrganizeOS fork, review focus 6 of the 0.309.0 merge: upstream posts a
  // form through createNodeProtectedResourceFetch, which denies the request
  // URL's host and projectDomain, each with its registrable domain and every
  // subdomain (getDeniedResourceHostnames), and has no allowance at 0.309.0. A
  // Signup Form posts to the platform on organizeos.org. That works only
  // because the OrganizeOS proxy fetches the deployment origin: the request
  // URL's host is the *.vercel.app host and projectDomain the bare label.
  // Were the URL's host ever the org's own host, every signup would fail. A
  // change belongs in the CLI-generated module, never in a runtime package.
  test("a published site's form fetch never denies the platform's domain", async () => {
    vi.stubEnv("WEBSTUDIO_FORM_EVALUATION_RECEIVER_PORT", undefined);
    try {
      const siteData = createSiteData();
      siteData.projectDomain = "acme";
      await writeSiteData(siteData);
      await prebuild({
        assets: false,
        template: ["react-router", "react-router-vercel"],
      });
      const protectedFetch =
        await import("@webstudio-is/sdk/protected-resource-fetch");
      const created: Array<{ deniedHostnames: readonly string[] }> = [];
      const generated = await runModule(
        await readFile(
          join(
            "app",
            "__generated__",
            "$resources.managed-form-fetch.server.ts"
          ),
          "utf8"
        ),
        {
          "@webstudio-is/sdk/protected-resource-fetch": protectedFetch,
          "@webstudio-is/sdk/protected-resource-fetch-node": {
            createNodeProtectedResourceFetch: (options: {
              deniedHostnames: readonly string[];
            }) => {
              created.push(options);
              return Object.assign(async () => new Response(), {
                validateDestination: (url: URL) =>
                  protectedFetch.validateProtectedResourceDestination(
                    url,
                    options.deniedHostnames
                  ),
              });
            },
          },
        }
      );
      const formFetch = (
        generated.createManagedFormResourceFetch as (input: {
          request: Request;
          context: unknown;
          projectDomain?: string;
        }) => { validateDestination: (url: URL) => void }
      )({
        request: new Request("https://acme-site-abc123.vercel.app/", {
          method: "POST",
          headers: { "x-forwarded-host": "acme.organizeos.org" },
        }),
        context: {},
        projectDomain: siteData.projectDomain,
      });

      expect(created).toHaveLength(1);
      const [{ deniedHostnames }] = created;
      expect(deniedHostnames.length).toBeGreaterThan(0);
      for (const hostname of deniedHostnames) {
        expect(hostname).not.toMatch(/(^|\.)organizeos\.org$/);
      }
      // so a signup reaches the platform's public API
      expect(() =>
        formFetch.validateDestination(
          new URL(
            "https://app.organizeos.org/api/public/v1/forms/f/submissions"
          )
        )
      ).not.toThrow();
      // while the site's own deployment stays denied
      expect(() =>
        formFetch.validateDestination(
          new URL("https://acme-site-abc123.vercel.app/")
        )
      ).toThrow("Resource destination is not allowed");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  // OrganizeOS fork, owner decision D15 of the 0.309.0 merge: the builder's
  // provisioning seeded every org a /newsletter page whose signup form is a
  // Form with a Resource action (apps/builder/app/shared/db/
  // signup-form-preset.server.tsx before 0.309.0). Its pages carry no
  // formComponentIdentityVersion, so 0.309.0 reads that Form as the
  // deprecated WebhookForm, and its published site must still post a signup.
  // Records as that preset stored them: the action Resource takes the Form's
  // id, and its url and headers are literals.
  test("an existing org's stored Form, read without the marker, still submits to /v1/signups on its published site", async () => {
    const formState = encodeDataSourceVariable("signup-state");
    const input = (id: string, name: string): [string, Prop] => [
      `${id}-name`,
      {
        id: `${id}-name`,
        instanceId: id,
        name: "name",
        type: "string",
        value: name,
      },
    ];
    const siteData = createSiteData({
      pages: [
        {
          id: "home",
          name: "Home",
          title: '"Home"',
          path: "",
          rootInstanceId: "root",
          meta: {},
        },
        {
          id: "signup-page",
          name: "Newsletter",
          title: '"Newsletter"',
          path: "/newsletter",
          rootInstanceId: "signup-body",
          meta: {},
        },
      ],
      instances: [
        [
          "root",
          { id: "root", component: "ws:element", tag: "body", children: [] },
        ],
        [
          "signup-body",
          {
            id: "signup-body",
            component: "ws:element",
            tag: "body",
            children: [{ type: "id", value: "signup-form" }],
          },
        ],
        [
          "signup-form",
          {
            id: "signup-form",
            component: "Form",
            children: [
              { type: "id", value: "signup-email" },
              { type: "id", value: "signup-first-name" },
              { type: "id", value: "signup-last-name" },
              { type: "id", value: "signup-submit" },
            ],
          },
        ],
        ...["signup-email", "signup-first-name", "signup-last-name"].map(
          (id) =>
            [
              id,
              { id, component: "ws:element", tag: "input", children: [] },
            ] as [string, Omit<Instance, "type">]
        ),
        [
          "signup-submit",
          {
            id: "signup-submit",
            component: "ws:element",
            tag: "button",
            children: [{ type: "text", value: "Sign up" }],
          },
        ],
      ],
      props: [
        [
          "signup-form-action",
          {
            id: "signup-form-action",
            instanceId: "signup-form",
            name: "action",
            type: "resource",
            value: "signup-form",
          },
        ],
        [
          "signup-form-state",
          {
            id: "signup-form-state",
            instanceId: "signup-form",
            name: "state",
            type: "expression",
            value: formState,
          },
        ],
        [
          "signup-form-on-state-change",
          {
            id: "signup-form-on-state-change",
            instanceId: "signup-form",
            name: "onStateChange",
            type: "action",
            value: [
              {
                type: "execute",
                args: ["state"],
                code: `${formState} = state`,
              },
            ],
          },
        ],
        input("signup-email", "email"),
        input("signup-first-name", "first_name"),
        input("signup-last-name", "last_name"),
      ],
      dataSources: [
        [
          "signup-state",
          {
            id: "signup-state",
            scopeInstanceId: "signup-body",
            name: "formState",
            type: "variable",
            value: { type: "string", value: "initial" },
          },
        ],
      ],
      resources: [
        [
          "signup-form",
          {
            id: "signup-form",
            name: "action",
            method: "post",
            url: JSON.stringify(
              "https://app.organizeos.org/api/public/v1/signups"
            ),
            headers: [
              {
                name: "Content-Type",
                value: JSON.stringify("application/json"),
              },
              {
                name: "Authorization",
                value: JSON.stringify("Bearer osk_token"),
              },
            ],
          },
        ],
      ],
    });
    siteData.projectDomain = "acme";
    expect("formComponentIdentityVersion" in siteData.build.pages).toBe(true);
    expect(JSON.parse(JSON.stringify(siteData.build.pages))).not.toHaveProperty(
      "formComponentIdentityVersion"
    );
    await writeSiteData(siteData);
    await prebuild({
      assets: false,
      template: ["react-router", "react-router-vercel"],
    });

    // Read without the marker, the stored Form is a WebhookForm.
    const pageModule = await readFile(
      join("app", "__generated__", "[newsletter]._index.tsx"),
      "utf8"
    );
    expect(pageModule).toContain("WebhookForm");
    expect(pageModule).not.toMatch(/\bResourceForm\b/);

    // The generated Node fetch module, with its destination policy kept and
    // only the transport stubbed (createNodeProtectedResourceFetch resolves
    // DNS and connects).
    await writeFile(
      join("app", "__generated__", "$resources.managed-form-fetch.server.ts"),
      `import { getDeniedResourceHostnames, validateProtectedResourceDestination } from "@webstudio-is/sdk/protected-resource-fetch";
export const createManagedFormEmailSender = () => undefined;
export const validateManagedFormEmail = () => undefined;
export const createManagedFormResourceFetch = ({ request, projectDomain }: { request: Request; projectDomain?: string }) => {
  const deniedHostnames = getDeniedResourceHostnames([new URL(request.url).hostname, projectDomain]);
  const validateDestination = (url: URL) => validateProtectedResourceDestination(url, deniedHostnames);
  return Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
    validateDestination(new URL(String(input instanceof Request ? input.url : input)));
    return (globalThis as unknown as { __organizeosSignupFetch: typeof fetch }).__organizeosSignupFetch(input, init);
  }, { validateDestination });
};
`
    );
    await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
    await build({
      stdin: {
        contents: 'export { action } from "./app/routes/[newsletter]._index"',
        resolveDir: tempDir,
      },
      outfile: join(tempDir, "organizeos-signup-action.mjs"),
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
      loader: { ".css": "text" },
    });
    const { action } = await import(
      pathToFileURL(join(tempDir, "organizeos-signup-action.mjs")).href
    );
    const received: Array<{
      url: string;
      method: string;
      authorization: string | null;
      body: unknown;
    }> = [];
    vi.stubGlobal(
      "__organizeosSignupFetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        received.push({
          url: request.url,
          method: request.method,
          authorization: request.headers.get("Authorization"),
          body: await request.json(),
        });
        return Response.json({ ok: true }, { status: 201 });
      })
    );

    const form = new FormData();
    form.set(formIdFieldName, "action");
    form.set(formBotFieldName, "brave");
    form.set("email", "ada@example.org");
    form.set("first_name", "Ada");
    form.set("last_name", "Lovelace");
    // As production serves it: the proxy fetches the deployment origin and
    // sends the org's host as x-forwarded-host (client/lib/websites2/site-proxy.ts).
    await expect(
      action({
        request: new Request("https://acme-site-abc123.vercel.app/newsletter", {
          method: "POST",
          headers: { "x-forwarded-host": "acme.organizeos.org" },
          body: form,
        }),
        context: {},
        params: {},
      })
    ).resolves.toEqual({ success: true });
    expect(received).toEqual([
      {
        url: "https://app.organizeos.org/api/public/v1/signups",
        method: "POST",
        authorization: "Bearer osk_token",
        body: {
          email: "ada@example.org",
          first_name: "Ada",
          last_name: "Lovelace",
        },
      },
    ]);
  });

  // OrganizeOS fork, D15: the /newsletter form provisioning seeds since
  // 0.309.0, a ResourceForm whose action Resource posts the form's formData.
  // Its records are the builder's own output, pinned by
  // apps/builder/app/shared/db/__fixtures__/signup-form.json (its test,
  // "the published-site fixture", fails when the preset changes).
  test("the provisioned ResourceForm submits to /v1/signups on its published site", async () => {
    const fixture = JSON.parse(
      await readFile(
        new URL(
          "../../../apps/builder/app/shared/db/__fixtures__/signup-form.json",
          import.meta.url
        ),
        "utf8"
      )
    ) as {
      readToken: string;
      bodyId: string;
      pageId: string;
      instances: Instance[];
      props: Prop[];
      dataSources: DataSource[];
      resources: Array<{ id: string }>;
    };
    const form = fixture.instances.find(
      (instance) => instance.component === "ResourceForm"
    );
    expect(form).toBeDefined();
    const siteData = createSiteData({
      pages: [
        {
          id: "home",
          name: "Home",
          title: '"Home"',
          path: "",
          rootInstanceId: "root",
          meta: {},
        },
        {
          id: fixture.pageId,
          name: "Newsletter",
          title: '"Newsletter"',
          path: "/newsletter",
          rootInstanceId: fixture.bodyId,
          meta: {},
        },
      ],
      instances: [
        [
          "root",
          { id: "root", component: "ws:element", tag: "body", children: [] },
        ],
        ...fixture.instances.map(
          (instance) => [instance.id, instance] as [string, Instance]
        ),
      ],
      props: fixture.props.map((prop) => [prop.id, prop]),
      dataSources: fixture.dataSources.map((dataSource) => [
        dataSource.id,
        dataSource,
      ]),
      resources: fixture.resources.map((resource) => [resource.id, resource]),
    });
    siteData.projectDomain = "acme";
    await writeSiteData(siteData);
    await prebuild({
      assets: false,
      template: ["react-router", "react-router-vercel"],
    });

    const pageModule = await readFile(
      join("app", "__generated__", "[newsletter]._index.tsx"),
      "utf8"
    );
    expect(pageModule).toMatch(/\bResourceForm\b/);
    expect(pageModule).not.toContain("WebhookForm");

    // The generated Node fetch module, with its destination policy kept and
    // only the transport stubbed (createNodeProtectedResourceFetch resolves
    // DNS and connects).
    await writeFile(
      join("app", "__generated__", "$resources.managed-form-fetch.server.ts"),
      `import { getDeniedResourceHostnames, validateProtectedResourceDestination } from "@webstudio-is/sdk/protected-resource-fetch";
export const createManagedFormEmailSender = () => undefined;
export const validateManagedFormEmail = () => undefined;
export const createManagedFormResourceFetch = ({ request, projectDomain }: { request: Request; projectDomain?: string }) => {
  const deniedHostnames = getDeniedResourceHostnames([new URL(request.url).hostname, projectDomain]);
  const validateDestination = (url: URL) => validateProtectedResourceDestination(url, deniedHostnames);
  return Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
    validateDestination(new URL(String(input instanceof Request ? input.url : input)));
    return (globalThis as unknown as { __organizeosSignupFetch: typeof fetch }).__organizeosSignupFetch(input, init);
  }, { validateDestination });
};
`
    );
    await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
    await build({
      stdin: {
        contents: 'export { action } from "./app/routes/[newsletter]._index"',
        resolveDir: tempDir,
      },
      outfile: join(tempDir, "organizeos-resource-form-action.mjs"),
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
      loader: { ".css": "text" },
    });
    const { action } = await import(
      pathToFileURL(join(tempDir, "organizeos-resource-form-action.mjs")).href
    );
    const received: Array<{
      url: string;
      method: string;
      authorization: string | null;
      contentType: string | null;
      body: unknown;
    }> = [];
    vi.stubGlobal(
      "__organizeosSignupFetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        received.push({
          url: request.url,
          method: request.method,
          authorization: request.headers.get("Authorization"),
          contentType: request.headers.get("Content-Type"),
          body: await request.json(),
        });
        return Response.json({ ok: true }, { status: 201 });
      })
    );

    const submission = new FormData();
    submission.set(managedFormIdFieldName, form!.id);
    submission.set(formBotFieldName, "brave");
    submission.set(managedFormArrayNamesFieldName, "[]");
    submission.set("email", "ada@example.org");
    submission.set("first_name", "Ada");
    submission.set("last_name", "Lovelace");
    // As production serves it: the proxy fetches the deployment origin and
    // sends the org's host as x-forwarded-host (client/lib/websites2/site-proxy.ts).
    await expect(
      action({
        request: new Request(
          `https://acme-site-abc123.vercel.app/newsletter?${managedFormRequestParamName}=1`,
          {
            method: "POST",
            headers: { "x-forwarded-host": "acme.organizeos.org" },
            body: submission,
          }
        ),
        context: {},
        params: {},
      })
    ).resolves.toMatchObject({ success: true });
    expect(received).toEqual([
      {
        url: "https://app.organizeos.org/api/public/v1/signups",
        method: "POST",
        authorization: `Bearer ${fixture.readToken}`,
        contentType: expect.stringMatching(/^application\/json\b/),
        body: {
          email: "ada@example.org",
          first_name: "Ada",
          last_name: "Lovelace",
        },
      },
    ]);
  });

  // OrganizeOS fork: a CMS item page (/blog/:slug, made by the builder's
  // Create item page) sets its status to 404 when its Resource does not answer
  // with the item, and the html route answers with that status and the page's
  // own body, its "not found" box, so a missing item is a real 404.
  describe("answers an item page with the status its meta computes", () => {
    const itemVariable = encodeDataSourceVariable("current-post");
    const system = "$ws$system";
    const found = `(${system}.params.slug ?? "") !== "" && ${itemVariable}?.ok === true && ${itemVariable}.data.data.slug === ${system}.params.slug`;
    const itemUrl =
      "https://app.example.org/api/public/v1/collections/blog/items/";

    beforeEach(async () => {
      const pages = [
        {
          id: "home",
          name: "Home",
          title: `"Home"`,
          path: "",
          rootInstanceId: "root",
          meta: {},
        },
        {
          id: "blog-item",
          name: "Blog template",
          title: `(${found}) ? ${itemVariable}.data.data.name : "Page not found"`,
          path: "/blog/:slug",
          rootInstanceId: "item-root",
          meta: { status: `(${found}) ? 200 : 404` },
        },
      ];
      await writeSiteData(
        createSiteData({
          pages,
          instances: [
            ["root", { id: "root", component: "Box", children: [] }],
            ["item-root", { id: "item-root", component: "Box", children: [] }],
          ],
          dataSources: [
            [
              "current-post",
              {
                type: "resource",
                id: "current-post",
                name: "Current post",
                scopeInstanceId: "item-root",
                resourceId: "current-post-resource",
              },
            ],
          ],
          resources: [
            [
              "current-post-resource",
              {
                id: "current-post-resource",
                name: "Current post",
                method: "get",
                url: `${JSON.stringify(itemUrl)} + (${system}.params.slug ?? "-")`,
                headers: [
                  { name: "Authorization", value: `"Bearer osk_test"` },
                ],
              },
            ],
          ],
        })
      );
      await prebuild({
        assets: false,
        template: ["react-router", "react-router-vercel"],
      });
    });

    /**
     * The item route's loader as the site ships it, with its generated
     * resources and meta, the sdk's resource loading, a fresh resource cache
     * and react-router's data(); the client module and auth stood in.
     */
    const loadItemLoader = async () => {
      const exports = await loadGeneratedRoute(
        join("app", "routes", "[blog].$slug._index.tsx"),
        "[blog].$slug._index",
        { "@webstudio-is/wsauth": { authenticateRequest: () => undefined } }
      );
      const loader = exports.loader as (arg: unknown) => Promise<{
        data: { pageMeta: { status?: number; title: string } };
        init: { status?: number } | null;
      }>;
      return (slug: string) =>
        loader({
          request: new Request(`https://site.example/blog/${slug}`),
          params: { slug },
          context: { EXCLUDE_FROM_SEARCH: false },
        });
    };

    const answer = (status: number, body: unknown) => async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          "content-type": "application/json",
          "cache-control": "public, s-maxage=60",
        },
      });

    test("200 with the item's title when the Resource answers with the item", async () => {
      const network = vi.fn<typeof fetch>(
        answer(200, { data: { slug: "hello", name: "Hello" } })
      );
      globalThis.fetch = network;

      const result = await (await loadItemLoader())("hello");

      expect(network).toHaveBeenCalledWith(
        `${itemUrl}hello`,
        expect.objectContaining({ method: "get" })
      );
      expect(result.init?.status).toBe(200);
      expect(result.data.pageMeta.title).toBe("Hello");
    });

    test.each([
      {
        name: "answers 404",
        fetch: answer(404, { error: "Not found" }),
      },
      {
        name: "answers with another item",
        fetch: answer(200, { data: { slug: "other", name: "Other" } }),
      },
      {
        name: "fails",
        fetch: async (): Promise<Response> => {
          throw new TypeError("fetch failed");
        },
      },
    ])(
      "404 with the page, not an error, when the Resource $name",
      async ({ fetch }) => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        globalThis.fetch = vi.fn<typeof globalThis.fetch>(fetch);

        const result = await (await loadItemLoader())("missing");

        expect(result.init?.status).toBe(404);
        expect(result.data.pageMeta.status).toBe(404);
        expect(result.data.pageMeta.title).toBe("Page not found");
      }
    );

    test("a second request for a missing item reads the 404 the cache kept", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const network = vi.fn<typeof fetch>(answer(404, { error: "Not found" }));
      globalThis.fetch = network;
      const load = await loadItemLoader();

      expect((await load("missing")).init?.status).toBe(404);
      expect((await load("missing")).init?.status).toBe(404);
      expect(network).toHaveBeenCalledTimes(1);
    });
  });

  // OrganizeOS fork: org script is paused (organizeos-org-script.ts)
  // OrganizeOS fork: organizeos-preview-header.ts
  test("fails a build whose Resource headers name X-OOS-Preview, in any casing", async () => {
    await writeSiteData(
      createSiteData({
        resources: [
          [
            "news",
            {
              id: "news",
              name: "News",
              method: "get",
              url: `"https://app.organizeos.org/api/public/v1/collections/news/items"`,
              headers: [{ name: "x-OOS-preview", value: `"v1.a.b"` }],
            },
          ],
        ],
      })
    );
    await expect(
      prebuild({
        assets: false,
        template: ["react-router", "react-router-vercel"],
      })
    ).rejects.toThrow(/X-OOS-Preview.*"News"/);
  });

  // OrganizeOS fork: input validation for expressions and generated names
  // (organizeos-code-check.ts)
  describe("stops a build with a value that fails input validation", () => {
    const page = (meta: Record<string, unknown>, title = `"Home"`) => ({
      pages: [
        {
          id: "home",
          name: "Home",
          title,
          path: "",
          rootInstanceId: "root",
          meta,
        },
      ],
    });
    const resource = (init: Record<string, unknown>) => ({
      resources: [
        [
          "news",
          {
            id: "news",
            name: "News",
            method: "post",
            url: `"https://example.org"`,
            headers: [],
            ...init,
          },
        ] as [string, Record<string, unknown>],
      ],
    });
    const rootProp = (init: Record<string, unknown>) => ({
      props: [
        [
          "prop",
          { id: "prop", instanceId: "root", name: "title", ...init },
        ] as [string, Record<string, unknown>],
      ],
    });
    const action = (args: string[], code: string) =>
      rootProp({
        name: "onClick",
        type: "action",
        value: [{ type: "execute", args, code }],
      });

    // a Resource that the page loads, through a data source on its root
    const loaded = (init: Record<string, unknown>) => ({
      ...resource(init),
      dataSources: [
        [
          "news-ds",
          {
            type: "resource",
            id: "news-ds",
            name: "news",
            scopeInstanceId: "root",
            resourceId: "news",
          },
        ],
      ] as Array<[string, Record<string, unknown>]>,
    });
    const literalTitle = page({});
    // a field, the build, the check's message and what publishing counts
    const valueCases: Array<
      [string, Parameters<typeof createSiteData>[0], string, string]
    > = [
      ["the title", page({}, "a()"), 'The title of page "/"', "1 expression"],
      [
        "the description",
        page({ description: "a()" }),
        "The description",
        "1 expression",
      ],
      ["the status", page({ status: "a()" }), "The status", "1 expression"],
      [
        "custom metadata",
        page({ custom: [{ property: "og:x", content: "a()" }] }),
        'The custom metadata "og:x"',
        "1 expression",
      ],
      [
        "a text expression",
        {
          ...literalTitle,
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Box",
                children: [{ type: "expression" as const, value: "a()" }],
              },
            ] as [
              string,
              {
                id: string;
                component: string;
                children: Array<{ type: "expression"; value: string }>;
              },
            ],
          ],
        },
        'The text expression of instance "root"',
        "1 expression",
      ],
      [
        "a property expression",
        { ...literalTitle, ...rootProp({ type: "expression", value: "a()" }) },
        'The property "title" of instance "root"',
        "1 expression",
      ],
      [
        "a resource URL",
        { ...literalTitle, ...loaded({ url: "a()" }) },
        'The resource "News" URL',
        "1 Resource",
      ],
      [
        "a search parameter name",
        {
          ...literalTitle,
          ...loaded({ searchParams: [{ name: 'a"', value: `"b"` }] }),
        },
        'The resource "News" search parameter name',
        "1 Resource",
      ],
      [
        "a search parameter value",
        {
          ...literalTitle,
          ...loaded({ searchParams: [{ name: "q", value: "a()" }] }),
        },
        'The resource "News" search parameter "q"',
        "1 Resource",
      ],
      [
        "a header name",
        {
          ...literalTitle,
          ...loaded({ headers: [{ name: "a b", value: `"b"` }] }),
        },
        'The resource "News" header name',
        "1 Resource",
      ],
      [
        "a header value",
        {
          ...literalTitle,
          ...loaded({ headers: [{ name: "X-A", value: "a()" }] }),
        },
        'The resource "News" header "X-A"',
        "1 Resource",
      ],
      [
        "a body",
        { ...literalTitle, ...loaded({ body: "a()" }) },
        'The resource "News" body',
        "1 Resource",
      ],
      [
        "an email subject",
        {
          ...literalTitle,
          ...loaded({
            control: "email",
            email: { subject: `"a".constructor.constructor("return 1")()` },
          }),
        },
        'The resource "News" email subject',
        "1 Resource",
      ],
      [
        "an email body",
        {
          ...literalTitle,
          ...loaded({
            control: "email",
            email: { body: `"a".constructor.constructor("return 1")()` },
          }),
        },
        'The resource "News" email body',
        "1 Resource",
      ],
      [
        "an email sender",
        {
          ...literalTitle,
          ...loaded({
            control: "email",
            email: {
              senderExpression: `"a".constructor.constructor("return 1")()`,
            },
          }),
        },
        'The resource "News" email sender',
        "1 Resource",
      ],
      [
        "an email recipients",
        {
          ...literalTitle,
          ...loaded({
            control: "email",
            email: {
              recipientsExpression: `"a".constructor.constructor("return 1")()`,
            },
          }),
        },
        'The resource "News" email recipients',
        "1 Resource",
      ],
    ];

    // With the pause's rules set aside, as when org script may run, a value
    // input validation refuses stops the build, named
    test.each(
      valueCases.map(([field, overrides, message]) => [
        field,
        overrides,
        message,
      ])
    )("%s", async (_field, overrides, message) => {
      vi.mocked(dropOrgScript).mockImplementationOnce((bundle) => bundle);
      await writeSiteData(createSiteData(overrides));
      await expect(
        prebuild({
          assets: false,
          template: ["react-router", "react-router-vercel"],
        })
      ).rejects.toThrow(message);
    });

    // While org script is paused, publishing leaves out an expression, a page
    // setting or a Resource that input validation refuses, counted, before
    // the check runs, and builds the rest
    test.each(
      valueCases.map(([field, overrides, , count]) => [field, overrides, count])
    )(
      "leaves out %s while org script is paused, and builds the rest",
      async (_field, overrides, count) => {
        const info = vi.spyOn(log, "info").mockImplementation(() => {});
        await writeSiteData(createSiteData(overrides));
        await prebuild({
          assets: false,
          template: ["react-router", "react-router-vercel"],
        });
        expect(info).toHaveBeenCalledWith(
          `Org script is paused until OrganizeOS sites move to their own domain: left out ${count}.`
        );
      },
      slowPrebuildTestTimeout
    );

    // While org script is paused, publishing leaves out an action that input
    // validation refuses before the check runs, and builds the rest
    test.each([
      ["an action's code", [], "a = 1"],
      ["an action's argument", ["a)"], "undefined"],
      ["an action that reads NaN", [], "$ws$dataSource$v = NaN"],
      ["an action that reads Infinity", [], "$ws$dataSource$v = Infinity"],
      ["an action's object key", [], "$ws$dataSource$v = { constructor: 1 }"],
    ])(
      "leaves out %s while org script is paused, and builds the rest",
      async (_field, args, code) => {
        const info = vi.spyOn(log, "info").mockImplementation(() => {});
        await writeSiteData(
          createSiteData({
            ...literalTitle,
            ...action(args, code),
            dataSources: [
              [
                "v",
                {
                  type: "variable",
                  id: "v",
                  name: "v",
                  scopeInstanceId: "root",
                  value: { type: "string", value: "" },
                },
              ],
            ],
          })
        );
        await prebuild({
          assets: false,
          template: ["react-router", "react-router-vercel"],
        });
        expect(info).toHaveBeenCalledWith(
          "Org script is paused until OrganizeOS sites move to their own domain: left out 1 unsafe action."
        );
      },
      slowPrebuildTestTimeout
    );

    // and one that nothing publishes goes, not counted
    test(
      "leaves out a Resource no page loads that input validation refuses, and builds the rest",
      async () => {
        const info = vi.spyOn(log, "info").mockImplementation(() => {});
        await writeSiteData(
          createSiteData({
            ...literalTitle,
            ...resource({ headers: [{ name: "a b", value: `"b"` }] }),
          })
        );
        await prebuild({
          assets: false,
          template: ["react-router", "react-router-vercel"],
        });
        expect(info).not.toHaveBeenCalled();
      },
      slowPrebuildTestTimeout
    );

    test(
      "a build whose values pass is built",
      async () => {
        await writeSiteData(
          createSiteData({
            ...page({ description: `"About"` }),
            ...rootProp({ type: "expression", value: "`a ${1}`" }),
          })
        );
        await prebuild({
          assets: false,
          template: ["react-router", "react-router-vercel"],
        });
      },
      slowPrebuildTestTimeout
    );
  });

  describe("leaves an org's own script out", () => {
    const scriptEmbed = '<script>alert("embed")</script>';

    const generated = async (file = "_index") => {
      await prebuild({
        assets: false,
        template: ["react-router", "react-router-vercel"],
      });
      const generatedDir = join("app", "__generated__");
      return {
        page: await readFile(join(generatedDir, `${file}.tsx`), "utf8"),
        resources: await readFile(
          join(generatedDir, `${file}.server.tsx`),
          "utf8"
        ),
      };
    };

    // T12
    test("leaves out HTML Embeds and custom code", async () => {
      await writeSiteData(
        createSiteData({
          pageMeta: { code: '<script src="/custom.js"></script>' },
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [
                  { type: "id", value: "box" },
                  { type: "id", value: "remote" },
                  { type: "id", value: "jsx" },
                ],
              },
            ],
            [
              "box",
              {
                id: "box",
                component: "Box",
                children: [{ type: "id", value: "embed" }],
              },
            ],
            ["embed", { id: "embed", component: "HtmlEmbed", children: [] }],
            [
              "remote",
              {
                id: "remote",
                component: elementComponent,
                tag: "script",
                children: [],
              },
            ],
            [
              "jsx",
              {
                id: "jsx",
                component: elementComponent,
                tag: 'div />{"marker_tag"}<div',
                children: [],
              },
            ],
          ],
          props: [
            [
              "embed-code",
              {
                id: "embed-code",
                instanceId: "embed",
                name: "code",
                type: "string",
                value: scriptEmbed,
              },
            ],
            [
              "remote-src",
              {
                id: "remote-src",
                instanceId: "remote",
                name: "src",
                type: "string",
                value: "https://evil.example/x.js",
              },
            ],
          ],
        })
      );

      const { page } = await generated();

      expect(page).not.toContain("alert");
      expect(page).not.toContain("HtmlEmbed");
      expect(page).not.toContain("custom.js");
      expect(page).not.toContain("evil.example");
      expect(page).not.toContain("<script");
      expect(page).not.toContain("marker_");
      // The page still exports its custom code, and now it holds nothing
      expect(page).toMatch(
        /export const CustomCode = \(\) => \{\s*return \(<><\/>\);/
      );
      expect(page).not.toContain("const Script");
      // ... and still renders the Box
      expect(page).toContain("<Box");
    });

    test("leaves out Markdown Embeds and the SVG animate and set elements", async () => {
      await writeSiteData(
        createSiteData({
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [
                  { type: "id", value: "markdown" },
                  { type: "id", value: "svg" },
                ],
              },
            ],
            [
              "markdown",
              { id: "markdown", component: "MarkdownEmbed", children: [] },
            ],
            [
              "svg",
              {
                id: "svg",
                component: elementComponent,
                tag: "svg",
                children: [{ type: "id", value: "link" }],
              },
            ],
            [
              "link",
              {
                id: "link",
                component: elementComponent,
                tag: "a",
                children: [
                  { type: "id", value: "animate" },
                  { type: "id", value: "set" },
                  { type: "id", value: "transform" },
                ],
              },
            ],
            [
              "animate",
              {
                id: "animate",
                component: elementComponent,
                tag: "animate",
                children: [],
              },
            ],
            [
              "set",
              {
                id: "set",
                component: elementComponent,
                tag: "set",
                children: [],
              },
            ],
            [
              "transform",
              {
                id: "transform",
                component: elementComponent,
                tag: "animateTransform",
                children: [],
              },
            ],
          ],
          props: [
            [
              "markdown-code",
              {
                id: "markdown-code",
                instanceId: "markdown",
                name: "code",
                type: "string",
                value: "[x](javascript:void0)",
              },
            ],
            [
              "animate-values",
              {
                id: "animate-values",
                instanceId: "animate",
                name: "values",
                type: "string",
                value: "javascript:void0",
              },
            ],
          ],
        })
      );

      const { page } = await generated();

      expect(page).not.toContain("MarkdownEmbed");
      expect(page).not.toContain("javascript:");
      expect(page).not.toContain("<animate ");
      expect(page).not.toContain("<set ");
      expect(page).toContain("<svg");
      expect(page).toContain("<Link");
      expect(page).toContain("<animateTransform");
    });

    // The generator writes an action's args as an arrow function's
    // parameters, and the page renders on the site's server and in every
    // visitor's browser, so crafted args would run in both before any click
    // (actionMayRun in @organizeos/site-components/org-script)
    test("leaves out an action that could run script or reach the page, and keeps one a template writes", async () => {
      const state = encodeDataSourceVariable("state");
      const action = (
        instanceId: string,
        value: Array<{ args: string[]; code: string }>,
        name = "onClick"
      ): [string, Record<string, unknown>] => [
        `${instanceId}-${name}`,
        {
          id: `${instanceId}-${name}`,
          instanceId,
          name,
          type: "action",
          value: value.map((entry) => ({ type: "execute", ...entry })),
        },
      ];
      const boxes = [
        "crafted",
        "block",
        "member",
        "generic",
        "parameter",
        "stored",
        "regex",
        "shadow",
        "length",
        "resource",
        "newline",
        "newline-block",
        "newline-cr",
        "newline-ls",
        "newline-comment",
        "proto",
        "comment",
        "comment-line",
        "kept",
      ];
      // a Webhook Form passes its action plain data: its state
      const forms = [
        "form-member",
        "form-generic",
        "form-regex",
        "form-newline",
        "form-a",
        "form-kept",
      ];
      await writeSiteData(
        createSiteData({
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [...boxes, ...forms].map((value) => ({
                  type: "id" as const,
                  value,
                })),
              },
            ],
            ...boxes.map(
              (
                id
              ): [string, { id: string; component: string; children: [] }] => [
                id,
                { id, component: "Box", children: [] },
              ]
            ),
            ...forms.map(
              (
                id
              ): [string, { id: string; component: string; children: [] }] => [
                id,
                { id, component: "Form", children: [] },
              ]
            ),
          ],
          dataSources: [
            [
              "state",
              {
                type: "variable",
                id: "state",
                name: "formState",
                scopeInstanceId: "root",
                value: { type: "string", value: "idle" },
              },
            ],
            // a parameter
            [
              "param",
              {
                type: "parameter",
                id: "param",
                name: "name",
                scopeInstanceId: "parameter",
              },
            ],
            // a variable named like an arg
            [
              "e",
              {
                type: "variable",
                id: "e",
                name: "event",
                scopeInstanceId: "root",
                value: { type: "string", value: "idle" },
              },
            ],
            [
              "res",
              {
                type: "resource",
                id: "res",
                name: "res",
                scopeInstanceId: "root",
                resourceId: "res-resource",
              },
            ],
          ],
          resources: [
            [
              "res-resource",
              {
                id: "res-resource",
                name: "res",
                method: "get",
                url: `"https://example.org/data.json"`,
                headers: [],
              },
            ],
          ],
          props: [
            action("crafted", [
              { args: [') => 0, "marker_args", (x'], code: "0" },
            ]),
            // a code that starts with an object
            action("block", [
              {
                args: [],
                code: '{} / "/}, "marker_block", () => { // "',
              },
            ]),
            action("member", [
              {
                args: ["event"],
                code: "event.view.location.hash",
              },
            ]),
            // a < followed later by a >
            action("generic", [
              { args: ["a", "b", "c"], code: `${state} = a < b > (c)` },
            ]),
            action("parameter", [
              { args: [], code: `${encodeDataSourceVariable("param")} = "x"` },
            ]),
            // an event set to a variable, where a Box passes one
            action("stored", [{ args: ["event"], code: `${state} = event` }]),
            // a regular expression after a `>`
            action("regex", [
              { args: [], code: '1 < 2 > /("marker_regex")/g' },
            ]),
            // an arg named like a variable
            action("shadow", [
              {
                args: ["event"],
                code: `${state} = ${encodeDataSourceVariable("e")}`,
              },
            ]),
            // a member, with no args
            action("length", [
              { args: [], code: `${state} = ${state}.length` },
            ]),
            // an assignment to a Resource
            action("resource", [
              { args: [], code: `${encodeDataSourceVariable("res")} = 1` },
            ]),
            // a member and a call, a < followed later by a > and a regular
            // expression, where the args may be named
            action(
              "form-member",
              [
                {
                  args: ["state"],
                  code: `${state} = state.constructor.name`,
                },
              ],
              "onStateChange"
            ),
            action(
              "form-generic",
              [{ args: ["a", "b", "c"], code: `${state} = a < b > (c)` }],
              "onStateChange"
            ),
            action(
              "form-regex",
              [
                {
                  args: ["state"],
                  code: `${state} = ${state} < ${state} > /("marker_form_regex")/i`,
                },
              ],
              "onStateChange"
            ),
            // a < followed later by a >, with no args and where the args may
            // be named
            action("newline", [
              {
                args: [],
                code: `${state} = "s" < 1 >\n ["constructor"] < 1 >\n ["constructor"]`,
              },
            ]),
            action("newline-block", [
              {
                args: [],
                code: `${state} = 1 < 2 >\n{} / "/}, "marker_newline", () => { // "`,
              },
            ]),
            ...(
              [
                ["newline-cr", "\r"],
                ["newline-ls", "\u2028"],
                ["newline-comment", " /*\n*/ "],
              ] as const
            ).map(([id, between]) =>
              action(id, [
                {
                  args: [],
                  code: `${state} = 1 < 2 >${between}{} / "/}, "marker_newline", () => { // "`,
                },
              ])
            ),
            action(
              "form-newline",
              [
                {
                  args: ["state"],
                  code: `${state} = state < 1 >\n["constructor"]`,
                },
              ],
              "onStateChange"
            ),
            action(
              "form-a",
              [{ args: ["a"], code: `${state} = a < 1 >\n["constructor"]` }],
              "onStateChange"
            ),
            // an object keyed __proto__
            action("proto", [
              { args: [], code: `${state} = { __proto__: null }` },
            ]),
            // a comment
            action("comment", [{ args: [], code: `${state} = /* note */ 1` }]),
            action("comment-line", [
              { args: [], code: `${state} = // note\n 1` },
            ]),
            // what the templates write
            action("kept", [{ args: [], code: `${state} = "clicked"` }]),
            action(
              "form-kept",
              [{ args: ["state"], code: `${state} = state` }],
              "onStateChange"
            ),
          ],
        })
      );

      const { page } = await generated();
      const { code: compiled } = await transformWithEsbuild(
        page,
        "module.tsx",
        { loader: "tsx", format: "esm", jsx: "automatic" }
      );

      expect(page).not.toContain("marker_");
      expect(page).not.toContain("location");
      expect(page).not.toContain("constructor");
      expect(compiled).not.toContain("constructor");
      expect(page).not.toContain("__proto__");
      expect(page).not.toContain("note");
      expect(page).not.toMatch(/a < b > \(c\)/);
      expect(page).not.toMatch(/ < [12] >/);
      expect(page).not.toMatch(/\bname = "x"/);
      expect(page).not.toMatch(/formState = event\b/);
      expect(page).not.toMatch(/\.length/);
      // no setter for a Resource
      expect(page).not.toMatch(/set\$res\b/);
      expect(page).not.toContain("$ws$dataSource$");
      // the templates' actions are still written, as handlers, and they are
      // the only ones
      expect(page).toMatch(/onClick=\{\(\) => \{\s*formState = "clicked"/);
      expect(page.match(/onClick=/g)).toHaveLength(1);
      expect(page).toMatch(
        /onStateChange=\{\(state: any\) => \{\s*formState = state\s/
      );
      expect(page.match(/onStateChange=/g)).toHaveLength(1);

      const exports = await runModule(page, {
        react: React,
        "react/jsx-runtime": jsxRuntime,
        "@webstudio-is/react-sdk/runtime":
          await import("@webstudio-is/react-sdk/runtime"),
        "@webstudio-is/sdk-components-react/components":
          await import("@webstudio-is/sdk-components-react/components"),
        "@webstudio-is/sdk-components-react-router": {
          Body: (props: Record<string, unknown>) =>
            React.createElement("body", props),
          // the stored Form publishes as a Webhook Form
          WebhookForm: ({ children }: { children?: React.ReactNode }) =>
            React.createElement("form", null, children),
        },
      });
      const Page = exports.Page as ComponentType<Record<string, unknown>>;
      renderToStaticMarkup(
        React.createElement(Page, {
          system: { params: {}, search: {}, origin: "https://x" },
        })
      );
    });

    // The builder's global root is not an instance it stores: one stored with
    // its id goes, and the global data sources stay with every page
    test("keeps the global data sources when it leaves out an instance stored with the global root's id", async () => {
      await writeSiteData(
        createSiteData({
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [{ type: "id", value: "button" }],
              },
            ],
            ["button", { id: "button", component: "Box", children: [] }],
            [":root", { id: ":root", component: "HtmlEmbed", children: [] }],
          ],
          dataSources: [
            [
              "local",
              {
                type: "variable",
                id: "local",
                name: "local",
                scopeInstanceId: "root",
                value: { type: "string", value: "" },
              },
            ],
            [
              "global",
              {
                type: "variable",
                id: "global",
                name: "global",
                scopeInstanceId: ":root",
                value: { type: "string", value: "" },
              },
            ],
          ],
          props: [
            [
              ":root-code",
              {
                id: ":root-code",
                instanceId: ":root",
                name: "code",
                type: "string",
                value: "<b>1</b>",
              },
            ],
            [
              "button-onClick",
              {
                id: "button-onClick",
                instanceId: "button",
                name: "onClick",
                type: "action",
                value: [
                  {
                    type: "execute",
                    args: [],
                    code: `${encodeDataSourceVariable("local")} = ${encodeDataSourceVariable("global")}`,
                  },
                ],
              },
            ],
          ],
        })
      );

      const { page } = await generated();
      const { code: compiled } = await transformWithEsbuild(
        page,
        "module.tsx",
        { loader: "tsx", format: "esm", jsx: "automatic" }
      );

      // the action is written, with the global variable declared
      expect(page).toMatch(/onClick=\{\(\) => \{\s*local = global\b/);
      expect(page).toMatch(/let \[global, set\$global\] = useVariableState/);
      expect(compiled).not.toContain("$ws$dataSource$");
    });

    // A Resource Form's own form data and browser info stay while org
    // script is paused, and the page names them as themselves
    test("keeps a Resource Form's own form data and browser info, declared on the page, and no parameter of those names elsewhere", async () => {
      const parameter = (
        id: string,
        name: string,
        scopeInstanceId: string
      ): [string, Record<string, unknown>] => [
        id,
        { type: "parameter", id, name, scopeInstanceId },
      ];
      const parameterProp = (
        instanceId: string,
        name: string,
        value: string
      ): [string, Record<string, unknown>] => [
        `${instanceId}-${name}`,
        {
          id: `${instanceId}-${name}`,
          instanceId,
          name,
          type: "parameter",
          value,
        },
      ];
      await writeSiteData(
        createSiteData({
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [
                  { type: "id", value: "form" },
                  { type: "id", value: "box" },
                ],
              },
            ],
            ["form", { id: "form", component: "ResourceForm", children: [] }],
            ["box", { id: "box", component: "Box", children: [] }],
          ],
          dataSources: [
            parameter("form-data", "formData", "form"),
            parameter("browser-info", "browserInfo", "form"),
            parameter("box-data", "formData", "box"),
          ],
          props: [
            parameterProp("form", "formData", "form-data"),
            parameterProp("form", "browserInfo", "browser-info"),
            parameterProp("box", "title", "box-data"),
          ],
        })
      );

      const { page } = await generated();

      expect(page).toMatch(/const formData: any = undefined\n/);
      expect(page).toMatch(/const browserInfo: any = undefined\n/);
      expect(page).toMatch(/formData=\{formData\}/);
      expect(page).toMatch(/browserInfo=\{browserInfo\}/);
      // the Box's is left out, with its prop
      expect(page).not.toMatch(/title=/);
      expect(page.match(/formData: any/g)).toHaveLength(1);
    });

    // The element types of a compiled page module: an import, a tag, or
    // anything else
    const elementTypesOf = (compiled: string) => {
      const program = parseModule(compiled, {
        ecmaVersion: "latest",
        sourceType: "module",
      });
      const imported = new Set<string>();
      const runtime = new Set<string>();
      for (const node of program.body) {
        if (node.type === "ImportDeclaration") {
          for (const specifier of node.specifiers) {
            imported.add(specifier.local.name);
            if (node.source.value === "react/jsx-runtime") {
              runtime.add(specifier.local.name);
            }
          }
        }
      }
      const types: Array<{ kind: "import" | "tag" | "other"; name: string }> =
        [];
      walkSimple(program, {
        CallExpression(node) {
          if (
            node.callee.type !== "Identifier" ||
            runtime.has(node.callee.name) === false
          ) {
            return;
          }
          const [type] = node.arguments;
          if (type?.type === "Literal" && typeof type.value === "string") {
            types.push({ kind: "tag", name: type.value });
          } else if (type?.type === "Identifier" && imported.has(type.name)) {
            types.push({ kind: "import", name: type.name });
          } else {
            types.push({
              kind: "other",
              name:
                type === undefined ? "" : compiled.slice(type.start, type.end),
            });
          }
        },
      });
      return types;
    };

    const renderPage = async (
      page: string,
      components: Record<string, Record<string, unknown>>
    ) => {
      const exports = await runModule(page, {
        react: React,
        "react/jsx-runtime": jsxRuntime,
        "@webstudio-is/react-sdk/runtime":
          await import("@webstudio-is/react-sdk/runtime"),
        "@webstudio-is/sdk-components-react-router": {
          Body: (props: Record<string, unknown>) =>
            React.createElement("body", props),
        },
        ...components,
      });
      const Page = exports.Page as ComponentType<Record<string, unknown>>;
      return renderToStaticMarkup(
        React.createElement(Page, {
          system: { params: {}, search: {}, origin: "https://x" },
        })
      );
    };

    const variable = (
      id: string,
      name: string,
      scopeInstanceId = "root"
    ): [string, Record<string, unknown>] => [
      id,
      {
        type: "variable",
        id,
        name,
        scopeInstanceId,
        value: { type: "string", value: "script" },
      },
    ];

    // A data source's id may not be one the page module uses for anything
    // else
    test("leaves out a data source whose id the page module uses for something else, and what names it reads nothing", async () => {
      const info = vi.spyOn(log, "info").mockImplementation(() => {});
      await writeSiteData(
        createSiteData({
          // a page title is an expression; the builder writes a string literal
          pages: [
            {
              id: "home",
              name: "Home",
              title: '"Home"',
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
          ],
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [
                  { type: "id", value: "button" },
                  { type: "id", value: "label" },
                  { type: "id", value: "source" },
                ],
              },
            ],
            [
              "button",
              {
                id: "button",
                component: "Box",
                children: [{ type: "text", value: "marker_text_1" }],
              },
            ],
            ["source", { id: "source", component: "Box", children: [] }],
            [
              "label",
              {
                id: "label",
                component: "Box",
                children: [{ type: "text", value: "marker_text_2" }],
              },
            ],
          ],
          dataSources: [variable("Box", "v"), variable("Body", "w")],
          props: [
            [
              "button-onClick",
              {
                id: "button-onClick",
                instanceId: "button",
                name: "onClick",
                type: "action",
                value: [
                  {
                    type: "execute",
                    args: [],
                    code: `${encodeDataSourceVariable("Box")} = ${encodeDataSourceVariable("Box")}`,
                  },
                ],
              },
            ],
            // a read of it, and a parameter prop that names it
            [
              "root-title",
              {
                id: "root-title",
                instanceId: "root",
                name: "title",
                type: "expression",
                value: encodeDataSourceVariable("Box"),
              },
            ],
            [
              "source-src",
              {
                id: "source-src",
                instanceId: "source",
                name: "src",
                type: "string",
                value: "https://evil.example/x.js",
              },
            ],
            [
              "label-data-x",
              {
                id: "label-data-x",
                instanceId: "label",
                name: "data-x",
                type: "parameter",
                value: "Body",
              },
            ],
          ],
        })
      );

      const { page } = await generated();
      const { code: compiled } = await transformWithEsbuild(
        page,
        "module.tsx",
        { loader: "tsx", format: "esm", jsx: "automatic" }
      );

      expect(page).not.toMatch(/let \[(Box|Body)\b/);
      expect(page).not.toContain("onClick=");
      const types = elementTypesOf(compiled);
      expect(
        types.filter(({ kind }) => kind === "import").length
      ).toBeGreaterThan(0);
      expect(types.filter(({ kind }) => kind !== "import")).toEqual([]);
      const html = await renderPage(page, {
        "@webstudio-is/sdk-components-react/components": {
          Box: (props: Record<string, unknown>) =>
            React.createElement("div", props),
        },
      });
      expect(html).not.toContain("<script");
      expect(info).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 1 unsafe action, 2 variables with a conflicting id and 1 expression."
      );
    });

    // Only a component the page imports, or one the generator writes itself,
    // ships
    test("leaves out an instance whose component the page does not import", async () => {
      const info = vi.spyOn(log, "info").mockImplementation(() => {});
      await writeSiteData(
        createSiteData({
          // a page title is an expression; the builder writes a string literal
          pages: [
            {
              id: "home",
              name: "Home",
              title: '"Home"',
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
          ],
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [
                  { type: "id", value: "script" },
                  { type: "id", value: "named" },
                  { type: "id", value: "box" },
                ],
              },
            ],
            [
              "script",
              {
                id: "script",
                component: "x:script",
                children: [{ type: "text", value: "marker_text_1" }],
              },
            ],
            [
              "named",
              {
                id: "named",
                component: "x:Location",
                children: [],
              },
            ],
            ["box", { id: "box", component: "Box", children: [] }],
          ],
        })
      );

      const { page } = await generated();
      const { code: compiled } = await transformWithEsbuild(
        page,
        "module.tsx",
        { loader: "tsx", format: "esm", jsx: "automatic" }
      );

      expect(page).not.toContain("marker_");
      expect(page).not.toMatch(/<(script|Location)\b/);
      expect(
        elementTypesOf(compiled).filter(({ kind }) => kind !== "import")
      ).toEqual([]);
      expect(info).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 2 unknown components."
      );
    });

    // The framework decides which components a page imports: the remix
    // template imports no OrganizeOS block
    test("leaves out a component the framework the site is built with does not import", async () => {
      const info = vi.spyOn(log, "info").mockImplementation(() => {});
      await writeSiteData(
        createSiteData({
          // a page title is an expression; the builder writes a string literal
          pages: [
            {
              id: "home",
              name: "Home",
              title: '"Home"',
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
          ],
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [
                  { type: "id", value: "signup" },
                  { type: "id", value: "box" },
                ],
              },
            ],
            [
              "signup",
              {
                id: "signup",
                component: "@organizeos/site-components:SignupForm",
                children: [],
              },
            ],
            ["box", { id: "box", component: "Box", children: [] }],
          ],
        })
      );

      await prebuild({ assets: false, template: ["defaults"] });
      const page = await readFile(
        join("app", "__generated__", "_index.tsx"),
        "utf8"
      );

      expect(page).not.toContain("SignupForm");
      expect(page).toMatch(/<Box\b/);
      expect(info).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 1 unknown component."
      );
    });

    // Inside a Collection an action names only what it may: never the
    // Collection's item, its index or its key
    test("an action inside a Collection names neither its item, its index nor its key", async () => {
      const box = (
        id: string
      ): [string, { id: string; component: string; children: [] }] => [
        id,
        { id, component: "Box", children: [] },
      ];
      const onClick = (
        instanceId: string,
        code: string
      ): [string, Record<string, unknown>] => [
        `${instanceId}-onClick`,
        {
          id: `${instanceId}-onClick`,
          instanceId,
          name: "onClick",
          type: "action",
          value: [{ type: "execute", args: [], code }],
        },
      ];
      const list = (
        id: string,
        item: string
      ): Array<[string, Record<string, unknown>]> => [
        [
          `${id}-data`,
          {
            id: `${id}-data`,
            instanceId: id,
            name: "data",
            type: "json",
            value: ["a", "b"],
          },
        ],
        [
          `${id}-item`,
          {
            id: `${id}-item`,
            instanceId: id,
            name: "item",
            type: "parameter",
            value: item,
          },
        ],
      ];
      await writeSiteData(
        createSiteData({
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [
                  { type: "id", value: "list" },
                  { type: "id", value: "other" },
                ],
              },
            ],
            [
              "list",
              {
                id: "list",
                component: "ws:collection",
                children: ["b1", "b2", "b3"].map((value) => ({
                  type: "id" as const,
                  value,
                })),
              },
            ],
            // a Collection whose item's id may not ship
            [
              "other",
              {
                id: "other",
                component: "ws:collection",
                children: [{ type: "id", value: "b4" }],
              },
            ],
            box("b1"),
            box("b2"),
            box("b3"),
            box("b4"),
          ],
          dataSources: [
            [
              "item",
              {
                type: "parameter",
                id: "item",
                name: "item",
                scopeInstanceId: "list",
              },
            ],
            [
              "set$v1",
              {
                type: "parameter",
                id: "set$v1",
                name: "item",
                scopeInstanceId: "other",
              },
            ],
            variable("v1", "v1"),
            variable("list-index", "idx"),
            variable("k", "_key"),
          ],
          props: [
            ...list("list", "item"),
            ...list("other", "set$v1"),
            onClick("b1", `${encodeDataSourceVariable("v1")} = 1`),
            onClick(
              "b2",
              `${encodeDataSourceVariable("v1")} = ${encodeDataSourceVariable("list-index")}`
            ),
            onClick("b3", `${encodeDataSourceVariable("k")} = 1`),
            onClick("b4", `${encodeDataSourceVariable("v1")} = 2`),
          ],
        })
      );

      const { page } = await generated();

      // the one action that names a variable is written, with its own setter
      expect(page.match(/onClick=/g)).toHaveLength(1);
      expect(page).toMatch(/onClick=\{\(\) => \{\s*v1 = 1\s*set\$v1\(v1\)/);
      expect(page).toMatch(/let \[v1, set\$v1\] = useVariableState/);
      // a Collection whose item may not ship is not written
      expect(page.match(/\.map\(/g)).toHaveLength(1);
      expect(page).not.toMatch(/\b_key = /);
      expect(page).not.toMatch(/= index\b/);
    });

    // A parameter is declared as itself only as a page's own or as a
    // Collection's item or key
    test("leaves out a parameter no page declares, so a parameter prop that names it reads nothing", async () => {
      const info = vi.spyOn(log, "info").mockImplementation(() => {});
      const link = (id: string): [string, Record<string, unknown>][] => [
        [
          `${id}-href`,
          {
            id: `${id}-href`,
            instanceId: id,
            name: "href",
            type: "string",
            value: "mailto:a@example.org",
          },
        ],
        [
          `${id}-ref`,
          {
            id: `${id}-ref`,
            instanceId: id,
            name: "ref",
            type: "parameter",
            value: "capture",
          },
        ],
      ];
      await writeSiteData(
        createSiteData({
          // a page title is an expression; the builder writes a string literal
          pages: [
            {
              id: "home",
              name: "Home",
              title: '"Home"',
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
          ],
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [
                  { type: "id", value: "link" },
                  { type: "id", value: "area" },
                ],
              },
            ],
            [
              "link",
              {
                id: "link",
                component: "Link",
                children: [{ type: "text", value: "link" }],
              },
            ],
            [
              "area",
              {
                id: "area",
                component: "ws:element",
                tag: "area",
                children: [],
              },
            ],
          ],
          dataSources: [
            [
              "capture",
              {
                type: "parameter",
                id: "capture",
                name: "capture",
                scopeInstanceId: "root",
              },
            ],
          ],
          props: [...link("link"), ...link("area")],
        })
      );

      const { page } = await generated();
      const { code: compiled } = await transformWithEsbuild(
        page,
        "module.tsx",
        { loader: "tsx", format: "esm", jsx: "automatic" }
      );

      expect(page).not.toMatch(/\sref=/);
      expect(compiled).not.toMatch(/\bcapture\b/);
      // the page renders, and no ref it is given calls anything
      const capture = vi.fn();
      (globalThis as { capture?: unknown }).capture = capture;
      try {
        const node = { tagName: "A" };
        const Link = React.forwardRef(
          (
            props: Record<string, unknown>,
            ref: React.ForwardedRef<unknown>
          ) => {
            if (typeof ref === "function") {
              ref(node);
            }
            return React.createElement("a", props);
          }
        );
        const html = await renderPage(page, {
          "@webstudio-is/sdk-components-react-router": {
            Body: (props: Record<string, unknown>) =>
              React.createElement("body", props),
            Link,
          },
        });
        expect(html).toContain('href="mailto:a@example.org"');
        expect(capture).not.toHaveBeenCalled();
      } finally {
        delete (globalThis as { capture?: unknown }).capture;
      }
      expect(info).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 1 variable with a conflicting id."
      );
    });

    // A page's own parameter is declared on that page alone, and a
    // Collection binds one item
    // A variable holds plain data only: nothing writes an element into one
    test("leaves out a parameter or an expression named ref, so no ref names a data source", async () => {
      const info = vi.spyOn(log, "info").mockImplementation(() => {});
      const ref = (
        instanceId: string,
        type: "parameter" | "expression",
        value: string
      ): [string, Record<string, unknown>] => [
        `${instanceId}-ref`,
        { id: `${instanceId}-ref`, instanceId, name: "ref", type, value },
      ];
      await writeSiteData(
        createSiteData({
          // a page title is an expression; the builder writes a string literal
          pages: [
            {
              id: "home",
              name: "Home",
              title: `"Home"`,
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
          ],
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [
                  { type: "id", value: "named" },
                  { type: "id", value: "bound" },
                ],
              },
            ],
            [
              "named",
              {
                id: "named",
                component: "Box",
                children: [{ type: "text", value: "named" }],
              },
            ],
            [
              "bound",
              {
                id: "bound",
                component: "Box",
                children: [{ type: "text", value: "bound" }],
              },
            ],
          ],
          props: [
            ref("named", "parameter", "held"),
            ref("bound", "expression", encodeDataSourceVariable("held")),
          ],
          dataSources: [
            [
              "held",
              {
                type: "variable",
                id: "held",
                name: "held",
                scopeInstanceId: "root",
                value: { type: "json", value: {} },
              },
            ],
          ],
        })
      );

      const { page } = await generated();

      expect(page).toContain("named");
      expect(page).not.toMatch(/\sref=/);
      expect(info).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 2 element references."
      );
    });

    test("leaves out a page template's own parameter held on the global root's id, and both parameters of a Collection with two item props", async () => {
      const info = vi.spyOn(log, "info").mockImplementation(() => {});
      const ref = (
        instanceId: string,
        value: string
      ): [string, Record<string, unknown>] => [
        `${instanceId}-ref`,
        {
          id: `${instanceId}-ref`,
          instanceId,
          name: "ref",
          type: "parameter",
          value,
        },
      ];
      const siteData = createSiteData({
        // a page title is an expression; the builder writes a string literal
        pages: [
          {
            id: "home",
            name: "Home",
            title: `"Home"`,
            path: "",
            rootInstanceId: "root",
            meta: {},
          },
        ],
        instances: [
          [
            "root",
            {
              id: "root",
              component: "Body",
              children: [
                { type: "id", value: "link" },
                { type: "id", value: "list" },
              ],
            },
          ],
          [
            "link",
            {
              id: "link",
              component: "Link",
              children: [{ type: "text", value: "link" }],
            },
          ],
          [
            "list",
            {
              id: "list",
              component: "ws:collection",
              children: [{ type: "id", value: "card" }],
            },
          ],
          [
            "card",
            {
              id: "card",
              component: "Link",
              children: [{ type: "text", value: "card" }],
            },
          ],
        ],
        props: [
          ref("link", "own"),
          ref("card", "first"),
          [
            "list-data",
            {
              id: "list-data",
              instanceId: "list",
              name: "data",
              type: "json",
              value: ["a"],
            },
          ],
          [
            "list-item",
            {
              id: "list-item",
              instanceId: "list",
              name: "item",
              type: "parameter",
              value: "first",
            },
          ],
          [
            "list-item-2",
            {
              id: "list-item-2",
              instanceId: "list",
              name: "item",
              type: "parameter",
              value: "last",
            },
          ],
        ],
        dataSources: [
          [
            "own",
            {
              type: "parameter",
              id: "own",
              name: "capture",
              scopeInstanceId: ":root",
            },
          ],
          [
            "first",
            {
              type: "parameter",
              id: "first",
              name: "capture",
              scopeInstanceId: "list",
            },
          ],
          [
            "last",
            {
              type: "parameter",
              id: "last",
              name: "item",
              scopeInstanceId: "list",
            },
          ],
        ],
      });
      (
        siteData.build.pages as unknown as { pageTemplates: unknown[] }
      ).pageTemplates = [
        {
          id: "template",
          name: "Template",
          title: `"Template"`,
          rootInstanceId: ":root",
          systemDataSourceId: "own",
          meta: {},
        },
      ];
      await writeSiteData(siteData);

      const { page } = await generated();
      const { code: compiled } = await transformWithEsbuild(
        page,
        "module.tsx",
        { loader: "tsx", format: "esm", jsx: "automatic" }
      );

      expect(page).not.toMatch(/\sref=/);
      expect(compiled).not.toMatch(/\bcapture\b/);
      const capture = vi.fn();
      (globalThis as { capture?: unknown }).capture = capture;
      try {
        const Link = React.forwardRef(
          (
            props: Record<string, unknown>,
            forwarded: React.ForwardedRef<unknown>
          ) => {
            if (typeof forwarded === "function") {
              forwarded({ tagName: "A" });
            }
            return React.createElement("a", props);
          }
        );
        await renderPage(page, {
          "@webstudio-is/sdk-components-react-router": {
            Body: (props: Record<string, unknown>) =>
              React.createElement("body", props),
            Link,
          },
        });
        expect(capture).not.toHaveBeenCalled();
      } finally {
        delete (globalThis as { capture?: unknown }).capture;
      }
      expect(info).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 3 variables with a conflicting id."
      );
    });

    // An XML page does not publish a Resource Form, so its own form data
    // goes there, and nothing on the page names it
    test("leaves out the form data of a Resource Form on an XML page, so the page names nothing undeclared", async () => {
      const info = vi.spyOn(log, "info").mockImplementation(() => {});
      await writeSiteData(
        createSiteData({
          pages: [
            {
              id: "home",
              name: "Home",
              title: "Home",
              path: "",
              rootInstanceId: "root",
              meta: { documentType: "xml" },
            },
          ],
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [{ type: "id", value: "item" }],
              },
            ],
            [
              "item",
              {
                id: "item",
                component: "XmlNode",
                tag: "item",
                children: [
                  { type: "id", value: "form" },
                  { type: "id", value: "title" },
                ],
              },
            ],
            ["form", { id: "form", component: "ResourceForm", children: [] }],
            [
              "title",
              { id: "title", component: "XmlNode", tag: "title", children: [] },
            ],
          ],
          dataSources: [
            [
              "form-data",
              {
                type: "parameter",
                id: "form-data",
                name: "formData",
                scopeInstanceId: "form",
              },
            ],
          ],
          props: [
            [
              "title-lang",
              {
                id: "title-lang",
                instanceId: "title",
                name: "lang",
                type: "parameter",
                value: "form-data",
              },
            ],
          ],
        })
      );

      const { page } = await generated();
      const { code: compiled } = await transformWithEsbuild(
        page,
        "module.tsx",
        { loader: "tsx", format: "esm", jsx: "automatic" }
      );

      expect(page).toContain('data-ws-tag="title"');
      expect(page).not.toMatch(/lang=/);
      expect(compiled).not.toMatch(/formData/);
      expect(info).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 1 variable with a conflicting id."
      );
    });

    // No data source may take the name String
    test("leaves out a variable named String, so a bound text value renders", async () => {
      const info = vi.spyOn(log, "info").mockImplementation(() => {});
      await writeSiteData(
        createSiteData({
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [{ type: "id", value: "image" }],
              },
            ],
            ["image", { id: "image", component: "Image", children: [] }],
          ],
          dataSources: [
            variable("string-name", "String"),
            [
              "label",
              {
                type: "variable",
                id: "label",
                name: "label",
                scopeInstanceId: "root",
                value: { type: "string", value: "A label" },
              },
            ],
          ],
          props: [
            [
              "image-alt",
              {
                id: "image-alt",
                instanceId: "image",
                name: "alt",
                type: "expression",
                value: encodeDataSourceVariable("label"),
              },
            ],
            // what names the variable that goes goes with it
            [
              "image-title",
              {
                id: "image-title",
                instanceId: "image",
                name: "title",
                type: "expression",
                value: `${encodeDataSourceVariable("label")} + ${encodeDataSourceVariable("string-name")}`,
              },
            ],
          ],
        })
      );

      const { page } = await generated();

      expect(page).toMatch(/String\(/);
      expect(page).not.toMatch(/let \[String\b/);
      const html = await renderPage(page, {
        "@webstudio-is/sdk-components-react/components": {
          Image: (props: Record<string, unknown>) =>
            React.createElement("img", props),
        },
      });
      expect(html).toContain('alt="A label"');
      expect(html).not.toContain("title=");
      expect(info).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 1 variable with a conflicting id and 1 expression."
      );
    });

    // No data source may be named as a global the page reads
    test("leaves out a variable named as a global the page reads, so a Collection beside it renders", async () => {
      const info = vi.spyOn(log, "info").mockImplementation(() => {});
      await writeSiteData(
        createSiteData({
          // a page title is an expression; the builder writes a string literal
          pages: [
            {
              id: "home",
              name: "Home",
              title: '"Home"',
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
          ],
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [
                  { type: "id", value: "list" },
                  { type: "id", value: "label" },
                ],
              },
            ],
            [
              "list",
              {
                id: "list",
                component: "ws:collection",
                children: [{ type: "id", value: "card" }],
              },
            ],
            ["card", { id: "card", component: "Box", children: [] }],
            ["label", { id: "label", component: "Box", children: [] }],
          ],
          dataSources: [
            variable("object-name", "Object"),
            [
              "item",
              {
                type: "parameter",
                id: "item",
                name: "item",
                scopeInstanceId: "list",
              },
            ],
          ],
          props: [
            [
              "list-data",
              {
                id: "list-data",
                instanceId: "list",
                name: "data",
                type: "json",
                value: ["first", "second"],
              },
            ],
            [
              "list-item",
              {
                id: "list-item",
                instanceId: "list",
                name: "item",
                type: "parameter",
                value: "item",
              },
            ],
            [
              "card-title",
              {
                id: "card-title",
                instanceId: "card",
                name: "title",
                type: "parameter",
                value: "item",
              },
            ],
            [
              "label-title",
              {
                id: "label-title",
                instanceId: "label",
                name: "title",
                type: "parameter",
                value: "object-name",
              },
            ],
          ],
        })
      );

      const { page } = await generated();

      expect(page).not.toMatch(/let \[Object\b/);
      const html = await renderPage(page, {
        "@webstudio-is/sdk-components-react/components": {
          Box: (props: Record<string, unknown>) =>
            React.createElement("div", props),
        },
      });
      expect(html).toContain('title="first"');
      expect(html).toContain('title="second"');
      expect(info).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 1 variable with a conflicting id."
      );
    });

    // A Collection binds as its item or key only a parameter of its own, and
    // never an action
    test("an action inside a Collection names no variable the Collection binds, and a Collection's item is no action", async () => {
      const info = vi.spyOn(log, "info").mockImplementation(() => {});
      await writeSiteData(
        createSiteData({
          // a page title is an expression; the builder writes a string literal
          pages: [
            {
              id: "home",
              name: "Home",
              title: '"Home"',
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
          ],
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [
                  { type: "id", value: "list" },
                  { type: "id", value: "actions" },
                ],
              },
            ],
            [
              "list",
              {
                id: "list",
                component: "ws:collection",
                children: [{ type: "id", value: "button" }],
              },
            ],
            ["button", { id: "button", component: "Box", children: [] }],
            [
              "actions",
              {
                id: "actions",
                component: "ws:collection",
                children: [{ type: "id", value: "card" }],
              },
            ],
            ["card", { id: "card", component: "Box", children: [] }],
          ],
          dataSources: [variable("v", "v"), variable("sink", "sink")],
          props: [
            [
              "list-data",
              {
                id: "list-data",
                instanceId: "list",
                name: "data",
                type: "json",
                value: ["ITEM_A", "ITEM_B"],
              },
            ],
            [
              "list-item",
              {
                id: "list-item",
                instanceId: "list",
                name: "item",
                type: "parameter",
                value: "v",
              },
            ],
            [
              "button-onClick",
              {
                id: "button-onClick",
                instanceId: "button",
                name: "onClick",
                type: "action",
                value: [
                  {
                    type: "execute",
                    args: [],
                    code: `${encodeDataSourceVariable("sink")} = ${encodeDataSourceVariable("v")}`,
                  },
                ],
              },
            ],
            [
              "actions-data",
              {
                id: "actions-data",
                instanceId: "actions",
                name: "data",
                type: "json",
                value: ["a"],
              },
            ],
            [
              "actions-item",
              {
                id: "actions-item",
                instanceId: "actions",
                name: "item",
                type: "action",
                value: [],
              },
            ],
          ],
        })
      );

      const { page } = await generated();
      const { code: compiled } = await transformWithEsbuild(
        page,
        "module.tsx",
        { loader: "tsx", format: "esm", jsx: "automatic" }
      );

      expect(compiled).toBeTruthy();
      expect(page).not.toContain("onClick=");
      expect(page).not.toMatch(/\.map\(\(\[_key, v\]/);
      expect(page).not.toMatch(/\.map\(\(\[_key, \(/);
      expect(info).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 2 unsafe actions and 1 variable with a conflicting id."
      );
    });

    // The only thing left out is a data source the page module uses for
    // something else
    test("leaves out a data source whose id the page module uses for something else when nothing else is left out", async () => {
      const info = vi.spyOn(log, "info").mockImplementation(() => {});
      await writeSiteData(
        createSiteData({
          // a page title is an expression; the builder writes a string literal
          pages: [
            {
              id: "home",
              name: "Home",
              title: '"Home"',
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
          ],
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [{ type: "id", value: "box" }],
              },
            ],
            [
              "box",
              {
                id: "box",
                component: "Box",
                children: [{ type: "text", value: "marker_text_1" }],
              },
            ],
          ],
          dataSources: [variable("Box", "v")],
          props: [
            [
              "box-x",
              {
                id: "box-x",
                instanceId: "box",
                name: "x",
                type: "parameter",
                value: "Box",
              },
            ],
          ],
        })
      );

      const { page } = await generated();

      expect(page).not.toMatch(/let \[Box\b/);
      const html = await renderPage(page, {
        "@webstudio-is/sdk-components-react/components": {
          Box: (props: Record<string, unknown>) =>
            React.createElement("div", props),
        },
      });
      expect(html).not.toContain("<script");
      expect(html).toContain("marker_text_1</div>");
      expect(info).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 1 variable with a conflicting id."
      );
    });

    // A build holds one entry per id, as the builder reads it: the last
    test("publishes the last of two entries with one id, and only that one", async () => {
      const info = vi.spyOn(log, "info").mockImplementation(() => {});
      // a page title is an expression; the builder writes a string literal
      const pages = [
        {
          id: "home",
          name: "Home",
          title: '"Home"',
          path: "",
          rootInstanceId: "root",
          meta: {},
        },
        {
          id: "about",
          name: "About",
          title: '"About"',
          path: "/about",
          rootInstanceId: "about-root",
          meta: {},
        },
      ];
      await writeSiteData(
        createSiteData({
          pages,
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [
                  { type: "id", value: "box" },
                  { type: "id", value: "link" },
                ],
              },
            ],
            ["box", { id: "box", component: "Box", children: [] }],
            [
              "link",
              {
                id: "link",
                component: "Link",
                children: [{ type: "text", value: "link" }],
              },
            ],
            [
              "about-root",
              {
                id: "about-root",
                component: "Body",
                children: [{ type: "id", value: "about-box" }],
              },
            ],
            ["about-box", { id: "about-box", component: "Box", children: [] }],
          ],
          props: [
            // a refused action, then a plain one, with one id
            [
              "P",
              {
                id: "P",
                instanceId: "box",
                name: "onClick",
                type: "action",
                value: [
                  {
                    type: "execute",
                    args: [') => 0, "marker_args", (x'],
                    code: "0",
                  },
                ],
              },
            ],
            [
              "P",
              {
                id: "P",
                instanceId: "about-box",
                name: "onClick",
                type: "action",
                value: [
                  {
                    type: "execute",
                    args: [],
                    code: `${encodeDataSourceVariable("D")} = "clicked"`,
                  },
                ],
              },
            ],
            [
              "link-ref",
              {
                id: "link-ref",
                instanceId: "link",
                name: "ref",
                type: "parameter",
                value: "D",
              },
            ],
          ],
          // a parameter no page declares, then a variable, with one id
          dataSources: [
            [
              "D",
              {
                type: "parameter",
                id: "D",
                name: "capture",
                scopeInstanceId: "root",
              },
            ],
            [
              "D",
              {
                type: "variable",
                id: "D",
                name: "harmless",
                scopeInstanceId: "about-root",
                value: { type: "string", value: "idle" },
              },
            ],
          ],
        })
      );

      const { page: home } = await generated();
      const { page: about } = await generated("[about]._index");

      expect(home).not.toContain("marker_");
      expect(home).not.toContain("onClick=");
      expect(home).not.toMatch(/\sref=/);
      expect(home).not.toMatch(/\bcapture\b/);
      expect(about).toMatch(
        /onClick=\{\(\) => \{\s*harmless = "clicked"\s*set\$harmless\(harmless\)/
      );
      expect(about).toMatch(
        /let \[harmless, set\$harmless\] = useVariableState<any>\("idle"\)/
      );
      expect(info).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 2 duplicate entries and 1 element reference."
      );
    });

    // The templates' action sets a variable to its arg, and still does when
    // an org has named the variable as the arg
    test("writes the templates' action when the variable it sets is named as its arg", async () => {
      await writeSiteData(
        createSiteData({
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [{ type: "id", value: "form" }],
              },
            ],
            ["form", { id: "form", component: "Form", children: [] }],
          ],
          dataSources: [variable("form-state", "state")],
          props: [
            [
              "form-onStateChange",
              {
                id: "form-onStateChange",
                instanceId: "form",
                name: "onStateChange",
                type: "action",
                value: [
                  {
                    type: "execute",
                    args: ["state"],
                    code: `${encodeDataSourceVariable("form-state")} = state`,
                  },
                ],
              },
            ],
          ],
        })
      );

      const { page } = await generated();
      await transformWithEsbuild(page, "module.tsx", {
        loader: "tsx",
        format: "esm",
        jsx: "automatic",
      });

      expect(page).toMatch(
        /onStateChange=\{\(state: any\) => \{\s*state = state\s*set\$state\(state\)/
      );
      expect(page).toMatch(/let \[state, set\$state\] = useVariableState/);
    });

    // While org script is paused, publishing keeps an expression only where
    // expressionMayRun passes it and it names only data sources the published
    // module declares where it is written, and a Resource only when every part
    // of it passes (findPausedExpressions in
    // @organizeos/site-components/org-script).
    describe("expressions, Resources and page settings", () => {
      // An expression the rule refuses, which holds its marker: one that
      // reads a member it may not read, and one the linter accepts that calls
      // a method with an argument that is not a literal. A module that holds a
      // marker published what the rule refuses.
      const refused = (marker: string) => `"marker_${marker}".constructor.name`;
      const refusedLintClean = (marker: string) =>
        `"marker_${marker}".replace("marker", ["x"].join(""))`;
      const system = {
        params: {},
        search: {},
        origin: "https://x",
        pathname: "/",
      };
      const id = encodeDataSourceVariable;

      // the names a generated module reads past what it declares and the
      // globals it may read, and the imports it shadows: none, as the check
      // publishing makes requires
      const undeclaredIn = async (code: string) => {
        const { undeclared, shadowed } = await findGeneratedCodeProblems(code);
        return [...undeclared, ...shadowed];
      };

      const renderPage = async (page: string) => {
        const element = (tag: string) => (props: Record<string, unknown>) =>
          React.createElement(tag, props);
        const exports = await runModule(page, {
          react: React,
          "react/jsx-runtime": jsxRuntime,
          "@webstudio-is/react-sdk/runtime":
            await import("@webstudio-is/react-sdk/runtime"),
          "@webstudio-is/sdk-components-react/components":
            await import("@webstudio-is/sdk-components-react/components"),
          "@webstudio-is/sdk-components-react-router": {
            Body: element("body"),
            Link: element("a"),
            RemixForm: element("form"),
            WebhookForm: element("form"),
            ResourceForm: element("form"),
          },
          "@webstudio-is/sdk": await import("@webstudio-is/sdk"),
        });
        const Page = exports.Page as ComponentType<Record<string, unknown>>;
        return renderToStaticMarkup(React.createElement(Page, { system }));
      };

      // each request as the page's load makes it, with no Resource's data
      // yet, by its name, and those a resource prop names, by the prop's
      const runServer = async (server: string) => {
        const exports = await runModule(server, {
          "@webstudio-is/sdk": await import("@webstudio-is/sdk"),
          "@webstudio-is/sdk/to-string":
            await import("@webstudio-is/sdk/to-string"),
          "@webstudio-is/react-sdk": await import("@webstudio-is/react-sdk"),
        });
        type Request = { url: unknown; headers: unknown[] };
        const getResources = exports.getResources as (props: unknown) => {
          data: {
            resources: Array<{
              id: string;
              outputName: string;
              createRequest: (
                documents: ReadonlyMap<string, unknown>
              ) => Request;
            }>;
          };
          action: Map<string, { outputName: string }>;
        };
        const getPageMeta = exports.getPageMeta as (props: unknown) => unknown;
        const graph = getResources({ system });
        // a request that reads another Resource's data gets a stand-in
        const documents = new Map(
          graph.data.resources.map(({ id }) => [id, { x: `data-of-${id}` }])
        );
        const data = new Map(
          graph.data.resources.map(({ outputName, createRequest }) => [
            outputName,
            createRequest(documents),
          ])
        );
        const action = new Map(
          [...graph.action].map(([name, { outputName }]) => [
            name,
            data.get(outputName) as Request,
          ])
        );
        return {
          resources: { data, action },
          meta: getPageMeta({ system, resources: {} }),
        };
      };

      const expression = (
        instanceId: string,
        name: string,
        value: string
      ): [string, Record<string, unknown>] => [
        `${instanceId}-${name}`,
        {
          id: `${instanceId}-${name}`,
          instanceId,
          name,
          type: "expression",
          value,
        },
      ];
      const parameter = (
        instanceId: string,
        name: string,
        value: string
      ): [string, Record<string, unknown>] => [
        `${instanceId}-${name}`,
        {
          id: `${instanceId}-${name}`,
          instanceId,
          name,
          type: "parameter",
          value,
        },
      ];
      const box = (
        instanceId: string,
        children: Array<{ type: "id" | "expression"; value: string }> = [],
        component = "Box"
      ): [
        string,
        { id: string; component: string; children: typeof children },
      ] => [instanceId, { id: instanceId, component, children }];
      const ids = (...list: string[]) =>
        list.map((value) => ({ type: "id" as const, value }));
      const resourceBinding = (
        resourceId: string,
        name = resourceId
      ): [string, Record<string, unknown>] => [
        `${resourceId}-ds`,
        {
          type: "resource",
          id: `${resourceId}-ds`,
          name,
          scopeInstanceId: "root",
          resourceId,
        },
      ];
      const resource = (
        resourceId: string,
        init: Record<string, unknown> = {}
      ): [string, Record<string, unknown>] => [
        resourceId,
        {
          id: resourceId,
          name: resourceId,
          method: "get",
          url: `"https://example.org/${resourceId}"`,
          headers: [],
          ...init,
        },
      ];

      // A Collection's item and a Resource's data source, named outside where
      // the module declares them
      const item = id("row-item");
      const named = id("first-ds");

      test("leaves out every expression and page setting that could run script, and every name the module does not declare where it is written", async () => {
        await writeSiteData(
          createSiteData({
            pages: [
              {
                id: "home",
                name: "Home",
                title: refused("title"),
                path: "",
                rootInstanceId: "root",
                meta: {
                  description: refused("description"),
                  excludePageFromSearch: refused("exclude"),
                  language: refused("language"),
                  socialImageUrl: refused("social"),
                  status: refused("status"),
                  redirect: `"/" + ${refused("redirect")}`,
                  content: refused("content"),
                  custom: [
                    { property: "og:x", content: refused("custom") },
                    {
                      property: "og:item",
                      content: `${item}.x`,
                    },
                    { property: "og:type", content: '"website"' },
                  ],
                },
              },
            ],
            instances: [
              box(
                "root",
                ids(
                  "titled",
                  "link",
                  "shown",
                  "text",
                  "list",
                  "outside",
                  "items"
                ),
                "Body"
              ),
              box("titled"),
              [
                "link",
                {
                  id: "link",
                  component: elementComponent,
                  tag: "a",
                  children: [],
                },
              ],
              box("shown"),
              box("text", [
                {
                  type: "expression",
                  value: '"t") && ("marker_text"',
                },
              ]),
              box("list", ids("entry"), "ws:collection"),
              box("entry"),
              box("outside"),
              box("items", ids("inside"), "ws:collection"),
              box("inside"),
            ],
            props: [
              expression("titled", "title", '"x"} data-x={"marker_prop"'),
              expression("link", "href", `"/" + ${refused("href")}`),
              expression("shown", "data-ws-show", 'false) || ("marker_show"'),
              expression("list", "data", refusedLintClean("collection")),
              parameter("list", "item", "list-item"),
              expression("outside", "title", `${item}.x`),
              expression("items", "data", '[{"x": "item value"}]'),
              parameter("items", "item", "row-item"),
              expression("inside", "title", `${item}.x`),
            ],
            dataSources: [
              [
                "list-item",
                {
                  type: "parameter",
                  id: "list-item",
                  name: "item",
                  scopeInstanceId: "list",
                },
              ],
              [
                "row-item",
                {
                  type: "parameter",
                  id: "row-item",
                  name: "row",
                  scopeInstanceId: "items",
                },
              ],
            ],
          })
        );

        const { page, resources: server } = await generated();

        expect(page).not.toContain("marker_");
        expect(server).not.toContain("marker_");
        expect(await undeclaredIn(page)).toEqual([]);
        expect(await undeclaredIn(server)).toEqual([]);

        const html = await renderPage(page);
        const { meta } = await runServer(server);
        // the item is still read inside its Collection, and the settings that
        // may run are kept
        expect(html).toContain('title="item value"');
        expect(meta).toMatchObject({
          title: "",
          custom: [{ property: "og:type", content: "website" }],
        });
      });

      test("leaves out every Resource that could run script, and keeps one whose every part may run, one that reads another Resource's data among them", async () => {
        await writeSiteData(
          createSiteData({
            instances: [box("root", [], "Body")],
            dataSources: [
              resourceBinding("first", "row"),
              resourceBinding("leak"),
              resourceBinding("in-url"),
              resourceBinding("in-search"),
              resourceBinding("in-header"),
              resourceBinding("in-body"),
              resourceBinding("in-header-name"),
              resourceBinding("in-search-name"),
              resourceBinding("kept"),
            ],
            resources: [
              resource("first"),
              resource("leak", {
                url: `"https://example.org/?k=" + ${named}.x`,
              }),
              resource("in-url", {
                url: '"https://example.org/", _u: ("marker_url")',
              }),
              resource("in-search", {
                searchParams: [
                  { name: "q", value: refusedLintClean("search") },
                ],
              }),
              resource("in-header", {
                headers: [{ name: "x", value: refusedLintClean("header") }],
              }),
              resource("in-body", { method: "post", body: refused("body") }),
              resource("in-header-name", {
                headers: [
                  {
                    name: 'x", value: ("marker_header_name"), y: "',
                    value: '"1"',
                  },
                ],
              }),
              resource("in-search-name", {
                searchParams: [
                  {
                    name: 'q", value: ("marker_search_name") }, { name: "q2',
                    value: '"1"',
                  },
                ],
              }),
              resource("kept", {
                url: '"https://example.org/items/" + ($ws$system.params.slug ?? "-")',
                headers: [{ name: "Authorization", value: '"Bearer x"' }],
              }),
            ],
          })
        );

        const { page, resources: server } = await generated();

        expect(server).not.toContain("marker_");
        expect(await undeclaredIn(page)).toEqual([]);
        expect(await undeclaredIn(server)).toEqual([]);

        const { resources } = await runServer(server);
        expect(
          [...resources.data.values()].map((request) => request.url)
        ).toEqual([
          "https://example.org/first",
          "https://example.org/?k=data-of-first",
          "https://example.org/items/-",
        ]);
      });

      test("checks every page and server module it generates, and a module that may not ship fails the publish", async () => {
        const check = vi.mocked(checkGeneratedModule);
        check.mockClear();
        await writeSiteData(
          createSiteData({
            pages: [
              {
                id: "home",
                name: "Home",
                title: '"Home"',
                path: "",
                rootInstanceId: "root",
                meta: {},
              },
              {
                id: "about",
                name: "About",
                title: '"About"',
                path: "/about",
                rootInstanceId: "about-root",
                meta: {},
              },
            ],
            instances: [box("root", [], "Body"), box("about-root", [], "Body")],
          })
        );
        await generated();
        expect(
          check.mock.calls
            .map(([, file]) => relative("app/__generated__", file))
            .sort()
        ).toEqual([
          "[about]._index.server.tsx",
          "[about]._index.tsx",
          "_index.server.tsx",
          "_index.tsx",
        ]);
        check.mockRejectedValueOnce(new Error("a module that may not ship"));
        await expect(generated()).rejects.toThrow("a module that may not ship");
      });

      test("publishes every fixture past the check", async () => {
        const fixturesDir = new URL("../../../fixtures/", import.meta.url);
        const fixtures = (await readdir(fixturesDir, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name);
        expect(fixtures.length).toBeGreaterThanOrEqual(8);
        for (const fixture of fixtures) {
          const data = await readFile(
            new URL(`${fixture}/.webstudio/data.json`, fixturesDir),
            "utf8"
          );
          await writeFile(".webstudio/data.json", data);
          await rm("app", { recursive: true, force: true });
          await expect(generated(), fixture).resolves.toBeDefined();
        }
      }, 120_000);

      // What the pause reads of each page is what prebuild publishes for it:
      // the instances it holds, the Resources it loads, those only a form's
      // submission sends, and the page settings it publishes as text
      test("reads each page as prebuild publishes it: fixtures, block templates, site templates and the registry's templates", async () => {
        const expectParity = async (label: string) => {
          const bundle = JSON.parse(
            await readFile(".webstudio/data.json", "utf8")
          ) as PublishedProjectBundle;
          const shipped = dropOrgScript(bundle);
          const pages = migratePages(shipped.build.pages);
          const hasMarker = hasHistoricalFormComponentIdentityVersion(
            shipped.build.pages
          );
          const instances = new Map(
            shipped.build.instances.map(([id, instance]) => {
              const read = { ...instance };
              migrateResourceFormInstancesMutable([read], hasMarker);
              return [id, read] as const;
            })
          );
          const props = new Map(shipped.build.props);
          const published: PublishedPage[] = [];
          findPausedExpressions({
            pages: getAllPages(pages),
            instances,
            props: props.values(),
            dataSources: new Map(shipped.build.dataSources),
            resources: new Map(shipped.build.resources ?? []),
            observe: (page) => published.push(page),
          });
          let read = 0;
          for (const page of getAllPages(pages)) {
            const file = join(
              "app",
              "__generated__",
              `${generateRemixRoute(getPagePath(page.id, pages))}.server.tsx`
            );
            if (existsSync(file) === false) {
              continue;
            }
            read += 1;
            const view = published.find(({ pageId }) => pageId === page.id);
            const where = `${label} ${page.path}`;
            expect(view, where).toBeDefined();
            expect(view?.held, where).toEqual(
              new Set([
                ...findTreeInstanceIdsExcludingStaticHidden({
                  instances,
                  props,
                  rootInstanceId: page.rootInstanceId,
                }),
                ROOT_INSTANCE_ID,
              ])
            );
            const server = await readFile(file, "utf8");
            const section = (from: string, to: string) =>
              server.slice(server.indexOf(from), server.indexOf(to));
            const idsIn = (text: string, pattern: RegExp) =>
              new Set(
                [...text.matchAll(pattern)].map(
                  ([, id]) => JSON.parse(id) as string
                )
              );
            // a deprecated Webhook Form's action becomes a Resource after
            // the pause, and holds only literals
            const stored = new Set(
              (shipped.build.resources ?? []).map(([resourceId]) => resourceId)
            );
            const requests = new Set(
              [
                ...idsIn(
                  section(
                    "export const getResources",
                    "export const getManagedFormResourceGraph"
                  ),
                  /\{ id: ("(?:[^"\\]|\\.)*"), outputName:/g
                ),
              ].filter((resourceId) => stored.has(resourceId))
            );
            const sent = idsIn(
              section(
                "export const getManagedFormResourceGraph",
                "export const getPageMeta"
              ),
              /\{ id: ("(?:[^"\\]|\\.)*"), name:/g
            );
            expect(requests, where).toEqual(view?.inGraph);
            expect(
              new Set([...sent].filter((id) => requests.has(id) === false)),
              where
            ).toEqual(view?.submission);
            const meta = server.slice(
              server.indexOf("export const getPageMeta")
            );
            for (const field of [
              "title",
              "description",
              "language",
              "socialImageUrl",
              "redirect",
              "content",
            ] as const) {
              const stored = field === "title" ? page.title : page.meta[field];
              if (stored === undefined) {
                continue;
              }
              const written = meta.match(
                new RegExp(`\\n\\s*${field}: (.*),\\n`)
              )?.[1];
              expect(
                written === JSON.stringify(stored),
                `${where} ${field}`
              ).toBe(view?.text.has(field));
            }
          }
          expect(read, label).toBeGreaterThan(0);
        };

        const fixturesDir = new URL("../../../fixtures/", import.meta.url);
        for (const fixture of (
          await readdir(fixturesDir, { withFileTypes: true })
        ).filter((entry) => entry.isDirectory())) {
          await writeFile(
            ".webstudio/data.json",
            await readFile(
              new URL(`${fixture.name}/.webstudio/data.json`, fixturesDir),
              "utf8"
            )
          );
          await rm("app", { recursive: true, force: true });
          await generated();
          await expectParity(fixture.name);
        }

        const fragments: Array<[string, WebstudioFragment]> = [
          ...registryFragments(),
          ...Object.entries(blockTemplates).map(
            ([name, meta]): [string, WebstudioFragment] => [
              name,
              renderTemplate(meta.template),
            ]
          ),
        ];
        let pageId = 0;
        for (const template of SITE_TEMPLATES) {
          for (const page of renderSiteTemplate(template, {
            assetIds: new Map(
              Object.keys(template.images).map((file) => [file, file])
            ),
            generatePageId: () => `page-${pageId++}`,
          })) {
            fragments.push([`${template.id} ${page.key}`, page.fragment]);
          }
        }
        expect(fragments.map(([name]) => name)).toEqual(
          expect.arrayContaining(["form", "SignupForm"])
        );
        for (const [label, fragment] of fragments) {
          await writeSiteData(
            createSiteData({
              pages: [
                {
                  id: "home",
                  name: "Home",
                  title: "Home",
                  path: "",
                  rootInstanceId: "root",
                  meta: { description: "Welcome" },
                },
              ],
              instances: [
                box("root", fragment.children as never, "Body"),
                ...fragment.instances.map(
                  (instance) => [instance.id, instance] as never
                ),
              ],
              props: fragment.props.map((prop) => [prop.id, prop]),
              dataSources: fragment.dataSources.map((dataSource) => [
                dataSource.id,
                dataSource,
              ]),
              resources: fragment.resources.map((resource) => [
                resource.id,
                resource,
              ]),
            })
          );
          await rm("app", { recursive: true, force: true });
          await generated();
          await expectParity(label);
        }
      }, 300_000);

      test("publishes an expression that names undefined, NaN or Infinity past the check, and leaves out an action that reads NaN or Infinity", async () => {
        await writeSiteData(
          createSiteData({
            instances: [box("root", ids("box"), "Body"), box("box")],
            props: [
              expression("box", "title", "[undefined, NaN, -Infinity]"),
              [
                "box-onClick",
                {
                  id: "box-onClick",
                  instanceId: "box",
                  name: "onClick",
                  type: "action",
                  value: [
                    {
                      type: "execute",
                      args: [],
                      code: `${encodeDataSourceVariable("count")} = Infinity`,
                    },
                    {
                      type: "execute",
                      args: [],
                      code: `${encodeDataSourceVariable("count")} = NaN`,
                    },
                  ],
                },
              ],
            ],
            dataSources: [
              [
                "count",
                {
                  type: "variable",
                  id: "count",
                  name: "count",
                  scopeInstanceId: "root",
                  value: { type: "number", value: 0 },
                },
              ],
            ],
          })
        );
        const { page } = await generated();
        expect(page).toContain("title={");
        expect(page).not.toContain("onClick");
      });

      test("publishes a page built from each block template and each site template page past the check", async () => {
        const fragments: Array<[string, WebstudioFragment]> = [
          ...Object.entries(blockTemplates).map(
            ([name, meta]): [string, WebstudioFragment] => [
              name,
              renderTemplate(meta.template),
            ]
          ),
        ];
        let pageId = 0;
        for (const template of SITE_TEMPLATES) {
          for (const page of renderSiteTemplate(template, {
            assetIds: new Map(
              Object.keys(template.images).map((file) => [file, file])
            ),
            generatePageId: () => `page-${pageId++}`,
          })) {
            fragments.push([`${template.id} ${page.key}`, page.fragment]);
          }
        }
        expect(fragments.length).toBeGreaterThan(
          Object.keys(blockTemplates).length
        );
        const info = vi.spyOn(log, "info").mockImplementation(() => {});
        for (const [label, fragment] of fragments) {
          await writeSiteData(
            createSiteData({
              pages: [
                {
                  id: "home",
                  name: "Home",
                  title: '"Home"',
                  path: "",
                  rootInstanceId: "root",
                  meta: {},
                },
              ],
              instances: [
                box("root", fragment.children as never, "Body"),
                ...fragment.instances.map(
                  (instance) => [instance.id, instance] as never
                ),
              ],
              props: fragment.props.map((prop) => [prop.id, prop]),
              dataSources: fragment.dataSources.map((dataSource) => [
                dataSource.id,
                dataSource,
              ]),
              resources: fragment.resources.map((resource) => [
                resource.id,
                resource,
              ]),
            })
          );
          await rm("app", { recursive: true, force: true });
          await expect(generated(), label).resolves.toBeDefined();
          // and leaves nothing out
          expect(info.mock.calls.flat().join("\n"), label).not.toContain(
            "left out"
          );
        }
      }, 120_000);

      // A variable may share its name with an action's arg or with one of the
      // module's own names: none of them is an import
      test.each([
        ["Rotation Control", "value", blockTemplates.RotatingTabs.template],
        ["Signup Form", "state", blockTemplates.SignupForm.template],
        ["RSVP Form", "state", blockTemplates.RsvpForm.template],
        ["Webhook Form", "state", baseTemplates.WebhookForm.template],
        ["a page", "siteName", undefined],
        ["a page", "breakpoints", undefined],
        ["a page", "lastPublished", undefined],
        ["a page", "jsx", undefined],
        ["a page", "jsxs", undefined],
      ] as const)(
        "publishes %s beside a variable named %s past the check, leaving nothing out",
        async (_label, name, template) => {
          const fragment =
            template === undefined
              ? {
                  children: [],
                  instances: [],
                  props: [],
                  dataSources: [],
                  resources: [],
                }
              : // the base library's components, by name, as the builder's
                // registry renders its templates
                renderTemplate(template, undefined, [], {
                  componentIds: new Map(
                    Object.entries(baseComponents).map(([key, component]) => [
                      component,
                      key,
                    ])
                  ),
                });
          const info = vi.spyOn(log, "info").mockImplementation(() => {});
          await writeSiteData(
            createSiteData({
              pages: [
                {
                  id: "home",
                  name: "Home",
                  title: '"Home"',
                  path: "",
                  rootInstanceId: "root",
                  meta: { description: id("named") },
                },
              ],
              instances: [
                box(
                  "root",
                  [
                    ...(fragment.children as never[]),
                    ...ids("named-box", "other"),
                  ],
                  "Body"
                ),
                box("named-box"),
                box("other"),
                ...fragment.instances.map(
                  (instance) => [instance.id, instance] as never
                ),
              ],
              props: [
                ...fragment.props.map((prop): [string, unknown] => [
                  prop.id,
                  prop,
                ]),
                expression("named-box", "title", id("named")),
              ] as never,
              dataSources: [
                ...fragment.dataSources.map((dataSource): [string, unknown] => [
                  dataSource.id,
                  dataSource,
                ]),
                [
                  "named",
                  {
                    type: "variable",
                    id: "named",
                    name,
                    scopeInstanceId: "root",
                    value: { type: "string", value: "kept" },
                  },
                ],
              ] as never,
              resources: fragment.resources.map((resource) => [
                resource.id,
                resource,
              ]),
            })
          );
          await rm("app", { recursive: true, force: true });
          const { page } = await generated();
          expect(page).toContain(`let [${name}, set$${name}]`);
          expect(info.mock.calls.flat().join("\n")).not.toContain("left out");
        }
      );

      test("publishes a variable and a Collection item named like a module's exports, past the check", async () => {
        const info = vi.spyOn(log, "info").mockImplementation(() => {});
        await writeSiteData(
          createSiteData({
            pages: [
              {
                id: "home",
                name: "Home",
                title: id("email"),
                path: "",
                rootInstanceId: "root",
                meta: { description: id("meta") },
              },
            ],
            instances: [
              box("root", ids("items"), "Body"),
              box("items", ids("inside"), "ws:collection"),
              box("inside"),
            ],
            props: [
              expression("items", "data", '["a"]'),
              parameter("items", "item", "item-param"),
              expression("inside", "title", id("item-param")),
            ],
            dataSources: [
              [
                "email",
                {
                  type: "variable",
                  id: "email",
                  name: "contactEmail",
                  scopeInstanceId: "root",
                  value: { type: "string", value: "hi@example.org" },
                },
              ],
              [
                "meta",
                {
                  type: "variable",
                  id: "meta",
                  name: "getPageMeta",
                  scopeInstanceId: "root",
                  value: { type: "string", value: "kept" },
                },
              ],
              [
                "item-param",
                {
                  type: "parameter",
                  id: "item-param",
                  name: "siteName",
                  scopeInstanceId: "items",
                },
              ],
            ],
          })
        );
        await rm("app", { recursive: true, force: true });
        const { page, resources: server } = await generated();
        expect(page).toContain("siteName");
        expect(server).toContain("contactEmail");
        expect(info.mock.calls.flat().join("\n")).not.toContain("left out");
      });

      // Publishing reads one entry for each id, the last, as the builder does
      test("publishes no expression stored beside another entry with its id", async () => {
        await writeSiteData(
          createSiteData({
            instances: [
              box("root", ids("box"), "Body"),
              box("box"),
              box("orphan"),
            ],
            props: [
              expression("box", "title", '"x".constructor.name'),
              [
                "box-title",
                {
                  id: "box-title",
                  instanceId: "orphan",
                  name: "title",
                  type: "string",
                  value: "kept",
                },
              ],
            ],
          })
        );
        const { page } = await generated();
        expect(page).not.toContain("constructor");
        expect(await renderPage(page)).not.toContain('title="String"');
      });

      // A Collection holds one item and one key at most
      test("leaves out a Collection's items when it holds two, and what reads one", async () => {
        await writeSiteData(
          createSiteData({
            instances: [
              box("root", ids("items"), "Body"),
              box("items", ids("inside"), "ws:collection"),
              box("inside"),
            ],
            props: [
              expression("items", "data", '[{"x": "item value"}]'),
              [
                "items-item-1",
                {
                  ...parameter("items", "item", "row-item")[1],
                  id: "items-item-1",
                },
              ],
              [
                "items-item-2",
                {
                  ...parameter("items", "item", "plain-item")[1],
                  id: "items-item-2",
                },
              ],
              expression("inside", "title", `${item}.x`),
            ],
            dataSources: [
              [
                "row-item",
                {
                  type: "parameter",
                  id: "row-item",
                  name: "row",
                  scopeInstanceId: "items",
                },
              ],
              [
                "plain-item",
                {
                  type: "parameter",
                  id: "plain-item",
                  name: "item",
                  scopeInstanceId: "items",
                },
              ],
            ],
          })
        );
        const { page } = await generated();
        expect(await undeclaredIn(page)).toEqual([]);
        await renderPage(page);
      });

      // A Collection's item and key may only be parameters of its own that
      // nothing around it binds
      test.each([
        [
          "one parameter for its item and its key",
          "items-param",
          "items-param",
        ],
        ["a variable for its item", "state-var", undefined],
        ["an outer Collection's item for its item", "outer-param", undefined],
      ])(
        "publishes a Collection that binds %s, leaving it out",
        async (_label, itemId, keyId) => {
          await writeSiteData(
            createSiteData({
              instances: [
                box("root", ids("outer"), "Body"),
                box("outer", ids("items"), "ws:collection"),
                box("items", ids("inside"), "ws:collection"),
                box("inside", [
                  { type: "expression", value: '"listed entry"' },
                ]),
              ],
              props: [
                expression("outer", "data", "[[1]]"),
                parameter("outer", "item", "outer-param"),
                expression("items", "data", "[1]"),
                parameter("items", "item", itemId),
                ...(keyId === undefined
                  ? []
                  : [parameter("items", "itemKey", keyId)]),
              ],
              dataSources: [
                [
                  "outer-param",
                  {
                    type: "parameter",
                    id: "outer-param",
                    name: "row",
                    scopeInstanceId: "outer",
                  },
                ],
                [
                  "items-param",
                  {
                    type: "parameter",
                    id: "items-param",
                    name: "entry",
                    scopeInstanceId: "items",
                  },
                ],
                [
                  "state-var",
                  {
                    type: "variable",
                    id: "state-var",
                    name: "state",
                    scopeInstanceId: "root",
                    value: { type: "string", value: "idle" },
                  },
                ],
              ],
            })
          );
          const { page } = await generated();
          expect(await undeclaredIn(page)).toEqual([]);
          expect(await renderPage(page)).not.toContain("listed entry");
        }
      );

      // A data source whose id is another of the page module's names goes
      // (collidingDataSourceIds), and what read it reads nothing
      test("leaves out a data source whose id is another of the module's names, and what reads it reads nothing", async () => {
        await writeSiteData(
          createSiteData({
            instances: [
              box("root", ids("loader", "inline"), "Body"),
              box("loader"),
              box("inline", [{ type: "expression", value: `"x"` }]),
            ],
            props: [
              expression("root", "title", id("Box")),
              [
                "loader-src",
                {
                  id: "loader-src",
                  instanceId: "loader",
                  name: "src",
                  type: "string",
                  value: "https://example.org/x.js",
                },
              ],
            ],
            dataSources: [
              [
                "Box",
                {
                  type: "variable",
                  id: "Box",
                  name: "tag",
                  scopeInstanceId: "root",
                  value: { type: "string", value: "script" },
                },
              ],
            ],
          })
        );
        const { page } = await generated();
        expect(await undeclaredIn(page)).toEqual([]);
        expect(page).not.toMatch(/let \[Box\b/);
        expect(await renderPage(page)).not.toContain("<script");
      });

      // The page holds what is scoped to its root, present or not, and
      // everything under it, an instance with the id `:root` included
      test("holds what prebuild holds: a missing root, a :root root and a :root instance below the root", async () => {
        const rowParam = (
          scopeInstanceId: string
        ): [string, Record<string, unknown>] => [
          "row-param",
          {
            type: "parameter",
            id: "row-param",
            name: "row",
            scopeInstanceId,
          },
        ];
        const named = id("row-param");
        // a missing root
        await writeSiteData(
          createSiteData({
            pages: [
              {
                id: "home",
                name: "Home",
                title: `${named}.x`,
                path: "",
                rootInstanceId: "ghost",
                meta: {},
              },
            ],
            instances: [box("root", [], "Body")],
            dataSources: [rowParam("ghost"), resourceBinding("ghosted")],
            resources: [resource("ghosted", { url: refused("ghost_url") })],
          })
        );
        let modules = await generated();
        expect(await undeclaredIn(modules.page)).toEqual([]);
        expect(await undeclaredIn(modules.resources)).toEqual([]);
        await runServer(modules.resources);
        // the root is :root, then a :root instance below the root
        for (const tree of [
          [box(":root", ids("box"), "Body")],
          [box("root", ids(":root"), "Body"), box(":root", ids("box"))],
        ]) {
          await rm("app", { recursive: true, force: true });
          await writeSiteData(
            createSiteData({
              pages: [
                {
                  id: "home",
                  name: "Home",
                  title: '"Home"',
                  path: "",
                  rootInstanceId: tree[0][0],
                  meta: {},
                },
              ],
              instances: [...tree, box("box")],
              props: [expression("box", "title", `${named}.x`)],
              dataSources: [rowParam("box")],
            })
          );
          modules = await generated();
          expect(await undeclaredIn(modules.page)).toEqual([]);
          await renderPage(modules.page);
        }
      });

      test("leaves out a data source or a resource prop that names a Resource the build does not hold", async () => {
        await writeSiteData(
          createSiteData({
            instances: [
              box("root", ids("form"), "Body"),
              box("form", [], "Form"),
            ],
            props: [
              [
                "form-action",
                {
                  id: "form-action",
                  instanceId: "form",
                  name: "action",
                  type: "resource",
                  value: "gone",
                },
              ],
            ],
            dataSources: [
              [
                "dangling-ds",
                {
                  type: "resource",
                  id: "dangling-ds",
                  name: "row",
                  scopeInstanceId: "root",
                  resourceId: "missing",
                },
              ],
            ],
          })
        );
        const { page, resources: server } = await generated();
        expect(await undeclaredIn(page)).toEqual([]);
        expect(await undeclaredIn(server)).toEqual([]);
        const { resources } = await runServer(server);
        expect([...resources.data.keys(), ...resources.action.keys()]).toEqual(
          []
        );
      });

      // A Resource named like a global a module reads goes, whether or not an
      // expression on the page reads it
      test("publishes a Resource named like a global a module reads, leaving it out", async () => {
        await writeSiteData(
          createSiteData({
            instances: [box("root", ids("box"), "Body"), box("box")],
            dataSources: [resourceBinding("global", "items")],
            resources: [resource("global", { name: "Map" })],
          })
        );
        const { page, resources: server } = await generated();
        expect(await undeclaredIn(page)).toEqual([]);
        expect(await undeclaredIn(server)).toEqual([]);
        const { resources } = await runServer(server);
        expect([...resources.data.keys(), ...resources.action.keys()]).toEqual(
          []
        );
      });

      // An action is judged against the data sources that ship
      test("leaves out an action that names a data source publishing leaves out", async () => {
        const stored = id("stored");
        await writeSiteData(
          createSiteData({
            instances: [
              box("root", ids("button"), "Body"),
              [
                "button",
                {
                  id: "button",
                  component: elementComponent,
                  tag: "button",
                  children: [],
                },
              ],
            ] as never,
            props: [
              [
                "button-onClick",
                {
                  id: "button-onClick",
                  instanceId: "button",
                  name: "onClick",
                  type: "action",
                  value: [
                    {
                      type: "execute",
                      args: [],
                      code: `${stored} = ${id("leak-ds")}`,
                    },
                  ],
                },
              ],
            ],
            dataSources: [
              [
                "stored",
                {
                  type: "variable",
                  id: "stored",
                  name: "stored",
                  scopeInstanceId: "root",
                  value: { type: "string", value: "" },
                },
              ],
              resourceBinding("leak"),
            ],
            resources: [
              resource("leak", { url: '"https://example.org/" + /x/.source' }),
            ],
          })
        );
        const { page } = await generated();
        expect(await undeclaredIn(page)).toEqual([]);
        expect(page).not.toContain("onClick=");
      });

      // An expression names only what the module declares where it is
      // written
      const entry = id("entry-item");
      const freeNameSites = {
        "an expression naming a Collection's item outside it": {
          name: "entry",
          data: { props: [expression("box", "title", `${entry}.x`)] },
        },
        "a Collection's own data naming its item": {
          name: "entry",
          // with no data the Collection writes nothing
          renders: false,
          data: { props: [expression("items", "data", `[${entry}]`)] },
        },
        "a Collection's own ws:show naming its item": {
          name: "entry",
          data: {
            props: [expression("items", "data-ws-show", `${entry} === 1`)],
          },
        },
        "a page setting naming a Collection's item": {
          name: "entry",
          data: { pageMeta: { description: `${entry}.x` } },
        },
        "a Resource's url naming a Collection's item": {
          name: "entry",
          data: {
            resources: [
              resource("source", { url: `"https://example.org/" + ${entry}` }),
            ],
          },
        },
        "a Resource's header naming a Collection's item": {
          name: "entry",
          data: {
            resources: [
              resource("source", {
                headers: [{ name: "x", value: `${entry}.x` }],
              }),
            ],
          },
        },
        "a Resource's body naming a Collection's item": {
          name: "entry",
          data: {
            resources: [
              resource("source", { method: "post", body: `${entry}.x` }),
            ],
          },
        },
        "a Resource's email subject naming a Collection's item": {
          name: "entry",
          data: {
            resources: [
              resource("source", {
                control: "email",
                email: { subject: `"New: " + ${entry}` },
              }),
            ],
          },
        },
      } as const;
      const freeNameSiteData = ({
        props = [],
        resources = [],
        pageMeta = {},
      }: {
        props?: readonly (readonly [string, Record<string, unknown>])[];
        resources?: readonly (readonly [string, Record<string, unknown>])[];
        pageMeta?: Record<string, unknown>;
      }) => ({
        pages: [
          {
            id: "home",
            name: "Home",
            title: '"Home"',
            path: "",
            rootInstanceId: "root",
            meta: pageMeta,
          },
        ],
        instances: [
          box("root", ids("box", "items"), "Body"),
          box("box"),
          box("items", ids("inside"), "ws:collection"),
          box("inside"),
        ],
        props: [
          ...(props.some(
            ([, prop]) => prop.instanceId === "items" && prop.name === "data"
          )
            ? []
            : [expression("items", "data", "[1]")]),
          parameter("items", "item", "entry-item"),
          expression("inside", "title", `${entry}.x`),
          ...props,
        ],
        dataSources: [
          [
            "entry-item",
            {
              type: "parameter",
              id: "entry-item",
              name: "entry",
              scopeInstanceId: "items",
            },
          ],
          resourceBinding("loaded"),
          ...(resources.length === 0 ? [] : [resourceBinding("source")]),
        ],
        resources: [resource("loaded"), ...resources],
      });

      test.each(Object.keys(freeNameSites))(
        "leaves out %s, so the module reads no name it does not declare",
        async (label) => {
          const site: { data: object; renders?: boolean } =
            freeNameSites[label as keyof typeof freeNameSites];
          await writeSiteData(
            createSiteData(freeNameSiteData(site.data) as never)
          );
          const { page, resources: server } = await generated();
          expect(await undeclaredIn(page)).toEqual([]);
          expect(await undeclaredIn(server)).toEqual([]);
          // the item is still read inside its Collection
          if (site.renders !== false) {
            expect(page).toContain("title={entry?.x}");
          }
        }
      );

      // Whatever the pause's rules leave in place, a module that reads a
      // name it does not declare, or shadows one, does not ship
      test.each([
        {
          label: "a Collection with two items",
          error: "reads names it does not declare: row",
          data: {
            instances: [
              box("root", ids("items"), "Body"),
              box("items", ids("inside"), "ws:collection"),
              box("inside"),
            ],
            props: [
              expression("items", "data", "[1]"),
              [
                "items-item-1",
                {
                  ...parameter("items", "item", "row-item")[1],
                  id: "items-item-1",
                },
              ],
              [
                "items-item-2",
                {
                  ...parameter("items", "item", "plain-item")[1],
                  id: "items-item-2",
                },
              ],
              expression("inside", "title", `${item}.x`),
            ],
            dataSources: [
              [
                "row-item",
                {
                  type: "parameter",
                  id: "row-item",
                  name: "row",
                  scopeInstanceId: "items",
                },
              ],
              [
                "plain-item",
                {
                  type: "parameter",
                  id: "plain-item",
                  name: "item",
                  scopeInstanceId: "items",
                },
              ],
            ],
          },
        },
        {
          label: "a data source with a component's id",
          error: "shadows names: Box",
          data: {
            instances: [box("root", ids("box"), "Body"), box("box")],
            props: [expression("box", "title", id("Box"))],
            dataSources: [
              [
                "Box",
                {
                  type: "variable",
                  id: "Box",
                  name: "tag",
                  scopeInstanceId: "root",
                  value: { type: "string", value: "" },
                },
              ],
            ],
          },
        },
        {
          label: "a shadowed import named in text",
          error: "shadows names: Box",
          data: {
            instances: [
              box("root", ids("box", "text"), "Body"),
              box("box"),
              box("text", [{ type: "expression", value: '"Box2 Box_12"' }]),
            ],
            props: [expression("box", "title", id("Box"))],
            dataSources: [
              [
                "Box",
                {
                  type: "variable",
                  id: "Box",
                  name: "tag",
                  scopeInstanceId: "root",
                  value: { type: "string", value: "" },
                },
              ],
            ],
          },
        },
        {
          label: "a page whose root is missing",
          error: "reads names it does not declare: row",
          data: {
            pages: [
              {
                id: "home",
                name: "Home",
                title: `${id("row-param")}.x`,
                path: "",
                rootInstanceId: "ghost",
                meta: {},
              },
            ],
            instances: [box("root", [], "Body")],
            dataSources: [
              [
                "row-param",
                {
                  type: "parameter",
                  id: "row-param",
                  name: "row",
                  scopeInstanceId: "ghost",
                },
              ],
            ],
          },
        },
        {
          label: "a data source scoped below an instance with the root's id",
          error: "reads names it does not declare: row",
          data: {
            instances: [
              box("root", ids(":root"), "Body"),
              box(":root", ids("box")),
              box("box"),
            ],
            props: [expression("box", "title", `${id("row-param")}.x`)],
            dataSources: [
              [
                "row-param",
                {
                  type: "parameter",
                  id: "row-param",
                  name: "row",
                  scopeInstanceId: "box",
                },
              ],
            ],
          },
        },
        {
          // input validation refuses it before the module is generated
          label: "an action that names a data source that does not ship",
          error:
            'The property "onClick" of instance "box" cannot be published: Unknown variable.',
          drop: (bundle: Parameters<typeof dropOrgScript>[0]) => ({
            ...bundle,
            build: {
              ...bundle.build,
              resources: [],
              dataSources: bundle.build.dataSources.filter(
                ([dataSourceId]) => dataSourceId !== "leak-ds"
              ),
            },
          }),
          data: {
            instances: [box("root", ids("box"), "Body"), box("box")],
            props: [
              [
                "box-onClick",
                {
                  id: "box-onClick",
                  instanceId: "box",
                  name: "onClick",
                  type: "action",
                  value: [
                    {
                      type: "execute",
                      args: [],
                      code: `${id("stored")} = ${id("leak-ds")}`,
                    },
                  ],
                },
              ],
            ],
            dataSources: [
              [
                "stored",
                {
                  type: "variable",
                  id: "stored",
                  name: "stored",
                  scopeInstanceId: "root",
                  value: { type: "string", value: "" },
                },
              ],
              resourceBinding("leak"),
            ],
            resources: [resource("leak")],
          },
        },
        {
          label: "a component the page does not import",
          error: "reads names it does not declare: Script",
          data: {
            instances: [
              box("root", ids("script"), "Body"),
              box("script", [], "x:Script"),
            ],
          },
        },
        {
          label: "an action that sets a Resource",
          error: "reads names it does not declare: set$set",
          data: {
            instances: [box("root", ids("box"), "Body"), box("box")],
            props: [
              [
                "box-onClick",
                {
                  id: "box-onClick",
                  instanceId: "box",
                  name: "onClick",
                  type: "action",
                  value: [
                    {
                      type: "execute",
                      args: [],
                      code: `${id("set-ds")} = 1`,
                    },
                  ],
                },
              ],
            ],
            dataSources: [resourceBinding("set")],
            resources: [resource("set")],
          },
        },
        ...Object.entries(freeNameSites).map(([label, site]) => ({
          label,
          error: `reads names it does not declare: ${site.name}`,
          data: freeNameSiteData(site.data),
          drop: undefined,
        })),
      ])(
        "fails the publish of a module with $label, without the pause's rules",
        async ({ data, drop, error }) => {
          vi.mocked(dropOrgScript).mockImplementationOnce(
            drop ?? ((bundle) => bundle)
          );
          await writeSiteData(createSiteData(data as never));
          await expect(generated()).rejects.toThrow(error);
        }
      );

      // An expression holds no `<` or `<<` followed later by a token that
      // starts with `>` (holdsAngleBrackets)
      test("leaves out a page setting and a Resource that hold a < followed later by a >", async () => {
        await writeSiteData(
          createSiteData({
            pages: [
              {
                id: "home",
                name: "Home",
                title: '$ws$system < 1 >\n["x"]',
                path: "",
                rootInstanceId: "root",
                meta: { description: "$ws$system < $ws$system >\n$ws$system" },
              },
            ],
            instances: [box("root", [], "Body")],
            dataSources: [resourceBinding("typed")],
            resources: [
              resource("typed", {
                url: '$ws$system < 1 >\n["a"] < 1 >\n["b"]',
              }),
            ],
          })
        );
        const { resources: server } = await generated();
        expect(server).not.toMatch(/< 1 >|< system/);
        expect(await undeclaredIn(server)).toEqual([]);
        const { resources, meta } = await runServer(server);
        expect(meta).toMatchObject({ title: "" });
        expect((meta as { description?: unknown }).description).toBeUndefined();
        expect([...resources.data.keys()]).toEqual([]);
      });

      // replaceFormActionsWithResources (prebuild.ts) makes a Resource of a
      // Form's static action after the pause has run, so that Resource is
      // never checked: it holds JSON literals only
      test("a Form's action becomes a Resource whose every part is a literal", async () => {
        const action = 'https://hooks.example/x"}, "marker_form", {"';
        const props = new Map<string, Prop>([
          [
            "form-method",
            {
              id: "form-method",
              instanceId: "form",
              name: "method",
              type: "string",
              value: "post",
            },
          ],
          [
            "form-action",
            {
              id: "form-action",
              instanceId: "form",
              name: "action",
              type: "string",
              value: action,
            },
          ],
        ]);
        const synthesized = new Map<string, Resource>();
        replaceFormActionsWithResources({
          // it rewrites the map it is given
          props: new Map(props),
          instances: new Map([
            [
              "form",
              {
                type: "instance",
                id: "form",
                component: "WebhookForm",
                children: [],
              },
            ],
          ]),
          resources: synthesized,
        });
        const fields = [...synthesized.values()].flatMap((request) => [
          request.url,
          ...(request.searchParams ?? []).map(({ value }) => value),
          ...request.headers.map(({ value }) => value),
          ...(request.body === undefined ? [] : [request.body]),
        ]);
        expect(fields.length).toBeGreaterThan(0);
        for (const field of fields) {
          expect(typeof JSON.parse(field), field).toBe("string");
        }

        await writeSiteData(
          createSiteData({
            instances: [
              box("root", ids("form"), "Body"),
              box("form", [], "Form"),
            ],
            props: [...props],
          })
        );
        const { page, resources: server } = await generated();

        expect(await undeclaredIn(page)).toEqual([]);
        expect(await undeclaredIn(server)).toEqual([]);
        const { resources } = await runServer(server);
        expect(
          [...resources.action.values()].map((request) => request.url)
        ).toEqual([action]);
      });

      // the registry's templates, rendered as the builder renders them
      const registryFragments = () => {
        const componentIds = new Map<object, string>();
        const componentMetas = new Map<string, WsComponentMeta>();
        for (const library of canvasComponentLibraries) {
          const prefix =
            "namespace" in library && library.namespace !== undefined
              ? `${library.namespace}:`
              : "";
          for (const [name, meta] of Object.entries(library.metas)) {
            componentMetas.set(`${prefix}${name}`, meta as WsComponentMeta);
          }
          for (const [component, componentId] of library.componentIds ?? []) {
            componentIds.set(component as object, componentId);
          }
          for (const [name, component] of Object.entries(library.components)) {
            componentIds.set(component as object, `${prefix}${name}`);
          }
        }
        return new Map(
          canvasComponentLibraries.flatMap((library) =>
            Object.entries(library.templates).map(
              ([name, meta]): [string, WebstudioFragment] => [
                name,
                renderTemplate(
                  (meta as { template: JSX.Element }).template,
                  undefined,
                  [],
                  { componentIds, componentMetas }
                ),
              ]
            )
          )
        );
      };
      const siteOf = (fragment: WebstudioFragment) =>
        createSiteData({
          instances: [
            box("root", fragment.children as never, "Body"),
            ...fragment.instances.map(
              (instance) => [instance.id, instance] as never
            ),
          ],
          props: fragment.props.map((prop) => [prop.id, prop]),
          dataSources: fragment.dataSources.map((dataSource) => [
            dataSource.id,
            dataSource,
          ]),
          resources: fragment.resources.map((resource) => [
            resource.id,
            resource,
          ]),
        });
      // a form's submission graph, by the form's id
      const formCase = (server: string, formId: string) =>
        server.slice(
          server.indexOf(`case ${JSON.stringify(formId)}:`),
          server.indexOf("export const getPageMeta")
        );

      test("publishes the Form (Beta) template, its email included, leaving nothing out", async () => {
        const fragment = registryFragments().get("form") as WebstudioFragment;
        const form = fragment.instances.find(
          (instance) => instance.component === "ResourceForm"
        );
        expect(form).toBeDefined();
        expect(
          fragment.resources.some((resource) => resource.control === "email")
        ).toBe(true);
        const info = vi.spyOn(log, "info").mockImplementation(() => {});
        await writeSiteData(siteOf(fragment));
        const { page, resources: server } = await generated();

        // its result action alone, which reads members of what it gets
        expect(info).toHaveBeenCalledWith(
          "Org script is paused until OrganizeOS sites move to their own domain: left out 1 unsafe action."
        );
        expect(await undeclaredIn(page)).toEqual([]);
        expect(await undeclaredIn(server)).toEqual([]);
        const submission = formCase(server, form?.id ?? "");
        expect(submission).toContain("resources: [");
        expect(submission).toContain("subject: ");
        expect(submission).not.toMatch(/^case [^\n]*: return undefined;/);
      });

      // A Resource Form's own form data is unset across the page that writes
      // the form; an XML page writes no form
      test("reads nothing from a Resource Form's form data outside the form, and leaves it out on an XML page", async () => {
        const fragment = registryFragments().get("form") as WebstudioFragment;
        const formData = fragment.dataSources.find(
          (dataSource) => dataSource.name === "formData"
        );
        expect(formData).toBeDefined();
        const outside = expression(
          "outside",
          "title",
          `"Sent: " + ${id(formData?.id ?? "")}.email`
        );
        const site = siteOf(fragment);
        await writeSiteData({
          ...site,
          build: {
            ...site.build,
            instances: [
              ...site.build.instances.map(([instanceId, instance]) =>
                instanceId === "root"
                  ? [
                      instanceId,
                      {
                        ...(instance as Instance),
                        children: [
                          ...(instance as Instance).children,
                          { type: "id", value: "outside" },
                        ],
                      },
                    ]
                  : [instanceId, instance]
              ),
              [
                "outside",
                {
                  type: "instance",
                  id: "outside",
                  component: "Box",
                  children: [],
                },
              ],
            ],
            props: [...site.build.props, outside],
          },
        } as never);
        const { page } = await generated();
        expect(page).toContain("title={");
        expect(await undeclaredIn(page)).toEqual([]);
        expect(await renderPage(page)).toContain('title="Sent: undefined"');

        // on an XML page
        const info = vi.spyOn(log, "info").mockImplementation(() => {});
        await writeSiteData(
          createSiteData({
            pages: [
              {
                id: "home",
                name: "Home",
                title: '"Feed"',
                path: "",
                rootInstanceId: "root",
                meta: { documentType: "xml" },
              },
            ],
            instances: [
              box("root", ids("node", "form"), "Body"),
              ["node", { id: "node", component: "XmlNode", children: [] }],
              ["form", { id: "form", component: "ResourceForm", children: [] }],
            ],
            props: [
              expression("node", "tag", '"item"'),
              expression("node", "title", `${id("form-data")}.email`),
            ],
            dataSources: [
              [
                "form-data",
                {
                  type: "parameter",
                  id: "form-data",
                  name: "formData",
                  scopeInstanceId: "form",
                },
              ],
            ],
          })
        );
        await rm("app", { recursive: true, force: true });
        const xml = await generated();
        expect(xml.page).not.toContain("email");
        expect(await undeclaredIn(xml.page)).toEqual([]);
        expect(info.mock.calls.flat().join("\n")).toContain("left out");
      });

      test.each([
        "subject",
        "body",
        "senderExpression",
        "recipientsExpression",
      ] as const)(
        "leaves out an email Resource whose %s may not run, loaded with the page or sent by a form, whose submission then fails closed",
        async (field) => {
          const fragment = registryFragments().get("form") as WebstudioFragment;
          const form = fragment.instances.find(
            (instance) => instance.component === "ResourceForm"
          );
          const refusedField = '"a" + (0 < 1 > "marker_email")';
          const withField = (
            resource: WebstudioFragment["resources"][number]
          ) =>
            resource.control === "email"
              ? {
                  ...resource,
                  email: { ...resource.email, [field]: refusedField },
                }
              : resource;
          // sent by the form
          const info = vi.spyOn(log, "info").mockImplementation(() => {});
          await writeSiteData(
            siteOf({
              ...fragment,
              resources: fragment.resources.map(withField),
            })
          );
          const { page, resources: server } = await generated();
          expect(server).not.toContain("marker_email");
          expect(info).toHaveBeenCalledWith(
            // the form's two emails, and its result action
            "Org script is paused until OrganizeOS sites move to their own domain: left out 1 unsafe action and 2 Resources."
          );
          expect(await undeclaredIn(page)).toEqual([]);
          expect(await undeclaredIn(server)).toEqual([]);
          expect(server).toContain(
            `case ${JSON.stringify(form?.id)}: return undefined;`
          );

          // loaded with the page
          info.mockClear();
          await writeSiteData(
            createSiteData({
              instances: [box("root", [], "Body")],
              dataSources: [resourceBinding("mail")],
              resources: [
                resource("mail", {
                  method: "post",
                  control: "email",
                  email: { recipientMode: "project", [field]: refusedField },
                }),
              ],
            })
          );
          await rm("app", { recursive: true, force: true });
          const loaded = await generated();
          expect(loaded.resources).not.toContain("marker_email");
          expect(info).toHaveBeenCalledWith(
            "Org script is paused until OrganizeOS sites move to their own domain: left out 1 Resource."
          );
          expect(await undeclaredIn(loaded.resources)).toEqual([]);
        }
      );

      test.each([
        "String",
        "Error",
        "_data",
        "_action",
        "_contentData",
        "_contentDocuments",
        "documents",
      ])(
        "leaves out a variable and a Resource named %s, and what names them",
        async (name) => {
          const info = vi.spyOn(log, "info").mockImplementation(() => {});
          await writeSiteData(
            createSiteData({
              instances: [box("root", ids("box"), "Body"), box("box")],
              props: [
                expression("box", "title", `${id("named")}`),
                expression("box", "data-loaded", `${id("loaded-ds")}.x`),
              ],
              dataSources: [
                [
                  "named",
                  {
                    type: "variable",
                    id: "named",
                    name,
                    scopeInstanceId: "root",
                    value: { type: "string", value: "" },
                  },
                ],
                resourceBinding("loaded"),
              ],
              resources: [resource("loaded", { name })],
            })
          );
          const { page, resources: server } = await generated();
          expect(page).not.toContain("title={");
          expect(page).not.toContain("data-loaded");
          expect(await undeclaredIn(page)).toEqual([]);
          expect(await undeclaredIn(server)).toEqual([]);
          expect(info.mock.calls.flat().join("\n")).toMatch(/1 Resource/);
        }
      );

      test("writes no copy of a refused expression on a prop typed as text", async () => {
        await writeSiteData(
          createSiteData({
            instances: [
              box("root", ids("refused", "kept"), "Body"),
              ["refused", { id: "refused", component: "Image", children: [] }],
              ["kept", { id: "kept", component: "Image", children: [] }],
            ],
            props: [
              expression("refused", "alt", '"marker_alt" + (0 < 1 > 2)'),
              expression("kept", "alt", '"kept"'),
            ],
          })
        );
        const { page } = await generated();
        expect(page).not.toContain("marker_alt");
        // a prop the meta types as text keeps the value that may run
        expect(page).toContain(
          'alt={"kept" == null ? "kept" : String("kept")}'
        );
      });

      test("publishes a bare-word title as text, and leaves out one input validation refuses", async () => {
        const titleOf = async (title: string) => {
          await writeSiteData(
            createSiteData({
              pages: [
                {
                  id: "home",
                  name: "Home",
                  title,
                  path: "",
                  rootInstanceId: "root",
                  meta: {},
                },
              ],
              instances: [box("root", [], "Body")],
            })
          );
          await rm("app", { recursive: true, force: true });
          const { resources: server } = await generated();
          return (await runServer(server)).meta as { title: unknown };
        };
        expect((await titleOf("Hello")).title).toBe("Hello");
        expect((await titleOf("Hello2")).title).toBe("");
      });

      test("drops uncounted what a statically hidden subtree holds that input validation refuses, and the build passes it", async () => {
        const info = vi.spyOn(log, "info").mockImplementation(() => {});
        await writeSiteData(
          createSiteData({
            instances: [
              box("root", ids("hidden"), "Body"),
              box("hidden", ids("inside")),
              box("inside", [
                { type: "expression", value: '"marker_child".constructor' },
              ]),
            ],
            props: [
              [
                "hidden-show",
                {
                  id: "hidden-show",
                  instanceId: "hidden",
                  name: "data-ws-show",
                  type: "boolean",
                  value: false,
                },
              ],
              expression("inside", "title", '"marker_prop".constructor'),
              // the pause's rule refuses it, input validation passes it, and
              // it never ships
              expression("inside", "data-x", '"marker_kept" + (0 < 1 > 2)'),
            ],
          })
        );
        const { page } = await generated();
        expect(page).not.toContain("marker_");
        expect(info.mock.calls.flat().join("\n")).not.toContain("left out");
      });

      // D7: while org script is paused publishing refuses a build that would
      // materialize MDX, so a Content Block it lets through publishes no
      // content of its own: none of what the block's source or document
      // would write
      test("publishes no Content Block content from a build it lets through", async () => {
        const block = (props: Array<[string, Record<string, unknown>]>) =>
          createSiteData({
            instances: [
              box("root", ids("block"), "Body"),
              ["block", { id: "block", component: "ws:block", children: [] }],
            ],
            props,
          });
        await writeSiteData(block([]));
        const { page, resources: server } = await generated();
        expect(page).not.toContain("frontmatter");
        expect(page).not.toContain("contentSource");
        expect(server).not.toContain("_contentDocuments");
        expect(await undeclaredIn(page)).toEqual([]);

        // a source that is not MDX publishes nothing
        await writeSiteData({
          assetIndex: await createTestAssetIndex([]),
          ...block([
            [
              "block-src",
              {
                id: "block-src",
                instanceId: "block",
                name: "src",
                type: "asset",
                value: "asset-image",
              },
            ],
          ]),
        } as ReturnType<typeof createSiteData>);
        await rm("app", { recursive: true, force: true });
        await expect(generated()).rejects.toThrow(
          'requires unavailable MDX Asset "asset-image"'
        );
      });

      // While org script is paused an action names its args only where its
      // component passes plain data, so no event reaches a variable, and an
      // expression that reads a host object through one reads nothing
      // (docs/ORGANIZEOS-FORK.md section 10, Actions)
      test("drops an action that stores its event, so an expression that reads one reads nothing", async () => {
        const stored = id("stored");
        await writeSiteData(
          createSiteData({
            instances: [
              box("root", ids("button", "image"), "Body"),
              [
                "button",
                {
                  id: "button",
                  component: elementComponent,
                  tag: "button",
                  children: [],
                },
              ],
              [
                "image",
                {
                  id: "image",
                  component: elementComponent,
                  tag: "img",
                  children: [],
                },
              ],
            ] as never,
            dataSources: [
              [
                "stored",
                {
                  type: "variable",
                  id: "stored",
                  name: "stored",
                  scopeInstanceId: "root",
                  value: { type: "string", value: "" },
                },
              ],
            ],
            props: [
              [
                "button-onClick",
                {
                  id: "button-onClick",
                  instanceId: "button",
                  name: "onClick",
                  type: "action",
                  value: [
                    {
                      type: "execute",
                      args: ["event"],
                      code: `${stored} = event`,
                    },
                  ],
                },
              ],
              expression(
                "image",
                "src",
                `"https://example.org/c?" + ${stored}.view.name`
              ),
            ],
          })
        );
        const { page } = await generated();

        expect(page).not.toContain("onClick=");
        expect(page).not.toMatch(/= event\b/);
        expect(await undeclaredIn(page)).toEqual([]);
      });
    });

    // T12, for the props that choose or fill an element
    describe("props that choose an element or fill it with markup", () => {
      const jsonProp = (
        id: string,
        instanceId: string,
        name: string,
        value: unknown
      ): [string, Record<string, unknown>] => [
        id,
        { id, instanceId, name, type: "json", value },
      ];
      const stringProp = (
        id: string,
        instanceId: string,
        name: string,
        value: string
      ): [string, Record<string, unknown>] => [
        id,
        { id, instanceId, name, type: "string", value },
      ];
      const expressionProp = (
        id: string,
        instanceId: string,
        name: string,
        value: string
      ): [string, Record<string, unknown>] => [
        id,
        { id, instanceId, name, type: "expression", value },
      ];
      const children = (...ids: string[]) =>
        ids.map((value) => ({ type: "id" as const, value }));

      /** The home page the site ships, rendered with the real Box, Text and Heading. */
      const renderHome = async () => {
        const { page } = await generated();
        const exports = await runModule(page, {
          react: React,
          "react/jsx-runtime": jsxRuntime,
          "@webstudio-is/react-sdk/runtime":
            await import("@webstudio-is/react-sdk/runtime"),
          "@webstudio-is/sdk-components-react/components":
            await import("@webstudio-is/sdk-components-react/components"),
          "@webstudio-is/sdk-components-react-router": {
            Body: (props: Record<string, unknown>) =>
              React.createElement("body", props),
          },
        });
        const Page = exports.Page as ComponentType<Record<string, unknown>>;
        return {
          page,
          html: renderToStaticMarkup(
            React.createElement(Page, {
              system: { params: {}, search: {}, origin: "https://x" },
            })
          ),
        };
      };

      test("a Box, Text and Heading with a data-ws-tag prop of script ship no script element", async () => {
        await writeSiteData(
          createSiteData({
            instances: [
              [
                "root",
                {
                  id: "root",
                  component: "Body",
                  children: children("box", "text", "heading", "kept"),
                },
              ],
              ["box", { id: "box", component: "Box", children: [] }],
              [
                "text",
                {
                  id: "text",
                  component: "Text",
                  children: [
                    { type: "text", value: "alert(document.cookie)" } as never,
                  ],
                },
              ],
              [
                "heading",
                { id: "heading", component: "Heading", children: [] },
              ],
              ["kept", { id: "kept", component: "Box", children: [] }],
            ],
            props: [
              stringProp("box-tag", "box", "data-ws-tag", "script"),
              stringProp("box-src", "box", "src", "https://evil.example/x.js"),
              stringProp("text-tag", "text", "data-ws-tag", "script"),
              expressionProp(
                "heading-tag",
                "heading",
                "data-ws-tag",
                `"script"`
              ),
              stringProp("kept-tag", "kept", "data-ws-tag", "nav"),
            ],
          })
        );

        const { page, html } = await renderHome();

        expect(page).not.toContain("script");
        expect(page).not.toContain("evil.example");
        expect(html).not.toContain("<script");
        expect(html).not.toContain("evil.example");
        expect(html).not.toContain("alert(");
        // ... and a data-ws-tag prop that is a tag the builder offers stays
        expect(html).toContain("<nav");
      });

      test("a DialogTitle whose tag prop is not an offered tag is left out", async () => {
        await writeSiteData(
          createSiteData({
            instances: [
              [
                "root",
                {
                  id: "root",
                  component: "Body",
                  children: children("script", "expression", "kept"),
                },
              ],
              [
                "script",
                {
                  id: "script",
                  component:
                    "@webstudio-is/sdk-components-react-radix:DialogTitle",
                  children: [],
                },
              ],
              [
                "expression",
                {
                  id: "expression",
                  component:
                    "@webstudio-is/sdk-components-react-radix:DialogTitle",
                  children: [],
                },
              ],
              [
                "kept",
                {
                  id: "kept",
                  component:
                    "@webstudio-is/sdk-components-react-radix:DialogTitle",
                  children: [],
                },
              ],
            ],
            props: [
              stringProp("script-tag", "script", "tag", "script"),
              expressionProp("expression-tag", "expression", "tag", `"script"`),
              stringProp("kept-tag", "kept", "tag", "h2"),
            ],
          })
        );

        const { page } = await generated();

        expect(page).not.toContain("script");
        expect(page).toContain('tag={"h2"}');
      });

      test("a Radix trigger that passes a tag prop on to its child ships neither", async () => {
        // Radix's Slot merges a trigger's props onto its first child, and a Box,
        // Text or Heading makes its element from the data-ws-tag or tag prop it
        // finds there. The published page does the same merge at run time.
        const radix = "@webstudio-is/sdk-components-react-radix";
        await writeSiteData(
          createSiteData({
            instances: [
              [
                "root",
                {
                  id: "root",
                  component: "Body",
                  children: children("dialog", "collapsible", "popover"),
                },
              ],
              [
                "dialog",
                {
                  id: "dialog",
                  component: `${radix}:Dialog`,
                  children: children("dialog-trigger"),
                },
              ],
              [
                "dialog-trigger",
                {
                  id: "dialog-trigger",
                  component: `${radix}:DialogTrigger`,
                  children: children("dialog-child"),
                },
              ],
              [
                "dialog-child",
                { id: "dialog-child", component: "Box", children: [] },
              ],
              [
                "collapsible",
                {
                  id: "collapsible",
                  component: `${radix}:Collapsible`,
                  children: children("collapsible-trigger"),
                },
              ],
              [
                "collapsible-trigger",
                {
                  id: "collapsible-trigger",
                  component: `${radix}:CollapsibleTrigger`,
                  children: children("collapsible-child"),
                },
              ],
              [
                "collapsible-child",
                { id: "collapsible-child", component: "Heading", children: [] },
              ],
              [
                "popover",
                {
                  id: "popover",
                  component: `${radix}:Popover`,
                  children: children("popover-trigger"),
                },
              ],
              [
                "popover-trigger",
                {
                  id: "popover-trigger",
                  component: `${radix}:PopoverTrigger`,
                  children: children("popover-child"),
                },
              ],
              [
                "popover-child",
                { id: "popover-child", component: "Box", children: [] },
              ],
            ],
            props: [
              stringProp("a", "dialog-trigger", "data-ws-tag", "script"),
              stringProp(
                "b",
                "dialog-trigger",
                "src",
                "https://evil.example/x.js"
              ),
              expressionProp(
                "c",
                "collapsible-trigger",
                "tag",
                `"scr" + "ipt"`
              ),
              stringProp(
                "d",
                "collapsible-trigger",
                "src",
                "https://evil.example/y.js"
              ),
              stringProp("e", "popover-trigger", "data-ws-tag", "nav"),
            ],
          })
        );

        const { page } = await generated();

        expect(page).not.toContain("evil.example");
        expect(page).not.toContain("script");
        expect(page).not.toContain("DialogTrigger");
        expect(page).not.toContain("CollapsibleTrigger");
        // ... and the trigger that passes a tag the builder offers stays
        expect(page).toContain("PopoverTrigger");
        expect(page).toContain('data-ws-tag={"nav"}');
      });

      test("a dangerouslySetInnerHTML prop ships no markup, and its element stays", async () => {
        await writeSiteData(
          createSiteData({
            instances: [
              [
                "root",
                {
                  id: "root",
                  component: "Body",
                  children: children("json", "expression", "box"),
                },
              ],
              [
                "json",
                {
                  id: "json",
                  component: elementComponent,
                  tag: "div",
                  children: [],
                },
              ],
              [
                "expression",
                {
                  id: "expression",
                  component: elementComponent,
                  tag: "div",
                  children: [],
                },
              ],
              ["box", { id: "box", component: "Box", children: [] }],
            ],
            props: [
              jsonProp("json-html", "json", "dangerouslySetInnerHTML", {
                __html: "<img src=x onerror=alert(1)>",
              }),
              stringProp("json-id", "json", "id", "json"),
              expressionProp(
                "expression-html",
                "expression",
                "dangerouslySetInnerHTML",
                `{__html: "<img src=x onerror=alert(2)>"}`
              ),
              jsonProp("box-html", "box", "dangerouslySetInnerHTML", {
                __html: "<script>alert(3)</script>",
              }),
            ],
          })
        );

        const { page, html } = await renderHome();

        expect(page).not.toContain("dangerouslySetInnerHTML");
        expect(page).not.toContain("onerror");
        expect(html).not.toContain("onerror");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("<script");
        // the elements stay
        expect(html).toContain('<div id="json" class="w-element"></div>');
        expect(html).toContain('<div class="w-element"></div>');
        expect(html).toContain('<div class="w-box"></div>');
      });
    });

    // T13. A guard: passes before and after.
    test("keeps the template icons", async () => {
      const chevron = [...templateIconCodes].find((icon) =>
        icon.includes("m4 6 4 4 4-4")
      );
      expect(chevron).toBeDefined();
      await writeSiteData(
        createSiteData({
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [{ type: "id", value: "icon" }],
              },
            ],
            ["icon", { id: "icon", component: "HtmlEmbed", children: [] }],
          ],
          props: [
            [
              "icon-code",
              {
                id: "icon-code",
                instanceId: "icon",
                name: "code",
                type: "string",
                value: chevron,
              },
            ],
          ],
        })
      );

      const { page } = await generated();

      expect(page).toContain("HtmlEmbed");
      expect(page).toContain("m4 6 4 4 4-4");
    });

    // T14
    test("a Resource used only inside a dropped embed is not loaded", async () => {
      await writeSiteData(
        createSiteData({
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [{ type: "id", value: "embed" }],
              },
            ],
            ["embed", { id: "embed", component: "HtmlEmbed", children: [] }],
          ],
          props: [
            [
              "embed-code",
              {
                id: "embed-code",
                instanceId: "embed",
                name: "code",
                type: "expression",
                value: `${encodeDataSourceVariable("html")}.data`,
              },
            ],
          ],
          dataSources: [
            [
              "html",
              {
                type: "resource",
                id: "html",
                scopeInstanceId: "embed",
                name: "html",
                resourceId: "html-resource",
              },
            ],
          ],
          resources: [
            [
              "html-resource",
              {
                id: "html-resource",
                name: "html",
                method: "get",
                url: `"https://cms.example.org/private/html"`,
                headers: [],
              },
            ],
          ],
        })
      );

      const { page, resources } = await generated();

      expect(resources).not.toContain("cms.example.org");
      expect(page).not.toContain("useResource(");
    });

    test("logs what it left out", async () => {
      const info = vi.spyOn(log, "info").mockImplementation(() => {});
      await writeSiteData(
        createSiteData({
          // a page title is an expression; the builder writes a string literal
          pages: [
            {
              id: "home",
              name: "Home",
              title: '"Home"',
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
          ],
          pageMeta: { code: "<style>x{}</style>" },
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Body",
                children: [{ type: "id", value: "embed" }],
              },
            ],
            ["embed", { id: "embed", component: "HtmlEmbed", children: [] }],
          ],
        })
      );

      await generated();

      expect(info).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 1 HTML Embed and the site's custom code."
      );
    });

    // Upstream 0.309.0 keeps the project's settings in their own column, and
    // the page module reads its custom code first
    // (`projectSettings?.meta ?? pages.meta`).
    test("the org script in projectSettings is dropped and reported", async () => {
      const info = vi.spyOn(log, "info").mockImplementation(() => {});
      const siteData = createSiteData({
        pageMeta: { code: '<script src="/pages.js"></script>' },
      });
      const build = {
        ...siteData.build,
        projectSettings: {
          meta: {
            siteName: "Settings Site",
            code: '<script src="/settings.js"></script><style>x{}</style>',
          },
          compiler: { atomicStyles: true },
        },
      };
      await writeSiteData({ ...siteData, build });

      const { page } = await generated();

      expect(page).not.toContain("settings.js");
      expect(page).not.toContain("pages.js");
      expect(page).not.toContain("<script");
      expect(page).not.toContain("const Script");
      expect(page).toMatch(
        /export const CustomCode = \(\) => \{\s*return \(<><\/>\);/
      );
      // the rest of the settings still reach the page
      expect(page).toContain('export const siteName = "Settings Site";');
      expect(info).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out the site's custom code."
      );
    });

    // D7: prebuild turns a Content Block's MDX into instances after
    // dropOrgScript has run, so while org script is paused a build that would
    // do that is refused, from the bundle alone, before any asset is read
    // (refuseMdxWhilePaused).
    describe("MDX content", () => {
      const refusal =
        "This site uses MDX content, which publishing does not support yet.";

      const mdxDocument = (
        id: string,
        source: string,
        extension: "md" | "mdx" = "mdx"
      ): AssetFileDocument => ({
        ...indexedDocument,
        _id: id,
        name: `${id}.${extension}`,
        path: `${id}.${extension}`,
        key: id,
        extension,
        mimeType: extension === "mdx" ? "text/mdx" : "text/markdown",
        size: new TextEncoder().encode(source).byteLength,
        revision: `${id}-revision`,
        contentRef: `${id}.${extension}`,
        properties: {},
      });

      /** A home page with a Content Block whose source is `src`. */
      const writeContentBlock = async ({
        documents,
        src,
      }: {
        documents: Array<[AssetFileDocument, string]>;
        src: Prop;
      }) => {
        const siteData = createSiteData({
          assets: documents.map(([document]) =>
            createAssetForIndexedDocument(document)
          ),
          instances: [
            [
              "root",
              {
                id: "root",
                component: "Box",
                children: [{ type: "id", value: "content" }],
              },
            ],
            [
              "content",
              {
                id: "content",
                component: "ws:block",
                children: [{ type: "id", value: "content-templates" }],
              },
            ],
            [
              "content-templates",
              {
                id: "content-templates",
                component: "ws:block-template",
                children: [],
              },
            ],
          ],
          props: [[src.id, src]],
        });
        const siteDataWithIndex = {
          ...siteData,
          assetIndex: await createTestAssetIndex(
            documents.map(([document]) => document),
            Object.fromEntries(
              documents.map(([document, source]) => [
                document.contentRef,
                source,
              ])
            )
          ),
        };
        await writeSiteData(siteDataWithIndex);
      };

      const assetSource = (value: string): Prop => ({
        id: "content-src",
        instanceId: "content",
        name: "src",
        type: "asset",
        value,
      });

      test.each([
        ["an .mdx asset", "mdx" as const],
        ["an .md asset", "md" as const],
      ])(
        "a build that would materialize MDX is refused while org script is paused (%s)",
        async (_name, extension) => {
          const document = mdxDocument("article", "# Article", extension);
          await writeContentBlock({
            documents: [[document, "# Article"]],
            src: assetSource("article"),
          });
          const network = vi.fn<typeof fetch>();
          globalThis.fetch = network;

          await expect(
            prebuild({
              assets: true,
              template: ["react-router", "react-router-vercel"],
            })
          ).rejects.toThrow(expect.objectContaining({ message: refusal }));
          // refused before anything was written, read or downloaded
          await expect(readdir("app")).rejects.toThrow("ENOENT");
          expect(network).not.toHaveBeenCalled();
        }
      );

      test("a build that would materialize MDX is refused while org script is paused (an expression that can select one)", async () => {
        const document = mdxDocument("article", "# Article");
        await writeContentBlock({
          documents: [[document, "# Article"]],
          src: {
            id: "content-src",
            instanceId: "content",
            name: "src",
            type: "expression",
            value: `${encodeDataSourceVariable("post")}.data.body`,
          },
        });

        await expect(
          prebuild({
            assets: false,
            template: ["react-router", "react-router-vercel"],
          })
        ).rejects.toThrow(refusal);
      });

      // A belt-and-braces case for when D7 is lifted: an MDX `ws:tag` takes
      // any string, and the generator writes a ws:element's tag into the page
      // module as code. Today the refusal stops it; lifting D7 without holding
      // the materialized instances to the pause's tag rule fails here.
      test("an MDX `ws:tag` holding JSX syntax never reaches a page module", async () => {
        const source =
          '<ws.element ws:tag="div />{globalThis.pwned = 1}<div">Hello</ws.element>\n';
        const document = mdxDocument("article", source);
        await writeContentBlock({
          documents: [[document, source]],
          src: assetSource("article"),
        });

        const outcome = await prebuild({
          assets: false,
          template: ["react-router", "react-router-vercel"],
        }).then(
          () => undefined,
          (error: unknown) => error
        );

        const written = await getFilePaths("app").catch(() => []);
        for (const file of written) {
          expect(await readFile(file, "utf8"), file).not.toContain("pwned");
        }
        expect(outcome).toMatchObject({ message: refusal });
      });
    });
  });

  // OrganizeOS fork: while org script is paused, publishing also leaves out
  // unsafe addresses, srcdoc, event handler attributes, XML elements on HTML
  // pages and redirects to an unsafe address (organizeos-org-script.ts,
  // propMayShip in @organizeos/site-components/org-script).
  describe("leaves unsafe values out", () => {
    type SiteData = Parameters<typeof createSiteData>[0];
    type Instances = NonNullable<NonNullable<SiteData>["instances"]>;
    type Props = NonNullable<NonNullable<SiteData>["props"]>;

    const element = (
      id: string,
      component: string,
      tag?: string,
      children: string[] = []
    ): Instances[number] => [
      id,
      {
        id,
        component,
        ...(tag === undefined ? {} : { tag }),
        children: children.map((value) => ({ type: "id", value })),
      },
    ];

    const prop = (
      instanceId: string,
      name: string,
      value: unknown,
      type = "string"
    ): Props[number] => [
      `${instanceId}:${name}`,
      { id: `${instanceId}:${name}`, instanceId, name, type, value },
    ];

    // Each element carries its id, so the page shows that it still renders
    const onHome = (
      instances: Instances,
      props: Props,
      overrides: SiteData = {}
    ) =>
      writeSiteData(
        createSiteData({
          instances: [
            element(
              "root",
              "Body",
              undefined,
              instances.flatMap(([id]) =>
                instances.some(([, parent]) =>
                  parent.children.some((child) => child.value === id)
                )
                  ? []
                  : [id]
              )
            ),
            ...instances,
          ],
          props: [...instances.map(([id]) => prop(id, "id", id)), ...props],
          ...overrides,
        })
      );

    const build = () =>
      prebuild({
        assets: false,
        template: ["react-router", "react-router-vercel"],
      });

    const read = async (file = "_index") => {
      const generatedDir = join("app", "__generated__");
      return {
        page: await readFile(join(generatedDir, `${file}.tsx`), "utf8"),
        server: await readFile(
          join(generatedDir, `${file}.server.tsx`),
          "utf8"
        ),
      };
    };

    const generated = async () => {
      await build();
      return read();
    };

    const expectRendered = (page: string, ids: string[]) => {
      for (const id of ids) {
        expect(page, id).toContain(`id={${JSON.stringify(id)}}`);
      }
    };

    test("drops javascript: and data: addresses from links, sources, forms and objects", async () => {
      await onHome(
        [
          element("object-json", elementComponent, "object"),
          element("link", "Link"),
          element("anchor", elementComponent, "a"),
          element("frame", elementComponent, "iframe"),
          element("object", elementComponent, "object"),
          element("form", elementComponent, "form"),
          element("button", elementComponent, "button"),
          element("svg", elementComponent, "svg", ["svg-link"]),
          element("svg-link", elementComponent, "a"),
          element("image", "Image"),
        ],
        [
          prop("object-json", "data", ["javascript:alert(1)"], "json"),
          prop("link", "href", "javascript:alert(1)"),
          prop("anchor", "href", " \tJaVaScRiPt:alert(1)"),
          prop("frame", "src", "data:text/html,<script>alert(1)</script>"),
          prop("object", "data", "data:text/html,<script>alert(1)</script>"),
          prop("form", "action", "javascript:alert(1)"),
          prop("button", "formaction", "javascript:alert(1)"),
          prop("svg-link", "xlink:href", "javascript:alert(1)"),
          prop("image", "src", "data:image/png;base64,AAAA"),
        ]
      );

      const { page } = await generated();

      expect(page.toLowerCase()).not.toContain("javascript:");
      expect(page.toLowerCase()).not.toContain("data:");
      expect(page).not.toContain("alert(1)");
      expectRendered(page, [
        "object-json",
        "link",
        "anchor",
        "frame",
        "object",
        "form",
        "button",
        "svg-link",
        "image",
      ]);
    });

    // A guard: passes before and after
    test("keeps http, https, mailto, tel and sms addresses, relative paths and fragments", async () => {
      const addresses = [
        "http://example.org/a",
        "https://example.org/b",
        "mailto:a@example.org",
        "tel:+15555550123",
        "sms:+15555550123",
        "/about",
        "#top",
      ];
      await onHome(
        addresses.map((_address, index) => element(`link-${index}`, "Link")),
        addresses.map((address, index) =>
          prop(`link-${index}`, "href", address)
        )
      );

      const { page } = await generated();

      for (const address of addresses) {
        expect(page).toContain(`href={${JSON.stringify(address)}}`);
      }
    });

    test("drops a bound address that decides nothing and publishes one whose fixed start decides", async () => {
      const variable = encodeDataSourceVariable("target");
      await onHome(
        [element("bound", "Link"), element("fixed", "Link")],
        [
          prop("bound", "href", `${variable}`, "expression"),
          prop("fixed", "href", `"/go/" + ${variable}`, "expression"),
        ],
        {
          dataSources: [
            [
              "target",
              {
                type: "variable",
                id: "target",
                scopeInstanceId: "root",
                name: "target",
                value: { type: "string", value: "next" },
              },
            ],
          ],
        }
      );

      const { page } = await generated();

      expectRendered(page, ["bound", "fixed"]);
      expect(page.match(/href=\{/g)).toHaveLength(1);
      // upstream 0.309.0 writes a bound attribute as `x == null ? x : String(x)`
      expect(page).toMatch(
        /href=\{"\/go\/" \+ (\w+)(?:\}| == null \? "\/go\/" \+ \1 : String\("\/go\/" \+ \1\)\})/
      );
    });

    test("publishes the Event Card's link, its document navigation and its cover image", async () => {
      // the card as the Event Card and Event List templates make it
      // (event-card.template.tsx), over the collection's event parameter
      const event = encodeDataSourceVariable("event-parameter");
      await onHome(
        [
          element("list", elementComponent, "div", ["events"]),
          element("events", "ws:collection", undefined, ["card"]),
          element("card", elementComponent, "article", ["cover", "link"]),
          element("cover", "Image"),
          element("link", elementComponent, "a"),
        ],
        [
          prop("events", "item", "event-parameter", "parameter"),
          prop(
            "events",
            "data",
            encodeDataSourceVariable("events"),
            "expression"
          ),
          prop("cover", "src", `${event}.cover_image_url`, "expression"),
          prop("link", "href", `"/events/" + ${event}.slug`, "expression"),
          prop("link", "reloadDocument", true, "boolean"),
        ],
        {
          dataSources: [
            [
              "events",
              {
                type: "variable",
                id: "events",
                scopeInstanceId: "list",
                name: "events",
                value: {
                  type: "json",
                  value: [{ slug: "drive", cover_image_url: "/a.png" }],
                },
              },
            ],
            [
              "event-parameter",
              {
                type: "parameter",
                id: "event-parameter",
                name: "event",
                scopeInstanceId: "events",
              },
            ],
          ],
        }
      );

      const { page } = await generated();

      expect(page).toContain('href={"/events/" + event?.slug}');
      expect(page).toContain("reloadDocument={true}");
      // upstream 0.309.0 writes a bound attribute as `x == null ? x : String(x)`
      expect(page).toContain(
        "src={event?.cover_image_url == null ? event?.cover_image_url : String(event?.cover_image_url)}"
      );
    });

    test("drops srcdoc and event handler attributes", async () => {
      await onHome(
        [
          element("frame", elementComponent, "iframe"),
          element("bound-frame", elementComponent, "iframe"),
          element("custom", elementComponent, "div"),
        ],
        [
          prop("frame", "srcdoc", "<script>alert(1)</script>"),
          prop("bound-frame", "srcdoc", '"<p>" + 1', "expression"),
          prop("custom", "is", "x-y"),
          prop("custom", "onclick", "alert(1)"),
          prop("custom", "onmouseover", '"alert(1)"', "expression"),
        ]
      );

      const { page } = await generated();

      expect(page.toLowerCase()).not.toContain("srcdoc");
      expect(page).not.toContain("onclick");
      expect(page).not.toContain("onmouseover");
      expect(page).not.toContain("alert(1)");
      expect(page).toContain('is={"x-y"}');
      expectRendered(page, ["frame", "bound-frame", "custom"]);
    });

    const xmlPages = [
      {
        id: "home",
        name: "Home",
        title: "Home",
        path: "",
        rootInstanceId: "root",
        meta: {},
      },
      {
        id: "feed",
        name: "Feed",
        title: "Feed",
        path: "/feed.xml",
        rootInstanceId: "xml-root",
        meta: { documentType: "xml" },
      },
    ];

    test("leaves an XML Node out of an HTML page and keeps it on an XML page", async () => {
      await writeSiteData(
        createSiteData({
          pages: xmlPages,
          instances: [
            element("root", "Body", undefined, ["box", "html-node"]),
            element("box", "Box"),
            element("html-node", "XmlNode"),
            element("xml-root", "Body", undefined, ["xml-node"]),
            element("xml-node", "XmlNode"),
          ],
          props: [
            prop("html-node", "tag", "x-custom"),
            prop("html-node", "onmouseover", "alert(1)"),
            prop("xml-node", "tag", "rss"),
            prop("xml-node", "version", "2.0"),
          ],
        })
      );

      await build();
      const { page } = await read();
      const { page: feed } = await read("[feed.xml]._index");

      expect(page).not.toContain("XmlNode");
      expect(page).not.toContain("onmouseover");
      expect(page).toContain("<Box");
      expect(feed).toContain("<XmlNode");
      expect(feed).toContain('tag={"rss"}');
    });

    test("an XML page answers with a sandbox policy and nosniff", async () => {
      await writeSiteData(
        createSiteData({
          pages: xmlPages,
          instances: [
            element("root", "Body"),
            element("xml-root", "Body", undefined, ["xml-node"]),
            element("xml-node", "XmlNode"),
          ],
          props: [prop("xml-node", "tag", "rss")],
        })
      );

      await build();
      const route = await readFile(
        join("app", "routes", "[feed.xml]._index.tsx"),
        "utf8"
      );

      expect(route).toContain('"Content-Type": "application/xml"');
      expect(route).toContain('"Content-Security-Policy": "sandbox"');
      expect(route).toContain('"X-Content-Type-Options": "nosniff"');
    });

    test("drops a page redirect and a project redirect to an unsafe target", async () => {
      await writeSiteData(
        createSiteData({
          pages: [
            {
              id: "home",
              name: "Home",
              title: "Home",
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
            {
              id: "unsafe",
              name: "Unsafe",
              title: "Unsafe",
              path: "/unsafe",
              rootInstanceId: "root",
              meta: { redirect: '"javascript:alert(1)"', status: "302" },
            },
            {
              id: "safe",
              name: "Safe",
              title: "Safe",
              path: "/safe",
              rootInstanceId: "root",
              meta: { redirect: '"/landing"', status: "301" },
            },
          ],
          instances: [element("root", "Body")],
          redirects: [
            { old: "/go", new: "javascript:alert(1)" },
            { old: "/old", new: "/new" },
          ],
        })
      );

      await build();
      const { server: unsafe } = await read("[unsafe]._index");
      const { server: safe } = await read("[safe]._index");
      const redirects = await readFile(
        join("app", "__generated__", "$resources.redirects.ts"),
        "utf8"
      );

      expect(unsafe.toLowerCase()).not.toContain("javascript:");
      expect(redirects.toLowerCase()).not.toContain("javascript:");
      expect(safe).toContain('"/landing"');
      expect(redirects).toContain('"new": "/new"');
    });
  });

  test("generates homepage, leaf, nested, dynamic, and 404 React Router routes", async () => {
    await writeSiteData(
      createSiteData({
        pages: [
          {
            id: "home",
            name: "Home",
            title: "Home",
            path: "",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "pricing",
            name: "Pricing",
            title: "Pricing",
            path: "/pricing",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "guide",
            name: "Guide",
            title: "Guide",
            path: "/docs/getting-started",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "post",
            name: "Post",
            title: "Post",
            path: "/blog/:slug",
            rootInstanceId: "root",
            meta: {},
          },
        ],
      })
    );

    await prebuild({ assets: false, template: ["react-router"] });

    await expect(readFile("app/routes/_index.tsx", "utf8")).resolves.toContain(
      "../__generated__/_index"
    );
    await expect(
      readFile("app/routes/[pricing]._index.tsx", "utf8")
    ).resolves.toContain("../__generated__/[pricing]._index");
    await expect(
      readFile("app/routes/[docs].[getting-started]._index.tsx", "utf8")
    ).resolves.toContain("../__generated__/[docs].[getting-started]._index");
    await expect(
      readFile("app/routes/[blog].$slug._index.tsx", "utf8")
    ).resolves.toContain("../__generated__/[blog].$slug._index");
    await expectGeneratedRedirectFallback("app/routes/$.tsx");
  });

  test("builds a generated dynamic route with the packaged React Router SDK", async () => {
    await writeSiteData(
      createSiteData({
        pages: [
          {
            id: "home",
            name: "Home",
            title: "Home",
            path: "",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "post",
            name: "Post",
            title: "Post",
            path: "/blog/:slug",
            rootInstanceId: "root",
            meta: {},
          },
        ],
      })
    );

    await prebuild({ assets: false, template: ["react-router"] });
    await linkPackagedPreviewDependencies();
    const loadedConfig = await loadConfigFromFile(
      { command: "build", mode: "production" },
      join(tempDir, "vite.config.ts")
    );
    expect(loadedConfig?.config.resolve?.conditions).toContain("import");
    expect(loadedConfig?.config.ssr?.resolve?.conditions).toContain("import");
    expect(loadedConfig?.config.optimizeDeps?.entries).toEqual([
      "app/root.tsx",
      "app/routes/**/*.{ts,tsx}",
    ]);
    await runGeneratedCommand("react-router", ["build"]);

    await expect(
      getFilePaths(join(tempDir, "build", "server"))
    ).resolves.not.toHaveLength(0);
  }, 30_000);

  test.each(["react-router-netlify", "react-router-cloudflare"])(
    "pre-scans generated routes with the %s template overlay",
    async (overlay) => {
      await prebuild({ assets: false, template: ["react-router", overlay] });
      const config = await readFile("vite.config.ts", "utf8");
      expect(config).toContain(
        'entries: ["app/root.tsx", "app/routes/**/*.{ts,tsx}"]'
      );
    }
  );

  test("preserves an authored catch-all page when redirects are configured", async () => {
    await writeSiteData(
      createSiteData({
        pages: [
          {
            id: "home",
            name: "Home",
            title: "Home",
            path: "",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "not-found",
            name: "Not found",
            // OrganizeOS fork: a title is an expression; two bare words fail
            // input validation (organizeos-code-check.ts)
            title: `"Not found"`,
            path: "/*",
            rootInstanceId: "root",
            meta: { status: "404" },
          },
        ],
      })
    );

    await prebuild({
      assets: false,
      template: ["react-router"],
      preserveRouteTemplates: true,
    });
    await prebuild({
      assets: false,
      template: ["react-router"],
      incremental: true,
    });

    const route = await readFile("app/routes/$.tsx", "utf8");
    expect(route).toContain("../__generated__/$");
    expect(route).toContain("../__generated__/$.server");
    expect(route).not.toContain('new Response("Not Found"');
    await expect(
      readFile("app/__generated__/$.server.tsx", "utf8")
    ).resolves.toContain("status: 404");
  });

  test("ignores the catch-all fallback when generating an SSG site", async () => {
    await writeSiteData(
      createSiteData({
        pages: [
          {
            id: "home",
            name: "Home",
            title: "Home",
            path: "",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "not-found",
            name: "Not found",
            // OrganizeOS fork: a title is an expression; two bare words fail
            // input validation (organizeos-code-check.ts)
            title: `"Not found"`,
            path: "/*",
            rootInstanceId: "root",
            meta: {},
          },
        ],
      })
    );

    await expect(
      prebuild({ assets: false, template: ["ssg"] })
    ).resolves.toBeUndefined();
    await expect(readFile("pages/index/+Page.tsx", "utf8")).resolves.toContain(
      "Page"
    );
    await expect(readFile("pages/*/+Page.tsx", "utf8")).rejects.toThrow(
      "ENOENT"
    );
  });

  test.each(["mdx", "md"])(
    "fetches a synced %s asset over HTTP in a dynamic SSR build",
    async (extension) => {
      const source = "# Published post\n";
      const name = `post.${extension}`;
      const index = await createTestAssetIndex({
        ...indexedDocument,
        name,
        path: `blog/${name}`,
        extension,
        mimeType: extension === "mdx" ? "text/mdx" : "text/markdown",
        contentRef: name,
        size: new TextEncoder().encode(source).byteLength,
        properties: { slug: "post" },
      });
      const siteData = {
        ...createSiteData({
          pages: [
            {
              id: "home",
              name: "Home",
              title: "Home",
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
            {
              id: "post",
              name: "Post",
              title: "Post",
              path: "/blog/:slug",
              rootInstanceId: "root",
              meta: {},
            },
          ],
        }),
        assets: [
          {
            id: "post-1",
            projectId: "project-id",
            name,
            type: "file" as const,
            format: extension,
            size: source.length,
            meta: {},
            description: "",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
          {
            id: "draft",
            projectId: "project-id",
            name: `draft.${extension}`,
            type: "file" as const,
            format: extension,
            size: source.length,
            meta: {},
            description: "",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        assetIndex: index,
      };
      siteData.build.resources = [["posts", createQueryResource("full")]];
      siteData.build.dataSources = [
        [
          "posts-data",
          {
            id: "posts-data",
            type: "resource",
            name: "posts",
            resourceId: "posts",
            scopeInstanceId: "root",
          },
        ],
      ];
      await writeSiteData(
        siteData as unknown as ReturnType<typeof createSiteData>
      );
      await mkdir(".webstudio/assets", { recursive: true });
      await writeFile(`.webstudio/assets/${name}`, source, "utf8");
      await writeFile(
        `.webstudio/assets/draft.${extension}`,
        "draft secret",
        "utf8"
      );

      await prebuild({
        assets: true,
        template: ["react-router"],
      });

      await expect(
        readFile("app/routes/[blog].$slug._index.tsx", "utf8")
      ).resolves.toContain("createGeneratedAssetResourceFetch");
      await expect(readFile(`public/assets/${name}`, "utf8")).resolves.toBe(
        source
      );
      await expect(
        readFile(`public/assets/draft.${extension}`, "utf8")
      ).resolves.toBe("draft secret");
      const manifest = await readFile(
        "app/__generated__/$resources.asset-query-manifest.ts",
        "utf8"
      );
      expect(manifest).not.toContain("Published post");
      expect(manifest).not.toContain('"contents"');
      expect(manifest).not.toContain("draft secret");
      await expect(
        readFile("app/asset-resource-fetch.ts", "utf8")
      ).rejects.toThrow("ENOENT");
      expect(
        (await getFilePaths("app/routes")).filter((path) =>
          path.includes("$slug")
        )
      ).toHaveLength(1);
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await runGeneratedCommand("react-router", ["build"]);
      const serverBundle = (
        await Promise.all(
          (
            await getFilePaths("build/server")
          )
            .filter((path) => path.endsWith(".js"))
            .map((path) => readFile(path, "utf8"))
        )
      ).join("\n");
      expect(serverBundle).not.toContain("Published post");
      expect(serverBundle).not.toContain("draft secret");
      expect(serverBundle).toContain("post-revision");
      const clientBundle = (
        await Promise.all(
          (
            await getFilePaths("build/client")
          )
            .filter((path) => path.endsWith(".js"))
            .map((path) => readFile(path, "utf8"))
        )
      ).join("\n");
      expect(clientBundle).not.toContain("Published post");
      expect(clientBundle).not.toContain("post-revision");

      // Exercise the generated runtime against real locally served assets.
      // The preview/Vite server supplies the same public files in normal use.
      const runtimeBundle = await build({
        entryPoints: [
          join(tempDir, "app/__generated__/$resources.asset-query-runtime.ts"),
        ],
        bundle: true,
        format: "esm",
        platform: "node",
        write: false,
      });
      const runtime = await import(
        /* @vite-ignore */
        `data:text/javascript;base64,${Buffer.from(
          runtimeBundle.outputFiles[0].text
        ).toString("base64")}`
      );
      const requestedPaths: string[] = [];
      const server = createServer((request, response) => {
        requestedPaths.push(request.url ?? "");
        if (request.url !== `/assets/${name}`) {
          response.writeHead(404).end();
          return;
        }
        void readFile(join(tempDir, "build/client/assets", name)).then(
          (bytes) => response.end(bytes),
          () => response.writeHead(404).end()
        );
      });
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve)
      );
      try {
        const address = server.address();
        if (address === null || typeof address === "string") {
          throw new Error("Expected a local TCP server");
        }
        const origin = `http://127.0.0.1:${address.port}`;
        const generatedFetch = await runtime.createGeneratedAssetResourceFetch({
          request: new Request(`${origin}/blog/post`),
          context: {},
          fallback: originalFetch,
        });
        const response = await generatedFetch("/$resources/assets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query: {
              content: { mode: "full" },
              output: { mode: "all", includeMetadata: true },
            },
          }),
        });
        const data = await response.json();
        expect(response.status, JSON.stringify(data)).toBe(200);
        expect(data).toMatchObject({
          items: [{ id: "post-1", content: { text: source } }],
        });
        expect(requestedPaths).toEqual([`/assets/${name}`]);
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
      }
    },
    30_000
  );

  test("embeds the deployment database when asset downloads are disabled", async () => {
    const index = await createTestAssetIndex();
    const siteData = {
      ...createSiteData({
        assets: [
          createAssetForIndexedDocument(indexedDocument),
          createAssetForIndexedDocument({
            ...indexedDocument,
            _id: "unrelated-asset",
            name: "unrelated.md",
            path: "unrelated.md",
            key: "unrelated",
            contentRef: "unrelated.md",
          }),
        ],
      }),
      assetIndex: index,
    };
    siteData.build.resources = [["posts", createQueryResource()]];
    siteData.build.dataSources = [
      [
        "posts-data",
        {
          id: "posts-data",
          type: "resource",
          name: "posts",
          resourceId: "posts",
          scopeInstanceId: "root",
        },
      ],
    ];
    await writeSiteData(
      siteData as unknown as ReturnType<typeof createSiteData>
    );
    await mkdir(".webstudio/assets", { recursive: true });
    await writeFile(".webstudio/assets/post.md", "local post body\n", "utf8");

    await prebuild({
      assets: false,
      template: ["react-router"],
      preserveRouteTemplates: true,
    });

    await expect(
      readFile("app/__generated__/$resources.asset-query-manifest.ts", "utf8")
    ).resolves.toContain(index.integrity.checksum);
    await expect(
      readFile("app/__generated__/$resources.asset-query-manifest.ts", "utf8")
    ).resolves.not.toContain("local post body");
    const runtimeModule = await readFile(
      "app/__generated__/$resources.asset-query-runtime.ts",
      "utf8"
    );
    expect(runtimeModule).not.toContain('"post-1"');
    expect(runtimeModule).not.toContain("unrelated-asset");
    expect(runtimeModule).not.toContain('$resources.assets"');
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    expect(packageJson.dependencies).not.toHaveProperty(
      "@webstudio-is/content-engine"
    );
    await expect(
      stat("app/__generated__/$resources.asset-query-vendor.js")
    ).resolves.toBeDefined();

    await writeSiteData();
    await prebuild({
      assets: false,
      incremental: true,
      template: ["react-router"],
    });
    const withoutQuery = JSON.parse(await readFile("package.json", "utf8"));
    expect(withoutQuery.dependencies).not.toHaveProperty(
      "@webstudio-is/content-engine"
    );
    await expect(
      stat("app/__generated__/$resources.asset-query-vendor.js")
    ).rejects.toThrow("ENOENT");
  });

  test.each(["production", "staging"] as const)(
    "keeps deferred published asset proxy URLs deployment-relative (%s)",
    async (target) => {
      const index = await createAssetIndex({
        projectId: "project-1",
        entries: [
          {
            ...createCanonicalAssetFileEntry({
              projectId: "project-1",
              document: indexedDocument,
            }),
            content: "# Indexed post body\n",
          },
        ],
        documentGraph: createDocumentGraph({
          nodes: [
            {
              id: indexedDocument._id,
              revision: indexedDocument.revision,
              contentRef: indexedDocument.contentRef,
              format: "markdown",
            },
          ],
          edges: [],
        }),
      });
      const baseSiteData = createSiteData({
        assets: [createAssetForIndexedDocument(indexedDocument)],
      });
      const siteData = {
        ...baseSiteData,
        origin: "https://p-project-1.apps.webstudio.is",
        assetIndex: index,
        build: {
          ...baseSiteData.build,
          deployment: {
            destination: "saas" as const,
            target,
            domains: ["example"],
            assetsDomain: "example",
            excludeWstdDomainFromSearch: false,
          },
          resources: [["posts", createQueryResource("markdown-body-ref")]],
          dataSources: [
            [
              "posts-data",
              {
                id: "posts-data",
                type: "resource" as const,
                name: "posts",
                resourceId: "posts",
                scopeInstanceId: "root",
              },
            ],
          ],
        },
      };
      await writeSiteData(
        siteData as unknown as ReturnType<typeof createSiteData>
      );

      await prebuild({
        assets: false,
        template: ["react-router"],
        preserveRouteTemplates: true,
      });

      const runtimeModule = await readFile(
        "app/__generated__/$resources.asset-query-runtime.ts",
        "utf8"
      );
      const manifest = await readFile(
        "app/__generated__/$resources.asset-query-manifest.ts",
        "utf8"
      );
      expect(manifest).not.toContain("# Indexed post body");
      expect(runtimeModule).toContain('"url":"/cgi/asset/post.md?format=raw"');
      expect(runtimeModule).not.toContain("sourceUrl");
      expect(runtimeModule).not.toContain(
        "https://p-project-1.apps.webstudio.is/cgi/asset/"
      );
      expect(runtimeModule).not.toContain('"url":"/assets/post.md"');
      const assetsModule = await readFile(
        "app/__generated__/$resources.assets.ts",
        "utf8"
      );
      expect(assetsModule).toContain(
        '"/post.md": "/cgi/asset/post.md?format=raw"'
      );
      expect(assetsModule).not.toContain(
        "https://p-project-1.apps.webstudio.is/cgi/asset/"
      );

      await mkdir(".webstudio/assets", { recursive: true });
      await writeFile(".webstudio/assets/post.md", "# Post\n", "utf8");
      await prebuild({
        assets: true,
        template: ["react-router"],
        preserveRouteTemplates: true,
      });

      const materializedRuntimeModule = await readFile(
        "app/__generated__/$resources.asset-query-runtime.ts",
        "utf8"
      );
      const materializedManifest = await readFile(
        "app/__generated__/$resources.asset-query-manifest.ts",
        "utf8"
      );
      expect(materializedManifest).not.toContain("# Indexed post body");
      expect(materializedManifest).not.toContain('"contents"');
      expect(materializedRuntimeModule).toContain('"url":"/assets/post.md"');
      expect(materializedRuntimeModule).not.toContain("sourceUrl");
      expect(materializedRuntimeModule).not.toContain(
        '"url":"https://assets.example/cgi/asset/post.md?format=raw"'
      );
      const materializedAssetsModule = await readFile(
        "app/__generated__/$resources.assets.ts",
        "utf8"
      );
      expect(materializedAssetsModule).toContain(
        '"/post.md": "/assets/post.md"'
      );
    }
  );

  test("uses pass-through images in the base react-router template", async () => {
    await prebuild({ assets: false, template: ["react-router"] });

    const route = await readFile("app/routes/_index.tsx", "utf8");
    expect(route).toContain("$resources.asset-query-runtime");
    expect(route).not.toContain("@webstudio-is/content-engine");
    const assetQueryRuntime = await readFile(
      "app/__generated__/$resources.asset-query-runtime.ts",
      "utf8"
    );
    expect(assetQueryRuntime).not.toContain("@webstudio-is/content-engine");
    expect(assetQueryRuntime).toContain("=> fallback");
    await expect(
      readFile("app/__generated__/$resources.asset-query-manifest.ts", "utf8")
    ).resolves.not.toContain("@webstudio-is/content-engine");
    await expect(readFile("app/constants.mjs", "utf8")).resolves.toContain(
      "return props.src"
    );
    await expect(readFile("app/routes/[_image].$.ts", "utf8")).rejects.toThrow(
      "ENOENT"
    );
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    expect(packageJson.dependencies).not.toHaveProperty("h3");
    expect(packageJson.dependencies).not.toHaveProperty("ipx");
  });

  test("does not modify a project-owned content-engine dependency", async () => {
    await prebuild({
      assets: false,
      template: ["react-router"],
      preserveRouteTemplates: true,
    });
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    packageJson.dependencies["@webstudio-is/content-engine"] = "custom-version";
    await writeFile("package.json", JSON.stringify(packageJson), "utf8");

    await prebuild({
      assets: false,
      incremental: true,
      template: ["react-router"],
    });

    const preserved = JSON.parse(await readFile("package.json", "utf8"));
    expect(preserved.dependencies).toHaveProperty(
      "@webstudio-is/content-engine",
      "custom-version"
    );
  });

  test("omits the asset query runtime from dynamic app bundles without asset queries", async () => {
    await prebuild({ assets: false, template: ["react-router"] });
    await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");

    await runGeneratedCommand("react-router", ["build"]);

    const serverBundle = (
      await Promise.all(
        (
          await getFilePaths("build/server")
        )
          .filter((path) => path.endsWith(".js"))
          .map((path) => readFile(path, "utf8"))
      )
    ).join("\n");
    expect(serverBundle).not.toContain("@webstudio-is/content-engine");
  }, 30_000);

  test("keeps IPX image optimization in the react-router Docker overlay", async () => {
    await prebuild({
      assets: false,
      template: ["react-router", "react-router-docker"],
    });

    await expect(readFile("app/constants.mjs", "utf8")).resolves.toContain(
      "return `/_image/w_${props.width},q_${props.quality}${path}`"
    );
    await expect(
      readFile("app/routes/[_image].$.ts", "utf8")
    ).resolves.toContain("createIPXH3Handler");
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    expect(packageJson.dependencies).toMatchObject({
      h3: "^1.15.1",
      ipx: "^3.0.3",
    });
  });

  test("rejects the react-router-docker overlay without its base template", async () => {
    await expect(
      prebuild({ assets: false, template: ["react-router-docker"] })
    ).rejects.toThrow(
      'requires "react-router". Use --template react-router --template react-router-docker.'
    );
  });

  test("selects ssg templates", async () => {
    await writeSiteData(
      createSiteData({
        pages: [
          {
            id: "home",
            name: "Home",
            title: "Home",
            path: "",
            rootInstanceId: "root",
            meta: {},
          },
        ],
      })
    );

    await prebuild({
      assets: false,
      template: ["ssg"],
    });

    await expect(readFile("pages/index/+Page.tsx", "utf8")).resolves.toContain(
      "../app/__generated__/_index"
    );
    await expect(readFile("pages/index/+data.ts", "utf8")).resolves.toContain(
      "../app/__generated__/_index.server"
    );
    await expect(readFile("pages/index/+data.ts", "utf8")).resolves.toContain(
      "createSsgAssetResourceFetch"
    );
    await expect(
      readFile("app/asset-resource-fetch.ts", "utf8")
    ).resolves.not.toContain("@webstudio-is/content-engine");
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    expect(packageJson.dependencies).not.toHaveProperty(
      "@webstudio-is/content-engine"
    );
    expect(packageJson.scripts.build).not.toContain(
      "cleanup-derived-assets.mjs"
    );
  });

  test.each(["defaults", "react-router"])(
    "uses page params and all query values in a managed Form Resource (%s)",
    async (template) => {
      const system = encodeDataSourceVariable(SYSTEM_VARIABLE_ID);
      const siteData = createSiteData({
        pages: [
          {
            id: "product",
            name: "Product",
            title: "Product",
            path: "/products/:slug",
            rootInstanceId: "root",
            meta: {},
          },
        ],
        instances: [
          ["root", { id: "root", component: "ResourceForm", children: [] }],
        ],
        props: [
          [
            "earlier-action",
            {
              id: "earlier-action",
              instanceId: "root",
              name: "action",
              type: "json",
              value: [],
            },
          ],
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "json",
              value: [{ dataSourceId: "destination" }],
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          SYSTEM_VARIABLE_ID,
          { id: SYSTEM_VARIABLE_ID, name: "system", type: "parameter" },
        ],
        [
          "destination",
          {
            id: "destination",
            name: "Destination",
            type: "resource",
            resourceId: "submit",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "submit",
          {
            id: "submit",
            name: "Submit",
            method: "post",
            url: `"https://receiver.example/" + ${system}.params.slug + "?source=" + ${system}.search.source`,
            headers: [
              {
                name: "X-Selected",
                value: `typeof ${system}.search.tag === "string" ? ${system}.search.tag : ${system}.search.tag[0]`,
              },
            ],
            body: `{ slug: ${system}.params.slug, tags: ${system}.search.tag }`,
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await writeFile(
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
        "export const createManagedFormEmailSender = () => undefined;\nexport const validateManagedFormEmail = () => undefined;\nexport const createManagedFormResourceFetch = () => globalThis.__testManagedFormFetch;\n"
      );
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents:
            'export { action } from "./app/routes/[products].$slug._index"',
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "managed-action.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { action } = await import(
        pathToFileURL(join(tempDir, "managed-action.mjs")).href
      );
      const received: Array<{
        url: string;
        selected: string | null;
        body: unknown;
      }> = [];
      vi.stubGlobal(
        "__testManagedFormFetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init);
          received.push({
            url: request.url,
            selected: request.headers.get("X-Selected"),
            body: await request.json(),
          });
          return Response.json({ accepted: true });
        })
      );
      const form = new FormData();
      form.set(managedFormIdFieldName, "root");
      form.set(formBotFieldName, "brave");
      form.set(managedFormArrayNamesFieldName, "[]");
      form.set("message", "Hello");
      await expect(
        action({
          request: new Request(
            `https://example.com/products/chair?source=newsletter&tag=&tag=red%2Cblue&tag=red%2Cblue&${managedFormRequestParamName}=1`,
            {
              method: "POST",
              headers: { host: "example.com" },
              body: form,
            }
          ),
          context: {},
          params: { slug: "chair" },
        })
      ).resolves.toMatchObject({ success: true });
      const nextForm = new FormData();
      nextForm.set(managedFormIdFieldName, "root");
      nextForm.set(formBotFieldName, "brave");
      nextForm.set(managedFormArrayNamesFieldName, "[]");
      await expect(
        action({
          request: new Request(
            `https://example.com/products/table?source=direct&tag=last&${managedFormRequestParamName}=1`,
            {
              method: "POST",
              headers: { host: "example.com" },
              body: nextForm,
            }
          ),
          context: {},
          params: { slug: "table" },
        })
      ).resolves.toMatchObject({ success: true });
      expect(received).toEqual([
        {
          url: "https://receiver.example/chair?source=newsletter",
          selected: "",
          body: { slug: "chair", tags: ["", "red,blue", "red,blue"] },
        },
        {
          url: "https://receiver.example/table?source=direct",
          selected: "last",
          body: { slug: "table", tags: "last" },
        },
      ]);
    }
  );

  test.each(["defaults", "react-router"])(
    "uses route params and query values in a deprecated Webhook Form Resource (%s)",
    async (template) => {
      const system = encodeDataSourceVariable(SYSTEM_VARIABLE_ID);
      const siteData = createSiteData({
        pages: [
          {
            id: "product",
            name: "Product",
            title: "Product",
            path: "/products/:slug",
            rootInstanceId: "root",
            meta: {},
          },
        ],
        instances: [["root", { id: "root", component: "Form", children: [] }]],
        props: [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "resource",
              value: "submit",
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          SYSTEM_VARIABLE_ID,
          { id: SYSTEM_VARIABLE_ID, name: "system", type: "parameter" },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "submit",
          {
            id: "submit",
            name: "Submit",
            method: "post",
            url: `"https://receiver.example/" + ${system}.params.slug + "?source=" + ${system}.search.source`,
            headers: [{ name: "X-Selected", value: `${system}.search.tag` }],
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await writeFile(
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
        "export const createManagedFormEmailSender = () => undefined;\nexport const validateManagedFormEmail = () => undefined;\nexport const createManagedFormResourceFetch = () => Object.assign(globalThis.__deprecatedWebhookFormRouteFetch, { validateDestination: () => undefined });\n"
      );
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents:
            'export { action } from "./app/routes/[products].$slug._index"',
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "deprecated-webhook-form-action.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { action } = await import(
        pathToFileURL(join(tempDir, "deprecated-webhook-form-action.mjs")).href
      );
      const received: Array<{
        url: string;
        selected: unknown;
        body: unknown;
      }> = [];
      vi.stubGlobal(
        "__deprecatedWebhookFormRouteFetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init);
          received.push({
            url: request.url,
            selected: JSON.parse(request.headers.get("X-Selected") ?? "null"),
            body: await request.json(),
          });
          return Response.json({ accepted: true });
        })
      );
      const form = new FormData();
      form.set(formIdFieldName, "action");
      form.set(formBotFieldName, "brave");
      form.set("message", "Hello");
      await expect(
        action({
          request: new Request(
            "https://example.com/products/chair?source=newsletter&tag=red&tag=blue",
            {
              method: "POST",
              headers: { host: "example.com" },
              body: form,
            }
          ),
          context: {},
          params: { slug: "chair" },
        })
      ).resolves.toEqual({ success: true });
      expect(received).toEqual([
        {
          url: "https://receiver.example/chair?source=newsletter",
          selected: ["red", "blue"],
          body: { message: "Hello" },
        },
      ]);
    }
  );

  test.each(["defaults", "react-router"])(
    "passes native GET Form multi-select values to page Resources (%s)",
    async (template) => {
      const system = encodeDataSourceVariable(SYSTEM_VARIABLE_ID);
      const siteData = createSiteData({
        pages: [
          {
            id: "product",
            name: "Product",
            title: encodeDataSourceVariable("selected-tags"),
            path: "/products/:slug",
            rootInstanceId: "root",
            meta: {},
          },
        ],
        instances: [["root", { id: "root", component: "Form", children: [] }]],
        props: [
          [
            "method",
            {
              id: "method",
              instanceId: "root",
              name: "method",
              type: "string",
              value: "get",
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          SYSTEM_VARIABLE_ID,
          { id: SYSTEM_VARIABLE_ID, name: "system", type: "parameter" },
        ],
        [
          "selected-tags",
          {
            id: "selected-tags",
            name: "Selected tags",
            type: "resource",
            resourceId: "tag-receiver",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "tag-receiver",
          {
            id: "tag-receiver",
            name: "Tag receiver",
            method: "get",
            url: '"https://receiver.example/tags"',
            headers: [
              { name: "X-Selected-Tags", value: `${system}.search.tag` },
            ],
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents:
            'export { loader } from "./app/routes/[products].$slug._index"',
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "native-get-loader.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { loader } = await import(
        pathToFileURL(join(tempDir, "native-get-loader.mjs")).href
      );
      const received: Array<{ url: string; selectedTags: string | null }> = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init);
          received.push({
            url: request.url,
            selectedTags: request.headers.get("X-Selected-Tags"),
          });
          return Response.json({ accepted: true });
        })
      );

      await loader({
        request: new Request(
          "https://example.com/products/chair?tag=red%2Cblue&tag=green"
        ),
        params: { slug: "chair" },
        context: { EXCLUDE_FROM_SEARCH: false },
      });

      expect(received).toEqual([
        {
          url: "https://receiver.example/tags",
          selectedTags: '["red,blue","green"]',
        },
      ]);
    }
  );

  test.each(["defaults", "react-router"])(
    "keeps a saved Webhook Form URL method and rejects its own host (%s)",
    async (template) => {
      const siteData = createSiteData({
        instances: [
          ["root", { id: "root", component: "WebhookForm", children: [] }],
        ],
        props: [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "string",
              value: "https://receiver.example/hook",
            },
          ],
          [
            "method",
            {
              id: "method",
              instanceId: "root",
              name: "method",
              type: "string",
              value: "put",
            },
          ],
        ],
      });
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await writeFile(
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
        `import { createProtectedResourceFetch } from "@webstudio-is/sdk/protected-resource-fetch";
export const createManagedFormEmailSender = () => undefined;
export const validateManagedFormEmail = () => undefined;
export const createManagedFormResourceFetch = ({ request }) => createProtectedResourceFetch({
  deniedHostnames: [new URL(request.url).hostname],
  transport: async ({ url, method, headers, body }) => ({
    response: await globalThis.__testManagedFormFetch(url, { method, headers, body }),
  }),
});
`
      );
      const { action } = await loadGeneratedIndexAction();
      const received: Array<{ method: string; body: unknown }> = [];
      vi.stubGlobal(
        "__testManagedFormFetch",
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init);
          received.push({ method: request.method, body: await request.json() });
          return Response.json({ accepted: true });
        }
      );
      const submit = (host: string) => {
        const form = new FormData();
        form.set(formIdFieldName, "action");
        form.set(formBotFieldName, "brave");
        form.set("message", "Hello");
        return action({
          request: new Request(`https://${host}/`, {
            method: "POST",
            headers: { host },
            body: form,
          }),
          context: {},
        });
      };
      await expect(submit("example.com")).resolves.toEqual({ success: true });
      expect(received).toEqual([{ method: "PUT", body: { message: "Hello" } }]);
      const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await expect(submit("receiver.example")).resolves.toEqual({
          success: false,
          errors: ["Resource destination is not allowed"],
        });
      } finally {
        errorLog.mockRestore();
      }
      expect(received).toHaveLength(1);
    }
  );

  test.each(
    ["defaults", "react-router"].flatMap((template) =>
      [0, 1, 6].map((recipients) => [template, recipients] as const)
    )
  )(
    "sends and preflights deprecated Webhook Form emails through the Form sender (%s, %i configured recipients)",
    async (template, recipientCount) => {
      const siteData = createSiteData({
        instances: [
          ["root", { id: "root", component: "WebhookForm", children: [] }],
        ],
        pageMeta: { contactEmail: "owner@example.com" },
      });
      if (recipientCount > 0) {
        siteData.build.props = [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "resource",
              value: "email",
            },
          ],
        ];
        siteData.build.resources = [
          [
            "email",
            {
              id: "email",
              name: "Email",
              control: "email",
              method: "post",
              url: '""',
              headers: [],
              email: {
                recipientMode: "custom",
                recipients: Array.from(
                  { length: recipientCount },
                  (_, index) => `person${index}@example.com`
                ).join(", "),
                subject: '"Saved subject"',
                body: '"Saved message"',
              },
            },
          ],
        ];
      }
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await writeFile(
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
        "export const createManagedFormEmailSender = () => globalThis.__testSendEmail;\nexport const validateManagedFormEmail = (...args) => globalThis.__testValidateEmail(...args);\nexport const createManagedFormResourceFetch = () => Object.assign(fetch, { validateDestination: () => undefined });\n"
      );
      const { action } = await loadGeneratedIndexAction();
      const validateEmail = vi.fn();
      vi.stubGlobal("__testValidateEmail", validateEmail);
      const messages: ResourceRequest[] = [];
      vi.stubGlobal("__testSendEmail", async (resource: ResourceRequest) => {
        messages.push(resource);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          data: { id: "sent" },
        };
      });
      const form = new FormData();
      form.set(formBotFieldName, "brave");
      if (recipientCount > 0) {
        form.set(formIdFieldName, "action");
      }
      form.set("message", "Hello");
      if (recipientCount > 5) {
        const errorLog = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        try {
          await expect(
            action({
              request: new Request("https://example.com/", {
                method: "POST",
                headers: { host: "example.com" },
                body: form,
              }),
              context: {},
            })
          ).resolves.toEqual({
            success: false,
            errors: [
              "Select no more than 5 team email recipients per Form submission",
            ],
          });
        } finally {
          errorLog.mockRestore();
        }
        expect(messages).toHaveLength(0);
        return;
      }
      await expect(
        action({
          request: new Request("https://example.com/", {
            method: "POST",
            headers: { host: "example.com" },
            body: form,
          }),
          context: {},
        })
      ).resolves.toEqual({ success: true });
      expect(messages).toHaveLength(1);
      expect(messages[0]?.control).toBe("email");
      expect(messages[0]?.email?.recipients).toEqual([
        {
          address:
            recipientCount > 0 ? "person0@example.com" : "owner@example.com",
        },
      ]);
      expect(messages[0]?.email?.headers?.["X-Message-ID"]).toEqual(
        expect.any(String)
      );
      expect(validateEmail).toHaveBeenCalledOnce();
      vi.stubGlobal("__testSendEmail", async () => ({
        ok: false,
        status: 503,
        statusText: "Email service is unavailable",
        data: {
          error: {
            code: "EMAIL_SERVICE_UNAVAILABLE",
            message: "Email service is unavailable",
          },
        },
      }));
      await expect(
        action({
          request: new Request("https://example.com/", {
            method: "POST",
            headers: { host: "example.com" },
            body: form,
          }),
          context: {},
        })
      ).resolves.toEqual({
        success: false,
        errors: ["Email service is unavailable"],
      });
    }
  );

  test.each(["defaults", "react-router"])(
    "submits identical deprecated Webhook Forms twice while caching dependencies (%s)",
    async (template) => {
      const siteData = createSiteData({
        instances: [["root", { id: "root", component: "Form", children: [] }]],
        props: [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "resource",
              value: "submit",
            },
          ],
        ],
      });
      // OrganizeOS fork: a data source and its Resource have their own ids,
      // as the builder writes them; one with a Resource's id is left out
      // while org script is paused (docs/ORGANIZEOS-FORK.md section 10)
      siteData.build.dataSources = [
        [
          "author-source",
          {
            id: "author-source",
            name: "Author",
            type: "resource",
            resourceId: "author",
            scopeInstanceId: "root",
          },
        ],
      ];
      siteData.build.resources = [
        [
          "author",
          {
            id: "author",
            name: "Author",
            method: "post",
            url: '"https://receiver.example/author"',
            body: '{ query: "author" }',
            headers: [{ name: "Cache-Control", value: '"public, max-age=60"' }],
          },
        ],
        [
          "submit",
          {
            id: "submit",
            name: "Submit",
            method: "post",
            url: `"https://receiver.example/submit/" + ${encodeDataSourceVariable(
              "author-source"
            )}.data.id`,
            headers: [{ name: "Cache-Control", value: '"public, max-age=60"' }],
          },
        ],
      ];
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await writeFile(
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
        "export const createManagedFormEmailSender = () => undefined;\nexport const validateManagedFormEmail = () => undefined;\nexport const createManagedFormResourceFetch = () => Object.assign(fetch, { validateDestination: () => undefined });\n"
      );
      const { action } = await loadGeneratedIndexAction();
      const cached = new Map<string, Response>();
      vi.stubGlobal("caches", {
        open: async () => ({
          match: async (key: URL) => cached.get(key.href)?.clone(),
          put: async (key: URL, response: Response) => {
            cached.set(key.href, response.clone());
          },
        }),
      });
      const received: Array<{ url: string; body: unknown }> = [];
      vi.stubGlobal(
        "fetch",
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init);
          received.push({ url: request.url, body: await request.json() });
          return Response.json({ id: "author-123" });
        }
      );
      const expired = (Date.now() - 300_001).toString(16);
      const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        for (const [botValues, error] of [
          [[], "Form bot field not found"],
          [["malformed"], "Form bot value invalid malformed"],
          [[expired], `Form bot value invalid ${expired}`],
          [["stale", Date.now().toString(16)], "Form bot value invalid stale"],
        ] as const) {
          const invalidForm = new FormData();
          invalidForm.set(formIdFieldName, "action");
          for (const value of botValues) {
            invalidForm.append(formBotFieldName, value);
          }
          await expect(
            action({
              request: new Request("https://example.com/", {
                method: "POST",
                headers: { host: "example.com" },
                body: invalidForm,
              }),
              context: {},
            })
          ).resolves.toEqual({ success: false, errors: [error] });
        }
      } finally {
        errorLog.mockRestore();
      }
      expect(received).toHaveLength(0);
      for (let index = 0; index < 2; index += 1) {
        const form = new FormData();
        form.set(formIdFieldName, "action");
        form.set(formBotFieldName, "brave");
        form.set("message", "Hello");
        await expect(
          action({
            request: new Request("https://example.com/", {
              method: "POST",
              headers: { host: "example.com" },
              body: form,
            }),
            context: {},
          })
        ).resolves.toEqual({ success: true });
      }
      expect(received).toEqual([
        { url: "https://receiver.example/author", body: { query: "author" } },
        {
          url: "https://receiver.example/submit/author-123",
          body: { message: "Hello" },
        },
        {
          url: "https://receiver.example/submit/author-123",
          body: { message: "Hello" },
        },
      ]);
    }
  );

  test.each(["defaults", "react-router"])(
    "rejects invalid managed Form actions before any request (%s)",
    async (template) => {
      const configurations = [
        ["empty", []],
        [
          "too-many",
          Array(11)
            .fill("destination")
            .map((dataSourceId) => ({ dataSourceId })),
        ],
        [
          "duplicate",
          [{ dataSourceId: "destination" }, { dataSourceId: "destination" }],
        ],
        ["missing", [{ dataSourceId: "missing" }]],
        ["malformed", { destinations: "destination" }],
        ["native", { mode: "native", destinations: ["destination"] }],
        ["valid", [{ dataSourceId: "destination" }]],
      ] as const;
      const siteData = createSiteData({
        instances: [
          [
            "root",
            {
              id: "root",
              component: "Box",
              children: configurations.map(([id]) => ({
                type: "id",
                value: id,
              })),
            },
          ],
          ...configurations.map(
            ([id]) =>
              [id, { id, component: "ResourceForm", children: [] }] as [
                string,
                Omit<Instance, "type">,
              ]
          ),
        ],
        props: configurations.map(([id, value]) => [
          `${id}-action`,
          {
            id: `${id}-action`,
            instanceId: id,
            name: "action",
            type: "json",
            value,
          },
        ]),
      });
      siteData.build.dataSources = [
        [
          "destination",
          {
            id: "destination",
            name: "Destination",
            type: "resource",
            resourceId: "remote",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "remote",
          {
            id: "remote",
            name: "Remote",
            method: "post",
            url: '"https://example.com/endpoint"',
            headers: [],
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await writeFile(
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
        "export const createManagedFormEmailSender = () => undefined;\nexport const validateManagedFormEmail = () => undefined;\nexport const createManagedFormResourceFetch = () => globalThis.__testManagedFormFetch;\n"
      );
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents: `export { action } from "./app/routes/_index";
            export { action as endpointAction } from "./app/routes/${generateRemixRoute(
              "/__ws-form"
            )}";`,
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "action.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { action, endpointAction } = await import(
        pathToFileURL(join(tempDir, "action.mjs")).href
      );
      const outgoingFetch = vi.fn(async () => Response.json({ ok: true }));
      vi.stubGlobal("__testManagedFormFetch", outgoingFetch);
      const submit = (id: string, fields: Record<string, string> = {}) => {
        const form = new FormData();
        form.set(managedFormIdFieldName, id);
        form.set("message", "Hello");
        for (const [name, value] of Object.entries(fields)) {
          form.set(name, value);
        }
        return action({
          request: new Request(
            `https://example.com/?${managedFormRequestParamName}=1`,
            {
              method: "POST",
              headers: { host: "example.com" },
              body: form,
            }
          ),
          context: {},
        });
      };

      for (const [id, error] of [
        ["unknown", "Form submission settings not found"],
        ["empty", "Select at least one Resource action"],
        ["too-many", "Select no more than 10 Resource actions"],
        ["duplicate", "Select each Resource only once"],
        ["missing", "Resource destination not found"],
        ["malformed", "Form submission settings not found"],
        ["native", "Form submission settings not found"],
      ]) {
        await expect(submit(id)).resolves.toEqual(getManagedFormFailure(error));
      }
      await expect(submit("valid")).resolves.toEqual(
        getManagedFormFailure("Form bot field not found")
      );
      await expect(
        submit("valid", { [formBotFieldName]: "stale" })
      ).resolves.toEqual(getManagedFormFailure("Form bot value invalid stale"));
      const malformedHex = `${Date.now().toString(16)}not-hex`;
      await expect(
        submit("valid", { [formBotFieldName]: malformedHex })
      ).resolves.toEqual(
        getManagedFormFailure(`Form bot value invalid ${malformedHex}`)
      );
      await expect(
        submit("valid", {
          [formBotFieldName]: "brave",
          [managedFormArrayNamesFieldName]: "not-json",
        })
      ).resolves.toEqual(getManagedFormFailure("Invalid Form field groups"));
      const unmarked = new FormData();
      unmarked.set(managedFormIdFieldName, "valid");
      unmarked.set(formBotFieldName, "brave");
      await expect(
        action({
          request: new Request("https://example.com/", {
            method: "POST",
            headers: { host: "example.com" },
            body: unmarked,
          }),
          context: {},
        })
      ).resolves.toEqual({
        success: false,
        errors: ["Invalid Form submission"],
      });
      expect(outgoingFetch).not.toHaveBeenCalled();
      vi.stubGlobal("navigator", { brave: { isBrave: () => true } });
      await expect(
        submitManagedForm({
          values: { message: "Hello" },
          managedFormId: "valid",
          location: "https://example.com/?source=staging",
          fetch: async (input, init) => {
            const response: Response = await endpointAction({
              request: new Request(input, {
                ...init,
                headers: { host: "example.com" },
              }),
              context: {},
            });
            expect(response.headers.get("content-type")).toContain(
              "application/json"
            );
            return response;
          },
        })
      ).resolves.toEqual({
        success: true,
        status: 200,
        results: [
          {
            resourceId: "remote",
            resourceName: expect.any(String),
            status: 200,
            body: { ok: true },
          },
        ],
        errors: [],
      });
      expect(outgoingFetch).toHaveBeenCalledOnce();
    }
  );

  test.each(["defaults", "react-router"])(
    "serves managed Form results as JSON through the framework HTTP handler (%s)",
    async (template) => {
      await writeSiteData(
        createSiteData({
          pages: [
            {
              id: "home",
              name: "Home",
              title: "Home",
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
            {
              id: "help",
              name: "Help",
              title: "Help",
              path: "/help/contact",
              rootInstanceId: "root",
              meta: {},
            },
            {
              id: "product",
              name: "Product",
              title: "Product",
              path: "/products/:slug",
              rootInstanceId: "root",
              meta: {},
            },
          ],
          instances: [
            ["root", { id: "root", component: "ResourceForm", children: [] }],
          ],
          props: [
            [
              "action",
              {
                id: "action",
                instanceId: "root",
                name: "action",
                type: "json",
                value: [],
              },
            ],
          ],
        })
      );
      await prebuild({ assets: false, template: [template] });
      if (template === "react-router") {
        await linkPackagedPreviewDependencies();
        await runGeneratedCommand("react-router", ["build"]);
      } else {
        await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
        const viteConfig = await readFile("vite.config.ts", "utf8");
        await writeFile(
          "vite.config.ts",
          viteConfig
            .replaceAll(
              'conditions: ["browser", "development|production"]',
              'conditions: ["webstudio", "browser", "development|production"]'
            )
            .replaceAll(
              'conditions: ["node", "development|production"]',
              'conditions: ["webstudio", "node", "development|production"]'
            )
        );
        await runGeneratedCommand("remix", ["vite:build"]);
      }
      const serverEntry = pathToFileURL(
        join(tempDir, "build/server/index.js")
      ).href;
      const handlerPackage =
        template === "react-router"
          ? "react-router"
          : "@remix-run/server-runtime";
      const runner = `
        import { createRequestHandler } from ${JSON.stringify(handlerPackage)};
        const serverBuild = await import(${JSON.stringify(serverEntry)});
        const handleRequest = createRequestHandler(serverBuild, "production");
        const results = [];
        for (const path of ["/__ws-form", "/__ws-form/help/contact", "/__ws-form/products/chair"]) {
          const form = new FormData();
          form.set(${JSON.stringify(managedFormIdFieldName)}, "root");
          form.set(${JSON.stringify(formBotFieldName)}, "brave");
          form.set(${JSON.stringify(managedFormArrayNamesFieldName)}, "[]");
          const response = await handleRequest(new Request(
            new URL(path, "https://example.com"),
            { method: "POST", body: form, headers: { host: "example.com" } }
          ));
          results.push({
            status: response.status,
            contentType: response.headers.get("content-type"),
            body: await response.json(),
          });
        }
        process.stdout.write(JSON.stringify(results));
      `;
      const { stdout } = await execFileAsync(
        process.execPath,
        [
          "--import",
          pathToFileURL(
            join(originalCwd, "../../node_modules/tsx/dist/loader.mjs")
          ).href,
          "--input-type=module",
          "-e",
          runner,
        ],
        {
          cwd: tempDir,
          env: { ...process.env, NODE_OPTIONS: "--conditions=webstudio" },
        }
      );
      const results = JSON.parse(stdout) as {
        status: number;
        contentType: string;
        body: unknown;
      }[];
      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result.status).toBe(400);
        expect(result.contentType).toContain("application/json");
        expect(result.body).toEqual(
          getManagedFormFailure("Select at least one Resource action")
        );
      }
    },
    60_000
  );

  test.each(["defaults", "react-router"])(
    "generates managed Form endpoints for root, nested, and dynamic pages (%s)",
    async (template) => {
      await writeSiteData(
        createSiteData({
          pages: [
            {
              id: "home",
              name: "Home",
              title: "Home",
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
            {
              id: "help",
              name: "Help",
              title: "Help",
              path: "/help/contact",
              rootInstanceId: "root",
              meta: {},
            },
            {
              id: "product",
              name: "Product",
              title: "Product",
              path: "/products/:slug",
              rootInstanceId: "root",
              meta: {},
            },
          ],
          instances: [
            ["root", { id: "root", component: "ResourceForm", children: [] }],
          ],
        })
      );
      await prebuild({ assets: false, template: [template] });
      for (const path of ["/", "/help/contact", "/products/:slug"]) {
        const endpointPath = path === "/" ? "/__ws-form" : `/__ws-form${path}`;
        await expect(
          readFile(
            join("app/routes", `${generateRemixRoute(endpointPath)}.tsx`),
            "utf8"
          )
        ).resolves.toContain("return Response.json(result");
      }
    }
  );

  test.each(["defaults", "react-router"])(
    "returns successful Resource results through the framework HTTP handler (%s)",
    async (template) => {
      const received: string[] = [];
      const receiver = createServer((request, response) => {
        received.push(request.url ?? "");
        response.writeHead(201, { "content-type": "application/json" });
        response.end(JSON.stringify({ accepted: true }));
      });
      await new Promise<void>((resolve) =>
        receiver.listen(0, "127.0.0.1", resolve)
      );
      try {
        const address = receiver.address();
        if (address === null || typeof address === "string") {
          throw new Error("Mock Resource server did not start");
        }
        const siteData = createSiteData({
          instances: [
            ["root", { id: "root", component: "ResourceForm", children: [] }],
          ],
          props: [
            [
              "action",
              {
                id: "action",
                instanceId: "root",
                name: "action",
                type: "json",
                value: [{ dataSourceId: "destination" }],
              },
            ],
          ],
        });
        siteData.build.dataSources = [
          [
            "destination",
            {
              id: "destination",
              name: "Destination",
              type: "resource",
              resourceId: "remote",
              scopeInstanceId: "root",
            },
          ],
        ] as never;
        siteData.build.resources = [
          [
            "remote",
            {
              id: "remote",
              name: "Remote",
              method: "post",
              url: JSON.stringify(`http://127.0.0.1:${address.port}/accept`),
              headers: [],
            },
          ],
        ] as never;
        await writeSiteData(siteData);
        await prebuild({ assets: false, template: [template] });
        // The production module blocks loopback; this test replaces only the
        // temporary site's fetch provider to exercise an actual local server.
        await writeFile(
          join(
            tempDir,
            "app/__generated__/$resources.managed-form-fetch.server.ts"
          ),
          "export const createManagedFormEmailSender = () => undefined;\nexport const validateManagedFormEmail = () => undefined;\nexport const createManagedFormResourceFetch = () => fetch;\n"
        );
        if (template === "react-router") {
          await linkPackagedPreviewDependencies();
          await runGeneratedCommand("react-router", ["build"]);
        } else {
          await symlink(
            join(originalCwd, "node_modules"),
            "node_modules",
            "dir"
          );
          const viteConfig = await readFile("vite.config.ts", "utf8");
          await writeFile(
            "vite.config.ts",
            viteConfig
              .replaceAll(
                'conditions: ["browser", "development|production"]',
                'conditions: ["webstudio", "browser", "development|production"]'
              )
              .replaceAll(
                'conditions: ["node", "development|production"]',
                'conditions: ["webstudio", "node", "development|production"]'
              )
          );
          await runGeneratedCommand("remix", ["vite:build"]);
        }
        const serverEntry = pathToFileURL(
          join(tempDir, "build/server/index.js")
        ).href;
        const handlerPackage =
          template === "react-router"
            ? "react-router"
            : "@remix-run/server-runtime";
        const runner = `
          import { createRequestHandler } from ${JSON.stringify(
            handlerPackage
          )};
          const build = await import(${JSON.stringify(serverEntry)});
          const handleRequest = createRequestHandler(build, "production");
          const form = new FormData();
          form.set(${JSON.stringify(managedFormIdFieldName)}, "root");
          form.set(${JSON.stringify(formBotFieldName)}, "brave");
          form.set(${JSON.stringify(managedFormArrayNamesFieldName)}, "[]");
          form.set("message", "Hello");
          const response = await handleRequest(new Request("https://example.com/__ws-form", {
            method: "POST", body: form, headers: { host: "example.com" },
          }));
          process.stdout.write(JSON.stringify({
            status: response.status,
            contentType: response.headers.get("content-type"),
            body: await response.json(),
          }));
        `;
        const { stdout } = await execFileAsync(
          process.execPath,
          [
            "--import",
            pathToFileURL(
              join(originalCwd, "../../node_modules/tsx/dist/loader.mjs")
            ).href,
            "--input-type=module",
            "-e",
            runner,
          ],
          {
            cwd: tempDir,
            env: { ...process.env, NODE_OPTIONS: "--conditions=webstudio" },
          }
        );
        const result = JSON.parse(stdout) as {
          status: number;
          contentType: string;
          body: unknown;
        };
        expect(result.status).toBe(200);
        expect(result.contentType).toContain("application/json");
        expect(result.body).toEqual({
          success: true,
          status: 200,
          results: [
            {
              resourceId: "remote",
              resourceName: expect.any(String),
              status: 201,
              body: { accepted: true },
            },
          ],
          errors: [],
        });
        expect(received).toEqual(["/accept"]);
      } finally {
        await new Promise<void>((resolve) => receiver.close(() => resolve()));
      }
    },
    60_000
  );

  test.each(["/__ws-form", "/__ws-form/submissions", "/__ws-form/:slug"])(
    "rejects a page under the reserved managed Form endpoint (%s)",
    async (path) => {
      await writeSiteData(
        createSiteData({
          pages: [
            {
              id: "home",
              name: "Home",
              title: "Home",
              path: "",
              rootInstanceId: "root",
              meta: {},
            },
            {
              id: "reserved",
              name: "Reserved",
              title: "Reserved",
              path,
              rootInstanceId: "root",
              meta: {},
            },
          ],
          instances: [
            ["root", { id: "root", component: "ResourceForm", children: [] }],
          ],
        })
      );
      await expect(
        prebuild({ assets: false, template: ["react-router"] })
      ).rejects.toThrow("uses the reserved Form endpoint");
    }
  );

  test("keeps an authored reserved-prefix page when no managed Form is present", async () => {
    await writeSiteData(
      createSiteData({
        pages: [
          {
            id: "home",
            name: "Home",
            title: "Home",
            path: "",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "reserved",
            name: "Reserved",
            title: "Reserved",
            path: "/__ws-form",
            rootInstanceId: "root",
            meta: {},
          },
        ],
      })
    );
    await expect(
      prebuild({ assets: false, template: ["react-router"] })
    ).resolves.toBeUndefined();
  });

  test("keeps a published reserved-prefix page when only a draft has a managed Form", async () => {
    await writeSiteData(
      createSiteData({
        pages: [
          {
            id: "home",
            name: "Home",
            title: "Home",
            path: "",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "reserved",
            name: "Reserved",
            title: "Reserved",
            path: "/__ws-form",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "draft",
            name: "Draft",
            title: "Draft",
            path: "/draft",
            rootInstanceId: "draft-form",
            meta: {},
            isDraft: true,
          },
        ],
        instances: [
          ["root", { id: "root", component: "Box", children: [] }],
          [
            "draft-form",
            { id: "draft-form", component: "ResourceForm", children: [] },
          ],
        ],
      })
    );
    await expect(
      prebuild({ assets: false, template: ["react-router"] })
    ).resolves.toBeUndefined();
    await expect(
      readFile("app/routes/[__ws-form]._index.tsx", "utf8")
    ).resolves.toContain("export default");
  });

  test.each([
    ["defaults", 2],
    ["defaults", 3],
    ["react-router", 2],
    ["react-router", 3],
  ] as const)(
    "preflights Email deliveries before sibling HTTP dispatch (%s, %i project recipients)",
    async (template, projectRecipientCount) => {
      const siteData = createSiteData({
        instances: [
          ["root", { id: "root", component: "ResourceForm", children: [] }],
        ],
        props: [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "json",
              value: [
                { dataSourceId: "http-source" },
                { dataSourceId: "project-source" },
                { dataSourceId: "custom-source" },
              ],
            },
          ],
        ],
        pageMeta: {
          contactEmail:
            projectRecipientCount === 2
              ? "first@example.com, first@example.com"
              : "first@example.com, first@example.com, third@example.com",
        },
      });
      siteData.build.dataSources = [
        [
          "http-source",
          {
            id: "http-source",
            name: "HTTP",
            type: "resource",
            resourceId: "http",
            scopeInstanceId: "root",
          },
        ],
        [
          "project-source",
          {
            id: "project-source",
            name: "Project Email",
            type: "resource",
            resourceId: "project-email",
            scopeInstanceId: "root",
          },
        ],
        [
          "custom-source",
          {
            id: "custom-source",
            name: "Custom Email",
            type: "resource",
            resourceId: "custom-email",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "http",
          {
            id: "http",
            name: "HTTP",
            method: "post",
            url: '"https://example.com/submit"',
            headers: [],
          },
        ],
        [
          "project-email",
          {
            id: "project-email",
            name: "Project Email",
            control: "email",
            method: "post",
            url: '""',
            headers: [],
          },
        ],
        [
          "custom-email",
          {
            id: "custom-email",
            name: "Custom Email",
            control: "email",
            method: "post",
            url: '""',
            headers: [],
            email: {
              recipientMode: "custom",
              recipients:
                "fourth@example.com, fifth@example.com, fifth@example.com",
            },
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents: 'export { action } from "./app/routes/_index"',
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "recipient-limit-action.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { action } = await import(
        pathToFileURL(join(tempDir, "recipient-limit-action.mjs")).href
      );
      const outgoingFetch = vi.fn(async () => Response.json({ ok: true }));
      vi.stubGlobal("fetch", outgoingFetch);
      const formData = new FormData();
      formData.set(managedFormIdFieldName, "root");
      formData.set(managedFormArrayNamesFieldName, "[]");
      formData.set(formBotFieldName, "brave");
      formData.set("message", "Hello");
      await expect(
        action({
          request: new Request(
            `https://example.com/?${managedFormRequestParamName}=1`,
            {
              method: "POST",
              headers: { host: "example.com" },
              body: formData,
            }
          ),
          context: {},
        })
      ).resolves.toEqual(
        getManagedFormFailure(
          projectRecipientCount === 2
            ? "Email delivery requires Webstudio Cloud and is not configured yet"
            : "Select no more than 5 team email recipients per Form submission"
        )
      );
      expect(outgoingFetch).not.toHaveBeenCalled();
    }
  );

  test.each(["defaults", "react-router"])(
    "preflights a dependent Email before HTTP dispatch (%s)",
    async (template) => {
      const siteData = createSiteData({
        instances: [
          ["root", { id: "root", component: "ResourceForm", children: [] }],
        ],
        props: [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "json",
              value: [{ dataSourceId: "http-source" }],
            },
          ],
        ],
        pageMeta: { contactEmail: "owner@example.com" },
      });
      siteData.build.dataSources = [
        [
          "email-source",
          {
            id: "email-source",
            name: "Email",
            type: "resource",
            resourceId: "email",
            scopeInstanceId: "root",
          },
        ],
        [
          "http-source",
          {
            id: "http-source",
            name: "HTTP",
            type: "resource",
            resourceId: "http",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "email",
          {
            id: "email",
            name: "Email",
            control: "email",
            method: "post",
            url: '""',
            headers: [],
          },
        ],
        [
          "http",
          {
            id: "http",
            name: "HTTP",
            method: "post",
            url: '"https://example.com/submit"',
            headers: [],
            body: encodeDataSourceVariable("email-source"),
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents: 'export { action } from "./app/routes/_index"',
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "dependent-email-action.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { action } = await import(
        pathToFileURL(join(tempDir, "dependent-email-action.mjs")).href
      );
      const outgoingFetch = vi.fn(async () => Response.json({ ok: true }));
      vi.stubGlobal("fetch", outgoingFetch);
      const formData = new FormData();
      formData.set(managedFormIdFieldName, "root");
      formData.set(managedFormArrayNamesFieldName, "[]");
      formData.set(formBotFieldName, "brave");
      await expect(
        action({
          request: new Request(
            `https://example.com/?${managedFormRequestParamName}=1`,
            {
              method: "POST",
              headers: { host: "example.com" },
              body: formData,
            }
          ),
          context: {},
        })
      ).resolves.toEqual(
        getManagedFormFailure(
          "Email delivery requires Webstudio Cloud and is not configured yet"
        )
      );
      expect(outgoingFetch).not.toHaveBeenCalled();
    }
  );

  test("generates submit-time Resource requests with Form parameters", async () => {
    const siteData = createSiteData({
      formComponentIdentityVersion: 1,
      instances: [["root", { id: "root", component: "Form", children: [] }]],
      props: [
        [
          "action",
          {
            id: "action",
            instanceId: "root",
            name: "action",
            type: "json",
            value: [{ dataSourceId: "destination" }],
          },
        ],
      ],
    });
    siteData.build.dataSources = [
      [
        "formData",
        {
          id: "formData",
          name: "formData",
          type: "parameter",
          scopeInstanceId: "root",
        },
      ],
      [
        "destination",
        {
          id: "destination",
          name: "Destination",
          type: "resource",
          resourceId: "remote",
          scopeInstanceId: "root",
        },
      ],
    ] as never;
    siteData.build.resources = [
      [
        "remote",
        {
          id: "remote",
          name: "Remote",
          method: "get",
          url: '"https://example.com/submit"',
          headers: [],
          body: encodeDataSourceVariable("formData"),
        },
      ],
    ] as never;
    await writeSiteData(siteData);
    await prebuild({ assets: false, template: ["react-router"] });
    await build({
      entryPoints: ["app/__generated__/_index.server.tsx"],
      absWorkingDir: tempDir,
      outfile: join(tempDir, "managed-graph.mjs"),
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
    });
    const { getManagedFormResourceGraph } = await import(
      pathToFileURL(join(tempDir, "managed-graph.mjs")).href
    );
    const formData = { message: "Hello" };
    const graph = getManagedFormResourceGraph("root", {
      system: {},
      formData,
      browserInfo: {},
    });
    expect(graph.rootIds).toEqual(["remote"]);
    expect(graph.resources[0].createRequest(new Map())).toMatchObject({
      method: "post",
      body: formData,
    });
  });

  test(
    "typechecks generated Email bindings in page and managed Form Resources",
    async () => {
      const siteData = createSiteData({
        instances: [
          ["root", { id: "root", component: "ResourceForm", children: [] }],
        ],
        props: [
          [
            "page-email-prop",
            {
              id: "page-email-prop",
              instanceId: "root",
              name: "value",
              type: "expression",
              value: encodeDataSourceVariable("pageEmailSource"),
            },
          ],
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "json",
              value: [{ dataSourceId: "emailDestination" }],
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          "sender",
          {
            id: "sender",
            name: "sender",
            type: "variable",
            value: { type: "string", value: "Acme <sender@example.com>" },
            scopeInstanceId: "root",
          },
        ],
        [
          "formData",
          {
            id: "formData",
            name: "formData",
            type: "parameter",
            scopeInstanceId: "root",
          },
        ],
        [
          "recipients",
          {
            id: "recipients",
            name: "recipients",
            type: "variable",
            value: { type: "string", value: "team@example.com" },
            scopeInstanceId: "root",
          },
        ],
        [
          "pageEmailSource",
          {
            id: "pageEmailSource",
            name: "Page email",
            type: "resource",
            resourceId: "page-email",
            scopeInstanceId: "root",
          },
        ],
        [
          "emailDestination",
          {
            id: "emailDestination",
            name: "Email",
            type: "resource",
            resourceId: "email",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "page-email",
          {
            id: "page-email",
            name: "Page Email",
            control: "email",
            method: "post",
            url: '""',
            headers: [],
            email: {
              senderExpression: encodeDataSourceVariable("sender"),
            },
          },
        ],
        [
          "email",
          {
            id: "email",
            name: "Email",
            control: "email",
            method: "post",
            url: '""',
            headers: [],
            email: {
              recipientMode: "custom",
              recipientsExpression: encodeDataSourceVariable("recipients"),
              body: `\`Submitted fields: \${${encodeDataSourceVariable(
                "formData"
              )}}\``,
            },
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: ["react-router"] });
      const serverModule = await readFile(
        "app/__generated__/_index.server.tsx",
        "utf8"
      );
      expect(
        serverModule.match(
          /import \{ resolveEmailRecipientsExpression, resolveEmailSenderSettingsExpression \} from "@webstudio-is\/sdk";/g
        )
      ).toHaveLength(1);
      expect(
        serverModule.match(/resolveEmailRecipientsExpression/g)
      ).toHaveLength(2);
      expect(
        serverModule.match(/resolveEmailSenderSettingsExpression/g)
      ).toHaveLength(2);
      await writeFile(
        "email-typecheck.ts",
        'export { getResources, getManagedFormResourceGraph } from "./app/__generated__/_index.server";'
      );
      await linkPackagedPreviewDependencies();
      await runGeneratedCommand("tsc", [
        "--ignoreConfig",
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--moduleResolution",
        "bundler",
        "--customConditions",
        "webstudio",
        "--module",
        "esnext",
        "--target",
        "es2023",
        "--types",
        "node",
        "--typeRoots",
        join(originalCwd, "../../node_modules/@types"),
        "--jsx",
        "react-jsx",
        "email-typecheck.ts",
      ]).catch((error: unknown) => {
        throw new Error(
          error instanceof Error && "stdout" in error
            ? String(error.stdout)
            : String(error)
        );
      });
    },
    slowPrebuildTestTimeout
  );

  test(
    "typechecks a page-level Email binding without a managed Form",
    async () => {
      const siteData = createSiteData({
        instances: [["root", { id: "root", component: "Box", children: [] }]],
        props: [
          [
            "page-email-prop",
            {
              id: "page-email-prop",
              instanceId: "root",
              name: "value",
              type: "expression",
              value: encodeDataSourceVariable("pageEmailSource"),
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          "sender",
          {
            id: "sender",
            name: "sender",
            type: "variable",
            value: { type: "string", value: "Acme <sender@example.com>" },
            scopeInstanceId: "root",
          },
        ],
        [
          "recipients",
          {
            id: "recipients",
            name: "recipients",
            type: "variable",
            value: {
              type: "string",
              value: "team@example.com, support@example.com",
            },
            scopeInstanceId: "root",
          },
        ],
        [
          "pageEmailSource",
          {
            id: "pageEmailSource",
            name: "Page email",
            type: "resource",
            resourceId: "email",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "email",
          {
            id: "email",
            name: "Email",
            control: "email",
            method: "post",
            url: '""',
            headers: [],
            email: {
              recipientMode: "custom",
              senderExpression: encodeDataSourceVariable("sender"),
              recipientsExpression: encodeDataSourceVariable("recipients"),
              subject: '"Subject"',
              body: '"Body"',
            },
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: ["react-router"] });
      const serverModule = await readFile(
        "app/__generated__/_index.server.tsx",
        "utf8"
      );
      expect(
        serverModule.match(
          /import \{ resolveEmailRecipientsExpression, resolveEmailSenderSettingsExpression \} from "@webstudio-is\/sdk";/g
        )
      ).toHaveLength(1);
      await writeFile(
        "email-typecheck.ts",
        'export { getResources } from "./app/__generated__/_index.server";'
      );
      await linkPackagedPreviewDependencies();
      await runGeneratedCommand("tsc", [
        "--ignoreConfig",
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--moduleResolution",
        "bundler",
        "--customConditions",
        "webstudio",
        "--module",
        "esnext",
        "--target",
        "es2023",
        "--types",
        "node",
        "--typeRoots",
        join(originalCwd, "../../node_modules/@types"),
        "--jsx",
        "react-jsx",
        "email-typecheck.ts",
      ]).catch((error: unknown) => {
        throw new Error(
          error instanceof Error && "stdout" in error
            ? String(error.stdout)
            : String(error)
        );
      });
    },
    slowPrebuildTestTimeout
  );

  test.each(["defaults", "react-router"])(
    "runs a visitor Email Resource from the generated Form route (%s)",
    async (template) => {
      const siteData = createSiteData({
        instances: [
          [
            "root",
            {
              id: "root",
              component: "ResourceForm",
              children: [{ type: "id", value: "email-input" }],
            },
          ],
          [
            "email-input",
            { id: "email-input", component: "Input", children: [] },
          ],
        ],
        props: [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "json",
              value: [{ dataSourceId: "visitor-source" }],
            },
          ],
          [
            "email-name",
            {
              id: "email-name",
              instanceId: "email-input",
              name: "name",
              type: "string",
              value: "visitorEmail",
            },
          ],
          [
            "email-type",
            {
              id: "email-type",
              instanceId: "email-input",
              name: "type",
              type: "string",
              value: "email",
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          "visitor-source",
          {
            id: "visitor-source",
            name: "Receipt",
            type: "resource",
            resourceId: "visitor-email",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "visitor-email",
          {
            id: "visitor-email",
            name: "Receipt",
            control: "email",
            method: "post",
            url: '""',
            headers: [],
            email: {
              recipientMode: "visitor",
              visitorEmailField: "visitorEmail",
              subject: '"Receipt"',
              body: '"Custom text"',
            },
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await writeFile(
        "app/__generated__/$resources.managed-form-fetch.server.ts",
        `export const createManagedFormEmailSender = () => globalThis.__testSendEmail;
export const validateManagedFormEmail = () => undefined;
export const createManagedFormResourceFetch = () => globalThis.__testManagedFormFetch;
`
      );
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents: 'export { action } from "./app/routes/_index"',
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "visitor-email-action.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { action } = await import(
        pathToFileURL(join(tempDir, "visitor-email-action.mjs")).href
      );
      const sendEmail = vi.fn(async (_request: ResourceRequest) => ({
        ok: true,
        status: 200,
        statusText: "OK",
        data: { id: "sent" },
      }));
      const httpFetch = vi.fn(async () => Response.json({ accepted: true }));
      vi.stubGlobal("__testSendEmail", sendEmail);
      vi.stubGlobal("__testManagedFormFetch", httpFetch);
      const formData = new FormData();
      formData.set(managedFormIdFieldName, "root");
      formData.set(managedFormArrayNamesFieldName, "[]");
      formData.set(formBotFieldName, "brave");
      formData.set("visitorEmail", "visitor@example.com");
      await expect(
        action({
          request: new Request(
            `https://site.example/?${managedFormRequestParamName}=1`,
            {
              method: "POST",
              headers: { host: "site.example" },
              body: formData,
            }
          ),
          context: {},
        })
      ).resolves.toMatchObject({ success: true, status: 200 });
      expect(sendEmail).toHaveBeenCalledOnce();
      expect(sendEmail.mock.calls[0][0].email).toMatchObject({
        recipients: [{ address: "visitor@example.com" }],
        body: "Custom text",
        includeAttachments: true,
      });
      expect(httpFetch).not.toHaveBeenCalled();
    },
    slowPrebuildTestTimeout
  );

  test.each(["defaults", "react-router"])(
    "ignores a spoofed forwarded host when resolving a managed relative Resource (%s)",
    async (template) => {
      const siteData = createSiteData({
        instances: [
          ["root", { id: "root", component: "ResourceForm", children: [] }],
        ],
        props: [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "json",
              value: [{ dataSourceId: "destination" }],
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          "destination",
          {
            id: "destination",
            name: "Destination",
            type: "resource",
            resourceId: "relative",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "relative",
          {
            id: "relative",
            name: "Relative",
            method: "post",
            url: '"/receive"',
            headers: [],
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await writeFile(
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
        `export const createManagedFormEmailSender = () => undefined;
export const validateManagedFormEmail = () => undefined;
export const createManagedFormResourceFetch = () => {
  const protectedFetch = globalThis.__testManagedFormFetch;
  protectedFetch.validateDestination = (url) => {
    if (url.hostname === "site.example") throw new Error("Resource destination is not allowed");
  };
  return protectedFetch;
};
`
      );
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents: 'export { action } from "./app/routes/_index"',
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "spoofed-host-action.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { action } = await import(
        pathToFileURL(join(tempDir, "spoofed-host-action.mjs")).href
      );
      const outbound = vi.fn(async () => Response.json({ accepted: true }));
      vi.stubGlobal("__testManagedFormFetch", outbound);
      const formData = new FormData();
      formData.set(managedFormIdFieldName, "root");
      formData.set(managedFormArrayNamesFieldName, "[]");
      formData.set(formBotFieldName, "brave");
      await expect(
        action({
          request: new Request(
            `https://site.example/?${managedFormRequestParamName}=1`,
            {
              method: "POST",
              headers: {
                host: "site.example",
                "x-forwarded-host": "attacker.example",
              },
              body: formData,
            }
          ),
          context: {},
        })
      ).resolves.toEqual(
        getManagedFormFailure("Resource destination is not allowed")
      );
      expect(outbound).not.toHaveBeenCalled();
    },
    slowPrebuildTestTimeout
  );

  test.each(["defaults", "react-router"])(
    "retries only a failed managed Form destination per submission (%s)",
    async (template) => {
      const siteData = createSiteData({
        instances: [
          ["root", { id: "root", component: "ResourceForm", children: [] }],
        ],
        props: [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "json",
              value: [
                { dataSourceId: "sibling-source" },
                { dataSourceId: "failed-source" },
              ],
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          "dependency-source",
          {
            id: "dependency-source",
            name: "Dependency",
            type: "resource",
            resourceId: "dependency",
            scopeInstanceId: "root",
          },
        ],
        [
          "failed-source",
          {
            id: "failed-source",
            name: "Failed",
            type: "resource",
            resourceId: "failed",
            scopeInstanceId: "root",
          },
        ],
        [
          "sibling-source",
          {
            id: "sibling-source",
            name: "Sibling",
            type: "resource",
            resourceId: "sibling",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "dependency",
          {
            id: "dependency",
            name: "Dependency",
            method: "get",
            url: '"https://receiver.example/dependency"',
            headers: [],
          },
        ],
        [
          "failed",
          {
            id: "failed",
            name: "Failed",
            method: "post",
            url: `"https://receiver.example/failed/" + ${encodeDataSourceVariable(
              "dependency-source"
            )}.data.id`,
            headers: [],
          },
        ],
        [
          "sibling",
          {
            id: "sibling",
            name: "Sibling",
            method: "post",
            url: '"https://receiver.example/sibling"',
            headers: [],
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await writeFile(
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
        "export const createManagedFormEmailSender = () => undefined;\nexport const validateManagedFormEmail = () => undefined;\nexport const createManagedFormResourceFetch = () => globalThis.__testManagedFormFetch;\n"
      );
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents: 'export { action } from "./app/routes/_index"',
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "retry-action.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { action } = await import(
        pathToFileURL(join(tempDir, "retry-action.mjs")).href
      );
      const attempts = new Map<string, number>();
      let failure: "status" | "network" | "timeout" | "persistent" = "status";
      vi.stubGlobal(
        "__testManagedFormFetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          const attempt = (attempts.get(url) ?? 0) + 1;
          attempts.set(url, attempt);
          if (url.endsWith("/dependency")) {
            return Response.json({ id: "resolved" });
          }
          if (url.endsWith("/sibling")) {
            return Response.json(
              { accepted: true },
              { headers: { "Set-Cookie": "private" } }
            );
          }
          if (failure === "persistent") {
            return new Response("Still failed", { status: 422 });
          }
          if (attempt === 1) {
            if (failure === "status") {
              return new Response("Temporary failure", { status: 503 });
            }
            if (failure === "network") {
              throw new Error("Connection lost");
            }
            return new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () =>
                reject(new DOMException("Aborted", "AbortError"))
              );
            });
          }
          return Response.json({ accepted: true });
        })
      );
      const submit = () => {
        const form = new FormData();
        form.set(managedFormIdFieldName, "root");
        form.set(managedFormArrayNamesFieldName, "[]");
        form.set(formBotFieldName, "brave");
        return action({
          request: new Request(
            `https://site.example/?${managedFormRequestParamName}=1`,
            {
              method: "POST",
              headers: { host: "site.example" },
              body: form,
            }
          ),
          context: {},
        });
      };
      const expectAttempts = (failed: number) => {
        expect(attempts.get("https://receiver.example/dependency")).toBe(1);
        expect(attempts.get("https://receiver.example/sibling")).toBe(1);
        expect(attempts.get("https://receiver.example/failed/resolved")).toBe(
          failed
        );
      };

      await expect(submit()).resolves.toEqual({
        success: true,
        status: 200,
        results: [
          {
            resourceId: "sibling",
            resourceName: expect.any(String),
            status: 200,
            body: { accepted: true },
          },
          {
            resourceId: "failed",
            resourceName: expect.any(String),
            status: 200,
            body: { accepted: true },
          },
        ],
        errors: [],
      });
      expectAttempts(2);
      attempts.clear();
      failure = "network";
      const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
      await expect(submit()).resolves.toMatchObject({
        success: true,
        status: 200,
        results: [
          {
            resourceId: "sibling",
            resourceName: expect.any(String),
            status: 200,
            body: { accepted: true },
          },
          {
            resourceId: "failed",
            resourceName: expect.any(String),
            status: 200,
            body: { accepted: true },
          },
        ],
        errors: [],
      });
      expectAttempts(2);
      errorLog.mockRestore();
      attempts.clear();
      failure = "timeout";
      vi.useFakeTimers();
      try {
        const pending = submit();
        await vi.advanceTimersByTimeAsync(10_000);
        await expect(pending).resolves.toMatchObject({
          success: true,
          status: 200,
          results: [
            {
              resourceId: "sibling",
              resourceName: expect.any(String),
              status: 200,
              body: { accepted: true },
            },
            {
              resourceId: "failed",
              resourceName: expect.any(String),
              status: 200,
              body: { accepted: true },
            },
          ],
          errors: [],
        });
        expectAttempts(2);
      } finally {
        vi.useRealTimers();
      }
      attempts.clear();
      failure = "persistent";
      await expect(submit()).resolves.toEqual({
        success: false,
        status: 502,
        results: [
          {
            resourceId: "sibling",
            resourceName: expect.any(String),
            status: 200,
            body: { accepted: true },
          },
          {
            resourceId: "failed",
            resourceName: expect.any(String),
            status: 422,
            body: "Still failed",
          },
        ],
        errors: [
          {
            resourceId: "failed",
            resourceName: expect.any(String),
            status: 422,
            body: "Still failed",
            message: "Resource request failed (422)",
          },
        ],
      });
      expectAttempts(2);
    }
  );

  test.each(["defaults", "react-router"])(
    "rejects a denied selected destination before a valid sibling POST (%s)",
    async (template) => {
      const siteData = createSiteData({
        instances: [
          ["root", { id: "root", component: "ResourceForm", children: [] }],
        ],
        props: [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "json",
              value: [
                { dataSourceId: "valid-source" },
                { dataSourceId: "denied-source" },
              ],
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          "valid-source",
          {
            id: "valid-source",
            name: "Valid",
            type: "resource",
            resourceId: "valid",
            scopeInstanceId: "root",
          },
        ],
        [
          "denied-source",
          {
            id: "denied-source",
            name: "Denied",
            type: "resource",
            resourceId: "denied",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "valid",
          {
            id: "valid",
            name: "Valid",
            method: "post",
            url: '"https://api.example.net/submit"',
            headers: [],
          },
        ],
        [
          "denied",
          {
            id: "denied",
            name: "Denied",
            method: "post",
            url: '"https://webstudio.is/blocked"',
            headers: [],
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await writeFile(
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
        "export const createManagedFormEmailSender = () => undefined;\nexport const validateManagedFormEmail = () => undefined;\nexport const createManagedFormResourceFetch = () => globalThis.__testManagedFormFetch;\n"
      );
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents: 'export { action } from "./app/routes/_index"',
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "url-preflight-action.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { action } = await import(
        pathToFileURL(join(tempDir, "url-preflight-action.mjs")).href
      );
      const received: string[] = [];
      vi.stubGlobal(
        "__testManagedFormFetch",
        createProtectedResourceFetch({
          deniedHostnames: ["webstudio.is"],
          transport: async ({ url }) => {
            received.push(url.href);
            return { response: Response.json({ accepted: true }) };
          },
        })
      );
      const formData = new FormData();
      formData.set(managedFormIdFieldName, "root");
      formData.set(managedFormArrayNamesFieldName, "[]");
      formData.set(formBotFieldName, "brave");
      await expect(
        action({
          request: new Request(
            `https://example.com/?${managedFormRequestParamName}=1`,
            { method: "POST", headers: { host: "example.com" }, body: formData }
          ),
          context: {},
          params: {},
        })
      ).resolves.toEqual(
        getManagedFormFailure("Resource destination is not allowed")
      );
      expect(received).toEqual([]);
    }
  );

  test.each(["defaults", "react-router"])(
    "preflights dependent bodies before any selected Form destination (%s)",
    async (template) => {
      const siteData = createSiteData({
        instances: [
          ["root", { id: "root", component: "ResourceForm", children: [] }],
        ],
        props: [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "json",
              value: [
                { dataSourceId: "independent-source" },
                { dataSourceId: "dependent-source" },
              ],
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          "formData",
          {
            id: "formData",
            name: "formData",
            type: "parameter",
            scopeInstanceId: "root",
          },
        ],
        [
          "lookup-source",
          {
            id: "lookup-source",
            name: "Lookup",
            type: "resource",
            resourceId: "lookup",
            scopeInstanceId: "root",
          },
        ],
        [
          "independent-source",
          {
            id: "independent-source",
            name: "Independent",
            type: "resource",
            resourceId: "independent",
            scopeInstanceId: "root",
          },
        ],
        [
          "dependent-source",
          {
            id: "dependent-source",
            name: "Dependent",
            type: "resource",
            resourceId: "dependent",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "lookup",
          {
            id: "lookup",
            name: "Lookup",
            method: "get",
            url: '"https://example.com/lookup"',
            headers: [],
          },
        ],
        [
          "independent",
          {
            id: "independent",
            name: "Independent",
            method: "post",
            url: '"https://example.com/independent"',
            headers: [],
            bodyFormat: "json",
            body: '{ message: "Hello" }',
          },
        ],
        [
          "dependent",
          {
            id: "dependent",
            name: "Dependent",
            method: "post",
            url: '"https://example.com/dependent"',
            headers: [],
            bodyFormat: "json",
            body: `{ attachment: ${encodeDataSourceVariable(
              "formData"
            )}.attachment, lookup: ${encodeDataSourceVariable(
              "lookup-source"
            )}.data }`,
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await writeFile(
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
        "export const createManagedFormEmailSender = () => undefined;\nexport const validateManagedFormEmail = () => undefined;\nexport const createManagedFormResourceFetch = () => globalThis.__testManagedFormFetch;\n"
      );
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents: 'export { action } from "./app/routes/_index"',
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "preflight-action.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { action } = await import(
        pathToFileURL(join(tempDir, "preflight-action.mjs")).href
      );
      const received: string[] = [];
      vi.stubGlobal(
        "__testManagedFormFetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init);
          received.push(request.url);
          return Response.json({ id: "looked-up" });
        })
      );
      const formData = new FormData();
      formData.set(managedFormIdFieldName, "root");
      formData.set(managedFormArrayNamesFieldName, "[]");
      formData.set(formBotFieldName, "brave");
      formData.set("attachment", new File(["hello"], "hello.txt"));
      await expect(
        action({
          request: new Request(
            `https://example.com/?${managedFormRequestParamName}=1`,
            { method: "POST", headers: { host: "example.com" }, body: formData }
          ),
          context: {},
          params: {},
        })
      ).resolves.toEqual(
        getManagedFormFailure("JSON body cannot include uploaded files")
      );
      expect(received).toEqual(["https://example.com/lookup"]);

      formData.set("attachment", "text attachment");
      await expect(
        action({
          request: new Request(
            `https://example.com/?${managedFormRequestParamName}=1`,
            { method: "POST", headers: { host: "example.com" }, body: formData }
          ),
          context: {},
          params: {},
        })
      ).resolves.toMatchObject({ success: true, status: 200 });
      expect(received.slice(1).sort()).toEqual([
        "https://example.com/dependent",
        "https://example.com/independent",
        "https://example.com/lookup",
      ]);
    }
  );

  test.each(["defaults", "react-router"])(
    "submits selected Form Resources in parallel with scoped values (%s)",
    async (template) => {
      const siteData = createSiteData({
        instances: [
          ["root", { id: "root", component: "ResourceForm", children: [] }],
        ],
        props: [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "json",
              value: [
                { dataSourceId: "form-destination" },
                { dataSourceId: "browser-destination" },
              ],
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          "formData",
          {
            id: "formData",
            name: "formData",
            type: "parameter",
            scopeInstanceId: "root",
          },
        ],
        [
          "browserInfo",
          {
            id: "browserInfo",
            name: "browserInfo",
            type: "parameter",
            scopeInstanceId: "root",
          },
        ],
        [
          "form-destination",
          {
            id: "form-destination",
            name: "Form destination",
            type: "resource",
            resourceId: "form-resource",
            scopeInstanceId: "root",
          },
        ],
        [
          "browser-destination",
          {
            id: "browser-destination",
            name: "Browser destination",
            type: "resource",
            resourceId: "browser-resource",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "form-resource",
          {
            id: "form-resource",
            name: "Form resource",
            method: "get",
            url: '"https://forms.example/submit"',
            headers: [],
            bodyFormat: "json",
            body: encodeDataSourceVariable("formData"),
          },
        ],
        [
          "browser-resource",
          {
            id: "browser-resource",
            name: "Browser resource",
            method: "get",
            url: '"https://browser.example/submit"',
            headers: [],
            body: encodeDataSourceVariable("browserInfo"),
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      // Replace the generated adapter only in this temporary test site. The
      // production action always imports its protected runtime adapter.
      await writeFile(
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
        "export const createManagedFormEmailSender = () => undefined;\nexport const validateManagedFormEmail = () => undefined;\nexport const createManagedFormResourceFetch = () => globalThis.__testManagedFormFetch;\n"
      );
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents: 'export { action } from "./app/routes/_index"',
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "managed-action.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { action } = await import(
        pathToFileURL(join(tempDir, "managed-action.mjs")).href
      );
      const received: Array<{ url: string; method: string; body: unknown }> =
        [];
      let releaseRequests = () => {};
      const waitForBoth = new Promise<void>((resolve) => {
        releaseRequests = resolve;
      });
      let failBrowserResource = false;
      vi.stubGlobal(
        "__testManagedFormFetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const outbound = new Request(input, init);
          received.push({
            url: outbound.url,
            method: outbound.method,
            body: await outbound.json(),
          });
          await waitForBoth;
          if (failBrowserResource && outbound.url.includes("browser.example")) {
            return new Response("Rejected", {
              status: 422,
            });
          }
          return Response.json({ accepted: true });
        })
      );
      const submit = (attachment?: File) => {
        const form = new FormData();
        form.set(managedFormIdFieldName, "root");
        form.set(formBotFieldName, Date.now().toString(16));
        form.set(
          managedFormArrayNamesFieldName,
          JSON.stringify(["tags", "empty"])
        );
        form.set("message", "Hello");
        form.append("tags", "red");
        form.append("tags", "blue");
        form.set("campaign", "conference");
        if (attachment !== undefined) {
          form.set("attachment", attachment);
        }
        return action({
          request: new Request(
            `https://site.example/?source=event&${managedFormRequestParamName}=1`,
            {
              method: "POST",
              headers: {
                host: "site.example",
                "user-agent": "Test Browser",
                "accept-language": "en-US",
                referer: "https://site.example/contact",
                "cf-connecting-ip": "127.0.0.1",
              },
              body: form,
            }
          ),
          context: {},
          params: {},
        });
      };
      await expect(submit(new File(["hello"], "hello.txt"))).resolves.toEqual(
        getManagedFormFailure("JSON body cannot include uploaded files")
      );
      expect(received).toHaveLength(0);
      const submission = submit();
      try {
        await vi.waitFor(() => expect(received).toHaveLength(2));
      } finally {
        releaseRequests();
      }
      await expect(submission).resolves.toMatchObject({
        success: true,
        status: 200,
        errors: [],
      });
      expect(received).toEqual([
        {
          url: "https://forms.example/submit",
          method: "POST",
          body: {
            message: "Hello",
            tags: ["red", "blue"],
            empty: [],
            campaign: "conference",
          },
        },
        {
          url: "https://browser.example/submit",
          method: "POST",
          body: {
            userAgent: "Test Browser",
            language: "en-US",
            referrer: "https://site.example/contact",
            pageUrl: "https://site.example/?source=event",
          },
        },
      ]);
      failBrowserResource = true;
      await expect(submit()).resolves.toEqual({
        success: false,
        status: 502,
        results: [
          {
            resourceId: "form-resource",
            resourceName: "Form resource",
            status: 200,
            body: { accepted: true },
          },
          {
            resourceId: "browser-resource",
            resourceName: "Browser resource",
            status: 422,
            body: "Rejected",
          },
        ],
        errors: [
          {
            resourceId: "browser-resource",
            resourceName: "Browser resource",
            status: 422,
            body: "Rejected",
            message: "Resource request failed (422)",
          },
        ],
      });
    }
  );

  test.each(["defaults", "react-router"])(
    "forwards repeated managed Form fields as standard multipart entries through the generated endpoint (%s)",
    async (template) => {
      const siteData = createSiteData({
        instances: [
          ["root", { id: "root", component: "ResourceForm", children: [] }],
        ],
        props: [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "json",
              value: [{ dataSourceId: "destination" }],
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          "formData",
          {
            id: "formData",
            name: "formData",
            type: "parameter",
            scopeInstanceId: "root",
          },
        ],
        [
          "destination",
          {
            id: "destination",
            name: "Destination",
            type: "resource",
            resourceId: "remote",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "remote",
          {
            id: "remote",
            name: "Remote",
            method: "post",
            url: '"https://receiver.example/submit"',
            headers: [],
            bodyFormat: "multipart",
            body: encodeDataSourceVariable("formData"),
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await writeFile(
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
        "export const createManagedFormEmailSender = () => undefined;\nexport const validateManagedFormEmail = () => undefined;\nexport const createManagedFormResourceFetch = () => globalThis.__testManagedFormFetch;\n"
      );
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents: `export { action } from "./app/routes/${generateRemixRoute(
            "/__ws-form"
          )}";`,
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "multipart-action.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { action } = await import(
        pathToFileURL(join(tempDir, "multipart-action.mjs")).href
      );
      const outbound = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init);
          expect(request.url).toBe("https://receiver.example/submit");
          expect(request.method).toBe("POST");
          expect(request.headers.get("content-type")).toContain(
            "multipart/form-data"
          );
          const fields = await request.formData();
          expect(fields.getAll("tags")).toEqual(["red", "blue", "red"]);
          const attachments = fields.getAll("attachments") as File[];
          expect(attachments).toMatchObject([
            { name: "first.bin", type: "application/octet-stream" },
            { name: "second.txt", type: "text/plain" },
          ]);
          expect(new Uint8Array(await attachments[0].arrayBuffer())).toEqual(
            new Uint8Array([0, 128, 255])
          );
          expect(new Uint8Array(await attachments[1].arrayBuffer())).toEqual(
            new Uint8Array([115, 101, 99, 111, 110, 100])
          );
          return Response.json({ accepted: true });
        }
      );
      vi.stubGlobal("__testManagedFormFetch", outbound);
      const form = new FormData();
      form.set(managedFormIdFieldName, "root");
      form.set(formBotFieldName, "brave");
      form.set(
        managedFormArrayNamesFieldName,
        JSON.stringify(["tags", "attachments"])
      );
      form.append("tags", "red");
      form.append("tags", "blue");
      form.append("tags", "red");
      form.append(
        "attachments",
        new File([new Uint8Array([0, 128, 255])], "first.bin", {
          type: "application/octet-stream",
        })
      );
      form.append(
        "attachments",
        new File(["second"], "second.txt", { type: "text/plain" })
      );
      const response: Response = await action({
        request: new Request("https://site.example/__ws-form", {
          method: "POST",
          headers: { host: "site.example" },
          body: form,
        }),
        context: {},
        params: {},
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ success: true });
      expect(outbound).toHaveBeenCalledOnce();
    }
  );

  test.each(["defaults", "react-router"])(
    "automatically sends a file in the default Form body as multipart through the generated endpoint (%s)",
    async (template) => {
      const siteData = createSiteData({
        instances: [
          ["root", { id: "root", component: "ResourceForm", children: [] }],
        ],
        props: [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "json",
              value: [{ dataSourceId: "destination" }],
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          "formData",
          {
            id: "formData",
            name: "formData",
            type: "parameter",
            scopeInstanceId: "root",
          },
        ],
        [
          "destination",
          {
            id: "destination",
            name: "Destination",
            type: "resource",
            resourceId: "remote",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "remote",
          {
            id: "remote",
            name: "Remote",
            method: "get",
            url: '"https://receiver.example/submit"',
            headers: [],
            // No body or bodyFormat: the managed Form uses submitted formData
            // and lets the normal `auto` serializer choose multipart for files.
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await writeFile(
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
        "export const createManagedFormEmailSender = () => undefined;\nexport const validateManagedFormEmail = () => undefined;\nexport const createManagedFormResourceFetch = () => globalThis.__testManagedFormFetch;\n"
      );
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents: `export { action } from "./app/routes/${generateRemixRoute(
            "/__ws-form"
          )}";`,
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "default-file-action.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { action } = await import(
        pathToFileURL(join(tempDir, "default-file-action.mjs")).href
      );
      const bytes = new Uint8Array([0, 128, 255]);
      const outbound = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init);
          expect(request.url).toBe("https://receiver.example/submit");
          expect(request.method).toBe("POST");
          expect(request.headers.get("content-type")).toMatch(
            /^multipart\/form-data; boundary=/
          );
          const fields = await request.formData();
          expect(fields.get("message")).toBe("Hello");
          const attachment = fields.get("attachment");
          expect(attachment).toMatchObject({
            name: "note.bin",
            type: "application/octet-stream",
          });
          expect(
            new Uint8Array(await (attachment as File).arrayBuffer())
          ).toEqual(bytes);
          return Response.json({ accepted: true });
        }
      );
      vi.stubGlobal("__testManagedFormFetch", outbound);
      const form = new FormData();
      form.set(managedFormIdFieldName, "root");
      form.set(formBotFieldName, "brave");
      form.set(managedFormArrayNamesFieldName, "[]");
      form.set("message", "Hello");
      form.set("attachment", new File([bytes], "note.bin"));
      const response: Response = await action({
        request: new Request("https://site.example/__ws-form", {
          method: "POST",
          headers: { host: "site.example" },
          body: form,
        }),
        context: {},
        params: {},
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ success: true });
      expect(outbound).toHaveBeenCalledOnce();
    }
  );

  test.each(["defaults", "react-router"])(
    "sends configured browserInfo headers from a trusted Cloudflare request (%s)",
    async (template) => {
      const browserInfo = encodeDataSourceVariable("browserInfo");
      const siteData = createSiteData({
        instances: [
          ["root", { id: "root", component: "ResourceForm", children: [] }],
        ],
        props: [
          [
            "action",
            {
              id: "action",
              instanceId: "root",
              name: "action",
              type: "json",
              value: [{ dataSourceId: "destination" }],
            },
          ],
        ],
      });
      siteData.build.dataSources = [
        [
          "browserInfo",
          {
            id: "browserInfo",
            name: "browserInfo",
            type: "parameter",
            scopeInstanceId: "root",
          },
        ],
        [
          "destination",
          {
            id: "destination",
            name: "Destination",
            type: "resource",
            resourceId: "receiver",
            scopeInstanceId: "root",
          },
        ],
      ] as never;
      siteData.build.resources = [
        [
          "receiver",
          {
            id: "receiver",
            name: "Receiver",
            method: "post",
            url: '"https://receiver.example/submit"',
            headers: [
              { name: "X-Forwarded-For", value: `${browserInfo}.ip` },
              { name: "User-Agent", value: `${browserInfo}.userAgent` },
              { name: "Accept-Language", value: `${browserInfo}.language` },
            ],
          },
        ],
      ] as never;
      await writeSiteData(siteData);
      await prebuild({ assets: false, template: [template] });
      await writeFile(
        join(
          tempDir,
          "app/__generated__/$resources.managed-form-fetch.server.ts"
        ),
        "export const createManagedFormEmailSender = () => undefined;\nexport const validateManagedFormEmail = () => undefined;\nexport const createManagedFormResourceFetch = () => globalThis.__testManagedFormFetch;\n"
      );
      await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
      await build({
        stdin: {
          contents: 'export { action } from "./app/routes/_index"',
          resolveDir: tempDir,
        },
        outfile: join(tempDir, "managed-browser-headers-action.mjs"),
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        loader: { ".css": "text" },
      });
      const { action } = await import(
        pathToFileURL(join(tempDir, "managed-browser-headers-action.mjs")).href
      );
      const received: Headers[] = [];
      vi.stubGlobal(
        "__testManagedFormFetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          received.push(new Headers(new Request(input, init).headers));
          return Response.json({ accepted: true });
        })
      );
      const form = new FormData();
      form.set(managedFormIdFieldName, "root");
      form.set(formBotFieldName, Date.now().toString(16));
      form.set(managedFormArrayNamesFieldName, "[]");
      const response = await action({
        request: new Request(
          `https://site.example/?${managedFormRequestParamName}=1`,
          {
            method: "POST",
            headers: {
              host: "site.example",
              "cf-connecting-ip": "198.51.100.42",
              "x-forwarded-for": "203.0.113.200",
              "x-real-ip": "203.0.113.201",
              "user-agent": "Visitor Browser",
              "accept-language": "fr-CA,fr;q=0.9",
              cookie: "session=secret",
              authorization: "Bearer secret",
            },
            body: form,
          }
        ),
        context: { cloudflare: {} },
        params: {},
      });
      expect(response.success).toBe(true);
      expect(received).toHaveLength(1);
      expect(received[0].get("X-Forwarded-For")).toBe("198.51.100.42");
      expect(received[0].get("User-Agent")).toBe("Visitor Browser");
      expect(received[0].get("Accept-Language")).toBe("fr-CA,fr;q=0.9");
      expect(received[0].has("Cookie")).toBe(false);
      expect(received[0].has("Authorization")).toBe(false);
      expect(received[0].has("X-Real-IP")).toBe(false);

      const nodeResponse = await action({
        request: new Request(
          `https://site.example/?${managedFormRequestParamName}=1`,
          {
            method: "POST",
            headers: {
              host: "site.example",
              "cf-connecting-ip": "203.0.113.202",
              "x-forwarded-for": "203.0.113.200",
              "x-real-ip": "203.0.113.201",
              "user-agent": "Visitor Browser",
              "accept-language": "fr-CA,fr;q=0.9",
            },
            body: form,
          }
        ),
        context: {},
        params: {},
      });
      expect(nodeResponse.success).toBe(true);
      expect(received).toHaveLength(2);
      expect(received[1].has("X-Forwarded-For")).toBe(false);
    }
  );

  test("prerenders the canonical Form with its navigation action", async () => {
    const siteData = createSiteData({
      formComponentIdentityVersion: 1,
      instances: [
        [
          "root",
          {
            id: "root",
            component: "Box",
            children: [{ type: "id", value: "form" }],
          },
        ],
        [
          "form",
          {
            id: "form",
            component: "Form",
            children: [],
          },
        ],
      ],
    });
    siteData.build.dataSources = [
      [
        "formData",
        {
          type: "parameter",
          id: "formData",
          name: "formData",
          scopeInstanceId: "form",
        },
      ],
      [
        "browserInfo",
        {
          type: "parameter",
          id: "browserInfo",
          name: "browserInfo",
          scopeInstanceId: "form",
        },
      ],
    ] as never;
    siteData.build.props = [
      [
        "formData",
        {
          id: "formData",
          instanceId: "form",
          name: "formData",
          type: "parameter",
          value: "formData",
        },
      ],
      [
        "browserInfo",
        {
          id: "browserInfo",
          instanceId: "form",
          name: "browserInfo",
          type: "parameter",
          value: "browserInfo",
        },
      ],
    ];
    await writeSiteData(siteData);

    await prebuild({ assets: false, template: ["ssg"] });
    await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
    await prerenderSsg();

    const html = parseHtml(await readFile("dist/client/index.html", "utf8"));
    const [form] = findElementsByTagName(html, "form");
    expect(form).toBeDefined();
    expect(form?.attrs.map(({ name }) => name)).toEqual([
      "class",
      "action",
      "method",
    ]);
    expect(form?.attrs.find(({ name }) => name === "action")?.value).toBe(
      "?__webstudio__=navigate"
    );
    expect(form?.attrs.find(({ name }) => name === "method")?.value).toBe(
      "get"
    );
    const generatedPage = await readFile(
      join("app", "__generated__", "_index.tsx"),
      "utf8"
    );
    expect(generatedPage).toContain("const formData: any = undefined");
    expect(generatedPage).toContain("const browserInfo: any = undefined");
  }, 30_000);

  test("ignores dynamic SSG pages without enumerable Assets query paths", async () => {
    await writeSiteData(
      createSiteData({
        pages: [
          {
            id: "home",
            name: "Home",
            title: "Home",
            path: "",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "post",
            name: "Post",
            title: "Post",
            path: "/blog/:slug",
            rootInstanceId: "root",
            meta: {},
          },
        ],
      })
    );

    await expect(
      prebuild({ assets: false, template: ["ssg"] })
    ).resolves.toBeUndefined();
    await expect(readFile("pages/index/+Page.tsx", "utf8")).resolves.toContain(
      "Page"
    );
    await expect(
      readFile("pages/blog/@slug/+Page.tsx", "utf8")
    ).rejects.toThrow("ENOENT");
  });

  test("prerenders dynamic SSG paths from parameterized Assets resources", async () => {
    // OrganizeOS fork: its query names a route parameter by a bare name,
    // which no expression may while org script is paused (the builder writes
    // the system data's name, which may)
    publishAsIfOrgScriptMayRun();
    const documents = [
      {
        ...indexedDocument,
        path: "blog/post.md",
        size: 1,
        properties: { slug: "hello-world", title: "Hello", draft: false },
      },
      {
        ...indexedDocument,
        _id: "draft-post",
        name: "draft.md",
        path: "blog/draft.md",
        key: "draft",
        size: 1,
        revision: "draft-revision",
        contentRef: "draft.md",
        properties: { slug: "draft-post", title: "Draft", draft: true },
      },
    ];
    const index = await createTestAssetIndex(documents);
    const siteData = {
      ...createSiteData({
        assets: documents.map(createAssetForIndexedDocument),
        pages: [
          {
            id: "home",
            name: "Home",
            title: "Home",
            path: "",
            rootInstanceId: "home-root",
            meta: {},
          },
          {
            id: "post",
            name: "Post",
            title: "Post",
            path: "/blog/:slug",
            rootInstanceId: "post-root",
            meta: {},
          },
        ],
        instances: [
          ["home-root", { id: "home-root", component: "Box", children: [] }],
          ["post-root", { id: "post-root", component: "Box", children: [] }],
        ],
      }),
      assetIndex: index,
    };
    siteData.build.resources = [
      [
        "post",
        {
          id: "post",
          name: "Post",
          control: "system",
          method: "post",
          url: '"/$resources/assets"',
          headers: [],
          body: createStructuredAssetQueryResourceBody({
            where: {
              all: [
                {
                  field: ["properties", "draft"],
                  operator: "ne",
                  value: "true",
                },
                {
                  field: ["properties", "slug"],
                  operator: "eq",
                  value: "system.params.slug",
                },
              ],
            },
            sort: [],
            limit: "1",
            offset: "0",
            output: { mode: "all", includeMetadata: true },
            content: { mode: "none" },
          }),
        },
      ],
    ];
    siteData.build.dataSources = [
      [
        "post-data",
        {
          id: "post-data",
          type: "resource",
          name: "post",
          resourceId: "post",
          scopeInstanceId: "post-root",
        },
      ],
    ];
    await writeSiteData(siteData);

    await prebuild({ assets: false, template: ["ssg"] });
    await expect(
      readFile("pages/blog/@slug/+onBeforePrerenderStart.ts", "utf8")
    ).resolves.toContain("/blog/hello-world");
    await expect(
      readFile("pages/blog/@slug/+onBeforePrerenderStart.ts", "utf8")
    ).resolves.not.toContain("/blog/draft-post");
    const sitemap = await readFile(
      "app/__generated__/$resources.sitemap.xml.ts",
      "utf8"
    );
    expect(sitemap).toContain('"path": "/"');
    expect(sitemap).not.toContain('"path": "/blog/hello-world"');
    expect(sitemap).not.toContain('"path": "/blog/draft-post"');
    await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
    await prerenderSsg();
    await expect(
      readFile("dist/client/blog/hello-world/index.html", "utf8")
    ).resolves.toContain("<!DOCTYPE html>");
    const staticRuntimeOutput = (
      await Promise.all(
        (
          await getFilePaths("dist/client")
        )
          .filter((path) => path.endsWith(".js") || path.endsWith(".json"))
          .map((path) => readFile(path, "utf8"))
      )
    ).join("\n");
    expect(staticRuntimeOutput).not.toContain(index.integrity.checksum);
  }, 30_000);

  test("does not prerender dynamic Assets paths that cannot match string route params", async () => {
    const index = await createTestAssetIndex([
      {
        ...indexedDocument,
        properties: { slug: 123 },
      },
      {
        ...indexedDocument,
        _id: "boolean-slug",
        revision: "boolean-revision",
        properties: { slug: true },
      },
    ]);
    const resource = createQueryResource();
    resource.body = createStructuredAssetQueryResourceBody({
      where: {
        all: [
          {
            field: ["properties", "slug"],
            operator: "eq",
            value: "system.params.slug",
          },
        ],
      },
      sort: [],
      limit: "1",
      offset: "0",
      output: { mode: "all", includeMetadata: true },
      content: { mode: "none" },
    });

    expect(
      getAssetResourcePrerenderPaths({
        pagePath: "/blog/:slug",
        resources: [["post", resource]],
        index,
      })
    ).toEqual([]);
  });

  test("uses JavaScript literals when filtering prerender candidates", async () => {
    const index = await createTestAssetIndex({
      ...indexedDocument,
      properties: { slug: "hello-world", status: "draft" },
    });
    const resource = createQueryResource();
    resource.body = createStructuredAssetQueryResourceBody({
      where: {
        all: [
          {
            field: ["properties", "status"],
            operator: "eq",
            value: "'published'",
          },
          {
            field: ["properties", "slug"],
            operator: "eq",
            value: "system.params.slug",
          },
        ],
      },
      sort: [],
      limit: "1",
      offset: "0",
      output: { mode: "all", includeMetadata: true },
      content: { mode: "none" },
    });

    expect(
      getAssetResourcePrerenderPaths({
        pagePath: "/blog/:slug",
        resources: [["post", resource]],
        index,
      })
    ).toEqual([]);
  });

  test("prerenders canonical and alternative asset routes from any groups", async () => {
    const index = await createTestAssetIndex({
      ...indexedDocument,
      properties: {
        slug: "hello-world",
        id: "post-123",
        aliases: ["original-title"],
        draft: false,
      },
    });
    const resource = createQueryResource();
    resource.body = createStructuredAssetQueryResourceBody({
      where: {
        all: [
          {
            field: ["properties", "draft"],
            operator: "ne",
            value: "true",
          },
          {
            any: [
              {
                field: ["properties", "slug"],
                operator: "eq",
                value: "system.params.identifier",
              },
              {
                field: ["properties", "id"],
                operator: "eq",
                value: "system.params.identifier",
              },
              {
                field: ["properties", "aliases"],
                operator: "contains",
                value: "system.params.identifier",
              },
            ],
          },
        ],
      },
      sort: [],
      limit: "1",
      offset: "0",
      output: { mode: "all", includeMetadata: true },
      content: { mode: "none" },
    });

    expect(
      getAssetResourcePrerenderPaths({
        pagePath: "/blog/:identifier",
        resources: [["post", resource]],
        index,
        requireCompleteEnumeration: true,
      })
    ).toEqual(["/blog/hello-world", "/blog/original-title", "/blog/post-123"]);
  });

  test("prerenders multi-parameter routes from one Assets query", async () => {
    const index = await createTestAssetIndex([
      {
        ...indexedDocument,
        properties: { category: "news", slug: "hello-world" },
      },
      {
        ...indexedDocument,
        _id: "other-post",
        revision: "other-revision",
        properties: { category: "guides", slug: "getting-started" },
      },
    ]);
    const resource = createQueryResource();
    resource.body = createStructuredAssetQueryResourceBody({
      where: {
        all: [
          {
            field: ["properties", "category"],
            operator: "eq",
            value: "system.params.category",
          },
          {
            field: ["properties", "slug"],
            operator: "eq",
            value: "system.params.slug",
          },
        ],
      },
      sort: [],
      limit: "1",
      offset: "0",
      output: { mode: "all", includeMetadata: true },
      content: { mode: "none" },
    });

    expect(
      getAssetResourcePrerenderPaths({
        pagePath: "/blog/:category/:slug",
        resources: [["post", resource]],
        index,
        requireCompleteEnumeration: true,
      })
    ).toEqual(["/blog/guides/getting-started", "/blog/news/hello-world"]);
  });

  test("rejects multi-parameter SSG routes split across Assets queries", async () => {
    const index = await createTestAssetIndex({
      ...indexedDocument,
      properties: { category: "news", slug: "hello-world" },
    });
    const createParameterResource = (parameter: "category" | "slug") => {
      const resource = createQueryResource();
      resource.body = createStructuredAssetQueryResourceBody({
        where: {
          all: [
            {
              field: ["properties", parameter],
              operator: "eq",
              value: `system.params.${parameter}`,
            },
          ],
        },
        sort: [],
        limit: "1",
        offset: "0",
        output: { mode: "all", includeMetadata: true },
        content: { mode: "none" },
      });
      return resource;
    };

    expect(() =>
      getAssetResourcePrerenderPaths({
        pagePath: "/blog/:category/:slug",
        resources: [
          ["category", createParameterResource("category")],
          ["slug", createParameterResource("slug")],
        ],
        index,
        requireCompleteEnumeration: true,
      })
    ).toThrow(
      "Dynamic SSG route parameters must be completely enumerated by one Assets query"
    );
  });

  test("ignores Assets queries unrelated to dynamic SSG route parameters", async () => {
    const index = await createTestAssetIndex({
      ...indexedDocument,
      properties: { slug: "hello-world", draft: false },
    });
    const resource = createQueryResource();
    resource.body = createStructuredAssetQueryResourceBody({
      where: {
        all: [
          {
            field: ["properties", "draft"],
            operator: "eq",
            value: "false",
          },
        ],
      },
      sort: [],
      limit: "20",
      offset: "0",
      output: { mode: "all", includeMetadata: true },
      content: { mode: "none" },
    });

    expect(
      getAssetResourcePrerenderPaths({
        pagePath: "/blog/:slug",
        resources: [["posts", resource]],
        index,
        requireCompleteEnumeration: true,
      })
    ).toEqual([]);
  });

  test("prerenders asset routes bound with optional member expressions", async () => {
    const index = await createTestAssetIndex({
      ...indexedDocument,
      properties: { slug: "hello-world" },
    });
    const resource = createQueryResource();
    resource.body = createStructuredAssetQueryResourceBody({
      where: {
        all: [
          {
            field: ["properties", "slug"],
            operator: "eq",
            value: 'system?.params?.["slug"]',
          },
        ],
      },
      sort: [],
      limit: "1",
      offset: "0",
      output: { mode: "all", includeMetadata: true },
      content: { mode: "none" },
    });

    expect(
      getAssetResourcePrerenderPaths({
        pagePath: "/blog/:slug",
        resources: [["post", resource]],
        index,
      })
    ).toEqual(["/blog/hello-world"]);
  });

  test("prerenders asset routes bound with the persisted system variable", async () => {
    const index = await createTestAssetIndex({
      ...indexedDocument,
      properties: { slug: "hello-world" },
    });
    const resource = createQueryResource();
    resource.body = createStructuredAssetQueryResourceBody({
      where: {
        all: [
          {
            field: ["properties", "slug"],
            operator: "eq",
            value: `${encodeDataSourceVariable(
              SYSTEM_VARIABLE_ID
            )}.params.slug`,
          },
        ],
      },
      sort: [],
      limit: "1",
      offset: "0",
      output: { mode: "all", includeMetadata: true },
      content: { mode: "none" },
    });

    expect(
      getAssetResourcePrerenderPaths({
        pagePath: "/blog/:slug",
        resources: [["post", resource]],
        index,
      })
    ).toEqual(["/blog/hello-world"]);
  });

  test("deduplicates collection routes matched by multiple assets", async () => {
    const index = await createTestAssetIndex([
      { ...indexedDocument, properties: { slug: "shared" } },
      {
        ...indexedDocument,
        _id: "other-post",
        revision: "other-revision",
        properties: { slug: "shared" },
      },
    ]);
    const resource = createQueryResource();
    resource.body = createStructuredAssetQueryResourceBody({
      where: {
        all: [
          {
            field: ["properties", "slug"],
            operator: "eq",
            value: "system.params.slug",
          },
        ],
      },
      sort: [],
      limit: "1",
      offset: "0",
      output: { mode: "all", includeMetadata: true },
      content: { mode: "none" },
    });

    expect(
      getAssetResourcePrerenderPaths({
        pagePath: "/blog/:slug",
        resources: [["post", resource]],
        index,
      })
    ).toEqual(["/blog/shared"]);
  });

  test("rejects SSG filters whose route values cannot be completely enumerated", async () => {
    const index = await createTestAssetIndex({
      ...indexedDocument,
      properties: { slug: "hello-world" },
    });
    const resource = createQueryResource();
    resource.body = createStructuredAssetQueryResourceBody({
      where: {
        all: [
          {
            field: ["properties", "slug"],
            operator: "startsWith",
            value: "system.params.slug",
          },
        ],
      },
      sort: [],
      limit: "20",
      offset: "0",
      output: { mode: "all", includeMetadata: true },
      content: { mode: "none" },
    });

    expect(() =>
      getAssetResourcePrerenderPaths({
        pagePath: "/blog/:slug",
        resources: [["posts", resource]],
        index,
        requireCompleteEnumeration: true,
      })
    ).toThrow('route parameter "slug" cannot be completely enumerated');
  });

  test("rejects SSG route parameters unconstrained by an alternative query branch", async () => {
    const index = await createTestAssetIndex({
      ...indexedDocument,
      properties: { slug: "hello-world", draft: false },
    });
    const resource = createQueryResource();
    resource.body = createStructuredAssetQueryResourceBody({
      where: {
        any: [
          {
            field: ["properties", "slug"],
            operator: "eq",
            value: "system.params.slug",
          },
          {
            field: ["properties", "draft"],
            operator: "eq",
            value: "false",
          },
        ],
      },
      sort: [],
      limit: "20",
      offset: "0",
      output: { mode: "all", includeMetadata: true },
      content: { mode: "none" },
    });

    expect(() =>
      getAssetResourcePrerenderPaths({
        pagePath: "/blog/:slug",
        resources: [["posts", resource]],
        index,
        requireCompleteEnumeration: true,
      })
    ).toThrow('route parameter "slug" cannot be completely enumerated');
  });

  test("prerenders SSG pages with asset query data", async () => {
    const document = {
      ...indexedDocument,
      path: "blog/post.md",
      size: 1,
      properties: { title: "Prerendered post" },
    };
    const index = await createTestAssetIndex(document);
    const siteData = {
      ...createSiteData({
        assets: [createAssetForIndexedDocument(document)],
        props: [
          [
            "root-title",
            {
              id: "root-title",
              instanceId: "root",
              name: "title",
              type: "expression",
              value: `${encodeDataVariableId(
                "posts-data"
              )}.data["post-1"].properties.title`,
            },
          ],
        ],
      }),
      assetIndex: index,
    };
    siteData.build.resources = [
      [
        "posts",
        {
          id: "posts",
          name: "Posts",
          control: "system",
          method: "post",
          url: '"/$resources/assets"',
          headers: [],
          body: createStructuredAssetQueryResourceBody({
            where: { all: [] },
            sort: [],
            limit: "10",
            offset: "0",
            output: { mode: "all", includeMetadata: true },
            content: { mode: "none" },
          }),
        },
      ],
    ];
    siteData.build.dataSources = [
      [
        "posts-data",
        {
          id: "posts-data",
          type: "resource",
          name: "posts",
          resourceId: "posts",
          scopeInstanceId: "root",
        },
      ],
    ];
    await writeSiteData(
      siteData as unknown as ReturnType<typeof createSiteData>
    );
    await prebuild({ assets: false, template: ["ssg"] });
    await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
    const pageModule = (await import(
      `${
        pathToFileURL(join(tempDir, "pages/index/+data.ts")).href
      }?test=${crypto.randomUUID()}`
    )) as {
      data: (context: {
        urlOriginal: string;
        headers: Record<string, string>;
        routeParams: Record<string, string>;
      }) => Promise<{ resources: Record<string, unknown> }>;
    };

    const pageData = await pageModule.data({
      urlOriginal: "/",
      headers: { host: "example.com" },
      routeParams: {},
    });

    expect(Object.values(pageData.resources)).toMatchObject([
      {
        ok: true,
        status: 200,
        data: {
          "post-1": {
            id: "post-1",
            properties: { title: "Prerendered post" },
          },
        },
        meta: { totalCount: 1, hasMore: false },
      },
    ]);
    await prerenderSsg();
    await expect(readFile("dist/client/index.html", "utf8")).resolves.toContain(
      "<!DOCTYPE html>"
    );
  }, 30_000);

  test("keeps resources used by XML collection pages in the request graph", async () => {
    // OrganizeOS fork: the pause leaves out a ws:element whose tag the
    // builder does not offer (urlset, url), on an XML page too (orgScript),
    // and input validation refuses one whatever the switch says, so the
    // XML elements are XML Nodes, as the builder makes them
    publishAsIfOrgScriptMayRun();
    const siteData = createSiteData({
      pages: [
        {
          id: "home",
          name: "Home",
          title: "Home",
          path: "",
          rootInstanceId: "root",
          meta: {},
        },
        {
          id: "sitemap",
          name: "Sitemap",
          title: "Sitemap",
          path: "/sitemap.xml",
          rootInstanceId: "sitemap-body",
          meta: { documentType: "xml" },
        },
      ],
      instances: [
        [
          "root",
          {
            id: "root",
            component: "Box",
            children: [],
          },
        ],
        [
          "sitemap-body",
          {
            id: "sitemap-body",
            component: "Box",
            children: [{ type: "id", value: "urlset" }],
          },
        ],
        [
          "urlset",
          {
            id: "urlset",
            component: "XmlNode",
            children: [{ type: "id", value: "collection" }],
          },
        ],
        [
          "collection",
          {
            id: "collection",
            component: "ws:collection",
            children: [{ type: "id", value: "url" }],
          },
        ],
        [
          "url",
          {
            id: "url",
            component: "XmlNode",
            children: [],
          },
        ],
      ],
      props: [
        [
          "collection-data",
          {
            id: "collection-data",
            instanceId: "collection",
            name: "data",
            type: "expression",
            value: `${encodeDataVariableId("sitemap-data-source")}?.data`,
          },
        ],
        [
          "collection-item",
          {
            id: "collection-item",
            instanceId: "collection",
            name: "item",
            type: "parameter",
            value: "sitemap-item",
          },
        ],
      ],
    });
    siteData.build.dataSources = [
      [
        "sitemap-data-source",
        {
          id: "sitemap-data-source",
          type: "resource",
          name: "Static Sitemap",
          resourceId: "sitemap-resource",
          scopeInstanceId: "collection",
        },
      ],
    ];
    siteData.build.resources = [
      [
        "sitemap-resource",
        {
          id: "sitemap-resource",
          name: "Static Sitemap",
          control: "system",
          method: "get",
          url: '"/$resources/sitemap.xml"',
          headers: [],
        },
      ],
    ];
    await writeSiteData(siteData);

    await prebuild({
      assets: false,
      template: ["react-router"],
      preserveRouteTemplates: true,
    });

    await expect(
      readFile("app/__generated__/[sitemap.xml]._index.server.tsx", "utf8")
    ).resolves.toContain('rootIds: [\n      "sitemap-resource"');
    await expect(
      readFile("app/routes/[sitemap.xml]._index.tsx", "utf8")
    ).resolves.toContain("../__generated__/[sitemap.xml]._index");

    siteData.build.version += 1;
    await writeSiteData(siteData);
    await prebuild({
      assets: false,
      template: ["react-router"],
      incremental: true,
    });
    await expect(
      readFile("app/routes/[sitemap.xml]._index.tsx", "utf8")
    ).resolves.toContain("../__generated__/[sitemap.xml]._index");
  });

  test("emits static text pages at their configured paths", async () => {
    const robots = "User-agent: *\nDisallow: /private";
    const security = "Contact: mailto:security@example.com\n# <head> & café\n";
    const siteData = createSiteData({
      pages: [
        {
          id: "home",
          name: "Home",
          title: "Home",
          path: "",
          rootInstanceId: "root",
          meta: {},
        },
        {
          id: "robots",
          name: "Robots",
          title: "Robots",
          path: "/robots.txt",
          rootInstanceId: "root",
          meta: {
            documentType: "text",
            content: JSON.stringify(robots),
          },
        },
        {
          id: "security",
          name: "Security",
          title: "Security",
          path: "/.well-known/security.txt",
          rootInstanceId: "root",
          meta: {
            documentType: "text",
            content: `${encodeDataVariableId("security-data")}.data.content`,
          },
        },
        {
          id: "empty",
          name: "Empty",
          title: "Empty",
          path: "/empty.txt",
          rootInstanceId: "root",
          meta: { documentType: "text", content: '""' },
        },
      ],
      dataSources: [
        [
          "security-data",
          {
            id: "security-data",
            type: "resource",
            name: "Security",
            resourceId: "security-resource",
            scopeInstanceId: "root",
          },
        ],
      ],
      resources: [
        [
          "security-resource",
          {
            id: "security-resource",
            name: "Security",
            control: "system",
            method: "get",
            url: JSON.stringify(
              `data:application/json,${encodeURIComponent(
                JSON.stringify({ content: security })
              )}`
            ),
            headers: [],
          },
        ],
      ],
    });
    await writeSiteData(siteData);

    await prebuild({ assets: false, template: ["ssg"] });
    await symlink(join(originalCwd, "node_modules"), "node_modules", "dir");
    await prerenderSsg();

    await expect(readFile("dist/client/robots.txt", "utf8")).resolves.toBe(
      robots
    );
    await expect(
      readFile("dist/client/.well-known/security.txt", "utf8")
    ).resolves.toBe(security);
    await expect(readFile("dist/client/empty.txt", "utf8")).resolves.toBe("");
    await expect(readFile("dist/client/index.html", "utf8")).resolves.toContain(
      "<!DOCTYPE html>"
    );
  }, 30_000);

  test("generates html, xml, and text document routes", async () => {
    await writeSiteData(
      createSiteData({
        pages: [
          {
            id: "home",
            name: "Home",
            title: "Home",
            path: "",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "feed",
            name: "Feed",
            title: "Feed",
            path: "/feed.xml",
            rootInstanceId: "xml-root",
            meta: {
              documentType: "xml",
            },
          },
          {
            id: "robots",
            name: "Robots",
            title: "Robots",
            path: "/robots.txt",
            rootInstanceId: "root",
            meta: {
              documentType: "text",
            },
          },
        ],
        instances: [
          [
            "root",
            {
              id: "root",
              component: "Box",
              children: [],
            },
          ],
          [
            "xml-root",
            {
              id: "xml-root",
              component: "Box",
              children: [{ type: "id", value: "xml-feed" }],
            },
          ],
          [
            "xml-feed",
            {
              id: "xml-feed",
              component: elementComponent,
              tag: "rss",
              children: [],
            },
          ],
        ],
      })
    );

    await prebuild({
      assets: false,
      template: ["defaults"],
    });

    await expect(readFile("app/routes/_index.tsx", "utf8")).resolves.toContain(
      "useLoaderData"
    );
    await expect(
      readFile("app/routes/[feed.xml]._index.tsx", "utf8")
    ).resolves.toContain("renderToString");
    await expect(
      readFile("app/routes/[robots.txt]._index.tsx", "utf8")
    ).resolves.toContain("Content-Type");
  });

  test("generates custom code only for the home page", async () => {
    await writeSiteData(
      createSiteData({
        pageMeta: {
          code: '<script src="/custom.js"></script><style>.x{color:red}</style>',
        },
        pages: [
          {
            id: "home",
            name: "Home",
            title: "Home",
            path: "",
            rootInstanceId: "root",
            meta: {},
          },
          {
            id: "about",
            name: "About",
            title: "About",
            path: "/about",
            rootInstanceId: "root",
            meta: {},
          },
        ],
      })
    );

    await prebuild({
      assets: false,
      template: ["defaults"],
    });

    await expect(
      readFile("app/__generated__/_index.tsx", "utf8")
    ).resolves.toContain("CustomCode");
    await expect(
      readFile("app/__generated__/[about]._index.tsx", "utf8")
    ).resolves.not.toContain("CustomCode");
  });

  test(
    "downloads assets only when requested by prebuild",
    async () => {
      const fetch = vi.fn(async () => ({
        ok: false,
        statusText: "Not Found",
      }));
      globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await prebuild({
        assets: false,
        template: ["defaults"],
      });
      expect(fetch).not.toHaveBeenCalled();

      await prebuild({
        assets: true,
        template: ["defaults"],
      });
      expect(fetch).toHaveBeenCalledWith(
        "https://assets.example/cgi/image/image.png?format=raw"
      );
      expect(consoleWarn).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining("Error materializing file image.png")
      );
    },
    slowPrebuildTestTimeout
  );

  test("uses synced asset files before downloading during prebuild", async () => {
    await mkdir(".webstudio/assets", { recursive: true });
    await writeFile(".webstudio/assets/image.png", "synced", "utf8");
    const fetch = vi.fn();
    globalThis.fetch = fetch;

    await prebuild({
      assets: true,
      template: ["defaults"],
    });

    await expect(readFile("public/assets/image.png", "utf8")).resolves.toBe(
      "synced"
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  test("merges package and tsconfig from every template", async () => {
    const localTemplate = join(tempDir, "local-template");
    await mkdir(localTemplate, { recursive: true });
    await writeFile(
      join(localTemplate, "package.json"),
      JSON.stringify({
        scripts: {
          local: "echo local",
        },
        dependencies: {
          "local-package": "1.0.0",
        },
      }),
      "utf8"
    );
    await writeFile(
      join(localTemplate, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: false,
          paths: {
            "~local/*": ["./local/*"],
          },
        },
      }),
      "utf8"
    );
    await writeFile(
      "package.json",
      JSON.stringify({
        scripts: {
          existing: "echo existing",
        },
        dependencies: {
          existing: "1.0.0",
        },
      }),
      "utf8"
    );
    await writeFile(
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: {
          strict: true,
          paths: {
            "~existing/*": ["./existing/*"],
          },
        },
      }),
      "utf8"
    );

    await prebuild({
      assets: false,
      template: ["defaults", localTemplate],
    });

    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    expect(packageJson.scripts.existing).toEqual("echo existing");
    expect(packageJson.scripts.local).toEqual("echo local");
    expect(packageJson.dependencies.existing).toEqual("1.0.0");
    expect(packageJson.dependencies["local-package"]).toEqual("1.0.0");

    const tsconfig = JSON.parse(await readFile("tsconfig.json", "utf8"));
    expect(tsconfig.compilerOptions.strict).toEqual(false);
    expect(tsconfig.compilerOptions.paths).toEqual({
      "~existing/*": ["./existing/*"],
      "~local/*": ["./local/*"],
    });
  });

  test("throws when project bundle is missing", async () => {
    await rm(".webstudio/data.json", { force: true });

    await expect(
      prebuild({
        assets: false,
        template: ["defaults"],
      })
    ).rejects.toThrow("Project bundle is missing");
  });

  test("throws when project bundle is invalid", async () => {
    await writeFile(".webstudio/data.json", JSON.stringify({ assets: [] }));

    await expect(
      prebuild({
        assets: false,
        template: ["defaults"],
      })
    ).rejects.toThrow(
      "Project bundle is invalid, please make sure the project is synced. Invalid fields: page: Required"
    );
  });

  test("exposes anonymous structured diagnostics for invalid asset fields", async () => {
    const data = structuredClone(createSiteData()) as unknown as {
      assets: Array<Record<string, unknown>>;
    };
    data.assets[0] = { ...data.assets[0], type: "future-video" };
    await writeFile(".webstudio/data.json", JSON.stringify(data));

    try {
      await prebuild({ assets: false, template: ["defaults"] });
      throw new Error("Expected invalid bundle to fail.");
    } catch (error) {
      expect(error).toMatchObject({
        code: "PROJECT_BUNDLE_INVALID",
        bundleVersion,
        issues: expect.arrayContaining([
          expect.objectContaining({
            path: ["assets", "0", "type"],
            code: "invalid_value",
          }),
        ]),
      });
    }
  });
});
