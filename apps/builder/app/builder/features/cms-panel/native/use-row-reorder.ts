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

type Waiting = {
  open?: () => void;
  bulk?: () => void;
  /** The waiting bulk call was dropped. */
  bulkDropped?: () => void;
};

const sameOrder = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length &&
  left.every((id, index) => right[index] === id);

const sameRows = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((id) => right.includes(id));

export const useRowReorder = (input: {
  source: CmsSource;
  collectionId: string;
  /** The open search, filter and sort: moves belong to the key they were made on. */
  listKey: string;
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
  whenSettled: (
    run: () => void,
    kind: "open" | "bulk",
    onDropped?: () => void
  ) => void;
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
  // The order the last successful E13 sent, until a drawn page shows it.
  const accepted = useRef<readonly string[] | undefined>(undefined);
  // The page the pending moves were made on: its key, page number, applied
  // sort and rows (`signature`), the page drawn (`drawn`), and its page
  // number and rows (`rows`).
  const movedOn = useRef<
    { signature: string; drawn: string; rows: string } | undefined
  >(undefined);
  // The page drawn when the order E13 last accepted was made.
  const acceptedOn = useRef<string | undefined>(undefined);
  const sortedIds = [...pageIds].sort();
  const pageSignature = JSON.stringify([
    input.listKey,
    input.page?.page,
    input.page?.applied.sort,
    sortedIds,
  ]);
  const drawnSignature = JSON.stringify([
    input.page?.page,
    input.page?.applied.sort,
    sortedIds,
  ]);
  const rowsSignature = JSON.stringify([input.page?.page, sortedIds]);
  const signatures = useRef({
    signature: pageSignature,
    drawn: drawnSignature,
    rows: rowsSignature,
  });
  signatures.current = {
    signature: pageSignature,
    drawn: drawnSignature,
    rows: rowsSignature,
  };
  // Bumped when another collection opens: an E13 sent for the last one
  // answers into nothing here.
  const generation = useRef(0);
  // The E13 calls in flight per collection, kept across collection changes:
  // back in a collection, its own E13 still holds an open, a bulk call and a
  // further order until it answers.
  const sending = useRef(new Map<string, number>());
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
    generation.current += 1;
    clearTimeout(timer.current);
    timer.current = undefined;
    inFlight.current = false;
    queued.current = undefined;
    awaitingAfter.current = undefined;
    accepted.current = undefined;
    acceptedOn.current = undefined;
    movedOn.current = undefined;
    waiting.current = {};
    setPending(undefined);
  }, [input.collectionId]);

  const isSending = (collectionId: string) => sending.current.has(collectionId);

  const isBusy = () =>
    timer.current !== undefined ||
    inFlight.current ||
    isSending(latest.current.collectionId) ||
    awaitingAfter.current !== undefined;

  /**
   * Settled: nothing pending to send, nothing in flight, and an E3 answer
   * after the last E13's. A drawn page is the server's order; a failed
   * refetch keeps showing the order E13 last accepted while the page it was
   * made on is drawn, until the next successful E3 answer or a change of
   * key, page number or rows.
   */
  const trySettle = () => {
    const after = awaitingAfter.current;
    const { count, ok } = latest.current.pageAnswer;
    if (
      after === undefined ||
      count <= after ||
      inFlight.current ||
      isSending(latest.current.collectionId) ||
      timer.current !== undefined
    ) {
      return;
    }
    awaitingAfter.current = undefined;
    if (
      ok ||
      accepted.current === undefined ||
      acceptedOn.current !== signatures.current.drawn
    ) {
      accepted.current = undefined;
      acceptedOn.current = undefined;
      pendingRef.current = undefined;
      setPending(undefined);
    } else {
      movedOn.current = { ...signatures.current };
      pendingRef.current = accepted.current;
      setPending(accepted.current);
    }
    bump();
    runWaiting(ok);
  };

  /** Moves made on rows or a key no longer drawn are never sent. */
  const dropPending = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    queued.current = undefined;
    movedOn.current = undefined;
    accepted.current = undefined;
    acceptedOn.current = undefined;
    pendingRef.current = undefined;
    setPending(undefined);
    bump();
    if (inFlight.current) {
      return;
    }
    if (awaitingAfter.current === undefined) {
      runWaiting(true);
    } else {
      trySettle();
    }
  };

  const send = (ids: readonly string[]) => {
    const current = latest.current;
    const currentIds = (current.page?.items ?? []).map((row) => row.id);
    if (sameRows(ids, currentIds) === false) {
      dropPending();
      return;
    }
    if (inFlight.current || isSending(current.collectionId)) {
      queued.current = ids;
      return;
    }
    // the order the server holds: the one E13 last accepted, else the page's
    const held =
      accepted.current ?? (current.page?.items ?? []).map((row) => row.id);
    if (sameOrder(ids, held)) {
      // the moves cancel out: nothing to send; the order E13 last accepted
      // still shows
      if (awaitingAfter.current === undefined) {
        pendingRef.current = accepted.current;
        setPending(accepted.current);
        bump();
        runWaiting(true);
      } else {
        bump();
        trySettle();
      }
      return;
    }
    inFlight.current = true;
    bump();
    const { collectionId, onReordered, onFailed } = current;
    const sentIn = generation.current;
    const sentOn = movedOn.current?.drawn;
    sending.current.set(
      collectionId,
      (sending.current.get(collectionId) ?? 0) + 1
    );
    void current.source
      .reorderItems(collectionId, { ids: [...ids] })
      .catch((): CmsResult<{ changed: number }> => ({ error: "unavailable" }))
      .then((result) => {
        // the lists and the canvas of the collection written refetch
        const report = () => {
          if (isCmsFailure(result)) {
            onFailed(result.error);
          } else {
            onReordered();
          }
        };
        const left = (sending.current.get(collectionId) ?? 1) - 1;
        if (left > 0) {
          sending.current.set(collectionId, left);
        } else {
          sending.current.delete(collectionId);
        }
        // another collection opened meanwhile: its reorder state is its own
        if (sentIn !== generation.current) {
          // back in the collection written: what waited on this E13 waits
          // on the E3 answer after it, then a queued order is sent
          if (
            latest.current.collectionId === collectionId &&
            isSending(collectionId) === false
          ) {
            const next = queued.current;
            queued.current = undefined;
            awaitingAfter.current = latest.current.pageAnswer.count;
            if (isCmsFailure(result) === false) {
              accepted.current = ids;
              acceptedOn.current = signatures.current.drawn;
            }
            bump();
            report();
            if (
              isCmsFailure(result) === false &&
              next !== undefined &&
              inFlight.current === false
            ) {
              send(next);
            }
            return;
          }
          report();
          return;
        }
        inFlight.current = false;
        const next = queued.current;
        queued.current = undefined;
        // the next E3 answer after this one settles the reorder
        awaitingAfter.current = latest.current.pageAnswer.count;
        if (isCmsFailure(result) === false) {
          accepted.current = ids;
          acceptedOn.current = sentOn;
        }
        bump();
        report();
        if (isCmsFailure(result) === false && next !== undefined) {
          send(next);
        }
      });
  };

  /** Runs what waited: an open always; a bulk call only on a drawn page. */
  const runWaiting = (pageDrawn: boolean) => {
    const { open, bulk, bulkDropped } = waiting.current;
    waiting.current = {};
    if (bulk !== undefined) {
      if (pageDrawn) {
        bulk();
      } else {
        // its versions are stale; the selection stays
        toast.error(getToastText("unavailable"));
        bulkDropped?.();
      }
    }
    open?.();
  };

  // E13 answered, then an E3 answer for the current key: settled.
  useEffect(() => {
    trySettle();
    // the order E13 accepted holds only until a page is drawn after it
    if (
      input.pageAnswer.ok &&
      accepted.current !== undefined &&
      awaitingAfter.current === undefined &&
      inFlight.current === false &&
      timer.current === undefined
    ) {
      accepted.current = undefined;
      acceptedOn.current = undefined;
      movedOn.current = undefined;
      pendingRef.current = undefined;
      setPending(undefined);
    }
  }, [input.pageAnswer]);

  // Another key, page or set of rows drops the moves made on the last,
  // except an order already sent, or queued behind the E13 in flight, while
  // the same page number and rows are drawn: it is still sent, and shows
  // only while the page it was made on is drawn.
  useEffect(() => {
    const moved = movedOn.current;
    if (moved === undefined || moved.signature === pageSignature) {
      return;
    }
    if (
      moved.rows === rowsSignature &&
      timer.current === undefined &&
      inFlight.current
    ) {
      movedOn.current = { ...moved, signature: pageSignature };
      return;
    }
    if (
      pendingRef.current !== undefined ||
      timer.current !== undefined ||
      accepted.current !== undefined
    ) {
      dropPending();
      return;
    }
    movedOn.current = undefined;
  }, [pageSignature]);

  const flush = () => {
    if (timer.current === undefined) {
      return;
    }
    clearTimeout(timer.current);
    timer.current = undefined;
    const ids = pendingRef.current;
    if (ids === undefined) {
      bump();
      if (awaitingAfter.current === undefined) {
        runWaiting(true);
      } else {
        trySettle();
      }
      return;
    }
    send(ids);
  };

  // a pending order shows only on the page it was made on
  const order =
    pending !== undefined &&
    movedOn.current?.drawn === drawnSignature &&
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
    movedOn.current = { ...signatures.current };
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
    movedOn.current = { ...signatures.current };
    pendingRef.current = next;
    setPending(next);
    send(next);
  };

  const whenSettled = (
    run: () => void,
    kind: "open" | "bulk",
    onDropped?: () => void
  ) => {
    if (isBusy() === false) {
      run();
      return;
    }
    waiting.current =
      kind === "open"
        ? { ...waiting.current, open: run }
        : { ...waiting.current, bulk: run, bulkDropped: onDropped };
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
