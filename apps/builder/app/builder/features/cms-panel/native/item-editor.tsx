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
import { ChevronLeftIcon, ResetIcon } from "@webstudio-is/icons";
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

/** Below this the header's Discard changes becomes an icon. */
const COMPACT_HEADER_WIDTH = 600;

type Busy = "save" | "publish" | "discard" | "reload";

/** A write whose answer was lost may have landed (4.3.2). */
type Settle = { sent: CmsItem };

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
  onBack,
  onDirtyChange,
  onWritten,
  onCreated,
  onSchemaStale,
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
  const [loadAttempt, setLoadAttempt] = useState(0);
  // Rich text reads its value once: it remounts when values are replaced.
  const [epoch, setEpoch] = useState(0);
  const [fieldEpochs, setFieldEpochs] = useState<Record<string, number>>({});
  // One per new item's editor, sent with every E6 until one succeeds.
  const [clientId] = useState(() => crypto.randomUUID());
  const backRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
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
  useEffect(() => {
    if (loadedId.current === itemId) {
      return;
    }
    loadedId.current = itemId;
    if (itemId === null) {
      applyItem(null);
      return;
    }
    let isCurrent = true;
    void source.getItem(collection.id, itemId).then((result) => {
      if (isCurrent === false) {
        return;
      }
      if (isCmsFailure(result)) {
        const kind =
          getRefusal(result.error) ??
          (result.error === "not_found" ? "not_found" : "unavailable");
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
      applyItem(result.item);
    });
    return () => {
      isCurrent = false;
    };
  }, [source, collection.id, itemId, applyItem, loadAttempt]);

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
  const settle = async ({ sent }: Settle) => {
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
      setConflict(true);
      return;
    }
    if (result.item.updatedAt === sent.updatedAt) {
      toast.error(getToastText("unavailable"));
      return;
    }
    setKept(keepAside({ fields, kept, baseline, baselineSlug, values, slug }));
    applyItem(result.item);
    onWritten(result.item);
  };

  const fail = (
    failure: CmsFailure,
    retry: () => void,
    settleWith?: Settle
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
    if (failure.error === "invalid" && failure.field === undefined) {
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
    const fieldText = getFieldErrorText(failure.error);
    const fieldKey = failure.field;
    if (fieldText !== undefined && fieldKey !== undefined) {
      setErrors((current) => ({ ...current, [fieldKey]: fieldText }));
      return;
    }
    const refusal = getRefusal(failure.error);
    if (refusal !== undefined) {
      setLine({ kind: refusal, retry });
      return;
    }
    if (failure.error === "unavailable" && settleWith !== undefined) {
      void settle(settleWith);
      return;
    }
    toast.error(getToastText(failure.error));
  };

  const write = async (
    kind: Busy,
    run: () => Promise<CmsResult<{ item: CmsItem }>>,
    retry: () => void,
    settleWith?: Settle
  ) => {
    setBusy(kind);
    let result: CmsResult<{ item: CmsItem }>;
    try {
      result = await run();
    } catch {
      // a source that throws reads as a lost answer
      result = { error: "unavailable" };
    } finally {
      setBusy(undefined);
    }
    if (isCmsFailure(result)) {
      fail(result, retry, settleWith);
      return;
    }
    setLine(undefined);
    applyItem(result.item);
    onWritten(result.item);
    return result.item;
  };

  const save = async (): Promise<CmsItem | undefined> => {
    if (item === undefined) {
      return;
    }
    const clientErrors = validateItem({ fields, values, slug, isNew });
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      return;
    }
    const saved = await write(
      "save",
      () =>
        item === null
          ? source.createItem(collection.id, {
              clientId,
              slug: slug === "" ? undefined : slug,
              data: toItemData(fields, values),
            })
          : source.updateItem(collection.id, item.id, {
              slug: slug === item.slug ? undefined : slug,
              data: toItemData(fields, values),
              expectedUpdatedAt: item.updatedAt,
            }),
      () => void save(),
      // E6's repeat is the same clientId; E7 reads the item back
      item === null ? undefined : { sent: item }
    );
    if (saved !== undefined) {
      // the "Use my edit" buttons go on the next Save
      setKept(undefined);
      if (item === null) {
        loadedId.current = saved.id;
        onCreated(saved);
      }
    }
    return saved;
  };

  const publish = async () => {
    let current = item;
    if (current === undefined) {
      return;
    }
    // With unsaved edits it saves, then publishes: two calls, each locked.
    if (current === null || isDirty) {
      current = await save();
      if (current === undefined || current === null) {
        return;
      }
    }
    const target = current;
    await write(
      "publish",
      () =>
        source.publishItem(collection.id, target.id, {
          expectedUpdatedAt: target.updatedAt,
        }),
      () => void publish(),
      { sent: target }
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
      () => void discard(),
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
      fail(result, () => void reload());
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
    if (kept === undefined) {
      return;
    }
    if (key === "slug") {
      setSlug(kept.slug);
      setFollows(false);
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
  const showConflictLine = conflict || keptDifferences.length > 0;

  const actions = (
    <Flex align="center" gap="2" css={{ flexShrink: 0 }}>
      {canEdit &&
        hasStagedChanges &&
        (isCompact ? (
          <Tooltip content="Discard changes" side="bottom">
            <IconButton
              aria-label="Discard changes"
              disabled={busy !== undefined}
              onClick={() => setConfirmDiscard(true)}
            >
              <ResetIcon fill="currentColor" />
            </IconButton>
          </Tooltip>
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
            (isDirty === false && isNew === false) || busy !== undefined
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
          disabled={nothingToPublish || busy !== undefined}
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
                    onOpenClassic={onOpenClassic}
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
