/**
 * The rich text control (4.3.3.1): a `LexicalComposer` in the builder
 * document, never the canvas's text editor. Its node set and HTML are
 * `rich-text-html.ts`'s; `field-controls.tsx` loads this module lazily, so
 * Lexical stays out of the builder's first load.
 *
 * A value the editor would not keep whole (a block shape its export does
 * not reproduce) opens read-only, so nothing is lost silently.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  $copyNode,
  $createNodeSelection,
  $createParagraphNode,
  $createTextNode,
  $getAdjacentNode,
  $getRoot,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  $isDecoratorNode,
  $isElementNode,
  $isParagraphNode,
  $isRootNode,
  $isLineBreakNode,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_DOWN_COMMAND,
  type BaseSelection,
  type ElementNode,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  FORMAT_TEXT_COMMAND,
  ParagraphNode,
  PASTE_COMMAND,
  SELECTION_CHANGE_COMMAND,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type PointType,
  type RangeSelection,
  type TextFormatType,
  type TextNode,
} from "lexical";
import {
  $createLinkNode,
  $isLinkNode,
  $toggleLink,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from "@lexical/link";
import {
  $createListItemNode,
  $createListNode,
  $isListItemNode,
  $isListNode,
  ListItemNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  ListNode,
} from "@lexical/list";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  HeadingNode,
  QuoteNode,
} from "@lexical/rich-text";
import {
  $generateNodesFromSerializedNodes,
  $insertDataTransferForRichText,
} from "@lexical/clipboard";
import { $createCodeNode, $isCodeNode } from "@lexical/code";
import { $setBlocksType } from "@lexical/selection";
import {
  $dfs,
  $findMatchingParent,
  mergeRegister,
  objectKlassEquals,
} from "@lexical/utils";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LEXICAL_CLIPBOARD_TYPE } from "./rich-text-line-clipboard";
import {
  fieldNamespaceOf,
  provideFieldHandlers,
  registerRichTextCommands,
} from "./rich-text-line-commands";
import {
  CmsHistoryPlugin,
  registerCompositionStep,
} from "./rich-text-line-history";
import { lineSpike } from "./rich-text-line-node";
import { registerLineInputListener } from "./rich-text-line-node-selection";
import {
  $unwrapLines,
  registerLineTransforms,
} from "./rich-text-line-normalise";
import { $intoLine, $pasteTextIntoItemLine } from "./rich-text-line-paste";
import {
  $caretOffEmptyLine,
  $pointIntoAdjacentBlock,
  $resolveLinedPoints,
  focusEditor,
  isPressing,
  removeKeptLines,
} from "./rich-text-line-points";
import {
  $prepareRemoval,
  $removeWhereNoTextStands,
  $tagRemoval,
} from "./rich-text-line-removal";
import {
  $quotedLineContent,
  $refuseBlockTypeOnLine,
  $restoreLinesAfterBlockType,
  $unwrapListLinesAtCaret,
  $unwrapQuoteLinesForParagraph,
  type BlockType,
} from "./rich-text-line-toolbar";
import { watchField, type FieldValue } from "./rich-text-field-watch";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import {
  Button,
  css,
  cssVar,
  Flex,
  Grid,
  IconButton,
  InputField,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  Switch,
  Text,
  textVariants,
  theme,
  toast,
  Tooltip,
} from "@webstudio-is/design-system";
import {
  BoldIcon,
  ImageIcon,
  LinkIcon,
  ListIcon,
  MinusIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
} from "@webstudio-is/icons";
import type { CmsRichTextValue, CmsSource } from "./cms-source";
import { getToastText, type CmsRefusal } from "./cms-logic";
import {
  CMS_IMAGE_ACCEPT,
  checkCmsImageFile,
  uploadCmsImage,
} from "./cms-image-upload";
import {
  $caretBeside,
  $createCmsImageNode,
  $isCmsFigureNode,
  $isCmsImageNode,
  type CmsImageAttributes,
} from "./rich-text-image-node";
import {
  exportRichTextHtml,
  getRichTextReadOnlyReason,
  importRichTextHtml,
  readRichTextValue,
  richTextHasImage,
  richTextHref,
  richTextHtmlConfig,
  PASTE_MARKS,
  pushMarksIntoBlocks,
  registerRichTextTransforms,
  richTextNodes,
} from "./rich-text-html";
import { RICH_TEXT_MAX_DEPTH } from "./rich-text-nodes";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";

const blockSpacing = { margin: 0, marginBottom: theme.spacing[5] };

/** Lexical takes class name strings; stitches gives each from `.className`. */
const editorTheme = {
  paragraph: css(blockSpacing)().className,
  heading: {
    h2: css(textVariants.bigTitle, blockSpacing, { userSelect: "text" })()
      .className,
    h3: css(textVariants.titles, blockSpacing, { userSelect: "text" })()
      .className,
    h4: css(textVariants.labels, blockSpacing, { userSelect: "text" })()
      .className,
  },
  quote: css(blockSpacing, {
    paddingLeft: theme.spacing[5],
    borderLeft: `2px solid ${cssVar("--border-default")}`,
  })().className,
  list: {
    ul: css(blockSpacing, { paddingLeft: theme.spacing[9] })().className,
    ol: css(blockSpacing, { paddingLeft: theme.spacing[9] })().className,
  },
  code: css(textVariants.mono, blockSpacing, {
    display: "block",
    padding: theme.spacing[3],
    background: cssVar("--background-primary"),
    borderRadius: theme.borderRadius[3],
    whiteSpace: "pre-wrap",
    userSelect: "text",
  })().className,
  link: css({
    color: cssVar("--foreground-accent"),
    textDecoration: "underline",
  })().className,
  text: {
    underline: css({ textDecoration: "underline" })().className,
    strikethrough: css({ textDecoration: "line-through" })().className,
    underlineStrikethrough: css({ textDecoration: "underline line-through" })()
      .className,
    code: css(textVariants.mono, {
      background: cssVar("--background-primary"),
      borderRadius: theme.borderRadius[2],
      userSelect: "text",
    })().className,
  },
};

/** The TextArea's frame: secondary background, a border on hover and focus. */
const frameStyle = css({
  borderRadius: theme.borderRadius[4],
  border: "1px solid transparent",
  background: cssVar("--background-secondary"),
  color: cssVar("--foreground-primary"),
  "&:hover": {
    borderColor: cssVar("--border-default"),
  },
  "&:focus-within": {
    borderColor: cssVar("--border-focus"),
  },
  "&[data-invalid]": {
    borderColor: cssVar("--border-negative"),
  },
  "&[data-disabled]": {
    background: cssVar("--background-disabled"),
    color: cssVar("--foreground-disabled"),
  },
});

const toolbarStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing[1],
  padding: theme.spacing[2],
  minWidth: 0,
  borderBottom: `1px solid ${cssVar("--border-default")}`,
});

const contentStyle = css(textVariants.regular, {
  minHeight: theme.spacing[23],
  padding: theme.spacing[5],
  outline: "none",
  userSelect: "text",
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
  "& hr": {
    border: "none",
    borderTop: `1px solid ${cssVar("--border-default")}`,
    marginBlock: theme.spacing[5],
  },
  // a line adds no space of its own: the break Lexical adds after a stored
  // break that ends a line draws nothing where something follows the line,
  // as the stored break draws nothing at the head before a block. An empty
  // line's single break stays, and so does the added break of the line
  // that holds the caret after its last break
  "& [data-cms-line]:not([data-cms-caret]):has(+ *) > br + br:last-child": {
    display: "none",
  },
});

const NumberedListIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M6.5 4h7.5M6.5 8h7.5M6.5 12h7.5" />
    <path d="M2.5 3l1-.5v3" />
    <path d="M2.25 10.25c0-.6.5-.9 1-.9s1 .3 1 .85c0 .7-2 1.3-2 2.3h2" />
  </svg>
);

const ToolbarButton = ({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) => (
  <Tooltip content={label}>
    <IconButton
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // keeps the editor's selection
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </IconButton>
  </Tooltip>
);

const blockTypes: BlockType[] = [
  "paragraph",
  "h2",
  "h3",
  "h4",
  "quote",
  "code",
];

const blockLabels: Record<BlockType, string> = {
  paragraph: "Paragraph",
  h2: "Heading 2",
  h3: "Heading 3",
  h4: "Heading 4",
  quote: "Quote",
  code: "Code",
};

type ToolbarState = {
  block: BlockType;
  list: "bullet" | "number" | undefined;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  link: boolean;
};

const initialToolbarState: ToolbarState = {
  block: "paragraph",
  list: undefined,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  link: false,
};

const blockTypeOf = (node: LexicalNode): BlockType => {
  const block = $findMatchingParent(
    node,
    (parent) =>
      $isHeadingNode(parent) || $isQuoteNode(parent) || $isCodeNode(parent)
  );
  if ($isHeadingNode(block)) {
    const tag = block.getTag();
    return tag === "h2" || tag === "h3" || tag === "h4" ? tag : "paragraph";
  }
  if ($isQuoteNode(block)) {
    return "quote";
  }
  if ($isCodeNode(block)) {
    return "code";
  }
  return "paragraph";
};

const findLink = (node: LexicalNode) =>
  $findMatchingParent(node, $isLinkNode) as LinkNode | null;

const useToolbarState = (editor: LexicalEditor) => {
  const [state, setState] = useState<ToolbarState>(initialToolbarState);
  useEffect(() => {
    const read = () => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) === false) {
        return;
      }
      const anchor = selection.anchor.getNode();
      const list = $findMatchingParent(anchor, $isListNode) as ListNode | null;
      const listType = list?.getListType();
      setState({
        block: blockTypeOf(anchor),
        list:
          listType === "bullet" || listType === "number" ? listType : undefined,
        bold: selection.hasFormat("bold"),
        italic: selection.hasFormat("italic"),
        underline: selection.hasFormat("underline"),
        strikethrough: selection.hasFormat("strikethrough"),
        link: findLink(anchor) !== null,
      });
    };
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(read);
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          read();
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
  }, [editor]);
  return state;
};

const setBlockType = (editor: LexicalEditor, block: BlockType) => {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection) === false) {
      return;
    }
    // a caret at the root (before a first figure or rule) is in no block
    if (selection.anchor.key === "root" || selection.focus.key === "root") {
      return;
    }
    if (block === "paragraph") {
      $unwrapQuoteLinesForParagraph(selection);
    }
    if ($refuseBlockTypeOnLine(block)) {
      return;
    }

    const before = $quotedLineContent();
    $setBlocksType(selection, () => {
      switch (block) {
        case "paragraph":
          return $createParagraphNode();
        case "quote":
          return $createQuoteNode();
        case "code":
          return $createCodeNode();
        default:
          return $createHeadingNode(block);
      }
    });
    $restoreLinesAfterBlockType(before);
  });
  focusEditor(editor);
};

/**
 * No list item holds a block after its nested list (a paste into a nested
 * item can leave one). A paragraph after it becomes an item after the item
 * that holds the list, at that item's level, and an empty one goes. A list
 * after it (the rest of a list the paste split) nests under the last item
 * made, or joins the list before it, keeping its level. Any other block
 * leaves the outermost list, splitting it at every level between, with
 * whatever follows it, so the reading order and every untouched item's
 * level stay.
 */
const $liftBlocksAfterNestedList = (item: ListItemNode) => {
  const listAt = item.getChildren().findIndex($isListNode);
  if (listAt === -1) {
    return;
  }
  $unwrapLines(item.getChildren().slice(listAt + 1));
  const children = item.getChildren();
  const after = children.slice(listAt + 1);
  const isBlock = (node: LexicalNode) =>
    ($isElementNode(node) || $isDecoratorNode(node)) &&
    node.isInline() === false;
  const hasContent = (node: LexicalNode) =>
    /[^\s]|\u00a0/.test(node.getTextContent()) ||
    $dfs(node).some((entry) => $isDecoratorNode(entry.node));
  // a point whose node the lift removes (line breaks and white space after
  // the list, or the item past its list) goes to the end of the content
  // before it; any other point stays where the edit left it
  const selection = $getSelection();
  const moved = (
    $isRangeSelection(selection) ? [selection.anchor, selection.focus] : []
  ).flatMap((point) => {
    const node = point.getNode();
    const onItem = point.key === item.getKey();
    if (
      onItem
        ? point.type !== "element" || point.offset <= listAt
        : after.some(
            (entry) =>
              entry.is(node) ||
              ($isElementNode(entry) && entry.isParentOf(node))
          ) === false
    ) {
      return [];
    }
    // the nodes before the point, nearest first
    const nodes = $dfs(item).map((entry) => entry.node);
    let at = nodes.indexOf(node);
    if (point.type === "element" && $isElementNode(node)) {
      const child = node.getChildAtIndex(point.offset);
      at = child === null ? at + $dfs(node).length : nodes.indexOf(child);
    }
    const before = nodes
      .slice(0, at)
      .filter((entry) => entry.isParentOf(node) === false && entry !== item)
      .reverse();
    return [{ point, onItem, before }];
  });
  const $caretAtEnd = () => {
    const gone = moved.find(
      ({ point, onItem }) => onItem || point.getNode().isAttached() === false
    );
    const target = gone?.before.find((node) => node.isAttached());
    if (target === undefined) {
      return;
    }
    const last = $isElementNode(target) ? target.getLastDescendant() : target;
    if ($isTextNode(last)) {
      last.select(last.getTextContentSize(), last.getTextContentSize());
    } else if ($isElementNode(target)) {
      target.selectEnd();
    } else {
      target.selectNext(0, 0);
    }
  };
  if (after.some(isBlock) === false) {
    // inline content after the list stands in an item after this one,
    // without the line breaks and white space at its edges; with no
    // content, nothing stays after the list
    const first = after.findIndex(hasContent);
    const last = after.findLastIndex(hasContent);
    for (const [index, node] of after.entries()) {
      if (index < first || index > last || first === -1) {
        node.remove();
      }
    }
    if (first !== -1) {
      const next = $createListItemNode();
      next.append(...after.slice(first, last + 1));
      item.insertAfter(next);
    }
    $caretAtEnd();
    return;
  }
  const isEmptyList = (node: ListNode) =>
    node
      .getChildren()
      .every(
        (entry) => $isListItemNode(entry) && entry.getChildrenSize() === 0
      );
  let anchor: LexicalNode = item;
  let lifted: LexicalNode | undefined;
  let inlineRun: ParagraphNode | undefined;
  // once a block has left the lists: the tail's levels, innermost first,
  // each held in an item at the start of the level around it
  let levels: ListNode[] = [];
  let remainders = 0;
  // a run of inline content ends without its trailing line breaks and
  // white space
  const endRun = () => {
    for (
      let last = inlineRun?.getLastChild();
      last !== null && last !== undefined && hasContent(last) === false;
      last = inlineRun?.getLastChild()
    ) {
      last.remove();
    }
    inlineRun = undefined;
  };
  for (const child of after) {
    if (lifted !== undefined) {
      if ($isListNode(child) && levels.length > 0) {
        endRun();
        // the rest of a split list keeps its level, before what followed
        if (isEmptyList(child) === false) {
          const holder = $createListItemNode();
          holder.append(child);
          const at = levels[0].getChildAtIndex(remainders);
          if (at === null) {
            levels[0].append(holder);
          } else {
            at.insertBefore(holder);
          }
          remainders += 1;
        } else {
          child.remove();
        }
        continue;
      }
      // inline content at the top level stands in a paragraph
      if (isBlock(child) === false && $isRootNode(lifted.getParent())) {
        if (inlineRun === undefined) {
          // a run starts at content
          if (hasContent(child) === false) {
            child.remove();
            continue;
          }
          inlineRun = $createParagraphNode();
          lifted.insertAfter(inlineRun);
          lifted = inlineRun;
        }
        inlineRun.append(child);
        continue;
      }
      endRun();
      lifted.insertAfter(child);
      lifted = child;
      continue;
    }
    if ($isParagraphNode(child)) {
      if (child.getChildrenSize() === 0) {
        child.remove();
        continue;
      }
      const next = $createListItemNode();
      next.append(...child.getChildren());
      child.remove();
      anchor.insertAfter(next);
      anchor = next;
      continue;
    }
    if ($isListNode(child)) {
      if (isEmptyList(child)) {
        child.remove();
        continue;
      }
      // a nested list stands in its own item, after the last item made
      if (anchor !== item && $isListItemNode(anchor)) {
        const holder = $createListItemNode();
        holder.append(child);
        anchor.insertAfter(holder);
        anchor = holder;
        continue;
      }
      const before = child.getPreviousSibling();
      if ($isListNode(before) && before.getListType() === child.getListType()) {
        before.append(...child.getChildren());
        child.remove();
        continue;
      }
    }
    if (isBlock(child) === false) {
      continue;
    }
    // every list from the anchor's to the outermost splits after the item
    // on the anchor's path; what follows keeps its level in the tail
    let top: LexicalNode = anchor;
    let topList = top.getParent();
    levels = [];
    for (;;) {
      if ($isListNode(topList) === false) {
        return;
      }
      const level = $createListNode(topList.getListType());
      const inner = levels.at(-1);
      if (inner !== undefined) {
        const holder = $createListItemNode();
        holder.append(inner);
        level.append(holder);
      }
      level.append(...top.getNextSiblings());
      levels.push(level);
      const parent = topList.getParent();
      if (
        $isListItemNode(parent) === false ||
        $isListNode(parent.getParent()) === false
      ) {
        break;
      }
      top = parent;
      topList = parent.getParent();
    }
    topList.insertAfter(child);
    lifted = child;
    lifted.insertAfter(levels[levels.length - 1]);
  }
  endRun();
  $caretAtEnd();
  // levels left empty go, innermost first, each with the item that holds it
  for (const [index, level] of levels.entries()) {
    if (level.getChildrenSize() > 0) {
      break;
    }
    const holder = level.getParent();
    level.remove(true);
    if (index < levels.length - 1 && $isListItemNode(holder)) {
      holder.remove(true);
    }
  }
};

/**
 * How many lists and quotes hold a node, once a quote or a list of another
 * type after an item's nested list has left every list around it
 * (`$liftBlocksAfterNestedList`).
 */
const $nestingOf = (node: LexicalNode) => {
  // a quote, or a list joining no list before it, after an item's nested
  // list
  const $leavesTheLists = (child: LexicalNode) => {
    const before = child.getPreviousSiblings();
    const listAt = before.findIndex($isListNode);
    if (listAt === -1) {
      return false;
    }
    if ($isQuoteNode(child)) {
      return true;
    }
    // a list after a paragraph nests under its item; one after a block
    // that left the lists stays in the rest of the list
    if (
      $isListNode(child) === false ||
      before
        .slice(listAt + 1)
        .some(
          (sibling) =>
            $isParagraphNode(sibling) ||
            ($isElementNode(sibling) || $isDecoratorNode(sibling)
              ? sibling.isInline() === false
              : false)
        )
    ) {
      return false;
    }
    const previous = child.getPreviousSibling();
    return (
      $isListNode(previous) === false ||
      previous.getListType() !== child.getListType()
    );
  };
  let around = 0;
  let child = node;
  let parent = node.getParent();
  while (parent !== null) {
    if ($isListItemNode(parent) && $leavesTheLists(child)) {
      while ($isListItemNode(parent) || $isListNode(parent)) {
        parent = parent.getParent();
      }
      continue;
    }
    if ($isListNode(parent) || $isQuoteNode(parent)) {
      around += 1;
    }
    child = parent;
    parent = parent.getParent();
  }
  return around;
};

/**
 * A quote at the depth limit in a list item gives way to items at that
 * item's level, in order: each block's content becomes an item after it, a
 * list's items join that level, and what followed the quote in its item
 * follows them.
 */
const $liftQuoteOutOfItem = (quote: QuoteNode, item: ListItemNode) => {
  const rest = $unwrapLines(quote.getNextSiblings());
  let at: LexicalNode = item;
  // a quote inside gives way to its blocks too, in order
  const children: LexicalNode[] = [];
  const collect = (from: QuoteNode) => {
    for (const child of from.getChildren()) {
      if ($isQuoteNode(child)) {
        collect(child);
      } else {
        children.push(child);
      }
    }
  };
  collect(quote);
  for (const child of children) {
    if ($isListNode(child)) {
      for (const entry of child.getChildren()) {
        at.insertAfter(entry);
        at = entry;
      }
      child.remove();
      continue;
    }
    const next = $createListItemNode();
    if ($isElementNode(child) && child.isInline() === false) {
      next.append(...child.getChildren());
      child.remove();
    } else {
      next.append(child);
    }
    at.insertAfter(next);
    at = next;
  }
  quote.remove();
  if (rest.length > 0) {
    const tail = $createListItemNode();
    tail.append(...rest);
    at.insertAfter(tail);
  }
  if (item.getChildrenSize() === 0) {
    item.remove();
  }
};

/**
 * No list or quote nests past the platform's depth limit, whatever made the
 * nesting (a paste from any source, at any depth): one past it moves up a
 * level, keeping the reading order, until it is within the limit. A list in
 * an item moves its items beside that item; a list in a quote splits the
 * quote around it; a quote gives way to its blocks.
 */
const $liftPastDepthLimit = (node: ListNode | QuoteNode) => {
  if (node.isAttached() === false) {
    return;
  }
  if ($nestingOf(node) < RICH_TEXT_MAX_DEPTH - 1) {
    return;
  }
  const parent = node.getParent();
  if ($isQuoteNode(node) && $isListItemNode(parent)) {
    $liftQuoteOutOfItem(node, parent);
    return;
  }
  if ($isQuoteNode(node)) {
    for (const child of node.getChildren()) {
      node.insertBefore(child);
    }
    node.remove();
    return;
  }
  if ($isListItemNode(parent)) {
    let at: LexicalNode = parent;
    for (const item of node.getChildren()) {
      at.insertAfter(item);
      at = item;
    }
    node.remove();
    if (parent.getChildrenSize() === 0) {
      parent.remove();
    }
    return;
  }
  if ($isQuoteNode(parent)) {
    const rest = node.getNextSiblings();
    parent.insertAfter(node);
    if (rest.length > 0) {
      const after = $createQuoteNode();
      after.append(...rest);
      node.insertAfter(after);
    }
    if (parent.getChildrenSize() === 0) {
      parent.remove();
    }
  }
};

/**
 * A paragraph or heading holds no block: one inside it (a list, a quote, a
 * paragraph) splits it, standing between its two parts, and a part left
 * empty goes.
 */
const $liftBlocksOutOfTextBlock = (block: ElementNode) => {
  const inner = block
    .getChildren()
    .find(
      (child) =>
        ($isElementNode(child) || $isDecoratorNode(child)) &&
        child.isInline() === false
    );
  if (inner === undefined) {
    return;
  }
  const rest = inner.getNextSiblings();
  block.insertAfter(inner);
  if (rest.length > 0) {
    const tail = $copyNode(block);
    inner.insertAfter(tail);
    tail.append(...rest);
  }
  if (block.getChildrenSize() === 0) {
    block.remove();
  }
};

/** The node rules the read-only check runs too (`registerRichTextTransforms`). */
const TransformsPlugin = ({ namespace }: { namespace: string }) => {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      mergeRegister(
        registerRichTextTransforms(editor),
        // the live editor's alone: a stored value of these shapes reads lossy
        editor.registerNodeTransform(ListNode, $liftPastDepthLimit),
        editor.registerNodeTransform(QuoteNode, $liftPastDepthLimit),
        editor.registerNodeTransform(ParagraphNode, $liftBlocksOutOfTextBlock),
        editor.registerNodeTransform(HeadingNode, $liftBlocksOutOfTextBlock),
        // a list item's lift runs first in the item's one transform
        registerLineTransforms(editor, $liftBlocksAfterNestedList),
        // every handler that shares a command and a priority with a line
        // handler, in one stated order; the field's plugins above provide
        // theirs
        registerRichTextCommands(editor, {
          namespace,
          theme: editorTheme,
          nodes: editorNodes,
        }),
        registerLineInputListener(editor),
        registerCompositionStep(editor)
      ),
    [editor, namespace]
  );
  return null;
};

const LinkButton = ({
  id,
  active,
  disabled,
}: {
  id: string;
  active: boolean;
  disabled: boolean;
}) => {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [newTab, setNewTab] = useState(false);
  const [error, setError] = useState<string>();
  const newTabId = `${id}-link-new-tab`;

  const readLink = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      const link = $isRangeSelection(selection)
        ? findLink(selection.anchor.getNode())
        : null;
      setUrl(link?.getURL() ?? "");
      setNewTab(link?.getTarget() === "_blank");
    });
  };

  const closedByPressInEditor = useRef(false);
  const apply = () => {
    // B: an edit: lines a press's caret left go first
    removeKeptLines(editor);
    // only an address the site shows as a link
    const href = richTextHref(url);
    if (href === null) {
      setError("Not a link");
      return;
    }
    editor.dispatchCommand(
      TOGGLE_LINK_COMMAND,
      newTab
        ? { url: href, target: "_blank", rel: "noopener noreferrer" }
        : { url: href, target: null, rel: null }
    );
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          readLink();
          setError(undefined);
        }
        setOpen(next);
      }}
    >
      <Tooltip content="Link">
        <PopoverTrigger asChild>
          <IconButton
            type="button"
            aria-label="Link"
            aria-pressed={active}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
          >
            <LinkIcon />
          </IconButton>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        align="start"
        css={{ width: theme.spacing[33], padding: theme.panel.padding }}
        // 15.14 (a): a close that came from a press inside the editor does
        // not hand focus back (the press gives the editor focus itself)
        onPointerDownOutside={(event) => {
          const target = (event.detail?.originalEvent?.target ??
            event.target) as Node | null;
          closedByPressInEditor.current =
            target !== null &&
            editor.getRootElement()?.contains(target) === true;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const byPress = closedByPressInEditor.current;
          closedByPressInEditor.current = false;
          if (byPress && lineSpike.closeFocusFixOff === false) {
            return;
          }
          focusEditor(editor);
        }}
      >
        <Grid gap="2">
          <InputField
            type="url"
            aria-label="URL"
            placeholder="https://"
            autoFocus
            value={url}
            color={error === undefined ? undefined : "error"}
            aria-invalid={error === undefined ? undefined : true}
            onChange={(event) => {
              setUrl(event.currentTarget.value);
              setError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                apply();
              }
            }}
          />
          {error !== undefined && (
            <Text role="alert" color="destructive">
              {error}
            </Text>
          )}
          <Flex align="center" justify="between" gap="2" wrap="wrap">
            <Flex align="center" gap="2">
              <Switch
                id={newTabId}
                checked={newTab}
                onCheckedChange={setNewTab}
              />
              <Label htmlFor={newTabId}>New tab</Label>
            </Flex>
            <Flex gap="1">
              {active && (
                <Button
                  color="ghost"
                  onClick={() => {
                    removeKeptLines(editor);
                    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
                    setOpen(false);
                  }}
                >
                  Remove
                </Button>
              )}
              <Button color="primary" onClick={apply}>
                Apply
              </Button>
            </Flex>
          </Flex>
        </Grid>
      </PopoverContent>
    </Popover>
  );
};

/** What the toolbar's Image needs: E9, and where its failures go. */
type ImageUpload = {
  source: Pick<CmsSource, "uploadImage">;
  /** "Not an image", "Over 4 MB" or "Not uploaded", under the field. */
  onError?: (error: string | undefined) => void;
  /** True while E9 is in flight: Save and Publish wait for it. */
  onBusyChange?: (busy: boolean) => void;
  /** E9 answered `unauthorized` or `mfa_required`: the screen's line. */
  onRefusal?: (refusal: CmsRefusal) => void;
};

/**
 * Inserts the image where the caret was when Image was chosen, or in a new
 * paragraph at the end when that place is gone or is a code block.
 */
const insertImage = (
  editor: LexicalEditor,
  caret: RangeSelection | null,
  attributes: CmsImageAttributes
) => {
  // 15.14: an upload that finishes during a press in the editor leaves the
  // press's own caret where the press made it
  const pressed = isPressing(editor);
  editor.update(() => {
    const kept = pressed ? ($getSelection()?.clone() ?? null) : null;
    const $keepPress = () => {
      if (
        $isRangeSelection(kept) === false ||
        lineSpike.focusGuardOff ||
        [kept.anchor, kept.focus].some((point) => {
          const node = $getNodeByKey(point.key);
          return (
            node === null ||
            node.isAttached() === false ||
            point.offset >
              ($isTextNode(node)
                ? node.getTextContentSize()
                : $isElementNode(node)
                  ? node.getChildrenSize()
                  : 0)
          );
        })
      ) {
        return;
      }
      $setSelection(kept);
    };
    const image = $createCmsImageNode(attributes);
    const isAttached =
      caret !== null &&
      $getNodeByKey(caret.anchor.key) !== null &&
      $getNodeByKey(caret.focus.key) !== null;
    if (
      caret !== null &&
      isAttached &&
      $findMatchingParent(caret.anchor.getNode(), $isCodeNode) === null &&
      $findMatchingParent(caret.focus.getNode(), $isCodeNode) === null
    ) {
      $setSelection(caret.clone());
      const placed = $getSelection();
      if ($isRangeSelection(placed) && placed.isCollapsed() === false) {
        // a range starts as the editing commands start it (their first
        // handler); one that holds nothing once its ends are in place
        // (15.10) is the caret left at the block's end: no removal, no mark
        $selectionIntoAdjacentBlocks();
        if ($prepareRemoval(placed, "removal") === false) {
          $tagRemoval();
          $removeWhereNoTextStands(placed);
        }
      }
      $resolveLinedPoints(true);
      const selection = $getSelection() as RangeSelection;
      $editInBlockLedItem(selection, () => selection.insertNodes([image]));
      $keepPress();
      return;
    }
    const paragraph = $createParagraphNode();
    paragraph.append(image);
    $getRoot().append(paragraph);
    $keepPress();
  });
};

const ImageButton = ({
  disabled,
  upload,
}: {
  disabled: boolean;
  upload: ImageUpload;
}) => {
  const [editor] = useLexicalComposerContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<RangeSelection | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const choose = async (file: File) => {
    const refused = checkCmsImageFile(file);
    if (refused !== undefined) {
      upload.onError?.(refused);
      return;
    }
    upload.onError?.(undefined);
    setIsUploading(true);
    upload.onBusyChange?.(true);
    const uploaded = await uploadCmsImage(upload.source, file);
    setIsUploading(false);
    upload.onBusyChange?.(false);
    if (uploaded.ok === false) {
      if ("refusal" in uploaded) {
        if (upload.onRefusal !== undefined) {
          upload.onRefusal(uploaded.refusal);
          return;
        }
        upload.onError?.("Not uploaded");
        return;
      }
      if ("toast" in uploaded) {
        toast.error(getToastText(uploaded.toast));
        return;
      }
      upload.onError?.(uploaded.error);
      return;
    }
    insertImage(editor, caretRef.current, {
      src: uploaded.url,
      alt: "",
      width: uploaded.width === null ? null : String(uploaded.width),
      height: uploaded.height === null ? null : String(uploaded.height),
      title: null,
    });
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={CMS_IMAGE_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file !== undefined) {
            void choose(file);
          }
        }}
      />
      <ToolbarButton
        label="Image"
        disabled={disabled || isUploading}
        onClick={() => {
          caretRef.current = editor.getEditorState().read(() => {
            const selection = $getSelection();
            return $isRangeSelection(selection) ? selection.clone() : null;
          });
          fileRef.current?.click();
        }}
      >
        <ImageIcon />
      </ToolbarButton>
    </>
  );
};

/**
 * A quote holding blocks gives up the blocks the selection covers, from the
 * one holding its start to the one holding its end, in place: the blocks
 * before them stay a quote, and those after them make another. Each level of
 * nested quotes splits the same way, innermost first, so every uncovered
 * block keeps every quote around it. A quote in a list item is left alone:
 * the list command acts on the list around it.
 */
const $unwrapQuotedBlocks = () => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return;
  }
  const [start, end] = selection.isBackward()
    ? [selection.focus, selection.anchor]
    : [selection.anchor, selection.focus];
  const quotes = new Set<QuoteNode>();
  for (const node of selection.getNodes()) {
    for (let at: LexicalNode | null = node; at !== null; at = at.getParent()) {
      if ($isQuoteNode(at)) {
        quotes.add(at);
      }
    }
  }
  const depthOf = (node: LexicalNode) => node.getParentKeys().length;
  const ordered = [...quotes]
    .filter(
      (quote) =>
        $findMatchingParent(quote, $isListItemNode) === null &&
        quote
          .getChildren()
          .some((child) => $isElementNode(child) && child.isInline() === false)
    )
    .sort((one, two) => depthOf(two) - depthOf(one));
  /** The index of the quote's child holding the point, if the quote holds it. */
  const childAt = (quote: QuoteNode, point: typeof start) => {
    const node = point.getNode();
    if (node.is(quote)) {
      return Math.min(point.offset, quote.getChildrenSize() - 1);
    }
    const child = $findMatchingParent(
      node,
      (parent) => parent.getParent()?.is(quote) === true
    );
    return child === null ? undefined : child.getIndexWithinParent();
  };
  for (const quote of ordered) {
    if (quote.isAttached() === false) {
      continue;
    }
    const children = quote.getChildren();
    if (children.length === 0) {
      continue;
    }
    const first = childAt(quote, start) ?? 0;
    const last = childAt(quote, end) ?? children.length - 1;
    if (last < first) {
      continue;
    }
    // a list the selection is in changes its type in place
    if (children.slice(first, last + 1).every($isListNode)) {
      continue;
    }
    let anchor: LexicalNode = quote;
    // inline content between blocks keeps one paragraph per run
    let run: ElementNode | undefined;
    for (const child of children.slice(first, last + 1)) {
      if ($isElementNode(child) && child.isInline() === false) {
        run = undefined;
        anchor.insertAfter(child);
        anchor = child;
      } else {
        if (run === undefined) {
          run = $createParagraphNode();
          anchor.insertAfter(run);
          anchor = run;
        }
        run.append(child);
      }
    }
    const after = children.slice(last + 1);
    if (after.length > 0) {
      const rest = $createQuoteNode();
      anchor.insertAfter(rest);
      rest.append(...after);
    }
    if (first === 0) {
      quote.remove();
    }
  }
};

/** One `role="toolbar"` row, on upstream's `MarkdownToolbar` pattern. */
const Toolbar = ({
  id,
  disabled,
  upload,
}: {
  id: string;
  disabled: boolean;
  upload?: ImageUpload;
}) => {
  const [editor] = useLexicalComposerContext();
  const state = useToolbarState(editor);
  const format = (type: TextFormatType) =>
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
  // a code block holds plain text: no mark and no link
  const inCode = state.block === "code";
  const marksDisabled = disabled || inCode;
  const toggleList = (type: "bullet" | "number") => {
    // one update: one undo step
    editor.update(() => {
      $caretOffEmptyLine();
      // an element caret is kept by the node beside it, as the list
      // commands replace the block it points into
      const selection = $getSelection();
      const kept = $isRangeSelection(selection)
        ? [selection.anchor, selection.focus].map((point) => {
            if (point.type !== "element") {
              return;
            }
            const block = point.getNode();
            if ($isElementNode(block) === false) {
              return;
            }
            const before = block.getChildAtIndex(point.offset - 1);
            if (point.offset > 0 && before !== null) {
              return { node: before, after: true };
            }
            const next = block.getChildAtIndex(point.offset);
            return next === null ? undefined : { node: next, after: false };
          })
        : [];
      if (state.list === type) {
        $unwrapListLinesAtCaret();
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      } else {
        // a quote holding paragraphs gives up the ones the list covers
        // first, so each becomes its own item: one item holding several
        // paragraphs is no list the editor can write back
        $unwrapQuotedBlocks();
        editor.dispatchCommand(
          type === "bullet"
            ? INSERT_UNORDERED_LIST_COMMAND
            : INSERT_ORDERED_LIST_COMMAND,
          undefined
        );
      }
      // the list commands update after this; the caret is set after them
      editor.update(() => {
        const next = $getSelection();
        if ($isRangeSelection(next) === false) {
          return;
        }
        for (const [index, point] of [next.anchor, next.focus].entries()) {
          const at = kept[index];
          const parent = at?.node.getParent();
          if (
            at === undefined ||
            at.node.isAttached() === false ||
            $isElementNode(parent) === false
          ) {
            continue;
          }
          point.set(
            parent.getKey(),
            at.node.getIndexWithinParent() + (at.after ? 1 : 0),
            "element"
          );
        }
      });
    });
  };
  return (
    <div
      className={toolbarStyle()}
      role="toolbar"
      aria-label="Formatting"
      // 15.13 (a): lines a press's caret left go before a toolbar command,
      // at the click (the press is over: nothing moves under the pointer)
      // or the key that runs it
      onClickCapture={(event) => {
        // the toolbar's own controls; a popover's content (a portal) runs
        // the removal at its own command
        if (event.currentTarget.contains(event.target as Node)) {
          removeKeptLines(editor);
        }
      }}
      onKeyDownCapture={(event) => {
        if (event.currentTarget.contains(event.target as Node)) {
          removeKeptLines(editor);
        }
      }}
    >
      <Select
        aria-label="Block type"
        options={blockTypes}
        value={state.block}
        getLabel={(block: BlockType) => blockLabels[block]}
        disabled={disabled}
        onChange={(block) => setBlockType(editor, block)}
      />
      <ToolbarButton
        label="Bold"
        active={state.bold && inCode === false}
        disabled={marksDisabled}
        onClick={() => format("bold")}
      >
        <BoldIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={state.italic && inCode === false}
        disabled={marksDisabled}
        onClick={() => format("italic")}
      >
        <TextItalicIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={state.underline && inCode === false}
        disabled={marksDisabled}
        onClick={() => format("underline")}
      >
        <TextUnderlineIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={state.strikethrough && inCode === false}
        disabled={marksDisabled}
        onClick={() => format("strikethrough")}
      >
        <TextStrikethroughIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Bulleted list"
        active={state.list === "bullet"}
        disabled={disabled}
        onClick={() => toggleList("bullet")}
      >
        <ListIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={state.list === "number"}
        disabled={disabled}
        onClick={() => toggleList("number")}
      >
        <NumberedListIcon />
      </ToolbarButton>
      <LinkButton
        id={id}
        active={state.link && inCode === false}
        disabled={marksDisabled}
      />
      {upload !== undefined && (
        <ImageButton disabled={disabled} upload={upload} />
      )}
      <ToolbarButton
        label="Divider"
        disabled={disabled}
        onClick={() =>
          editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)
        }
      >
        <MinusIcon />
      </ToolbarButton>
    </div>
  );
};

const imageAttributeKeys = ["alt", "height", "src", "title", "width"];

/** Whether the platform's sanitiser keeps `src` on an `img`. */
const keepsImageSrc = (src: string) => {
  const holder = document.createElement("img");
  holder.setAttribute("src", src);
  return /\ssrc="/.test(sanitizeRichTextHtml(holder.outerHTML));
};

/**
 * An image node as this editor writes it: exactly its five attributes, each
 * a string or null, its address one the platform's sanitiser keeps on an
 * `img`, and a figure's caption a string or null.
 */
const isKeptImageNode = (node: {
  type?: unknown;
  attributes?: unknown;
  caption?: unknown;
}) => {
  const attributes = node.attributes;
  if (typeof attributes !== "object" || attributes === null) {
    return false;
  }
  const entries = Object.entries(attributes);
  if (
    entries.length !== imageAttributeKeys.length ||
    entries.some(
      ([key, value]) =>
        imageAttributeKeys.includes(key) === false ||
        (value !== null && typeof value !== "string")
    )
  ) {
    return false;
  }
  const src = (attributes as { src?: unknown }).src;
  if (typeof src !== "string" || keepsImageSrc(src) === false) {
    return false;
  }
  return (
    node.type !== "cms-figure" ||
    node.caption === null ||
    typeof node.caption === "string"
  );
};

/**
 * Whether copied Lexical nodes hold a link the Link control's rule refuses,
 * or an image node unlike the ones this editor writes. Lexical reads copied
 * nodes only from its own namespace, one per field.
 */
const hasRefusedNode = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some(hasRefusedNode);
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const node = value as {
    type?: unknown;
    url?: unknown;
    attributes?: unknown;
    caption?: unknown;
    children?: unknown;
    nodes?: unknown;
  };
  if (
    (node.type === "cms-image" || node.type === "cms-figure") &&
    isKeptImageNode(node) === false
  ) {
    return true;
  }
  if (
    (node.type === "link" || node.type === "autolink") &&
    richTextHref(typeof node.url === "string" ? node.url : undefined) === null
  ) {
    return true;
  }
  return hasRefusedNode(node.children) || hasRefusedNode(node.nodes);
};

/**
 * The pasted data with each link the Link control's rule (`richTextHref`)
 * refuses unwrapped to its text, and links and marks moved inside the
 * blocks they wrap; undefined when it needs neither.
 */
const withoutRefusedLinks = (data: DataTransfer): DataTransfer | undefined => {
  const html = data.getData("text/html");
  let cleanHtml: string | undefined;
  if (html !== "") {
    const dom = new DOMParser().parseFromString(html, "text/html");
    const movedMarks = pushMarksIntoBlocks(dom.body);
    // an image enters a value only from stored HTML, an upload or the
    // field's own clipboard data: dropped from pasted HTML here, before the
    // import, so the words around it keep their space
    const images = Array.from(dom.querySelectorAll("img")).filter(
      (image) => image.parentElement?.tagName !== "FIGURE"
    );
    for (const image of images) {
      image.remove();
    }
    const refused = Array.from(dom.querySelectorAll("a")).filter(
      (anchor) =>
        richTextHref(anchor.getAttribute("href") ?? undefined) === null
    );
    for (const anchor of refused) {
      anchor.replaceWith(...Array.from(anchor.childNodes));
    }
    // a link that held only an image is left with nothing to link
    const emptied = Array.from(dom.querySelectorAll("a")).filter(
      (anchor) => (anchor.textContent ?? "").trim() === ""
    );
    for (const anchor of emptied) {
      anchor.replaceWith(...Array.from(anchor.childNodes));
    }
    if (
      movedMarks ||
      images.length > 0 ||
      refused.length > 0 ||
      emptied.length > 0
    ) {
      cleanHtml = dom.body.innerHTML;
    }
  }
  let dropsLexical = false;
  const copied = data.getData(LEXICAL_CLIPBOARD_TYPE);
  if (copied !== "") {
    try {
      dropsLexical = hasRefusedNode(JSON.parse(copied));
    } catch {
      // not Lexical's data: the paste never reads it
    }
  }
  if (cleanHtml === undefined && dropsLexical === false) {
    return;
  }
  const next = new DataTransfer();
  for (const type of data.types) {
    if (type === "Files" || (type === LEXICAL_CLIPBOARD_TYPE && dropsLexical)) {
      continue;
    }
    next.setData(
      type,
      type === "text/html" && cleanHtml !== undefined
        ? cleanHtml
        : data.getData(type)
    );
  }
  return next;
};

/**
 * A pasted or dropped link takes the Link control's rule: one it refuses is
 * inserted as its text. A stored value's links take the import's rule
 * instead, so this applies to paste and drop only. Any link, however it was
 * made, whose address the import's rule refuses becomes its text.
 */
/** A link's attributes, for the links a split makes. */
const linkAttributes = (link: LinkNode) => ({
  target: link.getTarget(),
  rel: link.getRel(),
  title: link.getTitle(),
});

/**
 * The site never shows an image inside a link, so a link the Link control
 * makes or extends never holds one: a link at the root (around a figure) is
 * unwrapped, and a link is split around each image it holds.
 */
const $keepImagesOutOfLinks = (links: Set<LinkNode>) => {
  for (const link of links) {
    if (link.isAttached() === false) {
      continue;
    }
    if (link.getParent()?.getKey() === "root") {
      for (const child of link.getChildren()) {
        link.insertBefore(child);
      }
      link.remove();
      continue;
    }
    const children = link.getChildren();
    if (children.some($isCmsImageNode) === false) {
      continue;
    }
    let run: LinkNode | null = null;
    for (const child of children) {
      if ($isCmsImageNode(child)) {
        link.insertBefore(child);
        run = null;
        continue;
      }
      if (run === null) {
        run = $createLinkNode(link.getURL(), linkAttributes(link));
        link.insertBefore(run);
      }
      run.append(child);
    }
    link.remove();
  }
};

/**
 * The inline image ending the caret's line (up to its next line break), when
 * the browser's End would stop before it: the caret's End moves past it.
 */
const $imageEndingLine = (
  editor: LexicalEditor,
  point: PointType
): LexicalNode | undefined => {
  // the node the caret sits after: a text caret's own node, an element
  // caret's child before it (its first child at the element's start)
  let focus: LexicalNode = point.getNode();
  let fromEnd = false;
  if (point.type === "element" && $isElementNode(focus)) {
    const children = focus.getChildren();
    const before = children[point.offset - 1];
    if (before !== undefined) {
      focus = before;
      fromEnd = true;
    } else if (children[0] !== undefined) {
      focus = children[0];
    }
  }
  const block = $findMatchingParent(
    focus,
    (node) => $isElementNode(node) && node.isInline() === false
  );
  if ($isElementNode(block) === false) {
    return;
  }
  // the block's leaves in order, stopping at a nested block
  const leaves: LexicalNode[] = [];
  const collect = (element: ElementNode) => {
    for (const child of element.getChildren()) {
      if ($isElementNode(child)) {
        if (child.isInline()) {
          collect(child);
        }
      } else {
        leaves.push(child);
      }
    }
  };
  collect(block);
  const inFocus = (leaf: LexicalNode) =>
    leaf.is(focus) || leaf.isParentOf(focus) || focus.isParentOf(leaf);
  // an element caret's line goes on from after the node it follows
  const start = fromEnd
    ? leaves.findLastIndex(inFocus) + 1
    : leaves.findIndex(inFocus);
  // a caret already ending its line just after an image stays there: the
  // browser's own End would leave the image's side
  let last: LexicalNode | undefined =
    fromEnd && $isCmsImageNode(focus) ? focus : undefined;
  for (const leaf of leaves.slice(Math.max(start, 0))) {
    if ($isLineBreakNode(leaf)) {
      break;
    }
    last = leaf;
  }
  if (last === undefined || $isCmsImageNode(last) === false) {
    return;
  }
  // a line the browser wraps ends where the browser says; a caret with no
  // box of its own (an element caret) is measured by the node it follows
  const image = editor.getElementByKey(last.getKey());
  const caret = window.getSelection()?.rangeCount
    ? window.getSelection()!.getRangeAt(0).getBoundingClientRect()
    : undefined;
  const range =
    caret !== undefined && caret.height > 0
      ? caret
      : editor.getElementByKey(focus.getKey())?.getBoundingClientRect();
  if (image !== null && range !== undefined && range.height > 0) {
    const box = image.getBoundingClientRect();
    if (range.top >= box.bottom || range.bottom <= box.top) {
      return;
    }
  }
  return last;
};

/** The one image or figure a node selection holds. */
const $selectedImage = (selection: BaseSelection | null) => {
  if ($isNodeSelection(selection) === false) {
    return;
  }
  const nodes = selection.getNodes();
  return nodes.length === 1 &&
    ($isCmsImageNode(nodes[0]) || $isCmsFigureNode(nodes[0]))
    ? nodes[0]
    : undefined;
};

/**
 * The image an arrow from a collapsed caret reaches: an inline image beside
 * it (a link's edge counts too), or a figure beside its block's edge.
 */
const $imageBeside = (
  selection: RangeSelection,
  isBackward: boolean
): LexicalNode | undefined => {
  const focus = selection.focus;
  let beside = $getAdjacentNode(focus, isBackward);
  if (beside === null && focus.type === "text") {
    // at a link's edge: the node beside the link
    let node: LexicalNode = focus.getNode();
    for (
      let parent = node.getParent();
      $isElementNode(parent) && parent.isInline();
      parent = parent.getParent()
    ) {
      const edge = isBackward
        ? node.getPreviousSibling() === null
        : node.getNextSibling() === null;
      if (edge === false) {
        break;
      }
      node = parent;
      beside = isBackward
        ? parent.getPreviousSibling()
        : parent.getNextSibling();
      if (beside !== null) {
        break;
      }
    }
  }
  if ($isCmsImageNode(beside)) {
    return beside;
  }
  const block = focus.getNode().getTopLevelElement();
  if (block === null || $isElementNode(block) === false) {
    return;
  }
  const edgeNode = isBackward
    ? block.getFirstDescendant()
    : block.getLastDescendant();
  const atEdge =
    (focus.type === "element" &&
      focus.key === block.getKey() &&
      focus.offset === (isBackward ? 0 : block.getChildrenSize())) ||
    (focus.type === "text" &&
      edgeNode !== null &&
      focus.key === edgeNode.getKey() &&
      focus.offset === (isBackward ? 0 : edgeNode.getTextContentSize()));
  if (atEdge === false) {
    return;
  }
  const sibling = isBackward
    ? block.getPreviousSibling()
    : block.getNextSibling();
  return $isCmsFigureNode(sibling) ? sibling : undefined;
};

/** Whether a point is an element caret right after a line break. */
const $isAfterLineBreak = (point: PointType) => {
  if (point.type !== "element" || point.offset === 0) {
    return false;
  }
  const parent = point.getNode();
  return (
    $isElementNode(parent) &&
    $isLineBreakNode(parent.getChildAtIndex(point.offset - 1))
  );
};

/**
 * A key that inserts text: a printable one, an IME's or a dead key's. A
 * soft keyboard's key (Unidentified) may delete instead: its beforeinput
 * says which.
 */
const isTextInputKey = (event: KeyboardEvent) =>
  event.key.length === 1 || event.key === "Process" || event.key === "Dead";

const $caretBesideSelectedImage = (lastArrow: {
  current: "back" | "forward" | undefined;
}) => {
  const image = $selectedImage($getSelection());
  if (image !== undefined) {
    $caretBeside(image, lastArrow.current === "back", true);
    lastArrow.current = undefined;
  }
};

type CaretPoint = { key: NodeKey; offset: number; type: "text" | "element" };

/** A block's leaves in order, inside its inline elements, not its blocks. */
const $lineLeaves = (block: ElementNode) => {
  const leaves: LexicalNode[] = [];
  const collect = (element: ElementNode) => {
    for (const child of element.getChildren()) {
      if ($isElementNode(child)) {
        if (child.isInline()) {
          collect(child);
        }
      } else {
        leaves.push(child);
      }
    }
  };
  collect(block);
  return leaves;
};

/** The box of one character of a text node, as the browser lays it out. */
const charBox = (editor: LexicalEditor, node: TextNode, offset: number) => {
  const element = editor.getElementByKey(node.getKey());
  if (element === null) {
    return;
  }
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const text = walker.nextNode() as Text | null;
  if (text === null || offset < 0 || offset >= text.data.length) {
    return;
  }
  const range = document.createRange();
  range.setStart(text, offset);
  range.setEnd(text, offset + 1);
  const box = range.getClientRects()[0] ?? range.getBoundingClientRect();
  return box.height > 0 ? box : undefined;
};

/** A node's first or last line box. */
const lineBox = (editor: LexicalEditor, node: LexicalNode, last: boolean) => {
  const boxes = editor.getElementByKey(node.getKey())?.getClientRects();
  const box =
    boxes === undefined ? undefined : boxes[last ? boxes.length - 1 : 0];
  return box !== undefined && box.height > 0 ? box : undefined;
};

const isBelow = (box: DOMRect, line: DOMRect) => box.top >= line.bottom - 1;
const isAbove = (box: DOMRect, line: DOMRect) => box.bottom <= line.top + 1;

/** A point before a block's leaf, or after it. */
const pointBeside = (leaf: LexicalNode, after: boolean): CaretPoint => {
  if ($isTextNode(leaf)) {
    return {
      key: leaf.getKey(),
      offset: after ? leaf.getTextContentSize() : 0,
      type: "text",
    };
  }
  return {
    key: leaf.getParentOrThrow().getKey(),
    offset: leaf.getIndexWithinParent() + (after ? 1 : 0),
    type: "element",
  };
};

/**
 * A caret as a place in its block's leaves: before character `offset` of
 * leaf `index` (a leaf past the last is the block's end).
 */
const $caretInLeaves = (point: PointType) => {
  const node = point.getNode();
  const block = $findMatchingParent(
    node,
    (parent) => $isElementNode(parent) && parent.isInline() === false
  );
  if ($isElementNode(block) === false) {
    return;
  }
  const leaves = $lineLeaves(block);
  if (point.type === "text") {
    const index = leaves.findIndex((leaf) => leaf.is(node));
    return index === -1 ? undefined : { leaves, index, offset: point.offset };
  }
  if ($isElementNode(node) === false) {
    return;
  }
  // the first leaf at or after the child at the caret
  const after = node.getChildAtIndex(point.offset);
  const following =
    after === null
      ? undefined
      : $isElementNode(after)
        ? after.getFirstDescendant()
        : after;
  if (following !== null && following !== undefined) {
    const index = leaves.findIndex((leaf) => leaf.is(following));
    if (index !== -1) {
      return { leaves, index, offset: 0 };
    }
  }
  const before =
    point.offset > 0 ? node.getChildAtIndex(point.offset - 1) : null;
  const preceding = $isElementNode(before)
    ? before.getLastDescendant()
    : before;
  const index =
    preceding === null ? -1 : leaves.findIndex((leaf) => leaf.is(preceding));
  return { leaves, index: index + 1, offset: 0 };
};

/**
 * The box of the caret's visual line: what follows the caret, or, with
 * nothing after it on its line, what precedes it.
 */
const caretLineBox = (
  editor: LexicalEditor,
  leaves: LexicalNode[],
  index: number,
  offset: number
) => {
  const at = leaves[index];
  if (at !== undefined && $isLineBreakNode(at) === false) {
    const box = $isTextNode(at)
      ? (charBox(editor, at, offset) ?? charBox(editor, at, offset - 1))
      : lineBox(editor, at, false);
    if (box !== undefined) {
      return box;
    }
  }
  if (offset > 0 && $isTextNode(at)) {
    return charBox(editor, at, offset - 1);
  }
  const before = leaves[index - 1];
  if (before === undefined || $isLineBreakNode(before)) {
    return;
  }
  return $isTextNode(before)
    ? charBox(editor, before, before.getTextContentSize() - 1)
    : lineBox(editor, before, true);
};

/**
 * Where End takes a caret: the end of its visual line, which stops at the
 * next line break, or where the line wraps.
 */
const $caretLineEnd = (
  editor: LexicalEditor,
  point: PointType
): CaretPoint | undefined => {
  const caret = $caretInLeaves(point);
  if (caret === undefined) {
    return;
  }
  const { leaves, index, offset } = caret;
  const line = caretLineBox(editor, leaves, index, offset);
  let end: CaretPoint | undefined;
  for (let at = index; at < leaves.length; at += 1) {
    const leaf = leaves[at];
    if ($isLineBreakNode(leaf)) {
      return end ?? pointBeside(leaf, false);
    }
    if ($isTextNode(leaf)) {
      const size = leaf.getTextContentSize();
      const lastBox = charBox(editor, leaf, size - 1);
      if (
        line !== undefined &&
        lastBox !== undefined &&
        isBelow(lastBox, line)
      ) {
        for (let char = at === index ? offset : 0; char < size; char += 1) {
          const box = charBox(editor, leaf, char);
          if (box !== undefined && isBelow(box, line)) {
            return char === 0 && end !== undefined
              ? end
              : { key: leaf.getKey(), offset: char, type: "text" };
          }
        }
      }
      end = pointBeside(leaf, true);
      continue;
    }
    const box = lineBox(editor, leaf, false);
    if (line !== undefined && box !== undefined && isBelow(box, line)) {
      return end ?? pointBeside(leaf, false);
    }
    end = pointBeside(leaf, true);
  }
  if (end !== undefined) {
    return end;
  }
  return point.type === "text"
    ? { key: point.key, offset: point.offset, type: "text" }
    : { key: point.key, offset: point.offset, type: "element" };
};

/**
 * Where Home takes a caret: the start of its visual line, which begins
 * after the line break before it, or where the line wraps. Undefined for a
 * text caret on its block's first line, which the browser's Home handles,
 * unless `always`.
 */
const $caretLineStart = (
  editor: LexicalEditor,
  point: PointType,
  always = false
): CaretPoint | undefined => {
  const caret = $caretInLeaves(point);
  if (caret === undefined) {
    return;
  }
  const { leaves, index, offset } = caret;
  if (
    always === false &&
    point.type === "text" &&
    leaves.slice(0, index).some($isLineBreakNode) === false
  ) {
    return;
  }
  const line = caretLineBox(editor, leaves, index, offset);
  let start: CaretPoint =
    point.type === "text"
      ? { key: point.key, offset: point.offset, type: "text" }
      : { key: point.key, offset: point.offset, type: "element" };
  for (let at = offset > 0 ? index : index - 1; at >= 0; at -= 1) {
    const leaf = leaves[at];
    if ($isLineBreakNode(leaf)) {
      return pointBeside(leaf, true);
    }
    if ($isTextNode(leaf)) {
      const from = at === index ? offset - 1 : leaf.getTextContentSize() - 1;
      for (let char = from; char >= 0; char -= 1) {
        const box = charBox(editor, leaf, char);
        if (line !== undefined && box !== undefined && isAbove(box, line)) {
          return char + 1 === leaf.getTextContentSize()
            ? start
            : { key: leaf.getKey(), offset: char + 1, type: "text" };
        }
      }
      start = pointBeside(leaf, false);
      continue;
    }
    const box = lineBox(editor, leaf, true);
    if (line !== undefined && box !== undefined && isAbove(box, line)) {
      return start;
    }
    start = pointBeside(leaf, false);
  }
  return start;
};

const ImageEditingPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const lastArrow = useRef<"back" | "forward" | undefined>(undefined);
  // the anchor of a selection Home or End extended
  const pinnedAnchor = useRef<CaretPoint | undefined>(undefined);
  useEffect(() => {
    const unpin = () => {
      pinnedAnchor.current = undefined;
    };
    // a Shift+click extends the selection from its anchor, as Shift with
    // an arrow does; any other click ends the extension
    const pinOnShiftPointer = (event: PointerEvent) => {
      if (event.shiftKey === false) {
        unpin();
        return;
      }
      pinnedAnchor.current = editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (
          $isRangeSelection(selection) === false ||
          $isAfterLineBreak(selection.anchor) === false
        ) {
          return;
        }
        const { anchor } = selection;
        return { key: anchor.key, offset: anchor.offset, type: anchor.type };
      });
    };
    // a triple click selects its block whatever the anchor
    const unpinOnTripleClick = (event: MouseEvent) => {
      if (event.detail >= 3) {
        unpin();
      }
    };
    // a held anchor never outlives the editor's focus
    const unpinOnFocusOut = (event: FocusEvent) => {
      const root = event.currentTarget as HTMLElement;
      if (
        event.relatedTarget instanceof Node &&
        root.contains(event.relatedTarget)
      ) {
        return;
      }
      unpin();
    };
    // text input with an image selected, or at an element caret right
    // after a line break (where the browser's target range is the line
    // above), is inserted at Lexical's own selection
    const beforeTextInput = (event: Event) => {
      const where = editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($selectedImage(selection) !== undefined) {
          return "image";
        }
        if (
          $isRangeSelection(selection) &&
          selection.isCollapsed() &&
          $isAfterLineBreak(selection.anchor)
        ) {
          return "after break";
        }
      });
      const text =
        event instanceof InputEvent &&
        (event.inputType === "insertText" ||
          event.inputType === "insertReplacementText") &&
        typeof event.data === "string"
          ? event.data
          : undefined;
      const deletes =
        event instanceof InputEvent && event.inputType.startsWith("delete");
      if (deletes && where === "image") {
        // a delete with an image selected takes the image
        event.preventDefault();
        event.stopImmediatePropagation();
        editor.update(
          () => {
            const image = $selectedImage($getSelection());
            if (image !== undefined) {
              $caretBeside(image, false, true);
              image.remove();
            }
          },
          { discrete: true }
        );
        return;
      }
      if (
        where === undefined ||
        deletes ||
        (where === "after break" && text === undefined)
      ) {
        return;
      }
      if (text !== undefined) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      editor.update(
        () => {
          $caretBesideSelectedImage(lastArrow);
          const selection = $getSelection();
          if (text === undefined || $isRangeSelection(selection) === false) {
            return;
          }
          // a newline sent as text is a line break, two a new paragraph
          for (const part of text.split(/(\r?\n\r?\n|\r?\n)/)) {
            if (/^(\r?\n){2}$/.test(part)) {
              selection.insertParagraph();
            } else if (/^\r?\n$/.test(part)) {
              selection.insertLineBreak();
            } else if (part !== "") {
              selection.insertText(part);
            }
          }
        },
        { discrete: true }
      );
    };
    return mergeRegister(
      // above LinkPlugin's own handler, for a selection holding an image
      editor.registerCommand(
        TOGGLE_LINK_COMMAND,
        (payload) => {
          const selection = $getSelection();
          if ($isRangeSelection(selection) === false) {
            return false;
          }
          // the images the selection reaches, found before the toggle
          // moves the selection's offsets past a link it inserts
          const images = selection
            .getNodes()
            .flatMap((node) =>
              $isCmsImageNode(node) || $isCmsFigureNode(node)
                ? [node]
                : $isElementNode(node)
                  ? node
                      .getChildren()
                      .filter(
                        (child) =>
                          $isCmsImageNode(child) || $isCmsFigureNode(child)
                      )
                  : []
            );
          if (payload === null) {
            $toggleLink(null);
            return true;
          }
          const { url, ...attributes } =
            typeof payload === "string" ? { url: payload } : payload;
          $toggleLink(url, attributes);
          const links = new Set<LinkNode>();
          // a link at the root (around a figure or a rule) is unwrapped
          for (const node of $getRoot().getChildren()) {
            if ($isLinkNode(node)) {
              links.add(node);
            }
          }
          for (const image of images) {
            const link = $findMatchingParent(image, $isLinkNode);
            if ($isLinkNode(link)) {
              links.add(link);
            }
          }
          $keepImagesOutOfLinks(links);
          return true;
        },
        COMMAND_PRIORITY_NORMAL
      ),
      // the field's handlers of commands the line rules share, run in
      // COMMAND_ORDER's order by the one registration
      provideFieldHandlers(editor, {
        // an arrow onto an image selects it (an inline image beside the
        // caret, or a figure beside the block's edge); the next arrow moves
        // past it as a text caret
        imageArrow: (payload, _editor, command) => {
          const event = payload as KeyboardEvent;
          const isBackward = command === KEY_ARROW_LEFT_COMMAND;
          if (event.altKey || event.ctrlKey || event.metaKey) {
            return false;
          }
          const selection = $getSelection();
          if ($isNodeSelection(selection)) {
            const image = $selectedImage(selection);
            if (image === undefined || event.shiftKey) {
              return false;
            }
            event.preventDefault();
            $caretBeside(image, isBackward);
            lastArrow.current = undefined;
            return true;
          }
          if ($isRangeSelection(selection) === false || event.shiftKey) {
            return false;
          }
          // a range with a plain arrow collapses toward the arrow
          if (selection.isCollapsed() === false) {
            event.preventDefault();
            const [start, end] = selection.isBackward()
              ? [selection.focus, selection.anchor]
              : [selection.anchor, selection.focus];
            const to = isBackward ? start : end;
            const point = { key: to.key, offset: to.offset, type: to.type };
            selection.anchor.set(point.key, point.offset, point.type);
            selection.focus.set(point.key, point.offset, point.type);
            lastArrow.current = undefined;
            return true;
          }
          // a line break beside the caret: the caret steps just past it,
          // so the next arrow reaches what starts the next line
          const beside = $getAdjacentNode(selection.focus, isBackward);
          if ($isLineBreakNode(beside)) {
            event.preventDefault();
            const parent = beside.getParentOrThrow().getKey();
            const offset = beside.getIndexWithinParent() + (isBackward ? 0 : 1);
            selection.anchor.set(parent, offset, "element");
            selection.focus.set(parent, offset, "element");
            lastArrow.current = undefined;
            return true;
          }
          const image = $imageBeside(selection, isBackward);
          if (image === undefined) {
            return false;
          }
          event.preventDefault();
          const next = $createNodeSelection();
          next.add(image.getKey());
          $setSelection(next);
          lastArrow.current = isBackward ? "back" : "forward";
          return true;
        },
        // typing with an image selected first puts a caret beside it: on
        // the side the arrow was moving toward (after it when no arrow
        // selected it)
        caretBesideImageOnKey: (payload) => {
          const event = payload as KeyboardEvent;
          if (
            isTextInputKey(event) === false ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
          ) {
            return false;
          }
          $caretBesideSelectedImage(lastArrow);
          return false;
        },
        // text input with no key of its own (an IME, dictation, an emoji
        // picker), a paste or a drop with an image selected works as
        // typing does: from a caret beside it
        caretBesideSelectedImage: () => {
          $caretBesideSelectedImage(lastArrow);
          return false;
        },
        // Backspace at an element caret right after a line break takes the
        // line break (the browser reads that caret as one before it)
        deleteAfterLineBreak: (isBackward) => {
          const selection = $getSelection();
          if (
            isBackward === false ||
            $isRangeSelection(selection) === false ||
            selection.isCollapsed() === false ||
            $isAfterLineBreak(selection.anchor) === false
          ) {
            return false;
          }
          const parent = selection.anchor.getNode() as ElementNode;
          const offset = selection.anchor.offset - 1;
          parent.getChildAtIndex(offset)?.remove();
          selection.anchor.set(parent.getKey(), offset, "element");
          selection.focus.set(parent.getKey(), offset, "element");
          return true;
        },
        // a selection Home or End extended keeps its anchor while it is
        // extended further: the browser reads an anchor right after a line
        // break as one before it
        pinAnchorOnExtend: (payload) => {
          const event = payload as KeyboardEvent;
          if (event.key === "Shift") {
            return false;
          }
          const isExtending =
            event.shiftKey && /^(Arrow|Home$|End$|Page)/.test(event.key);
          if (isExtending === false) {
            pinnedAnchor.current = undefined;
            return false;
          }
          const selection = $getSelection();
          if (
            pinnedAnchor.current === undefined &&
            $isRangeSelection(selection) &&
            $isAfterLineBreak(selection.anchor)
          ) {
            const { anchor } = selection;
            pinnedAnchor.current = {
              key: anchor.key,
              offset: anchor.offset,
              type: anchor.type,
            };
          }
          return false;
        },
        pinImageAnchor: () => {
          const pinned = pinnedAnchor.current;
          if (pinned === undefined) {
            return false;
          }
          const selection = $getSelection();
          if (
            $isRangeSelection(selection) === false ||
            $getNodeByKey(pinned.key) === null
          ) {
            pinnedAnchor.current = undefined;
            return false;
          }
          const { anchor } = selection;
          if (
            anchor.key !== pinned.key ||
            anchor.offset !== pinned.offset ||
            anchor.type !== pinned.type
          ) {
            anchor.set(pinned.key, pinned.offset, pinned.type);
          }
          return false;
        },
      }),
      // text input with no key of its own (an IME, dictation, an emoji
      // picker) does the same, before the browser inserts it
      editor.registerRootListener((rootElement, previous) => {
        for (const type of ["beforeinput", "compositionstart"]) {
          previous?.removeEventListener(type, beforeTextInput, true);
          rootElement?.addEventListener(type, beforeTextInput, true);
        }
      }),
      // Up and Down from a selected figure go to the end of the block
      // before it, or the start of the block after it
      ...(
        [
          [KEY_ARROW_UP_COMMAND, true],
          [KEY_ARROW_DOWN_COMMAND, false],
        ] as const
      ).map(([command, isBackward]) =>
        editor.registerCommand(
          command,
          (event: KeyboardEvent) => {
            const figure = $selectedImage($getSelection());
            if ($isCmsFigureNode(figure) === false || event.shiftKey) {
              return false;
            }
            const sibling = isBackward
              ? figure.getPreviousSibling()
              : figure.getNextSibling();
            if ($isElementNode(sibling) === false) {
              return false;
            }
            event.preventDefault();
            if (isBackward) {
              sibling.selectEnd();
            } else {
              sibling.selectStart();
            }
            lastArrow.current = undefined;
            return true;
          },
          COMMAND_PRIORITY_LOW
        )
      ),
      // Home and End (with Shift too) from a caret beside a line break or
      // an image, or with an image selected, stay on the caret's own line
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          const isEnd = event.key === "End";
          if (
            (isEnd === false && event.key !== "Home") ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
          ) {
            return false;
          }
          let selection = $getSelection();
          const image = $selectedImage(selection);
          if (image !== undefined) {
            $caretBeside(image, lastArrow.current === "back");
            lastArrow.current = undefined;
            selection = $getSelection();
          }
          if ($isRangeSelection(selection) === false) {
            return false;
          }
          const { focus } = selection;
          // an element caret is never handed to the browser, which
          // measures it by the node before it (a line break's box is on
          // the line above)
          let target: CaretPoint | undefined;
          if (isEnd) {
            if (image !== undefined || focus.type === "element") {
              target = $caretLineEnd(editor, focus);
            } else {
              const ending = $imageEndingLine(editor, focus);
              target =
                ending === undefined ? undefined : pointBeside(ending, true);
            }
          } else {
            target = $caretLineStart(editor, focus, image !== undefined);
          }
          if (target === undefined) {
            if (image === undefined) {
              return false;
            }
            target = { key: focus.key, offset: focus.offset, type: focus.type };
          }
          event.preventDefault();
          const anchor = {
            key: selection.anchor.key,
            offset: selection.anchor.offset,
            type: selection.anchor.type,
          };
          selection.focus.set(target.key, target.offset, target.type);
          if (event.shiftKey) {
            selection.anchor.set(anchor.key, anchor.offset, anchor.type);
            pinnedAnchor.current = anchor;
          } else {
            selection.anchor.set(target.key, target.offset, target.type);
            pinnedAnchor.current = undefined;
          }
          return true;
        },
        COMMAND_PRIORITY_NORMAL
      ),
      // an edit ends the extension
      editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
        if (dirtyLeaves.size > 0 || dirtyElements.size > 0) {
          unpin();
        }
      }),
      editor.registerRootListener((rootElement, previous) => {
        previous?.removeEventListener("pointerdown", pinOnShiftPointer);
        rootElement?.addEventListener("pointerdown", pinOnShiftPointer);
        previous?.removeEventListener("focusout", unpinOnFocusOut);
        rootElement?.addEventListener("focusout", unpinOnFocusOut);
        previous?.removeEventListener("mousedown", unpinOnTripleClick);
        rootElement?.addEventListener("mousedown", unpinOnTripleClick);
      })
    );
  }, [editor]);
  return null;
};

/** The value the field reports for the editor's document. */
const fieldValueOf = (editor: LexicalEditor): FieldValue => {
  const html = exportRichTextHtml(editor);
  const text = editor.getEditorState().read(() => $getRoot().getTextContent());
  // no value only with neither text nor an image
  return text.trim() === "" && /<img\b/i.test(html) === false
    ? null
    : { html, text };
};

/** Development only: the field's harness watch, dropped at unmount. */
const WatchPlugin = ({
  watched,
}: {
  watched: { current: ((value: FieldValue) => void) | undefined };
}) => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (import.meta.env.DEV === false) {
      return;
    }
    const watch = watchField(editor, () => fieldValueOf(editor));
    watched.current = watch.changed;
    return () => {
      watched.current = undefined;
      watch.unwatch();
    };
  }, [editor, watched]);
  return null;
};

const LinkRulePlugin = () => {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          CONTROLLED_TEXT_INSERTION_COMMAND,
          (payload) => {
            if (typeof payload === "string" || payload.dataTransfer === null) {
              return false;
            }
            const clean = withoutRefusedLinks(payload.dataTransfer);
            if (clean === undefined) {
              return false;
            }
            payload.preventDefault();
            editor.dispatchCommand(
              CONTROLLED_TEXT_INSERTION_COMMAND,
              new InputEvent(payload.type, {
                inputType: payload.inputType,
                dataTransfer: clean,
              })
            );
            return true;
          },
          COMMAND_PRIORITY_LOW
        ),
        editor.registerCommand(
          PASTE_COMMAND,
          (event) => {
            if (
              objectKlassEquals(event, ClipboardEvent) === false ||
              (event as ClipboardEvent).clipboardData === null
            ) {
              return false;
            }
            const clean = withoutRefusedLinks(
              (event as ClipboardEvent).clipboardData as DataTransfer
            );
            if (clean === undefined) {
              return false;
            }
            event.preventDefault();
            editor.dispatchCommand(
              PASTE_COMMAND,
              new ClipboardEvent("paste", { clipboardData: clean })
            );
            return true;
          },
          COMMAND_PRIORITY_LOW
        )
      ),
    [editor]
  );
  return null;
};

/** Wraps each pasted list item outside a list in a list; true when anything changed. */
const wrapStrayListItems = (body: HTMLElement) => {
  // marks and links move into the items, and a wrapper between a list and
  // its items gives way: such an item stands in that list
  let changed = pushMarksIntoBlocks(body);
  for (const item of Array.from(body.querySelectorAll("li"))) {
    const wrappers: Element[] = [];
    let at = item.parentElement;
    while (
      at !== null &&
      at !== body &&
      /^(UL|OL|LI)$/.test(at.tagName) === false
    ) {
      wrappers.push(at);
      at = at.parentElement;
    }
    // only marks, links and plain wrappers give way: an item under a
    // quote, code, a heading or a table stays stray
    if (
      at !== null &&
      /^(UL|OL)$/.test(at.tagName) &&
      wrappers.every(
        (wrapper) =>
          /^(BLOCKQUOTE|PRE|H[1-6]|TABLE|CAPTION|THEAD|TBODY|TFOOT|TR|TD|TH)$/.test(
            wrapper.tagName
          ) === false
      )
    ) {
      for (const wrapper of wrappers) {
        if (wrapper.isConnected) {
          wrapper.replaceWith(...wrapper.childNodes);
          changed = true;
        }
      }
    }
  }
  // an item under a quote, code or a table in a list stands as the import
  // reads it; one under a heading, or under no list, takes a list of its own
  const isInList = (item: Element) => {
    for (let at = item.parentElement; at !== null; at = at.parentElement) {
      if (/^(UL|OL)$/.test(at.tagName)) {
        return true;
      }
      if (/^(LI|H[1-6])$/.test(at.tagName) || at === body) {
        return false;
      }
    }
    return false;
  };
  const strays = Array.from(body.querySelectorAll("li")).filter(
    (item) => isInList(item) === false
  );
  for (const item of strays) {
    const before = item.previousElementSibling;
    if (
      before !== null &&
      before.tagName === "UL" &&
      before.hasAttribute("data-stray")
    ) {
      before.appendChild(item);
      continue;
    }
    const list = body.ownerDocument.createElement("ul");
    list.setAttribute("data-stray", "");
    item.replaceWith(list);
    list.appendChild(item);
  }
  for (const list of Array.from(body.querySelectorAll("ul[data-stray]"))) {
    list.removeAttribute("data-stray");
  }
  return changed || strays.length > 0;
};

/**
 * What follows a pasted item's nested list moves to a new item after that
 * item, so it keeps its place after the list; true when any did.
 */
const splitItemsAfterNestedList = (body: HTMLElement) => {
  // the text a node imports: no style's or script's
  const textOf = (node: Node): string =>
    node instanceof Element && /^(STYLE|SCRIPT|TEMPLATE)$/.test(node.tagName)
      ? ""
      : node.nodeType === Node.TEXT_NODE
        ? (node.textContent ?? "")
        : Array.from(node.childNodes).map(textOf).join("");
  // only what imports to content: text past white space and format and
  // ignorable characters (a pasted image does not, nor a rule on its own)
  const isContent = (node: Node) =>
    (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) &&
    /[^\s\p{Cf}\p{Default_Ignorable_Code_Point}]/u.test(textOf(node));
  // a rule, or what holds one and no text: never dropped
  const isRule = (node: Node) =>
    node instanceof Element &&
    (node.tagName === "HR" ||
      (isContent(node) === false && node.querySelector("hr") !== null));
  // a block a list item cannot start with and still be edited in
  const isLeadBlock = (node: Node) =>
    node instanceof Element &&
    isRule(node) === false &&
    /^(BLOCKQUOTE|H[1-6]|PRE)$/.test(node.tagName);
  const BLOCKS =
    "p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, hr, figure, figcaption, canvas, noscript, video, table, div, section, article, header, footer, aside, main, nav, address, form, fieldset, dl, dt, dd";
  // the next line content from a node on: text, or an inline element with
  // text, past white space, comments, images and empty elements
  const lineContentFrom = (start: Node | null, forward: boolean): boolean => {
    for (
      let at = start;
      at !== null;
      at = forward ? at.nextSibling : at.previousSibling
    ) {
      if (
        at instanceof Element &&
        (at.tagName === "BR" || at.matches(BLOCKS))
      ) {
        return false;
      }
      if (isContent(at)) {
        // an inline element holding a block counts by its line content
        // nearest this side
        return at instanceof Element && at.querySelector(BLOCKS) !== null
          ? lineContentFrom(forward ? at.firstChild : at.lastChild, forward)
          : true;
      }
    }
    return false;
  };
  const isBlank = (node: Node) =>
    (node instanceof Element && node.tagName === "BR") ||
    (node.nodeType === Node.TEXT_NODE && isContent(node) === false);
  const isList = (node: Node) =>
    node instanceof Element && /^(UL|OL)$/.test(node.tagName);
  // no mark or link holds a list when a wrapper gives way
  pushMarksIntoBlocks(body);
  let split = false;
  for (const item of Array.from(body.querySelectorAll("li")).reverse()) {
    // a wrapper holding a nested list gives way to its content first, and
    // after the list, one holding a rule, a quote, a heading or code
    for (;;) {
      const children = Array.from(item.children);
      const listAt = children.findIndex(isList);
      const wrapper = children.find(
        (child, index) =>
          /^(UL|OL|LI|BLOCKQUOTE|H[1-6]|PRE|TABLE)$/.test(child.tagName) ===
            false &&
          child.matches(PASTE_MARKS) === false &&
          (child.querySelector("ul, ol") !== null ||
            (listAt !== -1 &&
              index > listAt &&
              child.querySelector(
                "hr, blockquote, h1, h2, h3, h4, h5, h6, pre"
              ) !== null))
      );
      if (wrapper === undefined) {
        break;
      }
      // a block wrapper's edges stay line breaks between the line content
      // on either side; an inline one gives way with none
      if (
        /^(DIV|SECTION|ARTICLE|HEADER|FOOTER|ASIDE|MAIN|NAV|ADDRESS|FORM|FIELDSET|DL|DT|DD|FIGURE|FIGCAPTION|CANVAS|NOSCRIPT|VIDEO)$/.test(
          wrapper.tagName
        )
      ) {
        // past white space and comments: a line break, or line content
        const makesLine = (start: Node | null, forward: boolean) => {
          for (
            let at = start;
            at !== null;
            at = forward ? at.nextSibling : at.previousSibling
          ) {
            if (
              at.nodeType === Node.COMMENT_NODE ||
              (at.nodeType === Node.TEXT_NODE && isContent(at) === false)
            ) {
              continue;
            }
            return (
              (at instanceof Element && at.tagName === "BR") ||
              lineContentFrom(at, forward)
            );
          }
          return false;
        };
        // its own last line break (past white space) makes no line of its
        // own
        let last = wrapper.lastChild;
        while (
          last !== null &&
          last.nodeType === Node.TEXT_NODE &&
          isContent(last) === false
        ) {
          last = last.previousSibling;
        }
        if (last instanceof Element && last.tagName === "BR") {
          last.remove();
        }
        const before =
          makesLine(wrapper.previousSibling, false) &&
          makesLine(wrapper.firstChild, true);
        const after =
          makesLine(wrapper.nextSibling, true) &&
          makesLine(wrapper.lastChild, false);
        if (before) {
          wrapper.insertBefore(
            body.ownerDocument.createElement("br"),
            wrapper.firstChild
          );
        }
        if (after) {
          wrapper.appendChild(body.ownerDocument.createElement("br"));
        }
      }
      wrapper.replaceWith(...wrapper.childNodes);
    }
    const list = Array.from(item.children).find(isList);
    // a rule stays in the item only after inline content of the item's own
    // before its list, else behind the content of the run it follows, or
    // with the next content when none precedes it
    let ownBefore = false;
    for (let at = list?.previousSibling; at; at = at.previousSibling) {
      ownBefore ||= isContent(at);
    }
    const pending: ChildNode[] = [];
    if (ownBefore === false) {
      for (let at = list?.previousSibling; at; at = at.previousSibling) {
        if (isRule(at)) {
          pending.unshift(at);
        }
      }
    }
    // what follows each nested list, up to and including the next one: a
    // run with content of its own (before its list) moves to new items,
    // made in one pass; any other run stays with the item before it,
    // without its line breaks and white space. Of a moved run, the rules
    // before its content stay, its leading quotes, headings and code
    // blocks take one item, and what follows from its first inline content
    // takes the next
    const runs: ChildNode[][] = [[]];
    for (let at = list?.nextSibling; at; at = at.nextSibling) {
      runs[runs.length - 1].push(at);
      if (isList(at)) {
        runs.push([]);
      }
    }
    let target: Element = item;
    const startItem = () => {
      const next = body.ownerDocument.createElement("li");
      target.parentNode?.insertBefore(next, target.nextSibling);
      target = next;
      split = true;
      for (const rule of pending.splice(0)) {
        next.appendChild(rule);
      }
      return next;
    };
    const keep = (node: Node) => {
      if (target !== item) {
        target.appendChild(node);
      }
    };
    const keepRule = (node: ChildNode) => {
      if (ownBefore) {
        return;
      }
      if (target === item) {
        pending.push(node);
      } else {
        target.appendChild(node);
      }
    };
    for (const run of runs) {
      const own = run.filter((node) => isList(node) === false);
      if (own.some(isContent) === false) {
        for (const node of run) {
          if (isBlank(node)) {
            node.remove();
          } else if (isRule(node)) {
            keepRule(node);
          } else {
            keep(node);
          }
        }
        continue;
      }
      let at = 0;
      // rules before the run's content stay in the original item
      for (; at < run.length && isContent(run[at]) === false; at += 1) {
        if (isRule(run[at])) {
          keepRule(run[at]);
        } else {
          run[at].remove();
        }
      }
      const blocks: ChildNode[] = [];
      for (; at < run.length; at += 1) {
        const node = run[at];
        if (isLeadBlock(node)) {
          blocks.push(node);
        } else if (isRule(node)) {
          // between or after the leading blocks: with them, or in the
          // original item after its own content
          if (ownBefore === false) {
            blocks.push(node);
          }
        } else if (isContent(node) === false && isList(node) === false) {
          node.remove();
        } else {
          break;
        }
      }
      if (blocks.length > 0) {
        const holder = startItem();
        for (const node of blocks) {
          holder.appendChild(node);
        }
      }
      const rest = run.slice(at);
      if (rest.some((node) => isList(node) === false)) {
        startItem();
      }
      for (const node of rest) {
        target.appendChild(node);
      }
    }
  }
  return split;
};

/**
 * The pasted data with its list items in lists, and nothing after an item's
 * nested list; undefined when none needs it.
 */
const withStrayListItemsWrapped = (
  data: DataTransfer
): DataTransfer | undefined => {
  const html = data.getData("text/html");
  if (html === "" || /<li\b/i.test(html) === false) {
    return;
  }
  const dom = new DOMParser().parseFromString(html, "text/html");
  const wrapped = wrapStrayListItems(dom.body);
  if (splitItemsAfterNestedList(dom.body) === false && wrapped === false) {
    return;
  }
  const next = new DataTransfer();
  for (const type of data.types) {
    if (type === "Files") {
      continue;
    }
    next.setData(
      type,
      type === "text/html" ? dom.body.innerHTML : data.getData(type)
    );
  }
  return next;
};

/** The field's own copied nodes, when the data holds them. */
const $ownClipboardNodes = (editor: LexicalEditor, data: DataTransfer) => {
  const copied = data.getData(LEXICAL_CLIPBOARD_TYPE);
  if (copied === "") {
    return;
  }
  try {
    const payload = JSON.parse(copied) as {
      namespace?: unknown;
      nodes?: unknown;
    };
    if (
      payload.namespace === fieldNamespaceOf(editor) &&
      Array.isArray(payload.nodes)
    ) {
      return $generateNodesFromSerializedNodes(payload.nodes);
    }
  } catch {
    // not Lexical's data: the paste never reads it
  }
};

/**
 * Copied nodes as a code block's text: each block its own line, images and
 * figures apart (they go after the block).
 */
const $codeTextOf = (nodes: LexicalNode[], images: LexicalNode[]) => {
  const lines: string[] = [];
  let line = "";
  let open = false;
  const walk = (node: LexicalNode) => {
    if ($isCmsImageNode(node) || $isCmsFigureNode(node)) {
      images.push(node);
      return;
    }
    if ($isElementNode(node) && node.isInline() === false) {
      if (open) {
        lines.push(line);
      }
      line = "";
      open = true;
      node.getChildren().forEach(walk);
      lines.push(line);
      line = "";
      open = false;
      return;
    }
    if ($isElementNode(node)) {
      node.getChildren().forEach(walk);
      return;
    }
    if ($isDecoratorNode(node)) {
      return;
    }
    line += node.getTextContent();
    open = true;
  };
  nodes.forEach(walk);
  if (open) {
    lines.push(line);
  }
  return lines.filter((each) => each !== "").join("\n");
};

/** Pasted HTML as a code block's text: each block its own line. */
const htmlCodeText = (html: string) => {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  const lines: string[] = [];
  let line = "";
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child instanceof Element) {
        if (child.tagName === "BR") {
          lines.push(line);
          line = "";
          continue;
        }
        const isBlock =
          /^(P|DIV|H[1-6]|LI|UL|OL|BLOCKQUOTE|PRE|FIGURE|FIGCAPTION|TABLE|TR|SECTION|ARTICLE)$/.test(
            child.tagName
          );
        if (isBlock && line !== "") {
          lines.push(line);
          line = "";
        }
        walk(child);
        if (isBlock && line !== "") {
          lines.push(line);
          line = "";
        }
        continue;
      }
      line += child.textContent ?? "";
    }
  };
  walk(body);
  if (line !== "") {
    lines.push(line);
  }
  return lines.join("\n");
};

/** Images and figures after a code block, an image run in a paragraph. */
const $placeAfterCode = (code: LexicalNode, images: LexicalNode[]) => {
  let after: LexicalNode = code;
  let run: ElementNode | undefined;
  for (const image of images) {
    if ($isCmsImageNode(image)) {
      if (run === undefined) {
        run = $createParagraphNode();
        after.insertAfter(run);
        after = run;
      }
      run.append(image);
      continue;
    }
    run = undefined;
    after.insertAfter(image);
    after = image;
  }
};

/**
 * The block that directly holds a point (a list item, a quote), when its
 * first child is a block: the editor's own edits read no such element as a
 * block. A list holds only items, and the root is not such a block.
 */
/** SPIKE: guards made no-ops, from VITE_GUARDS_OFF (comma separated). */
const guardOff = (name: string) =>
  String(
    (import.meta as { env?: Record<string, string> }).env?.VITE_GUARDS_OFF ?? ""
  )
    .split(",")
    .includes(name);

const $blockLedItemAt = (point: PointType) => {
  if (guardOff("blockLedItemAt")) {
    return;
  }
  let block: LexicalNode | null =
    point.type === "element" ? point.getNode() : point.getNode().getParent();
  while ($isElementNode(block) && block.isInline()) {
    block = block.getParent();
  }
  if (
    $isElementNode(block) === false ||
    $isRootNode(block) ||
    $isListNode(block)
  ) {
    return;
  }
  const first = block.getFirstChild();
  return ($isElementNode(first) || $isDecoratorNode(first)) &&
    first.isInline() === false
    ? block
    : undefined;
};

/**
 * Runs an edit at the selection (Enter, Shift+Enter, a paste, a drop, an
 * image) with the block-led item or quote holding its start read as a block:
 * an empty text leads the item meanwhile, and a quote takes the edit in a
 * paragraph of its own at the caret, as in its other paragraphs.
 */
const $editInBlockLedItem = (selection: RangeSelection, edit: () => void) => {
  if (guardOff("editInBlockLedItem")) {
    edit();
    return false;
  }
  const start = selection.isBackward() ? selection.focus : selection.anchor;
  const item = $blockLedItemAt(start);
  if (item === undefined) {
    edit();
    return false;
  }
  if ($isListItemNode(item) === false && start.type === "element") {
    const at = start.offset;
    const isCollapsed = selection.isCollapsed();
    for (const point of [selection.anchor, selection.focus]) {
      if (point.key === item.getKey() && point.offset > at) {
        point.set(point.key, point.offset + 1, "element");
      }
    }
    const paragraph = $createParagraphNode();
    item.splice(at, 0, [paragraph]);
    for (const point of isCollapsed
      ? [selection.anchor, selection.focus]
      : [start]) {
      point.set(paragraph.getKey(), 0, "element");
    }
    try {
      edit();
    } finally {
      if (paragraph.isAttached() && paragraph.isEmpty()) {
        paragraph.remove();
      }
    }
    return true;
  }
  for (const point of [selection.anchor, selection.focus]) {
    if (point.type === "element" && point.key === item.getKey()) {
      point.set(point.key, point.offset + 1, "element");
    }
  }
  const lead = $createTextNode("");
  item.splice(0, 0, [lead]);
  try {
    edit();
  } finally {
    if (lead.isAttached()) {
      lead.remove();
    }
  }
  return true;
};

/**
 * Runs an edit at the selection where its start is in a block-led item or
 * quote; false, with nothing done, anywhere else.
 */
const $editAtBlockLed = (edit: (selection: RangeSelection) => void) => {
  if (guardOff("editAtBlockLed")) {
    return false;
  }
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return false;
  }
  const start = selection.isBackward() ? selection.focus : selection.anchor;
  if ($blockLedItemAt(start) === undefined) {
    return false;
  }
  return $editInBlockLedItem(selection, () => edit(selection));
};

/**
 * Plain text pasted or dropped where the selection starts in a block-led
 * item or quote, when the data holds no HTML and none of the field's own
 * nodes: its lines and tabs land as in any other item.
 */
const $insertPlainTextAtBlockLed = (
  editor: LexicalEditor,
  data: DataTransfer
) =>
  guardOff("insertPlainTextAtBlockLed") === false &&
  data.getData("text/plain") !== "" &&
  data.getData("text/html") === "" &&
  $ownClipboardNodes(editor, data) === undefined &&
  $editAtBlockLed((selection) =>
    $insertDataTransferForRichText(data, selection, editor)
  );

/**
 * Nodes inserted in a list item: the item split at the selection leaves no
 * empty item when the last inserted item starts with a block (its content
 * cannot join the split-off rest). Items empty before, or inserted empty,
 * stay.
 */
const $insertIntoListItem = (
  nodes: LexicalNode[],
  selection: RangeSelection
) => {
  const start = selection.isBackward() ? selection.focus : selection.anchor;
  if ($findMatchingParent(start.getNode(), $isListItemNode) === null) {
    $editInBlockLedItem(selection, () => selection.insertNodes(nodes));
    return true;
  }
  const emptyItems = () =>
    $dfs()
      .map(({ node }) => node)
      .filter(
        (node): node is ListItemNode =>
          $isListItemNode(node) && node.getChildrenSize() === 0
      );
  const kept = new Set(emptyItems().map((item) => item.getKey()));
  for (const node of nodes) {
    for (const { node: inner } of $dfs(node)) {
      kept.add(inner.getKey());
    }
  }
  // the last pasted item, when it starts with a block and ends in inline
  // content of its own, is led by an empty text meanwhile: the rest of the
  // split item joins it as it joins any other item. With a nested list after
  // the caret, only where that list follows it: the last item stands in a
  // pasted list of the caret's list type, at the top
  const isBlock = (node: LexicalNode | null) =>
    ($isElementNode(node) || $isDecoratorNode(node)) &&
    node.isInline() === false;
  const tail = nodes.at(-1) ?? null;
  const last = $isElementNode(tail) ? (tail.getLastDescendant() ?? tail) : tail;
  const lastItem =
    last === null ? null : $findMatchingParent(last, $isListItemNode);
  let lead: TextNode | undefined;
  const startItem = $findMatchingParent(start.getNode(), $isListItemNode);
  const startList = startItem?.getParent();
  // the text after the caret comes from the item the selection ends in; a
  // nested list stands in the item after its own
  const end = selection.isBackward() ? selection.anchor : selection.focus;
  const endItem = $findMatchingParent(end.getNode(), $isListItemNode);
  const afterEnd = endItem?.getNextSibling() ?? null;
  const tailList = $isListItemNode(afterEnd) ? afterEnd.getFirstChild() : null;
  const lastList = lastItem?.getParent();
  const keepsTailList =
    $isListNode(tailList) &&
    ($isListNode(lastList) === false ||
      lastList !== tail ||
      $isListNode(startList) === false ||
      lastList.getListType() !== startList.getListType());
  if (
    guardOff("z6") === false &&
    keepsTailList === false &&
    $isListItemNode(lastItem) &&
    isBlock(lastItem.getFirstChild()) &&
    lastItem.getLastChild() !== null &&
    isBlock(lastItem.getLastChild()) === false
  ) {
    lead = $createTextNode("");
    lastItem.splice(0, 0, [lead]);
  }
  $editInBlockLedItem(selection, () => selection.insertNodes(nodes));
  if (lead?.isAttached() === true && lead.getTextContentSize() === 0) {
    lead.remove();
  }
  const caret = $getSelection();
  const caretItem = $isRangeSelection(caret)
    ? $findMatchingParent(caret.anchor.getNode(), $isListItemNode)
    : null;
  for (const item of emptyItems()) {
    if (kept.has(item.getKey()) || item.is(caretItem)) {
      continue;
    }
    const list = item.getParent();
    item.remove();
    if ($isListNode(list) && list.getChildrenSize() === 0) {
      list.remove();
    }
  }
  return true;
};

/**
 * Nodes a paste or drop inserts (`SELECTION_INSERT_CLIPBOARD_NODES_COMMAND`)
 * where the selection starts in a code block: the selected content goes,
 * the nodes' text goes into the block, and their images and figures after
 * it. Where it starts at a heading's start, blocks go before the heading.
 */
const $insertClipboardNodes = (
  pasted: LexicalNode[],
  selection: BaseSelection
) => {
  if ($isRangeSelection(selection) === false) {
    return false;
  }
  const start = selection.isBackward() ? selection.focus : selection.anchor;
  const nodes = $intoLine(pasted, selection);
  const code = $findMatchingParent(start.getNode(), $isCodeNode);
  if (code !== null) {
    selection.removeText();
    const images: LexicalNode[] = [];
    selection.insertRawText($codeTextOf(nodes, images));
    const block =
      $findMatchingParent(selection.anchor.getNode(), $isCodeNode) ?? code;
    $placeAfterCode(block, images);
    return true;
  }
  const heading = $findMatchingParent(start.getNode(), $isHeadingNode);
  const first = $isHeadingNode(heading) ? heading.getFirstDescendant() : null;
  const atStart =
    $isHeadingNode(heading) &&
    start.offset === 0 &&
    (start.key === heading.getKey() ||
      (first !== null && start.key === first.getKey()));
  if (
    atStart === false ||
    nodes.some(
      (node) =>
        ($isElementNode(node) || $isDecoratorNode(node)) &&
        node.isInline() === false
    ) === false
  ) {
    return $insertIntoListItem(nodes, selection);
  }
  selection.removeText();
  const target = $findMatchingParent(
    selection.anchor.getNode(),
    $isHeadingNode
  );
  if ($isHeadingNode(target) === false) {
    return false;
  }
  let run: ElementNode | undefined;
  for (const node of nodes) {
    if (
      ($isElementNode(node) || $isDecoratorNode(node)) &&
      node.isInline() === false
    ) {
      run = undefined;
      target.insertBefore(node);
      continue;
    }
    if (run === undefined) {
      run = $createParagraphNode();
      target.insertBefore(run);
    }
    run.append(node);
  }
  return true;
};

/**
 * A paste into a code block inserts its plain text there; the images and
 * figures of the field's own copied nodes go after the block, in order.
 */
const $pasteIntoCode = (editor: LexicalEditor, data: DataTransfer) => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return false;
  }
  const code = $findMatchingParent(selection.anchor.getNode(), $isCodeNode);
  if (
    code === null ||
    $findMatchingParent(selection.focus.getNode(), $isCodeNode)?.is(code) !==
      true
  ) {
    return false;
  }
  const clean = withoutRefusedLinks(data) ?? data;
  const images: LexicalNode[] = [];
  const nodes = $ownClipboardNodes(editor, clean);
  let text =
    nodes === undefined
      ? clean.getData("text/plain")
      : $codeTextOf(nodes, images);
  if (nodes === undefined && text === "") {
    text = htmlCodeText(clean.getData("text/html"));
  }
  selection.insertRawText(text);
  $placeAfterCode(code, images);
  return true;
};

/**
 * Figures alone from the field's own clipboard, pasted in a heading, stand
 * before it with the caret at its start, else after it.
 */
const $pasteFiguresBesideHeading = (
  editor: LexicalEditor,
  data: DataTransfer
) => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return false;
  }
  const heading = $findMatchingParent(
    selection.anchor.getNode(),
    $isHeadingNode
  );
  if ($isHeadingNode(heading) === false) {
    return false;
  }
  if (withoutRefusedLinks(data) !== undefined) {
    return false;
  }
  const nodes = $ownClipboardNodes(editor, data);
  if (
    nodes === undefined ||
    nodes.length === 0 ||
    nodes.every($isCmsFigureNode) === false
  ) {
    return false;
  }
  const { anchor } = selection;
  const first = heading.getFirstDescendant();
  const atStart =
    (anchor.type === "element" &&
      anchor.offset === 0 &&
      (anchor.key === heading.getKey() || first === null)) ||
    (anchor.type === "text" &&
      anchor.offset === 0 &&
      first !== null &&
      anchor.key === first.getKey());
  if (atStart) {
    for (const node of nodes) {
      heading.insertBefore(node);
    }
    return true;
  }
  let after: LexicalNode = heading;
  for (const node of nodes) {
    after.insertAfter(node);
    after = node;
  }
  return true;
};

/**
 * An element point on an inline element (a link) moves out of it, to a text
 * point where one is beside it: before the element, the end of the text
 * before it; after it, the start of the text after it. An offset past an
 * element's children comes back to its end.
 */
const $pointOutOfInline = (point: PointType) => {
  for (;;) {
    if (point.type !== "element") {
      return;
    }
    const node = point.getNode();
    if ($isElementNode(node) === false) {
      return;
    }
    const size = node.getChildrenSize();
    if (point.offset > size) {
      point.set(node.getKey(), size, "element");
    }
    if (node.isInline() === false) {
      return;
    }
    const at = node.getChildAtIndex(point.offset);
    const before =
      point.offset > 0 ? node.getChildAtIndex(point.offset - 1) : null;
    if ($isTextNode(at)) {
      point.set(at.getKey(), 0, "text");
      return;
    }
    if ($isTextNode(before)) {
      point.set(before.getKey(), before.getTextContentSize(), "text");
      return;
    }
    // the place before or after the inline element, in its parent
    const parent = node.getParentOrThrow();
    const index = node.getIndexWithinParent() + (point.offset === 0 ? 0 : 1);
    const outside =
      point.offset === 0 ? node.getPreviousSibling() : node.getNextSibling();
    if ($isTextNode(outside)) {
      point.set(
        outside.getKey(),
        point.offset === 0 ? outside.getTextContentSize() : 0,
        "text"
      );
      return;
    }
    point.set(parent.getKey(), index, "element");
  }
};

const $selectionIntoAdjacentBlocks = () => {
  if (guardOff("selectionIntoAdjacentBlocks")) {
    return false;
  }
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    $pointOutOfInline(selection.anchor);
    $pointOutOfInline(selection.focus);
    $pointIntoAdjacentBlock(selection.anchor);
    $pointIntoAdjacentBlock(selection.focus);
  }
  return false;
};

const PasteRulesPlugin = () => {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      mergeRegister(
        // an edit at an element point between a quote's or item's blocks
        // starts from a text point in the block beside it (COMMAND_ORDER
        // runs it on the editing commands, and a cut's removal step)
        provideFieldHandlers(editor, {
          selectionIntoAdjacentBlocks: $selectionIntoAdjacentBlocks,
        }),
        // Enter and Shift+Enter in a block-led item or quote split it and
        // break the line, as in any other item
        editor.registerCommand(
          INSERT_PARAGRAPH_COMMAND,
          () => $editAtBlockLed((selection) => selection.insertParagraph()),
          COMMAND_PRIORITY_NORMAL
        ),
        editor.registerCommand(
          INSERT_LINE_BREAK_COMMAND,
          (selectStart) =>
            $editAtBlockLed((selection) =>
              selection.insertLineBreak(selectStart)
            ),
          COMMAND_PRIORITY_NORMAL
        ),
        editor.registerCommand(
          SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
          ({ nodes, selection }) => $insertClipboardNodes(nodes, selection),
          COMMAND_PRIORITY_NORMAL
        ),
        // a drop gets the paste's list passes, above LinkRulePlugin's own
        editor.registerCommand(
          CONTROLLED_TEXT_INSERTION_COMMAND,
          (payload) => {
            if (typeof payload === "string" || payload.dataTransfer === null) {
              return false;
            }
            if ($insertPlainTextAtBlockLed(editor, payload.dataTransfer)) {
              payload.preventDefault();
              return true;
            }
            const wrapped = withStrayListItemsWrapped(payload.dataTransfer);
            if (wrapped === undefined) {
              return false;
            }
            payload.preventDefault();
            editor.dispatchCommand(
              CONTROLLED_TEXT_INSERTION_COMMAND,
              new InputEvent(payload.type, {
                inputType: payload.inputType,
                dataTransfer: wrapped,
              })
            );
            return true;
          },
          COMMAND_PRIORITY_NORMAL
        ),
        // above LinkRulePlugin's paste handler
        editor.registerCommand(
          PASTE_COMMAND,
          (event) => {
            if (
              objectKlassEquals(event, ClipboardEvent) === false ||
              (event as ClipboardEvent).clipboardData === null
            ) {
              return false;
            }
            const data = (event as ClipboardEvent).clipboardData!;
            if (
              $pasteIntoCode(editor, data) ||
              $pasteFiguresBesideHeading(editor, data) ||
              $insertPlainTextAtBlockLed(editor, data) ||
              $pasteTextIntoItemLine(data)
            ) {
              event.preventDefault();
              return true;
            }
            const wrapped = withStrayListItemsWrapped(data);
            if (wrapped === undefined) {
              return false;
            }
            event.preventDefault();
            editor.dispatchCommand(
              PASTE_COMMAND,
              new ClipboardEvent("paste", { clipboardData: wrapped })
            );
            return true;
          },
          COMMAND_PRIORITY_NORMAL
        )
      ),
    [editor]
  );
  return null;
};

/** A save in flight turns editing off. */
const EditablePlugin = ({ editable }: { editable: boolean }) => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  return null;
};

export type RichTextFieldProps = {
  id: string;
  /**
   * The field's own clipboard data's name, kept by its holder across
   * remounts; a field without one names its own.
   */
  namespace?: string;
  /** The field's label: a contenteditable takes its name from it. */
  labelId: string;
  describedBy?: string;
  value: unknown;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: CmsRichTextValue | null) => void;
  onOpenClassic?: () => void;
  /** E9, for the toolbar's Image; without it the toolbar has no Image. */
  source?: Pick<CmsSource, "uploadImage">;
  onError?: (error: string | undefined) => void;
  onBusyChange?: (busy: boolean) => void;
  onRefusal?: (refusal: CmsRefusal) => void;
};

/**
 * The live editor's nodes: the value's, and the code block's line indent,
 * which Enter in a code block can create.
 */
const editorNodes = [...richTextNodes];

export const RichTextField = ({
  id,
  labelId,
  describedBy,
  value,
  disabled = false,
  invalid,
  onChange,
  onOpenClassic,
  source,
  onError,
  onBusyChange,
  onRefusal,
  namespace: namespaceProp,
}: RichTextFieldProps) => {
  // read once: a new value remounts the field (FieldControl's remountKey)
  const [initial] = useState(() => readRichTextValue(value));
  const [ownNamespace] = useState(() => `cms-rich-text-${crypto.randomUUID()}`);
  const namespace = namespaceProp ?? ownNamespace;
  const [readOnlyReason] = useState(() =>
    getRichTextReadOnlyReason(initial?.html ?? "")
  );
  // Classic CMS opens a value with images read-only too: no button
  const [hasImage] = useState(() => richTextHasImage(initial?.html ?? ""));
  // the load is the composer's first update; once mounted, editing follows
  const isLoading = useRef(true);
  useEffect(() => {
    isLoading.current = false;
  }, []);
  const watched = useRef<((value: FieldValue) => void) | undefined>(undefined);

  if (readOnlyReason !== undefined) {
    return (
      <Grid gap="1" data-cms-rich-text-read-only={readOnlyReason}>
        <div className={frameStyle()} data-disabled>
          <Text
            id={id}
            aria-labelledby={labelId}
            css={{ padding: theme.spacing[5], whiteSpace: "pre-wrap" }}
          >
            {initial?.text ?? ""}
          </Text>
        </div>
        <Flex align="center" gap="2" css={{ flexWrap: "wrap" }}>
          <Text color="destructive">
            {hasImage ? "Read only" : "Edit in Classic CMS"}
          </Text>
          {hasImage === false && onOpenClassic !== undefined && (
            <Button color="neutral" onClick={onOpenClassic}>
              Classic CMS
            </Button>
          )}
        </Flex>
      </Grid>
    );
  }

  return (
    <LexicalComposer
      initialConfig={{
        // one per field: Lexical reads copied nodes, images included, only
        // from this field's own copy, cut or drag
        namespace,
        theme: editorTheme,
        nodes: editorNodes,
        html: richTextHtmlConfig,
        editable: disabled === false,
        // while the value loads, a failure reaches the load boundary; after
        // it, one is reported, not rethrown, so Lexical keeps the state
        // before the failed update and nothing half-applied is saved
        onError: (error) => {
          if (isLoading.current) {
            throw error;
          }
          console.error(error);
        },
        // The composer tags this update "history-merge", which the change
        // plugin skips: loading writes nothing.
        editorState: (editor) =>
          importRichTextHtml(editor, initial?.html ?? ""),
      }}
    >
      <div
        className={frameStyle()}
        data-invalid={invalid || undefined}
        data-disabled={disabled || undefined}
        data-cms-rich-text
      >
        <Toolbar
          id={id}
          disabled={disabled}
          upload={
            source === undefined
              ? undefined
              : { source, onError, onBusyChange, onRefusal }
          }
        />
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              id={id}
              className={contentStyle()}
              ariaLabelledBy={labelId}
              ariaDescribedBy={describedBy}
              ariaInvalid={invalid || undefined}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <EditablePlugin editable={disabled === false} />
        <CmsHistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <LinkRulePlugin />
        <PasteRulesPlugin />
        <ImageEditingPlugin />
        <HorizontalRulePlugin />
        <TransformsPlugin namespace={namespace} />
        <OnChangePlugin
          ignoreSelectionChange
          ignoreHistoryMergeTagChange
          onChange={(_editorState, editor) => {
            const value = fieldValueOf(editor);
            watched.current?.(value);
            onChange(value);
          }}
        />
        <WatchPlugin watched={watched} />
      </div>
    </LexicalComposer>
  );
};
