// The cells of `base-paste-node` (Task 5 Step 6; check 3, 14.8; T10.8): a
// paste with a rule node-selected in a lined item, the 213 cells of the
// prototype's describe "14.8: a paste with a rule node-selected in a lined
// item" (`rich-text-line-round14.test.tsx` at `451f20f04`: `P_CELLS` 56,
// `P_CELLS_MORE` 48, their arrow copies 77, `P_CELLS_LAST` 32). Each cell
// also names the same paste at the point directly after the last selected
// rule (D15, 5.4: in an item that starts with a block the paste runs at
// the caret D18 gives that point, and the selected rules then go).
// It imports nothing from the line modules, so the same file records the
// fixture at fork main.
import { act } from "react-dom/test-utils";
import { expect } from "vitest";
import { userEvent } from "@vitest/browser/context";
import {
  $createNodeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $setSelection,
  type LexicalNode,
} from "lexical";
import {
  at,
  beside,
  copy,
  keys,
  LI,
  pasteClip,
  pasteHtml,
  pasteText,
  type Step,
  then,
} from "./rich-text-line-test-kit";
import { editable, editorOf, settle } from "./rich-text-test-harness";

const Q = (word: string) => `<blockquote><p>${word}</p></blockquote>`;

type Shape = {
  stored: string;
  /** The text right after the rule, for the arrow's start (at its offset 0). */
  after: string;
};

const D2 = (middle: string) =>
  `<ul><li>Pw<ul><li>Aw</li><li>${middle}</li><li>Zw</li></ul></li><li>Nw</li></ul>`;
const OL = (middle: string) =>
  `<ol><li>Pw</li><li>${middle}</li><li>Nw</li></ol>`;

export const PASTE_NODE_SHAPES: Record<string, Shape> = {
  QR: { stored: LI(`${Q("Q0w")}<hr>`), after: "Nw" },
  QRT: { stored: LI(`${Q("Q0w")}<hr>T2w`), after: "T2w" },
  QQR: { stored: LI(`${Q("Q0w")}${Q("Q1w")}<hr>`), after: "Nw" },
  QRB: { stored: LI(`${Q("Q0w")}<hr><br>`), after: "Nw" },
  QRL: { stored: LI(`${Q("Q0w")}<hr><ul><li>L2w</li></ul>`), after: "L2w" },
  QRQ: { stored: LI(`${Q("Q0w")}<hr>${Q("Q2w")}`), after: "Q2w" },
  QRR: { stored: LI(`${Q("Q0w")}<hr><hr>`), after: "Nw" },
  RQR: { stored: LI(`<hr>${Q("Q1w")}<hr>`), after: "Nw" },
  QRTQ: { stored: LI(`${Q("Q0w")}<hr>T2w${Q("Q3w")}`), after: "T2w" },
  QRd2: { stored: D2(`${Q("Q0w")}<hr>`), after: "Zw" },
  QRol: { stored: OL(`${Q("Q0w")}<hr>`), after: "Nw" },
  XRY: { stored: LI("xq<hr>yq"), after: "yq" },
};
export type PasteKind =
  | "p1"
  | "p2"
  | "list"
  | "emptyP"
  | "heading"
  | "bold"
  | "plain"
  | "plain2"
  | "own";

const PASTES: Record<Exclude<PasteKind, "own">, Step> = {
  p1: pasteHtml("<p>Aq</p>", "Aq"),
  p2: pasteHtml("<p>Aq</p><p>Bq</p>", "Aq\nBq"),
  list: pasteHtml("<ul><li>Aq</li></ul>", "Aq"),
  emptyP: pasteHtml("<p></p>", ""),
  heading: pasteHtml("<h3>Hq</h3>", "Hq"),
  bold: pasteHtml("<b>Bq</b>", "Bq"),
  plain: pasteText("Aq"),
  plain2: pasteText("Aq\nBq"),
};

export type Way = "click" | "arrow" | "two";

const ruleCount = () =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      return $isNodeSelection(selection) ? selection.getNodes().length : 0;
    });

/** The rule selected by a click, by arrows from the text after it, or both by code. */
export const selectRule =
  (shape: string, way: Way): Step =>
  async () => {
    if (way === "click") {
      await userEvent.click(editable()!.querySelector("hr")!);
      await settle();
    } else if (way === "arrow") {
      await at(PASTE_NODE_SHAPES[shape].after, 0)();
      for (let press = 0; press < 4 && ruleCount() === 0; press += 1) {
        await keys("{ArrowLeft}")();
      }
    } else {
      await at(shape === "RQR" ? "Q1w" : "Q0w")();
      await act(async () => {
        editorOf()!.update(() => {
          const selection = $createNodeSelection();
          const walk = (node: LexicalNode) => {
            if (node.getType() === "horizontalrule") {
              selection.add(node.getKey());
            }
            if ($isElementNode(node)) {
              node.getChildren().forEach(walk);
            }
          };
          walk($getRoot());
          $setSelection(selection);
        });
      });
      await settle();
    }
    expect(ruleCount(), "rules selected").toBe(way === "two" ? 2 : 1);
  };

/** The field's own nodes: a real copy of the first item's text. */
const copyOwn: Step = then(at("Pw", 0), keys("{Shift>}{End}{/Shift}"), copy);

export type PasteNodeCell = {
  id: string;
  shape: string;
  way: Way;
  kind: PasteKind;
  stored: string;
  place: Step;
  action: Step;
  /**
   * The same paste at the point directly after the last selected rule, on
   * the same shape: its write with the selected rules taken out is the
   * write of the paste over the selection (D15, 5.4).
   */
  atPoint: { stored: string; place: Step; action: Step };
  /** Which of the item's rules the selection holds. */
  rules: "first" | "last" | "all";
  /** The item starts with a block (every shape but XRY). */
  blockLed: boolean;
};

/** `html` with the selected rules taken out. */
export const withoutSelectedRules = (
  html: string,
  rules: PasteNodeCell["rules"]
) => {
  const rule = "<hr />";
  if (rules === "all") {
    return html.split(rule).join("");
  }
  const at = rules === "first" ? html.indexOf(rule) : html.lastIndexOf(rule);
  return at === -1 ? html : html.slice(0, at) + html.slice(at + rule.length);
};

const cell = (shape: string, way: Way, kind: PasteKind): PasteNodeCell => {
  const { stored } = PASTE_NODE_SHAPES[shape];
  const action = kind === "own" ? pasteClip : PASTES[kind];
  const rules = way === "click" ? "first" : way === "arrow" ? "last" : "all";
  const point = beside("horizontalrule", "after", { last: rules !== "first" });
  return {
    id: `${shape}|${way}|${kind}`,
    shape,
    way,
    kind,
    stored,
    place:
      kind === "own"
        ? then(copyOwn, selectRule(shape, way))
        : selectRule(shape, way),
    action,
    atPoint: {
      stored,
      place: kind === "own" ? then(copyOwn, point) : point,
      action,
    },
    rules,
    blockLed: shape !== "XRY",
  };
};
const SHAPES_FIRST = [
  "QQR",
  "QR",
  "QRB",
  "QRL",
  "QRQ",
  "QRR",
  "QRT",
  "QRTQ",
  "QRd2",
  "QRol",
  "RQR",
];
const KINDS_FIRST: PasteKind[] = ["emptyP", "list", "own", "p1", "p2"];
const KINDS_MORE: PasteKind[] = ["heading", "bold", "plain", "plain2"];
const SHAPES_MORE = [...SHAPES_FIRST, "XRY"];

/** `P_CELLS`: 56. */
const first: PasteNodeCell[] = [
  ...SHAPES_FIRST.flatMap((shape) =>
    KINDS_FIRST.map((kind) => cell(shape, "click", kind))
  ),
  cell("XRY", "click", "emptyP"),
];
/** `P_CELLS_MORE`: 48. */
const more: PasteNodeCell[] = SHAPES_MORE.flatMap((shape) =>
  KINDS_MORE.map((kind) => cell(shape, "click", kind))
);
/** Their arrow copies, but own nodes and QRR and RQR: 77. */
const arrows: PasteNodeCell[] = [...first, ...more]
  .filter(
    ({ shape, kind }) => kind !== "own" && shape !== "QRR" && shape !== "RQR"
  )
  .map(({ shape, kind }) => cell(shape, "arrow", kind));
/** `P_CELLS_LAST`: QRR and RQR, the last rule by an arrow, or both: 32. */
const last: PasteNodeCell[] = ["QRR", "RQR"].flatMap((shape) =>
  (["arrow", "two"] as const).flatMap((way) =>
    (
      [
        "p1",
        "p2",
        "list",
        "emptyP",
        "heading",
        "bold",
        "plain",
        "plain2",
      ] as const
    ).map((kind) => cell(shape, way, kind))
  )
);

export const pasteNodeCells: PasteNodeCell[] = [
  ...first,
  ...more,
  ...arrows,
  ...last,
];
