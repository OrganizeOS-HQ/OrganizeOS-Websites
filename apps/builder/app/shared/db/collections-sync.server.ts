import type { DataSource, Resource } from "@webstudio-is/sdk";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import { deriveProjectId } from "./provision.server";
import { catalogRootBindingsWanted } from "./organizeos-site.server";
import {
  buildCollectionResourcePresets,
  createBindingReferenceTest,
  matchBuildRead,
  planCatalogRootBindings,
  readV1PresetSeed,
  removeUnusedPresetBindings,
  upsertById,
  type CollectionPresetInput,
} from "./resource-presets.server";

/**
 * OrganizeOS collections -> the builder's data catalog.
 *
 * OrganizeOS calls this with a full snapshot of an org's PUBLIC collections
 * whenever they change; each one becomes a catalog Resource in the org's dev
 * build (see buildCollectionResourcePresets). Where the org is wanted
 * (`catalogRootBindings`, catalogRootBindingsWanted), the same write gives each
 * catalog Resource its `:root` binding (planCatalogRootBindings), so a new
 * collection is bindable from every element; otherwise the unreferenced ones
 * are removed. The unscoped bindings an older sync wrote are removed where
 * nothing references them. Idempotent: same snapshot, no write.
 *
 * Collections missing from the snapshot are not removed yet.
 */

export type CollectionsSyncResult =
  | { status: "ok"; collections: number }
  // No project for the org, or it was offboarded (soft-deleted).
  | { status: "no-project" }
  // The build has no static /v1 preset to copy the API base and token from.
  | { status: "no-presets" }
  // The builder kept saving between our read and our write.
  | { status: "conflict" };

// A builder save landing between the read and the write costs one retry. The
// cap keeps the request short; OrganizeOS retries the 503 it becomes.
const MAX_ATTEMPTS = 3;

export const syncOrgCollectionPresets = async (
  context: AppContext,
  {
    organizationId,
    collections,
    catalogRootBindings,
  }: {
    organizationId: string;
    collections: CollectionPresetInput[];
    /**
     * The raw `ORGANIZEOS_CATALOG_ROOT_BINDINGS` and
     * `ORGANIZEOS_BLOCKS_DENY_ORG_IDS`.
     */
    catalogRootBindings?: { switchValue?: string; denyList?: string };
  }
): Promise<CollectionsSyncResult> => {
  const client = context.postgrest.client;
  const projectId = deriveProjectId(organizationId);
  const wanted = catalogRootBindingsWanted({
    organizationId,
    switchValue: catalogRootBindings?.switchValue,
    denyList: catalogRootBindings?.denyList,
  });

  const project = await client
    .from("Project")
    .select("id, isDeleted")
    .eq("id", projectId)
    .maybeSingle();
  if (project.error) {
    throw project.error;
  }
  if (project.data === null || project.data.isDeleted) {
    return { status: "no-project" };
  }

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

    const storedDataSources = build.data.dataSources ?? "[]";
    const storedResources = build.data.resources ?? "[]";
    const existingDataSources = JSON.parse(storedDataSources) as DataSource[];
    const existingResources = JSON.parse(storedResources) as Resource[];

    // The request carries no token: reuse the base and Authorization header of
    // a static preset the provision already seeded into this build.
    const seed = await readV1PresetSeed({
      projectId,
      resources: existingResources,
    });
    if (seed === undefined) {
      return { status: "no-presets" };
    }

    const presets = await buildCollectionResourcePresets({
      projectId,
      apiBase: seed.apiBase,
      authHeaderExpression: seed.authHeaderExpression,
      collections,
    });
    const synced = {
      status: "ok" as const,
      collections: presets.resources.length,
    };

    const upserted = upsertById(existingResources, presets.resources);
    const searchable = [
      build.data.instances ?? "[]",
      build.data.props ?? "[]",
      build.data.pages ?? "",
    ];
    const kept = await removeUnusedPresetBindings({
      projectId,
      dataSources: existingDataSources,
      resources: upserted,
      searchable,
    });
    const dataSources = JSON.stringify(
      await planCatalogRootBindings({
        projectId,
        dataSources: kept,
        resources: upserted,
        wanted,
        isReferenced: createBindingReferenceTest({
          dataSources: kept,
          resources: upserted,
          searchable,
        }),
      })
    );
    const resources = JSON.stringify(upserted);
    if (dataSources === storedDataSources && resources === storedResources) {
      return synced;
    }

    // Compare-and-swap on the version and updatedAt we read (matchBuildRead).
    // A plain update could overwrite a save that landed since the read, and a
    // version bump would make every open builder session reload, so neither.
    // The entry re-sync also keeps the version; each sets updatedAt, so each
    // fails the other's match instead of overwriting its change.
    const update = await matchBuildRead(
      client
        .from("Build")
        .update(
          { dataSources, resources, updatedAt: new Date().toISOString() },
          { count: "exact" }
        ),
      {
        id: build.data.id,
        version: build.data.version,
        updatedAt: build.data.updatedAt ?? null,
      }
    );
    if (update.error) {
      throw update.error;
    }
    if (update.count == null) {
      throw new Error("Update count is null");
    }
    if (update.count > 0) {
      return synced;
    }
  }

  return { status: "conflict" };
};
