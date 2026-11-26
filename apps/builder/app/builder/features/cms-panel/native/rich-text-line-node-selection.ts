// Node selections in a lined container, their handlers, and the line code's root input listeners.
import { $insertDataTransferForRichText } from "@lexical/clipboard";
import {
  $createRangeSelection,
  $getEditor,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $setSelection,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  type LexicalCommand,
  type LexicalEditor,
  PASTE_COMMAND,
} from "lexical";
import { objectKlassEquals } from "@lexical/utils";
import {
  $isCmsLineNode,
  isBlockDecorator,
  isLinedContainer,
  linesOff,
} from "./rich-text-line-node";
import { $unwrapLines } from "./rich-text-line-normalise";
import { rememberCompositionStart } from "./rich-text-line-history";
import {
  $notePasteHeldLine,
  $resolveLinedPoints,
} from "./rich-text-line-points";
import {
  $hasMark,
  $mark,
  HEAD_PATH_TAG,
  PASTE_OVER_NODE_MARK,
} from "./rich-text-line-removal";

/**
 * A node selection of a block in a lined container becomes a caret in a
 * line after the block; with `replace`, the block goes (a paste, a drop or
 * typing replaces it).
 */
export const $nodeSelectionIntoLine = (replace: boolean, create: boolean) => {
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
  $resolveLinedPoints(create);
  if (replace) {
    for (const node of nodes) {
      node.remove();
    }
  }
};

/**
 * A node selection in a lined container, for a command the head runs
 * well there (a paste of HTML or of the field's own nodes, a cut, a
 * delete): the container's lines give way to their children for this
 * update, so the head's own path runs over the head's tree, and the line
 * rules wrap the result at the end of the update. True when it did.
 */
export const $headPathOverNodeSelection = () => {
  const selection = $getSelection();
  if ($isNodeSelection(selection) === false) {
    return false;
  }
  const parent = selection.getNodes().at(-1)?.getParent() ?? null;
  const container = $isCmsLineNode(parent) ? parent.getParent() : parent;
  if (isLinedContainer(container) === false) {
    return false;
  }
  $unwrapLines(container.getChildren());
  $mark(HEAD_PATH_TAG);
  return true;
};

/** Typed or composed text lands directly after a selected node, which stays (D15). */
export const $typeIntoLine = (payload: unknown): boolean => {
  if ($hasMark(HEAD_PATH_TAG)) {
    return false;
  }
  // a drop carries a data transfer: it is a paste
  if (typeof payload === "string") {
    $nodeSelectionIntoLine(false, true);
  }
  return false;
};

/** A paste or drop over a node selection in a lined container (D15). */
export const $nodeSelectionPaste = (
  command: LexicalCommand<unknown>,
  payload: unknown
): boolean => {
  if ($hasMark(HEAD_PATH_TAG)) {
    return false;
  }
  const selection = $getSelection();
  const data =
    command === PASTE_COMMAND && objectKlassEquals(payload, ClipboardEvent)
      ? (payload as ClipboardEvent).clipboardData
      : null;
  const isRich =
    data !== null &&
    (data.getData("text/html") !== "" ||
      data.getData("application/x-lexical-editor") !== "");
  // 14.8 (D15): in a lined container that starts with a block,
  // where the head's own path does not end, Lexical's order for a
  // node selection, with the point after the last selected node
  // resolved by D18 first: the paste runs at that caret, as a paste
  // there does (D14), then the selected nodes go. A container that
  // starts with a line keeps the head's write
  if (isRich && $isNodeSelection(selection)) {
    const nodes = selection.getNodes();
    const container = nodes.at(-1)?.getParent() ?? null;
    if (
      isLinedContainer(container) &&
      $isCmsLineNode(container.getFirstChild()) === false
    ) {
      $nodeSelectionIntoLine(false, true);
      const caret = $getSelection();
      if ($isRangeSelection(caret)) {
        (payload as ClipboardEvent).preventDefault();
        $mark(PASTE_OVER_NODE_MARK);
        $insertDataTransferForRichText(data, caret, $getEditor());
        for (const node of nodes) {
          if (node.isAttached()) {
            node.remove();
          }
        }
        // T37.2: where the paste inserted nothing, the caret stays in the
        // line made at the point after the nodes, where they were
        const after = $getSelection();
        const line = $isRangeSelection(after) ? after.anchor.getNode() : null;
        if (
          $isRangeSelection(after) &&
          after.isCollapsed() &&
          $isCmsLineNode(line) &&
          line.isEmpty() &&
          line.isAttached()
        ) {
          $notePasteHeldLine(line);
        }
        return true;
      }
    }
  }
  if (isRich && $headPathOverNodeSelection()) {
    return false;
  }
  // plain text replaces the node; a clipboard of files only leaves it
  if (
    command === PASTE_COMMAND &&
    data !== null &&
    data.getData("text/plain") !== ""
  ) {
    $nodeSelectionIntoLine(true, false);
  }
  return false;
};

/**
 * A remove command under a node selection in a lined container takes the
 * head's path (D15); the removal mark then skips the update.
 */
export const $headPathOnRemove = (): boolean => {
  if ($hasMark(HEAD_PATH_TAG) === false) {
    $headPathOverNodeSelection();
  }
  return false;
};

/**
 * The root's input listeners of the line code: its `beforeinput` handler
 * (typed text with a block node-selected in a lined container lands
 * directly after the node, which stays (D15); Lexical leaves text typed
 * over a node selection to the browser, so the field takes the
 * `beforeinput` first; and Safari's text replacement), and its
 * `compositionstart` handler (the move before a leading link, then
 * `rememberCompositionStart`, Task 20). Each is
 * created once per registration and follows the root: removed from the
 * previous root, added to the new one, and removed at the cleanup.
 */
export const registerLineInputListener = (editor: LexicalEditor) => {
  if (linesOff) {
    return () => {};
  }
  // a composition at the start of a line that starts with a link lands
  // before the link, as a typed letter does: the caret stands on the
  // line's start before the composition begins
  const onCompositionStart = () => {
    // F12: what the composition's end needs, before Lexical's own
    // compositionstart handler changes anything; the state before is the
    // person's, before the two point moves below
    const before = editor.getEditorState();
    moveBeforeLeadingLink();
    composeForward();
    rememberCompositionStart(editor, before);
  };
  // 16.20: a composition over a backward range composes as over the
  // forward range: the range's ends are swapped before Lexical's own
  // compositionstart handler runs (a point move only: no tag)
  const composeForward = () => {
    const $backward = () => {
      const selection = $getSelection();
      return (
        $isRangeSelection(selection) &&
        selection.isCollapsed() === false &&
        selection.isBackward()
      );
    };
    if (editor.getEditorState().read($backward) === false) {
      return;
    }
    editor.update(
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) === false || $backward() === false) {
          return;
        }
        const { anchor, focus } = selection;
        const start = {
          key: focus.key,
          offset: focus.offset,
          type: focus.type,
        };
        focus.set(anchor.key, anchor.offset, anchor.type);
        anchor.set(start.key, start.offset, start.type);
      },
      { discrete: true }
    );
  };
  const moveBeforeLeadingLink = () => {
    const $atLinkLedLineStart = () => {
      const selection = $getSelection();
      if (
        $isRangeSelection(selection) === false ||
        selection.isCollapsed() === false
      ) {
        return false;
      }
      const point = selection.anchor;
      const text = point.getNode();
      const link = text.getParent();
      const line = link?.getParent() ?? null;
      return (
        point.type === "text" &&
        point.offset === 0 &&
        $isElementNode(link) &&
        link.isInline() &&
        link.getFirstChild()?.is(text) === true &&
        $isCmsLineNode(line) &&
        line.getFirstChild()?.is(link) === true
      );
    };
    if (editor.getEditorState().read($atLinkLedLineStart) === false) {
      return;
    }
    editor.update(
      () => {
        const selection = $getSelection();
        if (
          $isRangeSelection(selection) === false ||
          selection.isCollapsed() === false
        ) {
          return;
        }
        const point = selection.anchor;
        const text = point.getNode();
        const link = text.getParent();
        const line = link?.getParent() ?? null;
        if (
          point.type !== "text" ||
          point.offset !== 0 ||
          $isElementNode(link) === false ||
          link.isInline() === false ||
          link.getFirstChild()?.is(text) !== true ||
          $isCmsLineNode(line) === false ||
          line.getFirstChild()?.is(link) !== true
        ) {
          return;
        }
        // a point move only: no tag
        point.set(line.getKey(), 0, "element");
        selection.focus.set(line.getKey(), 0, "element");
      },
      { discrete: true }
    );
  };
  const onBeforeInput = (event: InputEvent) => {
    // Safari's text replacement over a range: the controlled text
    // insertion, so the removal is marked like typed text (5.4)
    if (
      event.inputType === "insertText" &&
      event.data === null &&
      event.dataTransfer !== null
    ) {
      const ranged = editor.getEditorState().read(() => {
        const selection = $getSelection();
        return (
          $isRangeSelection(selection) && selection.isCollapsed() === false
        );
      });
      if (ranged) {
        event.preventDefault();
        event.stopImmediatePropagation();
        editor.dispatchCommand(
          CONTROLLED_TEXT_INSERTION_COMMAND,
          event.dataTransfer.getData("text/plain")
        );
      }
      return;
    }
    if (event.inputType !== "insertText" || event.data === null) {
      return;
    }
    let handled = false;
    editor.update(() => {
      const selection = $getSelection();
      if ($isNodeSelection(selection) === false) {
        return;
      }
      const node = selection.getNodes().at(-1);
      if (
        node === undefined ||
        isBlockDecorator(node) === false ||
        isLinedContainer(node.getParent()) === false
      ) {
        return;
      }
      $nodeSelectionIntoLine(false, true);
      const range = $getSelection();
      if ($isRangeSelection(range)) {
        range.insertText(event.data ?? "");
        handled = true;
      }
    });
    if (handled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  // Lexical's cleanup calls the listener with (null, root)
  return editor.registerRootListener((root, previous) => {
    previous?.removeEventListener("compositionstart", onCompositionStart, true);
    previous?.removeEventListener(
      "beforeinput",
      onBeforeInput as EventListener,
      true
    );
    root?.addEventListener("compositionstart", onCompositionStart, true);
    root?.addEventListener("beforeinput", onBeforeInput as EventListener, true);
  });
};
