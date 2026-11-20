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
  $copyNode,
  $getEditor,
  $splitNode,
  $isRootOrShadowRoot,
  $getRoot,
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
  $createNodeSelection,
  $createRangeSelectionFromDom,
  CLICK_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  CUT_COMMAND,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  DecoratorNode,
  ElementNode,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  PASTE_COMMAND,
  REMOVE_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
  type BaseSelection,
  type LexicalCommand,
  type PointType,
  ParagraphNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type RangeSelection,
  type SerializedElementNode,
  type EditorState,
  type TextNode,
  $createTextNode,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
} from "lexical";
import {
  $createListItemNode,
  $isListItemNode,
  $isListNode,
  ListItemNode,
} from "@lexical/list";
import { $createHeadingNode, $isHeadingNode, $isQuoteNode, HeadingNode, QuoteNode } from "@lexical/rich-text";
import { CodeNode } from "@lexical/code";
import { $dfs, $findMatchingParent, mergeRegister } from "@lexical/utils";
import { $isParentElementRTL } from "@lexical/selection";
import { $insertDataTransferForRichText } from "@lexical/clipboard";
import { LinkNode } from "@lexical/link";
import type { HistoryState } from "@lexical/react/LexicalHistoryPlugin";
import { $createHorizontalRuleNode, INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";

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
  /** Tests: the head-form clipboard's scratch write throws. */
  scratchClipboardFails: false,
  /** Tests: the per-cut check finds the clipboard not holding the selection. */
  cutCheckFails: false,
  /** Probes: the point rule's third place (after every commit) does not run. */
  thirdPlaceOff: false,
  /** Probes: a key does not take over a caret the page moved (15.12 off). */
  resyncOff: false,
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
    selection: RangeSelection,
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
      // at the line's end, before a block: the new item starts with that
      // block and the caret goes to its start, as at the head
      const point = selection.anchor;
      const last = this.getLastDescendant();
      const atEnd =
        (point.key === this.getKey() &&
          point.offset === this.getChildrenSize()) ||
        (last !== null &&
          point.key === last.getKey() &&
          point.offset === last.getTextContentSize());
      if (
        atEnd &&
        rest.length > 0 &&
        $isElementNode(rest[0]) &&
        rest[0].isInline() === false
      ) {
        item.append(...rest);
        return item;
      }
      const line = $createCmsLineNode();
      item.append(line, ...rest);
      return line;
    }
    // at the line's start in a quote: an empty line (one line break)
    // stays before, and the text stays a line (D2, D19)
    const point = selection.anchor;
    const first = this.getFirstDescendant();
    const atStart =
      (point.key === this.getKey() && point.offset === 0) ||
      (first !== null && point.key === first.getKey() && point.offset === 0);
    if (atStart && this.isEmpty() === false) {
      const line = $createCmsLineNode();
      this.insertAfter(line, restoreSelection);
      this.append($createLineBreakNode());
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
  if (paragraph.isEmpty()) {
    const points = elementPoints().filter(
      (point) => point.key === paragraph.getKey()
    );
    const line = $createCmsLineNode();
    paragraph.insertBefore(line, false);
    // inline content directly before ends its own line first (D19)
    const prior = line.getPreviousSibling();
    const priorEnd = $isCmsLineNode(prior) ? prior.getLastChild() : prior;
    if (
      prior !== null &&
      (isInlineContent(prior) || $isCmsLineNode(prior)) &&
      isLineBreak(priorEnd) === false
    ) {
      line.append($createLineBreakNode());
    }
    line.append($createLineBreakNode());
    paragraph.remove();
    for (const point of points) {
      setPoint(point.which, line.getKey(), 0);
    }
    return;
  }
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
    // D3's break was decided before the edit, from the selection (E3)
    if ($hasMark(`${BREAK_AFTER_TAG}${first.getKey()}`)) {
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
  // I: a paste over the node leaves the caret after what it pasted
  if ($hasUpdateTag("paste") || $hasMark(PASTE_OVER_NODE_MARK)) {
    return false;
  }
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
const REMOVAL_END_TAG = "cms-removal-end:";
const BREAK_AFTER_TAG = "cms-break-after:";
/** A paste the line code runs over a node selection (Lexical's own paste is tagged "paste"). */
const PASTE_OVER_NODE_MARK = "cms-paste-over-node";

/**
 * The field's marks: per editor, what a command decided for the rest of its
 * update (a removal, the block its range ends in, D3's break, the head's
 * path). They are not update tags: Lexical keeps the tags of a commit that
 * changes no node for the next update. A mark is gone when its update ends,
 * committed or not: everything that reads one runs inside the update (its
 * commands and transforms), so a microtask queued when the first mark is
 * set clears them once the task that ran the update is done. Updates run in
 * one task share their marks, as Lexical batches them into one commit.
 */
const lineMarks = new WeakMap<LexicalEditor, Set<string>>();
const $mark = (name: string) => {
  const editor = $getEditor();
  let marks = lineMarks.get(editor);
  if (marks === undefined) {
    const made = new Set<string>();
    marks = made;
    lineMarks.set(editor, made);
    queueMicrotask(() => {
      if (lineMarks.get(editor) === made) {
        lineMarks.delete(editor);
      }
    });
  }
  marks.add(name);
};
const $hasMark = (name: string) =>
  lineMarks.get($getEditor())?.has(name) === true;
/** The field's history (Lexical's HistoryPlugin state), for K. */
export const cmsHistory = new WeakMap<LexicalEditor, HistoryState>();
/** Per editor, the composition under way: the state before it, the undo stack's length then, the entry below it and the redo stack. */
type HistoryEntry = HistoryState["undoStack"][number];
const compositionStarts = new WeakMap<
  LexicalEditor,
  {
    before: EditorState;
    index: number;
    below: HistoryEntry | undefined;
    redo: HistoryEntry[];
    ended: boolean;
  }
>();
/** Per editor, the text the page's last composition ended with. */
const compositionEndText = new WeakMap<LexicalEditor, string>();
/**
 * Per editor, a composition an undo or a redo voided while it ran: void
 * until it runs on and then ends.
 */
const compositionVoided = new WeakMap<LexicalEditor, "voided" | "resumed">();
/** The last check after a commit left a point on a lined container. */
let checkFailed = false;

/**
 * This update removes content (a range, a node selection, a delete, a
 * cut). The block the removed range starts in, and its ancestors, are
 * never emptied by it.
 */
/**
 * Removes a range in this update, with D3's break where the range runs from
 * a line into a block of the same container and a line follows the block
 * (decided here, before the edit, from the selection): the key or paste
 * that removed it then acts at the caret this leaves (E1, F).
 */
export const $removeRangeWithBreak = (selection: RangeSelection) => {
  const start = selection.isBackward() ? selection.focus : selection.anchor;
  const end = selection.isBackward() ? selection.anchor : selection.focus;
  const line = $findMatchingParent(start.getNode(), $isCmsLineNode);
  let block: LexicalNode | null = end.getNode();
  while (block !== null && line !== null && block.getParent()?.is(line.getParent()) !== true) {
    block = block.getParent();
  }
  const next =
    $isCmsLineNode(line) && $isElementNode(block) && $isCmsLineNode(block) === false
      ? block.getNextSibling()
      : null;
  selection.removeText();
  if ($isCmsLineNode(next) === false || line === null) {
    return;
  }
  if ($isElementNode(block) && block.isAttached() && block.getTextContentSize() === 0) {
    block.remove();
  }
  if (
    next.isAttached() &&
    line.isAttached() &&
    line.getNextSibling()?.is(next) === true &&
    isLineBreak(line.getLastChild()) === false &&
    isLineBreak(next.getFirstChild()) === false
  ) {
    line.append($createLineBreakNode());
  }
};

/**
 * D3: a caret delete puts inline content of a block into the line only when
 * the block's first leaf block (the one that joins) holds a node; an empty
 * block goes whole with no break.
 */
const $joinsInlineContent = (block: ElementNode) => {
  let joined: ElementNode = block;
  for (;;) {
    const first: LexicalNode | null = joined.getFirstChild();
    if ($isElementNode(first) === false || first.isInline()) {
      return first !== null;
    }
    joined = first;
  }
};

/**
 * 5.4: a removal removes what its range holds and nothing else. A range
 * whose first point is an element point at the end of a node with children
 * holds none of those children, but Lexical's node walk resolves that point
 * to the node's last child (getDescendantByIndex past the end), and its
 * removal takes it; a caret there is the start of the range a delete
 * extends to. The point moves to the same place in text: the end of a text
 * last child, else an empty text node appended after the last child, which
 * Lexical drops when the update ends. A point on a lined container is
 * resolved by D18 instead.
 */
/**
 * A caret at the edge of an inline element's content, the element at the
 * edge of its block or line, is at that block's or line's edge: a delete in
 * that direction runs from beside the element, as at the edge of the same
 * text unwrapped.
 */
const $caretBesideInlineEdge = (isBackward: boolean, character: boolean) => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false || selection.isCollapsed() === false) {
    return false;
  }
  const inline = $inlineEdgeOf(selection.anchor, isBackward);
  if (
    inline === null ||
    (isBackward ? inline.getPreviousSibling() : inline.getNextSibling()) !== null
  ) {
    return false;
  }
  const parent = inline.getParentOrThrow();
  const offset = isBackward ? 0 : parent.getChildrenSize();
  selection.anchor.set(parent.getKey(), offset, "element");
  selection.focus.set(parent.getKey(), offset, "element");
  // Backspace at the content's start: nothing is before the caret, and
  // Lexical's own step past nothing reads the page's selection, still in
  // the link; the block's start rule runs here, as at the start of the
  // same text unwrapped (an item outdents, a paragraph stays). True when
  // the delete is decided
  if (isBackward && character && $nothingBefore(inline)) {
    parent.collapseAtStart(selection);
    return true;
  }
  return false;
};

/**
 * Enter with a collapsed caret in a heading, where Lexical's own test
 * misreads the caret (it reads the heading's end only as the end of its
 * last text, and any point at offset 0 as the heading's start). The edge
 * function decides:
 * - at the heading's content start: Lexical's rule;
 * - at its content end: a paragraph directly after the heading, with the
 *   caret in it (the line rules make that a line);
 * - between two of its children: the heading splits into two headings
 *   there, with the caret at the start of the second.
 * Wherever Lexical reads the caret right (a text point inside text, or at
 * the end of a heading's last text) it stays Lexical's. True when it wrote.
 */
const $enterInHeading = () => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false || selection.isCollapsed() === false) {
    return false;
  }
  const point = selection.anchor;
  const node = point.getNode();
  const heading = $isHeadingNode(node) ? node : $findMatchingParent(node, $isHeadingNode);
  if ($isHeadingNode(heading) === false || heading.isEmpty() || $atContentEdge(point, heading, true)) {
    return false;
  }
  if ($atContentEdge(point, heading, false)) {
    const last = heading.getLastDescendant();
    if (
      point.type === "text" &&
      $isTextNode(last) &&
      point.key === last.getKey() &&
      point.offset === last.getTextContentSize()
    ) {
      return false;
    }
    const paragraph = $createParagraphNode();
    paragraph.setDirection(heading.getDirection());
    heading.insertAfter(paragraph);
    paragraph.select();
    return true;
  }
  // the middle: only where Lexical misreads the caret
  if (point.type === "text" && point.offset > 0) {
    return false;
  }
  let index: number;
  if (point.type === "element") {
    if (node.is(heading) === false) {
      return false;
    }
    index = point.offset;
  } else {
    let child: LexicalNode = node;
    while (child.getParent()?.is(heading) === false) {
      child = child.getParentOrThrow();
    }
    if ($atContentEdge(point, child, true) === false) {
      return false;
    }
    index = child.getIndexWithinParent();
  }
  const second = $createHeadingNode(heading.getTag());
  second.setDirection(heading.getDirection());
  second.append(...heading.getChildren().slice(index));
  heading.insertAfter(second);
  second.selectStart();
  return true;
};

const $pointOffNodeEnd = (selection: RangeSelection, isBackward?: boolean) => {
  $lastPointIntoText(selection);
  const first = selection.isCollapsed()
    ? selection.anchor
    : selection.anchor.isBefore(selection.focus)
      ? selection.anchor
      : selection.focus;
  const holder = first.getNode();
  if (first.type !== "element" || $isElementNode(holder) === false) {
    return;
  }
  const lined = isLinedContainer(holder as LexicalNode);
  // the mirror: a backward delete at a caret at the start of a node whose
  // first child is not text starts in text before that child, so the line
  // rules read it as the start of the block's text (a line that starts
  // with a break has its own rule); at the content's start there is
  // nothing to remove and the caret stays
  if (lined === false && selection.isCollapsed() && isBackward === true) {
    if (first.offset === 0 && $startsWithNonText(holder) && $nothingBefore(holder) === false) {
      const at = holder.getFirstChildOrThrow();
      const text = $createTextNode("");
      at.insertBefore(text);
      selection.anchor.set(text.getKey(), 0, "text");
      selection.focus.set(text.getKey(), 0, "text");
    }
    return;
  }
  if (lined || holder.getChildrenSize() === 0 || first.offset !== holder.getChildrenSize()) {
    return;
  }
  // a caret moves only for a delete whose direction is known (a key's own
  // command dispatches the directed delete next); a forward delete with
  // nothing after it in the content has nothing to remove: the caret stays
  // and the update changes nothing
  if (
    selection.isCollapsed() &&
    (isBackward === undefined || (isBackward === false && $nothingAfter(holder)))
  ) {
    return;
  }
  const last = holder.getLastChild();
  let text: TextNode;
  if ($isTextNode(last)) {
    text = last;
  } else {
    text = $createTextNode("");
    holder.append(text);
  }
  const offset = text.getTextContentSize();
  if (selection.isCollapsed()) {
    selection.anchor.set(text.getKey(), offset, "text");
    selection.focus.set(text.getKey(), offset, "text");
  } else {
    first.set(text.getKey(), offset, "text");
  }
};

/**
 * A node whose first child is not text: an image, an inline element such
 * as a link, or a line break (not in a line: a line that starts with a
 * break has its own rule).
 */
const $startsWithNonText = (holder: ElementNode) => {
  const at = holder.getFirstChild();
  return (
    $isDecoratorNode(at) ||
    ($isElementNode(at) && at.isInline()) ||
    (isLineBreak(at) && $isCmsLineNode(holder) === false)
  );
};

/**
 * 5.4 for a range's last point: an element point at the start of a node
 * whose first child is not text holds none of that child, but Lexical's
 * node walk descends into it (getDescendantByIndex(0)); the point moves to
 * the same place in text, an empty text node before the child, which
 * Lexical drops when the update ends.
 */
const $lastPointIntoText = (selection: RangeSelection) => {
  if (selection.isCollapsed()) {
    return;
  }
  const last = selection.anchor.isBefore(selection.focus)
    ? selection.focus
    : selection.anchor;
  const holder = last.getNode();
  if (
    last.type !== "element" ||
    last.offset !== 0 ||
    $isElementNode(holder) === false ||
    isLinedContainer(holder as LexicalNode) ||
    $startsWithNonText(holder) === false
  ) {
    return;
  }
  const text = $createTextNode("");
  holder.getFirstChildOrThrow().insertBefore(text);
  last.set(text.getKey(), 0, "text");
};

/** No node before this one, its ancestors' included: the content's start. */
const $nothingBefore = (node: LexicalNode) => {
  for (let at: LexicalNode | null = node; at !== null; at = at.getParent()) {
    if (at.getPreviousSibling() !== null) {
      return false;
    }
  }
  return true;
};

/**
 * The word and line forms backward at a caret at the start of its block or
 * line (nothing before it in its node, or a line break), just before a child
 * that is not text: the line has nothing before the caret, so they take one
 * character back, as Backspace does there (at the content's start there is
 * none to take, as in text, and Lexical's own form runs). Decided here, so Lexical's
 * extension by the page's selection does not run.
 */
const $backwardFormIsBackspace = () => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false || selection.isCollapsed() === false) {
    return false;
  }
  const { anchor } = selection;
  const holder = anchor.getNode();
  if (anchor.type !== "element" || $isElementNode(holder) === false || holder.isInline()) {
    return false;
  }
  if (isLinedContainer(holder as LexicalNode)) {
    return false;
  }
  const at = holder.getChildAtIndex(anchor.offset);
  const previous = anchor.offset > 0 ? holder.getChildAtIndex(anchor.offset - 1) : null;
  return (
    at !== null &&
    $isTextNode(at) === false &&
    ($isElementNode(at) === false || at.isInline()) &&
    ((previous === null && $nothingBefore(holder) === false) || isLineBreak(previous))
  );
};

/**
 * 15.5, 15.6: the word form at a line's start after a block (backward), or
 * at its end before a block (forward), does what the character form does
 * there (D3), as at the same block holding text: the line and the block
 * join, and nothing of the block goes.
 */
const $wordFormAtLineEdgeBesideBlock = (isBackward: boolean) => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false || selection.isCollapsed() === false) {
    return false;
  }
  const point = selection.anchor;
  const node = point.getNode();
  const line = $isCmsLineNode(node) ? node : $findMatchingParent(node, $isCmsLineNode);
  if ($isCmsLineNode(line) === false || $atContentEdge(point, line, isBackward) === false) {
    return false;
  }
  const beside = isBackward ? line.getPreviousSibling() : line.getNextSibling();
  return $isElementNode(beside) && $isCmsLineNode(beside) === false && beside.isInline() === false;
};

/** A caret at the content's start, just before a first child that is not text. */
const $lineFormAtContentStart = () => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false || selection.isCollapsed() === false) {
    return false;
  }
  const { anchor } = selection;
  const holder = anchor.getNode();
  if (anchor.type !== "element" || anchor.offset !== 0 || $isElementNode(holder) === false) {
    return false;
  }
  const first = holder.getFirstChild();
  return (
    first !== null &&
    $isTextNode(first) === false &&
    ($isElementNode(first) === false || first.isInline()) &&
    $nothingBefore(holder)
  );
};

/** No node after this one, its ancestors' included: the content's end. */
const $nothingAfter = (node: LexicalNode) => {
  for (let at: LexicalNode | null = node; at !== null; at = at.getParent()) {
    if (at.getNextSibling() !== null) {
      return false;
    }
  }
  return true;
};

/**
 * The line form forward at a caret at the end of its block or line, after
 * a last child that is not text: the line's rest is empty, so it removes
 * nothing, as at the end of the same block ending in text. A rule directly
 * after is D5's. Decided here, so Lexical's extension by the page's
 * selection does not run.
 */
const $lineFormHasNothing = () => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false || selection.isCollapsed() === false) {
    return false;
  }
  const { anchor } = selection;
  const holder = anchor.getNode();
  if (anchor.type !== "element" || $isElementNode(holder) === false || holder.isInline()) {
    return false;
  }
  const last = holder.getLastChild();
  if (
    isLinedContainer(holder as LexicalNode) ||
    last === null ||
    $isTextNode(last) ||
    anchor.offset !== holder.getChildrenSize()
  ) {
    return false;
  }
  // a rule directly after the block the caret ends (its last-child ancestors
  // included) is the line form's to remove
  for (let at: LexicalNode = holder; ; ) {
    const next = at.getNextSibling();
    if (next !== null) {
      return isBlockDecorator(next) === false;
    }
    const parent = at.getParent();
    if (parent === null || isLinedContainer(parent) || $isRootOrShadowRoot(parent)) {
      return true;
    }
    at = parent;
  }
};

export const $tagRemoval = (isBackward?: boolean) => {
  $mark(REMOVAL_TAG);
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return;
  }
  $pointOffNodeEnd(selection, isBackward);
  // E3: D3's break is decided here, before the edit, from the selection:
  // a delete at a caret that joins a block's text into the line before it
  // (Backspace at the block's start) or into this line (Delete at the
  // line's end), where a line follows the block, marks that line
  if (selection.isCollapsed() && isBackward !== undefined) {
    const edge = $childAtEdge(isBackward);
    if (edge !== null) {
      const block = isBackward ? edge.child : edge.child.getNextSibling();
      const line = isBackward ? edge.child.getPreviousSibling() : edge.child;
      const after = block?.getNextSibling() ?? null;
      if (
        $isCmsLineNode(line) &&
        $isElementNode(block) &&
        $isCmsLineNode(block) === false &&
        block.isInline() === false &&
        $isCmsLineNode(after) &&
        $joinsInlineContent(block)
      ) {
        $mark(`${BREAK_AFTER_TAG}${line.getKey()}`);
      }
    }
  }
  // the block the removal ends in: its rest joins what is before (D3)
  const end = selection.isBackward() ? selection.anchor : selection.focus;
  for (
    let node: LexicalNode | null = end.getNode();
    node !== null;
    node = node.getParent()
  ) {
    $mark(`${REMOVAL_END_TAG}${node.getKey()}`);
  }
  if (selection.isCollapsed()) {
    return;
  }
  const startPoint = selection.isBackward() ? selection.focus : selection.anchor;
  const childOf = (node: LexicalNode) => {
    let child: LexicalNode | null = node;
    while (child !== null && isLinedContainer(child.getParent()) === false) {
      child = child.getParent();
    }
    return child;
  };
  const from = childOf(startPoint.getNode());
  const to = childOf(end.getNode());
  if (
    $isCmsLineNode(from) &&
    to !== null &&
    $isElementNode(to) &&
    $isCmsLineNode(to) === false &&
    from.getParent()?.is(to.getParent()) === true
  ) {
    const last = to.getLastDescendant();
    // a block with no node left after the range's end puts nothing into the line
    const atEnd =
      last === null ||
      (end.getNode().is(last) && end.offset === last.getTextContentSize());
    if (atEnd === false) {
      $mark(`${BREAK_AFTER_TAG}${from.getKey()}`);
    }
  }
  const start = selection.isBackward() ? selection.focus : selection.anchor;
  for (
    let node: LexicalNode | null = start.getNode();
    node !== null;
    node = node.getParent()
  ) {
    $mark(`${REMOVAL_START_TAG}${node.getKey()}`);
  }
};

const $dropEmptied = (node: ElementNode) => {
  if (
    lineSpike.noEmptied === false ||
    $hasMark(REMOVAL_TAG) === false ||
    $hasMark(`${REMOVAL_START_TAG}${node.getKey()}`) ||
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

/**
 * A line that comes to hold a non-inline child splits around it: the child
 * goes to the container between the two halves, and an empty half goes.
 */
const $splitAroundBlocks = (line: CmsLineNode) => {
  const children = line.getChildren();
  if (children.every((child) => isInlineContent(child))) {
    return;
  }
  let last: LexicalNode = line;
  let half: CmsLineNode | null = null;
  for (const child of children) {
    if (isInlineContent(child)) {
      if (half === null) {
        half = $createCmsLineNode();
        last.insertAfter(half);
        last = half;
      }
      half.append(child);
    } else {
      last.insertAfter(child);
      last = child;
      half = null;
    }
  }
  line.remove();
};

const $keepLineInPlace = (line: CmsLineNode) => {
  if (lineSpike.on === false) {
    return;
  }
  const parent = line.getParent();
  if (isLineContainer(parent)) {
    $splitAroundBlocks(line);
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
  // E2: a range that ended inside a block of the item leaves the item's
  // later content in its item, whatever leads the item
  if (
    previous.some(
      (child) => child.isLine === false && $hasMark(`${REMOVAL_END_TAG}${child.key}`)
    )
  ) {
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
  if ($hasMark(REMOVAL_TAG) && $joinRestOfItem(container)) {
    return;
  }
  $normaliseLines(container);
  if (container.isAttached()) {
    $liftPointsIntoLines(true);
  }
};

/**
 * The line rules. A list item's lift (`liftItem`, the live editor's
 * `$liftBlocksAfterNestedList`) runs in the same transform before the line
 * step, so it sees a pasted paragraph before it becomes a line, whatever
 * the registration order.
 */
export const registerLineTransforms = (
  editor: LexicalEditor,
  liftItem?: (item: ListItemNode) => void
) =>
  linesOff
    ? liftItem === undefined
      ? () => {}
      : editor.registerNodeTransform(ListItemNode, liftItem)
    : mergeRegister(
    editor.registerNodeTransform(CmsLineNode, $keepLineInPlace),
    editor.registerNodeTransform(ListItemNode, (item) => {
      liftItem?.(item);
      if (item.isAttached()) {
        $keepContainer(item);
      }
    }),
    editor.registerNodeTransform(QuoteNode, $keepContainer),
    editor.registerNodeTransform(LinkNode, $linkGivesUpRules),
    editor.registerNodeTransform(HeadingNode, $dropEmptiedBlockInContainer),
    editor.registerNodeTransform(CodeNode, $dropEmptiedBlockInContainer)
  );

/** A rule is never inside a link (D10): the link gives it up, split around it. */
const $linkGivesUpRules = (link: LinkNode) => {
  const children = link.getChildren();
  const at = children.findIndex((child) => isBlockDecorator(child));
  if (at === -1) {
    return;
  }
  const rule = children[at];
  const rest = children.slice(at + 1);
  link.insertAfter(rule);
  if (rest.length > 0) {
    const tail = $copyNode(link);
    rule.insertAfter(tail);
    tail.append(...rest);
  }
  if (link.getChildrenSize() === 0) {
    link.remove();
  }
};

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
export const $liftPointsIntoLines = (create: boolean, depth = 0): boolean => {
  if (lineSpike.on === false) {
    return false;
  }
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return false;
  }
  const made = new Map<string, CmsLineNode>();
  const collapsed = selection.isCollapsed();
  let gaveBack = false;
  for (const point of collapsed ? [selection.anchor] : [selection.anchor, selection.focus]) {
    if (point.type !== "element") {
      continue;
    }
    const held = point.getNode();
    if (collapsed && $isCmsLineNode(held) && isLinedContainer(held.getParent())) {
      const at = held.getIndexWithinParent();
      const before = held.getPreviousSibling();
      const after = held.getNextSibling();
      const isBeside = (node: LexicalNode | null) =>
        node !== null &&
        ($isCmsLineNode(node) || ($isElementNode(node) && node.isInline() === false));
      if (held.isEmpty() && (isBeside(before) || isBeside(after))) {
        // C2: an empty line holds the caret only while D13 holds at its
        // place: with a line or a block beside it, the point goes back to
        // the container there and resolves, and the line goes
        const container = held.getParentOrThrow();
        point.set(container.getKey(), at, "element");
        held.remove();
        gaveBack = true;
      } else {
        continue;
      }
    }
    const container = point.getNode();
    if (isLinedContainer(container) === false) {
      continue;
    }
    // D18: a line at the point (its start), else a line directly before
    // it (its end); else a block at the point (its start), else a block
    // directly before it (its end); else an empty line
    const lineAt = container.getChildAtIndex(point.offset);
    const lineBefore =
      point.offset > 0 ? container.getChildAtIndex(point.offset - 1) : null;
    if ($isCmsLineNode(lineAt) || $isCmsLineNode(lineBefore)) {
      const line = ($isCmsLineNode(lineAt) ? lineAt : lineBefore) as CmsLineNode;
      const atStart = $isCmsLineNode(lineAt);
      const edge = atStart ? line.getFirstDescendant() : line.getLastDescendant();
      if ($isTextNode(edge)) {
        point.set(edge.getKey(), atStart ? 0 : edge.getTextContentSize(), "text");
      } else {
        point.set(line.getKey(), atStart ? 0 : line.getChildrenSize(), "element");
      }
      continue;
    }
    if ($pointIntoBlockBeside(point)) {
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
  if (collapsed) {
    const { anchor, focus } = selection;
    if (anchor.is(focus) === false) {
      focus.set(anchor.key, anchor.offset, anchor.type);
    }
  }
  // J: a point moved into a nested container (an item that holds only a
  // nested list) resolves there in turn, so one resolver serves all three
  // places
  const again =
    depth < 4 &&
    [selection.anchor, selection.focus].some(
      (point) => point.type === "element" && isLinedContainer(point.getNode())
    );
  const deeper = again ? $liftPointsIntoLines(create, depth + 1) : false;
  return made.size > 0 || gaveBack || deeper;
};

/**
 * An element point on a list item or quote moves into the block at it
 * (its start), else the block directly before it (its end); a block is
 * any non-inline element, a line included. True when it moved.
 */
export const $pointIntoBlockBeside = (point: PointType) => {
  if (point.type !== "element") {
    return false;
  }
  const parent = point.getNode();
  if ($isQuoteNode(parent) === false && $isListItemNode(parent) === false) {
    return false;
  }
  const isBlock = (node: LexicalNode | null): node is ElementNode =>
    $isElementNode(node) && node.isInline() === false;
  const at = parent.getChildAtIndex(point.offset);
  const before =
    point.offset > 0 ? parent.getChildAtIndex(point.offset - 1) : null;
  const atEnd = isBlock(at) === false;
  let block = isBlock(at) ? at : isBlock(before) ? before : undefined;
  if (block === undefined) {
    return false;
  }
  for (;;) {
    const child: LexicalNode | null = atEnd
      ? block.getLastChild()
      : block.getFirstChild();
    if ($isElementNode(child)) {
      block = child;
      continue;
    }
    if ($isTextNode(child)) {
      point.set(child.getKey(), atEnd ? child.getTextContentSize() : 0, "text");
      return true;
    }
    point.set(block.getKey(), atEnd ? block.getChildrenSize() : 0, "element");
    return true;
  }
};

/**
 * Whether this update already changed a node: a selection change Lexical
 * dispatches inside an edit keeps the edit's undo step and onChange.
 * SPIKE: reads the editor's dirty sets, which Lexical keeps private.
 */
const $updateHasEdits = () => {
  const editor = $getEditor() as unknown as {
    _dirtyElements: Map<string, boolean>;
    _dirtyLeaves: Set<string>;
  };
  return editor._dirtyElements.size > 0 || editor._dirtyLeaves.size > 0;
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
  const parent = selection.getNodes().at(-1)?.getParent() ?? null;
  const container = $isCmsLineNode(parent) ? parent.getParent() : parent;
  if (isLinedContainer(container) === false) {
    return false;
  }
  $unwrapLines(container.getChildren());
  $mark(HEAD_PATH_TAG);
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

/**
 * Whether a point is at the start (end) of a node's content: nothing of
 * that content stands before (after) it, in its own node or in any node
 * between it and the scope. A link's text is its block's text, so the
 * answer climbs through inline elements as through the blocks between.
 * Every edge rule of the line code asks it.
 */
export const $atContentEdge = (
  point: PointType,
  scope: LexicalNode,
  atStart: boolean
) => {
  let node: LexicalNode | null = point.getNode();
  const size =
    point.type === "text"
      ? node.getTextContentSize()
      : $isElementNode(node)
        ? node.getChildrenSize()
        : 0;
  if (point.offset !== (atStart ? 0 : size)) {
    return false;
  }
  while (node !== null && node.is(scope) === false) {
    if ((atStart ? node.getPreviousSibling() : node.getNextSibling()) !== null) {
      return false;
    }
    node = node.getParent();
  }
  return node !== null;
};

/**
 * The outermost inline element whose content's start (end) a point is at,
 * climbing through inline elements only; null when the point is not at
 * the edge of one.
 */
const $inlineEdgeOf = (point: PointType, atStart: boolean) => {
  let found: ElementNode | null = null;
  for (
    let at: ElementNode | null = point.getNode().getParent();
    at !== null && at.isInline();
    at = at.getParent()
  ) {
    if ($atContentEdge(point, at, atStart) === false) {
      break;
    }
    found = at;
  }
  if (point.type === "element") {
    const holder = point.getNode();
    if ($isElementNode(holder) && holder.isInline() && $atContentEdge(point, holder, atStart)) {
      found ??= holder;
    }
  }
  return found;
};

/**
 * The direct child of a lined container that holds a collapsed caret at
 * its start (backward) or end (forward), with the container.
 */
const $childAtEdge = (isBackward: boolean) => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false || selection.isCollapsed() === false) {
    return null;
  }
  const point = selection.anchor;
  const node = point.getNode();
  let child: LexicalNode | null = node;
  while (child !== null && isLinedContainer(child.getParent()) === false) {
    child = child.getParent();
  }
  if (child === null || $isElementNode(child) === false) {
    return null;
  }
  return $atContentEdge(point, child, isBackward)
    ? { child, container: child.getParentOrThrow() }
    : null;
};

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

/**
 * The focus at a block's edge in a lined container, with a rule directly
 * beside the block in the direction of the key, moves past the rule: the
 * container point on the rule's far side, resolved by D18. True when it moved.
 */
const $focusPastRule = (selection: RangeSelection, isBackward: boolean) => {
  const focus = selection.focus;
  const node = focus.getNode();
  let child: LexicalNode | null = node;
  while (child !== null && isLinedContainer(child.getParent()) === false) {
    child = child.getParent();
  }
  // a block, or an empty caret line (15.3), at whose edge the focus stands
  if (
    child === null ||
    $isElementNode(child) === false ||
    ($isCmsLineNode(child) && child.isEmpty() === false)
  ) {
    return false;
  }
  if ($atContentEdge(focus, child, isBackward) === false) {
    return false;
  }
  const rule = isBackward ? child.getPreviousSibling() : child.getNextSibling();
  if (isBlockDecorator(rule) === false) {
    return false;
  }
  const container = child.getParentOrThrow();
  const index = rule.getIndexWithinParent();
  focus.set(container.getKey(), isBackward ? index : index + 1, "element");
  $liftPointsIntoLines(false);
  return true;
};

/**
 * 14.7: the direction an arrow key moves the caret, as Lexical's own
 * character move takes it: by the direction of the block the selection is
 * in, where ArrowLeft moves forward in right-to-left text. Every arrow rule
 * of the line code reads its direction here.
 */
/**
 * 15.4: the directions of the content directly before and after a node (a
 * rule), skipping none: a side with no content, or a rule, has none. True
 * when both sides have one and they differ.
 */
const $sidesDiffer = (first: LexicalNode, last: LexicalNode = first) => {
  const directionOf = (node: LexicalNode | null) => {
    if (node === null || isBlockDecorator(node)) {
      return null;
    }
    for (let at: LexicalNode | null = node; at !== null; at = at.getParent()) {
      if ($isElementNode(at) && at.isInline() === false && at.getDirection() !== null) {
        return at.getDirection();
      }
    }
    return null;
  };
  const before = directionOf(first.getPreviousSibling());
  const after = directionOf(last.getNextSibling());
  return before !== null && after !== null && before !== after;
};

const $arrowMovesBackward = (isLeftKey: boolean, byFocus = false) => {
  const selection = $getSelection();
  let isRtl = false;
  if ($isRangeSelection(selection) && byFocus) {
    // 15.3: a range's moving point goes by the block the focus is in
    let at: LexicalNode | null = selection.focus.getNode();
    while (at !== null && ($isElementNode(at) === false || at.isInline() || at.getDirection() === null)) {
      at = at.getParent();
    }
    isRtl = $isElementNode(at) && at.getDirection() === "rtl";
  } else if ($isRangeSelection(selection)) {
    isRtl = $isParentElementRTL(selection);
  } else if ($isNodeSelection(selection)) {
    // 15.4: off a selected node, the key steps the way it moves a caret in
    // the direction of the content directly before and after the node; where
    // the two sides differ, Lexical's own rule: ArrowLeft to the previous
    // place, ArrowRight to the next
    const nodes = selection.getNodes();
    const first = nodes[0];
    const last = nodes.at(-1);
    if (first === undefined || last === undefined) {
      return isLeftKey;
    }
    if ($sidesDiffer(first, last)) {
      return isLeftKey;
    }
    const side = [first.getPreviousSibling(), last.getNextSibling()].find(
      (node) => node !== null && isBlockDecorator(node) === false
    );
    const block = $isElementNode(side) ? side : (side?.getParent() ?? first.getParent());
    isRtl = block?.getDirection() === "rtl";
  }
  return isLeftKey !== isRtl;
};

/** The page's caret position at a point of the viewport. */
const caretAtPoint = (x: number, y: number): { node: Node; offset: number } | null => {
  const withPosition = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  const position = withPosition.caretPositionFromPoint?.(x, y);
  if (position !== undefined && position !== null) {
    return { node: position.offsetNode, offset: position.offset };
  }
  const range = document.caretRangeFromPoint?.(x, y);
  return range === null || range === undefined
    ? null
    : { node: range.startContainer, offset: range.startOffset };
};

const isBlockDecorator = (node: LexicalNode | null): node is DecoratorNode<unknown> =>
  $isDecoratorNode(node) && node.isInline() === false;

/**
 * The field's key rules at a line's start: Backspace outdents a nested
 * item; Ctrl+Backspace after a rule removes the rule only; Backspace at an
 * item's start after an item that ends in a rule removes the rule and
 * joins the item, as after an item that ends in text.
 */
export const registerLineCommands = (editor: LexicalEditor) => {
  if (linesOff) {
    return () => {};
  }
  type PageSelection = { anchorNode: Node; anchorOffset: number; focusNode: Node; focusOffset: number };
  // the page's selection as Lexical last wrote or read it
  let pageSelection: PageSelection | null = null;
  const pageSnapshot = (): PageSelection | null => {
    const dom = window.getSelection();
    const root = editor.getRootElement();
    if (
      dom === null ||
      root === null ||
      dom.anchorNode === null ||
      dom.focusNode === null ||
      root.contains(dom.anchorNode) === false ||
      root.contains(dom.focusNode) === false
    ) {
      return null;
    }
    return { anchorNode: dom.anchorNode, anchorOffset: dom.anchorOffset, focusNode: dom.focusNode, focusOffset: dom.focusOffset };
  };
  let shiftPressTaken = false;
  const onShiftPress = (event: PointerEvent) => {
    shiftPressTaken = false;
    if (event.shiftKey === false || event.button !== 0) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest("hr, img, figure") !== null) {
      return;
    }
    const isNodeSelected = editor.getEditorState().read(() => $isNodeSelection($getSelection()));
    const root = editor.getRootElement();
    const dom = window.getSelection();
    const clicked = caretAtPoint(event.clientX, event.clientY);
    if (isNodeSelected === false || dom === null || clicked === null || root?.contains(clicked.node) !== true) {
      return;
    }
    shiftPressTaken = true;
    dom.collapse(clicked.node, clicked.offset);
    editor.update(
      () => {
        const range = $createRangeSelectionFromDom(dom, editor);
        if (range !== null) {
          $setSelection(range);
        }
      },
      { discrete: true }
    );
  };
  // the press the field took: the page does not extend its own selection
  const onShiftMouseDown = (event: MouseEvent) => {
    if (shiftPressTaken) {
      shiftPressTaken = false;
      event.preventDefault();
    }
  };
  return mergeRegister(
    // a caret that arrives with no line beside it gets an empty line, and
    // an empty line the caret left goes: not an edit (no undo step, no
    // onChange: the field's change plugin skips history-merge updates)
    editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const edited = $updateHasEdits();
        const made = $liftPointsIntoLines(true);
        const removed = $removeLeftEmptyLines();
        if ((made || removed) && edited === false) {
          $addUpdateTag("history-merge");
        }
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    ),
    // an arrow off a node-selected rule in a lined container steps beside
    // it and resolves the point there (5.3)
    ...([
      [KEY_ARROW_LEFT_COMMAND, true],
      [KEY_ARROW_RIGHT_COMMAND, false],
    ] as const).map(([command, isLeftKey]) =>
      editor.registerCommand(
        command,
        (event: KeyboardEvent) => {
          const isBackward = $arrowMovesBackward(isLeftKey);
          if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
            return false;
          }
          const selection = $getSelection();
          if ($isNodeSelection(selection) === false) {
            return false;
          }
          const node = selection.getNodes().at(isBackward ? 0 : -1);
          if (
            node === undefined ||
            isBlockDecorator(node) === false ||
            isLinedContainer(node.getParent()) === false
          ) {
            return false;
          }
          event.preventDefault();
          if (isBackward) {
            node.selectPrevious();
          } else {
            node.selectNext();
          }
          // a caret move, not an edit: a caret line made or removed is merged
          // into the history's current step (the lift is true only then)
          const edited = $updateHasEdits();
          if ($liftPointsIntoLines(true) && edited === false) {
            $addUpdateTag("history-merge");
          }
          return true;
        },
        COMMAND_PRIORITY_LOW
      )
    ),
    // an arrow from a block's edge into a line that starts (going right) or
    // ends (going left) with a line break steps past the break: the point
    // before or after it is the block's edge at the head (V10)
    ...([
      [KEY_ARROW_LEFT_COMMAND, true],
      [KEY_ARROW_RIGHT_COMMAND, false],
    ] as const).map(([command, isLeftKey]) =>
      editor.registerCommand(
        command,
        (event: KeyboardEvent) => {
          const isBackward = $arrowMovesBackward(isLeftKey, event.shiftKey);
          if (event.altKey || event.ctrlKey || event.metaKey) {
            return false;
          }
          const selection = $getSelection();
          if ($isRangeSelection(selection) === false) {
            return false;
          }
          // 14.3: with Shift held, from a block's edge toward a rule
          // directly beside it the focus takes the caret's step and passes
          // the rule, to where D18 resolves the container point on its far
          // side; the rule is inside the selection
          if (event.shiftKey && $focusPastRule(selection, isBackward)) {
            event.preventDefault();
            return true;
          }
          // B: from the edge of a block's text toward a rule directly beside
          // the block, the arrow node-selects the rule
          if (event.shiftKey === false && selection.isCollapsed()) {
            const edge = $childAtEdge(isBackward);
            const rule =
              edge === null
                ? null
                : isBackward
                  ? edge.child.getPreviousSibling()
                  : edge.child.getNextSibling();
            if (isBlockDecorator(rule)) {
              event.preventDefault();
              const nodes = $createNodeSelection();
              nodes.add(rule.getKey());
              $setSelection(nodes);
              return true;
            }
          }
          // going right from the end of a line that ends in a break, with a
          // block directly after the line: the block's start is the same
          // place, so the next stop is one character into the block, as at
          // the head
          if (event.shiftKey === false && isBackward === false && selection.isCollapsed()) {
            const at = selection.anchor;
            const atNode = at.getNode();
            const line = $isCmsLineNode(atNode) ? atNode : $findMatchingParent(atNode, $isCmsLineNode);
            const last = $isCmsLineNode(line) ? line.getLastChild() : null;
            const block = line?.getNextSibling() ?? null;
            const atEnd =
              $isCmsLineNode(line) &&
              isLineBreak(last) &&
              at.type === "element" &&
              atNode.is(line) &&
              at.offset === line.getChildrenSize();
            const first = $isElementNode(block) ? block.getFirstDescendant() : null;
            if (
              atEnd &&
              $isElementNode(block) &&
              $isCmsLineNode(block) === false &&
              block.isInline() === false &&
              $isTextNode(first) &&
              first.getTextContentSize() > 0
            ) {
              event.preventDefault();
              first.select(1, 1);
              return true;
            }
          }
          const focus = selection.focus;
          const node = focus.getNode();
          let child: LexicalNode | null = node;
          while (child !== null && isLinedContainer(child.getParent()) === false) {
            child = child.getParent();
          }
          if (child === null || $isCmsLineNode(child) || $isElementNode(child) === false) {
            return false;
          }
          if ($atContentEdge(focus, child, isBackward) === false) {
            return false;
          }
          const line = isBackward ? child.getPreviousSibling() : child.getNextSibling();
          if ($isCmsLineNode(line) === false) {
            return false;
          }
          const brk = isBackward ? line.getLastChild() : line.getFirstChild();
          if (isLineBreak(brk) === false) {
            return false;
          }
          event.preventDefault();
          // with Shift going right the focus stops before the break, where
          // the head's does (the container's point beside the block)
          // going right the walk stops before the break after a quote and
          // past it after a heading or code block, as the head's does
          const offset = isBackward
            ? line.getChildrenSize() - 1
            : $isQuoteNode(child) || event.shiftKey
              ? 0
              : 1;
          focus.set(line.getKey(), offset, "element");
          if (event.shiftKey === false) {
            selection.anchor.set(line.getKey(), offset, "element");
          }
          return true;
        },
        COMMAND_PRIORITY_NORMAL
      )
    ),
    // the caret's line: while a point stands after the last line break of a
    // line that has something after it, the line's element is marked, so
    // the break Lexical adds is drawn and the caret stands on the line the
    // next letter lands on. The mark is on the page only, never in the
    // editor's state
    editor.registerUpdateListener(({ editorState }) => {
      const marked = new Set<string>();
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) === false) {
          return;
        }
        for (const point of [selection.anchor, selection.focus]) {
          const line = point.getNode();
          if (
            $isCmsLineNode(line) &&
            point.type === "element" &&
            point.offset === line.getChildrenSize() &&
            isLineBreak(line.getLastChild()) &&
            line.getNextSibling() !== null
          ) {
            marked.add(line.getKey());
          }
        }
      });
      const root = editor.getRootElement();
      if (root === null) {
        return;
      }
      for (const element of Array.from(root.querySelectorAll("[data-cms-caret]"))) {
        element.removeAttribute("data-cms-caret");
      }
      for (const key of marked) {
        editor.getElementByKey(key)?.setAttribute("data-cms-caret", "");
      }
    }),
    // 15.12: a key starts from where the page's caret is when the page has
    // moved it since Lexical last wrote or read the selection. A step the
    // page took itself (a caret move inside text) reaches Lexical only when
    // the page's selectionchange is read back, and Lexical's keydown update
    // keeps its last selection; a key that comes before that read would act
    // at the place the page has left (an Enter splitting there, a delete
    // deciding from there). Where the page has not moved, Lexical's own
    // selection stands as it is (a point the page cannot draw apart, a
    // pending format)
    editor.registerUpdateListener(({ editorState, prevEditorState }) => {
      // a commit that wrote the selection
      const next = editorState.read(() => $getSelection());
      const prev = prevEditorState.read(() => $getSelection());
      if (next === prev || (next !== null && prev !== null && next.is(prev))) {
        return;
      }
      pageSelection = pageSnapshot();
    }),
    editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        pageSelection = pageSnapshot();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    ),
    editor.registerCommand(
      KEY_DOWN_COMMAND,
      () => {
        if (editor.isComposing() || lineSpike.resyncOff) {
          return false;
        }
        const now = pageSnapshot();
        const was = pageSelection;
        if (
          now === null ||
          (was !== null &&
            now.anchorNode === was.anchorNode &&
            now.anchorOffset === was.anchorOffset &&
            now.focusNode === was.focusNode &&
            now.focusOffset === was.focusOffset)
        ) {
          return false;
        }
        const selection = $getSelection();
        const dom = window.getSelection();
        if ($isRangeSelection(selection) === false || dom === null) {
          return false;
        }
        const page = $createRangeSelectionFromDom(dom, editor);
        if (page !== null) {
          $setSelection(page);
        }
        pageSelection = now;
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    ),
    // 15.7: Shift and a press on text while a node is selected: the field
    // takes the pressed point when the pointer goes down, so the page's
    // extension from its own anchor never becomes the selection, whichever
    // of the page's selectionchange and the click comes first
    editor.registerRootListener((root, previous) => {
      previous?.removeEventListener("pointerdown", onShiftPress, true);
      previous?.removeEventListener("mousedown", onShiftMouseDown, true);
      root?.addEventListener("pointerdown", onShiftPress, true);
      root?.addEventListener("mousedown", onShiftMouseDown, true);
    }),
    // L: a click on text after a node was selected gives a real caret, as
    // Lexical already does for a touch; with Shift held too, a caret at the
    // click, never the page's range (14.2)
    editor.registerCommand(
      CLICK_COMMAND,
      (event: MouseEvent) => {
        const selection = $getSelection();
        if (selection !== null && $isNodeSelection(selection) === false) {
          return false;
        }
        const target = event.target;
        if (target instanceof Element && target.closest("hr, img, figure") !== null) {
          return false;
        }
        const dom = window.getSelection();
        const root = editor.getRootElement();
        if (dom !== null && event.shiftKey) {
          const clicked = caretAtPoint(event.clientX, event.clientY);
          if (clicked !== null && root?.contains(clicked.node) === true) {
            dom.collapse(clicked.node, clicked.offset);
          }
        }
        const at = dom?.anchorNode ?? null;
        if (dom === null || at === null || root?.contains(at) !== true) {
          return false;
        }
        const range = $createRangeSelectionFromDom(dom, editor);
        if (range !== null) {
          $setSelection(range);
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    ),
    // the third place of 5.3: after every commit, a point that rests on a
    // lined container resolves at once, in an update of its own that makes
    // no undo step and fires no onChange; the rule then holds (5.3, 5.5)
    editor.registerUpdateListener(({ editorState }) => {
      const report = (message: string) => {
        console.error(message);
        lineRuleViolations.push(message);
      };
      if (editorState.read($lineHoldsBlock)) {
        report("cms-line rule: a line holds a block");
      }
      // held while a composition runs: it adds no update between the
      // composition's own; the commit that ends it is checked
      if (editor.isComposing() || lineSpike.thirdPlaceOff) {
        return;
      }
      const broken = editorState.read($pointRuleBroken);
      if (broken === null) {
        checkFailed = false;
        return;
      }
      // a check that could not resolve the point has reported it already
      if (checkFailed) {
        checkFailed = false;
        return;
      }
      editor.update(() => {
        // a point moved and nothing else changed is no edit (no onChange, no
        // step) and carries no tag; a caret line made or removed is merged
        // into the history's current step and fires no onChange
        if ($liftPointsIntoLines(true)) {
          $addUpdateTag("history-merge");
        }
        const still = $pointRuleBroken();
        if (still !== null) {
          checkFailed = true;
          report(`cms-line point rule: a point on ${still}`);
        }
      }, { discrete: true });
    }),
    ...insertCommands.map((command) =>
      editor.registerCommand(
        command,
        (payload: unknown) => {
          if ($hasMark(HEAD_PATH_TAG)) {
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
          if ($hasMark(HEAD_PATH_TAG)) {
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
          const isRich =
            data !== null &&
            (data.getData("text/html") !== "" ||
              data.getData("application/x-lexical-editor") !== "");
          // 14.8 (D15): in a lined container that starts with a block,
          // where the head's own path does not end, Lexical's order for a
          // node selection, with the point after the last selected node
          // resolved by D18 first: the paste runs at that caret, as a paste
          // there does (D14), then the selected nodes go. A container that
          // starts with a line keeps the head's write
          if (isRich && $isNodeSelection(selection)) {
            const nodes = selection.getNodes();
            const container = nodes.at(-1)?.getParent() ?? null;
            if (
              isLinedContainer(container) &&
              $isCmsLineNode(container.getFirstChild()) === false
            ) {
              $nodeSelectionIntoLine(false, true);
              const caret = $getSelection();
              if ($isRangeSelection(caret)) {
                (payload as ClipboardEvent).preventDefault();
                $mark(PASTE_OVER_NODE_MARK);
                $insertDataTransferForRichText(data, caret, $getEditor());
                for (const node of nodes) {
                  if (node.isAttached()) {
                    node.remove();
                  }
                }
                return true;
              }
            }
          }
          if (isRich && $headPathOverNodeSelection()) {
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
            if (command === INSERT_PARAGRAPH_COMMAND && $enterInHeading()) {
              return true;
            }
            const selection = $getSelection();
            if ($isRangeSelection(selection) && selection.isCollapsed() === false) {
              $tagRemoval();
              // E1: Enter or Shift+Enter over a range from a line into a
              // block is the removal (with D3's break, decided before the
              // edit by the removal's mark), then the key at its caret
              const start = selection.isBackward() ? selection.focus : selection.anchor;
              const line = $findMatchingParent(start.getNode(), $isCmsLineNode);
              if (
                command !== INSERT_HORIZONTAL_RULE_COMMAND &&
                $isCmsLineNode(line) &&
                $hasMark(`${BREAK_AFTER_TAG}${line.getKey()}`)
              ) {
                $removeRangeWithBreak(selection);
                return false;
              }
            }
            // Divider in a line splits as at the head: the container's
            // lines give way to their text for this update (V1)
            // Divider over a range keeps the head's write: the lines of the
            // containers its ends stand in give way for this update (A4)
            if (
              command === INSERT_HORIZONTAL_RULE_COMMAND &&
              $isRangeSelection(selection) &&
              selection.isCollapsed() === false
            ) {
              for (const point of [selection.anchor, selection.focus]) {
                const line = $findMatchingParent(point.getNode(), $isCmsLineNode);
                const container = line?.getParent() ?? null;
                if (container !== null && container.isAttached()) {
                  $unwrapLines(container.getChildren());
                }
              }
              return false;
            }
            if (command === INSERT_HORIZONTAL_RULE_COMMAND && $isRangeSelection(selection)) {
              const line = $findMatchingParent(selection.anchor.getNode(), $isCmsLineNode);
              const container = line?.getParent() ?? null;
              if (line !== null && container !== null) {
                $unwrapLines(container.getChildren());
                // a caret at the end of a link's text stands after the link,
                // as a text end does in V1
                const range = $getSelection();
                if ($isRangeSelection(range) && range.isCollapsed()) {
                  const link = $inlineEdgeOf(range.anchor, false);
                  const parent = link?.getParent() ?? null;
                  if (link !== null && parent !== null) {
                    const at = link.getIndexWithinParent() + 1;
                    range.anchor.set(parent.getKey(), at, "element");
                    range.focus.set(parent.getKey(), at, "element");
                  }
                }
              } else {
                // any caret in a quote, heading or code block of a lined
                // list item: the split goes up to the root at the caret, and
                // nothing empty is left; at the block's edge the rule goes
                // directly before or after it, at the item's edge before or
                // after the item (A1, A2), and between a quote's paragraphs
                // the quote splits there (15.8)
                const range = $getSelection();
                let child: LexicalNode | null = $isRangeSelection(range) && range.isCollapsed() ? range.anchor.getNode() : null;
                while (child !== null && isLinedContainer(child.getParent()) === false) {
                  child = child.getParent();
                }
                const item = child?.getParent() ?? null;
                if (
                  $isRangeSelection(range) &&
                  child !== null &&
                  $isListItemNode(item) &&
                  ["quote", "heading", "code"].includes(child.getType())
                ) {
                  const rule = $createHorizontalRuleNode();
                  const point = range.anchor;
                  let node: ElementNode;
                  let offset: number;
                  const at = point.getNode();
                  if (point.type === "text") {
                    const parentOfText = at.getParentOrThrow();
                    if (point.offset === 0) {
                      offset = at.getIndexWithinParent();
                    } else if (point.offset >= at.getTextContentSize()) {
                      offset = at.getIndexWithinParent() + 1;
                    } else {
                      const [left] = ($isTextNode(at) ? at.splitText(point.offset) : [at]) as LexicalNode[];
                      offset = left.getIndexWithinParent() + 1;
                    }
                    node = parentOfText;
                  } else {
                    node = at as ElementNode;
                    offset = point.offset;
                  }
                  // climb while the point is at a container's edge; where it
                  // stands inside one, Lexical's split takes it up to the root
                  for (;;) {
                    const parent = node.getParent();
                    if (parent === null || $isRootOrShadowRoot(parent)) break;
                    if (offset === 0) {
                      offset = node.getIndexWithinParent();
                    } else if (offset >= node.getChildrenSize()) {
                      offset = node.getIndexWithinParent() + 1;
                    } else {
                      break;
                    }
                    node = parent;
                  }
                  const parent = node.getParent();
                  if (parent !== null && $isRootOrShadowRoot(parent) && offset === 0) {
                    node.insertBefore(rule);
                  } else if (parent !== null && $isRootOrShadowRoot(parent) && offset >= node.getChildrenSize()) {
                    node.insertAfter(rule);
                  } else {
                    const [, right] = $splitNode(node, offset);
                    right.insertBefore(rule);
                  }
                  const next = rule.getNextSibling();
                  if (next !== null) {
                    next.selectStart();
                  } else {
                    const paragraph = $createParagraphNode();
                    rule.insertAfter(paragraph);
                    paragraph.select();
                  }
                  return true;
                }
              }
            }
            return false;
          },
          COMMAND_PRIORITY_CRITICAL
        )
    ),
    ...removeCommands.map((command) =>
      editor.registerCommand(
        command,
        (payload: unknown) => {
          if (
            $hasMark(HEAD_PATH_TAG) ||
            (command !== CUT_COMMAND && $headPathOverNodeSelection())
          ) {
            return false;
          }
          if (
            command === DELETE_CHARACTER_COMMAND ||
            command === DELETE_WORD_COMMAND ||
            command === DELETE_LINE_COMMAND
          ) {
            if ($caretBesideInlineEdge(payload as boolean, command === DELETE_CHARACTER_COMMAND)) {
              return true;
            }
          }
          if (command === DELETE_WORD_COMMAND && $wordFormAtLineEdgeBesideBlock(payload as boolean)) {
            $getEditor().dispatchCommand(DELETE_CHARACTER_COMMAND, payload as boolean);
            return true;
          }
          if (command === DELETE_LINE_COMMAND && payload === false && $lineFormHasNothing()) {
            return true;
          }
          // the line form backward at the content's start, before a first
          // child that is not text, has nothing to remove (as in text)
          if (command === DELETE_LINE_COMMAND && payload === true && $lineFormAtContentStart()) {
            return true;
          }
          if (
            (command === DELETE_LINE_COMMAND || command === DELETE_WORD_COMMAND) &&
            payload === true &&
            $backwardFormIsBackspace()
          ) {
            $getEditor().dispatchCommand(DELETE_CHARACTER_COMMAND, true);
            return true;
          }
          $tagRemoval(
            command === DELETE_CHARACTER_COMMAND ||
              command === DELETE_WORD_COMMAND ||
              command === DELETE_LINE_COMMAND
              ? (payload as boolean)
              : undefined
          );
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      )
    ),
    // a word or line delete that meets a rule first, in its direction,
    // inside one lined container removes the rule only (D5)
    ...[DELETE_WORD_COMMAND, DELETE_LINE_COMMAND].map((command) =>
      editor.registerCommand(
        command as LexicalCommand<boolean>,
        (isBackward: boolean) => {
          const beside = $ruleAtEdge(isBackward);
          if (beside === null) {
            return false;
          }
          beside.remove();
          return true;
        },
        COMMAND_PRIORITY_LOW
      )
    ),
    // in an empty line beside rules: Backspace removes the rule directly
    // before, Delete the one directly after, and nothing else; with no rule
    // that way, the delete joins as at an ordinary item's text edge
    ...[DELETE_CHARACTER_COMMAND, DELETE_WORD_COMMAND, DELETE_LINE_COMMAND].map((command) =>
      editor.registerCommand(
        command as LexicalCommand<boolean>,
        (isBackward: boolean) => {
          const selection = $getSelection();
          if ($isRangeSelection(selection) === false || selection.isCollapsed() === false) {
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
        },
        COMMAND_PRIORITY_NORMAL
      )
    ),
    // D3's fourth case and D9: Backspace at a block's start removes a line
    // break or a rule directly before the block; Delete at its end, one
    // directly after. The word and line forms take the line break too, and
    // a line break is never pulled into the block
    ...[DELETE_CHARACTER_COMMAND, DELETE_WORD_COMMAND, DELETE_LINE_COMMAND].map((command) =>
      editor.registerCommand(
        command as LexicalCommand<boolean>,
        (isBackward: boolean) => {
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
        },
        COMMAND_PRIORITY_LOW
      )
    ),
    // D3's third case, Delete form: at the end of a line that ends in a line
    // break, the text of the block directly after joins the line and the
    // line break stays
    ...[DELETE_CHARACTER_COMMAND, DELETE_WORD_COMMAND, DELETE_LINE_COMMAND].map((command) =>
      editor.registerCommand(
        command as LexicalCommand<boolean>,
        (isBackward: boolean) => {
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
        },
        COMMAND_PRIORITY_LOW
      )
    ),
    // Backspace at the start of a line that starts with a line break,
    // directly after a block: the break goes and the caret stands at the
    // block's end
    ...[DELETE_CHARACTER_COMMAND, DELETE_WORD_COMMAND, DELETE_LINE_COMMAND].map((command) =>
      editor.registerCommand(
        command as LexicalCommand<boolean>,
        (isBackward: boolean) => {
          const selection = $getSelection();
          if (isBackward === false || $isRangeSelection(selection) === false || selection.isCollapsed() === false) {
            return false;
          }
          const { anchor } = selection;
          const line = anchor.getNode();
          if (anchor.type !== "element" || anchor.offset !== 0 || $isCmsLineNode(line) === false) {
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
        },
        COMMAND_PRIORITY_LOW
      )
    ),
    // D3's second case: Backspace at the start of a line directly after a
    // block whose last paragraph ends in an image moves the line's content
    // to the end of that paragraph; the image stays (Lexical's own delete
    // would take the image first)
    editor.registerCommand(
      DELETE_CHARACTER_COMMAND,
      (isBackward: boolean) => {
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
        const line = $isCmsLineNode(node) ? node : $findMatchingParent(node, $isCmsLineNode);
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
      },
      COMMAND_PRIORITY_NORMAL
    ),
    ...[DELETE_CHARACTER_COMMAND, DELETE_WORD_COMMAND, DELETE_LINE_COMMAND].map((command) =>
      editor.registerCommand(
        command as LexicalCommand<boolean>,
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
        if (item === null || $atContentEdge(anchor, item, true) === false) {
          return false;
        }
        const previous = item.getPreviousSibling();
        if ($isListItemNode(previous) === false || isLinedContainer(previous) === false) {
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
      },
      COMMAND_PRIORITY_LOW
    )
    )
  );
};

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
    const container = node.getParent();
    const base = node.getIndexWithinParent();
    const onLine = elementPoints().filter((point) => point.key === node.getKey());
    const children = node.getChildren();
    queueLinePoints.push(
      ...onLine.map((point) => ({
        which: point.which,
        key: container?.getKey() ?? "",
        offset: base + point.offset,
      }))
    );
    for (const child of children) {
      node.insertBefore(child);
    }
    node.remove();
    for (const point of queueLinePoints.splice(0)) {
      if (point.key !== "") {
        setPoint(point.which, point.key, point.offset);
      }
    }
    return children;
  });

const queueLinePoints: ElementPoint[] = [];

/**
 * The text/plain of a copy or a cut (D6, F7): the head's for the same
 * selection, read with each line's children standing in its container as
 * at the head, plus one new line where a line's text meets the text of a
 * block before it, which the head runs together.
 */
/**
 * The nodes a range holds, in document order, read from the tree by the
 * field's own order of the two ends (not Lexical's node walk, which reads
 * an element-point end as a child of its node): an element that overlaps
 * the range, a text node with a character inside it, and an image, rule or
 * line break wholly inside it. The two ends come first and last.
 */
const $nodesInRange = (selection: RangeSelection) => {
  const pathOf = (node: LexicalNode) => {
    const path: number[] = [];
    let at: LexicalNode = node;
    while (at.getParent() !== null) {
      path.unshift(at.getIndexWithinParent());
      at = at.getParentOrThrow();
    }
    return path;
  };
  const placeOf = (point: PointType) => {
    const node = point.getNode();
    if (point.type === "element") {
      return [...pathOf(node), point.offset];
    }
    const path = pathOf(node);
    const index = path.pop() ?? 0;
    return [...path, index + point.offset / (node.getTextContentSize() + 1)];
  };
  const compare = (a: number[], b: number[]) => {
    for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
      if (a[index] !== b[index]) {
        return a[index] - b[index];
      }
    }
    return a.length - b.length;
  };
  const anchorFirst = compare(placeOf(selection.anchor), placeOf(selection.focus)) <= 0;
  const [start, end] = anchorFirst
    ? [selection.anchor, selection.focus]
    : [selection.focus, selection.anchor];
  const from = placeOf(start);
  const to = placeOf(end);
  const nodes: LexicalNode[] = [];
  const walk = (node: LexicalNode) => {
    const path = pathOf(node);
    const index = path.pop() ?? 0;
    const before = [...path, index];
    const after = [...path, index + 1];
    if ($isElementNode(node)) {
      // inside the element: its own path is a prefix of every point in it
      const opens = [...path, index];
      const overlaps = compare(after, from) > 0 && compare(opens, to) < 0;
      if (overlaps && node.getParent() !== null) {
        nodes.push(node);
      }
      if (overlaps || node.getParent() === null) {
        node.getChildren().forEach(walk);
      }
      return;
    }
    if ($isTextNode(node)) {
      const size = node.getTextContentSize();
      const first = [...path, index + 0 / (size + 1)];
      const lastChar = [...path, index + size / (size + 1)];
      if (size > 0 && compare(lastChar, from) > 0 && compare(first, to) < 0) {
        nodes.push(node);
      }
      return;
    }
    if (compare(before, from) >= 0 && compare(after, to) <= 0) {
      nodes.push(node);
    }
  };
  walk($getRoot());
  return { nodes, start, end };
};

/** What a range or node selection holds: its text (no new lines), images and rules. */
export type HeldContent = { text: string; images: number; rules: number };

export const $heldContent = (selection: BaseSelection): HeldContent => {
  const held: HeldContent = { text: "", images: 0, rules: 0 };
  const count = (node: LexicalNode) => {
    if (node.getType() === "cms-image") {
      held.images += 1;
    } else if (node.getType() === "horizontalrule") {
      held.rules += 1;
    }
  };
  if ($isRangeSelection(selection)) {
    const { nodes, start, end } = $nodesInRange(selection);
    for (const node of nodes) {
      if ($isTextNode(node)) {
        const text = node.getTextContent();
        const from = start.type === "text" && start.key === node.getKey() ? start.offset : 0;
        const to = end.type === "text" && end.key === node.getKey() ? end.offset : text.length;
        held.text += text.slice(from, to);
      } else {
        count(node);
      }
    }
    return held;
  }
  const walk = (node: LexicalNode) => {
    if ($isTextNode(node)) {
      held.text += node.getTextContent();
      return;
    }
    count(node);
    if ($isElementNode(node)) {
      node.getChildren().forEach(walk);
    }
  };
  selection.getNodes().forEach(walk);
  return held;
};

export const $plainTextOf = (selection: BaseSelection): string => {
  if ($isRangeSelection(selection) === false) {
    return selection.getTextContent();
  }
  const { nodes, start, end } = $nodesInRange(selection);
  // a range that ends at the start of a line after a block holds the break
  // between them (F7): text/plain ends with a new line. The end is on the
  // line at its start, or the container's point just before the line
  const endNode = end.getNode();
  let endLine: LexicalNode | null = null;
  if (end.offset === 0 && $isCmsLineNode(endNode)) {
    endLine = endNode;
  } else if (end.offset === 0 && end.type === "text") {
    const line = $findMatchingParent(endNode, $isCmsLineNode);
    endLine = line?.getFirstDescendant()?.is(endNode) === true ? line : null;
  } else if (end.type === "element" && isLinedContainer(endNode)) {
    const at = endNode.getChildAtIndex(end.offset);
    endLine = $isCmsLineNode(at) ? at : null;
  }
  const blockBefore = endLine?.getPreviousSibling() ?? null;
  const breakAtEnd =
    $isElementNode(blockBefore) && $isCmsLineNode(blockBefore) === false && blockBefore.isInline() === false;
  if (nodes.length === 0) {
    return breakAtEnd ? "\n" : "";
  }
  const last = nodes[nodes.length - 1];
  let text = "";
  let prevWasElement = true;
  // whether the last leaf read stood in a block's text, not in a line
  let lastInBlockText = false;
  for (const node of nodes) {
    if ($isCmsLineNode(node)) {
      continue;
    }
    if ($isElementNode(node) && node.isInline() === false) {
      if (prevWasElement === false) {
        text += "\n";
      }
      prevWasElement = node.isEmpty() === false;
      continue;
    }
    const line = $findMatchingParent(node, $isCmsLineNode);
    if (
      line !== null &&
      prevWasElement === false &&
      lastInBlockText &&
      isLineBreak(node) === false &&
      text.endsWith("\n") === false
    ) {
      text += "\n";
    }
    lastInBlockText = line === null;
    prevWasElement = false;
    if ($isTextNode(node)) {
      const part = node.getTextContent();
      const from = start.type === "text" && start.key === node.getKey() ? start.offset : 0;
      const to = end.type === "text" && end.key === node.getKey() ? end.offset : part.length;
      text += part.slice(from, to);
    } else if (
      ($isDecoratorNode(node) || isLineBreak(node)) &&
      (node !== last || selection.isCollapsed() === false)
    ) {
      text += node.getTextContent();
    }
  }
  if (breakAtEnd && text.endsWith("\n") === false) {
    text += "\n";
  }
  return text;
};

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
  const endPoint = selection.isBackward() ? mapped.anchor : mapped.focus;
  let endsAtLineStart: CmsLineNode | null = null;
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
    if (atStart && point === endPoint && selection.isCollapsed() === false) {
      endsAtLineStart = line;
    }
    point.set(
      container.getKey(),
      line.getIndexWithinParent() + (atStart ? 0 : 1),
      "element"
    );
  }
  // a selection that ends at a line's start holds nothing of that line: it
  // ends at the container's point before the line, where the head's nodes
  // step back to the child before it (D6)
  const line = endsAtLineStart;
  if (line !== null) {
    const nodes = mapped.getNodes();
    const kept = nodes.filter((node) => line.is(node) === false && line.isParentOf(node) === false);
    const before = line.getPreviousSibling();
    if (before !== null && kept.some((node) => node.is(before)) === false) {
      kept.push(before);
    }
    mapped.getNodes = () => kept;
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

/** D7's document: `direction` and empty lines left out. */
export const d7Document = (state: EditorState) => {
  const strip = (node: Record<string, unknown>): Record<string, unknown> => {
    const { direction: _direction, ...rest } = node;
    if (Array.isArray(rest.children)) {
      rest.children = (rest.children as Record<string, unknown>[])
        .filter(
          (child) =>
            (child.type === CmsLineNode.getType() &&
              (child.children as unknown[]).length === 0) === false
        )
        .map(strip);
    }
    return rest;
  };
  return JSON.stringify(strip(state.toJSON().root as unknown as Record<string, unknown>));
};

/**
 * F12 (K): a composition that changes the document is its own undo step,
 * decided at the composition's own end from state. At the commit in which
 * the editor starts composing, the state before it (S0), the undo stack's
 * length (n0), the entry below that length and the redo stack are kept per
 * editor. At the commit in which it stops:
 * - a document equal to S0's (a cancelled composition) puts the history
 *   back exactly: the undo stack is cut back to n0 and the redo stack is
 *   the one kept (15.2);
 * - a changed one gets S0 as a step at n0, unless the history already
 *   holds it there.
 * Only the composition's own end counts (15.1): a commit from the history
 * (an undo or a redo) during the composition, or a history that moved
 * since the start (a stack shorter than n0, or another entry below it),
 * voids what was kept, and the history stays as Lexical left it.
 */
export const registerCompositionStep = (editor: LexicalEditor) => {
  if (linesOff) {
    return () => {};
  }
  // the text the page's composition ended with: none is a cancel
  const onEnd = (event: CompositionEvent) => {
    compositionEndText.set(editor, event.data ?? "");
  };
  return mergeRegister(
        editor.registerRootListener((root, previous) => {
          previous?.removeEventListener("compositionend", onEnd, true);
          root?.addEventListener("compositionend", onEnd, true);
        }),
        editor.registerUpdateListener(({ editorState, prevEditorState, tags, dirtyElements, dirtyLeaves }) => {
          const history = cmsHistory.get(editor);
          if (history === undefined) {
            return;
          }
          const start = compositionStarts.get(editor);
          if (tags.has("historic")) {
            if (start !== undefined) {
              compositionStarts.delete(editor);
              if (start.ended === false) {
                compositionVoided.set(editor, "voided");
              }
            }
            return;
          }
          if (editor.isComposing()) {
            // the voided composition runs on (an undo can end the page's
            // composition, and the input method starts it again)
            if (compositionVoided.get(editor) === "voided") {
              compositionVoided.set(editor, "resumed");
            }
            if (start === undefined && compositionVoided.has(editor) === false) {
              // the history may already have taken this commit's step: its
              // newest entry is then the state before this commit
              const length = history.undoStack.length;
              const pushedHere = history.undoStack.at(-1)?.editorState === prevEditorState;
              const index = pushedHere ? length - 1 : length;
              compositionEndText.delete(editor);
              compositionStarts.set(editor, {
                before: prevEditorState,
                index,
                below: index > 0 ? history.undoStack[index - 1] : undefined,
                redo: [...history.redoStack],
                ended: false,
              });
            }
            return;
          }
          if (start === undefined) {
            // the voided composition's own end
            if (compositionVoided.get(editor) === "resumed") {
              compositionVoided.delete(editor);
            }
            return;
          }
          if (
            history.undoStack.length < start.index ||
            (start.index > 0 && history.undoStack[start.index - 1] !== start.below)
          ) {
            compositionStarts.delete(editor);
            return;
          }
          const before = d7Document(start.before);
          // a cancelled composition: the history exactly as before it. A
          // composition that ended with no text is a cancel, and the commit
          // that takes out its leftover belongs to it; one that ended with
          // text is decided at its end, and the next edit is the person's
          if (d7Document(editorState) === before) {
            compositionStarts.delete(editor);
            history.undoStack.length = start.index;
            history.redoStack.length = 0;
            history.redoStack.push(...start.redo);
            editor.dispatchCommand(CAN_UNDO_COMMAND, history.undoStack.length > 0);
            editor.dispatchCommand(CAN_REDO_COMMAND, history.redoStack.length > 0);
            return;
          }
          if (start.ended) {
            // a commit that changes no node is not the one read after the end
            if (dirtyElements.size > 0 || dirtyLeaves.size > 0) {
              compositionStarts.delete(editor);
            }
            return;
          }
          if (compositionEndText.get(editor) === "") {
            start.ended = true;
          } else {
            compositionStarts.delete(editor);
          }
          const entry = history.undoStack[start.index];
          if (entry !== undefined && d7Document(entry.editorState) === before) {
            return;
          }
          history.undoStack.splice(start.index, 0, { editor, editorState: start.before });
          history.redoStack.length = 0;
          editor.dispatchCommand(CAN_UNDO_COMMAND, true);
          editor.dispatchCommand(CAN_REDO_COMMAND, false);
        })
      );
};

/**
 * Typed text with a block node-selected in a lined container lands
 * directly after the node, which stays (D15). Lexical leaves text typed
 * over a node selection to the browser, so the field takes the
 * `beforeinput` first.
 */
export const registerTypingAfterSelectedNode = (editor: LexicalEditor) =>
  linesOff ? () => {} : editor.registerRootListener((root, previous) => {
    // a composition at the start of a line that starts with a link lands
    // before the link, as a typed letter does: the caret stands on the
    // line's start before the composition begins
    const onCompositionStart = () => {
      const $atLinkLedLineStart = () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) === false || selection.isCollapsed() === false) {
          return false;
        }
        const point = selection.anchor;
        const text = point.getNode();
        const link = text.getParent();
        const line = link?.getParent() ?? null;
        return (
          point.type === "text" &&
          point.offset === 0 &&
          $isElementNode(link) &&
          link.isInline() &&
          link.getFirstChild()?.is(text) === true &&
          $isCmsLineNode(line) &&
          line.getFirstChild()?.is(link) === true
        );
      };
      if (editor.getEditorState().read($atLinkLedLineStart) === false) {
        return;
      }
      editor.update(
        () => {
          const selection = $getSelection();
          if ($isRangeSelection(selection) === false || selection.isCollapsed() === false) {
            return;
          }
          const point = selection.anchor;
          const text = point.getNode();
          const link = text.getParent();
          const line = link?.getParent() ?? null;
          if (
            point.type !== "text" ||
            point.offset !== 0 ||
            $isElementNode(link) === false ||
            link.isInline() === false ||
            link.getFirstChild()?.is(text) !== true ||
            $isCmsLineNode(line) === false ||
            line.getFirstChild()?.is(link) !== true
          ) {
            return;
          }
          // a point move only: no tag
          point.set(line.getKey(), 0, "element");
          selection.focus.set(line.getKey(), 0, "element");
        },
        { discrete: true }
      );
    };
    previous?.removeEventListener("compositionstart", onCompositionStart, true);
    root?.addEventListener("compositionstart", onCompositionStart, true);
    const onBeforeInput = (event: InputEvent) => {
      // Safari's text replacement over a range: the controlled text
      // insertion, so the removal is marked like typed text (5.4)
      if (
        event.inputType === "insertText" &&
        event.data === null &&
        event.dataTransfer !== null
      ) {
        const ranged = editor
          .getEditorState()
          .read(() => {
            const selection = $getSelection();
            return $isRangeSelection(selection) && selection.isCollapsed() === false;
          });
        if (ranged) {
          event.preventDefault();
          event.stopImmediatePropagation();
          editor.dispatchCommand(
            CONTROLLED_TEXT_INSERTION_COMMAND,
            event.dataTransfer.getData("text/plain")
          );
        }
        return;
      }
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
