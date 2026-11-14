import { useEffect, useRef, useState } from "react";
import { atom, computed } from "nanostores";
import { useStore } from "@nanostores/react";
import type { AuthPermit } from "@webstudio-is/trpc-interface/index.server";
import {
  theme,
  rawTheme,
  cssVar,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Flex,
  IconButton,
  InsetList,
  InsetListItem,
  List,
  ListItem,
  ScrollAreaNative,
  Select,
  Text,
  Tooltip,
  styled,
} from "@webstudio-is/design-system";
import { ChevronLeftIcon } from "@webstudio-is/icons";
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
import { TruncatedText } from "../../cms-panel/native/truncated-text";
import { isOrganizeosBlocksEnabled } from "../insert-organizeos-block";
import { updateWebstudioDataStaged } from "../staged-data";
import { SITE_FORM_CREATE_FAILED } from "../site-form-insert";
import {
  type ApplyOutcome,
  type ApplyResult,
  applySiteTemplate,
  hasCanonicalVariables,
  isProjectUntouched,
  startBlankMutable,
} from "./apply-site-template";
import { useDialogBoundarySize } from "./use-dialog-boundary";

/**
 * The Templates screen (OrganizeOS design
 * `2026-11-13-builder-templates-screen-and-page-templates-design.md` section
 * 5): at first entry to an untouched project, a full-size dialog of the
 * offered site templates by category; a card opens the template's page view,
 * a picture of each of its pages, with Use template. Start blank or Use
 * template are the only ways out. Both write the canonical variables, which
 * ends the offer for every admin on every browser.
 */

/**
 * Whether drafts are offered too, for the owner's review: `templateDrafts=1`
 * in the builder URL, read as the screen mounts with the builder, before the
 * builder rewrites its URL on a page or mode change and drops it.
 */
export const $showTemplateDrafts = atom(false);

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

/** What a refused apply says, by its reason; the runtime's says its own. */
const refusalMessages: Record<
  Exclude<Extract<ApplyResult, { status: "refused" }>["reason"], "runtime">,
  string
> = {
  touched: "This site already has content.",
  "path-taken": "Its pages clash with this site's pages.",
  resources: "This template cannot be applied.",
  "no-project": "This template cannot be applied.",
  // a Signup Form placement's site form (fork doc section 9, "Site forms")
  form: SITE_FORM_CREATE_FAILED,
};

/** Write the blank-start variables, which ends the offer. */
const startBlank = () => {
  void updateWebstudioDataStaged((data) => {
    startBlankMutable(data);
  }).catch((error: unknown) => {
    console.error(error);
    builderApi.toast.error(
      error instanceof Error ? error.message : "Cannot start blank."
    );
  });
};

/**
 * Apply a template, then open Home, in Simple mode when the plan allows it.
 * The screen closes by itself: an applied template ends the offer. An apply
 * undone while its images uploaded leaves the project empty and the screen
 * offered again, so nothing more is done for it.
 */
const chooseTemplate = async (template: SiteTemplate) => {
  let result: ApplyOutcome;
  try {
    result = await applySiteTemplate(template);
  } catch (error) {
    console.error(error);
    builderApi.toast.error(`Cannot apply ${template.name}.`);
    return;
  }
  if (result.status === "refused") {
    builderApi.toast.error(
      result.reason === "runtime"
        ? result.message
        : refusalMessages[result.reason]
    );
    return;
  }
  if ($isTemplatesScreenOffered.get()) {
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
  if (result.missingImages > 0) {
    builderApi.toast.error(
      result.missingImages === 1
        ? "1 photo could not be added."
        : `${result.missingImages} photos could not be added.`
    );
  }
};

type CategoryChoice = TemplateCategory | "all";

/** The category column's width, and the main area under which it collapses. */
const COLUMN_WIDTH = parseFloat(rawTheme.spacing[27]);
const NARROW_MAIN_WIDTH = 600;

// As many columns as fit, of at least the token's width or the whole row
const CardGrid = styled("div", {
  display: "grid",
  gridTemplateColumns: `repeat(auto-fill, minmax(min(${theme.spacing[32]}, 100%), 1fr))`,
  gap: theme.spacing[9],
});

const PageGrid = styled("div", {
  display: "grid",
  gridTemplateColumns: `repeat(auto-fill, minmax(min(${theme.spacing[29]}, 100%), 1fr))`,
  gap: theme.spacing[9],
});

const CardButton = styled("button", {
  all: "unset",
  boxSizing: "border-box",
  display: "grid",
  alignContent: "start",
  gap: theme.spacing[3],
  minWidth: 0,
  padding: theme.spacing[3],
  borderRadius: theme.borderRadius[4],
  border: `1px solid ${cssVar("--border-default")}`,
  cursor: "pointer",
  "&:hover": { borderColor: cssVar("--border-focus") },
  "&:focus-visible": {
    outline: `1px solid ${cssVar("--border-focus")}`,
    outlineOffset: 1,
  },
  "&:disabled": {
    cursor: "default",
    opacity: 0.5,
    borderColor: cssVar("--border-default"),
  },
});

const pictureStyle = {
  display: "block",
  width: "100%",
  aspectRatio: "16 / 10",
  borderRadius: theme.borderRadius[2],
  background: cssVar("--background-secondary"),
} as const;

const Picture = styled("img", { ...pictureStyle, objectFit: "cover" });

const EmptyFrame = styled("div", pictureStyle);

const Figure = styled("figure", {
  display: "grid",
  alignContent: "start",
  gap: theme.spacing[3],
  minWidth: 0,
  margin: 0,
});

const Caption = styled("figcaption", { minWidth: 0 });

const pictureUrl = (template: SiteTemplate, file: string | undefined) =>
  file === undefined ? undefined : template.images[file]?.url;

/** A page's picture: Home's is the thumbnail, the others' in pagePictures. */
const pagePictureUrl = (
  template: SiteTemplate,
  page: SiteTemplate["pages"][number]
) =>
  pictureUrl(
    template,
    page.path === "" ? template.thumbnail : template.pagePictures[page.key]
  );

export const TemplatesScreen = () => {
  const isOffered = useStore($isTemplatesScreenOffered);
  const showDrafts = useStore($showTemplateDrafts);
  const size = useDialogBoundarySize();
  // at the screen's level, so a screen offered again while a first apply
  // still uploads stays disabled
  const [isApplying, setIsApplying] = useState(false);
  const [category, setCategory] = useState<CategoryChoice>("all");
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const backRef = useRef<HTMLButtonElement>(null);
  const useTemplateRef = useRef<HTMLButtonElement>(null);
  const wasApplying = useRef(false);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  // the card to give the focus back to, once its page view is left
  const returnFocusId = useRef<string | undefined>(undefined);

  useMount(() => {
    $showTemplateDrafts.set(
      new URLSearchParams(location.search).get("templateDrafts") === "1"
    );
  });

  // each offer opens at the grid, with All
  useEffect(() => {
    if (isOffered === false) {
      setCategory("all");
      setOpenId(undefined);
      returnFocusId.current = undefined;
    }
  }, [isOffered]);

  // an apply that leaves the screen open (refused or failed) gives the focus
  // back to Use template, which the fieldset took it from while it ran
  useEffect(() => {
    if (wasApplying.current && isApplying === false) {
      useTemplateRef.current?.focus();
    }
    wasApplying.current = isApplying;
  }, [isApplying]);

  // the focus follows the view: Back in a page view, the card after it
  useEffect(() => {
    if (openId !== undefined) {
      backRef.current?.focus();
      return;
    }
    const id = returnFocusId.current;
    if (id !== undefined) {
      cardRefs.current.get(id)?.focus();
      returnFocusId.current = undefined;
    }
  }, [openId]);

  const templates = getOfferedTemplates(showDrafts);
  const categories = CATEGORY_ORDER.filter((choice) =>
    templates.some((template) => template.category === choice)
  );
  // All lists them grouped in category order
  const shown = (category === "all" ? categories : [category]).flatMap(
    (choice) => templates.filter((template) => template.category === choice)
  );
  const openTemplate = templates.find((template) => template.id === openId);
  const isNarrow = size.width - COLUMN_WIDTH - 1 < NARROW_MAIN_WIDTH;

  const chooseCategory = (choice: CategoryChoice) => {
    if (isApplying) {
      return;
    }
    setCategory(choice);
    setOpenId(undefined);
    returnFocusId.current = undefined;
  };

  const back = () => {
    if (isApplying) {
      return;
    }
    returnFocusId.current = openId;
    setOpenId(undefined);
  };

  const use = async (template: SiteTemplate) => {
    if (isApplying) {
      return;
    }
    setIsApplying(true);
    try {
      await chooseTemplate(template);
    } finally {
      setIsApplying(false);
    }
  };

  const labelOf = (choice: CategoryChoice) =>
    choice === "all" ? "All" : categoryLabels[choice];

  // Open exactly while offered. With no onOpenChange, Escape and an outside
  // click do nothing to the dialog.
  return (
    <Dialog open={isOffered}>
      <DialogContent
        width={size.width}
        height={size.height}
        // the design system's own boundary is 0x0 when the UI is hidden, which
        // would cap the dialog at nothing; a min wins over that max
        minWidth={size.width}
        minHeight={size.height}
        aria-describedby={undefined}
        onKeyDown={(event) => {
          // Keep builder shortcuts from acting behind the screen
          event.stopPropagation();
        }}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          if (openId !== undefined) {
            back();
          }
        }}
      >
        <fieldset
          disabled={isApplying}
          style={{ display: "contents", border: 0, margin: 0, padding: 0 }}
        >
          <Flex grow css={{ minHeight: 0 }}>
            {isNarrow === false && (
              <List asChild>
                <InsetList
                  role="list"
                  aria-label="Categories"
                  css={{
                    width: COLUMN_WIDTH,
                    borderRight: `1px solid ${cssVar("--border-default")}`,
                  }}
                >
                  {(["all", ...categories] as const).map((choice, index) => (
                    <div role="listitem" key={choice}>
                      <ListItem
                        asChild
                        role={undefined}
                        index={index}
                        current={category === choice}
                        onSelect={() => chooseCategory(choice)}
                      >
                        <InsetListItem data-template-category={choice}>
                          <Text variant="labels" truncate>
                            {labelOf(choice)}
                          </Text>
                        </InsetListItem>
                      </ListItem>
                    </div>
                  ))}
                </InsetList>
              </List>
            )}
            <Flex direction="column" grow css={{ minWidth: 0 }}>
              {isNarrow && (
                <Flex css={{ padding: theme.panel.padding }}>
                  <Select
                    aria-label="Category"
                    fullWidth
                    disabled={isApplying}
                    options={["all", ...categories] as CategoryChoice[]}
                    value={category}
                    getLabel={labelOf}
                    onChange={chooseCategory}
                  />
                </Flex>
              )}
              <ScrollAreaNative
                css={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}
              >
                <Flex
                  direction="column"
                  gap="3"
                  css={{ padding: theme.panel.padding }}
                >
                  {openTemplate === undefined ? (
                    <CardGrid>
                      {shown.map((template) => (
                        <CardButton
                          key={template.id}
                          type="button"
                          data-site-template={template.id}
                          ref={(element) => {
                            if (element === null) {
                              cardRefs.current.delete(template.id);
                            } else {
                              cardRefs.current.set(template.id, element);
                            }
                          }}
                          onClick={() => setOpenId(template.id)}
                        >
                          <Picture
                            src={pictureUrl(template, template.thumbnail)}
                            alt=""
                          />
                          <TruncatedText variant="labels">
                            {template.name}
                          </TruncatedText>
                        </CardButton>
                      ))}
                    </CardGrid>
                  ) : (
                    <>
                      <Flex align="center" gap="2">
                        <Tooltip content="Back" side="bottom">
                          <IconButton
                            ref={backRef}
                            aria-label="Back"
                            onClick={back}
                          >
                            <ChevronLeftIcon />
                          </IconButton>
                        </Tooltip>
                        <TruncatedText
                          variant="titles"
                          css={{ flexGrow: 1, minWidth: 0 }}
                        >
                          {openTemplate.name}
                        </TruncatedText>
                        <Button
                          ref={useTemplateRef}
                          color="primary"
                          state={isApplying ? "pending" : undefined}
                          // a long name gives way, never the action
                          css={{ flexShrink: 0 }}
                          onClick={() => void use(openTemplate)}
                        >
                          Use template
                        </Button>
                      </Flex>
                      <PageGrid>
                        {openTemplate.pages.map((page) => {
                          const src = pagePictureUrl(openTemplate, page);
                          return (
                            <Figure
                              key={page.key}
                              data-site-template-page={page.key}
                            >
                              {src === undefined ? (
                                <EmptyFrame />
                              ) : (
                                <Picture src={src} alt="" />
                              )}
                              <Caption>
                                <TruncatedText variant="labels">
                                  {page.name}
                                </TruncatedText>
                              </Caption>
                            </Figure>
                          );
                        })}
                      </PageGrid>
                    </>
                  )}
                </Flex>
              </ScrollAreaNative>
            </Flex>
          </Flex>
        </fieldset>
        <DialogTitle
          suffix={
            <Button color="neutral" disabled={isApplying} onClick={startBlank}>
              Start blank
            </Button>
          }
        >
          Start from a template
        </DialogTitle>
      </DialogContent>
    </Dialog>
  );
};
