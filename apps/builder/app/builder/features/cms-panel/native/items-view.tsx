import { useEffect, useRef, useState } from "react";
import {
  Button,
  css,
  cssVar,
  Flex,
  IconButton,
  InsetList,
  InsetListItem,
  List,
  ListItem,
  ScrollAreaNative,
  SearchField,
  Text,
  theme,
  Tooltip,
} from "@webstudio-is/design-system";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "@webstudio-is/icons";
import { RelativeTime } from "~/builder/shared/relative-time";
import { formatPageRange, getPageCount } from "./cms-logic";
import {
  CMS_PAGE_SIZE,
  type CmsCollectionSummary,
  type CmsItemRow,
  type CmsItemsPage,
} from "./cms-source";
import { StatusChip } from "./status-chip";
import { TruncatedText } from "./truncated-text";

/** Proportional, as the dashboard's `projects-list.tsx`: 3 to 1 to 1. */
const columns = "minmax(0, 3fr) minmax(0, 1fr) minmax(0, 1fr)";

const tableStyle = css({
  display: "grid",
  alignContent: "start",
  width: "100%",
  '& [role="row"]': {
    display: "grid",
    gridTemplateColumns: columns,
    alignItems: "center",
    columnGap: theme.spacing[5],
    minHeight: theme.spacing[13],
    paddingBlock: 0,
    paddingInline: theme.spacing[5],
  },
  '& [role="columnheader"], & [role="cell"]': {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
  },
});

const headerRowStyle = css({
  position: "sticky",
  top: 0,
  zIndex: 1,
  marginInline: theme.spacing[3],
  background: cssVar("--background-primary"),
  borderBottom: `1px solid ${cssVar("--border-default")}`,
});

const TopBar = ({
  collection,
  query,
  canEdit,
  showSearch,
  onQueryChange,
  onNewItem,
}: {
  collection: CmsCollectionSummary;
  query: string;
  canEdit: boolean;
  showSearch: boolean;
  onQueryChange: (query: string) => void;
  onNewItem: () => void;
}) => {
  const [draft, setDraft] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    // the trimmed query comes back: keep what the person typed
    setDraft((current) => (current.trim() === query ? current : query));
  }, [query]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const change = (value: string, delay: number) => {
    setDraft(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onQueryChange(value.trim()), delay);
  };
  return (
    <Flex
      align="center"
      gap="2"
      data-cms-top-bar
      css={{
        height: theme.spacing[15],
        flexShrink: 0,
        paddingInline: theme.panel.paddingInline,
        borderBottom: `1px solid ${cssVar("--border-default")}`,
      }}
    >
      <Flex align="center" gap="2" css={{ minWidth: 0, flexGrow: 1 }}>
        <TruncatedText variant="titles">{collection.name}</TruncatedText>
        <Text color="subtle" css={{ flexShrink: 0 }}>
          {collection.total}
        </Text>
      </Flex>
      {showSearch && (
        <SearchField
          aria-label={`Search ${collection.name}`}
          placeholder="Search"
          value={draft}
          // the title truncates first, then the search shrinks to 128 px
          css={{
            width: theme.spacing[30],
            minWidth: theme.spacing[23],
            flexShrink: 1,
          }}
          onChange={(event) => change(event.currentTarget.value, 250)}
          onAbort={() => change("", 0)}
        />
      )}
      {canEdit && (
        <Button
          color="primary"
          prefix={<PlusIcon />}
          css={{ flexShrink: 0 }}
          onClick={onNewItem}
        >
          New item
        </Button>
      )}
    </Flex>
  );
};

const ItemRow = ({
  index,
  item,
  onOpen,
}: {
  index: number;
  item: CmsItemRow;
  onOpen: () => void;
}) => (
  <ListItem index={index} asChild onSelect={onOpen}>
    <InsetListItem asChild>
      <div role="row" data-cms-item={item.slug} data-cms-item-id={item.id}>
        <div role="cell">
          <TruncatedText>{item.title}</TruncatedText>
        </div>
        <div role="cell">
          <StatusChip {...item} />
        </div>
        <div role="cell">
          <Text color="subtle" truncate>
            <RelativeTime time={new Date(item.updatedAt)} />
          </Text>
        </div>
      </div>
    </InsetListItem>
  </ListItem>
);

const ItemsTable = ({
  collectionName,
  page,
  focusItemId,
  onOpenItem,
}: {
  collectionName: string;
  page: CmsItemsPage;
  /** The item whose editor just closed: its row takes the focus back. */
  focusItemId: string | undefined;
  onOpenItem: (itemId: string) => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusItemId === undefined) {
      return;
    }
    ref.current
      ?.querySelector<HTMLElement>(
        `[data-cms-item-id="${CSS.escape(focusItemId)}"]`
      )
      ?.focus();
  }, [focusItemId]);
  return (
    <div
      ref={ref}
      className={tableStyle()}
      role="table"
      aria-label={collectionName}
    >
      {page.items.length > 0 && (
        <div role="rowgroup">
          <div role="row" className={headerRowStyle()}>
            {["Name", "Status", "Modified"].map((label) => (
              <div role="columnheader" key={label}>
                <Text variant="labels" color="subtle">
                  {label}
                </Text>
              </div>
            ))}
          </div>
        </div>
      )}
      <List asChild>
        <InsetList role="rowgroup" css={{ gap: 0, paddingTop: 0 }}>
          {page.items.map((item, index) => (
            <ItemRow
              key={item.id}
              index={index}
              item={item}
              onOpen={() => onOpenItem(item.id)}
            />
          ))}
        </InsetList>
      </List>
    </div>
  );
};

const Pager = ({
  page,
  total,
  onPageChange,
}: {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}) => {
  const pageCount = getPageCount(total, CMS_PAGE_SIZE);
  return (
    <Flex
      align="center"
      justify="end"
      gap="1"
      data-cms-pager
      css={{
        height: theme.spacing[15],
        flexShrink: 0,
        paddingInline: theme.panel.paddingInline,
        borderTop: `1px solid ${cssVar("--border-default")}`,
      }}
    >
      <Text color="subtle" css={{ fontVariantNumeric: "tabular-nums" }}>
        {formatPageRange(page, CMS_PAGE_SIZE, total)}
      </Text>
      <Tooltip content="Previous" side="top">
        <IconButton
          aria-label="Previous"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon />
        </IconButton>
      </Tooltip>
      <Tooltip content="Next" side="top">
        <IconButton
          aria-label="Next"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon />
        </IconButton>
      </Tooltip>
    </Flex>
  );
};

/** The items view: top bar, table and paging (4.3). */
export const ItemsView = ({
  collection,
  page,
  query,
  canEdit,
  focusItemId,
  onQueryChange,
  onPageChange,
  onOpenItem,
  onNewItem,
}: {
  collection: CmsCollectionSummary;
  page: CmsItemsPage | undefined;
  query: string;
  canEdit: boolean;
  focusItemId?: string;
  onQueryChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onOpenItem: (itemId: string) => void;
  onNewItem: () => void;
}) => {
  // "No items yet" is the New item button alone (4.1 inventory), in its place
  const isEmpty = collection.total === 0 && query === "";
  return (
    <Flex direction="column" css={{ height: "100%", minWidth: 0 }}>
      <TopBar
        collection={collection}
        query={query}
        canEdit={canEdit}
        showSearch={isEmpty === false}
        onQueryChange={onQueryChange}
        onNewItem={onNewItem}
      />
      {isEmpty === false && (
        <>
          <ScrollAreaNative css={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
            {page !== undefined && (
              <ItemsTable
                collectionName={collection.name}
                page={page}
                focusItemId={focusItemId}
                onOpenItem={onOpenItem}
              />
            )}
          </ScrollAreaNative>
          {page !== undefined && page.total > 0 && (
            <Pager
              page={page.page}
              total={page.total}
              onPageChange={onPageChange}
            />
          )}
        </>
      )}
    </Flex>
  );
};
