import { useStore } from "@nanostores/react";
import {
  Flex,
  PanelTitle,
  Text,
  cssVar,
  theme,
} from "@webstudio-is/design-system";
import { $authPermit, $isDesignMode } from "~/shared/nano-states";
import {
  $openRailOverlay,
  RailOverlay,
} from "~/builder/features/rail-overlay/rail-overlay";
import { $variablesRegistryState } from "./reader";

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
  return (
    <Flex
      data-variables-manager
      data-read-only={readOnly || undefined}
      css={{ height: "100%" }}
    >
      <Flex
        direction="column"
        css={{
          width: theme.spacing[30],
          flexShrink: 0,
          borderRight: `1px solid ${cssVar("--border-default")}`,
        }}
      >
        <PanelTitle>Variables</PanelTitle>
      </Flex>
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
