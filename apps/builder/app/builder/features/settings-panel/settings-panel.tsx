import type { Instance } from "@webstudio-is/sdk";
import { SettingsSection } from "./settings-section";
import { PropsSectionContainer } from "./props-section/props-section";
import { VariablesSection } from "./variables-section";
import { Box, theme } from "@webstudio-is/design-system";
import { useStore } from "@nanostores/react";
import { $isDesignMode } from "~/shared/nano-states";
import { $dataSources, $instances, $props } from "~/shared/sync/data-stores";
import { ExpressionCompletionScopeContext } from "~/builder/shared/expression-editor";
import { getFormProgressCompletionScope } from "./form-context-preview";
import { useCallback } from "react";

export const SettingsPanel = ({
  selectedInstance,
  selectedInstanceKey,
}: {
  selectedInstance: Instance;
  selectedInstanceKey: string;
}) => {
  const isDesignMode = useStore($isDesignMode);
  const instances = useStore($instances);
  const props = useStore($props);
  const dataSources = useStore($dataSources);
  const resolveCompletionScope = useCallback(
    (scope: Record<string, unknown>) =>
      getFormProgressCompletionScope({ instances, props, dataSources, scope }),
    [instances, props, dataSources]
  );

  return (
    <ExpressionCompletionScopeContext.Provider value={resolveCompletionScope}>
      <Box css={{ pt: theme.spacing[5] }}>
        <SettingsSection />

        <PropsSectionContainer
          selectedInstance={selectedInstance}
          selectedInstanceKey={selectedInstanceKey}
        />

        {isDesignMode && <VariablesSection />}
      </Box>
    </ExpressionCompletionScopeContext.Provider>
  );
};
