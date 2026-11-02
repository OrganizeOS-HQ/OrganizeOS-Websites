import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Project } from "@webstudio-is/project";
import { TooltipProvider, toast } from "@webstudio-is/design-system";
import { createDefaultPages } from "@webstudio-is/project-build";
import { defaultPlanFeatures } from "@webstudio-is/plans";
import type { Page, ResourceRequest } from "@webstudio-is/sdk";
import { $, renderData } from "@webstudio-is/template";
import {
  $authPermit,
  $organizeosSite,
  $planFeatures,
  selectInstance,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { registerContainers } from "~/shared/sync/sync-stores";
import {
  $assets,
  $breakpoints,
  $dataSources,
  $instances,
  $pages,
  $project,
  $props,
  $resources,
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import { getResourceKey } from "~/shared/resources";
import { updateWebstudioData } from "~/shared/instance-utils/data";
import {
  buildCollectionResourcePresets,
  buildOrgResourcePresets,
} from "~/shared/db/resource-presets.server";
import { registerTestMetas } from "./backgrounds/test-fixtures";
import { loadCollectionError } from "./collection-schema";
import {
  findCollectionItemPage,
  listSitemapCollections,
} from "./collection-pages";
import {
  findItemResourcePages,
  findStaleItemPages,
  parseItemResourceSlug,
} from "./organizeos-data";
import { OrganizeosPanel } from "./organizeos-panel";

const { loaderFetch } = vi.hoisted(() => ({ loaderFetch: vi.fn() }));
vi.mock("~/shared/fetch.client", () => ({ fetch: loaderFetch }));

enableMapSet();
registerContainers();

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const projectId = "project-1";
const apiBase = "https://app.example.org/api/public/v1";
const { resources: orgCatalog } = await buildOrgResourcePresets({
  projectId,
  apiBaseUrl: apiBase,
  readToken: "osk_token",
});
const collectionCatalog = async (
  collections: Array<{ slug: string; name: string }>
) =>
  (
    await buildCollectionResourcePresets({
      projectId,
      apiBase,
      authHeaderExpression: `"Bearer osk_token"`,
      collections,
    })
  ).resources;
const blogAndFaq = await collectionCatalog([
  { slug: "blog", name: "Blog posts" },
  { slug: "faq", name: "FAQ" },
]);

const collections = [
  {
    slug: "blog",
    name: "Blog posts",
    singularName: "Blog post",
    fields: [
      {
        key: "title",
        label: "Title",
        kind: "text",
        isTitle: true,
        required: true,
      },
      { key: "summary", label: "Summary", kind: "textarea" },
    ],
  },
  {
    slug: "news",
    name: "Blog posts",
    singularName: "Blog post",
    fields: [{ key: "title", label: "Title", kind: "text", isTitle: true }],
  },
  {
    slug: "faq",
    name: "FAQ",
    singularName: "Question",
    fields: [{ key: "question", label: "Question", kind: "text" }],
  },
];

let schemaFails = false;

// the resources loader, answering each posted request by its url
const answerLoader = async (_url: string, init: RequestInit) => {
  const requests = JSON.parse(init.body as string) as ResourceRequest[];
  return new Response(
    JSON.stringify(
      requests.map((request) => {
        const key = getResourceKey(request);
        if (request.url === `${apiBase}/collections`) {
          return [
            key,
            schemaFails
              ? { ok: false, status: 503, data: { error: "Unavailable" } }
              : { ok: true, status: 200, data: { data: collections } },
          ];
        }
        return [key, { ok: true, status: 200, data: { data: [] } }];
      })
    )
  );
};

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let root: Root | undefined;
let container: HTMLElement | undefined;

const setProject = (catalog = blogAndFaq) => {
  const data = renderData(
    <$.Body ws:id="bodyId">
      <$.Box ws:id="boxId"></$.Box>
    </$.Body>
  );
  $instances.set(data.instances);
  $props.set(data.props);
  $dataSources.set(new Map());
  $breakpoints.set(new Map([["base", { id: "base", label: "Base" }]]));
  $styles.set(new Map());
  $styleSources.set(new Map());
  $styleSourceSelections.set(new Map());
  $assets.set(new Map());
  $resources.set(
    new Map(
      [...orgCatalog, ...catalog].map((resource) => [resource.id, resource])
    )
  );
  const pages = createDefaultPages({ rootInstanceId: "bodyId" });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
  selectInstance(undefined);
  $project.set({ id: projectId } as Project);
  $organizeosSite.set({
    organizationId: "org-1",
    manageUrl: "https://app.organizeos.org/dashboard",
    platformUrl: "https://app.organizeos.org",
    blocksEnabled: true,
  });
  $authPermit.set("own");
  $planFeatures.set({ ...defaultPlanFeatures, allowDynamicData: true });
};

/** Lets every pending promise, the catalog's hashing among them, settle. */
const settle = async () => {
  for (let index = 0; index < 30; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

const render = async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(TooltipProvider, null, createElement(OrganizeosPanel))
    );
  });
  await settle();
  return container;
};

const row = (slug: string) =>
  document.querySelector(`[data-organizeos-collection="${slug}"]`);

const openMenu = async (slug: string) => {
  const trigger = row(slug)?.querySelector(
    "[data-organizeos-collection-menu]"
  ) as HTMLElement;
  act(() => {
    trigger.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0 })
    );
  });
  await settle();
  return Array.from(
    document.querySelectorAll<HTMLElement>('[role="menuitem"]')
  );
};

const menuItem = (items: HTMLElement[], text: string) =>
  items.find((item) => item.textContent?.startsWith(text)) as HTMLElement;

const choose = async (item: HTMLElement) => {
  act(() => {
    item.click();
  });
  await settle();
};

const addListForm = () =>
  document.querySelector<HTMLElement>("[data-organizeos-add-list]");

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  registerTestMetas();
  schemaFails = false;
  loaderFetch.mockReset();
  loaderFetch.mockImplementation(answerLoader);
  setProject();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a collection row's menu", () => {
  test("replaces the row's button with a '...' menu: Create item page, Add list, Add to this page", async () => {
    await render();
    expect(row("blog")?.textContent).toEqual("Blog posts");
    const trigger = row("blog")?.querySelector("button");
    expect(trigger?.textContent).toEqual("");
    expect(trigger?.getAttribute("aria-haspopup")).toEqual("menu");
    const items = await openMenu("blog");
    expect(items.map((item) => item.textContent)).toEqual([
      "Create item page",
      "Add list",
      "Add to this page",
    ]);
  });

  test("other catalog rows keep their button", async () => {
    const host = await render();
    const rows = host.querySelector("[data-organizeos-data]");
    expect(rows?.textContent).toContain("EventsAdd to this page");
  });

  test("Create item page creates it, switches to it and says 'Item page created', with no action", async () => {
    const success = vi.spyOn(toast, "success");
    await render();
    await choose(menuItem(await openMenu("blog"), "Create item page"));
    const page = findCollectionItemPage("blog") as Page;
    expect(page).toBeDefined();
    expect($selectedPageId.get()).toEqual(page.id);
    expect(success).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledWith("Item page created");
  });

  test("once the item page exists, the entry reads Open item page and opens it", async () => {
    await render();
    await choose(menuItem(await openMenu("blog"), "Create item page"));
    const page = findCollectionItemPage("blog") as Page;
    $selectedPageId.set($pages.get()?.homePageId);
    await settle();
    const items = await openMenu("blog");
    expect(items[0].textContent).toEqual("Open item page");
    await choose(items[0]);
    expect($selectedPageId.get()).toEqual(page.id);
  });

  test("a failed read says 'Could not load the collection' and writes nothing", async () => {
    schemaFails = true;
    const error = vi.spyOn(toast, "error");
    await render();
    const pages = $pages.get();
    await choose(menuItem(await openMenu("blog"), "Create item page"));
    expect(error).toHaveBeenCalledWith(loadCollectionError);
    expect($pages.get()).toBe(pages);
  });

  test("Add to this page binds the Resource, and then shows 'On this page' with the entry disabled", async () => {
    await render();
    await choose(menuItem(await openMenu("blog"), "Add to this page"));
    expect(row("blog")?.textContent).toContain("On this page");
    const items = await openMenu("blog");
    expect(
      menuItem(items, "Add to this page").hasAttribute("data-disabled")
    ).toBe(true);
  });

  test("without dynamic data in the plan, Create item page and Add list are disabled with the plan badge", async () => {
    $planFeatures.set({ ...defaultPlanFeatures, allowDynamicData: false });
    await render();
    const items = await openMenu("blog");
    for (const name of ["Create item page", "Add list"]) {
      const item = menuItem(items, name);
      expect(item.hasAttribute("data-disabled"), name).toBe(true);
      expect(item.textContent).toEqual(`${name}Not in plan`);
    }
    expect(
      menuItem(items, "Add to this page").hasAttribute("data-disabled")
    ).toBe(false);
    await choose(menuItem(items, "Create item page"));
    expect(findCollectionItemPage("blog")).toBeUndefined();
  });
});

describe("the Add list popover", () => {
  const openAddList = async () => {
    await choose(menuItem(await openMenu("blog"), "Add list"));
    return addListForm() as HTMLElement;
  };

  test("holds Layout, Sort, Show, the Link switch and Add, with no help text", async () => {
    await render();
    const form = await openAddList();
    expect(form.textContent).toEqual(
      "LayoutSortNewestShow6Link to item pageAdd"
    );
    expect(
      Array.from(form.querySelectorAll("label"), (label) => label.textContent)
    ).toEqual(["Layout", "Sort", "Show", "Link to item page"]);
    expect(form.querySelector('[aria-label="Grid"]')).not.toBeNull();
    expect(form.querySelector('[aria-label="List"]')).not.toBeNull();
  });

  test("the Link switch is off and disabled while the collection has no item page", async () => {
    await render();
    const form = await openAddList();
    const link = form.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(link.disabled).toBe(true);
    expect(link.getAttribute("aria-checked")).toEqual("false");
  });

  test("the Link switch is on and enabled once it has one", async () => {
    await render();
    await choose(menuItem(await openMenu("blog"), "Create item page"));
    const form = await openAddList();
    const link = form.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(link.disabled).toBe(false);
    expect(link.getAttribute("aria-checked")).toEqual("true");
  });

  test("Add inserts the list with the chosen layout and closes", async () => {
    await render();
    const form = await openAddList();
    act(() => {
      (form.querySelector('[aria-label="List"]') as HTMLElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });
    act(() => {
      (
        form.querySelector("[data-organizeos-add-list-submit]") as HTMLElement
      ).click();
    });
    await settle();
    const list = Array.from($instances.get().values()).find(
      (instance) => instance.label === "Blog posts list"
    );
    expect(list).toBeDefined();
    const resource = Array.from($resources.get().values()).find(
      ({ name }) => name === "Blog posts list"
    );
    expect(resource?.searchParams).toEqual([
      { name: "sort", value: `"-publishedAt"` },
      { name: "limit", value: `"6"` },
      { name: "fields", value: `"summary"` },
    ]);
    // the List layout: a column of rows
    const items = Array.from($instances.get().values()).find(
      (instance) => instance.label === "Items"
    );
    const selection = $styleSourceSelections.get().get(items?.id ?? "");
    const directions = Array.from($styles.get().values()).flatMap((decl) =>
      selection?.values.includes(decl.styleSourceId) &&
      decl.property === "flexDirection"
        ? [decl.value]
        : []
    );
    expect(directions).toEqual([{ type: "keyword", value: "column" }]);
    expect(addListForm()).toBeNull();
  });

  test("Add with a failed read says 'Could not load the collection'", async () => {
    await render();
    const form = await openAddList();
    schemaFails = true;
    const error = vi.spyOn(toast, "error");
    act(() => {
      (
        form.querySelector("[data-organizeos-add-list-submit]") as HTMLElement
      ).click();
    });
    await settle();
    expect(error).toHaveBeenCalledWith(loadCollectionError);
  });
});

describe("an item page at an old address", () => {
  test("parseItemResourceSlug reads the first string literal of an item Resource's url", () => {
    expect(
      parseItemResourceSlug(
        `"${apiBase}/collections/blog/items/" + ($ws$system.params.slug ?? "-")`
      )
    ).toEqual("blog");
    expect(
      parseItemResourceSlug(
        `("${apiBase}/collections/my%20blog/items/") + $ws$system.params.slug`
      )
    ).toEqual("my blog");
    // a list block's url, and a catalog Resource's
    expect(
      parseItemResourceSlug(`"${apiBase}/collections/blog/items"`)
    ).toBeUndefined();
    expect(parseItemResourceSlug(`"${apiBase}/events"`)).toBeUndefined();
    expect(parseItemResourceSlug(`$ws$system.origin`)).toBeUndefined();
    expect(parseItemResourceSlug(`"a\\"b/collections/x/items/"`)).toEqual("x");
  });

  test("a renamed collection address marks its row 'Item page uses an old address'", async () => {
    await render();
    await choose(menuItem(await openMenu("blog"), "Create item page"));
    expect(document.body.textContent).not.toContain(
      "Item page uses an old address"
    );
    act(() => {
      root?.unmount();
    });
    // the collection now answers at "news": a new catalog Resource, same name
    const renamed = await collectionCatalog([
      { slug: "news", name: "Blog posts" },
      { slug: "faq", name: "FAQ" },
    ]);
    updateWebstudioData((data) => {
      for (const resource of blogAndFaq) {
        data.resources.delete(resource.id);
      }
      for (const resource of renamed) {
        data.resources.set(resource.id, resource);
      }
    });
    const data = {
      pages: $pages.get()!,
      dataSources: $dataSources.get(),
      resources: $resources.get(),
    };
    expect(findItemResourcePages(data).map(({ slug }) => slug)).toEqual([
      "blog",
    ]);
    expect(
      findStaleItemPages(data, new Set(["news", "faq"])).map(
        ({ page }) => page.name
      )
    ).toEqual(["Blog posts template"]);
    await render();
    expect(row("news")?.textContent).toContain("Item page uses an old address");
    expect(row("faq")?.textContent).not.toContain(
      "Item page uses an old address"
    );
  });

  test("with no row of the same name, the page gets a row of its own", async () => {
    await render();
    await choose(menuItem(await openMenu("blog"), "Create item page"));
    act(() => {
      root?.unmount();
    });
    updateWebstudioData((data) => {
      for (const resource of blogAndFaq) {
        if (resource.name === "Blog posts") {
          data.resources.delete(resource.id);
        }
      }
    });
    await render();
    const orphan = document.querySelector("[data-organizeos-orphan]");
    expect(orphan?.textContent).toEqual(
      "Blog posts templateItem page uses an old address"
    );
  });
});

describe("Remove from sitemap", () => {
  const deleteItemPage = () => {
    const page = findCollectionItemPage("blog") as Page;
    updateWebstudioData((data) => {
      data.pages.pages.delete(page.id);
      for (const folder of data.pages.folders.values()) {
        folder.children = folder.children.filter((id) => id !== page.id);
      }
    });
  };

  test("shows when the sitemap lists a collection with no item page, and removes its part", async () => {
    await render();
    await choose(menuItem(await openMenu("blog"), "Create item page"));
    let items = await openMenu("blog");
    expect(menuItem(items, "Remove from sitemap")).toBeUndefined();
    act(() => {
      root?.unmount();
    });
    $selectedPageId.set($pages.get()?.homePageId);
    deleteItemPage();
    expect(listSitemapCollections()).toEqual(["blog"]);
    await render();
    items = await openMenu("blog");
    await choose(menuItem(items, "Remove from sitemap"));
    expect(listSitemapCollections()).toEqual([]);
  });

  test("a sitemap part of a collection no longer in the catalog gets a row with the button", async () => {
    await render();
    await choose(menuItem(await openMenu("blog"), "Create item page"));
    act(() => {
      root?.unmount();
    });
    $selectedPageId.set($pages.get()?.homePageId);
    deleteItemPage();
    updateWebstudioData((data) => {
      for (const resource of blogAndFaq) {
        if (resource.name === "Blog posts") {
          data.resources.delete(resource.id);
        }
      }
    });
    await render();
    const orphan = document.querySelector("[data-organizeos-orphan]");
    expect(orphan?.textContent).toEqual("blogRemove from sitemap");
    act(() => {
      (orphan?.querySelector("button") as HTMLElement).click();
    });
    expect(listSitemapCollections()).toEqual([]);
  });
});
