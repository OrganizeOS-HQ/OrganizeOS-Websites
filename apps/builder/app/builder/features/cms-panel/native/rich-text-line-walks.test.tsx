// V10's walks and 5.8's Shift walks at lined points, an arrow off a
// selected rule (5.3, 5.8, FS9), the group B step and the Shift step past a
// rule (T9.2 B, T10.7, T11.11), and the direction the arrow rules take
// (14.7).
import { describe, expect, test, vi } from "vitest";
import {
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  type PointType,
} from "lexical";
import {
  at,
  caretKey,
  clipboard,
  copy,
  expectEdit,
  keys,
  letter,
  LI,
  mount,
  nodeAfter,
  recordEdit,
  short,
  type Step,
  then,
} from "./rich-text-line-test-kit";
import { editorOf, lastHtml, settle } from "./rich-text-test-harness";
import { walkOf, walksRuleCells } from "./rich-text-line-cells-walks-rule";
import {
  MOST_PRESSES,
  pageEdge,
  shiftPastRuleWalks,
  type ShiftWalk,
} from "./rich-text-line-cells-shift-past-rule";
import walksRuleFixture from "./__fixtures__/rich-text-line-base-walks-rule.json";
import shiftPastRuleFixture from "./__fixtures__/rich-text-line-base-shift-past-rule.json";

type WalkRecord = {
  write: string | null;
  calls: number;
  caret: string;
  typed: string;
};
import { isLinedContainer } from "./rich-text-line-node";

const BQ = (text: string) => `<blockquote><p>${text}</p></blockquote>`;
const PRE = (text: string) => `<pre><code>${text}</code></pre>`;

/** The walks of M28 and M28s: stored value, the key, the start caret. */
const WALKS: Record<string, readonly [string, "Left" | "Right", Step]> = {
  BQ: [LI("<br>" + BQ("Q1w")), "Left", at("Nw", 0)],
  CB: [LI(PRE("C0w") + "<br>"), "Right", at("C0w", 2)],
  HB: [LI("<h3>H0w</h3><br>"), "Right", at("H0w", 2)],
  TCB: [LI("T0w" + PRE("C1w") + "<br>"), "Right", at("C1w", 2)],
  THB: [LI("T0w<h3>H1w</h3><br>"), "Right", at("H1w", 2)],
  BC: [LI("<br>" + PRE("C1w")), "Left", at("C1w", 1)],
  BH: [LI("<br><h3>H1w</h3>"), "Left", at("H1w", 1)],
  BBQ: [LI("<br><br>" + BQ("Q2w")), "Left", at("Q2w", 1)],
  BQL: [LI("<br>" + BQ("Q1w") + "<ul><li>L2w</li></ul>"), "Left", at("Q1w", 1)],
  BQQ: [LI("<br>" + BQ("Q1w") + BQ("Q2w")), "Left", at("Q1w", 1)],
  BQR: [LI("<br>" + BQ("Q1w") + "<hr>"), "Left", at("Q1w", 1)],
  BQT: [LI("<br>" + BQ("Q1w") + "T2w"), "Left", at("Q1w", 1)],
  RBQ: [LI("<hr><br>" + BQ("Q2w")), "Left", at("Q2w", 1)],
  TBC: [LI("T0w<br>" + PRE("C2w")), "Left", at("C2w", 1)],
  TBH: [LI("T0w<br><h3>H2w</h3>"), "Left", at("H2w", 1)],
  TBQ: [LI("T0w<br>" + BQ("Q2w")), "Left", at("Q2w", 1)],
  QBR: [LI(BQ("Q0w") + "<br><hr>"), "Left", at("Nw", 0)],
};

const presses = (count: number, key: string): Step =>
  then(...Array.from({ length: count }, () => keys(key)));

/** Console errors from here to the end of the test. */
const consoleErrors = () => {
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const text = args.map(String).join(" ");
    if (text.includes("not wrapped in act") === false) {
      errors.push(text.slice(0, 300));
    }
  });
  return errors;
};

/** The focus of the committed selection, as caretKey writes a point. */
const focusKey = () => {
  const key = caretKey();
  return key.includes("|") ? key.split("|")[1] : key;
};

// M28, each row's write (its ruling where it has one): [id, write, caret]
const V10_WRITES: ReadonlyArray<readonly [string, string, string?]> = [
  [
    "M28-BQ-1",
    "<ul><li>Pw</li><li><br /><blockquote><p>Q1wk</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQ-2",
    "<ul><li>Pw</li><li><br /><blockquote><p>Q1kw</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQ-3",
    "<ul><li>Pw</li><li><br /><blockquote><p>Qk1w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQ-4",
    "<ul><li>Pw</li><li><br /><blockquote><p>kQ1w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQ-5",
    "<ul><li>Pw</li><li>k<br /><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-CB-1",
    "<ul><li>Pw</li><li><pre><code>C0wk</code></pre><br /></li><li>Nw</li></ul>",
  ],
  [
    "M28-CB-2",
    "<ul><li>Pw</li><li><pre><code>C0w</code></pre><br />k</li><li>Nw</li></ul>",
  ],
  [
    "M28-CB-3",
    "<ul><li>Pw</li><li><pre><code>C0w</code></pre><br /></li><li>kNw</li></ul>",
  ],
  [
    "M28-CB-4",
    "<ul><li>Pw</li><li><pre><code>C0w</code></pre><br /></li><li>Nkw</li></ul>",
  ],
  [
    "M28-CB-5",
    "<ul><li>Pw</li><li><pre><code>C0w</code></pre><br /></li><li>Nwk</li></ul>",
  ],
  ["M28-HB-1", "<ul><li>Pw</li><li><h3>H0wk</h3><br /></li><li>Nw</li></ul>"],
  ["M28-HB-2", "<ul><li>Pw</li><li><h3>H0w</h3><br />k</li><li>Nw</li></ul>"],
  ["M28-HB-3", "<ul><li>Pw</li><li><h3>H0w</h3><br /></li><li>kNw</li></ul>"],
  ["M28-HB-4", "<ul><li>Pw</li><li><h3>H0w</h3><br /></li><li>Nkw</li></ul>"],
  ["M28-HB-5", "<ul><li>Pw</li><li><h3>H0w</h3><br /></li><li>Nwk</li></ul>"],
  [
    "M28-TCB-1",
    "<ul><li>Pw</li><li>T0w<pre><code>C1wk</code></pre><br /></li><li>Nw</li></ul>",
  ],
  [
    "M28-TCB-2",
    "<ul><li>Pw</li><li>T0w<pre><code>C1w</code></pre><br />k</li><li>Nw</li></ul>",
  ],
  [
    "M28-TCB-3",
    "<ul><li>Pw</li><li>T0w<pre><code>C1w</code></pre><br /></li><li>kNw</li></ul>",
  ],
  [
    "M28-TCB-4",
    "<ul><li>Pw</li><li>T0w<pre><code>C1w</code></pre><br /></li><li>Nkw</li></ul>",
  ],
  [
    "M28-TCB-5",
    "<ul><li>Pw</li><li>T0w<pre><code>C1w</code></pre><br /></li><li>Nwk</li></ul>",
  ],
  [
    "M28-THB-1",
    "<ul><li>Pw</li><li>T0w<h3>H1wk</h3><br /></li><li>Nw</li></ul>",
  ],
  [
    "M28-THB-2",
    "<ul><li>Pw</li><li>T0w<h3>H1w</h3><br />k</li><li>Nw</li></ul>",
  ],
  [
    "M28-THB-3",
    "<ul><li>Pw</li><li>T0w<h3>H1w</h3><br /></li><li>kNw</li></ul>",
  ],
  [
    "M28-THB-4",
    "<ul><li>Pw</li><li>T0w<h3>H1w</h3><br /></li><li>Nkw</li></ul>",
  ],
  [
    "M28-THB-5",
    "<ul><li>Pw</li><li>T0w<h3>H1w</h3><br /></li><li>Nwk</li></ul>",
  ],
  [
    "M28-BC-1",
    "<ul><li>Pw</li><li><br /><pre><code>kC1w</code></pre></li><li>Nw</li></ul>",
  ],
  [
    "M28-BC-2",
    "<ul><li>Pw</li><li>k<br /><pre><code>C1w</code></pre></li><li>Nw</li></ul>",
  ],
  [
    "M28-BC-3",
    "<ul><li>Pwk</li><li><br /><pre><code>C1w</code></pre></li><li>Nw</li></ul>",
  ],
  [
    "M28-BC-4",
    "<ul><li>Pkw</li><li><br /><pre><code>C1w</code></pre></li><li>Nw</li></ul>",
  ],
  [
    "M28-BC-5",
    "<ul><li>kPw</li><li><br /><pre><code>C1w</code></pre></li><li>Nw</li></ul>",
  ],
  ["M28-BH-1", "<ul><li>Pw</li><li><br /><h3>kH1w</h3></li><li>Nw</li></ul>"],
  ["M28-BH-2", "<ul><li>Pw</li><li>k<br /><h3>H1w</h3></li><li>Nw</li></ul>"],
  ["M28-BH-3", "<ul><li>Pwk</li><li><br /><h3>H1w</h3></li><li>Nw</li></ul>"],
  ["M28-BH-4", "<ul><li>Pkw</li><li><br /><h3>H1w</h3></li><li>Nw</li></ul>"],
  ["M28-BH-5", "<ul><li>kPw</li><li><br /><h3>H1w</h3></li><li>Nw</li></ul>"],
  [
    "M28-BBQ-1",
    "<ul><li>Pw</li><li><br /><br /><blockquote><p>kQ2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-BBQ-2",
    "<ul><li>Pw</li><li><br />k<br /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-BBQ-3",
    "<ul><li>Pw</li><li>k<br /><br /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-BBQ-4",
    "<ul><li>Pwk</li><li><br /><br /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-BBQ-5",
    "<ul><li>Pkw</li><li><br /><br /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQL-1",
    "<ul><li>Pw</li><li><br /><blockquote><p>kQ1w</p></blockquote><ul><li>L2w</li></ul></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQL-2",
    "<ul><li>Pw</li><li>k<br /><blockquote><p>Q1w</p></blockquote><ul><li>L2w</li></ul></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQL-3",
    "<ul><li>Pwk</li><li><br /><blockquote><p>Q1w</p></blockquote><ul><li>L2w</li></ul></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQL-4",
    "<ul><li>Pkw</li><li><br /><blockquote><p>Q1w</p></blockquote><ul><li>L2w</li></ul></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQL-5",
    "<ul><li>kPw</li><li><br /><blockquote><p>Q1w</p></blockquote><ul><li>L2w</li></ul></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQQ-1",
    "<ul><li>Pw</li><li><br /><blockquote><p>kQ1w</p></blockquote><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQQ-2",
    "<ul><li>Pw</li><li>k<br /><blockquote><p>Q1w</p></blockquote><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQQ-3",
    "<ul><li>Pwk</li><li><br /><blockquote><p>Q1w</p></blockquote><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQQ-4",
    "<ul><li>Pkw</li><li><br /><blockquote><p>Q1w</p></blockquote><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQQ-5",
    "<ul><li>kPw</li><li><br /><blockquote><p>Q1w</p></blockquote><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQR-1",
    "<ul><li>Pw</li><li><br /><blockquote><p>kQ1w</p></blockquote><hr /></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQR-2",
    "<ul><li>Pw</li><li>k<br /><blockquote><p>Q1w</p></blockquote><hr /></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQR-3",
    "<ul><li>Pwk</li><li><br /><blockquote><p>Q1w</p></blockquote><hr /></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQR-4",
    "<ul><li>Pkw</li><li><br /><blockquote><p>Q1w</p></blockquote><hr /></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQR-5",
    "<ul><li>kPw</li><li><br /><blockquote><p>Q1w</p></blockquote><hr /></li><li>Nw</li></ul>",
  ],
  [
    "M28-BQT-1",
    "<ul><li>Pw</li><li><br /><blockquote><p>kQ1w</p></blockquote>T2w</li><li>Nw</li></ul>",
  ],
  [
    "M28-BQT-2",
    "<ul><li>Pw</li><li>k<br /><blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>",
  ],
  [
    "M28-BQT-3",
    "<ul><li>Pwk</li><li><br /><blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>",
  ],
  [
    "M28-BQT-4",
    "<ul><li>Pkw</li><li><br /><blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>",
  ],
  [
    "M28-BQT-5",
    "<ul><li>kPw</li><li><br /><blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>",
  ],
  [
    "M28-RBQ-1",
    "<ul><li>Pw</li><li><hr /><br /><blockquote><p>kQ2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-RBQ-2",
    "<ul><li>Pw</li><li><hr />k<br /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  // r1-task5-rulings.md M28-RBQ-3: carry
  [
    "M28-RBQ-3",
    "<ul><li>Pw</li><li><hr />k<br /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
    "text:k@1",
  ],
  [
    "M28-RBQ-4",
    "<ul><li>Pw</li><li>k<hr /><br /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-RBQ-5",
    "<ul><li>Pwk</li><li><hr /><br /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBC-1",
    "<ul><li>Pw</li><li>T0w<br /><pre><code>kC2w</code></pre></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBC-2",
    "<ul><li>Pw</li><li>T0wk<br /><pre><code>C2w</code></pre></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBC-3",
    "<ul><li>Pw</li><li>T0kw<br /><pre><code>C2w</code></pre></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBC-4",
    "<ul><li>Pw</li><li>Tk0w<br /><pre><code>C2w</code></pre></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBC-5",
    "<ul><li>Pw</li><li>kT0w<br /><pre><code>C2w</code></pre></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBH-1",
    "<ul><li>Pw</li><li>T0w<br /><h3>kH2w</h3></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBH-2",
    "<ul><li>Pw</li><li>T0wk<br /><h3>H2w</h3></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBH-3",
    "<ul><li>Pw</li><li>T0kw<br /><h3>H2w</h3></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBH-4",
    "<ul><li>Pw</li><li>Tk0w<br /><h3>H2w</h3></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBH-5",
    "<ul><li>Pw</li><li>kT0w<br /><h3>H2w</h3></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBQ-1",
    "<ul><li>Pw</li><li>T0w<br /><blockquote><p>kQ2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBQ-2",
    "<ul><li>Pw</li><li>T0wk<br /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBQ-3",
    "<ul><li>Pw</li><li>T0kw<br /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBQ-4",
    "<ul><li>Pw</li><li>Tk0w<br /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-TBQ-5",
    "<ul><li>Pw</li><li>kT0w<br /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  ],
  [
    "M28-QBR-1",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br /><hr />k</li><li>Nw</li></ul>",
  ],
  // r1-task5-rulings.md M28-QBR-2: carry
  [
    "M28-QBR-2",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br /><hr />k</li><li>Nw</li></ul>",
    "text:k@1",
  ],
  [
    "M28-QBR-3",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br />k<hr /></li><li>Nw</li></ul>",
  ],
  // r1-task5-rulings.md M28-QBR-4: carry
  [
    "M28-QBR-4",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /><hr /></li><li>Nw</li></ul>",
    "text:k@1",
  ],
  [
    "M28-QBR-5",
    "<ul><li>Pw</li><li><blockquote><p>Q0wk</p></blockquote><br /><hr /></li><li>Nw</li></ul>",
  ],
];

// M28s, each row's caret (its ruling where it has one): [id, caret]
const SHIFT_CARETS: ReadonlyArray<readonly [string, string]> = [
  ["M28s-BQ-Left-1", "text:Nw@0|text:Q1w@3"],
  ["M28s-BQ-Left-2", "text:Nw@0|text:Q1w@2"],
  ["M28s-BQ-Left-3", "text:Nw@0|text:Q1w@1"],
  ["M28s-BQ-Left-4", "text:Nw@0|text:Q1w@0"],
  ["M28s-BQ-Left-5", "text:Nw@0|element:listitem@0"],
  ["M28s-BQ-Right-1", "text:Nw@0|text:Nw@1"],
  ["M28s-BQ-Right-2", "text:Nw@0|text:Nw@2"],
  ["M28s-BQ-Right-3", "text:Nw@0|text:Nw@2"],
  ["M28s-BQ-Right-4", "text:Nw@0|text:Nw@2"],
  ["M28s-BQ-Right-5", "text:Nw@0|text:Nw@2"],
  ["M28s-CB-Left-1", "text:C0w@2|text:C0w@1"],
  ["M28s-CB-Left-2", "text:C0w@2|text:C0w@0"],
  ["M28s-CB-Left-3", "text:C0w@2|text:Pw@2"],
  ["M28s-CB-Left-4", "text:C0w@2|text:Pw@1"],
  ["M28s-CB-Left-5", "text:C0w@2|text:Pw@0"],
  ["M28s-CB-Right-1", "text:C0w@2|text:C0w@3"],
  ["M28s-CB-Right-2", "text:C0w@2|element:listitem@1"],
  ["M28s-CB-Right-3", "text:C0w@2|element:listitem@2"],
  ["M28s-CB-Right-4", "text:C0w@2|text:Nw@0"],
  ["M28s-CB-Right-5", "text:C0w@2|text:Nw@1"],
  ["M28s-HB-Left-1", "text:H0w@2|text:H0w@1"],
  ["M28s-HB-Left-2", "text:H0w@2|text:H0w@0"],
  ["M28s-HB-Left-3", "text:H0w@2|text:Pw@2"],
  ["M28s-HB-Left-4", "text:H0w@2|text:Pw@1"],
  ["M28s-HB-Left-5", "text:H0w@2|text:Pw@0"],
  ["M28s-HB-Right-1", "text:H0w@2|text:H0w@3"],
  ["M28s-HB-Right-2", "text:H0w@2|element:listitem@1"],
  ["M28s-HB-Right-3", "text:H0w@2|element:listitem@2"],
  ["M28s-HB-Right-4", "text:H0w@2|text:Nw@0"],
  ["M28s-HB-Right-5", "text:H0w@2|text:Nw@1"],
  ["M28s-TCB-Left-1", "text:C1w@2|text:C1w@1"],
  ["M28s-TCB-Left-2", "text:C1w@2|text:C1w@0"],
  ["M28s-TCB-Left-3", "text:C1w@2|text:T0w@3"],
  ["M28s-TCB-Left-4", "text:C1w@2|text:T0w@2"],
  ["M28s-TCB-Left-5", "text:C1w@2|text:T0w@1"],
  ["M28s-TCB-Right-1", "text:C1w@2|text:C1w@3"],
  ["M28s-TCB-Right-2", "text:C1w@2|element:listitem@2"],
  ["M28s-TCB-Right-3", "text:C1w@2|element:listitem@3"],
  ["M28s-TCB-Right-4", "text:C1w@2|text:Nw@0"],
  ["M28s-TCB-Right-5", "text:C1w@2|text:Nw@1"],
  ["M28s-THB-Left-1", "text:H1w@2|text:H1w@1"],
  ["M28s-THB-Left-2", "text:H1w@2|text:H1w@0"],
  ["M28s-THB-Left-3", "text:H1w@2|text:T0w@3"],
  ["M28s-THB-Left-4", "text:H1w@2|text:T0w@2"],
  ["M28s-THB-Left-5", "text:H1w@2|text:T0w@1"],
  ["M28s-THB-Right-1", "text:H1w@2|text:H1w@3"],
  ["M28s-THB-Right-2", "text:H1w@2|element:listitem@2"],
  ["M28s-THB-Right-3", "text:H1w@2|element:listitem@3"],
  ["M28s-THB-Right-4", "text:H1w@2|text:Nw@0"],
  ["M28s-THB-Right-5", "text:H1w@2|text:Nw@1"],
  ["M28s-BC-Left-1", "text:C1w@1|text:C1w@0"],
  ["M28s-BC-Left-2", "text:C1w@1|element:listitem@0"],
  ["M28s-BC-Left-3", "text:C1w@1|text:Pw@2"],
  ["M28s-BC-Left-4", "text:C1w@1|text:Pw@1"],
  ["M28s-BC-Left-5", "text:C1w@1|text:Pw@0"],
  ["M28s-BC-Right-1", "text:C1w@1|text:C1w@2"],
  ["M28s-BC-Right-2", "text:C1w@1|text:C1w@3"],
  ["M28s-BC-Right-3", "text:C1w@1|text:Nw@0"],
  ["M28s-BC-Right-4", "text:C1w@1|text:Nw@1"],
  ["M28s-BC-Right-5", "text:C1w@1|text:Nw@2"],
  ["M28s-BH-Left-1", "text:H1w@1|text:H1w@0"],
  ["M28s-BH-Left-2", "text:H1w@1|element:listitem@0"],
  ["M28s-BH-Left-3", "text:H1w@1|text:Pw@2"],
  ["M28s-BH-Left-4", "text:H1w@1|text:Pw@1"],
  ["M28s-BH-Left-5", "text:H1w@1|text:Pw@0"],
  ["M28s-BH-Right-1", "text:H1w@1|text:H1w@2"],
  ["M28s-BH-Right-2", "text:H1w@1|text:H1w@3"],
  ["M28s-BH-Right-3", "text:H1w@1|text:Nw@0"],
  ["M28s-BH-Right-4", "text:H1w@1|text:Nw@1"],
  ["M28s-BH-Right-5", "text:H1w@1|text:Nw@2"],
  ["M28s-BBQ-Left-1", "text:Q2w@1|text:Q2w@0"],
  ["M28s-BBQ-Left-2", "text:Q2w@1|element:listitem@1"],
  ["M28s-BBQ-Left-3", "text:Q2w@1|element:listitem@0"],
  ["M28s-BBQ-Left-4", "text:Q2w@1|text:Pw@2"],
  ["M28s-BBQ-Left-5", "text:Q2w@1|text:Pw@1"],
  ["M28s-BBQ-Right-1", "text:Q2w@1|text:Q2w@2"],
  ["M28s-BBQ-Right-2", "text:Q2w@1|text:Q2w@3"],
  ["M28s-BBQ-Right-3", "text:Q2w@1|text:Nw@0"],
  ["M28s-BBQ-Right-4", "text:Q2w@1|text:Nw@1"],
  ["M28s-BBQ-Right-5", "text:Q2w@1|text:Nw@2"],
  ["M28s-BQL-Left-1", "text:Q1w@1|text:Q1w@0"],
  ["M28s-BQL-Left-2", "text:Q1w@1|element:listitem@0"],
  ["M28s-BQL-Left-3", "text:Q1w@1|text:Pw@2"],
  ["M28s-BQL-Left-4", "text:Q1w@1|text:Pw@1"],
  ["M28s-BQL-Left-5", "text:Q1w@1|text:Pw@0"],
  ["M28s-BQL-Right-1", "text:Q1w@1|text:Q1w@2"],
  ["M28s-BQL-Right-2", "text:Q1w@1|text:Q1w@3"],
  ["M28s-BQL-Right-3", "text:Q1w@1|text:L2w@0"],
  ["M28s-BQL-Right-4", "text:Q1w@1|text:L2w@1"],
  ["M28s-BQL-Right-5", "text:Q1w@1|text:L2w@2"],
  ["M28s-BQQ-Left-1", "text:Q1w@1|text:Q1w@0"],
  ["M28s-BQQ-Left-2", "text:Q1w@1|element:listitem@0"],
  ["M28s-BQQ-Left-3", "text:Q1w@1|text:Pw@2"],
  ["M28s-BQQ-Left-4", "text:Q1w@1|text:Pw@1"],
  ["M28s-BQQ-Left-5", "text:Q1w@1|text:Pw@0"],
  ["M28s-BQQ-Right-1", "text:Q1w@1|text:Q1w@2"],
  ["M28s-BQQ-Right-2", "text:Q1w@1|text:Q1w@3"],
  ["M28s-BQQ-Right-3", "text:Q1w@1|text:Q2w@0"],
  ["M28s-BQQ-Right-4", "text:Q1w@1|text:Q2w@1"],
  ["M28s-BQQ-Right-5", "text:Q1w@1|text:Q2w@2"],
  ["M28s-BQR-Left-1", "text:Q1w@1|text:Q1w@0"],
  ["M28s-BQR-Left-2", "text:Q1w@1|element:listitem@0"],
  ["M28s-BQR-Left-3", "text:Q1w@1|text:Pw@2"],
  ["M28s-BQR-Left-4", "text:Q1w@1|text:Pw@1"],
  ["M28s-BQR-Left-5", "text:Q1w@1|text:Pw@0"],
  ["M28s-BQR-Right-1", "text:Q1w@1|text:Q1w@2"],
  ["M28s-BQR-Right-2", "text:Q1w@1|text:Q1w@3"],
  // r1-task5-rulings.md M28s-BQR-Right-3: carry (spec 5.3, the Shift bullet)
  ["M28s-BQR-Right-3", "text:Q1w@1|element:listitem@3"],
  // r1-task5-rulings.md M28s-BQR-Right-4: carry (spec 5.3, the Shift bullet)
  ["M28s-BQR-Right-4", "text:Q1w@1|text:Nw@0"],
  // r1-task5-rulings.md M28s-BQR-Right-5: carry (spec 5.3, the Shift bullet)
  ["M28s-BQR-Right-5", "text:Q1w@1|text:Nw@1"],
  ["M28s-BQT-Left-1", "text:Q1w@1|text:Q1w@0"],
  ["M28s-BQT-Left-2", "text:Q1w@1|element:listitem@0"],
  ["M28s-BQT-Left-3", "text:Q1w@1|text:Pw@2"],
  ["M28s-BQT-Left-4", "text:Q1w@1|text:Pw@1"],
  ["M28s-BQT-Left-5", "text:Q1w@1|text:Pw@0"],
  ["M28s-BQT-Right-1", "text:Q1w@1|text:Q1w@2"],
  ["M28s-BQT-Right-2", "text:Q1w@1|text:Q1w@3"],
  ["M28s-BQT-Right-3", "text:Q1w@1|text:T2w@0"],
  ["M28s-BQT-Right-4", "text:Q1w@1|text:T2w@1"],
  ["M28s-BQT-Right-5", "text:Q1w@1|text:T2w@2"],
  ["M28s-RBQ-Left-1", "text:Q2w@1|text:Q2w@0"],
  ["M28s-RBQ-Left-2", "text:Q2w@1|element:listitem@1"],
  ["M28s-RBQ-Left-3", "text:Q2w@1|element:listitem@0"],
  ["M28s-RBQ-Left-4", "text:Q2w@1|text:Pw@2"],
  ["M28s-RBQ-Left-5", "text:Q2w@1|text:Pw@1"],
  ["M28s-RBQ-Right-1", "text:Q2w@1|text:Q2w@2"],
  ["M28s-RBQ-Right-2", "text:Q2w@1|text:Q2w@3"],
  ["M28s-RBQ-Right-3", "text:Q2w@1|text:Nw@0"],
  ["M28s-RBQ-Right-4", "text:Q2w@1|text:Nw@1"],
  ["M28s-RBQ-Right-5", "text:Q2w@1|text:Nw@2"],
  ["M28s-TBC-Left-1", "text:C2w@1|text:C2w@0"],
  ["M28s-TBC-Left-2", "text:C2w@1|element:listitem@1"],
  ["M28s-TBC-Left-3", "text:C2w@1|text:T0w@2"],
  ["M28s-TBC-Left-4", "text:C2w@1|text:T0w@1"],
  ["M28s-TBC-Left-5", "text:C2w@1|text:T0w@0"],
  ["M28s-TBC-Right-1", "text:C2w@1|text:C2w@2"],
  ["M28s-TBC-Right-2", "text:C2w@1|text:C2w@3"],
  ["M28s-TBC-Right-3", "text:C2w@1|text:Nw@0"],
  ["M28s-TBC-Right-4", "text:C2w@1|text:Nw@1"],
  ["M28s-TBC-Right-5", "text:C2w@1|text:Nw@2"],
  ["M28s-TBH-Left-1", "text:H2w@1|text:H2w@0"],
  ["M28s-TBH-Left-2", "text:H2w@1|element:listitem@1"],
  ["M28s-TBH-Left-3", "text:H2w@1|text:T0w@2"],
  ["M28s-TBH-Left-4", "text:H2w@1|text:T0w@1"],
  ["M28s-TBH-Left-5", "text:H2w@1|text:T0w@0"],
  ["M28s-TBH-Right-1", "text:H2w@1|text:H2w@2"],
  ["M28s-TBH-Right-2", "text:H2w@1|text:H2w@3"],
  ["M28s-TBH-Right-3", "text:H2w@1|text:Nw@0"],
  ["M28s-TBH-Right-4", "text:H2w@1|text:Nw@1"],
  ["M28s-TBH-Right-5", "text:H2w@1|text:Nw@2"],
  ["M28s-TBQ-Left-1", "text:Q2w@1|text:Q2w@0"],
  ["M28s-TBQ-Left-2", "text:Q2w@1|element:listitem@1"],
  ["M28s-TBQ-Left-3", "text:Q2w@1|text:T0w@2"],
  ["M28s-TBQ-Left-4", "text:Q2w@1|text:T0w@1"],
  ["M28s-TBQ-Left-5", "text:Q2w@1|text:T0w@0"],
  ["M28s-TBQ-Right-1", "text:Q2w@1|text:Q2w@2"],
  ["M28s-TBQ-Right-2", "text:Q2w@1|text:Q2w@3"],
  ["M28s-TBQ-Right-3", "text:Q2w@1|text:Nw@0"],
  ["M28s-TBQ-Right-4", "text:Q2w@1|text:Nw@1"],
  ["M28s-TBQ-Right-5", "text:Q2w@1|text:Nw@2"],
  ["M28s-QBR-Left-1", "text:Nw@0|element:listitem@3"],
  ["M28s-QBR-Left-2", "text:Nw@0|element:listitem@2"],
  ["M28s-QBR-Left-3", "text:Nw@0|element:listitem@1"],
  ["M28s-QBR-Left-4", "text:Nw@0|text:Q0w@3"],
  ["M28s-QBR-Left-5", "text:Nw@0|text:Q0w@2"],
  ["M28s-QBR-Right-1", "text:Nw@0|text:Nw@1"],
  ["M28s-QBR-Right-2", "text:Nw@0|text:Nw@2"],
  ["M28s-QBR-Right-3", "text:Nw@0|text:Nw@2"],
  ["M28s-QBR-Right-4", "text:Nw@0|text:Nw@2"],
  ["M28s-QBR-Right-5", "text:Nw@0|text:Nw@2"],
];

const parse = (id: string) => {
  const parts = id.split("-");
  const count = Number(parts.at(-1));
  return { shape: parts[1], dir: parts.length === 4 ? parts[2] : "", count };
};

describe("V10: the arrow walks (M28)", () => {
  test.each(
    V10_WRITES.map(([id, write, caret]) => ({ ...parse(id), write, caret }))
  )("V10 $shape $count presses", async ({ shape, count, write, caret }) => {
    const [stored, dir, start] = WALKS[shape];
    await expectEdit({
      stored,
      // the walk is the place: one undo takes the letter back to the
      // walk's last stop (16.27)
      place: then(start, presses(count, `{Arrow${dir}}`)),
      action: letter,
      write,
      caret,
    });
  });
});

describe("5.8: the Shift walks (M28s)", () => {
  test.each(SHIFT_CARETS.map(([id, caret]) => ({ ...parse(id), caret })))(
    "Shift walk $shape $dir $count presses",
    async ({ shape, dir, count, caret }) => {
      const [stored, , start] = WALKS[shape];
      const onChange = await mount(stored);
      await start();
      const errors = consoleErrors();
      onChange.mockClear();
      await presses(count, `{Shift>}{Arrow${dir}}{/Shift}`)();
      await settle();
      expect(caretKey()).toBe(caret);
      expect(onChange).not.toHaveBeenCalled();
      expect(errors).toEqual([]);
    }
  );

  // the two Shift walks whose letter is ruled (T23): the write after the
  // walk is the typed value of the ruling
  test.each([
    {
      ...parse("M28s-BQT-Left-2"),
      write: "<ul><li>Pw</li><li>k1w<br />T2w</li><li>Nw</li></ul>",
    },
    {
      ...parse("M28s-QBR-Left-3"),
      write:
        "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>kNw</li></ul>",
    },
  ])(
    "Shift walk $shape $dir $count presses, then a letter",
    async ({ shape, dir, count, write }) => {
      const [stored, , start] = WALKS[shape];
      await expectEdit({
        stored,
        place: then(start, presses(count, `{Shift>}{Arrow${dir}}{/Shift}`)),
        action: letter,
        write,
      });
    }
  );

  test("Shift+ArrowRight from a block's end stops at the line's start, before the break", async () => {
    await mount("<ul><li><pre><code>C0w</code></pre><br></li><li>Nw</li></ul>");
    await at("C0w")();
    await keys("{Shift>}{ArrowRight}{/Shift}")();
    expect(caretKey()).toBe("text:C0w@3|element:listitem@1");
    await copy();
    // D6: a selection that ends at a line's start holds nothing of that line
    expect(clipboard()["text/html"]).toBeDefined();
    expect(clipboard()["text/html"]).not.toContain("<br");
  });

  const LEFT_WALKS = [
    "BQ",
    "BC",
    "BH",
    "BBQ",
    "BQL",
    "BQQ",
    "BQR",
    "BQT",
    "RBQ",
    "TBC",
    "TBH",
    "TBQ",
    "QBR",
  ];
  test.each(LEFT_WALKS)(
    "Shift+ArrowLeft takes the same step as ArrowLeft: %s",
    async (shape) => {
      const [stored, dir, start] = WALKS[shape];
      expect(dir).toBe("Left");
      await mount(stored);
      await start();
      await keys("{ArrowLeft}")();
      const caret = caretKey();
      await mount(stored);
      await start();
      await keys("{Shift>}{ArrowLeft}{/Shift}")();
      expect(focusKey()).toBe(caret);
    }
  );
});

describe("an arrow off a node-selected rule", () => {
  test.each(["ArrowRight", "ArrowLeft"])(
    "an arrow off a selected rule in a lined item steps beside it with no onChange: %s",
    async (key) => {
      const onChange = await mount("<ul><li>xq<hr>yq</li></ul>");
      await nodeAfter("xq")();
      expect(caretKey()).toBe("node:horizontalrule");
      onChange.mockClear();
      await keys(`{${key}}`)();
      const rests = editorOf()!
        .getEditorState()
        .read(() => {
          const selection = $getSelection();
          if ($isNodeSelection(selection)) {
            return "node";
          }
          if (
            $isRangeSelection(selection) === false ||
            selection.isCollapsed() === false
          ) {
            return "not a caret";
          }
          const node = selection.anchor.getNode();
          return selection.anchor.type === "element" && isLinedContainer(node)
            ? "on a lined container"
            : "beside";
        });
      expect(rests).toBe("beside");
      expect(onChange).not.toHaveBeenCalled();
      await keys("{Control>}z{/Control}")();
      expect(onChange).not.toHaveBeenCalled();
    }
  );
});

// ---------------------------------------------------------------------------
// T9.2 B: an arrow from a block's text edge to a rule beside the block

describe("B: an arrow from a block's text edge to a rule beside the block", () => {
  test("ArrowRight at a quote's end selects the rule after it, then the text after the rule", async () => {
    const stored = LI(BQ("Q0w") + "<hr>T2w");
    await mount(stored);
    await at("Q0w")();
    await keys("{ArrowRight}")();
    expect(caretKey()).toBe("node:horizontalrule");
    await expectEdit({
      stored,
      place: then(at("Q0w"), keys("{ArrowRight}"), keys("{ArrowRight}")),
      action: letter,
      write:
        "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />kT2w</li><li>Nw</li></ul>",
    });
  });

  test("ArrowLeft at a quote's start selects the rule before it", async () => {
    const onChange = await mount(LI("<hr>" + BQ("Q1w")));
    await at("Q1w", 0)();
    await keys("{ArrowLeft}")();
    expect(caretKey()).toBe("node:horizontalrule");
    expect(onChange).not.toHaveBeenCalled();
  });
});

// The walks past a rule beside a block against `base-walks-rule`. A cell
// equals its fixture cell, except:
// - "shorter": the head stops on the item point beside the block and at
//   the block's edge, one caret under D18 (5.3), so the build's walk is one
//   press shorter there: the cell equals the head's next press;
// - D15: the build node-selects the rule where the head does (or one press
//   earlier), and the letter lands directly after the rule where the head's
//   lands at the start of `Pw` (the build's letter, its class's form);
// - the P records of p-records-task11.md (the head's walk cycles back to the
//   block, K8, where the build's goes on into the next item; QRQ's left walk,
//   where the head's first press stays): not asserted until ruled.
const RULE_NAMED: Record<string, "shorter" | "P" | { D15: string }> = {
  "QR-Right-1": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "QR-Right-2": "shorter",
  "QR-Right-3": "P",
  "QR-Right-4": "P",
  "QR-Right-5": "P",
  "QR-Left-2": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "QRT-Right-1": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />kT2w</li><li>Nw</li></ul>",
  },
  "QRT-Right-2": "shorter",
  "QRT-Right-3": "shorter",
  "QRT-Right-4": "shorter",
  "QRT-Right-5": "shorter",
  "QRT-Left-1": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />kT2w</li><li>Nw</li></ul>",
  },
  "TQRT-Right-1": {
    D15: "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><hr />kT3w</li><li>Nw</li></ul>",
  },
  "TQRT-Right-2": "shorter",
  "TQRT-Right-3": "shorter",
  "TQRT-Right-4": "shorter",
  "TQRT-Right-5": "shorter",
  "TQRT-Left-1": {
    D15: "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><hr />kT3w</li><li>Nw</li></ul>",
  },
  "BQR-Right-1": {
    D15: "<ul><li>Pw</li><li><br /><blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "BQR-Right-2": "shorter",
  "BQR-Right-3": "P",
  "BQR-Right-4": "P",
  "BQR-Right-5": "P",
  "BQR-Left-2": {
    D15: "<ul><li>Pw</li><li><br /><blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "QQR-Right-1": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "QQR-Right-2": "shorter",
  "QQR-Right-3": "P",
  "QQR-Right-4": "P",
  "QQR-Right-5": "P",
  "QQR-Left-2": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "QRB-Right-1": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k<br /></li><li>Nw</li></ul>",
  },
  "QRB-Right-2": "shorter",
  "QRB-Right-3": "shorter",
  "QRB-Right-4": "shorter",
  "QRB-Right-5": "shorter",
  "QRB-Left-3": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k<br /></li><li>Nw</li></ul>",
  },
  "QRL-Right-1": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k<ul><li>L2w</li></ul></li><li>Nw</li></ul>",
  },
  "QRL-Right-2": "shorter",
  "QRL-Right-3": "P",
  "QRL-Right-4": "P",
  "QRL-Right-5": "P",
  "QRL-Left-2": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k<ul><li>L2w</li></ul></li><li>Nw</li></ul>",
  },
  "QRQ-Right-1": "P",
  "QRQ-Right-2": "shorter",
  "QRQ-Right-3": "shorter",
  "QRQ-Right-4": "shorter",
  "QRQ-Right-5": "shorter",
  "QRQ-Left-1": "P",
  "QRQ-Left-2": "P",
  "QRQ-Left-3": "shorter",
  "QRQ-Left-4": "shorter",
  "QRQ-Left-5": "P",
  "QRR-Right-1": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k<hr /></li><li>Nw</li></ul>",
  },
  "QRR-Right-2": "shorter",
  "QRR-Right-3": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><hr />k</li><li>Nw</li></ul>",
  },
  "QRR-Right-4": "shorter",
  "QRR-Right-5": "P",
  "QRR-Left-2": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><hr />k</li><li>Nw</li></ul>",
  },
  "QRR-Left-4": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k<hr /></li><li>Nw</li></ul>",
  },
  "RQR-Right-1": {
    D15: "<ul><li>Pw</li><li><hr /><blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "RQR-Right-2": "shorter",
  "RQR-Right-3": "P",
  "RQR-Right-4": "P",
  "RQR-Right-5": "P",
  "RQR-Left-2": {
    D15: "<ul><li>Pw</li><li><hr /><blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "TQR-Right-1": {
    D15: "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "TQR-Right-2": "shorter",
  "TQR-Right-3": "P",
  "TQR-Right-4": "P",
  "TQR-Right-5": "P",
  "TQR-Left-2": {
    D15: "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "QRTQ-Right-1": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />kT2w<blockquote><p>Q3w</p></blockquote></li><li>Nw</li></ul>",
  },
  "QRTQ-Right-2": "shorter",
  "QRTQ-Right-3": "shorter",
  "QRTQ-Right-4": "shorter",
  "QRTQ-Right-5": "shorter",
  "QRTQ-Left-1": {
    D15: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />kT2w<blockquote><p>Q3w</p></blockquote></li><li>Nw</li></ul>",
  },
};
const RULE_FIXTURE = walksRuleFixture as Record<string, WalkRecord>;

describe("B: the walks past a rule beside a block", () => {
  const cells = walksRuleCells.filter((cell) => cell.presses <= 5);

  test("every cell is equal, named or a P record", () => {
    expect(cells).toHaveLength(120);
    const named = Object.values(RULE_NAMED);
    expect(named.filter((entry) => entry === "shorter")).toHaveLength(30);
    expect(named.filter((entry) => typeof entry === "object")).toHaveLength(24);
    expect(named.filter((entry) => entry === "P")).toHaveLength(23);
  });

  test.each(cells.filter((cell) => RULE_NAMED[cell.id] !== "P"))(
    "B $id presses, then a letter",
    async (cell) => {
      const record = await recordEdit(
        { stored: cell.stored, place: cell.start, action: walkOf(cell) },
        { short: true }
      );
      const named = RULE_NAMED[cell.id];
      const got = {
        write: record.write,
        calls: record.calls,
        caret: record.caret,
        typed: record.typed,
      };
      if (typeof named === "object") {
        expect(got).toEqual({
          write: null,
          calls: 0,
          caret: "node:horizontalrule",
          typed: named.D15,
        });
      } else {
        const id =
          named === "shorter"
            ? `${cell.id.replace(/-\d+$/, "")}-${cell.presses + 1}`
            : cell.id;
        expect(got).toEqual(RULE_FIXTURE[id]);
      }
      expect(record.errors).toEqual([]);
      expect(record.slowest).toBeLessThan(2000);
    }
  );
});

// ---------------------------------------------------------------------------
// T10.7, T11.11: Shift and an arrow pass a rule beside a block

/** The page's focus, as a node's text and an offset. */
const pageFocus = () => {
  const selection = window.getSelection();
  return `${selection?.focusNode?.textContent ?? ""}@${selection?.focusOffset}`;
};

/** The walk: each stop's caret, and whether the press moved the focus. */
const shiftWalk = async (walk: ShiftWalk) => {
  await mount(walk.stored);
  await at(walk.start)();
  const result: Record<"F" | "B", { caret: string; moved: boolean }[]> = {
    F: [],
    B: [],
  };
  const edges = { F: false, B: false };
  for (const [way, key] of [
    ["F", walk.forward],
    ["B", walk.backward],
  ] as const) {
    for (let press = 1; press <= MOST_PRESSES; press += 1) {
      const before = `${caretKey()} ${pageFocus()}`;
      await keys(`{Shift>}{${key}}{/Shift}`)();
      const caret = caretKey();
      result[way].push({ caret, moved: `${caret} ${pageFocus()}` !== before });
      if (pageEdge() === (way === "F" ? "end" : "start")) {
        edges[way] = true;
        break;
      }
    }
  }
  return { ...result, edges };
};

const SHIFT_FIXTURE = shiftPastRuleFixture as Record<
  string,
  { caret: string; edge: string }
>;

// Against `base-shift-past-rule`, per walk and way: the head's stops that the
// build does not make (`stuck`: the head's focus stayed where it was;
// `merged`: the head stops on the item point beside the block and at the
// block's edge, one caret under D18, so the build is one press shorter, 5.3)
// and the stops where the build's caret differs from the head's only because
// D18 resolved the point to the block's text, not to the block
// (`pointOnBlock`: P records P-shift-past-rule-<walk>-<press> of
// p-records-task11.md, not asserted until ruled).
const SHIFT_NAMED: Record<
  string,
  { stuck?: number[]; merged?: number[]; pointOnBlock?: number[] }
> = {
  "ltr-QR-F": { merged: [5] },
  "ltr-QR-B": { pointOnBlock: [4] },
  "ltr-RQ-F": { pointOnBlock: [2] },
  "ltr-RQ-B": { stuck: [7] },
  "ltr-QRQ-F": { merged: [5], pointOnBlock: [6] },
  "ltr-QRQ-B": { stuck: [7], merged: [8] },
  "ltr-RQR-F": { merged: [6], pointOnBlock: [2] },
  "ltr-RQR-B": { merged: [7], pointOnBlock: [4] },
  "ltr-QRR-F": { merged: [5] },
  "ltr-QRR-B": { pointOnBlock: [5] },
  "ltr-d2-F": { merged: [5] },
  "ltr-d2-B": { pointOnBlock: [7] },
  "rtl-QR-F": { merged: [5] },
  "rtl-QR-B": { merged: [4] },
  "rtl-RQ-F": { merged: [2] },
  "rtl-RQ-B": { stuck: [7] },
  "rtl-QRQ-F": { merged: [5, 6] },
  "rtl-QRQ-B": { stuck: [7], merged: [8] },
  "rtl-RQR-F": { merged: [2, 7] },
  "rtl-RQR-B": { merged: [4, 8] },
  "rtl-QRR-F": { merged: [5] },
  "rtl-QRR-B": { pointOnBlock: [5] },
  "rtl-Rfirst-F": { merged: [2] },
  "rtl-Rfirst-B": { stuck: [7] },
  "rtl-Rlast-F": { merged: [5] },
  "rtl-Rlast-B": { merged: [4] },
  "rtl-d2-F": { merged: [5] },
  "rtl-d2-B": { merged: [7] },
};

describe("T10.7: Shift and an arrow pass a rule beside a block", () => {
  test.each(shiftPastRuleWalks)(
    "Shift walk past a rule $id: each stop equals the head's, one press shorter",
    async (walk) => {
      const errors = consoleErrors();
      const got = await shiftWalk(walk);
      for (const way of ["F", "B"] as const) {
        const head: { press: number; caret: string; edge: string }[] = [];
        for (let press = 1; press <= MOST_PRESSES; press += 1) {
          const cell = SHIFT_FIXTURE[`${walk.id}-${way}-${press}`];
          if (cell !== undefined) {
            head.push({ press, ...cell });
          }
        }
        const named = SHIFT_NAMED[`${walk.id}-${way}`] ?? {};
        const skipped = new Set([
          ...(named.stuck ?? []),
          ...(named.merged ?? []),
        ]);
        const expected = head.filter(
          ({ press }) => skipped.has(press) === false
        );
        const reached = head.at(-1)?.edge !== "";
        if (reached) {
          expect(got[way], `${way}: the build's stops`).toHaveLength(
            expected.length
          );
        } else {
          expect(got[way].length).toBeGreaterThanOrEqual(expected.length);
        }
        expected.forEach(({ press, caret }, index) => {
          if (named.pointOnBlock?.includes(press)) {
            expect(got[way][index].moved, `${way} ${press}`).toBe(true);
          } else {
            expect(got[way][index].caret, `${way}: the head's ${press}`).toBe(
              caret
            );
          }
        });
      }
      expect(errors).toEqual([]);
    }
  );

  test.each(shiftPastRuleWalks)(
    "with Shift held no arrow press leaves the focus where it was, away from the content's edge: $id",
    async (walk) => {
      const got = await shiftWalk(walk);
      // the walk back in d2 is longer than 14 presses
      expect(got.edges.F).toBe(true);
      expect(got.edges.B || got.B.length === MOST_PRESSES).toBe(true);
      expect(
        [...got.F, ...got.B]
          .map(({ moved }, index) => (moved ? null : index + 1))
          .filter((press) => press !== null)
      ).toEqual([]);
    }
  );
});

// 15.3: a focus on an empty caret line beside a rule passes that rule, in
// either direction of text; 15.4: off a selected rule a key steps as a caret
// in the direction of the content on both sides, and where the sides
// differ, Lexical's rule (ArrowLeft to the previous place, ArrowRight to the
// next). Stops as `walkSel` writes them: a collapsed point, or anchor->focus.
const pointName = (point: PointType) => {
  const node = point.getNode();
  if (point.type === "text") {
    return `"${node.getTextContent()}"@${point.offset}`;
  }
  const child = $isElementNode(node)
    ? node.getChildAtIndex(point.offset)
    : null;
  const name =
    child === null
      ? "-"
      : $isTextNode(child)
        ? child.getTextContent()
        : child.getType();
  return `${node.getType()}@${point.offset}[${name}]`;
};
const walkSel = () =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      if ($isNodeSelection(selection)) {
        return `node:${selection
          .getNodes()
          .map((node) => node.getType())
          .join(",")}`;
      }
      if ($isRangeSelection(selection)) {
        return selection.isCollapsed()
          ? pointName(selection.anchor)
          : `${pointName(selection.anchor)}->${pointName(selection.focus)}`;
      }
      return String(selection);
    });

const HEBREW = (html: string) => html.replace("Pw", "פא").replace("Nw", "נו");
const DIRECTION_WALKS: ReadonlyArray<
  readonly [string, string, string, number, string]
> = [
  [
    "QR, Shift back",
    HEBREW(LI(BQ("קבג") + "<hr>")),
    "נו",
    0,
    "{Shift>}{ArrowRight}{/Shift}",
  ],
  [
    "RQR, Shift back",
    HEBREW(LI("<hr>" + BQ("קדה") + "<hr>")),
    "נו",
    0,
    "{Shift>}{ArrowRight}{/Shift}",
  ],
  [
    "TQR, Shift back",
    HEBREW(LI("תאב" + BQ("קדה") + "<hr>")),
    "נו",
    0,
    "{Shift>}{ArrowRight}{/Shift}",
  ],
  [
    "RQR, Shift forward",
    HEBREW(LI("<hr>" + BQ("קדה") + "<hr>")),
    "פא",
    2,
    "{Shift>}{ArrowLeft}{/Shift}",
  ],
  [
    "QR left to right, Shift back",
    LI(BQ("Q0w") + "<hr>"),
    "Nw",
    0,
    "{Shift>}{ArrowLeft}{/Shift}",
  ],
  [
    "RQR left to right, Shift forward",
    LI("<hr>" + BQ("Q1w") + "<hr>"),
    "Pw",
    2,
    "{Shift>}{ArrowRight}{/Shift}",
  ],
  [
    "K8 (R2): a left-to-right line, a rule, a right-to-left quote",
    LI("T0w<hr>" + BQ("קבג")),
    "Pw",
    2,
    "{ArrowRight}",
  ],
  [
    "K8 (R2): a quote, a rule, a right-to-left line",
    LI(BQ("Q0w") + "<hr>תגד"),
    "Pw",
    2,
    "{ArrowRight}",
  ],
  [
    "a left-to-right line, a rule, a right-to-left quote, ArrowLeft back",
    LI("T0w<hr>" + BQ("קבג")),
    "Nw",
    0,
    "{ArrowLeft}",
  ],
  [
    "right-to-left on both sides of the rule",
    HEBREW(LI("תאב<hr>" + BQ("קבג"))),
    "פא",
    2,
    "{ArrowLeft}",
  ],
];

// the stops and the letter of each walk, as the carry walks them (round 15)
const DIRECTION_STOPS: Record<string, { stops: string[]; k: string }> = {
  "QR, Shift back": {
    stops: [
      '"נו"@0',
      '"נו"@0->cms-line@0[-]',
      '"נו"@0->"קבג"@3',
      '"נו"@0->"קבג"@2',
      '"נו"@0->"קבג"@1',
      '"נו"@0->"קבג"@0',
      '"נו"@0->"פא"@2',
      '"נו"@0->"פא"@1',
      '"נו"@0->"פא"@0',
      '"נו"@0->"פא"@0',
      '"נו"@0->"פא"@0',
    ],
    k: "<ul><li>kנו</li></ul>",
  },
  "QR left to right, Shift back": {
    stops: [
      '"Nw"@0',
      '"Nw"@0->cms-line@0[-]',
      '"Nw"@0->"Q0w"@3',
      '"Nw"@0->"Q0w"@2',
      '"Nw"@0->"Q0w"@1',
      '"Nw"@0->"Q0w"@0',
      '"Nw"@0->"Pw"@2',
      '"Nw"@0->"Pw"@1',
      '"Nw"@0->"Pw"@0',
      '"Nw"@0->"Pw"@0',
      '"Nw"@0->"Pw"@0',
    ],
    k: "<ul><li>kNw</li></ul>",
  },
  "RQR, Shift back": {
    stops: [
      '"נו"@0',
      '"נו"@0->cms-line@0[-]',
      '"נו"@0->"קדה"@3',
      '"נו"@0->"קדה"@2',
      '"נו"@0->"קדה"@1',
      '"נו"@0->"קדה"@0',
      '"נו"@0->cms-line@0[-]',
      '"נו"@0->"פא"@2',
      '"נו"@0->"פא"@1',
      '"נו"@0->"פא"@0',
      '"נו"@0->"פא"@0',
    ],
    k: "<ul><li>kנו</li></ul>",
  },
  "RQR, Shift forward": {
    stops: [
      '"פא"@2',
      '"פא"@2->cms-line@0[-]',
      '"פא"@2->"קדה"@0',
      '"פא"@2->"קדה"@1',
      '"פא"@2->"קדה"@2',
      '"פא"@2->"קדה"@3',
      '"פא"@2->cms-line@0[-]',
      '"פא"@2->"נו"@0',
      '"פא"@2->"נו"@1',
      '"פא"@2->"נו"@2',
      '"פא"@2->"נו"@2',
    ],
    k: "<ul><li>פאk</li></ul>",
  },
  "RQR left to right, Shift forward": {
    stops: [
      '"Pw"@2',
      '"Pw"@2->cms-line@0[-]',
      '"Pw"@2->"Q1w"@0',
      '"Pw"@2->"Q1w"@1',
      '"Pw"@2->"Q1w"@2',
      '"Pw"@2->"Q1w"@3',
      '"Pw"@2->cms-line@0[-]',
      '"Pw"@2->"Nw"@0',
      '"Pw"@2->"Nw"@1',
      '"Pw"@2->"Nw"@2',
      '"Pw"@2->"Nw"@2',
    ],
    k: "<ul><li>Pwk</li></ul>",
  },
  "TQR, Shift back": {
    stops: [
      '"נו"@0',
      '"נו"@0->cms-line@0[-]',
      '"נו"@0->"קדה"@3',
      '"נו"@0->"קדה"@2',
      '"נו"@0->"קדה"@1',
      '"נו"@0->"קדה"@0',
      '"נו"@0->"תאב"@3',
      '"נו"@0->"תאב"@2',
      '"נו"@0->"תאב"@1',
      '"נו"@0->"תאב"@0',
      '"נו"@0->"פא"@2',
    ],
    k: "<ul><li>פאkנו</li></ul>",
  },
  "K8 (R2): a quote, a rule, a right-to-left line": {
    stops: [
      '"Pw"@2',
      '"Q0w"@0',
      '"Q0w"@1',
      '"Q0w"@2',
      '"Q0w"@3',
      "node:horizontalrule",
      '"תגד"@0',
      "node:horizontalrule",
      '"תגד"@0',
      "node:horizontalrule",
      '"תגד"@0',
    ],
    k: "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />kתגד</li><li>Nw</li></ul>",
  },
  "K8 (R2): a left-to-right line, a rule, a right-to-left quote": {
    stops: [
      '"Pw"@2',
      '"T0w"@0',
      '"T0w"@1',
      '"T0w"@2',
      '"T0w"@3',
      "node:horizontalrule",
      "quote@0[paragraph]",
      "node:horizontalrule",
      "quote@0[paragraph]",
      "node:horizontalrule",
      "quote@0[paragraph]",
    ],
    k: "<ul><li>Pw</li><li>T0w<hr /><blockquote><p>kקבג</p></blockquote></li><li>Nw</li></ul>",
  },
  "a left-to-right line, a rule, a right-to-left quote, ArrowLeft back": {
    stops: [
      '"Nw"@0',
      '"קבג"@3',
      '"Nw"@0',
      '"קבג"@3',
      '"Nw"@0',
      '"קבג"@3',
      '"Nw"@0',
      '"קבג"@3',
      '"Nw"@0',
      '"קבג"@3',
      '"Nw"@0',
    ],
    k: "<ul><li>Pw</li><li>T0w<hr /><blockquote><p>קבג</p></blockquote></li><li>kNw</li></ul>",
  },
  "right-to-left on both sides of the rule": {
    stops: [
      '"פא"@2',
      '"תאב"@0',
      '"תאב"@1',
      '"תאב"@2',
      '"תאב"@3',
      "node:horizontalrule",
      "quote@0[paragraph]",
      '"קבג"@1',
      '"קבג"@2',
      '"קבג"@3',
      '"נו"@0',
    ],
    k: "<ul><li>פא</li><li>תאב<hr /><blockquote><p>קבג</p></blockquote></li><li>kנו</li></ul>",
  },
};

describe("15.3 and 15.4: the walks beside a rule in either direction of text", () => {
  test.each(DIRECTION_WALKS)(
    "%s: ten presses, then a letter",
    async (name, stored, word, offset, key) => {
      const onChange = await mount(stored);
      await at(word, offset)();
      const stops = [walkSel()];
      for (let press = 0; press < 10; press += 1) {
        await keys(key)();
        stops.push(walkSel());
      }
      await letter();
      expect({
        stops,
        k: onChange.mock.calls.length > 0 ? short(lastHtml(onChange)) : "none",
      }).toEqual(DIRECTION_STOPS[name]);
    }
  );
});

// ---------------------------------------------------------------------------
// 14.7: the arrow rules take the direction the key moves the caret in the
// block

describe("14.7: the arrow rules take the direction the key moves the caret in the block", () => {
  test("a right-to-left quote before a rule: ArrowRight at the text's logical end moves back into the text, as at the head", async () => {
    const stored = LI(BQ("אבג") + "<hr>T2w");
    await mount(stored);
    await at("אבג")();
    await keys("{ArrowRight}")();
    expect(caretKey()).not.toBe("node:horizontalrule");
    await expectEdit({
      stored,
      place: then(at("אבג"), keys("{ArrowRight}")),
      action: letter,
      write:
        "<ul><li>Pw</li><li><blockquote><p>אבkג</p></blockquote><hr />T2w</li><li>Nw</li></ul>",
    });
  });

  test("there ArrowLeft moves forward and selects the rule; a letter lands after it", async () => {
    const stored = LI(BQ("אבג") + "<hr>T2w");
    await mount(stored);
    await at("אבג")();
    await keys("{ArrowLeft}")();
    expect(caretKey()).toBe("node:horizontalrule");
    await expectEdit({
      stored,
      place: then(at("אבג"), keys("{ArrowLeft}")),
      action: letter,
      write:
        "<ul><li>Pw</li><li><blockquote><p>אבג</p></blockquote><hr />kT2w</li><li>Nw</li></ul>",
    });
  });

  test("a right-to-left quote after a rule: ArrowRight at the text's logical start moves backward and selects the rule", async () => {
    await mount(LI("T0w<hr>" + BQ("אבג")));
    await at("אבג", 0)();
    await keys("{ArrowRight}")();
    expect(caretKey()).toBe("node:horizontalrule");
  });

  test("there ArrowLeft moves forward into the text", async () => {
    const stored = LI("T0w<hr>" + BQ("אבג"));
    await mount(stored);
    await at("אבג", 0)();
    await keys("{ArrowLeft}")();
    expect(caretKey()).not.toBe("node:horizontalrule");
    await expectEdit({
      stored,
      place: then(at("אבג", 0), keys("{ArrowLeft}")),
      action: letter,
      write:
        "<ul><li>Pw</li><li>T0w<hr /><blockquote><p>אkבג</p></blockquote></li><li>Nw</li></ul>",
    });
  });
});
