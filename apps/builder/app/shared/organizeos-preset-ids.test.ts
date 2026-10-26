import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { Resource } from "@webstudio-is/sdk";
import {
  EVENTS_BINDING_NAME,
  FORMS_PRESET_NAME,
  UPCOMING_EVENTS_BINDING_NAME,
  UPCOMING_EVENTS_PRESET_KEY,
  UPCOMING_EVENTS_RESOURCE_NAME,
  findCatalogResources,
  getResourcePresetIds,
  isPresetId,
  parseCollectionUrl,
  uuidV5,
} from "./organizeos-preset-ids";

// The implementation provisioning used before the helper moved here, verbatim
// (node:crypto). Live projects carry ids it derived, so the shared helper must
// keep deriving exactly these.
const PRESET_NAMESPACE = "3f2a1b7c-8d5e-45a1-9b2c-6e0d1a2b3c4d";
const nodeUuidV5 = (name: string): string => {
  const namespaceBytes = Buffer.from(PRESET_NAMESPACE.replace(/-/g, ""), "hex");
  const bytes = createHash("sha1")
    .update(namespaceBytes)
    .update(Buffer.from(name, "utf8"))
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

describe("uuidV5", () => {
  // This file runs in the builder's browser environment (jsdom), on the same
  // WebCrypto call the server makes in Node.
  test("derives the ids provisioning has always written", async () => {
    // "project-1" is the project id of the provisioning tests.
    expect(await uuidV5("project-1:v1:events:resource")).toBe(
      "385fcd4c-92f8-5d7c-abfe-cb941b8f2449"
    );
    expect(await uuidV5("project-1:signup:body")).toBe(
      "c1910321-d483-530e-b85a-996b46e672e5"
    );
  });

  test("matches the node:crypto implementation it replaced", async () => {
    const names = [
      "project-1:v1:events:resource",
      "project-1:v1:events:binding",
      "project-1:v1:fundraisers:resource",
      "project-1:v1:stats:binding",
      "project-1:v1:forms:resource",
      "project-1:v1:forms:binding",
      "project-1:signup:page",
      "project-1:signup:0",
      "f0e1d2c3-b4a5-4697-8877-665544332211:v1:events:resource",
      "Ünïcødé, emoji \u{1F600} and spaces",
      "",
    ];
    for (const name of names) {
      expect(await uuidV5(name)).toBe(nodeUuidV5(name));
    }
  });

  test("is an RFC 4122 version 5 UUID", async () => {
    expect(await uuidV5("project-1:v1:forms:resource")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});

describe("getResourcePresetIds", () => {
  test("derives a preset's resource and binding ids from the project and key", async () => {
    expect(await getResourcePresetIds("project-1", "forms")).toEqual({
      resourceId: "5bd1e1fb-1480-5d7a-ad4b-75e9cbeec7dd",
      bindingId: "fb5d31a4-caab-5681-b150-3a1059d89124",
    });
    expect(await getResourcePresetIds("project-1", "events")).toEqual({
      resourceId: nodeUuidV5("project-1:v1:events:resource"),
      bindingId: nodeUuidV5("project-1:v1:events:binding"),
    });
  });
});

describe("the Events blocks' names", () => {
  test("keys and names the builder and provisioning share", () => {
    expect(UPCOMING_EVENTS_PRESET_KEY).toBe("upcoming-events");
    expect(UPCOMING_EVENTS_RESOURCE_NAME).toBe("Upcoming Events");
    expect(EVENTS_BINDING_NAME).toBe("OrganizeOS Events");
    expect(UPCOMING_EVENTS_BINDING_NAME).toBe("OrganizeOS Upcoming Events");
  });

  test("a binding's name is distinctive: never its Resource's name", () => {
    expect(EVENTS_BINDING_NAME).not.toBe("Events");
    expect(UPCOMING_EVENTS_BINDING_NAME).not.toBe(
      UPCOMING_EVENTS_RESOURCE_NAME
    );
    expect(FORMS_PRESET_NAME).toBe("OrganizeOS Forms");
  });

  test("Upcoming Events gets a deterministic id of its own", async () => {
    const upcoming = await getResourcePresetIds(
      "project-1",
      UPCOMING_EVENTS_PRESET_KEY
    );
    expect(upcoming.resourceId).toBe(
      await uuidV5("project-1:v1:upcoming-events:resource")
    );
    expect(upcoming.bindingId).toBe(
      await uuidV5("project-1:v1:upcoming-events:binding")
    );
    expect(upcoming.resourceId).not.toBe(
      (await getResourcePresetIds("project-1", "events")).resourceId
    );
    expect(isPresetId(upcoming.resourceId)).toBe(true);
  });
});

describe("isPresetId", () => {
  test("tells the derived ids from Webstudio's nanoids", async () => {
    expect(isPresetId(await uuidV5("project-1:v1:forms:resource"))).toBe(true);
    expect(isPresetId("V1StGXR8_Z5jdHi6B-myT")).toBe(false);
    // a v4 UUID is not one of ours
    expect(isPresetId("f0e1d2c3-b4a5-4697-8877-665544332211")).toBe(false);
  });
});

describe("parseCollectionUrl", () => {
  test("reads the API base and slug of a collection url", () => {
    expect(
      parseCollectionUrl(`"https://app.example.org/v1/collections/blog/items"`)
    ).toEqual({ apiBase: "https://app.example.org/v1", slug: "blog" });
  });

  test.each([
    `"https://app.example.org/v1/events"`,
    `"https://app.example.org/v1/collections/blog"`,
    `"/collections/blog/items"`,
    `"https://app.example.org/v1/collections/" + slug + "/items"`,
    "not json",
    "42",
  ])("ignores %s", (url) => {
    expect(parseCollectionUrl(url)).toBeUndefined();
  });
});

describe("findCatalogResources", () => {
  const resource = (id: string, name: string, path: string): Resource => ({
    id,
    name,
    method: "get",
    url: JSON.stringify(`https://app.example.org/v1${path}`),
    headers: [],
  });

  test("lists the catalog by id: the static ones, the collections in build order, then Forms", async () => {
    const id = async (key: string) =>
      (await getResourcePresetIds("project-1", key)).resourceId;
    const forms = resource(await id("forms"), "OrganizeOS Forms", "/forms");
    const team = resource(
      await id("collection:team"),
      "Team",
      "/collections/team/items"
    );
    const stats = resource(await id("stats"), "Stats", "/stats");
    const blog = resource(
      await id("collection:blog"),
      "Blog",
      "/collections/blog/items"
    );
    const events = resource(await id("events"), "Events", "/events");
    // same urls, other ids: an admin's, or a copy Webstudio made
    const lookalikes = [
      resource("copy-of-events", "Events", "/events"),
      resource("copy-of-blog", "Blog", "/collections/blog/items"),
    ];

    const catalog = await findCatalogResources("project-1", [
      forms,
      team,
      ...lookalikes,
      stats,
      blog,
      events,
    ]);

    expect(catalog.map((entry) => [entry.key, entry.resource])).toEqual([
      ["events", events],
      ["stats", stats],
      ["collection:team", team],
      ["collection:blog", blog],
      ["forms", forms],
    ]);
    expect(catalog[0].bindingId).toBe(
      (await getResourcePresetIds("project-1", "events")).bindingId
    );
  });

  test("lists Upcoming Events after Forms, when present, and not when absent", async () => {
    const id = async (key: string) =>
      (await getResourcePresetIds("project-1", key)).resourceId;
    const forms = resource(await id("forms"), "OrganizeOS Forms", "/forms");
    const upcoming = resource(
      await id("upcoming-events"),
      "Upcoming Events",
      "/events?upcoming=true"
    );
    const events = resource(await id("events"), "Events", "/events");
    const blog = resource(
      await id("collection:blog"),
      "Blog",
      "/collections/blog/items"
    );
    // the same url under another id: a copy Webstudio made
    const copy = resource(
      "copy-of-upcoming",
      "Upcoming Events",
      "/events?upcoming=true"
    );

    const catalog = await findCatalogResources("project-1", [
      upcoming,
      copy,
      forms,
      blog,
      events,
    ]);

    expect(catalog.map((entry) => entry.key)).toEqual([
      "events",
      "collection:blog",
      "forms",
      "upcoming-events",
    ]);
    expect(catalog.at(-1)).toEqual({
      key: "upcoming-events",
      resource: upcoming,
      bindingId: (await getResourcePresetIds("project-1", "upcoming-events"))
        .bindingId,
    });
    expect(
      (await findCatalogResources("project-1", [forms, events])).map(
        (entry) => entry.key
      )
    ).toEqual(["events", "forms"]);
  });
});
