// Spec section 10 and T45.13 (Task 22): 5.3's point rule holds under real
// clicks. Before each click the place is inside the editable
// (`document.elementFromPoint`); the click fires no onChange, makes no undo
// step and draws no report from the point check; it leaves the expected
// caret, and the letter after it writes the expected value.
// - The points M55's place reaches (the head's drawn caret, relative to the
//   editable): the caret is the grids' `<point> placed`, the letter the
//   grid's `<point> letter` write.
// - Group 1 (T45.13): M55 put eight places at x 471, outside the test
//   page's 414 px viewport. RT@1, RQ@1, TRT@2 and QRQ@2 click where the
//   branch draws the caret after `place` (M-b); TR@2 and QR@2, whose caret
//   has no rect, at the first place on the point's row that gives `placed`
//   (M-b: 254,44).
// - Group 2 (T45.13): QT@1, TQT el2, QA el1 and QB el1 click where the
//   branch draws the caret (M-b). M55's place there is the quote's end; a
//   click at it stays as a control, pinned equal at both builds (M-a).
// - Group 3 (T46.5): RR@1, RR@2 and BQ el1 are reached by keys only. No
//   click at either build lands the letter there (M-e9); a click on the
//   point's row leaves the item's start, and ArrowRight from there reaches
//   the point (2, 4 and 1 presses), with the head's letter at both builds.
// - T46.6 (P22-7): a click to the right of a line's text leaves the caret
//   at its end (5.7's QBR and QTR row), with ordinary content as the
//   control, equal at both builds (M-f2).
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import {
  ELEMENT_POINTS,
  type GridEntry,
  MEETING_POINTS,
} from "./rich-text-line-cells-grids";
import {
  backspace,
  caretKey,
  clickAt,
  del,
  enter,
  expectEdit,
  keys,
  LI,
  letter,
  mount,
  range,
  recordEdit,
  short,
  type Step,
} from "./rich-text-line-test-kit";
import { undoDepth } from "./rich-text-line-test-kit-branch";
import { editable, lastHtml, settle } from "./rich-text-test-harness";
import pointsJson from "./__snapshots__/rich-text-line-grid-points.json";
import meetingJson from "./__snapshots__/rich-text-line-grid-meeting.json";

const grid = { ...pointsJson, ...meetingJson } as Record<
  string,
  GridEntry | string
>;

type Place = [x: number, y: number];

/** M55: where the head's browser shows the caret at each point. */
const M55: Record<string, Place> = {
  "TR@0": [23, 32],
  "TR@1": [50, 32],
  "RT@0": [23, 32],
  "RT@2": [48, 49],
  "QR@0": [23, 32],
  "QR@1": [62, 32],
  "RQ@0": [23, 32],
  "RQ@2": [59, 49],
  "TRT@0": [23, 32],
  "TRT@1": [50, 32],
  "TRT@3": [50, 65],
  "QRQ@0": [23, 32],
  "QRQ@1": [62, 32],
  "QRQ@3": [62, 65],
  "RR@0": [23, 32],
  "TQ@1": [50, 32],
  "TQT el1": [50, 32],
  "TH@1": [50, 32],
  "TC@1": [50, 32],
  "AQ el1": [42, 32],
  "root el1": [42, 16],
};

/** Group 1: M55's x 471 is outside the viewport; the branch's places (M-b). */
const GROUP_1: Record<string, Place> = {
  "RT@1": [24, 49],
  "RQ@1": [34, 49],
  "TRT@2": [24, 65],
  "QRQ@2": [34, 65],
  "TR@2": [254, 44],
  "QR@2": [254, 44],
};

/**
 * Group 3 (T46.5): reached by keys only. A click on the point's row (M-e9)
 * leaves the item's start, the base's letter there; then ArrowRight
 * reaches the point (measured at both builds).
 */
const GROUP_3: Record<
  string,
  { place: Place; caret: string; write: string; presses: number }
> = {
  "RR@1": {
    place: [110, 34],
    caret: "element:listitem@0",
    write: LI("k<hr /><hr />"),
    presses: 2,
  },
  "RR@2": {
    place: [110, 40],
    caret: "element:listitem@0",
    write: LI("k<hr /><hr />"),
    presses: 4,
  },
  "BQ el1": {
    place: [26, 32],
    caret: "element:listitem@0",
    write: LI("k<br /><blockquote><p>Q1w</p></blockquote>"),
    presses: 1,
  },
};

/** T46.6: a place to the right of each line's text, on its row. */
const RIGHT_OF_TEXT: Array<[name: string, place: Place]> = [
  ["TR@2", [50, 32]],
  ["TR@2", [200, 32]],
  ["TR@2", [410, 38]],
  ["TR@1", [200, 32]],
  ["TRT@1", [200, 32]],
  ["TQ@1", [200, 32]],
  ["TQT el1", [200, 32]],
  ["TH@1", [200, 32]],
  ["TC@1", [200, 32]],
  ["AQ el1", [200, 32]],
];

/** T46.6's controls in ordinary content, equal at both builds (M-f2). */
const RIGHT_OF_TEXT_CONTROLS: Array<
  [stored: string, place: Place, write: string]
> = [
  [
    "<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>",
    [199, 32],
    "<ul><li>Pw</li><li>T0wk</li><li>Nw</li></ul>",
  ],
  ["<p>T0w</p>", [183, 16], "<p>T0wk</p>"],
];

/** Group 2: the branch's drawn caret (M-b). */
const GROUP_2: Record<string, Place> = {
  "QT@1": [24, 56],
  "TQT el2": [24, 72],
  "QA el1": [24, 56],
  "QB el1": [23, 56],
};

/** Group 2's controls: M55's place, the quote's end at both builds (M-a). */
const GROUP_2_CONTROLS: Record<
  string,
  { place: Place; caret: string; write: string }
> = {
  "QT@1": {
    place: [62, 32],
    caret: "text:Q0w@3",
    write: LI("<blockquote><p>Q0wk</p></blockquote>T1w"),
  },
  "TQT el2": {
    place: [59, 48],
    caret: "text:Q1w@3",
    write: LI("T0w<blockquote><p>Q1wk</p></blockquote>T2w"),
  },
  "QA el1": {
    place: [62, 32],
    caret: "text:Q0w@3",
    write: LI("<blockquote><p>Q0wk</p></blockquote><a>Lw</a>"),
  },
  "QB el1": {
    place: [62, 32],
    caret: "text:Q0w@3",
    write: LI("<blockquote><p>Q0wk</p></blockquote><br />"),
  },
};

const storedOf = (name: string) =>
  [...ELEMENT_POINTS, ...MEETING_POINTS].find(({ point }) => point === name)!
    .stored;

/** A click at `place`, its checks, then a letter: the caret and the write. */
const clickThenLetter = async (stored: string, [x, y]: Place, then?: Step) => {
  const onChange = await mount(stored);
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const text = args.map(String).join(" ");
    if (text.includes("not wrapped in act") === false) {
      errors.push(text.slice(0, 300));
    }
  });
  const box = editable()!.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + x, box.top + y);
  expect(
    hit !== null && editable()!.contains(hit),
    `the place ${x}, ${y} is inside the editable`
  ).toBe(true);
  const depth = undoDepth().undo;
  await clickAt(box.left + x, box.top + y)();
  expect(onChange, "no onChange from the click").not.toHaveBeenCalled();
  expect(undoDepth().undo, "no undo step from the click").toBe(depth);
  expect(
    errors.filter((error) => error.includes("cms-line point rule")),
    "nothing from the point check"
  ).toEqual([]);
  await then?.();
  const caret = caretKey();
  await letter();
  expect(errors, "console errors").toEqual([]);
  return { caret, write: short(lastHtml(onChange)) };
};

const placedOf = (name: string) => ({
  caret: grid[`${name} placed`] as string,
  write: (grid[`${name} letter`] as GridEntry).write,
});

describe("10: a click at each point (T45.13, T46.5)", () => {
  test("the 34 points, each in one group", () => {
    const here = [
      ...Object.keys(M55),
      ...Object.keys(GROUP_1),
      ...Object.keys(GROUP_2),
      ...Object.keys(GROUP_3),
    ].sort();
    expect(here).toHaveLength(34);
    expect(here).toEqual(
      [...ELEMENT_POINTS, ...MEETING_POINTS].map(({ point }) => point).sort()
    );
  });

  for (const [name, place] of Object.entries(M55)) {
    test(`a click at ${name} (M55's place) leaves D18's caret`, async () => {
      const expected = placedOf(name);
      const got = await clickThenLetter(storedOf(name), place);
      expect(got.caret, "the caret").toBe(expected.caret);
      expect(got.write, "the letter").toBe(expected.write);
    });
  }

  for (const [name, place] of Object.entries(GROUP_1)) {
    test(`group 1: a click at ${name} (the branch's place, in view) leaves D18's caret`, async () => {
      const expected = placedOf(name);
      const got = await clickThenLetter(storedOf(name), place);
      expect(got.caret, "the caret").toBe(expected.caret);
      expect(got.write, "the letter").toBe(expected.write);
    });
  }

  for (const [name, place] of Object.entries(GROUP_2)) {
    test(`group 2: a click at ${name} (the branch's drawn caret) leaves D18's caret`, async () => {
      const expected = placedOf(name);
      const got = await clickThenLetter(storedOf(name), place);
      expect(got.caret, "the caret").toBe(expected.caret);
      expect(got.write, "the letter").toBe(expected.write);
    });
  }

  for (const [name, control] of Object.entries(GROUP_2_CONTROLS)) {
    test(`control: a click at ${name}'s M55 place is a click in the quote's text, its end at both builds`, async () => {
      const got = await clickThenLetter(storedOf(name), control.place);
      expect(got.caret, "the caret").toBe(control.caret);
      expect(got.write, "the letter").toBe(control.write);
    });
  }

  for (const [name, point] of Object.entries(GROUP_3)) {
    test(`group 3: ${name} is reached by keys only: a click on its row leaves the item's start`, async () => {
      const got = await clickThenLetter(storedOf(name), point.place);
      expect(got.caret, "the caret").toBe(point.caret);
      expect(got.write, "the base's letter").toBe(point.write);
    });
    test(`group 3: ${name}: ${point.presses} ArrowRight from that click reach it`, async () => {
      const expected = placedOf(name);
      const got = await clickThenLetter(
        storedOf(name),
        point.place,
        async () => {
          for (let press = 0; press < point.presses; press += 1) {
            await keys("{ArrowRight}")();
          }
        }
      );
      expect(got.caret, "the caret").toBe(expected.caret);
      expect(got.write, "the letter").toBe(expected.write);
    });
  }
});

describe("T46.6: a click to the right of a line's text leaves the caret at its end", () => {
  for (const [name, place] of RIGHT_OF_TEXT) {
    test(`${name}, a click at ${place.join(",")}`, async () => {
      const expected = placedOf(name.startsWith("TR@2") ? "TR@1" : name);
      const got = await clickThenLetter(storedOf(name), place);
      expect(got.caret, "the caret at the text's end").toBe(expected.caret);
      expect(got.write, "the letter there").toBe(expected.write);
    });
  }
  for (const [stored, place, write] of RIGHT_OF_TEXT_CONTROLS) {
    test(`control: ${stored}, a click at ${place.join(",")}, equal at both builds`, async () => {
      const got = await clickThenLetter(stored, place);
      expect(got.caret, "the caret at the text's end").toBe("text:T0w@3");
      expect(got.write, "the letter there").toBe(write);
    });
  }
});

/** T70.11: a real click 2 px inside the first quote's bottom right corner. */
const clickQuoteCorner: Step = async () => {
  const quote = editable()!.querySelector<HTMLElement>("blockquote")!;
  const box = quote.getBoundingClientRect();
  await userEvent.click(quote, {
    position: { x: box.width - 2, y: box.height - 2 },
    force: true,
  } as never);
  await settle();
};

describe("T70.11: a click at a quote's bottom right leaves the caret at its text's end", () => {
  const QBR = LI("<blockquote><p>Q0w</p></blockquote><br><hr>");
  const QTR = LI("<blockquote><p>Q0w</p></blockquote>T1w<hr>");
  const letters: Array<
    [name: string, stored: string, caret: string, write: string]
  > = [
    [
      "QBR",
      QBR,
      "text:Q0w@3",
      LI("<blockquote><p>Q0wk</p></blockquote><br /><hr />"),
    ],
    [
      "QTR",
      QTR,
      "text:Q0w@3",
      LI("<blockquote><p>Q0wk</p></blockquote>T1w<hr />"),
    ],
    [
      "control, equal at both builds: TQR",
      LI("T0w<blockquote><p>Q1w</p></blockquote><hr>"),
      "text:Q1w@3",
      LI("T0w<blockquote><p>Q1wk</p></blockquote><hr />"),
    ],
    [
      "control, equal at both builds: QBR's ordinary twin",
      "<p>Pw</p><blockquote><p>Q0w</p></blockquote><p><br></p><hr><p>Nw</p>",
      "text:Q0w@3",
      "<p>Pw</p><blockquote><p>Q0wk</p></blockquote><p><br /></p><hr /><p>Nw</p>",
    ],
    [
      "control, equal at both builds: QTR's ordinary twin",
      "<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>T1w</p><hr><p>Nw</p>",
      "text:Q0w@3",
      "<p>Pw</p><blockquote><p>Q0wk</p></blockquote><p>T1w</p><hr /><p>Nw</p>",
    ],
  ];
  for (const [name, stored, caret, write] of letters) {
    test(`${name}: the caret, then a letter`, async () => {
      await expectEdit({
        stored,
        place: async () => {
          await clickQuoteCorner();
          expect(caretKey(), "the caret the click leaves").toBe(caret);
        },
        action: letter,
        write,
        caret: caret.replace("w@3", "wk@4"),
      });
    });
  }
  const edits: Array<
    [name: string, stored: string, action: Step, write: string, caret: string]
  > = [
    [
      "QBR Backspace",
      QBR,
      backspace,
      LI("<blockquote><p>Q0</p></blockquote><br /><hr />"),
      "text:Q0@2",
    ],
    [
      "QTR Backspace",
      QTR,
      backspace,
      LI("<blockquote><p>Q0</p></blockquote>T1w<hr />"),
      "text:Q0@2",
    ],
    [
      "QBR Delete (D3, fourth case)",
      QBR,
      del,
      LI("<blockquote><p>Q0w</p></blockquote><hr />"),
      "text:Q0w@3",
    ],
    [
      "QTR Delete (D3, second case)",
      QTR,
      del,
      LI("<blockquote><p>Q0wT1w</p></blockquote><hr />"),
      "text:Q0wT1w@3",
    ],
  ];
  for (const [name, stored, action, write, caret] of edits) {
    test(name, async () => {
      await expectEdit({
        stored,
        place: clickQuoteCorner,
        action,
        write,
        caret,
      });
    });
  }
  for (const [name, stored] of [
    ["QBR", QBR],
    ["QTR", QTR],
  ] as const) {
    test(`${name} Enter: R1's own Enter at Q0w@3 set by code`, async () => {
      const byCode = await recordEdit({
        stored,
        place: range("Q0w", 3, "Q0w", 3),
        action: enter,
      });
      const byClick = await recordEdit({
        stored,
        place: clickQuoteCorner,
        action: enter,
      });
      expect(byCode.write, "an Enter write").not.toBeNull();
      expect(byClick.write, "the write").toBe(byCode.write);
      expect(byClick.calls, "calls").toBe(byCode.calls);
      expect(byClick.caret, "the caret").toBe(byCode.caret);
      expect(byClick.undoRestores, "one undo restores").toBe(true);
      expect(byClick.redoEquals, "redo").toBe(true);
    });
  }
});
