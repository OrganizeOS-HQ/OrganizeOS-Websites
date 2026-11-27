// 726 cells of `base-1510`'s 2,082 (1,920 generated, 162 named): the nine shapes with a list before the rule.
// Task 13 Step 1b (T12.4, T12.8, T14.9, T15.3): the checks are
// `rich-text-line-cells-1510-checks.ts`'s.
import { describe, expect, test } from "vitest";
import { cells1510, type Fixture1510 } from "./rich-text-line-cells-1510";
import { gridTests1510 } from "./rich-text-line-cells-1510-checks";
import fixture1510Json from "./__fixtures__/rich-text-line-base-1510.json";

const fixture = fixture1510Json as Fixture1510;
const cells = cells1510().filter((cell) => cell.shape.block === "list");

describe("15.10: the first press past a nested block's end, a list", () => {
  test("the file holds 726 cells", () => {
    expect(cells).toHaveLength(726);
  });
  gridTests1510(
    cells,
    fixture,
    "./__snapshots__/rich-text-line-grid-1510-list.json"
  );
});
