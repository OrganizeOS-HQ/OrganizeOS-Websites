import { useState } from "react";
import { useStore } from "@nanostores/react";
import { Flex, Text, theme } from "@webstudio-is/design-system";
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
} from "./reader";
import { matchesVariableSearch } from "./search";
import { VariablesToolbar } from "./variables-toolbar";
import { VariablesTable } from "./variables-table";
import { CollectionsColumn } from "./collections-column";
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
  const select = (id: string) => {
    setChosen(id);
    setDraftType(undefined);
    if (projectId !== undefined) {
      writeSelectedCollection(projectId, id);
    }
  };
  const collection = collections.find((item) => item.id === selectedId);
  const allRows = collections.flatMap((item) => item.rows);
  const canAdd = readOnly === false && selectedId !== BRAND_COLLECTION_ID;
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
  // A new font takes the body font's first family (spec 5.4).
  const hasBodyFont = collections.some(
    (item) =>
      item.id === BRAND_COLLECTION_ID &&
      item.rows.some(
        (row) => row.cssName === "font-body" && row.value !== undefined
      )
  );
  const bodyFont = hasBodyFont ? resolveRootVariable("font-body") : undefined;
  return (
    <Flex
      data-variables-manager
      data-read-only={readOnly || undefined}
      css={{ height: "100%" }}
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
        />
        {isUnreadable && (
          <Text css={{ px: theme.spacing[9] }}>Reload to edit variables</Text>
        )}
        {collection !== undefined && (
          <VariablesTable
            collection={collection}
            rows={rows}
            allRows={allRows}
            readOnly={readOnly}
            canAdd={canAdd}
            isSearching={isSearching}
            draftType={draftType}
            bodyFont={bodyFont}
            onDraftEnd={() => setDraftType(undefined)}
            onNewVariable={setDraftType}
          />
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
