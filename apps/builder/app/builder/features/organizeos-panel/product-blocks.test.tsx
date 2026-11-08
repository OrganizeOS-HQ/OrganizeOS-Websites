import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { enableMapSet } from "immer";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import { renderData } from "@webstudio-is/template";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import {
  type DataSource,
  type Instance,
  type Resource,
  coreMetas,
  encodeDataSourceVariable,
} from "@webstudio-is/sdk";
import * as organizeosMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import { $ } from "@organizeos/site-components/site-templates";
import productsBody from "../../../../../../packages/sdk-components-organizeos/src/__fixtures__/products.json";
import {
  $organizeosSite,
  $registeredComponentMetas,
  $selectedInstanceSelector,
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
import { emitCommand } from "~/builder/shared/commands";
import { buildOrgResourcePresets } from "~/shared/db/resource-presets.server";
import { insertOrganizeosBlock } from "./insert-organizeos-block";
import {
  buildProductsUrl,
  findProductBlock,
  getProductOptions,
  loadCardProducts,
  parseProductsUrl,
  productsLoadTimeout,
  readCardProduct,
  readShow,
  showExpression,
  showOptions,
  writeCardProduct,
  writeShow,
} from "./product-blocks";

const { loaderFetch } = vi.hoisted(() => ({ loaderFetch: vi.fn() }));
vi.mock("~/shared/fetch.client", () => ({ fetch: loaderFetch }));
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: vi.fn(), info: vi.fn() } },
}));

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

const ns = "@organizeos/site-components";
const base = "https://staging.example.org/api/public/v1";
const uuid = "34efeec7-ef26-4210-946f-866b46b94f46";
const provisioned = await buildOrgResourcePresets({
  projectId: "project-1",
  apiBaseUrl: base,
  readToken: "osk_eventstoken",
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

const stores = () => ({
  instances: $instances.get(),
  props: $props.get(),
  dataSources: $dataSources.get(),
  resources: $resources.get(),
});

const insert = async (component: string) => {
  expect(await insertOrganizeosBlock(component)).toBe(true);
  return [...$instances.get().values()].find(
    (instance) => instance.component === component
  ) as Instance;
};

const ownBinding = (rootId: string) =>
  [...$dataSources.get().values()].find(
    (dataSource) =>
      dataSource.type === "resource" && dataSource.scopeInstanceId === rootId
  ) as Extract<DataSource, { type: "resource" }>;

const collectionData = (rootId: string) => {
  const block = findProductBlock(rootId, stores());
  return [...$props.get().values()].find(
    (prop) => prop.instanceId === block?.collection?.id && prop.name === "data"
  );
};

const undoDepth = () => serverSyncStore.transactionManager.currentStack.length;

beforeEach(() => {
  setProject();
  loaderFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("parseProductsUrl and buildProductsUrl", () => {
  test("reads Newest and a product's id, and nothing else", () => {
    expect(parseProductsUrl(`"${base}/products"`)).toEqual({ apiBase: base });
    expect(parseProductsUrl(`"${base}/products?id=${uuid}"`)).toEqual({
      apiBase: base,
      id: uuid,
    });
    for (const url of [
      `"${base}/events"`,
      `"${base}/products/x"`,
      `"${base}/products?id=${uuid}&x=1"`,
      `"${base}/products?sort=price"`,
      `"${base}/products?id=abc"`,
      `"${base}/products?id="`,
      `"/products"`,
      "`${base}/products`",
      `$ws$dataSource$abc + "/products"`,
      "42",
    ]) {
      expect(parseProductsUrl(url), url).toBeUndefined();
    }
  });

  test("an upper-case UUID reads as its lower-case id, and is written back lower-cased", () => {
    const upper = uuid.toUpperCase();
    expect(parseProductsUrl(`"${base}/products?id=${upper}"`)?.id).toBe(uuid);
    expect(buildProductsUrl(base, upper)).toBe(`"${base}/products?id=${uuid}"`);
  });

  test("round-trips", () => {
    expect(parseProductsUrl(buildProductsUrl(base))).toEqual({ apiBase: base });
    expect(parseProductsUrl(buildProductsUrl(base, uuid))).toEqual({
      apiBase: base,
      id: uuid,
    });
  });
});

describe("Show", () => {
  test("reads the insert's form as 6, and each of 3, 4, 6, 8, 12 and All once written", async () => {
    const root = await insert(`${ns}:ProductGrid`);
    expect(readShow(root.id, stores())).toBe("6");
    for (const show of showOptions) {
      const depth = undoDepth();
      expect(await writeShow(root.id, show)).toBe(true);
      expect(undoDepth()).toBe(depth + 1);
      expect(readShow(root.id, stores())).toBe(show);
      expect(collectionData(root.id)?.value).toBe(
        showExpression(encodeDataSourceVariable(ownBinding(root.id).id), show)
      );
    }
    expect(collectionData(root.id)?.value).toBe(
      `(${encodeDataSourceVariable(ownBinding(root.id).id)}.ok === true ? ${encodeDataSourceVariable(ownBinding(root.id).id)}.data.data : [])`
    );
  });

  test("an edited expression, or one over another binding, shows no value; choosing writes the form", async () => {
    const root = await insert(`${ns}:ProductGrid`);
    const prop = collectionData(root.id);
    if (prop === undefined) {
      throw Error("no data prop");
    }
    $props.set(
      new Map($props.get()).set(prop.id, {
        ...prop,
        type: "expression",
        value: `(${encodeDataSourceVariable(ownBinding(root.id).id)}.ok === true ? ${encodeDataSourceVariable(ownBinding(root.id).id)}.data.data.slice(1, 4) : [])`,
      })
    );
    expect(readShow(root.id, stores())).toBeUndefined();
    $props.set(
      new Map($props.get()).set(prop.id, {
        ...prop,
        type: "expression",
        value: showExpression(encodeDataSourceVariable("other"), "6"),
      })
    );
    expect(readShow(root.id, stores())).toBeUndefined();
    await writeShow(root.id, "4");
    expect(readShow(root.id, stores())).toBe("4");
  });

  test("writes only the collection's data, and leaves the selection where it was", async () => {
    const root = await insert(`${ns}:ProductGrid`);
    const selection = $selectedInstanceSelector.get();
    const before = stores();
    await writeShow(root.id, "12");
    const after = stores();
    expect(after.resources).toBe(before.resources);
    expect(after.dataSources).toBe(before.dataSources);
    expect(after.instances).toBe(before.instances);
    expect($selectedInstanceSelector.get()).toEqual(selection);
    emitCommand("undo");
    expect(readShow(root.id, stores())).toBe("6");
  });
});

describe("Product", () => {
  test("a fresh card reads Newest; choosing a product rewrites its own Resource only, in one undo step", async () => {
    const root = await insert(`${ns}:ProductCard`);
    expect(readCardProduct(root.id, stores())).toEqual({ kind: "newest" });
    const resourceId = ownBinding(root.id).resourceId;
    const catalog = [...$resources.get()].filter(([id]) => id !== resourceId);
    const depth = undoDepth();
    const selection = $selectedInstanceSelector.get();

    expect(await writeCardProduct(root.id, uuid.toUpperCase())).toBe(true);
    expect(undoDepth()).toBe(depth + 1);
    expect($resources.get().get(resourceId)?.url).toBe(
      `"${base}/products?id=${uuid}"`
    );
    expect(readCardProduct(root.id, stores())).toEqual({
      kind: "product",
      id: uuid,
    });
    // the catalog untouched
    for (const [id, resource] of catalog) {
      expect($resources.get().get(id), id).toBe(resource);
    }
    expect($selectedInstanceSelector.get()).toEqual(selection);

    await writeCardProduct(root.id, undefined);
    expect(readCardProduct(root.id, stores())).toEqual({ kind: "newest" });
  });

  test("an edited URL shows no value", async () => {
    const root = await insert(`${ns}:ProductCard`);
    const resourceId = ownBinding(root.id).resourceId;
    const resource = $resources.get().get(resourceId) as Resource;
    $resources.set(
      new Map($resources.get()).set(resourceId, {
        ...resource,
        url: `"${base}/products?id=${uuid}&x=1"`,
      })
    );
    expect(readCardProduct(root.id, stores())).toBeUndefined();
  });

  test("options: Newest, then the titles in order; a missing pick listed first as Unavailable product", () => {
    const products = [
      { id: "a", title: "Organizer T-shirt" },
      { id: "b", title: "Untitled product" },
    ];
    expect(getProductOptions(products)).toEqual([
      { value: "newest", label: "Newest" },
      { value: "a", label: "Organizer T-shirt" },
      { value: "b", label: "Untitled product" },
    ]);
    expect(getProductOptions(products, "a")).toHaveLength(3);
    expect(getProductOptions(products, "gone")[0]).toEqual({
      value: "gone",
      label: "Unavailable product",
    });
  });

  test("the list is read with the card Resource's Authorization", async () => {
    const root = await insert(`${ns}:ProductCard`);
    loaderFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const [request] = JSON.parse(String(init.body));
      expect(request).toMatchObject({
        method: "get",
        url: `${base}/products`,
        headers: [{ name: "Authorization", value: "Bearer osk_eventstoken" }],
      });
      const { getResourceKey } = await import("~/shared/resources");
      return {
        ok: true,
        json: async () => [
          [
            getResourceKey(request),
            { ok: true, status: 200, statusText: "", data: productsBody },
          ],
        ],
      };
    });
    expect(await loadCardProducts(root.id, stores())).toEqual(
      productsBody.data.map(({ id, title }) => ({ id, title }))
    );
    expect(loaderFetch).toHaveBeenCalledTimes(1);
  });

  test("a failed read, and one past the timeout, give undefined", async () => {
    const root = await insert(`${ns}:ProductCard`);
    loaderFetch.mockResolvedValue({ ok: false, json: async () => [] });
    expect(await loadCardProducts(root.id, stores())).toBeUndefined();

    vi.useFakeTimers();
    loaderFetch.mockImplementation(() => new Promise(() => {}));
    const pending = loadCardProducts(root.id, stores());
    await vi.advanceTimersByTimeAsync(productsLoadTimeout);
    expect(await pending).toBeUndefined();
  });
});
