import {
  $selectedBreakpoint,
  $selectedInstance,
  $selectedInstanceStyleSources,
  $selectedStyleSources,
  $selectedStyleState,
} from "~/shared/nano-states";
import { $breakpoints, $styleSources } from "~/shared/sync/data-stores";
import { getComputedStyleDecl } from "~/shared/style-object-model";
import type { InstanceSelector } from "~/shared/instance-utils/tree";
import { createBatchUpdate } from "~/builder/features/style-panel/shared/use-style-data";
import { layerProperties, type PresetStyles } from "./presets";
import { buildSectionStyleModel } from "./style-model";

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

export type BackgroundOrigin = {
  /**
   * Where the element's current background comes from, at the current
   * breakpoint and base state:
   * - none: no background of its own (defaults or a component preset);
   * - local: its local style source, at this breakpoint;
   * - token: a token, named in `label`;
   * - breakpoint: its local style source at another breakpoint, named in
   *   `label`.
   */
  kind: "none" | "local" | "token" | "breakpoint";
  label?: string;
};

const originPriority: Record<BackgroundOrigin["kind"], number> = {
  none: 0,
  local: 1,
  breakpoint: 2,
  token: 3,
};

/**
 * Where the instance's `background-color` and `background-image` come from
 * now, for the notice shown before a preset is applied ("This element's
 * background comes from the token X..."). When the two differ, a token wins
 * over another breakpoint, which wins over local.
 */
export const describeBackgroundOrigin = (
  instanceSelector: InstanceSelector
): BackgroundOrigin => {
  const model = buildSectionStyleModel(instanceSelector);
  const styleSources = $styleSources.get();
  const breakpoints = $breakpoints.get();
  const selectedBreakpointId = $selectedBreakpoint.get()?.id;
  let origin: BackgroundOrigin = { kind: "none" };
  for (const property of ["background-color", "background-image"] as const) {
    const { source } = getComputedStyleDecl({
      model,
      instanceSelector,
      property,
    });
    if (source.styleSourceId === undefined) {
      // a browser default or the component's preset
      continue;
    }
    const styleSource = styleSources.get(source.styleSourceId);
    let next: BackgroundOrigin;
    if (styleSource?.type === "token") {
      next = { kind: "token", label: styleSource.name };
    } else if (source.breakpointId !== selectedBreakpointId) {
      const breakpoint =
        source.breakpointId === undefined
          ? undefined
          : breakpoints.get(source.breakpointId);
      next = { kind: "breakpoint", label: breakpoint?.label };
    } else {
      next = { kind: "local" };
    }
    if (originPriority[next.kind] > originPriority[origin.kind]) {
      origin = next;
    }
  }
  return origin;
};
