// D4, D14, V2, V3, V4, V14, CS1 to CS5, FS2, FS5, C0, C8, C10, C18: paste
// routing into lines, and D14's three cases over a range (T9.2 F).
import { describe, expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import { DELETE_CHARACTER_COMMAND } from "lexical";
import {
  at,
  cut,
  drop,
  expectEdit,
  itemPoint,
  LI,
  pasteHtml,
  pasteText,
  range,
  rangeToLineStart,
  recordEdit,
  type Step,
  then,
} from "./rich-text-line-test-kit";
import { rangeIntoLinedCells } from "./rich-text-line-cells-paste";
import rangeIntoLinedJson from "./__fixtures__/rich-text-line-base-range-into-lined.json";
import { editorOf, settle } from "./rich-text-test-harness";

type Row = {
  name: string;
  stored: string;
  place: Step;
  action: Step;
  write: string;
  caret?: string;
  source: string;
};

// The field's removal of the range: DELETE_CHARACTER_COMMAND, no key press
// (T36.1). Where a paste over a range is ruled as the removal, then the
// paste at the caret it leaves (D14's first case), the oracle is this,
// then the paste.
const fieldRemoval: Step = async () => {
  await act(async () => {
    editorOf()!.dispatchCommand(DELETE_CHARACTER_COMMAND, true);
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

/** The edit equals the field's removal, then the same action (D14, T36.1). */
const expectRemovalThen = async (
  edit: { stored: string; place: Step; action: Step },
  source: string
) => {
  const oracle = await recordEdit(
    { ...edit, action: then(fieldRemoval, edit.action) },
    { short: true }
  );
  expect(oracle.write, "the oracle writes").not.toBeNull();
  await expectEdit({ ...edit, write: oracle.write, source });
  const typed = await recordEdit(edit, { short: true });
  expect(typed.typed, "a letter after it lands as after the oracle").toBe(
    oracle.typed
  );
};

const Q = (text: string) => `<blockquote><p>${text}</p></blockquote>`;
const TQ = LI(`T0w${Q("Q1w")}`);
const RT = LI("<hr>T1w");
const XQY = `<ul><li>xq${Q("qq")}yq</li><li>nq</li></ul>`;
const QL = "<blockquote>xq<ul><li>l1q</li></ul>yq</blockquote>";
const S2 = `<ul><li>xq${Q("qq")}yyq</li><li>nq</li></ul><p>sepq</p>`;
const S2ol = `<ol><li>xq${Q("qq")}yyq</li><li>nq</li></ol><p>sepq</p>`;
const CS3 = "<ul><li>a1q<ul><li>xqyq</li></ul></li></ul>";
const twoParagraphs = pasteHtml("<p>Aq</p><p>Bq</p>", "Aq\nBq");
const aList = pasteHtml("<ul><li>Aq</li><li>Bq</li></ul>", "Aq\nBq");
const aParagraph = pasteHtml("<p>Aq</p>");
const aCodeBlock = pasteHtml("<pre><code>Aq</code></pre>");

describe("D4 and D14: a paste at a caret in a line", () => {
  runRows([
    {
      name: "D14 and C7: two paragraphs at a caret in a line give the head's write",
      stored: TQ,
      place: at("T0w"),
      action: twoParagraphs,
      write: `<ul><li>Pw</li><li>T0wAq</li></ul><p>Bq</p>${Q("Q1w")}<ul><li>Nw</li></ul>`,
      source: "from M31-TQ@1-paste HTML; D4, D14",
    },
    {
      name: "C10: two plain-text lines at the same caret: the second line on its own line before the quote",
      stored: TQ,
      place: at("T0w"),
      action: pasteText("L1\nL2"),
      write: `<ul><li>Pw</li><li>T0wL1</li><li>L2${Q("Q1w")}</li><li>Nw</li></ul>`,
      caret: "text:L2@2",
      source:
        "from P3 (ruled third: D14, map 2 C10); ruled, not built at the carry",
    },
    {
      name: "one pasted paragraph in a line goes in as its inline content",
      stored: TQ,
      place: at("T0w", 2),
      action: aParagraph,
      write: LI(`T0Aqw${Q("Q1w")}`),
      source: "from M4a; spec 5.8",
    },
    {
      name: "one pasted paragraph in a line after a leading rule",
      stored: RT,
      place: at("T1w", 2),
      action: aParagraph,
      write: LI("<hr />T1Aqw"),
      source: "from M4b; spec 5.8",
    },
    {
      name: "one pasted code block in a line goes in as inline code",
      stored: TQ,
      place: at("T0w", 2),
      action: aCodeBlock,
      write: LI(`T0<code>Aq</code>w${Q("Q1w")}`),
      source: "from M5a; spec 5.8",
    },
    {
      name: "one pasted code block in a line after a leading rule",
      stored: RT,
      place: at("T1w", 2),
      action: aCodeBlock,
      write: LI("<hr />T1<code>Aq</code>w"),
      source: "from M5b; spec 5.8",
    },
  ]);
});

describe("V2, V3: a paste over a range keeps the first check's writes", () => {
  runRows([
    {
      name: "V2: a list over a range that starts in a line",
      stored: `<ul><li>s1q${Q("b1q")}<ul><li>n1q</li></ul></li><li>t1q</li></ul>`,
      place: range("s1q", 2, "t1q", 1),
      action: pasteHtml("<ul><li>Aq</li><li><hr>T1q</li></ul>"),
      write: "<ul><li>s1</li><li>Aq</li><li><hr />T1q1q</li></ul>",
      source: "check V2",
    },
    {
      name: "V2: two paragraphs over a range into a line",
      stored: `<ul><li>xxq${Q("qq")}yyq</li><li>nq</li></ul>`,
      place: range("xxq", 1, "yyq", 1),
      action: twoParagraphs,
      write: "<ul><li>xAq</li></ul><p>Bqyq</p><ul><li>nq</li></ul>",
      source: "check V2",
    },
    {
      name: "V3: the last pasted item lands in another list type",
      stored: `<ul><li>p1q</li><li>s1q${Q("b1q")}<ul><li>n1q</li></ul></li><li>t1q</li></ul>`,
      place: range("p1q", 2, "s1q", 2),
      action: pasteHtml("<ol><li>Aq</li><li>T1q</li></ol>"),
      write: `<ul><li>p1</li></ul><ol><li>Aq</li><li>T1qq${Q("b1q")}</li></ol><ul><li><ul><li>n1q</li></ul></li><li>t1q</li></ul>`,
      source: "check V3",
    },
  ]);
});

describe("V4, V14: a paste at a line's start", () => {
  runRows([
    {
      name: "V4: a paragraph at a quote line's start",
      stored: QL,
      place: at("yq", 0),
      action: aParagraph,
      write: "<blockquote>xq<ul><li>l1q</li></ul>Aqyq</blockquote>",
      source: "from M26a; check V4",
    },
    {
      name: "V4: a heading at a quote line's start",
      stored: QL,
      place: at("yq", 0),
      action: pasteHtml("<h2>Aq</h2>"),
      write: "<blockquote>xq<ul><li>l1q</li></ul>Aqyq</blockquote>",
      source: "from M26b; check V4",
    },
    {
      name: "V4: a code block at a quote line's start",
      stored: QL,
      place: at("yq", 0),
      action: aCodeBlock,
      write:
        "<blockquote>xq<ul><li>l1q</li></ul><code>Aq</code>yq</blockquote>",
      source: "from M26c; check V4",
    },
    {
      name: "V14: an HTML paste before a leading line break",
      stored: LI(`<br>${Q("Q1w")}T2w`),
      place: itemPoint(1, 0),
      action: pasteHtml("<p>H1</p><p>H2</p>", "H1\nH2"),
      write: `<ul><li>Pw</li><li>H1</li></ul><p>H2<br /></p>${Q("Q1w")}<p>T2w</p><ul><li>Nw</li></ul>`,
      source: "from M29; check V14",
    },
  ]);
});

describe("CS1 to CS5, FS2: the clipboard shapes of spec 5.7", () => {
  runRows([
    {
      name: "CS1: a list at xq@1",
      stored: XQY,
      place: at("xq", 1),
      action: aList,
      write: `<ul><li>x</li><li>Aq</li><li>Bqq${Q("qq")}yq</li><li>nq</li></ul>`,
      source: "from M15a; spec 5.7",
    },
    {
      name: "CS1: a list at xq@end",
      stored: XQY,
      place: at("xq"),
      action: aList,
      write: `<ul><li>xq</li><li>Aq</li><li>Bq${Q("qq")}yq</li><li>nq</li></ul>`,
      source: "from M15b; spec 5.7",
    },
    {
      name: "CS1: a list at yq@end",
      stored: XQY,
      place: at("yq"),
      action: aList,
      write: `<ul><li>xq${Q("qq")}yq</li><li>Aq</li><li>Bq</li><li>nq</li></ul>`,
      source: "from M15c; spec 5.7",
    },
    {
      name: "CS1: a list in TR",
      stored: "<ul><li>xq<hr>yq</li></ul>",
      place: at("xq"),
      action: aList,
      write: "<ul><li>xq</li><li>Aq</li><li>Bq<hr />yq</li></ul>",
      source: "from M15d; spec 5.7",
    },
    {
      name: "CS2: one paragraph",
      stored: `<ul><li>xxq${Q("qq")}yyq</li><li>nq</li></ul><p>sepq</p>`,
      place: at("xxq", 1),
      action: aParagraph,
      write: `<ul><li>xAqxq${Q("qq")}yyq</li><li>nq</li></ul><p>sepq</p>`,
      source: "from M15e; spec 5.7",
    },
    {
      name: "CS2: one paragraph at yq@0",
      stored: XQY,
      place: at("yq", 0),
      action: aParagraph,
      write: `<ul><li>xq${Q("qq")}Aqyq</li><li>nq</li></ul>`,
      source: "from M15f; spec 5.7",
    },
    {
      name: "CS3: two paragraphs, nested",
      stored: CS3,
      place: at("xqyq", 2),
      action: twoParagraphs,
      write: "<ul><li>a1q<ul><li>xqAq</li></ul></li><li>Bqyq</li></ul>",
      source: "from M15g; spec 5.7",
    },
    {
      name: "CS3: two paragraphs at n1q@end",
      stored:
        "<ul><li>a1q<ul><li>n1q</li><li>n2q</li></ul></li><li>t1q</li></ul>",
      place: at("n1q"),
      action: twoParagraphs,
      write:
        "<ul><li>a1q<ul><li>n1qAq</li></ul></li><li>Bq<ul><li>n2q</li></ul></li><li>t1q</li></ul>",
      source: "from M15h; spec 5.7",
    },
    {
      name: "CS3: a list then a paragraph",
      stored: CS3,
      place: at("xqyq", 2),
      action: pasteHtml("<ul><li>Aq</li></ul><p>Bq</p>", "Aq\nBq"),
      write:
        "<ul><li>a1q<ul><li>xq</li><li>Aq</li></ul></li><li>Bqyq</li></ul>",
      source: "from M15i; spec 5.7",
    },
    {
      name: "FS2: two paragraphs at depth 2",
      stored: "<ul><li>Zw<ul><li>xqyq</li></ul></li></ul>",
      place: at("xqyq", 2),
      action: twoParagraphs,
      write: "<ul><li>Zw<ul><li>xqAq</li></ul></li><li>Bqyq</li></ul>",
      source: "from M15j; spec 5.7",
    },
    {
      name: "CS4: a code block at yq@0",
      stored: XQY,
      place: at("yq", 0),
      action: aCodeBlock,
      write: `<ul><li>xq${Q("qq")}<code>Aq</code>yq</li><li>nq</li></ul>`,
      source: "from M15k; spec 5.7",
    },
    {
      name: "CS5: a paste over a range from a heading into the line after",
      stored: "<ul><li>xq<h3>hq</h3>yyq</li><li>nq</li></ul><p>sepq</p>",
      place: range("hq", 0, "yyq", 1),
      action: aParagraph,
      write: "<ul><li>xq<br />Aq<h3>yq</h3></li><li>nq</li></ul><p>sepq</p>",
      source: "spec 5.7 (written <li>xq<br />Aq<h3>yq</h3></li>)",
    },
  ]);
});

describe("FS5: a block pasted at a quote line's end (accepted until R3)", () => {
  runRows([
    {
      name: "FS5: a quote",
      stored: QL,
      place: at("xq"),
      action: pasteHtml("<blockquote><p>Aq</p></blockquote>"),
      write: `<blockquote>xq</blockquote>${Q("Aq")}<ul><li>l1q</li></ul><p>yq</p>`,
      caret: "text:Aq@2",
      source: "from P4a; spec 5.7 (accepted until R3)",
    },
    {
      name: "FS5: a rule",
      stored: QL,
      place: at("xq"),
      action: pasteHtml("<hr>", ""),
      write: "<blockquote>xq</blockquote><hr /><ul><li>l1q</li></ul><p>yq</p>",
      caret: "element:root@2",
      source: "from P4b; spec 5.7 (accepted until R3)",
    },
    {
      name: "FS5: a list",
      stored: QL,
      place: at("xq"),
      action: aList,
      write:
        "<blockquote>xq</blockquote><ul><li>Aq</li><li>Bq</li><li>l1q</li></ul><p>yq</p>",
      caret: "text:Bq@2",
      source: "from P4c; spec 5.7 (accepted until R3)",
    },
  ]);
});

describe("C0, C8, C18: the section 9 pastes", () => {
  runRows([
    {
      name: "C0: two paragraphs over a range from a quote into the text after it",
      stored: S2,
      place: range("qq", 0, "yyq", 1),
      action: twoParagraphs,
      write: `<ul><li>xq<blockquote><p>Aq</p><p>Bqyq</p></blockquote></li><li>nq</li></ul><p>sepq</p>`,
      caret: "text:Bqyq@2",
      source: "from P19; section 9",
    },
    {
      name: "C8: two paragraphs pasted into a heading in an item (the read-only half)",
      stored: "<ul><li>xq<h3>hq</h3>yq</li></ul>",
      place: at("hq", 1),
      action: twoParagraphs,
      write: "<ul><li>xq<h3>hAq</h3>Bqq<br />yq</li></ul>",
      caret: "text:Bqq@2",
      source: "from P15; section 9",
    },
    {
      name: "C18: a paste over a range from a block-led item's run into the next item",
      stored: `<ul><li>${Q("bq")}t1q</li><li>n1q</li></ul><p>sepq</p>`,
      place: range("t1q", 1, "n1q", 1),
      action: twoParagraphs,
      write: `<ul><li>${Q("bq")}tAq</li></ul><p>Bq1q</p><p>sepq</p>`,
      caret: "text:Bq1q@2",
      source: "from P16; section 9",
    },
  ]);
});

describe("F: a block paste or drop over a range in a lined item: the removal, then the paste", () => {
  type Case = {
    name: string;
    stored: string;
    place: Step;
    action: Step;
    /** check 2, group F's write; none named: the oracle's. */
    write?: string;
  };
  const CASES: Case[] = [
    {
      name: "a paragraph from the quote's start into the line after",
      stored: S2,
      place: range("qq", 0, "yyq", 1),
      action: aParagraph,
      write: `<ul><li>xq${Q("Aqyq")}</li><li>nq</li></ul><p>sepq</p>`,
    },
    {
      name: "a paragraph from the first line into the quote",
      stored: S2,
      place: range("xq", 1, "qq", 1),
      action: aParagraph,
      write: "<ul><li>xAqq<br />yyq</li><li>nq</li></ul><p>sepq</p>",
    },
    {
      name: "bold from the first line into the quote",
      stored: S2,
      place: range("xq", 1, "qq", 1),
      action: pasteHtml("<b>Aq</b>"),
      write:
        "<ul><li>x<b><strong>Aq</strong></b>q<br />yyq</li><li>nq</li></ul><p>sepq</p>",
    },
    {
      name: "two paragraphs from the first line into the quote",
      stored: S2,
      place: range("xq", 1, "qq", 1),
      action: pasteHtml("<p>Aq</p><p>Bq</p>", "x"),
      write:
        "<ul><li>xAq</li></ul><p>Bqq<br />yyq</p><ul><li>nq</li></ul><p>sepq</p>",
    },
    {
      name: "two paragraphs dropped from the first line into the quote",
      stored: S2,
      place: range("xq", 1, "qq", 1),
      action: drop("<p>Aq</p><p>Bq</p>"),
      write:
        "<ul><li>xAq</li></ul><p>Bqq<br />yyq</p><ul><li>nq</li></ul><p>sepq</p>",
    },
    {
      name: "a paragraph from inside the quote into the line after",
      stored: S2,
      place: range("qq", 1, "yyq", 1),
      action: aParagraph,
    },
    {
      name: "bold from the quote's start into the line after",
      stored: S2,
      place: range("qq", 0, "yyq", 1),
      action: pasteHtml("<b>Aq</b>"),
    },
    {
      name: "two paragraphs dropped from the quote's start",
      stored: S2,
      place: range("qq", 0, "yyq", 1),
      action: drop("<p>Aq</p><p>Bq</p>"),
    },
    {
      name: "two paragraphs into a numbered item's quote",
      stored: S2ol,
      place: range("qq", 1, "yyq", 1),
      action: twoParagraphs,
    },
  ];
  for (const { name, write, ...edit } of CASES) {
    if (write !== undefined) {
      test(`${name}: no hang`, async () => {
        await expectEdit({ ...edit, write, source: "check 2, group F" });
      });
    } else {
      test(`${name}: no hang, and equals the field's removal (DELETE_CHARACTER_COMMAND), then the paste`, async () => {
        await expectRemovalThen(edit, "check 2, group F; D14's first case");
      });
    }
  }
  test("a cut from inside a quote into the line after: no hang, and equals the field's removal (DELETE_CHARACTER_COMMAND)", async () => {
    const stored = `<ul><li>xq${Q("qq")}yq</li></ul>`;
    const place = range("qq", 1, "yq", 1);
    const oracle = await recordEdit(
      { stored, place, action: fieldRemoval },
      { short: true }
    );
    await expectEdit({
      stored,
      place,
      action: cut,
      write: oracle.write,
      source: "check 2, group F (C4); 5.4",
    });
  });
});

describe("D14's third case: a block paste over a range from outside into a text-led lined item takes the head's path, the lines unwrapped", () => {
  const base = rangeIntoLinedJson as Record<
    string,
    { write: string; calls: number; caret: string; typed: string }
  >;
  // the second cell ("Pw@1 to Q1w@1") waits for its ruling: <base> keeps
  // the emptied quote, the field drops it (P17-1)
  const [cell] = rangeIntoLinedCells();
  test(`${cell.id}: equals the fixture cell`, async () => {
    const fixture = base[cell.id];
    expect(fixture, "the fixture cell").toBeDefined();
    await expectEdit({
      stored: cell.stored,
      place: cell.place,
      action: cell.action,
      write: fixture.write,
      calls: fixture.calls,
      caret: fixture.caret,
      typed: fixture.typed,
      source: "B:base-range-into-lined; D14's third case",
    });
  });
});

describe("T23.1 by a paste: a range ending at a break-led line's start after a block (T30.2, T30.3)", () => {
  const CELLS: Array<[string, string, string, Step]> = [
    // [name, stored, word the range starts in at offset 2, paste]
    [
      "a heading, then a break-only line, one paragraph",
      LI("<h3>H0w</h3><br>"),
      "H0w",
      aParagraph,
    ],
    [
      "a heading, then a break-only line, two paragraphs",
      LI("<h3>H0w</h3><br>"),
      "H0w",
      twoParagraphs,
    ],
    [
      "a code block, then a break-only line, one paragraph",
      LI("<pre><code>C0w</code></pre><br>"),
      "C0w",
      aParagraph,
    ],
    [
      "a code block, then a break-only line, two paragraphs",
      LI("<pre><code>C0w</code></pre><br>"),
      "C0w",
      twoParagraphs,
    ],
    [
      "a heading, then a break-led line, two paragraphs",
      LI("<h3>H0w</h3><br>Tw"),
      "H0w",
      twoParagraphs,
    ],
    [
      "a heading in a quote, then a break-led line, one paragraph",
      "<blockquote><h3>H0w</h3><br>Tw</blockquote>",
      "H0w",
      aParagraph,
    ],
    [
      "a heading, then a break-only line, two plain-text lines",
      LI("<h3>H0w</h3><br>"),
      "H0w",
      pasteText("L1\nL2"),
    ],
  ];
  for (const [name, stored, word, action] of CELLS) {
    test(`${name}: equals the field's removal (DELETE_CHARACTER_COMMAND), then the paste`, async () => {
      await expectRemovalThen(
        { stored, place: rangeToLineStart(word, 2), action },
        "T23.1, T30.3 (every entry point, a paste included); D14's first case"
      );
    });
  }
});
