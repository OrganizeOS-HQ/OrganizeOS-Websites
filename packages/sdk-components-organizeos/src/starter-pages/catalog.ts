import type { StarterPage } from "./types";

/**
 * Every page template, in the New page screen's order. Empty until the first
 * page templates join as drafts (Fork C2); each is listed once the owner has
 * seen its pictures.
 */
export const STARTER_PAGES: StarterPage[] = [];

/** The listed page templates, in catalog order. */
export const listedStarterPages = (
  pages: readonly StarterPage[] = STARTER_PAGES
): StarterPage[] => pages.filter((page) => page.status === "listed");
