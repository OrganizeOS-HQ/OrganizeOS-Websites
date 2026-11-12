/**
 * The native screen's nanostores. `native/` imports `cms-panel.tsx` for types
 * only, and `cms-panel.tsx` imports from `native/` only this module,
 * `cms-canvas.ts` and `cms-native-screen.tsx`, so the flags both sides share
 * live here. Lexical stays out of the first load through `field-controls.tsx`,
 * which loads the rich-text field lazily.
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
