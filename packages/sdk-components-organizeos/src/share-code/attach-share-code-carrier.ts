import { navigateTo } from "../form/navigate";
import {
  isPlatformPath,
  readPageShareCode,
  shareCodeParam,
  withShareCode,
} from "./share-code";

/**
 * Carries the page's share code (`?r=`) to the organization's platform pages:
 * a click, a middle-click or a context menu on a link inside `root` to a
 * platform page on the page's own origin takes the code with it. In the
 * address only: no cookie, no storage.
 *
 * Three capture-phase listeners on `root` (a block's root element, or the
 * document): `click`; `auxclick`, which a middle-click opens its new tab
 * through; and `contextmenu`, which a right click, a long press and the
 * keyboard's menu key raise before the link's menu shows. On each it:
 *
 * - leaves an event another handler already cancelled alone;
 * - reads the page's code at the event, not when attached, since a site page
 *   can change its address without a reload, and does nothing without one;
 * - acts only on the nearest `a[href]` from the target, when it is an HTML
 *   anchor inside `root` whose http(s) address is on the page's own origin
 *   and a platform page (`isPlatformPath`);
 * - sets the anchor's `href` to the address with the code, unless it already
 *   has an `r`, which it keeps.
 *
 * A plain click (primary button, no modifier, no `target` but `_self`, no
 * `download`) then goes to that address by document (`navigateTo`), its
 * default prevented, whether or not the `href` was rewritten: a published
 * link may route through the site's client-side router by its own `to`, not
 * the DOM `href`, and the router would drop the code (a link rewritten by an
 * earlier Ctrl-click, middle-click or context menu, or by the first click of
 * a double-click, has its `r` already). A platform page is never one of the
 * site's routes. Preventing it in the capture phase, before React's
 * bubble-phase handlers, keeps a router's link from routing (it skips a
 * prevented event). Any other click keeps its default and follows the
 * `href`.
 *
 * A middle-click (button 1 only) and a context menu only set the `href`, as a
 * modified click does; neither is ever cancelled, so the browser opens the new
 * tab, or the menu, with the code. Every item of that menu uses the address
 * with the code, "Copy link address" included: the code is meant to be shared,
 * and the page's own address already carries it. iOS raises no `contextmenu`
 * on a long press, so nothing is carried there.
 *
 * Nothing stops an event's propagation, so the page's own handlers still run.
 * A carrier inside another (or inside the document's) acts once: the outer
 * one's listener runs first, and the inner one then finds a plain click
 * cancelled, or, for any other event, the link already carrying `r`.
 *
 * Returns the removal of all three listeners.
 */
export const attachShareCodeCarrier = (
  root: Element | Document
): (() => void) => {
  /**
   * The link an event inside `root` carries the code to, and the address it
   * goes to (the `href` set here, or the one it kept); undefined for an event
   * to leave alone.
   */
  const carried = (
    event: Event
  ): { anchor: HTMLAnchorElement; next: string } | undefined => {
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
      isPlatformPath(url.pathname) === false
    ) {
      return;
    }
    // The `r` decides only the href, never whether a click goes by document.
    let next = url.href;
    if (url.searchParams.has(shareCodeParam) === false) {
      next = withShareCode(url.href, code);
      anchor.href = next;
    }
    return { anchor, next };
  };

  const onClick = (event: Event) => {
    const link = carried(event);
    if (link === undefined) {
      return;
    }
    const { button, metaKey, ctrlKey, shiftKey, altKey } = event as MouseEvent;
    const plainClick =
      button === 0 &&
      metaKey === false &&
      ctrlKey === false &&
      shiftKey === false &&
      altKey === false &&
      (link.anchor.target === "" || link.anchor.target === "_self") &&
      link.anchor.hasAttribute("download") === false;
    if (plainClick) {
      event.preventDefault();
      navigateTo(link.next);
    }
  };

  // The middle button only: the secondary button opens the menu, below, and
  // the fourth and fifth are back and forward.
  const onAuxClick = (event: Event) => {
    if ((event as MouseEvent).button !== 1) {
      return;
    }
    carried(event);
  };

  const onContextMenu = (event: Event) => {
    carried(event);
  };

  root.addEventListener("click", onClick, true);
  root.addEventListener("auxclick", onAuxClick, true);
  root.addEventListener("contextmenu", onContextMenu, true);
  return () => {
    root.removeEventListener("click", onClick, true);
    root.removeEventListener("auxclick", onAuxClick, true);
    root.removeEventListener("contextmenu", onContextMenu, true);
  };
};
