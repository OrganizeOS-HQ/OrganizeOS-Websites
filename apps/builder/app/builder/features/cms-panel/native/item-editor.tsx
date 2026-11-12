import {
  useCallback,
  useEffect,
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
  isCmsFailure,
  type CmsAccess,
  type CmsCollection,
  type CmsFailure,
  type CmsItem,
  type CmsItemData,
  type CmsResult,
  type CmsSource,
} from "./cms-source";
import { FieldControl, FieldRow, fieldIds } from "./field-controls";
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

type Busy = "save" | "publish" | "discard" | "reload";

/**
 * A write whose answer was lost may have landed (4.3.2). `afterSave`: the
 * write followed a save in the same action, so `sent` is the saved item and
 * nothing set aside before that save is kept.
 */
type Settle = { sent: CmsItem; afterSave?: boolean };

/** Whether an element is narrower than `width`, kept current on resize. */
const useIsNarrow = (width: number) => {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    if (element === null) {
      return;
    }
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
  onCreated,
  onSchemaStale,
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
  onWritten: (item: CmsItem) => void;
  onCreated: (item: CmsItem) => void;
  /**
   * A write answered `invalid` with no field: the open collection's fields
   * are fetched again before the toast.
   */
  onSchemaStale: () => Promise<void>;
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
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Per reference field, its chosen ids whose items E5 no longer finds.
  const unresolved = useRef<Record<string, readonly string[]>>({});
  // Discard changes chosen in the Item menu: its dialog takes the focus.
  const discardChosen = useRef(false);
  const [setHeader, isCompact] = useIsNarrow(COMPACT_HEADER_WIDTH);

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
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  /**
   * An unknown outcome (4.3.2): read the item before the buttons enable
   * again. The same version: nothing landed. Another: it becomes the
   * baseline, with the person's values kept aside, so a write that landed
   * leaves the editor clean and one that did not shows "Use my edit".
   */
  const settle = async ({ sent, afterSave = false }: Settle) => {
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
            values,
            slug,
          })
        : keepAside({ fields, kept, baseline, baselineSlug, values, slug })
    );
    applyItem(result.item);
    onWritten(result.item);
  };

  const fail = (
    failure: CmsFailure,
    settleWith?: Settle,
    on: "load" | "write" = "write"
  ) => {
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
      void settle(settleWith);
      return;
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
      fail(result, settleWith);
      return;
    }
    setLine(undefined);
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
    from: CmsItem | null
  ): Promise<{ saved: CmsItem; differs: boolean } | undefined> => {
    const clientErrors = validateItem({
      fields,
      values,
      slug,
      isNew: from === null,
    });
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      return;
    }
    const data = toItemData(fields, values);
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
      from === null ? undefined : { sent: from }
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
      isItemDirty({
        fields,
        baseline: { ...emptyItemData(fields), ...saved.data },
        values,
        baselineSlug: saved.slug,
        slug,
      });
    return { saved, differs };
  };

  const save = async () => {
    if (item === undefined) {
      return;
    }
    await saveFrom(item);
  };

  const publish = async () => {
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
        const second = await saveFrom(current);
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

  const discard = async () => {
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

  /** Reload keeps the person's unsaved values aside (4.3.2). */
  const reload = async () => {
    if (item === undefined || item === null) {
      return;
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
      fail(result);
      return;
    }
    setKept(keepAside({ fields, kept, baseline, baselineSlug, values, slug }));
    applyItem(result.item);
  };

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

  const actions = (
    <Flex align="center" gap="2" css={{ flexShrink: 0 }}>
      {canEdit &&
        hasStagedChanges &&
        (isCompact ? (
          <DropdownMenu modal={false}>
            <Tooltip content="Item menu" side="bottom">
              <DropdownMenuTrigger asChild>
                <IconButton aria-label="Item menu">
                  <EllipsesIcon />
                </IconButton>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(event) => {
                if (discardChosen.current) {
                  discardChosen.current = false;
                  event.preventDefault();
                }
              }}
            >
              <DropdownMenuItem
                disabled={busy !== undefined}
                onSelect={() => {
                  discardChosen.current = true;
                  setConfirmDiscard(true);
                }}
              >
                Discard changes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            color="ghost"
            disabled={busy !== undefined}
            state={busy === "discard" ? "pending" : undefined}
            onClick={() => setConfirmDiscard(true)}
          >
            Discard changes
          </Button>
        ))}
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
              disabled={busy !== undefined && busy !== "reload"}
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
          data-cms-editor-fields
          css={{
            maxWidth: editorColumnMaxWidth,
            marginInline: "auto",
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
                  onUseMine={
                    canEdit && keptDifferences.includes(field.key)
                      ? () => restoreMine(field.key)
                      : undefined
                  }
                  useMineDisabled={busy !== undefined}
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
              onUseMine={
                canEdit && keptDifferences.includes("slug")
                  ? () => restoreMine("slug")
                  : undefined
              }
              useMineDisabled={busy !== undefined}
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
          </Grid>
        </Box>
      </ScrollAreaNative>
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent
          width={420}
          aria-describedby={undefined}
          // the safe choice takes the first focus; Discard stays right
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelRef.current?.focus();
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
