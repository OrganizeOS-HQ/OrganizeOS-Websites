/**
 * The native screen's nanostores, in a module of their own so the overlay
 * can read them without importing the screen (and Lexical) into its chunk.
 */
import { atom } from "nanostores";

/**
 * The native editor's unsaved flag. `$cmsDirty` is the computed of
 * `$cmsFrameDirty` and this (4.3.2); clearing one never clears the other.
 */
export const $cmsNativeDirty = atom(false);

/**
 * Bumped when the classic frame wrote (`cms.item_saved`,
 * `cms.collection_changed`): the native screen refetches its lists.
 */
export const $cmsNativeRefresh = atom(0);

export const refreshCmsNative = () => {
  $cmsNativeRefresh.set($cmsNativeRefresh.get() + 1);
};
