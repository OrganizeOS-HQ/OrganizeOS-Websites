// OrganizeOS: expire the platform's old, domain-wide session cookie on every
// document the builder serves under organizeos.org (docs/ORGANIZEOS-FORK.md
// section 5, "Old session cookies").
//
// The platform's session used to be `sb-<ref>-auth-token` (chunked `.0`,
// `.1`, ...) with `Domain=.organizeos.org`, so it reached the builder and every
// `p-{projectId}.builder.organizeos.org` canvas. It now lives host-only on the
// app host. A leftover copy can still sit in a browser; this deletes it before
// any page script can read it. The new cookie is never named here: it cannot
// reach the builder.

const flagName = "ORGANIZEOS_EXPIRE_LEGACY_SESSION";

const legacySessionCookieName =
  /^sb-[a-z0-9]+-auth-token(?:-code-verifier)?(?:\.(?:0|[1-9]\d*))?$/;

const legacyCookieDomain = "organizeos.org";

/** Off unless the flag is exactly `true`. Read on every call, not at build. */
export const legacySessionExpiryEnabled = (): boolean =>
  process.env[flagName]?.trim() === "true";

const isUnderLegacyCookieDomain = (request: Request): boolean => {
  let hostname: string;
  try {
    hostname = new URL(request.url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    hostname === legacyCookieDomain ||
    hostname.endsWith(`.${legacyCookieDomain}`)
  );
};

/** The old session cookie names the request carried, each once, in order. */
export const legacySessionCookieNames = (request: Request): string[] => {
  const names = new Set<string>();
  for (const pair of (request.headers.get("Cookie") ?? "").split(";")) {
    const separator = pair.indexOf("=");
    const name = (separator === -1 ? pair : pair.slice(0, separator)).trim();
    if (legacySessionCookieName.test(name)) {
      names.add(name);
    }
  }
  return [...names];
};

const expired = (name: string) =>
  `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure`;

/** The two deletes for one name: the domain-wide copy and a host-only one. */
export const legacySessionDeletes = (name: string): string[] => [
  `${expired(name)}; Domain=.${legacyCookieDomain}`,
  expired(name),
];

/**
 * Appends the deletes to a document response's headers. Call it last, once
 * the routes' own headers are in: these are raw appends, one Set-Cookie each.
 * Remix renders a document a second time with the same headers after an
 * error, so a delete already there is not added again.
 */
export const expireLegacySessionCookies = (
  request: Request,
  responseHeaders: Headers
): void => {
  if (legacySessionExpiryEnabled() === false) {
    return;
  }
  if (isUnderLegacyCookieDomain(request) === false) {
    return;
  }
  const present = new Set(responseHeaders.getSetCookie());
  for (const name of legacySessionCookieNames(request)) {
    for (const cookie of legacySessionDeletes(name)) {
      if (present.has(cookie) === false) {
        responseHeaders.append("Set-Cookie", cookie);
        present.add(cookie);
      }
    }
  }
};
