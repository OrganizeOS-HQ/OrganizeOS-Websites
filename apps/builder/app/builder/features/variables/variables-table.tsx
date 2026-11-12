import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import {
  Box,
  Checkbox,
  Flex,
  Grid,
  InputErrorsTooltip,
  InputField,
  SmallIconButton,
  Text,
  cssVar,
  theme,
  useSortable,
} from "@webstudio-is/design-system";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DragHandleIcon,
  PlusIcon,
} from "@webstudio-is/icons";
import type { StyleValue } from "@webstudio-is/css-engine";
import type { VariableType } from "@webstudio-is/project-build";
import type { CollectionView, VariableRow } from "./reader";
import {
  createVariable,
  deleteVariables,
  getVariableUsage,
  orderVariables,
} from "./operations";
import { landed } from "./refusal";
import { DeleteDialog } from "./delete-dialog";
import { RowMenu } from "./row-menu";
import { VARIABLE_TYPE_LABELS } from "./value-types";
import { NameCell } from "./name-cell";
import { ValueCell } from "./value-cell";
import { NewVariableMenu, newVariableValue } from "./variables-toolbar";

/** The table's columns: handle, Name, Base mode, actions (spec 5.5). */
const columns = `${theme.spacing[9]} minmax(0, 1fr) minmax(0, 1fr) ${theme.spacing[9]}`;

const rowCss = {
  gridTemplateColumns: columns,
  alignItems: "center",
  gap: theme.spacing[3],
  minHeight: theme.spacing[13],
  px: theme.spacing[5],
  borderBottom: `1px solid ${cssVar("--border-default")}`,
} as const;

/** Select mode's state, held by the manager (spec 5.6). */
export type Selection = {
  active: boolean;
  selected: ReadonlySet<string>;
  /** `order` is the shown, unlocked rows' CSS names, for a Shift range */
  onToggle: (cssName: string, range: boolean, order: readonly string[]) => void;
  onSetMany: (cssNames: readonly string[], on: boolean) => void;
};

/** A checkbox over several rows: checked when every one is selected. */
const ManyCheckbox = ({
  cssNames,
  selection,
}: {
  cssNames: readonly string[];
  selection: Selection;
}) => {
  const all =
    cssNames.length > 0 &&
    cssNames.every((cssName) => selection.selected.has(cssName));
  return (
    <Checkbox
      checked={all}
      onClick={(event) => {
        event.stopPropagation();
        selection.onSetMany(cssNames, all === false);
      }}
    />
  );
};

/** A group's rows, or a run of rows with no group, in collection order. */
type Segment = { group?: string; rows: VariableRow[] };

const segmentsOf = (rows: readonly VariableRow[]) => {
  const segments: Segment[] = [];
  const groups = new Map<string, Segment>();
  for (const row of rows) {
    if (row.group === undefined) {
      const last = segments.at(-1);
      if (last !== undefined && last.group === undefined) {
        last.rows.push(row);
      } else {
        segments.push({ rows: [row] });
      }
      continue;
    }
    const segment = groups.get(row.group);
    if (segment !== undefined) {
      segment.rows.push(row);
      continue;
    }
    const created = { group: row.group, rows: [row] };
    groups.set(row.group, created);
    segments.push(created);
  }
  return segments;
};

const RowView = ({
  row,
  rows,
  collections,
  readOnly,
  showLeaf,
  canDrag,
  selection,
  order,
  onMove,
}: {
  row: VariableRow;
  rows: readonly VariableRow[];
  collections: readonly CollectionView[];
  readOnly: boolean;
  showLeaf: boolean;
  canDrag: boolean;
  selection: Selection;
  order: readonly string[];
  onMove: (direction: -1 | 1) => void;
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [uses, setUses] = useState<number>();
  const requestDelete = () => {
    const count = getVariableUsage(row.cssName);
    if (count === 0) {
      landed(deleteVariables([row.cssName]));
      return;
    }
    setUses(count);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    // Enter on a row renames it (spec 5.5), as a double-click does.
    if (event.key === "Enter") {
      if (readOnly === false && row.locked === false) {
        event.preventDefault();
        setIsRenaming(true);
      }
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    if (event.altKey) {
      if (canDrag) {
        onMove(direction);
      }
      return;
    }
    const all = Array.from(
      event.currentTarget
        .closest('[role="table"]')
        ?.querySelectorAll<HTMLElement>("[data-variable-row]") ?? []
    );
    all[all.indexOf(event.currentTarget) + direction]?.focus();
  };
  return (
    <Grid
      role="row"
      data-variable-row={row.cssName}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      css={{
        ...rowCss,
        contentVisibility: "auto",
        containIntrinsicSize: `auto ${theme.spacing[13]}`,
        "&:focus-visible": {
          outline: `1px solid ${cssVar("--border-focus")}`,
          outlineOffset: -1,
        },
      }}
    >
      <Flex role="cell" justify="center">
        {selection.active
          ? row.locked === false && (
              <Checkbox
                checked={selection.selected.has(row.cssName)}
                onClick={(event) =>
                  selection.onToggle(row.cssName, event.shiftKey, order)
                }
              />
            )
          : canDrag && (
              // useSortable reads data-id from an HTML element, not an svg
              <Flex data-id={row.cssName} css={{ cursor: "grab" }}>
                <DragHandleIcon color={cssVar("--foreground-secondary")} />
              </Flex>
            )}
      </Flex>
      <Box role="cell" css={{ minWidth: 0 }}>
        <NameCell
          row={row}
          readOnly={readOnly}
          showLeaf={showLeaf}
          editing={isRenaming}
          onEditingChange={setIsRenaming}
        />
      </Box>
      <Box role="cell" css={{ minWidth: 0 }}>
        <ValueCell row={row} rows={rows} readOnly={readOnly} />
      </Box>
      <Flex role="cell" justify="center">
        <RowMenu
          row={row}
          collections={collections}
          readOnly={readOnly}
          onRename={() => setIsRenaming(true)}
          onDelete={requestDelete}
        />
        <DeleteDialog
          open={uses !== undefined}
          name={row.displayName}
          uses={uses ?? 0}
          onConfirm={() => {
            landed(deleteVariables([row.cssName]));
          }}
          onOpenChange={(open) => {
            if (open === false) {
              setUses(undefined);
            }
          }}
        />
      </Flex>
    </Grid>
  );
};

const SegmentView = ({
  segment,
  allRows,
  collections,
  readOnly,
  isSearching,
  isCollapsed,
  selection,
  order,
  onToggle,
  onReorder,
}: {
  segment: Segment;
  allRows: readonly VariableRow[];
  collections: readonly CollectionView[];
  readOnly: boolean;
  isSearching: boolean;
  isCollapsed: boolean;
  selection: Selection;
  order: readonly string[];
  onToggle: () => void;
  /** moves the segment's row at `from` to `to`; `keepFocus` refocuses it */
  onReorder: (from: number, to: number, keepFocus: boolean) => void;
}) => {
  const canDrag =
    readOnly === false && isSearching === false && selection.active === false;
  const items = segment.rows.map((row) => ({ id: row.cssName }));
  const { placementIndicator, sortableRefCallback } = useSortable({
    items,
    onSort: (newIndex, oldIndex) => {
      if (canDrag) {
        onReorder(oldIndex, newIndex, false);
      }
    },
  });
  return (
    <>
      {segment.group !== undefined && (
        <Grid
          role="row"
          data-variable-group={segment.group}
          css={{ ...rowCss, cursor: "default" }}
          onClick={onToggle}
        >
          <Flex role="cell" justify="center">
            {selection.active ? (
              <ManyCheckbox
                cssNames={segment.rows
                  .filter((row) => row.locked === false)
                  .map((row) => row.cssName)}
                selection={selection}
              />
            ) : isCollapsed ? (
              <ChevronRightIcon />
            ) : (
              <ChevronDownIcon />
            )}
          </Flex>
          <Text role="cell" variant="labels" truncate>
            {segment.group}
          </Text>
        </Grid>
      )}
      {isCollapsed === false && (
        <Box ref={sortableRefCallback}>
          {segment.rows.map((row, index) => (
            <RowView
              key={row.cssName}
              row={row}
              rows={allRows}
              collections={collections}
              readOnly={readOnly}
              showLeaf={segment.group !== undefined}
              // an untyped row has no place in the registry to keep
              canDrag={
                canDrag && row.locked === false && row.type !== undefined
              }
              selection={selection}
              order={order}
              onMove={(direction) => {
                const to = index + direction;
                if (to >= 0 && to < segment.rows.length) {
                  onReorder(index, to, true);
                }
              }}
            />
          ))}
          {placementIndicator}
        </Box>
      )}
    </>
  );
};

/** The new variable's name: Enter, or a blur with a name, creates it. */
const DraftRow = ({
  type,
  collectionId,
  bodyFont,
  onEnd,
}: {
  type: VariableType;
  collectionId: string;
  bodyFont: StyleValue | undefined;
  onEnd: () => void;
}) => {
  const [name, setName] = useState<string>(VARIABLE_TYPE_LABELS[type]);
  const [error, setError] = useState<string>();
  const done = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // The menu that opened the draft closes in the same frame: focus after it.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const create = () => {
    if (done.current) {
      return;
    }
    if (name.trim() === "") {
      done.current = true;
      onEnd();
      return;
    }
    const result = createVariable({
      collectionId,
      type,
      displayName: name,
      value: newVariableValue(type, bodyFont),
    });
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    done.current = true;
    onEnd();
  };
  return (
    <Grid role="row" data-variable-draft css={rowCss}>
      <Box role="cell" />
      <Box role="cell" css={{ minWidth: 0 }}>
        <InputErrorsTooltip errors={error === undefined ? undefined : [error]}>
          <InputField
            inputRef={inputRef}
            aria-label="Name"
            value={name}
            onFocus={(event) => {
              if (event.target instanceof HTMLInputElement) {
                event.target.select();
              }
            }}
            onChange={(event) => {
              setName(event.target.value);
              setError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                create();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                done.current = true;
                onEnd();
              }
            }}
            onBlur={create}
          />
        </InputErrorsTooltip>
      </Box>
    </Grid>
  );
};

/**
 * The selected collection's variables (spec 5.5): a grid of Name and Base
 * mode, groups under collapsible headers, a draft row while a new variable
 * is named, and New variable last.
 */
export const VariablesTable = ({
  collection,
  rows,
  allRows,
  collections,
  readOnly,
  canAdd,
  isSearching,
  draftType,
  bodyFont,
  selection,
  onDraftEnd,
  onNewVariable,
}: {
  collection: CollectionView;
  /** the collection's rows search keeps */
  rows: readonly VariableRow[];
  /** every collection's rows, for links */
  allRows: readonly VariableRow[];
  collections: readonly CollectionView[];
  readOnly: boolean;
  canAdd: boolean;
  isSearching: boolean;
  draftType: VariableType | undefined;
  bodyFont: StyleValue | undefined;
  selection: Selection;
  onDraftEnd: () => void;
  onNewVariable: (type: VariableType) => void;
}) => {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const tableRef = useRef<HTMLDivElement>(null);
  const segments = segmentsOf(rows);
  const isShown = (segment: Segment) =>
    segment.group === undefined || collapsed.has(segment.group) === false;
  // The shown, unlocked rows in display order: what the header checkbox and
  // a Shift range select. A collapsed group's rows are left out.
  const selectable = segments
    .filter(isShown)
    .flatMap((segment) =>
      segment.rows
        .filter((row) => row.locked === false)
        .map((row) => row.cssName)
    );
  /**
   * Stores the collection's whole display order with one segment's row moved
   * (a drag or Alt+Arrow, never while searching, so the segments are the
   * collection's), and keeps the focus on the row when asked.
   */
  const reorder = (
    segment: Segment,
    from: number,
    to: number,
    keepFocus: boolean
  ) => {
    const names = segment.rows.map((row) => row.cssName);
    const [moved] = names.splice(from, 1);
    names.splice(to, 0, moved);
    const display = segments.flatMap((item) =>
      item === segment ? names : item.rows.map((row) => row.cssName)
    );
    // Rendered at once, so the moved row can take the focus back.
    let result: ReturnType<typeof orderVariables> | undefined;
    flushSync(() => {
      result = orderVariables(collection.id, display);
    });
    if (result !== undefined && landed(result) && keepFocus) {
      tableRef.current
        ?.querySelector<HTMLElement>(
          `[data-variable-row="${CSS.escape(moved)}"]`
        )
        ?.focus();
    }
  };
  return (
    <Box
      ref={tableRef}
      role="table"
      aria-label={collection.name}
      css={{ overflowY: "auto", flexGrow: 1, minHeight: 0 }}
    >
      <Grid
        role="row"
        data-variables-header
        css={{ ...rowCss, minHeight: theme.spacing[11] }}
      >
        <Flex role="columnheader" justify="center">
          {selection.active && (
            <ManyCheckbox cssNames={selectable} selection={selection} />
          )}
        </Flex>
        <Text role="columnheader" variant="labels">
          Name
        </Text>
        <Text role="columnheader" variant="labels">
          Base mode
        </Text>
        <Box role="columnheader" />
      </Grid>
      {segments.map((segment, index) => (
        <SegmentView
          key={segment.group ?? `run-${index}`}
          segment={segment}
          allRows={allRows}
          collections={collections}
          readOnly={readOnly}
          isSearching={isSearching}
          selection={selection}
          order={selectable}
          onReorder={(from, to, keepFocus) =>
            reorder(segment, from, to, keepFocus)
          }
          isCollapsed={
            segment.group !== undefined && collapsed.has(segment.group)
          }
          onToggle={() => {
            const group = segment.group;
            if (group === undefined) {
              return;
            }
            setCollapsed((current) => {
              const next = new Set(current);
              if (next.has(group)) {
                next.delete(group);
              } else {
                next.add(group);
              }
              return next;
            });
          }}
        />
      ))}
      {draftType !== undefined && (
        <DraftRow
          key={draftType}
          type={draftType}
          collectionId={collection.id}
          bodyFont={bodyFont}
          onEnd={onDraftEnd}
        />
      )}
      {canAdd && (
        <NewVariableMenu onNewVariable={onNewVariable}>
          <Grid
            role="row"
            data-variable-new
            tabIndex={0}
            css={{ ...rowCss, cursor: "default" }}
          >
            <Flex role="cell" justify="center">
              <SmallIconButton icon={<PlusIcon />} tabIndex={-1} />
            </Flex>
            <Text role="cell" color="subtle">
              New variable
            </Text>
          </Grid>
        </NewVariableMenu>
      )}
    </Box>
  );
};
