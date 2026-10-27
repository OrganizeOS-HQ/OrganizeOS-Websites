import { useStore } from "@nanostores/react";
import type { CssProperty } from "@webstudio-is/css-engine";
import { $organizeosSite } from "~/shared/nano-states";
import { CollapsibleSection } from "~/builder/shared/collapsible-section";
import { $sectionSelector, SectionBackground } from "./section-background";

/**
 * The Style panel's "Background presets" section, one marked entry in
 * upstream's section map (style-panel/sections/sections.ts), directly after
 * Backgrounds (panel overhaul spec 5.2). Its content is section-background.tsx.
 *
 * Shown only for an org not denied the blocks and a selection that can take
 * a section background (not Global Root, the page root or the Body);
 * otherwise it renders nothing and the Style panel is upstream's. Radix mounts
 * a collapsible section's content only while it is open, so a closed section
 * computes no contrast report. Like every section but Advanced, the Style
 * panel skips it in advanced mode. It does not read the Style panel's
 * read-only state: the presets write the Local source, never a locked token.
 */

/**
 * The map's properties feed only the Advanced section's list of properties
 * shown elsewhere, and upstream's Backgrounds already lists the background
 * longhands.
 */
export const properties: CssProperty[] = [];

export const Section = () => {
  const site = useStore($organizeosSite);
  const selector = useStore($sectionSelector);
  if (site?.blocksEnabled !== true || selector === undefined) {
    return;
  }
  return (
    <CollapsibleSection label="Background presets" fullWidth>
      <SectionBackground />
    </CollapsibleSection>
  );
};
