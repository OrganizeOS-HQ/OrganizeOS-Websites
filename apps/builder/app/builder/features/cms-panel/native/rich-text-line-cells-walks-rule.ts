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
