import { atom } from "nanostores";

export type SectionName =
  | "general"
  | "emails"
  | "agents"
  | "auth"
  | "headers"
  | "redirects"
  | "publish"
  | "backups";

export const $openProjectSettings = atom<SectionName | undefined>();
