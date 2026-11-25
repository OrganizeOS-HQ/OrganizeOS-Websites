// D2's Enter, D19's Enter writes, V7, V17, KS0, KS5, K15, K16, K18, F9,
// Tab, indent; Enter in a heading over a range (M1), M2, E1, and Enter and
// Shift+Enter over a range with an end on the root (16.8, T11.4).
import { describe, expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $setSelection,
  type ElementNode,
  INDENT_CONTENT_COMMAND,
  type LexicalCommand,
  type LexicalNode,
  OUTDENT_CONTENT_COMMAND,
} from "lexical";
import {
  $baselinePoint,
  at,
  backspace,
  baselineChildCount,
  containerPoint,
  enter,
  expectEdit,
  itemPoint,
  keys,
  letter,
  LI,
  lineBreakInput,
  mount,
  newlineInput,
  range,
  rangeToLineStart,
  recordEdit,
  shiftEnter,
  short,
  type Step,
  then,
  W,
} from "./rich-text-line-test-kit";
import { enterRangeRootCells } from "./rich-text-line-cells-enter";
import enterRangeRootJson from "./__fixtures__/rich-text-line-base-enter-range-root.json";
import { undoDepth } from "./rich-text-line-test-kit-branch";
import {
  click,
  editable,
  editorOf,
  lastHtml,
  settle,
} from "./rich-text-test-harness";

type Row = {
  name: string;
  stored: string;
  place: Step;
  action: Step;
  write: string | null;
  calls?: number;
  caret?: string;
  typed?: string;
  source: string;
};

const QUOTE = (text: string) => `<blockquote><p>${text}</p></blockquote>`;
const TQT = LI(`T0w${QUOTE("Q1w")}T2w`);
const TR = LI("T0w<hr>");

const dispatch =
  (command: LexicalCommand<void>): Step =>
  async () => {
    await act(async () => {
      editorOf()!.dispatchCommand(command, undefined);
    });
    await settle();
  };

const runRows = (rows: Row[]) => {
  for (const row of rows) {
    test(row.name, async () => {
      const { name: _name, ...edit } = row;
      await expectEdit(edit);
    });
  }
};

describe("Enter in a line (D2, D19, V7, KS0, KS5)", () => {
  runRows([
    {
      name: "D2: Enter in a line splits the item",
      stored: TR,
      place: at("T0w", 1),
      action: enter,
      write: W("<li>T</li><li>0w<hr /></li>"),
      source: "derived (D2); measured",
    },
    {
      name: "Enter at a line's end before a block starts the new item with the block (TQT)",
      stored: TQT,
      place: at("T0w"),
      action: enter,
      write: W(`<li>T0w</li><li>${QUOTE("Q1w")}T2w</li>`),
      typed: W(`<li>T0w</li><li>${QUOTE("kQ1w")}T2w</li>`),
      source: "from M23 (write and typed); spec 5.7, 5.8",
    },
    {
      name: "Enter in an empty last line moves to a new item and the line goes",
      stored: TR,
      place: itemPoint(1, 2),
      action: enter,
      write: "<ul><li>Pw</li><li>T0w<hr /></li><li></li><li>Nw</li></ul>",
      source: "derived (5.8); measured",
    },
    {
      name: "KS0: Enter at an item's start (Aw)",
      stored: "<ul><li>Aw</li><li>Bw</li></ul>",
      place: at("Aw", 0),
      action: enter,
      write: "<ul><li></li><li>Aw</li><li>Bw</li></ul>",
      source: "from M8a; spec 5.7",
    },
    {
      name: "KS0: Enter at an item's start (Bw)",
      stored: "<ul><li>Aw</li><li>Bw</li></ul>",
      place: at("Bw", 0),
      action: enter,
      write: "<ul><li>Aw</li><li></li><li>Bw</li></ul>",
      source: "from M8b; spec 5.7",
    },
    {
      name: "KS0: ol",
      stored: "<ol><li>Aw</li><li>Bw</li></ol>",
      place: at("Bw", 0),
      action: enter,
      write: "<ol><li>Aw</li><li></li><li>Bw</li></ol>",
      source: "from M8c; spec 5.7",
    },
    {
      name: "KS0: a list in a quote",
      stored: "<blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote>",
      place: at("X1w", 0),
      action: enter,
      write:
        "<blockquote><ul><li></li><li>X1w</li><li>X2w</li></ul></blockquote>",
      source: "from M8d; spec 5.7",
    },
    {
      name: "KS0: depth 2",
      stored: "<ul><li>Zw<ul><li>Aw</li><li>Bw</li></ul></li></ul>",
      place: at("Aw", 0),
      action: enter,
      write: "<ul><li>Zw<ul><li></li><li>Aw</li><li>Bw</li></ul></li></ul>",
      source: "from M8e; spec 5.7",
    },
    {
      name: "FS1: after a mixed item",
      stored:
        "<ul><li>Pw</li><li><blockquote>Q0w</blockquote>T1w</li><li>Nw</li></ul>",
      place: at("Nw", 0),
      action: enter,
      write:
        "<ul><li>Pw</li><li><blockquote>Q0w</blockquote>T1w</li><li></li><li>Nw</li></ul>",
      source: "from M8f; spec 5.7",
    },
    {
      name: "KS5: a whole-item range in TR (redo, round 9)",
      stored: TR,
      place: range("T0w", 0, "T0w", 3),
      action: enter,
      write: "<ul><li>Pw</li><li></li><li><hr /></li><li>Nw</li></ul>",
      source: "from M13a (T19.1); spec 5.7, D7",
    },
    {
      name: "KS5: TQR",
      stored: LI(`T0w${QUOTE("Q1w")}<hr>`),
      place: range("T0w", 0, "Q1w", 3),
      action: enter,
      write: "<ul><li>Pw</li><li></li><li><hr /></li><li>Nw</li></ul>",
      source: "from M13b (third, as T19.1); spec 5.7, 5.4, D7",
    },
  ]);

  test("T19.1: after KS5's Enter the caret is in the item that holds the rule, before the rule", async () => {
    for (const [stored, place] of [
      [TR, range("T0w", 0, "T0w", 3)],
      [LI(`T0w${QUOTE("Q1w")}<hr>`), range("T0w", 0, "Q1w", 3)],
    ] as const) {
      await mount(stored);
      await place();
      await enter();
      const where = editorOf()!
        .getEditorState()
        .read(() => {
          const selection = $getSelection();
          if (
            $isRangeSelection(selection) === false ||
            selection.isCollapsed() === false
          ) {
            return "not a caret";
          }
          let node: LexicalNode | null = selection.anchor.getNode();
          while (node !== null && node.getType() !== "listitem") {
            node = node.getParent();
          }
          const item = node as ElementNode | null;
          const rule = item
            ?.getChildren()
            .find((child) => child.getType() === "horizontalrule");
          if (rule === undefined) {
            return `in an item without the rule (${caretOf()})`;
          }
          const anchor = selection.anchor;
          const at = anchor.getNode();
          const before =
            at.is(item) && anchor.offset <= rule.getIndexWithinParent();
          // an element point on the empty line directly before the rule
          const inLineBefore =
            at.getType() === "cms-line" &&
            at.getParent()?.is(item) === true &&
            at.getNextSibling()?.is(rule) === true;
          return before || inLineBefore ? "before the rule" : caretOf();
        });
      expect(where, stored).toBe("before the rule");
    }
  });
});

const caretOf = () => {
  const selection = $getSelection();
  return $isRangeSelection(selection)
    ? `${selection.anchor.getNode().getType()}@${selection.anchor.offset}`
    : String(selection);
};

describe("Enter at a block's start in a mixed item (D19, V7)", () => {
  const HT = LI("<h3>H0w</h3>T1w");
  const QT = LI(`${QUOTE("Q0w")}T1w`);
  const CT = LI("<pre><code>C0w</code></pre>T1w");
  const CT_WRITE = W("<li><pre><code>\nC0w</code></pre>T1w</li>");
  runRows([
    {
      name: "D19: Enter at a leading heading's start (HT)",
      stored: HT,
      place: at("H0w", 0),
      action: enter,
      write: W("<li><br /><h3>H0w</h3>T1w</li>"),
      caret: "text:H0w@0",
      source: "D19, spec 5.7",
    },
    {
      name: "V7: HT from el0",
      stored: HT,
      place: itemPoint(1, 0),
      action: enter,
      write: W("<li><br /><h3>H0w</h3>T1w</li>"),
      caret: "text:H0w@0",
      source: "derived (D18 step 3, D19; ruling of 2026-11-20); measured",
    },
    {
      name: "V7: QT from el0",
      stored: QT,
      place: itemPoint(1, 0),
      action: enter,
      write: W(`<li><blockquote><p></p><p>Q0w</p></blockquote>T1w</li>`),
      source: "derived (D18 step 3; spec 5.7 QT); measured",
    },
    {
      name: "V7: CT from el0",
      stored: CT,
      place: itemPoint(1, 0),
      action: enter,
      write: CT_WRITE,
      source: "from M24 (P13c); derived (D18 step 3; spec 5.7 CT)",
    },
    {
      name: "D19: HR",
      stored: LI("<h3>H0w</h3><hr>"),
      place: at("H0w", 0),
      action: enter,
      write: W("<li><br /><h3>H0w</h3><hr /></li>"),
      caret: "text:H0w@0",
      source: "derived (D19); measured",
    },
    {
      name: "D19: HT as the first item",
      stored: "<ul><li><h3>H0w</h3>T1w</li></ul>",
      place: at("H0w", 0),
      action: enter,
      write: "<ul><li><br /><h3>H0w</h3>T1w</li></ul>",
      caret: "text:H0w@0",
      source: "derived (D19); measured",
    },
    {
      name: "QT: Enter at a leading quote's start",
      stored: QT,
      place: at("Q0w", 0),
      action: enter,
      write: W(`<li><blockquote><p></p><p>Q0w</p></blockquote>T1w</li>`),
      source: "spec 5.7",
    },
    {
      name: "CT: Enter at a leading code block's start",
      stored: CT,
      place: at("C0w", 0),
      action: enter,
      write: CT_WRITE,
      source: "from M24; spec 5.7",
    },
    {
      name: "D19: Enter at a heading's start after text (TH)",
      stored: LI("T0w<h3>H0w</h3>"),
      place: at("H0w", 0),
      action: enter,
      write: W("<li>T0w<br /><br /><h3>H0w</h3></li>"),
      caret: "text:H0w@0",
      source: "D19, spec 5.7",
    },
    {
      name: "D19: after text ending in a line break (TBH)",
      stored: LI("T0w<br><h3>H0w</h3>"),
      place: at("H0w", 0),
      action: enter,
      write: W("<li>T0w<br /><br /><h3>H0w</h3></li>"),
      caret: "text:H0w@0",
      source: "derived (D19: only the empty line's break); measured",
    },
    {
      name: "Enter at a quote's start after text",
      stored: LI(`T0w${QUOTE("Q0w")}`),
      place: at("Q0w", 0),
      action: enter,
      write: W("<li>T0w<blockquote><p></p><p>Q0w</p></blockquote></li>"),
      caret: "text:Q0w@0",
      source: "from M32a (write and caret); spec 5.7, section 10",
    },
    {
      name: "Enter at a code block's start after text",
      stored: LI("T0w<pre><code>C0w</code></pre>"),
      place: at("C0w", 0),
      action: enter,
      write: W("<li>T0w<pre><code>\nC0w</code></pre></li>"),
      caret: "text:C0w@0",
      source: "from M32b (write and caret); spec 5.7, section 10",
    },
  ]);
});

describe("Enter and Shift+Enter in a lined quote (D19, D2, K12, D18, V17)", () => {
  runRows([
    {
      name: "Enter at a line's start in a quote",
      stored: "<blockquote><p>X1w</p>X2w</blockquote>",
      place: at("X2w", 0),
      action: enter,
      write: "<blockquote><p>X1w</p><br />X2w</blockquote>",
      source: "D19, spec 5.7",
    },
    {
      name: "the same after a rule",
      stored: "<blockquote><hr>X2w<ul><li>Yw</li></ul></blockquote>",
      place: at("X2w", 0),
      action: enter,
      write: "<blockquote><hr /><br />X2w<ul><li>Yw</li></ul></blockquote>",
      source: "derived (D2, D19); measured",
    },
    {
      name: "Enter at a line's end in a lined quote keeps a paragraph",
      stored: "<blockquote><p>X0w</p>X1w</blockquote>",
      place: at("X1w"),
      action: enter,
      write: "<blockquote><p>X0w</p>X1w<p></p></blockquote>",
      source: "from M36a (carry); D19, K12",
    },
    {
      name: "Enter at a paragraph's end in a lined quote",
      stored: "<blockquote><p>X0w</p>X1w</blockquote>",
      place: at("X0w"),
      action: enter,
      write: "<blockquote><p>X0w</p><p></p>X1w</blockquote>",
      caret: "element:paragraph@0",
      source: "from M36b (T19.2); D2",
    },
    {
      name: "Enter at the root quote's el1",
      stored: "<blockquote>X1w<p>X2w</p></blockquote>",
      place: containerPoint("X1w", 1),
      action: enter,
      write: "<blockquote>X1w<p></p><p>X2w</p></blockquote>",
      source: "from M31-root el1-Enter (carry); D18",
    },
    {
      name: "V17: Shift+Enter after a line's trailing break",
      stored: "<blockquote><p>X1w</p>X2w<br></blockquote>",
      place: then(at("X2w"), keys("{ArrowRight}")),
      action: shiftEnter,
      write: "<blockquote><p>X1w</p>X2w<br /><br /></blockquote>",
      source: "spec 5.7, check V17",
    },
    {
      name: "V17: by beforeinput",
      stored: "<blockquote><p>X1w</p>X2w<br></blockquote>",
      place: then(at("X2w"), keys("{ArrowRight}")),
      action: lineBreakInput,
      write: "<blockquote><p>X1w</p>X2w<br /><br /></blockquote>",
      source: "spec 5.7",
    },
    {
      name: "Shift+Enter from a line with no trailing break",
      stored: "<blockquote><p>X1w</p>X2w</blockquote>",
      place: at("X2w"),
      action: shiftEnter,
      write: "<blockquote><p>X1w</p>X2w<br /></blockquote>",
      source: "from M40; spec 5.7",
    },
  ]);

  test("an empty paragraph that kept the caret stays a paragraph when the caret leaves and the quote is edited again", async () => {
    const stored = "<blockquote><p>X0w</p>X1w</blockquote>";
    const onChange = await mount(stored);
    await at("X1w")();
    onChange.mockClear();
    await enter();
    expect(onChange.mock.calls.length, "Enter: one onChange").toBe(1);
    expect(short(lastHtml(onChange))).toBe(
      "<blockquote><p>X0w</p>X1w<p></p></blockquote>"
    );
    const editor = editorOf()!;
    const depth = undoDepth().undo;
    await at("X0w", 3)();
    await settle();
    expect(onChange.mock.calls.length, "the click: no onChange").toBe(1);
    expect(undoDepth().undo, "the click: no undo step").toBe(depth);
    const children = editor.getEditorState().read(() => {
      const quote = $getRoot().getFirstChild();
      return $isElementNode(quote)
        ? quote.getChildren().map((child) => ({
            type: child.getType(),
            inner: $isElementNode(child)
              ? child.getChildren().map((inner) => inner.getType())
              : [],
          }))
        : [];
    });
    const last = children[children.length - 1];
    expect(last.type, "the empty paragraph stays").toBe("paragraph");
    expect(
      last.inner.every((type) => type === "linebreak"),
      "it holds nothing but a line break"
    ).toBe(true);
    expect(
      children.filter((child) => child.type === "cms-line").length,
      "one line, X1w's"
    ).toBe(1);
    await enter();
    expect(onChange.mock.calls.length, "Enter: one onChange").toBe(2);
    expect(short(lastHtml(onChange))).toBe(
      "<blockquote><p>X0w</p><p></p>X1w<p></p></blockquote>"
    );
    await keys("{Control>}z{/Control}")();
    await keys("{Control>}z{/Control}")();
    expect(short(lastHtml(onChange)), "two undos restore the value").toBe(
      stored
    );
  });
});

describe("Tab and Shift+Tab leave the field (D2)", () => {
  for (const [name, key] of [
    ["Tab leaves the field and edits nothing", "{Tab}"],
    ["Shift+Tab", "{Shift>}{Tab}{/Shift}"],
  ] as const) {
    test(name, async () => {
      await expectEdit({
        stored: TR,
        place: at("T0w", 1),
        action: keys(key),
        write: null,
        source: "D2",
      });
      expect(document.activeElement).not.toBe(editable());
    });
  }
});

describe("a newline as text, K18, F9 (section 9)", () => {
  runRows([
    {
      name: "K15: a newline sent as text after a trailing line break",
      stored: LI(`${QUOTE("Q0w")}T1w<br>`),
      // the item's end, after the line's last break
      place: itemPoint(1, 3),
      action: newlineInput,
      write: W(`<li>${QUOTE("Q0w")}T1w<br /><br /></li>`),
      caret: "element:listitem@4",
      source: "from P20 (carry, against M56); section 9",
    },
    {
      name: "K16: a newline sent as text after a line break before a quote",
      stored: LI(`T0w<br>${QUOTE("Q2w")}`),
      // directly before the quote
      place: itemPoint(1, 2),
      action: newlineInput,
      write: W(`<li>T0w<br /><br />${QUOTE("Q2w")}</li>`),
      caret: "element:listitem@3",
      source: "from P21 (carry, against M57); section 9",
    },
    {
      // P24 records Enter and the letter as one row (two onChanges, its
      // undo-false shape); here Enter is the edit, its write the state
      // P24's undo of the letter leaves, and the letter the typed write
      name: "K18: Enter at a heading's end in a mixed item, then a letter",
      stored: LI("<h3>H0w</h3>T1w"),
      place: at("H0w"),
      action: enter,
      write: W("<li><h3>H0w</h3><br />T1w</li>"),
      typed: W("<li><h3>H0w</h3>k<br />T1w</li>"),
      source: "from P24 (carry; write and typed); section 9",
    },
    {
      name: "F9: Enter at a quote's own text end in a quote that leads a nested item",
      stored:
        "<ul><li>Zw<ul><li><blockquote><p>Q0w</p>X1w</blockquote></li></ul></li></ul>",
      place: at("X1w"),
      action: enter,
      write:
        "<ul><li>Zw<ul><li><blockquote><p>Q0w</p>X1w<p></p></blockquote></li></ul></li></ul>",
      typed:
        "<ul><li>Zw<ul><li><blockquote><p>Q0w</p>X1w<p>k</p></blockquote></li></ul></li></ul>",
      source: "from P25 (carry; write and typed, as P24); section 9",
    },
  ]);
});

describe("indent and outdent over two lines of one item (D2)", () => {
  runRows([
    {
      name: "an indent over two lines of one item moves the item once",
      stored: TQT,
      place: range("T0w", 1, "T2w", 1),
      action: dispatch(INDENT_CONTENT_COMMAND),
      write: `<ul><li>Pw<ul><li>T0w${QUOTE("Q1w")}T2w</li></ul></li><li>Nw</li></ul>`,
      source: "from M43; D2",
    },
    {
      name: "an outdent over two lines of one item moves the item once",
      stored: `<ul><li>Aw<ul><li>T0w${QUOTE("Q1w")}T2w</li></ul></li></ul>`,
      place: range("T0w", 1, "T2w", 1),
      action: dispatch(OUTDENT_CONTENT_COMMAND),
      write: `<ul><li>Aw</li><li>T0w${QUOTE("Q1w")}T2w</li></ul>`,
      source: "from M60; D2",
    },
  ]);
});

/** A range from `word` at `offset` to the end of the item that holds it. */
const toItemEnd =
  (word: string, offset: number): Step =>
  async () => {
    await click(editable()!);
    await act(async () => {
      editorOf()!.update(() => {
        const text = $getRoot()
          .getAllTextNodes()
          .find((node) => node.getTextContent() === word);
        expect(text, word).toBeDefined();
        let item: LexicalNode | null = text!;
        while (item !== null && item.getType() !== "listitem") {
          item = item.getParent();
        }
        expect(item, "the item").not.toBeNull();
        const end = $baselinePoint(
          item as ElementNode,
          baselineChildCount(item as ElementNode)
        );
        const selection = $createRangeSelection();
        selection.anchor.set(text!.getKey(), offset, "text");
        selection.focus.set(end.key, end.offset, "element");
        $setSelection(selection);
      });
    });
    await settle();
  };

describe("Enter over a range: M1 and E1 (T9.2 M1 and E; spec 5.7)", () => {
  const H = (rest: string, before = "") =>
    W(`<li>${before}<h3></h3>${rest}</li>`);
  const M1: Array<[string, string, string, string, string]> = [
    // [shape, stored item, word, write, typed]
    ["HT", "<h3>H0w</h3>T1w", "H0w", H("<br />"), H("k<br />")],
    ["HQ", `<h3>H0w</h3>${QUOTE("Q1w")}`, "H0w", H("<br />"), H("k<br />")],
    ["HH", "<h3>H0w</h3><h3>H1w</h3>", "H0w", H("<br />"), H("k<br />")],
    [
      "HC",
      "<h3>H0w</h3><pre><code>C1w</code></pre>",
      "H0w",
      H("<br />"),
      H("k<br />"),
    ],
    [
      "HL",
      "<h3>H0w</h3><ul><li>L1w</li></ul>",
      "H0w",
      H("<br /><ul><li>L1w</li></ul>"),
      H("k<br /><ul><li>L1w</li></ul>"),
    ],
    ["HR", "<h3>H0w</h3><hr>", "H0w", H("<br />"), H("k<br />")],
    ["HB", "<h3>H0w</h3><br>", "H0w", H("<br />"), H("k<br />")],
    [
      "RH",
      "<hr><h3>H1w</h3>",
      "H1w",
      H("<br />", "<hr />"),
      H("k<br />", "<hr />"),
    ],
    [
      "BH",
      "<br><h3>H1w</h3>",
      "H1w",
      H("<br />", "<br />"),
      H("k<br />", "<br />"),
    ],
  ];
  runRows([
    {
      name: "E1: Enter over T0w's end to Q1w@1 is the join, then Enter",
      stored: TQT,
      place: range("T0w", 3, "Q1w", 1),
      action: enter,
      write: "<ul><li>Pw</li><li>T0w</li><li>1w<br />T2w</li><li>Nw</li></ul>",
      source: "check 2, E1 (T9.2)",
    },
    {
      name: "M1: a heading's whole text in an item, Enter (H)",
      stored: LI("<h3>H0w</h3>"),
      place: range("H0w", 0, "H0w", 3),
      action: enter,
      write: H("<br />"),
      typed: H("k<br />"),
      source: "spec 5.7 (M1 row), check 2, M1; measured",
    },
    ...M1.map(
      ([shape, item, word, write, typed]): Row => ({
        name: `M1: ${shape}, from the heading's start to the item's end, Enter`,
        stored: LI(item),
        place: toItemEnd(word, 0),
        action: enter,
        write,
        typed,
        source: "spec 5.7 (M1 row), T9.2 M1; measured at 451f20f04",
      })
    ),
  ]);

  test("E1: the same with Shift+Enter is the join, then Shift+Enter (the oracle)", async () => {
    const oracle = await recordEdit(
      {
        stored: TQT,
        place: range("T0w", 3, "Q1w", 1),
        action: then(backspace, shiftEnter),
      },
      { short: true }
    );
    expect(oracle.calls, "the oracle's two edits").toBe(2);
    await expectEdit({
      stored: TQT,
      place: range("T0w", 3, "Q1w", 1),
      action: shiftEnter,
      write: oracle.write,
      source: "T9.2 E",
    });
  });
});

describe("T23.1 by Enter: a range ending at a break-led line's start after a block (T30.2, T30.3, T32.2)", () => {
  const CELLS: Array<[string, string, string]> = [
    // [name, stored, word the range starts in at offset 2]
    ["a heading, then a break-only line", LI("<h3>H0w</h3><br>"), "H0w"],
    [
      "a code block, then a break-only line",
      LI("<pre><code>C0w</code></pre><br>"),
      "C0w",
    ],
    ["a heading, then a break-led line", LI("<h3>H0w</h3><br>Tw"), "H0w"],
    [
      "a heading in a quote, then a break-led line",
      "<blockquote><h3>H0w</h3><br>Tw</blockquote>",
      "H0w",
    ],
  ];
  for (const [name, stored, word] of CELLS) {
    for (const [key, action] of [
      ["Enter", enter],
      ["Shift+Enter", shiftEnter],
    ] as const) {
      test(`${name}, ${key}: the oracle (Backspace, then the key)`, async () => {
        const place = rangeToLineStart(word, 2);
        const oracle = await recordEdit(
          { stored, place, action: then(backspace, action) },
          { short: true }
        );
        await expectEdit({
          stored,
          place,
          action,
          write: oracle.write,
          typed: oracle.typed,
          source: "T23.1, T30.3 (every entry point, Enter included); T11.4",
        });
      });
    }
  }
});

describe("M2: a rule-led root quote (spec 5.7)", () => {
  const RQ = "<blockquote><hr>X2w</blockquote>";
  runRows([
    {
      name: "M2: a letter before the rule of a rule-led root quote",
      stored: RQ,
      place: containerPoint("X2w", { before: 0 }),
      action: letter,
      write: "<blockquote>k<hr />X2w</blockquote>",
      source: "spec 5.7 (M2 row); equals base-m2",
    },
    {
      name: "M2: Enter there",
      stored: RQ,
      place: containerPoint("X2w", { before: 0 }),
      action: enter,
      write: "<blockquote><p></p><hr />X2w</blockquote>",
      source: "spec 5.7; equals base-m2",
    },
    {
      name: "M2: Shift+Enter there, then a letter",
      stored: RQ,
      place: containerPoint("X2w", { before: 0 }),
      action: shiftEnter,
      write: "<blockquote><br /><hr />X2w</blockquote>",
      typed: "<blockquote><br />k<hr />X2w</blockquote>",
      source: "spec 5.7, accepted under D18",
    },
  ]);
});

describe("16.8: Enter and Shift+Enter over a range with an end on the root are the removal, then the key (T11.4)", () => {
  const base = enterRangeRootJson as Record<
    string,
    { write: string | null; typed: string }
  >;
  for (const cell of enterRangeRootCells()) {
    test(cell.id, async () => {
      const oracle = await recordEdit(
        { ...cell, action: then(backspace, cell.action) },
        { short: true }
      );
      const edit = await expectEdit({
        stored: cell.stored,
        place: cell.place,
        action: cell.action,
        writeMatches: () => {},
        typed: undefined,
        source: "16.8, T11.4",
      });
      expect(edit.write, "the oracle's write: Backspace, then the key").toBe(
        oracle.write
      );
      const typed = await recordEdit(cell, { short: true });
      expect(typed.typed, "a letter after it lands as after the oracle").toBe(
        oracle.typed
      );
      expect(base[cell.id], "the fixture cell").toBeDefined();
      expect(
        edit.write,
        `differs from <base>'s write (${base[cell.id].write})`
      ).not.toBe(base[cell.id].write);
    });
  }
});
