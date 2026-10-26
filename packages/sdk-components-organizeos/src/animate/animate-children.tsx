import {
  forwardRef,
  useContext,
  useRef,
  type ComponentProps,
  type ElementRef,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { CanvasCheck } from "../form/canvas-check";
import { useMergedRef } from "../form/merge-ref";
import { canPlayOnCanvasProperty } from "./flag";
import { isPinned } from "./play-action";
import { useAnimate } from "./use-animate";

type Props = ComponentProps<"div"> & {
  /** upstream's `animationAction`, edited in its Animation section */
  action?: unknown;
  /** percent of the range between one child's start and the next, 0..20 */
  stagger?: number;
  /** the canvas play flag, set by the builder while the instance is selected */
  [canPlayOnCanvasProperty]?: boolean;
};

/**
 * Animate Children: plays its `action` on each of its element children with
 * native scroll and view timelines (spec 4.1, 4.2). A `div` styled
 * `display: contents` by its preset, so wrapping a section keeps its layout.
 *
 * The server renders the children as they are; the player attaches after
 * hydration. On the canvas it plays only while selected in the Navigator or
 * with the action's "Run on canvas" on, and notes what does not play.
 */
export const AnimateChildren = forwardRef<ElementRef<"div">, Props>(
  (
    {
      action,
      stagger,
      [canPlayOnCanvasProperty]: canPlayOnCanvas,
      children,
      ...props
    },
    ref
  ) => {
    const { renderer } = useContext(ReactSdkContext);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const mergedRef = useMergedRef(ref, rootRef);
    const canPlay =
      renderer !== "canvas" || canPlayOnCanvas === true || isPinned(action);
    const notes = useAnimate({ rootRef, action, stagger, canPlay });
    return (
      <div {...props} ref={mergedRef}>
        {children}
        <CanvasCheck title="Animate Children" problems={[]} notes={notes} />
      </div>
    );
  }
);

AnimateChildren.displayName = "AnimateChildren";
