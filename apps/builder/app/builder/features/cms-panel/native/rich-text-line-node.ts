/**
 * A line: each maximal run of inline content of a list item or quote
 * that also holds a block. No list item and no quote holds inline content
 * beside a non-inline child. The stored HTML never shows a line: its export
 * writes its children only.
 */
import {
  $createListItemNode,
  $isListItemNode,
  $isListNode,
  ListItemNode,
} from "@lexical/list";
import { $isQuoteNode } from "@lexical/rich-text";
import {
  $applyNodeReplacement,
  $createLineBreakNode,
  $createParagraphNode,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isLineBreakNode,
  $isRangeSelection,
  DecoratorNode,
  type DOMConversionMap,
  type DOMExportOutput,
  ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  ParagraphNode,
  type PointType,
  type RangeSelection,
  type SerializedElementNode,
  TextNode,
} from "lexical";

/**
 * 15.11: the nodes the clipboard writer's scratch editor makes to give an
 * element end a place in text: types of their own, registered in the
 * scratch editor only, so no real node is ever taken for one. They are
 * dropped from the editor data by type and from text/html by their mark.
 */
export const PLACE_ATTRIBUTE = "data-cms-place";

const markExport = (output: DOMExportOutput) => {
  if (output.element instanceof HTMLElement) {
    output.element.setAttribute(PLACE_ATTRIBUTE, "");
  }
  return output;
};

export class CmsPlaceTextNode extends TextNode {
  static getType() {
    return "cms-place-text";
  }
  static clone(node: CmsPlaceTextNode) {
    return new CmsPlaceTextNode(node.__text, node.__key);
  }
  static importJSON() {
    return new CmsPlaceTextNode("");
  }
  exportJSON() {
    return { ...super.exportJSON(), type: "cms-place-text" };
  }
  exportDOM(editor: LexicalEditor) {
    return markExport(super.exportDOM(editor));
  }
}

export class CmsPlaceParagraphNode extends ParagraphNode {
  static getType() {
    return "cms-place-paragraph";
  }
  static clone(node: CmsPlaceParagraphNode) {
    return new CmsPlaceParagraphNode(node.__key);
  }
  static importJSON() {
    return new CmsPlaceParagraphNode();
  }
  exportJSON() {
    return { ...super.exportJSON(), type: "cms-place-paragraph" };
  }
  exportDOM(editor: LexicalEditor) {
    return markExport(super.exportDOM(editor));
  }
}

export class CmsPlaceItemNode extends ListItemNode {
  static getType() {
    return "cms-place-item";
  }
  static clone(node: CmsPlaceItemNode) {
    return new CmsPlaceItemNode(node.__value, node.__checked, node.__key);
  }
  static importJSON() {
    return new CmsPlaceItemNode();
  }
  exportJSON() {
    return { ...super.exportJSON(), type: "cms-place-item" };
  }
  exportDOM(editor: LexicalEditor) {
    return markExport(super.exportDOM(editor));
  }
}

export const PLACE_TYPES = new Set([
  "cms-place-text",
  "cms-place-paragraph",
  "cms-place-item",
]);

export const placeNodes = [
  CmsPlaceTextNode,
  CmsPlaceParagraphNode,
  CmsPlaceItemNode,
];

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
   * Enter in a line (D2, D19). Lexical has split the line at the caret and
   * moves what followed the caret in it to the node this returns. Four
   * cases, each its own branch below.
   */
  insertNewAfter(
    selection: RangeSelection,
    restoreSelection = true
  ): ElementNode {
    const parent = this.getParent();
    const isItem = $isListItemNode(parent);
    const rest = this.getNextSiblings();
    const point = selection.anchor;
    // 5.8, an empty last line: Enter moves to a new item and the line goes
    if (isItem && this.isEmpty() && rest.length === 0) {
      const item = $createListItemNode();
      parent.insertAfter(item);
      this.remove();
      return item;
    }
    // TQT, a line's end before a block: the new item starts with that
    // block and the caret goes to its start, as at the head
    const last = this.getLastDescendant();
    const atEnd =
      (point.key === this.getKey() &&
        point.offset === this.getChildrenSize()) ||
      (last !== null &&
        point.key === last.getKey() &&
        point.offset === last.getTextContentSize());
    if (
      isItem &&
      atEnd &&
      rest.length > 0 &&
      $isElementNode(rest[0]) &&
      rest[0].isInline() === false
    ) {
      const item = $createListItemNode();
      parent.insertAfter(item);
      item.append(...rest);
      return item;
    }
    // D19, a line's start in a quote: an empty line (one line break) stays
    // before, and the text stays a line. This relies on Lexical reading the
    // nodes after the caret before it calls this, so the line is still
    // whole here (Task 21 pins it)
    const first = this.getFirstDescendant();
    const atStart =
      (point.key === this.getKey() && point.offset === 0) ||
      (first !== null && point.key === first.getKey() && point.offset === 0);
    if (isItem === false && atStart && this.isEmpty() === false) {
      const line = $createCmsLineNode();
      this.insertAfter(line, restoreSelection);
      this.append($createLineBreakNode());
      return line;
    }
    // the default split: in an item, what follows the caret and the item's
    // later children go to a new item; in a quote, a paragraph follows the
    // line
    if (isItem) {
      const item = $createListItemNode();
      parent.insertAfter(item);
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

export const $createCmsLineNode = () =>
  $applyNodeReplacement(new CmsLineNode());

export const $isCmsLineNode = (
  node: LexicalNode | null | undefined
): node is CmsLineNode => node instanceof CmsLineNode;

export const isInlineContent = (node: LexicalNode) =>
  $isCmsLineNode(node) === false &&
  ($isElementNode(node) || $isDecoratorNode(node) ? node.isInline() : true);

export const isListItemOrQuote = (
  node: LexicalNode | null
): node is ElementNode => $isListItemNode(node) || $isQuoteNode(node);

export type ElementPoint = {
  which: "anchor" | "focus";
  key: string;
  offset: number;
};

/** Element points of the selection, to be set again once nodes have moved. */
export const elementPoints = (): ElementPoint[] => {
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

export const setPoint = (
  which: "anchor" | "focus",
  key: string,
  offset: number
) => {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    selection[which].set(key, offset, "element");
  }
};

export const isLineBreak = (node: LexicalNode | null | undefined) =>
  node !== null && node !== undefined && $isLineBreakNode(node);

/** Whether the selection has a point in the node or below it. */
export const holdsSelection = (node: ElementNode) => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return false;
  }
  return [selection.anchor, selection.focus].some((point) => {
    const at = point.getNode();
    return at.is(node) || node.isParentOf(at);
  });
};

// ============================================================
// Points on a lined container
// ============================================================

/**
 * A lined container (5.1): a list item that holds a non-inline child, or a
 * quote that holds a line. A quote of paragraphs and blocks is not lined.
 * An item that holds only a nested list is lined too: the resolver moves
 * its point into the list.
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
    if (
      (atStart ? node.getPreviousSibling() : node.getNextSibling()) !== null
    ) {
      return false;
    }
    node = node.getParent();
  }
  return node !== null;
};

/**
 * The direct child of a lined container that holds a collapsed caret at
 * its start (backward) or end (forward), with the container.
 */
export const $childAtEdge = (isBackward: boolean) => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
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

/**
 * A rule or a figure; a figure never stands in an item or a quote (Task 8's
 * test).
 */
export const isBlockDecorator = (
  node: LexicalNode | null
): node is DecoratorNode<unknown> =>
  $isDecoratorNode(node) && node.isInline() === false;
