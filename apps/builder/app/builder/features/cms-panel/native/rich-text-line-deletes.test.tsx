import { describe, expect, test } from "vitest";
import { $getSelection, $isRangeSelection, type LexicalNode } from "lexical";
import { isLinedContainer } from "./rich-text-line-node";
import {
  at,
  backspace,
  beside,
  del,
  expectEdit,
  IMG,
  imageNode,
  itemPoint,
  keys,
  letter,
  LI,
  lineBack,
  lineForward,
  mount,
  nodeSelect,
  range,
  recordEdit,
  short,
  type Step,
  then,
  W,
  WJ,
  WN,
  wordBack,
  wordForward,
} from "./rich-text-line-test-kit";
import { undoDepth } from "./rich-text-line-test-kit-branch";
import { keyChangesNothingCells } from "./rich-text-line-cells-key-changes-nothing";
import keyChangesNothingJson from "./__fixtures__/rich-text-line-base-key-changes-nothing.json";
import { editorOf, lastHtml } from "./rich-text-test-harness";

describe("the delete precedence (5.8)", () => {
  test("the empty line's rule runs before Lexical's join", async () => {
    await expectEdit({
      stored: LI("T0w<hr>"),
      place: itemPoint(1, 2),
      action: backspace,
      write: W("<li>T0w</li>"),
      source: "spec 5.3",
    });
  });

  test("the line break at a block's edge runs before Lexical's merge", async () => {
    await expectEdit({
      stored: LI("<blockquote><p>Q0w</p></blockquote><br>"),
      place: at("Q0w"),
      action: del,
      write: W("<li><blockquote><p>Q0w</p></blockquote></li>"),
      source: "D3, check V6",
    });
  });

  test("the item-start join runs before Lexical's delete", async () => {
    await expectEdit({
      stored:
        "<ul><li>X0w<blockquote><p>X1w</p><hr></blockquote></li><li>Nw</li></ul>",
      place: at("Nw", 0),
      action: backspace,
      write: "<ul><li>X0w<blockquote><p>X1w</p></blockquote>Nw</li></ul>",
      source: "check V12",
    });
  });
});

type Row = {
  name: string;
  stored: string;
  place: Step;
  action: Step;
  write: string | null;
  caret?: string;
  source: string;
};

const RBQ = LI("<hr><br><blockquote><p>Q2w</p></blockquote>");
const QB = LI("<blockquote><p>Q0w</p></blockquote><br>");
const BQ = LI("<br><blockquote><p>Q1w</p></blockquote>");
const QR = LI("<blockquote><p>Q0w</p></blockquote><hr>");
const RQ = LI("<hr><blockquote><p>Q1w</p></blockquote>");
const QRT = LI("<blockquote><p>Q0w</p></blockquote><hr>T2w");
const TRQ = LI("T0w<hr><blockquote><p>Q2w</p></blockquote>");
const TR = LI("T0w<hr>");
const V12 =
  "<ul><li>X0w<blockquote><p>X1w</p><hr></blockquote></li><li>Nw</li></ul>";

const ROWS: Row[] = [
  {
    name: "D3 fourth case: RBQ Backspace",
    stored: RBQ,
    place: at("Q2w", 0),
    action: backspace,
    write: W("<li><hr /><blockquote><p>Q2w</p></blockquote></li>"),
    source: "D3, check V6",
  },
  {
    name: "RBQ Ctrl+Backspace",
    stored: RBQ,
    place: at("Q2w", 0),
    action: wordBack,
    write: W("<li><hr /><blockquote><p>Q2w</p></blockquote></li>"),
    source: "D3 (word form)",
  },
  {
    name: "RBQ line form",
    stored: RBQ,
    place: at("Q2w", 0),
    action: lineBack,
    write: W("<li><hr /><blockquote><p>Q2w</p></blockquote></li>"),
    source: "D3 (line form)",
  },
  {
    name: "QBQ Backspace",
    stored: LI(
      "<blockquote><p>Q0w</p></blockquote><br><blockquote><p>Q2w</p></blockquote>"
    ),
    place: at("Q2w", 0),
    action: backspace,
    write: W(
      "<li><blockquote><p>Q0w</p></blockquote><blockquote><p>Q2w</p></blockquote></li>"
    ),
    source: "from M50; check V6 (QBQ: the head's write)",
  },
  {
    name: "BQB Backspace",
    stored: LI("<br><blockquote><p>Q1w</p></blockquote><br>"),
    place: at("Q1w", 0),
    action: backspace,
    write: W("<li><blockquote><p>Q1w</p></blockquote><br /></li>"),
    source: "D3, spec 5.7",
  },
  {
    name: "QB Delete",
    stored: QB,
    place: at("Q0w"),
    action: del,
    write: W("<li><blockquote><p>Q0w</p></blockquote></li>"),
    source: "check V6",
  },
  {
    name: "QB Ctrl+Delete (round 9)",
    stored: QB,
    place: at("Q0w"),
    action: wordForward,
    write: W("<li><blockquote><p>Q0w</p></blockquote></li>"),
    source: "D3",
  },
  {
    name: "QB line form",
    stored: QB,
    place: at("Q0w"),
    action: lineForward,
    write: W("<li><blockquote><p>Q0w</p></blockquote></li>"),
    source: "D3",
  },
  {
    name: "QBT Delete",
    stored: LI("<blockquote><p>Q0w</p></blockquote><br>T2w"),
    place: at("Q0w"),
    action: del,
    write: W("<li><blockquote><p>Q0w</p></blockquote>T2w</li>"),
    source: "D3, check V6",
  },
  {
    name: "HB Delete",
    stored: LI("<h3>H0w</h3><br>"),
    place: at("H0w"),
    action: del,
    write: W("<li><h3>H0w</h3></li>"),
    source: "check V6",
  },
  {
    name: "BQ el1 Delete (round 9)",
    stored: BQ,
    place: itemPoint(1, 1),
    action: del,
    write: W("<li><br />Q1w</li>"),
    caret: "text:Q1w@0",
    source: "spec 5.7; P7-Delete (carry)",
  },
  {
    name: "BQ el1 Ctrl+Delete (round 9)",
    stored: BQ,
    place: itemPoint(1, 1),
    action: wordForward,
    write: W("<li><br />Q1w</li>"),
    caret: "text:Q1w@0",
    source: "spec 5.7; P7-Ctrl+Delete (carry)",
  },
  // P7-Backspace, P7-Ctrl+Backspace, P7-lineBack: the write only (the
  // caret waits on a ruling, Task 14's P record)
  {
    name: "BQ el1 Backspace removes the line break only",
    stored: BQ,
    place: itemPoint(1, 1),
    action: backspace,
    write: W("<li><blockquote><p>Q1w</p></blockquote></li>"),
    source: "P7-Backspace (carry): D18, 5.4, D3 fourth case",
  },
  {
    name: "BQ el1 Ctrl+Backspace",
    stored: BQ,
    place: itemPoint(1, 1),
    action: wordBack,
    write: W("<li><blockquote><p>Q1w</p></blockquote></li>"),
    source: "P7-Ctrl+Backspace (carry): the twin rule",
  },
  {
    name: "BQ el1 line form backward",
    stored: BQ,
    place: itemPoint(1, 1),
    action: lineBack,
    write: W("<li><blockquote><p>Q1w</p></blockquote></li>"),
    source: "P7-lineBack (carry)",
  },
  {
    name: "BQ el1 line form forward removes nothing",
    stored: BQ,
    place: itemPoint(1, 1),
    action: lineForward,
    write: null,
    caret: "element:listitem@1",
    source: "P7-lineForward (carry): 5.8 F2",
  },
  {
    name: "D9: Delete at a quote's end removes the rule after",
    stored: QR,
    place: at("Q0w"),
    action: del,
    write: W("<li><blockquote><p>Q0w</p></blockquote></li>"),
    source: "derived (D9); measured",
  },
  {
    name: "D9: the same from QR@1",
    stored: QR,
    place: itemPoint(1, 1),
    action: del,
    write: W("<li><blockquote><p>Q0w</p></blockquote></li>"),
    source: "D9",
  },
  {
    name: "D9: Ctrl+Delete from QR@1",
    stored: QR,
    place: itemPoint(1, 1),
    action: wordForward,
    write: W("<li><blockquote><p>Q0w</p></blockquote></li>"),
    source: "D9, spec 5.7",
  },
  {
    name: "D9: Backspace at a quote's start removes the rule before",
    stored: RQ,
    place: at("Q1w", 0),
    action: backspace,
    write: W("<li><blockquote><p>Q1w</p></blockquote></li>"),
    source: "derived (D9); measured",
  },
  {
    name: "D9: the same from RQ@1",
    stored: RQ,
    place: itemPoint(1, 1),
    action: backspace,
    write: W("<li><blockquote><p>Q1w</p></blockquote></li>"),
    source: "D9",
  },
  {
    name: "D9: Ctrl+Backspace from RQ@1",
    stored: RQ,
    place: itemPoint(1, 1),
    action: wordBack,
    write: W("<li><blockquote><p>Q1w</p></blockquote></li>"),
    source: "D9, spec 5.7",
  },
  {
    name: "D9: a heading",
    stored: LI("<h3>H0w</h3><hr>"),
    place: at("H0w"),
    action: del,
    write: W("<li><h3>H0w</h3></li>"),
    source: "derived (D9); measured",
  },
  {
    name: "D9: a code block",
    stored: LI("<hr><pre><code>C1w</code></pre>"),
    place: at("C1w", 0),
    action: backspace,
    write: W("<li><pre><code>C1w</code></pre></li>"),
    source: "derived (D9); measured",
  },
  {
    name: "D9 in a lined quote",
    stored: "<blockquote>X0w<h3>H1w</h3><hr></blockquote>",
    place: at("H1w"),
    action: del,
    write: "<blockquote>X0w<h3>H1w</h3></blockquote>",
    source: "derived (D9); measured",
  },
  {
    name: "D9 is R1's only in a lined container: a quote and a rule at the root keep the head's Delete",
    stored: "<blockquote><p>Q0w</p></blockquote><hr><p>Nw</p>",
    place: at("Q0w"),
    action: del,
    write: null,
    source: "from M63; D9 (round 7), R2",
  },
  {
    name: "V5: a line break before a rule keeps (word form)",
    stored: LI("<br><hr>"),
    place: at("Nw", 0),
    action: wordBack,
    write: WN("<li><br />Nw</li>"),
    source: "check V5",
  },
  {
    name: "V5: QRT Ctrl+Delete",
    stored: QRT,
    place: at("Q0w"),
    action: wordForward,
    write: W("<li><blockquote><p>Q0w</p></blockquote>T2w</li>"),
    source: "check V5",
  },
  {
    name: "V5: TRQ Ctrl+Delete",
    stored: TRQ,
    place: at("T0w"),
    action: wordForward,
    write: W("<li>T0w<blockquote><p>Q2w</p></blockquote></li>"),
    source: "check V5, D5",
  },
  {
    name: "V5: TRQ Ctrl+Backspace",
    stored: TRQ,
    place: at("Q2w", 0),
    action: wordBack,
    write: W("<li>T0w<blockquote><p>Q2w</p></blockquote></li>"),
    source: "check V5, D5",
  },
  {
    name: "V5: TRQ line form forward",
    stored: TRQ,
    place: at("T0w"),
    action: lineForward,
    write: W("<li>T0w<blockquote><p>Q2w</p></blockquote></li>"),
    source: "D5 (word and line forms)",
  },
  {
    name: "V5: TRQ line form backward",
    stored: TRQ,
    place: at("Q2w", 0),
    action: lineBack,
    write: W("<li>T0w<blockquote><p>Q2w</p></blockquote></li>"),
    source: "D5 (word and line forms)",
  },
  {
    name: "KS1: TRT Ctrl+Backspace",
    stored: LI("T0w<hr>T2w"),
    place: at("T2w", 0),
    action: wordBack,
    write: W("<li>T0wT2w</li>"),
    source: "from M9; spec 5.7",
  },
  {
    name: "KS1: QRT Ctrl+Backspace, only the rule goes",
    stored: QRT,
    place: at("T2w", 0),
    action: wordBack,
    write: W("<li><blockquote><p>Q0w</p></blockquote>T2w</li>"),
    source: "derived (spec 5.7); measured",
  },
  {
    name: "KS2: BRT Backspace",
    stored: LI("<br><hr>T2w"),
    place: at("T2w", 0),
    action: backspace,
    write: W("<li><br />T2w</li>"),
    source: "from M10a; spec 5.7",
  },
  {
    name: "KS3: TR Nw@0 Backspace",
    stored: TR,
    place: at("Nw", 0),
    action: backspace,
    write: WN("<li>T0wNw</li>"),
    source: "from M11a; spec 5.7",
  },
  {
    name: "KS3: TR Nw@0 Ctrl+Backspace",
    stored: TR,
    place: at("Nw", 0),
    action: wordBack,
    write: WN("<li>T0wNw</li>"),
    source: "from M11a (M11e equal); 5.8",
  },
  {
    name: "KS3: TR Nw@0 line form",
    stored: TR,
    place: at("Nw", 0),
    action: lineBack,
    write: WN("<li>T0wNw</li>"),
    source: "from M11a (M11f equal); 5.8",
  },
  {
    name: "KS3: TQR Nw@0 Backspace",
    stored: LI("T0w<blockquote><p>Q1w</p></blockquote><hr>"),
    place: at("Nw", 0),
    action: backspace,
    write: WN("<li>T0w<blockquote><p>Q1w</p></blockquote>Nw</li>"),
    source: "from M11b; spec 5.7",
  },
  {
    name: "KS3: ol TR",
    stored: "<ol><li>Pw</li><li>T0w<hr></li><li>Nw</li></ol>",
    place: at("Nw", 0),
    action: backspace,
    write: "<ol><li>Pw</li><li>T0wNw</li></ol>",
    source: "from M11c; spec 5.7",
  },
  {
    name: "FS3: a range Backspace",
    stored: TR,
    place: range("Pw", 1, "T0w", 2),
    action: backspace,
    write: "<ul><li>Pw<hr /></li><li>Nw</li></ul>",
    source: "from M11d; spec 5.7",
  },
  {
    name: "KS4: depth 2 RT",
    stored:
      "<ul><li>Aw<ul><li>Pw</li><li><hr>T1w</li><li>Nw</li></ul></li><li>Zw</li></ul>",
    place: at("T1w", 0),
    action: backspace,
    write:
      "<ul><li>Aw<ul><li>Pw</li></ul></li><li><hr />T1w<ul><li>Nw</li></ul></li><li>Zw</li></ul>",
    source: "from M12a; spec 5.7",
  },
  {
    name: "KS4: depth 2 TRT",
    stored:
      "<ul><li>Aw<ul><li>Pw</li><li>T0w<hr>T2w</li><li>Nw</li></ul></li><li>Zw</li></ul>",
    place: at("T2w", 0),
    action: backspace,
    write:
      "<ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<hr />T2w<ul><li>Nw</li></ul></li><li>Zw</li></ul>",
    source: "from M12b; spec 5.7",
  },
  {
    name: "V12: Backspace after an item whose quote ends in a rule",
    stored: V12,
    place: at("Nw", 0),
    action: backspace,
    write: "<ul><li>X0w<blockquote><p>X1w</p></blockquote>Nw</li></ul>",
    source: "check V12",
  },
  {
    name: "V12: Ctrl+Backspace",
    stored: V12,
    place: at("Nw", 0),
    action: wordBack,
    write: "<ul><li>X0w<blockquote><p>X1w</p></blockquote>Nw</li></ul>",
    source: "5.8 (word and line forms join)",
  },
  {
    name: "V12: line form",
    stored: V12,
    place: at("Nw", 0),
    action: lineBack,
    write: "<ul><li>X0w<blockquote><p>X1w</p></blockquote>Nw</li></ul>",
    source: "5.8",
  },
  {
    name: "map 1 group 9: an item holding only a rule",
    stored: "<ul><li><hr></li><li>Nw</li></ul>",
    place: at("Nw", 0),
    action: backspace,
    write: "<ul><li>Nw</li></ul>",
    source: "derived from M11a; measured",
  },
  {
    name: "P1: Backspace at a quote that leads the first item",
    stored: "<ul><li><blockquote><p>Q0w</p></blockquote>T1w</li></ul>",
    place: at("Q0w", 0),
    action: backspace,
    write: null,
    caret: "text:Q0w@0",
    source: "from P12a (confirm); spec 5.7, 5.5",
  },
  {
    name: "P4: the code form",
    stored: "<ul><li><pre><code>C0w</code></pre>T1w</li></ul>",
    place: at("C0w", 0),
    action: backspace,
    write: "<ul><li>C0w<br />T1w</li></ul>",
    caret: "text:C0w@0",
    source: "from P12b (already ruled); spec 5.7, 5.5",
  },
  {
    name: "Backspace at a nested first item's line",
    stored: "<ul><li>Aw<ul><li>T0w<hr></li><li>Nw</li></ul></li></ul>",
    place: at("T0w", 0),
    action: backspace,
    write: "<ul><li>Aw</li><li>T0w<hr /><ul><li>Nw</li></ul></li></ul>",
    source: "from M1a; 5.8 Measure",
  },
  {
    name: "the same, word form",
    stored: "<ul><li>Aw<ul><li>T0w<hr></li><li>Nw</li></ul></li></ul>",
    place: at("T0w", 0),
    action: wordBack,
    write: "<ul><li>AwT0w<hr /><ul><li>Nw</li></ul></li></ul>",
    caret: "text:AwT0w@2",
    source: "from M1b (ruled base); 5.8",
  },
  {
    name: "Backspace at a top-level first item's line",
    stored: "<ul><li>T0w<hr></li><li>Nw</li></ul>",
    place: at("T0w", 0),
    action: backspace,
    write: "<p>T0w</p><hr /><ul><li>Nw</li></ul>",
    source: "from M1c; 5.8",
  },
  {
    name: "Backspace at a quote's first line",
    stored: "<p>Pw</p><blockquote>X1w<hr></blockquote>",
    place: at("X1w", 0),
    action: backspace,
    write: "<p>PwX1w</p><hr />",
    caret: "text:PwX1w@2",
    source: "from M2a (ruled base); 5.8 Measure",
  },
  {
    name: "the same, a quote with a paragraph",
    stored: "<p>Pw</p><blockquote>X1w<p>X2w</p></blockquote>",
    place: at("X1w", 0),
    action: backspace,
    write: "<p>PwX1w</p><p>X2w</p>",
    caret: "text:PwX1w@2",
    source: "from M2b (ruled base); 5.8",
  },
];

describe("deletes at a resolved caret (D3 fourth case, D9, D5, V5, V6, V12, KS1 to KS4)", () => {
  for (const row of ROWS) {
    test(row.name, async () => {
      await expectEdit({
        stored: row.stored,
        place: row.place,
        action: row.action,
        write: row.write,
        caret: row.caret,
        source: row.source,
      });
    });
  }
});

describe("an image at a lined item's end, Delete (M27, T27, T28)", () => {
  const stored = LI(`<blockquote><p>Q0w</p></blockquote>${IMG}`);
  test("a caret directly after an image that ends a lined item: Delete joins the next item, the image stays", async () => {
    await expectEdit({
      stored,
      place: imageNode(),
      action: del,
      write: WN("<li><blockquote><p>Q0w</p></blockquote><img />Nw</li>"),
      source: "M27 (carry, re-ruled T27.2); check 3's edge-child rule",
    });
  });
  test("a caret directly after an image that ends a lined item: Backspace removes the image", async () => {
    await expectEdit({
      stored,
      place: imageNode(),
      action: backspace,
      write: W("<li><blockquote><p>Q0w</p></blockquote></li>"),
      source:
        "M21a (T28; the caret is Task 16's); check 3 (only Backspace just after an image removes it)",
    });
  });
  describe("a node selection (D15)", () => {
    test("an image node-selected at a lined item's end, Backspace: the image goes (a state only code makes)", async () => {
      await expectEdit({
        stored,
        place: nodeSelect("cms-image"),
        action: backspace,
        write: W("<li><blockquote><p>Q0w</p></blockquote></li>"),
        typed: W("<li><blockquote><p>Q0wk</p></blockquote></li>"),
        source: "M21a (T28; the caret is Task 16's); D15",
      });
    });
    test("an image node-selected at a lined item's end, Delete: the image goes, Nw stays its own item (a state only code makes)", async () => {
      await expectEdit({
        stored,
        place: nodeSelect("cms-image"),
        action: del,
        write: W("<li><blockquote><p>Q0w</p></blockquote></li>"),
        source: "D15; T28",
      });
    });
  });
});

/**
 * The delete cells at an empty line (5.3, 5.7): "join" cells have no rule
 * in the delete's direction, "rule" cells remove the one rule. The word
 * and line forms give the character form's write (5.7).
 */
type Cell = { write: string; join: boolean };
const EMPTY_LINE: ReadonlyArray<readonly [string, string, number, Cell, Cell]> =
  [
    [
      "TR@2",
      LI("T0w<hr>"),
      2,
      { write: W("<li>T0w</li>"), join: false },
      { write: WN("<li>T0w<hr />Nw</li>"), join: true },
    ],
    [
      "RT@0",
      LI("<hr>T1w"),
      0,
      { write: WJ("<li>Pw<hr />T1w</li>"), join: true },
      { write: W("<li>T1w</li>"), join: false },
    ],
    [
      "RR@0",
      LI("<hr><hr>"),
      0,
      { write: WJ("<li>Pw<hr /><hr /></li>"), join: true },
      { write: W("<li><hr /></li>"), join: false },
    ],
    [
      "RR@1",
      LI("<hr><hr>"),
      1,
      { write: W("<li><hr /></li>"), join: false },
      { write: W("<li><hr /></li>"), join: false },
    ],
    [
      "RR@2",
      LI("<hr><hr>"),
      2,
      { write: W("<li><hr /></li>"), join: false },
      // for lineForward ruled, not built at the carry (spec 5.7; T14.14)
      { write: WN("<li><hr /><hr />Nw</li>"), join: true },
    ],
  ];

/** The action, with every selection committed during it recorded. */
const recordingPoints =
  (action: Step, points: string[]): Step =>
  async () => {
    const editor = editorOf()!;
    const off = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) === false) {
          return;
        }
        for (const point of [selection.anchor, selection.focus]) {
          const node: LexicalNode = point.getNode();
          if (isLinedContainer(node)) {
            points.push(`${node.getType()}@${point.offset}`);
          }
        }
      });
    });
    try {
      await action();
    } finally {
      off();
    }
  };

describe("the delete cells at an empty line (5.3, 5.7)", () => {
  const BACK: ReadonlyArray<readonly [string, Step]> = [
    ["Backspace", backspace],
    ["Ctrl+Backspace", wordBack],
    ["lineBack", lineBack],
  ];
  const FORWARD: ReadonlyArray<readonly [string, Step]> = [
    ["Delete", del],
    ["Ctrl+Delete", wordForward],
    ["lineForward", lineForward],
  ];
  for (const [point, stored, offset, back, forward] of EMPTY_LINE) {
    for (const [keys, cell] of [
      [BACK, back],
      [FORWARD, forward],
    ] as const) {
      for (const [key, action] of keys) {
        test(`${point} ${key}`, async () => {
          const onContainer: string[] = [];
          await expectEdit({
            stored,
            place: itemPoint(1, offset),
            action: cell.join ? recordingPoints(action, onContainer) : action,
            write: cell.write,
            source: "spec 5.3, 5.7",
          });
          // 5.3: no point is ever held on a container for a delete
          expect(onContainer).toEqual([]);
        });
      }
    }
  }
});

describe("F2 in R1, and check 5's delete rules (Step 1b)", () => {
  const C = LI("<blockquote><p>Q0w</p></blockquote><br>T2w");
  test("C: Backspace at the start of a line that starts with a break after a quote removes the break; the caret at the quote's end", async () => {
    await expectEdit({
      stored: C,
      place: itemPoint(1, 1),
      action: backspace,
      write: W("<li><blockquote><p>Q0w</p></blockquote>T2w</li>"),
      caret: "text:Q0w@3",
      source: "D18 step 1, D3 fourth case (check 2, C)",
    });
  });
  test("C: Delete there removes the same break; the caret stays at the line's start", async () => {
    await expectEdit({
      stored: C,
      place: itemPoint(1, 1),
      action: del,
      write: W("<li><blockquote><p>Q0w</p></blockquote>T2w</li>"),
      caret: "text:T2w@0",
      source: "D18 step 1 (check 2, C)",
    });
  });

  const ENDING_IMAGE = LI(`<blockquote><p>Q0w${IMG}</p></blockquote>T1w`);
  for (const [name, action] of [
    ["Backspace", backspace],
    ["the word form", wordBack],
    ["the line form", lineBack],
  ] as const) {
    test(`16.12: ${name} at a line's start after a block that ends in an image joins, the image stays`, async () => {
      await expectEdit({
        stored: ENDING_IMAGE,
        place: at("T1w", 0),
        action,
        write: W("<li><blockquote><p>Q0w<img />T1w</p></blockquote></li>"),
        source: "D3 case 2, check 5, 16.12",
      });
    });
  }

  const LINK = `<a href="https://example.org/">L1w</a>`;
  const CODE = "<pre><code>C0w</code></pre>";
  const REFUSED: ReadonlyArray<readonly [string, string, Step]> = [
    [
      "before an image that starts a quote, a code block before it",
      LI(`${CODE}<blockquote><p>${IMG}Q1w</p></blockquote>`),
      beside("cms-image", "before"),
    ],
    [
      "before an image that starts a line",
      LI(`${CODE}${IMG}T1w`),
      itemPoint(1, { after: 0 }),
    ],
    [
      "ordinary content, a quote",
      `${CODE}<blockquote><p>${IMG}Q1w</p></blockquote>`,
      beside("cms-image", "before"),
    ],
    [
      "ordinary content, a paragraph",
      `${CODE}<p>${IMG}T1w</p>`,
      beside("cms-image", "before"),
    ],
    [
      "a leading link, lined",
      LI(`${CODE}${LINK}T1w`),
      itemPoint(1, { after: 0 }),
    ],
    [
      "a leading link, ordinary content",
      `${CODE}<p>${LINK}T1w</p>`,
      beside("link", "before"),
    ],
  ];
  for (const [name, stored, place] of REFUSED) {
    for (const [key, action] of [
      ["Backspace", backspace],
      ["Ctrl+Backspace", wordBack],
      ["lineBack", lineBack],
    ] as const) {
      test(`16.13: ${name}, ${key} joins nothing`, async () => {
        await expectEdit({
          stored,
          place,
          action,
          write: null,
          source:
            "ruled, not built at the carry: check 5, 16.13; T14.7, T14.14",
        });
      });
    }
  }
  test("16.13 control: a leading line break joins as the twin does", async () => {
    await expectEdit({
      stored: `${CODE}<p><br>T1w</p>`,
      place: beside("linebreak", "before"),
      action: backspace,
      write: "<pre><code>C0w\nT1w</code></pre>",
      source: "check 5, 16.13 (measured at 451f20f04 and the head)",
    });
  });

  /** The write of `stored` at `place` by `key`, as the build gives it. */
  const writeOf = async (stored: string, place: Step, key: Step) =>
    (await recordEdit({ stored, place, action: key })).write;

  const EQUALS: ReadonlyArray<
    readonly [string, string, Step, Step, Step, string]
  > = [
    [
      "15.6: Ctrl+Backspace after a line break, just before an image, is Backspace",
      LI(`T0w<br>${IMG}T2w`),
      itemPoint(1, 2),
      wordBack,
      backspace,
      "check 4, 15.6",
    ],
    [
      "15.6: lineBack after a line break, just before an image, is Backspace",
      LI(`T0w<br>${IMG}T2w`),
      itemPoint(1, 2),
      lineBack,
      backspace,
      "check 4, 15.6",
    ],
    [
      "15.6: at a line's start after a block, the word form is the character form",
      LI(`<h3>${IMG}</h3>T1w`),
      at("T1w", 0),
      wordBack,
      backspace,
      "check 4, 15.6 (T10.3)",
    ],
    [
      "15.6: at a line's end before a block, the word form is the character form (Delete mirror)",
      LI(`T0w<h3>${IMG}</h3>`),
      at("T0w"),
      wordForward,
      del,
      "check 4, 15.6 (T10.3)",
    ],
  ];
  for (const [name, stored, place, action, key, source] of EQUALS) {
    test(name, async () => {
      const write = await writeOf(stored, place, key);
      await expectEdit({ stored, place, action, write, source });
    });
  }
});

describe("T13.3: the join of a link-led line is its own undo step (16.27)", () => {
  const stored = LI(
    `<blockquote><p>Q0w</p></blockquote><a href="https://example.org/">A1w</a>x`
  );
  const write = W("<li><blockquote><p>Q0w<a>A1w</a>x</p></blockquote></li>");
  const href = (written: string) =>
    expect(written).toContain('href="https://example.org/"');
  test("T13.3: Backspace joins a link-led line into the quote before, one undo step", async () => {
    await expectEdit({
      stored,
      place: at("A1w", 0),
      action: backspace,
      write,
      source: "derived (D3 case 2); T13.3",
    });
  });
  test("T13.3: the same by the word form", async () => {
    await expectEdit({
      stored,
      place: at("A1w", 0),
      action: wordBack,
      write,
      source: "derived (D3 case 2); T13.3",
    });
  });
  for (const [name, key] of [
    ["Backspace", backspace],
    ["the word form", wordBack],
  ] as const) {
    test(`T13.3: the same after an earlier edit, ${name}`, async () => {
      const record = await expectEdit({
        stored,
        place: then(at("Pw"), letter, at("A1w", 0)),
        action: key,
        write: write.replace("<li>Pw</li>", "<li>Pwk</li>"),
        source: "derived (D3 case 2); T13.3",
      });
      expect(record.htmlBefore).toContain("<li>Pwk</li>");
    });
  }
  for (const [name, key] of [
    ["Backspace", backspace],
    ["the word form", wordBack],
  ] as const) {
    test(`T13.3: after an earlier edit, ${name}: a second undo removes the letter, redo reapplies the join`, async () => {
      const onChange = await mount(stored);
      await then(at("Pw"), letter)();
      const lettered = short(lastHtml(onChange));
      expect(lettered).toContain("<li>Pwk</li>");
      await at("A1w", 0)();
      await key();
      const joined = short(lastHtml(onChange));
      await keys("{Control>}z{/Control}")();
      expect(short(lastHtml(onChange))).toBe(lettered);
      await keys("{Control>}z{/Control}")();
      expect(short(lastHtml(onChange))).toBe(
        lettered.replace("<li>Pwk</li>", "<li>Pw</li>")
      );
      await keys("{Control>}y{/Control}")();
      await keys("{Control>}y{/Control}")();
      expect(short(lastHtml(onChange))).toBe(joined);
      expect(joined).toBe(write.replace("<li>Pw</li>", "<li>Pwk</li>"));
    });
  }
  test("T13.3: the joined link keeps its address", async () => {
    await expectEdit({
      stored,
      place: at("A1w", 0),
      action: backspace,
      writeMatches: href,
      source: "T13.3",
    });
  });
});

type FixtureCell = {
  write: string | null;
  calls: number;
  caret: string;
  typed?: string;
};
const KEY_CHANGES_NOTHING = keyChangesNothingJson as Record<
  string,
  FixtureCell
>;

/** Each edge child as a write names it (`short`), for the twin's put back. */
const SHORT_CHILD: Record<string, string> = {
  img: "<img />",
  br: "<br />",
  linkOut: "<a>Zw</a>",
  linkIn: "<a>Zw</a>",
  code: "<code>Zw</code>",
  codeIn: "<code>Zw</code>",
  linkBold: "<a><b><strong>Zw</strong></b></a>",
  boldLink: "<a><b><strong>Zw</strong></b></a>",
};

/**
 * A control's write: its fixture cell's, except where the head's write
 * there differs from the twin's with the child put back, which F2 names
 * (D1's exception; check 3's edge-child rule: a child at a block's edge
 * acts as a word in its place; check 5, 16.10). Each such cell is listed
 * by `namedByF2` below.
 */
const controlWrite = (cell: { child: string; twin: string; id: string }) => {
  const twin = KEY_CHANGES_NOTHING[cell.twin];
  const base = KEY_CHANGES_NOTHING[cell.id];
  if (cell.child === "twin" || twin.write === null) {
    return { write: base.write, calls: base.calls, namedByF2: false };
  }
  const put = twin.write.replaceAll("Zw", SHORT_CHILD[cell.child]);
  return { write: put, calls: twin.calls, namedByF2: put !== base.write };
};

describe("16.10: a key whose delete changes nothing writes nothing (T11.6, T15.8)", () => {
  for (const cell of keyChangesNothingCells) {
    const twin = KEY_CHANGES_NOTHING[cell.twin];
    const base = KEY_CHANGES_NOTHING[cell.id];
    if (twin.calls === 0) {
      test(`${cell.id}: none, as the twin`, async () => {
        let depth: ReturnType<typeof undoDepth> | undefined;
        await expectEdit({
          stored: cell.stored,
          place: cell.place,
          action: async () => {
            depth = undoDepth();
            await cell.action();
            expect(undoDepth(), "no undo step").toEqual(depth);
          },
          write: null,
          source: "check 5, 16.10; B:base-key-changes-nothing",
        });
      });
      continue;
    }
    const expected = controlWrite(cell);
    const named = expected.namedByF2 ? " (F2: the twin's write)" : "";
    test(`${cell.id}: a control, as at the head${named}`, async () => {
      const record = await recordEdit(cell, { short: true });
      expect({ write: record.write, calls: record.calls }).toEqual({
        write: expected.write,
        calls: expected.calls,
      });
      if (expected.namedByF2 === false) {
        expect(base.write).toBe(expected.write);
      }
    });
  }
});
