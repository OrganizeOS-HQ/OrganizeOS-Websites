/**
 * Drag and keyboard reorder of the items table (spec 5.1.7, W3-D4).
 *
 * The new order shows at once. A pointer drop sends E13 at once; keyboard
 * moves are sent together, `REORDER_SEND_DELAY_MS` after the last one or
 * when `flush` runs. While E13 is in flight a further order waits, and only
 * the latest is sent after it. A reorder renews the version of every row it
 * moves, so an open or a bulk call asked for meanwhile waits until the
 * reorder is settled: E13 answered, then an E3 answer for the current key.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "@webstudio-is/design-system";
import { getToastText } from "./cms-logic";
import { moveRow } from "./cms-list-logic";
import {
  isCmsFailure,
  type CmsErrorCode,
  type CmsItemsPage,
  type CmsResult,
  type CmsSource,
} from "./cms-source";

/** The pause after the last keyboard move; slice 3's Fields list uses it too. */
export const REORDER_SEND_DELAY_MS = 500;

type Waiting = { open?: () => void; bulk?: () => void };

const sameOrder = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length &&
  left.every((id, index) => right[index] === id);

export const useRowReorder = (input: {
  source: CmsSource;
  collectionId: string;
  page: CmsItemsPage | undefined;
  pageAnswer: { count: number; ok: boolean };
  onReordered: () => void;
  onFailed: (code: CmsErrorCode) => void;
}): {
  order: readonly string[];
  busy: boolean;
  /** A bulk call waits on the reorder: the bulk bar stays disabled. */
  bulkWaiting: boolean;
  move: (id: string, direction: -1 | 1) => void;
  drop: (oldIndex: number, newIndex: number) => void;
  flush: () => void;
  whenSettled: (run: () => void, kind: "open" | "bulk") => void;
} => {
  const latest = useRef(input);
  latest.current = input;
  const pageIds = (input.page?.items ?? []).map((row) => row.id);

  // The order shown while it differs from the page's: moves not yet sent,
  // or sent and not yet refetched.
  const [pending, setPending] = useState<readonly string[] | undefined>(
    undefined
  );
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlight = useRef(false);
  const queued = useRef<readonly string[] | undefined>(undefined);
  // The page-answer count when the last E13 answered: settled past it.
  const awaitingAfter = useRef<number | undefined>(undefined);
  const waiting = useRef<Waiting>({});
  // Re-renders when a ref-held phase changes.
  const [, setPhase] = useState(0);
  const bump = () => setPhase((current) => current + 1);

  useEffect(() => () => clearTimeout(timer.current), []);

  // another collection starts with nothing pending
  const lastCollectionId = useRef(input.collectionId);
  useEffect(() => {
    if (lastCollectionId.current === input.collectionId) {
      return;
    }
    lastCollectionId.current = input.collectionId;
    clearTimeout(timer.current);
    timer.current = undefined;
    queued.current = undefined;
    awaitingAfter.current = undefined;
    waiting.current = {};
    setPending(undefined);
  }, [input.collectionId]);

  const isBusy = () =>
    timer.current !== undefined ||
    inFlight.current ||
    awaitingAfter.current !== undefined;

  const settle = () => {
    awaitingAfter.current = undefined;
    setPending(undefined);
    bump();
  };

  const send = (ids: readonly string[]) => {
    const current = latest.current;
    const shown = (current.page?.items ?? []).map((row) => row.id);
    if (inFlight.current) {
      queued.current = ids;
      return;
    }
    if (sameOrder(ids, shown)) {
      // the moves cancel out: nothing to send
      setPending(undefined);
      bump();
      runWaiting(true);
      return;
    }
    inFlight.current = true;
    bump();
    const collectionId = current.collectionId;
    void current.source
      .reorderItems(collectionId, { ids: [...ids] })
      .catch((): CmsResult<{ changed: number }> => ({ error: "unavailable" }))
      .then((result) => {
        inFlight.current = false;
        if (latest.current.collectionId !== collectionId) {
          // another collection opened meanwhile: nothing here waits on it
          bump();
          return;
        }
        const next = queued.current;
        queued.current = undefined;
        if (isCmsFailure(result) === false && next !== undefined) {
          send(next);
          return;
        }
        // the next E3 answer after this one settles the reorder
        awaitingAfter.current = latest.current.pageAnswer.count;
        bump();
        if (isCmsFailure(result)) {
          latest.current.onFailed(result.error);
        } else {
          latest.current.onReordered();
        }
      });
  };

  /** Runs what waited: an open always; a bulk call only on a drawn page. */
  const runWaiting = (pageDrawn: boolean) => {
    const { open, bulk } = waiting.current;
    waiting.current = {};
    if (bulk !== undefined) {
      if (pageDrawn) {
        bulk();
      } else {
        // its versions are stale; the selection stays
        toast.error(getToastText("unavailable"));
      }
    }
    open?.();
  };

  // E13 answered, then an E3 answer for the current key: settled.
  useEffect(() => {
    const after = awaitingAfter.current;
    if (after === undefined || input.pageAnswer.count <= after) {
      return;
    }
    settle();
    runWaiting(input.pageAnswer.ok);
  }, [input.pageAnswer]);

  const flush = () => {
    if (timer.current === undefined) {
      return;
    }
    clearTimeout(timer.current);
    timer.current = undefined;
    const ids = pendingRef.current;
    if (ids === undefined) {
      bump();
      runWaiting(true);
      return;
    }
    send(ids);
  };

  // a pending order of other rows (another page drawn meanwhile) is dropped
  const order =
    pending !== undefined &&
    pending.length === pageIds.length &&
    pending.every((id) => pageIds.includes(id))
      ? pending
      : pageIds;

  const move = (id: string, direction: -1 | 1) => {
    const from = order.indexOf(id);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= order.length) {
      return;
    }
    const next = moveRow(order, from, to);
    pendingRef.current = next;
    setPending(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      const ids = pendingRef.current;
      if (ids !== undefined) {
        send(ids);
      }
    }, REORDER_SEND_DELAY_MS);
    bump();
  };

  const drop = (oldIndex: number, newIndex: number) => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const next = moveRow(order, oldIndex, newIndex);
    pendingRef.current = next;
    setPending(next);
    send(next);
  };

  const whenSettled = (run: () => void, kind: "open" | "bulk") => {
    if (isBusy() === false) {
      run();
      return;
    }
    waiting.current = { ...waiting.current, [kind]: run };
    bump();
    // pending moves are sent at once
    flush();
  };

  return {
    order,
    busy: isBusy(),
    bulkWaiting: waiting.current.bulk !== undefined,
    move,
    drop,
    flush,
    whenSettled,
  };
};
