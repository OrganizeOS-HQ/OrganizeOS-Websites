import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import * as React from "react";
import type { ComponentType } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";
import { bundleVersion } from "@webstudio-is/protocol";
import { log } from "@clack/prompts";
import { encodeDataSourceVariable } from "@webstudio-is/sdk";
import { templateIconCodes } from "@organizeos/site-components/org-script";
import { generateRedirectsModule, prebuild } from "./prebuild";
import {
  findModuleClosure,
  resolveOrganizeosComponentsModule,
} from "./organizeos-components";

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
const elementComponent = "ws:element";
const slowPrebuildTestTimeout = 15_000;
type Redirects = Array<{ old: string; new: string; status?: "301" | "302" }>;

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

const createSiteData = (
  overrides: {
    pages?: Array<{
      id: string;
      name: string;
      title: string;
      path: string;
      rootInstanceId: string;
      meta: Record<string, unknown>;
    }>;
    instances?: Array<
      [
        string,
        {
          type?: "instance";
          id: string;
          component: string;
          tag?: string;
          // OrganizeOS fork: the Event List cases below hold expressions
          children: Array<{ type: "id" | "expression"; value: string }>;
        },
      ]
    >;
    pageMeta?: Record<string, unknown>;
    redirects?: Redirects;
    // OrganizeOS fork: the Forms preset cases below set these three.
    props?: Array<[string, Record<string, unknown>]>;
    dataSources?: Array<[string, Record<string, unknown>]>;
    resources?: Array<[string, Record<string, unknown>]>;
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
    assets: [
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
  consoleInfo.mockRestore();
  process.chdir(originalCwd);
  globalThis.fetch = originalFetch;
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

describe("prebuild", () => {
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

    await expect(
      readFile("app/__generated__/$resources.assets.ts", "utf8")
    ).resolves.toContain("image.png");
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
    await expect(
      readFile("app/__generated__/$resources.redirects.ts", "utf8")
    ).resolves.toContain("/dl.php?filename=file.pdf");
  });

  // OrganizeOS fork: the OrganizeOS blocks ship inside the site as a copy of
  // their build (organizeos-components.ts).
  const organizeosDir = join("app", "__organizeos__");

  const expectCopyToBeTheClosure = async () => {
    const entryPath = resolveOrganizeosComponentsModule();
    const { modules } = await findModuleClosure(entryPath);
    const copied = await getFilePaths(organizeosDir);
    expect(copied.map((path) => relative(organizeosDir, path)).sort()).toEqual(
      [
        ...modules.map((path) => relative(dirname(entryPath), path)),
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
    const repository = "https://github.com/OrganizeOS-HQ/websites-builder";
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
      vi.stubEnv("GITHUB_REPOSITORY", "OrganizeOS-HQ/websites-builder");
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

    // Owner decision of 2026-10-15: AGPL-3.0 section 13 asks that the offer be
    // prominent, so besides the head links every html page ends its <body>
    // with a small visible "Source" link. The <body> is rendered by the
    // generated Page (its Body component, which the byte-identical
    // sdk-components-react-router package owns), so the route appends the link
    // to the children of the element Page returns.
    describe("ends every html page's body with a visible Source link", () => {
      /** Code with its whitespace collapsed, so prettier's wrapping is no part of a test. */
      const compact = (code: string) => code.replace(/\s+/g, " ");

      /** The element the route renders for the link: the wrapper and its anchor. */
      const getSourceOffer = (route: string) =>
        compact(route).match(
          /<div [^>]*data-organizeos-source-offer[^>]*>.*?<\/div>/
        )?.[0] ?? "";

      /** Where the link goes: the value of the constant its href names. */
      const getLinkTarget = (route: string) => {
        const name = getSourceOffer(route).match(/<a [^>]*href=\{(\w+)\}/)?.[1];
        return route.match(new RegExp(`const ${name} = "([^"]*)";`))?.[1];
      };

      test("it links the fork at the commit the publish workflow built", async () => {
        vi.stubEnv("GITHUB_REPOSITORY", "OrganizeOS-HQ/websites-builder");
        vi.stubEnv("GITHUB_SHA", sha);

        const { route } = await prebuildLinks();
        const offer = getSourceOffer(route);

        expect(offer).toContain("data-organizeos-source-offer");
        // the code-repository relation only: the anchor's target is a source
        // tree, not a license document, so it makes no license claim (the
        // head's license link names the AGPL text)
        expect(offer).toMatch(/<a [^>]*rel="code-repository"/);
        expect(offer).not.toMatch(/rel="[^"]*license/);
        expect(offer).toContain(`title="Source code of this site (AGPL-3.0)"`);
        expect(offer).toContain(
          `aria-label="Source code of this site (AGPL-3.0)"`
        );
        // the visible text
        expect(offer).toMatch(/>\s*Source\s*<\/a>/);
        expect(getLinkTarget(route)).toBe(`${repository}/tree/${sha}`);
        expect(route).not.toContain("__ORGANIZEOS_SOURCE_URL__");
      });

      test("without a commit it links the fork's repository", async () => {
        vi.stubEnv("GITHUB_REPOSITORY", undefined);
        vi.stubEnv("GITHUB_SHA", undefined);

        const { route } = await prebuildLinks();

        expect(getSourceOffer(route)).toContain("data-organizeos-source-offer");
        expect(getLinkTarget(route)).toBe(repository);
      });

      test("it is the last of the page's content in the body, before the scripts the Body appends, and the page's Body is where it goes", async () => {
        const { route } = await prebuildLinks();
        const code = compact(route);

        // The page is rendered through the wrapper that appends the link ...
        expect(code).toContain(
          "<PageWithSourceOffer key={url} system={system} />"
        );
        expect(code).not.toContain("<Page key={url}");
        // ... after the page's own children, never before them.
        const children = code.indexOf("page.props.children");
        const link = code.indexOf("<SourceOffer", children);
        expect(children).toBeGreaterThan(-1);
        expect(link).toBeGreaterThan(children);
      });

      // The tests above read the route's text. These render it: the
      // PageWithSourceOffer the site ships, around the generated Page, whose
      // root is the real Body of @webstudio-is/sdk-components-react-router.
      // Only react-router's Scripts and ScrollRestoration are stand-ins (the
      // real ones need a router); they render the <script> elements the real
      // Body puts after its children.
      describe("rendered", () => {
        type Wrapper = ComponentType<{ system: unknown }>;

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

        /** The route's PageWithSourceOffer, as the site ships it, around `Page`. */
        const loadWrapper = async (route: string, Page: unknown) => {
          const start = route.indexOf("const organizeosSourceUrl");
          const wrapper = route.indexOf("const PageWithSourceOffer", start);
          const end = route.indexOf("\n};\n", wrapper) + "\n};\n".length;
          const reactImport = route.match(
            /import \{[^}]*\bisValidElement\b[^}]*\} from "react";/
          )?.[0];
          expect(start).toBeGreaterThan(-1);
          expect(wrapper).toBeGreaterThan(start);
          expect(end).toBeGreaterThan(wrapper);
          expect(reactImport).toBeDefined();
          const exports = await runModule(
            [
              reactImport,
              `import { Page } from "./page";`,
              route.slice(start, end),
              `export { PageWithSourceOffer };`,
            ].join("\n"),
            {
              react: React,
              "react/jsx-runtime": jsxRuntime,
              "./page": { Page },
            }
          );
          return exports.PageWithSourceOffer as Wrapper;
        };

        /** The generated Page of the home page, rendering `Body` as its root. */
        const loadGeneratedPage = async (Body: unknown) => {
          const exports = await runModule(
            await readFile(join("app", "__generated__", "_index.tsx"), "utf8"),
            {
              react: React,
              "react/jsx-runtime": jsxRuntime,
              "@webstudio-is/react-sdk/runtime": await import(
                "@webstudio-is/react-sdk/runtime"
              ),
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
          const { Body } = await import(
            "@webstudio-is/sdk-components-react-router"
          );
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

        test("the link is inside the <body>, after the page's content and before the scripts", async () => {
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
          const PageWithSourceOffer = await loadWrapper(
            route,
            await loadGeneratedPage(await importBody())
          );

          const html = renderInHtml(
            React.createElement(PageWithSourceOffer, { system: {} })
          );

          // <body> comes right after <head> and nothing follows it: the link
          // is not a sibling of the page's root under <html>
          expect(html).toMatch(/^<html><head><\/head><body[ >]/);
          expect(html).toMatch(/<\/body><\/html>$/);
          const body = html.slice(
            html.indexOf("<body"),
            html.lastIndexOf("</body>")
          );
          expect(body.match(/data-organizeos-source-offer/g)).toHaveLength(1);
          // the wrapper is not hidden from sight or from assistive technology
          expect(body).not.toMatch(
            /<div data-organizeos-source-offer=""[^>]*\s(hidden|aria-hidden)[\s=>]/
          );
          // the page's two paragraphs, the link, then the scripts
          expect(body).toMatch(
            /^<body[^>]*><p [^>]*><\/p><p [^>]*><\/p><div data-organizeos-source-offer=""[^>]*><a [^>]*>Source<\/a><\/div><script data-scripts=""><\/script><script data-scroll-restoration=""><\/script>$/
          );
        });

        test("it renders what Page renders when that is not an element", async () => {
          const { route } = await prebuildLinks();
          const PageWithSourceOffer = await loadWrapper(route, () => null);

          expect(
            renderToStaticMarkup(
              React.createElement(PageWithSourceOffer, { system: {} })
            )
          ).toBe("");
        });
      });

      test("it styles itself inline, small, and never overlays the design", async () => {
        const { route } = await prebuildLinks();
        const offer = getSourceOffer(route);

        for (const declaration of [
          `display: "block"`,
          `textAlign: "center"`,
          `fontSize: "12px"`,
          `lineHeight: 1.5`,
          `padding: "8px"`,
          `opacity: 0.7`,
          `color: "inherit"`,
          // in a grid body it fills a whole row instead of the next cell
          `gridColumn: "1 / -1"`,
        ]) {
          expect(offer).toContain(declaration);
        }
        expect(offer).not.toMatch(/position|zIndex|float|top:|bottom:/);
        // visible: nothing hides it from a sighted visitor or from assistive
        // technology, which would defeat the point of a prominent offer
        expect(offer).not.toMatch(
          /\bhidden\b|visibility|aria-hidden|clip|display: "none"/
        );
        // no class: nothing for the org's CSS to reach, nothing of ours to leak
        expect(offer).not.toContain("className");
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

        expect(html).toContain("data-organizeos-source-offer");
        expect(xml).not.toContain("data-organizeos-source-offer");
        expect(text).not.toContain("data-organizeos-source-offer");
      });
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
      expect(resources).toContain(`const ${request}: ResourceRequest = {`);
      expect(resources).toContain(
        `url: "https://app.example.org/api/public/v1/forms",`
      );
      expect(resources).toContain(
        `{ name: "Authorization", value: "Bearer osk_test" },`
      );
      expect(resources).toContain(`["${request}", ${request}],`);
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
      expect(resources).toContain(`const ${request}: ResourceRequest = {`);
      expect(resources).toContain(
        `url: "https://app.example.org/api/public/v1/forms",`
      );
      expect(resources).toContain(
        `{ name: "Authorization", value: "Bearer osk_test" },`
      );
      expect(resources).toContain(`["${request}", ${request}],`);
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
      expect(resources).not.toContain("ResourceRequest = {");
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
      expect(resources).toContain(`const ${request}: ResourceRequest = {`);
      expect(resources).toContain(
        `url: "https://app.example.org/api/public/v1/events?upcoming=true",`
      );
      expect(resources).toContain(
        `{ name: "Authorization", value: "Bearer osk_test" },`
      );
      expect(resources).toContain(`["${request}", ${request}],`);
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
      expect(resources).not.toContain("ResourceRequest = {");
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

    test("the form action still posts with plain fetch", async () => {
      const route = await readFile(routes[0].file, "utf8");
      const action = route.slice(route.indexOf("export const action"));

      expect(action).toContain(
        "const { ok, statusText } = await loadResource(fetch, resource);"
      );
      expect(action).not.toContain("resourceCache");
      expect(action).not.toContain("customFetch");
    });
  });

  test("selects ssg templates and skips dynamic routes", async () => {
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
    await expect(
      readFile("pages/blog/:slug/+Page.tsx", "utf8")
    ).rejects.toThrow("ENOENT");
    await expect(
      readFile("app/__generated__/[blog].$slug._index.tsx", "utf8")
    ).resolves.toContain("export { Page }");
  });

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

  // OrganizeOS fork: org script is paused (organizeos-org-script.ts)
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
                tag: "div />{globalThis.pwned = 1}<div",
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
      expect(page).not.toContain("pwned");
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
});
