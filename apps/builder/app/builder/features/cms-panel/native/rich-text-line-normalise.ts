// The container and line transforms: paragraph to line, line splits, merges, unwrapping, the link rule.
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { $isListItemNode, ListItemNode } from "@lexical/list";
import { $isQuoteNode, HeadingNode, QuoteNode } from "@lexical/rich-text";
import { mergeRegister } from "@lexical/utils";
import {
  $copyNode,
  $createLineBreakNode,
  $createParagraphNode,
  $createRangeSelection,
  $getEditor,
  $getNodeByKey,
  $getSelection,
  $hasUpdateTag,
  $isElementNode,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  ParagraphNode,
} from "lexical";
import {
  $createCmsLineNode,
  $isCmsLineNode,
  CmsLineNode,
  type ElementPoint,
  elementPoints,
  holdsSelection,
  isBlockDecorator,
  isInlineContent,
  isLineBreak,
  isListItemOrQuote,
  setPoint,
} from "./rich-text-line-node";
import { $resolveLinedPoints } from "./rich-text-line-points";
import {
  $dropEmptied,
  $dropEmptiedBlockInContainer,
  $hasMark,
  $joinRestOfItem,
  $previousChildren,
  BREAK_AFTER_TAG,
  PASTE_OVER_NODE_MARK,
  REMOVAL_TAG,
} from "./rich-text-line-removal";

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
    // inline content directly before ends its own line first (D2)
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
const $linesNeedingBreak = (
  container: ElementNode,
  children: LexicalNode[]
) => {
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
 * The keys of the node selection the state before this update held, or
 * null when it held none (public API).
 */
export const $previousNodeSelectionKeys = (): NodeKey[] | null =>
  $getEditor()
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      return $isNodeSelection(selection)
        ? selection.getNodes().map((node) => node.getKey())
        : null;
    });

/**
 * The keys of the node selection the state before this update held, when
 * every one of its nodes is gone now; otherwise null.
 */
const $previousNodeSelectionGone = () => {
  const keys = $previousNodeSelectionKeys();
  if (keys === null || keys.length === 0) {
    return null;
  }
  const gone = keys.every((key) => {
    const now = $getNodeByKey(key);
    return now === null || now.isAttached() === false;
  });
  return gone ? keys : null;
};

/**
 * 5.8: a node selection in this lined container went (Backspace, Delete, a
 * cut) and the caret Lexical left is an element point at the end of the
 * block directly before the first removed node (its `selectPrevious` onto
 * a block): the caret goes to the end of that block's content, where the
 * head's point on the unlined item resolves (5.3). A text caret, or one a
 * rule of this update set elsewhere, stays.
 */
const $caretBeforeRemovedNodes = (container: ElementNode) => {
  if ($hasUpdateTag("paste") || $hasMark(PASTE_OVER_NODE_MARK)) {
    return;
  }
  const keys = $previousNodeSelectionGone();
  if (keys === null) {
    return;
  }
  const containerKey = container.getKey();
  // in the state before: the node directly before the first removed node,
  // a line's own previous sibling where the node led its line
  const beforeKey = $getEditor()
    .getEditorState()
    .read(() => {
      const nodes = keys
        .map((key) => $getNodeByKey(key))
        .filter((node) => node !== null);
      const first = nodes.find((node) =>
        nodes.every((other) => other === node || node.isBefore(other))
      );
      let node: LexicalNode | null = first ?? null;
      while (node !== null) {
        const parent: ElementNode | null = node.getParent();
        if (parent === null) {
          return null;
        }
        const inContainer =
          parent.getKey() === containerKey ||
          ($isCmsLineNode(parent) &&
            parent.getParent()?.getKey() === containerKey);
        if (inContainer === false) {
          return null;
        }
        const previous = node.getPreviousSibling();
        if (previous !== null) {
          return previous.getKey();
        }
        node = $isCmsLineNode(parent) ? parent : null;
      }
      return null;
    });
  let end = beforeKey === null ? null : $getNodeByKey(beforeKey);
  if (
    end === null ||
    end.isAttached() === false ||
    $isElementNode(end) === false ||
    end.isInline() ||
    $isCmsLineNode(end)
  ) {
    return;
  }
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false ||
    selection.anchor.type !== "element" ||
    selection.anchor.key !== end.getKey() ||
    selection.anchor.offset !== end.getChildrenSize()
  ) {
    return;
  }
  // its deepest last place
  while ($isElementNode(end) && end.isInline() === false) {
    const last: LexicalNode | null = end.getLastChild();
    if (last === null) {
      break;
    }
    end = last;
  }
  const range = $createRangeSelection();
  if ($isTextNode(end)) {
    range.anchor.set(end.getKey(), end.getTextContentSize(), "text");
    range.focus.set(end.getKey(), end.getTextContentSize(), "text");
  } else if ($isElementNode(end) && end.isInline() === false) {
    range.anchor.set(end.getKey(), 0, "element");
    range.focus.set(end.getKey(), 0, "element");
  } else {
    const parent = end.getParentOrThrow();
    const index = end.getIndexWithinParent() + 1;
    range.anchor.set(parent.getKey(), index, "element");
    range.focus.set(parent.getKey(), index, "element");
  }
  $setSelection(range);
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
  if ($previousNodeSelectionGone() === null) {
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
 * Whether this update left the paragraph empty: it is not in the state
 * before this update, or it was not empty there (public API).
 */
const $leftEmptyByThisUpdate = (paragraph: ParagraphNode) => {
  const key = paragraph.getKey();
  return $getEditor()
    .getEditorState()
    .read(() => {
      const before = $getNodeByKey(key);
      return $isElementNode(before) === false || before.isEmpty() === false;
    });
};

/**
 * D19 in a lined quote, for any edit: an empty paragraph directly in the
 * quote that this update left empty and that holds no point of the
 * selection becomes a line of one line break (two where inline content
 * without a closing break stands directly before it). An empty paragraph
 * that was empty before this update stays, as one that holds a point does:
 * it does not become a line later, and a stored one stays when the field
 * opens (the state before the load is empty). True when it made a line.
 */
const $emptyParagraphsToLines = (quote: ElementNode) => {
  if (
    $isQuoteNode(quote) === false ||
    quote.isAttached() === false ||
    quote.getChildren().some($isCmsLineNode) === false ||
    $getEditor().getEditorState().isEmpty()
  ) {
    return false;
  }
  let made = false;
  for (const child of quote.getChildren()) {
    if (
      $isParagraphNode(child) &&
      child.isEmpty() &&
      holdsSelection(child) === false &&
      $leftEmptyByThisUpdate(child)
    ) {
      $paragraphToLine(child);
      made = true;
    }
  }
  return made;
};

/**
 * The container's inline runs each in one line when it holds a block, and
 * no line when it holds none. Lines that meet join as the texts would join
 * with no line between them: no line break is added. An empty line holding
 * no point of the selection goes. In a quote that is lined after this,
 * D19's empty paragraphs become lines, and the runs are read again.
 */
const $normaliseLines = (container: ElementNode) => {
  $normaliseLineRuns(container);
  if ($emptyParagraphsToLines(container)) {
    $normaliseLineRuns(container);
  }
};

const $normaliseLineRuns = (container: ElementNode) => {
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
    (child) =>
      $isCmsLineNode(child) === false && isInlineContent(child) === false
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
          // two lines meet because a node-selected block between them went
          // (a cut, a delete): the caret goes to the join, as the head's
          // caret lands between the two texts it joins
          const last = line.getLastChild();
          caretSet =
            $caretAfterRemovedNode(last ?? line, last === null) || caretSet;
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
 * A line that comes to hold a non-inline child splits around it: the child
 * goes to the container between the two halves, and an empty half goes.
 * An element point on the line goes with what it stands before: offset k
 * to the half that holds child k, or to the end of the half before when
 * child k is the non-inline child (5.8); with no half before, to the start
 * of the half after, and with neither, to the container beside the child.
 */
export const $splitAroundBlocks = (line: CmsLineNode) => {
  const children = line.getChildren();
  if (children.every((child) => isInlineContent(child))) {
    return;
  }
  const onLine = elementPoints().filter((point) => point.key === line.getKey());
  // where each child position of the line lands
  const places: Array<{ key: string; offset: number } | null> = [];
  const pending: number[] = [];
  let last: LexicalNode = line;
  let half: CmsLineNode | null = null;
  for (const [index, child] of children.entries()) {
    if (isInlineContent(child)) {
      if (half === null) {
        half = $createCmsLineNode();
        last.insertAfter(half);
        last = half;
        // a block's position with no half before it: the start of this half
        for (const at of pending.splice(0)) {
          places[at] = { key: half.getKey(), offset: 0 };
        }
      }
      places[index] = { key: half.getKey(), offset: half.getChildrenSize() };
      half.append(child);
    } else {
      if (half !== null) {
        places[index] = {
          key: half.getKey(),
          offset: half.getChildrenSize(),
        };
      } else {
        places[index] = null;
        pending.push(index);
      }
      last.insertAfter(child);
      last = child;
      half = null;
    }
  }
  // the line's end: the end of the last half when it ends the line
  const end = half as CmsLineNode | null;
  places[children.length] =
    end === null ? null : { key: end.getKey(), offset: end.getChildrenSize() };
  if (end === null) {
    pending.push(children.length);
  }
  line.remove();
  for (const point of onLine) {
    const at = Math.min(point.offset, children.length);
    let to = places[at];
    if (to === null || to === undefined) {
      // no half before and none after: beside the child, in the container
      const child = children[Math.min(at, children.length - 1)];
      const parent = child.getParent();
      if (parent === null) {
        continue;
      }
      const index =
        child.getIndexWithinParent() + (at >= children.length ? 1 : 0);
      to = { key: parent.getKey(), offset: index };
    }
    setPoint(point.which, to.key, to.offset);
  }
};

const $keepLineInPlace = (line: CmsLineNode) => {
  const parent = line.getParent();
  if (isListItemOrQuote(parent)) {
    $splitAroundBlocks(line);
    $normaliseLines(parent);
    return;
  }
  const paragraph = $createParagraphNode();
  line.replace(paragraph, true);
};

const $normaliseContainer = (container: ElementNode) => {
  if ($dropEmptied(container)) {
    return;
  }
  if ($hasMark(REMOVAL_TAG) && $joinRestOfItem(container)) {
    return;
  }
  $normaliseLines(container);
  if (container.isAttached()) {
    $caretBeforeRemovedNodes(container);
    $resolveLinedPoints(true);
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
  mergeRegister(
    editor.registerNodeTransform(CmsLineNode, $keepLineInPlace),
    editor.registerNodeTransform(ListItemNode, (item) => {
      liftItem?.(item);
      if (item.isAttached()) {
        $normaliseContainer(item);
      }
    }),
    editor.registerNodeTransform(QuoteNode, $normaliseContainer),
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
    const onLine = elementPoints().filter(
      (point) => point.key === node.getKey()
    );
    const children = node.getChildren();
    const queueLinePoints: ElementPoint[] = onLine.map((point) => ({
      which: point.which,
      key: container?.getKey() ?? "",
      offset: base + point.offset,
    }));
    for (const child of children) {
      node.insertBefore(child);
    }
    node.remove();
    for (const point of queueLinePoints) {
      if (point.key !== "") {
        setPoint(point.which, point.key, point.offset);
      }
    }
    return children;
  });
