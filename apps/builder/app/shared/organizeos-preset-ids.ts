import type { Resource } from "@webstudio-is/sdk";

/**
 * The deterministic ids of an OrganizeOS org project's data catalog, shared by
 * provisioning and collections-sync on the server
 * (`shared/db/resource-presets.server.ts`, `shared/db/collections-sync.server.ts`,
 * `shared/db/signup-form-preset.server.tsx`) and the OrganizeOS panel in the
 * browser, which finds the Events Resource, adds the Forms Resource at insert
 * time and lists the catalog (`builder/features/organizeos-panel`). Both sides
 * must derive the same id from the same name, so a Resource the panel adds is
 * the one a later re-provision rewrites in place, never a second copy. The
 * names of the Resources a block creates (Forms, Upcoming Events) and of the
 * bindings a block brings live here too, so that both sides give them the same
 * ones.
 *
 * The catalog is GET Resources only. A Resource loads nowhere by itself: a use
 * (a block, or a page the panel adds it to) brings its own resource DataSource,
 * scoped to the instance that uses it, which references the catalog Resource
 * by id. The `bindingId` derived here is the id of the unscoped binding older
 * provisioning wrote next to each Resource, which never loaded; provisioning
 * and collections-sync now only remove it where nothing uses it.
 *
 * One implementation on WebCrypto (`globalThis.crypto.subtle`), which the
 * browser and Node 22 both provide. It is async because `digest` is.
 */

/**
 * The name of the Forms catalog Resource, in both writers, and of the binding
 * a Signup Form brings. The panel binds a block's `data` by id, but Webstudio
 * rebinds expressions by name when a block is duplicated, copied, pasted or
 * moved, and when a variable is saved. The block's own binding is scoped to
 * its root, so it masks a variable of this name in an enclosing scope, and a
 * copy remaps it by id: that capture applies only to a block that older
 * inserts bound at `:root`. A variable with exactly this name added on the
 * block's root itself can still take `data`, because validateDataVariableName
 * compares only `variable`-type sources. A name an admin is unlikely to reuse
 * narrows that (a known limit).
 */
export const FORMS_PRESET_NAME = "OrganizeOS Forms";

/**
 * The name of the Upcoming Events catalog Resource, in both writers. The first
 * Event List or Event Card creates it (`GET /v1/events?upcoming=true`), and
 * provisioning rewrites it where present, as it does Forms.
 */
export const UPCOMING_EVENTS_RESOURCE_NAME = "Upcoming Events";

/**
 * The names of the bindings the Events blocks bring, distinctive for the same
 * reason as FORMS_PRESET_NAME. The Events one is for the blocks that bind the
 * Events Resource as it is (the RSVP Form). A binding the Data section adds to
 * a page keeps its Resource's name ("Events", "Upcoming Events") instead.
 */
export const EVENTS_BINDING_NAME = "OrganizeOS Events";
export const UPCOMING_EVENTS_BINDING_NAME = "OrganizeOS Upcoming Events";

/** The keys of the static catalog Resources, in the order the panel lists them. */
export const STATIC_PRESET_KEYS = ["events", "fundraisers", "stats"] as const;

/** The key of the Forms catalog Resource, which the panel creates on first use. */
export const FORMS_PRESET_KEY = "forms";

/**
 * The key of the Upcoming Events catalog Resource, which the panel creates on
 * first use, like Forms.
 */
export const UPCOMING_EVENTS_PRESET_KEY = "upcoming-events";

/** The key of a public collection's catalog Resource. */
export const getCollectionPresetKey = (slug: string) => `collection:${slug}`;

// Fixed namespace for preset-derived ids. Do not change: it would orphan the
// presets already seeded into live projects.
const PRESET_NAMESPACE = "3f2a1b7c-8d5e-45a1-9b2c-6e0d1a2b3c4d";

const hexToBytes = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const namespaceBytes = hexToBytes(PRESET_NAMESPACE.replaceAll("-", ""));

/** RFC 4122 v5 (SHA-1, namespaced) UUID in the preset namespace. */
export const uuidV5 = async (name: string): Promise<string> => {
  const nameBytes = new TextEncoder().encode(name);
  const input = new Uint8Array(namespaceBytes.length + nameBytes.length);
  input.set(namespaceBytes);
  input.set(nameBytes, namespaceBytes.length);
  const digest = await globalThis.crypto.subtle.digest("SHA-1", input);
  const bytes = new Uint8Array(digest).slice(0, 16);
  // Set version (5) and the RFC 4122 variant.
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

/**
 * The ids of a /v1 preset (`key` is its path name: "events", "forms", ...):
 * its GET Resource and the resource DataSource that binds it.
 */
export const getResourcePresetIds = async (
  projectId: string,
  key: string
): Promise<{ resourceId: string; bindingId: string }> => {
  const [resourceId, bindingId] = await Promise.all([
    uuidV5(`${projectId}:v1:${key}:resource`),
    uuidV5(`${projectId}:v1:${key}:binding`),
  ]);
  return { resourceId, bindingId };
};

const UUID_V5_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Whether an id is one this module derives: a v5 UUID. Webstudio's own ids are
 * nanoids, so this tells the org's catalog Resources, which outlive the
 * bindings that reference them, from the Resource Webstudio creates for each
 * binding of its own and deletes with it.
 */
export const isPresetId = (id: string) => UUID_V5_RE.test(id);

/**
 * The API base and slug of a collection Resource's url expression, the literal
 * `"<API base>/collections/<slug>/items"` collections-sync writes, or undefined
 * for any other url.
 */
export const parseCollectionUrl = (
  url: string
): undefined | { apiBase: string; slug: string } => {
  let value: unknown;
  try {
    value = JSON.parse(url);
  } catch {
    return;
  }
  if (typeof value !== "string") {
    return;
  }
  const match = /^(.+)\/collections\/([^/]+)\/items$/.exec(value);
  if (match === null) {
    return;
  }
  try {
    return { apiBase: match[1], slug: decodeURIComponent(match[2]) };
  } catch {
    return;
  }
};

export type CatalogEntry = {
  /** The id derivation's key: "events", "forms", "collection:<slug>", ... */
  key: string;
  resource: Resource;
  /** The id of the unscoped binding older provisioning wrote for it. */
  bindingId: string;
};

/**
 * The org's catalog in a build: the Resources found by their deterministic ids,
 * never by name. Events, Fundraisers and Stats first, then the collections in
 * the build's order (a Resource whose url names a collection and whose id is
 * that collection's), then Forms, then Upcoming Events.
 */
export const findCatalogResources = async (
  projectId: string,
  resources: Iterable<Resource>
): Promise<CatalogEntry[]> => {
  const byId = new Map<string, Resource>();
  for (const resource of resources) {
    byId.set(resource.id, resource);
  }
  const find = async (key: string) => {
    const { resourceId, bindingId } = await getResourcePresetIds(
      projectId,
      key
    );
    const resource = byId.get(resourceId);
    return resource === undefined ? [] : [{ key, resource, bindingId }];
  };
  const entries: CatalogEntry[] = [];
  for (const key of STATIC_PRESET_KEYS) {
    entries.push(...(await find(key)));
  }
  for (const resource of byId.values()) {
    const collection = parseCollectionUrl(resource.url);
    if (collection === undefined) {
      continue;
    }
    const key = getCollectionPresetKey(collection.slug);
    const { resourceId, bindingId } = await getResourcePresetIds(
      projectId,
      key
    );
    if (resourceId === resource.id) {
      entries.push({ key, resource, bindingId });
    }
  }
  entries.push(...(await find(FORMS_PRESET_KEY)));
  entries.push(...(await find(UPCOMING_EVENTS_PRESET_KEY)));
  return entries;
};
