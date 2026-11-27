// Node selections in a lined container, their handlers, and the line code's root input listeners.
import {
  $createRangeSelection,
  $getEditor,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  type LexicalCommand,
  type LexicalEditor,
  type LexicalNode,
  PASTE_COMMAND,
} from "lexical";
import { objectKlassEquals } from "@lexical/utils";
import {
  $isCmsLineNode,
  isBlockDecorator,
  isLinedContainer,
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
 * Where a typed letter goes beside a block node-selected in a lined
 * container: the element point directly after the block (D15), which
 * `$resolveLinedPoints` takes into a line. Null for a block that is not
 * attached or does not stand in a lined container.
 */
export const $caretAfterLinedBlock = (node: LexicalNode | null | undefined) => {
  if (node == null || node.isAttached() === false) {
    return null;
  }
  const container = node.getParent();
  if (isLinedContainer(container) === false) {
    return null;
  }
  const index = node.getIndexWithinParent() + 1;
  const range = $createRangeSelection();
  range.anchor.set(container.getKey(), index, "element");
  range.focus.set(container.getKey(), index, "element");
  return range;
};

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
  const range = $caretAfterLinedBlock(nodes.at(-1));
  if (range === null) {
    return;
  }
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

/**
 * The selected nodes go once a paste at the point after them is done (D15).
 * T37.2: where the paste inserted nothing, the caret stays in the line made
 * at that point, where the nodes were.
 */
const $removeAfterPaste = (nodes: LexicalNode[]) => {
  for (const node of nodes) {
    if (node.isAttached()) {
      node.remove();
    }
  }
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
      if ($isRangeSelection($getSelection())) {
        const event = payload as ClipboardEvent;
        const editor = $getEditor();
        event.preventDefault();
        $mark(PASTE_OVER_NODE_MARK);
        // the field's own paste path runs at that caret, every paste rule
        // with it (T95.3)
        editor.dispatchCommand(PASTE_COMMAND, event);
        // Lexical's own insert is queued in this update: the nodes go
        // after it, in an update queued behind it
        editor.update(() => $removeAfterPaste(nodes));
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
 * head's path (D15); the removal mark then skips the update. Only a
 * command whose node-selection path removes the selected nodes unwraps:
 * Lexical's word and line deletes act on a range only, so under a node
 * selection they change nothing, and an unwrap there would dirty the item
 * for no change (T45.1).
 */
export const $headPathOnRemove = (
  command: LexicalCommand<unknown>
): boolean => {
  if (command === DELETE_WORD_COMMAND || command === DELETE_LINE_COMMAND) {
    return false;
  }
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
  // compositionstart handler runs (a point move only: no tag).
  // T59 defect 6 (16.20, F12): and in the format of the text it starts
  // in, as the forward range placed at that text does. A range the page
  // makes (real keys, a drag) carries the format its texts share: none
  // from plain into bold. Lexical's composition start then writes the
  // start character in that format, and its input handler, finding the
  // composed node's format unlike the selection's
  // (`$shouldPreventDefaultAndInsertText`), ends the composition for the
  // editor at the first composed text while the page composes on: the
  // page's composition starts again, a second undo step. The selection
  // takes its first point's text's format and style (a selection change
  // only: no node is dirty, no tag)
  const composeForward = () => {
    const $backward = () => {
      const selection = $getSelection();
      return (
        $isRangeSelection(selection) &&
        selection.isCollapsed() === false &&
        selection.isBackward()
      );
    };
    // the text at the selection's anchor, when the selection's format or
    // style is not its own. getStartEndPoints() gives [anchor, focus], so
    // the anchor is the range's start only for a forward range: in the
    // update below the backward swap runs first; in the read that gates
    // the update a backward range runs the update whatever this returns
    const $startUnlikeSelection = () => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) === false || selection.isCollapsed()) {
        return null;
      }
      const [start] = selection.getStartEndPoints() ?? [];
      const node = start?.type === "text" ? start.getNode() : null;
      return $isTextNode(node) &&
        (node.getFormat() !== selection.format ||
          node.getStyle() !== selection.style)
        ? node
        : null;
    };
    if (
      editor
        .getEditorState()
        .read(() => $backward() || $startUnlikeSelection() !== null) === false
    ) {
      return;
    }
    editor.update(
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) === false) {
          return;
        }
        if ($backward()) {
          const { anchor, focus } = selection;
          const start = {
            key: focus.key,
            offset: focus.offset,
            type: focus.type,
          };
          focus.set(anchor.key, anchor.offset, anchor.type);
          anchor.set(start.key, start.offset, start.type);
        }
        const node = $startUnlikeSelection();
        if (node !== null) {
          // RangeSelection has no setter for its format in Lexical 0.21
          selection.format = node.getFormat();
          selection.setStyle(node.getStyle());
        }
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
