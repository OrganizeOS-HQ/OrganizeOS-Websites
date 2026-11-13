/**
 * Collection settings (slice 3), in the main area: name, singular name,
 * address and public, with Delete collection in "...". The delete
 * confirmation is shared with the row's "...": it names the items it
 * removes, and while another collection references this one it says which
 * and offers no Delete.
 */
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
  DropdownMenuItem,
  Flex,
  InputField,
  Switch,
  Text,
  theme,
  toast,
} from "@webstudio-is/design-system";
import { getRefusal, isSlug, slugify } from "./cms-logic";
import { isCmsFailure } from "./cms-source";
import {
  getSettingsErrors,
  getStructureToastText,
  isSameSettings,
  type SettingsErrors,
} from "./cms-structure-logic";
import type {
  CmsCollectionSettings,
  CmsStructureCollection,
  CmsStructureSource,
} from "./cms-structure-source";
import { FieldRow, fieldIds } from "./field-controls";
import type { CmsLineKind } from "./refusal-line";
import { StructureBody, StructureHeader } from "./structure-header";

const ids = {
  name: "cms-settings-name",
  singularName: "cms-settings-singular",
  slug: "cms-settings-slug",
  isPublic: "cms-settings-public",
};

const settingsOf = (
  collection: CmsStructureCollection
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
}: {
  structure: CmsStructureSource;
  /** Refetches the collection, for its current references. */
  onRefresh: (collectionId: string) => void;
  /** The collection to delete; undefined closes the dialog. */
  collection: CmsStructureCollection | undefined;
  onOpenChange: (open: boolean) => void;
  onDeleted: (collectionId: string) => void;
  onRefusal: (line: CmsLineKind) => void;
}) => {
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const blockedBy = collection?.referencedBy ?? [];
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
      } else if (result.error === "referenced") {
        // a reference made since the dialog opened: show who uses it
        onRefresh(collection.id);
      } else {
        toast.error(getStructureToastText(result.error, "collection"));
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
        <DialogTitle>{title}</DialogTitle>
      </DialogContent>
    </Dialog>
  );
};

export const CollectionSettings = ({
  structure,
  collection,
  canManage,
  onBack,
  onDirtyChange,
  onSaved,
  onDelete,
  onRefusal,
}: {
  structure: CmsStructureSource;
  collection: CmsStructureCollection;
  canManage: boolean;
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
  onDelete: () => void;
  onRefusal: (line: CmsLineKind) => void;
}) => {
  const [baseline, setBaseline] = useState(() => settingsOf(collection));
  const [values, setValues] = useState(baseline);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [busy, setBusy] = useState(false);

  const isDirty = isSameSettings(baseline, values) === false;
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const set = (patch: Partial<CmsCollectionSettings>) => {
    setValues((current) => ({ ...current, ...patch }));
    setErrors({});
  };

  const save = async () => {
    const next = {
      ...values,
      name: values.name.trim(),
      singularName: values.singularName.trim(),
    };
    const found = getSettingsErrors(next);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setBusy(true);
    const result = await structure.updateCollection(collection.id, {
      ...next,
      expectedUpdatedAt: collection.updatedAt,
    });
    setBusy(false);
    if (isCmsFailure(result)) {
      const refusal = getRefusal(result.error, "write");
      if (refusal !== undefined) {
        onRefusal(refusal);
      } else if (result.error === "slug_taken") {
        setErrors({ slug: "Address in use" });
      } else if (result.error === "invalid" && result.field === "slug") {
        setErrors({ slug: "Lower-case letters, digits, hyphens" });
      } else {
        toast.error(getStructureToastText(result.error, "collection"));
      }
      return;
    }
    setBaseline(next);
    setValues(next);
    onDirtyChange(false);
    onSaved();
  };

  const disabled = canManage === false || busy;
  const errorProps = (id: string, error: string | undefined) => ({
    color: error === undefined ? undefined : ("error" as const),
    "aria-invalid": error !== undefined || undefined,
    "aria-describedby": error === undefined ? undefined : fieldIds(id).error,
  });

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
      <StructureBody>
        <FieldRow id={ids.name} label="Name" required error={errors.name}>
          <InputField
            id={ids.name}
            value={values.name}
            disabled={disabled}
            maxLength={120}
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
            maxLength={120}
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
            maxLength={63}
            spellCheck={false}
            {...errorProps(ids.slug, errors.slug)}
            onChange={(event) => set({ slug: event.currentTarget.value })}
            onBlur={() =>
              set({
                slug: isSlug(values.slug)
                  ? values.slug
                  : slugify(values.slug, slugify(values.name, "collection")),
              })
            }
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
