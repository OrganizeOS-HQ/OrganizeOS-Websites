import {
  type DataSource,
  type Resource,
  ROOT_INSTANCE_ID,
} from "@webstudio-is/sdk";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import {
  FORMS_PRESET_NAME,
  getResourcePresetIds,
} from "../organizeos-preset-ids";

/**
 * OrganizeOS Websites 2.0 Phase 4d: seed a provisioned org's project with
 * ready-to-bind data Resources pointed at the OrganizeOS public read API (/v1).
 *
 * Each preset is a server-side `Resource` (GET) plus a `resource` DataSource so
 * it shows up in the builder's data panel and can be bound to a Collection with
 * no setup. The per-org read token is inlined as a literal Authorization header
 * expression on each Resource; resource headers are evaluated only in the
 * SERVER-side getResources() (builder loader / published-page loader) and never
 * shipped to a visitor's browser (Webstudio resolves Resource fetches in the
 * page loader).
 *
 * The token is an org-scoped, READ-ONLY, public-data-only key (it only unlocks
 * already-published + public data via /v1 and is revocable), so persisting it
 * in the org's own project build is acceptable: the same admins could mint one
 * themselves.
 *
 * All ids are derived DETERMINISTICALLY from (projectId, key) so seeding is
 * idempotent: re-provisioning updates the same Resource/variable in place
 * (e.g. rotating the token value) instead of duplicating presets. The
 * derivation lives in shared/organizeos-preset-ids.ts, because the builder's
 * OrganizeOS panel derives the same ids in the browser: it adds the Forms
 * preset when a block first uses it, and a re-provision then rewrites that
 * same preset.
 */

type V1ResourcePreset = {
  /** The id derivation's key (organizeos-preset-ids.ts). */
  key: string;
  /** The name of the preset's Resource and DataSource. */
  label: string;
  path: string;
  /**
   * Which builds a provision writes the preset to:
   * - "always": every org project, on every provision;
   * - "when-present": only a build that already has it (its binding id or its
   *   resource id), where both records are rewritten whole. It is never added:
   *   the OrganizeOS panel creates it when a block first uses it.
   */
  seeding: "always" | "when-present";
  /** The DataSource's scope; none when absent. */
  scopeInstanceId?: DataSource["scopeInstanceId"];
};

/**
 * The /v1 read endpoints exposed as data-binding presets. These are the frozen
 * public GET DTOs from Phase 1 (see the OrganizeOS ledger repo). Write surfaces
 * (donate/signup form submission) are a separate mechanism and not seeded here.
 * Forms is the org's published forms, which the OrganizeOS Signup Form block
 * reads through its `data` prop.
 *
 * Webstudio loads a data source, in the builder and on a published page, only
 * when its scope is on the page or is `:root`, so an unscoped preset never
 * loads. Forms is scoped at `:root`, the global scope. A `:root` resource is
 * fetched on every page of the site, on every request, and nothing caches
 * those fetches, so Forms is seeded only where a block uses it. Events,
 * Fundraisers and Stats stay unscoped until the owner decides how a site pays
 * for loading them (spec section 12).
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
  // "when-present" is temporary for Forms: the starter signup page of spec
  // decision 8, if adopted, needs Forms seeded.
  {
    key: "forms",
    label: FORMS_PRESET_NAME,
    path: "/forms",
    seeding: "when-present",
    scopeInstanceId: ROOT_INSTANCE_ID,
  },
];

export type OrgResourcePresets = {
  dataSources: DataSource[];
  resources: Resource[];
};

/**
 * Build the preset Resources + DataSources for an org's project. Pure: returns
 * the objects to merge into a build, touches no I/O (async only because the id
 * derivation is). It builds every preset, whatever its seeding mode;
 * seedProjectResourcePresets decides which of them a build gets.
 */
export const buildOrgResourcePresets = async ({
  projectId,
  apiBaseUrl,
  readToken,
}: {
  projectId: string;
  apiBaseUrl: string;
  readToken: string;
}): Promise<OrgResourcePresets> => {
  const base = apiBaseUrl.replace(/\/+$/, "");

  // The token is inlined as a LITERAL header expression, not routed through a
  // variable DataSource. Variables are instance-scoped (page codegen drops
  // out-of-scope ones: the publish spike produced "Bearer " + undefined), and
  // these Resources must be bindable from any page. Resource headers are only
  // evaluated server-side (builder loader / published-page loader), so the
  // literal is equivalent security-wise, and the deterministic resource ids
  // mean a re-provision rewrites the literal on token rotation.
  const authHeaderExpression = JSON.stringify(`Bearer ${readToken}`);

  const resources: Resource[] = [];
  const dataSources: DataSource[] = [];

  for (const preset of V1_RESOURCE_PRESETS) {
    const { resourceId, bindingId } = await getResourcePresetIds(
      projectId,
      preset.key
    );

    resources.push({
      id: resourceId,
      name: preset.label,
      method: "get",
      // Expressions: a plain URL literal is a quoted string.
      url: JSON.stringify(`${base}${preset.path}`),
      headers: [{ name: "Authorization", value: authHeaderExpression }],
    });

    const binding: DataSource = {
      type: "resource",
      id: bindingId,
      name: preset.label,
      resourceId,
    };
    if (preset.scopeInstanceId !== undefined) {
      binding.scopeInstanceId = preset.scopeInstanceId;
    }
    dataSources.push(binding);
  }

  return { dataSources, resources };
};

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
 * Build one Resource + binding DataSource per public collection, so a
 * collection's items can be bound in the builder's data panel like the static
 * presets. Pure (async only because the id derivation is). Ids derive from
 * (projectId, slug), so a rename keeps them and only updates the names.
 *
 * A slug listed twice keeps the last entry. A platform collection that a
 * static preset already covers (events, fundraisers, stats) is skipped; a
 * platform collection with any other slug is seeded like any other.
 */
export const buildCollectionResourcePresets = async ({
  projectId,
  apiBase,
  authHeaderExpression,
  collections,
}: {
  projectId: string;
  apiBase: string;
  authHeaderExpression: string;
  collections: CollectionPresetInput[];
}): Promise<OrgResourcePresets> => {
  const base = apiBase.replace(/\/+$/, "");
  const bySlug = new Map(
    collections.map((collection) => [collection.slug, collection])
  );

  const resources: Resource[] = [];
  const dataSources: DataSource[] = [];

  for (const collection of bySlug.values()) {
    const coveredByStaticPreset = V1_RESOURCE_PRESETS.some(
      (preset) => preset.key === collection.slug
    );
    if (collection.kind === "platform" && coveredByStaticPreset) {
      continue;
    }

    // `${projectId}:v1:collection:<slug>:resource|binding`, as before the
    // derivation moved to organizeos-preset-ids.ts.
    const { resourceId, bindingId } = await getResourcePresetIds(
      projectId,
      `collection:${collection.slug}`
    );

    resources.push({
      id: resourceId,
      name: collection.name,
      method: "get",
      url: JSON.stringify(
        `${base}/collections/${encodeURIComponent(collection.slug)}/items`
      ),
      headers: [{ name: "Authorization", value: authHeaderExpression }],
    });

    dataSources.push({
      type: "resource",
      id: bindingId,
      name: collection.name,
      resourceId,
    });
  }

  return { dataSources, resources };
};

/**
 * Replace existing entries that share an incoming id where they stand, and
 * append the rest. Unlike mergeById this keeps the order of what is already
 * there, so a re-sync does not reshuffle the builder's data panel.
 */
export const upsertById = <Type extends { id: string }>(
  existing: Type[],
  incoming: Type[]
): Type[] => {
  const incomingById = new Map(incoming.map((item) => [item.id, item]));
  const merged = existing.map((item) => incomingById.get(item.id) ?? item);
  const existingIds = new Set(existing.map((item) => item.id));
  return [...merged, ...incoming.filter((item) => !existingIds.has(item.id))];
};

/** Replace any existing entries sharing an incoming id, keep the rest, append the incoming. */
const mergeById = <Type extends { id: string }>(
  existing: Type[],
  incoming: Type[]
): Type[] => {
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [...existing.filter((item) => !incomingIds.has(item.id)), ...incoming];
};

/**
 * Seed (or re-sync) the org's dev build with the /v1 Resource presets. Loads the
 * project's dev build (the one with no deployment), merges the presets by their
 * deterministic ids, and writes back. Idempotent: safe to run on every
 * provision. Does nothing observable beyond the presets already present.
 *
 * A "when-present" preset is merged only into a build that already has its
 * binding or its resource, and then both records are written whole, as every
 * preset is (a designer's rename or added search parameter is reset). A build
 * with neither never gets it.
 */
export const seedProjectResourcePresets = async (
  context: AppContext,
  {
    projectId,
    apiBaseUrl,
    readToken,
  }: { projectId: string; apiBaseUrl: string; readToken: string }
): Promise<void> => {
  const client = context.postgrest.client;

  const build = await client
    .from("Build")
    .select("id, dataSources, resources")
    .eq("projectId", projectId)
    .is("deployment", null)
    .single();
  if (build.error) {
    throw build.error;
  }

  const existingDataSources = JSON.parse(
    build.data.dataSources ?? "[]"
  ) as DataSource[];
  const existingResources = JSON.parse(
    build.data.resources ?? "[]"
  ) as Resource[];

  const presets = await buildOrgResourcePresets({
    projectId,
    apiBaseUrl,
    readToken,
  });

  const absentIds = new Set<string>();
  for (const preset of V1_RESOURCE_PRESETS) {
    if (preset.seeding === "always") {
      continue;
    }
    const { resourceId, bindingId } = await getResourcePresetIds(
      projectId,
      preset.key
    );
    const isPresent =
      existingDataSources.some((dataSource) => dataSource.id === bindingId) ||
      existingResources.some((resource) => resource.id === resourceId);
    if (isPresent === false) {
      absentIds.add(bindingId);
      absentIds.add(resourceId);
    }
  }
  const seededDataSources = presets.dataSources.filter(
    (dataSource) => absentIds.has(dataSource.id) === false
  );
  const seededResources = presets.resources.filter(
    (resource) => absentIds.has(resource.id) === false
  );

  const update = await client
    .from("Build")
    .update({
      dataSources: JSON.stringify(
        mergeById(existingDataSources, seededDataSources)
      ),
      resources: JSON.stringify(mergeById(existingResources, seededResources)),
    })
    .eq("id", build.data.id);
  if (update.error) {
    throw update.error;
  }
};
