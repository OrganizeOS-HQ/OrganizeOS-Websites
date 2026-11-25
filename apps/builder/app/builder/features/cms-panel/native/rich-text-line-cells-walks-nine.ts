// The cells of `base-walks-nine` (Task 5 Step 6; check 2, D): the nine-shape
// walk grid. Down from `Pw@1` and Up from `Nw@1`, 1 to 3 presses; Left from
// `Nw@0` and Right from `Pw@2`, 1 to 5 presses; then a letter. The
// right-to-left copy (branch only, a snapshot of its own) writes every text
// in Hebrew letters with `dir="rtl"` on the item, Left and Right swapped.
import { at, type Step } from "./rich-text-line-test-kit";
import type { WalkCell } from "./rich-text-line-cells-walks-rule";

type Words = Record<
  "P" | "N" | "Q0" | "Q1" | "H0" | "H1" | "C0" | "C1" | "T2",
  string
>;

const LTR: Words = {
  P: "Pw",
  N: "Nw",
  Q0: "Q0w",
  Q1: "Q1w",
  H0: "H0w",
  H1: "H1w",
  C0: "C0w",
  C1: "C1w",
  T2: "T2w",
};
const RTL: Words = {
  P: "פא",
  N: "נו",
  Q0: "קבג",
  Q1: "קדה",
  H0: "הבג",
  H1: "הדה",
  C0: "כבג",
  C1: "כדה",
  T2: "תהו",
};

const shapesOf = (w: Words, item: string) => {
  const LI = (x: string) =>
    `<ul><li>${w.P}</li>${item}${x}</li><li>${w.N}</li></ul>`;
  const BQ = (text: string) => `<blockquote><p>${text}</p></blockquote>`;
  return {
    BQ: LI("<br>" + BQ(w.Q1)),
    BR: LI("<br><hr>"),
    QBR: LI(BQ(w.Q0) + "<br><hr>"),
    HB: LI(`<h3>${w.H0}</h3><br>`),
    CB: LI(`<pre><code>${w.C0}</code></pre><br>`),
    BH: LI(`<br><h3>${w.H1}</h3>`),
    BC: LI(`<br><pre><code>${w.C1}</code></pre>`),
    BQT: LI("<br>" + BQ(w.Q1) + w.T2),
    QB: LI(BQ(w.Q0) + "<br>"),
  } as Record<string, string>;
};

const KEYS = [
  ["Down", 3],
  ["Up", 3],
  ["Left", 5],
  ["Right", 5],
] as const;

const cellsOf = (w: Words, rtl: boolean): WalkCell[] =>
  Object.entries(shapesOf(w, rtl ? '<li dir="rtl">' : "<li>")).flatMap(
    ([shape, stored]) =>
      KEYS.flatMap(([dir, most]) =>
        Array.from({ length: most }, (_, index) => {
          const presses = index + 1;
          // the walk named Left goes backward from Nw@0; in right-to-left
          // text its key is ArrowRight
          const key =
            rtl && dir === "Left"
              ? "Right"
              : rtl && dir === "Right"
                ? "Left"
                : dir;
          const start: Step =
            dir === "Down"
              ? at(w.P, 1)
              : dir === "Up"
                ? at(w.N, 1)
                : dir === "Left"
                  ? at(w.N, 0)
                  : at(w.P, 2);
          return {
            id: `${shape}-${dir}-${presses}`,
            stored,
            start,
            key: `{Arrow${key}}`,
            presses,
          };
        })
      )
  );

export const walksNineCells = cellsOf(LTR, false);
export const walksNineRtlCells = cellsOf(RTL, true);

// the 18 cells of T9.2 D that differ from the head: [class, the letter typed
// at the stop, from the carry's run]
export const NINE_NAMED: Record<string, readonly [string, string]> = {
  "BR-Left-2": ["D15", "<ul><li>Pw</li><li><br /><hr />k</li><li>Nw</li></ul>"],
  "BR-Right-3": [
    "D15",
    "<ul><li>Pw</li><li><br /><hr />k</li><li>Nw</li></ul>",
  ],
  "BR-Right-5": ["K8", "<ul><li>Pw</li><li><br /><hr /></li><li>kNw</li></ul>"],
  "QBR-Down-2": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /><hr /></li><li>Nw</li></ul>",
  ],
  "QBR-Up-1": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /><hr /></li><li>Nw</li></ul>",
  ],
  "QBR-Left-2": [
    "D15",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br /><hr />k</li><li>Nw</li></ul>",
  ],
  "QBR-Left-4": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /><hr /></li><li>Nw</li></ul>",
  ],
  "QBR-Right-5": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /><hr /></li><li>Nw</li></ul>",
  ],
  "HB-Down-2": [
    "a line's start",
    "<ul><li>Pw</li><li><h3>H0w</h3>k<br /></li><li>Nw</li></ul>",
  ],
  "HB-Up-2": [
    "a line's start",
    "<ul><li>Pw</li><li><h3>H0w</h3>k<br /></li><li>Nw</li></ul>",
  ],
  "HB-Left-2": [
    "a line's start",
    "<ul><li>Pw</li><li><h3>H0w</h3>k<br /></li><li>Nw</li></ul>",
  ],
  "CB-Down-2": [
    "a line's start",
    "<ul><li>Pw</li><li><pre><code>C0w</code></pre>k<br /></li><li>Nw</li></ul>",
  ],
  "CB-Up-2": [
    "a line's start",
    "<ul><li>Pw</li><li><pre><code>C0w</code></pre>k<br /></li><li>Nw</li></ul>",
  ],
  "CB-Left-2": [
    "a line's start",
    "<ul><li>Pw</li><li><pre><code>C0w</code></pre>k<br /></li><li>Nw</li></ul>",
  ],
  "QB-Down-2": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /></li><li>Nw</li></ul>",
  ],
  "QB-Up-2": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /></li><li>Nw</li></ul>",
  ],
  "QB-Left-2": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /></li><li>Nw</li></ul>",
  ],
  "QB-Right-5": [
    "a line's start",
    "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k<br /></li><li>Nw</li></ul>",
  ],
};
