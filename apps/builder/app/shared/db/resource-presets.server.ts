import {
  type DataSource,
  type Resource,
  encodeDataSourceVariable,
} from "@webstudio-is/sdk";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import {
  FORMS_PRESET_KEY,
  UPCOMING_EVENTS_PRESET_KEY,
  findCatalogResources,
  getCatalogRootBindingId,
  getResourcePresetIds,
  parseCollectionUrl,
} from "../organizeos-preset-ids";
import {
  buildCollectionResource,
  COLLECTION_SLUG_RE,
  readV1PresetSeed,
  V1_RESOURCE_PRESETS,
  type CollectionPresetInput,
  type V1PresetSeed,
} from "../organizeos-collection-resource";

// The catalog's pure builders live in shared/organizeos-collection-resource.ts,
// which the builder imports in the browser; this file's importers keep these
// names.
export {
  buildCollectionResource,
  COLLECTION_SLUG_RE,
  readV1PresetSeed,
  V1_RESOURCE_PRESETS,
  type CollectionPresetInput,
  type V1PresetSeed,
};

/**
 * OrganizeOS Websites 2.0 Phase 4d: seed a provisioned org's project with its
 * data catalog, GET Resources pointed at the OrganizeOS public read API (/v1).
 *
 * Data loads only where it is used: 0.309.0 loads a Resource, in the builder
 * and on a published page, only where a page's expressions read it. A block
 * brings its own binding, scoped to its root, which references the catalog
 * Resource by id. Where the org is wanted (`catalogRootBindingsWanted`:
 * `ORGANIZEOS_CATALOG_ROOT_BINDINGS` on, the org not denied), each catalog
 * Resource also gets one binding at `:root`, named like it, so every element
 * can bind it (planCatalogRootBindings). The unscoped bindings older
 * provisioning wrote never loaded; it removes each one nothing references,
 * and leaves the rest (removeUnusedPresetBindings).
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
 * shared/organizeos-preset-ids.ts, because the builder derives the same ids
 * in the browser: a block's insert adds the Forms Resource when a block first
 * uses it, and a re-provision then rewrites that same Resource.
 */

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
 * Build one catalog Resource per public collection, which the builder lists
 * next to the static ones. Pure (async only because the id derivation
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
  const bySlug = new Map(
    collections.map((collection) => [collection.slug, collection])
  );

  const resources: Resource[] = [];

  for (const collection of bySlug.values()) {
    const resource = await buildCollectionResource({
      projectId,
      seed: { apiBase, authHeaderExpression },
      collection,
    });
    if (resource !== undefined) {
      resources.push(resource);
    }
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
 * Whether a binding is referenced: its id, raw or in its expression form
 * (`$ws$dataSource$...`), appears in the build's `searchable` text
 * (instances, props, pages), its resources or its other data sources.
 */
export const createBindingReferenceTest = ({
  dataSources,
  resources,
  searchable,
}: {
  dataSources: DataSource[];
  resources: Resource[];
  searchable: string[];
}) => {
  const texts = [...searchable, JSON.stringify(resources)];
  return (dataSource: DataSource) => {
    const forms = [dataSource.id, encodeDataSourceVariable(dataSource.id)];
    const others = JSON.stringify(
      dataSources.filter((item) => item !== dataSource)
    );
    return [...texts, others].some((text) =>
      forms.some((form) => text.includes(form))
    );
  };
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

  const isReferenced = createBindingReferenceTest({
    dataSources,
    resources,
    searchable,
  });

  return dataSources.filter(
    (dataSource) =>
      presetBindingIds.has(dataSource.id) === false || isReferenced(dataSource)
  );
};

/**
 * Forms and Upcoming Events where the build lacks them, built from the API
 * base and Authorization of a static preset already in it (readV1PresetSeed),
 * in exactly provisioning's shape: what buildOrgResourcePresets builds for the
 * same base and token. None without a usable seed. The membership re-sync
 * writes them for a wanted org, which carries no token.
 */
export const buildMissingCatalogResources = async (
  projectId: string,
  resources: Resource[]
): Promise<Resource[]> => {
  const seed = await readV1PresetSeed({ projectId, resources });
  if (seed === undefined) {
    return [];
  }
  const base = seed.apiBase.replace(/\/+$/, "");
  const existingIds = new Set(resources.map(({ id }) => id));
  const missing: Resource[] = [];
  for (const key of [FORMS_PRESET_KEY, UPCOMING_EVENTS_PRESET_KEY]) {
    const preset = V1_RESOURCE_PRESETS.find((item) => item.key === key);
    if (preset === undefined) {
      continue;
    }
    const { resourceId } = await getResourcePresetIds(projectId, preset.key);
    if (existingIds.has(resourceId)) {
      continue;
    }
    missing.push({
      id: resourceId,
      name: preset.label,
      method: "get",
      url: JSON.stringify(`${base}${preset.path}`),
      headers: [{ name: "Authorization", value: seed.authHeaderExpression }],
    });
  }
  return missing;
};

const isSameRootBinding = (stored: DataSource, planned: DataSource) =>
  stored.type === "resource" &&
  planned.type === "resource" &&
  stored.id === planned.id &&
  stored.scopeInstanceId === planned.scopeInstanceId &&
  stored.name === planned.name &&
  stored.resourceId === planned.resourceId;

/**
 * The build's data sources with its catalog `:root` bindings planned. Pure
 * apart from the async id derivation.
 *
 * Wanted: one resource binding at `:root` per catalog Resource
 * (findCatalogResources, so Products only where the build has it), with the
 * id getCatalogRootBindingId derives and its Resource's name, or `<name> 2`,
 * `<name> 3` and so on when another `:root` data source (anything but these
 * bindings) or an earlier one in catalog order has it. A stored binding with
 * the id keeps its position and is restored when it differs (type, scope,
 * name or Resource changed outside the builder); a missing one is appended
 * after the existing data sources, in catalog order. Every other data source
 * comes back as it is.
 *
 * Not wanted: nothing is added, and each of these bindings that
 * `isReferenced` says nothing references is removed. Without `isReferenced`
 * nothing is removed. A build that holds none comes back as the same array.
 */
export const planCatalogRootBindings = async ({
  projectId,
  dataSources,
  resources,
  wanted,
  isReferenced,
}: {
  projectId: string;
  dataSources: DataSource[];
  resources: Resource[];
  wanted: boolean;
  isReferenced?: (dataSource: DataSource) => boolean;
}): Promise<DataSource[]> => {
  const catalog = await findCatalogResources(projectId, resources);
  const ids = await Promise.all(
    catalog.map(({ key }) => getCatalogRootBindingId(projectId, key))
  );
  const rootBindingIds = new Set(ids);

  if (wanted === false) {
    if (isReferenced === undefined) {
      return dataSources;
    }
    const kept = dataSources.filter(
      (dataSource) =>
        rootBindingIds.has(dataSource.id) === false || isReferenced(dataSource)
    );
    return kept.length === dataSources.length ? dataSources : kept;
  }

  if (catalog.length === 0) {
    return dataSources;
  }
  const takenNames = new Set<string>();
  for (const dataSource of dataSources) {
    if (
      dataSource.scopeInstanceId === ":root" &&
      rootBindingIds.has(dataSource.id) === false
    ) {
      takenNames.add(dataSource.name);
    }
  }
  const planned = new Map<string, DataSource>();
  catalog.forEach(({ resource }, index) => {
    let name = resource.name;
    for (let suffix = 2; takenNames.has(name); suffix += 1) {
      name = `${resource.name} ${suffix}`;
    }
    takenNames.add(name);
    planned.set(ids[index], {
      type: "resource",
      id: ids[index],
      scopeInstanceId: ":root",
      name,
      resourceId: resource.id,
    });
  });

  let changed = false;
  const placed = new Set<string>();
  const next = dataSources.map((dataSource) => {
    const binding = planned.get(dataSource.id);
    if (binding === undefined) {
      return dataSource;
    }
    placed.add(dataSource.id);
    if (isSameRootBinding(dataSource, binding)) {
      return dataSource;
    }
    changed = true;
    return binding;
  });
  for (const [id, binding] of planned) {
    if (placed.has(id) === false) {
      changed = true;
      next.push(binding);
    }
  }
  return changed ? next : dataSources;
};

const findAuthorizationValues = (resource: Resource) =>
  resource.headers
    .filter((header) => header.name.toLowerCase() === "authorization")
    .map((header) => header.value);

/** The org's dev build, as provisioning reads and writes it. */
export type DevBuild = {
  id: string;
  version: number;
  /** The compare-and-set's second key, beside the version. */
  updatedAt: string | null;
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
 * The compare-and-set every catalog writer matches its update on: the build's
 * id, version and updatedAt as it read them. A builder save bumps the version;
 * the writers that keep the version (the entry re-sync, collections-sync) set
 * updatedAt, so each also fails the other's match, and a bumping write's.
 * A null updatedAt is matched with `is null`.
 */
export const matchBuildRead = <
  Query extends {
    match: (query: Record<string, unknown>) => Query;
    filter: (column: string, operator: string, value: unknown) => Query;
  },
>(
  query: Query,
  row: { id: string; version: number; updatedAt: string | null }
): Query => {
  const read = { id: row.id, version: row.version };
  return row.updatedAt === null
    ? query.match(read).filter("updatedAt", "is", null)
    : query.match({ ...read, updatedAt: row.updatedAt });
};

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
 * It matches on updatedAt too and sets it (matchBuildRead), so a write of
 * collections-sync or the entry re-sync, which keep the version, landing
 * between the read and the write is not overwritten either.
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
      .select(
        "id, version, updatedAt, instances, props, dataSources, resources, pages"
      )
      .eq("projectId", projectId)
      .is("deployment", null)
      .single();
    if (build.error) {
      throw build.error;
    }
    const row: DevBuild = {
      id: build.data.id,
      version: build.data.version,
      updatedAt: build.data.updatedAt ?? null,
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

    const update = await matchBuildRead(
      client
        .from("Build")
        // lastTransactionId is cleared with the bump: a builder save whose
        // transaction id matched it would otherwise read the new version as
        // its own already-applied retry (build-patch-core) and skip the
        // reload.
        .update(
          {
            ...content,
            version: row.version + 1,
            lastTransactionId: null,
            updatedAt: new Date().toISOString(),
          },
          { count: "exact" }
        ),
      row
    );
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
 * - Products ("shop-blocks") is written as Events is while `shopBlocks` is
 *   true (the builder offers the Shop blocks), and as Forms is otherwise.
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
 *   references them (removeUnusedPresetBindings).
 * - The catalog's `:root` bindings are planned in the same write
 *   (planCatalogRootBindings): one per catalog Resource when `wanted`, and
 *   otherwise the ones nothing references are removed. No other binding is
 *   written: a block brings its own, and a re-provision never touches it.
 */
export const seedProjectResourcePresets = async (
  context: AppContext,
  {
    projectId,
    apiBaseUrl,
    readToken,
    shopBlocks = false,
    wanted = false,
  }: {
    projectId: string;
    apiBaseUrl: string;
    readToken: string;
    /** `ORGANIZEOS_SHOP_BLOCKS` is exactly `true` (isShopBlocksSwitchOn). */
    shopBlocks?: boolean;
    /** catalogRootBindingsWanted for the org. */
    wanted?: boolean;
  }
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
        (preset.seeding === "always" ||
          (preset.seeding === "shop-blocks" && shopBlocks) ||
          existingIds.has(resourceId))
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

    const searchable = [build.instances, build.props, build.pages];
    const kept = await removeUnusedPresetBindings({
      projectId,
      dataSources: existingDataSources,
      resources,
      searchable,
    });
    const dataSources = await planCatalogRootBindings({
      projectId,
      dataSources: kept,
      resources,
      wanted,
      isReferenced: createBindingReferenceTest({
        dataSources: kept,
        resources,
        searchable,
      }),
    });

    return {
      dataSources: JSON.stringify(dataSources),
      resources: JSON.stringify(resources),
    };
  });
};

/**
 * The membership re-sync's catalog writer (a provision with no `siteData`,
 * which runs before every builder entry). Best effort: the caller logs a
 * failure and the provision still succeeds.
 *
 * Wanted: reads the dev build's id, version, updatedAt, data sources and
 * resources, adds Forms and Upcoming Events where missing
 * (buildMissingCatalogResources) and plans the `:root` bindings.
 *
 * Not wanted: with no catalog `:root` binding in the build it stops after that
 * one read and writes nothing. Only with one does it read the instances,
 * props and pages, and remove the ones nothing references.
 *
 * It writes only a change, matched on the id, version and updatedAt it read
 * (matchBuildRead), setting updatedAt and leaving the version and
 * lastTransactionId alone: no token changes, so an open tab need not reload.
 * Three attempts; then it throws.
 */
export const syncCatalogRootBindings = async (
  context: AppContext,
  { projectId, wanted }: { projectId: string; wanted: boolean }
): Promise<void> => {
  const client = context.postgrest.client;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const build = await client
      .from("Build")
      .select("id, version, updatedAt, dataSources, resources")
      .eq("projectId", projectId)
      .is("deployment", null)
      .maybeSingle();
    if (build.error) {
      throw build.error;
    }
    if (build.data === null) {
      return;
    }
    const row = {
      id: build.data.id,
      version: build.data.version,
      updatedAt: build.data.updatedAt ?? null,
    };
    const storedDataSources = build.data.dataSources ?? "[]";
    const storedResources = build.data.resources ?? "[]";
    const dataSources = JSON.parse(storedDataSources) as DataSource[];
    const existingResources = JSON.parse(storedResources) as Resource[];

    let resources = existingResources;
    let isReferenced: undefined | ((dataSource: DataSource) => boolean);
    if (wanted) {
      resources = [
        ...existingResources,
        ...(await buildMissingCatalogResources(projectId, existingResources)),
      ];
    } else {
      const catalog = await findCatalogResources(projectId, resources);
      const rootBindingIds = new Set(
        await Promise.all(
          catalog.map(({ key }) => getCatalogRootBindingId(projectId, key))
        )
      );
      if (dataSources.some(({ id }) => rootBindingIds.has(id)) === false) {
        return;
      }
      const texts = await client
        .from("Build")
        .select("instances, props, pages")
        .eq("projectId", projectId)
        .is("deployment", null)
        .single();
      if (texts.error) {
        throw texts.error;
      }
      isReferenced = createBindingReferenceTest({
        dataSources,
        resources,
        searchable: [
          texts.data.instances ?? "[]",
          texts.data.props ?? "[]",
          texts.data.pages ?? "",
        ],
      });
    }
    const planned = await planCatalogRootBindings({
      projectId,
      dataSources,
      resources,
      wanted,
      isReferenced,
    });

    const content: { dataSources?: string; resources?: string } = {};
    if (planned !== dataSources) {
      content.dataSources = JSON.stringify(planned);
    }
    if (resources !== existingResources) {
      content.resources = JSON.stringify(resources);
    }
    if (
      (content.dataSources ?? storedDataSources) === storedDataSources &&
      (content.resources ?? storedResources) === storedResources
    ) {
      return;
    }

    const update = await matchBuildRead(
      client
        .from("Build")
        .update(
          { ...content, updatedAt: new Date().toISOString() },
          { count: "exact" }
        ),
      row
    );
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
    `The build of project ${projectId} kept changing; the catalog re-sync gave up`
  );
};
