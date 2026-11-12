import type { StyleSource } from "@webstudio-is/sdk";
import { isStyleSourceLocked } from "@webstudio-is/project-build/runtime";
import {
  $selectedBreakpoint,
  $selectedInstance,
  $selectedOrLastStyleSourceSelector,
  $selectedStyleSource,
} from "~/shared/nano-states";

/** Where a Style panel edit writes: the instance, breakpoint, state, source. */
export type BindTarget = {
  instanceId: string;
  breakpointId: string;
  state: string | undefined;
  styleSource: StyleSource;
};

/**
 * The target of "New variable from this value" (spec 4.10). It reads the
 * four stores publishUpdates reads, and refuses where publishUpdates refuses
 * (features/style-panel/shared/use-style-data.ts): nothing selected, or a
 * locked token, whose writes publishUpdates drops. A test holds the two to
 * the same target; publishUpdates itself cannot run inside an accumulator.
 */
export const resolveBindTarget = (): BindTarget | undefined => {
  const instance = $selectedInstance.get();
  const breakpoint = $selectedBreakpoint.get();
  const styleSource = $selectedStyleSource.get();
  const selector = $selectedOrLastStyleSourceSelector.get();
  if (
    instance === undefined ||
    breakpoint === undefined ||
    styleSource === undefined ||
    selector === undefined ||
    isStyleSourceLocked(styleSource)
  ) {
    return;
  }
  return {
    instanceId: instance.id,
    breakpointId: breakpoint.id,
    state: selector.state,
    styleSource,
  };
};
