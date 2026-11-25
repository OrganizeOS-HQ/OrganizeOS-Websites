// Paste routing into lines.
import { $isCodeNode } from "@lexical/code";
import { $isListItemNode } from "@lexical/list";
import { $findMatchingParent } from "@lexical/utils";
import {
  $createTextNode,
  $isDecoratorNode,
  $isElementNode,
  $isParagraphNode,
  type LexicalNode,
  type PointType,
  type RangeSelection,
} from "lexical";
import { $isCmsLineNode, isLinedContainer } from "./rich-text-line-node";
import { $unwrapLines } from "./rich-text-line-normalise";
import { $removeRangeWithBreak } from "./rich-text-line-removal";

/**
 * A paste into a line of a list item gives what the same paste gives in
 * the item's own text: one paragraph goes in as its inline content, one
 * code block as inline code, and blocks (at a caret) into the item with
 * its lines unwrapped meanwhile, as in the item's own text.
 */
export const $intoLine = (
  nodes: LexicalNode[],
  selection: RangeSelection
): LexicalNode[] => {
  const start = selection.isBackward() ? selection.focus : selection.anchor;
  const end = selection.isBackward() ? selection.anchor : selection.focus;
  const line = $findMatchingParent(start.getNode(), $isCmsLineNode);
  const item = line?.getParent() ?? null;
  // F (D14): a range with a point in a lined container is removed first,
  // as 5.4 says, with D3's and D5's joins, in the paste's update; the paste
  // then runs at the caret that leaves. The head's path never runs over
  // such a range
  const inLined = (point: PointType) =>
    $findMatchingParent(point.getNode(), (node) => isLinedContainer(node)) !==
    null;
  // (a range that starts outside a lined container keeps the first check's
  // V2 and V3 writes, below)
  if (selection.isCollapsed() === false && inLined(start)) {
    $removeRangeWithBreak(selection);
    return selection.isCollapsed() ? $intoLine(nodes, selection) : nodes;
  }
  // a range that starts outside a line and ends in one: the end's
  // container takes the head's path (V3)
  if ((line === null || item === null) && selection.isCollapsed() === false) {
    const endLine = $findMatchingParent(end.getNode(), $isCmsLineNode);
    const endContainer = endLine?.getParent() ?? null;
    // a block paste from the item before into a block-led lined item: the
    // removal first (5.4, with D5's join), then the paste at the caret it
    // leaves
    const before = endContainer?.getPreviousSibling() ?? null;
    const startNode = start.getNode();
    if (
      $isListItemNode(endContainer) &&
      $isCmsLineNode(endContainer.getFirstChild()) === false &&
      $isListItemNode(before) &&
      (before.is(startNode) || before.isParentOf(startNode)) &&
      nodes.some(
        (node) =>
          ($isElementNode(node) || $isDecoratorNode(node)) &&
          node.isInline() === false
      )
    ) {
      selection.removeText();
      return nodes;
    }
    if (endContainer !== null) {
      $unwrapLines(endContainer.getChildren());
    }
    return nodes;
  }
  if (line === null || item === null) {
    return nodes;
  }
  // a line in a quote, or a range: the head's path over the containers'
  // own text (D4, D14)
  if ($isListItemNode(item) === false || selection.isCollapsed() === false) {
    const endLine = $findMatchingParent(end.getNode(), $isCmsLineNode);
    $unwrapLines(item.getChildren());
    const endContainer = endLine?.getParent() ?? null;
    if (endContainer !== null && endContainer.is(item) === false) {
      $unwrapLines(endContainer.getChildren());
    }
    return nodes;
  }
  if (nodes.length === 1 && $isParagraphNode(nodes[0])) {
    return nodes[0].getChildren();
  }
  if (nodes.length === 1 && $isCodeNode(nodes[0])) {
    const text = $createTextNode(nodes[0].getTextContent());
    text.toggleFormat("code");
    return [text];
  }
  const isBlock = (node: LexicalNode) =>
    ($isElementNode(node) || $isDecoratorNode(node)) &&
    node.isInline() === false;
  if (nodes.some(isBlock)) {
    $unwrapLines(item.getChildren());
  }
  return nodes;
};
