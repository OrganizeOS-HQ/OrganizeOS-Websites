import { useState } from "react";
import { useStore } from "@nanostores/react";
import {
  Box,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Flex,
  InputErrorsTooltip,
  InputField,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Text,
  theme,
} from "@webstudio-is/design-system";
import type { StyleValue } from "@webstudio-is/css-engine";
import {
  BRAND_COLLECTION_ID,
  SITE_COLLECTION_ID,
  type VariableType,
} from "@webstudio-is/project-build";
import { $authPermit, $isDesignMode } from "~/shared/nano-states";
import { $project } from "~/shared/sync/data-stores";
import {
  $openRailOverlay,
  RailOverlay,
} from "~/builder/features/rail-overlay/rail-overlay";
import {
  $variableCollections,
  $variablesRegistryState,
  resolveRootVariable,
  type CollectionView,
} from "./reader";
import {
  deleteVariables,
  getVariableUsage,
  groupVariables,
  moveVariables,
} from "./operations";
import { matchesVariableSearch } from "./search";
import { describeBrandContrast } from "./brand-contrast";
import { VariablesToolbar } from "./variables-toolbar";
import { VariablesTable, type Selection } from "./variables-table";
import { CollectionsColumn } from "./collections-column";
import { DeleteDialog } from "./delete-dialog";
import {
  readSelectedCollection,
  writeSelectedCollection,
} from "./collection-memory";

/**
 * The commands that still run while the manager shows. A module constant, so
 * the host's listener does not re-subscribe on every render.
 */
const OVERLAY_ALLOWED_COMMANDS = ["undo", "redo"] as const;

const editPermits = new Set(["build", "admin", "own"]);

/** The bulk Group (spec 5.6): a name, and Enter puts the selection under it. */
const GroupControl = ({
  onGroup,
}: {
  /** a refusal, or undefined when it landed */
  onGroup: (group: string) => string | undefined;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        setName("");
        setError(undefined);
      }}
    >
      <PopoverTrigger asChild>
        <Button color="neutral">Group</Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <Box css={{ padding: theme.spacing[5] }}>
          <InputErrorsTooltip
            errors={error === undefined ? undefined : [error]}
          >
            <InputField
              autoFocus
              aria-label="Group name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(undefined);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  const refusal = onGroup(name);
                  if (refusal === undefined) {
                    setIsOpen(false);
                  } else {
                    setError(refusal);
                  }
                }
              }}
            />
          </InputErrorsTooltip>
        </Box>
      </PopoverContent>
    </Popover>
  );
};

/** Select, or while selecting, the bulk actions and Select to leave. */
const SelectControl = ({
  collections,
  selectedId,
  selection,
  rowsByName,
  onStart,
  onEnd,
  onClear,
}: {
  collections: readonly CollectionView[];
  selectedId: string;
  selection: Selection;
  rowsByName: ReadonlyMap<string, { displayName: string }>;
  onStart: () => void;
  onEnd: () => void;
  onClear: () => void;
}) => {
  const [deleting, setDeleting] = useState<{ uses: number }>();
  const selected = Array.from(selection.selected);
  const targets = collections.filter(
    (collection) =>
      collection.id !== BRAND_COLLECTION_ID && collection.id !== selectedId
  );
  if (selection.active === false) {
    return (
      <Button color="neutral" onClick={onStart}>
        Select
      </Button>
    );
  }
  const requestDelete = () => {
    const uses = selected.reduce(
      (sum, cssName) => sum + getVariableUsage(cssName),
      0
    );
    if (uses === 0) {
      deleteVariables(selected);
      onClear();
      return;
    }
    setDeleting({ uses });
  };
  return (
    <>
      {selected.length > 0 && (
        <>
          {targets.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button color="neutral">Move to collection</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {targets.map((collection) => (
                  <DropdownMenuItem
                    key={collection.id}
                    onSelect={() => {
                      moveVariables(selected, collection.id);
                      onClear();
                    }}
                  >
                    {collection.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <GroupControl
            onGroup={(group) => {
              const result = groupVariables(selected, group);
              if (result.ok === false) {
                return result.error;
              }
              onClear();
              return;
            }}
          />
          <Button color="neutral" onClick={requestDelete}>
            Delete
          </Button>
        </>
      )}
      <Button color="neutral" aria-pressed onClick={onEnd}>
        Select
      </Button>
      <DeleteDialog
        open={deleting !== undefined}
        name={
          selected.length === 1
            ? (rowsByName.get(selected[0])?.displayName ?? selected[0])
            : `${selected.length} variables`
        }
        uses={deleting?.uses ?? 0}
        onConfirm={() => {
          deleteVariables(selected);
          onClear();
        }}
        onOpenChange={(open) => {
          if (open === false) {
            setDeleting(undefined);
          }
        }}
      />
    </>
  );
};

const brandColors = ["base", "accent-1", "text"] as const;

/** The manager: the collections column beside the toolbar and the table. */
const VariablesManager = () => {
  const permit = useStore($authPermit);
  const registryState = useStore($variablesRegistryState);
  const isUnreadable = registryState.status === "unreadable";
  const readOnly = editPermits.has(permit) === false || isUnreadable;
  const projectId = useStore($project)?.id;
  const collections = useStore($variableCollections);
  // The remembered collection while it is listed, else the first.
  const [chosen, setChosen] = useState(() =>
    projectId === undefined ? undefined : readSelectedCollection(projectId)
  );
  const selectedId =
    collections.find((collection) => collection.id === chosen)?.id ??
    collections[0]?.id ??
    SITE_COLLECTION_ID;
  const [search, setSearch] = useState("");
  const [draftType, setDraftType] = useState<VariableType>();
  const [isSelecting, setIsSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [anchor, setAnchor] = useState<string>();

  const endSelect = () => {
    setIsSelecting(false);
    setSelected(new Set());
    setAnchor(undefined);
  };
  const select = (id: string) => {
    setChosen(id);
    setDraftType(undefined);
    endSelect();
    if (projectId !== undefined) {
      writeSelectedCollection(projectId, id);
    }
  };

  const selection: Selection = {
    active: isSelecting,
    selected,
    onToggle: (cssName, range, order) => {
      setSelected((current) => {
        const next = new Set(current);
        if (range && anchor !== undefined && order.includes(anchor)) {
          const from = order.indexOf(anchor);
          const to = order.indexOf(cssName);
          for (const name of order.slice(
            Math.min(from, to),
            Math.max(from, to) + 1
          )) {
            next.add(name);
          }
        } else if (next.has(cssName)) {
          next.delete(cssName);
        } else {
          next.add(cssName);
        }
        return next;
      });
      setAnchor(cssName);
    },
    onSetMany: (cssNames, on) => {
      setSelected((current) => {
        const next = new Set(current);
        for (const cssName of cssNames) {
          if (on) {
            next.add(cssName);
          } else {
            next.delete(cssName);
          }
        }
        return next;
      });
    },
  };

  const collection = collections.find((item) => item.id === selectedId);
  const allRows = collections.flatMap((item) => item.rows);
  const rowsByName = new Map(allRows.map((row) => [row.cssName, row]));
  const isBrand = selectedId === BRAND_COLLECTION_ID;
  const canAdd = readOnly === false && isBrand === false;
  const isSearching = search.trim() !== "";
  const rows =
    collection === undefined
      ? []
      : isSearching
        ? collection.rows.filter((row) =>
            matchesVariableSearch(
              row,
              // an alias matches by what it resolves to
              row.value?.type === "var"
                ? resolveRootVariable(row.cssName)
                : undefined,
              search
            )
          )
        : collection.rows;
  const brand = collections.find((item) => item.id === BRAND_COLLECTION_ID);
  const hasBrandValue = (cssName: string) =>
    brand?.rows.some(
      (row) => row.cssName === cssName && row.value !== undefined
    ) === true;
  // A new font takes the body font's first family (spec 5.4).
  const bodyFont = hasBrandValue("font-body")
    ? resolveRootVariable("font-body")
    : undefined;
  // The Brand contrast line (spec 5.7), from the resolved colours.
  const contrast = isBrand
    ? describeBrandContrast(
        Object.fromEntries(
          brandColors.flatMap(
            (cssName): Array<[string, StyleValue]> =>
              hasBrandValue(cssName)
                ? [[cssName, resolveRootVariable(cssName)]]
                : []
          )
        )
      )
    : undefined;

  return (
    <Flex
      data-variables-manager
      data-read-only={readOnly || undefined}
      css={{ height: "100%" }}
      onKeyDown={(event) => {
        // Escape leaves select mode first, and keeps the overlay open.
        if (
          event.key === "Escape" &&
          event.defaultPrevented === false &&
          isSelecting
        ) {
          event.preventDefault();
          endSelect();
        }
      }}
    >
      <CollectionsColumn
        collections={collections}
        selectedId={selectedId}
        readOnly={readOnly}
        onSelect={select}
      />
      <Flex direction="column" grow css={{ minWidth: 0 }}>
        <VariablesToolbar
          name={collection?.name ?? ""}
          canAdd={canAdd}
          search={search}
          onSearchChange={setSearch}
          onNewVariable={setDraftType}
          selectControl={
            <SelectControl
              collections={collections}
              selectedId={selectedId}
              selection={selection}
              rowsByName={rowsByName}
              onStart={() => setIsSelecting(true)}
              onEnd={endSelect}
              onClear={() => {
                setSelected(new Set());
                setAnchor(undefined);
              }}
            />
          }
        />
        {isUnreadable && (
          <Text css={{ px: theme.spacing[9] }}>Reload to edit variables</Text>
        )}
        {collection !== undefined && (
          <VariablesTable
            collection={collection}
            rows={rows}
            allRows={allRows}
            collections={collections}
            readOnly={readOnly}
            canAdd={canAdd}
            isSearching={isSearching}
            draftType={draftType}
            bodyFont={bodyFont}
            selection={selection}
            onDraftEnd={() => setDraftType(undefined)}
            onNewVariable={setDraftType}
          />
        )}
        {contrast !== undefined && (
          <Text
            color="destructive"
            data-brand-contrast
            css={{ px: theme.spacing[9], py: theme.spacing[5] }}
          >
            {contrast}
          </Text>
        )}
      </Flex>
    </Flex>
  );
};

/**
 * The Variables overlay on the rail-overlay host, in Design mode only (spec
 * 5.1). The manager renders only while it is open.
 */
export const VariablesOverlay = () => {
  const isDesignMode = useStore($isDesignMode);
  const isOpen = useStore($openRailOverlay) === "variables";
  return (
    <RailOverlay
      name="variables"
      isAvailable={isDesignMode}
      allowCommands={OVERLAY_ALLOWED_COMMANDS}
    >
      {isOpen && <VariablesManager />}
    </RailOverlay>
  );
};
