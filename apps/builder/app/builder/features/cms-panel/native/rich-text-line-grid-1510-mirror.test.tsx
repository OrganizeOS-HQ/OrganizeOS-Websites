// 512 cells: `base-1510-mirror` whole (16 shapes, a real click at Nw@0, 0 to 3 presses of Shift+ArrowLeft, eight actions).
// Task 13 Step 1b (T12.4, T12.8, T14.9, T15.3): the checks are
// `rich-text-line-cells-1510-checks.ts`'s.
import { describe, expect, test } from "vitest";
import { cells1510Mirror, type Fixture1510 } from "./rich-text-line-cells-1510";
import { gridTests1510 } from "./rich-text-line-cells-1510-checks";
import fixtureMirrorJson from "./__fixtures__/rich-text-line-base-1510-mirror.json";

const fixture = fixtureMirrorJson as Fixture1510;
const cells = cells1510Mirror();

describe("15.10's mirror", () => {
  test("the file holds 512 cells", () => {
    expect(cells).toHaveLength(512);
  });
  gridTests1510(
    cells,
    fixture,
    "./__snapshots__/rich-text-line-grid-1510-mirror.json"
  );
});
