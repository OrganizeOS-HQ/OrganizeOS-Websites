import { afterEach, describe, expect, test, vi } from "vitest";
import collectionCreateFixture from "~/shared/__fixtures__/cms-door/collection-create.json";
import collectionDeleteReferencedFixture from "~/shared/__fixtures__/cms-door/collection-delete-referenced.json";
import collectionDeleteFixture from "~/shared/__fixtures__/cms-door/collection-delete.json";
import collectionSchemaFixture from "~/shared/__fixtures__/cms-door/collection-schema.json";
import collectionSettingsFixture from "~/shared/__fixtures__/cms-door/collection-settings.json";
import collectionStructureFixture from "~/shared/__fixtures__/cms-door/collection-structure.json";
import structureFixture from "~/shared/__fixtures__/cms-door/structure.json";
import { createCmsStructureApi } from "./cms-structure-api";

// The builder's fetch adds the CSRF header to every request it sends
const { routeFetch } = vi.hoisted(() => ({ routeFetch: vi.fn() }));

vi.mock("~/shared/fetch.client", () => ({
  fetch: (...args: unknown[]) => routeFetch(...args),
}));

const c = "22222222-2222-4222-8222-222222222222";
const clientId = "44444444-4444-4444-8444-444444444444";
const base = "/rest/organizeos-cms/project-1";
const api = createCmsStructureApi("project-1");
const version = "2026-11-01T09:00:00+00:00";

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const settings = {
  name: "Articles",
  singularName: "Article",
  slug: "articles",
  isPublic: false,
};

afterEach(() => {
  routeFetch.mockReset();
  vi.restoreAllMocks();
});

describe("createCmsStructureApi", () => {
  test.each([
    [
      "E20",
      structureFixture,
      () => api.getStructure(),
      "GET",
      `${base}/structure`,
      undefined,
      structureFixture.body,
    ],
    [
      "E21",
      collectionStructureFixture,
      () => api.getCollectionStructure(c),
      "GET",
      `${base}/collections/${c}/structure`,
      undefined,
      collectionStructureFixture.body,
    ],
    [
      "E22",
      collectionCreateFixture,
      () =>
        api.createCollection({ clientId, type: "custom", name: "Speakers" }),
      "POST",
      `${base}/collections`,
      { clientId, type: "custom", name: "Speakers" },
      { ...collectionCreateFixture.body, created: true },
    ],
    [
      "E23",
      collectionSettingsFixture,
      () =>
        api.updateCollection(c, { ...settings, expectedUpdatedAt: version }),
      "PUT",
      `${base}/collections/${c}`,
      { ...settings, expectedUpdatedAt: version },
      collectionSettingsFixture.body,
    ],
    [
      "E24",
      collectionSchemaFixture,
      () =>
        api.updateSchema(c, {
          fields: collectionSchemaFixture.body.fields as never,
          removeKeys: ["cover"],
          expectedUpdatedAt: version,
        }),
      "PUT",
      `${base}/collections/${c}/schema`,
      {
        fields: collectionSchemaFixture.body.fields,
        removeKeys: ["cover"],
        expectedUpdatedAt: version,
      },
      collectionSchemaFixture.body,
    ],
    [
      "E25",
      collectionDeleteFixture,
      () => api.deleteCollection(c),
      "POST",
      `${base}/collections/${c}/delete`,
      {},
      collectionDeleteFixture.body,
    ],
    [
      "E25 referenced",
      collectionDeleteReferencedFixture,
      () => api.deleteCollection(c),
      "POST",
      `${base}/collections/${c}/delete`,
      {},
      { error: "referenced" },
    ],
  ])(
    "%s replays the platform's fixture through its call",
    async (_name, fixture, run, method, path, sent, expected) => {
      routeFetch.mockResolvedValueOnce(answer(fixture.body, fixture.status));
      expect(await run()).toEqual(expected);
      const [calledPath, init] = routeFetch.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(calledPath).toBe(path);
      expect(init.method).toBe(method);
      if (sent === undefined) {
        expect(init.body).toBeUndefined();
      } else {
        expect(JSON.parse(init.body as string)).toEqual(sent);
      }
    }
  );

  test("E21 keeps locked and showInTable", async () => {
    const collection = {
      ...collectionStructureFixture.body.collection,
      fields: [
        {
          key: "title",
          label: "Title",
          kind: "text",
          isTitle: true,
          required: true,
          locked: true,
        },
        { key: "date", label: "Date", kind: "date", showInTable: true },
      ],
    };
    routeFetch.mockResolvedValueOnce(answer({ collection }));
    expect(await api.getCollectionStructure(c)).toEqual({ collection });
  });

  test("E22 answered 200 is the collection already made, created false", async () => {
    routeFetch.mockResolvedValueOnce(answer(collectionCreateFixture.body, 200));
    expect(
      await api.createCollection({ clientId, type: "custom", name: "Speakers" })
    ).toEqual({ ...collectionCreateFixture.body, created: false });
  });

  test("E22 sends its clientId unchanged on every attempt", async () => {
    routeFetch.mockResolvedValue(answer({ error: "unavailable" }, 503));
    const body = { clientId, type: "blog", name: "News" };
    await api.createCollection(body);
    await api.createCollection(body);
    const sentIds = (routeFetch.mock.calls as [string, RequestInit][]).map(
      ([, init]) => JSON.parse(init.body as string).clientId
    );
    expect(sentIds).toEqual([clientId, clientId]);
  });

  test("an unknown code reads unavailable", async () => {
    routeFetch.mockResolvedValueOnce(answer({ error: "teapot" }, 418));
    expect(await api.deleteCollection(c)).toEqual({ error: "unavailable" });
  });

  test("a fetch that throws, or a timeout, reads unavailable, never thrown", async () => {
    routeFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await api.getStructure()).toEqual({ error: "unavailable" });
    const timeout = new Error("The operation timed out.");
    timeout.name = "TimeoutError";
    routeFetch.mockRejectedValueOnce(timeout);
    expect(
      await api.updateSchema(c, { fields: [], expectedUpdatedAt: version })
    ).toEqual({ error: "unavailable" });
  });

  test("each call carries the 20 s timeout", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    routeFetch.mockResolvedValue(answer({ error: "unavailable" }, 503));
    await api.getCollectionStructure(c);
    expect(timeout).toHaveBeenLastCalledWith(20_000);
  });
});
