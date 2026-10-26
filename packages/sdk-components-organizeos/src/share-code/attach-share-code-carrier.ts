import { navigateTo } from "../form/navigate";
import {
  isPlatformPath,
  readPageShareCode,
  shareCodeParam,
  withShareCode,
} from "./share-code";

/**
 * Carries the page's share code (`?r=`) to the organization's platform pages:
 * a click on a link inside `root` to a platform page on the page's own origin
 * goes there with the code. In the address only: no cookie, no storage.
 *
 * One capture-phase `click` listener on `root` (a block's root element, or the
 * document). On a click it:
 *
 * - leaves an event another handler already cancelled alone;
 * - reads the page's code at the click, not when attached, since a site page
 *   can change its address without a reload, and does nothing without one;
 * - acts only on the nearest `a[href]` from the target, when it is an HTML
 *   anchor inside `root` whose http(s) address is on the page's own origin, a
 *   platform page (`isPlatformPath`) and has no `r` yet;
 * - sets the anchor's `href` to the address with the code. A plain click
 *   (primary button, no modifier, no `target` but `_self`, no `download`) has
 *   its default prevented and goes there by document (`navigateTo`): a
 *   published link may route through the site's client-side router by its own
 *   `to`, not the DOM `href`, and a platform page is never one of the site's
 *   routes. Preventing it in the capture phase, before React's bubble-phase
 *   handlers, keeps a router's link from routing (it skips a prevented
 *   event). Any other click keeps its default and follows the rewritten
 *   `href`.
 *
 * Nothing stops the click's propagation, so the page's own handlers still
 * run. A carrier inside another (or inside the document's) acts once: the
 * outer one's listener runs first, and the inner one then finds the click
 * cancelled or the link already carrying `r`.
 *
 * Returns the listener's removal.
 */
export const attachShareCodeCarrier = (
  root: Element | Document
): (() => void) => {
  const onClick = (event: Event) => {
    if (event.defaultPrevented) {
      return;
    }
    const code = readPageShareCode();
    if (code === undefined) {
      return;
    }
    const target = event.target;
    if (target instanceof Element === false) {
      return;
    }
    const anchor = target.closest("a[href]");
    if (
      anchor instanceof HTMLAnchorElement === false ||
      root.contains(anchor) === false
    ) {
      return;
    }
    let url: URL;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch {
      return;
    }
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.origin !== window.location.origin ||
      isPlatformPath(url.pathname) === false ||
      url.searchParams.has(shareCodeParam)
    ) {
      return;
    }
    const next = withShareCode(url.href, code);
    anchor.href = next;
    const { button, metaKey, ctrlKey, shiftKey, altKey } = event as MouseEvent;
    const plainClick =
      button === 0 &&
      metaKey === false &&
      ctrlKey === false &&
      shiftKey === false &&
      altKey === false &&
      (anchor.target === "" || anchor.target === "_self") &&
      anchor.hasAttribute("download") === false;
    if (plainClick) {
      event.preventDefault();
      navigateTo(next);
    }
  };
  root.addEventListener("click", onClick, true);
  return () => {
    root.removeEventListener("click", onClick, true);
  };
};
