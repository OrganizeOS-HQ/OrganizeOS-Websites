import {
  type Hook,
  type HookContext,
  type InstanceData,
  getClosestInstance,
} from "@webstudio-is/react-sdk/runtime";
import { canPlayOnCanvasProperty } from "./animate/flag";

const animateChildren = "@organizeos/site-components:AnimateChildren";

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
 * The canvas play flag (spec 4.5, 14.9): an Animate Children plays on the
 * canvas while it, or an instance inside it, is selected in the Navigator.
 * Every select and unselect first clears the instance flagged last, so a
 * wrapper removed by undo and brought back by redo is never left playing.
 */
export const hooksAnimateChildren: Hook = {
  onNavigatorSelect: (context, event) => {
    clearLastFlagged(context);
    const [selected] = event.instancePath;
    if (selected === undefined) {
      return;
    }
    const closest = getClosestInstance(
      event.instancePath,
      selected,
      animateChildren
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

export const hooks: Hook[] = [hooksAnimateChildren];
