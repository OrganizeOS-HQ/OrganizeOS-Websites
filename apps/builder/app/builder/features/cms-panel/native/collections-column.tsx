import { useRef, type ReactNode } from "react";
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
  PanelTabs,
  PanelTabsContent,
  PanelTabsList,
  PanelTabsTrigger,
  PanelTitle,
  ScrollAreaNative,
  Separator,
  Text,
  theme,
  Tooltip,
} from "@webstudio-is/design-system";
import { EllipsesIcon, XIcon } from "@webstudio-is/icons";
import type { CmsCatalogSlots } from "./cms-screen";
import type { CmsCollectionSummary } from "./cms-source";
import { TruncatedText } from "./truncated-text";
import type { CmsStructureColumn } from "./use-cms-structure";

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

const isDrawn = (node: ReactNode) =>
  node !== null && node !== undefined && node !== false;

const CollectionRow = ({
  index,
  collection,
  isCurrent,
  staleLine,
  actions,
  reserveMenu,
  onSelect,
}: {
  index: number;
  collection: CmsCollectionSummary;
  isCurrent: boolean;
  /** The stale item page's line, or nothing. */
  staleLine: ReactNode;
  /** The collection's actions menu, or nothing without a catalog Resource. */
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
    {isDrawn(actions) && (
      <div className={rowMenuSlotStyle()} data-cms-row-menu>
        {actions}
      </div>
    )}
    {isDrawn(staleLine) && <div className={staleLineStyle()}>{staleLine}</div>}
  </div>
);

export const CollectionsColumn = ({
  collections,
  currentCollectionId,
  slots,
  onSelectCollection,
  onShowClassic,
  onClose,
  structure,
  renderRowMenu,
}: {
  collections: CmsCollectionSummary[];
  currentCollectionId: string | undefined;
  /** The build's side (4.5): undefined where the actions are not allowed. */
  slots: CmsCatalogSlots | undefined;
  onSelectCollection: (collectionId: string) => void;
  /** "Classic CMS" (4.6), run once the menu has closed. */
  onShowClassic: () => void;
  onClose: () => void;
  /** Slice 3: the Collections and Fields tabs. */
  structure?: CmsStructureColumn;
  /** Slice 3: a row's one "..." menu, in place of the slots' actions. */
  renderRowMenu?: (collection: CmsCollectionSummary) => ReactNode;
}) => {
  const footer = slots?.footer;
  // The menu's choice runs once the menu has closed, so the focus it moves
  // is not taken back by the menu.
  const classicChosen = useRef(false);
  const collectionsBody = (
    <>
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
                staleLine={slots?.renderStaleLine(collection)}
                actions={
                  renderRowMenu === undefined
                    ? slots?.renderActions(collection, {
                        leading: null,
                        trailing: null,
                      })
                    : renderRowMenu(collection)
                }
                reserveMenu={
                  slots !== undefined || structure?.canManage === true
                }
                onSelect={() => onSelectCollection(collection.id)}
              />
            ))}
          </InsetList>
        </List>
      </ScrollAreaNative>
      {isDrawn(footer) && (
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
    </>
  );
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
            <DropdownMenu
              onOpenChange={(open) => {
                if (open === false && classicChosen.current) {
                  onShowClassic();
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <IconButton aria-label="CMS menu">
                  <EllipsesIcon />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(event) => {
                  // The trigger is hidden behind the frame; focus stays there.
                  if (classicChosen.current) {
                    classicChosen.current = false;
                    event.preventDefault();
                  }
                }}
              >
                <DropdownMenuItem
                  onSelect={() => {
                    classicChosen.current = true;
                  }}
                >
                  Classic CMS
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
      {structure === undefined ? (
        collectionsBody
      ) : (
        <PanelTabs
          value={structure.tab}
          onValueChange={(tab) =>
            structure.onTabChange(tab === "fields" ? "fields" : "collections")
          }
          css={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            minHeight: 0,
          }}
        >
          <Flex
            align="center"
            justify="between"
            css={{ paddingRight: theme.spacing[5] }}
          >
            <PanelTabsList>
              <PanelTabsTrigger value="collections">
                Collections
              </PanelTabsTrigger>
              <PanelTabsTrigger
                value="fields"
                disabled={structure.hasFields === false}
              >
                Fields
              </PanelTabsTrigger>
            </PanelTabsList>
            {structure.add}
          </Flex>
          <PanelTabsContent
            value="collections"
            tabIndex={-1}
            css={{
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              minHeight: 0,
            }}
          >
            {collectionsBody}
          </PanelTabsContent>
          <PanelTabsContent
            value="fields"
            tabIndex={-1}
            css={{
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              minHeight: 0,
            }}
          >
            {structure.fields}
          </PanelTabsContent>
        </PanelTabs>
      )}
    </Flex>
  );
};
