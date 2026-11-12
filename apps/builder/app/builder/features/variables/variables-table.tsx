import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Box,
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
import { createVariable, reorderVariable } from "./operations";
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
  readOnly,
  showLeaf,
  canDrag,
  onMove,
}: {
  row: VariableRow;
  rows: readonly VariableRow[];
  readOnly: boolean;
  showLeaf: boolean;
  canDrag: boolean;
  onMove: (direction: -1 | 1) => void;
}) => {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    if (event.altKey) {
      onMove(direction);
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
        {canDrag && (
          <DragHandleIcon
            data-id={row.cssName}
            color={cssVar("--foreground-secondary")}
            style={{ cursor: "grab" }}
          />
        )}
      </Flex>
      <Box role="cell" css={{ minWidth: 0 }}>
        <NameCell row={row} readOnly={readOnly} showLeaf={showLeaf} />
      </Box>
      <Box role="cell" css={{ minWidth: 0 }}>
        <ValueCell row={row} rows={rows} readOnly={readOnly} />
      </Box>
      <Box role="cell" />
    </Grid>
  );
};

const SegmentView = ({
  segment,
  collectionRows,
  allRows,
  readOnly,
  isSearching,
  isCollapsed,
  onToggle,
}: {
  segment: Segment;
  collectionRows: readonly VariableRow[];
  allRows: readonly VariableRow[];
  readOnly: boolean;
  isSearching: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
}) => {
  const canDrag = readOnly === false && isSearching === false;
  const items = segment.rows.map((row) => ({ id: row.cssName }));
  /** The collection-rows index the contract's reorder takes. */
  const rowsIndexOf = (row: VariableRow | undefined) =>
    row === undefined ? collectionRows.length : collectionRows.indexOf(row);
  const { placementIndicator, sortableRefCallback } = useSortable({
    items,
    onSort: (newIndex, oldIndex) => {
      if (canDrag) {
        reorderVariable(
          segment.rows[oldIndex].cssName,
          rowsIndexOf(segment.rows[newIndex])
        );
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
            {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
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
              readOnly={readOnly}
              showLeaf={segment.group !== undefined}
              canDrag={canDrag && row.locked === false}
              onMove={(direction) => {
                const target = segment.rows[index + direction];
                if (readOnly === false && target !== undefined) {
                  reorderVariable(row.cssName, rowsIndexOf(target));
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
  readOnly,
  canAdd,
  isSearching,
  draftType,
  bodyFont,
  onDraftEnd,
  onNewVariable,
}: {
  collection: CollectionView;
  /** the collection's rows search keeps */
  rows: readonly VariableRow[];
  /** every collection's rows, for links */
  allRows: readonly VariableRow[];
  readOnly: boolean;
  canAdd: boolean;
  isSearching: boolean;
  draftType: VariableType | undefined;
  bodyFont: StyleValue | undefined;
  onDraftEnd: () => void;
  onNewVariable: (type: VariableType) => void;
}) => {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  return (
    <Box
      role="table"
      aria-label={collection.name}
      css={{ overflowY: "auto", flexGrow: 1, minHeight: 0 }}
    >
      <Grid role="row" css={{ ...rowCss, minHeight: theme.spacing[11] }}>
        <Box role="columnheader" />
        <Text role="columnheader" variant="labels">
          Name
        </Text>
        <Text role="columnheader" variant="labels">
          Base mode
        </Text>
        <Box role="columnheader" />
      </Grid>
      {segmentsOf(rows).map((segment, index) => (
        <SegmentView
          key={segment.group ?? `run-${index}`}
          segment={segment}
          collectionRows={collection.rows}
          allRows={allRows}
          readOnly={readOnly}
          isSearching={isSearching}
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
