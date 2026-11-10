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
  ScrollArea,
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

const columns = `minmax(0, 1fr) ${theme.spacing[25]} ${theme.spacing[26]}`;

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

export const TopBar = ({
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
    setDraft(query);
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
        <Tooltip content={collection.name} delayDuration={600}>
          <Text variant="titles" truncate>
            {collection.name}
          </Text>
        </Tooltip>
        <Text color="subtle" css={{ flexShrink: 0 }}>
          {collection.total}
        </Text>
      </Flex>
      {showSearch && (
        <SearchField
          aria-label={`Search ${collection.name}`}
          placeholder="Search"
          value={draft}
          css={{ width: theme.spacing[30], flexShrink: 1 }}
          onChange={(event) => change(event.currentTarget.value, 250)}
          onAbort={() => change("", 0)}
        />
      )}
      {canEdit && showSearch && (
        <Button color="primary" prefix={<PlusIcon />} onClick={onNewItem}>
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
      <div role="row" data-cms-item={item.slug}>
        <div role="cell">
          <Tooltip content={item.title} delayDuration={600}>
            <Text truncate>{item.title}</Text>
          </Tooltip>
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

export const ItemsTable = ({
  collectionName,
  page,
  onOpenItem,
}: {
  collectionName: string;
  page: CmsItemsPage;
  onOpenItem: (itemId: string) => void;
}) => (
  <div className={tableStyle()} role="table" aria-label={collectionName}>
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

export const Pager = ({
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
  onQueryChange,
  onPageChange,
  onOpenItem,
  onNewItem,
}: {
  collection: CmsCollectionSummary;
  page: CmsItemsPage | undefined;
  query: string;
  canEdit: boolean;
  onQueryChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onOpenItem: (itemId: string) => void;
  onNewItem: () => void;
}) => {
  // "No items yet" is the New item button alone (4.1 inventory).
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
      {isEmpty ? (
        <Flex align="center" justify="center" grow>
          {canEdit && (
            <Button color="primary" prefix={<PlusIcon />} onClick={onNewItem}>
              New item
            </Button>
          )}
        </Flex>
      ) : (
        <>
          <ScrollArea css={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
            {page !== undefined && (
              <ItemsTable
                collectionName={collection.name}
                page={page}
                onOpenItem={onOpenItem}
              />
            )}
          </ScrollArea>
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
