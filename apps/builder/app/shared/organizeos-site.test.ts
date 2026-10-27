/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { organizeosHomeUrl, type OrganizeosSite } from "./organizeos-site";

const site: OrganizeosSite = {
  organizationId: "org-1",
  subdomain: "acme",
  manageUrl: "https://app.organizeos.org/acme/website",
  platformUrl: "https://app.organizeos.org",
  blocksEnabled: true,
};

describe("organizeosHomeUrl", () => {
  test("is the org's workspace home on the app host", () => {
    expect(organizeosHomeUrl(site)).toBe("https://app.organizeos.org/acme");
  });

  test("trims a trailing slash from the app's address", () => {
    expect(
      organizeosHomeUrl({ ...site, platformUrl: "https://app.organizeos.org/" })
    ).toBe("https://app.organizeos.org/acme");
  });

  test("is the app's dashboard while the subdomain is unknown", () => {
    expect(organizeosHomeUrl({ ...site, subdomain: undefined })).toBe(
      "https://app.organizeos.org/dashboard"
    );
  });
});

describe("the menu's Back to OrganizeOS", () => {
  // Read as text, the fork's wiring-test style: an upstream merge that
  // reflows the menu fails here instead of sending the admin elsewhere
  const menu = readFileSync(
    fileURLToPath(
      new URL("../builder/features/menu/menu.tsx", import.meta.url)
    ),
    "utf8"
  );

  test("opens the org's workspace home, not its Website area", () => {
    expect(menu).toContain(
      "window.location.href = organizeosHomeUrl(organizeosSite);"
    );
    expect(menu).not.toContain("organizeosSite.manageUrl");
  });
});
