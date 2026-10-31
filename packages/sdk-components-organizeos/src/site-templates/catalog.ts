import { CATEGORY_ORDER, type SiteTemplate } from "./types";

// Every site template, listed or draft. Listing one is the owner's call, made
// by changing its `status` in a PR (spec 6.1). Each template here is held to
// checkSiteTemplate by catalog.test.ts. Empty until the first real template;
// the spike is a fixture beside it (__fixtures__/spike), not an entry.
export const SITE_TEMPLATES: SiteTemplate[] = [];

/** The templates the chooser offers: listed ones, by category order. */
export const listedTemplates = (
  templates: SiteTemplate[] = SITE_TEMPLATES
): SiteTemplate[] =>
  templates
    .filter((template) => template.status === "listed")
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    );
