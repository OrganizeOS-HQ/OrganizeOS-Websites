import { useState } from "react";
import { atom, computed } from "nanostores";
import { useStore } from "@nanostores/react";
import type { AuthPermit } from "@webstudio-is/trpc-interface/index.server";
import {
  theme,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  ScrollArea,
  Text,
  styled,
} from "@webstudio-is/design-system";
import {
  type SiteTemplate,
  type TemplateCategory,
  CATEGORY_ORDER,
  SITE_TEMPLATES,
  listedTemplates,
} from "@organizeos/site-components/site-templates";
import {
  $authPermit,
  $isContentModeAllowed,
  $organizeosSite,
  selectPage,
  setBuilderMode,
} from "~/shared/nano-states";
import { platformName } from "~/shared/branding";
import { builderApi } from "~/shared/builder-api";
import { useMount } from "~/shared/hook-utils/use-mount";
import { updateWebstudioData } from "~/shared/instance-utils/data";
import {
  $assets,
  $instances,
  $pages,
  $styleSourceSelections,
  $styles,
} from "~/shared/sync/data-stores";
import { $dataLoadingState } from "~/builder/shared/nano-states";
import { isOrganizeosBlocksEnabled } from "../insert-organizeos-block";
import {
  type ApplyResult,
  applySiteTemplate,
  hasCanonicalVariables,
  isProjectUntouched,
  startBlankMutable,
} from "./apply-site-template";

/**
 * The site-template chooser (OrganizeOS design
 * `2026-10-30-website-template-inventory-design.md` section 6.4): at first
 * entry to an untouched project, a template or "Start blank", and nothing
 * else closes it. Both write the canonical variables, which ends the offer
 * for every admin on every browser.
 */

/**
 * Whether drafts are offered too, for the owner's review: `templateDrafts=1`
 * in the builder URL, read as the chooser mounts with the builder, before the
 * builder rewrites its URL on a page or mode change and drops it.
 */
const $showTemplateDrafts = atom(false);

/** Listed templates, and drafts when they are shown. */
const getOfferedTemplates = (showDrafts: boolean): SiteTemplate[] => [
  ...listedTemplates(SITE_TEMPLATES),
  ...(showDrafts
    ? SITE_TEMPLATES.filter((template) => template.status === "draft")
    : []),
];

/** The permits that may build: applying writes pages, tokens and styles. */
const buildPermits = new Set<AuthPermit>(["build", "admin", "own"]);

/**
 * Whether the chooser is offered: the data is loaded, the permit can build,
 * the org is not denied the blocks (templates place them, and this is the
 * only caller of applySiteTemplate), the project is untouched and has none of
 * the canonical variables, and a template is offered. Reads the raw stores,
 * since getWebstudioData() throws before the data loads.
 */
export const $isTemplateChooserOffered = computed(
  [
    $dataLoadingState,
    $authPermit,
    $organizeosSite,
    $showTemplateDrafts,
    $pages,
    $instances,
    $assets,
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
    styles,
    styleSourceSelections
  ) =>
    dataLoadingState === "loaded" &&
    buildPermits.has(authPermit) &&
    // the blocks deny list, read from $organizeosSite
    isOrganizeosBlocksEnabled() &&
    pages !== undefined &&
    isProjectUntouched({ pages, instances, assets }) &&
    hasCanonicalVariables({ styles, styleSourceSelections }) === false &&
    getOfferedTemplates(showDrafts).length > 0
);

const categoryLabels: Record<TemplateCategory, string> = {
  nonprofit: "Nonprofit",
  association: "Association",
  community: "Community",
  union: "Union",
  campaign: "Campaign",
  "single-issue": "Single issue",
  cooperative: "Cooperative",
  "emergency-services": "Emergency services",
  foundation: "Foundation",
};

/** Write the blank-start variables, which ends the offer. */
const startBlank = () => {
  updateWebstudioData((data) => {
    startBlankMutable(data);
  });
};

/**
 * Apply a template, then open Home, in Simple mode when the plan allows it.
 * The dialog closes by itself: an applied template ends the offer.
 */
const chooseTemplate = async (template: SiteTemplate) => {
  let result: ApplyResult;
  try {
    result = await applySiteTemplate(template);
  } catch (error) {
    console.error(error);
    builderApi.toast.error(`Cannot apply ${template.name}.`);
    return;
  }
  if (result.status === "refused") {
    builderApi.toast.error("This site already has content.");
    return;
  }
  const homePageId = $pages.get()?.homePageId;
  if (homePageId !== undefined) {
    selectPage(homePageId);
  }
  if ($isContentModeAllowed.get()) {
    setBuilderMode("content");
  }
  if (result.unboundBlocks.length > 0) {
    const blocks = Array.from(new Set(result.unboundBlocks)).join(", ");
    builderApi.toast.error(
      `Not linked to your organization's data: ${blocks}. Contact ${platformName} support to restore the link.`
    );
  }
};

// As many columns of at least 160px as fit, so a row wraps in any width.
const CardGrid = styled("div", {
  display: "grid",
  gridTemplateColumns: `repeat(auto-fill, minmax(${theme.spacing[25]}, 1fr))`,
  gap: theme.spacing[5],
});

const CardButton = styled("button", {
  all: "unset",
  boxSizing: "border-box",
  display: "grid",
  alignContent: "start",
  gap: theme.spacing[3],
  padding: theme.spacing[3],
  borderRadius: theme.borderRadius[4],
  border: `1px solid ${theme.colors.borderMain}`,
  cursor: "pointer",
  "&:hover": { borderColor: theme.colors.borderFocus },
  "&:focus-visible": {
    outline: `1px solid ${theme.colors.borderFocus}`,
    outlineOffset: 1,
  },
  "&:disabled": {
    cursor: "default",
    opacity: 0.5,
    borderColor: theme.colors.borderMain,
  },
});

const Thumbnail = styled("img", {
  display: "block",
  width: "100%",
  aspectRatio: "16 / 10",
  objectFit: "cover",
  borderRadius: theme.borderRadius[2],
  background: theme.colors.backgroundNeutralMain,
});

const TemplateCard = ({
  template,
  disabled,
  onChoose,
}: {
  template: SiteTemplate;
  disabled: boolean;
  onChoose: (template: SiteTemplate) => void;
}) => (
  <CardButton
    type="button"
    data-site-template={template.id}
    disabled={disabled}
    onClick={() => onChoose(template)}
  >
    <Thumbnail src={template.images[template.thumbnail]?.url} alt="" />
    <Text as="span" variant="labels" truncate>
      {template.name}
    </Text>
    <Text as="span" color="subtle">
      {template.oneLine}
    </Text>
  </CardButton>
);

export const TemplateChooser = () => {
  const isOffered = useStore($isTemplateChooserOffered);
  const showDrafts = useStore($showTemplateDrafts);
  const [isApplying, setIsApplying] = useState(false);

  useMount(() => {
    $showTemplateDrafts.set(
      new URLSearchParams(location.search).get("templateDrafts") === "1"
    );
  });

  const templates = getOfferedTemplates(showDrafts);
  const categories = CATEGORY_ORDER.flatMap((category) => {
    const inCategory = templates.filter(
      (template) => template.category === category
    );
    return inCategory.length === 0 ? [] : [{ category, templates: inCategory }];
  });

  const choose = async (template: SiteTemplate) => {
    setIsApplying(true);
    try {
      await chooseTemplate(template);
    } finally {
      setIsApplying(false);
    }
  };

  // Open exactly while offered. With no onOpenChange, Escape and an outside
  // click do nothing.
  return (
    <Dialog open={isOffered}>
      <DialogContent
        width={640}
        aria-describedby={undefined}
        onKeyDown={(event) => {
          // Keep builder shortcuts from acting behind the chooser
          event.stopPropagation();
        }}
      >
        <DialogTitle
          suffix={
            <Button color="neutral" disabled={isApplying} onClick={startBlank}>
              Start blank
            </Button>
          }
        >
          Start from a template
        </DialogTitle>
        <ScrollArea>
          <Grid gap="5" css={{ padding: theme.panel.padding }}>
            {categories.map(({ category, templates }) => (
              <Grid key={category} gap="3">
                <Text variant="titles" data-site-template-category={category}>
                  {categoryLabels[category]}
                </Text>
                <CardGrid>
                  {templates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      disabled={isApplying}
                      onChoose={choose}
                    />
                  ))}
                </CardGrid>
              </Grid>
            ))}
          </Grid>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
