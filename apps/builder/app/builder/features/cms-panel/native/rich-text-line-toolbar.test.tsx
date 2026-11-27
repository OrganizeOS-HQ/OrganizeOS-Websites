// The toolbar in lined containers: Divider (V1, A1 to A4, 15.8), Block type
// (D2, FS4, FS8, T10), Link (D10, V15, 16.11), the list buttons (V16), Image
// at the quote points and from a code block (T13.1), a click in QTR.
import { describe, expect, test, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import { $getSelection, $isNodeSelection, $isRangeSelection } from "lexical";
import {
  at,
  backspace,
  beside,
  button,
  caretKey,
  chooseBlockType,
  clickAt,
  clickItemCorner,
  containerPoint,
  expectEdit,
  forceOrder,
  hold,
  imageButton,
  IMG,
  imageNode,
  itemEnd,
  itemPoint,
  keys,
  letter,
  LI,
  link,
  mount,
  nodeAfter,
  range,
  realClicks,
  recordEdit,
  shiftPress,
  short,
  type Step,
  then,
  tripleClick,
  W,
} from "./rich-text-line-test-kit";
import {
  editable,
  editorOf,
  lastHtml,
  settle,
  unmountField,
} from "./rich-text-test-harness";
import { isLinedContainer } from "./rich-text-line-node";
import { undoDepth } from "./rich-text-line-test-kit-branch";
import { exportRichTextHtml } from "./rich-text-html";
import { dividerA3A4Cells } from "./rich-text-line-cells-divider-a3a4";
import { linkElementEndCells } from "./rich-text-line-cells-link-element-end";
import dividerA3A4Json from "./__fixtures__/rich-text-line-base-divider-a3a4.json";
import linkElementEndJson from "./__fixtures__/rich-text-line-base-link-element-end.json";

type Row = {
  name: string;
  stored: string;
  place: Step;
  action: Step;
  write: string | null;
  calls?: number;
  caret?: string;
  typed?: string;
  /** checks of the value as the field wrote it, beside the write */
  also?: (written: Document) => void;
  source: string;
};

const QUOTE = (text: string) => `<blockquote><p>${text}</p></blockquote>`;
const divider = button("Divider");
const parse = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");

const runRows = (rows: Row[]) => {
  for (const row of rows) {
    test(row.name, async () => {
      const { name: _name, also, write, ...edit } = row;
      if (also === undefined || write === null) {
        await expectEdit({ ...edit, write });
        return;
      }
      await expectEdit({
        ...edit,
        writeMatches: (written) => {
          expect(short(written), "write").toBe(write);
          also(parse(written));
        },
      });
    });
  }
};

const everyHref = (doc: Document) => {
  const links = [...doc.querySelectorAll("a")];
  expect(links.length, "links").toBeGreaterThan(0);
  for (const anchor of links) {
    expect(anchor.getAttribute("href"), "href").toBe("https://example.org/");
  }
};
const rulesIn = (parent: string) => (doc: Document) => {
  const rules = [...doc.querySelectorAll("hr")];
  expect(rules.length, "rules").toBeGreaterThan(0);
  for (const rule of rules) {
    expect(rule.parentElement?.tagName.toLowerCase(), "the rule's parent").toBe(
      parent
    );
  }
};
const noRuleInLink = (doc: Document) => {
  expect(doc.querySelectorAll("a hr").length, "a rule in a link").toBe(0);
};

describe("Divider (V1, A1, A2, 15.8, 5.8)", () => {
  runRows([
    {
      name: "V1: Divider at a line's end in TR",
      stored: LI("T0w<hr>"),
      place: at("T0w"),
      action: divider,
      write:
        "<ul><li>Pw</li><li>T0w</li></ul><hr /><ul><li><hr /></li><li>Nw</li></ul>",
      source: "check V1",
    },
    {
      name: "V1: at el1 between text and a rule",
      stored: "<ul><li>xq<hr>yq</li></ul>",
      place: itemPoint(0, 1),
      action: divider,
      write: "<ul><li>xq</li></ul><hr /><ul><li><hr />yq</li></ul>",
      source: "check V1",
    },
    {
      name: "V1: TQ",
      stored: LI(`T0w${QUOTE("Q1w")}`),
      place: at("T0w"),
      action: divider,
      write: `<ul><li>Pw</li><li>T0w</li></ul><hr /><ul><li>${QUOTE("Q1w")}</li><li>Nw</li></ul>`,
      source: "from M25a; check V1",
    },
    {
      name: "V1: TC",
      stored: LI("T0w<pre><code>C1w</code></pre>"),
      place: at("T0w"),
      action: divider,
      write:
        "<ul><li>Pw</li><li>T0w</li></ul><hr /><ul><li><pre><code>C1w</code></pre></li><li>Nw</li></ul>",
      source: "from M25b; check V1",
    },
    {
      name: "V1: TH",
      stored: LI("T0w<h3>H1w</h3>"),
      place: at("T0w"),
      action: divider,
      write:
        "<ul><li>Pw</li><li>T0w</li></ul><hr /><ul><li><h3>H1w</h3></li><li>Nw</li></ul>",
      source: "from M25c; check V1",
    },
    {
      name: "V1: QT",
      stored: LI(`${QUOTE("Q0w")}T1w`),
      place: at("T1w"),
      action: divider,
      write: `<ul><li>Pw</li></ul><hr /><ul><li>${QUOTE("Q0w")}T1w</li><li>Nw</li></ul>`,
      source: "from M25d; check V1",
    },
    {
      name: "V1: the root quote",
      stored: "<blockquote>X1w<p>X2w</p></blockquote>",
      place: at("X1w"),
      action: divider,
      write:
        "<blockquote>X1w</blockquote><hr /><blockquote><p>X2w</p></blockquote>",
      source: "from M25e; check V1",
    },
    {
      name: "Divider at AQ el1 (round 9)",
      stored: LI(`<a href="https://example.org/a">Aw</a>${QUOTE("Q1w")}`),
      place: itemPoint(1, 1),
      action: divider,
      write: `<ul><li>Pw</li><li><a>Aw</a></li></ul><hr /><ul><li>${QUOTE("Q1w")}</li><li>Nw</li></ul>`,
      source: "spec 5.7",
    },
    {
      name: "A1: Divider at a block's last text's end, content after it in the item",
      stored: LI(`${QUOTE("Q0w")}<hr>`),
      place: at("Q0w"),
      action: divider,
      write: `<ul><li>Pw</li><li>${QUOTE("Q0w")}</li></ul><hr /><ul><li><hr /></li><li>Nw</li></ul>`,
      source: "derived (spec 5.7); measured (M38a)",
    },
    {
      name: "A1: the same from QR@1",
      stored: LI(`${QUOTE("Q0w")}<hr>`),
      place: itemPoint(1, 1),
      action: divider,
      write: `<ul><li>Pw</li><li>${QUOTE("Q0w")}</li></ul><hr /><ul><li><hr /></li><li>Nw</li></ul>`,
      source: "spec 5.7, D18 (M38a)",
    },
    {
      name: "A2: Divider at a block's first text's start, content before it in the item",
      stored: LI(`<hr>${QUOTE("Q1w")}`),
      place: at("Q1w", 0),
      action: divider,
      write: `<ul><li>Pw</li><li><hr /></li></ul><hr /><ul><li>${QUOTE("Q1w")}</li><li>Nw</li></ul>`,
      source: "derived (spec 5.7); measured (M38b)",
    },
    {
      name: "A2: the same from RQ@1",
      stored: LI(`<hr>${QUOTE("Q1w")}`),
      place: itemPoint(1, 1),
      action: divider,
      write: `<ul><li>Pw</li><li><hr /></li></ul><hr /><ul><li>${QUOTE("Q1w")}</li><li>Nw</li></ul>`,
      source: "spec 5.7, D18 (M38b)",
    },
    {
      name: "A1: at a quote's text end, after the item when the quote ends it (TQ)",
      stored: LI(`T0w${QUOTE("Q1w")}`),
      place: at("Q1w"),
      action: divider,
      write: `<ul><li>Pw</li><li>T0w${QUOTE("Q1w")}</li></ul><hr /><ul><li>Nw</li></ul>`,
      source: "spec 5.7",
    },
    {
      name: "A1: QT at the quote's end",
      stored: LI(`${QUOTE("Q0w")}T1w`),
      place: at("Q0w"),
      action: divider,
      write: `<ul><li>Pw</li><li>${QUOTE("Q0w")}</li></ul><hr /><ul><li>T1w</li><li>Nw</li></ul>`,
      source: "spec 5.7",
    },
    {
      name: "A2: at a quote's text start, before the item, no empty item",
      stored: LI(`${QUOTE("Q0w")}T1w`),
      place: at("Q0w", 0),
      action: divider,
      write: `<ul><li>Pw</li></ul><hr /><ul><li>${QUOTE("Q0w")}T1w</li><li>Nw</li></ul>`,
      source: "spec 5.7",
    },
    {
      name: "A1: depth 2",
      stored: `<ul><li>Pw<ul><li>${QUOTE("Q1w")}</li></ul></li><li>Nw</li></ul>`,
      place: at("Q1w"),
      action: divider,
      write: `<ul><li>Pw<ul><li>${QUOTE("Q1w")}</li></ul></li></ul><hr /><ul><li>Nw</li></ul>`,
      source: "spec 5.7",
    },
    {
      name: "15.8: at a paragraph's end inside a quote",
      stored: LI(`<blockquote><p>Q0w</p><p>Q1w</p></blockquote>T2w`),
      place: at("Q0w"),
      action: divider,
      write: `<ul><li>Pw</li><li>${QUOTE("Q0w")}</li></ul><hr /><ul><li>${QUOTE("Q1w")}T2w</li><li>Nw</li></ul>`,
      source: "spec 5.7 (check 4, 15.8)",
    },
    {
      name: "Divider in an empty heading of a lined item",
      stored: LI("T0w<h3>H1w</h3>"),
      place: then(range("H1w", 0, "H1w", 3), backspace),
      action: divider,
      write:
        "<ul><li>Pw</li><li>T0w</li></ul><hr /><ul><li></li><li>Nw</li></ul>",
      source: "from M6a; spec 5.8",
    },
    {
      name: "Divider in an empty quote of a lined item",
      stored: LI(`T0w${QUOTE("Q1w")}`),
      place: then(range("Q1w", 0, "Q1w", 3), backspace),
      action: divider,
      write:
        "<ul><li>Pw</li><li>T0w</li></ul><hr /><ul><li></li><li>Nw</li></ul>",
      source: "from M6b (ruled carry); spec 5.7, 5.8",
    },
  ]);
});

describe("Block type (D2, FS4, FS8)", () => {
  runRows([
    {
      name: "Heading 2 beside a quote acts in the quote",
      stored: LI(`${QUOTE("Q0w")}<hr>`),
      place: itemPoint(1, 0),
      action: chooseBlockType("Heading 2"),
      write: W("<li><blockquote><h2>Q0w</h2></blockquote><hr /></li>"),
      source: "spec 5.7",
    },
    {
      name: "Paragraph on a paragraph writes nothing",
      stored: LI(`${QUOTE("Q0w")}<hr>`),
      place: itemPoint(1, 0),
      action: chooseBlockType("Paragraph"),
      write: null,
      source: "spec 5.7",
    },
    {
      name: "Paragraph on a line in an item writes nothing",
      stored: LI("T0w<hr>"),
      place: at("T0w", 1),
      action: chooseBlockType("Paragraph"),
      write: null,
      source: "D2",
    },
    {
      name: "Paragraph on a root quote's line unwraps the quote (round 9)",
      stored: "<blockquote>X1w<p>X2w</p></blockquote>",
      place: at("X1w", 1),
      action: chooseBlockType("Paragraph"),
      write: "<p>X1w</p><p>X2w</p>",
      source: "D2",
    },
    {
      name: "Quote on a quote's line adds no quote",
      stored: "<blockquote><p>X1w</p>X2w</blockquote>",
      place: at("X1w", 1),
      action: chooseBlockType("Quote"),
      write: null,
      source: "from P9; D2",
    },
    {
      name: "FS4: Quote over a range into a lined quote",
      stored:
        "<p>Pw</p><blockquote>X0w<ul><li>X1w</li></ul>X2w</blockquote><p>Nw</p>",
      place: range("Pw", 1, "X0w", 2),
      action: chooseBlockType("Quote"),
      write:
        "<blockquote>Pw</blockquote><blockquote>X0w<ul><li>X1w</li></ul>X2w</blockquote><p>Nw</p>",
      source: "from M18a; spec 5.7",
    },
    {
      name: "FS4: Ctrl+A, Quote",
      stored:
        "<p>Pw</p><blockquote>X0w<ul><li>X1w</li></ul>X2w</blockquote><p>Nw</p>",
      place: then(at("Pw"), keys("{Control>}a{/Control}")),
      action: chooseBlockType("Quote"),
      write:
        "<blockquote>Pw</blockquote><blockquote>X0w<blockquote>X1w</blockquote>X2w</blockquote><blockquote>Nw</blockquote>",
      source: "from M18b; spec 5.7",
    },
    {
      name: "FS8: Code on a line of only an image does nothing",
      stored: LI(`${QUOTE("Q0w")}${IMG}`),
      place: itemEnd(1),
      action: chooseBlockType("Code"),
      write: null,
      source: "from M19b; D2, spec 5.7",
    },
    {
      name: "D2: Code on a line with an image beside text",
      stored: LI(`T0w${IMG}X1w<hr>`),
      place: at("T0w", 1),
      action: chooseBlockType("Code"),
      write: W("<li><pre><code>T0wX1w</code></pre><img /><hr /></li>"),
      source: "from M7a (ruled third, Step 2: M7b converts); D2",
    },
    {
      name: "a block made from a line has no indent",
      stored: "<ul><li>Aw<ul><li>T0w<hr></li></ul></li></ul>",
      place: at("T0w", 1),
      action: chooseBlockType("Heading 2"),
      write: "<ul><li>Aw<ul><li><h2>T0w</h2><hr /></li></ul></li></ul>",
      source: "derived (5.8); measured",
    },
    {
      name: "TS1: Block type over mixed and ordinary items",
      stored: `<ul><li>Aw</li><li>T0w${QUOTE("Q1w")}T2w</li></ul>`,
      place: range("Aw", 1, "T2w", 1),
      action: chooseBlockType("Heading 2"),
      write:
        "<h2>Aw</h2><ul><li><h2>T0w</h2><blockquote><h2>Q1w</h2></blockquote><h2>T2w</h2></li></ul>",
      source: "from P6 (already ruled); D2 (accepted)",
    },
  ]);
});

/** Task 22's unreached shape `d7 TR`: seven nested lists, the innermost item `T0w<hr>`. */
const D7_TR = [6, 5, 4, 3, 2, 1].reduce(
  (inner, level) => `<ul><li>A${level}w${inner}</li></ul>`,
  "<ul><li>T0w<hr></li></ul>"
);

/**
 * T45.4 (D13, section 4's depth limit): Quote on a line whose quote would
 * stand at the nesting the depth limit's lift removes changes nothing,
 * on the empty caret line and on a line with text.
 */
describe("T45.4: Quote at the depth limit", () => {
  const CELLS: ReadonlyArray<{
    name: string;
    place: Step;
    caret: string;
    typed: string;
  }> = [
    {
      name: "the empty caret line (d7 TR el2)",
      place: containerPoint("T0w", 2),
      caret: "element:listitem@2",
      typed: D7_TR.replace("<hr>", "<hr />k"),
    },
    {
      name: "a line with text (d7 TR T0w@1)",
      place: at("T0w", 1),
      caret: "text:T0w@1",
      typed: D7_TR.replace("T0w<hr>", "Tk0w<hr />"),
    },
  ];
  for (const cell of CELLS) {
    test(`Quote at the depth limit changes nothing: ${cell.name}`, async () => {
      await expectEdit({
        stored: D7_TR,
        place: cell.place,
        action: async () => {
          const depth = undoDepth();
          await chooseBlockType("Quote")();
          expect(undoDepth(), "no undo step").toEqual(depth);
        },
        write: null,
        caret: cell.caret,
        typed: cell.typed,
        source: "T45.4; D13; section 4",
      });
    });
  }

  // T47.4: a range with one end's line at the depth limit is refused whole
  test("Quote over a range from a line that could hold a quote to a line at the depth limit writes nothing", async () => {
    const alone = await recordEdit({
      stored: D7_TR,
      place: at("A6w", 1),
      action: chooseBlockType("Quote"),
    });
    expect(alone.write ?? "", "Quote at A6w alone makes a quote").toContain(
      "<blockquote>"
    );
    await expectEdit({
      stored: D7_TR,
      place: range("A6w", 1, "T0w", 1),
      action: async () => {
        const depth = undoDepth();
        await chooseBlockType("Quote")();
        expect(undoDepth(), "no undo step").toEqual(depth);
      },
      write: null,
      source: "T47.4; T45.4",
    });
  });

  test("control: Heading 2 at the depth limit's empty caret line still writes its empty heading (d7 TR el2)", async () => {
    const record = await recordEdit({
      stored: D7_TR,
      place: containerPoint("T0w", 2),
      action: chooseBlockType("Heading 2"),
    });
    expect(record.calls, "one onChange").toBe(1);
    expect(record.write, "the write").toBe(
      D7_TR.replace("<hr>", "<hr /><h2></h2>")
    );
  });
});

/**
 * T46.1 (D2, D19, T42.1): Paragraph at the start of the text after a
 * heading in a lined quote writes nothing, in an item and at the root, as
 * the head does at the root (M-e1).
 */
describe("Paragraph in a lined quote after a heading", () => {
  const CELLS: ReadonlyArray<{ name: string; stored: string; typed: string }> =
    [
      {
        name: "in an item (HQ in item el1)",
        stored: LI("<blockquote><h3>H0w</h3>X1w</blockquote>T2w"),
        typed: W("<li><blockquote><h3>H0w</h3>kX1w</blockquote>T2w</li>"),
      },
      {
        name: "at the root",
        stored: "<blockquote><h3>H0w</h3>X1w</blockquote>",
        typed: "<blockquote><h3>H0w</h3>kX1w</blockquote>",
      },
    ];
  for (const cell of CELLS) {
    test(`Paragraph in a lined quote after a heading changes nothing: ${cell.name}`, async () => {
      await expectEdit({
        stored: cell.stored,
        place: at("X1w", 0),
        action: async () => {
          const depth = undoDepth();
          await chooseBlockType("Paragraph")();
          expect(undoDepth(), "no undo step").toEqual(depth);
        },
        write: null,
        caret: "text:X1w@0",
        typed: cell.typed,
        source: "T46.1; D2, D19",
      });
    });
  }

  // T47.6 (M-g3): the inputs the first refusal left out; the head writes
  // nothing at each, in an item and at the root
  const MORE: ReadonlyArray<{
    name: string;
    stored: string;
    place: Step;
  }> = [
    {
      name: "a range inside X1w, in an item",
      stored: LI("<blockquote><h3>H0w</h3>X1w</blockquote>T2w"),
      place: range("X1w", 1, "X1w", 2),
    },
    {
      name: "a range inside X1w, at the root",
      stored: "<blockquote><h3>H0w</h3>X1w</blockquote>",
      place: range("X1w", 1, "X1w", 2),
    },
    {
      name: "the empty line after the heading, in an item",
      stored: LI("<blockquote><h3>H0w</h3><br>X1w</blockquote>T2w"),
      place: containerPoint("X1w", 1),
    },
    {
      name: "the empty line after the heading, at the root",
      stored: "<blockquote><h3>H0w</h3><br>X1w</blockquote>",
      place: containerPoint("X1w", 1),
    },
  ];
  for (const cell of MORE) {
    test(`Paragraph in a lined quote after a heading changes nothing: ${cell.name}`, async () => {
      const record = await recordEdit({
        stored: cell.stored,
        place: cell.place,
        action: async () => {
          const depth = undoDepth();
          await chooseBlockType("Paragraph")();
          expect(undoDepth(), "no undo step").toEqual(depth);
        },
      });
      expect(record.calls, "no onChange").toBe(0);
      expect(record.caret, "the caret").toBe(record.caretBefore);
    });
  }

  // T47.6 (M-g3): a range from the heading into X1w changes the heading,
  // in the item as at the root (equal at both builds)
  test("control: Paragraph over a range from the heading into X1w makes the heading a paragraph", async () => {
    await expectEdit({
      stored: LI("<blockquote><h3>H0w</h3>X1w</blockquote>T2w"),
      place: range("H0w", 1, "X1w", 1),
      action: chooseBlockType("Paragraph"),
      write: W("<li><blockquote><p>H0w</p>X1w</blockquote>T2w</li>"),
      source: "T47.6 (M-g3): <base>'s root write with the item around it",
    });
  });

  test("control: Paragraph in a quote that starts with text still unwraps it", async () => {
    await expectEdit({
      stored: "<blockquote>X1w<p>X2w</p></blockquote>",
      place: at("X1w", 1),
      action: chooseBlockType("Paragraph"),
      write: "<p>X1w</p><p>X2w</p>",
      source: "D2's example; T46.1",
    });
  });
});

describe("Link (D10, V15)", () => {
  runRows([
    {
      name: "D10 and V15: Link over a range that touches a rule",
      stored: LI("T0w<hr>"),
      place: range("T0w", 1, "Nw", 1),
      action: link(),
      write: "<ul><li>Pw</li><li>T<a>0w</a><hr /></li><li><a>N</a>w</li></ul>",
      also: (doc) => {
        everyHref(doc);
        noRuleInLink(doc);
      },
      source: "D10, check V15",
    },
    {
      name: "D10: Link over a rule in an item that holds a quote",
      stored: LI(`T0w${QUOTE("Q1w")}<hr>`),
      place: range("T0w", 1, "Nw", 1),
      action: link(),
      write:
        "<ul><li>Pw</li><li>T<a>0w</a><blockquote><p><a>Q1w</a></p></blockquote><hr /></li><li><a>N</a>w</li></ul>",
      also: (doc) => {
        everyHref(doc);
        rulesIn("li")(doc);
      },
      source: "from P5a (ruled carry); section 10",
    },
    {
      name: "D10: Link over a rule in a lined quote",
      stored: "<blockquote><p>X1w</p>Y2w<hr></blockquote><p>Z3w</p>",
      place: range("Y2w", 1, "Z3w", 1),
      action: link(),
      write:
        "<blockquote><p>X1w</p>Y<a>2w</a><hr /></blockquote><p><a>Z</a>3w</p>",
      also: (doc) => {
        everyHref(doc);
        rulesIn("blockquote")(doc);
      },
      source: "from P5b (ruled carry); section 10",
    },
    {
      name: "D10: Link at an empty line beside a rule",
      stored: LI("T0w<hr>"),
      place: itemPoint(1, 2),
      action: link(),
      write: null,
      source: "from P11a (ruled against M37); D10",
    },
    {
      name: "D10: Link with a rule node-selected",
      stored: "<ul><li>xq<hr>yq</li></ul>",
      place: nodeAfter("xq"),
      action: link(),
      write: null,
      source: "from P11b (ruled against M37); D10, check V15",
    },
    {
      name: "V15: a click at a lined item's corner, then Link",
      stored: LI(`${QUOTE("Q0w")}<br><hr>`),
      place: then(at("Pw"), clickItemCorner(1)),
      action: link(),
      write: null,
      source: "from P14 (ruled against M46 and D10); check V15",
    },
  ]);
});

/**
 * T45.2 (D10, P7-Link widened): Link at a collapsed caret in a line with
 * no word at it writes nothing: no onChange, no undo step, the caret
 * stays, and the next letter lands where it landed before Link.
 */
describe("T45.2: Link at a caret in a line with no word at it", () => {
  const QI = LI(`<blockquote><p>Q0w</p></blockquote>${IMG}`);
  const TQI = LI(`T0w<blockquote><p>Q1w</p></blockquote>X2w${IMG}`);
  const CELLS: ReadonlyArray<{
    name: string;
    stored: string;
    place: Step;
    typed: string;
  }> = [
    {
      name: "BQ el1",
      stored: LI("<br><blockquote><p>Q1w</p></blockquote>"),
      place: itemPoint(1, 1),
      typed: W("<li><br />k<blockquote><p>Q1w</p></blockquote></li>"),
    },
    {
      name: "QB el1",
      stored: LI("<blockquote><p>Q0w</p></blockquote><br>"),
      place: itemPoint(1, 1),
      typed: W("<li><blockquote><p>Q0w</p></blockquote>k<br /></li>"),
    },
    {
      name: "IR el1",
      stored: LI(`${IMG}<hr>`),
      place: itemPoint(1, 1),
      typed: W("<li><img />k<hr /></li>"),
    },
    {
      name: "image in QI for real",
      stored: QI,
      place: imageNode(),
      typed: W("<li><blockquote><p>Q0w</p></blockquote><img />k</li>"),
    },
    {
      name: "image in TQI for real",
      stored: TQI,
      place: imageNode(),
      typed: W("<li>T0w<blockquote><p>Q1w</p></blockquote>X2w<img />k</li>"),
    },
  ];
  for (const cell of CELLS) {
    test(`Link at a caret in a line with no word at it writes nothing: ${cell.name}`, async () => {
      const onChange = await mount(cell.stored);
      await cell.place();
      const caret = caretKey();
      const value = exportRichTextHtml(editorOf()!);
      const depth = undoDepth();
      onChange.mockClear();
      await link()();
      expect(onChange, "no onChange").not.toHaveBeenCalled();
      expect(exportRichTextHtml(editorOf()!), "the value").toBe(value);
      expect(undoDepth(), "the history's length").toEqual(depth);
      expect(caretKey(), "the caret").toBe(caret);
      expect(
        editable()!.querySelector("a hr"),
        "no link holds a rule"
      ).toBeNull();
      await letter();
      expect(short(lastHtml(onChange)), "the letter").toBe(cell.typed);
    });
  }

  // M-d2 rows 3 and 4: ordinary content keeps <base>'s single onChange
  // with the value unchanged (T42.1, D1)
  const CONTROLS: ReadonlyArray<{
    name: string;
    stored: string;
    caret: string;
  }> = [
    {
      name: "directly after an image at a paragraph's end",
      stored: `<p>Aw${IMG}</p>`,
      caret: "element:paragraph@2",
    },
    {
      name: "after the image of a paragraph holding only an image, a rule after it",
      stored: `<p>${IMG}</p><hr>`,
      caret: "element:paragraph@1",
    },
  ];
  for (const control of CONTROLS) {
    test(`control: Link in ordinary content ${control.name} hands out the value unchanged once`, async () => {
      const onChange = await mount(control.stored);
      await beside("cms-image", "after")();
      expect(caretKey(), "the caret").toBe(control.caret);
      const value = short(exportRichTextHtml(editorOf()!));
      onChange.mockClear();
      await link()();
      expect(onChange, "one onChange").toHaveBeenCalledTimes(1);
      expect(short(lastHtml(onChange)), "the value unchanged").toBe(value);
      expect(caretKey(), "the caret").toBe(control.caret);
    });
  }
});

// T18.8: the cell where the kit's Link driver lost the focus at <base>
// (M46). A person loses it there too at <base> (the rule wrapped in a
// link); in R1 the focus is in the editable after a real Apply, by Enter
// and by a click on Apply (P19-1)
describe("Link: the focus after a real Apply (T18.8)", () => {
  for (const way of ["Enter", "a click on Apply"] as const) {
    test(`V15's item-corner cell: the editable has the focus after ${way}, and a letter reaches the editor`, async () => {
      const onChange = await mount(LI(`${QUOTE("Q0w")}<br><hr>`));
      await then(at("Pw"), clickItemCorner(1))();
      onChange.mockClear();
      await userEvent.click(
        document.querySelector<HTMLElement>('[aria-label="Link"]')!
      );
      await settle();
      const input =
        document.querySelector<HTMLInputElement>('[aria-label="URL"]');
      expect(input, "the URL field").not.toBeNull();
      await userEvent.fill(input!, "https://example.org/");
      if (way === "Enter") {
        await userEvent.keyboard("{Enter}");
      } else {
        await userEvent.click(
          [...document.querySelectorAll<HTMLElement>("button")].find(
            (element) => element.textContent === "Apply"
          )!
        );
      }
      await settle();
      expect(document.activeElement, "the focus").toBe(editable());
      expect(onChange, "Link writes nothing (P14)").not.toHaveBeenCalled();
      expect(caretKey(), "the caret (P14)").toBe("element:listitem@3");
      await letter();
      expect(onChange, "the letter reaches the editor").toHaveBeenCalledTimes(
        1
      );
    });
  }
});

describe("the list buttons (V16)", () => {
  runRows([
    {
      name: "V16: list off at an item's end after a rule",
      stored: LI("T0w<hr>"),
      place: itemPoint(1, 2),
      action: button("Bulleted list"),
      write: "<p>Pw</p><p>T0w</p><hr /><p>Nw</p>",
      typed: "<p>Pw</p><p>T0w</p><hr /><p>k</p><p>Nw</p>",
      source: "from M22 (write and typed); check V16, spec 5.7",
    },
    {
      name: "list off on a nested list in a mixed item",
      stored: `<ul><li>T0w${QUOTE("Q1w")}<ul><li>Nw</li></ul></li></ul>`,
      place: at("Nw", 1),
      action: button("Bulleted list"),
      write: "<p>T0w</p><blockquote><p>Q1w</p></blockquote><p>Nw</p>",
      source: "from M35; section 10",
    },
  ]);
});

describe("T59 defect 2: list off at a click after an item's final rule (5.7, V16)", () => {
  // the record sets' click at the item's end: 3 px inside its bottom right
  const clickItemEnd =
    (item: number): Step =>
    async () => {
      const li = editable()!.querySelectorAll("li")[item] as HTMLElement;
      const box = li.getBoundingClientRect();
      await userEvent.click(li, {
        position: { x: box.width - 3, y: box.height - 3 },
      } as never);
      await settle();
    };
  const cells: Array<[string, string, number, string, string]> = [
    [
      "QBR",
      LI(`${QUOTE("Q0w")}<br><hr>`),
      1,
      "<p>Pw</p><blockquote><p>Q0w</p></blockquote><p><br /></p><hr /><p>Nw</p>",
      "<p>Pw</p><blockquote><p>Q0w</p></blockquote><p><br /></p><hr /><p>k</p><p>Nw</p>",
    ],
    [
      "QTR",
      LI(`${QUOTE("Q0w")}T1w<hr>`),
      1,
      "<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>T1w</p><hr /><p>Nw</p>",
      "<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>T1w</p><hr /><p>k</p><p>Nw</p>",
    ],
    [
      "d2 CR",
      "<ul><li>Aw<ul><li>Pw</li><li><pre><code>C0w</code></pre><hr></li><li>Nw</li></ul></li><li>Zw</li></ul>",
      // the nested list stands in an item of its own in the DOM
      3,
      "<p>Aw</p><p>Pw</p><pre><code>C0w</code></pre><hr /><p>Nw</p><p>Zw</p>",
      "<p>Aw</p><p>Pw</p><pre><code>C0w</code></pre><hr /><p>k</p><p>Nw</p><p>Zw</p>",
    ],
  ];
  for (const [name, stored, item, write, typed] of cells) {
    test(`${name}: Bulleted list leaves the caret after the rule, and after redo`, async () => {
      await expectEdit({
        stored,
        place: clickItemEnd(item),
        action: button("Bulleted list"),
        write,
        caret: "element:root@4",
        typed,
        source: "acceptance check, defect 2; spec 5.7 (TR item@2), V16",
      });
    });
  }
});

describe("T59 review L2: list off at a caret after an item's ending quote or code block (5.7, D1)", () => {
  // the item's last line emptied by Backspace keeps the caret (T24);
  // list off then starts from the element caret after the block, which
  // the head at that same point leaves after the block at the root
  const cells: Array<[string, string, string, string, string]> = [
    [
      "a quote",
      LI(`${QUOTE("Q0w")}Xz`),
      "<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>",
      "element:root@2",
      "<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>k</p><p>Nw</p>",
    ],
    [
      "a code block",
      LI("<pre><code>C0w</code></pre>Xz"),
      "<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>",
      "element:root@2",
      "<p>Pw</p><pre><code>C0w</code></pre><p>k</p><p>Nw</p>",
    ],
  ];
  for (const [name, stored, write, caret, typed] of cells) {
    test(`after ${name}: Bulleted list leaves the caret after it at the root`, async () => {
      // undo brings back the caret in the emptied line (D7, T71.3)
      const record = await recordEdit(
        {
          stored,
          place: then(at("Xz", 2), backspace, backspace),
          action: button("Bulleted list"),
        },
        { typeAfter: true }
      );
      expect(record.caretBefore, "the caret after the block").toBe(
        "element:listitem@1"
      );
      expect(record.calls, "calls").toBe(1);
      expect(record.write, "write").toBe(write);
      expect(record.caret, "caret").toBe(caret);
      expect(record.undoRestores, "undo restores the state and caret").toBe(
        true
      );
      expect(record.redoEquals, "redo equals the write").toBe(true);
      expect(record.typed, "typed after redo").toBe(typed);
      expect(record.errors, "console errors").toEqual([]);
    });
  }
});

describe("T71.3: undo from an emptied last line after a quote or a code block brings its caret back (D7)", () => {
  // the item's last line emptied by Backspace keeps the caret (T24); an
  // undo of the next action restores that caret, and a letter lands in the
  // line as it did before the action
  const blocks: Array<[string, string, string]> = [
    ["a quote", QUOTE("Q0w"), "<blockquote><p>Q0w</p></blockquote>"],
    [
      "a code block",
      "<pre><code>C0w</code></pre>",
      "<pre><code>C0w</code></pre>",
    ],
  ];
  const actions: Array<[string, Step]> = [
    ["Bulleted list", button("Bulleted list")],
    ["Heading 2", chooseBlockType("Heading 2")],
    ["a typed letter", keys("x")],
  ];
  for (const [blockName, block, written] of blocks) {
    for (const [actionName, action] of actions) {
      test(`after ${blockName}: undo after ${actionName}`, async () => {
        const onChange = await mount(LI(`${block}Xz`));
        await then(at("Xz", 2), backspace, backspace)();
        const editor = editorOf()!;
        const before = caretKey(editor);
        expect(before, "the caret in the emptied line").toBe(
          "element:listitem@1"
        );
        const value = short(lastHtml(onChange));
        await action();
        expect(short(lastHtml(onChange)), "the action wrote").not.toBe(value);
        await keys("{Control>}z{/Control}")();
        expect(short(lastHtml(onChange)), "undo restores the value").toBe(
          value
        );
        expect(caretKey(editor), "undo's caret").toBe(before);
        await letter();
        expect(short(lastHtml(onChange)), "the letter in the line").toBe(
          W(`<li>${written}k</li>`)
        );
      });
    }
  }
});

describe("Image at the quote points", () => {
  const QR = LI(`${QUOTE("Q0w")}<hr>`);
  const RQ = LI(`<hr>${QUOTE("Q1w")}`);
  const QRQ = LI(`${QUOTE("Q0w")}<hr>${QUOTE("Q2w")}`);
  runRows([
    {
      name: "Image at QR@0",
      stored: QR,
      place: itemPoint(1, 0),
      action: imageButton,
      write: W("<li><blockquote><p><img />Q0w</p></blockquote><hr /></li>"),
      typed: W("<li><blockquote><p><img />kQ0w</p></blockquote><hr /></li>"),
      source: "spec 5.7",
    },
    {
      name: "Image at QR@1 (check 5: Q1 QR item@1 Image)",
      stored: QR,
      place: itemPoint(1, 1),
      action: imageButton,
      write: W("<li><blockquote><p>Q0w<img /></p></blockquote><hr /></li>"),
      source: "derived (D18: the quote's end); measured",
    },
    {
      name: "Image at RQ@1 (check 5: Q1 RQ item@1 Image)",
      stored: RQ,
      place: itemPoint(1, 1),
      action: imageButton,
      write: W("<li><hr /><blockquote><p><img />Q1w</p></blockquote></li>"),
      source: "derived (the quote's start); measured",
    },
    {
      name: "Image at RQ@2",
      stored: RQ,
      place: itemPoint(1, 2),
      action: imageButton,
      write: W("<li><hr /><blockquote><p>Q1w<img /></p></blockquote></li>"),
      source: "derived (the quote's end); measured",
    },
    {
      name: "Image at QRQ@0",
      stored: QRQ,
      place: itemPoint(1, 0),
      action: imageButton,
      write: W(
        "<li><blockquote><p><img />Q0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li>"
      ),
      source: "derived; measured",
    },
    {
      name: "Image at QRQ@1",
      stored: QRQ,
      place: itemPoint(1, 1),
      action: imageButton,
      write: W(
        "<li><blockquote><p>Q0w<img /></p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li>"
      ),
      source: "derived; measured",
    },
    {
      name: "Image at QRQ@2",
      stored: QRQ,
      place: itemPoint(1, 2),
      action: imageButton,
      write: W(
        "<li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p><img />Q2w</p></blockquote></li>"
      ),
      source: "derived; measured",
    },
    {
      name: "Image at QRQ@3",
      stored: QRQ,
      place: itemPoint(1, 3),
      action: imageButton,
      write: W(
        "<li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>Q2w<img /></p></blockquote></li>"
      ),
      source: "derived; measured",
    },
  ]);
});

describe("QTR and QBR: a click in the item (spec 5.7)", () => {
  for (const [name, middle] of [
    ["QTR", `${QUOTE("Q0w")}T1w<hr>`],
    ["QBR", `${QUOTE("Q0w")}<br><hr>`],
  ] as const) {
    test(`${name}: a click in the item gives a real selection`, async () => {
      const onChange = await mount(LI(middle));
      await at("Pw")();
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        const text = args.map(String).join(" ");
        if (text.includes("not wrapped in act") === false) {
          errors.push(text);
        }
      });
      onChange.mockClear();
      await clickItemCorner(1)();
      const points = editorOf()!
        .getEditorState()
        .read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection) === false) {
            return null;
          }
          return [selection.anchor, selection.focus].map(
            (point) =>
              point.type === "element" && isLinedContainer(point.getNode())
          );
        });
      expect(points, "a range selection").not.toBeNull();
      expect(points, "a point on a lined container").toEqual([false, false]);
      expect(onChange).not.toHaveBeenCalled();
      expect(errors, "console errors").toEqual([]);
    });
  }
});

describe("T10: focus after the Block type select closes", () => {
  test("T10: after the Block type select closes, keys reach the editor at the caret", async () => {
    const onChange = await mount("<p>T0w</p>");
    await at("T0w", 1)();
    await chooseBlockType("Heading 2")();
    expect(document.activeElement, "the focus").toBe(editable());
    await letter();
    expect(short(lastHtml(onChange))).toBe("<h2>Tk0w</h2>");
    await keys("{Control>}z{/Control}")();
    await keys("{Control>}z{/Control}")();
    expect(short(lastHtml(onChange))).toBe("<p>T0w</p>");
  });
});

describe("Divider: A1 and A2 for every block, the item-end click, a root quote (T9.2 A, T10.8)", () => {
  runRows([
    {
      name: "A1: an item of only a quote",
      stored: LI(QUOTE("Q0w")),
      place: at("Q0w"),
      action: divider,
      write: `<ul><li>Pw</li><li>${QUOTE("Q0w")}</li></ul><hr /><ul><li>Nw</li></ul>`,
      source: "check 2, A1",
    },
    {
      name: "A1: the item-end click resolves to the quote's end (D18)",
      stored: LI(QUOTE("Q0w")),
      place: clickItemCorner(1),
      action: divider,
      write: `<ul><li>Pw</li><li>${QUOTE("Q0w")}</li></ul><hr /><ul><li>Nw</li></ul>`,
      source: "check 2, A1",
    },
    {
      name: "A2: in the list's first item, no empty list",
      stored: `<ul><li>${QUOTE("Q0w")}</li><li>Nw</li></ul>`,
      place: at("Q0w", 0),
      action: divider,
      write: `<hr /><ul><li>${QUOTE("Q0w")}</li><li>Nw</li></ul>`,
      source: "check 2, A2",
    },
    {
      name: "A4: over a range, the head's write",
      stored: LI(`${QUOTE("Q0w")}T1w`),
      place: range("Q0w", 0, "T1w", 3),
      action: divider,
      write: `<ul><li>Pw</li></ul><hr /><ul><li>${QUOTE("Q0w")}T1w</li><li>Nw</li></ul>`,
      source: "check 2, A4",
    },
    ...(
      [
        ["a heading", "<h3>H0w</h3>", "H0w"],
        ["a code block", "<pre><code>C0w</code></pre>", "C0w"],
      ] as const
    ).flatMap(([name, block, word]): Row[] => [
      {
        name: `A1: ${name} at its text's end, a line after it`,
        stored: LI(`${block}T1w`),
        place: at(word),
        action: divider,
        write: `<ul><li>Pw</li><li>${block}</li></ul><hr /><ul><li>T1w</li><li>Nw</li></ul>`,
        source: "T9.2 A (the QT row with the block in place of the quote)",
      },
      {
        name: `A2: ${name} at its text's start, before the item`,
        stored: LI(`${block}T1w`),
        place: at(word, 0),
        action: divider,
        write: `<ul><li>Pw</li></ul><hr /><ul><li>${block}T1w</li><li>Nw</li></ul>`,
        source: "T9.2 A (the QT row with the block in place of the quote)",
      },
    ]),
    {
      name: "out of a root quote mid-text (Q1w@1): the rule at the root, both quotes split",
      stored: `<blockquote><ul><li>${QUOTE("Q1w")}</li></ul></blockquote>`,
      place: at("Q1w", 1),
      action: divider,
      write: `<blockquote><ul><li>${QUOTE("Q")}</li></ul></blockquote><hr /><blockquote><ul><li>${QUOTE("1w")}</li></ul></blockquote>`,
      source: "T10.8; measured at <base> and 451f20f04",
    },
  ]);

  test("out of a root quote at the content's end (Q1w@end): the rule at the root after the quote, an empty paragraph after it", async () => {
    const quote = `<blockquote><ul><li>${QUOTE("Q1w")}</li></ul></blockquote>`;
    await expectEdit({
      stored: quote,
      place: at("Q1w"),
      action: divider,
      write: `${quote}<hr /><p></p>`,
      typed: `${quote}<hr /><p>k</p>`,
      source: "T10.8; check 2 A1; T40.2 (P19-9)",
    });
  });
});

describe("Divider at every caret of a block in a lined item (check 5, the history lens)", () => {
  const Q2 = "<blockquote><p>Q0w</p><p>Q1w</p></blockquote>";
  const H = "<h3>H0w</h3>";
  const C = "<pre><code>C0w\nC1w</code></pre>";
  const OL = (x: string) => `<ol><li>Pw</li><li>${x}</li><li>Nw</li></ol>`;
  const D2 = (x: string) =>
    `<ul><li>Pw<ul><li>${x}</li><li>Mw</li></ul></li><li>Nw</li></ul>`;
  const D3 = (x: string) =>
    `<ul><li>Pw<ul><li>P2w<ul><li>${x}</li><li>Mw</li></ul></li></ul></li><li>Nw</li></ul>`;
  const CARETS: Record<string, [string, number, string][]> = {
    Q2: [
      ["Q0w", 0, "start"],
      ["Q1w", 3, "end"],
      ["Q0w", 1, "mid"],
      ["Q0w", 3, "p0end"],
      ["Q1w", 0, "p1start"],
    ],
    H: [
      ["H0w", 0, "start"],
      ["H0w", 3, "end"],
      ["H0w", 1, "mid"],
    ],
    C: [
      ["C0w", 0, "start"],
      ["C1w", 3, "end"],
      ["C0w", 1, "mid"],
      ["C0w", 3, "l0end"],
      ["C1w", 0, "l1start"],
    ],
  };
  const BLOCKS: Record<string, string> = { Q2, H, C };
  const cells: { id: string; stored: string; word: string; offset: number }[] =
    [];
  for (const [block, carets] of Object.entries(CARETS)) {
    for (const [position, wrap] of [
      ["first", (x: string) => `${x}T9w`],
      ["last", (x: string) => `T0w${x}`],
      ["between", (x: string) => `T0w${x}T9w`],
    ] as const) {
      for (const [word, offset, name] of carets) {
        cells.push({
          id: `${block}-${position}-${name}`,
          stored: LI(wrap(BLOCKS[block])),
          word,
          offset,
        });
      }
    }
  }
  for (const [word, offset, name] of CARETS.Q2) {
    for (const [depth, wrap] of [
      ["depth2", D2],
      ["depth3", D3],
      ["ol", OL],
    ] as const) {
      cells.push({
        id: `Q2-${depth}-${name}`,
        stored: wrap(`T0w${Q2}T9w`),
        word,
        offset,
      });
    }
  }
  /** The value's text in reading order, a rule as [hr]. */
  const flat = (html: string) => {
    const out: string[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out.push((node.textContent ?? "").replace(/\n/g, ""));
        return;
      }
      if (node.nodeName === "HR") {
        out.push("[hr]");
      }
      node.childNodes.forEach(walk);
    };
    walk(parse(html).body);
    return out.join("");
  };
  const empties = (html: string) =>
    [
      ...parse(html).body.querySelectorAll(
        "li, ul, ol, blockquote, p, h1, h2, h3, h4, h5, h6, pre"
      ),
    ]
      .filter(
        (element) =>
          (element.textContent ?? "").trim() === "" &&
          element.querySelector("img, hr") === null
      )
      .map((element) => element.tagName);
  for (const cell of cells) {
    test(`${cell.id}: the rule at the root at the caret, nothing empty, the letter after the rule`, async () => {
      const f0 = flat(cell.stored);
      const index = f0.indexOf(cell.word) + cell.offset;
      await expectEdit({
        stored: cell.stored,
        place: at(cell.word, cell.offset),
        action: divider,
        writeMatches: (written) => {
          expect(flat(written), "the reading order").toBe(
            `${f0.slice(0, index)}[hr]${f0.slice(index)}`
          );
          expect(empties(written), "an empty copy").toEqual([]);
          expect(
            [...parse(written).body.children].filter(
              (child) => child.tagName === "HR"
            ).length,
            "a rule at the root"
          ).toBe(1);
        },
      });
      const typed = await recordEdit(
        {
          stored: cell.stored,
          place: at(cell.word, cell.offset),
          action: divider,
        },
        { short: true }
      );
      expect(flat(typed.typed!), "the letter after the rule").toBe(
        `${f0.slice(0, index)}[hr]k${f0.slice(index)}`
      );
    });
  }
});

describe("A3 and A4: Divider in a nested item and over a range keep the head's write (base-divider-a3a4)", () => {
  const base = dividerA3A4Json as Record<
    string,
    { write: string | null; calls: number; caret: string; typed: string }
  >;
  for (const cell of dividerA3A4Cells()) {
    test(`${cell.id}: equals its fixture cell`, async () => {
      const fixture = base[cell.id];
      expect(fixture, "the fixture cell").toBeDefined();
      const record = await recordEdit(cell, { short: true });
      expect(
        { write: record.write, calls: record.calls, typed: record.typed },
        "the write and the letter after it"
      ).toEqual({
        write: fixture.write,
        calls: fixture.calls,
        typed: fixture.typed,
      });
      expect(record.errors, "console errors").toEqual([]);
      await expectEdit({
        stored: cell.stored,
        place: cell.place,
        action: cell.action,
        write: fixture.write,
        calls: fixture.calls,
        source: "check 2, A3 and A4: the head's write",
      });
    });
  }
});

describe("16.11: Link over a range with an element-point end (base-link-element-end)", () => {
  const base = linkElementEndJson as Record<
    string,
    { write: string | null; failed?: string }
  >;
  /** Link opened by the toolbar's button, the address confirmed by Apply. */
  const linkByApply: Step = async () => {
    await userEvent.click(
      document.querySelector<HTMLElement>('[aria-label="Link"]')!
    );
    await settle();
    const input =
      document.querySelector<HTMLInputElement>('[aria-label="URL"]');
    expect(input, "the URL field").not.toBeNull();
    await userEvent.fill(input!, "https://example.org/");
    await userEvent.click(
      [...document.querySelectorAll<HTMLElement>("button")].find(
        (element) => element.textContent === "Apply"
      )!
    );
    await settle();
  };
  for (const cell of linkElementEndCells()) {
    for (const [way, action] of [
      ["Enter in the toolbar's Link", link()],
      ["the popover's Apply", linkByApply],
    ] as const) {
      const head = base[cell.id]?.failed;
      test(`${cell.id}, ${way}: the write of the same range with text-point ends, no throw${head === undefined ? "" : ` (the head throws: ${head.slice(0, 60)})`}`, async () => {
        expect(base[cell.id], "the fixture cell").toBeDefined();
        const oracle = await recordEdit(
          { stored: cell.stored, place: cell.textPlace, action },
          { short: true }
        );
        expect(oracle.errors, "the oracle's console errors").toEqual([]);
        expect(oracle.calls, "the oracle writes").toBe(1);
        await expectEdit({
          stored: cell.stored,
          place: cell.place,
          action,
          write: oracle.write,
          source: "check 5, 16.11; T11.7",
        });
      });
    }
  }
});

describe("clicks (T9.2 L, T10.8, 15.7, 16.16)", () => {
  const LINKED = '<a href="https://example.org/l">Lw</a>';
  const BIG_IMG =
    '<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />';
  const SHAPES: Record<string, (node: string) => string> = {
    ordinary: (node) =>
      `<p>Aw${LINKED}</p>${node.startsWith("<img") ? `<p>${node}</p>` : node}<p>Cw</p>`,
    lined: (node) => `<ul><li>Aw${LINKED}${node}Cw</li></ul>`,
    "lined quote": (node) => `<blockquote>Aw${LINKED}${node}Cw</blockquote>`,
  };
  const isNodeSelected = () =>
    editorOf()!
      .getEditorState()
      .read(() => $isNodeSelection($getSelection()));
  /** A click at Cw's start, then ArrowLeft until the node is selected. */
  const selectByArrow: Step = async () => {
    await at("Cw", 0)();
    for (let press = 0; press < 3 && isNodeSelected() === false; press++) {
      await keys("{ArrowLeft}")();
    }
    expect(isNodeSelected(), "a node selected").toBe(true);
  };
  const spanOf = (word: string) =>
    [...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]")].find(
      (element) => element.textContent === word
    )!;
  const pointIn = (word: string, offset: number) => {
    const span = spanOf(word);
    const range = document.createRange();
    range.setStart(span.firstChild!, offset);
    range.setEnd(span.firstChild!, offset);
    const rect = range.getBoundingClientRect();
    const box = span.getBoundingClientRect();
    return { x: rect.left, y: box.top + box.height / 2 };
  };
  const withK = (html: string, word: string) =>
    html.replace(`>${word}<`, `>${word[0]}k${word.slice(1)}<`);

  test("gives a caret at the click (QTR after the rule was node-selected)", async () => {
    await expectEdit({
      stored: LI(`${QUOTE("Q0w")}T1w<hr>`),
      place: then(at("T1w"), keys("{ArrowRight}"), at("Q0w", 0)),
      action: letter,
      write: W(`<li>${QUOTE("kQ0w")}T1w<hr /></li>`),
      source: "check 2, L (rich-text-line-round13)",
    });
  });

  for (const [shape, html] of Object.entries(SHAPES)) {
    for (const node of ["<hr>", BIG_IMG]) {
      const nodeName = node === "<hr>" ? "rule" : "image";
      for (const [word, offset] of [
        ["Aw", 1],
        ["Lw", 1],
        ["Cw", 1],
      ] as const) {
        const stored = html(node);
        const want = short(withK(stored, word));
        test(`a click into text while a node is selected gives a caret at the click: ${shape}, ${nodeName}, ${word}`, async () => {
          const onChange = await mount(stored);
          await selectByArrow();
          await at(word, offset)();
          await letter();
          expect(short(lastHtml(onChange))).toBe(want);
        });
        if (shape === "lined quote") {
          continue;
        }
        // Step 1e (T11.10): with Shift decided at the click, the cells in
        // the link's text still pass
        const control = word === "Lw" ? "control: " : "";
        test(`${control}15.7 Shift+press after a node selection, repeated: ${shape} ${nodeName} ${word}`, async () => {
          const results: string[] = [];
          for (let run = 0; run < 5; run += 1) {
            const onChange = await mount(stored);
            await selectByArrow();
            await shiftPress(spanOf(word), pointIn(word, offset))();
            await letter();
            results.push(short(lastHtml(onChange)));
            unmountField();
          }
          expect(results).toEqual(Array(5).fill(want));
        }, 60_000);
        test(`${control}15.7 Shift+press after a node selection, selectionchange-first: ${shape} ${nodeName} ${word}`, async () => {
          const onChange = await mount(stored);
          await selectByArrow();
          await forceOrder(
            "selectionchange-first",
            shiftPress(spanOf(word), pointIn(word, offset)),
            "pointerdown"
          )();
          await letter();
          expect(short(lastHtml(onChange))).toBe(want);
        });
      }
    }
  }

  // 16.16: a Shift+press anywhere inside the editable element, its padding
  // included, gives the caret the same press without Shift gives
  const paddingPoint = (where: "right" | "bottom") => {
    if (where === "right") {
      // T41.1: the editable is wider than the test page's viewport; its
      // right edge is scrolled into view so the press reaches it
      editable()!.scrollIntoView({ block: "nearest", inline: "end" });
    }
    const box = editable()!.getBoundingClientRect();
    const line = spanOf("Aw").getBoundingClientRect();
    const point =
      where === "right"
        ? { x: box.right - 3, y: line.top + line.height / 2 }
        : { x: box.left + box.width / 2, y: box.bottom - 3 };
    if (where === "right") {
      const hit = document.elementFromPoint(point.x, point.y);
      expect(
        hit !== null && editable()!.contains(hit),
        "the point is inside the field"
      ).toBe(true);
    }
    return point;
  };
  for (const shape of ["ordinary", "lined"] as const) {
    for (const [where, count] of [
      ["right", 30],
      ["bottom", 5],
    ] as const) {
      test(`${where === "right" ? "control: " : ""}16.16: a Shift+press in the ${where} padding after a node selection gives the caret the same press without Shift gives: ${shape}, ${count} runs`, async () => {
        const carets: string[] = [];
        for (let run = 0; run < count; run += 1) {
          for (const shift of [false, true]) {
            await mount(SHAPES[shape]("<hr>"));
            await selectByArrow();
            const point = paddingPoint(where);
            await (
              shift
                ? shiftPress(editable()!, point)
                : hold(editable()!, 0, point)
            )();
            carets.push(caretKey());
            unmountField();
          }
        }
        for (let run = 0; run < count; run += 1) {
          expect(carets[2 * run + 1], `run ${run}`).toBe(carets[2 * run]);
        }
      }, 120_000);
    }
  }

  test("a double click selects the word", async () => {
    await mount(LI("T0w<hr>T2w"));
    await at("T0w", 1)();
    await realClicks(spanOf("T0w"), 2, 50)();
    expect(caretKey()).toBe("text:T0w@0|text:T0w@3");
  });
  test("a triple click in a lined item selects the line (accepted)", async () => {
    await mount(LI("T0w<hr>T2w"));
    await tripleClick("T0w")();
    expect(caretKey()).toBe("text:T0w@0|text:T0w@3");
  });
  test("a click on a rule node-selects it", async () => {
    await mount(LI("T0w<hr>T2w"));
    const rule = editable()!.querySelector("hr")!.getBoundingClientRect();
    await clickAt(rule.left + rule.width / 2, rule.top + rule.height / 2)();
    expect(caretKey()).toBe("node:horizontalrule");
  });
  test("V11: a real click on the first rule, Backspace, then k", async () => {
    const clickFirstRule: Step = async () => {
      const rule = editable()!.querySelector("hr")!.getBoundingClientRect();
      await clickAt(rule.left + rule.width / 2, rule.top + rule.height / 2)();
      expect(caretKey(), "the clicked rule selected").toBe(
        "node:horizontalrule"
      );
    };
    // the caret and the typed value no check names: sent as a P record
    // (P19-3), not pinned
    await expectEdit({
      stored: LI("<br><hr><hr>"),
      place: clickFirstRule,
      action: backspace,
      write: W("<li><br /><hr /></li>"),
      source:
        "derived (D15); measured at <base> and 451f20f04 (check 5: V11 BRR click first rule Backspace k)",
    });
  });
  for (const [name, stored] of [
    ["an image", `<p>Aw ${BIG_IMG} Bw</p>`],
    [
      "a figure",
      '<p>Aw</p><figure><img src="https://e.org/f.png" alt="F" /><figcaption>Cap</figcaption></figure><p>Bw</p>',
    ],
  ] as const) {
    test(`control: a click on ${name} opens its popover and selects nothing`, async () => {
      await mount(stored);
      await userEvent.click(editable()!.querySelector("img")!);
      await settle();
      expect(
        [...document.querySelectorAll("label")].some(
          (label) => label.textContent === "Alt"
        ),
        "the popover"
      ).toBe(true);
      expect(caretKey()).toBe("none");
    });
  }
});

describe("T13.1: an image from a code-block caret lands after the code block", () => {
  const ROOT = "<p>Pw</p><pre><code>C1w</code></pre><p>Nw</p>";
  runRows([
    {
      name: "T13.1: Image from mid code in a root code block",
      stored: ROOT,
      place: at("C1w", 1),
      action: imageButton,
      write: "<p>Pw</p><pre><code>C1w</code></pre><p><img /></p><p>Nw</p>",
      source: "ruled, not built at the carry: T13.1",
    },
    {
      name: "T13.1: Image from the code block's end",
      stored: ROOT,
      place: at("C1w"),
      action: imageButton,
      write: "<p>Pw</p><pre><code>C1w</code></pre><p><img /></p><p>Nw</p>",
      source: "ruled, not built at the carry: T13.1",
    },
    {
      name: "T13.1: Image from a range in a root code block (T40.4)",
      stored: ROOT,
      place: range("C1w", 1, "C1w", 2),
      action: imageButton,
      write: "<p>Pw</p><pre><code>Cw</code></pre><p><img /></p><p>Nw</p>",
      source: "T13.1, T40.4 (a range: the place after the removal step)",
    },
    // a real click in the gap between the code block and the rule leaves
    // the caret after the rule at <base>, 451f20f04 and the branch, never
    // at the code's end (P19-4): the code's end is clicked in its text
    {
      name: "T13.1: an item's code block then a rule, the caret at the code's end by a real click",
      stored: LI("<pre><code>C0w</code></pre><hr>"),
      place: async () => {
        await at("C0w")();
        expect(caretKey(), "the code's end").toBe("text:C0w@3");
      },
      action: imageButton,
      write: W("<li><pre><code>C0w</code></pre><img /><hr /></li>"),
      source: "ruled, not built at the carry: T13.1",
    },
  ]);
  // T41.2's three cells, pinned as they print (T43.2; P20-14)
  runRows(
    (
      [
        ["Pw@1..C1w@1", range("Pw", 1, "C1w", 1), "<p>P<img />1w</p><p>Nw</p>"],
        [
          "C1w@1..Nw@1",
          range("C1w", 1, "Nw", 1),
          "<p>Pw</p><pre><code>Cw</code></pre><p><img /></p>",
        ],
        [
          "C1w@0..C1w@3",
          range("C1w", 0, "C1w", 3),
          "<p>Pw</p><pre><code></code></pre><p><img /></p><p>Nw</p>",
        ],
      ] as const
    ).map(([name, place, write]) => ({
      name: `T41.2: Image from a range ${name}`,
      stored: ROOT,
      place,
      action: imageButton,
      write,
      source: "T43.2 (as printed, P20-14)",
    }))
  );
});

void act;
