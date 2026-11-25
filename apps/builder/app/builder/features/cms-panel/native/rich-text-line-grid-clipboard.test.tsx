// The one writer over every oracle range of `rich-text-line-writer-cases.ts`
// (check 4, 15.11: 219 lined and 54 unlined; check 5, 16.4 to 16.6, 16.14;
// D6's two invariants). Each range is copied, then, after a remount, cut:
// - 16.5: the cut's clipboard is the copy's, character for character, in
//   every type, and the cut is never refused (one onChange);
// - the writer against the oracle: text/html and the editor data hold
//   exactly `$rangeOracle`'s H (text, images, rules, line breaks), judged on
//   the raw text/html, and text/plain is H's text or F7's one new line;
// - 16.6: an element-point end adds no empty span to the raw text/html
//   (no range here holds an empty text of its own); the shell of an item
//   or a quote a range starts or ends in is D6's and FS9's, not judged here;
// - D6: the clipboard holds nothing outside the selection and everything in
//   it; a cut removes exactly what its clipboard holds (P and S stay).
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  type PointType,
  type RangeSelection,
} from "lexical";
import {
  $rangeOracle,
  clipboard,
  copy,
  cut,
  type Held,
  mount,
} from "./rich-text-line-test-kit";
import {
  type Case,
  dataSeq,
  htmlSeq,
  LINED_CASES,
  placeRange,
  realInput,
  UNLINED_CASES,
} from "./rich-text-line-writer-cases";
import { editable, editorOf, settle } from "./rich-text-test-harness";

const EDITOR_DATA = "application/x-lexical-editor";

type Parts = { p: Held; h: Held; s: Held };

const $span = (
  from: Pick<PointType, "key" | "offset" | "type">,
  to: Pick<PointType, "key" | "offset" | "type">
) => {
  const between = $createRangeSelection();
  between.anchor.set(from.key, from.offset, from.type);
  between.focus.set(to.key, to.offset, to.type);
  return $rangeOracle(between);
};

/** P, H and S of the committed range; null when it is no range. */
const parts = (): Parts | null =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) === false) {
        return null;
      }
      const h = $rangeOracle(selection as RangeSelection);
      const [first, last] =
        h.order === "backward"
          ? [selection.focus, selection.anchor]
          : [selection.anchor, selection.focus];
      const root = $getRoot();
      const start = { key: root.getKey(), offset: 0, type: "element" as const };
      const end = {
        key: root.getKey(),
        offset: root.getChildrenSize(),
        type: "element" as const,
      };
      return { p: $span(start, first), h, s: $span(last, end) };
    });

const documentHeld = (): Held =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const root = $getRoot();
      return $span(
        { key: root.getKey(), offset: 0, type: "element" },
        { key: root.getKey(), offset: root.getChildrenSize(), type: "element" }
      );
    });

const place = async (cell: Case) => {
  if ("real" in cell) {
    await realInput(cell.real);
    return;
  }
  await userEvent.click(editable()!);
  await settle();
  expect(await placeRange(cell.anchor, cell.focus), "placed").toBeNull();
};

const content = (held: {
  text: string;
  img: number;
  hr: number;
  br: number;
}) => ({ text: held.text, images: held.img, rules: held.hr, breaks: held.br });

const oracleContent = (held: Held) => ({
  text: held.text,
  images: held.images,
  rules: held.rules,
  breaks: held.breaks,
});

/** The empty spans of the raw text/html (16.6: an image alone copies as `<img>`). */
const emptySpans = (html: string) =>
  [...html.matchAll(/<span\b[^>]*><\/span>/g)].map((match) => match[0]);

/**
 * The ends of the committed range that are text points holding nothing of
 * their text (a first point at its end, a last point at its start): Lexical
 * exports each as an empty span, at the head too (D6). An element-point end
 * adds none (16.6).
 */
const emptyTextEndsNow = () =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) === false) {
        return 0;
      }
      const backward = $rangeOracle(selection).order === "backward";
      const [first, last] = backward
        ? [selection.focus, selection.anchor]
        : [selection.anchor, selection.focus];
      return (
        Number(
          first.type === "text" &&
            first.offset === first.getNode().getTextContentSize()
        ) + Number(last.type === "text" && last.offset === 0)
      );
    });

const runCell = async (cell: Case) => {
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    const text = args.map(String).join(" ");
    if (text.includes("not wrapped in act") === false) {
      errors.push(text.slice(0, 300));
    }
  });
  // the copy
  await mount(cell.html);
  await place(cell);
  const before = parts();
  const emptyTextEnds = emptyTextEndsNow();
  await copy();
  const copied = clipboard();
  // the cut, of the same range, after a remount
  const onChange = await mount(cell.html);
  await place(cell);
  onChange.mockClear();
  await cut();
  const cutData = clipboard();
  const calls = onChange.mock.calls.length;
  vi.restoreAllMocks();

  // 16.5: the cut's clipboard is the copy's, and the cut is not refused
  expect(cutData["text/html"], "16.5: text/html").toBe(copied["text/html"]);
  expect(cutData["text/plain"], "16.5: text/plain").toBe(copied["text/plain"]);
  expect(cutData[EDITOR_DATA], "16.5: the editor data").toBe(
    copied[EDITOR_DATA]
  );
  expect(errors, "console errors").toEqual([]);
  // a Shift+click on an image opens the image's popover and leaves the
  // field no range: there is nothing for the writer to judge
  if (before === null) {
    return;
  }
  expect(calls, "16.4: the cut is not refused").toBe(1);
  const { h, p, s } = before;

  // the writer against the oracle, judged on the raw text/html
  const html = copied["text/html"] ?? "";
  expect(html, "text/html written").not.toBe("");
  expect(html, "no line leaves the field").not.toContain("data-cms-line");
  expect(copied[EDITOR_DATA] ?? "", "no line in the editor data").not.toContain(
    '"type":"cms-line"'
  );
  expect(content(htmlSeq(html)!), "text/html holds H").toEqual(
    oracleContent(h)
  );
  expect(
    content(dataSeq(copied[EDITOR_DATA])!),
    "the editor data holds H"
  ).toEqual(oracleContent(h));
  expect(
    (copied["text/plain"] ?? "").replace(/\n/g, ""),
    "text/plain: H's text"
  ).toBe(h.text);

  // 16.6: an element-point end adds nothing to the clipboard
  expect(
    emptySpans(html).length,
    `16.6: an empty span only for a text end that holds nothing: ${html}`
  ).toBeLessThanOrEqual(emptyTextEnds);

  // D6: a cut removes exactly what its clipboard holds
  const after = documentHeld();
  expect(after.text, "the document keeps P and S").toBe(p.text + s.text);
  expect(after.images, "images").toBe(p.images + s.images);
  expect(after.rules, "rules").toBe(p.rules + s.rules);
};

describe("the one writer over the oracle ranges: lined (219)", () => {
  for (const cell of LINED_CASES) {
    test(cell.id, () => runCell(cell));
  }
});

describe("the one writer over the oracle ranges: unlined (54)", () => {
  for (const cell of UNLINED_CASES) {
    test(cell.id, () => runCell(cell));
  }
});
