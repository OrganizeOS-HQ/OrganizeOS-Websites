import { expect, test } from "vitest";
import type { WebstudioFragment } from "@webstudio-is/sdk";
import { renderTemplate } from "@webstudio-is/template";
import { DonationForm as meta } from "@organizeos/site-components/templates";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { completeDonationFormFragment } from "./giving-insert";

const site: OrganizeosSite = {
  organizationId: "0b5c1a2e-3f4d-4e5a-8b6c-7d8e9f0a1b2c",
  manageUrl: "https://app.organizeos.org/acme/website",
  platformUrl: "https://app.organizeos.org/",
  blocksEnabled: true,
};

const fragment = (): WebstudioFragment => renderTemplate(meta.template);

const rootId = (value: WebstudioFragment) =>
  value.children.find((child) => child.type === "id")!.value;

const rootProp = (value: WebstudioFragment, name: string) =>
  value.props.filter(
    (prop) => prop.instanceId === rootId(value) && prop.name === name
  );

test("writes the site's org id and the platform's origin on the root, as strings", () => {
  const completed = completeDonationFormFragment(fragment(), site)!;
  expect(rootProp(completed, "organizationId")).toEqual([
    expect.objectContaining({ type: "string", value: site.organizationId }),
  ]);
  expect(rootProp(completed, "platformOrigin")).toEqual([
    expect.objectContaining({
      type: "string",
      value: "https://app.organizeos.org",
    }),
  ]);
  // the template's own settings stay
  expect(rootProp(completed, "target")).toEqual([
    expect.objectContaining({ value: "general" }),
  ]);
});

test("replaces a template prop of either name", () => {
  const base = fragment();
  const withStale: WebstudioFragment = {
    ...base,
    props: [
      ...base.props,
      {
        id: "stale-org",
        instanceId: rootId(base),
        name: "organizationId",
        type: "string",
        value: "another-org",
      },
      {
        id: "stale-origin",
        instanceId: rootId(base),
        name: "platformOrigin",
        type: "string",
        value: "https://staging.example.org",
      },
    ],
  };
  const completed = completeDonationFormFragment(withStale, site)!;
  expect(rootProp(completed, "organizationId")).toEqual([
    expect.objectContaining({ value: site.organizationId }),
  ]);
  expect(rootProp(completed, "platformOrigin")).toEqual([
    expect.objectContaining({ value: "https://app.organizeos.org" }),
  ]);
});

test("gives nothing without a site record or with a platform URL that does not parse", () => {
  expect(completeDonationFormFragment(fragment(), undefined)).toBeUndefined();
  expect(
    completeDonationFormFragment(fragment(), {
      ...site,
      platformUrl: "not a url",
    })
  ).toBeUndefined();
});
