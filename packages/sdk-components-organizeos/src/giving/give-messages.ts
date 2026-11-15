import { navigationTarget } from "../form/navigate";
import { GIVE_DONE_TYPE, GIVE_HEIGHT_TYPE, GIVE_MAX_HEIGHT } from "./contract";

/**
 * The frame's two messages to the Donation Form (OrganizeOS builder donations
 * spec 2026-11-13, 5.6; plan F1, F-D11 and F-D12), and where the block goes
 * after a gift. The frame posts only to the validated parent; the block takes
 * a message only from the platform origin and from its own frame's window,
 * and never posts to the frame.
 */

export type GiveMessage = { type: "height"; height: number } | { type: "done" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

/**
 * The message an event carries, when it comes from `platformOrigin` and from
 * `frame`, the block's own iframe's window. A height is a finite number above
 * 0, rounded up and capped at GIVE_MAX_HEIGHT. Anything else is undefined.
 */
export const readGiveMessage = (
  event: Pick<MessageEvent, "origin" | "source" | "data">,
  from: { platformOrigin: string; frame: Window | null }
): GiveMessage | undefined => {
  if (
    from.frame === null ||
    event.origin !== from.platformOrigin ||
    event.source !== from.frame
  ) {
    return;
  }
  const { data } = event;
  if (isRecord(data) === false) {
    return;
  }
  if (data.type === GIVE_DONE_TYPE) {
    return { type: "done" };
  }
  if (data.type === GIVE_HEIGHT_TYPE) {
    const { height } = data;
    if (typeof height !== "number" || Number.isFinite(height) === false) {
      return;
    }
    if (height <= 0) {
      return;
    }
    return {
      type: "height",
      height: Math.min(Math.ceil(height), GIVE_MAX_HEIGHT),
    };
  }
};

/**
 * Where the page goes after a gift: the after-gift page as `navigationTarget`
 * resolves it (http(s) only, the visit's share code carried to a platform
 * path), and only on the page's own origin. A blank value, another site and a
 * `javascript:` address are undefined, so the thank-you stays in the frame.
 * `afterGiftPage` is not an address prop to the org-script rules, so this is
 * its guard.
 */
export const afterGiftTarget = (href: unknown): string | undefined => {
  if (typeof href !== "string" || href.trim() === "") {
    return;
  }
  const target = navigationTarget(href);
  if (target === undefined) {
    return;
  }
  try {
    return new URL(target).origin === window.location.origin
      ? target
      : undefined;
  } catch {
    return;
  }
};
