import { describe, expect, test } from "vitest";
import type { SiteAddresses, SiteTarget } from "./organizeos-publish-addresses";
import {
  canUnpublish,
  cannotGoLive,
  defaultTicks,
  isReplaceRow,
  manageDomainsUrlOf,
  newTabLink,
  nextTicks,
  publishErrorLine,
  replaceState,
  rowLabel,
  rowWord,
  unpublishErrorLine,
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

describe("the line for a publish the forms step refused", () => {
  test("shows the route's line, or the generic forms line without one", () => {
    expect(
      publishErrorLine({
        ok: false,
        error: "forms",
        message: "Pick a form for Newsletter on Home.",
      })
    ).toBe("Pick a form for Newsletter on Home.");
    expect(publishErrorLine({ ok: false, error: "forms" })).toBe(
      "Forms could not be saved. Try again."
    );
  });
});

describe("serving, the old site and the replace", () => {
  test("serving drives the ticks and the word; without it, live does", () => {
    const staged = { ...builtin, live: true, serving: true };
    const notServing = { ...builtin, live: true, serving: false };
    expect(defaultTicks([notServing, main])).toEqual(new Set());
    expect(defaultTicks([staged, main])).toEqual(new Set(["builtin"]));
    expect(defaultTicks([{ ...builtin, live: true }])).toEqual(
      new Set(["builtin"])
    );
    expect(rowWord(staged, undefined)).toBe("Live");
    expect(rowWord(notServing, undefined)).toBe("Not live");
  });

  test("with the old site on a custom main, the custom rows show it and the built-in is a trial copy", () => {
    const key = "www.example.org";
    expect(rowWord(main, key)).toBe("Shows your old site");
    expect(rowWord(other, key)).toBe("Shows your old site");
    expect(rowWord(builtin, key)).toBe("Not live");
    expect(isReplaceRow(builtin, key)).toBe(false);
    expect(isReplaceRow(main, key)).toBe(true);
    expect(rowWord(main, undefined)).toBe("Not live");
  });

  test("with the old site on the built-in, the built-in is a replace row too", () => {
    expect(rowWord(builtin, "builtin")).toBe("Shows your old site");
    expect(isReplaceRow(builtin, "builtin")).toBe(true);
  });

  test("replaceState: none, needs the address serving the old site, or the confirm", () => {
    const targets = [builtin, main, other];
    const key = "www.example.org";
    expect(replaceState(["builtin"], targets, key)).toBe("none");
    expect(replaceState(["example.net"], targets, key)).toBe("needs_anchor");
    expect(replaceState(["builtin", key], targets, key)).toBe("confirm");
    expect(replaceState(["example.net", key], targets, key)).toBe("confirm");
    expect(replaceState(["example.net"], targets, undefined)).toBe("none");
    expect(replaceState(["builtin"], targets, "builtin")).toBe("confirm");
  });

  test("Unpublish is offered on a recorded build not taken down, while the builder can ask", () => {
    const recorded = { ...builtin, publishedAt: at.toISOString(), live: true };
    const ready = { actions: true, hidden: false };
    expect(canUnpublish(recorded, ready)).toBe(true);
    expect(canUnpublish({ ...recorded, serving: false }, ready)).toBe(true);
    expect(canUnpublish(recorded, { actions: false, hidden: false })).toBe(
      false
    );
    expect(canUnpublish(recorded, { actions: true, hidden: true })).toBe(false);
    expect(canUnpublish(builtin, ready)).toBe(false);
    expect(
      canUnpublish({ ...recorded, unpublishedAt: at.toISOString() }, ready)
    ).toBe(false);
  });

  test("one line per Unpublish failure, none where the re-read says it", () => {
    expect(unpublishErrorLine({ ok: false, error: "rate_limited" })).toBe(
      "Try again in a few minutes."
    );
    expect(unpublishErrorLine({ ok: false, error: "forbidden" })).toBe(
      "You can't unpublish this address."
    );
    for (const error of ["failed", "timeout"] as const) {
      expect(unpublishErrorLine({ ok: false, error })).toBe(
        "Couldn't unpublish. Try again."
      );
    }
    for (const error of [
      "unavailable",
      "unknown_target",
      "not_live",
    ] as const) {
      expect(unpublishErrorLine({ ok: false, error })).toBeUndefined();
    }
  });

  test("a replace refused because the addresses changed says so", () => {
    for (const error of [
      "old_site_changed",
      "replace_unconfirmed",
      "old_site_needs_main",
    ]) {
      expect(publishErrorLine({ ok: false, error })).toBe(
        "Your addresses changed. Check them and publish again."
      );
    }
  });
});

describe("the link to OrganizeOS's domain settings", () => {
  const site = {
    platformUrl: "https://app.organizeos.org",
    subdomain: "example-org",
  };

  test("the read's URL wins", () => {
    expect(
      manageDomainsUrlOf(
        site,
        addresses({ manageDomainsUrl: "https://app.example.net/domains" })
      )
    ).toBe("https://app.example.net/domains");
  });

  test("without a read it is the site's domain settings, trailing slashes trimmed", () => {
    expect(manageDomainsUrlOf(site, undefined)).toBe(
      "https://app.organizeos.org/example-org/settings/domain"
    );
    expect(
      manageDomainsUrlOf(
        { ...site, platformUrl: "https://app.organizeos.org//" },
        undefined
      )
    ).toBe("https://app.organizeos.org/example-org/settings/domain");
  });

  test("without a read or a subdomain there is none", () => {
    expect(
      manageDomainsUrlOf({ platformUrl: site.platformUrl }, undefined)
    ).toBeUndefined();
  });

  test("it opens in a new tab without an opener", () => {
    expect(newTabLink).toEqual({ target: "_blank", rel: "noreferrer" });
  });
});
