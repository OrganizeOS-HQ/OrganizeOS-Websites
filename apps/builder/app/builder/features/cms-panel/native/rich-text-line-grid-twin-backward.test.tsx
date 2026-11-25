// The backward image twin grid (Task 14 Step 1b; check 3, round 14): a
// caret just before an image that starts its block or line is that
// block's or line's start; Backspace, Ctrl+Backspace and the line form
// there write what the twin, a word in the image's place, writes. 126
// cells, each run with its twin.
import { describe, test } from "vitest";
import { backwardImageCells, expectTwin } from "./rich-text-line-cells-twin";

describe("a caret just before an image that starts its block or line is its start", () => {
  for (const cell of backwardImageCells()) {
    test(cell.name, () => expectTwin(cell));
  }
});
