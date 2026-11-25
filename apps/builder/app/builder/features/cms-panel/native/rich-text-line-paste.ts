// Paste routing into lines (D4, D14).
import { $isCodeNode } from "@lexical/code";
import { $isListItemNode } from "@lexical/list";
import { $findMatchingParent } from "@lexical/utils";
import {
  $addUpdateTag,
  $createTabNode,
  $createTextNode,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  type LexicalNode,
  type PointType,
  type RangeSelection,
} from "lexical";
import {
  $createCmsLineNode,
  $isCmsLineNode,
  isLinedContainer,
} from "./rich-text-line-node";
import { $unwrapLines } from "./rich-text-line-normalise";
import { $removeRangeWithBreak } from "./rich-text-line-removal";

const isBlock = (node: LexicalNode) =>
  ($isElementNode(node) || $isDecoratorNode(node)) && node.isInline() === false;

const inLined = (point: PointType) =>
  $findMatchingParent(point.getNode(), (node) => isLinedContainer(node)) !==
  null;

const endsOf = (selection: RangeSelection) => ({
  start: selection.isBackward() ? selection.focus : selection.anchor,
  end: selection.isBackward() ? selection.anchor : selection.focus,
});

/**
 * V2, D5, D14: a range removed before the paste, in the paste's update; the
 * paste then runs at the caret that removal leaves (undefined: not this
 * branch).
 * - D14 (check 2, F; V2): a range with its start in a lined container is
 *   removed first, as 5.4 says, with D3's and D5's joins. The head's path
 *   never runs over such a range.
 * - D5: a block paste over a range from the item before into a block-led
 *   lined item: the removal first, with D5's join.
 */
const $removeRangeBeforeBlockPaste = (
  nodes: LexicalNode[],
  selection: RangeSelection
): LexicalNode[] | undefined => {
  if (selection.isCollapsed()) {
    return;
  }
  const { start, end } = endsOf(selection);
  if (inLined(start)) {
    $removeRangeWithBreak(selection);
    return selection.isCollapsed() ? $intoLine(nodes, selection) : nodes;
  }
  const line = $findMatchingParent(start.getNode(), $isCmsLineNode);
  if (line !== null && line.getParent() !== null) {
    return;
  }
  const endContainer =
    $findMatchingParent(end.getNode(), $isCmsLineNode)?.getParent() ?? null;
  const before = endContainer?.getPreviousSibling() ?? null;
  const startNode = start.getNode();
  if (
    $isListItemNode(endContainer) &&
    $isCmsLineNode(endContainer.getFirstChild()) === false &&
    $isListItemNode(before) &&
    (before.is(startNode) || before.isParentOf(startNode)) &&
    nodes.some(isBlock)
  ) {
    selection.removeText();
    return nodes;
  }
};

/**
 * V3: a range that starts outside every line and ends in one: the end's
 * container takes the head's path, its lines unwrapped (D14's third case;
 * undefined: not this branch).
 */
const $unwrapEndContainer = (
  nodes: LexicalNode[],
  selection: RangeSelection
): LexicalNode[] | undefined => {
  const { start, end } = endsOf(selection);
  const line = $findMatchingParent(start.getNode(), $isCmsLineNode);
  if ((line !== null && line.getParent() !== null) || selection.isCollapsed()) {
    return;
  }
  const endContainer =
    $findMatchingParent(end.getNode(), $isCmsLineNode)?.getParent() ?? null;
  if (endContainer !== null) {
    $unwrapLines(endContainer.getChildren());
  }
  return nodes;
};

/**
 * V2, V4: a line in a quote, or a range from a line: the head's path over
 * the containers' own text, their lines unwrapped (D4, D14; undefined: not
 * this branch).
 */
const $unwrapForQuoteLineOrRange = (
  nodes: LexicalNode[],
  selection: RangeSelection
): LexicalNode[] | undefined => {
  const { start, end } = endsOf(selection);
  const item = $findMatchingParent(
    start.getNode(),
    $isCmsLineNode
  )?.getParent();
  if (
    item === null ||
    item === undefined ||
    ($isListItemNode(item) && selection.isCollapsed())
  ) {
    return;
  }
  $unwrapLines(item.getChildren());
  const endContainer =
    $findMatchingParent(end.getNode(), $isCmsLineNode)?.getParent() ?? null;
  if (endContainer !== null && endContainer.is(item) === false) {
    $unwrapLines(endContainer.getChildren());
  }
  return nodes;
};

/**
 * A paste at a caret in a line of a list item gives what the same paste
 * gives in the item's own text: one paragraph goes in as its inline
 * content (5.8, M4), one code block as inline code (5.8, M5), and blocks
 * into the item with its lines unwrapped meanwhile (D4, D14: the head's
 * C7 result for an item's text, accepted until R3).
 */
const $pasteIntoItemLine = (
  nodes: LexicalNode[],
  selection: RangeSelection
) => {
  if (nodes.length === 1 && $isParagraphNode(nodes[0])) {
    return nodes[0].getChildren();
  }
  if (nodes.length === 1 && $isCodeNode(nodes[0])) {
    const text = $createTextNode(nodes[0].getTextContent());
    text.toggleFormat("code");
    return [text];
  }
  if (nodes.some(isBlock)) {
    const start = selection.isBackward() ? selection.focus : selection.anchor;
    const item = $findMatchingParent(
      start.getNode(),
      $isCmsLineNode
    )?.getParent();
    if (item !== null && item !== undefined) {
      $unwrapLines(item.getChildren());
    }
  }
  return nodes;
};

/**
 * The nodes a paste or drop inserts (`SELECTION_INSERT_CLIPBOARD_NODES_COMMAND`),
 * routed by where the selection starts: the four branches in their order
 * (CI 3.37 to 3.40). A selection that starts outside every line and holds
 * no range keeps the head's path.
 */
export const $intoLine = (
  nodes: LexicalNode[],
  selection: RangeSelection
): LexicalNode[] => {
  const removed = $removeRangeBeforeBlockPaste(nodes, selection);
  if (removed !== undefined) {
    return removed;
  }
  const unwrapped =
    $unwrapEndContainer(nodes, selection) ??
    $unwrapForQuoteLineOrRange(nodes, selection);
  if (unwrapped !== undefined) {
    return unwrapped;
  }
  const { start } = endsOf(selection);
  const line = $findMatchingParent(start.getNode(), $isCmsLineNode);
  if (line === null || line.getParent() === null) {
    return nodes;
  }
  return $pasteIntoItemLine(nodes, selection);
};

/**
 * C10 (D14, P3): plain text of several lines pasted at a caret in a line of
 * a list item, where a line's paragraph break leaves the caret at the
 * start of the block that leads the new item: the next line of text goes
 * on a line of its own before that block, as the first line stays in the
 * line it was pasted in. The data's lines go in as Lexical's rich-text
 * paste puts them (a paragraph break per new line, a tab node per tab).
 * Only that case is the field's: false otherwise, and the head's paste
 * runs.
 */
export const $pasteTextIntoItemLine = (data: DataTransfer): boolean => {
  const text = data.getData("text/plain");
  const selection = $getSelection();
  if (
    text === "" ||
    data.getData("text/html") !== "" ||
    data.getData("application/x-lexical-editor") !== "" ||
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const line = $findMatchingParent(selection.anchor.getNode(), $isCmsLineNode);
  if ($isListItemNode(line?.getParent()) === false) {
    return false;
  }
  const parts = text.split(/(\r?\n|\t)/);
  if (parts[parts.length - 1] === "") {
    parts.pop();
  }
  // the case: a paragraph break directly before a line of text
  if (
    parts.some(
      (part, index) =>
        (part === "\n" || part === "\r\n") &&
        parts[index + 1] !== undefined &&
        /^(\r?\n|\t)$/.test(parts[index + 1]) === false &&
        parts[index + 1] !== ""
    ) === false
  ) {
    return false;
  }
  // tagged as Lexical's own rich-text paste is
  $addUpdateTag("paste");
  for (const [index, part] of parts.entries()) {
    const current = $getSelection();
    if ($isRangeSelection(current) === false) {
      return true;
    }
    if (part === "\n" || part === "\r\n") {
      current.insertParagraph();
      const next = parts[index + 1];
      if (
        next !== undefined &&
        next !== "" &&
        /^(\r?\n|\t)$/.test(next) === false
      ) {
        $lineBeforeLeadingBlock();
      }
    } else if (part === "\t") {
      current.insertNodes([$createTabNode()]);
    } else {
      current.insertText(part);
    }
  }
  return true;
};

/**
 * The caret at the content start of the block that leads a lined list
 * item goes on a new empty line before that block.
 */
const $lineBeforeLeadingBlock = () => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return;
  }
  const { anchor } = selection;
  const item = $findMatchingParent(anchor.getNode(), $isListItemNode);
  const block = item?.getFirstChild() ?? null;
  if (
    $isListItemNode(item) === false ||
    $isElementNode(block) === false ||
    $isCmsLineNode(block) ||
    block.isInline() ||
    anchor.offset !== 0
  ) {
    return;
  }
  const first = block.getFirstDescendant();
  const atStart =
    anchor.getNode().is(block) ||
    (first !== null && anchor.getNode().is(first)) ||
    (first !== null &&
      $isElementNode(anchor.getNode()) &&
      anchor.getNode().isParentOf(first) &&
      block.isParentOf(anchor.getNode()));
  if (atStart === false) {
    return;
  }
  const line = $createCmsLineNode();
  block.insertBefore(line);
  line.select(0, 0);
};
