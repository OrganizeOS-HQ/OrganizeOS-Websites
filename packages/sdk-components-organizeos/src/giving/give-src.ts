import {
  CANONICAL_COLOR_NAMES,
  CANONICAL_FONT_NAMES,
} from "../site-templates/canonical-variables";
import { GIVE_EMBED_PATH, GIVE_THEME_KEY } from "./contract";

/**
 * The address the Donation Form frames (OrganizeOS builder donations spec
 * 2026-11-13, 5.1 and 5.5; plan F1, F-D2, F-D9 and F-D10):
 * `{platformOrigin}/embed/give/{orgId}?to&path&parent&r&preview&state#t=`,
 * the query in the contract's order. Every rule here mirrors what the
 * platform's parser accepts (`client/lib/donations/give-embed/params.ts` and
 * `theme.ts`), so the block never builds an address the frame would refuse.
 */

/**
 * An organization or campaign id as Postgres prints it, lower-case and
 * hyphenated: the platform's `ORG_ID_RE`
 * (`client/lib/domains/edge-builder-project.ts`), which reads both the path's
 * org id and `to`. The block lower-cases a value before testing it.
 */
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * A site page's path as the platform records it: the platform's
 * `PAGE_PATH_RE` (`client/lib/public/site/page-path.ts`), at most 500
 * characters. Any other path is not sent.
 */
const PAGE_PATH_RE = /^\/[^\s?#\p{Cc}]*$/u;
const PAGE_PATH_MAX_LENGTH = 500;

/** The fragment's longest `t=` part; the platform refuses one over 4,096. */
const THEME_MAX_LENGTH = 4000;

/** A theme value's longest text. */
const THEME_VALUE_MAX_LENGTH = 200;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Whether a value is one platform origin: exactly its own `URL.origin`, over
 * https, or over http on a local host for development.
 */
export const isPlatformOrigin = (value: unknown): value is string => {
  if (typeof value !== "string" || value === "") {
    return false;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.origin !== value) {
    return false;
  }
  return (
    url.protocol === "https:" ||
    (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))
  );
};

/** Whether a value is an organization id, in any case. */
export const isOrgId = (value: unknown): value is string =>
  typeof value === "string" && ID_RE.test(value.toLowerCase());

/**
 * What a block gives to, as `to` carries it: `"general"`, or a campaign id
 * lower-cased. Undefined for anything else, `""` included.
 */
export const parseGiveTarget = (
  value: unknown
): "general" | string | undefined => {
  if (value === "general") {
    return "general";
  }
  if (typeof value !== "string") {
    return;
  }
  const id = value.toLowerCase();
  return ID_RE.test(id) ? id : undefined;
};

const trimmed = (value: string) => {
  const text = value.trim();
  return text !== "" && text.length <= THEME_VALUE_MAX_LENGTH
    ? text
    : undefined;
};

/**
 * The site's six canonical variables where `el` sits, keyed by name without
 * `--`. A custom property's computed value is its declared text, and the
 * builder writes colours as `rgb(255 248 240 / 1)`, `hsl(...)` or a keyword,
 * which the frame refuses. So each colour that is set is resolved through a
 * hidden probe inside `el` styled `color: var(--name)`: its computed `color`
 * is `rgb(r, g, b)` or `rgba(r, g, b, a)`. Fonts are read as declared. Unset,
 * empty and over-long values are left out.
 */
export const readSiteTheme = (el: Element): Record<string, string> => {
  const view = el.ownerDocument.defaultView;
  if (view === null) {
    return {};
  }
  const style = view.getComputedStyle(el);
  const theme: Record<string, string> = {};
  const probe = el.ownerDocument.createElement("span");
  probe.hidden = true;
  probe.setAttribute("aria-hidden", "true");
  el.append(probe);
  try {
    for (const name of CANONICAL_COLOR_NAMES) {
      if (trimmed(style.getPropertyValue(`--${name}`)) === undefined) {
        continue;
      }
      // the attribute, not the CSSOM: some DOMs drop a var() they cannot parse
      probe.setAttribute("style", `color: var(--${name})`);
      const resolved = trimmed(view.getComputedStyle(probe).color);
      if (resolved !== undefined) {
        theme[name] = resolved;
      }
    }
  } finally {
    probe.remove();
  }
  for (const name of CANONICAL_FONT_NAMES) {
    const value = trimmed(style.getPropertyValue(`--${name}`));
    if (value !== undefined) {
      theme[name] = value;
    }
  }
  return theme;
};

/**
 * The fragment's value: the theme as UTF-8 JSON in unpadded base64url.
 * Undefined for an empty theme, or one too long for the frame.
 */
export const encodeSiteTheme = (
  theme: Record<string, string>
): string | undefined => {
  if (Object.keys(theme).length === 0) {
    return;
  }
  const bytes = new TextEncoder().encode(JSON.stringify(theme));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const encoded = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${GIVE_THEME_KEY}=${encoded}`.length > THEME_MAX_LENGTH
    ? undefined
    : encoded;
};

export type GiveSrcInput = {
  /** Checked with isPlatformOrigin first. */
  platformOrigin: string;
  /** Checked with isOrgId first; lower-cased here. */
  organizationId: string;
  /** From parseGiveTarget. */
  target: string;
  /** The site page's own origin and path (`location`). */
  page: { origin: string; pathname: string };
  /** The visit's share code, when it has one. */
  shareCode?: string;
  /** On the builder's canvas or in its preview. */
  preview: boolean;
  /** The canvas's not-taking-gifts state; sent only with `preview`. */
  unavailable: boolean;
  /** encodeSiteTheme's value, without `t=`. */
  theme?: string;
};

export const buildGiveSrc = (input: GiveSrcInput): string => {
  const query = new URLSearchParams();
  query.set("to", input.target);
  const { pathname } = input.page;
  if (pathname.length <= PAGE_PATH_MAX_LENGTH && PAGE_PATH_RE.test(pathname)) {
    query.set("path", pathname);
  }
  query.set("parent", input.page.origin);
  if (input.shareCode !== undefined) {
    query.set("r", input.shareCode);
  }
  if (input.preview) {
    query.set("preview", "1");
    if (input.unavailable) {
      query.set("state", "unavailable");
    }
  }
  const address = `${input.platformOrigin}${GIVE_EMBED_PATH}/${input.organizationId.toLowerCase()}`;
  const fragment =
    input.theme === undefined ? "" : `#${GIVE_THEME_KEY}=${input.theme}`;
  return `${address}?${query.toString()}${fragment}`;
};
