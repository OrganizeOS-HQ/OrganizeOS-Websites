import { afterEach, describe, expect, test, vi } from "vitest";
import collectionFixture from "~/shared/__fixtures__/cms-door/collection.json";
import collectionsFixture from "~/shared/__fixtures__/cms-door/collections.json";
import itemFixture from "~/shared/__fixtures__/cms-door/item.json";
import itemWriteFixture from "~/shared/__fixtures__/cms-door/item-write.json";
import itemsFixture from "~/shared/__fixtures__/cms-door/items.json";
import searchFixture from "~/shared/__fixtures__/cms-door/search.json";
import {
  CMS_REQUEST_TIMEOUT_MS,
  CMS_UPLOAD_TIMEOUT_MS,
  cmsDoorPath,
  cmsSearchTerm,
  createCmsApi,
} from "./cms-api";
import { cmsFieldKinds } from "./cms-source";

// The builder's fetch adds the CSRF header to every request it sends
const { routeFetch } = vi.hoisted(() => ({ routeFetch: vi.fn() }));

vi.mock("~/shared/fetch.client", () => ({
  fetch: (...args: unknown[]) => routeFetch(...args),
}));

const c = "22222222-2222-4222-8222-222222222222";
const i = "33333333-3333-4333-8333-333333333333";
const base = "/rest/organizeos-cms/project-1";
const api = createCmsApi("project-1");

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const item = {
  id: i,
  slug: "a",
  status: "draft",
  hasStagedChanges: false,
  data: {},
  updatedAt: "2026-11-07T10:00:00.123456+00:00",
  createdAt: "2026-11-07T10:00:00.123456+00:00",
  publishedAt: null,
};

const lastCall = () => {
  const [path, init] = routeFetch.mock.calls[0] as [string, RequestInit];
  return { path, init };
};

afterEach(() => {
  routeFetch.mockReset();
  vi.restoreAllMocks();
});

describe("cmsDoorPath", () => {
  test("encodes the project and keeps the defined, non-empty values in order", () => {
    expect(
      cmsDoorPath("a/b", "collections", { z: "1", a: undefined, m: "", b: "2" })
    ).toBe("/rest/organizeos-cms/a%2Fb/collections?z=1&b=2");
    expect(cmsDoorPath("p", "access")).toBe("/rest/organizeos-cms/p/access");
  });
});

describe("createCmsApi", () => {
  test.each([
    ["getAccess", () => api.getAccess(), "GET", `${base}/access`],
    [
      "listCollections",
      () => api.listCollections(),
      "GET",
      `${base}/collections`,
    ],
    [
      "getCollection",
      () => api.getCollection(c),
      "GET",
      `${base}/collections/${c}`,
    ],
    [
      "listItems",
      () => api.listItems(c, { q: "café", page: 2 }),
      "GET",
      `${base}/collections/${c}/items?q=caf%C3%A9&page=2`,
    ],
    [
      "listItems without q",
      () => api.listItems(c, { q: "" }),
      "GET",
      `${base}/collections/${c}/items`,
    ],
    [
      "getItem",
      () => api.getItem(c, i),
      "GET",
      `${base}/collections/${c}/items/${i}`,
    ],
    [
      "searchItems",
      () => api.searchItems(c, { ids: [c, i] }),
      "GET",
      `${base}/collections/${c}/items/search?ids=${c}%2C${i}`,
    ],
    [
      "searchItems with q and ids",
      () => api.searchItems(c, { q: "news", ids: [i] }),
      "GET",
      `${base}/collections/${c}/items/search?q=news&ids=${i}`,
    ],
    [
      "createItem",
      () => api.createItem(c, { clientId: i, data: {} }),
      "POST",
      `${base}/collections/${c}/items`,
    ],
    [
      "updateItem",
      () => api.updateItem(c, i, { data: {}, expectedUpdatedAt: "x" }),
      "PUT",
      `${base}/collections/${c}/items/${i}`,
    ],
    [
      "publishItem",
      () => api.publishItem(c, i, { expectedUpdatedAt: "x" }),
      "POST",
      `${base}/collections/${c}/items/${i}/publish`,
    ],
    [
      "discardItemChanges",
      () => api.discardItemChanges(c, i, { expectedUpdatedAt: "x" }),
      "POST",
      `${base}/collections/${c}/items/${i}/discard`,
    ],
    [
      "uploadImage",
      () =>
        api.uploadImage(
          new File([new Uint8Array(1)], "a.png", { type: "image/png" })
        ),
      "POST",
      `${base}/uploads/image`,
    ],
  ] as const)("%s calls its door path", async (_name, run, method, path) => {
    routeFetch.mockResolvedValueOnce(ok({ error: "not_found" }, 404));
    await run();
    expect(routeFetch).toHaveBeenCalledTimes(1);
    const call = lastCall();
    expect(call.path).toBe(path);
    expect(call.init.method).toBe(method);
  });

  test("a write sends its body as JSON with Content-Type application/json", async () => {
    const body = { clientId: i, slug: "a", data: { title: "A" } };
    routeFetch.mockResolvedValueOnce(ok({ item }, 201));
    await api.createItem(c, body);
    const { init } = lastCall();
    expect(init.body).toBe(JSON.stringify(body));
    expect(new Headers(init.headers).get("Content-Type")).toBe(
      "application/json"
    );
  });

  test("searchItems with neither q nor ids answers no items without a request", async () => {
    expect(await api.searchItems(c, {})).toEqual({ items: [] });
    expect(await api.searchItems(c, { q: "  ", ids: [] })).toEqual({
      items: [],
    });
    expect(routeFetch).not.toHaveBeenCalled();
  });

  test("uploadImage sends one FormData entry, file, and sets no Content-Type of its own", async () => {
    const file = new File([new Uint8Array(1)], "a.png", { type: "image/png" });
    routeFetch.mockResolvedValueOnce(
      ok({ url: "https://x.example/a.png", path: "org/collections/a.png" })
    );
    await api.uploadImage(file);
    const { init } = lastCall();
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect([...form.keys()]).toEqual(["file"]);
    expect(form.get("file")).toBe(file);
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);
  });

  test("waits 20 s, and 35 s for an upload", async () => {
    expect(CMS_REQUEST_TIMEOUT_MS).toBe(20_000);
    expect(CMS_UPLOAD_TIMEOUT_MS).toBe(35_000);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    routeFetch.mockResolvedValue(ok({ error: "not_found" }, 404));
    await api.getItem(c, i);
    expect(timeout).toHaveBeenLastCalledWith(20_000);
    await api.updateItem(c, i, { data: {}, expectedUpdatedAt: "x" });
    expect(timeout).toHaveBeenLastCalledWith(20_000);
    await api.uploadImage(new File([new Uint8Array(1)], "a.png"));
    expect(timeout).toHaveBeenLastCalledWith(35_000);
    for (const [, init] of routeFetch.mock.calls as [string, RequestInit][]) {
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });

  test("returns the item with updatedAt exactly as the platform sent it", async () => {
    const updatedAt = "2026-11-07T10:00:00.123456+00:00";
    routeFetch.mockResolvedValueOnce(
      ok({ item: { ...item, updatedAt, createdAt: updatedAt } })
    );
    expect(await api.getItem(c, i)).toEqual({
      item: { ...item, updatedAt, createdAt: updatedAt },
    });
  });

  test("returns the door's error code, and its field", async () => {
    routeFetch.mockResolvedValueOnce(ok({ error: "conflict" }, 409));
    expect(
      await api.updateItem(c, i, { data: {}, expectedUpdatedAt: "x" })
    ).toEqual({ error: "conflict" });
    routeFetch.mockResolvedValueOnce(
      ok({ error: "invalid", field: "title" }, 400)
    );
    expect(await api.createItem(c, { clientId: i, data: {} })).toEqual({
      error: "invalid",
      field: "title",
    });
    routeFetch.mockResolvedValueOnce(ok({ error: "refused" }, 401));
    expect(await api.getAccess()).toEqual({ error: "refused" });
  });

  test.each([
    ["an unknown code", () => ok({ error: "teapot" }, 418)],
    [
      "a field longer than 64",
      () => ok({ error: "invalid", field: "f".repeat(65) }, 400),
    ],
    [
      "an answer that is not JSON",
      () => new Response("<html>", { status: 502 }),
    ],
    ["a dark door's empty 404", () => new Response(null, { status: 404 })],
    ["a success of the wrong shape", () => ok({ items: "x" })],
    ["a success carrying an error code", () => ok({ error: "conflict" })],
  ])("%s is unavailable", async (_name, answer) => {
    routeFetch.mockResolvedValueOnce(answer());
    expect(await api.listItems(c, {})).toEqual({ error: "unavailable" });
  });

  test("a timeout or any throw is unavailable, never thrown", async () => {
    const timeout = new Error("The operation timed out.");
    timeout.name = "TimeoutError";
    routeFetch.mockRejectedValueOnce(timeout);
    expect(await api.getAccess()).toEqual({ error: "unavailable" });
    routeFetch.mockRejectedValueOnce(new Error("CSRF token is not set."));
    expect(await api.publishItem(c, i, { expectedUpdatedAt: "x" })).toEqual({
      error: "unavailable",
    });
  });

  // A pasted title
  test.each([
    ["a 250-character paste", "a".repeat(250), "a".repeat(200)],
    [
      "an emoji split by the cut",
      `${"a".repeat(199)}\u{1F600}`,
      "a".repeat(199),
    ],
    ["100 emoji", "\u{1F600}".repeat(100), "\u{1F600}".repeat(100)],
    ["surrounding spaces", "  news  ", "news"],
    ["only spaces", "   ", undefined],
    ["nothing", undefined, undefined],
  ])("cmsSearchTerm keeps %s within 200 units", (_name, q, out) => {
    expect(cmsSearchTerm(q)).toBe(out);
  });

  test("listItems and searchItems send the cut term", async () => {
    routeFetch.mockResolvedValue(ok({ error: "not_found" }, 404));
    await api.listItems(c, { q: "a".repeat(250) });
    await api.searchItems(c, { q: "a".repeat(250) });
    const queries = (routeFetch.mock.calls as [string][]).map(
      ([path]) => new URL(path, "https://builder.example").searchParams
    );
    expect(queries[0].get("q")).toBe("a".repeat(200));
    expect(queries[1].get("q")).toBe("a".repeat(200));
  });

  // The platform sends canonical kinds and editor-only keys
  test("E2's fields parse with every canonical kind, the editor-only keys dropped", async () => {
    routeFetch.mockResolvedValueOnce(
      ok({
        collection: {
          id: c,
          slug: "posts",
          name: "Posts",
          singularName: "Post",
          isPublic: true,
          fields: cmsFieldKinds.map((kind, n) => ({
            key: `f${n}`,
            label: kind,
            kind,
            locked: true,
            showInTable: false,
          })),
        },
      })
    );
    const result = await api.getCollection(c);
    if ("error" in result) {
      throw new Error(result.error);
    }
    expect(result.collection.fields).toHaveLength(15);
    expect(result.collection.fields.map((field) => field.kind)).toEqual([
      ...cmsFieldKinds,
    ]);
    for (const field of result.collection.fields) {
      expect(field).not.toHaveProperty("locked");
      expect(field).not.toHaveProperty("showInTable");
    }
  });

  test("a field of a kind the client does not know makes E2 unavailable", async () => {
    routeFetch.mockResolvedValueOnce(
      ok({
        collection: {
          id: c,
          slug: "posts",
          name: "Posts",
          singularName: "Post",
          isPublic: true,
          fields: [{ key: "site", label: "Site", kind: "url" }],
        },
      })
    );
    expect(await api.getCollection(c)).toEqual({ error: "unavailable" });
  });

  // The platform pins no E0 or E9 answer; these are spec 5.4's shapes
  test("parses E0's and E9's answers", async () => {
    const access = {
      canEdit: true,
      canPublish: false,
      canManageSettings: false,
    };
    routeFetch.mockResolvedValueOnce(ok(access));
    expect(await api.getAccess()).toEqual(access);
    const upload = {
      url: "https://x.example/storage/v1/object/public/organization-images/o/collections/1-a.png",
      path: "o/collections/1-a.png",
    };
    routeFetch.mockResolvedValueOnce(ok(upload));
    expect(
      await api.uploadImage(new File([new Uint8Array(1)], "a.png"))
    ).toEqual(upload);
    routeFetch.mockResolvedValueOnce(ok({ canEdit: "yes" }));
    expect(await api.getAccess()).toEqual({ error: "unavailable" });
  });

  // The platform's own answers, so the two repositories' shapes cannot
  // drift apart unseen
  test.each([
    ["collections", collectionsFixture, () => api.listCollections()],
    ["collection", collectionFixture, () => api.getCollection(c)],
    ["items", itemsFixture, () => api.listItems(c, {})],
    ["item", itemFixture, () => api.getItem(c, i)],
    ["search", searchFixture, () => api.searchItems(c, { ids: [i] })],
    [
      "item-write",
      itemWriteFixture,
      () => api.createItem(c, { clientId: i, data: { title: "New post" } }),
    ],
  ] as const)(
    "parses the platform's %s fixture as it is",
    async (_name, { status, body }, run) => {
      routeFetch.mockResolvedValueOnce(ok(body, status));
      expect(await run()).toEqual(body);
    }
  );
});
