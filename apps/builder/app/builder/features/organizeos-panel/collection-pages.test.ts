import { beforeEach, describe, expect, test, vi } from "vitest";
import { enableMapSet } from "immer";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import { showAttribute } from "@webstudio-is/react-sdk";
import {
  type Instance,
  type Page,
  type Pages,
  type Prop,
  type ResourceRequest,
  type WebstudioData,
  encodeDataVariableId,
  getPagePath,
  lintExpression,
  transpileExpression,
} from "@webstudio-is/sdk";
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
import { $selectedPageId } from "~/shared/nano-states/pages";
import { selectInstance } from "~/shared/nano-states";
import { getResourceKey } from "~/shared/resources";
import { isPresetId } from "~/shared/organizeos-preset-ids";
import { getWebstudioData } from "~/shared/instance-utils/data";
import { buildCollectionResourcePresets } from "~/shared/db/resource-presets.server";
import { loadCollectionError } from "./collection-schema";
import {
  createCollectionItemPage,
  findCollectionItemPage,
  getItemPageExpressions,
} from "./collection-pages";

const { loaderFetch } = vi.hoisted(() => ({ loaderFetch: vi.fn() }));
vi.mock("~/shared/fetch.client", () => ({ fetch: loaderFetch }));

enableMapSet();
registerContainers();

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

// the blog template as `/v1/collections` sends it
const blogFields = [
  { key: "title", label: "Title", kind: "text", required: true, isTitle: true },
  { key: "summary", label: "Summary", kind: "textarea" },
  { key: "body", label: "Body", kind: "richtext", required: true },
  { key: "cover", label: "Cover image", kind: "image" },
  { key: "publishedOn", label: "Published on", kind: "date" },
  {
    key: "author",
    label: "Author",
    kind: "reference",
    reference: { collectionSlug: "team", multiple: false },
  },
  {
    key: "categories",
    label: "Categories",
    kind: "multireference",
    reference: { collectionSlug: "categories", multiple: true },
  },
];
const collections = [
  {
    slug: "blog",
    name: "Blog posts",
    singularName: "Blog post",
    kind: "curated",
    itemCount: 1,
    fields: blogFields,
  },
  {
    slug: "faq",
    name: "FAQ",
    singularName: "Question",
    kind: "curated",
    itemCount: 0,
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

let items: Record<string, Array<{ slug: string }>> = {};
let schemaFails = false;

// the resources loader, answering each posted request by its url
loaderFetch.mockImplementation(async (_url: string, init: RequestInit) => {
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
        const match = /\/collections\/([^/]+)\/items$/.exec(request.url);
        return [
          key,
          { ok: true, status: 200, data: { data: items[match?.[1] ?? ""] } },
        ];
      })
    )
  );
});

const setProject = (
  pages: Pages = createDefaultPages({ rootInstanceId: "homeBody" })
) => {
  $instances.set(
    new Map([
      [
        "homeBody",
        {
          type: "instance",
          id: "homeBody",
          component: "ws:element",
          tag: "body",
          children: [],
        },
      ],
    ])
  );
  $props.set(new Map());
  $breakpoints.set(new Map([["base", { id: "base", label: "Base" }]]));
  $styles.set(new Map());
  $styleSources.set(new Map());
  $styleSourceSelections.set(new Map());
  $assets.set(new Map());
  $resources.set(new Map(catalog.map((resource) => [resource.id, resource])));
  $dataSources.set(new Map());
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
  selectInstance(undefined);
  $project.set({ id: projectId } as Project);
};

beforeEach(() => {
  loaderFetch.mockClear();
  items = { blog: [{ slug: "first-post" }], faq: [] };
  schemaFails = false;
  setProject();
});

const createBlogPage = async () => {
  const result = await createCollectionItemPage("blog");
  if ("error" in result) {
    throw new Error(result.error);
  }
  const page = $pages.get()?.pages.get(result.pageId) as Page;
  return { result, page };
};

const getItemBinding = (page: Page) => {
  const binding = [...$dataSources.get().values()].find(
    (dataSource) =>
      dataSource.type === "resource" &&
      dataSource.scopeInstanceId === page.rootInstanceId
  );
  if (binding?.type !== "resource") {
    throw new Error("no binding");
  }
  return binding;
};

const getTree = (instanceId: Instance["id"]) => {
  const instances = $instances.get();
  const props = [...$props.get().values()];
  const walk = (id: string): unknown => {
    const instance = instances.get(id) as Instance;
    const show = props.find(
      (prop) => prop.instanceId === id && prop.name === showAttribute
    );
    return {
      component: instance.component,
      tag: instance.tag,
      label: instance.label,
      ...(show ? { show: true } : {}),
      children: instance.children.flatMap((child) =>
        child.type === "id" ? [walk(child.value)] : [child]
      ),
    };
  };
  return walk(instanceId);
};

describe("createCollectionItemPage", () => {
  test("creates '{Collection} template' at /{slug}/:slug, at the root of the Pages tree, and switches to it", async () => {
    const { result, page } = await createBlogPage();
    expect(result).toEqual({ pageId: page.id, created: true });
    expect(page.name).toEqual("Blog posts template");
    expect(page.path).toEqual("/blog/:slug");
    const pages = $pages.get() as Pages;
    expect(pages.folders.get(pages.rootFolderId)?.children).toContain(page.id);
    expect(getPagePath(page.id, pages)).toEqual("/blog/:slug");
    expect($selectedPageId.get()).toEqual(page.id);
    expect($instances.get().get(page.rootInstanceId)).toMatchObject({
      type: "instance",
      component: "ws:element",
      tag: "body",
    });
  });

  test("adds the page's own Resource, 'Current {singular}', scoped to the page root", async () => {
    const { page } = await createBlogPage();
    const binding = getItemBinding(page);
    expect(binding.name).toEqual("Current Blog post");
    expect(isPresetId(binding.resourceId)).toBe(false);
    expect($resources.get().get(binding.resourceId)).toEqual({
      id: binding.resourceId,
      name: "Current Blog post",
      method: "get",
      url: `"${apiBase}/collections/blog/items/" + ($ws$system.params.slug ?? "-")`,
      headers: [{ name: "Authorization", value: auth }],
    });
  });

  test("sets every meta field as an expression over the Resource", async () => {
    const { page } = await createBlogPage();
    const v = encodeDataVariableId(getItemBinding(page).id);
    const found = `($ws$system.params.slug ?? "") !== "" && ${v}?.ok === true && ${v}.data.data.slug === $ws$system.params.slug`;
    expect(page.title).toEqual(
      `(${found}) ? ${v}.data.data.name : "Page not found"`
    );
    expect(page.meta).toEqual({
      status: `(${found}) ? 200 : 404`,
      description: `(${found}) ? (${v}.data.data.fields.body.text ?? "").slice(0, 160) : ""`,
      socialImageUrl: `(${found}) ? (${v}.data.data.fields.cover.url ?? "") : ""`,
      excludePageFromSearch: "false",
    });
  });

  test("the description is the Summary field, else the rich text's text, else empty", () => {
    const describe = (
      fields: Parameters<typeof getItemPageExpressions>[0]["fields"]
    ) =>
      getItemPageExpressions({ variable: "$ws$dataSource$x", fields })
        .description;
    expect(
      describe([{ key: "bio", label: "Bio", kind: "textarea" }])
    ).toContain(`($ws$dataSource$x.data.data.fields.bio ?? "").slice(0, 160)`);
    expect(
      describe([{ key: "story", label: "Story", kind: "richtext" }])
    ).toContain(
      `($ws$dataSource$x.data.data.fields.story.text ?? "").slice(0, 160)`
    );
    expect(describe([{ key: "name", label: "Name", kind: "text" }])).toEqual(
      `""`
    );
  });

  test("builds the starter layout from the fields, shown when found, with a 'not found' box otherwise", async () => {
    const { page } = await createBlogPage();
    const v = encodeDataVariableId(getItemBinding(page).id);
    const tree = getTree(page.rootInstanceId) as {
      children: Array<{ children: Array<{ children: unknown[] }> }>;
    };
    const [container] = tree.children;
    const [article, notFound] = container.children;
    expect(
      article.children.map((part) => {
        const { component, tag, label, show } = part as Record<string, unknown>;
        return { component, tag, label, show };
      })
    ).toEqual([
      { component: "ws:element", tag: "h1", label: "Title", show: undefined },
      { component: "Time", tag: undefined, label: "Published on", show: true },
      { component: "Image", tag: undefined, label: "Cover image", show: true },
      {
        component: "@organizeos/site-components:RichText",
        tag: undefined,
        label: "Body",
        show: undefined,
      },
      { component: "ws:element", tag: "p", label: "Summary", show: undefined },
      { component: "ws:element", tag: "p", label: "Author", show: undefined },
    ]);
    expect(notFound).toMatchObject({
      tag: "div",
      label: "Not found",
      show: true,
      children: [
        {
          tag: "h1",
          children: [{ type: "text", value: "Page not found" }],
        },
      ],
    });

    const props = [...$props.get().values()];
    const propOf = (label: string, name: string) => {
      const instance = [...$instances.get().values()].find(
        (instance) => instance.label === label
      );
      return props.find(
        (prop) => prop.instanceId === instance?.id && prop.name === name
      ) as undefined | Extract<Prop, { type: "expression" }>;
    };
    const found = getItemPageExpressions({
      variable: v,
      fields: blogFields,
    }).found;
    expect(propOf("Item", showAttribute)?.value).toEqual(found);
    expect(propOf("Not found", showAttribute)?.value).toEqual(`!(${found})`);
    expect(propOf("Body", "value")?.value).toEqual(
      `${v}.data.data.fields.body.nodes`
    );
    expect(propOf("Cover image", "src")?.value).toEqual(
      `${v}.data.data.fields.cover.url`
    );
    expect(propOf("Cover image", "alt")?.value).toEqual(
      `${v}.data.data.fields.cover.alt`
    );
    expect(propOf("Published on", "datetime")?.value).toEqual(
      `${v}.data.data.fields.publishedOn`
    );
    // the Rich Text block brings its descendants, as its template makes it
    const richText = [...$instances.get().values()].find(
      (instance) => instance.label === "Body"
    ) as Instance;
    expect(richText.children.length).toBe(17);
    // the container is centred at 720 px
    const containerId = $instances.get().get(page.rootInstanceId)?.children[0]
      ?.value as string;
    const sourceId = $styleSourceSelections.get().get(containerId)?.values[0];
    expect(
      [...$styles.get().values()]
        .filter((style) => style.styleSourceId === sourceId)
        .map(({ property, value }) => [property, value])
    ).toEqual(
      expect.arrayContaining([
        ["maxWidth", { type: "unit", unit: "px", value: 720 }],
        ["marginLeft", { type: "keyword", value: "auto" }],
        ["marginRight", { type: "keyword", value: "auto" }],
      ])
    );
  });

  test("a schema with no rich text shows its summary, and its date as publishedAt", async () => {
    const result = await createCollectionItemPage("faq");
    if ("error" in result) {
      throw new Error(result.error);
    }
    const page = $pages.get()?.pages.get(result.pageId) as Page;
    expect(page.name).toEqual("FAQ template");
    const v = encodeDataVariableId(getItemBinding(page).id);
    const time = [...$instances.get().values()].find(
      (instance) => instance.component === "Time"
    );
    const datetime = [...$props.get().values()].find(
      (prop) => prop.instanceId === time?.id && prop.name === "datetime"
    );
    expect(datetime).toMatchObject({ value: `${v}.data.data.publishedAt` });
    expect(getItemBinding(page).name).toEqual("Current Question");
  });

  test("fills the canvas address with the first item", async () => {
    const { page } = await createBlogPage();
    expect(page.history).toEqual(["/blog/first-post"]);
  });

  test("leaves the canvas address empty with no items", async () => {
    const result = await createCollectionItemPage("faq");
    const page = $pages.get()?.pages.get((result as { pageId: string }).pageId);
    expect(page?.history).toBeUndefined();
  });

  test("returns the error, and writes nothing, when the schema cannot be read", async () => {
    schemaFails = true;
    const before = getWebstudioData();
    expect(await createCollectionItemPage("blog")).toEqual({
      error: loadCollectionError,
    });
    expect(getWebstudioData()).toEqual(before);
  });

  test("returns the error for a collection the project has no catalog Resource for", async () => {
    expect(await createCollectionItemPage("team")).toEqual({
      error: loadCollectionError,
    });
  });

  test("is one undo step", async () => {
    const before = getWebstudioData();
    await createBlogPage();
    expect(getWebstudioData()).not.toEqual(before);
    serverSyncStore.undo();
    expect(getWebstudioData()).toEqual(before);
  });

  test("never creates a second page: the existing item page is opened", async () => {
    const { page } = await createBlogPage();
    $selectedPageId.set(($pages.get() as Pages).homePageId);
    const pageCount = $pages.get()?.pages.size;
    expect(await createCollectionItemPage("blog")).toEqual({
      pageId: page.id,
      created: false,
    });
    expect($pages.get()?.pages.size).toBe(pageCount);
    expect($selectedPageId.get()).toEqual(page.id);
  });
});

describe("findCollectionItemPage", () => {
  const withPage = (page: Partial<Page>, folderSlug?: string) => {
    const pages = createDefaultPages({ rootInstanceId: "homeBody" });
    const full = {
      id: "made-by-hand",
      name: "Post",
      title: `"Post"`,
      rootInstanceId: "postBody",
      meta: {},
      path: "",
      ...page,
    } as Page;
    pages.pages.set(full.id, full);
    if (folderSlug === undefined) {
      pages.folders.get(pages.rootFolderId)?.children.push(full.id);
    } else {
      pages.folders.set("folder", {
        id: "folder",
        name: "Folder",
        slug: folderSlug,
        children: [full.id],
      });
      pages.folders.get(pages.rootFolderId)?.children.push("folder");
    }
    return pages;
  };

  test("finds a page made by hand at /{slug}/:slug", () => {
    expect(
      findCollectionItemPage("blog", withPage({ path: "/blog/:slug" }))?.id
    ).toEqual("made-by-hand");
  });

  test("counts the folders in the path", () => {
    expect(
      findCollectionItemPage("blog", withPage({ path: "/:slug" }, "blog"))?.id
    ).toEqual("made-by-hand");
    // its own path is /blog/:slug, but its full path is /news/blog/:slug
    expect(
      findCollectionItemPage("blog", withPage({ path: "/blog/:slug" }, "news"))
    ).toBeUndefined();
  });

  test("another param name is another path", () => {
    expect(
      findCollectionItemPage("blog", withPage({ path: "/blog/:post" }))
    ).toBeUndefined();
  });
});

describe("the item page's expressions", () => {
  const variable = encodeDataVariableId("item-binding");
  const expressions = getItemPageExpressions({ variable, fields: blogFields });

  test.each(Object.entries(expressions))(
    "%s passes the expression validator",
    (_name, expression) => {
      const diagnostics = lintExpression({
        expression,
        availableVariables: new Set(["$ws$system", variable]),
      });
      expect(
        diagnostics.filter(({ severity }) => severity === "error")
      ).toEqual([]);
      // and names no variable it does not have
      expect(diagnostics).toEqual([]);
    }
  );

  test("every expression the page writes passes the validator", async () => {
    const { page } = await createBlogPage();
    const binding = getItemBinding(page);
    const availableVariables = new Set([
      "$ws$system",
      encodeDataVariableId(binding.id),
    ]);
    const data: WebstudioData = getWebstudioData();
    const written: string[] = [
      page.title,
      ...(Object.values(page.meta) as string[]),
    ];
    for (const prop of data.props.values()) {
      if (prop.type === "expression") {
        written.push(prop.value);
      }
    }
    for (const instance of data.instances.values()) {
      for (const child of instance.children) {
        if (child.type === "expression") {
          written.push(child.value);
        }
      }
    }
    written.push(
      ($resources.get().get(binding.resourceId) as { url: string }).url
    );
    expect(written.length).toBeGreaterThan(10);
    for (const expression of written) {
      expect(
        lintExpression({ expression, availableVariables }),
        expression
      ).toEqual([]);
    }
  });

  // found, evaluated as the builder and a published page evaluate it
  const evaluate = (system: unknown, resource: unknown) => {
    const code = transpileExpression({
      expression: expressions.found,
      executable: true,
      replaceVariable: (identifier) =>
        identifier === "$ws$system" ? "system" : "resource",
    });
    return new Function("system", "resource", `return (${code})`)(
      system,
      resource
    );
  };
  const answer = (slug: string) => ({
    ok: true,
    status: 200,
    data: { data: { slug, name: "First post" } },
  });

  test("found: a matching slug is true", () => {
    expect(
      evaluate({ params: { slug: "first-post" } }, answer("first-post"))
    ).toBe(true);
  });

  test("found: a 404 answer is false", () => {
    expect(
      evaluate(
        { params: { slug: "missing" } },
        { ok: false, status: 404, data: { error: "Not found" } }
      )
    ).toBe(false);
  });

  test("found: a different slug in the answer is false", () => {
    expect(evaluate({ params: { slug: ".." } }, answer("first-post"))).toBe(
      false
    );
  });

  test("found: an undefined param is false, whatever the answer", () => {
    expect(
      evaluate({ params: { slug: undefined } }, answer(undefined as never))
    ).toBe(false);
    expect(evaluate({ params: {} }, { ok: true, data: { data: {} } })).toBe(
      false
    );
  });

  test("found: an undefined Resource is false", () => {
    expect(evaluate({ params: { slug: "first-post" } }, undefined)).toBe(false);
  });
});
