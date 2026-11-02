import { useState } from "react";
import { useStore } from "@nanostores/react";
import {
  theme,
  Button,
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
  ProBadge,
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
  onDone: () => void;
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
    onDone();
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
    {gated && <ProBadge>{planBadgeLabel}</ProBadge>}
  </Flex>
);

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
  const { allowDynamicData } = useStore($permissions);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const gated = allowDynamicData === false;

  const createItemPage = async () => {
    setIsBusy(true);
    const result = await createCollectionItemPage(slug);
    setIsBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if (result.created) {
      toast.success(itemPageCreated);
    }
  };

  return (
    <Flex direction="column" data-organizeos-collection={slug}>
      <Flex align="center" justify="between" gap="2">
        <Tooltip content={resource.name} delayDuration={600}>
          <Text truncate>{resource.name}</Text>
        </Tooltip>
        <Flex align="center" gap="2" css={{ flexShrink: 0 }}>
          {isOnPage && <Text color="subtle">On this page</Text>}
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
                    aria-label={`${resource.name} menu`}
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
                {itemPage === undefined ? (
                  <DropdownMenuItem disabled={gated} onSelect={createItemPage}>
                    <GatedLabel gated={gated}>Create item page</GatedLabel>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => selectPage(itemPage.id)}>
                    Open item page
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  disabled={gated}
                  onSelect={() => setIsListOpen(true)}
                >
                  <GatedLabel gated={gated}>Add list</GatedLabel>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isOnPage}
                  onSelect={() => addCatalogResourceToPage(resource.id)}
                >
                  Add to this page
                </DropdownMenuItem>
                {isSitemapOrphan && (
                  <DropdownMenuItem
                    onSelect={() => removeCollectionFromSitemap(slug)}
                  >
                    Remove from sitemap
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <PopoverContent align="end">
              <AddListForm
                slug={slug}
                hasItemPage={itemPage !== undefined}
                onDone={() => setIsListOpen(false)}
              />
            </PopoverContent>
          </Popover>
        </Flex>
      </Flex>
      {isStale && (
        <Text color="destructive" data-organizeos-stale-address>
          {staleAddressLine}
        </Text>
      )}
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
}: {
  name: string;
  isStale: boolean;
  sitemapSlug?: string;
}) => (
  <Flex direction="column" data-organizeos-orphan>
    <Flex align="center" justify="between" gap="2">
      <Tooltip content={name} delayDuration={600}>
        <Text truncate>{name}</Text>
      </Tooltip>
      {sitemapSlug !== undefined && (
        <Button
          color="neutral"
          css={{ flexShrink: 0 }}
          onClick={() => removeCollectionFromSitemap(sitemapSlug)}
        >
          Remove from sitemap
        </Button>
      )}
    </Flex>
    {isStale && (
      <Text color="destructive" data-organizeos-stale-address>
        {staleAddressLine}
      </Text>
    )}
  </Flex>
);
