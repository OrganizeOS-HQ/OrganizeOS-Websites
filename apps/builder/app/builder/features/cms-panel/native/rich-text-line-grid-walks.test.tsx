// T9.2 D: the nine-shape walk grid against `base-walks-nine`, its
// right-to-left copy (a snapshot of its own), and every stop of both walk
// grids and of `base-walks-rule` with the letter typed with no wait and with
// a wait (15.12).
import { describe, expect, test } from "vitest";
import {
  keys,
  letter,
  mount,
  noWait,
  recordEdit,
  short,
  waited,
} from "./rich-text-line-test-kit";
import { lastHtml } from "./rich-text-test-harness";
import {
  walkOf,
  walksRuleCells,
  type WalkCell,
} from "./rich-text-line-cells-walks-rule";
import {
  walksNineCells,
  walksNineRtlCells,
} from "./rich-text-line-cells-walks-nine";
import walksNineFixture from "./__fixtures__/rich-text-line-base-walks-nine.json";

const NINE_FIXTURE = walksNineFixture as Record<
  string,
  { write: string | null; calls: number; caret: string; typed: string }
>;

// the 18 cells of T9.2 D that differ from the head: [class, the letter typed
// at the stop, from the carry's run]
const NINE_NAMED: Record<string, readonly [string, string]> = {
  "BR-Left-2": ["D15", "<ul><li>Pw</li><li><br /><hr />k</li><li>Nw</li></ul>"],
  "BR-Right-3": [
    "D15",
    "<ul><li>Pw</li><li><br /><hr />k</li><li>Nw</li></ul>",
  ],
  "BR-Right-5": ["K8", "<ul><li>Pw</li><li><br /><hr /></li><li>kNw</li></ul>"],
  "QBR-Down-2": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /><hr /></li><li>Nw</li></ul>",
  ],
  "QBR-Up-1": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /><hr /></li><li>Nw</li></ul>",
  ],
  "QBR-Left-2": [
    "D15",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br /><hr />k</li><li>Nw</li></ul>",
  ],
  "QBR-Left-4": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /><hr /></li><li>Nw</li></ul>",
  ],
  "QBR-Right-5": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /><hr /></li><li>Nw</li></ul>",
  ],
  "HB-Down-2": [
    "a line's start",
    "<ul><li>Pw</li><li><h3>H0w</h3>k<br /></li><li>Nw</li></ul>",
  ],
  "HB-Up-2": [
    "a line's start",
    "<ul><li>Pw</li><li><h3>H0w</h3>k<br /></li><li>Nw</li></ul>",
  ],
  "HB-Left-2": [
    "a line's start",
    "<ul><li>Pw</li><li><h3>H0w</h3>k<br /></li><li>Nw</li></ul>",
  ],
  "CB-Down-2": [
    "a line's start",
    "<ul><li>Pw</li><li><pre><code>C0w</code></pre>k<br /></li><li>Nw</li></ul>",
  ],
  "CB-Up-2": [
    "a line's start",
    "<ul><li>Pw</li><li><pre><code>C0w</code></pre>k<br /></li><li>Nw</li></ul>",
  ],
  "CB-Left-2": [
    "a line's start",
    "<ul><li>Pw</li><li><pre><code>C0w</code></pre>k<br /></li><li>Nw</li></ul>",
  ],
  "QB-Down-2": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /></li><li>Nw</li></ul>",
  ],
  "QB-Up-2": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /></li><li>Nw</li></ul>",
  ],
  "QB-Left-2": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /></li><li>Nw</li></ul>",
  ],
  "QB-Right-5": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /></li><li>Nw</li></ul>",
  ],
};

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

describe("every stop with no wait equals the stop with a wait", () => {
  const typedBy = async (
    cell: WalkCell,
    run: typeof noWait | typeof waited
  ) => {
    const onChange = await mount(cell.stored);
    await cell.start();
    const presses = Array.from({ length: cell.presses }, () => keys(cell.key));
    await run(...presses, letter)();
    return short(lastHtml(onChange));
  };
  test.each([
    ["the nine-shape grid", walksNineCells],
    ["the nine-shape grid, right to left", walksNineRtlCells],
    ["base-walks-rule", walksRuleCells.filter((cell) => cell.presses <= 5)],
  ] as const)(
    "%s",
    async (_name, cells) => {
      const differ: string[] = [];
      for (const cell of cells) {
        const fast = await typedBy(cell, noWait);
        const slow = await typedBy(cell, waited);
        if (fast !== slow) {
          differ.push(`${cell.id}: ${fast} | ${slow}`);
        }
      }
      expect(differ).toEqual([]);
    },
    600_000
  );
});
