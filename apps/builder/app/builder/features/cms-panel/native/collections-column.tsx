import {
  css,
  cssVar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Flex,
  IconButton,
  InsetList,
  InsetListItem,
  List,
  ListItem,
  PanelTitle,
  ScrollArea,
  Separator,
  SmallIconButton,
  Text,
  theme,
  Tooltip,
} from "@webstudio-is/design-system";
import { EllipsesIcon, XIcon } from "@webstudio-is/icons";
import type {
  CmsCatalogOrphan,
  CmsCatalogRow,
  CmsCatalogView,
  CmsCollectionActions,
  CmsCollectionSummary,
} from "./cms-source";

/** The existing warning line of the data tab (`collection-row-menu.tsx`). */
export const STALE_ADDRESS_LINE = "Item page uses an old address";

const rowStyle = css({
  position: "relative",
  display: "grid",
  "& [data-cms-row-menu]": {
    opacity: 0,
  },
  "&:hover [data-cms-row-menu], &:focus-within [data-cms-row-menu], & [data-cms-row-menu][data-state=open], &[data-current] [data-cms-row-menu]":
    {
      opacity: 1,
    },
});

const rowMenuSlotStyle = css({
  position: "absolute",
  top: 0,
  right: theme.spacing[3],
  height: theme.spacing[13],
  display: "flex",
  alignItems: "center",
});

const staleLineStyle = css({
  paddingInline: theme.spacing[3],
  paddingBottom: theme.spacing[3],
});

/**
 * The collection actions of 4.5, one "..." per row. W2 replaces this menu's
 * body with `CollectionActionsMenu`, split from the data tab's
 * `CollectionRow`, so the Add list popover and the busy state come with it.
 */
const CollectionActionsMenu = ({
  name,
  slug,
  catalogRow,
  actions,
}: {
  name: string;
  slug: string;
  catalogRow: CmsCatalogRow | undefined;
  actions: CmsCollectionActions;
}) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <SmallIconButton
        data-cms-row-menu
        aria-label={`${name} actions`}
        icon={<EllipsesIcon />}
      />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" css={{ width: theme.spacing[29] }}>
      {catalogRow?.hasItemPage ? (
        <DropdownMenuItem onSelect={() => actions.onOpenItemPage?.(slug)}>
          Open item page
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onSelect={() => actions.onCreateItemPage?.(slug)}>
          Create item page
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={() => actions.onAddList?.(slug)}>
        Add list
      </DropdownMenuItem>
      {catalogRow?.isSitemapOrphan && (
        <DropdownMenuItem onSelect={() => actions.onRemoveFromSitemap?.(slug)}>
          Remove from sitemap
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

const CollectionRow = ({
  index,
  collection,
  isCurrent,
  catalogRow,
  showActions,
  reserveMenu,
  actions,
  onSelect,
}: {
  index: number;
  collection: CmsCollectionSummary;
  isCurrent: boolean;
  catalogRow: CmsCatalogRow | undefined;
  showActions: boolean;
  /** Keeps every count in one column, menu or not. */
  reserveMenu: boolean;
  actions: CmsCollectionActions;
  onSelect: () => void;
}) => (
  <div
    className={rowStyle()}
    data-current={isCurrent || undefined}
    data-cms-collection={collection.slug}
  >
    <ListItem asChild index={index} current={isCurrent} onSelect={onSelect}>
      <InsetListItem
        css={{
          gridTemplateColumns: "minmax(0, 1fr) auto",
          // the "..." sits over this space
          paddingRight: reserveMenu ? theme.spacing[13] : undefined,
        }}
      >
        <Tooltip content={collection.name} delayDuration={600}>
          <Text variant="labels" truncate>
            {collection.name}
          </Text>
        </Tooltip>
        <Text color="subtle" css={{ fontVariantNumeric: "tabular-nums" }}>
          {collection.total}
        </Text>
      </InsetListItem>
    </ListItem>
    {showActions && (
      <div className={rowMenuSlotStyle()}>
        <CollectionActionsMenu
          name={collection.name}
          slug={collection.slug}
          catalogRow={catalogRow}
          actions={actions}
        />
      </div>
    )}
    {catalogRow?.isStale && (
      <Text color="destructive" className={staleLineStyle()}>
        {STALE_ADDRESS_LINE}
      </Text>
    )}
  </div>
);

/** W2 renders the data tab's `OrphanRow` here; this is its look. */
const OrphanRow = ({
  orphan,
  showActions,
  actions,
}: {
  orphan: CmsCatalogOrphan;
  showActions: boolean;
  actions: CmsCollectionActions;
}) => (
  <div className={rowStyle()} data-cms-orphan={orphan.name}>
    <Flex
      align="center"
      gap="2"
      css={{
        minHeight: theme.spacing[13],
        paddingInline: theme.spacing[3],
        paddingRight:
          showActions && orphan.sitemapSlug !== undefined
            ? theme.spacing[13]
            : theme.spacing[3],
      }}
    >
      <Tooltip content={orphan.name} delayDuration={600}>
        <Text color="subtle" truncate>
          {orphan.name}
        </Text>
      </Tooltip>
    </Flex>
    {showActions && orphan.sitemapSlug !== undefined && (
      <div className={rowMenuSlotStyle()}>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SmallIconButton
              data-cms-row-menu
              aria-label={`${orphan.name} actions`}
              icon={<EllipsesIcon />}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onSelect={() =>
                orphan.sitemapSlug !== undefined &&
                actions.onRemoveFromSitemap?.(orphan.sitemapSlug)
              }
            >
              Remove from sitemap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )}
    {orphan.isStale && (
      <Text color="destructive" className={staleLineStyle()}>
        {STALE_ADDRESS_LINE}
      </Text>
    )}
  </div>
);

export const CollectionsColumn = ({
  collections,
  currentCollectionId,
  catalog,
  actions,
  onSelectCollection,
  onOpenClassic,
  onClose,
}: {
  collections: CmsCollectionSummary[];
  currentCollectionId: string | undefined;
  catalog: CmsCatalogView | undefined;
  actions: CmsCollectionActions;
  onSelectCollection: (collectionId: string) => void;
  /** Present while the classic frame exists (4.6). */
  onOpenClassic?: () => void;
  onClose: () => void;
}) => {
  const actionsEnabled = catalog?.actionsEnabled === true;
  const orphans = catalog?.orphans ?? [];
  return (
    <Flex
      direction="column"
      data-cms-collections
      css={{
        width: theme.sizes.sidebarWidth,
        flexShrink: 0,
        height: "100%",
        borderRight: `1px solid ${cssVar("--border-default")}`,
        background: cssVar("--background-primary"),
      }}
    >
      <PanelTitle
        suffix={
          <>
            {onOpenClassic !== undefined && (
              <DropdownMenu modal={false}>
                <Tooltip content="More" side="bottom">
                  <DropdownMenuTrigger asChild>
                    <IconButton aria-label="More">
                      <EllipsesIcon />
                    </IconButton>
                  </DropdownMenuTrigger>
                </Tooltip>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={onOpenClassic}>
                    Classic CMS
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Tooltip content="Close" side="bottom">
              <IconButton aria-label="Close" onClick={onClose}>
                <XIcon />
              </IconButton>
            </Tooltip>
          </>
        }
      >
        CMS
      </PanelTitle>
      <Separator />
      <ScrollArea css={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <List asChild>
          <InsetList css={{ gap: theme.spacing[1] }} aria-label="Collections">
            {collections.map((collection, index) => {
              const catalogRow = catalog?.rows[collection.slug];
              return (
                <CollectionRow
                  key={collection.id}
                  index={index}
                  collection={collection}
                  isCurrent={collection.id === currentCollectionId}
                  catalogRow={catalogRow}
                  showActions={actionsEnabled && catalogRow !== undefined}
                  reserveMenu={actionsEnabled}
                  actions={actions}
                  onSelect={() => onSelectCollection(collection.id)}
                />
              );
            })}
          </InsetList>
        </List>
      </ScrollArea>
      {orphans.length > 0 && (
        <>
          <Separator />
          <InsetList css={{ gap: theme.spacing[1] }} data-cms-orphans>
            {orphans.map((orphan) => (
              <OrphanRow
                key={orphan.name}
                orphan={orphan}
                showActions={actionsEnabled}
                actions={actions}
              />
            ))}
          </InsetList>
        </>
      )}
    </Flex>
  );
};
