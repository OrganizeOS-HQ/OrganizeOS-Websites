import type { Resource } from "@webstudio-is/sdk";

/**
 * OrganizeOS fork: a published site never carries the builder's draft-preview
 * header (OrganizeOS design 2026-10-26 CMS in the builder, 4.5).
 *
 * The builder adds `X-OOS-Preview` to a canvas fetch on the server, after the
 * cache key and outside build data, so no Resource should ever hold it. A
 * Resource that does (typed into its headers by hand) would send a stored
 * value from every page view of the live site. It could never verify without
 * the platform's secret, but the build fails rather than publish it. Header
 * names are case-insensitive, so every casing counts.
 */
export const PREVIEW_HEADER_NAME = "x-oos-preview";

export const findPreviewHeaderResources = (
  resources: Iterable<[Resource["id"], Resource]> | undefined
): Resource[] => {
  const found: Resource[] = [];
  for (const [, resource] of resources ?? []) {
    if (
      resource.headers.some(
        ({ name }) => name.trim().toLowerCase() === PREVIEW_HEADER_NAME
      )
    ) {
      found.push(resource);
    }
  }
  return found;
};

export const assertNoPreviewHeader = (
  resources: Iterable<[Resource["id"], Resource]> | undefined
) => {
  const found = findPreviewHeaderResources(resources);
  if (found.length > 0) {
    const names = found.map((resource) => `"${resource.name}"`).join(", ");
    throw new Error(
      `Resource headers must not name X-OOS-Preview, the builder's draft preview header. Remove it from: ${names}.`
    );
  }
};
