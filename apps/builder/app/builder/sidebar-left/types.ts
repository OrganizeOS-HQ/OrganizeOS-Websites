export const sidebarPanelNames = [
  "assets",
  // OrganizeOS fork: the CMS panel, in the OrganizeOS data tab's slot.
  "cms",
  "components",
  "navigator",
  // OrganizeOS fork: the OrganizeOS data tab, where the CMS panel is off.
  "organizeos",
  "pages",
] as const;

export type SidebarPanelName = (typeof sidebarPanelNames)[number] | "none";
