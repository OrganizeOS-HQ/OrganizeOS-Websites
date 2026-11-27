// The checks of the 15.10 grids (Task 13 Step 1b; T12.4, T12.8, T14.9,
// T15.3), shared by their files. Every cell whose selection is a range
// checks that what the removal took is what the range held (H) and that
// its write follows the rule. To the right (`base-1510`): a cell whose
// focus the head's presses leave on the root directly after the nested
// block holds what the same range ending at the block's content end holds,
// so it writes what the same input one press earlier writes (a delete or a
// cut over what is then a caret removes nothing and adds no undo step; a
// copy leaves the clipboard as it was, T11.5); a copy's three formats equal
// the copy one press earlier. Every other range cell, on either side, is
// the removal, then the key: each key writes what it writes after
// Backspace over the range, a delete and a cut write Backspace's write, and
// a cut's clipboard is the copy's. A cell whose write follows no named rule
// is a P record, not a pin. Every cell then equals its
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
  expect(after.length >= head.length + tail.length, after).toBe(true);
  const put = after.slice(head.length, after.length - tail.length);
  expect(put, "what the action put in").toBe(PUT_1510[cell.action]);
};

/**
 * Each key over a range is the removal, then the key at the caret it leaves
 * (5.4; 16.8, T11.4): a delete of any form and a cut write what Backspace
 * over the range writes, a cut's clipboard is the copy's, and every other
 * key writes what it writes after Backspace over the range (the oracle,
 * run here).
 */
const expectKeyOverRange = async (
  record: Record1510,
  cell: Cell1510,
  results: Map<string, Record1510>
) => {
  if (REMOVES.has(cell.action)) {
    if (cell.action !== "bs") {
      const backspace = results.get(withAction(cell, "bs"));
      expect(backspace, "Backspace over the range ran first").toBeDefined();
      expect(record.write, "Backspace's write over the range").toBe(
        backspace!.write
      );
    }
    return;
  }
  if (cell.action === "copy") {
    const cutCell = results.get(withAction(cell, "cut"));
    expect(cutCell, "the cut over the range ran first").toBeDefined();
    expectSameClip(cutCell!, record, "a cut's clipboard is the copy's");
    return;
  }
  const after = await runCell1510(cell, { first: keys("{Backspace}") });
  expectClean(after);
  // the values both leave: a key that leaves the value as it stood
  // hands out nothing (16.10)
  expect(record.value, "the key after Backspace over the range").toBe(
    after.value
  );
};

/**
 * Registers one test per cell, in the table's order (a cell's earlier
 * press and its other actions run before it), and a last test that matches
 * the names of the cells that differ from the head's against `snapshot`.
 * Every cell whose selection is a range checks what its removal took and
 * its write against the rule (15.10's earlier press where 15.10 rules the
 * cell, else the removal then the key), whatever name its difference from
 * the head's cell then gets. A cell in `extra` (the mirror's
 * Shift+Enter and Image) has no fixture cell and is checked by the rule
 * only.
 */
export const gridTests1510 = (
  cells: Cell1510[],
  fixture: Fixture1510,
  snapshot: string,
  { extra = [] }: { extra?: Cell1510[] } = {}
) => {
  const results = new Map<string, Record1510>();
  const named: Record<string, string> = {};
  for (const cell of [...cells, ...extra]) {
    test(cell.id, async () => {
      const record = await runCell1510(cell, {
        depth: undoDepth,
        oracle: true,
      });
      results.set(cell.id, record);
      expectClean(record);
      const range = isCaret(record.before) === false;
      if (range) {
        expectTakesRange(record, cell);
      }
      const head = fixture[cell.id];
      if (cell.side === "R" && isRuled1510(cell, fixture)) {
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
      if (range) {
        await expectKeyOverRange(record, cell, results);
      }
      if (extra.includes(cell)) {
        expect(range, "the walk leaves a range").toBe(true);
        return;
      }
      expect(head, "the fixture cell").toBeDefined();
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
