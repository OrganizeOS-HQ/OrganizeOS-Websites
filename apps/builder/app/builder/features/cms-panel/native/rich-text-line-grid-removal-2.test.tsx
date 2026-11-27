// 1,440 cells (5 edge children x 4 places x lined or ordinary x forward or backward x 18 entry points; the 40 compositions over a backward range joined with Task 20); this file runs the text and link edges (576), the first file the others (864).
// The removal class sweep (Task 13 Step 1b): what the removal took equals
// `$rangeOracle` of the range (H), no console error, each step under
// 2,000 ms; Divider over a range removes nothing (check 2, A4).
import { describe, test } from "vitest";
import {
  expectRemovalCell,
  removalCells,
} from "./rich-text-line-cells-removal";

const cells = removalCells();

describe("the removal class sweep: text or a link beside an end", () => {
  for (const cell of cells.filter((each) =>
    ["text", "link"].includes(each.edge)
  )) {
    test(cell.id, () => expectRemovalCell(cell));
  }
});
