/**
 * Add on use (OrganizeOS design
 * docs/superpowers/specs/2026-11-13-native-cms-slice-3-design.md, 4.7 and
 * 7.4): a collection action on a public collection whose catalog Resource the
 * build lacks first adds that Resource, exactly as collections-sync writes it
 * (`shared/organizeos-collection-resource.ts`), as its own staged
 * transaction immediately before the action. It adds only a missing
 * Resource, never changes or deletes one, and never adds a `:root` binding.
 */
import { toast } from "@webstudio-is/design-system";
import {
  buildCollectionResource,
  type V1PresetSeed,
} from "~/shared/organizeos-collection-resource";
import { executeStagedRuntimeMutation } from "~/shared/instance-utils/data";
import { stageWebstudioDataMutable } from "../../organizeos-panel/staged-data";
import type { CmsCollectionSummary } from "./cms-source";

/** True once the build holds the Resource; false after a refusal's toast. */
export const addCollectionCatalogResource = async ({
  projectId,
  seed,
  collection,
}: {
  projectId: string;
  seed: V1PresetSeed;
  collection: CmsCollectionSummary;
}): Promise<boolean> => {
  try {
    // an E1 row carries no kind: the sync builds a CMS collection the same way
    const resource = await buildCollectionResource({
      projectId,
      seed,
      collection: { slug: collection.slug, name: collection.name },
    });
    if (resource === undefined) {
      return false;
    }
    await executeStagedRuntimeMutation((accumulator) =>
      stageWebstudioDataMutable(accumulator, (data) => {
        if (data.resources.has(resource.id) === false) {
          data.resources.set(resource.id, resource);
        }
      })
    );
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
    return false;
  }
};
