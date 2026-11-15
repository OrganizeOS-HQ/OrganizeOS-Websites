import { nanoid } from "nanoid";
import type { Prop, WebstudioFragment } from "@webstudio-is/sdk";
import type { OrganizeosSite } from "~/shared/organizeos-site";

/**
 * The Donation Form's insert-time props (OrganizeOS builder donations spec
 * 2026-11-13, 7.2 and W1; plan F1, F-D7): the frame's org and the platform's
 * origin, written on the root as literals from the builder's site record,
 * since a published block has no runtime source for either. A pure fragment
 * transform after the catalog completion, on the pattern of the forms'
 * markSiteForm.
 *
 * It imports nothing from insert-organizeos-block.ts, which imports it.
 */

const platformOriginOf = (platformUrl: string): string | undefined => {
  try {
    const url = new URL(platformUrl);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.origin
      : undefined;
  } catch {
    return;
  }
};

const literal = (instanceId: string, name: string, value: string): Prop => ({
  id: nanoid(),
  instanceId,
  name,
  type: "string",
  value,
});

/**
 * The fragment with its root's `organizationId` and `platformOrigin` set, any
 * template prop of either name replaced. Undefined without a site record, or
 * with a platform URL that does not parse: the insert is then refused.
 */
export const completeDonationFormFragment = (
  fragment: WebstudioFragment,
  site: OrganizeosSite | undefined
): WebstudioFragment | undefined => {
  if (site === undefined) {
    return;
  }
  const platformOrigin = platformOriginOf(site.platformUrl);
  const rootId = fragment.children.find((child) => child.type === "id")?.value;
  if (platformOrigin === undefined || rootId === undefined) {
    return;
  }
  const written = new Set(["organizationId", "platformOrigin"]);
  return {
    ...fragment,
    props: [
      ...fragment.props.filter(
        (prop) => prop.instanceId !== rootId || written.has(prop.name) === false
      ),
      literal(rootId, "organizationId", site.organizationId),
      literal(rootId, "platformOrigin", platformOrigin),
    ],
  };
};
