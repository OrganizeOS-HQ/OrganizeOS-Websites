import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Box,
  Button,
  cssVar,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Flex,
  Grid,
  IconButton,
  InputField,
  ScrollAreaNative,
  Text,
  theme,
  toast,
  Tooltip,
} from "@webstudio-is/design-system";
import { ChevronLeftIcon, EllipsesIcon } from "@webstudio-is/icons";
import {
  emptyItemData,
  differsFromStored,
  getChangedFieldKeys,
  emptyValueFor,
  getFieldErrorText,
  getItemTitle,
  getKeptDifferences,
  getRefusal,
  getTitleField,
  getToastText,
  isItemDirty,
  keepAside,
  slugFollowsTitle,
  slugify,
  toItemData,
  validateItem,
  type CmsKeptValues,
  type CmsRefusal,
} from "./cms-logic";
import {
  getChangedSincePublish,
  getDeleteTitle,
  getListFailureText,
} from "./cms-list-logic";
import { DeleteDialog } from "./delete-dialog";
import {
  isCmsFailure,
  type CmsAccess,
  type CmsCollection,
  type CmsFailure,
  type CmsItem,
  type CmsItemData,
  type CmsRichTextValue,
  type CmsResult,
  type CmsSource,
} from "./cms-source";
import { FieldControl, FieldRow, fieldIds } from "./field-controls";
import { ItemDetails, SIDE_DETAILS_WIDTH } from "./item-details";
import { LineRow, RefusalLine, type CmsLineKind } from "./refusal-line";
import { StatusChip } from "./status-chip";
import { TruncatedText } from "./truncated-text";

/**
 * The fields' column: 448 px of controls, as the builder's own forms are
 * about that wide (spec 4.3: at most 640), plus its padding.
 */
const editorColumnMaxWidth = `calc(${theme.spacing[35]} + 2 * ${theme.spacing[9]})`;

/** Below this header width, Discard changes moves into the Item menu. */
export const COMPACT_HEADER_WIDTH = 600;

type Busy = "save" | "publish" | "discard" | "reload" | "status" | "delete";

/**
 * A write whose answer was lost may have landed (4.3.2). `afterSave`: the
 * write followed a save in the same action, so `sent` is the saved item and
 * nothing set aside before that save is kept.
 */
type Settle = {
  sent: CmsItem;
  afterSave?: boolean;
  /** The values the write sent, when a Save settled some of them. */
  values?: CmsItemData;
};

/**
 * Whether an element is narrower than `width`, kept current on resize. The
 * width is measured as the element is attached, so the first layout drawn
 * is already right; the observer follows later resizes.
 */
const useIsNarrow = (width: number) => {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  useLayoutEffect(() => {
    if (element === null) {
      return;
    }
    // the content box, as the observer's contentRect measures it
    const style = getComputedStyle(element);
    const contentWidth =
      element.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    setIsNarrow(contentWidth < width);
    const observer = new ResizeObserver(([entry]) => {
      setIsNarrow(entry.contentRect.width < width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, width]);
  return [setElement, isNarrow] as const;
};

export const ItemEditor = ({
  source,
  access,
  collection,
  itemId,
  homeUrl,
  focusBack = false,
  refreshKey,
  onBack,
  onDirtyChange,
  onWritten,
  onDeleted,
  onCreated,
  onSchemaStale,
  onBusyChange,
  onRefusal,
  onOpenHome,
  onOpenClassic,
}: {
  source: CmsSource;
  access: CmsAccess;
  collection: CmsCollection;
  /** null: a new item. */
  itemId: string | null;
  homeUrl?: string;
  /** Opened from the list: the Back button takes the focus. */
  focusBack?: boolean;
  /**
   * Changes on each reopen and after each write in the classic frame: a
   * clean editor with no write in flight reads its item again (4.7).
   */
  refreshKey: number;
  /** The root runs the unsaved guard before leaving. */
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
  /** After every write: the lists refetch and the canvas invalidates (4.7). */
  onWritten: (item?: CmsItem) => void;
  /** After the editor's Delete (Task 19): the editor closes, the lists refetch. */
  onDeleted: () => void;
  onCreated: (item: CmsItem) => void;
  /**
   * A write answered `invalid` with no field: the open collection's fields
   * are fetched again before the toast.
   */
  onSchemaStale: () => Promise<void>;
  /**
   * Save, Publish, Discard changes, Unpublish, Archive or Restore runs:
   * every call it makes and the read after. `stay`: it ended with an error
   * the editor shows, so what waited on it is dropped.
   */
  onBusyChange?: (busy: boolean, stay?: boolean) => void;
  /**
   * A call answered `unauthorized` or `mfa_required` (any call), or
   * `forbidden` or `plan` on the item's load: the screen shows the line
   * and hides the view, which keeps this editor and its edits.
   */
  onRefusal: (refusal: CmsRefusal) => void;
  /** `unauthorized`: the guard, then this tab home (4.3.4). */
  onOpenHome?: () => void;
  onOpenClassic?: () => void;
}) => {
  const { fields } = collection;
  const titleField = getTitleField(fields);
  const canEdit = access.canEdit;

  const [item, setItem] = useState<CmsItem | null | undefined>(undefined);
  // The published copy while the item has staged changes (W3-D5): from E4,
  // or the baseline a first staged save replaced; null after any answer
  // with nothing staged. Write answers carry none.
  const [live, setLive] = useState<CmsItem["live"]>(null);
  const [values, setValues] = useState<CmsItemData>({});
  const [slug, setSlug] = useState("");
  const [follows, setFollows] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** The platform's version moved past ours: Reload is the way on. */
  const [conflict, setConflict] = useState(false);
  const [kept, setKept] = useState<CmsKeptValues | undefined>(undefined);
  const [busy, setBusy] = useState<Busy | undefined>(undefined);
  const [line, setLine] = useState<
    { kind: CmsLineKind; retry?: () => void } | undefined
  >(undefined);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // The fields whose value is still being written (an upload in flight):
  // Save and Publish wait, so no write leaves a late value out.
  const [busyFields, setBusyFields] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  // Rich text reads its value once: it remounts when values are replaced.
  const [epoch, setEpoch] = useState(0);
  const [fieldEpochs, setFieldEpochs] = useState<Record<string, number>>({});
  // One per new item's editor, sent with every E6 until one succeeds; a new
  // one after E6 answers not_found.
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const backRef = useRef<HTMLButtonElement>(null);
  const itemMenuRef = useRef<HTMLButtonElement>(null);
  // Save, Publish, Discard changes, Unpublish, Archive or Restore, from its
  // first call to its last answer
  const [isChainRunning, setIsChainRunning] = useState(false);
  // the running chain ended with an error the editor shows
  const chainStays = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // what had the focus when the Discard changes dialog opened
  const discardOpener = useRef<Element | null>(null);
  // Per reference field, its chosen ids whose items E5 no longer finds.
  const unresolved = useRef<Record<string, readonly string[]>>({});
  // Discard changes or Delete chosen in the Item menu: its dialog takes the
  // focus.
  const dialogChosen = useRef(false);
  const [setHeader, isCompact] = useIsNarrow(COMPACT_HEADER_WIDTH);
  const [setBody, isBodyNarrow] = useIsNarrow(SIDE_DETAILS_WIDTH);

  const isNew = item === null;
  const baseline = useMemo(
    () =>
      item === undefined || item === null
        ? emptyItemData(fields)
        : { ...emptyItemData(fields), ...item.data },
    [item, fields]
  );
  const baselineSlug = item?.slug ?? "";
  const keptDifferences = getKeptDifferences({ fields, kept, values, slug });
  // Values set aside by Reload count as unsaved until saved or discarded.
  const isDirty =
    item !== undefined &&
    (isItemDirty({ fields, baseline, values, baselineSlug, slug }) ||
      keptDifferences.length > 0);

  const applyItem = useCallback(
    (next: CmsItem | null) => {
      const data =
        next === null
          ? emptyItemData(fields)
          : { ...emptyItemData(fields), ...structuredClone(next.data) };
      setItem(next);
      setValues(data);
      setSlug(next?.slug ?? "");
      setFollows(
        slugFollowsTitle({
          isNew: next === null,
          slug: next?.slug ?? "",
          title: getItemTitle(data, fields),
        })
      );
      setErrors({});
      setConflict(false);
      setEpoch((current) => current + 1);
    },
    [fields]
  );

  const loadedId = useRef<string | null | undefined>(undefined);
  // the latest callback: a new one never restarts the item's load
  const onRefusalRef = useRef(onRefusal);
  onRefusalRef.current = onRefusal;
  // the latest fields: a refetch of the fields never restarts the item's load
  const applyItemRef = useRef(applyItem);
  applyItemRef.current = applyItem;
  useEffect(() => {
    if (loadedId.current === itemId) {
      return;
    }
    loadedId.current = itemId;
    if (itemId === null) {
      applyItemRef.current(null);
      return;
    }
    let isCurrent = true;
    void source.getItem(collection.id, itemId).then((result) => {
      if (isCurrent === false) {
        return;
      }
      if (isCmsFailure(result)) {
        const refusal = getRefusal(result.error, "load");
        if (refusal !== undefined) {
          onRefusalRef.current(refusal);
        }
        // the editor's own line is its load's: the screen's line, if any,
        // goes when Retry there succeeds, and this one stays for its Retry
        const kind = result.error === "not_found" ? "not_found" : "unavailable";
        setLine({
          kind,
          retry: () => {
            loadedId.current = undefined;
            setLine(undefined);
            setLoadAttempt((current) => current + 1);
          },
        });
        return;
      }
      applyItemRef.current(result.item);
      setLive(result.item.live);
    });
    return () => {
      isCurrent = false;
    };
  }, [source, collection.id, itemId, loadAttempt]);

  // What a refetch's answer is checked against when it arrives.
  const latest = useRef({ item, isDirty, busy });
  latest.current = { item, isDirty, busy };
  const lastRefreshKey = useRef(refreshKey);
  const refreshRequest = useRef(0);
  useEffect(() => {
    if (refreshKey === lastRefreshKey.current) {
      return;
    }
    lastRefreshKey.current = refreshKey;
    const requested = latest.current;
    // unsaved edits stay (4.7); a new item has nothing to read
    if (
      requested.item === undefined ||
      requested.item === null ||
      requested.isDirty ||
      requested.busy !== undefined
    ) {
      return;
    }
    const itemSent = requested.item;
    refreshRequest.current += 1;
    const request = refreshRequest.current;
    void source
      .getItem(collection.id, itemSent.id)
      .catch((): CmsResult<{ item: CmsItem }> => ({ error: "unavailable" }))
      .then((result) => {
        const now = latest.current;
        // a later refetch, a write, or an edit since: this answer is dropped
        if (
          request !== refreshRequest.current ||
          now.item !== itemSent ||
          now.isDirty ||
          now.busy !== undefined
        ) {
          return;
        }
        if (isCmsFailure(result)) {
          // a failure changes nothing on screen but a refusal's line
          const refusal = getRefusal(result.error, "load");
          if (refusal !== undefined) {
            onRefusalRef.current(refusal);
          }
          return;
        }
        setKept(undefined);
        applyItem(result.item);
        setLive(result.item.live);
      });
  }, [refreshKey, source, collection.id, applyItem]);

  // A create answered after this editor closed opens nothing.
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // on open only: a later prop change never moves the focus
  const focusBackOnOpen = useRef(focusBack);
  useEffect(() => {
    if (focusBackOnOpen.current) {
      backRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(isChainRunning, chainStays.current);
    chainStays.current = false;
  }, [isChainRunning, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  /**
   * An unknown outcome (4.3.2): read the item before the buttons enable
   * again. The same version: nothing landed. Another: it becomes the
   * baseline, with the person's values kept aside, so a write that landed
   * leaves the editor clean and one that did not shows "Use my edit".
   */
  const settle = async ({
    sent,
    afterSave = false,
    values: sentValues,
  }: Settle) => {
    setBusy("reload");
    let result: CmsResult<{ item: CmsItem }>;
    try {
      result = await source.getItem(collection.id, sent.id);
    } catch {
      result = { error: "unavailable" };
    } finally {
      setBusy(undefined);
    }
    if (isCmsFailure(result)) {
      // Reload is the way on; a refusal is answered as on a write, so the
      // view stays unless the session itself needs the person
      setConflict(true);
      const refusal = getRefusal(result.error, "write");
      if (refusal !== undefined) {
        onRefusal(refusal);
      } else if (result.error === "forbidden" || result.error === "plan") {
        toast.error(getToastText(result.error));
      }
      return;
    }
    if (result.item.updatedAt === sent.updatedAt) {
      toast.error(getToastText("unavailable"));
      return;
    }
    setKept(
      afterSave
        ? keepAside({
            fields,
            kept: undefined,
            baseline: { ...emptyItemData(fields), ...sent.data },
            baselineSlug: sent.slug,
            values: sentValues ?? values,
            slug,
          })
        : keepAside({
            fields,
            kept,
            baseline,
            baselineSlug,
            values: sentValues ?? values,
            slug,
          })
    );
    applyItem(result.item);
    setLive(result.item.live);
    onWritten(result.item);
  };

  /** Answers the read an unknown outcome runs, for the chain to wait on. */
  const fail = (
    failure: CmsFailure,
    settleWith?: Settle,
    on: "load" | "write" = "write"
  ): Promise<void> | undefined => {
    if (failure.error === "conflict") {
      setConflict(true);
      return;
    }
    // the address clash never carries a field (5.7)
    if (failure.error === "slug_taken") {
      setErrors((current) => ({ ...current, slug: "Address in use" }));
      return;
    }
    // a field the editor draws, or the address, shows its error in place
    const isDrawnField =
      failure.field === "slug" ||
      fields.some((field) => field.key === failure.field);
    if (failure.error === "invalid" && isDrawnField === false) {
      // no write until the fields are current
      setBusy("reload");
      void onSchemaStale()
        .catch(() => undefined)
        .finally(() => {
          setBusy(undefined);
          toast.error(getToastText(failure.error));
        });
      return;
    }
    // the door names no field: each reference holding an item E5 no longer
    // finds is marked, and with none to name it is a toast
    if (failure.error === "reference_invalid" && failure.field === undefined) {
      const text = getToastText(failure.error);
      const keys = fields
        .filter(
          (field) =>
            (field.kind === "reference" || field.kind === "multireference") &&
            (unresolved.current[field.key]?.length ?? 0) > 0
        )
        .map((field) => field.key);
      if (keys.length === 0) {
        toast.error(text);
        return;
      }
      setErrors((current) => ({
        ...current,
        ...Object.fromEntries(keys.map((key) => [key, text])),
      }));
      return;
    }
    const fieldText = getFieldErrorText(failure.error);
    const fieldKey = failure.field;
    if (fieldText !== undefined && fieldKey !== undefined) {
      setErrors((current) => ({ ...current, [fieldKey]: fieldText }));
      return;
    }
    const refusal = getRefusal(failure.error, on);
    if (refusal !== undefined) {
      onRefusal(refusal);
      return;
    }
    if (failure.error === "unavailable" && settleWith !== undefined) {
      return settle(settleWith);
    }
    toast.error(getToastText(failure.error));
  };

  /**
   * E6's replay (200): the item the first attempt made becomes the baseline
   * and version, and the person's values and address stay, so whatever
   * differs is saved by the next E7.
   */
  const adoptVersion = (next: CmsItem) => {
    setItem(next);
    setErrors({});
    setConflict(false);
  };

  const write = async (
    kind: Busy,
    run: () => Promise<CmsResult<{ item: CmsItem; created?: boolean }>>,
    settleWith?: Settle
  ) => {
    // the copy a first staged save replaces is the live one
    const wasStaged = item?.hasStagedChanges ?? false;
    const replaced = { slug: baselineSlug, data: baseline };
    setBusy(kind);
    let result: CmsResult<{ item: CmsItem; created?: boolean }>;
    try {
      result = await run();
    } catch {
      // a source that throws reads as a lost answer
      result = { error: "unavailable" };
    } finally {
      setBusy(undefined);
    }
    if (isCmsFailure(result)) {
      await fail(result, settleWith);
      return;
    }
    setLine(undefined);
    if (result.item.hasStagedChanges === false) {
      setLive(null);
    } else if (wasStaged === false) {
      setLive(replaced);
    }
    if (result.created === false) {
      adoptVersion(result.item);
    } else {
      applyItem(result.item);
    }
    onWritten(result.item);
    return result.item;
  };

  /**
   * Saves the person's values over `from` (null: a new item). Answers the
   * saved item, and whether the values still differ from it, which only an
   * E6 replay leaves.
   */
  const saveFrom = async (
    from: CmsItem | null,
    drafted: CmsItemData = values
  ): Promise<
    { saved: CmsItem; differs: boolean; values: CmsItemData } | undefined
  > => {
    const clientErrors = validateItem({
      fields,
      values: drafted,
      slug,
      isNew: from === null,
    });
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      return;
    }
    setBusy("save");
    const sent = await settleRichText(drafted);
    const data = toItemData(fields, sent);
    let replayed = false;
    const saved = await write(
      "save",
      async () => {
        if (from !== null) {
          return source.updateItem(collection.id, from.id, {
            slug: slug === from.slug ? undefined : slug,
            data,
            expectedUpdatedAt: from.updatedAt,
          });
        }
        const result = await source.createItem(collection.id, {
          clientId,
          slug: slug === "" ? undefined : slug,
          data,
        });
        // the clientId made nothing that still exists: the next Save is a
        // new create
        if (isCmsFailure(result)) {
          if (result.error === "not_found") {
            setClientId(crypto.randomUUID());
          }
        } else {
          replayed = result.created === false;
        }
        return result;
      },
      // E6's repeat is the same clientId; E7 reads the item back
      from === null ? undefined : { sent: from, values: sent }
    );
    if (saved === undefined) {
      return;
    }
    // the "Use my edit" buttons go on the next Save
    setKept(undefined);
    if (from === null) {
      loadedId.current = saved.id;
      if (isMounted.current) {
        onCreated(saved);
      }
    }
    const differs =
      replayed &&
      differsFromStored({
        fields,
        stored: { ...emptyItemData(fields), ...saved.data },
        values: sent,
        storedSlug: saved.slug,
        slug,
      });
    // a replay that stored the person's values: they take its stored form,
    // so the editor is clean
    if (replayed && differs === false) {
      applyItem(saved);
    }
    return { saved, differs, values: sent };
  };

  /**
   * Each changed rich-text field whose value would reopen read-only is sent
   * as the editor's own write of it when that write holds the same content
   * (`settleRichTextHtml`); every other value is sent as drafted.
   */
  const settleRichText = async (drafted: CmsItemData) => {
    const changed = getChangedFieldKeys(fields, baseline, drafted);
    const richText = fields.filter(
      (field) => field.kind === "richtext" && changed.includes(field.key)
    );
    if (richText.length === 0) {
      return drafted;
    }
    try {
      const { settleRichTextHtml } = await import("./rich-text-html");
      let sent = drafted;
      for (const field of richText) {
        const value = drafted[field.key];
        if (
          typeof value !== "object" ||
          value === null ||
          typeof (value as CmsRichTextValue).html !== "string"
        ) {
          continue;
        }
        const settled = settleRichTextHtml((value as CmsRichTextValue).html);
        if (settled.outcome === "settled") {
          sent = {
            ...sent,
            [field.key]: { ...(value as CmsRichTextValue), html: settled.html },
          };
        }
      }
      return sent;
    } catch {
      return drafted;
    }
  };

  /** Runs one chain of calls; Back and the other exits wait for its end. */
  const runChain = async (run: () => Promise<void>) => {
    chainStays.current = false;
    setIsChainRunning(true);
    try {
      await run();
    } finally {
      if (isMounted.current) {
        setIsChainRunning(false);
      }
    }
  };

  const save = () =>
    runChain(async () => {
      if (item === undefined) {
        return;
      }
      await saveFrom(item);
    });

  const publish = () => runChain(publishNow);

  const publishNow = async () => {
    let current = item;
    if (current === undefined) {
      return;
    }
    const afterSave = current === null || isDirty;
    // With unsaved edits it saves, then publishes: two calls, each locked.
    if (current === null || isDirty) {
      const first = await saveFrom(current);
      if (first === undefined) {
        return;
      }
      current = first.saved;
      // an E6 replay of older values: they are saved before publishing
      if (first.differs) {
        const second = await saveFrom(current, first.values);
        if (second === undefined) {
          return;
        }
        current = second.saved;
      }
    }
    const target = current;
    await write(
      "publish",
      () =>
        source.publishItem(collection.id, target.id, {
          expectedUpdatedAt: target.updatedAt,
        }),
      { sent: target, afterSave }
    );
  };

  const discard = () => runChain(discardNow);

  const discardNow = async () => {
    setConfirmDiscard(false);
    if (item === undefined || item === null) {
      return;
    }
    const discarded = await write(
      "discard",
      () =>
        source.discardItemChanges(collection.id, item.id, {
          expectedUpdatedAt: item.updatedAt,
        }),
      { sent: item }
    );
    if (discarded !== undefined) {
      setKept(undefined);
    }
  };

  /**
   * After a status change: the item is read, and becomes the baseline and
   * version with nothing kept aside, since the person's values were saved.
   * A failed read shows the load line and its Retry.
   */
  const readAfterStatus = async (target: CmsItem) => {
    setBusy("reload");
    let result: CmsResult<{ item: CmsItem }>;
    try {
      result = await source.getItem(collection.id, target.id);
    } catch {
      result = { error: "unavailable" };
    } finally {
      setBusy(undefined);
    }
    if (isCmsFailure(result)) {
      const refusal = getRefusal(result.error, "write");
      if (refusal !== undefined) {
        onRefusal(refusal);
        return;
      }
      // Retry reads the item as Reload does: an edit made meanwhile is
      // kept aside
      setLine({
        kind: "unavailable",
        retry: () => {
          void reloadRef.current().then((read) => {
            if (read && isMounted.current) {
              setLine(undefined);
            }
          });
        },
      });
      return;
    }
    setLine(undefined);
    setKept(undefined);
    applyItem(result.item);
    setLive(result.item.live);
  };

  /**
   * Unpublish, Archive and Restore (5.2.1): Save first with unsaved edits,
   * stopping on its failure; then E11; then the item is read.
   */
  const changeStatus = async (status: "draft" | "archived") => {
    if (item === undefined || item === null) {
      return;
    }
    const from = item;
    await runChain(() => runStatus(status, from));
  };

  const runStatus = async (status: "draft" | "archived", from: CmsItem) => {
    let current = from;
    if (isDirty) {
      const first = await saveFrom(current);
      if (first === undefined) {
        return;
      }
      current = first.saved;
    }
    const target = current;
    setBusy("status");
    let result: CmsResult<{ changed: string[] }>;
    try {
      result = await source.setItemsStatus(collection.id, {
        ids: [target.id],
        status,
      });
    } catch {
      result = { error: "unavailable" };
    } finally {
      setBusy(undefined);
    }
    if (isCmsFailure(result)) {
      const refusal = getRefusal(result.error, "write");
      if (refusal !== undefined) {
        onRefusal(refusal);
        return;
      }
      if (result.error === "unavailable") {
        // the outcome is unknown: what the item reads is the truth
        onWritten();
        await readAfterStatus(target);
        return;
      }
      if (result.error === "slug_taken") {
        if (isMounted.current === false) {
          toast.error(getListFailureText("status", result.error));
          return;
        }
        setErrors((current) => ({ ...current, slug: "Address in use" }));
        chainStays.current = true;
        return;
      }
      toast.error(
        result.error === "not_found"
          ? "Item not found"
          : getListFailureText("status", result.error)
      );
      return;
    }
    onWritten();
    await readAfterStatus(target);
  };

  /** Delete (5.2.1): E12; the editor closes without the unsaved guard. */
  const remove = async () => {
    if (item === undefined || item === null) {
      return;
    }
    const target = item;
    setBusy("delete");
    let result: CmsResult<{ deleted: string[] }>;
    try {
      result = await source.deleteItems(collection.id, { ids: [target.id] });
    } catch {
      result = { error: "unavailable" };
    }
    if (isCmsFailure(result) && result.error === "unavailable") {
      // the outcome is unknown: an item that is gone was deleted
      let read: CmsResult<{ item: CmsItem }>;
      try {
        read = await source.getItem(collection.id, target.id);
      } catch {
        read = { error: "unavailable" };
      }
      result =
        isCmsFailure(read) && read.error === "not_found"
          ? { deleted: [target.id] }
          : result;
    }
    setBusy(undefined);
    setConfirmDelete(false);
    if (isCmsFailure(result) === false) {
      // a 200 without the id: it was already gone, so the editor closes too
      onDeleted();
      return;
    }
    const refusal = getRefusal(result.error, "write");
    if (refusal !== undefined) {
      onRefusal(refusal);
      return;
    }
    toast.error(
      result.error === "not_found"
        ? "Item not found"
        : getListFailureText("delete", result.error)
    );
  };

  /**
   * Reload keeps the person's unsaved values aside (4.3.2). Answers whether
   * the item was read.
   */
  const reload = async (): Promise<boolean> => {
    if (item === undefined || item === null) {
      return false;
    }
    setBusy("reload");
    let result: CmsResult<{ item: CmsItem }>;
    try {
      result = await source.getItem(collection.id, item.id);
    } catch {
      result = { error: "unavailable" };
    } finally {
      setBusy(undefined);
    }
    if (isCmsFailure(result)) {
      // the editor holds the person's values: refused as a write is, so the
      // view and the conflict line with its Reload stay
      void fail(result);
      return false;
    }
    setKept(keepAside({ fields, kept, baseline, baselineSlug, values, slug }));
    applyItem(result.item);
    setLive(result.item.live);
    return true;
  };
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const setField = (key: string, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors(({ [key]: _, ...rest }) => rest);
    if (key === titleField?.key && follows) {
      setSlug(typeof value === "string" ? slugify(value) : "");
    }
  };

  const restoreMine = (key: string) => {
    // a write's answer replaces the values: nothing is restored under it
    if (kept === undefined || busy !== undefined) {
      return;
    }
    if (key === "slug") {
      if (kept.slug !== undefined) {
        setSlug(kept.slug);
        setFollows(false);
      }
      return;
    }
    setValues((current) => ({
      ...current,
      [key]: structuredClone(kept.values[key]),
    }));
    setFieldEpochs((current) => ({
      ...current,
      [key]: (current[key] ?? 0) + 1,
    }));
  };

  const refusalLine = line !== undefined && (
    <RefusalLine
      kind={line.kind}
      homeUrl={homeUrl}
      onOpenHome={onOpenHome}
      onRetry={line.retry}
    />
  );

  if (item === undefined) {
    return (
      <Flex direction="column" css={{ height: "100%" }}>
        <EditorHeader
          headerRef={setHeader}
          backRef={backRef}
          collectionName={collection.name}
          itemName={undefined}
          onBack={onBack}
          chip={undefined}
          actions={null}
        />
        {refusalLine}
      </Flex>
    );
  }

  const savedTitle = isNew ? "" : getItemTitle(baseline, fields);
  const itemName = isNew
    ? getItemTitle(values, fields) ||
      `New ${collection.singularName.toLowerCase()}`
    : savedTitle || baselineSlug;
  const status = item?.status ?? "draft";
  const hasStagedChanges = item?.hasStagedChanges ?? false;
  const isPublishLabel = isNew || status !== "published";
  const nothingToPublish =
    isNew === false &&
    status === "published" &&
    hasStagedChanges === false &&
    isDirty === false;
  const disabled = canEdit === false || busy !== undefined;
  const isFieldBusy = busyFields.size > 0;
  const showConflictLine = conflict || keptDifferences.length > 0;
  // the dots show only while the item has staged changes (5.2.3)
  const changedSince =
    item !== null && item.hasStagedChanges
      ? getChangedSincePublish({ fields, live, values, slug })
      : { keys: new Set<string>(), address: false };
  const details = item === null ? null : <ItemDetails item={item} />;
  const detailsBeside = details !== null && isBodyNarrow === false;

  const isBusy = busy !== undefined;
  const menuItems = [
    isCompact && hasStagedChanges ? "discard" : undefined,
    access.canPublish && status === "published" ? "unpublish" : undefined,
    status !== "archived" ? "archive" : undefined,
    status === "archived" ? "restore" : undefined,
  ].filter((entry) => entry !== undefined);
  const actions = (
    <Flex align="center" gap="2" css={{ flexShrink: 0 }}>
      {canEdit && hasStagedChanges && isCompact === false && (
        <Button
          color="ghost"
          disabled={isBusy}
          state={busy === "discard" ? "pending" : undefined}
          onClick={() => setConfirmDiscard(true)}
        >
          Discard changes
        </Button>
      )}
      {canEdit && (
        <Button
          color={access.canPublish ? "neutral" : "primary"}
          disabled={
            (isDirty === false && isNew === false) ||
            busy !== undefined ||
            isFieldBusy
          }
          state={busy === "save" ? "pending" : undefined}
          onClick={() => void save()}
        >
          Save
        </Button>
      )}
      {canEdit && access.canPublish && (
        <Button
          color="primary"
          disabled={nothingToPublish || busy !== undefined || isFieldBusy}
          state={busy === "publish" ? "pending" : undefined}
          onClick={() => void publish()}
        >
          {isPublishLabel ? "Publish" : "Publish changes"}
        </Button>
      )}
      {canEdit && isNew === false && (
        <DropdownMenu modal={false}>
          <Tooltip content="Item menu" side="bottom">
            <DropdownMenuTrigger asChild>
              <IconButton ref={itemMenuRef} aria-label="Item menu">
                <EllipsesIcon />
              </IconButton>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={(event) => {
              if (dialogChosen.current) {
                dialogChosen.current = false;
                event.preventDefault();
              }
            }}
          >
            {menuItems.includes("discard") && (
              <DropdownMenuItem
                disabled={isBusy}
                onSelect={() => {
                  dialogChosen.current = true;
                  setConfirmDiscard(true);
                }}
              >
                Discard changes
              </DropdownMenuItem>
            )}
            {menuItems.includes("unpublish") && (
              <DropdownMenuItem
                disabled={isBusy || isFieldBusy}
                onSelect={() => void changeStatus("draft")}
              >
                Unpublish
              </DropdownMenuItem>
            )}
            {menuItems.includes("archive") && (
              <DropdownMenuItem
                disabled={isBusy || isFieldBusy}
                onSelect={() => void changeStatus("archived")}
              >
                Archive
              </DropdownMenuItem>
            )}
            {menuItems.includes("restore") && (
              <DropdownMenuItem
                disabled={isBusy || isFieldBusy}
                onSelect={() => void changeStatus("draft")}
              >
                Restore
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              disabled={isBusy}
              onSelect={() => {
                dialogChosen.current = true;
                setConfirmDelete(true);
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </Flex>
  );

  return (
    <Flex
      direction="column"
      css={{ height: "100%", minWidth: 0 }}
      data-cms-editor
    >
      <EditorHeader
        headerRef={setHeader}
        backRef={backRef}
        collectionName={collection.name}
        itemName={itemName}
        chip={{ status, hasStagedChanges }}
        onBack={onBack}
        actions={actions}
      />
      {showConflictLine && (
        <LineRow data-cms-conflict>
          <Text color="destructive">Changed by someone else</Text>
          {conflict && (
            <Button
              color="neutral"
              state={busy === "reload" ? "pending" : undefined}
              disabled={
                (busy !== undefined && busy !== "reload") || isFieldBusy
              }
              onClick={() => void reload()}
            >
              Reload
            </Button>
          )}
        </LineRow>
      )}
      {refusalLine}
      <ScrollAreaNative css={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Box
          ref={setBody}
          data-cms-editor-body
          css={
            detailsBeside
              ? {
                  display: "grid",
                  // the fields column stays centred while the details,
                  // top-aligned beside it, have their width; narrower, the
                  // fields move left to make room
                  gridTemplateColumns: `minmax(0, 1fr) ${editorColumnMaxWidth} minmax(${theme.spacing[30]}, 1fr)`,
                  alignItems: "start",
                }
              : undefined
          }
        >
          <Box
            data-cms-editor-fields
            css={{
              maxWidth: editorColumnMaxWidth,
              marginInline: "auto",
              gridColumn: detailsBeside ? 2 : undefined,
              width: detailsBeside ? "100%" : undefined,
              paddingInline: theme.spacing[9],
              paddingBlock: theme.spacing[11],
            }}
          >
            {/* one column that never grows past the box for a long value */}
            <Grid gap="2" css={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
              {fields.map((field) => {
                const id = `cms-field-${field.key}`;
                return (
                  <FieldRow
                    key={field.key}
                    id={id}
                    label={field.label}
                    help={field.help}
                    required={field.required}
                    inline={field.kind === "switch"}
                    error={errors[field.key]}
                    changed={changedSince.keys.has(field.key)}
                    onUseMine={
                      canEdit && keptDifferences.includes(field.key)
                        ? () => restoreMine(field.key)
                        : undefined
                    }
                    useMineDisabled={busy !== undefined || isFieldBusy}
                  >
                    <FieldControl
                      id={id}
                      remountKey={`${epoch}:${fieldEpochs[field.key] ?? 0}`}
                      field={field}
                      // a field added since the item loaded shows empty
                      value={
                        field.key in values
                          ? values[field.key]
                          : emptyValueFor(field.kind)
                      }
                      source={source}
                      disabled={disabled}
                      invalid={errors[field.key] !== undefined}
                      onChange={(value) => setField(field.key, value)}
                      onError={(error) =>
                        setErrors(({ [field.key]: _, ...rest }) =>
                          error === undefined
                            ? rest
                            : { ...rest, [field.key]: error }
                        )
                      }
                      onBusyChange={(isBusy) =>
                        setBusyFields((current) => {
                          const next = new Set(current);
                          if (isBusy) {
                            next.add(field.key);
                          } else {
                            next.delete(field.key);
                          }
                          return next;
                        })
                      }
                      onRefusal={onRefusal}
                      onOpenClassic={onOpenClassic}
                      onUnresolvedChange={(ids) => {
                        unresolved.current[field.key] = ids;
                      }}
                    />
                  </FieldRow>
                );
              })}
              <FieldRow
                id="cms-field-slug"
                label="Address"
                error={errors.slug}
                changed={changedSince.address}
                onUseMine={
                  canEdit && keptDifferences.includes("slug")
                    ? () => restoreMine("slug")
                    : undefined
                }
                useMineDisabled={busy !== undefined || isFieldBusy}
              >
                <InputField
                  id="cms-field-slug"
                  value={slug}
                  disabled={disabled}
                  color={errors.slug === undefined ? undefined : "error"}
                  aria-invalid={errors.slug !== undefined || undefined}
                  aria-describedby={
                    errors.slug === undefined
                      ? undefined
                      : fieldIds("cms-field-slug").error
                  }
                  maxLength={63}
                  onChange={(event) => {
                    setSlug(event.currentTarget.value);
                    setFollows(false);
                    setErrors(({ slug: _, ...rest }) => rest);
                  }}
                />
              </FieldRow>
              {details !== null && detailsBeside === false && details}
            </Grid>
          </Box>
          {detailsBeside && (
            <Box
              css={{
                gridColumn: 3,
                maxWidth: theme.spacing[30],
                minWidth: 0,
                paddingBlock: theme.spacing[11],
                paddingInlineEnd: theme.spacing[9],
              }}
            >
              {details}
            </Box>
          )}
        </Box>
      </ScrollAreaNative>
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent
          width={420}
          aria-describedby={undefined}
          // the safe choice takes the first focus; Discard stays right
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            discardOpener.current = document.activeElement;
            cancelRef.current?.focus();
          }}
          // the focus goes back to its opener, else to the Item menu
          onCloseAutoFocus={(event) => {
            const element = discardOpener.current;
            discardOpener.current = null;
            event.preventDefault();
            if (
              element instanceof HTMLElement &&
              element !== document.body &&
              element.isConnected
            ) {
              element.focus();
            } else {
              itemMenuRef.current?.focus();
            }
          }}
        >
          <DialogActions>
            <Button color="destructive" onClick={() => void discard()}>
              Discard
            </Button>
            <DialogClose>
              <Button ref={cancelRef} color="ghost">
                Cancel
              </Button>
            </DialogClose>
          </DialogActions>
          {/* last in the DOM, so the close button is last in tab order */}
          <DialogTitle>Discard staged changes?</DialogTitle>
        </DialogContent>
      </Dialog>
      <DeleteDialog
        open={confirmDelete}
        title={getDeleteTitle(1, collection)}
        busy={busy === "delete"}
        onCancel={() => setConfirmDelete(false)}
        onFocusLost={() => itemMenuRef.current?.focus()}
        onConfirm={() => void remove()}
      />
    </Flex>
  );
};

/**
 * Back, the crumb "{Collection} / {Item}" and the chip, then the actions.
 * The collection part truncates first and takes at most 40%.
 */
const EditorHeader = ({
  headerRef,
  backRef,
  collectionName,
  itemName,
  chip,
  actions,
  onBack,
}: {
  headerRef: (element: HTMLElement | null) => void;
  backRef: RefObject<HTMLButtonElement>;
  collectionName: string;
  itemName: string | undefined;
  chip: Parameters<typeof StatusChip>[0] | undefined;
  actions: JSX.Element | null;
  onBack: () => void;
}) => (
  <Flex
    ref={headerRef}
    align="center"
    gap="2"
    data-cms-editor-header
    css={{
      height: theme.spacing[15],
      flexShrink: 0,
      paddingLeft: theme.spacing[5],
      paddingRight: theme.panel.paddingInline,
      borderBottom: `1px solid ${cssVar("--border-default")}`,
    }}
  >
    <Tooltip content="Back" side="bottom">
      <IconButton ref={backRef} aria-label="Back" onClick={onBack}>
        <ChevronLeftIcon />
      </IconButton>
    </Tooltip>
    <Flex
      align="center"
      gap="1"
      data-cms-crumb
      css={{ minWidth: 0, flexGrow: 1 }}
    >
      {/* gives way first, down to 48 px, and never takes over 40% */}
      <TruncatedText
        variant="titles"
        css={{
          flex: "0 4 auto",
          maxWidth: "40%",
          minWidth: itemName === undefined ? 0 : theme.spacing[17],
        }}
      >
        {collectionName}
      </TruncatedText>
      {itemName !== undefined && (
        <>
          <Text variant="titles" css={{ flexShrink: 0 }}>
            /
          </Text>
          <TruncatedText variant="titles" css={{ flex: "0 1 auto" }}>
            {itemName}
          </TruncatedText>
        </>
      )}
      {chip !== undefined && (
        <Box
          css={{ display: "flex", flexShrink: 0, marginLeft: theme.spacing[3] }}
        >
          <StatusChip {...chip} />
        </Box>
      )}
    </Flex>
    {actions}
  </Flex>
);
