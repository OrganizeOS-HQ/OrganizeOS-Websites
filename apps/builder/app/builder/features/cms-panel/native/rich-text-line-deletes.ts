// The delete rules at a resolved caret and round 14's delete forms at a line's edge.
import { $isListItemNode } from "@lexical/list";
import { $isQuoteNode } from "@lexical/rich-text";
import { $findMatchingParent } from "@lexical/utils";
import {
  $getEditor,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  ElementNode,
  type LexicalCommand,
  type LexicalNode,
} from "lexical";
import {
  $atContentEdge,
  $childAtEdge,
  $isCmsLineNode,
  isBlockDecorator,
  isLineBreak,
  isLinedContainer,
} from "./rich-text-line-node";
import {
  $backwardFormIsBackspace,
  $caretBesideInlineEdge,
  $hasMark,
  $lineFormAtContentStart,
  $lineFormHasNothing,
  $wordFormAtLineEdgeBesideBlock,
  HEAD_PATH_TAG,
} from "./rich-text-line-removal";

/** The rule beside the caret's child of a lined container, in a direction. */
const $ruleAtEdge = (isBackward: boolean) => {
  const edge = $childAtEdge(isBackward);
  if (edge === null) {
    return null;
  }
  const beside = isBackward
    ? edge.child.getPreviousSibling()
    : edge.child.getNextSibling();
  return isBlockDecorator(beside) ? beside : null;
};

// a word or line delete that meets a rule first, in its direction,
// inside one lined container removes the rule only (D5)
export const $wordBesideRule = (isBackward: boolean): boolean => {
  const beside = $ruleAtEdge(isBackward);
  if (beside === null) {
    return false;
  }
  beside.remove();
  return true;
};

// in an empty line beside rules: Backspace removes the rule directly
// before, Delete the one directly after, and nothing else; with no rule
// that way, the delete joins as at an ordinary item's text edge
export const $emptyLine = (isBackward: boolean): boolean => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const line = selection.anchor.getNode();
  const container = line.getParent();
  if (
    $isCmsLineNode(line) === false ||
    line.isEmpty() === false ||
    isLinedContainer(container) === false
  ) {
    return false;
  }
  const beside = isBackward ? line.getPreviousSibling() : line.getNextSibling();
  if (isBlockDecorator(beside)) {
    beside.remove();
    return true;
  }
  // no rule that way: the line is the container's first or last
  // line, and Lexical's own delete runs from it, with D5's join
  // carrying the item's rest
  return false;
};

// D3's fourth case and D9: Backspace at a block's start removes a line
// break or a rule directly before the block; Delete at its end, one
// directly after. The word and line forms take the line break too, and
// a line break is never pulled into the block
export const $blockEdge = (
  isBackward: boolean,
  command: LexicalCommand<unknown>
): boolean => {
  const edge = $childAtEdge(isBackward);
  if (edge === null || $isCmsLineNode(edge.child)) {
    return false;
  }
  const rule = isBackward
    ? edge.child.getPreviousSibling()
    : edge.child.getNextSibling();
  if (
    command === DELETE_CHARACTER_COMMAND &&
    isBlockDecorator(rule) &&
    ["quote", "heading", "code"].includes(edge.child.getType())
  ) {
    rule.remove();
    return true;
  }
  const line = isBackward
    ? edge.child.getPreviousSibling()
    : edge.child.getNextSibling();
  if ($isCmsLineNode(line) === false) {
    return false;
  }
  const brk = isBackward ? line.getLastChild() : line.getFirstChild();
  if (isLineBreak(brk) === false || brk === null) {
    return false;
  }
  brk.remove();
  return true;
};

// D3's third case, Delete form: at the end of a line that ends in a line
// break, the text of the block directly after joins the line and the
// line break stays
export const $lineEndIntoBlock = (isBackward: boolean): boolean => {
  const selection = $getSelection();
  if (
    isBackward ||
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const point = selection.anchor;
  const line = point.getNode();
  if (
    $isCmsLineNode(line) === false ||
    point.type !== "element" ||
    point.offset !== line.getChildrenSize() ||
    isLineBreak(line.getLastChild()) === false
  ) {
    return false;
  }
  const block = line.getNextSibling();
  if (
    $isElementNode(block) === false ||
    $isCmsLineNode(block) ||
    block.isInline() ||
    ["quote", "heading"].includes(block.getType()) === false
  ) {
    return false;
  }
  const holder = $isQuoteNode(block) ? block.getFirstChild() : block;
  if ($isElementNode(holder) === false || holder.isInline()) {
    return false;
  }
  const moved = holder.getChildren();
  const at = line.getChildrenSize();
  line.append(...moved);
  holder.remove();
  if (block.isAttached() && block.isEmpty()) {
    block.remove();
  }
  point.set(line.getKey(), at, "element");
  selection.focus.set(line.getKey(), at, "element");
  return true;
};

// Backspace at the start of a line that starts with a line break,
// directly after a block: the break goes and the caret stands at the
// block's end
export const $breakLedLineStart = (isBackward: boolean): boolean => {
  const selection = $getSelection();
  if (
    isBackward === false ||
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const { anchor } = selection;
  const line = anchor.getNode();
  if (
    anchor.type !== "element" ||
    anchor.offset !== 0 ||
    $isCmsLineNode(line) === false
  ) {
    return false;
  }
  const brk = line.getFirstChild();
  const block = line.getPreviousSibling();
  if (
    isLineBreak(brk) === false ||
    brk === null ||
    $isElementNode(block) === false ||
    $isCmsLineNode(block) ||
    block.isInline()
  ) {
    return false;
  }
  brk.remove();
  const last = block.getLastDescendant();
  if ($isTextNode(last)) {
    last.select(last.getTextContentSize(), last.getTextContentSize());
  } else if ($isElementNode(last)) {
    last.selectEnd();
  } else {
    block.selectEnd();
  }
  return true;
};

// D3's second case: Backspace at the start of a line directly after a
// block whose last paragraph ends in an image moves the line's content
// to the end of that paragraph; the image stays (Lexical's own delete
// would take the image first)
export const $joinBeforeEndingImage = (isBackward: boolean): boolean => {
  const selection = $getSelection();
  if (
    isBackward === false ||
    $hasMark(HEAD_PATH_TAG) ||
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const { anchor } = selection;
  const node = anchor.getNode();
  const line = $isCmsLineNode(node)
    ? node
    : $findMatchingParent(node, $isCmsLineNode);
  if ($isCmsLineNode(line) === false || anchor.offset !== 0) {
    return false;
  }
  if ($atContentEdge(anchor, line, true) === false) {
    return false;
  }
  let target: LexicalNode | null = line.getPreviousSibling();
  while (
    $isElementNode(target) &&
    $isCmsLineNode(target) === false &&
    $isElementNode(target.getLastChild()) &&
    (target.getLastChild() as ElementNode).isInline() === false
  ) {
    target = target.getLastChild();
  }
  if (
    $isElementNode(target) === false ||
    $isCmsLineNode(target) ||
    target.isInline() ||
    isBlockDecorator(target.getLastChild()) ||
    $isDecoratorNode(target.getLastChild()) === false
  ) {
    return false;
  }
  const children = line.getChildren();
  target.append(...children);
  line.remove();
  const start = children[0];
  if ($isTextNode(start)) {
    start.select(0, 0);
  } else if (start !== undefined) {
    const at = start.getIndexWithinParent();
    selection.anchor.set(target.getKey(), at, "element");
    selection.focus.set(target.getKey(), at, "element");
  } else {
    target.selectEnd();
  }
  return true;
};

// Backspace at an item's start after an item that ends in a rule (or a
// quote that ends in one) removes the rule and joins the item, as after an
// item that ends in text
export const $itemStartJoin = (isBackward: boolean): boolean => {
  if (isBackward === false) {
    return false;
  }
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const { anchor } = selection;
  const node = anchor.getNode();
  const item = $isListItemNode(node)
    ? node
    : $findMatchingParent(node, $isListItemNode);
  if (item === null || $atContentEdge(anchor, item, true) === false) {
    return false;
  }
  const previous = item.getPreviousSibling();
  if (
    $isListItemNode(previous) === false ||
    isLinedContainer(previous) === false
  ) {
    return false;
  }
  const lastChild = previous.getLastChild();
  const rule =
    $isQuoteNode(lastChild) && isBlockDecorator(lastChild.getLastChild())
      ? lastChild.getLastChild()
      : lastChild;
  if (isBlockDecorator(rule) === false) {
    return false;
  }
  rule.remove();
  const target = previous.getLastChild();
  const children = item.getChildren();
  if ($isCmsLineNode(target)) {
    target.append(...children);
  } else {
    previous.append(...children);
  }
  item.remove();
  return true;
};

/**
 * Round 14's delete forms at a line's edge, in their carried order: a
 * caret beside an inline edge, the word form beside a block, the line
 * form forward with nothing after it, the line form backward at the
 * content's start, and a backward word or line form that is Backspace.
 * Each returns true when it applies; nothing under the head path.
 */
export const $deleteEdgeForms = (
  command: LexicalCommand<unknown>,
  isBackward: boolean
): boolean => {
  if ($hasMark(HEAD_PATH_TAG)) {
    return false;
  }
  if (
    $caretBesideInlineEdge(isBackward, command === DELETE_CHARACTER_COMMAND)
  ) {
    return true;
  }
  if (
    command === DELETE_WORD_COMMAND &&
    $wordFormAtLineEdgeBesideBlock(isBackward)
  ) {
    $getEditor().dispatchCommand(DELETE_CHARACTER_COMMAND, isBackward);
    return true;
  }
  if (
    command === DELETE_LINE_COMMAND &&
    isBackward === false &&
    $lineFormHasNothing()
  ) {
    return true;
  }
  // the line form backward at the content's start, before a first
  // child that is not text, has nothing to remove (as in text)
  if (
    command === DELETE_LINE_COMMAND &&
    isBackward === true &&
    $lineFormAtContentStart()
  ) {
    return true;
  }
  if (
    (command === DELETE_LINE_COMMAND || command === DELETE_WORD_COMMAND) &&
    isBackward === true &&
    $backwardFormIsBackspace()
  ) {
    $getEditor().dispatchCommand(DELETE_CHARACTER_COMMAND, true);
    return true;
  }
  return false;
};
