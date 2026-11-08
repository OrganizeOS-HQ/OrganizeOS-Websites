import { json } from "@remix-run/server-runtime";
import { z } from "zod";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import type { SessionData } from "~/services/auth.server.utils";
import type { OrganizeosBindingOutcome } from "~/services/auth-strategy/organizeos-session.server";
import { privateNoStoreResponseHeaders } from "~/services/cache-control.server";
import { preventCrossOriginCookie } from "~/services/no-cross-origin-cookie";
import { allowedDestinations } from "~/services/destinations.server";
import type { ProjectOrganization } from "~/shared/db/organizeos-project-org.server";
import {
  BUILTIN_TARGET_KEY,
  HOST_PATTERN,
  composeSiteAddresses,
  type SiteAddressesRow,
} from "~/shared/db/organizeos-site-addresses.server";
import {
  SITE_ACTION_LIFETIME_SECONDS,
  mintSiteActionAssertion,
  type SiteActionAnswer,
} from "~/shared/organizeos-site-action.server";

/**
 * OrganizeOS fork: the Publish dialog's Unpublish of one address
 * (docs/ORGANIZEOS-FORK.md section 5).
 *
 * A fetch only (a document or iframe load is refused), with the page's CSRF
 * token, for a user signed in as a user (never a share link's token) whose
 * builder session has a `live` OrganizeOS binding (never `pass`: without SSO
 * there is no OrganizeOS session to assert), in either binding mode, and who
 * holds the project's `admin` permit. The org is the project owner's, never
 * the request's. The body is `{ action: "unpublish", target }`.
 *
 * The target must be one of the org's targets in OrganizeOS's addresses read,
 * made here, with a recorded build that is not unpublished; otherwise nothing
 * is minted or sent. With `WEBSITES2_SITE_ACTION_SECRET` unset nothing is
 * minted either. Then the route mints the assertion for the session's
 * OrganizeOS user and session and POSTs it to OrganizeOS, which decides.
 *
 * Answers, never stored: `200 { ok: true }`; `400 invalid_request`; `403`
 * (no user session, no live binding, no `admin` permit, not an org's project,
 * or OrganizeOS refused the role: `forbidden`); `404 unavailable` (no secret
 * here, or OrganizeOS answered 404: the action is not available); `405` for
 * any method but POST; `409 not_live` or `unknown_target`; `429
 * rate_limited`; `502 failed` (a refused assertion, a dead session, a timeout
 * or any other answer); `503 addresses_unavailable` or `targets_unavailable`.
 * A failure logs one code, never a host, an id or the header.
 */

const MAX_BODY_BYTES = 1024;

const bodySchema = z
  .object({
    action: z.literal("unpublish"),
    target: z
      .string()
      .refine((key) => key === BUILTIN_TARGET_KEY || HOST_PATTERN.test(key)),
  })
  .strict();

export type SiteActionRouteDeps = {
  checkCsrf: (request: Request) => Promise<void>;
  createContext: (request: Request) => Promise<AppContext>;
  readSession: (request: Request) => Promise<SessionData | null>;
  bindingOutcome: (session: SessionData) => Promise<OrganizeosBindingOutcome>;
  hasAdminPermit: (projectId: string, context: AppContext) => Promise<boolean>;
  resolveOrganization: (
    projectId: string,
    context: AppContext
  ) => Promise<ProjectOrganization>;
  fetchAddresses: (
    organizationId: string
  ) => Promise<SiteAddressesRow | undefined>;
  secret: string | undefined;
  /** Milliseconds. */
  now: () => number;
  randomId: () => string;
  /** POST the assertion to OrganizeOS. */
  send: (header: string) => Promise<SiteActionAnswer>;
  publisherHost: string;
  platformUrl: string;
};

type LogCode =
  | "binding_refused"
  | "owner_read_failed"
  | "addresses_unavailable"
  | "targets_unavailable"
  | "not_live"
  | "unavailable"
  | "refused"
  | "forbidden"
  | "rate_limited"
  | "unknown_target"
  | "failed";

const log = (code: LogCode) => {
  console.error(`[organizeos-site-action] ${code}`);
};

const answer = (body: object, status = 200) =>
  json(body, { status, headers: privateNoStoreResponseHeaders });

const refused = () => answer({ ok: false }, 403);

const readBody = async (request: Request): Promise<unknown> => {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return;
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return;
  }
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return;
  }
  try {
    return JSON.parse(text);
  } catch {
    return;
  }
};

export const handleSiteActionRequest = async (
  request: Request,
  projectId: string | undefined,
  deps: SiteActionRouteDeps
): Promise<Response> => {
  if (request.method !== "POST") {
    return answer({ ok: false }, 405);
  }
  preventCrossOriginCookie(request);
  allowedDestinations(request, ["empty"]);
  await deps.checkCsrf(request);

  if (projectId === undefined) {
    return answer({ ok: false, error: "invalid_request" }, 400);
  }

  const context = await deps.createContext(request);
  if (context.authorization.type !== "user") {
    return refused();
  }
  const session = await deps.readSession(request);
  if (session === null || session.userId !== context.authorization.userId) {
    return refused();
  }
  // Only a live OrganizeOS session can be asserted: `pass` (no SSO) has none.
  const outcome = await deps.bindingOutcome(session);
  const sub = session.organizeosUserId;
  const sid = session.organizeosSid;
  if (outcome !== "live" || sub === undefined || sid === undefined) {
    log("binding_refused");
    return refused();
  }
  if ((await deps.hasAdminPermit(projectId, context)) === false) {
    return refused();
  }

  const parsed = bodySchema.safeParse(await readBody(request));
  if (parsed.success === false) {
    return answer({ ok: false, error: "invalid_request" }, 400);
  }

  const secret = deps.secret;
  if (secret === undefined || secret.trim() === "") {
    log("unavailable");
    return answer({ ok: false, error: "unavailable" }, 404);
  }

  const owner = await deps.resolveOrganization(projectId, context);
  if ("failed" in owner) {
    log("owner_read_failed");
    return answer({ ok: false, error: "addresses_unavailable" }, 503);
  }
  if ("none" in owner) {
    return refused();
  }
  const { organizationId } = owner;

  const row = await deps.fetchAddresses(organizationId);
  if (row === undefined) {
    log("addresses_unavailable");
    return answer({ ok: false, error: "addresses_unavailable" }, 503);
  }
  const { targets } = composeSiteAddresses({
    row,
    publisherHost: deps.publisherHost,
    platformUrl: deps.platformUrl,
  });
  if (targets === undefined) {
    log("targets_unavailable");
    return answer({ ok: false, error: "targets_unavailable" }, 503);
  }
  // Only a listed target with a recorded build that is not taken down.
  const target = targets.find(
    (candidate) => candidate.key === parsed.data.target
  );
  if (
    target === undefined ||
    target.publishedAt === null ||
    target.unpublishedAt !== null
  ) {
    log("not_live");
    return answer({ ok: false, error: "not_live" }, 409);
  }

  const iat = Math.floor(deps.now() / 1000);
  const header = mintSiteActionAssertion(
    {
      aud: "site-action",
      act: "unpublish",
      tgt: target.key,
      org: organizationId,
      sub,
      sid,
      jti: deps.randomId(),
      iat,
      exp: iat + SITE_ACTION_LIFETIME_SECONDS,
    },
    secret
  );

  const result = await deps.send(header);
  if (result.kind === "ok") {
    return answer({ ok: true });
  }
  if (result.kind === "status") {
    switch (result.status) {
      case 404:
        log("unavailable");
        return answer({ ok: false, error: "unavailable" }, 404);
      case 403:
        log("forbidden");
        return answer({ ok: false, error: "forbidden" }, 403);
      case 409:
        log("unknown_target");
        return answer({ ok: false, error: "unknown_target" }, 409);
      case 429:
        log("rate_limited");
        return answer({ ok: false, error: "rate_limited" }, 429);
      case 401:
        // A refused assertion, a replay or a dead session: not the person's
        // to fix here; the dialog says to try again and reads the truth.
        log("refused");
        return answer({ ok: false, error: "failed" }, 502);
    }
  }
  log("failed");
  return answer({ ok: false, error: "failed" }, 502);
};
