// The 15.11 writer's ranges (prototype check 4's element-point sweep, its
// unlined twins and its real-input ranges), the oracle that reads what a
// range holds from the editor state, and the placing of their ends.
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $setSelection,
  type ElementNode,
  type LexicalNode,
} from "lexical";
import { clickInWord, editable, editorOf, fontsLoaded, settle } from "./rich-text-test-harness";

export const IMG = `<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />`;
export const LI = (x: string) => `<ul><li>Pw</li><li>${x}</li><li>Nw</li></ul>`;
// ---- the selection oracle (own code: the editor state's JSON and the two ends' paths) ----
type JNode = { type: string; text?: string; children?: JNode[] };
type OPoint = { path: number[]; type: "text" | "element"; offset: number };
export const $pointByPath = (point: { getNode: () => LexicalNode; type: "text" | "element"; offset: number }): OPoint => {
  const path: number[] = [];
  for (let at: LexicalNode = point.getNode(); at.getParent() !== null; at = at.getParentOrThrow()) {
    path.unshift(at.getIndexWithinParent());
  }
  return { path, type: point.type, offset: point.offset };
};
const samePath = (a: number[], b: number[]) => a.length === b.length && a.every((x, k) => x === b[k]);
/** Leaf tokens in document order, and each end's position among them. */
export const oracleTokens = (root: JNode, ends: OPoint[]) => {
  const tokens: string[] = [];
  const pos: (number | null)[] = ends.map(() => null);
  const walk = (node: JNode, path: number[]) => {
    if (typeof node.text === "string") {
      ends.forEach((e, k) => {
        if (e.type === "text" && samePath(e.path, path)) pos[k] = tokens.length + e.offset;
      });
      for (const ch of node.text) tokens.push(ch);
      return;
    }
    if (node.children !== undefined) {
      node.children.forEach((child, index) => {
        ends.forEach((e, k) => {
          if (e.type === "element" && samePath(e.path, path) && e.offset === index) pos[k] = tokens.length;
        });
        walk(child, [...path, index]);
      });
      ends.forEach((e, k) => {
        if (e.type === "element" && samePath(e.path, path) && e.offset === node.children!.length) pos[k] = tokens.length;
      });
      return;
    }
    tokens.push(node.type === "linebreak" ? "[br]" : `[${node.type}]`);
  };
  walk(root, []);
  return { tokens, pos };
};
export const oracleOf = (tokens: string[]) => {
  const out = { text: "", img: 0, hr: 0, br: 0, seq: "" };
  for (const t of tokens) {
    if (t === "[br]") out.br += 1;
    else if (t === "[cms-image]" || t === "[cms-figure]") out.img += 1;
    else if (t === "[horizontalrule]") out.hr += 1;
    else if (t.length === 1) { if (t !== "\n") out.text += t; }
    else out.text += `?${t}`;
  }
  out.seq = tokens.filter((t) => t !== "\n").map((t) => (t.length === 1 ? t : t === "[br]" ? "|" : t === "[horizontalrule]" ? "#" : "@")).join("");
  return out;
};
export const liveTokens = () =>
  oracleTokens((editorOf()!.getEditorState().toJSON() as unknown as { root: JNode }).root, []).tokens;
export const oracleNow = () => {
  const ends = editorOf()!
    .getEditorState()
    .read(() => {
      const s = $getSelection() as unknown as { anchor?: never; focus?: never } | null;
      if (s === null || s.anchor === undefined) return null;
      return [$pointByPath(s.anchor), $pointByPath(s.focus!)];
    });
  if (ends === null) return null;
  const { tokens, pos } = oracleTokens((editorOf()!.getEditorState().toJSON() as unknown as { root: JNode }).root, ends);
  if (pos[0] === null || pos[1] === null) return { error: "end not found", ends };
  const lo = Math.min(pos[0], pos[1]);
  const hi = Math.max(pos[0], pos[1]);
  return { ends, pos, tokens: tokens.slice(lo, hi), ...oracleOf(tokens.slice(lo, hi)) };
};
/** The data's content in order, as the oracle reads it. */
export const dataSeq = (lexical: string | undefined) => {
  if (lexical === undefined || lexical === "") return null;
  const tokens: string[] = [];
  const walk = (n: JNode) => {
    if (typeof n.text === "string") { for (const ch of n.text) tokens.push(ch); return; }
    if (n.children !== undefined) { n.children.forEach(walk); return; }
    tokens.push(n.type === "linebreak" ? "[br]" : `[${n.type}]`);
  };
  try {
    (JSON.parse(lexical).nodes as JNode[]).forEach(walk);
  } catch { return null; }
  return oracleOf(tokens);
};
export const htmlSeq = (html: string | undefined) => {
  if (html === undefined || html === "") return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tokens: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === 3) { for (const ch of n.textContent ?? "") tokens.push(ch); return; }
    const tag = (n as Element).tagName?.toLowerCase();
    if (tag === "img") tokens.push("[cms-image]");
    else if (tag === "hr") tokens.push("[horizontalrule]");
    else if (tag === "br") tokens.push("[br]");
    n.childNodes.forEach(walk);
  };
  walk(doc.body);
  return oracleOf(tokens);
};
/** The data's wrappers: its nodes with text and leaves named by kind. */
export const shapeOf = (lexical: string | undefined) => {
  if (lexical === undefined || lexical === "") return null;
  const walk = (n: JNode): string => {
    if (typeof n.text === "string") return "t";
    if (n.children === undefined) return n.type === "linebreak" ? "br" : n.type === "horizontalrule" ? "hr" : n.type === "cms-image" ? "img" : n.type;
    return `${n.type}(${n.children.map(walk).join(",")})`;
  };
  try { return (JSON.parse(lexical).nodes as JNode[]).map(walk).join(","); } catch { return null; }
};

// ---- placing ends ----
export type End =
  | { t: "text"; w: string; o: number }
  | { t: "before" | "after" | "lineBefore" | "lineAfter" | "start" | "end"; ty: string; n: number };

const $nth = (type: string, n: number) => {
  const found: LexicalNode[] = [];
  const walk = (node: LexicalNode) => {
    if (node.getType() === type) found.push(node);
    if ($isElementNode(node)) node.getChildren().forEach(walk);
  };
  walk($getRoot());
  return found[n];
};

const $setEnd = (point: { set: (k: string, o: number, t: "text" | "element") => void }, end: End) => {
  if (end.t === "text") {
    const node = $getRoot()
      .getAllTextNodes()
      .find((t) => t.getTextContent() === end.w);
    if (node === undefined) throw new Error(`no text ${end.w}`);
    point.set(node.getKey(), end.o, "text");
    return;
  }
  const node = $nth(end.ty, end.n);
  if (node === undefined) throw new Error(`no ${end.ty}#${end.n}`);
  if (end.t === "start") {
    point.set(node.getKey(), 0, "element");
    return;
  }
  if (end.t === "end") {
    point.set(node.getKey(), (node as ElementNode).getChildrenSize(), "element");
    return;
  }
  const parent = node.getParentOrThrow();
  const index = node.getIndexWithinParent();
  if (end.t === "lineAfter" || end.t === "lineBefore") {
    // the empty line beside the node where the build has one, else the container point
    const beside = end.t === "lineAfter" ? node.getNextSibling() : node.getPreviousSibling();
    if (
      beside !== null &&
      beside.getType() === "cms-line" &&
      (beside as ElementNode).getChildrenSize() === 0
    ) {
      point.set(beside.getKey(), 0, "element");
      return;
    }
  }
  const after = end.t === "after" || end.t === "lineAfter";
  point.set(parent.getKey(), index + (after ? 1 : 0), "element");
};

export const placeRange = async (anchor: End, focus: End) => {
  let error: string | null = null;
  await act(async () => {
    editorOf()!.update(() => {
      try {
        const range = $createRangeSelection();
        $setEnd(range.anchor, anchor);
        $setEnd(range.focus, focus);
        $setSelection(range);
      } catch (e) {
        error = String(e);
      }
    });
  });
  await settle();
  return error;
};

// ---- real input ----
export type Real =
  | { k: "keys"; click: [string, number?]; keys: string }
  | { k: "shiftclickImg"; click: [string, number?]; img: number; side: "left" | "right" }
  | { k: "mouse"; click: [string, number?]; to: [string, number?] }
  | { k: "selectAll"; click: [string, number?] };

export const realInput = async (real: Real) => {
  await clickInWord(real.click[0], real.click[1]);
  if (real.k === "keys") {
    await userEvent.keyboard(real.keys);
  } else if (real.k === "selectAll") {
    await userEvent.keyboard("{Control>}a{/Control}");
  } else if (real.k === "mouse") {
    await userEvent.keyboard("{Shift>}");
    await clickInWord(real.to[0], real.to[1]);
    await userEvent.keyboard("{/Shift}");
  } else {
    const img = editable()!.querySelectorAll("img")[real.img] as HTMLElement;
    await fontsLoaded(img);
    const box = img.getBoundingClientRect();
    await userEvent.keyboard("{Shift>}");
    await userEvent.click(img, {
      position: { x: real.side === "right" ? box.width - 1 : 1, y: box.height / 2 },
    } as never);
    await userEvent.keyboard("{/Shift}");
  }
  await settle();
};



const t = (w: string, o: number): End => ({ t: "text", w, o });
const after = (ty: string, n = 0): End => ({ t: "after", ty, n });
const before = (ty: string, n = 0): End => ({ t: "before", ty, n });
const lineAfter = (ty: string, n = 0): End => ({ t: "lineAfter", ty, n });
const lineBefore = (ty: string, n = 0): End => ({ t: "lineBefore", ty, n });
const end = (ty: string, n = 0): End => ({ t: "end", ty, n });
const start = (ty: string, n = 0): End => ({ t: "start", ty, n });

export type Case =
  | { id: string; html: string; anchor: End; focus: End }
  | { id: string; html: string; real: Real };

type Group = {
  name: string;
  html: string;
  ends: [string, End][];
  others: [string, End][];
  pairs?: [string, End, End][];
};

const Q = (w: string) => `<blockquote><p>${w}</p></blockquote>`;

const GROUPS: Group[] = [
  {
    name: "imgLineEnd-QTIQ",
    html: LI(`${Q("Q0w")}T1w${IMG}${Q("Q2w")}`),
    ends: [["afterImg", after("cms-image")]],
    others: [
      ["sameLine T1w@1", t("T1w", 1)],
      ["blockAfter Q2w@1", t("Q2w", 1)],
      ["blockBefore Q0w@1", t("Q0w", 1)],
      ["itemBefore Pw@1", t("Pw", 1)],
      ["itemAfter Nw@1", t("Nw", 1)],
    ],
  },
  {
    name: "imgLineEnd-TIQT",
    html: LI(`T0w${IMG}${Q("Q1w")}T2w`),
    ends: [["afterImg", after("cms-image")]],
    others: [
      ["sameLine T0w@1", t("T0w", 1)],
      ["otherLine T2w@1", t("T2w", 1)],
      ["block Q1w@1", t("Q1w", 1)],
      ["itemBefore Pw@1", t("Pw", 1)],
      ["itemAfter Nw@1", t("Nw", 1)],
    ],
  },
  {
    name: "imgLineEnd-TI",
    html: LI(`T0w${IMG}`),
    ends: [["afterImg", after("cms-image")], ["itemEnd", end("listitem", 1)]],
    others: [
      ["sameLine T0w@1", t("T0w", 1)],
      ["itemBefore Pw@1", t("Pw", 1)],
      ["itemAfter Nw@1", t("Nw", 1)],
    ],
  },
  {
    name: "imgLineStart-TQIT",
    html: LI(`T0w${Q("Q1w")}${IMG}T2w`),
    ends: [["beforeImg", before("cms-image")]],
    others: [
      ["sameLine T2w@1", t("T2w", 1)],
      ["otherLine T0w@1", t("T0w", 1)],
      ["block Q1w@1", t("Q1w", 1)],
      ["itemBefore Pw@1", t("Pw", 1)],
      ["itemAfter Nw@1", t("Nw", 1)],
    ],
    pairs: [["beforeImg..afterImg", before("cms-image"), after("cms-image")]],
  },
  {
    name: "imgLineStart-IT",
    html: LI(`${IMG}T1w`),
    ends: [["beforeImg", before("cms-image")], ["itemStart", start("listitem", 1)]],
    others: [
      ["sameLine T1w@1", t("T1w", 1)],
      ["itemBefore Pw@1", t("Pw", 1)],
      ["itemAfter Nw@1", t("Nw", 1)],
    ],
  },
  {
    name: "ruleEnd-TR",
    html: LI(`T0w<hr>`),
    ends: [
      ["afterRule", after("horizontalrule")],
      ["emptyLineAfterRule", lineAfter("horizontalrule")],
      ["itemEnd", end("listitem", 1)],
    ],
    others: [
      ["lineBefore T0w@1", t("T0w", 1)],
      ["itemBefore Pw@1", t("Pw", 1)],
      ["itemAfter Nw@1", t("Nw", 1)],
    ],
  },
  {
    name: "ruleEnd-QTR",
    html: LI(`${Q("Q0w")}T1w<hr>`),
    ends: [
      ["afterRule", after("horizontalrule")],
      ["emptyLineAfterRule", lineAfter("horizontalrule")],
    ],
    others: [
      ["lineBefore T1w@1", t("T1w", 1)],
      ["block Q0w@1", t("Q0w", 1)],
      ["itemAfter Nw@1", t("Nw", 1)],
    ],
  },
  {
    name: "ruleStart-RT",
    html: LI(`<hr>T1w`),
    ends: [
      ["beforeRule", before("horizontalrule")],
      ["emptyLineBeforeRule", lineBefore("horizontalrule")],
      ["itemStart", start("listitem", 1)],
    ],
    others: [
      ["lineAfter T1w@1", t("T1w", 1)],
      ["itemBefore Pw@1", t("Pw", 1)],
      ["itemAfter Nw@1", t("Nw", 1)],
    ],
    pairs: [["beforeRule..afterRule", before("horizontalrule"), after("horizontalrule")]],
  },
  {
    name: "ruleStart-RTQ",
    html: LI(`<hr>T1w${Q("Q2w")}`),
    ends: [
      ["beforeRule", before("horizontalrule")],
      ["emptyLineBeforeRule", lineBefore("horizontalrule")],
    ],
    others: [
      ["lineAfter T1w@1", t("T1w", 1)],
      ["block Q2w@1", t("Q2w", 1)],
      ["itemBefore Pw@1", t("Pw", 1)],
    ],
  },
  {
    name: "brOnly-TQB",
    html: LI(`T0w${Q("Q1w")}<br>`),
    ends: [
      ["beforeBreak", before("linebreak")],
      ["afterBreak", after("linebreak")],
    ],
    others: [
      ["otherLine T0w@1", t("T0w", 1)],
      ["block Q1w@1", t("Q1w", 1)],
      ["blockEnd Q1w@3", t("Q1w", 3)],
      ["itemBefore Pw@1", t("Pw", 1)],
      ["itemAfter Nw@1", t("Nw", 1)],
    ],
    pairs: [["beforeBreak..afterBreak", before("linebreak"), after("linebreak")]],
  },
  {
    name: "brOnly-QB-FS9",
    html: `<ul><li>${Q("Q0w")}<br></li><li>Iw</li></ul>`,
    ends: [
      ["beforeBreak", before("linebreak")],
      ["afterBreak", after("linebreak")],
    ],
    others: [
      ["blockEnd Q0w@3", t("Q0w", 3)],
      ["block Q0w@1", t("Q0w", 1)],
      ["itemAfter Iw@1", t("Iw", 1)],
    ],
  },
  {
    name: "quoteLine-QT",
    html: LI(`${Q("Q0w")}T1w${Q("Q2w")}T3w`),
    ends: [["afterQuote", after("quote", 0)]],
    others: [
      ["block Q0w@1", t("Q0w", 1)],
      ["sameLine T1w@1", t("T1w", 1)],
      ["otherLine T3w@1", t("T3w", 1)],
      ["blockAfter Q2w@1", t("Q2w", 1)],
      ["itemBefore Pw@1", t("Pw", 1)],
      ["itemAfter Nw@1", t("Nw", 1)],
    ],
    pairs: [["afterQuote..itemEnd", after("quote", 0), end("listitem", 1)]],
  },
  {
    name: "twoBlocks-TQQT",
    html: LI(`T0w${Q("Q1w")}${Q("Q2w")}T3w`),
    ends: [["betweenBlocks", after("quote", 0)]],
    others: [
      ["line T0w@1", t("T0w", 1)],
      ["blockBefore Q1w@1", t("Q1w", 1)],
      ["blockAfter Q2w@1", t("Q2w", 1)],
      ["line T3w@1", t("T3w", 1)],
      ["itemBefore Pw@1", t("Pw", 1)],
      ["itemAfter Nw@1", t("Nw", 1)],
    ],
    pairs: [["betweenBlocks..afterQuote2", after("quote", 0), after("quote", 1)]],
  },
];

export const LINED_CASES: Case[] = [];
for (const group of GROUPS) {
  for (const [en, e] of group.ends) {
    for (const [on, o] of group.others) {
      LINED_CASES.push({ id: `${group.name} | ${en} -> ${on}`, html: group.html, anchor: e, focus: o });
      LINED_CASES.push({ id: `${group.name} | ${on} -> ${en}`, html: group.html, anchor: o, focus: e });
    }
  }
  for (const [pn, a, b] of group.pairs ?? []) {
    LINED_CASES.push({ id: `${group.name} | pair ${pn}`, html: group.html, anchor: a, focus: b });
    LINED_CASES.push({ id: `${group.name} | pair-back ${pn}`, html: group.html, anchor: b, focus: a });
  }
}

const S = (n: number, key: string) => `{Shift>}${`{${key}}`.repeat(n)}{/Shift}`;
const LINED_DOC = `<ul><li>T0w${Q("Q1w")}T2w</li><li><hr>T3w</li><li>T4w${IMG}</li><li>T5w<br></li></ul><p>endw</p>`;
const REAL: [string, string, Real][] = [
  ["imgLineEnd-QTIQ", LI(`${Q("Q0w")}T1w${IMG}${Q("Q2w")}`), { k: "keys", click: ["Q2w", 1], keys: S(2, "ArrowLeft") }],
  ["imgLineEnd-QTIQ", LI(`${Q("Q0w")}T1w${IMG}${Q("Q2w")}`), { k: "keys", click: ["Q2w", 1], keys: S(3, "ArrowLeft") }],
  ["imgLineEnd-QTIQ", LI(`${Q("Q0w")}T1w${IMG}${Q("Q2w")}`), { k: "shiftclickImg", click: ["T1w", 1], img: 0, side: "right" }],
  ["imgLineEnd-QTIQ", LI(`${Q("Q0w")}T1w${IMG}${Q("Q2w")}`), { k: "shiftclickImg", click: ["Q2w", 1], img: 0, side: "right" }],
  ["imgLineEnd-QTIQ", LI(`${Q("Q0w")}T1w${IMG}${Q("Q2w")}`), { k: "keys", click: ["T1w", 1], keys: S(3, "ArrowRight") }],
  ["imgLineEnd-QTIQ", LI(`${Q("Q0w")}T1w${IMG}${Q("Q2w")}`), { k: "keys", click: ["T1w", 3], keys: S(1, "ArrowRight") }],
  ["imgLineEnd-TI", LI(`T0w${IMG}`), { k: "keys", click: ["Nw", 1], keys: S(2, "ArrowLeft") }],
  ["imgLineEnd-TI", LI(`T0w${IMG}`), { k: "keys", click: ["T0w", 1], keys: "{Shift>}{End}{/Shift}" }],
  ["imgLineStart-TQIT", LI(`T0w${Q("Q1w")}${IMG}T2w`), { k: "keys", click: ["T2w", 1], keys: S(2, "ArrowLeft") }],
  ["imgLineStart-TQIT", LI(`T0w${Q("Q1w")}${IMG}T2w`), { k: "keys", click: ["T2w", 1], keys: S(3, "ArrowLeft") }],
  ["imgLineStart-TQIT", LI(`T0w${Q("Q1w")}${IMG}T2w`), { k: "shiftclickImg", click: ["T0w", 1], img: 0, side: "left" }],
  ["imgLineStart-TQIT", LI(`T0w${Q("Q1w")}${IMG}T2w`), { k: "keys", click: ["Q1w", 1], keys: S(3, "ArrowRight") }],
  ["imgLineStart-IT", LI(`${IMG}T1w`), { k: "keys", click: ["T1w", 1], keys: "{Shift>}{Home}{/Shift}" }],
  ["brOnly-TQB", LI(`T0w${Q("Q1w")}<br>`), { k: "keys", click: ["Q1w", 3], keys: S(1, "ArrowRight") }],
  ["brOnly-TQB", LI(`T0w${Q("Q1w")}<br>`), { k: "keys", click: ["Q1w", 3], keys: S(2, "ArrowRight") }],
  ["brOnly-TQB", LI(`T0w${Q("Q1w")}<br>`), { k: "keys", click: ["T0w", 1], keys: S(2, "ArrowDown") }],
  ["brOnly-TQB", LI(`T0w${Q("Q1w")}<br>`), { k: "keys", click: ["Nw", 1], keys: S(2, "ArrowLeft") }],
  ["brOnly-QB-FS9 alone", `<ul><li>${Q("Q0w")}<br></li></ul>`, { k: "keys", click: ["Q0w"], keys: S(1, "ArrowRight") }],
  ["brOnly-QB-FS9 next", `<ul><li>${Q("Q0w")}<br></li><li>Iw</li></ul>`, { k: "keys", click: ["Q0w"], keys: S(1, "ArrowRight") }],
  ["ruleEnd-TR", LI(`T0w<hr>`), { k: "keys", click: ["Nw", 1], keys: S(2, "ArrowLeft") }],
  ["ruleEnd-TR", LI(`T0w<hr>`), { k: "keys", click: ["Nw", 1], keys: S(3, "ArrowLeft") }],
  ["ruleEnd-TR", LI(`T0w<hr>`), { k: "keys", click: ["T0w", 1], keys: S(1, "ArrowDown") }],
  ["ruleEnd-TR", LI(`T0w<hr>`), { k: "keys", click: ["T0w", 1], keys: S(2, "ArrowDown") }],
  ["ruleEnd-TR", LI(`T0w<hr>`), { k: "keys", click: ["T0w", 3], keys: S(2, "ArrowRight") }],
  ["ruleStart-RT", LI(`<hr>T1w`), { k: "keys", click: ["T1w", 1], keys: S(2, "ArrowLeft") }],
  ["ruleStart-RT", LI(`<hr>T1w`), { k: "keys", click: ["T1w", 1], keys: S(3, "ArrowLeft") }],
  ["ruleStart-RT", LI(`<hr>T1w`), { k: "keys", click: ["Pw", 1], keys: S(1, "ArrowDown") }],
  ["ruleStart-RT", LI(`<hr>T1w`), { k: "keys", click: ["Pw", 2], keys: S(2, "ArrowRight") }],
  ["quoteLine-QT", LI(`${Q("Q0w")}T1w${Q("Q2w")}T3w`), { k: "keys", click: ["Q0w", 3], keys: S(1, "ArrowRight") }],
  ["quoteLine-QT", LI(`${Q("Q0w")}T1w${Q("Q2w")}T3w`), { k: "keys", click: ["T1w", 0], keys: S(1, "ArrowLeft") }],
  ["twoBlocks-TQQT", LI(`T0w${Q("Q1w")}${Q("Q2w")}T3w`), { k: "keys", click: ["Q1w", 3], keys: S(1, "ArrowRight") }],
  ["twoBlocks-TQQT", LI(`T0w${Q("Q1w")}${Q("Q2w")}T3w`), { k: "keys", click: ["Q2w", 0], keys: S(1, "ArrowLeft") }],
  ["selectAll lined doc", LINED_DOC, { k: "selectAll", click: ["T3w", 1] }],
  ["selectAll imgLineEnd", LI(`${Q("Q0w")}T1w${IMG}${Q("Q2w")}`), { k: "selectAll", click: ["T1w", 1] }],
  ["selectAll ruleEnd", `<ul><li>T0w<hr></li></ul>`, { k: "selectAll", click: ["T0w", 1] }],
  ["selectAll ruleStart", `<ul><li><hr>T1w</li></ul>`, { k: "selectAll", click: ["T1w", 1] }],
  ["selectAll brOnly", `<ul><li>T0w${Q("Q1w")}<br></li></ul>`, { k: "selectAll", click: ["T0w", 1] }],
  ["selectAll code", `<ul><li>T0w<pre><code>C1w</code></pre>T2w</li></ul>`, { k: "selectAll", click: ["T0w", 1] }],
  ["mouse imgLineEnd T1w..Q2w", LI(`${Q("Q0w")}T1w${IMG}${Q("Q2w")}`), { k: "mouse", click: ["T1w", 1], to: ["Q2w", 1] }],
];
let r = 0;
for (const [name, html, real] of REAL) {
  r += 1;
  LINED_CASES.push({ id: `real${String(r).padStart(2, "0")} ${name} | ${JSON.stringify(real)}`, html, real });
}



type UnlinedGroup = { name: string; html: string; ends: [string, End][]; others: [string, End][]; pairs?: [string, End, End][] };
const UNLINED_GROUPS: UnlinedGroup[] = [
  {
    name: "para-endsImg",
    html: `<p>A0w${IMG}</p><p>B1w</p>`,
    ends: [["afterImg", after("cms-image")]],
    others: [["sameP A0w@1", t("A0w", 1)], ["nextP B1w@1", t("B1w", 1)]],
    pairs: [["beforeImg..afterImg", before("cms-image"), after("cms-image")]],
  },
  {
    name: "para-startsImg",
    html: `<p>A0w</p><p>${IMG}B1w</p>`,
    ends: [["beforeImg", before("cms-image")]],
    others: [["prevP A0w@1", t("A0w", 1)], ["sameP B1w@1", t("B1w", 1)]],
    pairs: [["beforeImg..afterImg", before("cms-image"), after("cms-image")]],
  },
  {
    name: "para-brOnly",
    html: `<p>A0w</p><p><br></p><p>B2w</p>`,
    ends: [["beforeBreak", before("linebreak")], ["afterBreak", after("linebreak")]],
    others: [["prevP A0w@1", t("A0w", 1)], ["nextP B2w@1", t("B2w", 1)]],
    pairs: [["beforeBreak..afterBreak", before("linebreak"), after("linebreak")]],
  },
  {
    name: "rootRule",
    html: `<p>A0w</p><hr><p>B2w</p>`,
    ends: [["beforeRule", before("horizontalrule")], ["afterRule", after("horizontalrule")]],
    others: [["prevP A0w@1", t("A0w", 1)], ["nextP B2w@1", t("B2w", 1)]],
    pairs: [["beforeRule..afterRule", before("horizontalrule"), after("horizontalrule")]],
  },
  {
    name: "item-endsImg",
    html: `<ul><li>Pw</li><li>U0w${IMG}</li><li>Nw</li></ul>`,
    ends: [["afterImg", after("cms-image")]],
    others: [["sameItem U0w@1", t("U0w", 1)], ["itemAfter Nw@1", t("Nw", 1)]],
  },
  {
    name: "item-startsImg",
    html: `<ul><li>Pw</li><li>${IMG}U1w</li><li>Nw</li></ul>`,
    ends: [["beforeImg", before("cms-image")], ["itemStart", start("listitem", 1)]],
    others: [["sameItem U1w@1", t("U1w", 1)], ["itemBefore Pw@1", t("Pw", 1)]],
  },
];
export const UNLINED_CASES: Case[] = [];
for (const group of UNLINED_GROUPS) {
  for (const [en, e] of group.ends) {
    for (const [on, o] of group.others) {
      UNLINED_CASES.push({ id: `${group.name} | ${en} -> ${on}`, html: group.html, anchor: e, focus: o });
      UNLINED_CASES.push({ id: `${group.name} | ${on} -> ${en}`, html: group.html, anchor: o, focus: e });
    }
  }
  for (const [pn, a, b] of group.pairs ?? []) {
    UNLINED_CASES.push({ id: `${group.name} | pair ${pn}`, html: group.html, anchor: a, focus: b });
    UNLINED_CASES.push({ id: `${group.name} | pair-back ${pn}`, html: group.html, anchor: b, focus: a });
  }
}
const UNLINED_REAL: [string, string, Real][] = [
  ["para-startsImg Shift+Home", `<p>A0w</p><p>${IMG}B1w</p>`, { k: "keys", click: ["B1w", 1], keys: "{Shift>}{Home}{/Shift}" }],
  ["para-endsImg Shift+End", `<p>A0w${IMG}</p><p>B1w</p>`, { k: "keys", click: ["A0w", 1], keys: "{Shift>}{End}{/Shift}" }],
  ["item-startsImg Shift+Home", `<ul><li>Pw</li><li>${IMG}U1w</li><li>Nw</li></ul>`, { k: "keys", click: ["U1w", 1], keys: "{Shift>}{Home}{/Shift}" }],
  ["item-endsImg Shift+End", `<ul><li>Pw</li><li>U0w${IMG}</li><li>Nw</li></ul>`, { k: "keys", click: ["U0w", 1], keys: "{Shift>}{End}{/Shift}" }],
  ["item-startsImg Shift+Home at 3", `<ul><li>Pw</li><li>${IMG}U1w</li><li>Nw</li></ul>`, { k: "keys", click: ["U1w", 3], keys: "{Shift>}{Home}{/Shift}" }],
  ["item-endsImg Shift+End at 0", `<ul><li>Pw</li><li>U0w${IMG}</li><li>Nw</li></ul>`, { k: "keys", click: ["U0w", 0], keys: "{Shift>}{End}{/Shift}" }],
  ["selectAll para img rule", `<p>A0w${IMG}</p><hr><p>B2w</p>`, { k: "selectAll", click: ["A0w", 1] }],
  ["selectAll para startsImg", `<p>${IMG}A1w</p>`, { k: "selectAll", click: ["A1w", 1] }],
  ["selectAll item endsImg", `<ul><li>U0w${IMG}</li></ul>`, { k: "selectAll", click: ["U0w", 1] }],
  ["selectAll br only", `<p>A0w</p><p><br></p>`, { k: "selectAll", click: ["A0w", 1] }],
];
let u = 0;
for (const [name, html, real] of UNLINED_REAL) {
  u += 1;
  UNLINED_CASES.push({ id: `real${String(u).padStart(2, "0")} ${name} | ${JSON.stringify(real)}`, html, real });
}

