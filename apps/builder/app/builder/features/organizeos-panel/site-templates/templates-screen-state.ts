import { atom, computed } from "nanostores";
import type { AuthPermit } from "@webstudio-is/trpc-interface/index.server";
import {
  type SiteTemplate,
  SITE_TEMPLATES,
  listedTemplates,
} from "@organizeos/site-components/site-templates";
import { $authPermit, $organizeosSite } from "~/shared/nano-states";
import {
  $assets,
  $instances,
  $pages,
  $projectSettings,
  $props,
  $styleSourceSelections,
  $styles,
} from "~/shared/sync/data-stores";
import { $dataLoadingState } from "~/builder/shared/nano-states";
import { isOrganizeosBlocksEnabled } from "../insert-organizeos-block";
import {
  hasCanonicalVariables,
  isProjectUntouched,
} from "./apply-site-template";

// What the Templates screen and the New page screen both read, in a module of
// its own, so neither screen imports the other.

/**
 * Whether drafts are offered too, for the owner's review: `templateDrafts=1`
 * in the builder URL, read as the Templates screen mounts with the builder,
 * before the builder rewrites its URL on a page or mode change and drops it.
 * The New page screen offers draft page templates by it too.
 */
export const $showTemplateDrafts = atom(false);

/** Listed templates, and drafts when they are shown. */
export const getOfferedTemplates = (showDrafts: boolean): SiteTemplate[] => [
  ...listedTemplates(SITE_TEMPLATES),
  ...(showDrafts
    ? SITE_TEMPLATES.filter((template) => template.status === "draft")
    : []),
];

/** The permits that may build: applying writes pages, tokens and styles. */
const buildPermits = new Set<AuthPermit>(["build", "admin", "own"]);

/**
 * Whether the screen is offered: the data is loaded, the permit can build,
 * the org is not denied the blocks (templates place them, and this is the
 * only caller of applySiteTemplate), the project is untouched and has none of
 * the canonical variables, and a template is offered. Reads the raw stores,
 * since getWebstudioData() throws before the data loads.
 */
export const $isTemplatesScreenOffered = computed(
  [
    $dataLoadingState,
    $authPermit,
    $organizeosSite,
    $showTemplateDrafts,
    $pages,
    $instances,
    $assets,
    $props,
    $projectSettings,
    $styles,
    $styleSourceSelections,
  ],
  (
    dataLoadingState,
    authPermit,
    _organizeosSite,
    showDrafts,
    pages,
    instances,
    assets,
    props,
    projectSettings,
    styles,
    styleSourceSelections
  ) =>
    dataLoadingState === "loaded" &&
    buildPermits.has(authPermit) &&
    // the blocks deny list, read from $organizeosSite
    isOrganizeosBlocksEnabled() &&
    pages !== undefined &&
    isProjectUntouched({
      pages,
      instances,
      assets,
      props,
      styles,
      projectSettings,
    }) &&
    hasCanonicalVariables({ styles, styleSourceSelections }) === false &&
    getOfferedTemplates(showDrafts).length > 0
);
