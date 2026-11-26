// The delete rules at a resolved caret and round 14's delete forms at a line's edge.
import { $isCodeNode } from "@lexical/code";
import { $isListItemNode } from "@lexical/list";
import { $isHeadingNode, $isQuoteNode } from "@lexical/rich-text";
import { $findMatchingParent } from "@lexical/utils";
import {
  $addUpdateTag,
  $createParagraphNode,
  $getEditor,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
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
  $createCmsLineNode,
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

// D5, check V5: a word or line delete that meets a rule first, in its
// direction, inside one lined container removes the rule only (first
// example: V5's TRQ Ctrl+Delete at T0w's end writes <li>T0w<blockquote>
// <p>Q2w</p></blockquote></li>)
export const $wordBesideRule = (isBackward: boolean): boolean => {
  const beside = $ruleAtEdge(isBackward);
  if (beside === null) {
    return false;
  }
  beside.remove();
  return true;
};

// spec 5.3, 5.7 (first example: TR@2 Backspace writes <li>T0w</li>): in
// an empty line beside rules, Backspace removes the rule directly before,
// Delete the one directly after, and nothing else; with no rule that way,
// the delete joins as at an ordinary item's text edge. The word and line
// forms do what the character form does and remove no word
export const $emptyLine = (
  isBackward: boolean,
  command: LexicalCommand<unknown> = DELETE_CHARACTER_COMMAND
): boolean => {
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
  if (isBackward === false && $isQuoteNode(beside)) {
    $emptyLineBeforeQuote(line, beside, command);
    return true;
  }
  // T45.3 (D7, T14.14): the word and line forms with nothing in the
  // key's direction and nothing after the container give the character
  // form's write, which is none: no node is touched (first example: d7 TR
  // el2 lineForward, where Lexical's own line delete dirties the line)
  if (
    command !== DELETE_CHARACTER_COMMAND &&
    isBackward === false &&
    beside === null &&
    $nothingAfter(container)
  ) {
    return true;
  }
  // no rule that way: Lexical's own delete runs from the line. The join
  // cells of 5.3 (TR@2 and RR@2 forward, RT@0 and RR@0 backward: a rule on
  // the line's other side, the item's edge that way and an item beyond)
  // give the word and line forms the character form's join, with D5's join
  // carrying the item's rest (RR@2 lineForward: no word of Nw goes); every
  // other empty line keeps Lexical's own word and line delete
  const behind = isBackward ? line.getNextSibling() : line.getPreviousSibling();
  if (
    command !== DELETE_CHARACTER_COMMAND &&
    beside === null &&
    isBlockDecorator(behind) &&
    $isListItemNode(container) &&
    $isListItemNode(
      isBackward ? container.getPreviousSibling() : container.getNextSibling()
    )
  ) {
    $getEditor().dispatchCommand(DELETE_CHARACTER_COMMAND, isBackward);
    return true;
  }
  return false;
};

/** Nothing follows `node` in the document: no sibling after it or after any ancestor. */
const $nothingAfter = (node: LexicalNode) => {
  for (
    let current: LexicalNode | null = node;
    current !== null && $isRootOrShadowRoot(current) === false;
    current = current.getParent()
  ) {
    if (current.getNextSibling() !== null) {
      return false;
    }
  }
  return true;
};

/**
 * T45.7 (5.3, 5.8): Backspace in an empty line after a rule removes the
 * rule and nothing else, at any depth. A line reports its item's indent,
 * so in a nested item Lexical's Backspace would outdent at the line's
 * offset 0 before the delete runs; the empty line's rule goes first.
 * The outdent stays at the start of an item's first line (first example:
 * d2 TR el2 Backspace writes `<li>T0w</li>` at depth 2).
 */
export const $emptyLineRuleBeforeOutdent = (
  event: KeyboardEvent | null
): boolean => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const line = selection.anchor.getNode();
  if (
    $isCmsLineNode(line) === false ||
    line.isEmpty() === false ||
    line.getIndent() === 0 ||
    isLinedContainer(line.getParent()) === false ||
    isBlockDecorator(line.getPreviousSibling()) === false
  ) {
    return false;
  }
  event?.preventDefault();
  return $getEditor().dispatchCommand(DELETE_CHARACTER_COMMAND, true);
};

/**
 * T33.4 (P14-7): forward at an empty line that holds the caret before a
 * quote, Delete and Ctrl+Delete remove the line and the quote stays, the
 * caret at its start; the line form removes nothing (the line form at a
 * line's end before a block, P7-lineForward). The value is unchanged (an
 * empty line exports nothing), so neither is an edit: no onChange, no
 * undo step (16.10; the field's change plugin skips history-merge
 * updates). First example: `LI(k<blockquote><p>Q1w</p></blockquote>)`,
 * a click after k, Backspace, then Delete.
 */
const $emptyLineBeforeQuote = (
  line: ElementNode,
  quote: ElementNode,
  command: LexicalCommand<unknown>
) => {
  if (command === DELETE_LINE_COMMAND) {
    return;
  }
  $addUpdateTag("history-merge");
  line.remove();
  quote.selectStart();
};

// D3's fourth case and D9: Backspace at a block's start removes a line
// break or a rule directly before the block; Delete at its end, one
// directly after. The word and line forms take the line break too, and
// a line break is never pulled into the block (first example: D3 fourth
// case, RBQ Backspace at Q2w@0 writes <li><hr /><blockquote><p>Q2w</p>
// </blockquote></li>)
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

// D3's third case, Delete form (spec 5.7): at the end of a line that ends
// in a line break, the text of the block directly after joins the line
// and the line break stays (first example: BQ el1 Delete (round 9) writes
// <li><br />Q1w</li>)
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

// D18 step 1, D3's fourth case (check 2, C): Backspace at the start of a
// line that starts with a line break, directly after a block: the break
// goes and the caret stands at the block's end (first example: C, at el1
// of LI(<blockquote><p>Q0w</p></blockquote><br>T2w), writes <li>
// <blockquote><p>Q0w</p></blockquote>T2w</li>, the caret at Q0w@3)
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
// would take the image first). 15.5, 16.12; first example: at T1w@0 of
// LI(<blockquote><p>Q0wIMG</p></blockquote>T1w), <li><blockquote><p>
// Q0w<img />T1w</p></blockquote></li>, by each of the three forms
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
// item that ends in text (check V12, spec 5.7 KS3; first example: V12,
// Nw@0 after <li>X0w<blockquote><p>X1w</p><hr></blockquote></li>, writes
// <li>X0w<blockquote><p>X1w</p></blockquote>Nw</li>)
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
 * A collapsed caret at the content edge of a root paragraph or heading (or
 * of a paragraph that is a root quote's first or last block) in a direction, with a rule at the
 * root directly beside that block and nothing beyond the rule: the rule,
 * and whether a quote stands between. The caret's edge is read through
 * inline elements ($atContentEdge).
 */
const $rootRuleBeside = (isBackward: boolean) => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return null;
  }
  const { anchor } = selection;
  const node = anchor.getNode();
  const block =
    $isElementNode(node) && node.isInline() === false
      ? node
      : $findMatchingParent(
          node,
          (parent) => $isElementNode(parent) && parent.isInline() === false
        );
  if (
    $isElementNode(block) === false ||
    $isCmsLineNode(block) ||
    $isRootOrShadowRoot(block) ||
    $atContentEdge(anchor, block, isBackward) === false
  ) {
    return null;
  }
  let top: ElementNode = block;
  let inQuote = false;
  const parent = block.getParent();
  if ($isRootOrShadowRoot(parent) === false) {
    const beside = isBackward
      ? block.getPreviousSibling()
      : block.getNextSibling();
    if (
      $isQuoteNode(parent) === false ||
      beside !== null ||
      $isRootOrShadowRoot(parent.getParent()) === false
    ) {
      return null;
    }
    top = parent;
    inQuote = true;
  }
  // the fixture's shapes only (base-key-changes-nothing): a paragraph in
  // a root quote, a root heading or a root paragraph; any other block (a
  // code block, a heading in a quote) keeps the head's delete
  if (
    $isParagraphNode(block) === false &&
    (inQuote || $isHeadingNode(block) === false)
  ) {
    return null;
  }
  const rule = isBackward ? top.getPreviousSibling() : top.getNextSibling();
  // a rule with content beyond it is the head's to step past (it joins
  // that content, as the twin does)
  if (
    isBlockDecorator(rule) === false ||
    (isBackward ? rule.getPreviousSibling() : rule.getNextSibling()) !== null
  ) {
    return null;
  }
  return { rule, block, inQuote };
};

/**
 * 16.10 (check 5; the fixture base-key-changes-nothing): Backspace or
 * Delete whose delete changes nothing is the field's, before the removal
 * step makes anything: a caret at a root quote's content edge with a rule
 * at the root beside the quote (first example: `<p>A9w</p><blockquote>
 * <p>X0wIMG</p></blockquote><hr>`, the caret after the image, Delete).
 * The twin, text in the image's place, writes nothing at the head; so
 * does the field: no update, no undo step, no value handed out.
 */
export const $nothingChanges = (
  isBackward: boolean,
  event: KeyboardEvent | null
): boolean => {
  if ($rootRuleBeside(isBackward)?.inQuote !== true) {
    return false;
  }
  event?.preventDefault();
  return true;
};

/**
 * The word and line forms at the same places (16.10 and F2, as the twin
 * does at the head): backward at a root quote's start, and the line form
 * forward at its end, change nothing; the word form forward at a root
 * quote's end, and both forward forms at the end of a root heading or
 * paragraph whose last child is not text, remove the rule alone (the
 * child stays, as a word in its place does). True when decided.
 */
const $formBesideRootRule = (
  command: LexicalCommand<unknown>,
  isBackward: boolean
) => {
  const beside = $rootRuleBeside(isBackward);
  if (beside === null) {
    return false;
  }
  if (beside.inQuote && (isBackward || command === DELETE_LINE_COMMAND)) {
    return true;
  }
  const last = beside.block.getLastChild();
  if (isBackward || $isTextNode(last) || last === null) {
    return false;
  }
  beside.rule.remove();
  return true;
};

/**
 * 16.13 (check 5; T14.7): a backward delete just before a child the code
 * block cannot hold (an image, a link: its address would be lost) that
 * starts a quote's first paragraph, a paragraph or a line, with a code
 * block directly before, joins nothing and writes nothing, in lined and
 * ordinary content (first example: `LI(<pre><code>C0w</code></pre>
 * <blockquote><p>IMGQ1w</p></blockquote>)`, Backspace before the image).
 * A leading line break joins as a new line in the code.
 */
export const $noReorderingJoin = (
  isBackward: boolean,
  event: KeyboardEvent | null
): boolean => {
  const selection = $getSelection();
  if (
    isBackward === false ||
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const { anchor } = selection;
  const node = anchor.getNode();
  const holder =
    $isElementNode(node) && node.isInline() === false
      ? node
      : $findMatchingParent(
          node,
          (parent) => $isElementNode(parent) && parent.isInline() === false
        );
  if (
    $isElementNode(holder) === false ||
    ($isCmsLineNode(holder) === false && $isParagraphNode(holder) === false) ||
    $atContentEdge(anchor, holder, true) === false
  ) {
    return false;
  }
  const first = holder.getFirstChild();
  if (first === null) {
    return false;
  }
  const parent = holder.getParent();
  const before =
    $isQuoteNode(parent) && holder.getPreviousSibling() === null
      ? parent.getPreviousSibling()
      : holder.getPreviousSibling();
  if ($isCodeNode(before) === false) {
    return false;
  }
  if (codeCanHold(first)) {
    // the key rows leave the join to the delete commands
    if (event === null) {
      $leaveBehindWhatCodeCannotHold(holder);
    }
    return false;
  }
  event?.preventDefault();
  return true;
};

/** A child a code block holds: text and line breaks only. */
const codeCanHold = (node: LexicalNode) =>
  $isTextNode(node) || isLineBreak(node);

/**
 * T33.3 (P14-2): a join into a code block carries what the block can hold
 * up to the first child it cannot hold (an image, a link); from that child
 * on, the rest stays behind: a paragraph after the code block at the
 * root, a line after it in a list item (first example: Backspace at T1w's
 * start in `<pre><code>C0w</code></pre><p>T1w<a href="https://example.org/">
 * Lw</a></p>` writes `<pre><code>C0wT1w</code></pre><p><a href=
 * "https://example.org/">Lw</a></p>`). Splits the rest off before the
 * join, which Lexical's delete then makes with what is left. From a
 * quote's first paragraph, the rest stays in the quote (T34.1, P14-10).
 */
const $leaveBehindWhatCodeCannotHold = (holder: ElementNode) => {
  const parent = holder.getParent();
  const atRoot = $isParagraphNode(holder) && $isRootOrShadowRoot(parent);
  const inQuote = $isParagraphNode(holder) && $isQuoteNode(parent);
  const inItem = $isCmsLineNode(holder) && $isListItemNode(parent);
  // a line led by a line break joins nothing (D3 group C)
  if (
    (atRoot === false && inQuote === false && inItem === false) ||
    (inItem && $isTextNode(holder.getFirstChild()) === false)
  ) {
    return;
  }
  const stop = holder
    .getChildren()
    .find((child) => codeCanHold(child) === false);
  if (stop === undefined) {
    return;
  }
  const rest = inItem ? $createCmsLineNode() : $createParagraphNode();
  const moved: LexicalNode[] = [];
  for (
    let node: LexicalNode | null = stop;
    node !== null;
    node = node.getNextSibling()
  ) {
    moved.push(node);
  }
  rest.append(...moved);
  holder.insertAfter(rest);
};

/** A caret at the start of a lined item's line that a block stands before. */
const $lineStartAfterBlockInItem = () => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    $wordFormAtLineEdgeBesideBlock(true) === false
  ) {
    return false;
  }
  const node = selection.anchor.getNode();
  const line = $isCmsLineNode(node)
    ? node
    : $findMatchingParent(node, $isCmsLineNode);
  return $isListItemNode(line?.getParent());
};

/**
 * Round 14's delete forms at a line's edge, in their carried order: a
 * caret beside an inline edge, the word form beside a block, the line
 * form forward with nothing after it, the line form backward at the
 * content's start, and a backward word or line form that is Backspace
 * (with 16.12's: at a lined item's line start after a block). The word
 * and line forms beside a root-level rule come after the inline edge
 * (16.10, F2). Check 3 and 4 (15.5, 15.6), round 14; first example: 15.6,
 * Ctrl+Backspace after a line break just before an image in
 * LI(T0w<br>IMGT2w) writes Backspace's write there. Each returns true when
 * it applies; nothing under the head path.
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
    (command === DELETE_WORD_COMMAND || command === DELETE_LINE_COMMAND) &&
    $formBesideRootRule(command, isBackward)
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
  // 16.12: at a lined item's line start after a block, the three
  // backward forms are Backspace (LI(<blockquote><p>Q0wIMG</p>
  // </blockquote>T1w) at T1w@0: the line joins after the image)
  if (
    (command === DELETE_LINE_COMMAND || command === DELETE_WORD_COMMAND) &&
    isBackward === true &&
    ($backwardFormIsBackspace() || $lineStartAfterBlockInItem())
  ) {
    $getEditor().dispatchCommand(DELETE_CHARACTER_COMMAND, true);
    return true;
  }
  return false;
};
