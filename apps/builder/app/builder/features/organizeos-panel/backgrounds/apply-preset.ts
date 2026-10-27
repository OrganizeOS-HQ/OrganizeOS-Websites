import {
  $selectedInstance,
  $selectedInstanceStyleSources,
  $selectedStyleSources,
  $selectedStyleState,
} from "~/shared/nano-states";
import { createBatchUpdate } from "~/builder/features/style-panel/shared/use-style-data";
import { layerProperties, type PresetStyles } from "./presets";

/**
 * Applies a preset's styles to the selected instance (spec 3.2).
 *
 * It acts on the selected instance because upstream's style writes do:
 * `createBatchUpdate` publishes to `$selectedInstance` at
 * `$selectedBreakpoint`, into the selected style source and state.
 *
 * 1. Selects the instance's local style source and the base state, so the
 *    write never lands on a token (a locked token would silently drop it)
 *    or on `:hover`, and the style panel shows what was written. These are
 *    the few lines of upstream's module-private `selectStyleSource`
 *    (`style-panel/style-source-section.tsx`), re-implemented here rather
 *    than exported. The selection is not part of the transaction, so undo
 *    restores the styles and leaves Local selected.
 * 2. In one batch, so one transaction and one undo step: deletes
 *    `background-color` and the nine layer lists, then sets the preset's
 *    values. Deleting first means a property the preset does not write
 *    cannot survive from an earlier background.
 *
 * With no selected instance it does nothing.
 */
export const applyPreset = (styles: PresetStyles): void => {
  const instance = $selectedInstance.get();
  if (instance === undefined) {
    return;
  }
  // $selectedInstanceStyleSources always ends with a local source, generated
  // (and persisted by the first write) when the instance has none yet
  const local = $selectedInstanceStyleSources
    .get()
    .find((styleSource) => styleSource.type === "local");
  if (local === undefined) {
    return;
  }
  const selectedStyleSources = new Map($selectedStyleSources.get());
  selectedStyleSources.set(instance.id, local.id);
  $selectedStyleSources.set(selectedStyleSources);
  $selectedStyleState.set(undefined);

  const batch = createBatchUpdate();
  batch.deleteProperty("background-color");
  for (const property of layerProperties) {
    batch.deleteProperty(property);
  }
  for (const { property, value } of styles) {
    batch.setProperty(property)(value);
  }
  batch.publish();
};
