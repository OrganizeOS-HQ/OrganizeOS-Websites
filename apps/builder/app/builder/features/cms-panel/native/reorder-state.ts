/**
 * The items table's reorder state (spec 5.1.7, W3-D4), kept by the screen
 * above the table, so a remount of the table (an item visit, the page line,
 * a structure view) keeps it: the E13 calls in flight per collection, and
 * for the collection the table last showed, the order shown, the order
 * queued behind E13, the order E13 last accepted and the page it was made
 * on, and the page answer the reorder waits past.
 *
 * Read API for other views:
 * - `isSending(collectionId)`: an E13 for the collection is in flight.
 * - `whenSent(collectionId, run)`: runs `run` once no E13 for the
 *   collection is in flight (at once when none is); a later call for the
 *   same collection replaces a waiting one.
 * - `subscribe(listener)`: called after each change; answers the
 *   unsubscribe.
 * Writes belong to `useRowReorder` alone.
 */

/** The page a move was made on: its key, page number, sort and rows. */
export type ReorderPage = {
  signature: string;
  drawn: string;
  rows: string;
};

export type CollectionReorder = {
  /** The E13 calls in flight. */
  sending: number;
  /** The order shown while it differs from the page's. */
  pending?: readonly string[];
  /** The page `pending` was made on. */
  movedOn?: ReorderPage;
  /** The latest order made while E13 was in flight, sent after it. */
  queued?: readonly string[];
  /** The page answer count when the last E13 answered: settled past it. */
  awaitingAfter?: number;
  /** The order the last successful E13 sent, until a drawn page shows it. */
  accepted?: readonly string[];
  /** The page drawn when `accepted` was made. */
  acceptedOn?: string;
};

export type ReorderState = {
  isSending: (collectionId: string) => boolean;
  whenSent: (collectionId: string, run: () => void) => void;
  subscribe: (listener: () => void) => () => void;
  /** The collection's record, made on first use. */
  get: (collectionId: string) => CollectionReorder;
  /** The collection the table last showed. */
  current: string | undefined;
  /** The latest page answer count seen. */
  pageAnswerCount: number;
  notePageAnswer: (count: number) => void;
  /** The table moved to another collection: the one left keeps only its E13 count. */
  leave: (collectionId: string) => void;
  notify: () => void;
  /** Sends a queued order through the table shown; unset while none is. */
  sendQueued?: (collectionId: string, ids: readonly string[]) => void;
};

export const createReorderState = (): ReorderState => {
  const records = new Map<string, CollectionReorder>();
  const listeners = new Set<() => void>();
  const waitingSent = new Map<string, () => void>();
  const get = (collectionId: string) => {
    let record = records.get(collectionId);
    if (record === undefined) {
      record = { sending: 0 };
      records.set(collectionId, record);
    }
    return record;
  };
  const isSending = (collectionId: string) =>
    (records.get(collectionId)?.sending ?? 0) > 0;
  const state: ReorderState = {
    isSending,
    whenSent: (collectionId, run) => {
      if (isSending(collectionId) === false) {
        run();
        return;
      }
      waitingSent.set(collectionId, run);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get,
    current: undefined,
    pageAnswerCount: 0,
    notePageAnswer: (count) => {
      state.pageAnswerCount = Math.max(state.pageAnswerCount, count);
    },
    leave: (collectionId) => {
      const record = get(collectionId);
      records.set(collectionId, { sending: record.sending });
    },
    notify: () => {
      for (const [collectionId, run] of [...waitingSent]) {
        if (isSending(collectionId) === false) {
          waitingSent.delete(collectionId);
          run();
        }
      }
      for (const listener of [...listeners]) {
        listener();
      }
    },
  };
  return state;
};
