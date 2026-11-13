import type { VariableRow } from "./reader";

/** A group's rows, or a run of rows with no group, in collection order. */
export type Segment = { group?: string; rows: VariableRow[] };

/** The manager's and the bind picker's grouping: each group once, where it first appears. */
export const segmentsOf = (rows: readonly VariableRow[]) => {
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
