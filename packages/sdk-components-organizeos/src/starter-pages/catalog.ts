import { aboutStarterPage } from "./about";
import { contactStarterPage } from "./contact";
import { donateStarterPage } from "./donate";
import { eventStarterPage } from "./event";
import { eventsStarterPage } from "./events";
import { fundraiserStarterPage } from "./fundraiser";
import { joinStarterPage } from "./join";
import type { StarterPage } from "./types";
import { volunteerStarterPage } from "./volunteer";

/**
 * Every page template, in the New page screen's order (spec 6.2). Each is a
 * draft until the owner has seen its pictures (inventory rule 12), then
 * listed (Fork D).
 */
export const STARTER_PAGES: StarterPage[] = [
  eventsStarterPage,
  eventStarterPage,
  donateStarterPage,
  fundraiserStarterPage,
  joinStarterPage,
  volunteerStarterPage,
  aboutStarterPage,
  contactStarterPage,
];

/** The listed page templates, in catalog order. */
export const listedStarterPages = (
  pages: readonly StarterPage[] = STARTER_PAGES
): StarterPage[] => pages.filter((page) => page.status === "listed");
