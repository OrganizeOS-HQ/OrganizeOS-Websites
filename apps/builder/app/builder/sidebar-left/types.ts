export const sidebarPanelNames = [
  "assets",
  "components",
  "navigator",
  // OrganizeOS fork: the OrganizeOS data tab. The CMS is a rail button, not a
  // panel (builder/features/cms-panel).
  "organizeos",
  "pages",
] as const;

export type SidebarPanelName = (typeof sidebarPanelNames)[number] | "none";
