/**
 * The native screen's nanostores, in a module of their own so the overlay
 * can read them without importing the screen (and Lexical) into its chunk.
 */
import { atom } from "nanostores";

/**
 * The native editor's unsaved flag. W2 makes `$cmsDirty` the computed of
 * `$cmsFrameDirty` and this (4.3.2); clearing one never clears the other.
 */
export const $cmsNativeDirty = atom(false);
