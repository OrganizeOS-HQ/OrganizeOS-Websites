import { beforeEach, describe, expect, test, vi } from "vitest";
import { enableMapSet } from "immer";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import { showAttribute } from "@webstudio-is/react-sdk";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import {
  type DataSource,
  type Instance,
  type Prop,
  type Resource,
  type ResourceRequest,
  coreMetas,
  encodeDataVariableId,
  lintExpression,
  transpileExpression,
} from "@webstudio-is/sdk";
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
import { $selectedPageId } from "~/shared/nano-states/pages";
import {
  $registeredComponentMetas,
  $selectedInstanceSelector,
  selectInstance,
} from "~/shared/nano-states";
import { getResourceKey } from "~/shared/resources";
import { isTreeSatisfyingContentModel } from "~/shared/content-model";
import { findAvailableVariables } from "~/shared/data-variables";
import { buildCollectionResourcePresets } from "~/shared/db/resource-presets.server";
import { loadCollectionError } from "./collection-schema";
import {
  type CollectionListOptions,
  getListSearchParams,
  insertCollectionList,
} from "./collection-list";

const { loaderFetch } = vi.hoisted(() => ({ loaderFetch: vi.fn() }));
vi.mock("~/shared/fetch.client", () => ({ fetch: loaderFetch }));

enableMapSet();
registerContainers();
$registeredComponentMetas.set(
  new Map(Object.entries({ ...defaultMetas, ...coreMetas }))
);

const projectId = "project-1";
const apiBase = "https://app.example.org/api/public/v1";
const auth = `"Bearer osk_token"`;
const { resources: catalog } = await buildCollectionResourcePresets({
  projectId,
  apiBase,
  authHeaderExpression: auth,
  collections: [
    { slug: "blog", name: "Blog posts" },
    { slug: "faq", name: "FAQ" },
  ],
});

// the blog and faq templates as `/v1/collections` sends them
const blogFields = [
  { key: "title", label: "Title", kind: "text", required: true, isTitle: true },
  { key: "summary", label: "Summary", kind: "textarea" },
  { key: "body", label: "Body", kind: "richtext", required: true },
  { key: "cover", label: "Cover image", kind: "image" },
  { key: "publishedOn", label: "Published on", kind: "date" },
];
const collections = [
  {
    slug: "blog",
    name: "Blog posts",
    singularName: "Blog post",
    fields: blogFields,
  },
  {
    slug: "faq",
    name: "FAQ",
    singularName: "Question",
    fields: [
      {
        key: "question",
        label: "Question",
        kind: "text",
        required: true,
        isTitle: true,
      },
      { key: "answer", label: "Answer", kind: "textarea", required: true },
    ],
  },
];

let schemaFails = false;

loaderFetch.mockImplementation(async (_url: string, init: RequestInit) => {
  const requests = JSON.parse(init.body as string) as ResourceRequest[];
  return new Response(
    JSON.stringify(
      requests.map((request) => [
        getResourceKey(request),
        schemaFails
          ? { ok: false, status: 503, data: { error: "Unavailable" } }
          : { ok: true, status: 200, data: { data: collections } },
      ])
    )
  );
});

const setProject = () => {
  $instances.set(
    new Map<Instance["id"], Instance>([
      [
        "homeBody",
        {
          type: "instance",
          id: "homeBody",
          component: "ws:element",
          tag: "body",
          children: [
            { type: "id", value: "heading" },
            { type: "id", value: "box" },
          ],
        },
      ],
      [
        "heading",
        {
          type: "instance",
          id: "heading",
          component: "ws:element",
          tag: "h1",
          children: [{ type: "text", value: "Welcome" }],
        },
      ],
      [
        "box",
        {
          type: "instance",
          id: "box",
          component: "ws:element",
          tag: "div",
          children: [],
        },
      ],
    ])
  );
  $props.set(new Map());
  $breakpoints.set(
    new Map([
      ["base", { id: "base", label: "Base" }],
      ["tablet", { id: "tablet", label: "Tablet", maxWidth: 991 }],
      ["mobile", { id: "mobile", label: "Mobile landscape", maxWidth: 767 }],
    ])
  );
  $styles.set(new Map());
  $styleSources.set(new Map());
  $styleSourceSelections.set(new Map());
  $assets.set(new Map());
  $resources.set(new Map(catalog.map((resource) => [resource.id, resource])));
  $dataSources.set(new Map());
  const pages = createDefaultPages({ rootInstanceId: "homeBody" });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
  selectInstance(undefined);
  $project.set({ id: projectId } as Project);
};

beforeEach(() => {
  loaderFetch.mockClear();
  schemaFails = false;
  setProject();
});

const defaults: CollectionListOptions = {
  slug: "blog",
  layout: "grid",
  sort: "newest",
  count: 6,
  link: false,
};

const insertList = async (options: Partial<CollectionListOptions> = {}) => {
  const result = await insertCollectionList({ ...defaults, ...options });
  if ("error" in result) {
    throw new Error(result.error);
  }
  expect(result.inserted).toBe(true);
  const rootId = $selectedInstanceSelector.get()?.[0] as Instance["id"];
  const root = $instances.get().get(rootId) as Instance;
  const binding = [...$dataSources.get().values()].find(
    (dataSource) =>
      dataSource.type === "resource" && dataSource.scopeInstanceId === rootId
  ) as Extract<DataSource, { type: "resource" }>;
  const resource = $resources.get().get(binding.resourceId) as Resource;
  return { root, binding, resource, list: encodeDataVariableId(binding.id) };
};

const propsOf = (instanceId: Instance["id"]) =>
  [...$props.get().values()].filter((prop) => prop.instanceId === instanceId);

const propOf = (instanceId: Instance["id"], name: string) =>
  propsOf(instanceId).find((prop) => prop.name === name);

const childrenOf = (instanceId: Instance["id"]) =>
  ($instances.get().get(instanceId) as Instance).children.flatMap((child) =>
    child.type === "id" ? [$instances.get().get(child.value) as Instance] : []
  );

const findByLabel = (label: string) =>
  [...$instances.get().values()].find((instance) => instance.label === label);

/** The local styles of an instance, by breakpoint id, as css text values. */
const stylesOf = (instanceId: Instance["id"]) => {
  const selection = $styleSourceSelections.get().get(instanceId);
  const byBreakpoint: Record<string, Record<string, unknown>> = {};
  for (const decl of $styles.get().values()) {
    if (selection?.values.includes(decl.styleSourceId)) {
      byBreakpoint[decl.breakpointId] ??= {};
      byBreakpoint[decl.breakpointId][decl.property] = decl.value;
    }
  }
  return byBreakpoint;
};

/** An expression evaluated as the builder and a published page do. */
const evaluate = (expression: string, values: Record<string, unknown>) => {
  const names = Object.keys(values);
  const code = transpileExpression({
    expression,
    executable: true,
    replaceVariable: (identifier) => `v${names.indexOf(identifier)}` as string,
  });
  return new Function(
    ...names.map((_, index) => `v${index}`),
    `return (${code})`
  )(...Object.values(values));
};

describe("insertCollectionList: the Resource", () => {
  test("'{Collection} list', scoped to the block root, the items url with the catalog's Authorization", async () => {
    const { root, binding, resource } = await insertList();
    expect(root.label).toEqual("Blog posts list");
    expect(binding.name).toEqual("Blog posts list");
    expect(resource).toEqual({
      id: binding.resourceId,
      name: "Blog posts list",
      method: "get",
      url: JSON.stringify(`${apiBase}/collections/blog/items`),
      searchParams: [
        { name: "sort", value: `"-publishedAt"` },
        { name: "limit", value: `"6"` },
        { name: "fields", value: `"cover,publishedOn,summary"` },
      ],
      headers: [{ name: "Authorization", value: auth }],
    });
    // a Resource of its own, not the catalog one
    expect(catalog.some(({ id }) => id === resource.id)).toBe(false);
  });

  test.each([
    ["newest", "-publishedAt"],
    ["oldest", "publishedAt"],
    ["az", "name"],
    ["manual", "sortOrder"],
  ] as const)("sort %s is `%s`", (sort, value) => {
    expect(
      getListSearchParams({ sort, count: 3, fieldKeys: [] }).find(
        ({ name }) => name === "sort"
      )
    ).toEqual({ name: "sort", value: JSON.stringify(value) });
  });

  test.each([3, 6, 9, 12] as const)("show %s is its limit", (count) => {
    expect(
      getListSearchParams({ sort: "newest", count, fieldKeys: ["a"] })
    ).toContainEqual({ name: "limit", value: JSON.stringify(String(count)) });
  });

  test("show All omits limit, so the API's default applies", () => {
    expect(
      getListSearchParams({ sort: "newest", count: "all", fieldKeys: ["a"] })
    ).toEqual([
      { name: "sort", value: `"-publishedAt"` },
      { name: "fields", value: `"a"` },
    ]);
  });

  test("fields names only the card's own keys; with none, it is omitted, and the system keys come back regardless", async () => {
    const { resource } = await insertList({ slug: "faq", count: "all" });
    expect(resource.searchParams).toEqual([
      { name: "sort", value: `"-publishedAt"` },
      { name: "fields", value: `"answer"` },
    ]);
    expect(
      getListSearchParams({ sort: "newest", count: 3, fieldKeys: [] })
    ).toEqual([
      { name: "sort", value: `"-publishedAt"` },
      { name: "limit", value: `"3"` },
    ]);
  });
});

describe("insertCollectionList: the collection and the card", () => {
  test("a ws:collection over the list, read only when it answered", async () => {
    const { root, list } = await insertList();
    const [items] = childrenOf(root.id);
    const [collection] = childrenOf(items.id);
    expect(collection.component).toEqual("ws:collection");
    expect(propOf(collection.id, "data")).toMatchObject({
      type: "expression",
      value: `(${list}.ok === true ? ${list}.data.data : [])`,
    });
    const parameter = $dataSources
      .get()
      .get((propOf(collection.id, "item") as Prop).value as string);
    expect(parameter).toMatchObject({
      type: "parameter",
      name: "collectionItem",
      scopeInstanceId: collection.id,
    });
    const data = (propOf(collection.id, "data") as Prop).value as string;
    const answer = { ok: true, data: { data: [{ slug: "a" }] } };
    expect(evaluate(data, { [list]: answer })).toEqual([{ slug: "a" }]);
    expect(evaluate(data, { [list]: { ok: false, data: {} } })).toEqual([]);
    expect(evaluate(data, { [list]: undefined })).toEqual([]);
  });

  test("the card holds the Image, an h3 Title, the Date and the Summary", async () => {
    const { root } = await insertList();
    const [items] = childrenOf(root.id);
    const [collection] = childrenOf(items.id);
    const item = encodeDataVariableId(
      (propOf(collection.id, "item") as Prop).value as string
    );
    const [card] = childrenOf(collection.id);
    expect(card).toMatchObject({ component: "ws:element", tag: "div" });
    const [image, text] = childrenOf(card.id);
    expect(image.component).toEqual("Image");
    expect(propOf(image.id, "src")?.value).toEqual(`${item}.fields.cover.url`);
    expect(propOf(image.id, "alt")?.value).toEqual(`${item}.fields.cover.alt`);
    const [title, date, summary] = childrenOf(text.id);
    expect(title).toMatchObject({
      tag: "h3",
      children: [{ type: "expression", value: `${item}.name` }],
    });
    expect(date.component).toEqual("Time");
    expect(propOf(date.id, "datetime")?.value).toEqual(
      `${item}.fields.publishedOn`
    );
    expect(summary).toMatchObject({
      tag: "p",
      children: [{ type: "expression", value: `${item}.fields.summary` }],
    });
  });

  test("without an image or date field, no Image, and the date is the item's publishedAt", async () => {
    const { root } = await insertList({ slug: "faq" });
    const [items] = childrenOf(root.id);
    const [collection] = childrenOf(items.id);
    const item = encodeDataVariableId(
      (propOf(collection.id, "item") as Prop).value as string
    );
    const [card] = childrenOf(collection.id);
    const parts = childrenOf(card.id);
    expect(parts.map(({ component }) => component)).toEqual(["ws:element"]);
    const [, date] = childrenOf(parts[0].id);
    expect(propOf(date.id, "datetime")?.value).toEqual(`${item}.publishedAt`);
  });

  test("link off: no Link", async () => {
    const { root } = await insertList({ link: false });
    const [items] = childrenOf(root.id);
    const [collection] = childrenOf(items.id);
    expect(childrenOf(collection.id).map(({ tag }) => tag)).toEqual(["div"]);
    expect(
      [...$instances.get().values()].some((instance) => instance.tag === "a")
    ).toBe(false);
  });

  test("link on: the card is wrapped in a Link to the item's page", async () => {
    const { root } = await insertList({ link: true });
    const [items] = childrenOf(root.id);
    const [collection] = childrenOf(items.id);
    const item = encodeDataVariableId(
      (propOf(collection.id, "item") as Prop).value as string
    );
    const [link] = childrenOf(collection.id);
    expect(link.tag).toEqual("a");
    expect(propOf(link.id, "href")).toMatchObject({
      type: "expression",
      value: `"/blog/" + ${item}.slug`,
    });
    expect(
      evaluate(`"/blog/" + ${item}.slug`, { [item]: { slug: "first-post" } })
    ).toEqual("/blog/first-post");
    expect(childrenOf(link.id).map(({ tag }) => tag)).toEqual(["div"]);
  });

  test("the block satisfies the content model", async () => {
    for (const link of [false, true]) {
      setProject();
      const { root } = await insertList({ link });
      expect(
        isTreeSatisfyingContentModel({
          instances: $instances.get(),
          props: $props.get(),
          metas: $registeredComponentMetas.get(),
          instanceSelector: [root.id, "homeBody"],
        })
      ).toBe(true);
    }
  });
});

describe("insertCollectionList: the layouts", () => {
  test("Grid is three columns, one under 768 px", async () => {
    const { root } = await insertList({ layout: "grid" });
    const [items] = childrenOf(root.id);
    const styles = stylesOf(items.id);
    expect(styles.base).toMatchObject({ display: { value: "grid" } });
    expect(JSON.stringify(styles.base.gridTemplateColumns)).toContain("3");
    expect(styles.mobile).toEqual({
      gridTemplateColumns: expect.anything(),
    });
    expect(JSON.stringify(styles.mobile.gridTemplateColumns)).not.toContain(
      "3"
    );
    expect(styles.tablet).toBeUndefined();
  });

  test("List is rows with the image at the left", async () => {
    const { root } = await insertList({ layout: "list" });
    const [items] = childrenOf(root.id);
    expect(stylesOf(items.id).base).toMatchObject({
      display: { value: "flex" },
      flexDirection: { value: "column" },
    });
    const [collection] = childrenOf(items.id);
    const [card] = childrenOf(collection.id);
    expect(stylesOf(card.id).base).toMatchObject({
      display: { value: "flex" },
      flexDirection: { value: "row" },
    });
    const [image] = childrenOf(card.id);
    expect(image.component).toEqual("Image");
    expect(stylesOf(image.id).base).toMatchObject({
      flexShrink: { value: 0 },
    });
  });
});

describe("insertCollectionList: the empty and error boxes", () => {
  test("'No items yet' shows for an empty answer, 'Could not load' for a failed read, neither while loading", async () => {
    const { list } = await insertList();
    const empty = findByLabel("No items yet") as Instance;
    const failed = findByLabel("Could not load") as Instance;
    const emptyShow = propOf(empty.id, showAttribute)?.value as string;
    const failedShow = propOf(failed.id, showAttribute)?.value as string;
    const cases: Array<[unknown, boolean, boolean]> = [
      [{ ok: true, data: { data: [] } }, true, false],
      [{ ok: true, data: { data: [{ slug: "a" }] } }, false, false],
      [{ ok: false, status: 404, data: { error: "Not found" } }, false, true],
      [undefined, false, false],
    ];
    for (const [answer, showsEmpty, showsFailed] of cases) {
      expect(Boolean(evaluate(emptyShow, { [list]: answer }))).toBe(showsEmpty);
      expect(Boolean(evaluate(failedShow, { [list]: answer }))).toBe(
        showsFailed
      );
    }
  });
});

describe("insertCollectionList: placement and errors", () => {
  test("goes in at the selection", async () => {
    selectInstance(["box", "homeBody"]);
    const { root } = await insertList();
    expect(childrenOf("box").map(({ id }) => id)).toEqual([root.id]);
  });

  test("else at the end of the page", async () => {
    const { root } = await insertList();
    expect(childrenOf("homeBody").map(({ id }) => id)).toEqual([
      "heading",
      "box",
      root.id,
    ]);
  });

  test("a failed schema read is 'Could not load the collection', and writes nothing", async () => {
    schemaFails = true;
    const before = $instances.get();
    expect(await insertCollectionList(defaults)).toEqual({
      error: loadCollectionError,
    });
    expect($instances.get()).toBe(before);
  });

  test("a collection the catalog lacks is the same error", async () => {
    expect(await insertCollectionList({ ...defaults, slug: "team" })).toEqual({
      error: loadCollectionError,
    });
  });

  test("every expression it writes passes the validator, with the variables in scope", async () => {
    await insertList({ link: true });
    const instances = $instances.get();
    const dataSources = $dataSources.get();
    const scopeOf = (instanceId: Instance["id"]) =>
      new Set(
        findAvailableVariables({
          startingInstanceId: instanceId,
          instances,
          dataSources,
        }).map((variable) => encodeDataVariableId(variable.id))
      );
    const written: Array<[string, Set<string>]> = [];
    for (const prop of $props.get().values()) {
      if (prop.type === "expression") {
        written.push([prop.value, scopeOf(prop.instanceId)]);
      }
    }
    for (const instance of instances.values()) {
      for (const child of instance.children) {
        if (child.type === "expression") {
          written.push([child.value, scopeOf(instance.id)]);
        }
      }
    }
    expect(written.length).toBeGreaterThan(8);
    for (const [expression, availableVariables] of written) {
      expect(
        lintExpression({ expression, availableVariables }),
        expression
      ).toEqual([]);
    }
  });
});
