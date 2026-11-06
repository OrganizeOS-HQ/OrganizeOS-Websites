import type { Instance } from "@webstudio-is/sdk";
import { SettingsSection } from "./settings-section";
import { PropsSectionContainer } from "./props-section/props-section";
import { VariablesSection } from "./variables-section";
import { Box, PanelBanner, Text, theme } from "@webstudio-is/design-system";
import { useStore } from "@nanostores/react";
import { $isDesignMode, $permissions } from "~/shared/nano-states";
import { $dataSources, $instances, $props } from "~/shared/sync/data-stores";
import { ExpressionCompletionScopeContext } from "~/builder/shared/expression-editor";
import { getFormProgressCompletionScope } from "./form-context-preview";
import { useCallback } from "react";
import { planUpgradeHint } from "~/shared/branding";

export const SettingsPanel = ({
  selectedInstance,
  selectedInstanceKey,
}: {
  selectedInstance: Instance;
  selectedInstanceKey: string;
}) => {
  const { allowDynamicData } = useStore($permissions);
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

        {/* OrganizeOS fork: upstream sold its CMS here, with marketing artwork
            and a "CMS on custom domains / preview on staging on any plan" pitch.
            An OrganizeOS site has one address and no staging, so that sentence
            was simply untrue; this is the only plan gate an org can trip. */}
        {allowDynamicData === false && (
          <PanelBanner>
            <Text variant="regularBold">
              Binding external data is not included in your plan
            </Text>
            <Text>{planUpgradeHint}</Text>
          </PanelBanner>
        )}
      </Box>
    </ExpressionCompletionScopeContext.Provider>
  );
};
