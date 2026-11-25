// 598 cells: `base-1510-mirror` whole (512: 16 shapes, a real click at Nw@0, 0 to 3 presses of Shift+ArrowLeft, eight actions), and Shift+Enter and Image over each of the 43 ranges the walk leaves at the head (86).
// Task 13 Step 1b (T12.4, T12.8, T14.9, T15.3): the checks are
// `rich-text-line-cells-1510-checks.ts`'s.
import { describe, expect, test } from "vitest";
import {
  cells1510Mirror,
  cells1510MirrorKeys,
  type Fixture1510,
} from "./rich-text-line-cells-1510";
import { gridTests1510 } from "./rich-text-line-cells-1510-checks";
import fixtureMirrorJson from "./__fixtures__/rich-text-line-base-1510-mirror.json";

const fixture = fixtureMirrorJson as Fixture1510;
const cells = cells1510Mirror();

describe("15.10's mirror", () => {
  const keys = cells1510MirrorKeys(fixture);
  test("the file holds 512 cells and 86 of Shift+Enter and Image", () => {
    expect(cells).toHaveLength(512);
    expect(keys).toHaveLength(86);
  });
  gridTests1510(
    cells,
    fixture,
    "./__snapshots__/rich-text-line-grid-1510-mirror.json",
    { extra: keys }
  );
});
