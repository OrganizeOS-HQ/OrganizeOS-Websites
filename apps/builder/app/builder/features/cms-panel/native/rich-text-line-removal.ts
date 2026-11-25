// The removal mark and its tags, "emptied", the join that carries an item's rest, and the handlers of the removal mark, 15.10's key and Enter over a range.
import { $isListItemNode, $isListNode } from "@lexical/list";
import {
  $createHeadingNode,
  $isHeadingNode,
  $isQuoteNode,
} from "@lexical/rich-text";
import { $findMatchingParent } from "@lexical/utils";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getEditor,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  $setSelection,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  ElementNode,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type LexicalCommand,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
  type PointType,
  type RangeSelection,
  REMOVE_TEXT_COMMAND,
  TextNode,
} from "lexical";
import {
  $atContentEdge,
  $childAtEdge,
  $isCmsLineNode,
  CmsPlaceItemNode,
  CmsPlaceParagraphNode,
  CmsPlaceTextNode,
  holdsSelection,
  isBlockDecorator,
  isLineBreak,
  isListItemOrQuote,
  isLinedContainer,
  lineSpike,
} from "./rich-text-line-node";
import { $inlineEdgeOf, $noteRemovalLines } from "./rich-text-line-points";

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
export const $previousChildren = (key: string) =>
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
export const REMOVAL_TAG = "cms-removal";

/** An update that runs the head's own path over unwrapped lines. */
export const HEAD_PATH_TAG = "cms-head-path";

const REMOVAL_START_TAG = "cms-removal-start:";

const REMOVAL_END_TAG = "cms-removal-end:";

export const BREAK_AFTER_TAG = "cms-break-after:";

/** A paste the line code runs over a node selection (Lexical's own paste is tagged "paste"). */
export const PASTE_OVER_NODE_MARK = "cms-paste-over-node";

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

export const $mark = (name: string) => {
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

/** Tests: the marks an editor holds now (none once its update is done). */
export const lineMarkCount = (editor: LexicalEditor) =>
  lineMarks.get(editor)?.size ?? 0;

export const $hasMark = (name: string) =>
  lineMarks.get($getEditor())?.has(name) === true;

/**
 * The per-editor edit tracker: whether the update in progress is an edit.
 * `markEdit` is called by the removal mark and by every edit command's row
 * of COMMAND_ORDER; `isEdit()` is true from the first `markEdit` of an
 * update until that update commits. A selection change Lexical dispatches
 * inside an edit then keeps the edit's undo step and onChange, and one
 * Lexical dispatches from the commit after it (an update of its own) is no
 * edit. The update is known by the committed state it started from: a
 * commit changes it, and the update listener clears the mark; an update
 * that commits nothing is over when its task's microtasks run.
 */
export type EditTracker = {
  markEdit(): void;
  isEdit(): boolean;
  dispose(): void;
};

const editTrackers = new WeakMap<LexicalEditor, EditTracker>();

export const createEditTracker = (editor: LexicalEditor): EditTracker => {
  let from: EditorState | null = null;
  const unregister = editor.registerUpdateListener(() => {
    from = null;
  });
  const tracker: EditTracker = {
    markEdit: () => {
      const state = editor.getEditorState();
      if (from === state) {
        return;
      }
      from = state;
      queueMicrotask(() => {
        if (from === state) {
          from = null;
        }
      });
    },
    isEdit: () => from !== null && from === editor.getEditorState(),
    dispose: () => {
      unregister();
      from = null;
      if (editTrackers.get(editor) === tracker) {
        editTrackers.delete(editor);
      }
    },
  };
  editTrackers.set(editor, tracker);
  return tracker;
};

/** The tracker of the editor whose update is running, if it has one. */
export const editTrackerOf = (editor: LexicalEditor) =>
  editTrackers.get(editor);

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
  while (
    block !== null &&
    line !== null &&
    block.getParent()?.is(line.getParent()) !== true
  ) {
    block = block.getParent();
  }
  const next =
    $isCmsLineNode(line) &&
    $isElementNode(block) &&
    $isCmsLineNode(block) === false
      ? block.getNextSibling()
      : null;
  selection.removeText();
  if ($isCmsLineNode(next) === false || line === null) {
    return;
  }
  if (
    $isElementNode(block) &&
    block.isAttached() &&
    block.getTextContentSize() === 0
  ) {
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
export const $caretBesideInlineEdge = (
  isBackward: boolean,
  character: boolean
) => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const inline = $inlineEdgeOf(selection.anchor, isBackward);
  if (
    inline === null ||
    (isBackward ? inline.getPreviousSibling() : inline.getNextSibling()) !==
      null
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
export const $enterInHeading = () => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const point = selection.anchor;
  const node = point.getNode();
  const heading = $isHeadingNode(node)
    ? node
    : $findMatchingParent(node, $isHeadingNode);
  if (
    $isHeadingNode(heading) === false ||
    heading.isEmpty() ||
    $atContentEdge(point, heading, true)
  ) {
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
    if (
      first.offset === 0 &&
      $startsWithNonText(holder) &&
      $nothingBefore(holder) === false
    ) {
      const at = holder.getFirstChildOrThrow();
      const text = $createTextNode("");
      at.insertBefore(text);
      selection.anchor.set(text.getKey(), 0, "text");
      selection.focus.set(text.getKey(), 0, "text");
    }
    return;
  }
  if (
    lined ||
    holder.getChildrenSize() === 0 ||
    first.offset !== holder.getChildrenSize()
  ) {
    return;
  }
  // a caret moves only for a delete whose direction is known (a key's own
  // command dispatches the directed delete next); a forward delete with
  // nothing after it in the content has nothing to remove: the caret stays
  // and the update changes nothing
  if (
    selection.isCollapsed() &&
    (isBackward === undefined ||
      (isBackward === false && $nothingAfter(holder)))
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
export const $backwardFormIsBackspace = () => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const { anchor } = selection;
  const holder = anchor.getNode();
  if (
    anchor.type !== "element" ||
    $isElementNode(holder) === false ||
    holder.isInline()
  ) {
    return false;
  }
  if (isLinedContainer(holder as LexicalNode)) {
    return false;
  }
  const at = holder.getChildAtIndex(anchor.offset);
  const previous =
    anchor.offset > 0 ? holder.getChildAtIndex(anchor.offset - 1) : null;
  return (
    at !== null &&
    $isTextNode(at) === false &&
    ($isElementNode(at) === false || at.isInline()) &&
    ((previous === null && $nothingBefore(holder) === false) ||
      isLineBreak(previous))
  );
};

/**
 * 15.5, 15.6: the word form at a line's start after a block (backward), or
 * at its end before a block (forward), does what the character form does
 * there (D3), as at the same block holding text: the line and the block
 * join, and nothing of the block goes.
 */
export const $wordFormAtLineEdgeBesideBlock = (isBackward: boolean) => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const point = selection.anchor;
  const node = point.getNode();
  const line = $isCmsLineNode(node)
    ? node
    : $findMatchingParent(node, $isCmsLineNode);
  if (
    $isCmsLineNode(line) === false ||
    $atContentEdge(point, line, isBackward) === false
  ) {
    return false;
  }
  const beside = isBackward ? line.getPreviousSibling() : line.getNextSibling();
  return (
    $isElementNode(beside) &&
    $isCmsLineNode(beside) === false &&
    beside.isInline() === false
  );
};

/** A caret at the content's start, just before a first child that is not text. */
export const $lineFormAtContentStart = () => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const { anchor } = selection;
  const holder = anchor.getNode();
  if (
    anchor.type !== "element" ||
    anchor.offset !== 0 ||
    $isElementNode(holder) === false
  ) {
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
export const $lineFormHasNothing = () => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const { anchor } = selection;
  const holder = anchor.getNode();
  if (
    anchor.type !== "element" ||
    $isElementNode(holder) === false ||
    holder.isInline()
  ) {
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
  for (let at: LexicalNode = holder; ;) {
    const next = at.getNextSibling();
    if (next !== null) {
      return isBlockDecorator(next) === false;
    }
    const parent = at.getParent();
    if (
      parent === null ||
      isLinedContainer(parent) ||
      $isRootOrShadowRoot(parent)
    ) {
      return true;
    }
    at = parent;
  }
};

/**
 * 15.10: a range's last point on a container where no text can stand (the
 * root, a list, a quote) directly after a nested block holds what the
 * range ending at that block's content end holds, and moves there: its
 * last text's end, else the place after its last child. A last point
 * after a rule stays. E: an end directly before a block takes its content
 * start (for the writer, a first point only). True when it moved.
 */
export const $lastPointToBlockEnd = (
  selection: RangeSelection,
  use: "removal" | "writer" = "removal"
) => {
  if (lineSpike.on === false || selection.isCollapsed()) {
    return false;
  }
  const noText = (holder: LexicalNode) =>
    ($isRootOrShadowRoot(holder) ||
      $isListNode(holder) ||
      $isQuoteNode(holder)) &&
    isLinedContainer(holder) === false;
  const isBlock = (node: LexicalNode | null): node is ElementNode =>
    $isElementNode(node) && node.isInline() === false;
  const { start, end: last } = $endsInOrder(selection);
  let moved = false;
  // 15.10: a last point directly after a nested block takes its content end
  let lastDone = false;
  if (last.type === "element" && last.offset > 0 && noText(last.getNode())) {
    const block = (last.getNode() as ElementNode).getChildAtIndex(
      last.offset - 1
    );
    if (isBlock(block)) {
      const end = block.getLastDescendant();
      if ($isTextNode(end)) {
        last.set(end.getKey(), end.getTextContentSize(), "text");
      } else if (end === null) {
        last.set(block.getKey(), 0, "element");
      } else {
        last.set(
          end.getParentOrThrow().getKey(),
          end.getIndexWithinParent() + 1,
          "element"
        );
      }
      lastDone = true;
      moved = true;
    }
  }
  // E (15.10's mirror): an end, first or last, directly before a block
  // takes that block's content start. K14: for the writer only a first
  // point does; a last point directly before a block stays, so the
  // clipboard ends before the block and never carries its shell
  for (const point of lastDone || use === "writer" ? [start] : [start, last]) {
    if (point.type !== "element" || noText(point.getNode()) === false) {
      continue;
    }
    const block = (point.getNode() as ElementNode).getChildAtIndex(
      point.offset
    );
    if (isBlock(block) === false) {
      continue;
    }
    const first = block.getFirstDescendant();
    if ($isTextNode(first)) {
      point.set(first.getKey(), 0, "text");
    } else if (first === null) {
      point.set(block.getKey(), 0, "element");
    } else {
      point.set(
        first.getParentOrThrow().getKey(),
        first.getIndexWithinParent(),
        "element"
      );
    }
    moved = true;
  }
  return moved;
};

/**
 * Marks a removal and puts its ends where the line rules read them. True
 * when the range holds nothing once its ends are in place (15.10): there
 * is nothing to remove, and the selection is the caret there.
 */
export const $tagRemoval = (isBackward?: boolean): boolean => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) &&
    $lastPointToBlockEnd(selection) &&
    selection.isCollapsed()
  ) {
    return true;
  }
  // 15.11 (3): the removal uses the ends the clipboard writer uses
  if (
    $isRangeSelection(selection) &&
    selection.isCollapsed() === false &&
    lineSpike.on
  ) {
    $endsIntoText(selection, false);
  }
  $mark(REMOVAL_TAG);
  $noteRemovalLines();
  if ($isRangeSelection(selection) === false) {
    return false;
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
    return false;
  }
  const startPoint = selection.isBackward()
    ? selection.focus
    : selection.anchor;
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
  return false;
};

export const $dropEmptied = (node: ElementNode) => {
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
 * An item whose first line this update joined into the item before it
 * (a removal from that item into this one) joins it whole: the rest of
 * the item follows the joined text, as an item of text and a rule joins
 * at the head.
 */
export const $joinRestOfItem = (item: ElementNode) => {
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
      (child) =>
        child.isLine === false && $hasMark(`${REMOVAL_END_TAG}${child.key}`)
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

/**
 * A heading or code block in an item or quote whose children a removal
 * detached goes, as an item or quote does (K12).
 */
export const $dropEmptiedBlockInContainer = (block: ElementNode) => {
  if (
    lineSpike.on === false ||
    isListItemOrQuote(block.getParent()) === false
  ) {
    return;
  }
  $dropEmptied(block);
};

/** The delete commands: the removal mark takes their direction. */
const deleteCommands: LexicalCommand<unknown>[] = [
  DELETE_CHARACTER_COMMAND,
  DELETE_WORD_COMMAND,
  DELETE_LINE_COMMAND,
] as LexicalCommand<unknown>[];

/** The other commands the removal mark is on whatever the selection. */
const removeCommands: LexicalCommand<unknown>[] = [
  REMOVE_TEXT_COMMAND,
] as LexicalCommand<unknown>[];

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
/** A range's two ends in document order, by the tree (not Lexical's isBackward). */
export const $endsInOrder = (selection: RangeSelection) => {
  const { start, end } = $nodesInRange(selection, false);
  return { start, end };
};

/**
 * 15.11 (candidate iii): each element-point end of a range gets a place of
 * its own in text, the same place for the clipboard writer and for a
 * removal: the edge of a text node directly beside it in the same parent
 * (the side inside the range first), else an empty text node at the point.
 * Where no text can stand (the root, a list, a quote between its
 * paragraphs) nothing moves and the result is null. With `mark`, the
 * inserted nodes carry the mark the writer drops them by.
 */

export const $endsIntoText = (
  selection: RangeSelection,
  mark: boolean
): LexicalNode[] | null => {
  const { start, end } = $endsInOrder(selection);
  const holders = [start, end].filter((point) => point.type === "element");
  const noText = (element: LexicalNode) =>
    $isRootOrShadowRoot(element) ||
    $isListNode(element) ||
    ($isQuoteNode(element) && isLinedContainer(element) === false);
  // the live editor: where no text can stand nothing moves (15.11 (4))
  if (mark === false && holders.some((point) => noText(point.getNode()))) {
    return null;
  }
  const inserted: LexicalNode[] = [];
  const placed = new Map<string, TextNode>();
  for (const point of [start, end]) {
    if (point.type !== "element") {
      continue;
    }
    const isStart = point === start;
    const element = point.getNode() as ElementNode;
    const left =
      point.offset > 0 ? element.getChildAtIndex(point.offset - 1) : null;
    const right = element.getChildAtIndex(point.offset);
    const sides: [LexicalNode | null, "left" | "right"][] = isStart
      ? [
          [right, "right"],
          [left, "left"],
        ]
      : [
          [left, "left"],
          [right, "right"],
        ];
    const beside = sides.find(([node]) => $isTextNode(node));
    if (beside !== undefined) {
      const text = beside[0] as TextNode;
      point.set(
        text.getKey(),
        beside[1] === "left" ? text.getTextContentSize() : 0,
        "text"
      );
      continue;
    }
    const at = `${element.getKey()}@${point.offset}`;
    let text = placed.get(at);
    if (text === undefined) {
      text = mark ? new CmsPlaceTextNode("") : $createTextNode("");
      // 15.11 (E), the scratch editor only: where no text can stand, a
      // made block of a kind that can stand there holds it
      let holder: LexicalNode = text;
      if (noText(element)) {
        const block = $isListNode(element)
          ? new CmsPlaceItemNode()
          : new CmsPlaceParagraphNode();
        block.append(text);
        holder = block;
      }
      if (right !== null) {
        right.insertBefore(holder);
      } else {
        element.append(holder);
      }
      placed.set(at, text);
      inserted.push(text);
    }
    point.set(text.getKey(), 0, "text");
  }
  return inserted;
};

export const $nodesInRange = (selection: RangeSelection, collect = true) => {
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
  const anchorFirst =
    compare(placeOf(selection.anchor), placeOf(selection.focus)) <= 0;
  const [start, end] = anchorFirst
    ? [selection.anchor, selection.focus]
    : [selection.focus, selection.anchor];
  const from = placeOf(start);
  const to = placeOf(end);
  const nodes: LexicalNode[] = [];
  if (collect === false) {
    return { nodes, start, end };
  }
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

/**
 * The removal mark, one handler on every command it is on (Task 7's
 * table): nothing under the head path; on the delete and remove commands
 * the mark whatever the selection, with its answer (a range that holds
 * nothing once its ends are in place removes nothing, 15.10); on the
 * others the mark for a range only, and the command runs on.
 */
export const $removalMark = (
  command: LexicalCommand<unknown>,
  payload: unknown
): boolean => {
  editTrackers.get($getEditor())?.markEdit();
  if ($hasMark(HEAD_PATH_TAG)) {
    return false;
  }
  if (deleteCommands.includes(command)) {
    return $tagRemoval(payload as boolean);
  }
  // the two key commands pass their direction, as the delete commands do
  if (command === KEY_BACKSPACE_COMMAND) {
    return $tagRemoval(true);
  }
  if (command === KEY_DELETE_COMMAND) {
    return $tagRemoval(false);
  }
  if (removeCommands.includes(command)) {
    return $tagRemoval(undefined);
  }
  const selection = $getSelection();
  if ($isRangeSelection(selection) && selection.isCollapsed() === false) {
    $tagRemoval();
  }
  return false;
};

/**
 * 15.10: Backspace or Delete over a range that holds nothing once its
 * last point is in place removes nothing, and the page's own delete after
 * the key does not run at the caret that is left.
 */
export const $nothingHeldKey = (event: KeyboardEvent | null): boolean => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return false;
  }
  const moved = selection.clone();
  if ($lastPointToBlockEnd(moved) === false || moved.isCollapsed() === false) {
    return false;
  }
  event?.preventDefault();
  $setSelection(moved);
  return true;
};

/**
 * E1: Enter or Shift+Enter over a range from a line into a block is the
 * removal (with D3's break, decided before the edit by the removal's
 * mark), then the key at its caret.
 */
export const $enterRangeWithBreak = (): boolean => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) && selection.isCollapsed() === false) {
    const start = selection.isBackward() ? selection.focus : selection.anchor;
    const line = $findMatchingParent(start.getNode(), $isCmsLineNode);
    if (
      $isCmsLineNode(line) &&
      $hasMark(`${BREAK_AFTER_TAG}${line.getKey()}`)
    ) {
      $removeRangeWithBreak(selection);
    }
  }
  return false;
};
