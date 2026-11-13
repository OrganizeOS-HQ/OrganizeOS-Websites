// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Project } from "@webstudio-is/project";
import { toast, TooltipProvider } from "@webstudio-is/design-system";
import { createDefaultPages } from "@webstudio-is/project-build";
import { defaultPlanFeatures } from "@webstudio-is/plans";
import type { Page, ResourceRequest } from "@webstudio-is/sdk";
import { renderData } from "@webstudio-is/template";
import { $ } from "@organizeos/site-components/site-templates";
import { userEvent } from "@vitest/browser/context";
import {
  $authPermit,
  $builderMode,
  $computedResourceRequests,
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
import { getResourceKey, invalidateResource } from "~/shared/resources";
import {
  buildCollectionResourcePresets,
  buildOrgResourcePresets,
} from "~/shared/db/resource-presets.server";
import { registerTestMetas } from "../../organizeos-panel/test-fixtures";
import {
  addCollectionToSitemapMutable,
  createCollectionItemPage,
  findCollectionItemPage,
  listSitemapCollections,
} from "../../organizeos-panel/collection-pages";
import { updateWebstudioDataStaged } from "../../organizeos-panel/staged-data";
import type { CmsCollectionSummary } from "./cms-source";
import {
  createFakeCmsSource,
  itemOf,
  itemsPageOf,
  POSTS_DETAIL,
  rowOf,
  type FakeCmsSource,
} from "./fake-cms-source";
import { CmsNativeScreen } from "./cms-native-screen";
import hostSource from "./cms-native-screen.tsx?raw";

const { loaderFetch } = vi.hoisted(() => ({ loaderFetch: vi.fn() }));
vi.mock("~/shared/fetch.client", () => ({ fetch: loaderFetch }));

const cmsApi = vi.hoisted(() => ({ createCmsApi: vi.fn() }));
vi.mock("./cms-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./cms-api")>()),
  createCmsApi: cmsApi.createCmsApi,
}));

vi.mock("~/shared/resources", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/shared/resources")>()),
  invalidateResource: vi.fn(),
}));

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
const newsAndEvents = await collectionCatalog([
  { slug: "news", name: "News" },
  { slug: "events", name: "Events" },
]);

// the collections' schemas, as the resources loader answers them
const schemas = [
  {
    slug: "blog",
    name: "Blog posts",
    singularName: "Blog post",
    fields: [{ key: "title", label: "Title", kind: "text", isTitle: true }],
  },
  {
    slug: "news",
    name: "News",
    singularName: "News item",
    fields: [{ key: "title", label: "Title", kind: "text", isTitle: true }],
  },
  {
    slug: "oldnews",
    name: "News",
    singularName: "News item",
    fields: [{ key: "title", label: "Title", kind: "text", isTitle: true }],
  },
];

const NEWS: CmsCollectionSummary = {
  id: "44444444-4444-4444-8444-444444444444",
  slug: "news",
  name: "News",
  singularName: "News item",
  isPublic: true,
  total: 3,
};
const EVENTS: CmsCollectionSummary = {
  id: "55555555-5555-4555-8555-555555555555",
  slug: "events",
  name: "Events",
  singularName: "Event",
  isPublic: true,
  total: 2,
};
const MEMBERS: CmsCollectionSummary = {
  id: "66666666-6666-4666-8666-666666666666",
  slug: "members",
  name: "Members",
  singularName: "Member",
  isPublic: false,
  total: 4,
};

// the resources loader, answering each posted request by its url
const answerLoader = async (_url: string, init: RequestInit) => {
  const requests = JSON.parse(init.body as string) as ResourceRequest[];
  return new Response(
    JSON.stringify(
      requests.map((request) => {
        const key = getResourceKey(request);
        if (request.url === `${apiBase}/collections`) {
          return [key, { ok: true, status: 200, data: { data: schemas } }];
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

const site = {
  organizationId: "org-1",
  manageUrl: "https://app.organizeos.org/dashboard",
  platformUrl: "https://app.organizeos.org",
  blocksEnabled: true,
};

let root: Root | undefined;
let container: HTMLElement | undefined;
let platformCollections: CmsCollectionSummary[];
const onClose = vi.fn();
const onHide = vi.fn();
const onShowClassic = vi.fn();

const setProject = (catalog = newsAndEvents) => {
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
  $organizeosSite.set(site);
  $authPermit.set("own");
  $planFeatures.set({ ...defaultPlanFeatures, allowDynamicData: true });
};

type Catalog = Awaited<ReturnType<typeof collectionCatalog>>;

/**
 * Replaces the build's collection catalog Resources, as the server's catalog
 * sync does; the item pages' own Resources stay.
 */
const replaceCatalog = (previous: Catalog, next: Catalog) =>
  $resources.set(
    new Map([
      ...[...$resources.get()].filter(([id]) =>
        previous.every((resource) => resource.id !== id)
      ),
      ...next.map((resource) => [resource.id, resource] as const),
    ])
  );

/** An item page left at the collection's old address. */
const leaveStaleItemPage = async (slug: string, name: string) => {
  const previous = await collectionCatalog([{ slug, name }]);
  setProject(previous);
  expect(await createCollectionItemPage(slug)).toMatchObject({
    created: true,
  });
  replaceCatalog(previous, newsAndEvents);
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
 * Waits until `read` passes: what the column reaches in no fixed number of
 * turns (its menus wait on the catalog's WebCrypto hashing).
 */
const until = async <T,>(read: () => T): Promise<T> => {
  await settle();
  return vi.waitFor(read, { timeout: 5000, interval: 20 });
};

/** Draws the host and waits for the `slug` collection's row. */
const render = async (slug = "news") => {
  container = document.createElement("div");
  container.style.width = "1200px";
  container.style.height = "800px";
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(CmsNativeScreen, {
          hidden: false,
          overlayShown: true,
          onClose,
          onHide,
          onShowClassic,
        })
      )
    );
  });
  await until(() =>
    expect(
      document.querySelector(`[data-cms-collection="${slug}"]`)
    ).not.toBeNull()
  );
  return container;
};

const byLabel = (label: string) =>
  document.querySelector<HTMLElement>(`[aria-label="${label}"]`);

const row = (slug: string) =>
  document.querySelector<HTMLElement>(`[data-cms-collection="${slug}"]`);

const orphans = () => [
  ...document.querySelectorAll<HTMLElement>("[data-organizeos-orphan]"),
];

const openMenu = async (label: string) => {
  const trigger = await until(() => {
    const element = byLabel(label);
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

const menuItem = (items: HTMLElement[], text: string) =>
  items.find((item) => item.textContent?.startsWith(text)) as HTMLElement;

const choose = async (item: HTMLElement) => {
  act(() => {
    item.click();
  });
  await settle();
};

/** The sitemap lists `slug`, which has no item page. */
const addToSitemap = (slug: string, name: string) =>
  updateWebstudioDataStaged((data) => {
    addCollectionToSitemapMutable(data, {
      schema: { slug, name },
      catalog: { apiBase, authorization: `"Bearer osk_token"` },
    });
  });

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  registerTestMetas();
  loaderFetch.mockReset();
  loaderFetch.mockImplementation(answerLoader);
  platformCollections = [NEWS, EVENTS, MEMBERS];
  cmsApi.createCmsApi.mockReset();
  cmsApi.createCmsApi.mockImplementation(() => {
    const fake = createFakeCmsSource();
    fake.listCollections.mockImplementation(async () => ({
      collections: platformCollections,
    }));
    return fake;
  });
  onClose.mockReset();
  onHide.mockReset();
  onShowClassic.mockReset();
  $builderMode.set("design");
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
  $builderMode.set("design");
  $project.set(undefined);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the collection actions in the CMS column", () => {
  test("in Design mode for an allowed org, a collection with a catalog Resource has its menu, a private one none", async () => {
    await render();
    await until(() => expect(byLabel("News menu")).not.toBeNull());
    expect(byLabel("Events menu")).not.toBeNull();
    expect(row("members")).not.toBeNull();
    expect(byLabel("Members menu")).toBeNull();
    expect(row("news")?.contains(byLabel("News menu"))).toBe(true);
  });

  test.each([
    ["Content mode", () => $builderMode.set("content")],
    [
      "a denied org",
      () => $organizeosSite.set({ ...site, blocksEnabled: false }),
    ],
  ])("in %s there is no menu, stale line or orphan row", async (_, gate) => {
    // a stale item page and a sitemap orphan, each with its line or row
    await leaveStaleItemPage("oldnews", "News");
    await addToSitemap("gone", "Gone");
    await render();
    await until(() => expect(byLabel("News menu")).not.toBeNull());
    expect(
      row("news")?.querySelector("[data-organizeos-stale-address]")
    ).not.toBeNull();
    expect(orphans()).toHaveLength(1);
    act(() => {
      gate();
    });
    await settle();
    expect(row("news")).not.toBeNull();
    expect(
      document.querySelectorAll("[data-organizeos-collection-menu]")
    ).toHaveLength(0);
    expect(byLabel("News menu")).toBeNull();
    expect(
      document.querySelector("[data-organizeos-stale-address]")
    ).toBeNull();
    expect(orphans()).toHaveLength(0);
    expect(document.querySelector("[data-cms-orphans]")).toBeNull();
  });

  test("the menu holds Create item page and Add list, and Remove from sitemap for a sitemap orphan; never Add to this page", async () => {
    await render();
    let items = await openMenu("News menu");
    expect(items.map((item) => item.textContent)).toEqual([
      "Create item page",
      "Add list",
    ]);
    act(() => {
      root?.unmount();
    });
    container?.remove();
    await addToSitemap("news", "News");
    expect(listSitemapCollections()).toEqual(["news"]);
    await render();
    items = await openMenu("News menu");
    expect(items.map((item) => item.textContent)).toEqual([
      "Create item page",
      "Add list",
      "Remove from sitemap",
    ]);
  });

  test("Create item page creates the page, selects it and hides the overlay", async () => {
    await render();
    await choose(menuItem(await openMenu("News menu"), "Create item page"));
    const page = await until(() => {
      const found = findCollectionItemPage("news");
      expect(found).toBeDefined();
      return found as Page;
    });
    expect(page.path).toEqual("/news/:slug");
    expect($selectedPageId.get()).toEqual(page.id);
    await until(() => expect(onHide).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
  });

  test("Open item page selects it and hides the overlay", async () => {
    await createCollectionItemPage("news");
    const page = findCollectionItemPage("news") as Page;
    expect(page).toBeDefined();
    $selectedPageId.set($pages.get()?.homePageId);
    await render();
    const items = await openMenu("News menu");
    expect(items[0].textContent).toEqual("Open item page");
    await choose(items[0]);
    expect($selectedPageId.get()).toEqual(page.id);
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("Add list inserts at the canvas selection and hides the overlay", async () => {
    selectInstance(["boxId", "bodyId"]);
    await render();
    await choose(menuItem(await openMenu("News menu"), "Add list"));
    const submit = await until(() => {
      const element = document.querySelector<HTMLElement>(
        "[data-organizeos-add-list-submit]"
      );
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    act(() => {
      submit.click();
    });
    const list = await until(() => {
      const found = [...$instances.get().values()].find(
        (instance) => instance.label === "News list"
      );
      expect(found).toBeDefined();
      return found!;
    });
    expect(
      $instances
        .get()
        .get("boxId")
        ?.children.some(
          (child) => child.type === "id" && child.value === list.id
        )
    ).toBe(true);
    await until(() => expect(onHide).toHaveBeenCalledTimes(1));
  });

  test("Remove from sitemap toasts Removed from sitemap and leaves the overlay open", async () => {
    const success = vi.spyOn(toast, "success");
    await addToSitemap("news", "News");
    await render();
    await choose(menuItem(await openMenu("News menu"), "Remove from sitemap"));
    await until(() => expect(listSitemapCollections()).toEqual([]));
    await until(() =>
      expect(success).toHaveBeenCalledWith("Removed from sitemap")
    );
    expect(success).toHaveBeenCalledTimes(1);
    expect(onHide).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("a row whose item page reads an old address shows Item page uses an old address", async () => {
    // the collection now answers at "news": a new catalog Resource, same name
    await leaveStaleItemPage("oldnews", "News");
    await render();
    const line = await until(() => {
      const element = row("news")?.querySelector(
        "[data-organizeos-stale-address]"
      );
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    expect(line.textContent).toEqual("Item page uses an old address");
    expect(
      row("events")?.querySelector("[data-organizeos-stale-address]")
    ).toBeNull();
    // the line fits the column
    expect(line.scrollWidth).toBeLessThanOrEqual(line.clientWidth);
  });

  test("a catalog collection with no platform row keeps its stale line in the foot", async () => {
    // News's item page reads an old address, and the platform lists no news
    await leaveStaleItemPage("oldnews", "News");
    platformCollections = [EVENTS, MEMBERS];
    await render("events");
    const found = await until(() => {
      const rows = orphans();
      expect(rows.map((orphan) => orphan.textContent)).toContain(
        "NewsItem page uses an old address"
      );
      return rows;
    });
    expect(found.map((orphan) => orphan.textContent)).toEqual([
      "NewsItem page uses an old address",
    ]);
  });

  test("the foot holds a stale item page, a sitemap orphan with its menu, and a catalog collection with no platform row with none", async () => {
    // an item page whose collection left the catalog
    await leaveStaleItemPage("blog", "Blog posts");
    await addToSitemap("gone", "Gone");
    // events has a catalog Resource and no platform row
    platformCollections = [NEWS, MEMBERS];
    await render();
    const rows = await until(() => {
      const found = orphans();
      expect(found).toHaveLength(3);
      return found;
    });
    expect(rows.map((orphan) => orphan.textContent)).toEqual([
      "Blog posts templateItem page uses an old address",
      "gone",
      "Events",
    ]);
    expect(rows[1].querySelector('[aria-label="gone menu"]')).not.toBeNull();
    expect(rows[0].querySelector("button")).toBeNull();
    expect(rows[2].querySelector("button")).toBeNull();
    const items = await openMenu("gone menu");
    expect(items.map((item) => item.textContent)).toEqual([
      "Remove from sitemap",
    ]);
    // the org's other presets are never collections
    expect(row("products")).toBeNull();
    expect(document.body.textContent).not.toMatch(/products/i);
  });

  test("it imports the catalog from collection-catalog.ts, never organizeos-panel/index.ts", () => {
    expect(hostSource).toContain("organizeos-panel/collection-catalog");
    expect(hostSource).not.toMatch(/organizeos-panel(\/index)?["']/);
  });
});

describe("the canvas after a write", () => {
  const NEW_ID = "77777777-7777-4777-8777-777777777777";
  const V2 = "2026-11-12T10:00:02.5+00:00";

  const request = (url: string): ResourceRequest => ({
    name: url,
    method: "get",
    url,
    searchParams: [],
    headers: [],
  });

  const buttonByText = (text: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === text
    );

  const click = async (element: HTMLElement | null | undefined) => {
    expect(element).toBeTruthy();
    await act(async () => userEvent.click(element!));
    await settle();
  };

  const retypeTitle = async (text: string) => {
    const title = await until(() => {
      const element =
        document.querySelector<HTMLInputElement>("#cms-field-title");
      expect(element).not.toBeNull();
      return element!;
    });
    await act(async () => userEvent.clear(title));
    await act(async () => userEvent.type(title, text));
    await settle();
  };

  const openFirstItem = async () =>
    click(
      await until(() => {
        const element =
          document.querySelector<HTMLElement>("[data-cms-item-id]");
        expect(element).not.toBeNull();
        return element!;
      })
    );

  const buttonNamed = (text: string) =>
    until(() => {
      const button = buttonByText(text);
      expect(button, text).toBeDefined();
      return button!;
    });

  test.each(["create", "save", "publish", "discard"] as const)(
    "after a %s the canvas refetches that collection's requests only",
    async (action) => {
      const news = request(
        `${site.platformUrl}/api/public/v1/collections/news?limit=6`
      );
      const events = request(
        `${site.platformUrl}/api/public/v1/collections/events`
      );
      vi.spyOn($computedResourceRequests, "get").mockReturnValue([
        news,
        events,
      ]);
      const item =
        action === "discard"
          ? itemOf({ status: "published", hasStagedChanges: true })
          : itemOf();
      const written = itemOf({
        id: action === "create" ? NEW_ID : item.id,
        slug: action === "create" ? "hello-world" : item.slug,
        status: action === "publish" ? "published" : item.status,
        data: { title: "Hello world", summary: null, author: null },
        updatedAt: V2,
      });
      let fake: FakeCmsSource | undefined;
      cmsApi.createCmsApi.mockImplementation(() => {
        fake = createFakeCmsSource();
        fake.listCollections.mockResolvedValue({
          collections: platformCollections,
        });
        fake.getCollection.mockResolvedValue({
          collection: {
            ...POSTS_DETAIL,
            id: NEWS.id,
            slug: NEWS.slug,
            name: NEWS.name,
            singularName: NEWS.singularName,
          },
        });
        fake.listItems.mockResolvedValue(itemsPageOf([rowOf(item)], 1, 1));
        fake.getItem.mockResolvedValue({ item });
        fake.createItem.mockResolvedValue({ item: written, created: true });
        fake.updateItem.mockResolvedValue({ item: written });
        fake.publishItem.mockResolvedValue({ item: written });
        fake.discardItemChanges.mockResolvedValue({ item: written });
        return fake;
      });
      await render();
      vi.mocked(invalidateResource).mockClear();
      switch (action) {
        case "create":
          await click(await buttonNamed("New item"));
          await retypeTitle("Hello world");
          await click(buttonByText("Save"));
          expect(fake?.createItem).toHaveBeenCalledTimes(1);
          break;
        case "save":
          await openFirstItem();
          await retypeTitle("Hello world");
          await click(buttonByText("Save"));
          expect(fake?.updateItem).toHaveBeenCalledTimes(1);
          break;
        case "publish":
          await openFirstItem();
          await click(await buttonNamed("Publish"));
          expect(fake?.publishItem).toHaveBeenCalledTimes(1);
          break;
        case "discard":
          await openFirstItem();
          await click(await buttonNamed("Discard changes"));
          await click(await buttonNamed("Discard"));
          expect(fake?.discardItemChanges).toHaveBeenCalledTimes(1);
          break;
      }
      expect(vi.mocked(invalidateResource).mock.calls).toEqual([[news]]);
    }
  );

  /** Draws the host on two News items whose list calls answer `answer`. */
  const renderList = async (answer: "ok" | "forbidden" | "unavailable") => {
    const news = request(
      `${site.platformUrl}/api/public/v1/collections/news?limit=6`
    );
    const events = request(
      `${site.platformUrl}/api/public/v1/collections/events`
    );
    vi.spyOn($computedResourceRequests, "get").mockReturnValue([news, events]);
    const first = itemOf({ status: "published" });
    const second = itemOf({
      id: NEW_ID,
      slug: "second",
      data: { title: "Second", summary: null, author: null },
    });
    let fake: FakeCmsSource | undefined;
    cmsApi.createCmsApi.mockImplementation(() => {
      fake = createFakeCmsSource();
      fake.listCollections.mockResolvedValue({
        collections: platformCollections,
      });
      fake.getCollection.mockResolvedValue({
        collection: {
          ...POSTS_DETAIL,
          id: NEWS.id,
          slug: NEWS.slug,
          name: NEWS.name,
          singularName: NEWS.singularName,
        },
      });
      fake.listItems.mockResolvedValue(
        itemsPageOf([rowOf(first), rowOf(second)], 2, 1)
      );
      fake.getItem.mockResolvedValue({ item: first });
      const failure =
        answer === "ok" ? undefined : ({ error: answer } as const);
      fake.publishItems.mockResolvedValue(
        failure ?? {
          published: [first.id],
          unchanged: [],
          conflicts: [],
          failed: [],
        }
      );
      fake.setItemsStatus.mockResolvedValue(failure ?? { changed: [first.id] });
      fake.deleteItems.mockResolvedValue(failure ?? { deleted: [first.id] });
      fake.reorderItems.mockResolvedValue(failure ?? { changed: 2 });
      return fake;
    });
    await render();
    return { news, fake: () => fake! };
  };

  const selectFirst = async () =>
    click(
      await until(() => {
        const box = document.querySelector<HTMLElement>(
          '[aria-label="Select Hello"]'
        );
        expect(box).not.toBeNull();
        return box!;
      })
    );

  const toolbarButton = (text: string) =>
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        '[role="toolbar"] button'
      ),
    ].find((button) => button.textContent === text);

  const dialogButton = (text: string) =>
    [
      ...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ].find((button) => button.textContent === text);

  const menuItem = (text: string) =>
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (element) => element.textContent === text
    );

  test.each([
    ["E10", "ok"],
    ["E10", "forbidden"],
    ["E10", "unavailable"],
    ["E11", "ok"],
    ["E11", "forbidden"],
    ["E11", "unavailable"],
    ["E12", "ok"],
    ["E12", "forbidden"],
    ["E12", "unavailable"],
    ["E13", "ok"],
    ["E13", "forbidden"],
    ["E13", "unavailable"],
    ["editor archive", "ok"],
    ["editor archive", "unavailable"],
    ["editor delete", "ok"],
  ] as const)(
    "after %s answered %s the canvas refetches that collection's requests once",
    async (call, answer) => {
      const { news, fake } = await renderList(answer);
      await until(() =>
        expect(document.querySelector("[data-cms-item-id]")).not.toBeNull()
      );
      vi.mocked(invalidateResource).mockClear();
      switch (call) {
        case "E10":
          await selectFirst();
          await click(toolbarButton("Publish"));
          expect(fake().publishItems).toHaveBeenCalledTimes(1);
          break;
        case "E11":
          await selectFirst();
          await click(toolbarButton("Archive"));
          expect(fake().setItemsStatus).toHaveBeenCalledTimes(1);
          break;
        case "E12":
          await selectFirst();
          await click(toolbarButton("Delete"));
          await click(dialogButton("Delete"));
          expect(fake().deleteItems).toHaveBeenCalledTimes(1);
          break;
        case "E13": {
          const row =
            document.querySelector<HTMLElement>("[data-cms-item-id]")!;
          act(() => {
            row.focus();
          });
          await act(async () => userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}"));
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 600));
          });
          await settle();
          expect(fake().reorderItems).toHaveBeenCalledTimes(1);
          break;
        }
        case "editor archive":
          await openFirstItem();
          await click(byLabel("Item menu"));
          await click(menuItem("Archive"));
          expect(fake().setItemsStatus).toHaveBeenCalledTimes(1);
          break;
        case "editor delete":
          await openFirstItem();
          await click(byLabel("Item menu"));
          await click(menuItem("Delete"));
          await click(dialogButton("Delete"));
          expect(fake().deleteItems).toHaveBeenCalledTimes(1);
          break;
      }
      await settle();
      expect(vi.mocked(invalidateResource).mock.calls).toEqual([[news]]);
    }
  );
});
