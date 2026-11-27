// Enter in a heading (T10.4; check 3, round 14), the twin oracle: Enter and
// Shift+Enter beside an image, a link or a line break at a heading's, a
// quote paragraph's and a line's end and start (108 cells); Enter in a
// heading's middle after an image or a link, placed by structure, by a
// click and by a click and an arrow (18 cells); each cell writes what its
// twin, the word Ew in the child's place, writes, and a letter after it
// lands as after the twin. The 12 over-reach cells, where Lexical reads
// the caret right, equal the same cells recorded at <base>
// (`base-enter-heading`), except where a ruling changes the item's line
// (K18, P24). From `rich-text-line-enter.test.tsx` at `451f20f04`.
import { describe, expect, test } from "vitest";
import {
  beside,
  enter,
  type EditRecord,
  recordEdit,
  shiftEnter,
  type Step,
} from "./rich-text-line-test-kit";
import { cell, MARK, type TwinCell } from "./rich-text-line-cells-twin";
import {
  enterHeadingPlainCells,
  headingShape,
  inText,
} from "./rich-text-line-cells-enter";
import enterHeadingJson from "./__fixtures__/rich-text-line-base-enter-heading.json";

const CONTEXTS = ["blockLed", "lineLed", "ordinary"] as const;
const LI = (x: string) => `<ul><li>Pw</li><li>${x}</li><li>Nw</li></ul>`;

/** The prototype's shapes: `x` in a heading, a quote's paragraph or a line. */
const shape = (context: string, block: string, x: string) => {
  if (context === "ordinary") {
    const b =
      block === "heading"
        ? `<h3>${x}</h3>`
        : block === "quote"
          ? `<blockquote><p>${x}</p></blockquote>`
          : `<p>${x}</p>`;
    return `<p>T0w</p>${b}<p>T1w</p>`;
  }
  const lead = context === "lineLed" ? "T9w" : "";
  if (block === "line") {
    return LI(
      `${lead}<blockquote><p>Q0w</p></blockquote>${x}<blockquote><p>B1w</p></blockquote>`
    );
  }
  const b =
    block === "heading"
      ? `<h3>${x}</h3>`
      : `<blockquote><p>${x}</p></blockquote>`;
  return LI(`${lead}${b}T1w`);
};

const CHILDREN = {
  image: { edge: "img", type: "cms-image" },
  link: { edge: "a-outside", type: "link" },
  br: { edge: "br", type: "linebreak" },
} as const;

const KEYS: Record<string, Step> = { enter, shiftEnter };

const edgeCells = (): TwinCell[] =>
  (["br", "image", "link"] as const).flatMap((child) =>
    (["end", "start"] as const).flatMap((pos) =>
      CONTEXTS.flatMap((context) =>
        (["heading", "line", "quote"] as const).flatMap((block) =>
          Object.entries(KEYS).map(([key, action]) =>
            cell(
              `${child} ${pos} ${context} ${block} ${key}`,
              shape(
                context,
                block,
                pos === "end" ? `X0w${MARK}` : `${MARK}X0w`
              ),
              CHILDREN[child].edge,
              pos === "end" ? "fwd" : "back",
              beside(CHILDREN[child].type, pos === "end" ? "after" : "before"),
              action
            )
          )
        )
      )
    )
  );

const middleCells = (): TwinCell[] =>
  (["image", "link"] as const).flatMap((child) =>
    CONTEXTS.flatMap((context) =>
      (["arrow", "click", "structure"] as const).map((how) =>
        cell(
          `${child} ${context} ${how}`,
          headingShape(context, `Aw${MARK}Bw`),
          CHILDREN[child].edge,
          "fwd",
          inText("Bw", 0, how),
          enter
        )
      )
    )
  );

/**
 * Runs the cell and its twin (`recordEdit`'s short form: the key, then a
 * letter) and checks the cell writes the twin's write, and the twin's
 * letter, with the child put back.
 */
const expectTwinWithLetter = async (twinCell: TwinCell) => {
  expect(twinCell.twin, "twinOf names the child").toBe(
    twinCell.marked.replace(MARK, "Ew")
  );
  const putBack = (value: string | null | undefined) =>
    value?.replaceAll("Ew", twinCell.putBack) ?? null;
  const writeOf = (record: EditRecord) =>
    record.write === record.htmlBefore ? null : record.write;
  const twin = await recordEdit(
    {
      stored: twinCell.twin,
      place: twinCell.twinPlace,
      action: twinCell.action,
    },
    { short: true }
  );
  const edge = await recordEdit(
    { stored: twinCell.stored, place: twinCell.place, action: twinCell.action },
    { short: true }
  );
  expect(writeOf(edge), "the twin's write with the child put back").toBe(
    putBack(writeOf(twin))
  );
  expect(edge.typed, "the twin's letter with the child put back").toBe(
    putBack(twin.typed)
  );
  expect(edge.errors, "console errors").toEqual([]);
  expect(twin.slowest, "the twin's slowest step").toBeLessThan(2000);
  expect(edge.slowest, "the slowest step").toBeLessThan(2000);
};

describe("Enter and Shift+Enter beside a non-text child at a block's edge write as the twin", () => {
  for (const twinCell of edgeCells()) {
    test(twinCell.name, () => expectTwinWithLetter(twinCell));
  }
});

describe("Enter in a heading's middle, after an image or a link, splits it as the twin", () => {
  for (const twinCell of middleCells()) {
    test(twinCell.name, () => expectTwinWithLetter(twinCell));
  }
});

/**
 * K18 (P24, carry): the paragraph Enter leaves after a heading in an item
 * is a line, with D3's break before the line after it; at <base> it is a
 * paragraph in the item. The handler does not act in these cells (the
 * caret is at the end of the heading's last text).
 */
const K18: Record<string, { write: string; typed: string }> =
  Object.fromEntries(
    (["blockLed", "lineLed"] as const).flatMap((context) =>
      (["click", "structure"] as const).map((how) => {
        const lead = context === "lineLed" ? "T9w" : "";
        return [
          `text end ${context} ${how}`,
          {
            write: LI(`${lead}<h3>AwBw</h3><br />T1w`),
            typed: LI(`${lead}<h3>AwBw</h3>k<br />T1w`),
          },
        ];
      })
    )
  );

describe("Enter in a heading's plain text stays Lexical's", () => {
  const base = enterHeadingJson as Record<
    string,
    { write: string | null; calls: number; typed: string }
  >;
  for (const plainCell of enterHeadingPlainCells()) {
    test(plainCell.id, async () => {
      const record = await recordEdit(plainCell, { short: true });
      const expected = K18[plainCell.id] ?? base[plainCell.id];
      expect(expected, "the fixture cell").toBeDefined();
      expect(record.write, "the write").toBe(expected.write);
      expect(record.typed, "the letter after it").toBe(expected.typed);
      expect(record.calls, "one onChange").toBe(1);
      expect(record.errors, "console errors").toEqual([]);
      expect(record.slowest, "the slowest step").toBeLessThan(2000);
    });
  }
});
