import { type ReactNode, useState } from "react";
import { useStore } from "@nanostores/react";
import {
  theme,
  Button,
  Chip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Flex,
  Grid,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SmallIconButton,
  Switch,
  Text,
  ToggleGroup,
  ToggleGroupButton,
  Tooltip,
  toast,
} from "@webstudio-is/design-system";
import {
  EllipsesIcon,
  ListViewIcon,
  RepeatGridIcon,
} from "@webstudio-is/icons";
import type { Page, Resource } from "@webstudio-is/sdk";
import { $permissions, selectPage } from "~/shared/nano-states";
import { planBadgeLabel } from "~/shared/branding";
import {
  createCollectionItemPage,
  removeCollectionFromSitemap,
} from "./collection-pages";
import {
  type ListCount,
  type ListLayout,
  type ListSort,
  insertCollectionList,
} from "./collection-list";
import { addCatalogResourceToPage } from "./organizeos-data";

/**
 * A collection's row in the OrganizeOS data tab (design
 * `2026-10-27-cms-page-templates-design.md` section 2.1): its name and a "..."
 * menu with Create item page (Open item page once the collection has one),
 * Add list, Add to this page and, when the sitemap still lists a collection
 * whose item page is gone, Remove from sitemap. Add list opens a small
 * popover of options. Create item page and Add list need dynamic data, so a
 * plan without it shows them disabled with upstream's plan badge.
 */

export const itemPageCreated = "Item page created";
export const staleAddressLine = "Item page uses an old address";

const sorts: ListSort[] = ["newest", "oldest", "az", "manual"];
const sortLabels: Record<ListSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  az: "A to Z",
  manual: "Manual order",
};
const counts: ListCount[] = [3, 6, 9, 12, "all"];
const countLabel = (count: ListCount) =>
  count === "all" ? "All" : String(count);

const OptionLabel = ({ children }: { children: string }) => (
  <Tooltip content={children} delayDuration={600}>
    <Label truncate>{children}</Label>
  </Tooltip>
);

const AddListForm = ({
  slug,
  hasItemPage,
  onDone,
}: {
  slug: string;
  hasItemPage: boolean;
  /** After an add that read the collection: whether the list was inserted. */
  onDone: (inserted: boolean) => void;
}) => {
  const [layout, setLayout] = useState<ListLayout>("grid");
  const [sort, setSort] = useState<ListSort>("newest");
  const [count, setCount] = useState<ListCount>(6);
  const [link, setLink] = useState(hasItemPage);
  const [isBusy, setIsBusy] = useState(false);
  const add = async () => {
    setIsBusy(true);
    const result = await insertCollectionList({
      slug,
      layout,
      sort,
      count,
      link: hasItemPage && link,
    });
    setIsBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    onDone(result.inserted);
  };
  return (
    <Grid
      gap="2"
      align="center"
      css={{
        gridTemplateColumns: `minmax(0, 1fr) ${theme.spacing[25]}`,
        padding: theme.panel.padding,
        width: theme.spacing[30],
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
      data-organizeos-add-list
    >
      <OptionLabel>Layout</OptionLabel>
      <ToggleGroup
        type="single"
        value={layout}
        onValueChange={(value: string) => {
          if (value === "grid" || value === "list") {
            setLayout(value);
          }
        }}
      >
        <Tooltip content="Grid">
          <ToggleGroupButton value="grid" aria-label="Grid">
            <RepeatGridIcon />
          </ToggleGroupButton>
        </Tooltip>
        <Tooltip content="List">
          <ToggleGroupButton value="list" aria-label="List">
            <ListViewIcon />
          </ToggleGroupButton>
        </Tooltip>
      </ToggleGroup>
      <OptionLabel>Sort</OptionLabel>
      <Select<ListSort>
        aria-label="Sort"
        options={sorts}
        value={sort}
        getLabel={(option: ListSort) => sortLabels[option]}
        onChange={setSort}
      />
      <OptionLabel>Show</OptionLabel>
      <Select<ListCount>
        aria-label="Show"
        options={counts}
        value={count}
        getLabel={countLabel}
        getValue={countLabel}
        onChange={setCount}
      />
      <OptionLabel>Link to item page</OptionLabel>
      <Flex justify="end">
        <Switch
          aria-label="Link to item page"
          checked={hasItemPage && link}
          disabled={hasItemPage === false}
          onCheckedChange={setLink}
        />
      </Flex>
      <Button
        css={{ gridColumn: "1 / -1" }}
        disabled={isBusy}
        onClick={add}
        data-organizeos-add-list-submit
      >
        Add
      </Button>
    </Grid>
  );
};

const GatedLabel = ({
  children,
  gated,
}: {
  children: string;
  gated: boolean;
}) => (
  <Flex direction="row" gap="2" align="center">
    {children}
    {/* a plain label (Chip, planBadgeLabel), as every plan badge is */}
    {gated && <Chip>{planBadgeLabel}</Chip>}
  </Flex>
);

/** The warning under a row whose item page reads an old address. */
export const StaleItemPageLine = () => (
  <Text color="destructive" data-organizeos-stale-address>
    {staleAddressLine}
  </Text>
);

/**
 * A collection's "..." menu: `leadingItems`, Create item page or Open item
 * page, Add list, `trailingItems`, then Remove from sitemap for a sitemap
 * orphan. Add list opens its popover anchored on the menu's own trigger.
 * `onShowCanvas` runs after Create item page (made or found), Open item page
 * and an Add list that inserted; `onRemovedFromSitemap` after a removal that
 * removed.
 */
export const CollectionActionsMenu = ({
  slug,
  name,
  itemPage,
  isSitemapOrphan,
  leadingItems,
  trailingItems,
  beforeAction,
  onShowCanvas,
  onRemovedFromSitemap,
}: {
  slug: string;
  /** The trigger's label is "{name} menu". */
  name: string;
  itemPage: undefined | Page;
  /** The sitemap lists the collection, which has no item page. */
  isSitemapOrphan: boolean;
  leadingItems?: ReactNode;
  trailingItems?: ReactNode;
  /**
   * Awaited before Create item page and Add list; false runs neither (the
   * native CMS adds a missing catalog Resource here).
   */
  beforeAction?: () => Promise<boolean>;
  onShowCanvas?: () => void;
  onRemovedFromSitemap?: () => void;
}) => {
  const { allowDynamicData } = useStore($permissions);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const gated = allowDynamicData === false;

  const isReady = async () =>
    beforeAction === undefined ? true : await beforeAction();

  const createItemPage = async () => {
    setIsBusy(true);
    if ((await isReady()) === false) {
      setIsBusy(false);
      return;
    }
    const result = await createCollectionItemPage(slug);
    setIsBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if (result.created) {
      toast.success(itemPageCreated);
    }
    onShowCanvas?.();
  };

  const removeFromSitemap = async () => {
    if (await removeCollectionFromSitemap(slug)) {
      onRemovedFromSitemap?.();
    }
  };

  return (
    <Popover
      open={isListOpen}
      onOpenChange={(open) => {
        // opened from the menu only: the button is the menu's trigger,
        // and the popover's anchor
        if (open === false) {
          setIsListOpen(false);
        }
      }}
    >
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <PopoverTrigger asChild>
            <SmallIconButton
              aria-label={`${name} menu`}
              icon={<EllipsesIcon />}
              disabled={isBusy}
              data-organizeos-collection-menu
            />
          </PopoverTrigger>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {leadingItems}
          {itemPage === undefined ? (
            <DropdownMenuItem disabled={gated} onSelect={createItemPage}>
              <GatedLabel gated={gated}>Create item page</GatedLabel>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() => {
                selectPage(itemPage.id);
                onShowCanvas?.();
              }}
            >
              Open item page
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={gated}
            onSelect={() => {
              if (beforeAction === undefined) {
                setIsListOpen(true);
                return;
              }
              setIsBusy(true);
              void isReady().then((ready) => {
                setIsBusy(false);
                if (ready) {
                  setIsListOpen(true);
                }
              });
            }}
          >
            <GatedLabel gated={gated}>Add list</GatedLabel>
          </DropdownMenuItem>
          {trailingItems}
          {isSitemapOrphan && (
            <DropdownMenuItem onSelect={() => void removeFromSitemap()}>
              Remove from sitemap
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <PopoverContent align="end">
        <AddListForm
          slug={slug}
          hasItemPage={itemPage !== undefined}
          onDone={(inserted) => {
            setIsListOpen(false);
            if (inserted) {
              onShowCanvas?.();
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

export const CollectionRow = ({
  resource,
  slug,
  itemPage,
  isOnPage,
  isStale,
  isSitemapOrphan,
}: {
  resource: Resource;
  slug: string;
  itemPage: undefined | Page;
  isOnPage: boolean;
  /** An item page of this collection reads an old address. */
  isStale: boolean;
  /** The sitemap lists the collection, which has no item page. */
  isSitemapOrphan: boolean;
}) => {
  return (
    <Flex direction="column" data-organizeos-collection={slug}>
      <Flex align="center" justify="between" gap="2">
        <Tooltip content={resource.name} delayDuration={600}>
          <Text truncate>{resource.name}</Text>
        </Tooltip>
        <Flex align="center" gap="2" css={{ flexShrink: 0 }}>
          {isOnPage && <Text color="subtle">On this page</Text>}
          <CollectionActionsMenu
            slug={slug}
            name={resource.name}
            itemPage={itemPage}
            isSitemapOrphan={isSitemapOrphan}
            trailingItems={
              <DropdownMenuItem
                disabled={isOnPage}
                onSelect={() => void addCatalogResourceToPage(resource.id)}
              >
                Add to this page
              </DropdownMenuItem>
            }
          />
        </Flex>
      </Flex>
      {isStale && <StaleItemPageLine />}
    </Flex>
  );
};

/**
 * A row for what has no catalog row of its own: an item page whose
 * collection's address changed under a new name, or a sitemap part of a
 * collection no longer in the catalog.
 */
export const OrphanRow = ({
  name,
  isStale,
  sitemapSlug,
  removeIn = "button",
  onRemovedFromSitemap,
}: {
  name: string;
  isStale: boolean;
  sitemapSlug?: string;
  /** Where Remove from sitemap sits: a button, or a "{name} menu". */
  removeIn?: "button" | "menu";
  onRemovedFromSitemap?: () => void;
}) => {
  const removeFromSitemap = async (slug: string) => {
    if (await removeCollectionFromSitemap(slug)) {
      onRemovedFromSitemap?.();
    }
  };
  return (
    <Flex direction="column" data-organizeos-orphan>
      <Flex align="center" justify="between" gap="2">
        <Tooltip content={name} delayDuration={600}>
          <Text truncate>{name}</Text>
        </Tooltip>
        {sitemapSlug !== undefined &&
          (removeIn === "menu" ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <SmallIconButton
                  aria-label={`${name} menu`}
                  icon={<EllipsesIcon />}
                  css={{ flexShrink: 0 }}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <DropdownMenuItem
                  onSelect={() => void removeFromSitemap(sitemapSlug)}
                >
                  Remove from sitemap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              color="neutral"
              css={{ flexShrink: 0 }}
              onClick={() => void removeFromSitemap(sitemapSlug)}
            >
              Remove from sitemap
            </Button>
          ))}
      </Flex>
      {isStale && <StaleItemPageLine />}
    </Flex>
  );
};
