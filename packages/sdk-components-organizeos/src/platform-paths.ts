// The paths the platform answers itself on an org's site host, so a page of
// the site there would never show (OrganizeOS docs/features/
// website-builder.md, the transactional flows). Its own export,
// `@organizeos/site-components/platform-paths`, importing nothing, so the
// builder's page settings (packages/project-build) and the New page screen
// can refuse such a path without loading the template catalog.

/** The middle of a profile handle (OrganizeOS packages/shared/src/profile/handle.ts, HANDLE_BODY). */
const HANDLE_BODY = "[a-z0-9_](?:[a-z0-9_-]{0,28}[a-z0-9_])";

/** `prefix` itself or a path below it: segment-exact, so /authors is not /auth. */
const under = (prefix: string) =>
  new RegExp(`^${prefix.replaceAll("/", "\\/")}(\\/.*)?$`);

/**
 * Every path the platform answers itself on an org's site host, before the
 * org's published site sees the request, so a page of a template there would
 * never show; the check refuses one. Mirrored by hand from three files in
 * the OrganizeOS repository, and kept in step with them:
 *
 * - client/lib/verification/public-route-allowlist.ts:
 *   `DONOR_SELF_SERVICE_PATTERNS` and `PLATFORM_FLOW_PATTERNS`, the donor
 *   pages and the transactional flows (only `/events/<slug>` is the
 *   platform's, not `/events`);
 * - client/lib/middleware/org-host-route.ts: `decideOrgHostRoute`'s prefixes
 *   (with `/admin` and `/design-system` from
 *   client/lib/auth/platform-admin-paths.ts), each segment-exact as its
 *   `isUnder` is, and `HANDLE_PATH_RE`, a profile at `/@handle`;
 * - client/middleware.ts: `/org-profile` and the paths below it, the org
 *   profile renderer, which it answers with a 404 on every host (a profile
 *   is reached only through the `/@handle` rewrite); every path below
 *   `/.well-known/`, which it passes to the platform's static files on every
 *   host (security.txt, the mobile app's deep-link files); and the paths its
 *   `config.matcher` skips the middleware for, which the platform's static
 *   files answer or 404: `/fonts/`, `/icons/` and `/screenshots/` and what
 *   is below them, `/sw.js`, `/workbox-*.js`, `/manifest.webmanifest`,
 *   `/favicon.ico`, and a path that ends in an image, font or sound
 *   extension outside `/assets/`, `/api/` and `/org/`.
 */
export const PLATFORM_SERVED_PATHS: readonly RegExp[] = [
  // public-route-allowlist.ts
  /^\/unsubscribe$/,
  /^\/confirm-subscription$/,
  /^\/giving\/manage$/,
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
  // middleware.ts
  under("/org-profile"),
  /^\/\.well-known\//,
  // middleware.ts, config.matcher: what follows its first "/", as the matcher
  // writes it
  /^\/(?:_next\/static|_next\/image|api\/inngest|favicon\.ico|fonts\/|icons\/|screenshots\/|manifest\.webmanifest|sw\.js|workbox-.*\.js|(?!assets\/|api\/|org\/).*\.(?:svg|png|jpg|jpeg|gif|webp|ttf|otf|woff|woff2|ico|webmanifest|wav)$)/,
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
