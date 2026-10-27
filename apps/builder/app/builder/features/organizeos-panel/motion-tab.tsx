import { computed } from "nanostores";
import { useStore } from "@nanostores/react";
import type { Instance } from "@webstudio-is/sdk";
import {
  theme,
  Flex,
  PanelTabsContent,
  PanelTabsTrigger,
  ScrollArea,
  Text,
} from "@webstudio-is/design-system";
import {
  $isDesignMode,
  $organizeosSite,
  $selectedBreakpoint,
  $selectedPage,
} from "~/shared/nano-states";
import {
  getInstanceLabel,
  InstanceIcon,
} from "~/builder/shared/instance-label";
import { PropsSectionContainer } from "~/builder/features/settings-panel/props-section/props-section";
import { animateChildrenComponent, Motion } from "./motion";

/**
 * The Inspector's Motion tab (panel overhaul spec 5.4), after Style and
 * Settings, mounted by marked lines in builder/inspector.tsx. It holds the
 * motion presets (motion.tsx) for the selected instance and, for a selected
 * Animate Children, upstream's Animation editor below them, by rendering
 * upstream's own PropsSectionContainer. Offered for an org on the blocks'
 * allowlist, in design mode, on an HTML page.
 */

/** Whether the Inspector offers the Motion tab. */
export const $isMotionTabAvailable = computed(
  [$organizeosSite, $isDesignMode, $selectedPage],
  (site, isDesignMode, page) =>
    site?.blocksEnabled === true &&
    isDesignMode &&
    // as the Inspector defaults the document type
    (page?.meta.documentType ?? "html") === "html"
);

// The Inspector's tab content style, which it keeps private.
const contentStyle = {
  display: "flex",
  flexDirection: "column",
  overflow: "auto",
};

export const MotionTabTrigger = () => (
  <PanelTabsTrigger value="motion">Motion</PanelTabsTrigger>
);

/** The selected instance's icon and label, as the Inspector's other tabs show it. */
const InstanceRow = ({ instance }: { instance: Instance }) => (
  <Flex
    justify="between"
    align="center"
    shrink={false}
    css={{
      paddingInline: theme.panel.paddingInline,
      height: theme.spacing[13],
    }}
  >
    <Flex gap="1" align="center">
      <Flex shrink={false}>
        <InstanceIcon instance={instance} />
      </Flex>
      <Text truncate variant="labels">
        {getInstanceLabel(instance)}
      </Text>
    </Flex>
  </Flex>
);

/**
 * Every subscription of the tab lives here, inside the tab's content, which
 * Radix mounts only while the tab is active.
 */
const MotionTabBody = ({
  instance,
  instanceKey,
}: {
  instance: Instance;
  instanceKey: string;
}) => {
  const selectedBreakpoint = useStore($selectedBreakpoint);
  // Upstream's PropsSection renders the Animation section alone only while a
  // breakpoint is selected (it is undefined only in a project with no
  // breakpoints); otherwise it renders the whole props panel, so the tab
  // renders nothing below Stagger.
  const editor =
    instance.component === animateChildrenComponent &&
    selectedBreakpoint !== undefined ? (
      <PropsSectionContainer
        // Re-render when instance changes, as Settings does
        key={instance.id}
        selectedInstance={instance}
        selectedInstanceKey={instanceKey}
      />
    ) : undefined;
  return (
    <ScrollArea>
      <InstanceRow instance={instance} />
      <Motion editor={editor} />
    </ScrollArea>
  );
};

export const MotionTabContent = ({
  instance,
  instanceKey,
}: {
  instance: Instance;
  instanceKey: string;
}) => (
  <PanelTabsContent value="motion" css={contentStyle} tabIndex={-1}>
    <MotionTabBody instance={instance} instanceKey={instanceKey} />
  </PanelTabsContent>
);
