import { useContext, useEffect } from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { isBuilderRender } from "../form/submit";
import { attachShareCodeCarrier } from "./attach-share-code-carrier";

/**
 * The page's share-code carrier: a visitor's share code (`?r=`) goes with a
 * click on any link on the page to one of the organization's platform pages
 * on the page's own origin, a designer's own link outside every block
 * included. It is `attachShareCodeCarrier` on the document, attached after
 * hydration. A published page mounts it once, from the CLI's html route
 * template (`page.ts`); the builder never renders that template, and the
 * renderer check keeps it inert on the canvas and in the preview anyway.
 *
 * It renders nothing and reads nothing while rendering (the code is read at
 * the click), so the server's markup is the same whatever the address and
 * hydration cannot mismatch. No cookie, no storage.
 *
 * Beside a block's own carrier (`useShareCodeCarrier` on the block's root), a
 * click is carried once. Both listen in the capture phase, and the capture
 * phase reaches the document before any element in it: a plain click is
 * cancelled and sent by document here, and the block's carrier then leaves
 * the cancelled click alone; any other click reaches the block's carrier with
 * its `r` already on the link, which it keeps.
 */
export const PageShareCodeCarrier = (): null => {
  const { renderer } = useContext(ReactSdkContext);
  useEffect(() => {
    if (isBuilderRender(renderer)) {
      return;
    }
    return attachShareCodeCarrier(document);
  }, [renderer]);
  return null;
};
