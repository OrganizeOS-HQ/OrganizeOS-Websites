/**
 * The native CMS items table (spec 5.1.4): the checkbox, Name, Status, the
 * field columns that fit, Modified and Published, with sortable headers. The
 * drag handle and the bulk selection arrive in later tasks.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Checkbox,
  css,
  cssVar,
  InsetList,
  InsetListItem,
  List,
  ListItem,
  Text,
  theme,
} from "@webstudio-is/design-system";
import { ChevronDownIcon, ChevronUpIcon } from "@webstudio-is/icons";
import { RelativeTime } from "~/builder/shared/relative-time";
import { tickedCheckboxCss } from "../../publish/organizeos-publish-checkbox";
import {
  fitFieldColumns,
  getCellText,
  resolveColumns,
  type CmsListState,
} from "./cms-list-logic";
import type {
  CmsField,
  CmsItemRow,
  CmsItemsPage,
  CmsSortKey,
} from "./cms-source";
import { StatusChip } from "./status-chip";
import { TruncatedText } from "./truncated-text";

/** The kinds the list can sort on (spec 5.1.3). */
const SORTABLE_KINDS: ReadonlySet<string> = new Set([
  "text",
  "date",
  "switch",
  "option",
]);

const isSortableField = (field: CmsField) =>
  field.isTitle !== true && SORTABLE_KINDS.has(field.kind);

const LEAD = theme.spacing[11];

const tableStyle = css({
  display: "grid",
  alignContent: "start",
  width: "100%",
  '& [role="row"]': {
    display: "grid",
    gridTemplateColumns: "var(--cms-grid)",
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

const sortButtonStyle = css({
  all: "unset",
  display: "flex",
  alignItems: "center",
  gap: theme.spacing[2],
  minWidth: 0,
  cursor: "pointer",
  "&:focus-visible": {
    outline: `2px solid ${cssVar("--border-focus")}`,
    outlineOffset: -2,
  },
});

/** A medium date for the Published column, in the browser's locale. */
const publishedDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
};

const HeaderLabel = ({ label }: { label: string }) => (
  <TruncatedText variant="labels" color="subtle">
    {label}
  </TruncatedText>
);

const ColumnHeader = ({
  label,
  sortKey,
  list,
  onSortChange,
}: {
  label: string;
  sortKey: CmsSortKey | undefined;
  list: CmsListState;
  onSortChange: (clicked: CmsSortKey) => void;
}) => {
  if (sortKey === undefined) {
    return (
      <div role="columnheader">
        <HeaderLabel label={label} />
      </div>
    );
  }
  const active = list.sort === sortKey;
  const ariaSort = active
    ? list.direction === "asc"
      ? "ascending"
      : "descending"
    : "none";
  return (
    <div role="columnheader" aria-sort={ariaSort}>
      <button
        type="button"
        className={sortButtonStyle()}
        onClick={() => onSortChange(sortKey)}
      >
        <HeaderLabel label={label} />
        {active &&
          (list.direction === "asc" ? (
            <ChevronUpIcon color={cssVar("--foreground-secondary")} />
          ) : (
            <ChevronDownIcon color={cssVar("--foreground-secondary")} />
          ))}
      </button>
    </div>
  );
};

const FieldCell = ({ field, value }: { field: CmsField; value: unknown }) => {
  const text = getCellText(field, value);
  if (field.kind === "number") {
    return (
      <Text
        color="subtle"
        truncate
        css={{ fontVariantNumeric: "tabular-nums" }}
      >
        {text}
      </Text>
    );
  }
  return <TruncatedText>{text}</TruncatedText>;
};

const ItemRow = ({
  index,
  item,
  fields,
  canEdit,
  selected,
  leadCount,
  onOpen,
  onToggle,
}: {
  index: number;
  item: CmsItemRow;
  fields: CmsField[];
  canEdit: boolean;
  selected: boolean;
  leadCount: number;
  onOpen: () => void;
  onToggle: (id: string) => void;
}) => (
  <ListItem
    index={index}
    asChild
    onSelect={onOpen}
    state={selected ? "selected" : undefined}
  >
    <InsetListItem asChild>
      <div role="row" data-cms-item={item.slug} data-cms-item-id={item.id}>
        {canEdit && (
          <div role="cell" style={{ width: LEAD }}>
            <Checkbox
              aria-label={`Select ${item.title}`}
              checked={selected}
              css={selected ? tickedCheckboxCss : undefined}
              onClick={(event) => event.stopPropagation()}
              onCheckedChange={() => onToggle(item.id)}
            />
          </div>
        )}
        {Array.from({ length: leadCount - (canEdit ? 1 : 0) }).map((_, i) => (
          <div role="cell" key={`lead-${i}`} style={{ width: LEAD }} />
        ))}
        <div role="cell">
          <TruncatedText>{item.title}</TruncatedText>
        </div>
        <div role="cell">
          <StatusChip {...item} />
        </div>
        {fields.map((field) => (
          <div role="cell" key={field.key} data-cms-column-key={field.key}>
            <FieldCell field={field} value={item.values[field.key] ?? null} />
          </div>
        ))}
        <div role="cell">
          <Text color="subtle" truncate>
            <RelativeTime time={new Date(item.updatedAt)} />
          </Text>
        </div>
        <div role="cell">
          {item.status === "published" && item.publishedAt !== null ? (
            <Text color="subtle" truncate>
              {publishedDate(item.publishedAt)}
            </Text>
          ) : null}
        </div>
      </div>
    </InsetListItem>
  </ListItem>
);

export const ItemsTable = ({
  collectionName,
  page,
  fields,
  list,
  canEdit,
  showHandle,
  focusItemId,
  onOpenItem,
  onSortChange,
  onToggle,
  onToggleAll,
}: {
  collectionName: string;
  page: CmsItemsPage;
  /** The cached E2 fields of the open collection. */
  fields: CmsField[];
  list: CmsListState;
  canEdit: boolean;
  /** A drag handle column is reserved (Task 18). */
  showHandle: boolean;
  /** The item whose editor just closed: its row takes the focus back. */
  focusItemId: string | undefined;
  onOpenItem: (itemId: string) => void;
  onSortChange: (clicked: CmsSortKey) => void;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(() => {
      setWidth(element.clientWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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

  // the field columns E3 named, resolved against the cached fields
  const resolved = useMemo(
    () => resolveColumns(fields, page.columns).fields,
    [fields, page.columns]
  );
  const leadCount = (canEdit ? 1 : 0) + (showHandle ? 1 : 0);
  const fit = fitFieldColumns({
    width,
    wanted: resolved.length,
    checkbox: canEdit,
    handle: showHandle,
  });
  const shown = resolved.slice(0, fit);

  const template = [
    ...Array.from({ length: leadCount }, () => LEAD),
    "minmax(0, 3fr)",
    "minmax(0, 1fr)",
    ...shown.map(() => "minmax(0, 1fr)"),
    "minmax(0, 1fr)",
    "minmax(0, 1fr)",
  ].join(" ");

  const rows = page.items;
  const allSelected =
    rows.length > 0 && rows.every((row) => list.selected.has(row.id));
  const someSelected = rows.some((row) => list.selected.has(row.id));

  return (
    <div
      ref={ref}
      className={tableStyle()}
      role="table"
      aria-label={collectionName}
      style={{ "--cms-grid": template } as CSSProperties}
    >
      {rows.length > 0 && (
        <div role="rowgroup">
          <div role="row" className={headerRowStyle()}>
            {canEdit && (
              <div role="columnheader" style={{ width: LEAD }}>
                <Checkbox
                  aria-label="Select all on this page"
                  checked={
                    allSelected ? true : someSelected ? "indeterminate" : false
                  }
                  css={allSelected ? tickedCheckboxCss : undefined}
                  onCheckedChange={() => onToggleAll()}
                />
              </div>
            )}
            {showHandle && <div role="columnheader" style={{ width: LEAD }} />}
            <ColumnHeader
              label="Name"
              sortKey="name"
              list={list}
              onSortChange={onSortChange}
            />
            <ColumnHeader
              label="Status"
              sortKey="status"
              list={list}
              onSortChange={onSortChange}
            />
            {shown.map((field) => (
              <ColumnHeader
                key={field.key}
                label={field.label}
                sortKey={
                  isSortableField(field) ? `field:${field.key}` : undefined
                }
                list={list}
                onSortChange={onSortChange}
              />
            ))}
            <ColumnHeader
              label="Modified"
              sortKey="updated"
              list={list}
              onSortChange={onSortChange}
            />
            <ColumnHeader
              label="Published"
              sortKey={undefined}
              list={list}
              onSortChange={onSortChange}
            />
          </div>
        </div>
      )}
      <List asChild>
        <InsetList role="rowgroup" css={{ gap: 0, paddingTop: 0 }}>
          {rows.map((item, index) => (
            <ItemRow
              key={item.id}
              index={index}
              item={item}
              fields={shown}
              canEdit={canEdit}
              selected={list.selected.has(item.id)}
              leadCount={leadCount}
              onOpen={() => onOpenItem(item.id)}
              onToggle={onToggle}
            />
          ))}
        </InsetList>
      </List>
    </div>
  );
};
