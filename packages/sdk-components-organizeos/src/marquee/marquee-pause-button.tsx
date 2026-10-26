import {
  forwardRef,
  useContext,
  useRef,
  type ComponentProps,
  type ElementRef,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { useMergedRef } from "../form/merge-ref";
import { MarqueeContext, useRegisterMarqueePart } from "./context";

type Props = Omit<ComponentProps<"button">, "children"> & {
  pauseLabel?: string;
  playLabel?: string;
};

/**
 * Marquee Pause Button: the Pause and Play control the Marquee's motion
 * needs (WCAG 2.2.2), first in the root's tab order.
 *
 * It renders `hidden` until the marquee moves, so the server markup and a
 * page without JavaScript show no inert control, and hides again when it
 * stops moving for good. On the canvas it always shows its Pause label so
 * the designer can select and style it.
 */
export const MarqueePauseButton = forwardRef<ElementRef<"button">, Props>(
  (
    { pauseLabel = "Pause", playLabel = "Play", onClick, style, ...props },
    ref
  ) => {
    const { renderer } = useContext(ReactSdkContext);
    const root = useContext(MarqueeContext);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const mergedRef = useMergedRef(ref, buttonRef);
    useRegisterMarqueePart("button", buttonRef);
    const state = root?.state ?? "off";
    const hidden = renderer !== "canvas" && state === "off";
    return (
      <button
        {...props}
        type="button"
        hidden={hidden}
        // a display the designer styles would show a `hidden` button
        style={hidden ? { ...style, display: "none" } : style}
        onClick={(event) => {
          onClick?.(event);
          root?.toggle();
        }}
        ref={mergedRef}
      >
        {state === "stopped" ? playLabel : pauseLabel}
      </button>
    );
  }
);

MarqueePauseButton.displayName = "MarqueePauseButton";
