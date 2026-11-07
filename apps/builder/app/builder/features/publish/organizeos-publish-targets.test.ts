import { describe, expect, test } from "vitest";
import type { SiteAddresses, SiteTarget } from "./organizeos-publish-addresses";
import {
  cannotGoLive,
  defaultTicks,
  nextTicks,
  publishErrorLine,
  rowLabel,
} from "./organizeos-publish-targets";

const target = (change: Partial<SiteTarget>): SiteTarget => ({
  key: "example.net",
  host: "example.net",
  builtin: false,
  main: false,
  publishedAt: null,
  live: false,
  ...change,
});

const builtin = target({
  key: "builtin",
  host: "example-org.organizeos.org",
  builtin: true,
});
const main = target({
  key: "www.example.org",
  host: "www.example.org",
  main: true,
});
const other = target({});

const addresses = (change: Partial<SiteAddresses>): SiteAddresses => ({
  host: "www.example.org",
  origin: "https://www.example.org",
  status: "live",
  manageDomainsUrl: "https://app.organizeos.org/example-org/settings/domain",
  ...change,
});

const at = new Date("2026-11-07T12:00:00Z");

describe("the Publish dialog's ticks", () => {
  test("before the first go-live nothing is ticked", () => {
    expect(defaultTicks([builtin, main, other])).toEqual(new Set());
    expect(
      nextTicks(undefined, [builtin, main, other], { reset: false })
    ).toEqual(new Set());
  });

  test("the first read ticks exactly the live addresses", () => {
    const targets = [
      { ...builtin, live: true },
      main,
      { ...other, live: true },
    ];
    expect(nextTicks(undefined, targets, { reset: false })).toEqual(
      new Set(["builtin", "example.net"])
    );
  });

  test("a person's ticks hold through every read while their publish is pending", () => {
    const ticked = new Set(["builtin", "www.example.org"]);
    const targets = [{ ...builtin, live: true }, main, other];
    expect(nextTicks(ticked, targets, { reset: false })).toEqual(ticked);
  });

  test("the read after a publish settles resets them to the live addresses", () => {
    const ticked = new Set(["builtin", "www.example.org", "example.net"]);
    const targets = [
      { ...builtin, live: true },
      { ...main, live: true },
      other,
    ];
    expect(nextTicks(ticked, targets, { reset: true })).toEqual(
      new Set(["builtin", "www.example.org"])
    );
  });

  test("a ticked address the newer read no longer lists is dropped", () => {
    const ticked = new Set(["builtin", "example.net"]);
    expect(nextTicks(ticked, [builtin, main], { reset: false })).toEqual(
      new Set(["builtin"])
    );
  });
});

describe("the Publish dialog's row labels", () => {
  test("the built-in address is Built-in, the main Main, the others nothing", () => {
    expect(rowLabel(builtin)).toBe("Built-in");
    expect(rowLabel(main)).toBe("Main");
    expect(rowLabel(other)).toBeUndefined();
  });
});

describe("the line for a version that can't go live", () => {
  test("shows only for a published build OrganizeOS says cannot go live", () => {
    const published = { status: "published" as const, at };
    expect(cannotGoLive(addresses({ launchable: false }), published)).toBe(
      true
    );
    expect(cannotGoLive(addresses({ launchable: true }), published)).toBe(
      false
    );
    expect(cannotGoLive(addresses({}), published)).toBe(false);
    expect(cannotGoLive(undefined, published)).toBe(false);
    for (const state of [
      { status: "idle" as const },
      { status: "pending" as const, at },
      { status: "failed" as const, at, timedOut: false },
      { status: "failed" as const, at, timedOut: true },
    ]) {
      expect(
        cannotGoLive(addresses({ launchable: false }), state),
        state.status
      ).toBe(false);
    }
  });
});

describe("the line for a failed publish", () => {
  test("names each refusal in a few words", () => {
    expect(publishErrorLine({ ok: false, error: "unknown_target" })).toBe(
      "Your addresses changed. Check them and publish again."
    );
    for (const error of [
      "addresses_unavailable",
      "targets_unavailable",
      "publish_unavailable",
    ]) {
      expect(publishErrorLine({ ok: false, error }), error).toBe(
        "Publishing is not available right now."
      );
    }
    expect(publishErrorLine({ ok: false, error: "build_refused" })).toBe(
      "This version can't be published."
    );
    expect(
      publishErrorLine({
        ok: false,
        error: "dispatch_failed",
        message: "Publishing could not be started. Please try again.",
      })
    ).toBe("Publishing could not be started. Please try again.");
    expect(publishErrorLine({ ok: false, error: "timeout" })).toBe(
      "Publishing did not answer in time. Check the status and try again."
    );
    expect(publishErrorLine({ ok: false, error: "forbidden" })).toBe(
      "You can't publish this site."
    );
    expect(publishErrorLine({ ok: false, error: "anything else" })).toBe(
      "Publishing failed. Please try again."
    );
  });
});
