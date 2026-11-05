import type {
  Instance,
  Instances,
  WebstudioData,
  WebstudioFragment,
} from "@webstudio-is/sdk";
import {
  type ConflictResolution,
  BuilderRuntimeError,
  createRuntimeMutation,
  produceWebstudioDataMutation,
} from "@webstudio-is/project-build/runtime";
import {
  type RuntimeMutationAccumulator,
  executeStagedRuntimeMutation,
} from "~/shared/instance-utils/data";
import {
  type Insertable,
  findClosestInsertable,
} from "~/shared/instance-utils/insert";
import { selectInstance } from "~/shared/nano-states";
import { builderApi } from "~/shared/builder-api";

/**
 * The OrganizeOS panels' writes on 0.309.0's runtime layer (fork doc section
 * 9). Each write goes through executeStagedRuntimeMutation, so it is one
 * transaction and one undo step, and it is refused, writing nothing, where the
 * runtime layer refuses a commit (a page template without build access).
 *
 * Every caller derives its asynchronous ids (the catalog's v5 ids, hashes,
 * fetches) before the call, keeps the recipe synchronous, and catches the
 * rejection.
 */

/**
 * A write of the panels' own, staged on the accumulator's state. The recipe
 * returns primitives only: its draft is revoked after it.
 */
export const stageWebstudioDataMutable = <T>(
  accumulator: RuntimeMutationAccumulator,
  recipe: (data: WebstudioData) => T
): T => {
  let result!: T;
  const { payload } = produceWebstudioDataMutation(
    accumulator.state as WebstudioData,
    (draft) => {
      result = recipe(draft);
    }
  );
  accumulator.stage(
    createRuntimeMutation({
      payload,
      result: {},
      invalidatesNamespaces: Array.from(
        new Set(payload.map(({ namespace }) => namespace))
      ),
    })
  );
  return result;
};

/**
 * updateWebstudioData's replacement: one transaction, one undo step, nothing
 * committed when the recipe changes nothing. Rejects without build access.
 */
export const updateWebstudioDataStaged = <T>(
  recipe: (data: WebstudioData) => T
): Promise<T> =>
  executeStagedRuntimeMutation((accumulator) =>
    stageWebstudioDataMutable(accumulator, recipe)
  );

/**
 * The ids instances.insertFragment gave a fragment's instances, found by
 * walking the fragment's tree and the inserted one in step (the insert returns
 * only the roots' ids, and keeps each instance's children in order). A
 * component that differs stops the walk below it.
 */
export const mapInsertedInstanceIds = (
  fragment: Pick<WebstudioFragment, "children" | "instances">,
  instances: Instances,
  rootInstanceIds: readonly Instance["id"][]
) => {
  const templates = new Map(
    fragment.instances.map((instance) => [instance.id, instance])
  );
  const ids = new Map<Instance["id"], Instance["id"]>();
  const visit = (templateId: Instance["id"], insertedId: Instance["id"]) => {
    const template = templates.get(templateId);
    const inserted = instances.get(insertedId);
    if (
      template === undefined ||
      inserted === undefined ||
      template.component !== inserted.component ||
      ids.has(templateId)
    ) {
      return;
    }
    ids.set(templateId, insertedId);
    template.children.forEach((child, index) => {
      const insertedChild = inserted.children[index];
      if (child.type === "id" && insertedChild?.type === "id") {
        visit(child.value, insertedChild.value);
      }
    });
  };
  fragment.children
    .filter((child) => child.type === "id")
    .forEach((child, index) => {
      const rootId = rootInstanceIds[index];
      if (rootId !== undefined) {
        visit(child.value, rootId);
      }
    });
  return ids;
};

/**
 * Insert a fragment at the selection, or at `insertable` (a drop), and
 * complete it, as one commit: `complete` writes into the staged state, given
 * the fragment's ids mapped to the inserted ones and the inserted root's id.
 * Selects the inserted root. A fragment with no place to go is refused with
 * upstream's own toast; any other refusal (the content model, no build
 * access) toasts its message once. Either way nothing is written.
 */
export const insertCompletedFragment = async ({
  fragment,
  insertable,
  conflictResolution,
  complete,
}: {
  fragment: WebstudioFragment;
  insertable?: Insertable;
  conflictResolution?: ConflictResolution;
  complete: (
    data: WebstudioData,
    newInstanceIds: Map<Instance["id"], Instance["id"]>,
    rootId: Instance["id"]
  ) => void;
}): Promise<boolean> => {
  // toasts "… has no place here" itself
  const target = findClosestInsertable(fragment, insertable);
  const parentInstanceId = target?.parentSelector[0];
  if (target === undefined || parentInstanceId === undefined) {
    return false;
  }
  let staged = false;
  try {
    const inserted = await executeStagedRuntimeMutation((accumulator) => {
      const result = accumulator.execute({
        id: "instances.insertFragment",
        input: {
          parentInstanceId,
          fragment,
          conflictResolution,
          insertIndex:
            typeof target.position === "number" ? target.position : undefined,
        },
        // The runtime checks the content model against the static registry,
        // which has no OrganizeOS metas: allow what the fragment has on its
        // own (Rich Text's descendants), and still check where it goes
        // (ruling data OQ1).
        context: { allowLegacyContentModelWarnings: true },
      });
      const [rootId] = result.rootInstanceIds;
      if (rootId === undefined) {
        throw Error("Nothing was inserted.");
      }
      const ids = mapInsertedInstanceIds(
        fragment,
        accumulator.state.instances ?? new Map(),
        result.rootInstanceIds
      );
      stageWebstudioDataMutable(accumulator, (data) =>
        complete(data, ids, rootId)
      );
      staged = true;
      return {
        rootId,
        parentInstanceId: result.parentInstanceId,
        didMergeBreakpoints: result.didMergeBreakpointsDueToLimit === true,
      };
    });
    selectInstance([
      inserted.rootId,
      ...(inserted.parentInstanceId === undefined ||
      inserted.parentInstanceId === parentInstanceId
        ? target.parentSelector
        : [inserted.parentInstanceId, ...target.parentSelector]),
    ]);
    if (inserted.didMergeBreakpoints) {
      builderApi.toast.info(
        "Some breakpoints were merged because the project reached the breakpoint limit."
      );
    }
    return true;
  } catch (error) {
    // The commit toasts its own refusal (a block inside MDX content) before
    // it throws it, so that one is not toasted again (ruling data OQ7).
    if (staged && error instanceof BuilderRuntimeError) {
      return false;
    }
    console.error(error);
    builderApi.toast.error(
      error instanceof Error ? error.message : "Cannot insert."
    );
    return false;
  }
};

/**
 * registerFolderChildMutable's replacement for a fresh page id: the page joins
 * the end of the folder, or of the root folder when the folder is unknown.
 */
export const addToFolderMutable = (
  pages: Pick<WebstudioData["pages"], "folders" | "rootFolderId">,
  id: string,
  folderId = pages.rootFolderId
) => {
  (
    pages.folders.get(folderId) ?? pages.folders.get(pages.rootFolderId)
  )?.children.push(id);
};
