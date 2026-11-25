// The delete rules at a resolved caret.
import { $isListItemNode } from "@lexical/list";
import { $isQuoteNode } from "@lexical/rich-text";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  ElementNode,
  type LexicalCommand,
  type LexicalEditor,
  type LexicalNode,
} from "lexical";
import {
  $atContentEdge,
  $childAtEdge,
  $isCmsLineNode,
  isBlockDecorator,
  isLineBreak,
  isLinedContainer,
} from "./rich-text-line-node";
import { $hasMark, HEAD_PATH_TAG } from "./rich-text-line-removal";

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

export const registerDeleteCommands = (editor: LexicalEditor) =>
  mergeRegister(
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
    ...[DELETE_CHARACTER_COMMAND, DELETE_WORD_COMMAND, DELETE_LINE_COMMAND].map(
      (command) =>
        editor.registerCommand(
          command as LexicalCommand<boolean>,
          (isBackward: boolean) => {
            const selection = $getSelection();
            if (
              $isRangeSelection(selection) === false ||
              selection.isCollapsed() === false
            ) {
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
            const beside = isBackward
              ? line.getPreviousSibling()
              : line.getNextSibling();
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
    ...[DELETE_CHARACTER_COMMAND, DELETE_WORD_COMMAND, DELETE_LINE_COMMAND].map(
      (command) =>
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
    ...[DELETE_CHARACTER_COMMAND, DELETE_WORD_COMMAND, DELETE_LINE_COMMAND].map(
      (command) =>
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
    ...[DELETE_CHARACTER_COMMAND, DELETE_WORD_COMMAND, DELETE_LINE_COMMAND].map(
      (command) =>
        editor.registerCommand(
          command as LexicalCommand<boolean>,
          (isBackward: boolean) => {
            const selection = $getSelection();
            if (
              isBackward === false ||
              $isRangeSelection(selection) === false ||
              selection.isCollapsed() === false
            ) {
              return false;
            }
            const { anchor } = selection;
            const line = anchor.getNode();
            if (
              anchor.type !== "element" ||
              anchor.offset !== 0 ||
              $isCmsLineNode(line) === false
            ) {
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
        const line = $isCmsLineNode(node)
          ? node
          : $findMatchingParent(node, $isCmsLineNode);
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
    ...[DELETE_CHARACTER_COMMAND, DELETE_WORD_COMMAND, DELETE_LINE_COMMAND].map(
      (command) =>
        editor.registerCommand(
          command as LexicalCommand<boolean>,
          (isBackward: boolean) => {
            if (isBackward === false) {
              return false;
            }
            const selection = $getSelection();
            if (
              $isRangeSelection(selection) === false ||
              selection.isCollapsed() === false
            ) {
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
            if (
              $isListItemNode(previous) === false ||
              isLinedContainer(previous) === false
            ) {
              return false;
            }
            const lastChild = previous.getLastChild();
            const rule =
              $isQuoteNode(lastChild) &&
              isBlockDecorator(lastChild.getLastChild())
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
