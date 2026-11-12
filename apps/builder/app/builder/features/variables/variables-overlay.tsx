import { useState } from "react";
import { useStore } from "@nanostores/react";
import { Flex, Text, theme } from "@webstudio-is/design-system";
import { SITE_COLLECTION_ID } from "@webstudio-is/project-build";
import { $authPermit, $isDesignMode } from "~/shared/nano-states";
import { $project } from "~/shared/sync/data-stores";
import {
  $openRailOverlay,
  RailOverlay,
} from "~/builder/features/rail-overlay/rail-overlay";
import { $variableCollections, $variablesRegistryState } from "./reader";
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
  const select = (id: string) => {
    setChosen(id);
    if (projectId !== undefined) {
      writeSelectedCollection(projectId, id);
    }
  };
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
        <Flex
          align="center"
          css={{ height: theme.spacing[15], flexShrink: 0 }}
        />
        {isUnreadable && (
          <Text css={{ px: theme.spacing[9] }}>Reload to edit variables</Text>
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
