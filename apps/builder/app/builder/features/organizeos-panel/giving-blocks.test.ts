import { expect, test } from "vitest";
import { parseFundraisersData } from "@organizeos/site-components/fundraisers-data";
import fundraisersBody from "../../../../../../packages/sdk-components-organizeos/src/__fixtures__/fundraisers.json";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import {
  donationFormComponent,
  fundraiserOptions,
  fundraisersPicker,
  fundraisingHref,
  generalGivingOption,
  givingWarning,
  goalProgressComponent,
} from "./giving-blocks";

const SPRING = "b1c2d3e4-0000-4000-8000-000000000001";
const UNKNOWN = "b1c2d3e4-0000-4000-8000-0000000000ff";
const list = parseFundraisersData(fundraisersBody);

const site: OrganizeosSite = {
  organizationId: "0b5c1a2e-3f4d-4e5a-8b6c-7d8e9f0a1b2c",
  subdomain: "acme",
  manageUrl: "https://app.organizeos.org/acme/website",
  platformUrl: "https://app.organizeos.org/",
  blocksEnabled: true,
};

const labels = (options: Array<{ label: string }>) =>
  options.map((option) => option.label);

test("General giving first, then the fundraisers, drafts marked", () => {
  const { options, selected, missing } = fundraiserOptions(list, "general", {
    general: true,
  });
  expect(labels(options)).toEqual([
    "General giving",
    "Spring Drive",
    "Flood Relief",
    "Year-End Match (draft)",
  ]);
  expect(selected).toEqual(generalGivingOption);
  expect(missing).toBe(false);
});

test("an empty target selects nothing", () => {
  expect(fundraiserOptions(list, "", { general: true }).selected).toBe(
    undefined
  );
});

test("an unknown fundraiser is kept second as not found", () => {
  const { options, selected, missing } = fundraiserOptions(list, UNKNOWN, {
    general: true,
  });
  expect(options[1]).toEqual({ value: UNKNOWN, label: "Fundraiser not found" });
  expect(selected).toEqual(options[1]);
  expect(missing).toBe(true);
});

test("while nothing has loaded, only General giving and the current value", () => {
  const { options, missing } = fundraiserOptions(undefined, SPRING, {
    general: true,
  });
  expect(options.map((option) => option.value)).toEqual(["general", SPRING]);
  expect(missing).toBe(false);
});

test("without General giving, an empty record selects nothing", () => {
  const { options, selected } = fundraiserOptions(list, "", { general: false });
  expect(labels(options)).toEqual([
    "Spring Drive",
    "Flood Relief",
    "Year-End Match (draft)",
  ]);
  expect(selected).toBeUndefined();
});

test("the record picker reads the root's bound data", () => {
  expect(fundraisersPicker.loadFailed).toBe("Fundraisers didn't load.");
  expect(fundraisersPicker.placeholder).toBe("Pick a fundraiser");
  const picked = fundraisersPicker.getOptions(
    fundraisersBody,
    SPRING,
    new Date()
  );
  expect(picked.selected?.label).toBe("Spring Drive");
  expect(picked.hasData).toBe(true);
  expect(fundraisersPicker.getOptions(undefined, "", new Date()).hasData).toBe(
    false
  );
});

test("the warning line", () => {
  const ok = {
    component: donationFormComponent,
    organizationId: site.organizationId,
    platformOrigin: "https://app.organizeos.org",
    missing: false,
    site,
  };
  expect(givingWarning(ok)).toBeUndefined();
  expect(givingWarning({ ...ok, organizationId: "another-org" })).toBe(
    "Re-insert this block"
  );
  expect(
    givingWarning({ ...ok, platformOrigin: "https://staging.example.org" })
  ).toBe("Re-insert this block");
  expect(givingWarning({ ...ok, missing: true })).toBe("Fundraiser not found");
  expect(
    givingWarning({ ...ok, organizationId: "another-org", missing: true })
  ).toBe("Re-insert this block");
  expect(
    givingWarning({
      component: goalProgressComponent,
      missing: false,
      site,
    })
  ).toBeUndefined();
  expect(
    givingWarning({ component: goalProgressComponent, missing: true, site })
  ).toBe("Fundraiser not found");
});

test("Open in Fundraising", () => {
  expect(fundraisingHref(site, "general")).toBe(
    "https://app.organizeos.org/acme/fundraisers"
  );
  expect(fundraisingHref(site, SPRING)).toBe(
    `https://app.organizeos.org/acme/fundraisers/${SPRING}/edit`
  );
  expect(fundraisingHref({ ...site, subdomain: undefined }, "general")).toBe(
    undefined
  );
  expect(fundraisingHref(undefined, "general")).toBeUndefined();
  expect(fundraisingHref(site, "x")).toBeUndefined();
  expect(fundraisingHref(site, "")).toBeUndefined();
});
