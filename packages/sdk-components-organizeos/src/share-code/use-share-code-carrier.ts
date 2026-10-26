import { useEffect, type RefObject } from "react";
import { isBuilderRender, type Renderer } from "../form/submit";
import { attachShareCodeCarrier } from "./attach-share-code-carrier";

/**
 * Attaches the share-code carrier (`attachShareCodeCarrier`) to a block's root
 * after hydration, on a published page only. On the builder's canvas and in
 * its preview it attaches nothing, whatever the canvas's own address holds, so
 * the canvas keeps its own handling of a click on a link.
 */
export const useShareCodeCarrier = ({
  rootRef,
  renderer,
}: {
  rootRef: RefObject<Element | null>;
  renderer: Renderer;
}) => {
  useEffect(() => {
    const root = rootRef.current;
    if (isBuilderRender(renderer) || root === null) {
      return;
    }
    return attachShareCodeCarrier(root);
  }, [renderer, rootRef]);
};
