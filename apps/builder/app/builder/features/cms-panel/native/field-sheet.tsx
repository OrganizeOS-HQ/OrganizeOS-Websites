/**
 * The field sheet, in the main area as the item editor is: one field's
 * name, key, kind, the kind's own settings, help text, Required, Title and
 * Table column. A saved field's key and kind are fixed; a template field's
 * reference keeps its target. "..." holds Remove field, confirmed with the
 * count of items it is removed from.
 *
 * Each save sends the whole schema with this one change, checked first by
 * the platform's rules (`cms-structure-logic.ts`), through the collection's
 * queue (E24). A conflict shows its line with Reload, which rebases each
 * property the person did not change on the fresh read.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Button,
  css,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DropdownMenuItem,
  Flex,
  Grid,
  InputField,
  Select,
  SmallIconButton,
  Switch,
  Text,
  TextArea,
  theme,
  toast,
  useSortable,
} from "@webstudio-is/design-system";
import { DragHandleIcon, PlusIcon, XIcon } from "@webstudio-is/icons";
import { getRefusal, getToastText } from "./cms-logic";
import {
  isCmsFailure,
  type CmsErrorCode,
  type CmsFieldKind,
} from "./cms-source";
import {
  canRemoveField,
  canShowInTable,
  draftFromField,
  draftToField,
  FIELD_HELP_MAX,
  FIELD_KEY_MAX,
  FIELD_KINDS,
  FIELD_KIND_LABELS,
  FIELD_LABEL_MAX,
  getFieldDraftErrors,
  getStructureToastText,
  isFieldDraftDirty,
  isReferenceKind,
  isSameField,
  newDraft,
  newOption,
  OPTIONS_MAX,
  OPTION_VALUE_MAX,
  rebaseFieldDraft,
  schemaWithDraft,
  schemaWithout,
  takesMaxLength,
  withKind,
  withLabel,
  withTitle,
  type FieldDraft,
  type FieldDraftErrors,
} from "./cms-structure-logic";
import type {
  CmsStructureCollection,
  CmsStructureField,
  CmsStructureSource,
} from "./cms-structure-source";
import type { CmsStructureEnqueue } from "./collection-settings";
import { FieldRow, fieldIds } from "./field-controls";
import { FieldKindLabel } from "./fields-view";
import { LineRow, type CmsLineKind } from "./refusal-line";
import {
  StructureBody,
  StructureHeader,
  WrappingDialogTitle,
} from "./structure-header";

export type FieldSheetTarget = { key: string } | { kind: CmsFieldKind };

/** What the hook reads again after a write's answer. */
export type FieldSheetStale = "structure" | "collections" | "limits";

const ids = {
  label: "cms-field-sheet-label",
  key: "cms-field-sheet-key",
  kind: "cms-field-sheet-kind",
  options: "cms-field-sheet-options",
  reference: "cms-field-sheet-reference",
  maxLength: "cms-field-sheet-max-length",
  help: "cms-field-sheet-help",
  required: "cms-field-sheet-required",
  title: "cms-field-sheet-title",
  column: "cms-field-sheet-column",
};

const errorProps = (id: string, error: string | undefined) => ({
  color: error === undefined ? undefined : ("error" as const),
  "aria-invalid": error !== undefined || undefined,
  "aria-describedby": error === undefined ? undefined : fieldIds(id).error,
});

const SwitchRow = ({
  id,
  label,
  checked,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <FieldRow id={id} label={label} inline>
    <Switch
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
    />
  </FieldRow>
);

const gripStyle = css({
  display: "flex",
  flexShrink: 0,
  cursor: "grab",
  opacity: 0.7,
  "&[data-disabled]": { visibility: "hidden" },
});

const optionRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing[3],
  minWidth: 0,
  "&[data-dragging]": { opacity: 0.5 },
});

/** The options by label; each row moves by its grip or Alt+Arrow. */
const OptionsEditor = ({
  draft,
  error,
  disabled,
  onChange,
}: {
  draft: FieldDraft;
  error: string | undefined;
  disabled: boolean;
  onChange: (options: FieldDraft["options"]) => void;
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [focusId, setFocusId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (focusId !== undefined) {
      listRef.current
        ?.querySelector<HTMLInputElement>(`[data-id="${focusId}"] input`)
        ?.focus();
      setFocusId(undefined);
    }
  }, [focusId]);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.options.length || from === to) {
      return;
    }
    const next = [...draft.options];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
    setFocusId(moved.id);
  };
  const { dragItemId, placementIndicator, sortableRefCallback } = useSortable({
    items: draft.options,
    onSort: (newIndex, oldIndex) => {
      if (disabled === false) {
        move(oldIndex, newIndex);
      }
    },
  });
  return (
    <FieldRow id={ids.options} label="Options" error={error}>
      <Grid
        gap="1"
        id={ids.options}
        role="list"
        css={{ gridTemplateColumns: "minmax(0, 1fr)" }}
        ref={(element: HTMLDivElement | null) => {
          listRef.current = element;
          if (disabled === false) {
            sortableRefCallback(element);
          }
        }}
      >
        {draft.options.map((option, index) => (
          <div
            key={option.id}
            role="listitem"
            data-id={option.id}
            data-cms-option-row
            data-dragging={dragItemId === option.id || undefined}
            className={optionRowStyle()}
          >
            <span
              className={gripStyle()}
              data-grip
              data-disabled={disabled || undefined}
              aria-hidden
            >
              <DragHandleIcon size={16} />
            </span>
            <InputField
              aria-label={`Option ${index + 1}`}
              aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              value={option.label}
              disabled={disabled}
              maxLength={OPTION_VALUE_MAX}
              css={{ flexGrow: 1, minWidth: 0 }}
              onChange={(event) => {
                const label = event.currentTarget.value;
                onChange(
                  draft.options.map((entry) =>
                    entry.id === option.id ? { ...entry, label } : entry
                  )
                );
              }}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (
                  event.altKey &&
                  (event.key === "ArrowUp" || event.key === "ArrowDown")
                ) {
                  event.preventDefault();
                  move(index, index + (event.key === "ArrowUp" ? -1 : 1));
                  return;
                }
                if (
                  event.key === "Enter" &&
                  index === draft.options.length - 1 &&
                  draft.options.length < OPTIONS_MAX
                ) {
                  event.preventDefault();
                  const added = newOption();
                  onChange([...draft.options, added]);
                  setFocusId(added.id);
                }
              }}
            />
            <SmallIconButton
              aria-label={`Remove ${option.label || `option ${index + 1}`}`}
              disabled={disabled || draft.options.length === 1}
              icon={<XIcon />}
              onClick={() =>
                onChange(
                  draft.options.filter((entry) => entry.id !== option.id)
                )
              }
            />
          </div>
        ))}
        {placementIndicator}
        <Flex>
          <Button
            color="ghost"
            prefix={<PlusIcon />}
            disabled={disabled || draft.options.length >= OPTIONS_MAX}
            onClick={() => {
              const added = newOption();
              onChange([...draft.options, added]);
              setFocusId(added.id);
            }}
          >
            Add option
          </Button>
        </Flex>
      </Grid>
    </FieldRow>
  );
};

export const FieldSheet = ({
  structure,
  collection,
  target,
  targets,
  canManage,
  enqueue,
  reread,
  onBack,
  onClose,
  onDirtyChange,
  onSaved,
  onRemoved,
  onRefusal,
  onStale,
}: {
  structure: CmsStructureSource;
  collection: CmsStructureCollection;
  target: FieldSheetTarget;
  /** Collections a reference may target, this one included. */
  targets: Array<{ id: string; name: string }>;
  canManage: boolean;
  /** The collection's queue: a Save carries a pending reorder. */
  enqueue: CmsStructureEnqueue;
  /** E21 again: the fresh collection, or undefined. */
  reread: () => Promise<CmsStructureCollection | undefined>;
  /** Back, behind the unsaved guard. */
  onBack: () => void;
  /** Closes the sheet at once: its field is gone. */
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  /** After a save, with the schema now in force, its version and the key. */
  onSaved: (
    fields: CmsStructureField[],
    updatedAt: string,
    key: string
  ) => void;
  onRemoved: (fields: CmsStructureField[], updatedAt: string) => void;
  onRefusal: (line: CmsLineKind) => void;
  onStale: (stale: FieldSheetStale) => void;
}) => {
  const [saved, setSaved] = useState<CmsStructureField | undefined>(() =>
    "key" in target
      ? collection.fields.find((field) => field.key === target.key)
      : undefined
  );
  const originalKey = saved?.key;
  const [draft, setDraft] = useState<FieldDraft>(() =>
    saved === undefined
      ? newDraft("kind" in target ? target.kind : "text", targets[0]?.id ?? "")
      : draftFromField(saved)
  );
  const [errors, setErrors] = useState<FieldDraftErrors>({});
  const [line, setLine] = useState<"conflict" | "invalid" | undefined>(
    undefined
  );
  const [busy, setBusy] = useState<"save" | "remove" | undefined>(undefined);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const isDirty = isFieldDraftDirty(saved, draft);
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const isNew = saved === undefined;
  useEffect(() => {
    if (isNew === false) {
      return;
    }
    // after the menu that opened the sheet has closed
    const frame = requestAnimationFrame(() => labelRef.current?.focus());
    return () => cancelAnimationFrame(frame);
    // the first focus only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (next: FieldDraft) => {
    setDraft(next);
    setErrors({});
    if (line === "invalid") {
      setLine(undefined);
    }
  };

  /** A fresh read: the draft rebases on it, or the sheet closes. */
  const rebase = async () => {
    const fresh = await reread();
    if (fresh === undefined) {
      return;
    }
    if (originalKey === undefined) {
      return;
    }
    const freshField = fresh.fields.find((field) => field.key === originalKey);
    if (freshField === undefined) {
      toast.error("Field not found");
      onClose();
      return;
    }
    if (saved !== undefined) {
      setDraft((current) => rebaseFieldDraft(saved, freshField, current));
    }
    setSaved(freshField);
  };

  /** After an unknown outcome: the write landed when E21 holds the draft. */
  const settleUnknown = async () => {
    const fresh = await reread();
    if (fresh === undefined) {
      return;
    }
    const key = draft.key.trim();
    const freshField = fresh.fields.find((field) => field.key === key);
    if (
      freshField !== undefined &&
      isSameField(draftToField(draftFromField(freshField)), draftToField(draft))
    ) {
      onSaved(fresh.fields, fresh.updatedAt, key);
      return;
    }
    if (saved !== undefined && freshField !== undefined) {
      setDraft((current) => rebaseFieldDraft(saved, freshField, current));
      setSaved(freshField);
    } else if (saved !== undefined) {
      toast.error("Field not found");
      onClose();
    }
  };

  const fail = async (code: CmsErrorCode, field: string | undefined) => {
    const refusal = getRefusal(code, "write");
    if (refusal !== undefined) {
      onRefusal(refusal);
      return;
    }
    const openKey = originalKey ?? draft.key.trim();
    switch (code) {
      case "conflict":
        setLine("conflict");
        return;
      case "invalid": {
        if (field === undefined || field !== openKey) {
          toast.error(getToastText(code));
          onStale("structure");
          return;
        }
        if (isNew) {
          const fresh = await reread();
          const lower = openKey.toLowerCase();
          if (
            fresh?.fields.some((entry) => entry.key.toLowerCase() === lower)
          ) {
            setErrors({ key: "Key in use" });
            return;
          }
        }
        setLine("invalid");
        return;
      }
      case "reference_invalid":
        setErrors({ reference: "Collection not found" });
        onStale("collections");
        return;
      case "limit":
        toast.error(getStructureToastText(code, "field"));
        onStale("limits");
        return;
      case "not_found":
        toast.error(getStructureToastText(code, "collection"));
        onStale("collections");
        return;
      default:
        toast.error(getToastText(code));
        if (code === "unavailable" || code === "updating") {
          await settleUnknown();
        }
    }
  };

  const save = async () => {
    const found = getFieldDraftErrors(collection.fields, draft, originalKey);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setBusy("save");
    const fields = schemaWithDraft(collection.fields, draft, originalKey);
    const result = await enqueue(collection.id, (expectedUpdatedAt) =>
      structure.updateSchema(collection.id, { fields, expectedUpdatedAt })
    );
    setBusy(undefined);
    if (isCmsFailure(result)) {
      await fail(result.error, result.field);
      return;
    }
    setLine(undefined);
    onSaved(result.fields, result.updatedAt, draft.key.trim());
  };

  const remove = async () => {
    if (originalKey === undefined) {
      return;
    }
    setBusy("remove");
    const result = await enqueue(collection.id, (expectedUpdatedAt) =>
      structure.updateSchema(collection.id, {
        fields: schemaWithout(collection.fields, originalKey),
        removeKeys: [originalKey],
        expectedUpdatedAt,
      })
    );
    setBusy(undefined);
    setConfirmRemove(false);
    if (isCmsFailure(result)) {
      await fail(result.error, result.field);
      return;
    }
    onRemoved(result.fields, result.updatedAt);
  };

  const referenceTargets = useMemo(
    () => targets.map((entry) => entry.id),
    [targets]
  );
  const targetName = (id: string) =>
    targets.find((entry) => entry.id === id)?.name ?? "";

  const disabled = canManage === false || busy !== undefined;
  const columnEnabled = canShowInTable(collection.fields, draft, originalKey);
  const isCurrentTitle = saved?.isTitle === true;
  const removable = saved !== undefined && canRemoveField(saved);
  const name =
    draft.label.trim() ||
    saved?.label ||
    `New ${FIELD_KIND_LABELS[draft.kind].toLowerCase()} field`;
  const removeLabel = saved?.label ?? "";

  return (
    <Flex
      direction="column"
      css={{ height: "100%", minWidth: 0 }}
      data-cms-field-sheet
    >
      <StructureHeader
        collectionName={collection.name}
        name={name}
        menuLabel="Field menu"
        onBack={onBack}
        menu={
          canManage &&
          removable && (
            <DropdownMenuItem
              destructive
              onSelect={() => setConfirmRemove(true)}
            >
              Remove field
            </DropdownMenuItem>
          )
        }
        actions={
          canManage && (
            <Button
              color="primary"
              disabled={
                (isDirty === false && isNew === false) || busy !== undefined
              }
              state={busy === "save" ? "pending" : undefined}
              onClick={() => void save()}
            >
              {isNew ? "Add field" : "Save"}
            </Button>
          )
        }
      />
      {line === "conflict" && (
        <LineRow data-cms-structure-conflict>
          <Text>Changed by someone else</Text>
          <Button
            color="ghost"
            onClick={() => {
              setLine(undefined);
              void rebase();
            }}
          >
            Reload
          </Button>
        </LineRow>
      )}
      {line === "invalid" && (
        <LineRow data-cms-structure-invalid>
          <Text color="destructive">Not valid</Text>
        </LineRow>
      )}
      <StructureBody>
        <FieldRow id={ids.label} label="Name" required error={errors.label}>
          <InputField
            inputRef={labelRef}
            id={ids.label}
            value={draft.label}
            disabled={disabled}
            maxLength={FIELD_LABEL_MAX}
            {...errorProps(ids.label, errors.label)}
            onChange={(event) =>
              update(withLabel(draft, event.currentTarget.value))
            }
          />
        </FieldRow>
        <FieldRow id={ids.key} label="Key" required error={errors.key}>
          <InputField
            id={ids.key}
            value={draft.key}
            disabled={disabled || isNew === false}
            maxLength={FIELD_KEY_MAX}
            spellCheck={false}
            css={{ fontFamily: "monospace" }}
            {...errorProps(ids.key, errors.key)}
            onChange={(event) =>
              update({
                ...draft,
                key: event.currentTarget.value,
                keyTouched: true,
              })
            }
          />
        </FieldRow>
        <FieldRow id={ids.kind} label="Kind">
          <Select
            id={ids.kind}
            options={FIELD_KINDS}
            value={draft.kind}
            disabled={disabled || isNew === false}
            getLabel={(kind: CmsFieldKind) => <FieldKindLabel kind={kind} />}
            onChange={(kind) =>
              update(withKind(draft, kind, targets[0]?.id ?? ""))
            }
          />
        </FieldRow>
        {draft.kind === "option" && (
          <OptionsEditor
            draft={draft}
            error={errors.options}
            disabled={disabled}
            onChange={(options) => update({ ...draft, options })}
          />
        )}
        {isReferenceKind(draft.kind) && (
          <FieldRow
            id={ids.reference}
            label="Collection"
            required
            error={errors.reference}
          >
            <Select
              id={ids.reference}
              options={referenceTargets}
              value={draft.referenceId === "" ? undefined : draft.referenceId}
              placeholder="Choose"
              disabled={disabled || draft.locked}
              getLabel={targetName}
              onChange={(referenceId) => update({ ...draft, referenceId })}
            />
          </FieldRow>
        )}
        {takesMaxLength(draft.kind) && (
          <FieldRow
            id={ids.maxLength}
            label="Max length"
            error={errors.maxLength}
          >
            <InputField
              id={ids.maxLength}
              value={draft.maxLength}
              inputMode="numeric"
              disabled={disabled}
              {...errorProps(ids.maxLength, errors.maxLength)}
              onChange={(event) =>
                update({ ...draft, maxLength: event.currentTarget.value })
              }
            />
          </FieldRow>
        )}
        <FieldRow id={ids.help} label="Help text">
          <TextArea
            id={ids.help}
            rows={2}
            autoGrow
            maxRows={6}
            value={draft.help}
            disabled={disabled}
            maxLength={FIELD_HELP_MAX}
            onChange={(help) => update({ ...draft, help })}
          />
        </FieldRow>
        <Grid gap="2" css={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          <SwitchRow
            id={ids.required}
            label="Required"
            checked={draft.required || draft.isTitle}
            disabled={disabled || draft.isTitle}
            onChange={(required) => update({ ...draft, required })}
          />
          {draft.kind === "text" && (
            <SwitchRow
              id={ids.title}
              label="Title"
              checked={draft.isTitle}
              disabled={disabled || isCurrentTitle}
              onChange={(isTitle) => update(withTitle(draft, isTitle))}
            />
          )}
          <SwitchRow
            id={ids.column}
            label="Table column"
            checked={draft.showInTable}
            disabled={disabled || columnEnabled === false}
            onChange={(showInTable) => update({ ...draft, showInTable })}
          />
        </Grid>
      </StructureBody>
      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent
          width={420}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelRef.current?.focus();
          }}
        >
          <DialogActions>
            <Button
              color="destructive"
              state={busy === "remove" ? "pending" : undefined}
              onClick={() => void remove()}
            >
              Remove
            </Button>
            <DialogClose>
              <Button ref={cancelRef} color="ghost">
                Cancel
              </Button>
            </DialogClose>
          </DialogActions>
          <WrappingDialogTitle>
            {collection.total > 0
              ? `Remove ${removeLabel} from ${collection.total} ${
                  collection.total === 1 ? "item" : "items"
                }?`
              : `Remove ${removeLabel}?`}
          </WrappingDialogTitle>
        </DialogContent>
      </Dialog>
    </Flex>
  );
};
