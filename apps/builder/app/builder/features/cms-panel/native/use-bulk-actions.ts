/**
 * The bulk bar's calls (spec 5.1.6, 10): E10, E11 and E12 on the selected
 * rows of the page shown. Every answer refetches the lists; a 200 clears the
 * selection; a failure toasts its word, and a refusal shows the screen's line.
 */
import { useRef, useState } from "react";
import { toast } from "@webstudio-is/design-system";
import { getRefusal, type CmsRefusal } from "./cms-logic";
import {
  getListFailureText,
  type CmsListAction,
  type CmsListState,
} from "./cms-list-logic";
import {
  isCmsFailure,
  type CmsCollectionSummary,
  type CmsFailure,
  type CmsItemsPage,
  type CmsResult,
  type CmsSource,
} from "./cms-source";

export const useBulkActions = (input: {
  source: CmsSource;
  collection: CmsCollectionSummary;
  page: CmsItemsPage | undefined;
  list: CmsListState;
  onListChange: (next: CmsListState) => void;
  onListWritten: () => void;
  onRefusal: (refusal: CmsRefusal) => void;
}): {
  busy: boolean;
  publish: () => Promise<void>;
  setStatus: (status: "draft" | "archived") => Promise<void>;
  remove: () => Promise<void>;
} => {
  // the latest props: an answer reads the list and callbacks as they are then
  const latest = useRef(input);
  latest.current = input;
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  /** The selected rows of the page shown, in the page's order. */
  const selectedRows = () => {
    const { page, list } = latest.current;
    return (page?.items ?? []).filter((row) => list.selected.has(row.id));
  };

  const run = async <Value>(
    action: CmsListAction,
    call: (collectionId: string) => Promise<CmsResult<Value>>,
    onSuccess?: (value: Value) => void
  ) => {
    if (inFlight.current) {
      return;
    }
    const collectionId = latest.current.collection.id;
    inFlight.current = true;
    setBusy(true);
    let result: CmsResult<Value>;
    try {
      result = await call(collectionId);
    } catch {
      // a source that throws reads as a lost answer
      result = { error: "unavailable" } as CmsFailure;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    const current = latest.current;
    // every answer refetches: items before a stop may have changed
    current.onListWritten();
    if (isCmsFailure(result)) {
      const refusal = getRefusal(result.error, "write");
      if (refusal !== undefined) {
        current.onRefusal(refusal);
        return;
      }
      toast.error(getListFailureText(action, result.error));
      return;
    }
    if (current.collection.id === collectionId) {
      current.onListChange({ ...current.list, selected: new Set() });
    }
    onSuccess?.(result);
  };

  const publish = async () => {
    const items = selectedRows().map((row) => ({
      id: row.id,
      updatedAt: row.updatedAt,
    }));
    if (items.length === 0) {
      return;
    }
    await run(
      "publish",
      (collectionId) =>
        latest.current.source.publishItems(collectionId, { items }),
      (answer) => {
        if (answer.conflicts.length > 0) {
          toast.error(`${answer.conflicts.length} changed by someone else`);
        }
        if (answer.failed.length > 0) {
          toast.error(`${answer.failed.length} not published`);
        }
      }
    );
  };

  const setStatus = async (status: "draft" | "archived") => {
    const ids = selectedRows().map((row) => row.id);
    if (ids.length === 0) {
      return;
    }
    await run("status", (collectionId) =>
      latest.current.source.setItemsStatus(collectionId, { ids, status })
    );
  };

  const remove = async () => {
    const ids = selectedRows().map((row) => row.id);
    if (ids.length === 0) {
      return;
    }
    await run("delete", (collectionId) =>
      latest.current.source.deleteItems(collectionId, { ids })
    );
  };

  return { busy, publish, setStatus, remove };
};
