// The cells of `base-enter-range-root` (Task 5 Step 6; T11.4, 16.8): Enter
// and Shift+Enter over a range with an end on the root of
// `<p>A0w</p><hr><p>B2w</p>`; and of `base-enter-heading` (T10.4): the
// over-reach cells of the prototype's "Enter in a heading's plain text
// stays Lexical's" (`rich-text-line-enter.test.tsx` at `451f20f04`, table
// `PLAIN_WRITES`). It imports nothing from the line modules, so the same
// file records the fixtures at fork main.
import { act } from "react-dom/test-utils";
import { expect } from "vitest";
import { userEvent } from "@vitest/browser/context";
import {
  $createRangeSelection,
  $getRoot,
  $isElementNode,
  $setSelection,
  type LexicalNode,
} from "lexical";
import { click, editable, editorOf, settle } from "./rich-text-test-harness";
import {
  at,
  enter,
  LI,
  shiftEnter,
  type Step,
} from "./rich-text-line-test-kit";

/**
 * An end of a range: a text point in `word`, the root's start or end, or
 * the point directly before or after the root's rule.
 */
export type End =
  | { word: string; offset: number }
  | "rootStart"
  | "rootEnd"
  | "beforeRule"
  | "afterRule";

const $order = () => {
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

const $endPoint = (end: End) => {
  const root = $getRoot();
  if (end === "rootStart" || end === "rootEnd") {
    return {
      key: root.getKey(),
      offset: end === "rootStart" ? 0 : root.getChildrenSize(),
      type: "element" as const,
    };
  }
  if (end === "beforeRule" || end === "afterRule") {
    const rule = root
      .getChildren()
      .find((child) => child.getType() === "horizontalrule");
    expect(rule, "the root's rule").toBeDefined();
    return {
      key: root.getKey(),
      offset: rule!.getIndexWithinParent() + (end === "afterRule" ? 1 : 0),
      type: "element" as const,
    };
  }
  const text = $order().find(
    (node) => node.getType() === "text" && node.getTextContent() === end.word
  );
  expect(text, end.word).toBeDefined();
  return { key: text!.getKey(), offset: end.offset, type: "text" as const };
};

/** A range from `anchor` to `focus`, set directly after a real click. */
export const span =
  (anchor: End, focus: End): Step =>
  async () => {
    await click(editable()!);
    await act(async () => {
      editorOf()!.update(() => {
        const from = $endPoint(anchor);
        const to = $endPoint(focus);
        const selection = $createRangeSelection();
        selection.anchor.set(from.key, from.offset, from.type);
        selection.focus.set(to.key, to.offset, to.type);
        $setSelection(selection);
      });
    });
    await settle();
  };

export const ROOT_RULE = "<p>A0w</p><hr><p>B2w</p>";

const NAMES: Record<string, End> = {
  root0: "rootStart",
  rootEnd: "rootEnd",
  bR: "beforeRule",
  aR: "afterRule",
  a1: { word: "A0w", offset: 1 },
  b1: { word: "B2w", offset: 1 },
  b3: { word: "B2w", offset: 3 },
};

/**
 * The cells, each `<anchor>-><focus> <key>`: every range whose anchor is
 * on the root directly before or after the rule (check 5 counts 19 cells
 * and does not list them; these 24 hold the range it names, from the
 * point before the rule to `B2w` after "B").
 */
const RANGES = (["bR", "aR"] as const).flatMap((from) =>
  ["root0", "rootEnd", from === "bR" ? "aR" : "bR", "a1", "b1", "b3"].flatMap(
    (to) =>
      (["Enter", "Shift+Enter"] as const).map((key) => [from, to, key] as const)
  )
);

export type EnterRangeRootCell = {
  id: string;
  stored: string;
  anchor: End;
  focus: End;
  key: "Enter" | "Shift+Enter";
  place: Step;
  action: Step;
};

export const enterRangeRootCells = (
  ranges: ReadonlyArray<
    readonly [string, string, "Enter" | "Shift+Enter"]
  > = RANGES
): EnterRangeRootCell[] =>
  ranges.map(([from, to, key]) => ({
    id: `${from}->${to} ${key}`,
    stored: ROOT_RULE,
    anchor: NAMES[from],
    focus: NAMES[to],
    key,
    place: span(NAMES[from], NAMES[to]),
    action: key === "Enter" ? enter : shiftEnter,
  }));

/** Every candidate range of the pool the 19 were chosen from. */
export const enterRangeRootPool = () => {
  const names = Object.keys(NAMES);
  const rootEnds = new Set(["root0", "rootEnd", "bR", "aR"]);
  const pool: Array<readonly [string, string, "Enter" | "Shift+Enter"]> = [];
  for (const from of names) {
    for (const to of names) {
      if (from === to || (!rootEnds.has(from) && !rootEnds.has(to))) {
        continue;
      }
      pool.push([from, to, "Enter"], [from, to, "Shift+Enter"]);
    }
  }
  return enterRangeRootCells(pool);
};

/** The heading shapes of the prototype's Enter tests. */
export const headingShape = (context: string, x: string) =>
  context === "ordinary"
    ? `<p>T0w</p><h3>${x}</h3><p>T1w</p>`
    : LI(`${context === "lineLed" ? "T9w" : ""}<h3>${x}</h3>T1w`);

/** A caret in the text `word` at `offset`: set directly, clicked, or clicked after it and ArrowLeft. */
export const inText =
  (word: string, offset: number, how: string): Step =>
  async () => {
    if (how === "structure") {
      await click(editable()!);
      await act(async () => {
        editorOf()!.update(() => {
          const text = $order().find(
            (node) =>
              node.getType() === "text" && node.getTextContent() === word
          );
          expect(text, word).toBeDefined();
          const selection = $createRangeSelection();
          selection.anchor.set(text!.getKey(), offset, "text");
          selection.focus.set(text!.getKey(), offset, "text");
          $setSelection(selection);
        });
      });
      await settle();
    } else if (how === "click") {
      await at(word, offset)();
    } else {
      await at(word, offset + 1)();
      await userEvent.keyboard("{ArrowLeft}");
      await settle();
    }
  };

export type EnterHeadingPlainCell = {
  id: string;
  stored: string;
  place: Step;
  action: Step;
};

/** The 12 over-reach cells: Enter where Lexical reads the caret right. */
export const enterHeadingPlainCells = (): EnterHeadingPlainCell[] =>
  (["plain middle", "text end"] as const).flatMap((where) =>
    (["blockLed", "lineLed", "ordinary"] as const).flatMap((context) =>
      (["click", "structure"] as const).map((how) => ({
        id: `${where} ${context} ${how}`,
        stored: headingShape(context, "AwBw"),
        place: inText("AwBw", where === "plain middle" ? 2 : 4, how),
        action: enter,
      }))
    )
  );
