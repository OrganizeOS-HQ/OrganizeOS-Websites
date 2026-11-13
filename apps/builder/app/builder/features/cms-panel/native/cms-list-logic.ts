/**
 * The native CMS list's pure rules: the E3 query from the list state, column
 * resolving and fitting, cell text, selection, sort, drag, the
 * changed-since-publish dots, the delete dialog's title and the per-action
 * failure words. No React, no stores, no I/O.
 */
import { emptyValueFor, getToastText, isSameStoredValue } from "./cms-logic";
import type {
  CmsErrorCode,
  CmsField,
  CmsItem,
  CmsItemData,
  CmsItemsApplied,
  CmsItemsQuery,
  CmsSortDirection,
  CmsSortKey,
  CmsStatusFilter,
} from "./cms-source";

export type CmsListFilter = {
  status: CmsStatusFilter;
  option: { key: string; value: string } | null;
};

export type CmsListState = {
  collectionId: string | undefined;
  status: CmsStatusFilter;
  sort: CmsSortKey;
  direction: CmsSortDirection;
  option: { key: string; value: string } | null;
  selected: ReadonlySet<string>;
};

/** A sort's first direction: newest first for Modified, else ascending. */
export const defaultDirection = (sort: CmsSortKey): CmsSortDirection =>
  sort === "updated" ? "desc" : "asc";

export const defaultListState = (
  collectionId: string | undefined
): CmsListState => ({
  collectionId,
  status: "all",
  sort: "order",
  direction: "asc",
  option: null,
  selected: new Set(),
});

/**
 * E3's query for the list state: `q` and `page` as slice 1 sends them, then
 * each filter and sort key only when it differs from its default.
 */
export const toItemsQuery = (
  state: CmsListState,
  q: string | undefined,
  page: number
): CmsItemsQuery => {
  const query: CmsItemsQuery = {
    q: q === undefined || q === "" ? undefined : q,
    page,
  };
  if (state.status !== "all") {
    query.status = state.status;
  }
  if (state.sort !== "order") {
    query.sort = state.sort;
  }
  if (state.direction !== defaultDirection(state.sort)) {
    query.direction = state.direction;
  }
  if (state.option !== null) {
    query.optionKey = state.option.key;
    query.optionValue = state.option.value;
  }
  return query;
};

/** The key of every input to an E3 request; never the selection. */
export const listKey = (state: CmsListState): string =>
  JSON.stringify([state.status, state.sort, state.direction, state.option]);

const optionOf = (applied: CmsItemsApplied) =>
  applied.optionKey !== null && applied.optionValue !== null
    ? { key: applied.optionKey, value: applied.optionValue }
    : null;

/** The state with the applied filter and sort, or the same state when equal. */
export const adoptApplied = (
  state: CmsListState,
  applied: CmsItemsApplied
): CmsListState => {
  const option = optionOf(applied);
  if (
    state.status === applied.status &&
    state.sort === applied.sort &&
    state.direction === applied.direction &&
    (state.option?.key ?? null) === (option?.key ?? null) &&
    (state.option?.value ?? null) === (option?.value ?? null)
  ) {
    return state;
  }
  return {
    ...state,
    status: applied.status,
    sort: applied.sort,
    direction: applied.direction,
    option,
  };
};

/** The field kinds the list sorts on (spec 5.1.3). */
const SORTABLE_KINDS: ReadonlySet<string> = new Set([
  "text",
  "date",
  "switch",
  "option",
]);

/** Whether a field column sorts: a sortable kind, never the title (Name sorts it). */
export const isSortableField = (field: CmsField): boolean =>
  field.isTitle !== true && SORTABLE_KINDS.has(field.kind);

/** The fields for E3's column keys, in order, skipping a key the fields lack. */
export const resolveColumns = (
  fields: readonly CmsField[],
  keys: readonly string[]
): { fields: CmsField[]; missing: boolean } => {
  const resolved: CmsField[] = [];
  let missing = false;
  for (const key of keys) {
    const field = fields.find((candidate) => candidate.key === key);
    if (field === undefined) {
      missing = true;
    } else {
      resolved.push(field);
    }
  }
  return { fields: resolved, missing };
};

const LEAD_COLUMN = 24;
const COLUMN_GAP = 8;
const ROW_INSET = 24;
const FIELD_MIN = 96;
const NAME_MIN = 160;

/**
 * How many of the `wanted` field columns fit in `width`, the largest n that
 * leaves every column at least 96 px and Name at least 160 px (5.1.4). Name
 * takes 3 shares; Status, each field, Modified and Published take 1.
 */
export const fitFieldColumns = ({
  width,
  wanted,
  checkbox,
  handle,
}: {
  width: number;
  wanted: number;
  checkbox: boolean;
  handle: boolean;
}): number => {
  const leads = (checkbox ? 1 : 0) + (handle ? 1 : 0);
  const shareFor = (n: number): number => {
    const columns = leads + n + 4;
    const available =
      width - ROW_INSET - LEAD_COLUMN * leads - COLUMN_GAP * (columns - 1);
    return available / (n + 6);
  };
  for (let n = wanted; n >= 0; n -= 1) {
    const share = shareFor(n);
    if (share >= FIELD_MIN && 3 * share >= NAME_MIN) {
      return n;
    }
  }
  return 0;
};

const isEmptyCell = (value: unknown): boolean =>
  value === null || value === undefined || value === "";

/** A field column's cell text (5.1.4). */
export const getCellText = (field: CmsField, value: unknown): string => {
  if (field.kind === "switch") {
    return value ? "Yes" : "No";
  }
  if (isEmptyCell(value)) {
    return "";
  }
  if (field.kind === "option") {
    const option = field.options?.find((entry) => entry.value === value);
    return option?.label ?? String(value);
  }
  if (field.kind === "reference") {
    return "Linked";
  }
  if (field.kind === "number") {
    const number = Number(value);
    return Number.isNaN(number) ? "" : new Intl.NumberFormat().format(number);
  }
  if (field.kind === "datetime") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime())
      ? ""
      : new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(date);
  }
  return String(value);
};

/** The ids still shown after a new page. */
export const keepSelection = (
  selected: ReadonlySet<string>,
  rows: readonly { id: string }[]
): ReadonlySet<string> => {
  const shown = new Set(rows.map((row) => row.id));
  return new Set([...selected].filter((id) => shown.has(id)));
};

/** A header click: flip the active column, or set another's first direction. */
export const nextSort = (
  current: { sort: CmsSortKey; direction: CmsSortDirection },
  clicked: CmsSortKey
): { sort: CmsSortKey; direction: CmsSortDirection } =>
  clicked === current.sort
    ? {
        sort: current.sort,
        direction: current.direction === "asc" ? "desc" : "asc",
      }
    : { sort: clicked, direction: defaultDirection(clicked) };

/** The number of filters on: status and the option filter. */
export const filterCount = (state: CmsListState): 0 | 1 | 2 =>
  ((state.status === "all" ? 0 : 1) + (state.option === null ? 0 : 1)) as
    | 0
    | 1
    | 2;

/** Whether drag reorder is offered (5.1.7). */
export const canDragRows = ({
  canEdit,
  state,
  q,
  total,
}: {
  canEdit: boolean;
  state: CmsListState;
  q: string;
  total: number;
}): boolean =>
  canEdit &&
  state.sort === "order" &&
  q.trim() === "" &&
  filterCount(state) === 0 &&
  total <= 50;

/** The ids with the one at `from` moved to `to`. */
export const moveRow = (
  ids: readonly string[],
  from: number,
  to: number
): string[] => {
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

const valueOf = (data: CmsItemData, field: CmsField): unknown =>
  field.key in data ? data[field.key] : emptyValueFor(field.kind);

/**
 * The staged fields and address that differ from the live copy, each compared
 * in the platform's stored form (5.2.3). Nothing changed while `live` is null.
 */
export const getChangedSincePublish = ({
  fields,
  live,
  values,
  slug,
}: {
  fields: readonly CmsField[];
  live: CmsItem["live"];
  values: CmsItemData;
  slug: string;
}): { keys: ReadonlySet<string>; address: boolean } => {
  if (live === null) {
    return { keys: new Set(), address: false };
  }
  const keys = new Set(
    fields
      .filter(
        (field) =>
          isSameStoredValue(
            field.kind,
            valueOf(values, field),
            valueOf(live.data, field)
          ) === false
      )
      .map((field) => field.key)
  );
  return { keys, address: slug !== live.slug };
};

/** The bulk or editor delete dialog's title (Copy). */
export const getDeleteTitle = (
  count: number,
  collection: { name: string; singularName: string }
): string =>
  count === 1
    ? `Delete 1 ${collection.singularName.toLowerCase()}?`
    : `Delete ${count} ${collection.name.toLowerCase()}?`;

export type CmsListAction = "publish" | "status" | "delete" | "order";

const actionWord: Record<CmsListAction, string> = {
  publish: "Not published",
  status: "Not changed",
  delete: "Not deleted",
  order: "Not moved",
};

/** The codes whose words the shared toast map already carries. */
const sharedCodes: ReadonlySet<CmsErrorCode> = new Set<CmsErrorCode>([
  "rate_limited",
  "unavailable",
  "updating",
  "replayed",
  "refused",
  "forbidden",
  "plan",
  "limit",
]);

/**
 * The toast for a list action refused with `code` (5.5): the shared word for a
 * shared code, "Address in use" for `slug_taken`, "Collection not found" for
 * `not_found`, else the action's own word.
 */
export const getListFailureText = (
  action: CmsListAction,
  code: CmsErrorCode
): string => {
  if (code === "slug_taken") {
    return "Address in use";
  }
  if (code === "not_found") {
    return "Collection not found";
  }
  if (sharedCodes.has(code)) {
    return getToastText(code);
  }
  return actionWord[action];
};
