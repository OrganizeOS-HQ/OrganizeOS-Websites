/**
 * The give embed's contract, frozen (OrganizeOS builder donations spec
 * 2026-11-13, 5.1, 5.6 and W8): the platform's
 * `{platformOrigin}/embed/give/{orgId}` page that the Donation form frames,
 * the query names the block may send, the fragment key of the site's theme,
 * and the two messages the frame posts to the block. A published block keeps
 * building this address, so it only ever changes additively. Pinned by
 * `__fixtures__/give-embed-messages.json`, copied from the platform.
 */

export const GIVE_EMBED_PATH = "/embed/give";

/** The query names, in the order the block sends them. */
export const GIVE_QUERY_KEYS = [
  "to",
  "path",
  "parent",
  "r",
  "preview",
  "state",
] as const;

/** The fragment's key: `#t=` and the base64url JSON of the site's theme. */
export const GIVE_THEME_KEY = "t";

export const GIVE_HEIGHT_TYPE = "oos-give-height";
export const GIVE_DONE_TYPE = "oos-give-done";

/** With no answer from the frame this long after its clock starts, it is Unavailable. */
export const GIVE_FRAME_TIMEOUT_MS = 10_000;

/** The placeholder's height, and the frame's until its first height message. */
export const GIVE_PLACEHOLDER_HEIGHT = 640;

/** The tallest height a message may set. */
export const GIVE_MAX_HEIGHT = 10_000;
