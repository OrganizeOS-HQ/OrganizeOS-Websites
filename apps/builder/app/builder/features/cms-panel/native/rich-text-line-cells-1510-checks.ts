// The checks of the 15.10 grids (Task 13 Step 1b; T12.4, T12.8, T14.9,
// T15.3), shared by their files. To the right (`base-1510`): a cell whose
// focus the head's presses leave on the root directly after the nested block
// holds what the same range ending at the block's content end holds, so it
// writes what the same input one press earlier writes (a delete or a cut
// over what is then a caret removes nothing and adds no undo step; a copy
// leaves the clipboard as it was, T11.5); a copy's three formats equal the
// copy one press earlier. The mirror (`base-1510-mirror`): over every range
// the walk leaves, what the removal takes equals `$rangeOracle` of the
// range, each key writes what the same key writes after Backspace over the
// range, and a cut's clipboard is the copy's. Every other cell equals its
// fixture cell or is named by `differenceOf`; the names are a file snapshot.
import { expect, test } from "vitest";
import { keys } from "./rich-text-line-test-kit";
import { undoDepth } from "./rich-text-line-test-kit-branch";
import {
  differenceOf,
  earlierId,
  isRuled1510,
  PUT_1510,
  runCell1510,
  sameAsFixture,
  withAction,
  type Cell1510,
  type Fixture1510,
  type Record1510,
} from "./rich-text-line-cells-1510";

const REMOVES = new Set(["bs", "del", "cut", "wordB", "wordF"]);
const isCaret = (before: string) => before.includes("|") === false;

const expectClean = (record: Record1510) => {
  expect(record.errors, "console errors and throws").toEqual([]);
  expect(record.ms, "the step in ms").toBeLessThan(2000);
};

/** The same clipboard in all three formats. */
const expectSameClip = (
  record: Record1510,
  other: Record1510,
  what: string
) => {
  expect(record.clip?.html ?? null, `${what}: text/html`).toBe(
    other.clip?.html ?? null
  );
  expect(record.clip?.plain ?? null, `${what}: text/plain`).toBe(
    other.clip?.plain ?? null
  );
  expect(record.clip?.lexical ?? null, `${what}: the editor data`).toBe(
    other.clip?.lexical ?? null
  );
};

/** What the removal took is what the range held (H), and the action put in its own. */
const expectTakesRange = (record: Record1510, cell: Cell1510) => {
  const { before, start, end, after } = record.tokens!;
  if (start === end) {
    return;
  }
  if (cell.action === "copy") {
    expect(after, "a copy removes nothing").toBe(before);
    return;
  }
  const head = before.slice(0, start);
  const tail = before.slice(end);
  expect(after.startsWith(head), `kept before the range: ${after}`).toBe(true);
  expect(after.endsWith(tail), `kept after the range: ${after}`).toBe(true);
  const put = after.slice(head.length, after.length - tail.length);
  expect(put.replace(/↵/g, ""), "what the action put in").toBe(
    PUT_1510[cell.action].replace(/↵/g, "")
  );
};

/**
 * Registers one test per cell, in the table's order (a cell's earlier
 * press and its other actions run before it), and a last test that matches
 * the names of the cells that differ from the head's against `snapshot`.
 */
export const gridTests1510 = (
  cells: Cell1510[],
  fixture: Fixture1510,
  snapshot: string
) => {
  const results = new Map<string, Record1510>();
  const named: Record<string, string> = {};
  for (const cell of cells) {
    test(cell.id, async () => {
      const mirror = cell.side === "L";
      const record = await runCell1510(cell, {
        depth: undoDepth,
        oracle: mirror,
      });
      results.set(cell.id, record);
      expectClean(record);
      const head = fixture[cell.id];
      expect(head, "the fixture cell").toBeDefined();
      if (mirror === false && isRuled1510(cell, fixture)) {
        named[cell.id] =
          "15.10: the range holds what it holds one press earlier";
        const earlier = results.get(earlierId(cell));
        expect(earlier, "the cell one press earlier ran first").toBeDefined();
        if (isCaret(earlier!.before) && REMOVES.has(cell.action)) {
          expect(record.calls, "nothing removed: no onChange").toBe(0);
          expect(record.undoAdded, "no undo step").toBe(false);
          if (cell.action === "cut") {
            expect(record.clip?.html ?? null, "the clipboard as it was").toBe(
              null
            );
          }
          return;
        }
        if (isCaret(earlier!.before) && cell.action === "copy") {
          expect(record.clip?.html ?? null, "the clipboard as it was").toBe(
            null
          );
          return;
        }
        expect(record.write, "the write one press earlier").toBe(
          earlier!.write
        );
        expect(record.calls, "the onChange count one press earlier").toBe(
          earlier!.calls
        );
        if (record.clip !== undefined) {
          expectSameClip(record, earlier!, "the clipboard one press earlier");
        }
        return;
      }
      if (mirror && isCaret(record.before) === false) {
        expectTakesRange(record, cell);
        if (cell.action === "del" || cell.action === "cut") {
          const backspace = results.get(withAction(cell, "bs"));
          expect(record.write, "Backspace's write over the range").toBe(
            backspace!.write
          );
        } else if (cell.action === "copy") {
          const cutCell = results.get(withAction(cell, "cut"));
          expectSameClip(cutCell!, record, "a cut's clipboard is the copy's");
        } else if (cell.action !== "bs") {
          const after = await runCell1510(cell, {
            first: keys("{Backspace}"),
          });
          expectClean(after);
          expect(record.write, "the key after Backspace over the range").toBe(
            after.write
          );
        }
      }
      if (sameAsFixture(record, head) === false) {
        const name = differenceOf(record, head);
        expect(
          name,
          `a difference from the head's cell no class names: ${JSON.stringify({ head, record: { ...record, clip: { ...record.clip, lexical: undefined }, tokens: undefined } })}`
        ).not.toBeNull();
        named[cell.id] = name!;
      }
    });
  }
  test("the cells that differ from the head's, by name", async () => {
    expect(Object.keys(named).length).toBeGreaterThan(0);
    await expect(`${JSON.stringify(named, null, 2)}\n`).toMatchFileSnapshot(
      snapshot
    );
  });
};
