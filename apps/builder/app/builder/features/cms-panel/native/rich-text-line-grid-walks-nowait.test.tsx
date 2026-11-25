// 15.12: every stop of both walk grids and of `base-walks-rule` with the
// letter typed with no wait equals the stop's pinned letter, which is the
// letter typed with a wait (the sample in rich-text-line-grid-walks.test.tsx).
import { describe, expect, test } from "vitest";
import { keys, letter, mount, noWait, short } from "./rich-text-line-test-kit";
import { lastHtml } from "./rich-text-test-harness";
import {
  RULE_NAMED,
  walksRuleCells,
  type WalkCell,
} from "./rich-text-line-cells-walks-rule";
import {
  NINE_NAMED,
  walksNineCells,
  walksNineRtlCells,
} from "./rich-text-line-cells-walks-nine";
import walksNineFixture from "./__fixtures__/rich-text-line-base-walks-nine.json";
import walksRuleFixture from "./__fixtures__/rich-text-line-base-walks-rule.json";
import walksNineRtl from "./__snapshots__/rich-text-line-grid-walks-rtl.json";

type Cell = { typed: string };
const NINE = walksNineFixture as Record<string, Cell>;
const RULE = walksRuleFixture as Record<string, Cell>;
const RTL = walksNineRtl as Record<string, Cell>;

const ruleTyped = (cell: WalkCell) => {
  const named = RULE_NAMED[cell.id];
  if (typeof named === "object") {
    return named.typed;
  }
  return named === "shorter"
    ? RULE[`${cell.id.replace(/-\d+$/, "")}-${cell.presses + 1}`].typed
    : RULE[cell.id].typed;
};

describe("every stop with no wait equals the stop with a wait", () => {
  test.each([
    [
      "the nine-shape grid",
      walksNineCells,
      (cell: WalkCell) => NINE_NAMED[cell.id]?.[1] ?? NINE[cell.id].typed,
    ],
    [
      "the nine-shape grid, right to left",
      walksNineRtlCells,
      (cell: WalkCell) => RTL[cell.id].typed,
    ],
    [
      "base-walks-rule",
      walksRuleCells.filter((cell) => cell.presses <= 5),
      ruleTyped,
    ],
  ] as const)(
    "%s",
    async (_name, cells, pinned) => {
      const differ: string[] = [];
      for (const cell of cells) {
        const onChange = await mount(cell.stored);
        await cell.start();
        const presses = Array.from({ length: cell.presses }, () =>
          keys(cell.key)
        );
        await noWait(...presses, letter)();
        const fast = short(lastHtml(onChange));
        if (fast !== pinned(cell)) {
          differ.push(`${cell.id}: ${fast} | ${pinned(cell)}`);
        }
      }
      expect(differ).toEqual([]);
    },
    300_000
  );
});
