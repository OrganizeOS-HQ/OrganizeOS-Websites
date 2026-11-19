import { sidebarPanelNames } from "~/builder/sidebar-left/types";

/**
 * OrganizeOS fork: stored settings with the widths of panels that are no
 * longer panel names dropped, such as the OrganizeOS data tab's
 * ("organizeos"). The settings' parse checks `sidebarPanelWidths` against
 * the panel names and falls back to every default on any error, so one
 * stale width would reset every setting. Anything that is not a plain
 * object of widths is returned as it is, for the parse to judge.
 */
export const dropUnknownPanelWidths = (stored: unknown): unknown => {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) {
    return stored;
  }
  const { sidebarPanelWidths: widths } = stored as Record<string, unknown>;
  if (typeof widths !== "object" || widths === null || Array.isArray(widths)) {
    return stored;
  }
  const names: readonly string[] = sidebarPanelNames;
  return {
    ...stored,
    sidebarPanelWidths: Object.fromEntries(
      Object.entries(widths).filter(([name]) => names.includes(name))
    ),
  };
};
