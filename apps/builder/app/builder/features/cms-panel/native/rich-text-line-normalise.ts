// The container and line transforms: paragraph to line, line splits, merges, unwrapping, the link rule.
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { $isListItemNode, ListItemNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { mergeRegister } from "@lexical/utils";
import {
  $copyNode,
  $createLineBreakNode,
  $createParagraphNode,
  $createRangeSelection,
  $getEditor,
  $getNodeByKey,
  $hasUpdateTag,
  $isElementNode,
  $isNodeSelection,
  $isParagraphNode,
  $isTextNode,
  $setSelection,
  ElementNode,
  type LexicalEditor,
  type LexicalNode,
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
  isLineContainer,
  linesOff,
  lineSpike,
  setPoint,
} from "./rich-text-line-node";
import { $liftPointsIntoLines } from "./rich-text-line-points";
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
