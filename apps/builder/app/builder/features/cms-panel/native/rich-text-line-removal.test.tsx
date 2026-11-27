// 5.4, D5, D16, V8, K12, D1's exceptions in ordinary content, T0, T1, F0,
// F1, Safari's path, the removal-path pin and T23.1's line-break join.
import { describe, expect, test } from "vitest";
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
  DELETE_CHARACTER_COMMAND,
  type ElementNode,
  type LexicalNode,
  type NodeKey,
  type RangeSelection,
} from "lexical";
import {
  $rangeOracle,
  $wherePoint,
  at,
  backspace,
  button,
  cut,
  cutByKey,
  del,
  drop,
  enter,
  expectEdit,
  ime,
  imageButton,
  IMG,
  itemEnd,
  keys,
  letter,
  LI,
  lineBack,
  lineForward,
  mount,
  nodeSelect,
  pasteHtml,
  pasteOwn,
  pasteText,
  range,
  rangeToLineStart,
  recordEdit,
  replaceText,
  shiftEnter,
  short,
  then,
  tripleClick,
  W,
  WJ,
  wordBack,
  wordForward,
  type Held,
  type Step,
} from "./rich-text-line-test-kit";
import { undoDepth } from "./rich-text-line-test-kit-branch";
import { CmsImageNode } from "./rich-text-image-node";
import { $hasMark, REMOVAL_TAG } from "./rich-text-line-removal";
import {
  ACTIONS_1511,
  cells1511,
  runCell1511,
} from "./rich-text-line-cells-1511";
import fixture1511Json from "./__fixtures__/rich-text-line-base-1511-removal.json";
import { sameState } from "./rich-text-line-test-compare";
import { editable, editorOf, lastHtml, settle } from "./rich-text-test-harness";

const BQ = (text: string) => `<blockquote><p>${text}</p></blockquote>`;
const PRE = (text: string) => `<pre><code>${text}</code></pre>`;
const divider = button("Divider");
const shiftRight = (presses: number) =>
  then(
    ...Array.from({ length: presses }, () =>
      keys("{Shift>}{ArrowRight}{/Shift}")
    )
  );

describe("5.4: removals", () => {
  test("V8: Enter over a range that empties a quote", async () => {
    await expectEdit({
      stored: LI(`T0w${BQ("Q1w")}`),
      place: range("T0w", 1, "Q1w", 2),
      action: enter,
      write: W("<li>T</li><li>w</li>"),
      caret: "text:w@0",
      source: "check V8",
    });
  });

  test("V8: the same, a backward range", async () => {
    await expectEdit({
      stored: LI(`T0w${BQ("Q1w")}`),
      place: range("Q1w", 2, "T0w", 1),
      action: enter,
      write: W("<li>T</li><li>w</li>"),
      caret: "text:w@0",
      source: "check V8",
    });
  });

  test("V8: a cut over that range", async () => {
    await expectEdit({
      stored: LI(`T0w${BQ("Q1w")}`),
      place: range("T0w", 1, "Q1w", 2),
      action: cut,
      write: W("<li>Tw</li>"),
      source: "check V8",
    });
  });

  test("V8: the same cut, backward", async () => {
    await expectEdit({
      stored: LI(`T0w${BQ("Q1w")}`),
      place: range("Q1w", 2, "T0w", 1),
      action: cut,
      write: W("<li>Tw</li>"),
      source: "check V8",
    });
  });

  test("V8: a real Ctrl+X into a quote's text", async () => {
    await expectEdit({
      stored: `<ul><li>xq${BQ("qq")}yq</li></ul>`,
      place: range("xq", 1, "qq", 1),
      action: cutByKey,
      write: "<ul><li>xq<br />yq</li></ul>",
      source: "check V8; T11.1",
    });
  });

  test("a cut from inside a code block into the line after it removes what its clipboard holds", async () => {
    await expectEdit({
      stored: `<ul><li>Pw</li><li>T0w${PRE("C1w")}T2w</li><li>Nw</li></ul>`,
      place: range("C1w", 1, "T2w", 2),
      action: cut,
      write: W(`<li>T0w${PRE("Cw")}</li>`),
      source: "check 3, Ruled with no change; T14.14",
    });
  });

  test("the same range, Backspace", async () => {
    await expectEdit({
      stored: `<ul><li>Pw</li><li>T0w${PRE("C1w")}T2w</li><li>Nw</li></ul>`,
      place: range("C1w", 1, "T2w", 2),
      action: backspace,
      write: W(`<li>T0w${PRE("Cw")}</li>`),
      source: "check 3, Ruled with no change",
    });
  });

  test("V8: Enter over a range through a leading rule", async () => {
    await expectEdit({
      stored: LI("<hr>T1w"),
      place: range("Pw", 1, "T1w", 2),
      action: enter,
      write: WJ("<li>P</li><li>w</li>"),
      caret: "text:w@0",
      source: "check V8",
    });
  });

  test("V8: Enter over a range into TRT's text", async () => {
    await expectEdit({
      stored: LI("T0w<hr>T2w"),
      place: range("Pw", 1, "T0w", 2),
      action: enter,
      write: WJ("<li>P</li><li>w<hr />T2w</li>"),
      source: "check V8",
    });
  });

  test("K12: Enter over a range into a heading", async () => {
    await expectEdit({
      stored: LI("T0w<h3>H1w</h3>"),
      place: range("T0w", 1, "H1w", 3),
      action: enter,
      write: W("<li>T</li><li></li>"),
      source: "spec 5.7",
    });
  });

  test("K12: the same in a quote that holds a list", async () => {
    await expectEdit({
      stored: "<blockquote>X0w<h3>H1w</h3><ul><li>Yw</li></ul></blockquote>",
      place: range("X0w", 1, "H1w", 3),
      action: enter,
      write: "<blockquote>X<p></p><ul><li>Yw</li></ul></blockquote>",
      caret: "element:paragraph@0",
      source: "spec 5.7",
    });
  });

  test("an item of only a quote and a nested list joins the item before", async () => {
    await expectEdit({
      stored: `<ul><li>Pw</li><li>${BQ("Q0w")}<ul><li>L1w</li></ul></li></ul>`,
      place: at("Q0w", 0),
      action: backspace,
      write: "<ul><li>PwQ0w<ul><li>L1w</li></ul></li></ul>",
      source: "spec 5.7, check section 2",
    });
  });

  test("triple-click then Enter leaves the head's two empty items", async () => {
    await expectEdit({
      stored: "<ul><li>Aw</li><li>Bw</li></ul>",
      place: tripleClick("Aw"),
      action: enter,
      write: "<ul><li></li><li></li><li>Bw</li></ul>",
      source: "from M8g; spec 5.4",
    });
  });

  test("a removal by Enter that empties an item", async () => {
    await expectEdit({
      stored: LI(BQ("Q1w")),
      place: range("Pw", 1, "Q1w", 3),
      action: enter,
      write: "<ul><li>P</li><li></li><li>Nw</li></ul>",
      source: "from P10a; spec 5.4",
    });
  });

  test("a removal by Shift+Enter that empties an item", async () => {
    await expectEdit({
      stored: LI(BQ("Q1w")),
      place: range("Pw", 1, "Q1w", 3),
      action: shiftEnter,
      write: "<ul><li>P<br /></li><li>Nw</li></ul>",
      source: "from P10b; spec 5.4",
    });
  });

  test("a removal by Divider that empties an item", async () => {
    await expectEdit({
      stored: LI(BQ("Q1w")),
      place: range("Pw", 1, "Q1w", 3),
      action: divider,
      write: `<ul><li>Pw</li><li></li></ul><hr /><ul><li>${BQ("Q1w")}</li><li>Nw</li></ul>`,
      source: "from P10c; spec 5.7, T2",
    });
  });

  test("a cut that empties an item leaves no empty item, with real clipboard events", async () => {
    await expectEdit({
      stored: LI(BQ("Q1w")),
      place: range("Pw", 1, "Q1w", 3),
      action: cutByKey,
      write: WJ("<li>P</li>"),
      source: "derived (5.4), section 10; measured",
    });
  });

  test("Backspace by the decorator path with the selection changed inside the edit", async () => {
    await expectEdit({
      stored: LI("T0w<hr>T2w"),
      place: at("T2w", 0),
      action: backspace,
      write: W("<li>T0wT2w</li>"),
      source: "section 10, D3",
    });
  });

  test("Backspace by the decorator path that leaves a caret line", async () => {
    await expectEdit({
      stored: LI(`<hr>${IMG}`),
      place: itemEnd(1),
      action: backspace,
      write: W("<li><hr /></li>"),
      source: "derived (section 10); measured",
    });
  });
});

describe("D5: a range into a block-led item's text joins first", () => {
  const stored = LI("<hr>T1w");
  const place = range("Pw", 1, "T1w", 2);

  test("D5: Image over a range into a block-led item's text", async () => {
    await expectEdit({
      stored,
      place,
      action: imageButton,
      write: WJ("<li>P<img />w</li>"),
      source: "D5",
    });
  });

  test("D5, the same range: a letter", async () => {
    await expectEdit({
      stored,
      place,
      action: letter,
      write: WJ("<li>Pkw</li>"),
      source: "derived (D5, every entry point); measured",
    });
  });

  test("D5: a composition", async () => {
    await expectEdit({
      stored,
      place,
      action: ime("a"),
      write: WJ("<li>Paw</li>"),
      // one value: the three at <proto> and <base> repeat it (16.10;
      // Task 20)
      calls: 1,
      source: "derived (D5); measured at <proto> and <base> (T12.9)",
    });
  });

  test("D5: Backspace", async () => {
    await expectEdit({
      stored,
      place,
      action: backspace,
      write: WJ("<li>Pw</li>"),
      source: "derived (D5); measured",
    });
  });

  test("D5: Delete", async () => {
    await expectEdit({
      stored,
      place,
      action: del,
      write: WJ("<li>Pw</li>"),
      source: "derived (D5); measured",
    });
  });

  test("D5: a cut", async () => {
    await expectEdit({
      stored,
      place,
      action: cut,
      write: WJ("<li>Pw</li>"),
      source: "ruled, not built at the carry: T11.1 (D5); T14.14",
    });
  });

  test("D5: a text paste", async () => {
    await expectEdit({
      stored,
      place,
      action: pasteText("Aq"),
      write: WJ("<li>PAqw</li>"),
      source: "derived (D5); measured",
    });
  });

  test("D5: Safari's replacement", async () => {
    await expectEdit({
      stored,
      place,
      action: replaceText("k"),
      write: WJ("<li>Pkw</li>"),
      source: "section 10",
    });
  });

  test("D5 and D14: a block paste joins first", async () => {
    await expectEdit({
      stored,
      place,
      action: pasteHtml("<p>Aq</p><p>Bq</p>"),
      write: "<ul><li>PAq</li></ul><p>Bqw</p><ul><li>Nw</li></ul>",
      source: "from M44a; spec 5.7, D14",
    });
  });

  test("D5 and D14: a block paste in RBT", async () => {
    await expectEdit({
      stored: LI("<hr><br>T1w"),
      place,
      action: pasteHtml("<p>Aq</p><p>Bq</p>"),
      write: "<ul><li>PAq</li></ul><p>Bqw</p><ul><li>Nw</li></ul>",
      source: "from M44a; spec 5.7",
    });
  });

  test("D5 and D14: a block paste from a line of the item before", async () => {
    await expectEdit({
      stored: `<ul><li>T0w${BQ("Q1w")}Lw</li><li><hr>T1w</li><li>Nw</li></ul>`,
      place: range("Lw", 1, "T1w", 2),
      action: pasteHtml("<p>Aq</p><p>Bq</p>"),
      write: `<ul><li>T0w${BQ("Q1w")}LAq</li></ul><p>Bqw</p><ul><li>Nw</li></ul>`,
      source: "from M44b; spec 5.7",
    });
  });

  test("D5 and D14: a drop joins first", async () => {
    await expectEdit({
      stored,
      place,
      action: drop("<p>Dq</p>"),
      write: "<ul><li>PDqw</li><li>Nw</li></ul>",
      source: "from M51; spec 5.7, D5, D14",
    });
  });

  test("D5: a range that ends in a block of a block-led item keeps the item's rest", async () => {
    await expectEdit({
      stored: LI("<h3>H0w</h3>T1w"),
      place: range("Pw", 1, "H0w", 3),
      action: backspace,
      write: WJ("<li>P</li><li>T1w</li>"),
      source: "spec 5.4",
    });
  });

  test("TS2: a letter over a range into a text-led item", async () => {
    await expectEdit({
      stored: LI("T0w<hr>"),
      place: range("Pw", 1, "T0w", 2),
      action: letter,
      write: "<ul><li>Pkw<hr /></li><li>Nw</li></ul>",
      source: "from M17a; 5.7",
    });
  });

  test("TS2: Image over that range", async () => {
    await expectEdit({
      stored: LI("T0w<hr>"),
      place: range("Pw", 1, "T0w", 2),
      action: imageButton,
      write: "<ul><li>P<img />w<hr /></li><li>Nw</li></ul>",
      source: "from M17b; 5.7",
    });
  });

  test("FS7: a letter over a range into a quote-led item's text", async () => {
    await expectEdit({
      stored: LI(`${BQ("Q0w")}T1w<hr>`),
      place: range("Pw", 0, "T1w", 1),
      action: keys("a"),
      write: "<ul><li>a1w<hr /></li><li>Nw</li></ul>",
      source: "from M17c; 5.7",
    });
  });

  test("D16: T13, an item holding only its line break stays", async () => {
    await expectEdit({
      stored: LI(`${BQ("Q0w")}<br>`),
      place: range("Pw", 1, "Q0w", 2),
      action: imageButton,
      write: WJ("<li>P<img />w</li><li><br /></li>"),
      source: "D16",
    });
  });

  test("D16: K0 BQT, the quote the caret is in stays", async () => {
    await expectEdit({
      stored: LI(`<br>${BQ("Q1w")}T2w`),
      place: range("Q1w", 0, "T2w", 3),
      action: letter,
      write: W(`<li><br />${BQ("k")}</li>`),
      source: "derived (D16); measured",
    });
  });
});

describe("section 9: the head hangs, throws or loses content", () => {
  test("T0: Image over an item's whole text before a rule", async () => {
    await expectEdit({
      stored: LI("T0w<hr>"),
      place: range("T0w", 0, "T0w", 3),
      action: imageButton,
      write: "<ul><li>Pw</li><li><img /><hr /></li><li>Nw</li></ul>",
      source: "from P17; section 9",
    });
  });

  test("T1: Image over a range in a quote that holds a list", async () => {
    await expectEdit({
      stored:
        "<ul><li>Pw</li><li><blockquote>X0w<ul><li>X1w</li></ul>X2w</blockquote></li><li>Nw</li></ul>",
      place: range("X1w", 1, "X2w", 2),
      action: imageButton,
      write:
        "<ul><li>Pw</li><li><blockquote>X0w<ul><li>X<img />w</li></ul></blockquote></li><li>Nw</li></ul>",
      source: "from P18; section 9",
    });
  });

  test("F0: Backspace over a selection made with Shift+ArrowRight", async () => {
    await expectEdit({
      stored: LI(`T0w${BQ("Q1w")}T2w`),
      place: then(at("Q1w"), shiftRight(2)),
      action: backspace,
      write: `<ul><li>Pw</li><li>T0w${BQ("Q1w2w")}</li><li>Nw</li></ul>`,
      source: "from P23; section 9",
    });
  });

  test("F1: a letter after a triple-click on the text after a block", async () => {
    await expectEdit({
      stored: LI(`T0w${BQ("Q1w")}T2w`),
      place: tripleClick("T2w"),
      action: letter,
      write: `<ul><li>Pw</li><li>T0w${BQ("Q1w")}k</li><li>Nw</li></ul>`,
      source: "from P22; section 9",
    });
  });
});

describe("D1's exceptions in ordinary content", () => {
  test("group 4: Backspace at a root quote's start leaves no empty quote", async () => {
    await expectEdit({
      stored: `<p>Pw</p>${BQ("Q0w")}`,
      place: at("Q0w", 0),
      action: backspace,
      write: "<p>PwQ0w</p>",
      source: "derived (5.4; map 1 group 4); measured",
    });
  });

  test("group 4: a quote emptied by Backspace over a range", async () => {
    await expectEdit({
      stored: `<p>Pw</p>${BQ("Q0w")}<p>Nw</p>`,
      place: range("Pw", 1, "Q0w", 3),
      action: backspace,
      write: "<p>P</p><p>Nw</p>",
      source: "derived (5.4); measured",
    });
  });

  test("group 5: an item holding only a quote, joined by Delete", async () => {
    await expectEdit({
      stored: `<ul><li>Pw</li><li>${BQ("Q0w")}</li><li>Nw</li></ul>`,
      place: at("Pw"),
      action: del,
      write: "<ul><li>PwQ0w</li><li>Nw</li></ul>",
      source: "derived (5.4; map 1 group 5); measured",
    });
  });

  test("group 5: the same with a heading, by Backspace", async () => {
    await expectEdit({
      stored: "<ul><li>Pw</li><li><h3>H0w</h3></li><li>Nw</li></ul>",
      place: at("H0w", 0),
      action: backspace,
      write: "<ul><li>PwH0w</li><li>Nw</li></ul>",
      source: "derived (5.4); measured",
    });
  });

  test("group 17: Delete before a nested list leaves no empty item", async () => {
    await expectEdit({
      stored:
        "<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>",
      place: at("T0w"),
      action: del,
      write: "<ul><li>Pw</li><li>T0wL1w</li><li>Nw</li></ul>",
      source: "derived (5.4; map 1 group 17); measured",
    });
  });

  test("an emptied list goes", async () => {
    await expectEdit({
      stored: `<p>Pw</p><ul><li>${BQ("Q0w")}</li></ul>`,
      place: at("Pw"),
      action: del,
      write: "<p>PwQ0w</p>",
      source: "derived (5.4); measured",
    });
  });

  test("F3: Bulleted with an image node-selected in a root quote", async () => {
    await expectEdit({
      stored: `<p>Pw</p><blockquote><p>X0w${IMG}</p></blockquote><p>Nw</p>`,
      place: nodeSelect("cms-image"),
      action: button("Bulleted list"),
      write: "<p>Pw</p><ul><li>X0w<img /></li></ul><p>Nw</p>",
      source: "from P27; D1, section 9",
    });
  });

  test("K14: Delete in a quote before a nested list", async () => {
    await expectEdit({
      stored: LI(`${BQ("Q0w")}<ul><li>L1w</li></ul>`),
      place: at("Q0w"),
      action: del,
      write: `<ul><li>Pw</li><li>${BQ("Q0wL1w")}</li><li>Nw</li></ul>`,
      source: "from P28; D1, section 9",
    });
  });
});

describe("section 10: Safari's replacement is the letter", () => {
  const cases: Array<[string, string, Step, string]> = [
    [
      "ordinary content",
      LI("T1w"),
      range("Pw", 1, "T1w", 1),
      "<ul><li>Pk1w</li><li>Nw</li></ul>",
    ],
    [
      "ordinary content, into the last item",
      LI("T1w"),
      range("Pw", 2, "Nw", 0),
      "<ul><li>PwkNw</li></ul>",
    ],
    ["D5", LI("<hr>T1w"), range("Pw", 1, "T1w", 2), WJ("<li>Pkw</li>")],
  ];
  for (const [name, stored, place, write] of cases) {
    test(`${name}: replaceText`, async () => {
      await expectEdit({ stored, place, action: replaceText("k"), write });
    });
    test(`${name}: a letter`, async () => {
      await expectEdit({ stored, place, action: letter, write });
    });
  }
});

describe("every Lexical path that removes a range dispatches a marked command", () => {
  const stored = LI(`T0w${BQ("Q1w")}T2w`);
  const place = range("T0w", 1, "T2w", 1);
  const actions: Array<[string, Step]> = [
    ["Backspace", backspace],
    ["Delete", del],
    ["Ctrl+Backspace", wordBack],
    ["Ctrl+Delete", wordForward],
    ["lineBack", lineBack],
    ["lineForward", lineForward],
    ["cut", cut],
    ["letter", letter],
    ["ime", ime("a")],
    ["paste HTML", pasteHtml("<p>Aq</p><p>Bq</p>")],
    ["paste text", pasteText("Aq")],
    ["pasteOwn", pasteOwn("<p>Aq</p><p>Bq</p>")],
    ["drop", drop("<p>Dq</p>")],
    ["Enter", enter],
    ["Shift+Enter", shiftEnter],
    ["Image", imageButton],
    ["replaceText", replaceText("k")],
  ];
  for (const [name, action] of actions) {
    test(`${name}: the emptied quote goes`, async () => {
      const record = await recordEdit({ stored, place, action });
      // a composition hands out one value: the three at <base> repeat it
      // (16.10; Task 20)
      expect(record.calls).toBe(1);
      expect(record.write).not.toContain("blockquote");
      expect(record.errors).toEqual([]);
      expect(record.slowest).toBeLessThan(2000);
    });
  }
  test("Divider over a range takes the head's path and removes nothing (check 2, A4)", async () => {
    const record = await recordEdit({ stored, place, action: divider });
    expect(record.write).toContain("blockquote");
    expect(record.errors).toEqual([]);
  });
});

describe("T23.1: a removal that ends at the start of a line holding only a line break, directly after a block, joins that line as an empty paragraph joins", () => {
  const CB = LI(`${PRE("C0w")}<br>`);
  const HB = LI("<h3>H0w</h3><br>");
  const pressPlace = (word: string) => then(at(word, 2), shiftRight(2));
  // T23.1 holds for every entry point (T30.3)
  const entries: Array<[string, Step, (block: string) => string]> = [
    ["a letter", letter, (block) => `${block}k`],
    ["a text paste", pasteText("Aq"), (block) => `${block}Aq`],
    ["Backspace", backspace, (block) => block],
    ["Delete", del, (block) => block],
    ["a cut", cut, (block) => block],
  ];
  for (const [name, action, text] of entries) {
    test(`M28s-CB-Right-2, ${name}`, async () => {
      await expectEdit({
        stored: CB,
        place: pressPlace("C0w"),
        action,
        write: W(`<li>${PRE(text("C0"))}</li>`),
        source: "T23.1; ruled, not built at the carry",
      });
    });
    test(`M28s-HB-Right-2, ${name}`, async () => {
      await expectEdit({
        stored: HB,
        place: pressPlace("H0w"),
        action,
        write: W(`<li><h3>${text("H0")}</h3></li>`),
        source: "T23.1; ruled, not built at the carry",
      });
    });
  }

  test("M28s-TCB-Right-2, a letter", async () => {
    await expectEdit({
      stored: LI(`T0w${PRE("C1w")}<br>`),
      place: pressPlace("C1w"),
      action: letter,
      write: W(`<li>T0w${PRE("C1k")}</li>`),
      source: "T23.1; ruled, not built at the carry",
    });
  });

  test("M28s-THB-Right-2, a letter", async () => {
    await expectEdit({
      stored: LI("T0w<h3>H1w</h3><br>"),
      place: pressPlace("H1w"),
      action: letter,
      write: W("<li>T0w<h3>H1k</h3></li>"),
      source: "T23.1; ruled, not built at the carry",
    });
  });

  test("M61, a letter", async () => {
    await expectEdit({
      stored: `<ul><li>${PRE("C0w")}<br></li><li>Nw</li></ul>`,
      place: rangeToLineStart("C0w", 0),
      action: letter,
      write: `<ul><li>${PRE("k")}</li><li>Nw</li></ul>`,
      source: "T23.1; ruled, not built at the carry",
    });
  });
});

describe("T30.1: T23.1 over the whole word of the block: the emptied block holds the caret and exports nothing", () => {
  for (const [name, stored, word, empty, typed] of [
    ["a heading", LI("<h3>H0w</h3><br>"), "H0w", "heading", "<h3>k</h3>"],
    ["a code block", LI(`${PRE("C0w")}<br>`), "C0w", "code", PRE("k")],
  ] as const) {
    test(`${name}, Backspace, then a letter`, async () => {
      await expectEdit({
        stored,
        place: rangeToLineStart(word, 0),
        action: backspace,
        write: W("<li></li>"),
        caret: `element:${empty}@0`,
        typed: W(`<li>${typed}</li>`),
        source: "T30.1 (P13-1)",
      });
    });
  }
});

describe("T30.2: a removal that ends at the start of a line led by a line break, directly after a block, removes that break; the rest of the line stays a line after the block", () => {
  const ITEM = LI("<h3>H0w</h3><br>Tw");
  const QUOTE = "<blockquote><h3>H0w</h3><br>Tw</blockquote>";
  test("Backspace from H0w@2 in an item", async () => {
    await expectEdit({
      stored: ITEM,
      place: rangeToLineStart("H0w", 2),
      action: backspace,
      write: W("<li><h3>H0</h3>Tw</li>"),
      caret: "text:H0@2",
      source: "T30.2 (P13-2)",
    });
  });
  test("Backspace from H0w@2 in a quote", async () => {
    await expectEdit({
      stored: QUOTE,
      place: rangeToLineStart("H0w", 2),
      action: backspace,
      write: "<blockquote><h3>H0</h3>Tw</blockquote>",
      caret: "text:H0@2",
      source: "T30.2 (P13-2)",
    });
  });
  test("Backspace from H0w@0 in a quote: the caret in the emptied heading, then a letter", async () => {
    // the write while the heading is empty: T31.1 (P13-6)
    const record = await recordEdit(
      { stored: QUOTE, place: rangeToLineStart("H0w", 0), action: backspace },
      { typeAfter: true }
    );
    expect(record.write, "write").toBe("<blockquote><h3></h3>Tw</blockquote>");
    expect(record.calls, "calls").toBe(1);
    expect(record.caret, "caret").toBe("element:heading@0");
    expect(record.typed, "typed").toBe("<blockquote><h3>k</h3>Tw</blockquote>");
    expect(record.undoRestores, "undo restores the state before").toBe(true);
    expect(record.redoEquals, "redo equals the write").toBe(true);
    expect(record.errors, "console errors").toEqual([]);
    expect(record.slowest, "slowest step in ms").toBeLessThan(2000);
  });
  // every other entry point: Backspace over the range, then the key (a
  // delete and a cut write what Backspace writes)
  const others: Array<[string, Step, boolean]> = [
    ["a letter", letter, true],
    ["a text paste", pasteText("Aq"), true],
    ["Enter", enter, true],
    ["Delete", del, false],
    ["a cut", cut, false],
  ];
  for (const [where, stored] of [
    ["an item", ITEM],
    ["a quote", QUOTE],
  ] as const) {
    for (const offset of [2, 0]) {
      for (const [name, action, keyAfter] of others) {
        test(`${name} from H0w@${offset} in ${where} is Backspace, then the key`, async () => {
          const place = rangeToLineStart("H0w", offset);
          const oracle = await recordEdit({
            stored,
            place: keyAfter ? then(place, backspace) : place,
            action: keyAfter ? action : backspace,
          });
          expect(oracle.write, "the oracle keeps the line").toContain("Tw");
          await expectEdit({
            stored,
            place,
            action,
            write: oracle.write,
            source: "T30.2, T30.3: derived (Backspace, then the key)",
          });
        });
      }
    }
  }
});

describe("T32.2: T30.2 applies from the block the range starts in, wherever it stands before the line", () => {
  const cells: Array<[string, string, string, string, string]> = [
    [
      "a heading before the quote",
      LI("A0w<h3>H0w</h3><blockquote><p>Q0w</p></blockquote><br>B1w"),
      "H0w",
      "<li>A0w<h3>H</h3>B1w</li>",
      "text:H@1",
    ],
    [
      "the quote directly before the line",
      LI("A0w<blockquote><p>Q0w</p></blockquote><br>B1w"),
      "Q0w",
      "<li>A0w<blockquote><p>Q</p></blockquote>B1w</li>",
      "text:Q@1",
    ],
    [
      "a code block before the quote (the rest does not become code)",
      LI(
        "A0w<pre><code>C0w</code></pre><blockquote><p>Q0w</p></blockquote><br>B1w"
      ),
      "C0w",
      "<li>A0w<pre><code>C</code></pre>B1w</li>",
      "text:C@1",
    ],
  ];
  for (const [name, stored, word, write, caret] of cells) {
    test(`Backspace from ${word}@1 in ${name}`, async () => {
      await expectEdit({
        stored,
        place: rangeToLineStart(word, 1),
        action: backspace,
        write: W(write),
        caret,
        source: "T32.2 (twin measured at <base>, P13-6's T31.2 table)",
      });
    });
  }
});

describe("T31: a range from a block into a root quote's first line joins only that line; the quote's rest stays", () => {
  const QP = "<p>Pw</p><blockquote>X1w<p>X2w</p></blockquote>";
  const QB = "<p>Pw</p><blockquote>X1w<br>X2w</blockquote>";
  const cells: Array<[string, string, Step, string, string]> = [
    [
      "a letter, the quote's rest a paragraph",
      QP,
      letter,
      "<p>Pk1w</p><blockquote><p>X2w</p></blockquote>",
      "T31's row principle",
    ],
    [
      "Backspace, the quote's rest a paragraph",
      QP,
      backspace,
      "<p>P1w</p><blockquote><p>X2w</p></blockquote>",
      "T31's row principle",
    ],
    [
      "a cut, the quote's rest a paragraph",
      QP,
      cut,
      "<p>P1w</p><blockquote><p>X2w</p></blockquote>",
      "T31's row principle",
    ],
    [
      "a letter, the line led on by a line break",
      QB,
      letter,
      "<p>Pk1w<br />X2w</p>",
      "measured: <base> writes the same",
    ],
    [
      "Backspace, the line led on by a line break",
      QB,
      backspace,
      "<p>P1w<br />X2w</p>",
      "measured: <base> writes the same",
    ],
  ];
  for (const [name, stored, action, write, source] of cells) {
    test(name, async () => {
      await expectEdit({
        stored,
        place: range("Pw", 1, "X1w", 1),
        action,
        write,
        source,
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Step 1b: a removal removes what its range holds (5.4; T10.2, T10.5, T9.2 E)

const $allNodes = () => {
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

type End =
  | { word: string; offset: number }
  | { $point: () => { key: NodeKey; offset: number } };

const $endPoint = (end: End) => {
  if ("word" in end) {
    const found = $allNodes().find(
      (node) => $isTextNode(node) && node.getTextContent() === end.word
    );
    expect(found, end.word).toBeDefined();
    return { key: found!.getKey(), offset: end.offset, type: "text" as const };
  }
  return { ...end.$point(), type: "element" as const };
};

/** A range between two ends, set in an update after a real click on the field. */
const between =
  (from: End, to: End): Step =>
  async () => {
    await userEvent.click(editable()!);
    await settle();
    await act(async () => {
      editorOf()!.update(() => {
        const a = $endPoint(from);
        const f = $endPoint(to);
        const selection = $createRangeSelection();
        selection.anchor.set(a.key, a.offset, a.type);
        selection.focus.set(f.key, f.offset, f.type);
        $setSelection(selection);
      });
    });
    await settle();
  };

const $nth = (type: string, nth = 0) =>
  $allNodes().filter((node) => node.getType() === type)[nth] as
    | ElementNode
    | undefined;

/** The point directly after (or before) the `nth` node of `type`, on its parent. */
const beside = (type: string, side: "before" | "after", nth = 0): End => ({
  $point: () => {
    const node = $allNodes().filter((each) => each.getType() === type)[nth];
    return {
      key: node.getParentOrThrow().getKey(),
      offset: node.getIndexWithinParent() + (side === "after" ? 1 : 0),
    };
  },
});

const text = (word: string, offset: number): End => ({ word, offset });

/** The document as tokens: text, ▣ an image, ― a rule, ↵ a line break. */
const docTokens = () =>
  editorOf()!
    .getEditorState()
    .read(() => {
      let out = "";
      for (const node of $allNodes()) {
        if ($isTextNode(node)) {
          out += node.getTextContent();
        } else if (node.getType() === "cms-image") {
          out += "▣";
        } else if (node.getType() === "horizontalrule") {
          out += "―";
        } else if (node.getType() === "linebreak") {
          out += "↵";
        }
      }
      return out;
    });

const heldNow = () =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection), "a range").toBe(true);
      return $rangeOracle(selection as RangeSelection);
    });

/** What a removal took: the part of the tokens before that the tokens after lack. */
const removedBetween = (before: string, after: string, inserted = "") => {
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  ) {
    start += 1;
  }
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end += 1;
  }
  expect(after.slice(start, after.length - end), "what the action put in").toBe(
    inserted
  );
  return before.slice(start, before.length - end);
};

const heldTokens = (held: Held) => ({
  text: held.text,
  images: held.images,
  rules: held.rules,
  breaks: held.breaks,
});
const tokensHeld = (tokens: string) => ({
  text: tokens.replace(/[▣―↵]/g, ""),
  images: [...tokens].filter((each) => each === "▣").length,
  rules: [...tokens].filter((each) => each === "―").length,
  breaks: [...tokens].filter((each) => each === "↵").length,
});

/** Mounts, places, and checks that `action` takes exactly what the range holds. */
const expectRemovalTakesRange = async (
  stored: string,
  place: Step,
  action: Step,
  inserted = ""
) => {
  await mount(stored);
  await place();
  const held = heldNow();
  const before = docTokens();
  await action();
  const took = removedBetween(before, docTokens(), inserted);
  expect(tokensHeld(took), "what the removal took").toEqual(heldTokens(held));
};

describe("Step 1b: a removal takes what its range holds", () => {
  const lined = LI(`${BQ("Q0w")}T1w${IMG}${BQ("Q2w")}`);
  const afterImage: End = {
    $point: () => {
      const item = $allNodes().filter(
        (node) => node.getType() === "listitem"
      )[1] as ElementNode;
      return $wherePoint(item, { before: 1 });
    },
  };
  const place = between(afterImage, text("Q2w", 1));
  const kept = `${BQ("Q0w")}T1w<img />`;
  const cases: Array<[string, Step, string]> = [
    ["Backspace", backspace, W(`<li>${kept}2w</li>`)],
    ["Delete", del, W(`<li>${kept}2w</li>`)],
    ["cut", cut, W(`<li>${kept}2w</li>`)],
    ["Enter", enter, W(`<li>${kept}</li><li>2w</li>`)],
    ["Image", imageButton, W(`<li>${kept}<img />2w</li>`)],
  ];
  for (const [name, action, write] of cases) {
    test(`A removal that takes an image outside its range (check 3): ${name}`, async () => {
      await expectEdit({
        stored: lined,
        place,
        action,
        write,
        source: "check 3",
      });
    });
  }
  test("A removal that takes an image outside its range (check 3): ordinary content", async () => {
    await expectEdit({
      stored: `<p>T1w${IMG}</p>${BQ("Q2w")}`,
      place: between(
        { $point: () => ({ key: $nth("paragraph")!.getKey(), offset: 2 }) },
        text("Q2w", 1)
      ),
      action: backspace,
      write: "<p>T1w<img />2w</p>",
      source: "check 3; D1's fourth exception",
    });
  });

  const shiftHome = keys("{Shift>}{Home}{/Shift}");
  const leading: Array<[string, string]> = [
    ["a paragraph", `<p>${IMG}B1w</p>`],
    ["an item", `<ul><li>${IMG}B1w</li></ul>`],
    ["a line after a quote", LI(`${BQ("Q0w")}${IMG}B1w`)],
  ];
  const keysAfter: Array<[string, Step]> = [
    ["Backspace", backspace],
    ["Delete", del],
    ["Ctrl+Backspace", wordBack],
    ["Enter", enter],
    ["a paste of Aq", pasteText("Aq")],
  ];
  for (const [where, stored] of leading) {
    for (const [name, action] of keysAfter) {
      test(`Shift+Home before a leading image removes the text before the caret: ${where}, ${name}`, async () => {
        // the oracle: the same key over the same range with a text start
        const oracle = await recordEdit({
          stored,
          place: range("B1w", 0, "B1w", 1),
          action,
        });
        expect(oracle.write, "the oracle keeps the image").toContain("<img />");
        await expectEdit({
          stored,
          place: then(at("B1w", 1), shiftHome),
          action,
          write: oracle.write,
          source: "5.4; Review Focus 1",
        });
      });
    }
  }
  test("Shift+Home before a leading image: the paragraph's Backspace", async () => {
    await expectEdit({
      stored: `<p>${IMG}B1w</p>`,
      place: then(at("B1w", 1), shiftHome),
      action: backspace,
      write: "<p><img />1w</p>",
      source: "5.4",
    });
  });

  test("an end after a rule that is last: the removal takes the range (the step moves nothing)", async () => {
    await expectRemovalTakesRange(
      "<p>A0w</p><hr>",
      between(text("A0w", 1), beside("horizontalrule", "after")),
      backspace
    );
  });
  test("an end between two rules: the removal takes the range (the step moves nothing)", async () => {
    await expectRemovalTakesRange(
      "<p>A0w</p><hr><hr><p>B2w</p>",
      between(text("A0w", 1), beside("horizontalrule", "after")),
      backspace
    );
  });
  test("an end between two rules, to the text after: the removal takes the range", async () => {
    await expectRemovalTakesRange(
      "<p>A0w</p><hr><hr><p>B2w</p>",
      between(beside("horizontalrule", "after"), text("B2w", 1)),
      backspace
    );
  });

  // 15.10's range one press past the quote's end holds nothing
  const pastQuote = then(at("Pw"), keys("{Shift>}{ArrowRight}{/Shift}"));
  const quoteRule = `${BQ("Pw")}<hr><p>Nw</p>`;
  const nothing: Array<[string, Step]> = [
    ["Backspace", backspace],
    ["Delete", del],
    ["Ctrl+Backspace", wordBack],
    ["Ctrl+Delete", wordForward],
    ["cut", cut],
  ];
  for (const [name, action] of nothing) {
    test(`a delete that changes nothing fires no onChange and makes no undo step, and leaves nothing in the state: ${name}`, async () => {
      const onChange = await mount(quoteRule);
      await pastQuote();
      const before = editorOf()!.getEditorState().toJSON();
      const steps = undoDepth();
      const calls = onChange.mock.calls.length;
      await action();
      expect(onChange.mock.calls.length, "no onChange").toBe(calls);
      expect(undoDepth(), "no undo step").toEqual(steps);
      expect(
        sameState(before, editorOf()!.getEditorState().toJSON()),
        "the state as it was (D7)"
      ).toBe(true);
    });
  }

  test("Image over that range marks no removal and writes what Image writes at the quote's end (15.10; Step 2)", async () => {
    const marks: boolean[] = [];
    const imageWatched: Step = async () => {
      const editor = editorOf()!;
      const off = editor.registerNodeTransform(CmsImageNode, () => {
        marks.push($hasMark(REMOVAL_TAG));
      });
      try {
        await imageButton();
      } finally {
        off();
      }
    };
    const record = await recordEdit({
      stored: quoteRule,
      place: pastQuote,
      action: imageWatched,
    });
    expect(record.caretBefore, "the press passed the quote's end").toBe(
      "text:Pw@2|element:root@1"
    );
    expect(marks.length, "the image was inserted").toBeGreaterThan(0);
    expect(marks, "no removal mark").not.toContain(true);
    // the oracle: the same input one press earlier
    const earlier = await recordEdit({
      stored: quoteRule,
      place: at("Pw"),
      action: imageButton,
    });
    expect(record.write).toBe(earlier.write);
    expect(record.calls).toBe(earlier.calls);
    expect(record.errors).toEqual([]);
  });
});

describe("15.10's mirror: Shift+Enter and Image over a range from the root before a rule are Backspace over the range, then the key", () => {
  // the review's shape (quote, text, quote): a real click at Nw@0, two
  // presses of Shift+ArrowLeft; the grid `rich-text-line-grid-1510-mirror`
  // runs the two keys over every range the walk leaves
  const stored = `${BQ("Pw")}<hr>${BQ("Nw")}`;
  const place = then(
    at("Nw", 0),
    keys("{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}")
  );
  for (const [name, action] of [
    ["Shift+Enter", shiftEnter],
    ["Image", imageButton],
  ] as const) {
    test(name, async () => {
      const record = await recordEdit({ stored, place, action });
      expect(record.caretBefore, "a range onto the root").toBe(
        "text:Nw@0|element:root@1"
      );
      const oracle = await recordEdit({
        stored,
        place: then(place, backspace),
        action,
      });
      expect(record.write).not.toBeNull();
      expect(record.write).toBe(oracle.write);
      expect(record.errors).toEqual([]);
    });
  }
});

describe("round 13, group E: D3's break, decided before the edit", () => {
  const BQT = LI(`<br>${BQ("Q1w")}T2w`);
  test("E2: a letter over a range from the item before into the quote", async () => {
    await expectEdit({
      stored: BQT,
      place: range("Pw", 1, "Q1w", 2),
      action: letter,
      write: WJ("<li>Pkw</li><li>T2w</li>"),
      source: "check 2, E2",
    });
  });
  test("E2: Backspace over that range", async () => {
    await expectEdit({
      stored: BQT,
      place: range("Pw", 1, "Q1w", 2),
      action: backspace,
      write: WJ("<li>Pw</li><li>T2w</li>"),
      source: "check 2, E2",
    });
  });
  test("E3: Backspace at a code block's start between two lines", async () => {
    await expectEdit({
      stored: LI(`T0w${PRE("C1w")}T2w`),
      place: at("C1w", 0),
      action: backspace,
      write: W("<li>T0wC1w<br />T2w</li>"),
      source: "check 2, E3",
    });
  });
  test("E3: Delete at the end of the line before a code block", async () => {
    await expectEdit({
      stored: LI(`T0w${PRE("C1w")}T2w`),
      place: at("T0w"),
      action: del,
      write: W("<li>T0wC1w<br />T2w</li>"),
      source: "check 2, E3",
    });
  });
});

// Controls (Step 2b, 16.14, T11.10): with the marks cleared at the commit of
// their update in place of the end of the task, these still pass, as Lexical
// batches the updates of one task into one commit.
describe("T10.5: the marks", () => {
  test("control: two updates in one task share the marks: a removal, then a selection-only update", async () => {
    const stored = `${LI(`T0w${BQ("Q1w")}T2w`)}${BQ("Zw")}`;
    const onChange = await mount(stored);
    await at("Nw")();
    const before = editorOf()!.getEditorState().toJSON();
    const calls = onChange.mock.calls.length;
    const editor = editorOf()!;
    await act(async () => {
      editor.update(() => {
        const from = $endPoint(text("T0w", 1));
        const to = $endPoint(text("T2w", 1));
        const selection = $createRangeSelection();
        selection.anchor.set(from.key, from.offset, "text");
        selection.focus.set(to.key, to.offset, "text");
        $setSelection(selection);
        editor.dispatchCommand(DELETE_CHARACTER_COMMAND, true);
      });
      // the same task: the selection only, back to Nw's end
      editor.update(() => {
        const end = $endPoint(text("Nw", 2));
        const selection = $createRangeSelection();
        selection.anchor.set(end.key, end.offset, "text");
        selection.focus.set(end.key, end.offset, "text");
        $setSelection(selection);
      });
    });
    await settle();
    expect(onChange.mock.calls.length - calls, "one onChange").toBe(1);
    expect(short(lastHtml(onChange))).toBe(`${W("<li>T2w</li>")}${BQ("Zw")}`);
    // in the next task no mark is set: emptying the quote by code, with no
    // removal, leaves it (the emptied rule is a removal's)
    await act(async () => {
      editor.update(() => {
        $nth("quote")!.getFirstChildOrThrow().remove();
      });
    });
    await settle();
    expect(
      editor.getEditorState().read(() => $nth("quote") !== undefined),
      "the quote no removal emptied stays"
    ).toBe(true);
    // undo goes back over both, to the state before the removal
    await keys("{Control>}z{/Control}")();
    await keys("{Control>}z{/Control}")();
    expect(sameState(before, editor.getEditorState().toJSON())).toBe(true);
  });

  describe("control: marks end with the task that ran their update", () => {
    // two updates run in one task share their marks, as Lexical batches them
    // into one commit: a removal that removes nothing, then a letter, in one
    // task, write what the two write in two tasks
    const html = `<ul><li>Pw</li><li><h3>X0w${IMG}</h3></li></ul>`;
    const run = async (oneTask: boolean) => {
      const onChange = await mount(html);
      await userEvent.click(editable()!.querySelector("img")!);
      await settle();
      await keys("{Escape}")();
      const editor = editorOf()!;
      const removal = () =>
        editor.dispatchCommand(DELETE_CHARACTER_COMMAND, false);
      const typed = () =>
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertText("k");
          }
        });
      if (oneTask) {
        await act(async () => {
          removal();
          typed();
        });
      } else {
        await act(async () => {
          removal();
        });
        await settle();
        await act(async () => {
          typed();
        });
      }
      await settle();
      return short(lastHtml(onChange));
    };
    test("a no-op removal and a letter in two tasks", async () => {
      expect(await run(false)).toBe(
        "<ul><li>Pw</li><li><h3>X0w<img />k</h3></li></ul>"
      );
    });
    test("a no-op removal and a letter in one task", async () => {
      expect(await run(true)).toBe(
        "<ul><li>Pw</li><li><h3>X0w<img />k</h3></li></ul>"
      );
    });
  });
});

describe("15.11's mirror: an element-point end directly before a block (no real input reaches the point after a root-level rule: the ranges are placed by structure)", () => {
  const fixture = fixture1511Json as Record<
    string,
    { write: string | null; calls: number; errors?: string[] }
  >;
  const BACKSPACE: Record<string, string> = {
    "after the rule to B2w@1": "<p>A0w</p><hr /><p>2w</p>",
    "A0w@1 to after the rule": "<p>AB2w</p>",
    "before the rule to after it": "<p>A0w</p><p>B2w</p>",
  };
  for (const cell of cells1511()) {
    test(`${cell.id}`, async () => {
      const record = await runCell1511(cell);
      expect(record.errors, "console errors").toEqual([]);
      expect(record.ms, "the step in ms").toBeLessThan(2000);
      expect(record.calls).toBe(1);
      const backspaceWrite = BACKSPACE[cell.range.name];
      if (cell.action === "k") {
        // the oracle: Backspace over the range, then the letter
        const oracle = await runCell1511(
          cell,
          then(ACTIONS_1511.bs, ACTIONS_1511.k)
        );
        expect(record.write, "Backspace, then the letter").toBe(oracle.write);
      } else {
        expect(record.write, "the write").toBe(backspaceWrite);
      }
      // where the head differs, it loses the paragraph after the rule or
      // takes the wrong side of it
      const head = fixture[cell.id];
      expect(head, "the fixture cell").toBeDefined();
      if (head.write !== record.write) {
        const lost =
          (head.write ?? "").includes("B2w") === false ||
          (head.write ?? "").split("<p>").length <
            (record.write ?? "").split("<p>").length;
        expect(lost, `the head's ${head.write}`).toBe(true);
      }
    });
  }
});
