import { json } from "@remix-run/server-runtime";
import { z } from "zod";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import type { Deployment } from "@webstudio-is/sdk";
import type { SessionData } from "~/services/auth.server.utils";
import type { OrganizeosBindingOutcome } from "~/services/auth-strategy/organizeos-session.server";
import type { OrganizeosPublisher } from "~/services/organizeos-publisher.server";
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

/**
 * OrganizeOS fork: the Publish dialog's publish, to the addresses the admin
 * ticked (docs/ORGANIZEOS-FORK.md section 5).
 *
 * A fetch only (a document or iframe load is refused), with the page's CSRF
 * token, for a user signed in as a user (never a share link's token) whose
 * OrganizeOS session is live (`pass` only where SSO is not configured), in
 * either binding mode, and who holds the project's `admin` permit. The org is
 * the project owner's (resolveProjectOrganization), never the request's.
 *
 * The body is `{ targets, replacePages? }`: 1 to 20 distinct keys, each
 * `builtin` or a host, and `replacePages: true` once the admin confirmed
 * replacing the organization's old site.
 * Every key must be one of the org's own targets in OrganizeOS's addresses
 * read, made here at the moment of the publish; one that is not refuses the
 * whole publish before anything is written. The build row is written as
 * `domain.publish` writes it for an org site (its domains are the project's
 * own domain alone), and the keys from the read, never the request's text, go
 * to the OrganizeOS publisher, which dispatches them with the build. OrganizeOS
 * then puts each one live when the build passes its checks.
 *
 * Answers, never stored: `200 { ok: true }`; `400 invalid_request`; `403` (no
 * user session, no live binding, no `admin` permit, or not an org's project);
 * `409 unknown_target`, `replace_unconfirmed` (a ticked address would replace
 * the organization's old site, unconfirmed), `old_site_needs_main` (a replace
 * without the address serving the old site) or `old_site_changed` (a replace
 * for an organization whose addresses no longer show an old site), or `409`
 * when the build's org is not the project's;
 * `405` for any method but POST; `422 build_refused` (the version cannot be
 * published); `502 dispatch_failed`
 * with the publisher's own message; `503 addresses_unavailable`,
 * `targets_unavailable` or `publish_unavailable`. A failure logs one code,
 * never a host, an id or an upstream message.
 */

/** A request body larger than this is refused unread. */
const MAX_BODY_BYTES = 4096;

const MAX_TARGETS = 20;

const keySchema = z
  .string()
  .refine((key) => key === BUILTIN_TARGET_KEY || HOST_PATTERN.test(key));

const bodySchema = z
  .object({
    targets: z
      .array(keySchema)
      .min(1)
      .max(MAX_TARGETS)
      .refine((keys) => new Set(keys).size === keys.length),
    // The admin confirmed replacing the organization's old site
    replacePages: z.literal(true).optional(),
  })
  .strict();

export type PublishRouteDeps = {
  checkCsrf: (request: Request) => Promise<void>;
  createContext: (request: Request) => Promise<AppContext>;
  readSession: (request: Request) => Promise<SessionData | null>;
  bindingOutcome: (session: SessionData) => Promise<OrganizeosBindingOutcome>;
  hasAdminPermit: (projectId: string, context: AppContext) => Promise<boolean>;
  resolveOrganization: (
    projectId: string,
    context: AppContext
  ) => Promise<ProjectOrganization>;
  /** The org's addresses row, or undefined when it cannot be had. */
  fetchAddresses: (
    organizationId: string
  ) => Promise<SiteAddressesRow | undefined>;
  /** `Project.domain`, or undefined when it cannot be read. */
  loadProjectDomain: (
    projectId: string,
    context: AppContext
  ) => Promise<string | undefined>;
  createBuild: (
    props: { projectId: string; deployment: Deployment },
    context: AppContext
  ) => Promise<{ id: string }>;
  getPublisher: () => OrganizeosPublisher | undefined;
  publisherHost: string;
  platformUrl: string;
};

type LogCode =
  | "binding_refused"
  | "owner_read_failed"
  | "addresses_unavailable"
  | "targets_unavailable"
  | "unknown_target"
  | "replace_unconfirmed"
  | "old_site_needs_main"
  | "old_site_changed"
  | "publish_unavailable"
  | "project_read_failed"
  | "build_refused"
  | "organization_mismatch"
  | "dispatch_failed";

const log = (code: LogCode, detail?: string) => {
  console.error(
    detail === undefined
      ? `[organizeos-publish] ${code}`
      : `[organizeos-publish] ${code} ${detail}`
  );
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

/** The kind of a thrown value, for a log line: never its message. */
const errorKind = (error: unknown) =>
  error instanceof Error ? error.constructor.name : typeof error;

export const handlePublishRequest = async (
  request: Request,
  projectId: string | undefined,
  deps: PublishRouteDeps
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
  // Stricter than the session readers, which allow every outcome while the
  // binding is observed: publishing puts addresses live, so it needs a live
  // OrganizeOS session whatever the mode.
  const outcome = await deps.bindingOutcome(session);
  if (outcome !== "live" && outcome !== "pass") {
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
  const { targets, oldSiteKey } = composeSiteAddresses({
    row,
    publisherHost: deps.publisherHost,
    platformUrl: deps.platformUrl,
  });
  if (targets === undefined) {
    log("targets_unavailable");
    return answer({ ok: false, error: "targets_unavailable" }, 503);
  }

  // Every ticked key must be one of this org's targets; what is sent on is
  // the read's own keys, in the read's order.
  const ticked = new Set(parsed.data.targets);
  const known = new Set(targets.map((target) => target.key));
  if (parsed.data.targets.some((key) => known.has(key) === false)) {
    log("unknown_target");
    return answer({ ok: false, error: "unknown_target" }, 409);
  }
  const keys = targets
    .filter((target) => ticked.has(target.key))
    .map((target) => target.key);

  // The organization's old site (its addresses still show it). Publishing to
  // a custom address, or to the built-in when it is the address serving the
  // old site, replaces it: that needs the admin's confirm and the address
  // serving the old site among the keys. The built-in alone, beside a custom
  // main that serves the old site, is a trial copy and needs neither.
  const replacePages = parsed.data.replacePages === true;
  if (oldSiteKey === undefined) {
    if (replacePages) {
      log("old_site_changed");
      return answer({ ok: false, error: "old_site_changed" }, 409);
    }
  } else {
    const replaces = keys.some(
      (key) => key !== BUILTIN_TARGET_KEY || oldSiteKey === BUILTIN_TARGET_KEY
    );
    if (replaces && replacePages === false) {
      log("replace_unconfirmed");
      return answer({ ok: false, error: "replace_unconfirmed" }, 409);
    }
    if (replacePages && keys.includes(oldSiteKey) === false) {
      log("old_site_needs_main");
      return answer({ ok: false, error: "old_site_needs_main" }, 409);
    }
  }

  const publisher = deps.getPublisher();
  if (publisher === undefined) {
    log("publish_unavailable");
    return answer({ ok: false, error: "publish_unavailable" }, 503);
  }

  const domain = await deps.loadProjectDomain(projectId, context);
  if (domain === undefined) {
    log("project_read_failed");
    return answer({ ok: false, error: "publish_unavailable" }, 503);
  }

  // As domain.publish writes it for an org site: the project's own domain
  // alone, so the builder's status and the published bundle find the build
  // and what the CLI builds is unchanged. The addresses go with the dispatch.
  const deployment: Deployment = {
    destination: "saas",
    target: "production",
    domains: [domain],
    assetsDomain: domain,
    excludeWstdDomainFromSearch: false,
  };
  let buildId: string;
  try {
    buildId = (await deps.createBuild({ projectId, deployment }, context)).id;
  } catch (error) {
    log("build_refused", errorKind(error));
    return answer({ ok: false, error: "build_refused" }, 422);
  }

  let result: Awaited<ReturnType<OrganizeosPublisher["publish"]["mutate"]>>;
  try {
    result = await publisher.publish.mutate({
      buildId,
      destination: "saas",
      targets: keys,
      ...(replacePages ? { replacePages: true as const } : {}),
      expectedOrganizationId: organizationId,
    });
  } catch (error) {
    log("dispatch_failed", errorKind(error));
    return answer({ ok: false, error: "dispatch_failed" }, 502);
  }
  if (result.success === false) {
    if (result.organizationMismatch === true) {
      log("organization_mismatch");
      return answer({ ok: false }, 409);
    }
    log("dispatch_failed");
    return answer(
      { ok: false, error: "dispatch_failed", message: result.error },
      502
    );
  }
  return answer({ ok: true });
};
