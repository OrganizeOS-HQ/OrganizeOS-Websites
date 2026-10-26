import {
  forwardRef,
  useRef,
  type ComponentProps,
  type ElementRef,
} from "react";
import { useMergedRef } from "../form/merge-ref";
import { useRegisterMarqueePart } from "./context";

/**
 * Marquee Track: holds the Marquee's items and is the part that moves. Its
 * children are the designer's; the clones live in a container the runtime
 * appends after them, which React never sees.
 */
export const MarqueeTrack = forwardRef<
  ElementRef<"div">,
  ComponentProps<"div">
>((props, ref) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergedRef(ref, trackRef);
  useRegisterMarqueePart("track", trackRef);
  return <div {...props} ref={mergedRef} />;
});

MarqueeTrack.displayName = "MarqueeTrack";
