/**
 * Drag and keyboard reorder of the items table (spec 5.1.7, W3-D4).
 *
 * The new order shows at once. A pointer drop sends E13 at once; keyboard
 * moves are sent together, `REORDER_SEND_DELAY_MS` after the last one or
 * when `flush` runs. While E13 is in flight a further order waits, and only
 * the latest is sent after it. A reorder renews the version of every row it
 * moves, so an open or a bulk call asked for meanwhile waits until the
 * reorder is settled: E13 answered, then an E3 answer for the current key.
 * The state lives in the screen's `ReorderState`, so a remount of the
 * table keeps it.
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
import type { ReorderState } from "./reorder-state";

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
  /** The screen's reorder state, kept across remounts of the table. */
  state: ReorderState;
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
  const { state } = input;
  state.notePageAnswer(input.pageAnswer.count);
  // the open collection's record
  const record = () => state.get(latest.current.collectionId);
  const pageIds = (input.page?.items ?? []).map((row) => row.id);

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const waiting = useRef<Waiting>({});
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
  // Re-renders when the state changes.
  const [, setPhase] = useState(0);
  const bump = () => setPhase((current) => current + 1);

  const setShown = (ids: readonly string[] | undefined) => {
    record().pending = ids;
  };

  // another collection starts with nothing pending; the same one, shown
  // again, keeps its state
  useEffect(() => {
    if (state.current === input.collectionId) {
      return;
    }
    if (state.current !== undefined) {
      state.leave(state.current);
    }
    state.current = input.collectionId;
    clearTimeout(timer.current);
    timer.current = undefined;
    waiting.current = {};
    bump();
  }, [input.collectionId]);

  const isSending = () => record().sending > 0;

  const isBusy = () =>
    timer.current !== undefined ||
    isSending() ||
    record().awaitingAfter !== undefined;

  /**
   * Settled: nothing pending to send, nothing in flight, and an E3 answer
   * after the last E13's. A drawn page is the server's order; a failed
   * refetch keeps showing the order E13 last accepted while the page it was
   * made on is drawn, until the next successful E3 answer or a change of
   * key, page number or rows.
   */
  const trySettle = () => {
    const current = record();
    const after = current.awaitingAfter;
    const { count, ok } = latest.current.pageAnswer;
    if (
      after === undefined ||
      count <= after ||
      isSending() ||
      timer.current !== undefined
    ) {
      return;
    }
    current.awaitingAfter = undefined;
    if (
      ok ||
      current.accepted === undefined ||
      current.acceptedOn !== signatures.current.drawn
    ) {
      current.accepted = undefined;
      current.acceptedOn = undefined;
      setShown(undefined);
    } else {
      current.movedOn = { ...signatures.current };
      setShown(current.accepted);
    }
    bump();
    state.notify();
    runWaiting(ok);
  };

  /**
   * Moves made on rows or a key no longer drawn are never sent; an order
   * queued behind the E13 in flight was made on its own drawn rows, and is
   * still sent after it.
   */
  const dropPending = () => {
    const current = record();
    clearTimeout(timer.current);
    timer.current = undefined;
    current.movedOn = undefined;
    current.accepted = undefined;
    current.acceptedOn = undefined;
    setShown(undefined);
    bump();
    if (isSending()) {
      return;
    }
    current.queued = undefined;
    if (current.awaitingAfter === undefined) {
      runWaiting(true);
    } else {
      trySettle();
    }
  };

  /** `queued`: an order queued behind E13, checked against its rows then. */
  const send = (ids: readonly string[], queued = false) => {
    const current = latest.current;
    const held = record();
    const currentIds = (current.page?.items ?? []).map((row) => row.id);
    if (queued === false && sameRows(ids, currentIds) === false) {
      dropPending();
      return;
    }
    if (isSending()) {
      held.queued = ids;
      return;
    }
    // the order the server holds: the one E13 last accepted, else the page's
    const serverOrder = held.accepted ?? currentIds;
    if (sameOrder(ids, serverOrder)) {
      // the moves cancel out: nothing to send; the order E13 last accepted
      // still shows
      if (held.awaitingAfter === undefined) {
        setShown(held.accepted);
        bump();
        runWaiting(true);
      } else {
        bump();
        trySettle();
      }
      return;
    }
    const { collectionId, onReordered, onFailed } = current;
    const sentOn = held.movedOn?.drawn;
    held.sending += 1;
    bump();
    state.notify();
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
        const written = state.get(collectionId);
        written.sending = Math.max(0, written.sending - 1);
        // another collection shows: its reorder state is its own
        if (state.current !== collectionId || written.sending > 0) {
          state.notify();
          report();
          return;
        }
        const next = written.queued;
        written.queued = undefined;
        // the next E3 answer after this one settles the reorder
        written.awaitingAfter = state.pageAnswerCount;
        if (isCmsFailure(result) === false) {
          written.accepted = ids;
          written.acceptedOn = sentOn;
        }
        state.notify();
        report();
        if (isCmsFailure(result) === false && next !== undefined) {
          if (state.sendQueued === undefined) {
            // sent when the table shows again
            written.queued = next;
          } else {
            state.sendQueued(collectionId, next);
          }
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
    // the order E13 accepted holds only until a page is drawn after it;
    // moves not yet sent stay
    const current = record();
    if (
      input.pageAnswer.ok &&
      current.accepted !== undefined &&
      current.awaitingAfter === undefined &&
      isSending() === false
    ) {
      current.accepted = undefined;
      current.acceptedOn = undefined;
      if (timer.current === undefined) {
        current.movedOn = undefined;
        setShown(undefined);
      }
      bump();
    }
  }, [input.pageAnswer]);

  // Another key, page or set of rows drops the moves made on the last,
  // except an order already sent, or queued behind the E13 in flight, while
  // the same page number and rows are drawn: it is still sent, and shows
  // only while the page it was made on is drawn.
  useEffect(() => {
    const current = record();
    const moved = current.movedOn;
    if (moved === undefined || moved.signature === pageSignature) {
      return;
    }
    if (
      moved.rows === signatures.current.rows &&
      timer.current === undefined &&
      isSending()
    ) {
      current.movedOn = { ...moved, signature: pageSignature };
      return;
    }
    if (
      current.pending !== undefined ||
      timer.current !== undefined ||
      current.accepted !== undefined
    ) {
      dropPending();
      return;
    }
    current.movedOn = undefined;
  }, [pageSignature]);

  const flush = () => {
    if (timer.current === undefined) {
      return;
    }
    clearTimeout(timer.current);
    timer.current = undefined;
    const ids = record().pending;
    if (ids === undefined) {
      bump();
      if (record().awaitingAfter === undefined) {
        runWaiting(true);
      } else {
        trySettle();
      }
      return;
    }
    send(ids);
  };

  // The table shown sends what was queued behind an E13 that answered
  // while no table showed; leaving it sends the moves not yet sent.
  const actions = useRef({ send, flush });
  actions.current = { send, flush };
  useEffect(() => {
    const sendQueued = (collectionId: string, ids: readonly string[]) => {
      if (latest.current.collectionId === collectionId) {
        actions.current.send(ids, true);
      }
    };
    state.sendQueued = sendQueued;
    const unsubscribe = state.subscribe(bump);
    const current = record();
    if (
      state.current === latest.current.collectionId &&
      current.sending === 0 &&
      current.queued !== undefined
    ) {
      const ids = current.queued;
      current.queued = undefined;
      actions.current.send(ids, true);
    }
    return () => {
      unsubscribe();
      if (state.sendQueued === sendQueued) {
        state.sendQueued = undefined;
      }
      actions.current.flush();
      clearTimeout(timer.current);
    };
  }, []);

  // a pending order shows only on the page it was made on
  const shown = state.get(input.collectionId);
  const pending =
    state.current === input.collectionId ? shown.pending : undefined;
  const order =
    pending !== undefined &&
    shown.movedOn?.drawn === drawnSignature &&
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
    record().movedOn = { ...signatures.current };
    setShown(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      const ids = record().pending;
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
    record().movedOn = { ...signatures.current };
    setShown(next);
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
