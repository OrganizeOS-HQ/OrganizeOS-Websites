/**
 * The field sheet (slice 3), in the main area as the item editor is: one
 * field's name, key, kind, the kind's own settings, help text, Required,
 * the title switch and the table column. A saved field's key and kind are
 * fixed; a template field's reference keeps its target. "..." holds Remove
 * field, confirmed with the count of items it is removed from.
 *
 * Each save sends the whole schema with this one change, checked first by
 * the platform's rules (`cms-structure-logic.ts`).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
  DropdownMenuItem,
  Flex,
  Grid,
  InputField,
  Select,
  SmallIconButton,
  Switch,
  TextArea,
  toast,
  Tooltip,
} from "@webstudio-is/design-system";
import { PlusIcon, XIcon } from "@webstudio-is/icons";
import { getRefusal } from "./cms-logic";
import { isCmsFailure, type CmsFieldKind } from "./cms-source";
import {
  canRemoveField,
  draftFromField,
  FIELD_HELP_MAX,
  FIELD_KEY_MAX,
  FIELD_KINDS,
  FIELD_KIND_LABELS,
  FIELD_LABEL_MAX,
  canShowInTable,
  getFieldDraftErrors,
  getStructureToastText,
  isFieldDraftDirty,
  isReferenceKind,
  newDraft,
  newOption,
  OPTIONS_MAX,
  OPTION_VALUE_MAX,
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
import { FieldRow, fieldIds } from "./field-controls";
import { FieldKindLabel } from "./fields-view";
import type { CmsLineKind } from "./refusal-line";
import { StructureBody, StructureHeader } from "./structure-header";

export type FieldSheetTarget = { key: string } | { kind: CmsFieldKind };

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
  const lastRef = useRef<HTMLInputElement>(null);
  const [focusLast, setFocusLast] = useState(false);
  useEffect(() => {
    if (focusLast) {
      lastRef.current?.focus();
      setFocusLast(false);
    }
  }, [focusLast]);
  return (
    <FieldRow id={ids.options} label="Options" error={error}>
      <Grid
        gap="1"
        id={ids.options}
        role="list"
        css={{ gridTemplateColumns: "minmax(0, 1fr)" }}
      >
        {draft.options.map((option, index) => (
          <Flex key={option.id} role="listitem" align="center" gap="1">
            <InputField
              ref={index === draft.options.length - 1 ? lastRef : undefined}
              aria-label={`Option ${index + 1}`}
              value={option.label}
              disabled={disabled}
              maxLength={OPTION_VALUE_MAX}
              css={{ flexGrow: 1 }}
              onChange={(event) => {
                const label = event.currentTarget.value;
                onChange(
                  draft.options.map((entry) =>
                    entry.id === option.id ? { ...entry, label } : entry
                  )
                );
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  draft.options.length < OPTIONS_MAX
                ) {
                  event.preventDefault();
                  onChange([
                    ...draft.options.slice(0, index + 1),
                    newOption(),
                    ...draft.options.slice(index + 1),
                  ]);
                  setFocusLast(index === draft.options.length - 1);
                }
              }}
            />
            <Tooltip content="Remove">
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
            </Tooltip>
          </Flex>
        ))}
        <Flex>
          <Button
            color="ghost"
            prefix={<PlusIcon />}
            disabled={disabled || draft.options.length >= OPTIONS_MAX}
            onClick={() => {
              onChange([...draft.options, newOption()]);
              setFocusLast(true);
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
  onBack,
  onDirtyChange,
  onSaved,
  onRemoved,
  onRefusal,
}: {
  structure: CmsStructureSource;
  collection: CmsStructureCollection;
  target: FieldSheetTarget;
  /** Collections a reference may target, this one included. */
  targets: Array<{ id: string; name: string }>;
  canManage: boolean;
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
  /** After a save, with the schema now in force and the saved key. */
  onSaved: (fields: CmsStructureField[], key: string) => void;
  onRemoved: (fields: CmsStructureField[]) => void;
  onRefusal: (line: CmsLineKind) => void;
}) => {
  const original =
    "key" in target
      ? collection.fields.find((field) => field.key === target.key)
      : undefined;
  const originalKey = original?.key;
  const [draft, setDraft] = useState<FieldDraft>(() =>
    original === undefined
      ? newDraft("kind" in target ? target.kind : "text", targets[0]?.id ?? "")
      : draftFromField(original)
  );
  const [errors, setErrors] = useState<FieldDraftErrors>({});
  const [busy, setBusy] = useState<"save" | "remove" | undefined>(undefined);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const isDirty = isFieldDraftDirty(original, draft);
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const isNew = original === undefined;
  useEffect(() => {
    if (isNew) {
      labelRef.current?.focus();
    }
  }, [isNew]);

  const update = (next: FieldDraft) => {
    setDraft(next);
    setErrors({});
  };

  const fail = (code: Parameters<typeof getRefusal>[0], field?: string) => {
    const refusal = getRefusal(code, "write");
    if (refusal !== undefined) {
      onRefusal(refusal);
      return;
    }
    if (code === "invalid" && field === draft.key.trim() && isNew) {
      setErrors({ key: "Key in use" });
      return;
    }
    if (code === "reference_invalid") {
      setErrors({ reference: "Collection not found" });
      return;
    }
    toast.error(getStructureToastText(code, "field"));
  };

  const save = async () => {
    const found = getFieldDraftErrors(collection.fields, draft, originalKey);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setBusy("save");
    const fields = schemaWithDraft(collection.fields, draft, originalKey);
    const result = await structure.updateSchema(collection.id, {
      fields,
      expectedUpdatedAt: collection.updatedAt,
    });
    setBusy(undefined);
    if (isCmsFailure(result)) {
      fail(result.error, result.field);
      return;
    }
    onDirtyChange(false);
    onSaved(result.fields, draft.key.trim());
  };

  const remove = async () => {
    if (originalKey === undefined) {
      return;
    }
    setBusy("remove");
    const result = await structure.updateSchema(collection.id, {
      fields: schemaWithout(collection.fields, originalKey),
      removeKeys: [originalKey],
      expectedUpdatedAt: collection.updatedAt,
    });
    setBusy(undefined);
    setConfirmRemove(false);
    if (isCmsFailure(result)) {
      fail(result.error, result.field);
      return;
    }
    onDirtyChange(false);
    onRemoved(result.fields);
  };

  const referenceTargets = useMemo(
    () => targets.map((entry) => entry.id),
    [targets]
  );
  const targetName = (id: string) =>
    targets.find((entry) => entry.id === id)?.name ?? "";

  const disabled = canManage === false || busy !== undefined;
  const columnEnabled = canShowInTable(collection.fields, draft, originalKey);
  const isCurrentTitle = original?.isTitle === true;
  const removable = original !== undefined && canRemoveField(original);
  const name =
    draft.label.trim() ||
    original?.label ||
    `New ${FIELD_KIND_LABELS[draft.kind].toLowerCase()} field`;

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
      <StructureBody>
        <FieldRow id={ids.label} label="Name" required error={errors.label}>
          <InputField
            ref={labelRef}
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
              type="number"
              min={1}
              value={draft.maxLength}
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
          <DialogTitle>
            {collection.total > 0
              ? `Remove ${original?.label ?? "this field"} from ${collection.total} ${
                  collection.total === 1 ? "item" : "items"
                }?`
              : `Remove ${original?.label ?? "this field"}?`}
          </DialogTitle>
        </DialogContent>
      </Dialog>
    </Flex>
  );
};
