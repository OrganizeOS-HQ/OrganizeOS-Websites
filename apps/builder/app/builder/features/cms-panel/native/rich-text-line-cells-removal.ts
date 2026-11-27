// The removal class sweep (Task 13 Step 1b; check 3's sweep, check 5): one
// table of the edge child beside an element-point end (an image, a line
// break, inline code, text, a link), the place of the point (the start at
// its parent's end, the end at its parent's start, an end beside a text
// neighbour, both ends element points), forward and backward, in a lined
// item and in ordinary content, by every entry point. A cell asserts that
// what the removal took equals `$rangeOracle` of the range (H), with no
// console error and the step under 2,000 ms. Divider over a range takes the
// head's path and removes nothing (check 2, A4). A composition over a
// backward range removes the range, writes its text once and leaves no
// composition-start character, as the forward range does (P13-4, T30.5;
// Task 20, 16.19 to 16.21).
import { expect, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type ElementNode,
  type LexicalNode,
  type PointType,
  type RangeSelection,
} from "lexical";
import {
  $rangeOracle,
  backspace,
  button,
  cut,
  del,
  drop,
  enter,
  ime,
  imageButton,
  letter,
  lineBack,
  lineForward,
  mount,
  pasteHtml,
  pasteOwn,
  pasteText,
  replaceText,
  shiftEnter,
  wordBack,
  wordForward,
  type Step,
} from "./rich-text-line-test-kit";
import { editable, editorOf, settle } from "./rich-text-test-harness";

const EDGES = {
  image:
    '<img src="https://cdn.example.org/x.png" alt="" width="2" height="3" />',
  "line break": "<br>",
  "inline code": "<code>Cw</code>",
  text: "<b>Ew</b>",
  link: '<a href="https://example.org/l">Lw</a>',
} as const;
type Edge = keyof typeof EDGES;

const PLACES = [
  "the start at its parent's end",
  "the end at its parent's start",
  "an end beside a text neighbour",
  "both ends element points",
] as const;
type Place = (typeof PLACES)[number];

/**
 * The parents the place names, in order: `first` and `second` are the inline
 * runs the range runs from and to. Ordinary content holds them as two
 * paragraphs; a lined item as two lines with a quote between them.
 */
const runs = (place: Place, edge: string) => {
  switch (place) {
    case "the start at its parent's end":
      return { first: `A0w${edge}`, second: "B1w" };
    case "the end at its parent's start":
      return { first: "A0w", second: `${edge}B1w` };
    case "an end beside a text neighbour":
      return { first: `A0w${edge}B0w`, second: "C1w" };
    case "both ends element points":
      return { first: `A0w${edge}`, second: `${edge}B1w` };
  }
};

export const ENTRY_POINTS: ReadonlyArray<readonly [string, Step, string]> = [
  ["Backspace", backspace, ""],
  ["Delete", del, ""],
  ["Ctrl+Backspace", wordBack, ""],
  ["Ctrl+Delete", wordForward, ""],
  ["lineBack", lineBack, ""],
  ["lineForward", lineForward, ""],
  ["cut", cut, ""],
  ["letter", letter, "k"],
  ["ime", ime("a"), "a"],
  ["paste HTML", pasteHtml("<p>Aq</p><p>Bq</p>"), "AqBq"],
  ["paste text", pasteText("Aq"), "Aq"],
  ["pasteOwn", pasteOwn("<p>Aq</p><p>Bq</p>"), "AqBq"],
  ["drop", drop("<p>Dq</p>"), "Dq"],
  ["Enter", enter, ""],
  ["Shift+Enter", shiftEnter, "↵"],
  ["Image", imageButton, "▣"],
  ["Divider", button("Divider"), "―"],
  ["replaceText", replaceText("k"), "k"],
];

export type RemovalCell = {
  id: string;
  edge: Edge;
  place: Place;
  backward: boolean;
  lined: boolean;
  entry: (typeof ENTRY_POINTS)[number];
  stored: string;
};

export const removalCells = (): RemovalCell[] => {
  const cells: RemovalCell[] = [];
  for (const edge of Object.keys(EDGES) as Edge[]) {
    for (const place of PLACES) {
      const { first, second } = runs(place, EDGES[edge]);
      for (const lined of [false, true]) {
        const stored = lined
          ? `<ul><li>Pw</li><li>${first}<blockquote><p>Q0w</p></blockquote>${second}</li><li>Nw</li></ul>`
          : `<p>${first}</p><p>${second}</p>`;
        for (const backward of [false, true]) {
          for (const entry of ENTRY_POINTS) {
            cells.push({
              id: `${edge}|${place}|${lined ? "lined" : "ordinary"}|${backward ? "backward" : "forward"}|${entry[0]}`,
              edge,
              place,
              backward,
              lined,
              entry,
              stored,
            });
          }
        }
      }
    }
  }
  return cells;
};

const $all = () => {
  const order: LexicalNode[] = [];
  const walk = (node: LexicalNode) => {
    order.push(node);
    if ($isElementNode(node)) {
      node.getChildren().forEach(walk);
    }
  };
  walk($getRoot());
  return order;
};

/** The two inline runs: the paragraphs, or the item's two lines. */
const $runs = (cell: RemovalCell) => {
  const parents = $all().filter((node) =>
    cell.lined
      ? node.getType() === "cms-line" &&
        node.getParent()?.getType() === "listitem"
      : node.getType() === "paragraph"
  ) as ElementNode[];
  expect(parents.length, "two runs").toBe(2);
  return parents;
};

/** The edge child: the first node of its kind in `run`. */
const $edgeIn = (cell: RemovalCell, run: ElementNode) => {
  const types: Record<Edge, (node: LexicalNode) => boolean> = {
    image: (node) => node.getType() === "cms-image",
    "line break": (node) => node.getType() === "linebreak",
    "inline code": (node) => $isTextNode(node) && node.hasFormat("code"),
    text: (node) => $isTextNode(node) && node.hasFormat("bold"),
    link: (node) => node.getType() === "link",
  };
  const edge = run.getChildren().find(types[cell.edge]);
  expect(edge, cell.edge).toBeDefined();
  return edge!;
};

const $text = (word: string) => {
  const found = $getRoot()
    .getAllTextNodes()
    .find((node) => node.getTextContent() === word);
  expect(found, word).toBeDefined();
  return found!;
};

type End = { key: string; offset: number; type: "text" | "element" };

const $ends = (cell: RemovalCell): [End, End] => {
  const [first, second] = $runs(cell);
  const element = (node: ElementNode, offset: number): End => ({
    key: node.getKey(),
    offset,
    type: "element",
  });
  const text = (word: string, offset: number): End => ({
    key: $text(word).getKey(),
    offset,
    type: "text",
  });
  switch (cell.place) {
    case "the start at its parent's end":
      return [element(first, first.getChildrenSize()), text("B1w", 1)];
    case "the end at its parent's start":
      return [text("A0w", 1), element(second, 0)];
    case "an end beside a text neighbour": {
      const edge = $edgeIn(cell, first);
      return [element(first, edge.getIndexWithinParent() + 1), text("C1w", 1)];
    }
    case "both ends element points":
      return [element(first, first.getChildrenSize()), element(second, 0)];
  }
};

/** The document as tokens: text, ▣ an image, ― a rule, ↵ a line break. */
export const $documentTokens = () => {
  const starts = new Map<string, number>();
  const ends = new Map<string, number>();
  let out = "";
  const walk = (node: LexicalNode) => {
    starts.set(node.getKey(), out.length);
    if ($isTextNode(node)) {
      // a composition's start character left in the value is a token too
      // (16.21: none is left)
      out += node.getTextContent();
    } else if ($isElementNode(node)) {
      node.getChildren().forEach(walk);
    } else if (node.getType() === "cms-image") {
      out += "▣";
    } else if (node.getType() === "horizontalrule") {
      out += "―";
    } else if (node.getType() === "linebreak") {
      out += "↵";
    }
    ends.set(node.getKey(), out.length);
  };
  walk($getRoot());
  return { out, starts, ends };
};

/** A point's place among the tokens. */
export const $tokenPosition = (
  tokens: ReturnType<typeof $documentTokens>,
  point: PointType
) => {
  const node = point.getNode();
  if (point.type === "text") {
    return tokens.starts.get(node.getKey())! + point.offset;
  }
  const child = (node as ElementNode).getChildAtIndex(point.offset);
  return child === null
    ? tokens.ends.get(node.getKey())!
    : tokens.starts.get(child.getKey())!;
};

const count = (tokens: string, token: string) =>
  [...tokens].filter((each) => each === token).length;

export type RemovalRecord = {
  before: string;
  start: number;
  end: number;
  after: string;
  errors: string[];
  ms: number;
};

/** Mounts, places the cell's range by structure, runs its entry point. */
export const runRemovalCell = async (
  cell: RemovalCell
): Promise<RemovalRecord> => {
  await mount(cell.stored);
  await userEvent.click(editable()!);
  await settle();
  await act(async () => {
    editorOf()!.update(() => {
      const [first, last] = $ends(cell);
      const [anchor, focus] = cell.backward ? [last, first] : [first, last];
      const selection = $createRangeSelection();
      selection.anchor.set(anchor.key, anchor.offset, anchor.type);
      selection.focus.set(focus.key, focus.offset, focus.type);
      $setSelection(selection);
    });
  });
  await settle();
  const { before, start, end } = editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection), "a range").toBe(true);
      const range = selection as RangeSelection;
      const tokens = $documentTokens();
      const a = $tokenPosition(tokens, range.anchor);
      const f = $tokenPosition(tokens, range.focus);
      // H: the oracle and the token positions read the same range
      const held = $rangeOracle(range);
      const slice = tokens.out.slice(Math.min(a, f), Math.max(a, f));
      expect(
        {
          text: slice.replace(/[▣―↵]/g, ""),
          images: count(slice, "▣"),
          rules: count(slice, "―"),
          breaks: count(slice, "↵"),
        },
        "the oracle"
      ).toEqual({
        text: held.text,
        images: held.images,
        rules: held.rules,
        breaks: held.breaks,
      });
      return { before: tokens.out, start: Math.min(a, f), end: Math.max(a, f) };
    });
  const errors: string[] = [];
  const spy = vi
    .spyOn(console, "error")
    .mockImplementation((...args: unknown[]) => {
      const text = args.map(String).join(" ");
      if (text.includes("not wrapped in act") === false) {
        errors.push(text.slice(0, 300));
      }
    });
  const began = performance.now();
  try {
    await cell.entry[1]();
  } finally {
    spy.mockRestore();
  }
  const ms = performance.now() - began;
  const after = editorOf()!
    .getEditorState()
    .read(() => $documentTokens().out);
  return { before, start, end, after, errors, ms };
};

/** The cell's assertions: what the removal took is what the range held (H). */
export const expectRemovalCell = async (cell: RemovalCell) => {
  const record = await runRemovalCell(cell);
  expect(record.errors, "console errors").toEqual([]);
  expect(record.ms, "the step in ms").toBeLessThan(2000);
  const { before, start, end, after } = record;
  if (cell.entry[0] === "Divider") {
    // the head's path over a range: nothing removed, a rule added
    expect(after.replace(/―/g, ""), "Divider removes nothing").toBe(
      before.replace(/―/g, "")
    );
    return;
  }
  const head = before.slice(0, start);
  const tail = before.slice(end);
  expect(after.startsWith(head), `kept before the range: ${after}`).toBe(true);
  expect(after.endsWith(tail), `kept after the range: ${after}`).toBe(true);
  expect(after.length >= head.length + tail.length, after).toBe(true);
  // what stands between is what the action put in, and nothing else
  const put = after.slice(head.length, after.length - tail.length);
  expect(put, "what the action put in").toBe(cell.entry[2]);
};
