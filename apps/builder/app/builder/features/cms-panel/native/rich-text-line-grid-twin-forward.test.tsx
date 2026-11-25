// The forward image twin grid (Task 14 Step 1b; check 3, round 14): a caret
// just after an image that ends its block or line is that block's or
// line's end; Delete, Ctrl+Delete and the line form there write what the
// twin, a word in the image's place, writes (a forward delete never
// removes the image). 153 cells, each run with its twin.
import { describe, test } from "vitest";
import { expectTwin, forwardImageCells } from "./rich-text-line-cells-twin";

describe("a caret just after an image that ends its block or line is its end", () => {
  for (const cell of forwardImageCells()) {
    test(cell.name, () => expectTwin(cell));
  }
});
