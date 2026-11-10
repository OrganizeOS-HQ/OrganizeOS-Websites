import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  css,
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
  ScrollArea,
  Text,
  theme,
  toast,
  Tooltip,
} from "@webstudio-is/design-system";
import { ChevronLeftIcon } from "@webstudio-is/icons";
import {
  emptyItemData,
  getFieldErrorText,
  getItemTitle,
  getRefusal,
  getTitleField,
  getToastText,
  isItemDirty,
  isSameValue,
  slugFollowsTitle,
  slugify,
  validateItem,
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
import { FieldControl, FieldRow } from "./field-controls";
import { RefusalLine, type CmsLineKind } from "./refusal-line";
import { StatusChip } from "./status-chip";

/** At most 640 px wide (4.3), from the spacing scale: 384 + 256. */
const editorColumnMaxWidth = `calc(${theme.spacing[34]} + ${theme.spacing[31]})`;

const lineStyle = css({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing[5],
  minHeight: theme.spacing[15],
  flexShrink: 0,
  paddingInline: theme.panel.paddingInline,
  borderBottom: `1px solid ${cssVar("--border-default")}`,
});

export const CONFLICT_LINE = "Changed by someone else";

type Kept = { values: CmsItemData; slug: string };

type Busy = "save" | "publish" | "discard" | "reload";

export const ItemEditor = ({
  source,
  access,
  collection,
  itemId,
  homeUrl,
  onBack,
  onDirtyChange,
  onWritten,
  onCreated,
  onOpenClassic,
}: {
  source: CmsSource;
  access: CmsAccess;
  collection: CmsCollection;
  /** null: a new item. */
  itemId: string | null;
  homeUrl?: string;
  /** The root runs the unsaved guard before leaving. */
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
  /** After every write: the lists refetch and the canvas invalidates (4.7). */
  onWritten: (item: CmsItem) => void;
  onCreated: (item: CmsItem) => void;
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
  const [conflict, setConflict] = useState(false);
  const [kept, setKept] = useState<Kept | undefined>(undefined);
  const [busy, setBusy] = useState<Busy | undefined>(undefined);
  const [line, setLine] = useState<
    { kind: CmsLineKind; retry?: () => void } | undefined
  >(undefined);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Uncontrolled controls (rich text) remount when values are replaced.
  const [epoch, setEpoch] = useState(0);
  const [fieldEpochs, setFieldEpochs] = useState<Record<string, number>>({});

  const isNew = item === null;
  const baseline = useMemo(
    () =>
      item === undefined || item === null
        ? emptyItemData(fields)
        : { ...emptyItemData(fields), ...item.data },
    [item, fields]
  );
  const baselineSlug = item?.slug ?? "";
  const isDirty =
    item !== undefined &&
    isItemDirty({ fields, baseline, values, baselineSlug, slug });

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
        const refusal = getRefusal(result.error);
        setLine({ kind: refusal ?? "unavailable" });
        return;
      }
      applyItem(result.item);
    });
    return () => {
      isCurrent = false;
    };
  }, [source, collection.id, itemId, applyItem]);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const fail = (failure: CmsFailure, retry: () => void) => {
    if (failure.error === "conflict") {
      setConflict(true);
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
    toast.error(getToastText(failure.error));
  };

  const write = async (
    kind: Busy,
    run: () => Promise<CmsResult<{ item: CmsItem }>>,
    retry: () => void
  ) => {
    setBusy(kind);
    const result = await run();
    setBusy(undefined);
    if (isCmsFailure(result)) {
      fail(result, retry);
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
    const clientErrors = validateItem(fields, values, slug);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      return;
    }
    const saved = await write(
      "save",
      () =>
        item === null
          ? source.createItem(collection.id, {
              slug: slug === "" ? undefined : slug,
              data: values,
            })
          : source.updateItem(collection.id, item.id, {
              slug: slug === item.slug ? undefined : slug,
              data: values,
              expectedUpdatedAt: item.updatedAt,
            }),
      () => void save()
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
      () => void publish()
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
      () => void discard()
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
    const result = await source.getItem(collection.id, item.id);
    setBusy(undefined);
    if (isCmsFailure(result)) {
      fail(result, () => void reload());
      return;
    }
    setKept({ values, slug });
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
    setValues((current) => ({ ...current, [key]: kept.values[key] }));
    setFieldEpochs((current) => ({
      ...current,
      [key]: (current[key] ?? 0) + 1,
    }));
  };

  if (item === undefined) {
    return (
      <Flex direction="column" css={{ height: "100%" }}>
        <EditorHeader
          crumb={collection.name}
          onBack={onBack}
          chip={undefined}
          actions={null}
        />
        {line !== undefined && (
          <div className={lineStyle()}>
            <RefusalLine kind={line.kind} homeUrl={homeUrl} />
          </div>
        )}
      </Flex>
    );
  }

  const title = getItemTitle(values, fields);
  const status = item?.status ?? "draft";
  const hasStagedChanges = item?.hasStagedChanges ?? false;
  const isPublishLabel = isNew || status !== "published";
  const nothingToPublish =
    isNew === false &&
    status === "published" &&
    hasStagedChanges === false &&
    isDirty === false;
  const disabled = canEdit === false || busy !== undefined;

  const actions = (
    <Flex align="center" gap="2" css={{ flexShrink: 0 }}>
      {canEdit && hasStagedChanges && (
        <Button
          color="ghost"
          disabled={busy !== undefined}
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

  const keptDiffers = (key: string) =>
    kept !== undefined &&
    (key === "slug"
      ? kept.slug !== slug
      : isSameValue(kept.values[key], values[key]) === false);

  return (
    <Flex
      direction="column"
      css={{ height: "100%", minWidth: 0 }}
      data-cms-editor
    >
      <EditorHeader
        crumb={`${collection.name} / ${
          title === "" ? `New ${collection.singularName.toLowerCase()}` : title
        }`}
        chip={{ status, hasStagedChanges }}
        onBack={onBack}
        actions={actions}
      />
      {conflict && (
        <div className={lineStyle()} data-cms-conflict>
          <Text color="destructive">{CONFLICT_LINE}</Text>
          <Button
            color="neutral"
            state={busy === "reload" ? "pending" : undefined}
            onClick={() => void reload()}
          >
            Reload
          </Button>
        </div>
      )}
      {line !== undefined && (
        <div className={lineStyle()}>
          <RefusalLine
            kind={line.kind}
            homeUrl={homeUrl}
            onRetry={line.retry}
          />
        </div>
      )}
      <ScrollArea css={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Box
          css={{
            maxWidth: editorColumnMaxWidth,
            marginInline: "auto",
            paddingInline: theme.spacing[9],
            paddingBlock: theme.spacing[11],
          }}
        >
          <Grid gap="3">
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
                    canEdit && keptDiffers(field.key)
                      ? () => restoreMine(field.key)
                      : undefined
                  }
                >
                  <FieldControl
                    key={`${epoch}:${fieldEpochs[field.key] ?? 0}`}
                    id={id}
                    field={field}
                    value={values[field.key]}
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
                canEdit && keptDiffers("slug")
                  ? () => restoreMine("slug")
                  : undefined
              }
            >
              <InputField
                id="cms-field-slug"
                value={slug}
                disabled={disabled}
                color={errors.slug === undefined ? undefined : "error"}
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
      </ScrollArea>
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent width={420} aria-describedby={undefined}>
          <DialogActions>
            <Button color="destructive" onClick={() => void discard()}>
              Discard
            </Button>
            <DialogClose>
              <Button color="ghost">Cancel</Button>
            </DialogClose>
          </DialogActions>
          {/* last in the DOM, so the close button is last in tab order */}
          <DialogTitle>Discard staged changes?</DialogTitle>
        </DialogContent>
      </Dialog>
    </Flex>
  );
};

const EditorHeader = ({
  crumb,
  chip,
  actions,
  onBack,
}: {
  crumb: string;
  chip: Parameters<typeof StatusChip>[0] | undefined;
  actions: JSX.Element | null;
  onBack: () => void;
}) => (
  <Flex
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
      <IconButton aria-label="Back" onClick={onBack}>
        <ChevronLeftIcon />
      </IconButton>
    </Tooltip>
    <Flex align="center" gap="2" css={{ minWidth: 0, flexGrow: 1 }}>
      <Tooltip content={crumb} delayDuration={600}>
        <Text variant="titles" truncate>
          {crumb}
        </Text>
      </Tooltip>
      {chip !== undefined && <StatusChip {...chip} />}
    </Flex>
    {actions}
  </Flex>
);
