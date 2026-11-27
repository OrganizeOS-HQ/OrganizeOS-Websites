// T9.2 D: the nine-shape walk grid against `base-walks-nine` and its
// right-to-left copy (a snapshot of its own).
import { describe, expect, test } from "vitest";
import {
  keys,
  letter,
  mount,
  recordEdit,
  short,
  waited,
} from "./rich-text-line-test-kit";
import { lastHtml } from "./rich-text-test-harness";
import { walkOf, type WalkCell } from "./rich-text-line-cells-walks-rule";
import {
  NINE_NAMED,
  walksNineCells,
  walksNineRtlCells,
} from "./rich-text-line-cells-walks-nine";
import walksNineFixture from "./__fixtures__/rich-text-line-base-walks-nine.json";

const NINE_FIXTURE = walksNineFixture as Record<
  string,
  { write: string | null; calls: number; caret: string; typed: string }
>;

const record = async (cell: WalkCell) => {
  const { write, calls, caret, typed, errors, slowest } = await recordEdit(
    { stored: cell.stored, place: cell.start, action: walkOf(cell) },
    { short: true }
  );
  expect(errors).toEqual([]);
  expect(slowest).toBeLessThan(2000);
  return { write, calls, caret, typed };
};

describe("D: the nine-shape walk grid", () => {
  test("126 cells equal the head's, 18 are named", () => {
    expect(walksNineCells).toHaveLength(144);
    expect(Object.keys(NINE_NAMED)).toHaveLength(18);
    const classes = Object.values(NINE_NAMED).map(([name]) => name);
    expect(classes.filter((name) => name === "a line's start")).toHaveLength(
      14
    );
    expect(classes.filter((name) => name === "D15")).toHaveLength(3);
    expect(classes.filter((name) => name === "K8")).toHaveLength(1);
  });

  // a line's start (D18 step 1): the letter lands at the start of the line
  // after the block, where the head's lands at the block's text end; D15:
  // after a node-selected rule the letter lands after the rule, where the
  // head's lands at the start of `Pw`; K8: the head's walk cycles back to
  // the line, the build's has gone on into the next item
  test.each(walksNineCells)("D $id presses, then a letter", async (cell) => {
    const got = await record(cell);
    const named = NINE_NAMED[cell.id];
    if (named === undefined) {
      expect(got).toEqual(NINE_FIXTURE[cell.id]);
    } else {
      expect({ write: got.write, calls: got.calls, typed: got.typed }).toEqual({
        write: null,
        calls: 0,
        typed: named[1],
      });
      expect(got.typed).not.toBe(NINE_FIXTURE[cell.id].typed);
    }
  });
});

describe("the nine-shape walk grid, right to left", () => {
  test("the 144 cells", async () => {
    const cells: Record<string, unknown> = {};
    for (const cell of walksNineRtlCells) {
      cells[cell.id] = await record(cell);
    }
    await expect(JSON.stringify(cells, null, 2) + "\n").toMatchFileSnapshot(
      "./__snapshots__/rich-text-line-grid-walks-rtl.json"
    );
  }, 300_000);
});

// the no-wait cells (rich-text-line-grid-walks-nowait.test.tsx) compare
// with the pinned values: a sample shows that a cell's pinned letter is the
// letter typed with a wait (settle and 150 ms after each key)
test("a cell's pinned letter is its letter with a wait: every twelfth cell", async () => {
  const differ: string[] = [];
  for (const cell of walksNineCells.filter((_, index) => index % 12 === 0)) {
    const onChange = await mount(cell.stored);
    await cell.start();
    const presses = Array.from({ length: cell.presses }, () => keys(cell.key));
    await waited(...presses, letter)();
    const pinned = NINE_NAMED[cell.id]?.[1] ?? NINE_FIXTURE[cell.id].typed;
    if (short(lastHtml(onChange)) !== pinned) {
      differ.push(cell.id);
    }
  }
  expect(differ).toEqual([]);
}, 120_000);
