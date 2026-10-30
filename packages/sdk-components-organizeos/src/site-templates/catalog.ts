import { spikeTemplate } from "./spike";
import { CATEGORY_ORDER, type SiteTemplate } from "./types";

// Every site template, listed or draft. Listing one is the owner's call, made
// by changing its `status` in a PR (spec 6.1). Each template here is held to
// checkSiteTemplate by catalog.test.ts.
export const SITE_TEMPLATES: SiteTemplate[] = [spikeTemplate];

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
