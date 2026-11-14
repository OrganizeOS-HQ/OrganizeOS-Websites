/**
 * The structure screens' state (OrganizeOS design
 * docs/superpowers/specs/2026-11-13-native-cms-slice-3-design.md, section
 * 4), for `CmsScreen`: the column's tab, the open field sheet or collection
 * settings, the open collection's structure (E21), the plan's caps and the
 * templates (E20), and the New collection and Delete dialogs. Without a
 * `CmsStructureSource` it adds nothing.
 *
 * Its reads follow the screen's rules: E20 and E21 read on open and again on
 * each reopen and refresh; a background read that fails changes nothing on
 * screen; a read made while a view holds unsaved values maps as a write.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  Flex,
  IconButton,
  Text,
  toast,
  Tooltip,
} from "@webstudio-is/design-system";
import { PlusIcon } from "@webstudio-is/icons";
import { getRefusal, getToastText, type CmsRefusal } from "./cms-logic";
import { $cmsNativeDirty } from "./cms-native-stores";
import {
  isCmsFailure,
  type CmsAccess,
  type CmsCollectionSummary,
  type CmsErrorCode,
  type CmsFieldKind,
} from "./cms-source";
import {
  changesCanvas,
  getFieldCap,
  getStructureToastText,
  moveField,
  orderByKeys,
  RATE_LIMIT_RETRY_MS,
  REORDER_PAUSE_MS,
} from "./cms-structure-logic";
import {
  CUSTOM_COLLECTION_TYPE,
  type CmsStructureCollection,
  type CmsStructureField,
  type CmsStructureLimits,
  type CmsStructureSource,
  type CmsTemplate,
} from "./cms-structure-source";
import {
  CollectionSettings,
  DeleteCollectionDialog,
  type CmsStructureEnqueue,
} from "./collection-settings";
import { FieldSheet, type FieldSheetTarget } from "./field-sheet";
import { AddFieldMenu, FieldsList } from "./fields-view";
import {
  NewCollectionDialog,
  NewCollectionPage,
  type CmsPendingCreate,
} from "./new-collection";
import { LineRow, RefusalLine, type CmsLineKind } from "./refusal-line";
import { StructureRowMenu } from "./structure-row-menu";

export type CmsStructureTab = "collections" | "fields";

export type CmsStructureView =
  | { type: "field"; target: FieldSheetTarget }
  | { type: "settings" };

/** Where a story opens: a tab, a view, a dialog. */
export type CmsStructureInitial = {
  tab?: CmsStructureTab;
  view?: CmsStructureView;
  dialog?: "new-collection" | "delete";
  /** The New collection dialog's preselected option. */
  newCollectionType?: string;
};

export type CmsStructureColumn = {
  tab: CmsStructureTab;
  onTabChange: (tab: CmsStructureTab) => void;
  /** Disabled with no collection open. */
  hasFields: boolean;
  /** The tab row's "+": New collection, or the Add field menu. */
  add: ReactNode;
  fields: ReactNode;
  /** The person can manage the CMS's settings: rows reserve their menu. */
  canManage: boolean;
};

/** What a structure write changed, for the screen's refetches (4.7). */
export type CmsStructureEffect =
  | { kind: "created"; collection: CmsCollectionSummary }
  | {
      kind: "settings";
      before: { slug: string; isPublic: boolean };
      after: { slug: string; isPublic: boolean };
    }
  | {
      kind: "schema";
      slug: string;
      removed: string[];
      /** A field removed, a field's options or the title field changed. */
      changesCanvas: boolean;
    }
  | { kind: "deleted"; collectionId: string; slug: string };

/**
 * A read's failure, as the screen maps its own (4.3.4): while a view holds
 * unsaved values, `forbidden` and `plan` are a toast and the view stays.
 */
const mapStructureRead = (
  code: CmsErrorCode
): CmsRefusal | "toast" | undefined => {
  const refusal = getRefusal(code, $cmsNativeDirty.get() ? "write" : "load");
  if (refusal === undefined && getRefusal(code, "load") !== undefined) {
    toast.error(getToastText(code), { id: `cms-read-${code}` });
    return "toast";
  }
  return refusal;
};

/** A read whose foreground inputs are the last read's was asked by a reopen. */
const useIsBackground = () => {
  const last = useRef<{ source: CmsStructureSource; key: string } | undefined>(
    undefined
  );
  return useCallback((source: CmsStructureSource, key: string) => {
    const isBackground =
      last.current?.source === source && last.current.key === key;
    last.current = { source, key };
    return isBackground;
  }, []);
};

export const useCmsStructure = ({
  structure,
  access,
  collections,
  collectionId,
  opens,
  refresh,
  attempt,
  initial,
  guard,
  onDirtyChange,
  onWritten,
  onOpenCollection,
  onViewOpen,
  refetchCollections,
  showLine: showScreenLine,
  clearLine: clearScreenLine,
  renderRowActions,
}: {
  structure: CmsStructureSource | undefined;
  access: CmsAccess | undefined;
  collections: CmsCollectionSummary[];
  collectionId: string | undefined;
  /** The screen's reopen count and `$cmsNativeRefresh`: E20 and E21 read again. */
  opens: number;
  refresh: number;
  /** The screen line's Retry: E20 and E21 read again, in the foreground. */
  attempt: number;
  initial?: CmsStructureInitial;
  /** The unsaved guard. */
  guard: (run: () => void) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** After a structure write: the screen's refetches (4.7). */
  onWritten: (effect: CmsStructureEffect) => void;
  /** Opens a collection's items, past the guard. */
  onOpenCollection: (collectionId: string | undefined) => void;
  /** A structure view opens over the items: the list's selection clears. */
  onViewOpen: () => void;
  /** E1 again, in the background. */
  refetchCollections: () => void;
  /** The screen's line, under the cause "structure". */
  showLine: (kind: CmsLineKind) => void;
  clearLine: () => void;
  /** The collection actions, given the menu's own items; null without. */
  renderRowActions?: (
    collection: CmsCollectionSummary,
    items: { leading: ReactNode; trailing: ReactNode }
  ) => ReactNode;
}) => {
  const canManage = access?.canManageSettings === true;
  const isReady = structure !== undefined && access !== undefined;
  const [tab, setTab] = useState<CmsStructureTab>(
    initial?.tab ?? "collections"
  );
  const [view, setView] = useState<CmsStructureView | undefined>(initial?.view);
  // the collection the open view belongs to: when the open collection
  // changes any other way, the view closes (it never moves to another one)
  const [viewCollectionId, setViewCollectionId] = useState(collectionId);
  const [session, setSession] = useState(0);
  // the open collection and view session now, for answers that land later
  const collectionIdRef = useRef(collectionId);
  collectionIdRef.current = collectionId;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [detail, setDetail] = useState<CmsStructureCollection | undefined>();
  const [detailFailed, setDetailFailed] = useState<
    "unavailable" | "not_found" | undefined
  >(undefined);
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [detailVersion, setDetailVersion] = useState(0);
  const [limits, setLimits] = useState<CmsStructureLimits | undefined>();
  const [templates, setTemplates] = useState<CmsTemplate[] | undefined>();
  // a foreground E20 failed: its line and Retry stand where the options go
  const [structureFailed, setStructureFailed] = useState(false);
  const [structureAttempt, setStructureAttempt] = useState(0);
  const isStructureBackground = useIsBackground();
  const [structureVersion, setStructureVersion] = useState(0);
  const [isNewOpen, setIsNewOpen] = useState(
    initial?.dialog === "new-collection"
  );
  const [deleteTarget, setDeleteTarget] = useState<
    CmsStructureCollection | undefined
  >();
  const isDetailBackground = useIsBackground();
  /** After a write: the screen's refetches, and E21 again for the open one. */
  const written = (effect: CmsStructureEffect) => {
    onWritten(effect);
    if (effect.kind === "schema" || effect.kind === "settings") {
      setDetailVersion((current) => current + 1);
    }
  };

  // One queue per collection (4.4, W4-D4): its E23 and E24 run one at a
  // time, each with the version the last answer, or E21, gave.
  // a create answers later than its click: its opening goes through the
  // guard as the screen holds it then
  const latestGuard = useRef(guard);
  latestGuard.current = guard;

  const refocusFrame = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (refocusFrame.current !== undefined) {
        cancelAnimationFrame(refocusFrame.current);
      }
    },
    []
  );
  const queues = useRef(new Map<string, Promise<unknown>>());
  const versions = useRef(new Map<string, string>());
  const inFlight = useRef(new Map<string, number>());
  // writes answered per collection: a read sent before one answered carries
  // an older version than the queue holds
  const answered = useRef(new Map<string, number>());
  // the schema the platform last answered or served, per collection, as it
  // answers: a reorder's turn builds on it, never on a render's stale copy
  const lastSchema = useRef(new Map<string, CmsStructureField[]>());
  const enqueue: CmsStructureEnqueue = useCallback((id, write) => {
    const run = async () => {
      inFlight.current.set(id, (inFlight.current.get(id) ?? 0) + 1);
      try {
        const result = await write(versions.current.get(id) ?? "");
        if (isCmsFailure(result) === false) {
          versions.current.set(id, result.updatedAt);
          if ("fields" in result && Array.isArray(result.fields)) {
            lastSchema.current.set(id, result.fields as CmsStructureField[]);
          }
        }
        answered.current.set(id, (answered.current.get(id) ?? 0) + 1);
        return result;
      } finally {
        inFlight.current.set(id, (inFlight.current.get(id) ?? 1) - 1);
      }
    };
    const next = (queues.current.get(id) ?? Promise.resolve()).then(run, run);
    queues.current.set(
      id,
      next.catch(() => undefined)
    );
    return next;
  }, []);
  /** The count of a collection's answered writes, when a read is sent. */
  const readMark = useCallback(
    (id: string) => answered.current.get(id) ?? 0,
    []
  );
  // An open settings view or field sheet holds its collection's version:
  // its form was built from that version, so a save over another person's
  // change answers `conflict` and rebases. A read meanwhile waits here.
  const holds = useRef(new Map<string, number>());
  const deferred = useRef(
    new Map<string, { updatedAt: string; mark: number }>()
  );
  const isCurrentMark = (id: string, mark: number) =>
    (inFlight.current.get(id) ?? 0) === 0 &&
    (answered.current.get(id) ?? 0) === mark;
  /**
   * A read's version, unless a write of that collection is under way or
   * answered since the read was sent. `forView`: the open view's own reread,
   * which rebases the view on it.
   */
  const takeVersion = useCallback(
    (collection: CmsStructureCollection, mark: number, forView = false) => {
      if (isCurrentMark(collection.id, mark) === false) {
        return;
      }
      if (forView === false && (holds.current.get(collection.id) ?? 0) > 0) {
        deferred.current.set(collection.id, {
          updatedAt: collection.updatedAt,
          mark,
        });
        return;
      }
      deferred.current.delete(collection.id);
      versions.current.set(collection.id, collection.updatedAt);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  /** Holds a collection's version until the returned release. */
  const holdVersion = useCallback((id: string) => {
    holds.current.set(id, (holds.current.get(id) ?? 0) + 1);
    return () => {
      const left = (holds.current.get(id) ?? 1) - 1;
      holds.current.set(id, left);
      const waiting = deferred.current.get(id);
      if (left > 0 || waiting === undefined) {
        return;
      }
      deferred.current.delete(id);
      if (isCurrentMark(id, waiting.mark)) {
        versions.current.set(id, waiting.updatedAt);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Which read, or a write, showed the line: that read's next answer, or
  // either read's after a write, clears it.
  const lineFrom = useRef<"e20" | "e21" | "write" | undefined>(undefined);
  const showLineFrom = useCallback(
    (from: "e20" | "e21" | "write", kind: CmsLineKind) => {
      lineFrom.current = from;
      showScreenLine(kind);
    },
    [showScreenLine]
  );
  const clearLineFrom = useCallback(
    (from: "e20" | "e21") => {
      if (lineFrom.current === from || lineFrom.current === "write") {
        lineFrom.current = undefined;
        clearScreenLine();
      }
    },
    [clearScreenLine]
  );
  const showLine = useCallback(
    (kind: CmsLineKind) => showLineFrom("write", kind),
    [showLineFrom]
  );

  // A reorder waiting for its pause, or sent: the order on screen is the
  // person's, and a read keeps it until the platform answers.
  const reorderTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const reorderPending = useRef<string | undefined>(undefined);
  /** The order the platform last accepted, per collection. */
  const acceptedOrder = useRef(new Map<string, CmsStructureField[]>());
  const latestDetail = useRef<CmsStructureCollection | undefined>(undefined);
  latestDetail.current = detail;
  const cancelReorderTimer = useCallback(() => {
    if (reorderTimer.current !== undefined) {
      clearTimeout(reorderTimer.current);
      reorderTimer.current = undefined;
    }
  }, []);
  /**
   * A read while a reorder waits: the read's fields in the person's order.
   * When the read adds or removes a field, the reorder is dropped and the
   * read stands as it is.
   */
  const withLocalOrder = useCallback(
    (
      current: CmsStructureCollection | undefined,
      fresh: CmsStructureCollection
    ): CmsStructureCollection => {
      if (reorderPending.current === fresh.id && current?.id === fresh.id) {
        const byKey = new Map(fresh.fields.map((field) => [field.key, field]));
        const ordered = current.fields.flatMap((field) => {
          const found = byKey.get(field.key);
          return found === undefined ? [] : [found];
        });
        if (ordered.length === fresh.fields.length) {
          // the platform's order now is the read's, not the moved one
          acceptedOrder.current.set(fresh.id, fresh.fields);
          lastSchema.current.set(fresh.id, fresh.fields);
          return { ...fresh, fields: ordered };
        }
        cancelReorderTimer();
        reorderPending.current = undefined;
      }
      acceptedOrder.current.set(fresh.id, fresh.fields);
      lastSchema.current.set(fresh.id, fresh.fields);
      return fresh;
    },
    [cancelReorderTimer]
  );
  useEffect(() => cancelReorderTimer, [cancelReorderTimer]);

  // E20: the templates and the plan's caps, for a person who can manage.
  useEffect(() => {
    if (structure === undefined || isReady === false || opens === 0) {
      return;
    }
    if (canManage === false) {
      return;
    }
    const isBackground = isStructureBackground(
      structure,
      JSON.stringify([structureAttempt, attempt])
    );
    let isCurrent = true;
    void structure.getStructure().then((result) => {
      if (isCurrent === false) {
        return;
      }
      if (isCmsFailure(result)) {
        const refusal = mapStructureRead(result.error);
        if (refusal !== undefined && refusal !== "toast") {
          showLineFrom("e20", refusal);
          return;
        }
        // any other failure: a foreground read shows its line and Retry; a
        // background one changes nothing
        if (refusal === undefined && isBackground === false) {
          setStructureFailed(true);
        }
        return;
      }
      clearLineFrom("e20");
      setStructureFailed(false);
      setLimits(result.limits);
      setTemplates(result.templates);
    });
    return () => {
      isCurrent = false;
    };
  }, [
    structure,
    isReady,
    canManage,
    opens,
    refresh,
    attempt,
    structureAttempt,
    structureVersion,
    isStructureBackground,
    showLineFrom,
    clearLineFrom,
  ]);

  // E21: the open collection's structure.
  useEffect(() => {
    if (
      structure === undefined ||
      isReady === false ||
      opens === 0 ||
      collectionId === undefined
    ) {
      return;
    }
    const isBackground = isDetailBackground(
      structure,
      JSON.stringify([collectionId, detailAttempt, attempt])
    );
    let isCurrent = true;
    if (isBackground === false) {
      setDetailFailed(undefined);
    }
    const mark = readMark(collectionId);
    void structure.getCollectionStructure(collectionId).then((result) => {
      if (isCurrent === false) {
        return;
      }
      if (isCmsFailure(result)) {
        const refusal = mapStructureRead(result.error);
        if (refusal === "toast") {
          return;
        }
        if (refusal !== undefined) {
          showLineFrom("e21", refusal);
          return;
        }
        if (isBackground) {
          return;
        }
        if (result.error === "not_found") {
          setDetailFailed("not_found");
          refetchCollections();
        } else {
          setDetailFailed("unavailable");
        }
        return;
      }
      clearLineFrom("e21");
      setDetailFailed(undefined);
      takeVersion(result.collection, mark);
      setDetail((current) => withLocalOrder(current, result.collection));
    });
    return () => {
      isCurrent = false;
    };
  }, [
    structure,
    isReady,
    opens,
    refresh,
    collectionId,
    detailAttempt,
    attempt,
    detailVersion,
    isDetailBackground,
    readMark,
    takeVersion,
    withLocalOrder,
    showLineFrom,
    clearLineFrom,
    refetchCollections,
  ]);

  // A tab with nothing to show goes back to the list.
  useEffect(() => {
    if (collectionId === undefined && tab === "fields") {
      setTab("collections");
    }
  }, [collectionId, tab]);

  // A story may open the Delete dialog.
  const pendingDialogRef = useRef(initial?.dialog);
  useEffect(() => {
    if (pendingDialogRef.current === "delete" && detail !== undefined) {
      pendingDialogRef.current = undefined;
      setDeleteTarget(detail);
    }
  }, [detail]);

  // Whether the settings view or the field sheet reported unsaved values:
  // only then does closing it clear the screen's flag, which the item
  // editor shares.
  const viewDirty = useRef(false);
  const reportViewDirty = useCallback(
    (dirty: boolean) => {
      viewDirty.current = dirty;
      onDirtyChange(dirty);
    },
    [onDirtyChange]
  );
  const clearViewDirty = useCallback(() => {
    if (viewDirty.current) {
      viewDirty.current = false;
      onDirtyChange(false);
    }
  }, [onDirtyChange]);

  const closeView = useCallback(() => {
    clearViewDirty();
    setView(undefined);
  }, [clearViewDirty]);

  // the open collection changed other than by its own Settings: its view
  // closes, and so does its unsaved report
  useEffect(() => {
    if (view !== undefined && viewCollectionId !== collectionId) {
      closeView();
    }
  }, [view, viewCollectionId, collectionId, closeView]);

  // The focus: a view that opens takes it on Back, unless the view already
  // holds it; a view that closes gives it to the row it was opened from
  const shownView = useRef<
    { view: CmsStructureView; slug?: string } | undefined
  >(undefined);
  useEffect(() => {
    const previous = shownView.current;
    if (previous?.view === view) {
      return;
    }
    shownView.current =
      view === undefined
        ? undefined
        : {
            view,
            slug: collections.find((entry) => entry.id === viewCollectionId)
              ?.slug,
          };
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      const lost = active === null || active === document.body;
      if (view !== undefined) {
        const header = document.querySelector("[data-cms-structure-header]");
        const holder = header?.parentElement;
        if (header !== null && (lost || holder?.contains(active) === false)) {
          header.querySelector<HTMLElement>('[aria-label="Back"]')?.focus();
        }
        return;
      }
      if (previous === undefined || lost === false) {
        return;
      }
      const target =
        previous.view.type === "field" ? previous.view.target : undefined;
      const selector =
        target === undefined
          ? previous.slug === undefined
            ? undefined
            : `[data-cms-collection="${CSS.escape(previous.slug)}"] button`
          : "key" in target
            ? `[data-cms-field-row="${CSS.escape(target.key)}"] button`
            : '[aria-label="Add field"]';
      if (selector !== undefined) {
        document.querySelector<HTMLElement>(selector)?.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
    // the list and the open collection are read as they are on the change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  /** Discard ran an action that leaves the view open: it shows saved values. */
  const resetView = useCallback(() => {
    clearViewDirty();
    setSession((current) => current + 1);
  }, [clearViewDirty]);

  // A Create whose outcome is unknown: the next E1 holding a new collection
  // of that name is the one it made.
  const pendingCreate = useRef<
    (CmsPendingCreate & { knownIds: Set<string> }) | undefined
  >(undefined);
  const foundCreated = useRef<
    ((collection: CmsCollectionSummary, type: string) => void) | undefined
  >(undefined);
  useEffect(() => {
    const pending = pendingCreate.current;
    if (pending === undefined) {
      return;
    }
    const found = collections.find(
      (entry) =>
        pending.knownIds.has(entry.id) === false && entry.name === pending.name
    );
    if (found !== undefined) {
      foundCreated.current?.(found, pending.type);
    }
  }, [collections]);

  /** E21 now; `forView`: the open view's reread, which takes the version. */
  const fetchStructure = async (id: string, forView = false) => {
    if (structure === undefined) {
      return undefined;
    }
    const mark = readMark(id);
    const result = await structure.getCollectionStructure(id);
    if (isCmsFailure(result)) {
      const refusal = mapStructureRead(result.error);
      if (refusal !== undefined && refusal !== "toast") {
        showLine(refusal);
      } else if (refusal === undefined && result.error === "not_found") {
        toast.error("Collection not found");
        refetchCollections();
      } else if (refusal === undefined) {
        toast.error(getToastText(result.error));
      }
      return undefined;
    }
    takeVersion(result.collection, mark, forView);
    if (result.collection.id === collectionIdRef.current) {
      setDetail((current) => withLocalOrder(current, result.collection));
    }
    return result.collection;
  };

  const open = (next: CmsStructureView) =>
    guard(() => {
      clearViewDirty();
      onViewOpen();
      setSession((current) => current + 1);
      setViewCollectionId(collectionIdRef.current);
      setView(next);
    });

  const openSettings = (id: string) =>
    guard(() => {
      clearViewDirty();
      onViewOpen();
      if (id !== collectionId) {
        onOpenCollection(id);
      }
      setSession((current) => current + 1);
      setViewCollectionId(id);
      setView({ type: "settings" });
    });

  // always read again: the count and the references change with item writes
  const requestDelete = async (id: string) => {
    const found = await fetchStructure(id);
    if (found !== undefined) {
      setDeleteTarget(found);
    }
  };

  /** Puts back the order the platform last accepted. */
  const putBackOrder = (id: string) => {
    const accepted = acceptedOrder.current.get(id);
    setDetail((current) =>
      current?.id === id && accepted !== undefined
        ? {
            ...current,
            fields: orderByKeys(
              current.fields,
              accepted.map((field) => field.key)
            ),
          }
        : current
    );
  };

  // the order a move made, kept for its E24 even if another collection opens
  const pendingOrder = useRef<
    { id: string; slug: string; fields: CmsStructureField[] } | undefined
  >(undefined);

  /**
   * E24 with the moved order, through the collection's queue. Its fields are
   * built when its turn comes: the last answered schema (a sheet's Save may
   * have landed meanwhile) in the moved order.
   */
  const sendReorder = async (id: string, isRetry: boolean) => {
    const moved = pendingOrder.current;
    if (structure === undefined || moved === undefined || moved.id !== id) {
      reorderPending.current = undefined;
      return;
    }
    const keys = moved.fields.map((field) => field.key);
    let fields = moved.fields;
    const result = await enqueue(id, (expectedUpdatedAt) => {
      const live = latestDetail.current;
      const base =
        lastSchema.current.get(id) ??
        (live?.id === id ? live.fields : moved.fields);
      fields = orderByKeys(base, keys);
      return structure.updateSchema(id, { fields, expectedUpdatedAt });
    });
    // a later move restarted the pause: that write carries the order
    if (reorderTimer.current !== undefined) {
      return;
    }
    if (isCmsFailure(result)) {
      if (result.error === "rate_limited" && isRetry === false) {
        reorderTimer.current = setTimeout(() => {
          reorderTimer.current = undefined;
          void sendReorder(id, true);
        }, RATE_LIMIT_RETRY_MS);
        return;
      }
      // another person's change while a view held the version: read it
      // again, taking its version, and send the moved order once more
      if (result.error === "conflict" && isRetry === false) {
        const fresh = await fetchStructure(id, true);
        if (fresh !== undefined) {
          void sendReorder(id, true);
          return;
        }
      }
      reorderPending.current = undefined;
      pendingOrder.current = undefined;
      putBackOrder(id);
      const refusal = getRefusal(result.error, "write");
      if (refusal !== undefined) {
        // the line stands; the order put back is already the last accepted
        showLine(refusal);
        return;
      }
      if (result.error === "conflict") {
        toast.error("Changed by someone else");
      } else {
        toast.error(getStructureToastText(result.error, "field"));
      }
      if (result.error === "not_found") {
        refetchCollections();
      }
      // the order put back is the last accepted: E21 again for the rest
      setDetailVersion((version) => version + 1);
      return;
    }
    reorderPending.current = undefined;
    pendingOrder.current = undefined;
    acceptedOrder.current.set(id, fields);
    setDetail((latest) =>
      latest?.id === id ? { ...latest, updatedAt: result.updatedAt } : latest
    );
    written({
      kind: "schema",
      slug: moved.slug,
      removed: [],
      changesCanvas: false,
    });
  };

  /** A move shows at once; E24 goes after a pause, with the latest order. */
  const reorder = (key: string, toIndex: number) => {
    const before = latestDetail.current;
    if (structure === undefined || before === undefined) {
      return;
    }
    const from = before.fields.findIndex((field) => field.key === key);
    if (toIndex < 0 || toIndex >= before.fields.length || toIndex === from) {
      return;
    }
    const fields = moveField(before.fields, key, toIndex);
    latestDetail.current = { ...before, fields };
    setDetail(latestDetail.current);
    pendingOrder.current = { id: before.id, slug: before.slug, fields };
    // the moved row keeps the focus, for the next Alt+Arrow: once the new
    // order is drawn, and only when the move lost it; a later move replaces
    // a refocus still waiting
    if (refocusFrame.current !== undefined) {
      cancelAnimationFrame(refocusFrame.current);
    }
    refocusFrame.current = requestAnimationFrame(() => {
      refocusFrame.current = undefined;
      const active = document.activeElement;
      if (active === null || active === document.body) {
        document
          .querySelector<HTMLElement>(
            `[data-cms-field-row="${CSS.escape(key)}"] button`
          )
          ?.focus();
      }
    });
    reorderPending.current = before.id;
    cancelReorderTimer();
    reorderTimer.current = setTimeout(() => {
      reorderTimer.current = undefined;
      void sendReorder(before.id, false);
    }, REORDER_PAUSE_MS);
  };

  /** A sheet's Save carries the order on screen: no reorder of its own. */
  const enqueueSchema: CmsStructureEnqueue = (id, write) => {
    const carried =
      reorderPending.current === id && reorderTimer.current !== undefined;
    if (carried) {
      cancelReorderTimer();
    }
    return enqueue(id, write).then((result) => {
      if (reorderPending.current === id && reorderTimer.current === undefined) {
        if (carried && isCmsFailure(result)) {
          // the Save that carried the moved order was refused: send it alone
          reorderTimer.current = setTimeout(() => {
            reorderTimer.current = undefined;
            void sendReorder(id, false);
          }, REORDER_PAUSE_MS);
        } else {
          reorderPending.current = undefined;
          pendingOrder.current = undefined;
        }
      }
      return result;
    });
  };

  // a move still in its pause is sent when another collection opens
  const lastCollectionId = useRef(collectionId);
  useEffect(() => {
    const previous = lastCollectionId.current;
    lastCollectionId.current = collectionId;
    if (
      previous !== undefined &&
      previous !== collectionId &&
      reorderPending.current === previous &&
      reorderTimer.current !== undefined
    ) {
      cancelReorderTimer();
      void sendReorder(previous, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId]);

  // an open view holds its collection's version (see `holdVersion`); each
  // view session holds afresh, so a read that waited applies between them
  const heldId =
    view !== undefined && detail?.id === collectionId
      ? collectionId
      : undefined;
  useEffect(
    () => (heldId === undefined ? undefined : holdVersion(heldId)),
    [heldId, session, holdVersion]
  );

  if (structure === undefined) {
    return {
      column: undefined,
      mainView: undefined,
      renderRowMenu: undefined,
      dialogs: null,
      closeView,
      resetView,
    };
  }

  const openDetail =
    detail !== undefined && detail.id === collectionId ? detail : undefined;
  const retryStructure = () => {
    setStructureFailed(false);
    setStructureAttempt((current) => current + 1);
  };
  const cap = getFieldCap(limits?.fields ?? Number.POSITIVE_INFINITY);
  const targets = collections.map(({ id, name }) => ({ id, name }));
  const openFieldKey =
    view?.type === "field" && "key" in view.target
      ? view.target.key
      : undefined;

  const renderFields = (): ReactNode => {
    if (detailFailed === "not_found") {
      return (
        <LineRow data-cms-structure-not-found>
          <Text>Collection not found</Text>
        </LineRow>
      );
    }
    if (detailFailed === "unavailable") {
      return (
        <RefusalLine
          kind="unavailable"
          onRetry={() => setDetailAttempt((current) => current + 1)}
        />
      );
    }
    if (openDetail === undefined) {
      return null;
    }
    return (
      <FieldsList
        fields={openDetail.fields}
        currentKey={openFieldKey}
        cap={cap}
        canManage={canManage}
        onSelect={(key) => {
          if (key !== openFieldKey) {
            open({ type: "field", target: { key } });
          }
        }}
        onReorder={reorder}
      />
    );
  };

  const column: CmsStructureColumn = {
    tab,
    onTabChange: setTab,
    hasFields: collectionId !== undefined,
    canManage,
    add:
      canManage === false ? null : tab === "collections" ? (
        <Tooltip content="New collection" side="bottom">
          <IconButton
            aria-label="New collection"
            // held until E20 has answered once, so the options are the plan's
            disabled={templates === undefined && structureFailed === false}
            onClick={() => guard(() => setIsNewOpen(true))}
          >
            <PlusIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <AddFieldMenu
          disabled={openDetail === undefined || openDetail.fields.length >= cap}
          onAdd={(kind: CmsFieldKind) =>
            open({ type: "field", target: { kind } })
          }
        />
      ),
    fields: (
      <Flex direction="column" css={{ flexGrow: 1, minHeight: 0 }}>
        {renderFields()}
      </Flex>
    ),
  };

  const onCreated = (created: CmsCollectionSummary, type: string) => {
    pendingCreate.current = undefined;
    setIsNewOpen(false);
    written({ kind: "created", collection: created });
    setStructureVersion((current) => current + 1);
    latestGuard.current(() => {
      clearViewDirty();
      setView(undefined);
      onOpenCollection(created.id);
      // a custom collection starts with Name alone: its fields come next
      if (type === CUSTOM_COLLECTION_TYPE) {
        setTab("fields");
      }
    });
  };

  foundCreated.current = onCreated;

  const createCallbacks = {
    onCreated,
    onRefusal: showLine,
    onUnknownOutcome: (pending: CmsPendingCreate) => {
      pendingCreate.current = {
        ...pending,
        knownIds: new Set(collections.map((entry) => entry.id)),
      };
      refetchCollections();
    },
    onLimit: () => setStructureVersion((current) => current + 1),
  };

  const renderMain = (): ReactNode => {
    if (isReady === false) {
      return undefined;
    }
    if (collections.length === 0 && canManage && structureFailed) {
      return <RefusalLine kind="unavailable" onRetry={retryStructure} />;
    }
    if (collections.length === 0 && canManage && templates !== undefined) {
      return (
        <NewCollectionPage
          structure={structure}
          templates={templates}
          limits={limits}
          {...createCallbacks}
        />
      );
    }
    if (
      view === undefined ||
      openDetail === undefined ||
      viewCollectionId !== openDetail.id
    ) {
      return undefined;
    }
    // a view's answer acts on the view only while it is the same session of
    // the same collection; otherwise it updates that collection's data alone
    const viewSession = session;
    const isSameView = () =>
      sessionRef.current === viewSession &&
      collectionIdRef.current === openDetail.id;
    if (view.type === "settings") {
      return (
        <CollectionSettings
          key={`${openDetail.id}:${session}`}
          structure={structure}
          collection={openDetail}
          canManage={canManage}
          enqueue={enqueue}
          reread={() => fetchStructure(openDetail.id, true)}
          onBack={() => guard(closeView)}
          onDirtyChange={reportViewDirty}
          onSaved={(before, after) => {
            setDetail((current) =>
              current?.id === openDetail.id ? { ...current, ...after } : current
            );
            written({
              kind: "settings",
              before: { slug: before.slug, isPublic: before.isPublic },
              after: { slug: after.slug, isPublic: after.isPublic },
            });
          }}
          onDelete={() => void requestDelete(openDetail.id)}
          onRefusal={showLine}
          onNotFound={refetchCollections}
        />
      );
    }
    return (
      <FieldSheet
        key={`${openDetail.id}:${session}`}
        structure={structure}
        collection={openDetail}
        target={view.target}
        targets={targets}
        canManage={canManage}
        enqueue={enqueueSchema}
        reread={() => fetchStructure(openDetail.id, true)}
        readCount={() => fetchStructure(openDetail.id)}
        onBack={() => guard(closeView)}
        onClose={() => {
          if (isSameView()) {
            closeView();
          }
        }}
        onDirtyChange={reportViewDirty}
        onRefusal={showLine}
        onStale={(stale) => {
          if (stale === "structure") {
            setDetailVersion((current) => current + 1);
          } else if (stale === "collections") {
            refetchCollections();
          } else {
            setStructureVersion((current) => current + 1);
          }
        }}
        onSaved={(fields, updatedAt, key) => {
          acceptedOrder.current.set(openDetail.id, fields);
          setDetail((current) =>
            current?.id === openDetail.id
              ? { ...current, fields, updatedAt }
              : current
          );
          if (isSameView()) {
            setSession((current) => current + 1);
            setView({ type: "field", target: { key } });
          }
          written({
            kind: "schema",
            slug: openDetail.slug,
            removed: [],
            changesCanvas: changesCanvas(openDetail.fields, fields),
          });
        }}
        onRemoved={(fields, updatedAt) => {
          const removed = openDetail.fields
            .filter((field) => fields.every((kept) => kept.key !== field.key))
            .map((field) => field.key);
          acceptedOrder.current.set(openDetail.id, fields);
          setDetail((current) =>
            current?.id === openDetail.id
              ? { ...current, fields, updatedAt }
              : current
          );
          if (isSameView()) {
            closeView();
          }
          written({
            kind: "schema",
            slug: openDetail.slug,
            removed,
            changesCanvas: changesCanvas(openDetail.fields, fields),
          });
        }}
      />
    );
  };

  const dialogs = (
    <>
      <NewCollectionDialog
        open={isNewOpen}
        onOpenChange={(isOpen) => {
          // a create of unknown outcome is adopted only while its form is open
          if (isOpen === false) {
            pendingCreate.current = undefined;
          }
          setIsNewOpen(isOpen);
        }}
        structure={structure}
        templates={templates ?? []}
        limits={limits}
        initialType={initial?.newCollectionType}
        onRetryTemplates={
          templates === undefined && structureFailed
            ? retryStructure
            : undefined
        }
        {...createCallbacks}
      />
      <DeleteCollectionDialog
        structure={structure}
        collection={deleteTarget}
        onRefusal={showLine}
        onRefresh={async (id) => {
          const found = await fetchStructure(id);
          if (found !== undefined) {
            setDeleteTarget(found);
          }
        }}
        onNotFound={refetchCollections}
        onOpenChange={(isOpen) => {
          if (isOpen === false) {
            setDeleteTarget(undefined);
          }
        }}
        onDeleted={(id) => {
          const deleted = collections.find((entry) => entry.id === id);
          if (id === collectionId) {
            // its view and editor close; the screen opens the first listed
            closeView();
            onOpenCollection(undefined);
          }
          setStructureVersion((current) => current + 1);
          written({
            kind: "deleted",
            collectionId: id,
            slug: deleted?.slug ?? deleteTarget?.slug ?? "",
          });
        }}
      />
    </>
  );

  const renderRowMenu = (collection: CmsCollectionSummary): ReactNode => {
    const onSettings = () => openSettings(collection.id);
    const onDelete = () => void requestDelete(collection.id);
    const items = canManage
      ? {
          leading: (
            <>
              <DropdownMenuItem onSelect={onSettings}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ),
          trailing: (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={onDelete}>
                Delete
              </DropdownMenuItem>
            </>
          ),
        }
      : { leading: null, trailing: null };
    const actions = renderRowActions?.(collection, items);
    if (actions !== undefined && actions !== null) {
      return actions;
    }
    if (canManage === false) {
      return null;
    }
    return (
      <StructureRowMenu
        collection={collection}
        onSettings={onSettings}
        onDelete={onDelete}
      />
    );
  };

  return {
    column,
    mainView: renderMain(),
    renderRowMenu,
    dialogs,
    closeView,
    resetView,
  };
};
