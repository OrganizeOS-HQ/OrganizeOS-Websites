import { platformName } from "~/shared/branding";

/**
 * The toast for platform blocks a template placed but could not link to the
 * org's data (a site template's apply, a page template's insert): each block
 * named once, in order.
 */
export const unboundBlocksMessage = (blocks: readonly string[]): string =>
  `Not linked to your organization's data: ${Array.from(new Set(blocks)).join(", ")}. Contact ${platformName} support to restore the link.`;
