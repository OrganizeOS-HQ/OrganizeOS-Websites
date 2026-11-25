// The walks of `base-shift-past-rule` (Task 5 Step 6; T10.7, T11.11, T12.8,
// T14.8): the eight shapes of check 5's probe `zzv15-nav-w1` in left-to-right
// and right-to-left text, each walked as the probe's `F-B` walk: a real click
// at the end of `Pw` (`Aw` in `d2`), Shift and the forward arrow to the
// content's edge, then Shift and the backward arrow back, at most 14 presses
// each way. Every stop is a cell.
import { editable } from "./rich-text-test-harness";

export type TextDirection = "ltr" | "rtl";

const WORDS = {
  ltr: {
    P: "Pw",
    N: "Nw",
    T0: "T0w",
    T1: "T1w",
    Q0: "Q0w",
    Q1: "Q1w",
    Q2: "Q2w",
    A: "Aw",
    Z: "Zw",
  },
  rtl: {
    P: "פא",
    N: "נו",
    T0: "תאב",
    T1: "תגד",
    Q0: "קבג",
    Q1: "קדה",
    Q2: "קוז",
    A: "אז",
    Z: "זט",
  },
};

const quote = (text: string) => `<blockquote><p>${text}</p></blockquote>`;

export const shiftPastRuleShapes = (d: TextDirection) => {
  const w = WORDS[d];
  const LI = (x: string) =>
    `<ul><li>${w.P}</li><li>${x}</li><li>${w.N}</li></ul>`;
  return {
    QR: LI(`${quote(w.Q0)}<hr>`),
    RQ: LI(`<hr>${quote(w.Q1)}`),
    QRQ: LI(`${quote(w.Q0)}<hr>${quote(w.Q2)}`),
    RQR: LI(`<hr>${quote(w.Q1)}<hr>`),
    QRR: LI(`${quote(w.Q0)}<hr><hr>`),
    Rfirst: LI(`<hr>${w.T1}`),
    Rlast: LI(`${w.T0}<hr>`),
    d2: `<ul><li>${w.P}<ul><li>${w.A}</li><li>${quote(w.Q0)}<hr></li><li>${w.Z}</li></ul></li><li>${w.N}</li></ul>`,
  } as Record<string, string>;
};

export type ShiftWalk = {
  id: string;
  d: TextDirection;
  shape: string;
  stored: string;
  /** The word clicked at its end. */
  start: string;
  forward: string;
  backward: string;
};

export const shiftPastRuleWalks: ShiftWalk[] = (
  ["ltr", "rtl"] as const
).flatMap((d) =>
  Object.entries(shiftPastRuleShapes(d)).map(([shape, stored]) => ({
    id: `${d}-${shape}`,
    d,
    shape,
    stored,
    start: shape === "d2" ? WORDS[d].A : WORDS[d].P,
    forward: d === "ltr" ? "ArrowRight" : "ArrowLeft",
    backward: d === "ltr" ? "ArrowLeft" : "ArrowRight",
  }))
);

export const MOST_PRESSES = 14;

/** Where the page's focus stands: the content's `end`, `start`, or neither. */
export const pageEdge = () => {
  const selection = window.getSelection()!;
  const texts = [
    ...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]"),
  ];
  const first = texts[0]?.firstChild;
  const last = texts.at(-1)?.firstChild;
  if (
    selection.focusNode === last &&
    selection.focusOffset === (last?.textContent ?? "").length
  ) {
    return "end";
  }
  if (selection.focusNode === first && selection.focusOffset === 0) {
    return "start";
  }
  return "";
};
