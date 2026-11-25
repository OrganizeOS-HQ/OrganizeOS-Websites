// 1,400 cells (5 edge children x 4 places x lined or ordinary x forward or backward x 18 entry points, less the 40 compositions over a backward range, Task 20's); this file runs the image, line break and inline code edges (840), `-2` the text and link edges (560).
// The removal class sweep (Task 13 Step 1b): what the removal took equals
// `$rangeOracle` of the range (H), no console error, each step under
// 2,000 ms; Divider over a range removes nothing (check 2, A4).
import { describe, expect, test } from "vitest";
import {
  expectRemovalCell,
  removalCells,
} from "./rich-text-line-cells-removal";

const cells = removalCells();

describe("the removal class sweep: an image, a line break or inline code beside an end", () => {
  test("the table holds 1,400 cells", () => {
    expect(cells).toHaveLength(1400);
  });
  for (const cell of cells.filter((each) =>
    ["image", "line break", "inline code"].includes(each.edge)
  )) {
    test(cell.id, () => expectRemovalCell(cell));
  }
});
