// The node-selection grid (Task 22): a rule in TRT and in TR, an image in
// QI and in TQI, each selected by code (`nodeSelect`) and for real (an
// arrow onto the rule; a click on the image, then Escape), by the 30
// commands, a pasted rule and a pasted file: 256 cells, in the file
// snapshot.
import { describe, expect, test } from "vitest";
import { gridTests, nodeCells } from "./rich-text-line-cells-grids";

const cells = nodeCells();

describe("the node selections by every command", () => {
  test("the file holds 256 cells", () => {
    expect(cells).toHaveLength(256);
  });
  gridTests(cells, "./__snapshots__/rich-text-line-grid-node.json");
});
