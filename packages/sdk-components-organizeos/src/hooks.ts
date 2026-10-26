import type {
  Hook,
  HookContext,
  InstanceData,
} from "@webstudio-is/react-sdk/runtime";
import { canPlayOnCanvasProperty } from "./animate/flag";

/** The blocks that play on the canvas while selected: they read the flag. */
const players = new Set([
  "@organizeos/site-components:AnimateChildren",
  "@organizeos/site-components:ConvergenceField",
]);

/** The instance the hook flagged last, so it is always the one cleared. */
let lastFlagged: InstanceData | undefined;

const clearLastFlagged = (context: HookContext) => {
  if (lastFlagged !== undefined) {
    // deletes by instance key, whether or not the instance still exists
    context.setMemoryProp(lastFlagged, canPlayOnCanvasProperty, undefined);
    lastFlagged = undefined;
  }
};

/**
 * The canvas play flag (spec 4.5, 14.9; field spec 10.4): an Animate
 * Children or a Convergence Field plays on the canvas while it, or an
 * instance inside it, is selected in the Navigator. The walk goes from the
 * selected instance outward and flags the first of either it meets, so the
 * nearest wins when one is nested in the other. Every select and unselect
 * first clears the instance flagged last, so a block removed by undo and
 * brought back by redo is never left playing.
 */
export const hooksCanvasPlay: Hook = {
  onNavigatorSelect: (context, event) => {
    clearLastFlagged(context);
    const closest = event.instancePath.find((instance) =>
      players.has(instance.component)
    );
    if (closest !== undefined) {
      context.setMemoryProp(closest, canPlayOnCanvasProperty, true);
      lastFlagged = closest;
    }
  },
  onNavigatorUnselect: (context) => {
    clearLastFlagged(context);
  },
};

export const hooks: Hook[] = [hooksCanvasPlay];
