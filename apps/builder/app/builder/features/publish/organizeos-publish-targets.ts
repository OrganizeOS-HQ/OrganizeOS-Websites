import type { OrganizeosPublishState } from "./organizeos-publish-status";
import type {
  PublishOutcome,
  SiteAddresses,
  SiteTarget,
} from "./organizeos-publish-addresses";

/**
 * The Publish dialog's rules for an OrganizeOS site: which addresses are
 * ticked, how a row is labelled, when the version cannot go live, and the one
 * line each failed publish shows (docs/ORGANIZEOS-FORK.md section 5).
 */

/** The ticks a read sets: exactly the live addresses, none before the first go-live. */
export const defaultTicks = (targets: SiteTarget[]): Set<string> =>
  new Set(targets.filter((target) => target.live).map((target) => target.key));

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
    case "forbidden":
      return "You can't publish this site.";
    case "timeout":
      return "Publishing did not answer in time. Check the status and try again.";
    default:
      return "Publishing failed. Please try again.";
  }
};
