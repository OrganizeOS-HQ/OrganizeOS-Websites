// Spec 5.3's point grid (Task 22): the 23 element points of TR, RT, QR, RQ,
// TRT, QRQ and RR, each placed by its baseline offset (`itemPoint`), by the
// 30 commands: 690 cells. Each cell's write, onChange count, caret and the
// letter after it, and each point's caret right after its place, are in the
// file snapshot.
// D13 (T71.2): Bulleted list at QR@2, RQ@0, RR@0, RR@1, RR@2 and RT@0, the
// empty caret lines beside rules, keeps the caret where its line was (before
// the leading rule, between the rules, after the final rule), not the head's.
import { describe, expect, test } from "vitest";
import { gridTests, pointCells } from "./rich-text-line-cells-grids";

const cells = pointCells();

describe("5.3: the element points by every command", () => {
  test("the file holds 690 cells", () => {
    expect(cells).toHaveLength(690);
  });
  gridTests(cells, "./__snapshots__/rich-text-line-grid-points.json", {
    placed: true,
  });
});
