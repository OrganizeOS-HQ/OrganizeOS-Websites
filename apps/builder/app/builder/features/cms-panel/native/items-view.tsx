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
  toast,
  Tooltip,
} from "@webstudio-is/design-system";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "@webstudio-is/icons";
import {
  formatPageRange,
  getPageCount,
  getRefusal,
  type CmsRefusal,
} from "./cms-logic";
import {
  canDragRows,
  filterCount,
  getDeleteTitle,
  getListFailureText,
  isSortableField,
  listKey,
  nextSort,
  resolveColumns,
  type CmsListState,
} from "./cms-list-logic";
import {
  CMS_PAGE_SIZE,
  type CmsCollectionSummary,
  type CmsField,
  type CmsItemRow,
  type CmsItemsPage,
  type CmsSortKey,
  type CmsSource,
} from "./cms-source";
import { BulkBar } from "./bulk-bar";
import { DeleteDialog } from "./delete-dialog";
import { FilterMenu, SortMenu } from "./items-menus";
import { ItemsTable } from "./items-table";
import { TruncatedText } from "./truncated-text";
import { useBulkActions } from "./use-bulk-actions";
import { useRowReorder } from "./use-row-reorder";

const TopBar = ({
  collection,
  query,
  canEdit,
  showSearch,
  list,
  filterField,
  sortFields,
  maxMenuWidth,
  bulkBar,
  onListChange,
  onQueryChange,
  onNewItem,
}: {
  collection: CmsCollectionSummary;
  query: string;
  canEdit: boolean;
  showSearch: boolean;
  /** While rows are selected: the bulk bar, in place of the search, Filter, Sort and New item. */
  bulkBar: JSX.Element | undefined;
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
      wrap={bulkBar === undefined ? undefined : "wrap"}
      data-cms-top-bar
      css={{
        minHeight: theme.spacing[15],
        flexShrink: 0,
        paddingBlock: bulkBar === undefined ? undefined : theme.spacing[3],
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
      {bulkBar}
      {showSearch && bulkBar === undefined && (
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
      {showSearch && bulkBar === undefined && (
        <FilterMenu
          list={list}
          filterField={filterField}
          maxWidth={maxMenuWidth}
          onChange={onListChange}
        />
      )}
      {showSearch && bulkBar === undefined && (
        <SortMenu
          list={list}
          sortFields={sortFields}
          maxWidth={maxMenuWidth}
          onChange={onListChange}
        />
      )}
      {canEdit && bulkBar === undefined && (
        <Button
          color="primary"
          prefix={<PlusIcon />}
          data-cms-new-item
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

/**
 * The table's drag and keyboard reorder (5.1.7). The screen holds it above
 * the view, so a structure view opened while a reorder is in flight leaves
 * it running, and the table drawn again after shows its order and waits.
 */
export const useItemsReorder = (input: {
  source: CmsSource | undefined;
  collectionId: string;
  list: CmsListState;
  query: string;
  page: CmsItemsPage | undefined;
  pageAnswer: { count: number; ok: boolean };
  onListWritten: () => void;
  onRefusal: (refusal: CmsRefusal) => void;
}) =>
  useRowReorder({
    source: input.source,
    collectionId: input.collectionId,
    listKey: JSON.stringify([listKey(input.list), input.query]),
    page: input.page,
    pageAnswer: input.pageAnswer,
    onReordered: input.onListWritten,
    onFailed: (code) => {
      // the refetch shows the server's order
      input.onListWritten();
      const refusal = getRefusal(code, "write");
      if (refusal !== undefined) {
        input.onRefusal(refusal);
        return;
      }
      toast.error(getListFailureText("order", code));
    },
  });

export type ItemsReorder = ReturnType<typeof useItemsReorder>;

/** The items view: top bar, table and paging (4.3). */
export const ItemsView = ({
  collection,
  page,
  query,
  drawnQueryEmpty,
  canEdit,
  canPublish,
  focusItemId,
  deletedItemId,
  onDeletedFocused,
  source,
  fields,
  list,
  pageAnswer,
  onListChange,
  onListWritten,
  onRefusal,
  onQueryChange,
  onPageChange,
  onOpenItem,
  onNewItem,
  reorder: heldReorder,
}: {
  /** The screen's reorder, held above the view; else the view's own. */
  reorder?: ItemsReorder;
  collection: CmsCollectionSummary;
  page: CmsItemsPage | undefined;
  query: string;
  /** The drawn page answered the open search, filter and sort, with no search. */
  drawnQueryEmpty: boolean;
  canEdit: boolean;
  canPublish: boolean;
  focusItemId?: string;
  /** The item the editor's Delete removed: the first other row takes the focus. */
  deletedItemId?: string;
  /** The focus has settled after the delete: the deleted row is gone. */
  onDeletedFocused?: () => void;
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

  // A list change made inside the table (a header, a checkbox) keeps the
  // focus there: moves made on the drawn page are sent first.
  const changeListInTable = (next: CmsListState) => {
    reorder.flush();
    onListChange(next);
  };

  const onSortChange = (clicked: CmsSortKey) => {
    const next = nextSort(
      { sort: list.sort, direction: list.direction },
      clicked
    );
    changeListInTable({
      ...list,
      sort: next.sort,
      direction: next.direction,
    });
  };

  const onToggle = (id: string) => {
    const selected = new Set(list.selected);
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    changeListInTable({ ...list, selected });
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
    changeListInTable({ ...list, selected });
  };

  // E3's field columns, resolved; the Filter's option field and the Sort's
  // sortable fields, whether or not they fit (spec 5.1.2, 5.1.3)
  const columnFields = resolveColumns(fields ?? [], page?.columns ?? []).fields;
  // a field sort whose column no longer shows (a schema change) stays in the
  // Sort menu, checked, so it can be seen and cleared
  const sortedKey = list.sort.startsWith("field:")
    ? list.sort.slice("field:".length)
    : undefined;
  const sortedField =
    sortedKey === undefined ||
    columnFields.some((field) => field.key === sortedKey)
      ? undefined
      : (fields ?? []).find(
          (field) => field.key === sortedKey && isSortableField(field)
        );
  const sortFields = [
    ...columnFields.filter(isSortableField),
    ...(sortedField === undefined ? [] : [sortedField]),
  ];
  const filterField =
    page?.filterField != null
      ? ((fields ?? []).find((field) => field.key === page.filterField) ?? null)
      : null;

  const bulk = useBulkActions({
    source,
    collection,
    page,
    list,
    onListChange,
    onListWritten,
    onRefusal,
  });
  // the count the delete dialog was opened for, so its title holds while it closes
  const [confirmDelete, setConfirmDelete] = useState<number | undefined>(
    undefined
  );
  // drag reorder (5.1.7): an open and a bulk call wait until it settles
  const ownReorder = useItemsReorder({
    source,
    collectionId: collection.id,
    list,
    query,
    page,
    pageAnswer,
    onListWritten,
    onRefusal,
  });
  const reorder = heldReorder ?? ownReorder;
  // drag is offered only on a drawn page in Manual order with no search and
  // no filter, read from the page's own applied filter and sort
  const showHandle =
    page !== undefined &&
    drawnQueryEmpty &&
    page.applied.status === "all" &&
    page.applied.sort === "order" &&
    page.applied.optionKey === null &&
    canDragRows({ canEdit, state: list, q: query, total: page.total });
  const shownPage: CmsItemsPage | undefined =
    page === undefined
      ? undefined
      : {
          ...page,
          items: reorder.order
            .map((id) => page.items.find((row) => row.id === id))
            .filter((row): row is CmsItemRow => row !== undefined),
        };
  const bulkBusy = bulk.busy || reorder.bulkWaiting;
  const runBulk = (run: () => Promise<void>, onDropped?: () => void) =>
    reorder.whenSettled(() => void run(), "bulk", onDropped);

  // A row opened while a bulk call is in flight opens once it has answered,
  // in the collection it was opened in.
  const waitingOpen = useRef<
    { itemId: string; collectionId: string } | undefined
  >(undefined);
  const openCollectionId = useRef(collection.id);
  openCollectionId.current = collection.id;
  const openNow = useRef((itemId: string) =>
    reorder.whenSettled(() => onOpenItem(itemId), "open")
  );
  openNow.current = (itemId: string) =>
    reorder.whenSettled(() => onOpenItem(itemId), "open");
  const openRow = (itemId: string) => {
    if (bulk.busy) {
      waitingOpen.current = { itemId, collectionId: collection.id };
      return;
    }
    openNow.current(itemId);
  };
  useEffect(() => {
    if (waitingOpen.current?.collectionId !== collection.id) {
      waitingOpen.current = undefined;
    }
  }, [collection.id]);
  useEffect(() => {
    const waiting = waitingOpen.current;
    if (bulk.busy || waiting === undefined) {
      return;
    }
    waitingOpen.current = undefined;
    if (waiting.collectionId === openCollectionId.current) {
      openNow.current(waiting.itemId);
    }
  }, [bulk.busy]);

  // The focus left with the bulk bar or its Delete dialog: the table's first
  // row takes it, else New item, again until the next page answer has landed.
  const pageAnswers = useRef(pageAnswer.count);
  pageAnswers.current = pageAnswer.count;
  const refocus = useRef<number | undefined>(undefined);
  const [refocusTick, setRefocusTick] = useState(0);
  const requestRefocus = () => {
    refocus.current = pageAnswers.current;
    setRefocusTick((current) => current + 1);
  };
  useEffect(() => {
    const since = refocus.current;
    const root = rootRef.current;
    if (since === undefined || root === null) {
      return;
    }
    const active = document.activeElement;
    if (active === null || active === document.body) {
      const target =
        root.querySelector<HTMLElement>("[data-cms-item-id]") ??
        root.querySelector<HTMLElement>("[data-cms-new-item]");
      target?.focus();
    }
    if (pageAnswer.count > since) {
      refocus.current = undefined;
    }
  }, [refocusTick, page, pageAnswer.count]);
  const selectedCount =
    page?.items.filter((row) => list.selected.has(row.id)).length ?? 0;
  const bulkBar =
    canEdit && selectedCount > 0 ? (
      <BulkBar
        count={selectedCount}
        canPublish={canPublish}
        busy={bulkBusy}
        onPublish={() => runBulk(bulk.publish)}
        onUnpublish={() => runBulk(() => bulk.setStatus("draft"))}
        onArchive={() => runBulk(() => bulk.setStatus("archived"))}
        onDelete={() => setConfirmDelete(selectedCount)}
        onClear={() => onListChange({ ...list, selected: new Set() })}
        onFocusLost={requestRefocus}
      />
    ) : undefined;

  const rootRef = useRef<HTMLDivElement>(null);
  const [mainWidth, setMainWidth] = useState(0);

  // After the editor closes (W3-D6): the returned item's row takes the
  // focus, else the table's first row (never the deleted item's), else New
  // item. Again on each page while the focus is lost or on a row no longer
  // listed, until a page answered after the list showed has landed.
  const answersAtShow = useRef(pageAnswer.count);
  const [returning, setReturning] = useState(true);
  // New item, focused for want of a row: a row drawn later takes the focus
  const fallbackFocus = useRef<HTMLElement | undefined>(undefined);
  const onDeletedFocusedRef = useRef(onDeletedFocused);
  onDeletedFocusedRef.current = onDeletedFocused;
  useEffect(() => {
    const root = rootRef.current;
    if (
      returning === false ||
      root === null ||
      (focusItemId === undefined && deletedItemId === undefined)
    ) {
      return;
    }
    const active = document.activeElement;
    const listed = new Set((page?.items ?? []).map((row) => row.id));
    const activeRowId =
      active instanceof HTMLElement && root.contains(active)
        ? active.dataset.cmsItemId
        : undefined;
    const rows = [
      ...root.querySelectorAll<HTMLElement>("[data-cms-item-id]"),
    ].filter((row) => row.dataset.cmsItemId !== deletedItemId);
    const isLost =
      active === null ||
      active === document.body ||
      (active === fallbackFocus.current && rows.length > 0) ||
      (activeRowId !== undefined &&
        (activeRowId === deletedItemId || listed.has(activeRowId) === false));
    if (isLost) {
      const row =
        rows.find((entry) => entry.dataset.cmsItemId === focusItemId) ??
        rows[0];
      const target =
        row ?? root.querySelector<HTMLElement>("[data-cms-new-item]");
      fallbackFocus.current =
        row === undefined && target !== null ? target : undefined;
      target?.focus();
    }
    if (pageAnswer.count > answersAtShow.current) {
      setReturning(false);
      if (deletedItemId !== undefined) {
        onDeletedFocusedRef.current?.();
      }
    }
  }, [returning, focusItemId, deletedItemId, page, pageAnswer.count]);
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
      data-cms-page-answers={pageAnswer.count}
      data-cms-page-answer-ok={pageAnswer.ok}
      onKeyDown={(event) => {
        // Escape with a selection clears it, and the overlay stays (5.1.5).
        // A dialog's or menu's Escape (portalled, so outside this element's
        // DOM, or already handled) is theirs.
        if (
          event.key !== "Escape" ||
          event.defaultPrevented ||
          list.selected.size === 0 ||
          rootRef.current === null ||
          rootRef.current.contains(event.target as Node) === false
        ) {
          return;
        }
        event.preventDefault();
        onListChange({ ...list, selected: new Set() });
      }}
    >
      <TopBar
        // a new collection starts with an empty search and no pending one
        key={collection.id}
        collection={collection}
        query={query}
        canEdit={canEdit}
        showSearch={emptyNew === false}
        bulkBar={bulkBar}
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
                page={shownPage ?? page}
                fields={fields ?? []}
                list={list}
                canEdit={canEdit}
                showHandle={showHandle}
                focusItemId={focusItemId}
                onOpenItem={openRow}
                onMove={reorder.move}
                onDrop={reorder.drop}
                onLeave={reorder.flush}
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
      <DeleteDialog
        open={confirmDelete !== undefined}
        title={getDeleteTitle(confirmDelete ?? selectedCount, collection)}
        busy={bulkBusy}
        onCancel={() => setConfirmDelete(undefined)}
        onFocusLost={requestRefocus}
        onConfirm={() =>
          runBulk(
            () => bulk.remove().finally(() => setConfirmDelete(undefined)),
            // a dropped call closes the dialog; the selection stays
            () => setConfirmDelete(undefined)
          )
        }
      />
    </Flex>
  );
};
