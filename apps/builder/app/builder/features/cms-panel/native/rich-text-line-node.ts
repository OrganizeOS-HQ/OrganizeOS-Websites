/**
 * SPIKE. A line: each maximal run of inline content of a list item or quote
 * that also holds a block. No list item and no quote holds inline content
 * beside a non-inline child. The stored HTML never shows a line: its export
 * writes its children only.
 */
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createRangeSelection,
  $addUpdateTag,
  $getEditor,
  $hasUpdateTag,
  $getNodeByKey,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isLineBreakNode,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  CUT_COMMAND,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  DecoratorNode,
  ElementNode,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  PASTE_COMMAND,
  REMOVE_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
  type BaseSelection,
  type LexicalCommand,
  ParagraphNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type RangeSelection,
  type SerializedElementNode,
} from "lexical";
import {
  $createListItemNode,
  $isListItemNode,
  $isListNode,
  ListItemNode,
} from "@lexical/list";
import { $isQuoteNode, HeadingNode, QuoteNode } from "@lexical/rich-text";
import { CodeNode } from "@lexical/code";
import { $dfs, $findMatchingParent, mergeRegister } from "@lexical/utils";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";

/** SPIKE: VITE_LINES_OFF turns every line rule off (the head's behaviour). */
const linesOff =
  String(
    (import.meta as { env?: Record<string, string> }).env?.VITE_LINES_OFF ?? ""
  ) !== "";

export const lineSpike = {
  /** The invariant's transforms run. */
  on: linesOff === false,
  /** An update leaves no item, quote or line it emptied. */
  noEmptied: true,
};

export class CmsLineNode extends ElementNode {
  static getType() {
    return "cms-line";
  }

  static clone(node: CmsLineNode) {
    return new CmsLineNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  static importJSON(json: SerializedElementNode) {
    const node = $createCmsLineNode();
    node.setDirection(json.direction);
    return node;
  }

  exportJSON(): SerializedElementNode {
    return { ...super.exportJSON(), type: "cms-line", version: 1 };
  }

  static importDOM(): DOMConversionMap | null {
    return null;
  }

  createDOM() {
    const element = document.createElement("div");
    element.setAttribute("data-cms-line", "");
    return element;
  }

  updateDOM() {
    return false;
  }

  // a copy carries the line's children, never the line
  excludeFromCopy() {
    return true;
  }

  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    return { element: document.createDocumentFragment() };
  }

  isInline() {
    return false;
  }

  canBeEmpty() {
    return true;
  }

  // a line reports and sets its item's indent; of the lines of one item a
  // range covers, the first changes the item, so the item changes once
  canIndent() {
    const item = this.getParent();
    if ($isListItemNode(item) === false) {
      return false;
    }
    const selection = $getSelection();
    return (
      selection === null ||
      this.getPreviousSiblings().some(
        (sibling) => $isCmsLineNode(sibling) && sibling.isSelected(selection)
      ) === false
    );
  }

  getIndent() {
    const item = this.getParent();
    return $isListItemNode(item) ? item.getIndent() : 0;
  }

  setIndent(indent: number) {
    const item = this.getParent();
    if ($isListItemNode(item) && indent !== item.getIndent()) {
      item.setIndent(Math.max(0, indent));
    }
    return this;
  }

  /**
   * Enter in a line in an item splits the item: what follows the caret and
   * the item's later children go to a new item. In a quote, a paragraph
   * follows the line.
   */
  insertNewAfter(
    _selection: RangeSelection,
    restoreSelection = true
  ): ElementNode {
    const parent = this.getParent();
    if ($isListItemNode(parent)) {
      const item = $createListItemNode();
      const rest = this.getNextSiblings();
      parent.insertAfter(item);
      if (this.isEmpty() && rest.length === 0) {
        this.remove();
        return item;
      }
      const line = $createCmsLineNode();
      item.append(line, ...rest);
      return line;
    }
    const paragraph = $createParagraphNode();
    this.insertAfter(paragraph, restoreSelection);
    return paragraph;
  }

  /**
   * Backspace at the start of the first line of a list's first item, with
   * nothing before it: the item's content leaves the list before it.
   */
  collapseAtStart(_selection: RangeSelection): boolean {
    const item = this.getParent();
    if (
      $isListItemNode(item) === false ||
      this.getPreviousSibling() !== null ||
      item.getPreviousSibling() !== null
    ) {
      return false;
    }
    const list = item.getParent();
    if ($isListNode(list) === false || $isListItemNode(list.getParent())) {
      return false;
    }
    const paragraph = $createParagraphNode();
    const children = item.getChildren();
    list.insertBefore(paragraph);
    paragraph.append(...this.getChildren());
    let after: LexicalNode = paragraph;
    for (const child of children.slice(1)) {
      after.insertAfter(child);
      after = child;
    }
    this.remove();
    item.remove();
    if (list.isEmpty()) {
      list.remove();
    }
    paragraph.selectStart();
    return true;
  }
}

export const $createCmsLineNode = () => new CmsLineNode();

export const $isCmsLineNode = (
  node: LexicalNode | null | undefined
): node is CmsLineNode => node instanceof CmsLineNode;

const isInlineContent = (node: LexicalNode) =>
  $isCmsLineNode(node) === false &&
  ($isElementNode(node) || $isDecoratorNode(node) ? node.isInline() : true);

const isLineContainer = (node: LexicalNode | null): node is ElementNode =>
  $isListItemNode(node) || $isQuoteNode(node);

type ElementPoint = { which: "anchor" | "focus"; key: string; offset: number };

/** Element points of the selection, to be set again once nodes have moved. */
const elementPoints = (): ElementPoint[] => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return [];
  }
  return (["anchor", "focus"] as const).flatMap((which) => {
    const point = selection[which];
    return point.type === "element"
      ? [{ which, key: point.key, offset: point.offset }]
      : [];
  });
};

const setPoint = (which: "anchor" | "focus", key: string, offset: number) => {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    selection[which].set(key, offset, "element");
  }
};


const isLineBreak = (node: LexicalNode | null | undefined) =>
  node !== null && node !== undefined && $isLineBreakNode(node);

/** Whether the selection has a point in the node or below it. */
const holdsSelection = (node: ElementNode) => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return false;
  }
  return [selection.anchor, selection.focus].some((point) => {
    const at = point.getNode();
    return at.is(node) || node.isParentOf(at);
  });
};

/**
 * A paragraph directly in a list item becomes a line. It keeps its own
 * visual line: one line break separates it from inline content or a line
 * beside it, unless a line break already stands at that edge.
 */
const $paragraphToLine = (paragraph: ParagraphNode) => {
  const before = paragraph.getPreviousSibling();
  const after = paragraph.getNextSibling();
  const children = paragraph.getChildren();
  const touches = (node: LexicalNode | null) =>
    node !== null && (isInlineContent(node) || $isCmsLineNode(node));
  const lastOf = (node: LexicalNode | null) =>
    $isCmsLineNode(node) ? node.getLastChild() : node;
  const firstOf = (node: LexicalNode | null) =>
    $isCmsLineNode(node) ? node.getFirstChild() : node;
  const breakBefore =
    touches(before) &&
    isLineBreak(lastOf(before)) === false &&
    isLineBreak(children[0]) === false;
  const breakAfter =
    touches(after) &&
    isLineBreak(firstOf(after)) === false &&
    isLineBreak(children.at(-1)) === false;
  const points = elementPoints().filter(
    (point) => point.key === paragraph.getKey()
  );
  const line = $createCmsLineNode();
  paragraph.insertBefore(line, false);
  if (breakBefore) {
    line.append($createLineBreakNode());
  }
  line.append(...children);
  if (breakAfter) {
    line.append($createLineBreakNode());
  }
  paragraph.remove();
  for (const point of points) {
    setPoint(point.which, line.getKey(), point.offset + (breakBefore ? 1 : 0));
  }
};

/**
 * Of two lines that meet, the second takes a line break first when a
 * block between them had its text join the first line (D3: that text
 * keeps its visual line against the line after), unless a line break
 * already stands at that edge. Read from the state before (public API).
 */
const $linesNeedingBreak = (container: ElementNode, children: LexicalNode[]) => {
  const result = new Set<string>();
  const previous = $previousChildren(container.getKey());
  if (previous === null) {
    return result;
  }
  const keys = previous.map((child) => child.key);
  children.forEach((child, index) => {
    const first = children[index - 1];
    if (
      $isCmsLineNode(child) === false ||
      $isCmsLineNode(first) === false ||
      isLineBreak(first.getLastChild()) ||
      isLineBreak(child.getFirstChild())
    ) {
      return;
    }
    const from = keys.indexOf(first.getKey());
    const to = keys.indexOf(child.getKey());
    if (from === -1 || to === -1 || to - from < 2) {
      return;
    }
    const between = keys.slice(from + 1, to);
    const texts = $getEditor()
      .getEditorState()
      .read(() =>
        between.flatMap((key) => {
          const node = $getNodeByKey(key);
          return $isElementNode(node)
            ? node.getAllTextNodes().map((text) => text.getKey())
            : [];
        })
      );
    if (
      texts.some((key) => {
        const now = $getNodeByKey(key);
        return now !== null && now.isAttached() && first.isParentOf(now);
      })
    ) {
      result.add(child.getKey());
    }
  });
  return result;
};

/**
 * Two lines meet because a node-selected block between them went (a cut,
 * a delete): the caret goes to the join, as the head's caret lands between
 * the two texts it joins.
 */
const $caretAtJoinOfRemovedNode = (line: CmsLineNode) => {
  const last = line.getLastChild();
  return $caretAfterRemovedNode(last ?? line, last === null);
};

/**
 * True when it set the caret: the element points the line rules carry
 * across their moves then stay as set here, since the removal already
 * turned the node selection into a point on the container.
 */
const $caretAfterRemovedNode = (node: LexicalNode, inside: boolean) => {
  // the state before this update held a node selection whose nodes are gone
  const before = $getEditor().getEditorState()._selection;
  if ($isNodeSelection(before) === false) {
    return false;
  }
  const gone = [...before._nodes].every((key) => {
    const now = $getNodeByKey(key);
    return now === null || now.isAttached() === false;
  });
  if (gone === false) {
    return false;
  }
  const range = $createRangeSelection();
  if ($isTextNode(node)) {
    range.anchor.set(node.getKey(), node.getTextContentSize(), "text");
    range.focus.set(node.getKey(), node.getTextContentSize(), "text");
  } else if (inside && $isElementNode(node)) {
    range.anchor.set(node.getKey(), node.getChildrenSize(), "element");
    range.focus.set(node.getKey(), node.getChildrenSize(), "element");
  } else {
    const parent = node.getParentOrThrow();
    const index = node.getIndexWithinParent() + 1;
    range.anchor.set(parent.getKey(), index, "element");
    range.focus.set(parent.getKey(), index, "element");
  }
  $setSelection(range);
  return true;
};

/**
 * The container's inline runs each in one line when it holds a block, and
 * no line when it holds none. Lines that meet join as the texts would join
 * with no line between them: no line break is added. An empty line holding
 * no point of the selection goes.
 */
export const $normaliseLines = (container: ElementNode) => {
  if ($isListItemNode(container)) {
    for (const child of container.getChildren()) {
      // a paragraph holding a block waits for its lift
      if (
        $isParagraphNode(child) &&
        child.getChildren().every(isInlineContent)
      ) {
        $paragraphToLine(child);
      }
    }
  }
  for (const child of container.getChildren()) {
    if (
      $isCmsLineNode(child) &&
      child.isEmpty() &&
      holdsSelection(child) === false
    ) {
      child.remove();
    }
  }
  const children = container.getChildren();
  const hasBlock = children.some(
    (child) => $isCmsLineNode(child) === false && isInlineContent(child) === false
  );
  const hasInline = children.some(isInlineContent);
  const lineCount = children.filter($isCmsLineNode).length;
  if (hasBlock && hasInline === false) {
    const meet = children.some(
      (child, index) =>
        $isCmsLineNode(child) && $isCmsLineNode(children[index + 1])
    );
    if (meet === false) {
      return;
    }
  }
  if (hasBlock === false && lineCount === 0) {
    return;
  }
  const breakBefore = $linesNeedingBreak(container, children);
  const points = elementPoints();
  let caretSet = false;
  const moved = new Map<string, { key: string; base: number }>();
  const containerKey = container.getKey();
  // where each old child position of the container lands
  const containerMap: Array<{ key: string; offset: number }> = [];
  if (hasBlock === false) {
    let index = 0;
    for (const child of children) {
      containerMap.push({ key: containerKey, offset: index });
      if ($isCmsLineNode(child)) {
        const before = child.getPreviousSibling();
        if (before !== null) {
          caretSet = $caretAfterRemovedNode(before, false) || caretSet;
        }
        if (breakBefore.has(child.getKey())) {
          child.splice(0, 0, [$createLineBreakNode()]);
        }
        moved.set(child.getKey(), { key: containerKey, base: index });
        const inner = child.getChildren();
        for (const each of inner) {
          child.insertBefore(each, false);
        }
        index += inner.length;
        child.remove();
      } else {
        index += 1;
      }
    }
    containerMap.push({ key: containerKey, offset: index });
  } else {
    let line: CmsLineNode | undefined;
    let blockIndex = 0;
    for (const child of children) {
      if ($isCmsLineNode(child)) {
        if (line === undefined) {
          line = child;
          containerMap.push({ key: child.getKey(), offset: 0 });
          blockIndex += 1;
        } else {
          caretSet = $caretAtJoinOfRemovedNode(line) || caretSet;
          containerMap.push({
            key: line.getKey(),
            offset: line.getChildrenSize(),
          });
          moved.set(child.getKey(), {
            key: line.getKey(),
            base: line.getChildrenSize(),
          });
          if (breakBefore.has(child.getKey())) {
            line.append($createLineBreakNode());
          }
          line.append(...child.getChildren());
          child.remove();
        }
        continue;
      }
      if (isInlineContent(child)) {
        if (line === undefined) {
          line = $createCmsLineNode();
          child.insertBefore(line, false);
          blockIndex += 1;
        }
        containerMap.push({
          key: line.getKey(),
          offset: line.getChildrenSize(),
        });
        line.append(child);
        continue;
      }
      containerMap.push({ key: containerKey, offset: blockIndex });
      blockIndex += 1;
      line = undefined;
    }
    containerMap.push({ key: containerKey, offset: blockIndex });
  }
  if (caretSet) {
    return;
  }
  for (const point of points) {
    if (point.key === containerKey) {
      const to = containerMap[Math.min(point.offset, containerMap.length - 1)];
      setPoint(point.which, to.key, to.offset);
      continue;
    }
    const to = moved.get(point.key);
    if (to !== undefined) {
      setPoint(point.which, to.key, to.base + point.offset);
    }
  }
};

/**
 * Whether this update emptied the node: it held children before the
 * update, holds none now, and none of the children it held is attached
 * any more (a split that moved them, as Enter at an item's start does,
 * empties nothing). Reads the state before the update only, so a redo,
 * which restores the state, gives the same result.
 */
const $wasEmptied = (node: ElementNode) => {
  if (node.getChildrenSize() !== 0) {
    return false;
  }
  const held = $previousChildren(node.getKey());
  if (held === null || held.length === 0) {
    return false;
  }
  return held.every(({ key }) => {
    const now = $getNodeByKey(key);
    return now === null || now.isAttached() === false;
  });
};

/** The children a node held in the state before this update (public API). */
const $previousChildren = (key: string) =>
  $getEditor()
    .getEditorState()
    .read(() => {
      const node = $getNodeByKey(key);
      return $isElementNode(node)
        ? node.getChildren().map((child) => ({
            key: child.getKey(),
            isLine: $isCmsLineNode(child),
          }))
        : null;
    });

/** An item or quote this update emptied goes, unless it holds the caret. */
const REMOVAL_TAG = "cms-removal";
/** SPIKE: the rule violations seen, for the probe. */
export const lineRuleViolations: string[] = [];
/** An update that runs the head's own path over unwrapped lines. */
const HEAD_PATH_TAG = "cms-head-path";

const REMOVAL_START_TAG = "cms-removal-start:";

/**
 * This update removes content (a range, a node selection, a delete, a
 * cut). The block the removed range starts in, and its ancestors, are
 * never emptied by it.
 */
export const $tagRemoval = () => {
  $addUpdateTag(REMOVAL_TAG);
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false || selection.isCollapsed()) {
    return;
  }
  const start = selection.isBackward() ? selection.focus : selection.anchor;
  for (
    let node: LexicalNode | null = start.getNode();
    node !== null;
    node = node.getParent()
  ) {
    $addUpdateTag(`${REMOVAL_START_TAG}${node.getKey()}`);
  }
};

const $dropEmptied = (node: ElementNode) => {
  if (
    lineSpike.noEmptied === false ||
    $hasUpdateTag(REMOVAL_TAG) === false ||
    $hasUpdateTag(`${REMOVAL_START_TAG}${node.getKey()}`) ||
    $wasEmptied(node) === false ||
    holdsSelection(node)
  ) {
    return false;
  }
  const parent = node.getParent();
  node.remove();
  if ($isListNode(parent) && parent.isEmpty()) {
    parent.remove();
  }
  return true;
};

const $keepLineInPlace = (line: CmsLineNode) => {
  if (lineSpike.on === false) {
    return;
  }
  const parent = line.getParent();
  if (isLineContainer(parent)) {
    $normaliseLines(parent);
    return;
  }
  const paragraph = $createParagraphNode();
  line.replace(paragraph, true);
};

/**
 * An item whose first line this update joined into the item before it
 * (a removal from that item into this one) joins it whole: the rest of
 * the item follows the joined text, as an item of text and a rule joins
 * at the head.
 */
const $joinRestOfItem = (item: ElementNode) => {
  if ($isListItemNode(item) === false || item.isEmpty()) {
    return false;
  }
  const previous = $previousChildren(item.getKey());
  if (previous === null || previous.length === 0) {
    return false;
  }
  // the removal reached the item's start: its first child is gone, and
  // what stays is the rest of what it held. A line of it went too: the
  // head read that text as the item's own, and joined the item whole
  const gone = (key: string) => {
    const now = $getNodeByKey(key);
    return now === null || now.isAttached() === false;
  };
  if (gone(previous[0].key) === false) {
    return false;
  }
  if (previous.some((child) => child.isLine && gone(child.key)) === false) {
    return false;
  }
  const held = new Set(previous.map((child) => child.key));
  if (item.getChildren().some((child) => held.has(child.getKey()) === false)) {
    return false;
  }
  // the text it started with joined the item before, where the caret is
  const before = item.getPreviousSibling();
  const selection = $getSelection();
  if (
    $isListItemNode(before) === false ||
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const at = selection.anchor.getNode();
  if (before.is(at) === false && before.isParentOf(at) === false) {
    return false;
  }
  before.append(...item.getChildren());
  item.remove();
  return true;
};

const $keepContainer = (container: ElementNode) => {
  if (lineSpike.on === false) {
    return;
  }
  if ($dropEmptied(container)) {
    return;
  }
  if ($hasUpdateTag(REMOVAL_TAG) && $joinRestOfItem(container)) {
    return;
  }
  $normaliseLines(container);
  if (container.isAttached()) {
    $liftPointsIntoLines(true);
  }
};

/**
 * The line rules. Registered after the field's lifts, so that
 * `$liftBlocksAfterNestedList` sees a pasted paragraph before it becomes
 * a line.
 */
export const registerLineTransforms = (editor: LexicalEditor) =>
  linesOff ? () => {} : mergeRegister(
    editor.registerNodeTransform(CmsLineNode, $keepLineInPlace),
    editor.registerNodeTransform(ListItemNode, $keepContainer),
    editor.registerNodeTransform(QuoteNode, $keepContainer),
    editor.registerNodeTransform(HeadingNode, $dropEmptiedBlockInContainer),
    editor.registerNodeTransform(CodeNode, $dropEmptiedBlockInContainer)
  );

/**
 * A heading or code block in an item or quote whose children a removal
 * detached goes, as an item or quote does (K12).
 */
const $dropEmptiedBlockInContainer = (block: ElementNode) => {
  if (lineSpike.on === false || isLineContainer(block.getParent()) === false) {
    return;
  }
  $dropEmptied(block);
};

// ============================================================
// Points on a lined container
// ============================================================

/**
 * A lined container: a list item that holds a non-inline child, or a quote
 * that holds a line. A quote of paragraphs and blocks is not lined.
 */
export const isLinedContainer = (
  node: LexicalNode | null
): node is ElementNode =>
  ($isListItemNode(node) &&
    node
      .getChildren()
      .some(
        (child) => $isCmsLineNode(child) || isInlineContent(child) === false
      )) ||
  ($isQuoteNode(node) && node.getChildren().some($isCmsLineNode));

/**
 * Each element point on a lined container moves into the line beside it:
 * the start of the line after, else the end of the line before. With
 * `create`, a point with no line beside it gets an empty line of its own
 * there.
 */
export const $liftPointsIntoLines = (create: boolean): boolean => {
  if (lineSpike.on === false) {
    return false;
  }
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return false;
  }
  const made = new Map<string, CmsLineNode>();
  for (const point of [selection.anchor, selection.focus]) {
    if (point.type !== "element") {
      continue;
    }
    const container = point.getNode();
    if (isLinedContainer(container) === false) {
      continue;
    }
    const after = container.getChildAtIndex(point.offset);
    const before =
      point.offset > 0 ? container.getChildAtIndex(point.offset - 1) : null;
    if ($isCmsLineNode(after)) {
      point.set(after.getKey(), 0, "element");
      continue;
    }
    if ($isCmsLineNode(before)) {
      point.set(before.getKey(), before.getChildrenSize(), "element");
      continue;
    }
    if (create === false) {
      continue;
    }
    const at = `${container.getKey()}@${point.offset}`;
    let line = made.get(at);
    if (line === undefined) {
      line = $createCmsLineNode();
      made.set(at, line);
      const offset = point.offset;
      const other =
        point === selection.anchor ? selection.focus : selection.anchor;
      container.splice(offset, 0, [line]);
      if (
        other.type === "element" &&
        other.key === container.getKey() &&
        other.offset > offset
      ) {
        other.set(other.key, other.offset + 1, "element");
      }
    }
    point.set(line.getKey(), 0, "element");
  }
  return made.size > 0;
};

/** Empty lines that hold no point of the selection go. True when any did. */
const $removeLeftEmptyLines = () => {
  let removed = false;
  for (const { node } of $dfs()) {
    if (
      $isCmsLineNode(node) &&
      node.isAttached() &&
      node.isEmpty() &&
      holdsSelection(node) === false
    ) {
      node.remove();
      removed = true;
    }
  }
  return removed;
};

/** Whether a committed selection breaks the point rule (5.3). */
const $pointRuleBroken = () => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return null;
  }
  for (const point of [selection.anchor, selection.focus]) {
    const node = $getNodeByKey(point.key);
    if (point.type === "element" && node !== null && isLinedContainer(node)) {
      return `${node.getType()}@${point.offset}`;
    }
  }
  return null;
};

/** Whether a line holds a non-inline child (5.5). */
const $lineHoldsBlock = () =>
  $dfs().some(
    ({ node }) =>
      $isCmsLineNode(node) &&
      node.getChildren().some((child) => isInlineContent(child) === false)
  );

/**
 * A node selection of a block in a lined container becomes a caret in a
 * line after the block; with `replace`, the block goes (a paste, a drop or
 * typing replaces it).
 */
const $nodeSelectionIntoLine = (replace: boolean, create: boolean) => {
  const selection = $getSelection();
  if ($isNodeSelection(selection) === false) {
    return;
  }
  const nodes = selection.getNodes();
  const last = nodes.at(-1);
  const container = last?.getParent() ?? null;
  if (last === undefined || isLinedContainer(container) === false) {
    return;
  }
  const index = last.getIndexWithinParent() + 1;
  const range = $createRangeSelection();
  range.anchor.set(container.getKey(), index, "element");
  range.focus.set(container.getKey(), index, "element");
  $setSelection(range);
  $liftPointsIntoLines(create);
  if (replace) {
    for (const node of nodes) {
      node.remove();
    }
  }
};

/**
 * A node selection in a lined container, for a command the head runs
 * well there (a paste of HTML or of the field's own nodes, a cut, a
 * delete): the container's lines give way to their children for this
 * update, so the head's own path runs over the head's tree, and the line
 * rules wrap the result at the end of the update. True when it did.
 */
export const $headPathOverNodeSelection = () => {
  const selection = $getSelection();
  if ($isNodeSelection(selection) === false) {
    return false;
  }
  const container = selection.getNodes().at(-1)?.getParent() ?? null;
  if (isLinedContainer(container) === false) {
    return false;
  }
  $unwrapLines(container.getChildren());
  $addUpdateTag(HEAD_PATH_TAG);
  return true;
};

const insertCommands: LexicalCommand<never>[] = [
  INSERT_PARAGRAPH_COMMAND,
  INSERT_LINE_BREAK_COMMAND,
  CONTROLLED_TEXT_INSERTION_COMMAND,
] as LexicalCommand<never>[];

/** A paste or drop at a point with no line beside it goes the head's way. */
const pasteCommands: LexicalCommand<never>[] = [
  PASTE_COMMAND,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
] as LexicalCommand<never>[];



const removeCommands: LexicalCommand<never>[] = [
  DELETE_CHARACTER_COMMAND,
  DELETE_WORD_COMMAND,
  DELETE_LINE_COMMAND,
  REMOVE_TEXT_COMMAND,
  CUT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
] as LexicalCommand<never>[];

/** The line a collapsed caret is at the start of, with no text before it. */
const $lineAtStart = () => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false || selection.isCollapsed() === false) {
    return null;
  }
  const { anchor } = selection;
  if (anchor.offset !== 0) {
    return null;
  }
  const node = anchor.getNode();
  const line = $isCmsLineNode(node)
    ? node
    : $findMatchingParent(node, $isCmsLineNode);
  if (line === null) {
    return null;
  }
  const first = line.getFirstDescendant();
  return first === null || first.is(node) || line.is(node) ? line : null;
};

const isBlockDecorator = (node: LexicalNode | null): node is DecoratorNode<unknown> =>
  $isDecoratorNode(node) && node.isInline() === false;

/**
 * The field's key rules at a line's start: Backspace outdents a nested
 * item; Ctrl+Backspace after a rule removes the rule only; Backspace at an
 * item's start after an item that ends in a rule removes the rule and
 * joins the item, as after an item that ends in text.
 */
export const registerLineCommands = (editor: LexicalEditor) =>
  linesOff ? () => {} : mergeRegister(
    // a caret that arrives with no line beside it gets an empty line, and
    // an empty line the caret left goes: not an edit (no undo step, no
    // onChange: the field's change plugin skips history-merge updates)
    editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const made = $liftPointsIntoLines(true);
        const removed = $removeLeftEmptyLines();
        if (made || removed) {
          $addUpdateTag("history-merge");
        }
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    ),
    // the rule holds in every committed state (5.3, 5.5)
    editor.registerUpdateListener(({ editorState }) => {
      const broken = editorState.read($pointRuleBroken);
      const block = editorState.read($lineHoldsBlock);
      if (broken !== null || block) {
        const message = broken !== null
          ? `cms-line point rule: a point on ${broken}`
          : "cms-line rule: a line holds a block";
        console.error(message);
        lineRuleViolations.push(message);
      }
    }),
    ...insertCommands.map((command) =>
      editor.registerCommand(
        command,
        (payload: unknown) => {
          if ($hasUpdateTag(HEAD_PATH_TAG)) {
            return false;
          }
          // a drop carries a data transfer: it is a paste
          const isDrop =
            command === CONTROLLED_TEXT_INSERTION_COMMAND &&
            typeof payload !== "string";
          const selection = $getSelection();
          if (
            $isRangeSelection(selection) &&
            selection.isCollapsed() === false
          ) {
            $tagRemoval();
          }
          // typed or composed text lands directly after a selected node,
          // which stays (D15)
          if (command === CONTROLLED_TEXT_INSERTION_COMMAND && isDrop === false) {
            $nodeSelectionIntoLine(false, true);
          }
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      )
    ),
    ...pasteCommands.map((command) =>
      editor.registerCommand(
        command,
        (payload: unknown) => {
          if ($hasUpdateTag(HEAD_PATH_TAG)) {
            return false;
          }
          const selection = $getSelection();
          if ($isRangeSelection(selection) && selection.isCollapsed() === false) {
            $tagRemoval();
          }
          const data =
            command === PASTE_COMMAND && payload instanceof ClipboardEvent
              ? payload.clipboardData
              : null;
          if (
            data !== null &&
            (data.getData("text/html") !== "" ||
              data.getData("application/x-lexical-editor") !== "") &&
            $headPathOverNodeSelection()
          ) {
            return false;
          }
          // plain text replaces the node; a clipboard of files only leaves it
          if (
            command === PASTE_COMMAND &&
            data !== null &&
            data.getData("text/plain") !== ""
          ) {
            $nodeSelectionIntoLine(true, false);
          }
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      )
    ),
    // Enter, Shift+Enter and Divider over a range remove it
    ...[INSERT_PARAGRAPH_COMMAND, INSERT_LINE_BREAK_COMMAND, INSERT_HORIZONTAL_RULE_COMMAND].map(
      (command) =>
        editor.registerCommand(
          command as LexicalCommand<unknown>,
          () => {
            const selection = $getSelection();
            if ($isRangeSelection(selection) && selection.isCollapsed() === false) {
              $tagRemoval();
            }
            return false;
          },
          COMMAND_PRIORITY_CRITICAL
        )
    ),
    ...removeCommands.map((command) =>
      editor.registerCommand(
        command,
        () => {
          if (
            $hasUpdateTag(HEAD_PATH_TAG) ||
            (command !== CUT_COMMAND && $headPathOverNodeSelection())
          ) {
            return false;
          }
          $tagRemoval();
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      )
    ),
    editor.registerCommand(
      DELETE_WORD_COMMAND,
      (isBackward: boolean) => {
        const line = $lineAtStart();
        const before = line?.getPreviousSibling() ?? null;
        if (isBackward === false || line === null || isBlockDecorator(before) === false) {
          return false;
        }
        before.remove();
        return true;
      },
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand(
      DELETE_CHARACTER_COMMAND,
      (isBackward: boolean) => {
        if (isBackward === false) {
          return false;
        }
        const selection = $getSelection();
        if ($isRangeSelection(selection) === false || selection.isCollapsed() === false) {
          return false;
        }
        const { anchor } = selection;
        const node = anchor.getNode();
        const item = $isListItemNode(node)
          ? node
          : $findMatchingParent(node, $isListItemNode);
        if (item === null || anchor.offset !== 0) {
          return false;
        }
        const first = item.getFirstDescendant();
        if (first !== null && first.is(node) === false && item.is(node) === false) {
          return false;
        }
        const previous = item.getPreviousSibling();
        if ($isListItemNode(previous) === false || isLinedContainer(previous) === false) {
          return false;
        }
        const rule = previous.getLastChild();
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
      },
      COMMAND_PRIORITY_LOW
    )
  );

/**
 * The lines among `nodes` give way to their children, in place, and the
 * nodes come back with each line replaced by its children: a lift that
 * reads inline content reads it as the head's tree held it. The line rules
 * wrap whatever stays mixed again.
 */
export const $unwrapLines = (nodes: LexicalNode[]): LexicalNode[] =>
  nodes.flatMap((node) => {
    if ($isCmsLineNode(node) === false) {
      return [node];
    }
    const children = node.getChildren();
    for (const child of children) {
      node.insertBefore(child);
    }
    node.remove();
    return children;
  });

/**
 * The selection a copy, a cut or a drag writes from: a point at the edge
 * of a line counts as the same point on the line's container (D6), so the
 * copied data holds the list item wherever the head's does.
 */
export const $mapLineEdges = (selection: BaseSelection): BaseSelection => {
  if ($isRangeSelection(selection) === false) {
    return selection;
  }
  const mapped = selection.clone();
  for (const point of [mapped.anchor, mapped.focus]) {
    const node = point.getNode();
    const line = $isCmsLineNode(node)
      ? node
      : $findMatchingParent(node, $isCmsLineNode);
    if (line === null || isLineContainer(line.getParent()) === false) {
      continue;
    }
    const first = line.getFirstDescendant();
    const last = line.getLastDescendant();
    const atStart =
      point.offset === 0 &&
      (line.is(node) || first === null || first.is(node));
    const atEnd = line.is(node)
      ? point.offset === line.getChildrenSize()
      : last !== null &&
        last.is(node) &&
        point.offset === node.getTextContentSize();
    if (atStart === false && atEnd === false) {
      continue;
    }
    const container = line.getParentOrThrow();
    point.set(
      container.getKey(),
      line.getIndexWithinParent() + (atStart ? 0 : 1),
      "element"
    );
  }
  return mapped;
};

/**
 * A caret in an empty line stands on the line's container for an edit
 * that reads leaf nodes only (the list commands): the empty line goes and
 * the caret takes its place; the line rules restore the line after.
 */
export const $caretOffEmptyLine = () => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false || selection.isCollapsed() === false) {
    return;
  }
  const line = selection.anchor.getNode();
  if ($isCmsLineNode(line) === false || line.isEmpty() === false) {
    return;
  }
  const container = line.getParentOrThrow();
  const index = line.getIndexWithinParent();
  line.remove();
  selection.anchor.set(container.getKey(), index, "element");
  selection.focus.set(container.getKey(), index, "element");
};

/**
 * Typed text with a block node-selected in a lined container lands
 * directly after the node, which stays (D15). Lexical leaves text typed
 * over a node selection to the browser, so the field takes the
 * `beforeinput` first.
 */
export const registerTypingAfterSelectedNode = (editor: LexicalEditor) =>
  linesOff ? () => {} : editor.registerRootListener((root, previous) => {
    const onBeforeInput = (event: InputEvent) => {
      if (event.inputType !== "insertText" || event.data === null) {
        return;
      }
      let handled = false;
      editor.update(() => {
        const selection = $getSelection();
        if ($isNodeSelection(selection) === false) {
          return;
        }
        const node = selection.getNodes().at(-1);
        if (
          node === undefined ||
          isBlockDecorator(node) === false ||
          isLinedContainer(node.getParent()) === false
        ) {
          return;
        }
        $nodeSelectionIntoLine(false, true);
        const range = $getSelection();
        if ($isRangeSelection(range)) {
          range.insertText(event.data ?? "");
          handled = true;
        }
      });
      if (handled) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    previous?.removeEventListener("beforeinput", onBeforeInput as EventListener, true);
    root?.addEventListener("beforeinput", onBeforeInput as EventListener, true);
  });
