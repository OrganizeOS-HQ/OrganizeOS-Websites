import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { page, userEvent } from "@vitest/browser/context";
import { enableMapSet } from "immer";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import { renderData } from "@webstudio-is/template";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import {
  type DataSource,
  type Instance,
  type Resource,
  coreMetas,
} from "@webstudio-is/sdk";
import * as organizeosMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import { $ } from "@organizeos/site-components/site-templates";
import productsBody from "../../../../../../../packages/sdk-components-organizeos/src/__fixtures__/products.json";
import {
  $organizeosSite,
  $registeredComponentMetas,
  $selectedInstanceSelector,
  getInstanceKey,
  registerComponentLibrary,
  selectInstance,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { $authPermit, $builderMode } from "~/shared/nano-states/misc";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
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
import { buildOrgResourcePresets } from "~/shared/db/resource-presets.server";
import { insertOrganizeosBlock } from "~/builder/features/organizeos-panel/insert-organizeos-block";
import {
  readCardProduct,
  readShow,
  writeCardProduct,
} from "~/builder/features/organizeos-panel/product-blocks";
import { PropsSectionContainer } from "../props-section/props-section";

const { loaderFetch } = vi.hoisted(() => ({ loaderFetch: vi.fn() }));
vi.mock("~/shared/fetch.client", () => ({ fetch: loaderFetch }));
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: vi.fn(), info: vi.fn() } },
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

enableMapSet();
registerContainers();
$registeredComponentMetas.set(
  new Map(Object.entries({ ...defaultMetas, ...coreMetas }))
);
registerComponentLibrary({
  namespace: "@organizeos/site-components",
  components: {},
  metas: organizeosMetas,
  templates: organizeosTemplates,
});

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const ns = "@organizeos/site-components";
const base = "https://staging.example.org/api/public/v1";
const provisioned = await buildOrgResourcePresets({
  projectId: "project-1",
  apiBaseUrl: base,
  readToken: "osk_eventstoken",
});

let root: Root | undefined;
let container: HTMLElement | undefined;

const settle = () =>
  act(async () => {
    for (let turn = 0; turn < 5; turn += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });

const setProject = () => {
  const data = renderData(<$.Body ws:id="bodyId"></$.Body>);
  $instances.set(data.instances);
  $props.set(data.props);
  $breakpoints.set(new Map());
  $styles.set(new Map());
  $styleSources.set(new Map());
  $styleSourceSelections.set(new Map());
  $assets.set(new Map());
  $resources.set(
    new Map(provisioned.resources.map((resource) => [resource.id, resource]))
  );
  $dataSources.set(new Map());
  const pages = createDefaultPages({ rootInstanceId: "bodyId" });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
  $builderMode.set("design");
  $authPermit.set("build");
  selectInstance(["bodyId"]);
  $project.set({ id: "project-1" } as Project);
  serverSyncStore.transactionManager.currentStack = [];
  serverSyncStore.transactionManager.undoneStack = [];
  $organizeosSite.set({
    organizationId: "org-1",
    manageUrl: "https://app.example.org/dashboard",
    platformUrl: "https://app.example.org",
    blocksEnabled: true,
    shopBlocksEnabled: true,
  });
};

const insert = async (component: string) => {
  expect(await insertOrganizeosBlock(component)).toBe(true);
  const instance = [...$instances.get().values()].find(
    (item) => item.component === component
  ) as Instance;
  selectInstance([instance.id, "bodyId"]);
  return instance;
};

const renderPanel = async (rootId: string, width = 240) => {
  container = document.createElement("div");
  container.style.width = `${width}px`;
  document.body.appendChild(container);
  root = createRoot(container);
  const instance = $instances.get().get(rootId) as Instance;
  await act(async () =>
    root?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(PropsSectionContainer, {
          selectedInstance: instance,
          selectedInstanceKey: getInstanceKey([rootId, "bodyId"]),
        })
      )
    )
  );
  await settle();
  return container;
};

const stores = () => ({
  instances: $instances.get(),
  props: $props.get(),
  dataSources: $dataSources.get(),
  resources: $resources.get(),
});

const answer = (body: unknown, ok = true) =>
  loaderFetch.mockImplementation(async (_url: string, init: RequestInit) => {
    const [request] = JSON.parse(String(init.body));
    return {
      ok: true,
      json: async () => [
        [
          getResourceKey(request),
          { ok, status: ok ? 200 : 503, statusText: "", data: body },
        ],
      ],
    };
  });

const control = (host: HTMLElement, kind: string) =>
  host.querySelector<HTMLElement>(`[data-organizeos-control="${kind}"]`);

const undoDepth = () => serverSyncStore.transactionManager.currentStack.length;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  loaderFetch.mockReset();
  setProject();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
});

describe("the Product Grid's rows", () => {
  test("Show reads 6 and Columns keeps upstream's select at 3", async () => {
    const grid = await insert(`${ns}:ProductGrid`);
    const host = await renderPanel(grid.id);
    const show = control(host, "product-show");
    expect(show?.textContent).toContain("Show");
    expect(show?.querySelector('[role="combobox"]')?.textContent).toBe("6");
    // Columns is upstream's control, not an OrganizeOS one
    expect(host.textContent).toContain("Columns");
    expect(host.querySelectorAll("[data-organizeos-control]")).toHaveLength(1);
  });

  test("choosing All writes the collection's data in one undo step, and keeps the selection and the tab", async () => {
    const grid = await insert(`${ns}:ProductGrid`);
    const host = await renderPanel(grid.id);
    const selection = $selectedInstanceSelector.get();
    const depth = undoDepth();
    await userEvent.click(
      control(host, "product-show")?.querySelector(
        '[role="combobox"]'
      ) as HTMLElement
    );
    await userEvent.click(
      page.getByRole("option", { name: "All", exact: true })
    );
    await settle();
    expect(readShow(grid.id, stores())).toBe("All");
    expect(undoDepth()).toBe(depth + 1);
    expect($selectedInstanceSelector.get()).toEqual(selection);
    expect(host.isConnected).toBe(true);
  });
});

describe("the Product Card's Product row", () => {
  test("reads the list once on mount, and lists Newest, then the products", async () => {
    answer(productsBody);
    const card = await insert(`${ns}:ProductCard`);
    const host = await renderPanel(card.id);
    await vi.waitFor(() => expect(loaderFetch).toHaveBeenCalledTimes(1));
    const row = control(host, "product-card");
    expect(row?.querySelector('[role="combobox"]')?.textContent).toBe("Newest");
    await userEvent.click(
      row?.querySelector('[role="combobox"]') as HTMLElement
    );
    const options = Array.from(
      document.querySelectorAll('[role="option"]'),
      (option) => option.textContent
    );
    expect(options).toEqual([
      "Newest",
      "Organizer T-shirt",
      "Campaign Mug",
      "Canvas Tote Bag",
      "Sticker",
    ]);
    await userEvent.click(
      page.getByRole("option", { name: "Campaign Mug", exact: true })
    );
    await settle();
    expect(readCardProduct(card.id, stores())).toEqual({
      kind: "product",
      id: productsBody.data[1].id,
    });
    expect(loaderFetch).toHaveBeenCalledTimes(1);
  });

  test("a pick the list lacks reads Unavailable product", async () => {
    answer(productsBody);
    const card = await insert(`${ns}:ProductCard`);
    await writeCardProduct(card.id, "00000000-0000-4000-8000-000000000000");
    const host = await renderPanel(card.id);
    await vi.waitFor(() =>
      expect(
        control(host, "product-card")?.querySelector('[role="combobox"]')
          ?.textContent
      ).toBe("Unavailable product")
    );
  });

  test("while the list loads nothing shows under the select; a failure shows one line, whose Reload reads again", async () => {
    let resolve: (value: unknown) => void = () => {};
    loaderFetch.mockImplementation(
      () => new Promise((done) => (resolve = done))
    );
    const card = await insert(`${ns}:ProductCard`);
    const host = await renderPanel(card.id);
    expect(
      control(host, "product-card")?.querySelector("[data-products-load]")
    ).toBeNull();
    await act(async () => resolve({ ok: false, json: async () => [] }));
    await settle();
    const line = control(host, "product-card")?.querySelector(
      "[data-products-load]"
    );
    expect(line?.textContent).toBe("Products didn't load. Reload");
    answer(productsBody);
    await userEvent.click(page.getByRole("button", { name: "Reload" }));
    await settle();
    expect(loaderFetch).toHaveBeenCalledTimes(2);
    await vi.waitFor(() =>
      expect(
        control(host, "product-card")?.querySelector("[data-products-load]")
      ).toBeNull()
    );
  });

  test("a card whose own Resource URL is in neither form shows no value and no line, and reads nothing", async () => {
    answer(productsBody);
    const card = await insert(`${ns}:ProductCard`);
    const binding = [...$dataSources.get().values()].find(
      (dataSource) =>
        dataSource.type === "resource" && dataSource.scopeInstanceId === card.id
    ) as Extract<DataSource, { type: "resource" }>;
    const resource = $resources.get().get(binding.resourceId) as Resource;
    $resources.set(
      new Map($resources.get()).set(resource.id, {
        ...resource,
        url: `"${base}/products?sort=price"`,
      })
    );
    const host = await renderPanel(card.id);
    const row = control(host, "product-card");
    expect(row?.querySelector('[role="combobox"]')?.textContent).toBe("");
    expect(row?.querySelector("[data-products-load]")).toBeNull();
    expect(loaderFetch).not.toHaveBeenCalled();
  });

  test("while the list loads, and after a failed read, a pick is not listed as Unavailable product", async () => {
    let resolve: (value: unknown) => void = () => {};
    loaderFetch.mockImplementation(
      () => new Promise((done) => (resolve = done))
    );
    const card = await insert(`${ns}:ProductCard`);
    await writeCardProduct(card.id, productsBody.data[0].id);
    const host = await renderPanel(card.id);
    const combobox = () =>
      control(host, "product-card")?.querySelector(
        '[role="combobox"]'
      ) as HTMLElement;
    const listed = async () => {
      await userEvent.click(combobox());
      const options = Array.from(
        document.querySelectorAll('[role="option"]'),
        (option) => option.textContent
      );
      await userEvent.keyboard("{Escape}");
      await settle();
      return options;
    };
    expect(await listed()).toEqual(["Newest"]);
    await act(async () => resolve({ ok: false, json: async () => [] }));
    await settle();
    expect(
      control(host, "product-card")?.querySelector("[data-products-load]")
    ).toBeInstanceOf(HTMLElement);
    expect(combobox().textContent).toBe("");
    expect(await listed()).toEqual(["Newest"]);
  });

  test("a failed read answer shows the line too", async () => {
    answer({ error: "unavailable" }, false);
    const card = await insert(`${ns}:ProductCard`);
    const host = await renderPanel(card.id);
    await vi.waitFor(() =>
      expect(
        control(host, "product-card")?.querySelector("[data-products-load]")
      ).toBeInstanceOf(HTMLElement)
    );
  });

  test("rows fit a 240px panel: a 120-character title truncates, and no row scrolls sideways", async () => {
    const long = "A".repeat(120);
    answer({
      data: [{ ...productsBody.data[0], title: long }],
    });
    const card = await insert(`${ns}:ProductCard`);
    await writeCardProduct(card.id, productsBody.data[0].id);
    const host = await renderPanel(card.id);
    await vi.waitFor(() =>
      expect(
        control(host, "product-card")?.querySelector('[role="combobox"]')
          ?.textContent
      ).toBe(long)
    );
    const { right } = host.getBoundingClientRect();
    // what overflows a truncating ancestor (overflow: hidden) is clipped
    const clipped = (element: Element) => {
      for (
        let parent = element.parentElement;
        parent !== null && parent !== host;
        parent = parent.parentElement
      ) {
        if (getComputedStyle(parent).overflowX === "hidden") {
          return true;
        }
      }
      return false;
    };
    const overflowing = Array.from(
      host.querySelectorAll("[data-organizeos-control] *")
    ).filter(
      (element) =>
        clipped(element) === false &&
        element.getBoundingClientRect().right > right + 0.5
    );
    expect(
      overflowing.map((element) => element.outerHTML.slice(0, 80))
    ).toEqual([]);
    // the title is cut short with an ellipsis, not wrapped
    const combobox = control(host, "product-card")?.querySelector(
      '[role="combobox"]'
    ) as HTMLElement;
    const text = combobox.querySelector("span") as HTMLElement;
    expect(getComputedStyle(text).textOverflow).toBe("ellipsis");
    expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
    expect(host.scrollWidth).toBeLessThanOrEqual(240);
  });
});
