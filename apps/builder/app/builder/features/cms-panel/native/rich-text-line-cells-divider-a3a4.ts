// The cells of `base-divider-a3a4` (Task 5 Step 6; check 2, A3 and A4):
// Divider in a nested item of a lined item (A3: QL, HL, CL, TQL at the
// nested text's start and end) and over a range across the whole item (A4:
// QT, HT, CT, BQT, QTR), both of which keep the head's write until R2. It
// imports nothing from the line modules, so the same file records the
// fixture at fork main.
import { act } from "react-dom/test-utils";
import { expect } from "vitest";
import {
  $createRangeSelection,
  $getRoot,
  $isElementNode,
  $isTextNode,
  $setSelection,
  type ElementNode,
  type LexicalNode,
} from "lexical";
import { click, editable, editorOf, settle } from "./rich-text-test-harness";
import {
  $baselinePoint,
  at,
  button,
  LI,
  range,
  type Step,
} from "./rich-text-line-test-kit";

export type DividerCell = {
  id: string;
  stored: string;
  place: Step;
  action: Step;
};

const QUOTE = (text: string) => `<blockquote><p>${text}</p></blockquote>`;
const NESTED = (text: string) => `<ul><li>${text}</li></ul>`;

const $all = () => {
  const out: LexicalNode[] = [];
  const walk = (node: LexicalNode) => {
    out.push(node);
    if ($isElementNode(node)) {
      node.getChildren().forEach(walk);
    }
  };
  walk($getRoot());
  return out;
};

/**
 * From the middle item's start (baseline offset 0, before its leading line
 * break) to the end of `word`, set directly after a real click.
 */
const fromItemStart =
  (word: string): Step =>
  async () => {
    await click(editable());
    await act(async () => {
      editorOf()!.update(() => {
        const item = $all().filter((node) => node.getType() === "listitem")[1];
        expect(item, "the middle item").toBeDefined();
        const start = $baselinePoint(item as ElementNode, 0);
        const text = $all().find(
          (node) => $isTextNode(node) && node.getTextContent() === word
        );
        expect(text, word).toBeDefined();
        const selection = $createRangeSelection();
        selection.anchor.set(start.key, start.offset, "element");
        selection.focus.set(text!.getKey(), text!.getTextContentSize(), "text");
        $setSelection(selection);
      });
    });
    await settle();
  };

const divider = button("Divider");

export const dividerA3A4Cells = (): DividerCell[] => {
  const cells: DividerCell[] = [];
  // A3: the nested item's text, its start and its end
  for (const [name, middle, word] of [
    ["QL", `${QUOTE("Q0w")}${NESTED("L1w")}`, "L1w"],
    ["HL", `<h3>H0w</h3>${NESTED("L1w")}`, "L1w"],
    ["CL", `<pre><code>C0w</code></pre>${NESTED("L1w")}`, "L1w"],
    ["TQL", `T0w${QUOTE("Q1w")}${NESTED("L2w")}`, "L2w"],
  ] as const) {
    cells.push({
      id: `A3 ${name} ${word}@0`,
      stored: LI(middle),
      place: at(word, 0),
      action: divider,
    });
    cells.push({
      id: `A3 ${name} ${word}@end`,
      stored: LI(middle),
      place: at(word),
      action: divider,
    });
  }
  // A4: a range over the whole item
  for (const [name, middle, from] of [
    ["QT", `${QUOTE("Q0w")}T1w`, "Q0w"],
    ["HT", "<h3>H0w</h3>T1w", "H0w"],
    ["CT", "<pre><code>C0w</code></pre>T1w", "C0w"],
    ["QTR", `${QUOTE("Q0w")}T1w<hr>`, "Q0w"],
  ] as const) {
    cells.push({
      id: `A4 ${name} whole`,
      stored: LI(middle),
      place: range(from, 0, "T1w", 3),
      action: divider,
    });
  }
  cells.push({
    id: "A4 BQT whole",
    stored: LI(`<br>${QUOTE("Q1w")}T2w`),
    place: fromItemStart("T2w"),
    action: divider,
  });
  return cells;
};
