/**
 * Collection settings, in the main area: name, singular name, address and
 * public, with Delete collection in "...". Save sends all four with the
 * collection's version through its queue (E23); a conflict shows its line
 * with Reload, which rebases the controls the person did not change on the
 * fresh read.
 *
 * The delete confirmation is shared with the row's "...": it names the
 * items it removes, and while another collection references this one it
 * says which and offers no Delete.
 */
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DropdownMenuItem,
  Flex,
  InputField,
  Switch,
  Text,
  theme,
  toast,
} from "@webstudio-is/design-system";
import { getRefusal, getToastText } from "./cms-logic";
import { isCmsFailure, type CmsResult } from "./cms-source";
import {
  COLLECTION_NAME_MAX,
  COLLECTION_SLUG_MAX,
  getSettingsErrors,
  getStructureToastText,
  isSameSettings,
  rebaseSettings,
  toSettingsToSave,
  type SettingsErrors,
} from "./cms-structure-logic";
import type {
  CmsCollectionSettings,
  CmsStructureCollection,
  CmsStructureSource,
} from "./cms-structure-source";
import { FieldRow, fieldIds } from "./field-controls";
import { LineRow, type CmsLineKind } from "./refusal-line";
import {
  StructureBody,
  StructureHeader,
  WrappingDialogTitle,
} from "./structure-header";

/** The hook's per-collection queue (4.4): each write gets the version. */
export type CmsStructureEnqueue = <Answer extends { updatedAt: string }>(
  collectionId: string,
  write: (expectedUpdatedAt: string) => Promise<CmsResult<Answer>>
) => Promise<CmsResult<Answer>>;

const ids = {
  name: "cms-settings-name",
  singularName: "cms-settings-singular",
  slug: "cms-settings-slug",
  isPublic: "cms-settings-public",
};

export const settingsOf = (
  collection: CmsCollectionSettings
): CmsCollectionSettings => ({
  name: collection.name,
  singularName: collection.singularName,
  slug: collection.slug,
  isPublic: collection.isPublic,
});

const joinNames = (names: string[]) =>
  names.length <= 2
    ? names.join(" and ")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

export const DeleteCollectionDialog = ({
  structure,
  collection,
  onOpenChange,
  onDeleted,
  onRefusal,
  onRefresh,
  onNotFound,
}: {
  structure: CmsStructureSource;
  /** The collection to delete; undefined closes the dialog. */
  collection: CmsStructureCollection | undefined;
  onOpenChange: (open: boolean) => void;
  onDeleted: (collectionId: string) => void;
  onRefusal: (line: CmsLineKind) => void;
  /** Rereads the collection, for its current references. */
  onRefresh: (collectionId: string) => void;
  /** The collection is gone: E1 again. */
  onNotFound: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  // a Delete whose outcome is unknown: a later not_found is that delete
  const unknownOutcome = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const blockedBy = collection?.referencedBy ?? [];
  useEffect(() => {
    unknownOutcome.current = false;
  }, [collection?.id]);
  const remove = async () => {
    if (collection === undefined) {
      return;
    }
    setBusy(true);
    const result = await structure.deleteCollection(collection.id);
    setBusy(false);
    if (isCmsFailure(result)) {
      const refusal = getRefusal(result.error, "write");
      if (refusal !== undefined) {
        onRefusal(refusal);
        return;
      }
      if (result.error === "referenced") {
        // a reference made since the dialog opened: show who uses it
        onRefresh(collection.id);
        return;
      }
      if (result.error === "not_found" && unknownOutcome.current) {
        onOpenChange(false);
        onDeleted(collection.id);
        return;
      }
      toast.error(getStructureToastText(result.error, "collection"));
      if (result.error === "unavailable" || result.error === "updating") {
        unknownOutcome.current = true;
      }
      if (result.error === "not_found") {
        onOpenChange(false);
        onNotFound();
      }
      return;
    }
    onOpenChange(false);
    onDeleted(collection.id);
  };
  const title =
    collection === undefined
      ? ""
      : blockedBy.length > 0
        ? `${collection.name} is in use`
        : collection.total > 0
          ? `Delete ${collection.name} and its ${collection.total} ${
              collection.total === 1 ? "item" : "items"
            }?`
          : `Delete ${collection.name}?`;
  return (
    <Dialog open={collection !== undefined} onOpenChange={onOpenChange}>
      <DialogContent
        width={420}
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        {blockedBy.length > 0 && (
          <Text
            color="destructive"
            data-cms-delete-blocked
            css={{
              paddingInline: theme.panel.paddingInline,
              paddingTop: theme.spacing[5],
              overflowWrap: "anywhere",
            }}
          >
            {`Used by ${joinNames(blockedBy.map((entry) => entry.name))}`}
          </Text>
        )}
        <DialogActions>
          {blockedBy.length === 0 && (
            <Button
              color="destructive"
              state={busy ? "pending" : undefined}
              disabled={busy}
              onClick={() => void remove()}
            >
              Delete
            </Button>
          )}
          <DialogClose>
            <Button ref={cancelRef} color="ghost">
              {blockedBy.length > 0 ? "Close" : "Cancel"}
            </Button>
          </DialogClose>
        </DialogActions>
        <WrappingDialogTitle>{title}</WrappingDialogTitle>
      </DialogContent>
    </Dialog>
  );
};

export const CollectionSettings = ({
  structure,
  collection,
  canManage,
  enqueue,
  reread,
  onBack,
  onDirtyChange,
  onSaved,
  onDelete,
  onRefusal,
  onNotFound,
}: {
  structure: CmsStructureSource;
  collection: CmsStructureCollection;
  canManage: boolean;
  enqueue: CmsStructureEnqueue;
  /** E21 again: the fresh collection, or undefined. */
  reread: () => Promise<CmsStructureCollection | undefined>;
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
  /** After E23: the settings before and as saved. */
  onSaved: (
    before: CmsCollectionSettings,
    after: CmsCollectionSettings & { updatedAt: string }
  ) => void;
  onDelete: () => void;
  onRefusal: (line: CmsLineKind) => void;
  /** The collection is gone: E1 again. */
  onNotFound: () => void;
}) => {
  const [baseline, setBaseline] = useState(() => settingsOf(collection));
  const [values, setValues] = useState(baseline);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [busy, setBusy] = useState(false);
  const [isConflict, setIsConflict] = useState(false);

  const isDirty = isSameSettings(baseline, values) === false;
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const set = (patch: Partial<CmsCollectionSettings>) => {
    setValues((current) => ({ ...current, ...patch }));
    setErrors({});
  };

  /** A fresh read in place of the baseline: rebase what the person left. */
  const rebase = async (sent?: CmsCollectionSettings) => {
    const fresh = await reread();
    if (fresh === undefined) {
      return;
    }
    const freshSettings = settingsOf(fresh);
    // the write landed: the view is clean, and the write's effects follow
    if (sent !== undefined && isSameSettings(freshSettings, sent)) {
      setBaseline(freshSettings);
      setValues(freshSettings);
      setIsConflict(false);
      if (isSameSettings(freshSettings, baseline) === false) {
        onSaved(baseline, { ...freshSettings, updatedAt: fresh.updatedAt });
      }
      return;
    }
    setValues((current) => rebaseSettings(baseline, freshSettings, current));
    setBaseline(freshSettings);
  };

  const save = async () => {
    const next = toSettingsToSave(values);
    setValues(next);
    const found = getSettingsErrors(next);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setBusy(true);
    const result = await enqueue(collection.id, async (expectedUpdatedAt) => {
      const answer = await structure.updateCollection(collection.id, {
        ...next,
        expectedUpdatedAt,
      });
      return isCmsFailure(answer)
        ? answer
        : { ...answer, updatedAt: answer.collection.updatedAt };
    });
    setBusy(false);
    if (isCmsFailure(result)) {
      const refusal = getRefusal(result.error, "write");
      if (refusal !== undefined) {
        onRefusal(refusal);
      } else if (result.error === "conflict") {
        setIsConflict(true);
      } else if (result.error === "slug_taken") {
        setErrors({ slug: "Address in use" });
      } else if (result.error === "invalid" && result.field === "slug") {
        setErrors({ slug: "Lower-case letters, digits, hyphens" });
      } else if (
        result.error === "invalid" &&
        (result.field === "name" || result.field === "singularName")
      ) {
        setErrors({ [result.field]: "Required" });
      } else if (result.error === "not_found") {
        toast.error(getStructureToastText(result.error, "collection"));
        onNotFound();
      } else {
        toast.error(getToastText(result.error));
        if (result.error === "unavailable" || result.error === "updating") {
          await rebase(next);
        }
      }
      return;
    }
    const saved = settingsOf(result.collection);
    setBaseline(saved);
    setValues(saved);
    setIsConflict(false);
    onSaved(baseline, { ...saved, updatedAt: result.collection.updatedAt });
  };

  const disabled = canManage === false || busy;
  const errorProps = (id: string, error: string | undefined) => ({
    color: error === undefined ? undefined : ("error" as const),
    "aria-invalid": error !== undefined || undefined,
    "aria-describedby": error === undefined ? undefined : fieldIds(id).error,
  });
  const slugifyAddress = () => set({ slug: toSettingsToSave(values).slug });

  return (
    <Flex
      direction="column"
      css={{ height: "100%", minWidth: 0 }}
      data-cms-collection-settings
    >
      <StructureHeader
        collectionName={baseline.name}
        name="Settings"
        menuLabel="Collection menu"
        onBack={onBack}
        menu={
          canManage && (
            <DropdownMenuItem destructive onSelect={onDelete}>
              Delete collection
            </DropdownMenuItem>
          )
        }
        actions={
          canManage && (
            <Button
              color="primary"
              disabled={isDirty === false || busy}
              state={busy ? "pending" : undefined}
              onClick={() => void save()}
            >
              Save
            </Button>
          )
        }
      />
      {isConflict && (
        <LineRow data-cms-structure-conflict>
          <Text>Changed by someone else</Text>
          <Button
            color="ghost"
            onClick={() => {
              setIsConflict(false);
              void rebase();
            }}
          >
            Reload
          </Button>
        </LineRow>
      )}
      <StructureBody>
        <FieldRow id={ids.name} label="Name" required error={errors.name}>
          <InputField
            id={ids.name}
            value={values.name}
            disabled={disabled}
            maxLength={COLLECTION_NAME_MAX}
            {...errorProps(ids.name, errors.name)}
            onChange={(event) => set({ name: event.currentTarget.value })}
          />
        </FieldRow>
        <FieldRow
          id={ids.singularName}
          label="Singular name"
          required
          error={errors.singularName}
        >
          <InputField
            id={ids.singularName}
            value={values.singularName}
            disabled={disabled}
            maxLength={COLLECTION_NAME_MAX}
            {...errorProps(ids.singularName, errors.singularName)}
            onChange={(event) =>
              set({ singularName: event.currentTarget.value })
            }
          />
        </FieldRow>
        <FieldRow id={ids.slug} label="Address" required error={errors.slug}>
          <InputField
            id={ids.slug}
            value={values.slug}
            disabled={disabled}
            maxLength={COLLECTION_SLUG_MAX}
            spellCheck={false}
            {...errorProps(ids.slug, errors.slug)}
            onChange={(event) => set({ slug: event.currentTarget.value })}
            onBlur={slugifyAddress}
            onKeyDown={(event) => {
              if (event.key === "Enter" && isDirty && busy === false) {
                event.preventDefault();
                void save();
              }
            }}
          />
        </FieldRow>
        <FieldRow id={ids.isPublic} label="Public" inline>
          <Switch
            id={ids.isPublic}
            checked={values.isPublic}
            disabled={disabled}
            onCheckedChange={(isPublic) => set({ isPublic })}
          />
        </FieldRow>
      </StructureBody>
    </Flex>
  );
};
