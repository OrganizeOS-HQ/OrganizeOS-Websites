// The one writer over every oracle range of `rich-text-line-writer-cases.ts`
// (check 4, 15.11: 219 lined and 54 unlined; check 5, 16.4 to 16.6, 16.14;
// D6's two invariants). Each range is copied, then, after a remount, cut:
// - 16.5: the cut's clipboard is the copy's, character for character, in
//   every type, and the cut is never refused (one onChange);
// - the writer against the oracle: text/html and the editor data hold
//   exactly `$rangeOracle`'s H (text, images, rules, line breaks), judged on
//   the raw text/html, and text/plain is H's text or F7's one new line;
// - 16.6: the raw text/html and the editor data hold no empty element the
//   range does not enter (an element holding one of its ends, a text end at
//   a block's edge included: D6, FS9, or lying inside it), by type;
// - D6: the clipboard holds nothing outside the selection and everything in
//   it; a cut removes exactly what its clipboard holds (P and S stay).
import { describe, expect, test, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { commands, userEvent } from "@vitest/browser/context";
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  type ElementNode,
  type LexicalNode,
  type PointType,
  type RangeSelection,
} from "lexical";
import {
  $rangeOracle,
  clipboard,
  copy,
  cut,
  expectSameLines,
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
import { exportRichTextHtml } from "./rich-text-html";
import { ITEM_NOT_WHOLE_MARK } from "./rich-text-line-clipboard";

declare module "@vitest/browser/context" {
  interface BrowserCommands {
    grantClipboard: () => Promise<void>;
  }
}

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

/** The node type each exported tag stands for (16.6: an empty element by its type). */
const TAG_TYPE: Record<string, string> = {
  P: "paragraph",
  BLOCKQUOTE: "quote",
  LI: "listitem",
  UL: "list",
  OL: "list",
  H1: "heading",
  H2: "heading",
  H3: "heading",
  H4: "heading",
  H5: "heading",
  H6: "heading",
  PRE: "code",
  SPAN: "text",
  A: "link",
};

type Counts = Record<string, number>;

const add = (counts: Counts, type: string) => {
  counts[type] = (counts[type] ?? 0) + 1;
};

/** The empty elements of the raw text/html by type: no text, image, rule or line break. */
const emptyInHtml = (html: string) => {
  const counts: Counts = {};
  const body = new DOMParser().parseFromString(html, "text/html").body;
  for (const element of body.querySelectorAll("*")) {
    if (
      element.tagName === "CODE" &&
      element.parentElement?.tagName === "PRE"
    ) {
      continue;
    }
    if (
      (element.textContent ?? "") === "" &&
      ["IMG", "HR", "BR"].includes(element.tagName) === false &&
      element.querySelector("img, hr, br") === null
    ) {
      add(counts, TAG_TYPE[element.tagName] ?? element.tagName.toLowerCase());
    }
  }
  return counts;
};

type JNode = { type: string; text?: string; children?: JNode[] };

/** The empty nodes of the editor data by type: no text, image, rule or line break. */
const emptyInData = (json: string | undefined) => {
  const counts: Counts = {};
  const holds = (node: JNode): boolean =>
    node.text !== undefined
      ? node.text !== ""
      : node.children === undefined || node.children.some(holds);
  const walk = (node: JNode) => {
    if (holds(node) === false) {
      add(counts, node.type);
    }
    node.children?.forEach(walk);
  };
  (JSON.parse(json ?? "{}").nodes as JNode[]).forEach(walk);
  return counts;
};

/**
 * The elements the committed range enters that hold none of its content
 * (H), by type: the oracle's side of 16.6. An element is entered when it
 * holds one of the range's ends (a text end at a block's edge is inside the
 * block: D6, FS9) or lies inside the range; one holding H's content is not
 * empty in the clipboard. The root and the lines (never exported) are left
 * out.
 */
const enteredEmptyNow = (): Counts =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const counts: Counts = {};
      const selection = $getSelection();
      if ($isRangeSelection(selection) === false) {
        return counts;
      }
      const leaves: LexicalNode[] = [];
      const first = new Map<string, number>();
      const after = new Map<string, number>();
      const walk = (node: LexicalNode) => {
        first.set(node.getKey(), leaves.length);
        if ($isElementNode(node)) {
          node.getChildren().forEach(walk);
        } else {
          leaves.push(node);
        }
        after.set(node.getKey(), leaves.length);
      };
      walk($getRoot());
      const position = (point: PointType): [number, number] => {
        const node = point.getNode();
        if (point.type === "text") {
          return [first.get(node.getKey())!, point.offset];
        }
        const child = (node as ElementNode).getChildAtIndex(point.offset);
        return [
          child === null
            ? after.get(node.getKey())!
            : first.get(child.getKey())!,
          0,
        ];
      };
      const before = (a: [number, number], b: [number, number]) =>
        a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
      const backward = $rangeOracle(selection).order === "backward";
      const [startPoint, endPoint] = backward
        ? [selection.focus, selection.anchor]
        : [selection.anchor, selection.focus];
      const start = position(startPoint);
      const end = position(endPoint);
      // the leaves H holds, by the oracle's rule
      const held = new Set<number>();
      for (
        let index = start[0];
        index <= end[0] && index < leaves.length;
        index += 1
      ) {
        const leaf = leaves[index];
        if ($isTextNode(leaf)) {
          const size = leaf.getTextContentSize();
          const from = index === start[0] ? start[1] : 0;
          const to = index === end[0] ? end[1] : size;
          if (to > from) {
            held.add(index);
          }
        } else if (index !== end[0] && (index !== start[0] || start[1] === 0)) {
          held.add(index);
        }
      }
      const ends = [startPoint.getNode(), endPoint.getNode()];
      const visit = (node: LexicalNode) => {
        if ($isElementNode(node)) {
          node.getChildren().forEach(visit);
        }
        const type = node.getType();
        if (node.getKey() === $getRoot().getKey() || type === "cms-line") {
          return;
        }
        if ($isElementNode(node) === false && $isTextNode(node) === false) {
          return;
        }
        const from = first.get(node.getKey())!;
        const to = after.get(node.getKey())!;
        for (let index = from; index < to; index += 1) {
          if (held.has(index)) {
            return;
          }
        }
        const holdsAnEnd = ends.some(
          (end) => end.is(node) || end.getParents().some((up) => up.is(node))
        );
        const inside =
          before(start, [from, 0]) &&
          (to > from ? before([to, 0], end) : before([from, 0], end));
        if (holdsAnEnd || inside) {
          add(counts, type);
        }
      };
      visit($getRoot());
      return counts;
    });

/** The types whose empty elements in `found` exceed what the range enters. */
const beyond = (found: Counts, entered: Counts) =>
  Object.entries(found)
    .filter(([type, count]) => count > (entered[type] ?? 0))
    .map(([type, count]) => `${type}: ${count} > ${entered[type] ?? 0}`);

/**
 * The cells whose real input leaves the field no range: a Shift+click on an
 * image opens its popover, and Lexical holds no selection while it is open
 * (T12.1; T27.1: no real input node-selects an image, so D15 does not
 * apply). Their copy and cut are controls (T39.3, P18-5): the clipboard
 * sentinel stays and the value is unchanged.
 */
const NO_RANGE = [
  'real03 imgLineEnd-QTIQ | {"k":"shiftclickImg","click":["T1w",1],"img":0,"side":"right"}',
  'real04 imgLineEnd-QTIQ | {"k":"shiftclickImg","click":["Q2w",1],"img":0,"side":"right"}',
  'real11 imgLineStart-TQIT | {"k":"shiftclickImg","click":["T0w",1],"img":0,"side":"left"}',
];

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
  const entered = enteredEmptyNow();
  const noSelection = editorOf()!
    .getEditorState()
    .read(() => $getSelection() === null);
  const popovers = document.querySelectorAll('[role="dialog"]').length;
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
  // T68.3: the writer's made-up character is in no flavour of either
  for (const [name, data] of [
    ["copy", copied],
    ["cut", cutData],
  ] as const) {
    for (const type of ["text/plain", "text/html", EDITOR_DATA]) {
      expect(
        data[type] ?? "",
        `${name} ${type}: no made-up character`
      ).not.toContain(ITEM_NOT_WHOLE_MARK);
    }
  }
  if (NO_RANGE.includes(cell.id)) {
    expect(noSelection, "Lexical holds no selection (T12.1)").toBe(true);
    expect(popovers, "the image's popover is open (T12.1)").toBeGreaterThan(0);
    // T39.3 (P18-5): controls. A copy and a cut, by the event and by a real
    // key, leave the clipboard sentinel and the value as they were
    for (const kind of ["copy", "cut"] as const) {
      const onSentinel = await mount(cell.html);
      await place(cell);
      const value = exportRichTextHtml(editorOf()!);
      onSentinel.mockClear();
      const transfer = new DataTransfer();
      transfer.setData("text/plain", "Zz");
      await act(async () => {
        editable()!.dispatchEvent(
          new ClipboardEvent(kind, {
            bubbles: true,
            cancelable: true,
            clipboardData: transfer,
          })
        );
      });
      await settle();
      expect(
        Object.fromEntries(transfer.types.map((t) => [t, transfer.getData(t)])),
        `${kind}: the event's clipboard sentinel stays`
      ).toEqual({ "text/plain": "Zz" });
      await commands.grantClipboard();
      await navigator.clipboard.writeText("Zz");
      await userEvent.keyboard(
        `{Control>}${kind === "copy" ? "c" : "x"}{/Control}`
      );
      await settle();
      expect(
        await navigator.clipboard.readText(),
        `${kind}: the clipboard sentinel stays`
      ).toBe("Zz");
      expect(onSentinel.mock.calls.length, `${kind}: no onChange`).toBe(0);
      expect(exportRichTextHtml(editorOf()!), `${kind}: the value`).toBe(value);
    }
    return;
  }
  expect(before, "the real input leaves a range").not.toBeNull();
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
  // T65 as T71.4 restates it, on every cell
  expectSameLines(copied);

  // 16.6: an element-point end adds nothing to the clipboard: no empty
  // element the range does not enter, in text/html and in the editor data
  expect(
    beyond(emptyInHtml(html), entered),
    `16.6: text/html holds an empty element the range does not enter: ${html}`
  ).toEqual([]);
  expect(
    beyond(emptyInData(copied[EDITOR_DATA]), entered),
    "16.6: the editor data holds an empty node the range does not enter"
  ).toEqual([]);

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
