// The twin grids' cells (Task 14 Step 1b; check 3's edge-child rule, round
// 14): a child at a block's or a line's edge (an image, a line break, a
// link), the caret beside it, a delete away from it. Each cell's twin is
// the same shape with the word Ew in the child's place (`twinOf`), the
// caret at the word's edge; the cell writes what the twin writes with the
// child put back. From the prototype's `rich-text-line-round14.test.tsx`
// ("a caret just after an image that ends its block or line is its end",
// "a caret just before an image that starts its block or line is its
// start") and `rich-text-line-edges.test.tsx` ("edge children write as
// their twins") at 451f20f04.
import { act } from "react-dom/test-utils";
import { expect } from "vitest";
import { $createRangeSelection, $getRoot, $setSelection } from "lexical";
import { click, editable, editorOf, settle } from "./rich-text-test-harness";
import {
  backspace,
  beside,
  del,
  type EditRecord,
  imageNode,
  lineBack,
  lineForward,
  range,
  recordEdit,
  type Step,
  twinOf,
  wordBack,
  wordForward,
} from "./rich-text-line-test-kit";

export type Edge = "img" | "br" | "a-outside" | "a-inside";

export type TwinCell = {
  name: string;
  stored: string;
  twin: string;
  /** The shape with a marker in the child's place, for the twin check. */
  marked: string;
  edge: Edge;
  occurrence: number;
  place: Step;
  twinPlace: Step;
  action: Step;
  /** The child as a write names it (`short`). */
  putBack: string;
};

const MARK = "\u0001";
const LINK = `<a href="https://example.org/l">Lw</a>`;
// the prototype's image size: a click on the kit's 2 by 3 image, then
// Escape, can leave the caret before it in a line after a quote
const GRID_IMG = `<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />`;

const FORMS = {
  fwd: [
    ["Delete", del],
    ["Ctrl+Delete", wordForward],
    ["lineForward", lineForward],
  ],
  back: [
    ["Backspace", backspace],
    ["Ctrl+Backspace", wordBack],
    ["lineBack", lineBack],
  ],
} as const;

// a child that ends its container (forward) or starts it (backward)
const ENDS_LINED: Record<string, (x: string) => string> = {
  quote: (x) => `<blockquote><p>X0w${x}</p></blockquote>`,
  heading: (x) => `<h3>X0w${x}</h3>`,
  line: (x) => `<blockquote><p>Q0w</p></blockquote>X1w${x}`,
};
const ENDS_ORDINARY: Record<string, (x: string) => string> = {
  quote: (x) => `<blockquote><p>X0w${x}</p></blockquote>`,
  heading: (x) => `<h3>X0w${x}</h3>`,
  line: (x) => `<p>X1w${x}</p>`,
};
const STARTS_LINED: Record<string, (x: string) => string> = {
  quote: (x) => `<blockquote><p>${x}X0w</p></blockquote>`,
  heading: (x) => `<h3>${x}X0w</h3>`,
  line: (x) => `${x}X1w`,
};
const STARTS_ORDINARY: Record<string, (x: string) => string> = {
  quote: (x) => `<blockquote><p>${x}X0w</p></blockquote>`,
  heading: (x) => `<h3>${x}X0w</h3>`,
  line: (x) => `<p>${x}X1w</p>`,
};
const FOLLOW_LINED: Record<string, string> = {
  line: "T1w",
  block: "<blockquote><p>B1w</p></blockquote>",
  rule: "<hr>",
  nested: "<ul><li>L1w</li></ul>",
  itemEnd: "",
  contentEnd: "",
};
const FOLLOW_ORDINARY: Record<string, string> = {
  line: "<p>T1w</p>",
  block: "<blockquote><p>B1w</p></blockquote>",
  rule: "<hr>",
  nested: "<ul><li>L1w</li></ul>",
  contentEnd: "",
};
const PRECEDE_LINED: Record<string, string> = {
  line: "T0w<br>",
  block: "<blockquote><p>B0w</p></blockquote>",
  rule: "<hr>",
  itemStart: "",
  contentStart: "",
};
const PRECEDE_ORDINARY: Record<string, string> = {
  line: "<p>T0w</p>",
  block: "<blockquote><p>B0w</p></blockquote>",
  rule: "<hr>",
  contentStart: "",
};

const CONTEXTS = ["blockLed", "lineLed", "ordinary"] as const;

const forwardShape = (context: string, end: string, follower: string) => {
  if (context === "ordinary") {
    return `${ENDS_ORDINARY[end](MARK)}${FOLLOW_ORDINARY[follower]}`;
  }
  const inner = `${context === "lineLed" ? "T9w" : ""}${ENDS_LINED[end](MARK)}${FOLLOW_LINED[follower]}`;
  return follower === "contentEnd"
    ? `<ul><li>Pw</li><li>${inner}</li></ul>`
    : `<ul><li>Pw</li><li>${inner}</li><li>Nw</li></ul>`;
};

const backwardShape = (context: string, start: string, before: string) => {
  if (context === "ordinary") {
    return `${PRECEDE_ORDINARY[before]}${STARTS_ORDINARY[start](MARK)}<p>Fw</p>`;
  }
  const inner = `${context === "lineLed" && before !== "line" ? "T9w<br>" : ""}${PRECEDE_LINED[before]}${STARTS_LINED[start](MARK)}`;
  return before === "contentStart"
    ? `<ul><li>${inner}</li><li>Nw</li></ul>`
    : `<ul><li>Pw</li><li>${inner}</li><li>Nw</li></ul>`;
};

const CHILD: Record<Edge, { html: string; count: RegExp; putBack: string }> = {
  img: { html: GRID_IMG, count: /<img\b/g, putBack: "<img />" },
  br: { html: "<br>", count: /<br\b/g, putBack: "<br />" },
  "a-outside": { html: LINK, count: /<a\b/g, putBack: "<a>Lw</a>" },
  "a-inside": { html: LINK, count: /<a\b/g, putBack: "<a>Lw</a>" },
};

/**
 * The twin's caret, set directly: in the text that holds Ew, after the
 * word (forward) or before it (backward), whatever text it joined.
 */
const atTwinWord =
  (dir: "fwd" | "back"): Step =>
  async () => {
    await click(editable()!);
    await act(async () => {
      editorOf()!.update(() => {
        const text = $getRoot()
          .getAllTextNodes()
          .find((node) => node.getTextContent().includes("Ew"));
        if (text === undefined) {
          throw new Error("the twin's word Ew is not in the field");
        }
        const offset =
          text.getTextContent().indexOf("Ew") + (dir === "fwd" ? 2 : 0);
        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), offset, "text");
        selection.focus.set(text.getKey(), offset, "text");
        $setSelection(selection);
      });
    });
    await settle();
  };

const cell = (
  name: string,
  marked: string,
  edge: Edge,
  dir: "fwd" | "back",
  place: Step,
  action: Step
): TwinCell => {
  const child = CHILD[edge];
  const at = marked.indexOf(MARK);
  const occurrence = [...marked.slice(0, at).matchAll(child.count)].length;
  const stored = marked.replace(MARK, child.html);
  return {
    name,
    stored,
    twin: twinOf(stored, edge, occurrence),
    marked,
    edge,
    occurrence,
    place,
    twinPlace: atTwinWord(dir),
    action,
    putBack: child.putBack,
  };
};

/** An image at the end of a quote's last paragraph, a heading or a line. */
export const forwardImageCells = (): TwinCell[] =>
  CONTEXTS.flatMap((context) =>
    Object.keys(ENDS_LINED).flatMap((end) =>
      Object.keys(
        context === "ordinary" ? FOLLOW_ORDINARY : FOLLOW_LINED
      ).flatMap((follower) =>
        FORMS.fwd.map(([form, action]) =>
          cell(
            `${context}, ${end} then ${follower}, ${form}`,
            forwardShape(context, end, follower),
            "img",
            "fwd",
            // the real gesture: a click on the image, then Escape (T27)
            imageNode(),
            action
          )
        )
      )
    )
  );

/**
 * Runs the cell and its twin (each by `recordEdit`'s short form) and
 * checks the cell writes the twin's write with the child put back; a
 * write equal to the value before reads as none (D19). Every step stays
 * under the 2,000 ms bound (the cell that hung at an older build among
 * them).
 */
export const expectTwin = async (twinCell: TwinCell) => {
  expect(twinCell.twin, "twinOf names the child").toBe(
    twinCell.marked.replace(MARK, "Ew")
  );
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
    {
      stored: twinCell.stored,
      place: twinCell.place,
      action: twinCell.action,
    },
    { short: true }
  );
  const expected = writeOf(twin)?.replaceAll("Ew", twinCell.putBack) ?? null;
  expect(writeOf(edge), "the twin's write with the child put back").toBe(
    expected
  );
  expect(edge.errors, "console errors").toEqual([]);
  expect(twin.slowest, "the twin's slowest step").toBeLessThan(2000);
  expect(edge.slowest, "the slowest step").toBeLessThan(2000);
};

/** An image at the start of a quote's first paragraph, a heading or a line. */
export const backwardImageCells = (): TwinCell[] =>
  CONTEXTS.flatMap((context) =>
    Object.keys(STARTS_LINED).flatMap((start) =>
      Object.keys(
        context === "ordinary" ? PRECEDE_ORDINARY : PRECEDE_LINED
      ).flatMap((before) =>
        FORMS.back.map(([form, action]) =>
          cell(
            `${context}, ${before} then ${start}, ${form}`,
            backwardShape(context, start, before),
            "img",
            "back",
            beside("cms-image", "before"),
            action
          )
        )
      )
    )
  );

const EDGE_PLACES: Record<
  "br" | "linkOut" | "linkIn",
  { edge: Edge; fwd: Step; back: Step }
> = {
  br: {
    edge: "br",
    fwd: beside("linebreak", "after", { last: true }),
    back: beside("linebreak", "before", { last: true }),
  },
  linkOut: {
    edge: "a-outside",
    fwd: beside("link", "after"),
    back: beside("link", "before"),
  },
  linkIn: {
    edge: "a-inside",
    fwd: range("Lw", 2, "Lw", 2),
    back: range("Lw", 0, "Lw", 0),
  },
};

/**
 * A line break at a block's edge, and a link at a block's or a line's
 * edge with the caret outside it or inside its text at the edge; both
 * directions, the three forms, the image grids' followers and contexts (a
 * line break at a line's edge is no block's edge: 744 cells).
 */
export const edgeCells = (): TwinCell[] =>
  (["fwd", "back"] as const).flatMap((dir) =>
    (["br", "linkOut", "linkIn"] as const).flatMap((name) =>
      CONTEXTS.flatMap((context) =>
        Object.keys(ENDS_LINED)
          .filter((block) => name !== "br" || block !== "line")
          .flatMap((block) =>
            Object.keys(
              dir === "fwd"
                ? context === "ordinary"
                  ? FOLLOW_ORDINARY
                  : FOLLOW_LINED
                : context === "ordinary"
                  ? PRECEDE_ORDINARY
                  : PRECEDE_LINED
            ).flatMap((neighbour) =>
              FORMS[dir].map(([form, action]) =>
                cell(
                  `${dir} ${name} ${context} ${block} ${neighbour} ${form}`,
                  dir === "fwd"
                    ? forwardShape(context, block, neighbour)
                    : backwardShape(context, block, neighbour),
                  EDGE_PLACES[name].edge,
                  dir,
                  EDGE_PLACES[name][dir],
                  action
                )
              )
            )
          )
      )
    )
  );
