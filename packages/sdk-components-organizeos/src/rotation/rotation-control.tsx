import {
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ElementRef,
  type RefObject,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { CanvasCheck } from "../form/canvas-check";
import { useMergedRef } from "../form/merge-ref";
import { checkRotationStructure } from "./structure";
import { useFade } from "./use-fade";
import { useRotation } from "./use-rotation";

export const structureProblem =
  "Rotating Tabs needs this control as the first child of a Tabs, and its panels hidden when inactive.";

/**
 * On the canvas only, whether the structure around the button holds (spec
 * 5.4), checked again as the designer edits the section: a change to its
 * children, or to an element's style, class or state, below the root.
 */
const useCanvasStructure = (
  buttonRef: RefObject<HTMLElement | null>,
  canvas: boolean
) => {
  const [holds, setHolds] = useState(true);
  useEffect(() => {
    const button = buttonRef.current;
    const root = button?.parentElement ?? null;
    if (canvas === false) {
      return;
    }
    const check = () => setHolds(checkRotationStructure(root, button));
    check();
    if (root === null || typeof MutationObserver !== "function") {
      return;
    }
    const observer = new MutationObserver(check);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-state"],
    });
    return () => observer.disconnect();
  }, [buttonRef, canvas]);
  return holds;
};

type Props = Omit<ComponentProps<"button">, "value" | "children"> & {
  /** seconds between advances, clamped to 3..20 by the runtime */
  interval?: number;
  /** ms the incoming panel fades in, clamped to 0..600 by the runtime; 0 is off */
  fade?: number;
  pauseLabel?: string;
  playLabel?: string;
  /** the Tabs' selected value, bound to the variable Tabs' `value` reads */
  value?: string;
  /** sets that variable */
  onValueChange?: (value: string) => void;
};

/**
 * Rotation Control: the Pause/Play button of Rotating Tabs, first child of
 * upstream's Tabs, and the rotation behind it (`useRotation`).
 *
 * The button renders `hidden` until rotation runs, so the server markup and
 * a page without JavaScript show no inert control, and it hides again when
 * rotation will not run. On the canvas rotation never runs, and the button
 * always shows its Pause label so the designer can select and style it.
 *
 * While rotation can run, the panel that becomes active, by rotation or by a
 * visitor's choice, fades in over `fade` ms (`useFade`).
 */
export const RotationControl = forwardRef<ElementRef<"button">, Props>(
  (
    {
      interval,
      fade = 250,
      pauseLabel = "Pause",
      playLabel = "Play",
      value,
      onValueChange,
      onClick,
      style,
      ...props
    },
    ref
  ) => {
    const { renderer } = useContext(ReactSdkContext);
    const canvas = renderer === "canvas";
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const mergedRef = useMergedRef(ref, buttonRef);
    const { state, toggle } = useRotation({
      buttonRef,
      value,
      onValueChange,
      interval,
      enabled: canvas === false,
    });
    // "off" on the canvas, under reduced motion and until after mount
    useFade({ buttonRef, enabled: state !== "off", fade });
    const holds = useCanvasStructure(buttonRef, canvas);
    const hidden = canvas === false && state === "off";
    return (
      <>
        <button
          {...props}
          type="button"
          hidden={hidden}
          // a display the designer styles would show a `hidden` button
          style={hidden ? { ...style, display: "none" } : style}
          onClick={(event) => {
            onClick?.(event);
            toggle();
          }}
          ref={mergedRef}
        >
          {state === "stopped" ? playLabel : pauseLabel}
        </button>
        <CanvasCheck
          title="Rotation Control"
          problems={holds ? [] : [structureProblem]}
        />
      </>
    );
  }
);

RotationControl.displayName = "RotationControl";
