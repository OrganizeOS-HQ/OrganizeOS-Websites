import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Project } from "@webstudio-is/project";
import type { Resource, ResourceRequest } from "@webstudio-is/sdk";
import { $project, $resources } from "~/shared/sync/data-stores";
import { getResourceKey } from "~/shared/resources";
import { buildCollectionResourcePresets } from "~/shared/db/resource-presets.server";
import {
  findCollectionCatalog,
  loadCollectionError,
  loadCollectionSchema,
  loadFirstItemSlug,
} from "./collection-schema";

const { loaderFetch } = vi.hoisted(() => ({ loaderFetch: vi.fn() }));
vi.mock("~/shared/fetch.client", () => ({ fetch: loaderFetch }));

const projectId = "project-1";
const apiBase = "https://app.example.org/api/public/v1";
const auth = `"Bearer osk_token"`;
const { resources: catalog } = await buildCollectionResourcePresets({
  projectId,
  apiBase,
  authHeaderExpression: auth,
  collections: [
    { slug: "blog", name: "Blog posts" },
    { slug: "team", name: "Team" },
  ],
});

const blogEntry = {
  slug: "blog",
  name: "Blog posts",
  singularName: "Blog post",
  kind: "curated",
  itemCount: 2,
  fields: [
    {
      key: "title",
      label: "Title",
      kind: "text",
      required: true,
      isTitle: true,
    },
    {
      key: "level",
      label: "Level",
      kind: "option",
      options: [{ value: "a", label: "A" }],
    },
    {
      key: "author",
      label: "Author",
      kind: "reference",
      reference: { collectionSlug: "team", multiple: false },
    },
    { key: 2, label: "Broken" },
    // a key the generators could not write as a member name
    { key: "a.b", label: "Dotted", kind: "text" },
    { key: "x;y", label: "Odd", kind: "text" },
  ],
};

/** The loader's answer: `[[key, result]]` for the one posted request. */
const answer = (result: unknown) =>
  loaderFetch.mockImplementation(async (_url: string, init: RequestInit) => {
    const [request] = JSON.parse(init.body as string) as ResourceRequest[];
    return new Response(JSON.stringify([[getResourceKey(request), result]]));
  });

const postedRequests = () =>
  loaderFetch.mock.calls.map((call) => {
    const [url, init] = call as [string, RequestInit];
    return {
      url,
      method: init.method,
      body: JSON.parse(init.body as string) as ResourceRequest[],
    };
  });

beforeEach(() => {
  loaderFetch.mockReset();
  $project.set({ id: projectId } as Project);
  $resources.set(new Map(catalog.map((resource) => [resource.id, resource])));
});

describe("findCollectionCatalog", () => {
  test("finds the collection's catalog Resource by its id, with its base and header", async () => {
    const found = await findCollectionCatalog("blog");
    expect(found?.resource.name).toEqual("Blog posts");
    expect(found?.apiBase).toEqual(apiBase);
    expect(found?.authorization).toEqual(auth);
  });

  test("a Resource with the collection's url under another id is not the catalog", async () => {
    const lookalike: Resource = {
      id: "copied",
      name: "Blog posts",
      method: "get",
      url: JSON.stringify(`${apiBase}/collections/news/items`),
      headers: [{ name: "Authorization", value: auth }],
    };
    $resources.set(new Map([[lookalike.id, lookalike]]));
    expect(await findCollectionCatalog("news")).toBeUndefined();
  });
});

describe("loadCollectionSchema", () => {
  test("posts one GET of the collections list to the resources loader, with the catalog's Authorization", async () => {
    answer({ ok: true, status: 200, data: { data: [blogEntry] } });
    await loadCollectionSchema("blog");
    expect(postedRequests()).toEqual([
      {
        url: "/rest/resources-loader",
        method: "POST",
        body: [
          {
            name: "Blog posts",
            method: "get",
            url: `${apiBase}/collections`,
            searchParams: [],
            headers: [{ name: "Authorization", value: "Bearer osk_token" }],
          },
        ],
      },
    ]);
  });

  test("returns the collection's names and fields, dropping a field it cannot read or whose key is not a name", async () => {
    answer({
      ok: true,
      status: 200,
      data: {
        data: [{ ...blogEntry, slug: "team", name: "Team" }, blogEntry],
      },
    });
    expect(await loadCollectionSchema("blog")).toEqual({
      slug: "blog",
      name: "Blog posts",
      singularName: "Blog post",
      fields: [
        {
          key: "title",
          label: "Title",
          kind: "text",
          required: true,
          isTitle: true,
        },
        {
          key: "level",
          label: "Level",
          kind: "option",
          options: [{ value: "a", label: "A" }],
        },
        {
          key: "author",
          label: "Author",
          kind: "reference",
          reference: { collectionSlug: "team", multiple: false },
        },
      ],
    });
  });

  test.each([
    ["a failed read", { ok: false, status: 503, data: { error: "x" } }],
    ["an answer without the collection", { ok: true, data: { data: [] } }],
    ["an answer that is not a list", { ok: true, data: "<html>" }],
    [
      "an entry without fields",
      {
        ok: true,
        data: { data: [{ slug: "blog", name: "B", singularName: "b" }] },
      },
    ],
  ])("returns an error for %s", async (_name, result) => {
    answer(result);
    expect(await loadCollectionSchema("blog")).toEqual({
      error: loadCollectionError,
    });
  });

  test("returns an error when the loader itself fails", async () => {
    loaderFetch.mockResolvedValue(new Response("", { status: 500 }));
    expect(await loadCollectionSchema("blog")).toEqual({
      error: loadCollectionError,
    });
    loaderFetch.mockRejectedValue(new Error("offline"));
    expect(await loadCollectionSchema("blog")).toEqual({
      error: loadCollectionError,
    });
  });

  test("returns an error, and reads nothing, for a collection the project has no catalog Resource for", async () => {
    expect(await loadCollectionSchema("faq")).toEqual({
      error: loadCollectionError,
    });
    expect(loaderFetch).not.toHaveBeenCalled();
  });

  test("returns an error, and reads nothing, when the header is not a literal", async () => {
    $resources.set(
      new Map(
        catalog.map((resource) => [
          resource.id,
          {
            ...resource,
            headers: [{ name: "Authorization", value: "$ws$dataSource$token" }],
          },
        ])
      )
    );
    expect(await loadCollectionSchema("blog")).toEqual({
      error: loadCollectionError,
    });
    expect(loaderFetch).not.toHaveBeenCalled();
  });
});

describe("loadFirstItemSlug", () => {
  test("reads one item's slug through the same loader", async () => {
    answer({ ok: true, status: 200, data: { data: [{ slug: "first-post" }] } });
    const found = await findCollectionCatalog("blog");
    expect(await loadFirstItemSlug(found!, "blog")).toEqual("first-post");
    expect(postedRequests()[0].body).toEqual([
      {
        name: "Blog posts",
        method: "get",
        url: `${apiBase}/collections/blog/items`,
        searchParams: [
          { name: "limit", value: "1" },
          { name: "fields", value: "slug" },
        ],
        headers: [{ name: "Authorization", value: "Bearer osk_token" }],
      },
    ]);
  });

  test("is undefined with no items, or a failed read", async () => {
    const found = await findCollectionCatalog("blog");
    answer({ ok: true, status: 200, data: { data: [] } });
    expect(await loadFirstItemSlug(found!, "blog")).toBeUndefined();
    answer({ ok: false, status: 404, data: { error: "Not found" } });
    expect(await loadFirstItemSlug(found!, "blog")).toBeUndefined();
  });
});
