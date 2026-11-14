import type { Resource } from "@webstudio-is/sdk";
import {
  FORMS_PRESET_KEY,
  FORMS_PRESET_NAME,
  PRODUCTS_PRESET_KEY,
  PRODUCTS_RESOURCE_NAME,
  UPCOMING_EVENTS_PRESET_KEY,
  UPCOMING_EVENTS_RESOURCE_NAME,
  getCollectionPresetKey,
  getResourcePresetIds,
} from "./organizeos-preset-ids";

/**
 * OrganizeOS fork: the pure part of an org project's data catalog that the
 * server's provisioning and collections-sync (`db/resource-presets.server.ts`)
 * and the builder in the browser both build, so the two write the same
 * Resource: the static /v1 presets, the seed a collection Resource copies
 * from one of them, and a collection's catalog Resource. The browser adds a
 * public collection's Resource when the build lacks it and a collection
 * action needs it (`builder/features/cms-panel/native/cms-catalog-add.ts`);
 * a later sync then finds that same Resource. Nothing here is server-only.
 */

export type V1ResourcePreset = {
  /** The id derivation's key (organizeos-preset-ids.ts). */
  key: string;
  /** The name of the preset's Resource and DataSource. */
  label: string;
  path: string;
  /**
   * Which builds a provision writes the preset to:
   * - "always": every org project, on every provision;
   * - "when-present": only a build that already has its Resource, which is
   *   rewritten whole. It is never added: a block's insert creates it when
   *   a block first uses it. No preset has it now; "shop-blocks" falls back
   *   to it.
   * - "shop-blocks": "always" while the builder offers the Shop blocks
   *   (`ORGANIZEOS_SHOP_BLOCKS` is exactly `true`), "when-present" otherwise.
   */
  seeding: "always" | "when-present" | "shop-blocks";
};

/**
 * The /v1 read endpoints exposed as data-binding presets. These are the frozen
 * public GET DTOs from Phase 1 (see the OrganizeOS ledger repo). Write surfaces
 * (donate/signup form submission) are a separate mechanism and not seeded here.
 * Forms is the org's published forms, which the OrganizeOS Signup Form block
 * reads through its `data` prop. Upcoming Events is Events without the events
 * already over, which the Event List and Event Card blocks read. Both are
 * seeded for every org, so their `:root` bindings make them bindable without
 * a block; a block's insert still creates either when a build lacks it.
 * Products is the products the org's storefront
 * shows, newest first, at most 100, which the Product Grid reads (a Product
 * Card reads a copy of its own); it is seeded once the Shop blocks are
 * offered.
 */
export const V1_RESOURCE_PRESETS: readonly V1ResourcePreset[] = [
  { key: "events", label: "Events", path: "/events", seeding: "always" },
  {
    key: "fundraisers",
    label: "Fundraisers",
    path: "/fundraisers",
    seeding: "always",
  },
  { key: "stats", label: "Stats", path: "/stats", seeding: "always" },
  {
    key: FORMS_PRESET_KEY,
    label: FORMS_PRESET_NAME,
    path: "/forms",
    seeding: "always",
  },
  {
    key: UPCOMING_EVENTS_PRESET_KEY,
    label: UPCOMING_EVENTS_RESOURCE_NAME,
    path: "/events?upcoming=true",
    seeding: "always",
  },
  {
    key: PRODUCTS_PRESET_KEY,
    label: PRODUCTS_RESOURCE_NAME,
    path: "/products",
    seeding: "shop-blocks",
  },
];

/**
 * OrganizeOS's rule for a collection slug. The builder validates against the
 * same rule, so it accepts exactly the slugs the API serves.
 */
export const COLLECTION_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type CollectionPresetInput = {
  slug: string;
  name: string;
  kind?: string;
};

/** What a collection preset copies from a static preset already in the build. */
export type V1PresetSeed = {
  /** The /v1 API base, i.e. a static preset's url minus its path. */
  apiBase: string;
  /** The Authorization header value: already an expression, copied verbatim. */
  authHeaderExpression: string;
};

/**
 * Read the API base and the Authorization header expression back out of a
 * static /v1 preset (events, fundraisers, stats) in the build. A collections
 * sync carries no token, and the preset Resources are the one place the org's
 * token already lives, so the collection presets are seeded from them. Returns
 * the first preset that yields both, or undefined when none does (a project
 * provisioned without a read token, or presets the admin rewrote by hand).
 * Async only because the id derivation is.
 */
export const readV1PresetSeed = async ({
  projectId,
  resources,
}: {
  projectId: string;
  resources: Resource[];
}): Promise<V1PresetSeed | undefined> => {
  for (const preset of V1_RESOURCE_PRESETS) {
    const { resourceId } = await getResourcePresetIds(projectId, preset.key);
    const resource = resources.find((item) => item.id === resourceId);
    if (resource === undefined) {
      continue;
    }

    // The url is an expression. A literal is a JSON string; anything else the
    // admin wrote (a template with a variable) is not something to copy from.
    let url: unknown;
    try {
      url = JSON.parse(resource.url);
    } catch {
      continue;
    }
    if (typeof url !== "string" || url.endsWith(preset.path) === false) {
      continue;
    }
    const apiBase = url.slice(0, -preset.path.length);
    if (URL.canParse(apiBase) === false) {
      continue;
    }

    const authHeader = resource.headers?.find(
      (header) => header.name.toLowerCase() === "authorization"
    );
    if (authHeader === undefined || authHeader.value === "") {
      continue;
    }

    return { apiBase, authHeaderExpression: authHeader.value };
  }
};

/**
 * One public collection's catalog Resource, as collections-sync writes it:
 * the id from (projectId, slug), its name, a GET of the collection's items,
 * and the static preset's Authorization copied verbatim. Undefined for a
 * platform collection a static preset already covers (events, fundraisers,
 * stats). Pure (async only because the id derivation is).
 */
export const buildCollectionResource = async ({
  projectId,
  seed,
  collection,
}: {
  projectId: string;
  seed: V1PresetSeed;
  collection: CollectionPresetInput;
}): Promise<Resource | undefined> => {
  const coveredByStaticPreset = V1_RESOURCE_PRESETS.some(
    (preset) => preset.key === collection.slug
  );
  if (collection.kind === "platform" && coveredByStaticPreset) {
    return;
  }
  // `${projectId}:v1:collection:<slug>:resource`, as before the derivation
  // moved to organizeos-preset-ids.ts.
  const { resourceId } = await getResourcePresetIds(
    projectId,
    getCollectionPresetKey(collection.slug)
  );
  const base = seed.apiBase.replace(/\/+$/, "");
  return {
    id: resourceId,
    name: collection.name,
    method: "get",
    url: JSON.stringify(
      `${base}/collections/${encodeURIComponent(collection.slug)}/items`
    ),
    headers: [{ name: "Authorization", value: seed.authHeaderExpression }],
  };
};
