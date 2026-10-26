import {
  forwardRef,
  useContext,
  useRef,
  type ComponentProps,
  type ElementRef,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { useMergedRef } from "../form/merge-ref";
import { useShareCodeCarrier } from "./use-share-code-carrier";

/**
 * Share Code Carrier: the root of the blocks that are templates over native
 * elements (the Event List and the Event Card), which have no component of
 * their own to carry a visitor's share code. A `div` that passes every prop
 * through and carries the code on a click on a link inside it to a platform
 * page (`useShareCodeCarrier`). It renders the same markup on the server and
 * the client and acts only on a click, on a published page.
 */
export const ShareCodeCarrier = forwardRef<
  ElementRef<"div">,
  ComponentProps<"div">
>(({ children, ...props }, ref) => {
  const { renderer } = useContext(ReactSdkContext);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergedRef(ref, rootRef);
  useShareCodeCarrier({ rootRef, renderer });
  return (
    <div {...props} ref={mergedRef}>
      {children}
    </div>
  );
});

ShareCodeCarrier.displayName = "ShareCodeCarrier";
