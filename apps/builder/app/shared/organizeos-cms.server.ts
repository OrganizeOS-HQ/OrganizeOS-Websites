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
/**
 * The forms door's base path (builder forms spec 7.1): the same assertion
 * with `aud: "forms"`, so a CMS assertion never passes the forms door and
 * the reverse.
 */
export const FORMS_PLATFORM_BASE_PATH = "/api/internal/websites2/forms";

export type CmsActorPayload = {
  /** The door: `cms`, or `forms` (fixture `forms-actor-assertion.json`). */
  aud: "cms" | "forms";
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

/** The largest answer relayed: 5 MB (1 MB is 1,048,576 bytes). */
export const CMS_ANSWER_MAX_BYTES = 5_242_880;

/**
 * Read a stream to its end, at most `maxBytes`. A null stream is empty bytes;
 * a stream longer than `maxBytes` is cancelled and reads as `undefined`.
 */
export const readBoundedBytes = async (
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number
): Promise<Uint8Array | undefined> => {
  if (stream === null) {
    return new Uint8Array();
  }
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

export type CmsForwardRequest = {
  method: "GET" | "POST" | "PUT";
  /** A canonical target under `CMS_PLATFORM_BASE_PATH`. */
  target: string;
  /** The minted `X-OOS-Actor`. */
  header: string;
  body?: Uint8Array;
  contentType?: string;
  timeoutMs: number;
};

/** What OrganizeOS answered, reduced to what the route relays. */
export type CmsForwardAnswer =
  /** A JSON answer within 5 MB, its bytes as received. */
  | { kind: "answer"; status: number; bytes: Uint8Array }
  | { kind: "timeout" }
  /** A redirect or a network error. */
  | { kind: "failed" }
  /** Not `application/json`, over 5 MB, empty, not UTF-8 or malformed. */
  | { kind: "not_json" };

const isJsonMediaType = (contentType: string | null) =>
  (contentType ?? "").split(";")[0].trim().toLowerCase() === "application/json";

const thrownAnswer = (error: unknown): CmsForwardAnswer =>
  error instanceof Error && error.name === "TimeoutError"
    ? { kind: "timeout" }
    : { kind: "failed" };

/**
 * Send one door call to OrganizeOS. Never throws: a timeout, a network error
 * or a redirect (refused, `redirect: "error"`) is an answer. The bytes of a
 * JSON answer are returned as read, never re-serialised.
 */
export const forwardCmsRequest = async ({
  appUrl,
  method,
  target,
  header,
  body,
  contentType,
  timeoutMs,
  fetchImpl = fetch,
}: CmsForwardRequest & {
  appUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<CmsForwardAnswer> => {
  const headers: Record<string, string> = { [CMS_ACTOR_HEADER]: header };
  if (contentType !== undefined) {
    headers["Content-Type"] = contentType;
  }
  let response: Response;
  try {
    response = await fetchImpl(`${appUrl.replace(/\/+$/, "")}${target}`, {
      method,
      headers,
      // The same bytes, untouched: a Uint8Array body is sent with its
      // Content-Length.
      body: body as Uint8Array<ArrayBuffer> | undefined,
      redirect: "error",
      credentials: "omit",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return thrownAnswer(error);
  }
  if (!isJsonMediaType(response.headers.get("content-type"))) {
    await response.body?.cancel().catch(() => undefined);
    return { kind: "not_json" };
  }
  let bytes: Uint8Array | undefined;
  try {
    bytes = await readBoundedBytes(response.body, CMS_ANSWER_MAX_BYTES);
  } catch (error) {
    return thrownAnswer(error);
  }
  if (bytes === undefined) {
    return { kind: "not_json" };
  }
  try {
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { kind: "not_json" };
  }
  return { kind: "answer", status: response.status, bytes };
};
