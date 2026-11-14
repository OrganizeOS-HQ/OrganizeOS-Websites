import { useEffect, useId, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import {
  theme,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Flex,
  Grid,
  InputField,
  Label,
  ScrollAreaNative,
  Text,
} from "@webstudio-is/design-system";
import { type Page, type Pages, pagePath } from "@webstudio-is/sdk";
import {
  type PageSettingsValues,
  getInitialPageSettingsMeta,
  isPathAvailable,
  nameToPath,
  pageSettingsDefaultValues,
  validatePathnamePattern,
} from "@webstudio-is/project-build/runtime";
import { isPlatformServedPath } from "@organizeos/site-components/platform-paths";
import {
  type StarterPage,
  STARTER_PAGES,
  listedStarterPages,
} from "@organizeos/site-components/starter-pages";
import {
  $isDesignMode,
  $organizeosSite,
  selectPage,
} from "~/shared/nano-states";
import { $pages } from "~/shared/sync/data-stores";
import { builderApi } from "~/shared/builder-api";
import { executeRuntimeMutation } from "~/shared/instance-utils/data";
import { TruncatedText } from "../../cms-panel/native/truncated-text";
import { unboundBlocksMessage } from "../unbound-blocks";
import { useDialogBoundarySize } from "../site-templates/use-dialog-boundary";
import {
  $isTemplatesScreenOffered,
  $showTemplateDrafts,
} from "../site-templates/templates-screen-state";
import {
  BackButton,
  CardButton,
  EmptyFrame,
  PageGrid,
  Picture,
} from "../site-templates/screen-parts";
import {
  type StarterInsertOutcome,
  insertStarterPage,
} from "./insert-starter-page";
import { $newPageScreenOpen } from "./new-page-screen-state";

/**
 * The New page screen (OrganizeOS design
 * `2026-11-13-builder-templates-screen-and-page-templates-design.md` section
 * 6.1): the Pages panel's New page opens it. Blank first, then the offered
 * page templates; a card opens its create view, Name and Path, then Create
 * page. With Blank the only card, it opens straight into Blank's create view,
 * compact.
 */

type Card = { id: string; name: string; page?: StarterPage };

const BLANK: Card = { id: "blank", name: "Blank" };

type Fields = { name: string; path: string };

/** The screen's size with page templates offered, and with Blank alone. */
const GRID_SIZE = { width: 880, height: 640 };
const BLANK_SIZE = { width: 448, height: 320 };

/**
 * The first problem with a new page at `path` in the root folder, where its
 * full path is `path`: upstream's own message for a path that is not one,
 * then a path another page or the platform uses. Nothing when it is free.
 */
export const pathProblem = (pages: Pages, path: string): string | undefined => {
  const parsed = pagePath.safeParse(path);
  if (parsed.success === false) {
    return parsed.error.issues[0]?.message;
  }
  const [pattern] = validatePathnamePattern(path);
  if (pattern !== undefined) {
    return pattern;
  }
  if (
    isPathAvailable({ pages, path, parentFolderId: pages.rootFolderId }) ===
    false
  ) {
    return "Another page uses this path";
  }
  if (isPlatformServedPath(path)) {
    return "The platform uses this path";
  }
  return undefined;
};

/** Blank, the listed page templates, then drafts when shown. */
const getOfferedCards = (showDrafts: boolean, blocksEnabled: boolean) => [
  BLANK,
  ...[
    ...listedStarterPages(STARTER_PAGES),
    ...(showDrafts
      ? STARTER_PAGES.filter((page) => page.status === "draft")
      : []),
  ]
    // an org on the blocks deny list gets no page that places one
    .filter((page) => page.blocks.length === 0 || blocksEnabled)
    .map((page): Card => ({ id: page.id, name: page.name, page })),
];

/** A page template's default path, or the next free one after it. */
const defaultPath = (pages: Pages, page: StarterPage) =>
  isPathAvailable({
    pages,
    path: page.path,
    parentFolderId: pages.rootFolderId,
  })
    ? page.path
    : nameToPath(pages, page.path.slice(1));

/** What a refused page template says, by its reason; the runtime's its own. */
const refusalMessages: Record<
  Exclude<
    Extract<StarterInsertOutcome, { status: "refused" }>["reason"],
    "runtime"
  >,
  string
> = {
  invalid: "This path cannot be used.",
  "path-taken": "Another page uses this path.",
  "platform-path": "The platform uses this path.",
  resources: "This page template cannot be added.",
  "no-project": "This page template cannot be added.",
};

/**
 * Blank: upstream's New page form's two runtime operations, with upstream's
 * defaults, the name, the path, and the name as title (the plan's ruling 1),
 * then the page selected. Whether it was made.
 */
const createBlank = ({ name, path }: Fields): boolean => {
  const pages = $pages.get();
  if (pages === undefined) {
    builderApi.toast.error("Cannot create the page.");
    return false;
  }
  const values: PageSettingsValues = {
    ...pageSettingsDefaultValues,
    parentFolderId: pages.rootFolderId,
    name,
    path,
    title: JSON.stringify(name),
  };
  let pageId: Page["id"] | undefined;
  try {
    const created = executeRuntimeMutation({
      id: "pages.create",
      input: {
        name: values.name,
        path: values.path,
        title: values.title,
        parentFolderId: values.parentFolderId,
        meta: getInitialPageSettingsMeta(values),
      },
    });
    pageId = created?.result.pageId as Page["id"] | undefined;
  } catch (error) {
    console.error(error);
  }
  if (pageId === undefined) {
    builderApi.toast.error("Cannot create the page.");
    return false;
  }
  // The page exists from here: a refused settings step leaves it with
  // pages.create's own settings, and it is still the page made.
  try {
    executeRuntimeMutation({
      id: "pages.updateSettings",
      input: { pageId, values },
    });
  } catch (error) {
    console.error(error);
  }
  selectPage(pageId);
  return true;
};

/** A page template added (and selected), or why not, toasted. */
const addPageTemplate = async (
  card: Card & { page: StarterPage },
  fields: Fields
): Promise<boolean> => {
  let outcome: StarterInsertOutcome;
  try {
    outcome = await insertStarterPage(card.page, fields);
  } catch (error) {
    console.error(error);
    builderApi.toast.error(`Cannot add ${card.name}.`);
    return false;
  }
  if (outcome.status === "refused") {
    builderApi.toast.error(
      outcome.reason === "runtime"
        ? outcome.message
        : refusalMessages[outcome.reason]
    );
    return false;
  }
  if (outcome.unboundBlocks.length > 0) {
    builderApi.toast.error(unboundBlocksMessage(outcome.unboundBlocks));
  }
  return true;
};

const CreateView = ({
  card,
  pages,
  hasGrid,
  pending,
  onBack,
  onCreate,
}: {
  card: Card;
  pages: Pages;
  hasGrid: boolean;
  pending: boolean;
  onBack: () => void;
  onCreate: (fields: Fields) => void;
}) => {
  const nameId = useId();
  const pathId = useId();
  const warningId = useId();
  const [name, setName] = useState(
    () => card.page?.pageName ?? pageSettingsDefaultValues.name
  );
  const [path, setPath] = useState(() =>
    card.page === undefined
      ? nameToPath(pages, pageSettingsDefaultValues.name)
      : defaultPath(pages, card.page)
  );
  const problem = pathProblem(pages, path);
  const canCreate =
    pending === false && problem === undefined && name.trim() !== "";

  const changeName = (next: string) => {
    // Blank's path follows its name until the path is edited, as upstream's
    // form's does
    if (card.page === undefined && path === nameToPath(pages, name)) {
      setPath(nameToPath(pages, next));
    }
    setName(next);
  };

  return (
    <Flex direction="column" gap="3">
      {hasGrid && (
        <Flex align="center" gap="2">
          <BackButton onClick={onBack} />
          <TruncatedText variant="titles" css={{ flexGrow: 1, minWidth: 0 }}>
            {card.name}
          </TruncatedText>
        </Flex>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canCreate) {
            onCreate({ name: name.trim(), path });
          }
        }}
      >
        <Grid gap="3">
          <Grid gap="1">
            <Label htmlFor={nameId}>Name</Label>
            <InputField
              id={nameId}
              value={name}
              autoFocus
              onFocus={(event) => {
                // InputField takes focus events on its wrapper
                if (event.target instanceof HTMLInputElement) {
                  event.target.select();
                }
              }}
              onChange={(event) => changeName(event.target.value)}
            />
          </Grid>
          <Grid gap="1">
            <Label htmlFor={pathId}>Path</Label>
            <InputField
              id={pathId}
              value={path}
              color={problem === undefined ? undefined : "error"}
              aria-invalid={problem !== undefined}
              aria-describedby={problem === undefined ? undefined : warningId}
              onChange={(event) => setPath(event.target.value)}
            />
            {problem !== undefined && (
              <Text id={warningId} role="alert" color="destructive">
                {problem}
              </Text>
            )}
          </Grid>
          <Flex justify="end">
            <Button
              type="submit"
              color="primary"
              disabled={canCreate === false}
              state={pending ? "pending" : undefined}
            >
              Create page
            </Button>
          </Flex>
        </Grid>
      </form>
    </Flex>
  );
};

export const NewPageScreen = () => {
  const requested = useStore($newPageScreenOpen);
  const isDesignMode = useStore($isDesignMode);
  const isTemplatesScreenOffered = useStore($isTemplatesScreenOffered);
  const pages = useStore($pages);
  const showDrafts = useStore($showTemplateDrafts);
  const blocksEnabled = useStore($organizeosSite)?.blocksEnabled === true;
  const size = useDialogBoundarySize();
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  // a second create in the same tick, before `pending` renders, is ignored
  const inFlight = useRef(false);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  // the card to give the focus back to, once its create view is left
  const returnFocusId = useRef<string | undefined>(undefined);

  const canOpen =
    isDesignMode && isTemplatesScreenOffered === false && pages !== undefined;
  const isOpen = requested && canOpen;

  // closed by anything but its own controls, it opens fresh next time
  useEffect(() => {
    if (requested && canOpen === false) {
      $newPageScreenOpen.set(false);
    }
  }, [requested, canOpen]);

  useEffect(() => {
    if (isOpen === false) {
      setOpenId(undefined);
      returnFocusId.current = undefined;
    }
  }, [isOpen]);

  // back at the grid, the focus goes to the card that was open
  useEffect(() => {
    if (openId !== undefined) {
      return;
    }
    const id = returnFocusId.current;
    if (id !== undefined) {
      cardRefs.current.get(id)?.focus();
      returnFocusId.current = undefined;
    }
  }, [openId]);

  const cards = getOfferedCards(showDrafts, blocksEnabled);
  const hasGrid = cards.length > 1;
  const openCard = hasGrid
    ? cards.find((card) => card.id === openId)
    : cards[0];
  const { width: maxWidth, height: maxHeight } = hasGrid
    ? GRID_SIZE
    : BLANK_SIZE;
  const width = Math.min(maxWidth, size.width);
  const height = Math.min(maxHeight, size.height);

  const close = () => {
    if (inFlight.current) {
      return;
    }
    $newPageScreenOpen.set(false);
  };

  const back = () => {
    if (inFlight.current) {
      return;
    }
    returnFocusId.current = openId;
    setOpenId(undefined);
  };

  const create = async (card: Card, fields: Fields) => {
    // a create already running, or one that already closed the screen
    if (inFlight.current || $newPageScreenOpen.get() === false) {
      return;
    }
    inFlight.current = true;
    setPending(true);
    try {
      const done =
        card.page === undefined
          ? createBlank(fields)
          : await addPageTemplate({ ...card, page: card.page }, fields);
      if (done) {
        $newPageScreenOpen.set(false);
      }
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      draggable={false}
      onOpenChange={(open) => {
        if (open === false) {
          close();
        }
      }}
    >
      <DialogContent
        width={width}
        height={height}
        // as the Templates screen's: a min wins over a hidden boundary's max
        minWidth={width}
        minHeight={height}
        aria-describedby={undefined}
        onKeyDown={(event) => {
          // Keep builder shortcuts from acting behind the screen
          event.stopPropagation();
        }}
        onEscapeKeyDown={(event) => {
          if (inFlight.current) {
            event.preventDefault();
            return;
          }
          // from a create view, back to the grid; at the grid, it closes
          if (hasGrid && openCard !== undefined) {
            event.preventDefault();
            back();
          }
        }}
      >
        <fieldset
          disabled={pending}
          style={{ display: "contents", border: 0, margin: 0, padding: 0 }}
        >
          <ScrollAreaNative css={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
            <Flex
              direction="column"
              gap="3"
              css={{ padding: theme.panel.padding }}
            >
              {openCard === undefined || pages === undefined ? (
                <PageGrid>
                  {cards.map((card) => {
                    const src =
                      card.page === undefined
                        ? undefined
                        : card.page.images[card.page.picture]?.url;
                    return (
                      <CardButton
                        key={card.id}
                        type="button"
                        data-starter-page={card.id}
                        ref={(element) => {
                          if (element === null) {
                            cardRefs.current.delete(card.id);
                          } else {
                            cardRefs.current.set(card.id, element);
                          }
                        }}
                        onClick={() => setOpenId(card.id)}
                      >
                        {src === undefined ? (
                          <EmptyFrame />
                        ) : (
                          <Picture src={src} alt="" />
                        )}
                        <TruncatedText variant="labels">
                          {card.name}
                        </TruncatedText>
                      </CardButton>
                    );
                  })}
                </PageGrid>
              ) : (
                <CreateView
                  key={openCard.id}
                  card={openCard}
                  pages={pages}
                  hasGrid={hasGrid}
                  pending={pending}
                  onBack={back}
                  onCreate={(fields) => void create(openCard, fields)}
                />
              )}
            </Flex>
          </ScrollAreaNative>
        </fieldset>
        <DialogTitle>New page</DialogTitle>
      </DialogContent>
    </Dialog>
  );
};
