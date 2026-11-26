// The point resolver, the selection-change step, the caret-line mark, the after-commit check, the empty-line sweep and the arrow steps.
import { $isListItemNode } from "@lexical/list";
import { $isQuoteNode } from "@lexical/rich-text";
import { $isParentElementRTL } from "@lexical/selection";
import { $dfs, $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $addUpdateTag,
  type BaseSelection,
  $createNodeSelection,
  $createRangeSelectionFromDom,
  $getEditor,
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type EditorState,
  ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type PointType,
  type RangeSelection,
} from "lexical";
import {
  $atContentEdge,
  $childAtEdge,
  $createCmsLineNode,
  $isCmsLineNode,
  CmsLineNode,
  holdsSelection,
  isBlockDecorator,
  isInlineContent,
  isLineBreak,
  isLinedContainer,
} from "./rich-text-line-node";
import type { EditTracker } from "./rich-text-line-removal";

/**
 * 5.4, F8 and P9-2: lines a removal emptied while they held the caret, per
 * editor. Such a line is not emptied: it keeps the caret (D18 step 1) until
 * the caret leaves it, whatever stands beside it; C2's give-back is for the
 * caret lines the resolver makes. Only the commit listener changes the set.
 */
const emptiedLines = new WeakMap<LexicalEditor, Set<NodeKey>>();

/**
 * The lines that held a point of the selection when a removal started, by
 * the committed state the removal's update started from: the commit that
 * follows that state confirms them, so an update that is discarded adds
 * nothing to `emptiedLines`.
 */
const removalLines = new WeakMap<EditorState, Set<NodeKey>>();

/** A removal starts (`$tagRemoval`): the lines that hold the caret now. */
export const $noteRemovalLines = () => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return;
  }
  const base = $getEditor().getEditorState();
  for (const point of [selection.anchor, selection.focus]) {
    const line = $findMatchingParent(point.getNode(), $isCmsLineNode);
    if (line !== null) {
      let lines = removalLines.get(base);
      if (lines === undefined) {
        lines = new Set();
        removalLines.set(base, lines);
      }
      lines.add(line.getKey());
    }
  }
};

/**
 * T37.2: per editor, the empty lines a paste over a node selection made at
 * the point after the selected nodes, where the paste inserted nothing and
 * the nodes went. Such a line stands where the nodes were and keeps the
 * caret as an emptied line does, in the paste's update, at its commit and
 * at a redo of it (the commit listener adds it to `emptiedLines` whenever
 * it is empty and holds a point). Once the caret leaves, the line goes.
 */
const pasteHeldLines = new WeakMap<LexicalEditor, Set<NodeKey>>();

/** A paste over a node selection left the caret in this empty line (T37.2). */
export const $notePasteHeldLine = (line: CmsLineNode) => {
  const editor = $getEditor();
  let lines = pasteHeldLines.get(editor);
  if (lines === undefined) {
    lines = new Set();
    pasteHeldLines.set(editor, lines);
  }
  lines.add(line.getKey());
};

const emptiedOf = (editor: LexicalEditor) => {
  let emptied = emptiedLines.get(editor);
  if (emptied === undefined) {
    emptied = new Set();
    emptiedLines.set(editor, emptied);
  }
  return emptied;
};

/**
 * T71.3 (D7): each emptied line as it stood in a committed state. Lexical
 * restores an undo or a redo as a copy of that state holding the same node
 * objects, so a line the restored state holds as one of these, empty and
 * holding the caret, is an emptied line again and keeps the caret.
 */
const emptiedLineNodes = new WeakSet<LexicalNode>();

/**
 * After a commit: a line a removal in it started in, which held content
 * and a point of the selection before it and is empty and holds a point
 * now, is an emptied line. The set keeps only lines that are still empty
 * and still hold a point of the selection (the caret has not left). An
 * undo or a redo brings back the emptied lines of the state it restores.
 */
const noteEmptiedLines = (
  editor: LexicalEditor,
  editorState: EditorState,
  prevEditorState: EditorState,
  historic: boolean
) => {
  const emptied = emptiedOf(editor);
  collectEmptiedLines(editor, emptied, editorState, prevEditorState, historic);
  editorState.read(() => {
    for (const key of emptied) {
      const line = $getNodeByKey(key);
      if (line !== null) {
        emptiedLineNodes.add(line);
      }
    }
  });
};

const collectEmptiedLines = (
  editor: LexicalEditor,
  emptied: Set<NodeKey>,
  editorState: EditorState,
  prevEditorState: EditorState,
  historic: boolean
) => {
  const heldLines = editorState.read(() =>
    $dfs()
      .map(({ node }) => node)
      .filter(
        (node): node is CmsLineNode =>
          $isCmsLineNode(node) && node.isEmpty() && holdsSelection(node)
      )
  );
  const held = heldLines.map((node) => node.getKey());
  for (const key of [...emptied]) {
    if (held.includes(key) === false) {
      emptied.delete(key);
    }
  }
  const pasted = pasteHeldLines.get(editor);
  for (const line of heldLines) {
    if (
      pasted?.has(line.getKey()) === true ||
      (historic && emptiedLineNodes.has(line))
    ) {
      emptied.add(line.getKey());
    }
  }
  const removed = removalLines.get(prevEditorState);
  if (removed === undefined) {
    return;
  }
  prevEditorState.read(() => {
    for (const key of held) {
      const before = $getNodeByKey(key);
      if (
        removed.has(key) &&
        $isCmsLineNode(before) &&
        before.isEmpty() === false &&
        holdsSelection(before)
      ) {
        emptied.add(key);
      }
    }
  });
};

/**
 * Whether a removal emptied this line while it held the caret: in a commit
 * before (`noteEmptiedLines`), or in this update (a removal started in it,
 * and it held content in the state this update started from), or a paste
 * over a node selection left the caret in it (T37.2). Reads only.
 */
const $emptiedHoldingPoint = (line: CmsLineNode) => {
  const editor = $getEditor();
  const key = line.getKey();
  if (emptiedLines.get(editor)?.has(key) === true) {
    return true;
  }
  if (pasteHeldLines.get(editor)?.has(key) === true) {
    return true;
  }
  const base = editor.getEditorState();
  if (removalLines.get(base)?.has(key) !== true) {
    return false;
  }
  return base.read(() => {
    const before = $getNodeByKey(key);
    return $isCmsLineNode(before) && before.isEmpty() === false;
  });
};

/**
 * The point resolver (D18): each element point on a lined container moves
 * in D18's order. With `create`, a point no step places gets an empty line
 * of its own there. A point on a line is never moved. One resolver, three
 * calling places (5.3): the container's transform, selection change and
 * select-all, and the check after every commit. True when it made or
 * removed an empty line.
 */
export const $resolveLinedPoints = (create: boolean, depth = 0): boolean => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return false;
  }
  const made = new Map<string, CmsLineNode>();
  const collapsed = selection.isCollapsed();
  let gaveBack = false;
  for (const point of collapsed
    ? [selection.anchor]
    : [selection.anchor, selection.focus]) {
    if (point.type !== "element") {
      continue;
    }
    const held = point.getNode();
    if (
      collapsed &&
      $isCmsLineNode(held) &&
      isLinedContainer(held.getParent())
    ) {
      const at = held.getIndexWithinParent();
      const before = held.getPreviousSibling();
      const after = held.getNextSibling();
      const isBeside = (node: LexicalNode | null) =>
        node !== null &&
        ($isCmsLineNode(node) ||
          ($isElementNode(node) && node.isInline() === false));
      if (
        held.isEmpty() &&
        (isBeside(before) || isBeside(after)) &&
        $emptiedHoldingPoint(held) === false
      ) {
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
    // D18 step 1, a line at the point: its start, whatever leads it (QBT
    // and QA el1).
    // D18 step 2, else a line directly before the point: its end (TQT el1;
    // a line ending in a break, then a block: after the break).
    const lineAt = container.getChildAtIndex(point.offset);
    const lineBefore =
      point.offset > 0 ? container.getChildAtIndex(point.offset - 1) : null;
    if ($isCmsLineNode(lineAt) || $isCmsLineNode(lineBefore)) {
      const line = (
        $isCmsLineNode(lineAt) ? lineAt : lineBefore
      ) as CmsLineNode;
      const atStart = $isCmsLineNode(lineAt);
      const edge = atStart
        ? line.getFirstDescendant()
        : line.getLastDescendant();
      if ($isTextNode(edge)) {
        point.set(
          edge.getKey(),
          atStart ? 0 : edge.getTextContentSize(),
          "text"
        );
      } else {
        point.set(
          line.getKey(),
          atStart ? 0 : line.getChildrenSize(),
          "element"
        );
      }
      continue;
    }
    // D18 step 3, else a block at the point: its start; else a block
    // directly before it: its end (QR@1).
    if ($pointIntoAdjacentBlock(point)) {
      continue;
    }
    // D18 step 4, else an empty line (TR@2).
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
  const deeper = again ? $resolveLinedPoints(create, depth + 1) : false;
  return made.size > 0 || gaveBack || deeper;
};

/**
 * An element point on a list item or quote moves into the block at it
 * (its start), else the block directly before it (its end); a block is
 * any non-inline element, a line included. True when it moved. The
 * resolver's step 3 and the field's `$selectionIntoAdjacentBlocks` (a
 * quote that is not lined) share it.
 */
export const $pointIntoAdjacentBlock = (point: PointType) => {
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
 * 15.14: the press's own caret survives the press. A press in progress in
 * an editor, per editor (15.13's press state): the lined containers the caret was in since the press began (where
 * its end looks for the line the caret left). The one way the field
 * focuses an editor: during a press in it the field does not focus it (the
 * press does) and does not run what would place the caret after the focus.
 */
type Press = { containers: Set<NodeKey> };
const presses = new WeakMap<LexicalEditor, Press>();

export const isPressing = (editor: LexicalEditor) => presses.has(editor);

export const focusEditor = (
  editor: LexicalEditor,
  $before?: () => void,
  focusRoot = false
) => {
  if (presses.has(editor)) {
    return;
  }
  if ($before !== undefined) {
    editor.update($before);
  }
  if (focusRoot) {
    editor.getRootElement()?.focus({ preventScroll: true });
  }
  editor.focus();
};

/**
 * 15.13 (a): empty lines a press's caret left, per editor. A press does not
 * remove the line its caret left (the content would move between the
 * presses of a double click); the next key in the field, or the next edit
 * or clipboard command, removes it first. A press back into a kept line
 * makes it the caret's line again.
 */
const keptLines = new WeakMap<LexicalEditor, Set<NodeKey>>();

const keptOf = (editor: LexicalEditor) => {
  let kept = keptLines.get(editor);
  if (kept === undefined) {
    kept = new Set();
    keptLines.set(editor, kept);
  }
  return kept;
};

/**
 * The lined containers that hold the points of `selection`: the container
 * of the line a point is in, or the lined container a point rests on.
 */
const $containersOf = (selection: BaseSelection | null): NodeKey[] => {
  if ($isRangeSelection(selection) === false) {
    return [];
  }
  const containers: NodeKey[] = [];
  for (const point of [selection.anchor, selection.focus]) {
    const node = point.getNode();
    const line = $findMatchingParent(node, $isCmsLineNode);
    const container = line === null ? node : line.getParent();
    if (container !== null && isLinedContainer(container)) {
      containers.push(container.getKey());
    }
  }
  return containers;
};

/** The lined containers the committed selection's points are in: where the caret was. */
const $previousContainers = () =>
  $getEditor()
    .getEditorState()
    .read(() => $containersOf($getSelection()));

/** The lines the points of the current selection are in. */
const $selectionLines = (): NodeKey[] => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return [];
  }
  const lines: NodeKey[] = [];
  for (const point of [selection.anchor, selection.focus]) {
    const line = $findMatchingParent(point.getNode(), $isCmsLineNode);
    if (line !== null) {
      lines.push(line.getKey());
    }
  }
  return lines;
};

/** The empty lines that are children of the given containers. */
const $emptyLinesIn = (containers: Iterable<NodeKey>) => {
  const lines: CmsLineNode[] = [];
  for (const key of new Set(containers)) {
    const container = $getNodeByKey(key);
    if (
      $isElementNode(container) === false ||
      container.isAttached() === false
    ) {
      continue;
    }
    for (const child of container.getChildren()) {
      if ($isCmsLineNode(child) && child.isEmpty()) {
        lines.push(child);
      }
    }
  }
  return lines;
};

/** Harness: empty lines that hold no point of the selection and no press kept. */
export const unkeptEmptyLines = (editor: LexicalEditor) => {
  const kept = keptOf(editor);
  return editor
    .getEditorState()
    .read(
      () =>
        $dfs().filter(
          ({ node }) =>
            $isCmsLineNode(node) &&
            node.isEmpty() &&
            holdsSelection(node) === false &&
            kept.has(node.getKey()) === false
        ).length
    );
};

/**
 * The sweep (5.8): the empty lines that hold no point of the selection go,
 * only in the given containers (where the caret was), never a kept one. A
 * kept line that holds a point again is the caret's line again. True when
 * any went.
 */
export const $removeEmptyLinesIn = (
  containers: ReadonlyArray<NodeKey>
): boolean => {
  const kept = keptOf($getEditor());
  let removed = false;
  for (const line of $emptyLinesIn(containers)) {
    if (holdsSelection(line)) {
      kept.delete(line.getKey());
    } else if (kept.has(line.getKey()) === false) {
      line.remove();
      removed = true;
    }
  }
  return removed;
};

/** A press's end: the empty lines its caret left, in the given containers, are kept. */
const $keepEmptyLinesIn = (containers: Iterable<NodeKey>) => {
  const kept = keptOf($getEditor());
  for (const line of $emptyLinesIn(containers)) {
    if (holdsSelection(line)) {
      kept.delete(line.getKey());
    } else {
      kept.add(line.getKey());
    }
  }
};

/** Kept lines that hold no point of the selection go. True when any did. */
const $removeKeptLines = () => {
  const kept = keptOf($getEditor());
  let removed = false;
  for (const key of kept) {
    const line = $getNodeByKey(key);
    if (
      $isCmsLineNode(line) &&
      line.isAttached() &&
      line.isEmpty() &&
      holdsSelection(line) === false
    ) {
      line.remove();
      removed = true;
    }
  }
  kept.clear();
  return removed;
};

/**
 * D: the one way the field runs an update that can change a node while a
 * node selection is current. With a node selected, the page's own range is
 * what the browser types at (the field takes that input); Lexical's commit
 * of a node selection drops the page's ranges, so the range the page held
 * before the update is put back after it, when the node selection stands
 * and the page holds none. `update` commits at once (discrete).
 */
export const keepPageRange = <T>(editor: LexicalEditor, update: () => T): T => {
  // an editor with no page (a headless one) has no range to keep
  const dom = typeof window === "undefined" ? null : window.getSelection();
  const root = dom === null ? null : editor.getRootElement();
  const saved =
    dom !== null &&
    dom.rangeCount > 0 &&
    root !== null &&
    root.contains(dom.anchorNode)
      ? dom.getRangeAt(0).cloneRange()
      : null;
  const nodeSelected = () =>
    editor.getEditorState().read(() => $isNodeSelection($getSelection()));
  const before = saved !== null && nodeSelected();
  const result = update();
  if (
    before &&
    saved !== null &&
    dom !== null &&
    dom.rangeCount === 0 &&
    saved.startContainer.isConnected &&
    saved.endContainer.isConnected &&
    nodeSelected()
  ) {
    dom.addRange(saved);
  }
  return result;
};

/**
 * Kept lines that do not hold the caret go, in an update of their own: not
 * an edit (no undo step, no onChange). Before an edit command from outside
 * the field's own keys and clipboard events (the toolbar, the popovers),
 * and at the commit that ends a composition; never while composing.
 */
export const removeKeptLines = (editor: LexicalEditor) => {
  if (keptOf(editor).size === 0 || editor.isComposing()) {
    return;
  }
  keepPageRange(editor, () =>
    editor.update(
      () => {
        if ($removeKeptLines()) {
          $addUpdateTag("history-merge");
        }
      },
      { discrete: true }
    )
  );
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
 * The outermost inline element whose content's start (end) a point is at,
 * climbing through inline elements only; null when the point is not at
 * the edge of one.
 */
export const $inlineEdgeOf = (point: PointType, atStart: boolean) => {
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
    if (
      $isElementNode(holder) &&
      holder.isInline() &&
      $atContentEdge(point, holder, atStart)
    ) {
      found ??= holder;
    }
  }
  return found;
};

/**
 * The focus at the edge of a block or a line in a lined container, with a
 * rule directly beside it in the direction of the key, moves past the rule:
 * the container point on the rule's far side, resolved by D18. True when it
 * moved. The field decides the step at the key (15.3, 16.15): from a block,
 * an empty caret line or a line's text, in either direction of text.
 */
const $focusPastRule = (selection: RangeSelection, isBackward: boolean) => {
  const focus = selection.focus;
  const node = focus.getNode();
  let child: LexicalNode | null = node;
  while (child !== null && isLinedContainer(child.getParent()) === false) {
    child = child.getParent();
  }
  if (child === null || $isElementNode(child) === false) {
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
  $resolveLinedPoints(false);
  return true;
};

/**
 * The text at the end (`atEnd`) or start of a block that is neither a line
 * nor a lined container (a quote of paragraphs, a heading): null otherwise.
 */
const $textEdgeOfBlock = (node: LexicalNode, atEnd: boolean) => {
  if (
    $isElementNode(node) === false ||
    node.isInline() ||
    $isCmsLineNode(node) ||
    isLinedContainer(node)
  ) {
    return null;
  }
  const edge = atEnd
    ? (node as ElementNode).getLastDescendant()
    : (node as ElementNode).getFirstDescendant();
  return $isTextNode(edge) ? edge : null;
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
      if (
        $isElementNode(at) &&
        at.isInline() === false &&
        at.getDirection() !== null
      ) {
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
    while (
      at !== null &&
      ($isElementNode(at) === false ||
        at.isInline() ||
        at.getDirection() === null)
    ) {
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
    const block = $isElementNode(side)
      ? side
      : (side?.getParent() ?? first.getParent());
    isRtl = block?.getDirection() === "rtl";
  }
  return isLeftKey !== isRtl;
};

/** The page's caret position at a point of the viewport. */
const caretAtPoint = (
  x: number,
  y: number
): { node: Node; offset: number } | null => {
  const withPosition = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => { offsetNode: Node; offset: number } | null;
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

/**
 * A caret in an empty line stands on the line's container for an edit
 * that reads leaf nodes only (the list commands): the empty line goes and
 * the caret takes its place; the line rules restore the line after.
 */
export const $caretOffEmptyLine = () => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
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
  return JSON.stringify(
    strip(state.toJSON().root as unknown as Record<string, unknown>)
  );
};

export const pointRules = (editor: LexicalEditor, tracker?: EditTracker) => {
  // whether the update in progress is an edit (an edit command's update)
  const isEdit = () => tracker?.isEdit() === true;
  type PageSelection = {
    anchorNode: Node;
    anchorOffset: number;
    focusNode: Node;
    focusOffset: number;
  };
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
    return {
      anchorNode: dom.anchorNode,
      anchorOffset: dom.anchorOffset,
      focusNode: dom.focusNode,
      focusOffset: dom.focusOffset,
    };
  };
  let shiftPressTaken = false;
  const onShiftPress = (event: PointerEvent) => {
    shiftPressTaken = false;
    if (event.shiftKey === false || event.button !== 0) {
      return;
    }
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("hr, img, figure") !== null
    ) {
      return;
    }
    const isNodeSelected = editor
      .getEditorState()
      .read(() => $isNodeSelection($getSelection()));
    const root = editor.getRootElement();
    const dom = window.getSelection();
    const clicked = caretAtPoint(event.clientX, event.clientY);
    if (
      isNodeSelected === false ||
      dom === null ||
      clicked === null ||
      root?.contains(clicked.node) !== true
    ) {
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
  // 15.13: while a press is in progress in the field, the point rule makes
  // and removes no caret line, so no content moves under the pointer; it
  // runs when the press's own events are over (after the click, so the
  // pressed node's own click handler has run, else when the press ends
  // some other way), on the selection as it is then
  // (5.8) the sweep looks only where the caret was: the lined containers
  // that held the previous selection's points
  const $resolvePoint = () => {
    const edited = isEdit();
    const was = $previousContainers();
    const made = $resolveLinedPoints(true);
    const removed = $removeEmptyLinesIn(was);
    if ((made || removed) && edited === false) {
      $addUpdateTag("history-merge");
    }
  };
  // the press's end makes the line a caret needs, on the selection as it
  // is when the press's own events are over: a selection change the page
  // has not reported yet is read back first, so a line the caret left by
  // the press is kept (15.13 (a)) whichever of the two comes first
  const $resolveAfterPress = (press: Press) => {
    const edited = isEdit();
    for (const key of $previousContainers()) {
      press.containers.add(key);
    }
    // only where an empty line the press could have left stands (ordinary
    // content's presses are Lexical's own)
    if ($emptyLinesIn(press.containers).length > 0) {
      $readBack();
    }
    const made = $resolveLinedPoints(true);
    $keepEmptyLinesIn(press.containers);
    if (made && edited === false) {
      $addUpdateTag("history-merge");
    }
    $selectionBackOnPage();
  };
  // A: an end of the page's selection inside a decorator's DOM (an image's
  // own element, where Chrome takes no typed text) while Lexical holds a
  // range: Lexical's own selection goes back on the page, which then types
  // over the range. Selection-only; the page's next selection change reads
  // a place outside the decorator, so it does not repeat
  const pageEndInDecorator = () => {
    const root = editor.getRootElement();
    const page = window.getSelection();
    if (root === null || page === null || page.rangeCount === 0) {
      return false;
    }
    return [page.anchorNode, page.focusNode].some((node) => {
      const element =
        node instanceof Element ? node : (node?.parentElement ?? null);
      const decorator = element?.closest("[data-lexical-decorator]") ?? null;
      return decorator !== null && root.contains(decorator);
    });
  };
  const $selectionBackOnPage = () => {
    const selection = $getSelection();
    if (
      $isRangeSelection(selection) &&
      selection.isCollapsed() === false &&
      pageEndInDecorator()
    ) {
      $setSelection(selection.clone());
    }
  };
  const endPress = () => {
    const press = presses.get(editor);
    if (press === undefined) {
      return;
    }
    presses.delete(editor);
    if (editor.getRootElement() === null) {
      return;
    }
    // no real gesture reaches the keeper here with a page range: a press on
    // a rule node-selects it and leaves the page no range to put back
    keepPageRange(editor, () =>
      editor.update(() => $resolveAfterPress(press), { discrete: true })
    );
  };
  const onPressStart = (event: PointerEvent) => {
    // a second pointer ends the press in progress
    endPress();
    if (event.button === 0) {
      presses.set(editor, {
        containers: new Set(
          editor.getEditorState().read(() => $containersOf($getSelection()))
        ),
      });
    }
  };
  // 16.18: the press ends at its click, seen at the window in the capture
  // phase (a listener that stops the click's propagation does not keep the
  // press open); the held step runs in the next task, once the click's own
  // handlers (the pressed node's, CLICK_COMMAND) have run
  const onClickEnd = () => {
    const press = presses.get(editor);
    if (press === undefined) {
      return;
    }
    setTimeout(() => {
      if (presses.get(editor) === press) {
        endPress();
      }
    }, 0);
  };
  // 15.12: the page's selection is read back where the page has moved
  // since Lexical last wrote or read it
  const pageMoved = () => {
    if (editor.isComposing()) {
      return false;
    }
    const now = pageSnapshot();
    const was = pageSelection;
    // a range the page shows where Lexical last left none (a node
    // selection's commit removes the page's range, and the browser puts a
    // caret back on its own) is no step of the person's
    return !(
      now === null ||
      was === null ||
      (was !== null &&
        now.anchorNode === was.anchorNode &&
        now.anchorOffset === was.anchorOffset &&
        now.focusNode === was.focusNode &&
        now.focusOffset === was.focusOffset)
    );
  };
  const $readBack = () => {
    if (pageMoved() === false) {
      return false;
    }
    const now = pageSnapshot();
    const selection = $getSelection();
    const dom = window.getSelection();
    if ($isRangeSelection(selection) === false || dom === null) {
      return false;
    }
    const page = $createRangeSelectionFromDom(dom, editor);
    if (page !== null) {
      $setSelection(page);
      // the read-back never writes the page's selection: the page already
      // shows it, and a write (Lexical writes an element point back even
      // when it is unchanged) drops the page's goal column for the next
      // vertical step
      page.dirty = false;
    }
    pageSelection = now;
    return page !== null;
  };
  // a key, or an edit or clipboard event, in the field: in an update of its
  // own before the key's or the edit's (not an edit: no undo step, no
  // onChange), in this order: the page's read-back (15.12), the kept lines
  // go, the held step of a press in progress (15.13); the rules then read
  // the selection
  const beforeKeyOrEditEvents = [
    "keydown",
    "beforeinput",
    "paste",
    "cut",
    "copy",
    "drop",
  ] as const;
  const beforeKeyOrEdit = () => {
    // the page's read-back applies to a range Lexical holds
    const rangeHeld = editor
      .getEditorState()
      .read(() => $isRangeSelection($getSelection()));
    const press = presses.get(editor);
    if (editor.isComposing()) {
      // 16.18: an edit of a composition ends an open press too; the
      // composition's own updates are not disturbed (its start ran the
      // held step, onCompositionStart)
      presses.delete(editor);
      return;
    }
    if (
      keptOf(editor).size === 0 &&
      press === undefined &&
      (rangeHeld === false || pageMoved() === false)
    ) {
      return;
    }
    // 16.18: a key or an edit in the field ends an open press before it is
    // handled; its held step runs here
    presses.delete(editor);
    // after a press on a rule no real gesture reaches the keeper here with a
    // page range: the press node-selects the rule and the page holds none
    keepPageRange(editor, () =>
      editor.update(
        () => {
          const was = [...$previousContainers(), ...(press?.containers ?? [])];
          // a page step read back here is the selection change the page has
          // not reported yet: its step runs as at that change (a line the
          // caret left goes) before the key or edit reads the selection
          const readBack = $readBack();
          let changed = $removeKeptLines();
          if (readBack || press !== undefined) {
            changed = $resolveLinedPoints(true) || changed;
            changed = $removeEmptyLinesIn(was) || changed;
          }
          if (changed) {
            $addUpdateTag("history-merge");
          }
        },
        { discrete: true }
      )
    );
  };
  // 16.18: a composition is an edit: its start ends an open press, and the
  // held step runs before the editor composes (kept lines stay: they go at
  // the commit that ends the composition, 16.23)
  const onCompositionStart = () => {
    const press = presses.get(editor);
    if (press === undefined || editor.isComposing()) {
      return;
    }
    presses.delete(editor);
    // no real gesture reaches the keeper here with a node selected: the
    // click that node-selects a rule or an image also ends the press
    keepPageRange(editor, () =>
      editor.update(
        () => {
          const was = [...$previousContainers(), ...press.containers];
          let changed = $resolveLinedPoints(true);
          changed = $removeEmptyLinesIn(was) || changed;
          if (changed) {
            $addUpdateTag("history-merge");
          }
        },
        { discrete: true }
      )
    );
  };
  // a pointer seen with no button down: the press ended where the page
  // reported no release (outside the window, or no click followed)
  const onPointerMove = (event: PointerEvent) => {
    if (presses.has(editor) && (event.buttons & 1) === 0) {
      endPress();
    }
  };
  // a caret that arrives with no line beside it gets an empty line, and
  // an empty line the caret left goes: not an edit (no undo step, no
  // onChange: the field's change plugin skips history-merge updates)
  const resolveOnSelectionChange = () => {
    const press = presses.get(editor);
    if (press === undefined) {
      $resolvePoint();
      $selectionBackOnPage();
    } else {
      // held: the press's end looks where the caret was during it too
      for (const key of $previousContainers()) {
        press.containers.add(key);
      }
    }
    return false;
  };
  // an arrow off a node-selected rule in a lined container steps beside
  // it and resolves the point there (5.3)
  const arrowOffSelectedNode = (
    event: KeyboardEvent,
    isLeftKey: boolean
  ): boolean => {
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
    // T29.3: a block beside the rule (a quote, a heading) takes the caret at
    // its text edge, the one caret D18 names there, as the Shift step's
    // focus does; Lexical's step leaves an element point on the block
    const moved = $getSelection();
    if ($isRangeSelection(moved) && moved.anchor.type === "element") {
      const edge = $textEdgeOfBlock(moved.anchor.getNode(), isBackward);
      if (edge !== null) {
        const offset = isBackward ? edge.getTextContentSize() : 0;
        edge.select(offset, offset);
      }
    }
    // a caret move, not an edit: a caret line made or removed is merged
    // into the history's current step (the lift is true only then)
    const edited = isEdit();
    if ($resolveLinedPoints(true) && edited === false) {
      $addUpdateTag("history-merge");
    }
    return true;
  };
  // group B: an arrow from a block's text edge toward a rule directly
  // beside the block, and its Shift form (14.3, 16.15)
  const arrowToRule = (event: KeyboardEvent, isLeftKey: boolean): boolean => {
    const isBackward = $arrowMovesBackward(isLeftKey, event.shiftKey);
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    const selection = $getSelection();
    if ($isRangeSelection(selection) === false) {
      return false;
    }
    // 14.3, 16.15: with Shift held, from a block's edge or a line's text
    // edge toward a rule directly beside it the focus takes the caret's
    // step and passes the rule, to where D18 resolves the container point
    // on its far side; the rule is inside the selection. Decided here, at
    // the key, in either direction of text (15.3); the update only moves
    // the focus
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
    return false;
  };
  // an arrow from a block's edge into a line that starts (going right) or
  // ends (going left) with a line break steps past the break: the point
  // before or after it is the block's edge at the head
  const arrowPastLineBreak = (
    event: KeyboardEvent,
    isLeftKey: boolean
  ): boolean => {
    const isBackward = $arrowMovesBackward(isLeftKey, event.shiftKey);
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    const selection = $getSelection();
    if ($isRangeSelection(selection) === false) {
      return false;
    }
    // going right from the end of a line that ends in a break, with a
    // block directly after the line: the block's start is the same
    // place, so the next stop is one character into the block, as at
    // the head
    if (
      event.shiftKey === false &&
      isBackward === false &&
      selection.isCollapsed()
    ) {
      const at = selection.anchor;
      const atNode = at.getNode();
      const line = $isCmsLineNode(atNode)
        ? atNode
        : $findMatchingParent(atNode, $isCmsLineNode);
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
    if (
      child === null ||
      $isCmsLineNode(child) ||
      $isElementNode(child) === false
    ) {
      return false;
    }
    if ($atContentEdge(focus, child, isBackward) === false) {
      return false;
    }
    const line = isBackward
      ? child.getPreviousSibling()
      : child.getNextSibling();
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
  };
  const rememberPageSelection = () => {
    // a node selection's commit leaves the page no range: a range the page
    // shows under one is the browser's own caret (Chrome puts one back on
    // its own), no step of the person's, and is not remembered; else a
    // later key, once a commit rebuilt that caret's text, reads the
    // browser's next own caret back as a move (P22-9)
    pageSelection = $isNodeSelection($getSelection()) ? null : pageSnapshot();
    return false;
  };
  const readBackOnKey = () => {
    $readBack();
    return false;
  };
  // L: a click on text after a node was selected gives a real caret, as
  // Lexical already does for a touch; with Shift held too, a caret at the
  // click, never the page's range (14.2)
  const clickAfterNodeSelection = (event: MouseEvent) => {
    const selection = $getSelection();
    if (selection !== null && $isNodeSelection(selection) === false) {
      return false;
    }
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("hr, img, figure") !== null
    ) {
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
  };
  return {
    handlers: {
      resolveOnSelectionChange,
      arrowOffSelectedNode,
      arrowToRule,
      arrowPastLineBreak,
      rememberPageSelection,
      readBack: readBackOnKey,
      clickAfterNodeSelection,
    },
    // the rules' registrations that are not commands, in their carried order
    register: () =>
      mergeRegister(
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
          if (
            next === prev ||
            (next !== null && prev !== null && next.is(prev))
          ) {
            return;
          }
          pageSelection = pageSnapshot();
        }),
        editor.registerRootListener((root, previous) => {
          previous?.removeEventListener("pointerdown", onPressStart, true);
          root?.addEventListener("pointerdown", onPressStart, true);
          previous?.removeEventListener(
            "compositionstart",
            onCompositionStart,
            true
          );
          root?.addEventListener("compositionstart", onCompositionStart, true);
          for (const type of beforeKeyOrEditEvents) {
            previous?.removeEventListener(type, beforeKeyOrEdit, true);
            root?.addEventListener(type, beforeKeyOrEdit, true);
          }
        }),
        (() => {
          // the press's own end: the click (in the capture phase, its held
          // step in the next task), or a way a press ends with no click
          const ends = [
            "pointercancel",
            "dragend",
            "drop",
            "contextmenu",
          ] as const;
          // the window losing focus (an element's blur is not the press's end)
          const onBlur = (event: FocusEvent) => {
            if (event.target === window) {
              endPress();
            }
          };
          for (const type of ends) {
            window.addEventListener(type, endPress, true);
          }
          window.addEventListener("click", onClickEnd, true);
          window.addEventListener("pointermove", onPointerMove, true);
          window.addEventListener("blur", onBlur, true);
          return () => {
            endPress();
            for (const type of ends) {
              window.removeEventListener(type, endPress, true);
            }
            window.removeEventListener("click", onClickEnd, true);
            window.removeEventListener("pointermove", onPointerMove, true);
            window.removeEventListener("blur", onBlur, true);
          };
        })(),
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
        // 16.23: kept lines go at the commit that ends a composition
        (() => {
          let composing = editor.isComposing();
          return editor.registerUpdateListener(() => {
            const was = composing;
            composing = editor.isComposing();
            if (was && composing === false) {
              removeKeptLines(editor);
            }
          });
        })(),
        // 5.4 and F8: a line this commit emptied while it held the caret is
        // noted before any later update resolves the caret
        editor.registerUpdateListener(
          ({ editorState, prevEditorState, tags }) => {
            noteEmptiedLines(
              editor,
              editorState,
              prevEditorState,
              tags.has("historic")
            );
          }
        ),
        () => {
          emptiedLines.delete(editor);
          pasteHeldLines.delete(editor);
        }
      ),
  };
};

/**
 * The third place of 5.3: after every commit, a point that rests on a lined
 * container resolves at once, in an update of its own that makes no undo
 * step and fires no onChange; the rule then holds (5.3, 5.5). Its state is
 * this editor's: whether its own update is committing, so that commit is not
 * checked again. A point still on a lined container after the resolving
 * update is reported once and not retried. In development the whole tree is
 * also asserted to hold no line with a block in it.
 */
export const registerPointCheck = (
  editor: LexicalEditor,
  resolve: (create: boolean) => boolean = $resolveLinedPoints
): (() => void) => {
  let ownUpdate = false;
  const pointCheckListener = ({
    editorState,
    prevEditorState,
  }: {
    editorState: EditorState;
    prevEditorState: EditorState;
  }) => {
    if (
      process.env.NODE_ENV !== "production" &&
      editorState.read($lineHoldsBlock)
    ) {
      console.error("cms-line rule: a line holds a block");
    }
    // the commit of the check's own update is not checked again
    if (ownUpdate) {
      return;
    }
    // held while a composition runs: it adds no update between the
    // composition's own; the commit that ends it is checked
    if (editor.isComposing() || presses.has(editor)) {
      return;
    }
    const broken = editorState.read($pointRuleBroken);
    if (broken === null) {
      // a line the caret left by a key or by code, where no selection
      // change of the page followed (the field moved the caret in the
      // key's own update), goes at once: only a line the selection was in
      // before this commit, never a kept one (a press holds this check off)
      const kept = keptOf(editor);
      const was = prevEditorState.read($selectionLines);
      const $left = () =>
        was
          .map((key) => $getNodeByKey(key))
          .filter(
            (line): line is CmsLineNode =>
              $isCmsLineNode(line) &&
              line.isAttached() &&
              line.isEmpty() &&
              holdsSelection(line) === false &&
              kept.has(line.getKey()) === false
          );
      if (editorState.read($left).length > 0) {
        keepPageRange(editor, () =>
          editor.update(
            () => {
              const left = $left();
              for (const line of left) {
                line.remove();
              }
              if (left.length > 0) {
                $addUpdateTag("history-merge");
              }
            },
            { discrete: true }
          )
        );
      }
      return;
    }
    ownUpdate = true;
    // an update that changes nothing commits nothing and runs no onUpdate;
    // the check's update runs in this commit's queue, so it has ended by the
    // next microtask whichever way it ends
    queueMicrotask(() => {
      ownUpdate = false;
    });
    keepPageRange(editor, () =>
      editor.update(
        () => {
          // a point moved and nothing else changed is no edit (no onChange,
          // no step) and carries no tag; a caret line made or removed is
          // merged into the history's current step and fires no onChange
          if (resolve(true)) {
            $addUpdateTag("history-merge");
          }
          const still = $pointRuleBroken();
          if (still !== null) {
            console.error(`cms-line point rule: a point on ${still}`);
          }
        },
        {
          discrete: true,
          onUpdate: () => {
            ownUpdate = false;
          },
        }
      )
    );
  };
  return editor.registerUpdateListener(pointCheckListener);
};

/**
 * The caret-line mark (section 4): while a point of the selection stands
 * after the last line break of a line that has a block directly after it,
 * the line's element carries `data-cms-caret`, so the break the reconciler
 * adds there is drawn and the caret stands on the row the next letter lands
 * on. The mark is on the page only: setting or clearing it runs no editor
 * update, adds no history step and fires no onChange.
 */
export const registerCaretLineMark = (editor: LexicalEditor) => {
  let marked = new Set<string>();
  const unregister = editor.registerUpdateListener(({ editorState }) => {
    const next = new Set<string>();
    editorState.read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) === false) {
        return;
      }
      for (const point of [selection.anchor, selection.focus]) {
        const line = point.getNode();
        const after = $isCmsLineNode(line) ? line.getNextSibling() : null;
        if (
          $isCmsLineNode(line) &&
          point.type === "element" &&
          point.offset === line.getChildrenSize() &&
          isLineBreak(line.getLastChild()) &&
          after !== null &&
          isInlineContent(after) === false
        ) {
          next.add(line.getKey());
        }
      }
    });
    for (const key of marked) {
      if (next.has(key) === false) {
        editor.getElementByKey(key)?.removeAttribute("data-cms-caret");
      }
    }
    for (const key of next) {
      editor.getElementByKey(key)?.setAttribute("data-cms-caret", "");
    }
    marked = next;
  });
  return () => {
    unregister();
    for (const key of marked) {
      editor.getElementByKey(key)?.removeAttribute("data-cms-caret");
    }
    marked = new Set();
  };
};
