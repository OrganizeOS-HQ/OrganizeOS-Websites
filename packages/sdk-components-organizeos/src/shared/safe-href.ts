/**
 * The address rules the blocks share. Pure: no DOM, no window.
 *
 * Two rules, for two uses:
 *
 * - A link a visitor follows (Rich Text's `a`, OrganizeOS design
 *   `docs/superpowers/specs/2026-10-26-cms-in-the-builder-design.md` section
 *   4.7): `http:`, `https:`, `mailto:`, `tel:`, a root path (`/about`, but not
 *   `//host` or `/\host`, which browsers read as protocol-relative) or a
 *   fragment (`#top`). The same rule as the platform's converter
 *   (`richTextHref` in OrganizeOS `client/lib/collections/rich-text-nodes.ts`),
 *   which a published site checks again because a later `/v1` may be looser.
 * - A navigation a block makes itself (`form/navigate.ts`): the address,
 *   resolved against the page, must be `http:` or `https:`.
 */

const linkSchemes = new Set(["http", "https", "mailto", "tel"]);

/**
 * What a browser strips from an address before it parses it: C0 controls and
 * spaces at either end, and tabs and newlines anywhere.
 */
export const cleanHref = (raw: unknown): string => {
  if (typeof raw !== "string") {
    return "";
  }
  return (
    raw
      // eslint-disable-next-line no-control-regex
      .replace(/^[\u0000- ]+|[\u0000- ]+$/g, "")
      .replace(/[\t\n\r]/g, "")
  );
};

// eslint-disable-next-line no-control-regex
const hasControl = (value: string) => /[\u0000-\u001f\u007f]/.test(value);

const schemeOf = (url: string): undefined | string =>
  /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url)?.[1].toLowerCase();

/**
 * The address a link may keep, cleaned as a browser cleans it, or undefined
 * when the link must render as its text.
 */
export const safeLinkHref = (raw: unknown): undefined | string => {
  const href = cleanHref(raw);
  if (href === "" || hasControl(href)) {
    return;
  }
  if (href.startsWith("#")) {
    return href;
  }
  if (href.startsWith("/")) {
    return href[1] === "/" || href[1] === "\\" ? undefined : href;
  }
  const scheme = schemeOf(href);
  return scheme !== undefined && linkSchemes.has(scheme) ? href : undefined;
};

/** Whether a link may point at `href` (see `safeLinkHref`). */
export const isSafeHref = (href: unknown): boolean =>
  safeLinkHref(href) !== undefined;

/**
 * The source an image may keep: `https:` only, cleaned. Undefined drops the
 * image.
 */
export const safeImageSrc = (raw: unknown): undefined | string => {
  const src = cleanHref(raw);
  if (src === "" || hasControl(src)) {
    return;
  }
  return schemeOf(src) === "https" ? src : undefined;
};

/**
 * Whether a block may navigate the page to `url`, already resolved against
 * the page's address: `http:` and `https:` only, so a `javascript:` or
 * `data:` value never runs.
 */
export const isNavigableUrl = (url: URL): boolean =>
  url.protocol === "http:" || url.protocol === "https:";
