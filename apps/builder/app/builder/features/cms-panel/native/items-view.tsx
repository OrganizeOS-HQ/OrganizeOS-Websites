import { useEffect, useRef, useState } from "react";
import {
  Button,
  cssVar,
  Flex,
  IconButton,
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
import { formatPageRange, getPageCount, type CmsRefusal } from "./cms-logic";
import {
  filterCount,
  nextSort,
  resolveColumns,
  type CmsListState,
} from "./cms-list-logic";
import {
  CMS_PAGE_SIZE,
  type CmsCollectionSummary,
  type CmsField,
  type CmsItemsPage,
  type CmsSortKey,
  type CmsSource,
} from "./cms-source";
import { FilterMenu, SortMenu } from "./items-menus";
import { ItemsTable } from "./items-table";
import { TruncatedText } from "./truncated-text";

/** The field kinds the list can sort on (spec 5.1.3). */
const SORTABLE_KINDS: ReadonlySet<string> = new Set([
  "text",
  "date",
  "switch",
  "option",
]);

const TopBar = ({
  collection,
  query,
  canEdit,
  showSearch,
  list,
  filterField,
  sortFields,
  maxMenuWidth,
  onListChange,
  onQueryChange,
  onNewItem,
}: {
  collection: CmsCollectionSummary;
  query: string;
  canEdit: boolean;
  showSearch: boolean;
  list: CmsListState;
  filterField: CmsField | null;
  sortFields: CmsField[];
  maxMenuWidth: number | undefined;
  onListChange: (next: CmsListState) => void;
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
      {showSearch && (
        <FilterMenu
          list={list}
          filterField={filterField}
          maxWidth={maxMenuWidth}
          onChange={onListChange}
        />
      )}
      {showSearch && (
        <SortMenu
          list={list}
          sortFields={sortFields}
          maxWidth={maxMenuWidth}
          onChange={onListChange}
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
  fields,
  list,
  onListChange,
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
  /** The door, for the bulk and reorder calls (Tasks 16 to 18). */
  source: CmsSource;
  /** The cached E2 fields of the open collection, for the table (Task 15). */
  fields: CmsField[] | undefined;
  /** The open collection's filter, sort and selection (Task 14). */
  list: CmsListState;
  /** The last E3 answer's counter, for the reorder wait (Task 18). */
  pageAnswer: { count: number; ok: boolean };
  /** A filter, sort or selection change (Tasks 16 to 18). */
  onListChange: (next: CmsListState) => void;
  /** After a bulk or reorder write: the lists and canvas refetch (Task 17). */
  onListWritten: () => void;
  /** A refusal that replaces the view with one line (Tasks 16 to 18). */
  onRefusal: (refusal: CmsRefusal) => void;
  onQueryChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onOpenItem: (itemId: string) => void;
  onNewItem: () => void;
}) => {
  // The empty collection (New item alone) reads E3, not E1: no search, no
  // filter and a total of 0 (spec 5.1.8). Any other empty page is "No matches".
  const emptyNew =
    page !== undefined &&
    page.total === 0 &&
    query.trim() === "" &&
    filterCount(list) === 0;
  const noMatches =
    page !== undefined && page.total === 0 && emptyNew === false;

  const onSortChange = (clicked: CmsSortKey) => {
    const next = nextSort(
      { sort: list.sort, direction: list.direction },
      clicked
    );
    onListChange({ ...list, sort: next.sort, direction: next.direction });
  };

  const onToggle = (id: string) => {
    const selected = new Set(list.selected);
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    onListChange({ ...list, selected });
  };

  const onToggleAll = () => {
    if (page === undefined) {
      return;
    }
    const selected = new Set(list.selected);
    const ids = page.items.map((row) => row.id);
    const allSelected = ids.every((id) => selected.has(id));
    for (const id of ids) {
      if (allSelected) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
    }
    onListChange({ ...list, selected });
  };

  // E3's field columns, resolved; the Filter's option field and the Sort's
  // sortable fields, whether or not they fit (spec 5.1.2, 5.1.3)
  const columnFields = resolveColumns(fields ?? [], page?.columns ?? []).fields;
  const sortFields = columnFields.filter((field) =>
    SORTABLE_KINDS.has(field.kind)
  );
  const filterField =
    page?.filterField != null
      ? ((fields ?? []).find((field) => field.key === page.filterField) ?? null)
      : null;

  const rootRef = useRef<HTMLDivElement>(null);
  const [mainWidth, setMainWidth] = useState(0);
  useEffect(() => {
    const element = rootRef.current;
    if (element === null) {
      return;
    }
    setMainWidth(element.clientWidth);
    const observer = new ResizeObserver(() => {
      setMainWidth(element.clientWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Flex
      ref={rootRef}
      direction="column"
      css={{ height: "100%", minWidth: 0 }}
    >
      <TopBar
        // a new collection starts with an empty search and no pending one
        key={collection.id}
        collection={collection}
        query={query}
        canEdit={canEdit}
        showSearch={emptyNew === false}
        list={list}
        filterField={filterField}
        sortFields={sortFields}
        maxMenuWidth={mainWidth > 0 ? mainWidth : undefined}
        onListChange={onListChange}
        onQueryChange={onQueryChange}
        onNewItem={onNewItem}
      />
      {emptyNew === false && (
        <>
          <ScrollAreaNative css={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
            {noMatches && (
              <Text
                color="subtle"
                data-cms-no-matches
                css={{ padding: theme.panel.padding }}
              >
                No matches
              </Text>
            )}
            {page !== undefined && page.total > 0 && (
              <ItemsTable
                collectionName={collection.name}
                page={page}
                fields={fields ?? []}
                list={list}
                canEdit={canEdit}
                showHandle={false}
                focusItemId={focusItemId}
                onOpenItem={onOpenItem}
                onSortChange={onSortChange}
                onToggle={onToggle}
                onToggleAll={onToggleAll}
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
