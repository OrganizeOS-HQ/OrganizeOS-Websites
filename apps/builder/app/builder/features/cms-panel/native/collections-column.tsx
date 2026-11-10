import type { ReactNode } from "react";
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
  ScrollAreaNative,
  Separator,
  Text,
  theme,
  Tooltip,
} from "@webstudio-is/design-system";
import { EllipsesIcon, XIcon } from "@webstudio-is/icons";
import type { CmsCatalogView, CmsCollectionSummary } from "./cms-source";
import { TruncatedText } from "./truncated-text";

/** The data tab's warning line (`collection-row-menu.tsx` `staleAddressLine`). */
const STALE_ADDRESS_LINE = "Item page uses an old address";

const rowStyle = css({
  position: "relative",
  display: "grid",
  "& [data-cms-row-menu]": {
    opacity: 0,
  },
  "&:hover [data-cms-row-menu], &:focus-within [data-cms-row-menu], & [data-cms-row-menu]:has([data-state=open]), &[data-current] [data-cms-row-menu]":
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

const CollectionRow = ({
  index,
  collection,
  isCurrent,
  isStale,
  actions,
  reserveMenu,
  onSelect,
}: {
  index: number;
  collection: CmsCollectionSummary;
  isCurrent: boolean;
  isStale: boolean;
  /** W2's `CollectionActionsMenu`, or nothing for a private collection. */
  actions: ReactNode;
  /** Keeps every count in one column, menu or not. */
  reserveMenu: boolean;
  onSelect: () => void;
}) => (
  <div
    role="listitem"
    className={rowStyle()}
    data-current={isCurrent || undefined}
    data-cms-collection={collection.slug}
  >
    {/* a native button with aria-current, not a listbox option */}
    <ListItem
      asChild
      role={undefined}
      index={index}
      current={isCurrent}
      onSelect={onSelect}
    >
      <InsetListItem
        css={{
          gridTemplateColumns: "minmax(0, 1fr) auto",
          // the "..." sits over this space
          paddingRight: reserveMenu ? theme.spacing[13] : undefined,
        }}
      >
        <TruncatedText variant="labels">{collection.name}</TruncatedText>
        <Text color="subtle" css={{ fontVariantNumeric: "tabular-nums" }}>
          {collection.total}
        </Text>
      </InsetListItem>
    </ListItem>
    {actions !== null && actions !== undefined && actions !== false && (
      <div className={rowMenuSlotStyle()} data-cms-row-menu>
        {actions}
      </div>
    )}
    {isStale && (
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
  renderCollectionActions,
  footer,
  onSelectCollection,
  onOpenClassic,
  onClose,
}: {
  collections: CmsCollectionSummary[];
  currentCollectionId: string | undefined;
  catalog: CmsCatalogView | undefined;
  /**
   * Each row's "..." (4.5): W2's `CollectionActionsMenu`, with its Add list
   * popover, busy state and plan chip. Called only when the actions are
   * allowed; returns nothing for a row with no catalog Resource.
   */
  renderCollectionActions?: (collection: CmsCollectionSummary) => ReactNode;
  /** The orphan rows at the foot (4.5): W2 renders the data tab's. */
  footer?: ReactNode;
  onSelectCollection: (collectionId: string) => void;
  /** Present while the classic frame exists (4.6). */
  onOpenClassic?: () => void;
  onClose: () => void;
}) => {
  const staleSlugs = catalog?.staleSlugs ?? [];
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
      <ScrollAreaNative css={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <List asChild>
          <InsetList
            role="list"
            css={{ gap: theme.spacing[1] }}
            aria-label="Collections"
          >
            {collections.map((collection, index) => (
              <CollectionRow
                key={collection.id}
                index={index}
                collection={collection}
                isCurrent={collection.id === currentCollectionId}
                isStale={staleSlugs.includes(collection.slug)}
                actions={renderCollectionActions?.(collection)}
                reserveMenu={renderCollectionActions !== undefined}
                onSelect={() => onSelectCollection(collection.id)}
              />
            ))}
          </InsetList>
        </List>
      </ScrollAreaNative>
      {footer !== undefined && footer !== null && (
        <>
          <Separator />
          <Flex
            direction="column"
            gap="2"
            data-cms-orphans
            css={{
              flexShrink: 0,
              padding: theme.spacing[5],
              maxHeight: "40%",
              overflowY: "auto",
            }}
          >
            {footer}
          </Flex>
        </>
      )}
    </Flex>
  );
};
