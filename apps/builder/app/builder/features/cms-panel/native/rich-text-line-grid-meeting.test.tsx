// Spec 5.3's meeting grid (Task 22): the 11 points where a line and a block
// meet (M31's 10 and BQ el1), each placed at its element point, by the 30
// commands: 330 cells. QB el1's letter is D18 step 1's: it lands at the
// line's start, not at the quote's end. Each cell's write, onChange count,
// caret and the letter after it, and each point's caret right after its
// place, are in the file snapshot.
import { describe, expect, test } from "vitest";
import { gridTests, meetingCells } from "./rich-text-line-cells-grids";

const cells = meetingCells();

describe("5.3: the points where a line and a block meet, by every command", () => {
  test("the file holds 330 cells", () => {
    expect(cells).toHaveLength(330);
  });
  gridTests(cells, "./__snapshots__/rich-text-line-grid-meeting.json", {
    placed: true,
  });
});
