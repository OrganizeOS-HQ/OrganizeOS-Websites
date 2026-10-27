import { describe, expect, test } from "vitest";
import type { ResourceRequest } from "@webstudio-is/sdk";
import {
  cmsMessageSchema,
  findCollectionRequests,
  readCmsMessage,
} from "./cms-messages";

const platformUrl = "https://app.organizeos.org";

describe("cmsMessageSchema", () => {
  test.each([
    { type: "cms.item_saved", collection: "news" },
    { type: "cms.collection_changed", collection: "news" },
    { type: "cms.collection_changed", collection: null },
    { type: "cms.dirty", dirty: true },
    { type: "cms.dirty", dirty: false },
  ])("accepts the platform's flat shape %j", (message) => {
    expect(cmsMessageSchema.parse(message)).toEqual(message);
  });

  test.each([
    [
      "a nested payload",
      { type: "cms.item_saved", payload: { collection: "news" } },
    ],
    [
      "a nested payload beside the field",
      { type: "cms.item_saved", collection: "news", payload: {} },
    ],
    ["an extra key", { type: "cms.dirty", dirty: true, org: "org-1" }],
    ["an unknown type", { type: "cms.org_changed", collection: "news" }],
    ["a null item collection", { type: "cms.item_saved", collection: null }],
    [
      "a slug of the wrong shape",
      { type: "cms.item_saved", collection: "News/../x" },
    ],
    ["a string flag", { type: "cms.dirty", dirty: "true" }],
    ["a string", "cms.dirty"],
    ["null", null],
  ])("drops %s", (_case, message) => {
    expect(cmsMessageSchema.safeParse(message).success).toBe(false);
  });
});

describe("readCmsMessage", () => {
  const frameWindow = {} as Window;
  const event = (overrides: Partial<MessageEvent> = {}) =>
    ({
      origin: platformUrl,
      source: frameWindow,
      data: { type: "cms.dirty", dirty: true },
      ...overrides,
    }) as MessageEvent;

  test("accepts a message from the frame's window on the app's origin", () => {
    expect(readCmsMessage(event(), { frameWindow, platformUrl })).toEqual({
      type: "cms.dirty",
      dirty: true,
    });
  });

  test.each([
    ["another origin", { origin: "https://evil.example" }],
    [
      "the builder's own origin",
      { origin: "https://p-1.builder.organizeos.org" },
    ],
    ["an app subdomain", { origin: "https://acme.app.organizeos.org" }],
    ["another window", { source: {} as Window }],
    ["no window", { source: null }],
    ["a malformed payload", { data: { type: "cms.dirty", dirty: 1 } }],
  ])("drops a message from %s", (_case, overrides) => {
    expect(
      readCmsMessage(event(overrides as Partial<MessageEvent>), {
        frameWindow,
        platformUrl,
      })
    ).toBeUndefined();
  });

  test("drops every message while there is no frame", () => {
    expect(
      readCmsMessage(event({ source: null }), {
        frameWindow: null,
        platformUrl,
      })
    ).toBeUndefined();
  });
});

describe("findCollectionRequests", () => {
  const request = (url: string): ResourceRequest => ({
    name: url,
    method: "get",
    url,
    searchParams: [],
    headers: [],
  });

  test("finds only that collection's requests on the app's origin", () => {
    const requests = [
      request(`${platformUrl}/api/public/v1/collections/news/items`),
      request(`${platformUrl}/api/public/v1/collections/news/items/first-post`),
      request(`${platformUrl}/api/public/v1/collections/news`),
      request(`${platformUrl}/api/public/v1/collections/news-archive/items`),
      request(`${platformUrl}/api/public/v1/collections/team/items`),
      request(`${platformUrl}/api/public/v1/events`),
      request("https://evil.example/api/public/v1/collections/news/items"),
      request(
        "https://app.organizeos.org@evil.example/api/public/v1/collections/news/items"
      ),
      request(
        "https://user@app.organizeos.org/api/public/v1/collections/news/items"
      ),
      request("/api/public/v1/collections/news/items"),
      request("not a url"),
    ];
    expect(
      findCollectionRequests(requests, { slug: "news", platformUrl }).map(
        ({ url }) => url
      )
    ).toEqual([
      `${platformUrl}/api/public/v1/collections/news/items`,
      `${platformUrl}/api/public/v1/collections/news/items/first-post`,
      `${platformUrl}/api/public/v1/collections/news`,
    ]);
  });

  test("finds nothing for a platform URL that does not parse", () => {
    expect(
      findCollectionRequests(
        [request(`${platformUrl}/api/public/v1/collections/news/items`)],
        { slug: "news", platformUrl: "nope" }
      )
    ).toEqual([]);
  });
});
