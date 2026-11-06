import { afterEach, expect, test, vi } from "vitest";
import type { Page, Pages } from "@webstudio-is/sdk";
import { serializePages } from "@webstudio-is/project-build/persistence";

// OrganizeOS fork: the builder's sitemap reads each page's
// excludePageFromSearch as upstream does since webstudio-is/webstudio#6614,
// without evaluating it (pagesForSitemap).

const state = vi.hoisted(() => ({ pages: "" }));

vi.mock("../router-utils", () => ({ isBuilder: () => true }));

vi.mock("../context.server", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    single: async () => ({
      data: { pages: state.pages, updatedAt: "2026-11-02T00:00:00.000Z" },
      error: null,
    }),
  };
  return {
    createContext: async () => ({
      postgrest: { client: { from: () => chain } },
    }),
  };
});

const { loader } = await import("./sitemap.xml.server");

const marker = "__organizeosBuilderSitemapMarker";
const globals = globalThis as Record<string, unknown>;

afterEach(() => {
  delete globals[marker];
});

const page = (id: string, path: string, excludePageFromSearch?: string) =>
  ({
    id,
    name: id,
    title: `"${id}"`,
    path,
    rootInstanceId: `${id}-root`,
    meta: excludePageFromSearch === undefined ? {} : { excludePageFromSearch },
  }) as Page;

test("reads each page's excludePageFromSearch without evaluating it", async () => {
  const pages = {
    meta: { siteName: "Site" },
    homePageId: "home",
    rootFolderId: "root",
    pages: new Map([
      ["home", page("home", "")],
      ["hidden", page("hidden", "/hidden", "true")],
      ["code", page("code", "/code", `(globalThis.${marker} = true)`)],
    ]),
    folders: new Map([
      [
        "root",
        {
          id: "root",
          name: "Root",
          slug: "",
          children: ["home", "hidden", "code"],
        },
      ],
    ]),
  } as unknown as Pages;
  state.pages = serializePages(pages);

  const response = await loader({
    request: new Request(
      "https://p-090e6e14-ae50-4b2e-bd22-71733cec05bb.wstd.dev/rest/sitemap"
    ),
  });
  const sitemap = (await response.json()) as Array<{ path: string }>;

  expect(globals[marker]).toBeUndefined();
  expect(sitemap.map((entry) => entry.path)).toEqual(["/", "/code"]);
});
