import { createHmac } from "node:crypto";
import { parseBuilderUrl } from "@webstudio-is/http-client";
import { createClient } from "@webstudio-is/postgrest/index.server";
import {
  authorizeProject,
  ORGANIZEOS_SERVICE_PROVIDER,
} from "@webstudio-is/trpc-interface/index.server";
import env from "~/env/env.server";
import {
  checkOrganizeosBinding,
  readBuilderSession,
} from "~/services/auth-strategy/organizeos-session.server";
import type { SessionData } from "~/services/auth.server.utils";
import { parseOrganizationIdFromServiceEmail } from "~/services/organizeos-publisher.server";
import { createContext } from "./context.server";

/**
 * The canvas's draft preview (OrganizeOS design
 * docs/superpowers/specs/2026-10-26-cms-in-the-builder-design.md, 4.5).
 *
 * `rest.resources-loader.ts` runs every canvas Resource fetch on the server.
 * For a fetch to the OrganizeOS app's `/api/public/v1/collections/` it adds
 * `X-OOS-Preview: v1.{payload}.{mac}`, a 60-second assertion that this
 * signed-in OrganizeOS user, in this live OrganizeOS session, is looking at
 * this org's project. The platform verifies it
 * (`client/lib/public/v1/preview.ts`) and then serves drafts as well as
 * published items. The assertion is added to the outgoing request only:
 * after the client computed the cache key (`getResourceKey`), and never into
 * build data, so no publish can carry it.
 *
 * Minted only when every one of these holds, and otherwise the fetch goes out
 * unchanged:
 * 1. `WEBSITES2_PREVIEW_SECRET` is set;
 * 2. the fetch URL, parsed, has the origin of `ORGANIZEOS_APP_URL`, no
 *    userinfo, no encoded slash, backslash or dot, and a pathname under
 *    `/api/public/v1/collections/`;
 * 3. the request carries a builder session with an OrganizeOS binding that is
 *    live (`readBuilderSession` and `checkOrganizeosBinding`);
 * 4. that session's user may view the project in the `p-{projectId}` host
 *    (upstream's project authorization, viewers or above), signed in as a
 *    user rather than through a share link's token;
 * 5. the project is an OrganizeOS project: its owner is an org's service
 *    account. The organization id is cached per project for 60 s.
 *
 * Byte format, pinned by the platform's
 * `client/tests/fixtures/site-components/preview-assertion.json` (a copy is
 * in `__fixtures__/`): `payload` is base64url, unpadded, of the UTF-8 JSON
 * of `{ org, sub, sid, iat, exp }` in that key order, with Unix seconds and
 * `exp = iat + 60`; `mac` is base64url, unpadded, of HMAC-SHA256 over the
 * ASCII payload segment. The header replaces any stored `X-OOS-Preview`
 * whatever its casing: a duplicated header reaches the platform comma-joined,
 * and it refuses that as malformed.
 */

export const PREVIEW_HEADER = "X-OOS-Preview";

export const PREVIEW_LIFETIME_SECONDS = 60;

const COLLECTIONS_PATH_PREFIX = "/api/public/v1/collections/";

const ORG_CACHE_TTL_MS = 60_000;

export type PreviewPayload = {
  org: string;
  sub: string;
  sid: string;
  iat: number;
  exp: number;
};

/** `v1.{payload}.{mac}`: the exact segment that was MACed is the one sent. */
export const mintPreviewAssertion = (
  payload: PreviewPayload,
  secret: string
): string => {
  const ordered = {
    org: payload.org,
    sub: payload.sub,
    sid: payload.sid,
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

// An encoded slash, backslash or dot could reach a different route once the
// app decodes the path, so a pathname carrying one never matches.
const ODD_ENCODING = /%(?:2f|5c|2e)/i;

/**
 * Whether a fetch URL is one of the app's `/v1/collections*` reads. Parsed
 * with `new URL`, never compared as a string: `https://app@evil/...` has the
 * origin `https://evil`, and userinfo is refused outright.
 */
export const isPreviewableUrl = (href: string, appUrl: string): boolean => {
  let url: URL;
  let app: URL;
  try {
    url = new URL(href);
    app = new URL(appUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return false;
  }
  if (url.username !== "" || url.password !== "") {
    return false;
  }
  if (url.origin !== app.origin) {
    return false;
  }
  if (ODD_ENCODING.test(url.pathname)) {
    return false;
  }
  return url.pathname.startsWith(COLLECTIONS_PATH_PREFIX);
};

type ProjectOwner = { provider: string | null; email: string | null };

export type PreviewDeps = {
  secret: string | undefined;
  appUrl: string;
  /** Milliseconds. */
  now: () => number;
  readSession: (request: Request) => Promise<SessionData | null>;
  /** Whether the session's OrganizeOS binding is live, not merely allowed. */
  isSessionLive: (session: SessionData) => Promise<boolean>;
  /** Upstream's project authorization, `view` or above, as this user. */
  canViewProject: (
    request: Request,
    userId: string,
    projectId: string
  ) => Promise<boolean>;
  /** The project's owner, or null for no live project. */
  loadProjectOwner: (projectId: string) => Promise<ProjectOwner | null>;
};

const canViewProject: PreviewDeps["canViewProject"] = async (
  request,
  userId,
  projectId
) => {
  const context = await createContext(request);
  // A share link's token is not this user: only a signed-in user previews.
  if (
    context.authorization.type !== "user" ||
    context.authorization.userId !== userId
  ) {
    return false;
  }
  return authorizeProject.hasProjectPermit(
    { projectId, permit: "view" },
    context
  );
};

const loadProjectOwner: PreviewDeps["loadProjectOwner"] = async (projectId) => {
  const client = createClient(env.POSTGREST_URL, env.POSTGREST_API_KEY);
  const project = await client
    .from("Project")
    .select("userId")
    .eq("id", projectId)
    .eq("isDeleted", false)
    .maybeSingle();
  if (project.error) {
    throw project.error;
  }
  if (project.data === null || project.data.userId === null) {
    return null;
  }
  const owner = await client
    .from("User")
    .select("provider, email")
    .eq("id", project.data.userId)
    .maybeSingle();
  if (owner.error) {
    throw owner.error;
  }
  return owner.data;
};

const defaultDeps = (): PreviewDeps => ({
  secret: env.WEBSITES2_PREVIEW_SECRET,
  appUrl: env.ORGANIZEOS_APP_URL,
  now: Date.now,
  readSession: readBuilderSession,
  isSessionLive: async (session) =>
    (await checkOrganizeosBinding(session)).outcome === "live",
  canViewProject,
  loadProjectOwner,
});

const orgCache = new Map<
  string,
  { organizationId: string | null; at: number }
>();

export const resetPreviewOrgCache = () => {
  orgCache.clear();
};

/** The project's organization id, as the builder loader resolves it. */
const resolveOrganizationId = async (
  projectId: string,
  deps: PreviewDeps
): Promise<string | null> => {
  const cached = orgCache.get(projectId);
  if (cached !== undefined && deps.now() - cached.at < ORG_CACHE_TTL_MS) {
    return cached.organizationId;
  }
  const owner = await deps.loadProjectOwner(projectId);
  const organizationId =
    owner !== null &&
    owner.provider === ORGANIZEOS_SERVICE_PROVIDER &&
    owner.email !== null
      ? parseOrganizationIdFromServiceEmail(owner.email)
      : null;
  if (orgCache.size > 1000) {
    orgCache.clear();
  }
  orgCache.set(projectId, { organizationId, at: deps.now() });
  return organizationId;
};

type Grant = { org: string; sub: string; sid: string };

const resolveGrant = async (
  request: Request,
  deps: PreviewDeps
): Promise<Grant | undefined> => {
  const session = await deps.readSession(request);
  if (session === null) {
    return;
  }
  const sid = session.organizeosSid;
  const sub = session.organizeosUserId;
  if (sid === undefined || sid === "" || sub === undefined || sub === "") {
    return;
  }
  if ((await deps.isSessionLive(session)) === false) {
    return;
  }
  const { projectId } = parseBuilderUrl(request.url);
  if (projectId === undefined) {
    return;
  }
  if (
    (await deps.canViewProject(request, session.userId, projectId)) === false
  ) {
    return;
  }
  const org = await resolveOrganizationId(projectId, deps);
  if (org === null) {
    return;
  }
  return { org, sub, sid };
};

/**
 * One per resources-loader request: returns the `RequestInit` a fetch should
 * go out with. The session, permission and org are resolved once, on the
 * first fetch that qualifies; each fetch gets its own assertion.
 */
export const createPreviewAssertion = (
  request: Request,
  deps: PreviewDeps = defaultDeps()
) => {
  let grant: Promise<Grant | undefined> | undefined;
  return async (
    href: string,
    init?: RequestInit
  ): Promise<RequestInit | undefined> => {
    const { secret } = deps;
    if (secret === undefined || secret === "") {
      return init;
    }
    if (isPreviewableUrl(href, deps.appUrl) === false) {
      return init;
    }
    grant ??= resolveGrant(request, deps).catch((error) => {
      // Fail closed: no assertion, published items only.
      console.error(
        "[organizeos-preview] could not resolve the preview grant",
        error instanceof Error ? error.message : "unknown error"
      );
      return undefined;
    });
    const resolved = await grant;
    if (resolved === undefined) {
      return init;
    }
    const iat = Math.floor(deps.now() / 1000);
    const headers = new Headers(init?.headers);
    // Headers.set replaces every value under any casing of the name.
    headers.set(
      PREVIEW_HEADER,
      mintPreviewAssertion(
        { ...resolved, iat, exp: iat + PREVIEW_LIFETIME_SECONDS },
        secret
      )
    );
    return { ...init, headers };
  };
};
