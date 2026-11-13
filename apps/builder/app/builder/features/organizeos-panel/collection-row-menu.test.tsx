import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Project } from "@webstudio-is/project";
import {
  DropdownMenuItem,
  TooltipProvider,
  toast,
} from "@webstudio-is/design-system";
import { createDefaultPages } from "@webstudio-is/project-build";
import { defaultPlanFeatures } from "@webstudio-is/plans";
import type { Page, ResourceRequest } from "@webstudio-is/sdk";
import { renderData } from "@webstudio-is/template";
import { $ } from "@organizeos/site-components/site-templates";
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
import {
  buildCollectionResourcePresets,
  buildOrgResourcePresets,
} from "~/shared/db/resource-presets.server";
import { registerTestMetas } from "./test-fixtures";
import { loadCollectionError } from "./collection-schema";
import {
  addCollectionToSitemapMutable,
  findCollectionItemPage,
  listSitemapCollections,
} from "./collection-pages";
import {
  findItemResourcePages,
  findStaleItemPages,
  parseItemResourceSlug,
} from "./organizeos-data";
import { OrganizeosPanel } from "./organizeos-panel";
import {
  CollectionActionsMenu,
  OrphanRow,
  StaleItemPageLine,
} from "./collection-row-menu";
import { updateWebstudioDataStaged } from "./staged-data";

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

/** Lets pending promises settle: before a check that something did not happen. */
const settle = async () => {
  for (let index = 0; index < 30; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

/**
 * Waits until `read` passes: what the panel reaches in no fixed number of
 * turns (its rows wait on the catalog's WebCrypto hashing).
 */
const until = async <T,>(read: () => T): Promise<T> => {
  await settle();
  return vi.waitFor(read, { timeout: 5000, interval: 20 });
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
  // the catalog has resolved: its collection rows are there
  await until(() =>
    expect(
      document.querySelector(
        "[data-organizeos-collection], [data-organizeos-orphan]"
      )
    ).not.toBeNull()
  );
  return container;
};

const row = (slug: string) =>
  document.querySelector(`[data-organizeos-collection="${slug}"]`);

/** A collection's row, once it has rendered. */
const findRow = (slug: string) =>
  until(() => {
    const element = row(slug);
    expect(element, slug).not.toBeNull();
    return element as HTMLElement;
  });

const orphanRow = () =>
  until(() => {
    const element = document.querySelector<HTMLElement>(
      "[data-organizeos-orphan]"
    );
    expect(element).not.toBeNull();
    return element as HTMLElement;
  });

const openMenu = async (slug: string) => {
  const trigger = (await findRow(slug)).querySelector(
    "[data-organizeos-collection-menu]"
  ) as HTMLElement;
  act(() => {
    trigger.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0 })
    );
  });
  return until(() => {
    const items = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]')
    );
    expect(items.length).toBeGreaterThan(0);
    return items;
  });
};

const menuItem = (items: HTMLElement[], text: string) =>
  items.find((item) => item.textContent?.startsWith(text)) as HTMLElement;

const choose = async (item: HTMLElement) => {
  act(() => {
    item.click();
  });
  await settle();
};

/** Create item page from the blog row's menu, and the page once it is made. */
const createBlogItemPage = async () => {
  await choose(menuItem(await openMenu("blog"), "Create item page"));
  return until(() => {
    const page = findCollectionItemPage("blog");
    expect(page).toBeDefined();
    return page as Page;
  });
};

// As the server's catalog sync does when a collection goes; a staged write
// may not (staged-data.ts).
const removeBlogFromCatalog = () => {
  $resources.set(
    new Map(
      [...$resources.get()].filter(
        ([id]) =>
          blogAndFaq.find((resource) => resource.name === "Blog posts")?.id !==
          id
      )
    )
  );
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
    expect((await findRow("blog")).textContent).toEqual("Blog posts");
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
    await until(() =>
      expect(
        host.querySelector("[data-organizeos-data]")?.textContent
      ).toContain("EventsAdd to this page")
    );
  });

  test("Create item page creates it, switches to it and says 'Item page created', with no action", async () => {
    const success = vi.spyOn(toast, "success");
    await render();
    const page = await createBlogItemPage();
    expect($selectedPageId.get()).toEqual(page.id);
    await until(() => expect(success).toHaveBeenCalledTimes(1));
    expect(success).toHaveBeenCalledWith("Item page created");
  });

  test("once the item page exists, the entry reads Open item page and opens it", async () => {
    await render();
    const page = await createBlogItemPage();
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
    await until(() => expect(error).toHaveBeenCalledWith(loadCollectionError));
    expect($pages.get()).toBe(pages);
  });

  test("Add to this page binds the Resource, and then shows 'On this page' with the entry disabled", async () => {
    await render();
    await choose(menuItem(await openMenu("blog"), "Add to this page"));
    await until(() =>
      expect(row("blog")?.textContent).toContain("On this page")
    );
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
      // a plain label: never a link to a pricing page
      expect(item.querySelector("a, [href]"), name).toBeNull();
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
    await createBlogItemPage();
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
    await until(() =>
      expect(
        Array.from($instances.get().values()).find(
          (instance) => instance.label === "Blog posts list"
        )
      ).toBeDefined()
    );
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
    await until(() => expect(error).toHaveBeenCalledWith(loadCollectionError));
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
    await createBlogItemPage();
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
    // as the server's catalog sync does; a staged write may not
    // (staged-data.ts)
    $resources.set(
      new Map([
        ...[...$resources.get()].filter(([id]) =>
          blogAndFaq.every((resource) => resource.id !== id)
        ),
        ...renamed.map((resource) => [resource.id, resource] as const),
      ])
    );
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
    await until(() =>
      expect(row("news")?.textContent).toContain(
        "Item page uses an old address"
      )
    );
    expect((await findRow("faq")).textContent).not.toContain(
      "Item page uses an old address"
    );
  });

  test("with no row of the same name, the page gets a row of its own", async () => {
    await render();
    await createBlogItemPage();
    act(() => {
      root?.unmount();
    });
    removeBlogFromCatalog();
    await render();
    expect((await orphanRow()).textContent).toEqual(
      "Blog posts templateItem page uses an old address"
    );
  });
});

describe("Remove from sitemap", () => {
  const deleteItemPage = async () => {
    const page = findCollectionItemPage("blog") as Page;
    await updateWebstudioDataStaged((data) => {
      data.pages.pages.delete(page.id);
      for (const folder of data.pages.folders.values()) {
        folder.children = folder.children.filter((id) => id !== page.id);
      }
    });
  };

  test("shows when the sitemap lists a collection with no item page, and removes its part", async () => {
    await render();
    await createBlogItemPage();
    let items = await openMenu("blog");
    expect(menuItem(items, "Remove from sitemap")).toBeUndefined();
    act(() => {
      root?.unmount();
    });
    $selectedPageId.set($pages.get()?.homePageId);
    await deleteItemPage();
    expect(listSitemapCollections()).toEqual(["blog"]);
    await render();
    items = await openMenu("blog");
    await choose(menuItem(items, "Remove from sitemap"));
    await until(() => expect(listSitemapCollections()).toEqual([]));
  });

  test("a sitemap part of a collection no longer in the catalog gets a row with the button", async () => {
    await render();
    await createBlogItemPage();
    act(() => {
      root?.unmount();
    });
    $selectedPageId.set($pages.get()?.homePageId);
    await deleteItemPage();
    removeBlogFromCatalog();
    await render();
    const orphan = await orphanRow();
    expect(orphan.textContent).toEqual("blogRemove from sitemap");
    act(() => {
      (orphan.querySelector("button") as HTMLElement).click();
    });
    await until(() => expect(listSitemapCollections()).toEqual([]));
  });
});

describe("the split for the CMS column", () => {
  /** Renders one element, as the CMS column would hold it. */
  const renderElement = (element: () => ReactElement) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const draw = () =>
      act(() => {
        root?.render(createElement(TooltipProvider, null, element()));
      });
    draw();
    return draw;
  };

  const openTrigger = async (label: string) => {
    const trigger = await until(() => {
      const element = document.querySelector<HTMLElement>(
        `[aria-label="${label}"]`
      );
      expect(element, label).not.toBeNull();
      return element as HTMLElement;
    });
    act(() => {
      trigger.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, button: 0 })
      );
    });
    return until(() => {
      const items = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"]')
      );
      expect(items.length).toBeGreaterThan(0);
      return items;
    });
  };

  const submitAddList = async () => {
    await until(() => expect(addListForm()).not.toBeNull());
    act(() => {
      (
        addListForm()?.querySelector(
          "[data-organizeos-add-list-submit]"
        ) as HTMLElement
      ).click();
    });
    await until(() => expect(addListForm()).toBeNull());
  };

  const blogLists = () =>
    Array.from($instances.get().values()).filter(
      (instance) => instance.label === "Blog posts list"
    ).length;

  /** The blog's item page made and then deleted: the sitemap still lists it. */
  const leaveBlogInSitemap = async () => {
    await render();
    await createBlogItemPage();
    act(() => {
      root?.unmount();
    });
    container?.remove();
    $selectedPageId.set($pages.get()?.homePageId);
    const page = findCollectionItemPage("blog") as Page;
    await updateWebstudioDataStaged((data) => {
      data.pages.pages.delete(page.id);
      for (const folder of data.pages.folders.values()) {
        folder.children = folder.children.filter((id) => id !== page.id);
      }
    });
    expect(listSitemapCollections()).toEqual(["blog"]);
  };

  test("CollectionActionsMenu calls onShowCanvas after Create item page, Open item page and an Add list that inserted", async () => {
    const onShowCanvas = vi.fn();
    const redraw = renderElement(() => (
      <CollectionActionsMenu
        slug="blog"
        name="Blog posts"
        itemPage={findCollectionItemPage("blog")}
        isSitemapOrphan={false}
        onShowCanvas={onShowCanvas}
      />
    ));
    await choose(
      menuItem(await openTrigger("Blog posts menu"), "Create item page")
    );
    const page = await until(() => {
      const found = findCollectionItemPage("blog");
      expect(found).toBeDefined();
      return found as Page;
    });
    await until(() => expect(onShowCanvas).toHaveBeenCalledTimes(1));

    $selectedPageId.set($pages.get()?.homePageId);
    redraw();
    await settle();
    await choose(
      menuItem(await openTrigger("Blog posts menu"), "Open item page")
    );
    expect($selectedPageId.get()).toEqual(page.id);
    expect(onShowCanvas).toHaveBeenCalledTimes(2);

    await choose(menuItem(await openTrigger("Blog posts menu"), "Add list"));
    await submitAddList();
    await until(() => expect(blogLists()).toBe(1));
    expect(onShowCanvas).toHaveBeenCalledTimes(3);

    // no page selected: the list has no place to go
    $selectedPageId.set(undefined);
    await choose(menuItem(await openTrigger("Blog posts menu"), "Add list"));
    await submitAddList();
    await settle();
    expect(blogLists()).toBe(1);
    expect(onShowCanvas).toHaveBeenCalledTimes(3);
  });

  test("CollectionActionsMenu calls onRemovedFromSitemap only when the removal succeeded", async () => {
    await leaveBlogInSitemap();
    const onRemovedFromSitemap = vi.fn();
    renderElement(() => (
      <CollectionActionsMenu
        slug="blog"
        name="Blog posts"
        itemPage={undefined}
        isSitemapOrphan={true}
        onRemovedFromSitemap={onRemovedFromSitemap}
      />
    ));
    await choose(
      menuItem(await openTrigger("Blog posts menu"), "Remove from sitemap")
    );
    await until(() => expect(listSitemapCollections()).toEqual([]));
    await until(() => expect(onRemovedFromSitemap).toHaveBeenCalledTimes(1));
    // nothing left to remove: the removal answers false
    await choose(
      menuItem(await openTrigger("Blog posts menu"), "Remove from sitemap")
    );
    await settle();
    expect(onRemovedFromSitemap).toHaveBeenCalledTimes(1);
  });

  test("beforeAction false runs neither Create item page nor Add list", async () => {
    const onShowCanvas = vi.fn();
    const beforeAction = vi.fn(async () => false);
    renderElement(() => (
      <CollectionActionsMenu
        slug="blog"
        name="Blog posts"
        itemPage={undefined}
        isSitemapOrphan={false}
        beforeAction={beforeAction}
        onShowCanvas={onShowCanvas}
      />
    ));
    await choose(
      menuItem(await openTrigger("Blog posts menu"), "Create item page")
    );
    await settle();
    expect(beforeAction).toHaveBeenCalledTimes(1);
    expect(findCollectionItemPage("blog")).toBeUndefined();
    await choose(menuItem(await openTrigger("Blog posts menu"), "Add list"));
    await settle();
    expect(beforeAction).toHaveBeenCalledTimes(2);
    expect(addListForm()).toBeNull();
    expect(onShowCanvas).not.toHaveBeenCalled();
  });

  test("CollectionActionsMenu puts leadingItems before its items and trailingItems after, in one menu", async () => {
    renderElement(() => (
      <CollectionActionsMenu
        slug="blog"
        name="Blog posts"
        itemPage={undefined}
        isSitemapOrphan={false}
        leadingItems={<DropdownMenuItem>Settings</DropdownMenuItem>}
        trailingItems={<DropdownMenuItem>Delete</DropdownMenuItem>}
      />
    ));
    const items = await openTrigger("Blog posts menu");
    expect(items.map((item) => item.textContent)).toEqual([
      "Settings",
      "Create item page",
      "Add list",
      "Delete",
    ]);
    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1);
  });

  test("CollectionActionsMenu puts Remove from sitemap after trailingItems", async () => {
    renderElement(() => (
      <CollectionActionsMenu
        slug="blog"
        name="Blog posts"
        itemPage={undefined}
        isSitemapOrphan={true}
        trailingItems={<DropdownMenuItem>Delete</DropdownMenuItem>}
      />
    ));
    const items = await openTrigger("Blog posts menu");
    expect(items.map((item) => item.textContent)).toEqual([
      "Create item page",
      "Add list",
      "Delete",
      "Remove from sitemap",
    ]);
  });

  test("CollectionActionsMenu holds no Add to this page", async () => {
    renderElement(() => (
      <CollectionActionsMenu
        slug="blog"
        name="Blog posts"
        itemPage={undefined}
        isSitemapOrphan={true}
      />
    ));
    const items = await openTrigger("Blog posts menu");
    expect(items.map((item) => item.textContent)).toEqual([
      "Create item page",
      "Add list",
      "Remove from sitemap",
    ]);
  });

  test("the tab's menu keeps today's order for a sitemap orphan", async () => {
    await leaveBlogInSitemap();
    await render();
    const items = await openMenu("blog");
    expect(items.map((item) => item.textContent)).toEqual([
      "Create item page",
      "Add list",
      "Add to this page",
      "Remove from sitemap",
    ]);
  });

  test("OrphanRow with removeIn menu holds Remove from sitemap in its menu, with no inline button", async () => {
    await updateWebstudioDataStaged((data) => {
      addCollectionToSitemapMutable(data, {
        schema: { slug: "gone", name: "Gone" },
        catalog: { apiBase, authorization: `"Bearer osk_token"` },
      });
    });
    expect(listSitemapCollections()).toEqual(["gone"]);
    const onRemovedFromSitemap = vi.fn();
    renderElement(() => (
      <OrphanRow
        name="gone"
        isStale={false}
        sitemapSlug="gone"
        removeIn="menu"
        onRemovedFromSitemap={onRemovedFromSitemap}
      />
    ));
    const orphan = await orphanRow();
    expect(
      Array.from(orphan.querySelectorAll("button")).some(
        (button) => button.textContent === "Remove from sitemap"
      )
    ).toBe(false);
    expect(orphan.textContent).toEqual("gone");
    const items = await openTrigger("gone menu");
    expect(items.map((item) => item.textContent)).toEqual([
      "Remove from sitemap",
    ]);
    await choose(items[0]);
    await until(() => expect(listSitemapCollections()).toEqual([]));
    await until(() => expect(onRemovedFromSitemap).toHaveBeenCalledTimes(1));
  });

  test("OrphanRow with no sitemap slug has no menu", async () => {
    renderElement(() => (
      <OrphanRow name="Events" isStale={false} removeIn="menu" />
    ));
    const orphan = await orphanRow();
    expect(orphan.textContent).toEqual("Events");
    expect(orphan.querySelector("button")).toBeNull();
  });

  test("StaleItemPageLine reads Item page uses an old address", async () => {
    renderElement(() => <StaleItemPageLine />);
    const line = await until(() => {
      const element = document.querySelector("[data-organizeos-stale-address]");
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    expect(line.textContent).toEqual("Item page uses an old address");
  });
});
