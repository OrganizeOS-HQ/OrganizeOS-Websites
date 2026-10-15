import {
  type DataSource,
  type Resource,
  encodeDataSourceVariable,
} from "@webstudio-is/sdk";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import {
  FORMS_PRESET_NAME,
  UPCOMING_EVENTS_PRESET_KEY,
  UPCOMING_EVENTS_RESOURCE_NAME,
  findCatalogResources,
  getCollectionPresetKey,
  getResourcePresetIds,
  parseCollectionUrl,
} from "../organizeos-preset-ids";

/**
 * OrganizeOS Websites 2.0 Phase 4d: seed a provisioned org's project with its
 * data catalog, GET Resources pointed at the OrganizeOS public read API (/v1).
 *
 * The catalog is Resources only. Webstudio loads a resource DataSource, in the
 * builder and on a published page, only when its scope is an instance on the
 * page or `:root`, and data loads only where it is used: a use brings its own
 * binding, scoped to the instance that uses it (a Signup Form's root, or a
 * page the OrganizeOS panel adds the Resource to), which references the
 * catalog Resource by id. Provisioning writes no binding. The unscoped
 * bindings it used to write never loaded; it removes each one nothing
 * references, and leaves the rest (removeUnusedPresetBindings).
 *
 * The per-org read token is inlined as a literal Authorization header
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
 * idempotent: re-provisioning updates the same Resource in place (e.g.
 * rotating the token value) instead of duplicating it. The derivation lives in
 * shared/organizeos-preset-ids.ts, because the builder's OrganizeOS panel
 * derives the same ids in the browser: it adds the Forms Resource when a block
 * first uses it, and a re-provision then rewrites that same Resource.
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
   * - "when-present": only a build that already has its Resource, which is
   *   rewritten whole. It is never added: the OrganizeOS panel creates it when
   *   a block first uses it.
   */
  seeding: "always" | "when-present";
};

/**
 * The /v1 read endpoints exposed as data-binding presets. These are the frozen
 * public GET DTOs from Phase 1 (see the OrganizeOS ledger repo). Write surfaces
 * (donate/signup form submission) are a separate mechanism and not seeded here.
 * Forms is the org's published forms, which the OrganizeOS Signup Form block
 * reads through its `data` prop; the panel creates it on the first insert.
 * Upcoming Events is Events without the events already over, which the Event
 * List and Event Card blocks read; the panel creates it on the first insert,
 * like Forms.
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
    key: "forms",
    label: FORMS_PRESET_NAME,
    path: "/forms",
    seeding: "when-present",
  },
  {
    key: UPCOMING_EVENTS_PRESET_KEY,
    label: UPCOMING_EVENTS_RESOURCE_NAME,
    path: "/events?upcoming=true",
    seeding: "when-present",
  },
];

export type OrgResourcePresets = {
  resources: Resource[];
};

/**
 * Build the catalog Resources for an org's project. Pure: returns the objects
 * to merge into a build, touches no I/O (async only because the id derivation
 * is). It builds every preset, whatever its seeding mode;
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

  for (const preset of V1_RESOURCE_PRESETS) {
    const { resourceId } = await getResourcePresetIds(projectId, preset.key);

    resources.push({
      id: resourceId,
      name: preset.label,
      method: "get",
      // Expressions: a plain URL literal is a quoted string.
      url: JSON.stringify(`${base}${preset.path}`),
      headers: [{ name: "Authorization", value: authHeaderExpression }],
    });
  }

  return { resources };
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
 * Build one catalog Resource per public collection, which the OrganizeOS panel
 * lists next to the static ones. Pure (async only because the id derivation
 * is). Ids derive from (projectId, slug), so a rename keeps them and only
 * updates the names.
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

  for (const collection of bySlug.values()) {
    const coveredByStaticPreset = V1_RESOURCE_PRESETS.some(
      (preset) => preset.key === collection.slug
    );
    if (collection.kind === "platform" && coveredByStaticPreset) {
      continue;
    }

    // `${projectId}:v1:collection:<slug>:resource`, as before the derivation
    // moved to organizeos-preset-ids.ts.
    const { resourceId } = await getResourcePresetIds(
      projectId,
      getCollectionPresetKey(collection.slug)
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
  }

  return { resources };
};

/**
 * Replace existing entries that share an incoming id where they stand, and
 * append the rest, keeping the order of what is already there, so a re-sync
 * does not reshuffle the build's resources.
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

/**
 * Remove the bindings older provisioning and collections-sync wrote next to
 * each catalog Resource (unscoped, so they never loaded; the branch before
 * this one scoped Forms' at `:root`), where nothing references them. One is
 * found by its deterministic id, never by name, and counts as referenced when
 * its id, raw or in its expression form (`$ws$dataSource$...`), appears
 * anywhere in the build's `searchable` text (instances, props, pages), its
 * resources or its other data sources: an admin may have bound it. Those are
 * kept as they are. Everything else is returned untouched and in order.
 */
export const removeUnusedPresetBindings = async ({
  projectId,
  dataSources,
  resources,
  searchable,
}: {
  projectId: string;
  dataSources: DataSource[];
  resources: Resource[];
  searchable: string[];
}): Promise<DataSource[]> => {
  const presetBindingIds = new Set<string>();
  for (const preset of V1_RESOURCE_PRESETS) {
    const { bindingId } = await getResourcePresetIds(projectId, preset.key);
    presetBindingIds.add(bindingId);
  }
  for (const entry of await findCatalogResources(projectId, resources)) {
    presetBindingIds.add(entry.bindingId);
  }

  const texts = [...searchable, JSON.stringify(resources)];
  const isReferenced = (dataSource: DataSource) => {
    const forms = [dataSource.id, encodeDataSourceVariable(dataSource.id)];
    const others = JSON.stringify(
      dataSources.filter((item) => item !== dataSource)
    );
    return [...texts, others].some((text) =>
      forms.some((form) => text.includes(form))
    );
  };

  return dataSources.filter(
    (dataSource) =>
      presetBindingIds.has(dataSource.id) === false || isReferenced(dataSource)
  );
};

const findAuthorizationValues = (resource: Resource) =>
  resource.headers
    .filter((header) => header.name.toLowerCase() === "authorization")
    .map((header) => header.value);

/** The org's dev build, as provisioning reads and writes it. */
export type DevBuild = {
  id: string;
  version: number;
  instances: string;
  props: string;
  dataSources: string;
  resources: string;
  pages: string;
};

type DevBuildContent = Partial<
  Pick<DevBuild, "instances" | "props" | "dataSources" | "resources" | "pages">
>;

// A builder save landing between the read and the write costs one retry. The
// cap keeps the provisioning request short; OrganizeOS retries its failure.
const MAX_ATTEMPTS = 3;

/**
 * Rewrite the org's dev build (the one with no deployment) with what `change`
 * returns for it, as a compare-and-swap on the version it read that also bumps
 * the version. A builder tab open on the project then gets
 * `version_mismatched` on its next save and reloads, so it never acts on, or
 * copies from, records provisioning has replaced (a rotated token). A builder
 * save that lands between the read and the write costs a re-read and another
 * try, three attempts in all; then it throws. A change that writes the same
 * text writes nothing and bumps nothing.
 *
 * collections-sync makes the same compare-and-swap without the bump: it runs
 * often, and a bump makes every open builder reload.
 */
export const updateDevBuildWithVersionBump = async (
  context: AppContext,
  projectId: string,
  change: (build: DevBuild) => Promise<DevBuildContent>
): Promise<void> => {
  const client = context.postgrest.client;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const build = await client
      .from("Build")
      .select("id, version, instances, props, dataSources, resources, pages")
      .eq("projectId", projectId)
      .is("deployment", null)
      .single();
    if (build.error) {
      throw build.error;
    }
    const row: DevBuild = {
      id: build.data.id,
      version: build.data.version,
      instances: build.data.instances ?? "[]",
      props: build.data.props ?? "[]",
      dataSources: build.data.dataSources ?? "[]",
      resources: build.data.resources ?? "[]",
      pages: build.data.pages,
    };

    const content = await change(row);
    const changed = Object.entries(content).some(
      ([column, value]) => row[column as keyof DevBuildContent] !== value
    );
    if (changed === false) {
      return;
    }

    const update = await client
      .from("Build")
      // lastTransactionId is cleared with the bump: a builder save whose
      // transaction id matched it would otherwise read the new version as its
      // own already-applied retry (build-patch-core) and skip the reload.
      .update(
        { ...content, version: row.version + 1, lastTransactionId: null },
        { count: "exact" }
      )
      .match({ id: row.id, version: row.version });
    if (update.error) {
      throw update.error;
    }
    if (update.count == null) {
      throw new Error("Update count is null");
    }
    if (update.count > 0) {
      return;
    }
  }
  throw new Error(
    `The build of project ${projectId} kept changing; provisioning gave up`
  );
};

/** Whether a url expression is a string literal under `base` (a path below it). */
const isLiteralUrlUnder = (url: string, base: string) => {
  try {
    const value: unknown = JSON.parse(url);
    return typeof value === "string" && value.startsWith(`${base}/`);
  } catch {
    return false;
  }
};

/** Whether a header expression is a literal `Bearer <token>`. */
const isBearerLiteral = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "string" && parsed.startsWith("Bearer ");
  } catch {
    return false;
  }
};

/**
 * Seed (or re-sync) the org's dev build with its catalog Resources. Merges
 * them by their deterministic ids, in place and in order (upsertById), and
 * writes back with updateDevBuildWithVersionBump. Idempotent: safe to run on
 * every provision; an unchanged catalog writes nothing.
 *
 * - Events, Fundraisers and Stats are written whole on every provision (a
 *   designer's rename or added search parameter is reset).
 * - Forms and Upcoming Events ("when-present") are rewritten whole when the
 *   build has their Resource, and never created. Their tokens rotate like the
 *   others', since a url under the API base takes the new token.
 * - Each collection Resource the build has (collections-sync seeds them) gets
 *   the new Authorization header and API base, keeping its name and position,
 *   so a rotated token reaches it before the old one is revoked.
 * - Any other Resource whose Authorization header is a catalog Resource's
 *   previous one gets the new one: Webstudio gives a copied or duplicated
 *   block, or page, its own copy of the Resource its binding references. So
 *   does any Resource whose url is a literal on this org's API base with a
 *   literal Bearer header: a block pasted from another org's project brings
 *   that org's token, and this replaces it with this org's.
 * - The unscoped bindings older provisioning wrote are removed where nothing
 *   references them (removeUnusedPresetBindings). No binding is written: a
 *   use brings its own, and a re-provision never touches it.
 */
export const seedProjectResourcePresets = async (
  context: AppContext,
  {
    projectId,
    apiBaseUrl,
    readToken,
  }: { projectId: string; apiBaseUrl: string; readToken: string }
): Promise<void> => {
  const presets = await buildOrgResourcePresets({
    projectId,
    apiBaseUrl,
    readToken,
  });
  const apiBase = apiBaseUrl.replace(/\/+$/, "");
  const authHeaderExpression = JSON.stringify(`Bearer ${readToken}`);

  await updateDevBuildWithVersionBump(context, projectId, async (build) => {
    const existingDataSources = JSON.parse(build.dataSources) as DataSource[];
    const existingResources = JSON.parse(build.resources) as Resource[];
    const existingIds = new Set(existingResources.map(({ id }) => id));
    const catalog = await findCatalogResources(projectId, existingResources);

    const seeded: Resource[] = [];
    for (const preset of V1_RESOURCE_PRESETS) {
      const { resourceId } = await getResourcePresetIds(projectId, preset.key);
      const resource = presets.resources.find(({ id }) => id === resourceId);
      if (
        resource !== undefined &&
        (preset.seeding === "always" || existingIds.has(resourceId))
      ) {
        seeded.push(resource);
      }
    }

    const collections = await buildCollectionResourcePresets({
      projectId,
      apiBase,
      authHeaderExpression,
      collections: catalog.flatMap(({ resource }) => {
        const collection = parseCollectionUrl(resource.url);
        return collection === undefined
          ? []
          : [{ slug: collection.slug, name: resource.name }];
      }),
    });

    const previousAuth = new Set(
      catalog.flatMap(({ resource }) => findAuthorizationValues(resource))
    );
    previousAuth.delete(authHeaderExpression);
    const resources = upsertById(existingResources, [
      ...seeded,
      ...collections.resources,
    ]).map((resource) => {
      // A Resource on the OrganizeOS API with another read token: a copy made
      // before this rotation, or a block pasted from another org's project,
      // which brings that org's token with it.
      const onOrgApi = isLiteralUrlUnder(resource.url, apiBase);
      const replaces = (value: string) =>
        value !== authHeaderExpression &&
        (previousAuth.has(value) || (onOrgApi && isBearerLiteral(value)));
      return findAuthorizationValues(resource).some(replaces)
        ? {
            ...resource,
            headers: resource.headers.map((header) =>
              header.name.toLowerCase() === "authorization" &&
              replaces(header.value)
                ? { ...header, value: authHeaderExpression }
                : header
            ),
          }
        : resource;
    });

    const dataSources = await removeUnusedPresetBindings({
      projectId,
      dataSources: existingDataSources,
      resources,
      searchable: [build.instances, build.props, build.pages],
    });

    return {
      dataSources: JSON.stringify(dataSources),
      resources: JSON.stringify(resources),
    };
  });
};
