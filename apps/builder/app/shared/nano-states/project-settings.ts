import { atom } from "nanostores";

export type SectionName =
  | "general"
  | "emails"
  | "agents"
  | "auth"
  | "headers"
  | "redirects"
  | "publish"
  | "backups"
  // OrganizeOS fork: the org-only Domains section
  // (shared/project-settings/section-domains.tsx).
  | "domains";

export const $openProjectSettings = atom<SectionName | undefined>();
