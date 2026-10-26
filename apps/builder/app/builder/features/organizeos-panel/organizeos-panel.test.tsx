import { describe, expect, test } from "vitest";
import { $organizeosSite } from "~/shared/nano-states";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { $isOrganizeosPanelAvailable } from "./organizeos-panel";

describe("$isOrganizeosPanelAvailable", () => {
  const site: OrganizeosSite = {
    organizationId: "org-1",
    manageUrl: "https://app.organizeos.org/dashboard",
    platformUrl: "https://app.organizeos.org",
    blocksEnabled: true,
  };

  test.each([
    ["an org on the blocks' allowlist", site, true],
    ["an org off it", { ...site, blocksEnabled: false }, false],
    ["a project no org owns", undefined, false],
  ])("offers the panel to %s: %s", (_case, value, expected) => {
    $organizeosSite.set(value);
    expect($isOrganizeosPanelAvailable.get()).toBe(expected);
  });
});
