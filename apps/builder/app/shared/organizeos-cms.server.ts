import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";

/**
 * OrganizeOS fork: the native CMS's door, builder side
 * (docs/ORGANIZEOS-FORK.md section 5).
 *
 * The builder server mints `X-OOS-Actor: v1.{payload}.{mac}`, a 60-second
 * assertion that this signed-in OrganizeOS user, in this live OrganizeOS
 * session, makes this one request of this org's CMS, for every native CMS
 * call it forwards server to server to OrganizeOS's
 * `/api/internal/websites2/cms/{organizationId}/...`, with no cookie.
 *
 * Byte format, pinned by the platform's
 * `client/tests/fixtures/site-components/cms-actor-assertion.json` (a copy is
 * in `__fixtures__/`): `payload` is base64url, unpadded, of the UTF-8 JSON of
 * `{ aud, org, sub, sid, m, p, h, jti, iat, exp, ip }` in that key order, with
 * `m` the method, `p` the hash of the request's canonical target, `h` the hash
 * of its body bytes, `ip` an address literal or `null`, Unix seconds and
 * `exp = iat + 60`; `mac` is base64url, unpadded, of HMAC-SHA256 over the
 * ASCII payload segment, keyed by `WEBSITES2_CMS_SECRET` (never the preview's
 * or the site action's secret). OrganizeOS design
 * `docs/superpowers/specs/2026-11-07-native-cms-in-the-builder-design.md`,
 * 5.2.
 */

export const CMS_ACTOR_HEADER = "X-OOS-Actor";
export const CMS_ACTOR_LIFETIME_SECONDS = 60;
export const CMS_PLATFORM_BASE_PATH = "/api/internal/websites2/cms";

export type CmsActorPayload = {
  aud: "cms";
  org: string;
  sub: string;
  sid: string;
  m: "GET" | "POST" | "PUT";
  /** `hashCmsBytes` of the canonical target (`cmsCanonicalTarget`). */
  p: string;
  /** `hashCmsBytes` of the body bytes; of empty bytes for a GET. */
  h: string;
  jti: string;
  iat: number;
  exp: number;
  /** An address literal of at most 45 characters, or `null`. */
  ip: string | null;
};

/** `v1.{payload}.{mac}`: the exact segment that was MACed is the one sent. */
export const mintCmsActorAssertion = (
  payload: CmsActorPayload,
  secret: string
): string => {
  const ordered = {
    aud: payload.aud,
    org: payload.org,
    sub: payload.sub,
    sid: payload.sid,
    m: payload.m,
    p: payload.p,
    h: payload.h,
    jti: payload.jti,
    iat: payload.iat,
    exp: payload.exp,
    ip: payload.ip,
  };
  const segment = Buffer.from(JSON.stringify(ordered), "utf8").toString(
    "base64url"
  );
  const mac = createHmac("sha256", secret)
    .update(segment, "ascii")
    .digest("base64url");
  return `v1.${segment}.${mac}`;
};

/**
 * The canonical target (spec 5.2): the pathname, then, only when there is a
 * pair, `?` and the pairs sorted by key and serialised by `URLSearchParams`.
 */
export const cmsCanonicalTarget = (
  pathname: string,
  pairs: Iterable<readonly [string, string]>
): string => {
  // A stable sort in code-unit order: a repeated key keeps its order.
  const sorted = [...pairs].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted.length === 0
    ? pathname
    : `${pathname}?${new URLSearchParams(sorted.map(([k, v]) => [k, v])).toString()}`;
};

/** base64url, unpadded, of SHA-256; a string is hashed as its UTF-8 bytes. */
export const hashCmsBytes = (input: Uint8Array | string): string =>
  createHash("sha256")
    .update(typeof input === "string" ? Buffer.from(input, "utf8") : input)
    .digest("base64url");

const MAX_IP_LENGTH = 45;

/**
 * The person's address for the platform's audit row: `x-real-ip` when present
 * and non-blank, else the first `x-forwarded-for` entry, kept only when it is
 * an address literal of at most 45 characters.
 */
export const readCmsActorIp = (headers: Headers): string | null => {
  const realIp = headers.get("x-real-ip")?.trim();
  const candidate =
    realIp !== undefined && realIp !== ""
      ? realIp
      : headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (
    candidate === undefined ||
    candidate.length > MAX_IP_LENGTH ||
    isIP(candidate) === 0
  ) {
    return null;
  }
  return candidate;
};
