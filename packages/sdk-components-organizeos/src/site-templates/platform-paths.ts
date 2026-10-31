// The routes the platform serves on a site's own host, which a template links
// to by path and never has a page at (OrganizeOS docs/features/
// website-builder.md, the transactional flows). A published site's router has
// no route there, so a link to one is a document navigation
// (`reloadDocument`), as the Event Card's link to `/events/{slug}` is; any
// other page is linked by its key. More join as a template needs them.

export const PLATFORM_PATHS = ["/donate"] as const;

export type PlatformPath = (typeof PLATFORM_PATHS)[number];

export const isPlatformPath = (href: string): href is PlatformPath =>
  (PLATFORM_PATHS as readonly string[]).includes(href);

/** The middle of a profile handle (OrganizeOS packages/shared/src/profile/handle.ts, HANDLE_BODY). */
const HANDLE_BODY = "[a-z0-9_](?:[a-z0-9_-]{0,28}[a-z0-9_])";

/** `prefix` itself or a path below it: segment-exact, so /authors is not /auth. */
const under = (prefix: string) =>
  new RegExp(`^${prefix.replaceAll("/", "\\/")}(\\/.*)?$`);

/**
 * Every path the platform answers itself on an org's site host, before the
 * org's published site sees the request, so a page of a template there would
 * never show; the check refuses one. Mirrored by hand from two files in the
 * OrganizeOS repository, and kept in step with them:
 *
 * - client/lib/verification/public-route-allowlist.ts:
 *   `DONOR_SELF_SERVICE_PATTERNS` and `PLATFORM_FLOW_PATTERNS`, the donor
 *   pages and the transactional flows (only `/events/<slug>` is the
 *   platform's, not `/events`);
 * - client/lib/middleware/org-host-route.ts: `decideOrgHostRoute`'s prefixes
 *   (with `/admin` and `/design-system` from
 *   client/lib/auth/platform-admin-paths.ts), each segment-exact as its
 *   `isUnder` is, and `HANDLE_PATH_RE`, a profile at `/@handle`.
 */
export const PLATFORM_SERVED_PATHS: readonly RegExp[] = [
  // public-route-allowlist.ts
  /^\/unsubscribe$/,
  /^\/confirm-subscription$/,
  /^\/giving\/manage\/[^/]+$/,
  /^\/donate(\/[^/]+)?$/,
  /^\/fundraise\/[^/]+$/,
  /^\/petitions\/[^/]+(\/(confirm|thanks))?$/,
  /^\/join(\/[^/]+)?$/,
  /^\/shop(\/[^/]+)?$/,
  /^\/cart$/,
  /^\/checkout(\/success)?$/,
  /^\/events\/[^/]+$/,
  // org-host-route.ts
  ...[
    "/org",
    "/api",
    "/_next",
    "/admin",
    "/design-system",
    "/login",
    "/signup",
    "/reset-password",
    "/workspace",
    "/member",
    "/auth",
    "/workspace-auth",
    "/dashboard",
    "/account",
    "/onboarding",
    "/meetings",
    "/embed",
  ].map(under),
  new RegExp(`^\\/@(${HANDLE_BODY})\\/?$`, "i"),
];

/**
 * Whether the platform answers `path` itself on an org's site host
 * (PLATFORM_SERVED_PATHS). A trailing slash changes nothing, as on the
 * platform.
 */
export const isPlatformServedPath = (path: string): boolean => {
  const normalized = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return PLATFORM_SERVED_PATHS.some((pattern) => pattern.test(normalized));
};
