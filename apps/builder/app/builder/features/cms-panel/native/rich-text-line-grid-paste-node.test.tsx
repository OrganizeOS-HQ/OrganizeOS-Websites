// The node-selection paste grid (check 3, 14.8; T10.8; D15): the 213 cells
// of `base-paste-node`, recorded at `<base>` (126 of them run away there:
// `failed: runaway`). Every cell finishes under 2,000 ms on the branch.
// - In an item that starts with a block, an HTML or own-node paste runs at
//   the caret D18 gives the point directly after the last selected rule,
//   and the selected rules then go (D15, 5.4): its write is that paste's
//   write with the selected rules taken out (P16-4).
// - A plain-text paste replaces the rule as an HTML paste does (C15): the
//   same, in every item; the head writes nothing there.
// - Every other cell (an HTML paste in the line-led item XRY) equals its
//   fixture cell, the empty-paragraph cells where the head splits the list
//   included.
import { describe, expect, test } from "vitest";
import { recordEdit } from "./rich-text-line-test-kit";
import {
  pasteNodeCells,
  type PasteNodeCell,
  withoutSelectedRules,
} from "./rich-text-line-cells-paste-node";
import pasteNodeJson from "./__fixtures__/rich-text-line-base-paste-node.json";

type Recorded =
  | { write: string | null; calls: number; caret: string; typed?: string }
  | { failed: string };
const fixture = pasteNodeJson as Record<string, Recorded>;

const P16_3_SHAPES = new Set([
  "QR",
  "QQR",
  "QRL",
  "QRR",
  "QRd2",
  "QRol",
  "RQR",
]);

const isPlain = (cell: PasteNodeCell) =>
  cell.kind === "plain" || cell.kind === "plain2";

describe("14.8: a paste with a rule node-selected in a lined item", () => {
  test("the fixture holds every cell", () => {
    expect(Object.keys(fixture).sort()).toEqual(
      pasteNodeCells.map((cell) => cell.id).sort()
    );
  });

  for (const cell of pasteNodeCells) {
    const atCaret = cell.blockLed || isPlain(cell);
    const name = isPlain(cell)
      ? `${cell.id} (C15: the head writes nothing)`
      : cell.id;
    test(name, async () => {
      const record = await recordEdit(
        { stored: cell.stored, place: cell.place, action: cell.action },
        { short: true }
      );
      expect(record.errors, "console errors").toEqual([]);
      expect(record.slowest, "slowest step in ms").toBeLessThan(2000);
      const base = fixture[cell.id];
      if (atCaret) {
        // one edit, whatever the paste inserts there (an empty paragraph
        // inserts nothing)
        const atPoint = await recordEdit(cell.atPoint, { short: true });
        expect(record.calls, "calls").toBe(1);
        expect(record.write, "the paste at D18's caret, the rule removed").toBe(
          withoutSelectedRules(atPoint.write ?? atPoint.htmlBefore, cell.rules)
        );
        // where the caret goes when nothing is inserted and the rule goes
        // is no rule's in the shapes where the rule ends the item or stands
        // before a list or another rule (P16-3)
        if (!(cell.kind === "emptyP" && P16_3_SHAPES.has(cell.shape))) {
          expect(record.typed, "the letter after it").toBe(
            withoutSelectedRules(atPoint.typed ?? "", cell.rules)
          );
        }
        if (isPlain(cell) && "failed" in base === false) {
          expect(base.calls, "the head writes nothing").toBe(0);
        }
        return;
      }
      expect("failed" in base, "the head's cell finished").toBe(false);
      const { write, calls, typed } = base as Exclude<
        Recorded,
        { failed: string }
      >;
      expect(
        JSON.stringify({
          write: record.write,
          calls: record.calls,
          typed: record.typed,
        }),
        "the head's write"
      ).toBe(JSON.stringify({ write, calls, typed }));
    });
  }
});
