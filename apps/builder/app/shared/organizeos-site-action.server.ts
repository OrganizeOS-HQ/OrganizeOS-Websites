import { createHmac } from "node:crypto";
import { z } from "zod";

/**
 * OrganizeOS fork: the Publish dialog's Unpublish, builder side
 * (docs/ORGANIZEOS-FORK.md section 5).
 *
 * The builder server mints `X-OOS-Site-Action: v1.{payload}.{mac}`, a
 * 60-second, single-use assertion that this signed-in OrganizeOS user, in this
 * live OrganizeOS session, asks to unpublish one address of this org, and
 * POSTs it server to server to OrganizeOS's
 * `/api/internal/websites2/site-action`, with no body and no cookie.
 * OrganizeOS verifies it, checks the session and the user's role again, and
 * takes the address down. The one action is `unpublish`: nothing can bring an
 * address up this way.
 *
 * Byte format, pinned by the platform's
 * `client/tests/fixtures/site-components/site-action-assertion.json` (a copy
 * is in `__fixtures__/`): `payload` is base64url, unpadded, of the UTF-8 JSON
 * of `{ aud, act, tgt, org, sub, sid, jti, iat, exp }` in that key order, with
 * Unix seconds and `exp = iat + 60`; `mac` is base64url, unpadded, of
 * HMAC-SHA256 over the ASCII payload segment, keyed by
 * `WEBSITES2_SITE_ACTION_SECRET` (never the preview secret).
 */

export const SITE_ACTION_HEADER = "X-OOS-Site-Action";
export const SITE_ACTION_PATH = "/api/internal/websites2/site-action";
export const SITE_ACTION_LIFETIME_SECONDS = 60;
/** The server-to-server call's own timeout. */
export const SITE_ACTION_TIMEOUT_MS = 10_000;

export type SiteActionPayload = {
  aud: "site-action";
  act: "unpublish";
  /** `builtin`, or a host the org's site is served on. */
  tgt: string;
  org: string;
  sub: string;
  sid: string;
  jti: string;
  iat: number;
  exp: number;
};

/** `v1.{payload}.{mac}`: the exact segment that was MACed is the one sent. */
export const mintSiteActionAssertion = (
  payload: SiteActionPayload,
  secret: string
): string => {
  const ordered = {
    aud: payload.aud,
    act: payload.act,
    tgt: payload.tgt,
    org: payload.org,
    sub: payload.sub,
    sid: payload.sid,
    jti: payload.jti,
    iat: payload.iat,
    exp: payload.exp,
  };
  const segment = Buffer.from(JSON.stringify(ordered), "utf8").toString(
    "base64url"
  );
  const mac = createHmac("sha256", secret)
    .update(segment, "ascii")
    .digest("base64url");
  return `v1.${segment}.${mac}`;
};

const okAnswerSchema = z.object({ ok: z.literal(true), changed: z.boolean() });

/** What OrganizeOS answered, reduced to what the route maps. */
export type SiteActionAnswer =
  | { kind: "ok"; changed: boolean }
  | { kind: "status"; status: number }
  | { kind: "timeout" }
  | { kind: "failed" };

/**
 * POST the assertion to OrganizeOS. Never throws: a timeout, a network error,
 * a redirect (refused, `redirect: "error"`) or a malformed 200 is an answer.
 */
export const postSiteAction = async ({
  appUrl,
  header,
  fetchImpl = fetch,
  timeoutMs = SITE_ACTION_TIMEOUT_MS,
}: {
  appUrl: string;
  header: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<SiteActionAnswer> => {
  let response: Response;
  try {
    response = await fetchImpl(
      `${appUrl.replace(/\/+$/, "")}${SITE_ACTION_PATH}`,
      {
        method: "POST",
        headers: { [SITE_ACTION_HEADER]: header },
        redirect: "error",
        credentials: "omit",
        signal: AbortSignal.timeout(timeoutMs),
      }
    );
  } catch (error) {
    return error instanceof Error && error.name === "TimeoutError"
      ? { kind: "timeout" }
      : { kind: "failed" };
  }
  if (response.status !== 200) {
    return { kind: "status", status: response.status };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "failed" };
  }
  const parsed = okAnswerSchema.safeParse(body);
  return parsed.success
    ? { kind: "ok", changed: parsed.data.changed }
    : { kind: "failed" };
};
