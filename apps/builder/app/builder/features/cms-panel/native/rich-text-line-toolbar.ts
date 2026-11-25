// The Divider handler, Block type's line rules and list off's unwrap.
import { $isListItemNode, $isListNode } from "@lexical/list";
import { $createHorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { $isQuoteNode } from "@lexical/rich-text";
import { $dfs, $findMatchingParent } from "@lexical/utils";
import {
  $createParagraphNode,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  $splitNode,
  ElementNode,
  type LexicalNode,
  type PointType,
  type RangeSelection,
} from "lexical";
import {
  $createCmsLineNode,
  $isCmsLineNode,
  isLinedContainer,
  lineSpike,
} from "./rich-text-line-node";
import { $unwrapLines } from "./rich-text-line-normalise";
import { $inlineEdgeOf } from "./rich-text-line-points";

export type BlockType = "paragraph" | "h2" | "h3" | "h4" | "quote" | "code";

// Paragraph on a line writes nothing: a line already is its
// container's paragraph (D2, D13)
const lineOf = (point: PointType) =>
  $isCmsLineNode(point.getNode())
    ? point.getNode()
    : $findMatchingParent(point.getNode(), $isCmsLineNode);

/**
 * Paragraph on a quote's line unwraps the quote's lines first (round 9).
 */
export const $unwrapQuoteLinesForParagraph = (
  selection: RangeSelection
): void => {
  // text directly in a quote has the quote as its block: Paragraph there
  // unwraps the quote, as at the head, so the quote's lines give way first
  for (const point of [selection.anchor, selection.focus]) {
    const quote = lineOf(point)?.getParent() ?? null;
    if ($isQuoteNode(quote)) {
      $unwrapLines(quote.getChildren());
    }
  }
};

/** Block type that changes nothing writes nothing (D19); true when it is refused. */
export const $refuseBlockTypeOnLine = (block: BlockType): boolean => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return false;
  }
  // Block type that changes nothing writes nothing (D19): Paragraph on
  // a line or on a paragraph
  const isParagraphish = (point: PointType) =>
    lineOf(point) !== null ||
    ($findMatchingParent(point.getNode(), $isParagraphNode) !== null &&
      $findMatchingParent(point.getNode(), (node) => isLinedContainer(node)) !==
        null);
  if (
    block === "paragraph" &&
    isParagraphish(selection.anchor) &&
    isParagraphish(selection.focus)
  ) {
    return true;
  }
  // a code block holds no image: Code on a line holding one changes nothing
  if (block === "code") {
    const line = $findMatchingParent(
      selection.anchor.getNode(),
      $isCmsLineNode
    );
    if (
      line !== null &&
      $isCmsLineNode(line) &&
      line.getChildren().some($isDecoratorNode)
    ) {
      return true;
    }
  }
  return false;
};

export type QuotedLines = { before: Set<string>; quoted: Set<string> };

/** The nodes before a block type and the inline content of lines that stand in quotes. */
export const $quotedLineContent = (): QuotedLines => {
  const before = new Set($dfs().map(({ node }) => node.getKey()));
  // the inline content of lines that stand in quotes
  const quotedLineContent = new Set(
    $dfs()
      .map(({ node }) => node)
      .filter(
        (node) =>
          $isCmsLineNode(node.getParent()) &&
          $isQuoteNode(node.getParent()?.getParent() ?? null)
      )
      .map((node) => node.getKey())
  );
  return { before, quoted: quotedLineContent };
};

export const $restoreLinesAfterBlockType = (lines: QuotedLines): void => {
  const { before, quoted: quotedLineContent } = lines;
  // a line in a quote is a paragraph of that quote: Quote adds no quote
  // inside it
  for (const { node } of $dfs()) {
    if (
      lineSpike.on &&
      $isQuoteNode(node) &&
      before.has(node.getKey()) === false &&
      $isQuoteNode(node.getParent()) &&
      quotedLineContent.has(node.getFirstChild()?.getKey() ?? "")
    ) {
      node.replace($createCmsLineNode(), true);
    }
  }
  // a block made from a line takes no indent: the line reported its item's
  for (const { node } of $dfs()) {
    if (
      lineSpike.on &&
      $isElementNode(node) &&
      before.has(node.getKey()) === false &&
      isLinedContainer(node.getParent()) &&
      node.getIndent() > 0
    ) {
      node.setIndent(0);
    }
  }
};

export const $unwrapListLinesAtCaret = (): void => {
  const selection = $getSelection();
  // the list's lines give way to their children first, so the list
  // comes off as at the head; the paragraphs it leaves hold no line
  const at = $isRangeSelection(selection) ? selection.anchor.getNode() : null;
  let list = at === null ? null : $findMatchingParent(at, $isListNode);
  while (list !== null) {
    const outer = $findMatchingParent(list.getParentOrThrow(), $isListNode);
    if (outer === null) {
      break;
    }
    list = outer;
  }
  if (list !== null) {
    for (const { node } of $dfs(list)) {
      if ($isListItemNode(node)) {
        $unwrapLines(node.getChildren());
      }
    }
  }
};

/**
 * Divider (V1, A1, A2, A4, 15.8): the unwrap, round 9's move from a
 * link's end, and the rule's place at the caret. The removal mark runs
 * before it on the same command.
 */
export const $divider = (): boolean => {
  const selection = $getSelection();
  // Divider in a line splits as at the head: the container's
  // lines give way to their text for this update (V1)
  // Divider over a range keeps the head's write: the lines of the
  // containers its ends stand in give way for this update (A4)
  if ($isRangeSelection(selection) && selection.isCollapsed() === false) {
    for (const point of [selection.anchor, selection.focus]) {
      const line = $findMatchingParent(point.getNode(), $isCmsLineNode);
      const container = line?.getParent() ?? null;
      if (container !== null && container.isAttached()) {
        $unwrapLines(container.getChildren());
      }
    }
    return false;
  }
  if ($isRangeSelection(selection)) {
    const line = $findMatchingParent(
      selection.anchor.getNode(),
      $isCmsLineNode
    );
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
      let child: LexicalNode | null =
        $isRangeSelection(range) && range.isCollapsed()
          ? range.anchor.getNode()
          : null;
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
            const [left] = (
              $isTextNode(at) ? at.splitText(point.offset) : [at]
            ) as LexicalNode[];
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
          if (parent === null || $isRootOrShadowRoot(parent)) {
            break;
          }
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
        } else if (
          parent !== null &&
          $isRootOrShadowRoot(parent) &&
          offset >= node.getChildrenSize()
        ) {
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
};
