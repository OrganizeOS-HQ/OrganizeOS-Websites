import { atom } from "nanostores";

/**
 * Whether the Pages panel's New page has opened the New page screen
 * (new-page-screen.tsx). A module of its own, so upstream's pages.tsx imports
 * one store and none of the screen.
 */
export const $newPageScreenOpen = atom(false);
