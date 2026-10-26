import {
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ElementRef,
  type RefObject,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { CanvasCheck } from "../form/canvas-check";
import { useMergedRef } from "../form/merge-ref";
import {
  MarqueeContext,
  useMarqueeParts,
  type MarqueeParts,
  type MarqueeRoot,
} from "./context";
import { checkMarqueeStructure } from "./structure";
import { useMarquee } from "./use-marquee";

export const structureProblem =
  "Marquee needs one Marquee Pause Button as its first child and one Marquee Track after it, both directly inside it.";

/**
 * On the canvas only, whether the parts are in place (spec 12.7), checked
 * again as the designer moves them.
 */
const useCanvasStructure = (
  rootRef: RefObject<HTMLElement | null>,
  parts: MarqueeParts,
  canvas: boolean
) => {
  const [holds, setHolds] = useState(true);
  useEffect(() => {
    const root = rootRef.current;
    if (canvas === false) {
      return;
    }
    const check = () =>
      setHolds(checkMarqueeStructure(root, parts.buttons, parts.tracks));
    check();
    if (root === null || typeof MutationObserver !== "function") {
      return;
    }
    const observer = new MutationObserver(check);
    observer.observe(root, { childList: true });
    return () => observer.disconnect();
  }, [rootRef, parts, canvas]);
  return holds;
};

type Props = ComponentProps<"div"> & {
  /** px per second, clamped to 10..200 by the runtime */
  speed?: number;
  /** "left" or "right"; unset, the reading direction's */
  direction?: string;
};

/**
 * Marquee: a root that drifts its Marquee Track's items in a seamless loop
 * behind its Marquee Pause Button (spec 4). The parts register through a
 * context; the motion is `useMarquee`'s.
 *
 * The server renders the items once, in a row the root clips; the clones
 * the motion needs are made after hydration, never on the canvas.
 */
export const Marquee = forwardRef<ElementRef<"div">, Props>(
  ({ speed, direction, children, ...props }, ref) => {
    const { renderer } = useContext(ReactSdkContext);
    const canvas = renderer === "canvas";
    const rootRef = useRef<HTMLDivElement | null>(null);
    const mergedRef = useMergedRef(ref, rootRef);
    const { parts, register } = useMarqueeParts();
    const { state, toggle } = useMarquee({
      rootRef,
      parts,
      speed,
      direction,
      enabled: canvas === false,
    });
    const holds = useCanvasStructure(rootRef, parts, canvas);
    const value = useMemo<MarqueeRoot>(
      () => ({ register, state, toggle }),
      [register, state, toggle]
    );
    return (
      <div {...props} ref={mergedRef}>
        <MarqueeContext.Provider value={value}>
          {children}
        </MarqueeContext.Provider>
        <CanvasCheck
          title="Marquee"
          problems={holds ? [] : [structureProblem]}
        />
      </div>
    );
  }
);

Marquee.displayName = "Marquee";
