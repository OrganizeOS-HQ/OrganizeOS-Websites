export const sidebarPanelNames = [
  "assets",
  "components",
  "navigator",
  // OrganizeOS fork: the OrganizeOS tab (the CMS tab takes this slot).
  "organizeos",
  "pages",
] as const;

export type SidebarPanelName = (typeof sidebarPanelNames)[number] | "none";
