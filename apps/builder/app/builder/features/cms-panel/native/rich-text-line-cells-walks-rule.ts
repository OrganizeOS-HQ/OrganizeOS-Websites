// The cells of `base-walks-rule` (Task 5 Step 6; check 2, B): the arrow
// walks past a rule beside a block, Right and Left, 1 to 5 presses, then a
// letter; going right also a sixth press, the head's stop that the build's
// fifth reaches one press shorter (12 cells beyond the 120; T12.8: a count is
// a minimum). Going right from a real click at the end of the text of the quote
// before the rule; going left from a real click at the start of the text
// after the rule, or at `Nw@0` where no text follows the rule in the item.
import { at, keys, LI, type Step, then } from "./rich-text-line-test-kit";

const BQ = (text: string) => `<blockquote><p>${text}</p></blockquote>`;

/** Each shape: its stored value, the right walk's start, the left walk's. */
export const WALKS_RULE_SHAPES: Record<
  string,
  readonly [string, readonly [string, number], readonly [string, number]]
> = {
  QR: [LI(BQ("Q0w") + "<hr>"), ["Q0w", 3], ["Nw", 0]],
  QRT: [LI(BQ("Q0w") + "<hr>T2w"), ["Q0w", 3], ["T2w", 0]],
  TQRT: [LI("T0w" + BQ("Q1w") + "<hr>T3w"), ["Q1w", 3], ["T3w", 0]],
  BQR: [LI("<br>" + BQ("Q1w") + "<hr>"), ["Q1w", 3], ["Nw", 0]],
  QQR: [LI(BQ("Q0w") + BQ("Q1w") + "<hr>"), ["Q1w", 3], ["Nw", 0]],
  QRB: [LI(BQ("Q0w") + "<hr><br>"), ["Q0w", 3], ["Nw", 0]],
  QRL: [LI(BQ("Q0w") + "<hr><ul><li>L2w</li></ul>"), ["Q0w", 3], ["L2w", 0]],
  QRQ: [LI(BQ("Q0w") + "<hr>" + BQ("Q2w")), ["Q0w", 3], ["Q2w", 0]],
  QRR: [LI(BQ("Q0w") + "<hr><hr>"), ["Q0w", 3], ["Nw", 0]],
  RQR: [LI("<hr>" + BQ("Q1w") + "<hr>"), ["Q1w", 3], ["Nw", 0]],
  TQR: [LI("T0w" + BQ("Q1w") + "<hr>"), ["Q1w", 3], ["Nw", 0]],
  QRTQ: [LI(BQ("Q0w") + "<hr>T2w" + BQ("Q3w")), ["Q0w", 3], ["T2w", 0]],
};

export type WalkCell = {
  id: string;
  stored: string;
  /** The real click that starts the walk. */
  start: Step;
  /** The key, pressed `presses` times. */
  key: string;
  presses: number;
};

export const walksRuleCells: WalkCell[] = Object.entries(
  WALKS_RULE_SHAPES
).flatMap(([shape, [stored, right, left]]) =>
  (["Right", "Left"] as const).flatMap((dir) =>
    (dir === "Right" ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]).map((presses) => {
      const [word, offset] = dir === "Right" ? right : left;
      return {
        id: `${shape}-${dir}-${presses}`,
        stored,
        start: at(word, offset),
        key: `{Arrow${dir}}`,
        presses,
      };
    })
  )
);

/** The walk itself: `presses` presses of the cell's key. */
export const walkOf = (cell: Pick<WalkCell, "key" | "presses">): Step =>
  then(...Array.from({ length: cell.presses }, () => keys(cell.key)));

// The walks past a rule beside a block against `base-walks-rule`. A cell
// equals its fixture cell, except:
// - "shorter": the head stops on the item point beside the block and at
//   the block's edge, one caret under D18 (5.3), so the build's walk is one
//   press shorter there: the cell equals the head's next press;
// - D15: the build node-selects the rule where the head does (or one press
//   earlier), and the letter lands directly after the rule where the head's
//   lands at the start of `Pw` (the build's letter, its class's form);
// - "D18: the quote's text": the step off a node-selected rule rests at the
//   quote's text edge where the head's rests on the quote element, the same
//   caret (T29.3); the letter equals the head's;
// - T29.2: the head's walk cycles back to the block (K8) where the build's
//   goes on, and QRQ's left walk, whose first press stays at the head: the
//   build's stops and letters, pinned by T29.2.
export const RULE_NAMED: Record<
  string,
  "shorter" | { why: string; caret: string; typed: string }
> = {
  "QR-Right-1": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "QR-Right-2": "shorter",
  "QR-Right-3": {
    why: "T29.2",
    caret: "text:Nw@0",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /></li><li>kNw</li></ul>",
  },
  "QR-Right-4": {
    why: "T29.2",
    caret: "text:Nw@1",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /></li><li>Nkw</li></ul>",
  },
  "QR-Right-5": {
    why: "T29.2",
    caret: "text:Nw@2",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /></li><li>Nwk</li></ul>",
  },
  "QR-Left-2": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "QR-Left-3": {
    why: "D18: the quote's text",
    caret: "text:Q0w@3",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0wk</p></blockquote><hr /></li><li>Nw</li></ul>",
  },
  "QRT-Right-1": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />kT2w</li><li>Nw</li></ul>",
  },
  "QRT-Right-2": "shorter",
  "QRT-Right-3": "shorter",
  "QRT-Right-4": "shorter",
  "QRT-Right-5": "shorter",
  "QRT-Left-1": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />kT2w</li><li>Nw</li></ul>",
  },
  "QRT-Left-2": {
    why: "D18: the quote's text",
    caret: "text:Q0w@3",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0wk</p></blockquote><hr />T2w</li><li>Nw</li></ul>",
  },
  "TQRT-Right-1": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><hr />kT3w</li><li>Nw</li></ul>",
  },
  "TQRT-Right-2": "shorter",
  "TQRT-Right-3": "shorter",
  "TQRT-Right-4": "shorter",
  "TQRT-Right-5": "shorter",
  "TQRT-Left-1": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><hr />kT3w</li><li>Nw</li></ul>",
  },
  "TQRT-Left-2": {
    why: "D18: the quote's text",
    caret: "text:Q1w@3",
    typed:
      "<ul><li>Pw</li><li>T0w<blockquote><p>Q1wk</p></blockquote><hr />T3w</li><li>Nw</li></ul>",
  },
  "BQR-Right-1": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><br /><blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "BQR-Right-2": "shorter",
  "BQR-Right-3": {
    why: "T29.2",
    caret: "text:Nw@0",
    typed:
      "<ul><li>Pw</li><li><br /><blockquote><p>Q1w</p></blockquote><hr /></li><li>kNw</li></ul>",
  },
  "BQR-Right-4": {
    why: "T29.2",
    caret: "text:Nw@1",
    typed:
      "<ul><li>Pw</li><li><br /><blockquote><p>Q1w</p></blockquote><hr /></li><li>Nkw</li></ul>",
  },
  "BQR-Right-5": {
    why: "T29.2",
    caret: "text:Nw@2",
    typed:
      "<ul><li>Pw</li><li><br /><blockquote><p>Q1w</p></blockquote><hr /></li><li>Nwk</li></ul>",
  },
  "BQR-Left-2": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><br /><blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "BQR-Left-3": {
    why: "D18: the quote's text",
    caret: "text:Q1w@3",
    typed:
      "<ul><li>Pw</li><li><br /><blockquote><p>Q1wk</p></blockquote><hr /></li><li>Nw</li></ul>",
  },
  "QQR-Right-1": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "QQR-Right-2": "shorter",
  "QQR-Right-3": {
    why: "T29.2",
    caret: "text:Nw@0",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><blockquote><p>Q1w</p></blockquote><hr /></li><li>kNw</li></ul>",
  },
  "QQR-Right-4": {
    why: "T29.2",
    caret: "text:Nw@1",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><blockquote><p>Q1w</p></blockquote><hr /></li><li>Nkw</li></ul>",
  },
  "QQR-Right-5": {
    why: "T29.2",
    caret: "text:Nw@2",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><blockquote><p>Q1w</p></blockquote><hr /></li><li>Nwk</li></ul>",
  },
  "QQR-Left-2": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "QQR-Left-3": {
    why: "D18: the quote's text",
    caret: "text:Q1w@3",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><blockquote><p>Q1wk</p></blockquote><hr /></li><li>Nw</li></ul>",
  },
  "QRB-Right-1": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k<br /></li><li>Nw</li></ul>",
  },
  "QRB-Right-2": "shorter",
  "QRB-Right-3": "shorter",
  "QRB-Right-4": "shorter",
  "QRB-Right-5": "shorter",
  "QRB-Left-3": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k<br /></li><li>Nw</li></ul>",
  },
  "QRB-Left-4": {
    why: "D18: the quote's text",
    caret: "text:Q0w@3",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0wk</p></blockquote><hr /><br /></li><li>Nw</li></ul>",
  },
  "QRL-Right-1": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k<ul><li>L2w</li></ul></li><li>Nw</li></ul>",
  },
  "QRL-Right-2": "shorter",
  "QRL-Right-3": {
    why: "T29.2",
    caret: "text:L2w@0",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><ul><li>kL2w</li></ul></li><li>Nw</li></ul>",
  },
  "QRL-Right-4": {
    why: "T29.2",
    caret: "text:L2w@1",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><ul><li>Lk2w</li></ul></li><li>Nw</li></ul>",
  },
  "QRL-Right-5": {
    why: "T29.2",
    caret: "text:L2w@2",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><ul><li>L2kw</li></ul></li><li>Nw</li></ul>",
  },
  "QRL-Left-2": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k<ul><li>L2w</li></ul></li><li>Nw</li></ul>",
  },
  "QRL-Left-3": {
    why: "D18: the quote's text",
    caret: "text:Q0w@3",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0wk</p></blockquote><hr /><ul><li>L2w</li></ul></li><li>Nw</li></ul>",
  },
  "QRQ-Right-1": {
    why: "T29.2",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>kQ2w</p></blockquote></li><li>Nw</li></ul>",
  },
  "QRQ-Right-2": {
    why: "D18: the quote's text",
    caret: "text:Q2w@0",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>kQ2w</p></blockquote></li><li>Nw</li></ul>",
  },
  "QRQ-Right-3": "shorter",
  "QRQ-Right-4": "shorter",
  "QRQ-Right-5": "shorter",
  "QRQ-Left-1": {
    why: "T29.2",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><blockquote><p>kQ2w</p></blockquote></li><li>Nw</li></ul>",
  },
  "QRQ-Left-2": "shorter",
  "QRQ-Left-3": "shorter",
  "QRQ-Left-4": "shorter",
  "QRQ-Left-5": {
    why: "T29.2",
    caret: "text:Q0w@0",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>kQ0w</p></blockquote><hr /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>",
  },
  "QRR-Right-1": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k<hr /></li><li>Nw</li></ul>",
  },
  "QRR-Right-2": "shorter",
  "QRR-Right-3": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><hr />k</li><li>Nw</li></ul>",
  },
  "QRR-Right-4": "shorter",
  "QRR-Right-5": {
    why: "T29.2",
    caret: "text:Nw@0",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><hr /></li><li>kNw</li></ul>",
  },
  "QRR-Left-2": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr /><hr />k</li><li>Nw</li></ul>",
  },
  "QRR-Left-4": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />k<hr /></li><li>Nw</li></ul>",
  },
  "QRR-Left-5": {
    why: "D18: the quote's text",
    caret: "text:Q0w@3",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0wk</p></blockquote><hr /><hr /></li><li>Nw</li></ul>",
  },
  "RQR-Right-1": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><hr /><blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "RQR-Right-2": "shorter",
  "RQR-Right-3": {
    why: "T29.2",
    caret: "text:Nw@0",
    typed:
      "<ul><li>Pw</li><li><hr /><blockquote><p>Q1w</p></blockquote><hr /></li><li>kNw</li></ul>",
  },
  "RQR-Right-4": {
    why: "T29.2",
    caret: "text:Nw@1",
    typed:
      "<ul><li>Pw</li><li><hr /><blockquote><p>Q1w</p></blockquote><hr /></li><li>Nkw</li></ul>",
  },
  "RQR-Right-5": {
    why: "T29.2",
    caret: "text:Nw@2",
    typed:
      "<ul><li>Pw</li><li><hr /><blockquote><p>Q1w</p></blockquote><hr /></li><li>Nwk</li></ul>",
  },
  "RQR-Left-2": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><hr /><blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "RQR-Left-3": {
    why: "D18: the quote's text",
    caret: "text:Q1w@3",
    typed:
      "<ul><li>Pw</li><li><hr /><blockquote><p>Q1wk</p></blockquote><hr /></li><li>Nw</li></ul>",
  },
  "TQR-Right-1": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "TQR-Right-2": "shorter",
  "TQR-Right-3": {
    why: "T29.2",
    caret: "text:Nw@0",
    typed:
      "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><hr /></li><li>kNw</li></ul>",
  },
  "TQR-Right-4": {
    why: "T29.2",
    caret: "text:Nw@1",
    typed:
      "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><hr /></li><li>Nkw</li></ul>",
  },
  "TQR-Right-5": {
    why: "T29.2",
    caret: "text:Nw@2",
    typed:
      "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><hr /></li><li>Nwk</li></ul>",
  },
  "TQR-Left-2": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote><hr />k</li><li>Nw</li></ul>",
  },
  "TQR-Left-3": {
    why: "D18: the quote's text",
    caret: "text:Q1w@3",
    typed:
      "<ul><li>Pw</li><li>T0w<blockquote><p>Q1wk</p></blockquote><hr /></li><li>Nw</li></ul>",
  },
  "QRTQ-Right-1": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />kT2w<blockquote><p>Q3w</p></blockquote></li><li>Nw</li></ul>",
  },
  "QRTQ-Right-2": "shorter",
  "QRTQ-Right-3": "shorter",
  "QRTQ-Right-4": "shorter",
  "QRTQ-Right-5": "shorter",
  "QRTQ-Left-1": {
    why: "D15",
    caret: "node:horizontalrule",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />kT2w<blockquote><p>Q3w</p></blockquote></li><li>Nw</li></ul>",
  },
  "QRTQ-Left-2": {
    why: "D18: the quote's text",
    caret: "text:Q0w@3",
    typed:
      "<ul><li>Pw</li><li><blockquote><p>Q0wk</p></blockquote><hr />T2w<blockquote><p>Q3w</p></blockquote></li><li>Nw</li></ul>",
  },
};
