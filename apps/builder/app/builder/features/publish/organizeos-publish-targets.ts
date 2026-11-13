import type { OrganizeosSite } from "~/shared/organizeos-site";
import type { OrganizeosPublishState } from "./organizeos-publish-status";
import type {
  PublishOutcome,
  SiteAddresses,
  SiteTarget,
  UnpublishOutcome,
} from "./organizeos-publish-addresses";

/**
 * The Publish dialog's rules for an OrganizeOS site: which addresses are
 * ticked, how a row is labelled, when the version cannot go live, and the one
 * line each failed publish shows (docs/ORGANIZEOS-FORK.md section 5).
 */

/** The address serves its build now; a platform without `serving` says live. */
export const isServing = (target: SiteTarget) => target.serving ?? target.live;

/** The ticks a read sets: exactly the live addresses, none before the first go-live. */
export const defaultTicks = (targets: SiteTarget[]): Set<string> =>
  new Set(targets.filter(isServing).map((target) => target.key));

/**
 * The ticks after a read. The first read, and the read after a publish
 * settles, set the live addresses; any other read keeps what the person
 * ticked, less any address the read no longer lists.
 */
export const nextTicks = (
  previous: Set<string> | undefined,
  targets: SiteTarget[],
  { reset }: { reset: boolean }
): Set<string> => {
  if (previous === undefined || reset) {
    return defaultTicks(targets);
  }
  const keys = new Set(targets.map((target) => target.key));
  return new Set(Array.from(previous).filter((key) => keys.has(key)));
};

/** "Built-in", "Main", or nothing. */
export const rowLabel = (target: SiteTarget): string | undefined => {
  if (target.builtin) {
    return "Built-in";
  }
  if (target.main) {
    return "Main";
  }
};

/** The props that open a link in a new tab. */
export const newTabLink = {
  target: "_blank",
  rel: "noreferrer",
} as const;

/** OrganizeOS's domain settings, from the read, else from the site. */
export const manageDomainsUrlOf = (
  site: Pick<OrganizeosSite, "platformUrl" | "subdomain">,
  addresses: SiteAddresses | undefined
): string | undefined => {
  if (addresses !== undefined) {
    return addresses.manageDomainsUrl;
  }
  if (site.subdomain === undefined) {
    return;
  }
  return `${site.platformUrl.replace(/\/+$/, "")}/${site.subdomain}/settings/domain`;
};

/** The last build is published, and OrganizeOS says it cannot go live. */
export const cannotGoLive = (
  addresses: SiteAddresses | undefined,
  state: OrganizeosPublishState
) => state.status === "published" && addresses?.launchable === false;

/** The line a failed publish shows, once. */
export const publishErrorLine = (
  outcome: Extract<PublishOutcome, { ok: false }>
): string => {
  switch (outcome.error) {
    case "unknown_target":
    case "old_site_changed":
    case "replace_unconfirmed":
    case "old_site_needs_main":
      return "Your addresses changed. Check them and publish again.";
    case "addresses_unavailable":
    case "targets_unavailable":
    case "publish_unavailable":
      return "Publishing is not available right now.";
    case "build_refused":
      return "This version can't be published.";
    case "dispatch_failed":
      return (
        outcome.message ?? "Publishing could not be started. Please try again."
      );
    case "forms":
      // The publish step's own line: a block and its page, or a reason.
      return outcome.message ?? "Forms could not be saved. Try again.";
    case "forbidden":
      return "You can't publish this site.";
    case "timeout":
      return "Publishing did not answer in time. Check the status and try again.";
    default:
      return "Publishing failed. Please try again.";
  }
};

/**
 * While the organization's addresses show its old site, publishing to this
 * row replaces it: every custom address, and the built-in when it is the
 * address serving the old site. The built-in beside a custom main that serves
 * the old site is a trial copy.
 */
export const isReplaceRow = (
  target: SiteTarget,
  oldSiteKey: string | undefined
) =>
  oldSiteKey !== undefined &&
  (target.builtin === false || oldSiteKey === target.key);

/** The row's word: Live, Not live, or Shows your old site. */
export const rowWord = (
  target: SiteTarget,
  oldSiteKey: string | undefined
): string => {
  if (isServing(target)) {
    return "Live";
  }
  return isReplaceRow(target, oldSiteKey) ? "Shows your old site" : "Not live";
};

/**
 * What publishing the ticked keys asks: nothing more (`none`), the address
 * serving the old site ticked first (`needs_anchor`), or the replace confirm
 * (`confirm`).
 */
export const replaceState = (
  tickedKeys: string[],
  targets: SiteTarget[],
  oldSiteKey: string | undefined
): "none" | "needs_anchor" | "confirm" => {
  if (oldSiteKey === undefined) {
    return "none";
  }
  const replaces = targets.some(
    (target) =>
      tickedKeys.includes(target.key) && isReplaceRow(target, oldSiteKey)
  );
  if (replaces === false) {
    return "none";
  }
  return tickedKeys.includes(oldSiteKey) ? "confirm" : "needs_anchor";
};

/**
 * Unpublish is offered on a row with a recorded build that is not taken down,
 * while the builder can ask and OrganizeOS has not said the action is
 * unavailable.
 */
export const canUnpublish = (
  target: SiteTarget,
  { actions, hidden }: { actions: boolean; hidden: boolean }
) =>
  actions &&
  hidden === false &&
  target.publishedAt !== null &&
  (target.unpublishedAt ?? null) === null;

/** The line a failed Unpublish shows, once; none when the re-read says it all. */
export const unpublishErrorLine = (
  outcome: Extract<UnpublishOutcome, { ok: false }>
): string | undefined => {
  switch (outcome.error) {
    case "rate_limited":
      return "Try again in a few minutes.";
    case "forbidden":
      return "You can't unpublish this address.";
    case "failed":
    case "timeout":
      return "Couldn't unpublish. Try again.";
    case "unavailable":
    case "unknown_target":
    case "not_live":
      return;
  }
};
