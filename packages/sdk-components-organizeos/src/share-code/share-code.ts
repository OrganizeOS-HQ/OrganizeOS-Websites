/**
 * A visitor's share code. A member's share link opens an organization's page
 * with `?r=` and a 10-character code, which OrganizeOS credits to the member
 * when the visitor signs up, registers or gives during that visit. The blocks
 * keep it in the page's address only, never in a cookie or storage.
 *
 * Copied from OrganizeOS-HQ/OrganizeOS at commit 39ce1bbe3, which calls the
 * share code a referral code (its wire field is `referral_code`):
 *
 * - `client/lib/referrals/code.ts`: `REFERRAL_CODE_PARAM`,
 *   `REFERRAL_CODE_PATTERN`, `isReferralCode` and `readReferralCode`;
 * - `client/lib/referrals/carry-code.ts`: `withReferralCode`;
 * - `client/lib/verification/public-route-allowlist.ts`: the transactional flow
 *   family, `PLATFORM_FLOW_PATTERNS`, and its `normalize`.
 *
 * Both repositories test their copy against the same bytes,
 * `__fixtures__/share-code.json`: change OrganizeOS first, then copy, as for
 * the contract fixtures (docs/ORGANIZEOS-FORK.md section 9). No import beyond
 * the language, so every block and a published page can use it.
 */

/** The query parameter a share link carries: `?r={code}`. */
export const shareCodeParam = "r";

/** Ten characters from an alphabet without 0, O, I or l. */
export const shareCodePattern = /^[1-9A-HJ-NP-Za-km-z]{10}$/;

/** True when the value has a share code's shape; says nothing of whether it exists. */
export const isShareCode = (value: unknown): value is string =>
  typeof value === "string" && shareCodePattern.test(value);

/**
 * The code in a query string (`?r=...`), or undefined when there is none or it
 * cannot be a code. With `r` given twice, the first value is read, as
 * `URLSearchParams.get` does.
 */
export const readShareCode = (
  search: URLSearchParams | string | null | undefined
): string | undefined => {
  if (search === null || search === undefined || search === "") {
    return;
  }
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const value = params.get(shareCodeParam);
  return isShareCode(value) ? value : undefined;
};

/**
 * The code in the address the page has when this is called, never cached: a
 * site page can change its address without a reload. Undefined on the server.
 */
export const readPageShareCode = (): string | undefined => {
  if (typeof window === "undefined") {
    return;
  }
  return readShareCode(window.location.search);
};

/**
 * The link with the code as `?r={code}`. Absolute and relative hrefs both
 * work; an `r` already there is replaced, and the rest of the query (encoded
 * again by `URLSearchParams`) and the fragment are kept. A value that cannot be
 * a code leaves the href unchanged.
 */
export const withShareCode = (
  href: string,
  code: string | null | undefined
): string => {
  if (isShareCode(code) === false) {
    return href;
  }
  const hashAt = href.indexOf("#");
  const hash = hashAt >= 0 ? href.slice(hashAt) : "";
  const beforeHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const queryAt = beforeHash.indexOf("?");
  const path = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const params = new URLSearchParams(
    queryAt >= 0 ? beforeHash.slice(queryAt + 1) : ""
  );
  params.set(shareCodeParam, code);
  return `${path}?${params.toString()}${hash}`;
};

/**
 * The organization's platform pages a share code is carried to: donate,
 * fundraise, petitions, join, shop, cart, checkout and an event's page. These
 * are exactly the paths an org host leaves to the platform rather than its
 * published site, so the code never goes to the site's own pages by this list.
 * The donor self-service pages (unsubscribe, giving management) are left out:
 * they carry a token from email.
 */
export const platformPathPatterns: ReadonlyArray<RegExp> = [
  /^\/donate(\/[^/]+)?$/,
  /^\/fundraise\/[^/]+$/,
  /^\/petitions\/[^/]+(\/(confirm|thanks))?$/,
  /^\/join(\/[^/]+)?$/,
  /^\/shop(\/[^/]+)?$/,
  /^\/cart$/,
  /^\/checkout(\/success)?$/,
  /^\/events\/[^/]+$/,
];

/** A trailing slash never changes which route answers; compare without it. */
const normalize = (pathname: string) =>
  pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

/** True when the path is one of the organization's platform pages. */
export const isPlatformPath = (pathname: string): boolean => {
  const path = normalize(pathname);
  return platformPathPatterns.some((pattern) => pattern.test(path));
};
