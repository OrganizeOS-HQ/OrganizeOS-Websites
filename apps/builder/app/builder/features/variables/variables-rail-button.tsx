import { useStore } from "@nanostores/react";
import { rawTheme } from "@webstudio-is/design-system";
import { $isDesignMode } from "~/shared/nano-states";
import { RailOverlayButton } from "~/builder/features/rail-overlay/rail-overlay";
import { VariablesIcon } from "./variables-icon";

/** The rail's Variables button, in Design mode only (spec 5.1). */
export const VariablesRailButton = () => (
  <RailOverlayButton
    name="variables"
    label="Variables"
    isAvailable={useStore($isDesignMode)}
  >
    <VariablesIcon size={rawTheme.spacing[10]} />
  </RailOverlayButton>
);
