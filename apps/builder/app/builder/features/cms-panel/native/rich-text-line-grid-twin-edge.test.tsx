// The edge-child twin grid (Task 14 Step 1b; check 3, round 14): a line
// break or a link at a block's or line's edge, the caret outside the link
// or inside its text at the edge; each cell writes what its twin, a word
// in the child's place, writes. 744 cells, each run with its twin.
import { describe, test } from "vitest";
import { edgeCells, expectTwin } from "./rich-text-line-cells-twin";

describe("edge children write as their twins", () => {
  for (const cell of edgeCells()) {
    test(cell.name, () => expectTwin(cell));
  }
});
