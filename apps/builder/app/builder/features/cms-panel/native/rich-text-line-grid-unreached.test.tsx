// The unreached grid (Task 22): Task 5's inputs outside every record set
// (an ordered list, depths 2, 6 and 7, a mixed container in a mixed
// container, a heading in a quote in an item, an item whose run is only a
// link or only an image), each shape at a text caret in the line and at the
// element point beside the block, by the 30 commands, Heading 3 and
// Heading 4: 576 cells, in the file snapshot.
import { describe, expect, test } from "vitest";
import { gridTests, unreachedCells } from "./rich-text-line-cells-grids";

const cells = unreachedCells();

describe("inputs outside every record set, by every command", () => {
  test("the file holds 576 cells", () => {
    expect(cells).toHaveLength(576);
  });
  gridTests(cells, "./__snapshots__/rich-text-line-grid-unreached.json");
});
