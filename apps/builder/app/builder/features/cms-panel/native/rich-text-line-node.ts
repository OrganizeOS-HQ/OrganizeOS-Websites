/**
 * SPIKE. A line: each maximal run of inline content of a list item or quote
 * that also holds a block. No list item and no quote holds inline content
 * beside a non-inline child. The stored HTML never shows a line: its export
 * writes its children only.
 */
import {
  $createLineBreakNode,
  $createParagraphNode,
  $getEditor,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  ElementNode,
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
import { mergeRegister } from "@lexical/utils";

export const lineSpike = {
  /** The invariant's transforms run. */
  on: true,
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

/**
 * The container's inline runs each in one line when it holds a block, and
 * no line when it holds none. Lines that meet join with a line break.
 */
export const $normaliseLines = (container: ElementNode) => {
  const children = container.getChildren();
  const hasBlock = children.some(
    (child) => $isCmsLineNode(child) === false && isInlineContent(child) === false
  );
  const hasInline = children.some(isInlineContent);
  const lineCount = children.filter($isCmsLineNode).length;
  if (hasBlock && hasInline === false) {
    // every run already a line: only lines that meet join
    let meet = false;
    children.forEach((child, index) => {
      if ($isCmsLineNode(child) && $isCmsLineNode(children[index + 1])) {
        meet = true;
      }
    });
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
    // unwrap: the lines' children stand in the container
    let index = 0;
    let previousWasLine = false;
    for (const child of children) {
      containerMap.push({ key: containerKey, offset: index });
      if ($isCmsLineNode(child)) {
        if (previousWasLine) {
          child.insertBefore($createLineBreakNode(), false);
          index += 1;
        }
        moved.set(child.getKey(), { key: containerKey, base: index });
        const inner = child.getChildren();
        for (const each of inner) {
          child.insertBefore(each, false);
        }
        index += inner.length;
        child.remove();
        previousWasLine = true;
      } else {
        index += 1;
        previousWasLine = false;
      }
    }
    containerMap.push({ key: containerKey, offset: index });
  } else {
    let line: CmsLineNode | undefined;
    let previousWasLine = false;
    let blockIndex = 0;
    for (const child of children) {
      if ($isCmsLineNode(child)) {
        if (line === undefined) {
          line = child;
          containerMap.push({ key: child.getKey(), offset: 0 });
          blockIndex += 1;
        } else {
          containerMap.push({ key: line.getKey(), offset: line.getChildrenSize() });
          if (previousWasLine) {
            line.append($createLineBreakNode());
          }
          moved.set(child.getKey(), {
            key: line.getKey(),
            base: line.getChildrenSize(),
          });
          line.append(...child.getChildren());
          child.remove();
        }
        previousWasLine = true;
        continue;
      }
      if (isInlineContent(child)) {
        if (line === undefined) {
          line = $createCmsLineNode();
          child.insertBefore(line, false);
          blockIndex += 1;
        }
        containerMap.push({ key: line.getKey(), offset: line.getChildrenSize() });
        line.append(child);
        previousWasLine = false;
        continue;
      }
      containerMap.push({ key: containerKey, offset: blockIndex });
      blockIndex += 1;
      line = undefined;
      previousWasLine = false;
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

/** Whether the node had children before this update. */
const hadChildren = (node: ElementNode) => {
  const previous = $getEditor().getEditorState()._nodeMap.get(node.getKey());
  return $isElementNode(previous) && previous.__size > 0;
};

/** An item, quote or line this update emptied goes, unless it holds the caret. */
const $dropEmptied = (node: ElementNode) => {
  if (
    lineSpike.noEmptied === false ||
    node.getChildrenSize() !== 0 ||
    hadChildren(node) === false ||
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
  if ($dropEmptied(line)) {
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

/** A paragraph directly in a list item is a line. */
const $paragraphInItem = (paragraph: ParagraphNode) => {
  if (lineSpike.on === false) {
    return;
  }
  const parent = paragraph.getParent();
  if ($isListItemNode(parent) === false || $isParagraphNode(paragraph) === false) {
    return;
  }
  const line = $createCmsLineNode();
  paragraph.replace(line, true);
};

export const registerLineTransforms = (editor: LexicalEditor) =>
  mergeRegister(
    editor.registerNodeTransform(CmsLineNode, $keepLineInPlace),
    editor.registerNodeTransform(ListItemNode, $keepContainer),
    editor.registerNodeTransform(QuoteNode, $keepContainer),
    editor.registerNodeTransform(ParagraphNode, $paragraphInItem)
  );
