import {
  isPlatformPath,
  readPageShareCode,
  shareCodeParam,
  withShareCode,
} from "../share-code/share-code";
import { isNavigableUrl } from "../shared/safe-href";

/**
 * Where a navigation to `href` goes, or undefined when it must not go. Only
 * http(s) targets (`isNavigableUrl`): the page link comes from the builder's
 * URL control, and a `javascript:` value must never run. This is narrower
 * than a link's rule (`isSafeHref`), which also allows `mailto:` and `tel:`,
 * and wider in one way: a relative address resolves against the page. When the target is one of the
 * organization's platform pages on the page's own origin, has no `r` yet and
 * the page has a share code, the code goes with it, as a click on a link to
 * that page would carry it (share-code/attach-share-code-carrier.ts).
 */
export const navigationTarget = (href: string): string | undefined => {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return;
  }
  if (isNavigableUrl(url) === false) {
    return;
  }
  const code = readPageShareCode();
  if (
    code !== undefined &&
    url.origin === window.location.origin &&
    isPlatformPath(url.pathname) &&
    url.searchParams.has(shareCodeParam) === false
  ) {
    return withShareCode(url.href, code);
  }
  return url.href;
};

/**
 * Opens the page a root goes to after a successful submission, or the
 * platform page a share-code carrier sends a click to, by document: the
 * address `navigationTarget` gives. Returns whether it navigated.
 */
export const navigateTo = (href: string): boolean => {
  const target = navigationTarget(href);
  if (target === undefined) {
    return false;
  }
  window.location.assign(target);
  return true;
};
