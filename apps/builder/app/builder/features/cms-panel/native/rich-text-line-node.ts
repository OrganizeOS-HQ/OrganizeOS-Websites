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
  $getEditor,
  $getNodeByKey,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isLineBreakNode,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
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
  FORMAT_TEXT_COMMAND,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  PASTE_COMMAND,
  REMOVE_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
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
import { $isQuoteNode, QuoteNode } from "@lexical/rich-text";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";

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

  // an indent of a line indents its item
  canIndent() {
    return $isListItemNode(this.getParent());
  }

  getIndent() {
    return 0;
  }

  setIndent(indent: number) {
    const parent = this.getParent();
    if ($isListItemNode(parent) && indent !== 0) {
      parent.setIndent(Math.max(0, parent.getIndent() + indent));
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
 * The container's inline runs each in one line when it holds a block, and
 * no line when it holds none. Lines that meet join as the texts would join
 * with no line between them: no line break is added. An empty line holding
 * no point of the selection goes.
 */
export const $normaliseLines = (container: ElementNode) => {
  if ($isListItemNode(container)) {
    for (const child of container.getChildren()) {
      if ($isParagraphNode(child)) {
        $paragraphToLine(child);
      }
    }
  }
  for (const child of container.getChildren()) {
    if ($isCmsLineNode(child) && child.isEmpty() && holdsSelection(child) === false) {
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
  const points = elementPoints();
  const moved = new Map<string, { key: string; base: number }>();
  const containerKey = container.getKey();
  // where each old child position of the container lands
  const containerMap: Array<{ key: string; offset: number }> = [];
  if (hasBlock === false) {
    let index = 0;
    for (const child of children) {
      containerMap.push({ key: containerKey, offset: index });
      if ($isCmsLineNode(child)) {
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
          containerMap.push({
            key: line.getKey(),
            offset: line.getChildrenSize(),
          });
          moved.set(child.getKey(), {
            key: line.getKey(),
            base: line.getChildrenSize(),
          });
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
  const previousMap = $getEditor().getEditorState()._nodeMap;
  const previous = previousMap.get(node.getKey());
  if ($isElementNode(previous) === false || previous.__size === 0) {
    return false;
  }
  let key: string | null = previous.__first;
  while (key !== null) {
    const now = $getNodeByKey(key);
    if (now !== null && now.isAttached()) {
      return false;
    }
    key = previousMap.get(key)?.__next ?? null;
  }
  return true;
};

/** An item or quote this update emptied goes, unless it holds the caret. */
const $dropEmptied = (node: ElementNode) => {
  if (
    lineSpike.noEmptied === false ||
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

const $keepContainer = (container: ElementNode) => {
  if (lineSpike.on === false) {
    return;
  }
  if ($dropEmptied(container)) {
    return;
  }
  $normaliseLines(container);
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
    editor.registerNodeTransform(QuoteNode, $keepContainer)
  );

// ============================================================
// Points on a lined container
// ============================================================

/** A list item or quote that the editor reads as no block: it holds a block. */
const isLinedContainer = (node: LexicalNode | null): node is ElementNode =>
  isLineContainer(node) &&
  node.getChildren().some(
    (child) => $isCmsLineNode(child) || isInlineContent(child) === false
  );

/**
 * Each element point on a lined container moves into the line beside it:
 * the start of the line after, else the end of the line before. With
 * `create`, a point with no line beside it gets an empty line of its own
 * there.
 */
export const $liftPointsIntoLines = (create: boolean) => {
  if (lineSpike.on === false) {
    return;
  }
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return;
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
    // a quote takes an edit there in a paragraph of its own
    // (`$editInBlockLedItem`)
    if (create === false || $isListItemNode(container) === false) {
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
};

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

const insertCommands: LexicalCommand<never>[] = [
  INSERT_PARAGRAPH_COMMAND,
  INSERT_LINE_BREAK_COMMAND,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  FORMAT_TEXT_COMMAND,
] as LexicalCommand<never>[];

/** A paste or drop at a point with no line beside it goes the head's way. */
const pasteCommands: LexicalCommand<never>[] = [
  PASTE_COMMAND,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
] as LexicalCommand<never>[];

const replacingCommands = new Set<LexicalCommand<never>>([
  CONTROLLED_TEXT_INSERTION_COMMAND,
  PASTE_COMMAND,
] as LexicalCommand<never>[]);

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
    editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        $liftPointsIntoLines(false);
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    ),
    ...insertCommands.map((command) =>
      editor.registerCommand(
        command,
        (payload: unknown) => {
          // a drop carries a data transfer: it is a paste
          const isDrop =
            command === CONTROLLED_TEXT_INSERTION_COMMAND &&
            typeof payload !== "string";
          $nodeSelectionIntoLine(replacingCommands.has(command), isDrop === false);
          $liftPointsIntoLines(isDrop === false);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      )
    ),
    ...pasteCommands.map((command) =>
      editor.registerCommand(
        command,
        () => {
          $nodeSelectionIntoLine(true, false);
          $liftPointsIntoLines(false);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      )
    ),
    ...removeCommands.map((command) =>
      editor.registerCommand(
        command,
        () => {
          $liftPointsIntoLines(false);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      )
    ),
    editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event: KeyboardEvent) => {
        const line = $lineAtStart();
        const item = line?.getParent();
        if (
          line !== null &&
          $isListItemNode(item) &&
          item.getIndent() > 0
        ) {
          event.preventDefault();
          return editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
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
