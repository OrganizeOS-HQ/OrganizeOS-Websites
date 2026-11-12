import { useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Flex,
  InputErrorsTooltip,
  InputField,
  PanelTitle,
  SmallIconButton,
  Text,
  Tooltip,
  cssVar,
  selectedItemBackground,
  theme,
  useSortable,
} from "@webstudio-is/design-system";
import { EllipsesIcon, PlusIcon } from "@webstudio-is/icons";
import {
  BRAND_COLLECTION_ID,
  SITE_COLLECTION_ID,
} from "@webstudio-is/project-build";
import type { CollectionView } from "./reader";
import {
  createCollection,
  deleteCollection,
  getVariableUsage,
  renameCollection,
  reorderCollection,
} from "./operations";
import { DeleteDialog } from "./delete-dialog";

/**
 * A collection's name being typed: Enter, or a blur with a name, commits;
 * Escape, or an empty name, cancels. Escape is prevented, so the overlay
 * stays open.
 */
const NameField = ({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  /** a refusal, or undefined when it landed */
  onCommit: (name: string) => string | undefined;
  onCancel: () => void;
}) => {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string>();
  const done = useRef(false);
  const commit = () => {
    if (done.current) {
      return;
    }
    if (value.trim() === "") {
      done.current = true;
      onCancel();
      return;
    }
    const refusal = onCommit(value);
    if (refusal === undefined) {
      done.current = true;
    }
    setError(refusal);
  };
  return (
    <InputErrorsTooltip errors={error === undefined ? undefined : [error]}>
      <InputField
        autoFocus
        maxLength={64}
        value={value}
        css={
          error === undefined
            ? undefined
            : { borderColor: cssVar("--border-negative") }
        }
        onFocus={(event) => {
          // InputField focuses its input inside a wrapper
          if (event.target instanceof HTMLInputElement) {
            event.target.select();
          }
        }}
        onChange={(event) => {
          setValue(event.target.value);
          setError(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            done.current = true;
            onCancel();
          }
        }}
        onBlur={commit}
      />
    </InputErrorsTooltip>
  );
};

const isSystem = (id: string) =>
  id === BRAND_COLLECTION_ID || id === SITE_COLLECTION_ID;

const CollectionMenu = ({
  collection,
  onRename,
  onDelete,
}: {
  collection: CollectionView;
  onRename: () => void;
  onDelete: () => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <SmallIconButton
        aria-label="Actions"
        icon={<EllipsesIcon />}
        onClick={(event) => event.stopPropagation()}
      />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
      {collection.id !== SITE_COLLECTION_ID && (
        <DropdownMenuItem destructive onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

const CollectionItem = ({
  collection,
  isSelected,
  readOnly,
  isRenaming,
  onSelect,
  onRename,
  onRenameEnd,
  onDelete,
}: {
  collection: CollectionView;
  isSelected: boolean;
  readOnly: boolean;
  isRenaming: boolean;
  onSelect: () => void;
  onRename: () => void;
  onRenameEnd: () => void;
  onDelete: () => void;
}) => {
  if (isRenaming) {
    return (
      <Flex css={{ px: theme.spacing[5], py: theme.spacing[2] }}>
        <NameField
          initial={collection.name}
          onCommit={(name) => {
            const result = renameCollection(collection.id, name);
            if (result.ok) {
              onRenameEnd();
              return;
            }
            return result.error;
          }}
          onCancel={onRenameEnd}
        />
      </Flex>
    );
  }
  return (
    <Flex
      role="option"
      aria-selected={isSelected}
      data-collection={collection.id}
      data-id={isSystem(collection.id) ? undefined : collection.id}
      align="center"
      gap="1"
      onClick={onSelect}
      css={{
        height: theme.spacing[13],
        px: theme.spacing[9],
        cursor: "default",
        background: isSelected ? selectedItemBackground : undefined,
        "&:hover": {
          background: isSelected
            ? selectedItemBackground
            : cssVar("--overlay-interaction-hover"),
        },
      }}
    >
      <Text truncate css={{ flexGrow: 1 }}>
        {collection.name}
      </Text>
      {readOnly === false && collection.id !== BRAND_COLLECTION_ID && (
        <CollectionMenu
          collection={collection}
          onRename={onRename}
          onDelete={onDelete}
        />
      )}
    </Flex>
  );
};

/**
 * The left column (spec 5.3): Brand and Site first, then the designer's own
 * collections in registry order, which drag to reorder.
 */
export const CollectionsColumn = ({
  collections,
  selectedId,
  readOnly,
  onSelect,
}: {
  collections: readonly CollectionView[];
  selectedId: string;
  readOnly: boolean;
  onSelect: (id: string) => void;
}) => {
  const [editing, setEditing] = useState<
    { kind: "new" } | { kind: "rename"; id: string } | undefined
  >();
  const [toDelete, setToDelete] = useState<CollectionView>();

  const system = collections.filter((collection) => isSystem(collection.id));
  const designer = collections.filter(
    (collection) => isSystem(collection.id) === false
  );

  const { placementIndicator, sortableRefCallback } = useSortable({
    items: designer,
    onSort: (newIndex, oldIndex) => {
      if (readOnly === false) {
        reorderCollection(designer[oldIndex].id, newIndex);
      }
    },
  });

  const deleteNow = (collection: CollectionView) => {
    const result = deleteCollection(collection.id);
    if (result.ok) {
      onSelect(SITE_COLLECTION_ID);
    }
  };

  const requestDelete = (collection: CollectionView) => {
    if (collection.rows.length === 0) {
      deleteNow(collection);
      return;
    }
    setToDelete(collection);
  };

  const renderItem = (collection: CollectionView) => (
    <CollectionItem
      key={collection.id}
      collection={collection}
      isSelected={collection.id === selectedId}
      readOnly={readOnly}
      isRenaming={editing?.kind === "rename" && editing.id === collection.id}
      onSelect={() => onSelect(collection.id)}
      onRename={() => setEditing({ kind: "rename", id: collection.id })}
      onRenameEnd={() => setEditing(undefined)}
      onDelete={() => requestDelete(collection)}
    />
  );

  const uses =
    toDelete?.rows.reduce(
      (sum, row) => sum + getVariableUsage(row.cssName),
      0
    ) ?? 0;
  const count = toDelete?.rows.length ?? 0;

  return (
    <Flex
      data-collections-column
      direction="column"
      css={{
        width: theme.spacing[30],
        flexShrink: 0,
        borderRight: `1px solid ${cssVar("--border-default")}`,
        overflowY: "auto",
      }}
    >
      <PanelTitle
        suffix={
          readOnly ? undefined : (
            <Tooltip content="New collection">
              <SmallIconButton
                aria-label="New collection"
                icon={<PlusIcon />}
                onClick={() => setEditing({ kind: "new" })}
              />
            </Tooltip>
          )
        }
      >
        Variables
      </PanelTitle>
      <Flex direction="column" role="listbox" aria-label="Collections">
        {system.map(renderItem)}
        <Flex direction="column" ref={sortableRefCallback}>
          {designer.map(renderItem)}
          {placementIndicator}
        </Flex>
      </Flex>
      {editing?.kind === "new" && (
        <Flex css={{ px: theme.spacing[5], py: theme.spacing[2] }}>
          <NameField
            initial=""
            onCommit={(name) => {
              const result = createCollection(name);
              if (result.ok) {
                setEditing(undefined);
                onSelect(result.id);
                return;
              }
              return result.error;
            }}
            onCancel={() => setEditing(undefined)}
          />
        </Flex>
      )}
      <DeleteDialog
        open={toDelete !== undefined}
        name={`${toDelete?.name} and its ${count} ${count === 1 ? "variable" : "variables"}`}
        uses={uses}
        onConfirm={() => {
          if (toDelete !== undefined) {
            deleteNow(toDelete);
          }
        }}
        onOpenChange={(open) => {
          if (open === false) {
            setToDelete(undefined);
          }
        }}
      />
    </Flex>
  );
};
