// The history plugin's external state and the composition's step.
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  createEmptyHistoryState,
  HistoryPlugin,
  type HistoryState,
} from "@lexical/react/LexicalHistoryPlugin";
import { mergeRegister } from "@lexical/utils";
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  type EditorState,
  type LexicalEditor,
  TextNode,
} from "lexical";
import { createElement, useEffect, useState } from "react";
import { linesOff, lineSpike } from "./rich-text-line-node";
import { d7Document } from "./rich-text-line-points";

/** The field's history (Lexical's HistoryPlugin state), for K. */
const cmsHistory = new WeakMap<LexicalEditor, HistoryState>();

/** Per editor, the composition under way: the state before it, the undo stack's length then, the entry below it and the redo stack. */
type HistoryEntry = HistoryState["undoStack"][number];

const compositionStarts = new WeakMap<
  LexicalEditor,
  {
    before: EditorState;
    index: number;
    below: HistoryEntry | undefined;
    redo: HistoryEntry[];
    ended: boolean;
  }
>();

/** Per editor, the text the page's last composition ended with. */
const compositionEndText = new WeakMap<LexicalEditor, string>();

/**
 * Per editor, a composition an undo or a redo voided while it ran: void
 * until it runs on and then ends.
 */
const compositionVoided = new WeakMap<LexicalEditor, "voided" | "resumed">();

/**
 * F12 (K): a composition that changes the document is its own undo step,
 * decided at the composition's own end from state. At the commit in which
 * the editor starts composing, the state before it (S0), the undo stack's
 * length (n0), the entry below that length and the redo stack are kept per
 * editor. At the commit in which it stops:
 * - a document equal to S0's (a cancelled composition) puts the history
 *   back exactly: the undo stack is cut back to n0 and the redo stack is
 *   the one kept (15.2);
 * - a changed one gets S0 as a step at n0, unless the history already
 *   holds it there.
 * Only the composition's own end counts (15.1): a commit from the history
 * (an undo or a redo) during the composition, or a history that moved
 * since the start (a stack shorter than n0, or another entry below it),
 * voids what was kept, and the history stays as Lexical left it.
 */
export const registerCompositionStep = (editor: LexicalEditor) => {
  if (linesOff) {
    return () => {};
  }
  // the text the page's composition ended with: none is a cancel
  const onEnd = (event: CompositionEvent) => {
    compositionEndText.set(editor, event.data ?? "");
  };
  // R1 (the composition-start character): Lexical 0.21 starts a
  // composition over a range, or at an element point, by inserting
  // COMPOSITION_START_CHAR (U+200B on Chrome and other Blink browsers,
  // U+00A0 on Firefox, Safari and iOS) at the caret. At the commit in which
  // the editor starts composing, the composed node holds it just before
  // the caret: that place is kept, and at the composition's end the
  // character is removed in the same update when it is still there. Never
  // a strip: no other character is touched
  let starting: string | null = null;
  let startPlace: { key: string; offset: number; char: string } | null = null;
  let removedAtEnd = false;
  // on the window, in the capture phase: before Lexical's own listener on
  // the root
  const onStart = (event: CompositionEvent) => {
    const root = editor.getRootElement();
    if (
      root === null ||
      event.target instanceof Node === false ||
      root.contains(event.target) === false
    ) {
      return;
    }
    // until the next commit: the start's own (Lexical's listener runs
    // after a microtask checkpoint, so a microtask would end it too soon)
    starting = "";
  };
  return mergeRegister(
    editor.registerRootListener((root, previous) => {
      previous?.removeEventListener("compositionend", onEnd, true);
      root?.addEventListener("compositionend", onEnd, true);
      previous?.ownerDocument.defaultView?.removeEventListener(
        "compositionstart",
        onStart,
        true
      );
      root?.ownerDocument.defaultView?.addEventListener(
        "compositionstart",
        onStart,
        true
      );
    }),
    editor.registerCommand(
      CONTROLLED_TEXT_INSERTION_COMMAND,
      (payload) => {
        if (
          starting === "" &&
          editor.isComposing() &&
          (payload === "\u200b" || payload === "\u00a0")
        ) {
          starting = payload;
        }
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    ),
    // the composition's end dirties the text node the page's caret is
    // in, which need not be the composed one
    editor.registerNodeTransform(TextNode, () => {
      const place = startPlace;
      if (
        place === null ||
        editor.isComposing() ||
        lineSpike.compositionStartCharKept
      ) {
        return;
      }
      startPlace = null;
      const node = $getNodeByKey(place.key);
      if ($isTextNode(node) === false || node.isAttached() === false) {
        return;
      }
      const text = node.getTextContent();
      if (text[place.offset] !== place.char) {
        return;
      }
      node.setTextContent(
        text.slice(0, place.offset) + text.slice(place.offset + 1)
      );
      removedAtEnd = true;
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        for (const point of [selection.anchor, selection.focus]) {
          if (
            point.type === "text" &&
            point.key === place.key &&
            point.offset > place.offset
          ) {
            point.set(point.key, point.offset - 1, "text");
          }
        }
      }
    }),
    editor.registerUpdateListener(
      ({ editorState, prevEditorState, tags, dirtyElements, dirtyLeaves }) => {
        // R1: the place of the start character, read at the commit that
        // inserted it; gone once the composition is over
        if (
          editor.isComposing() &&
          typeof starting === "string" &&
          starting !== ""
        ) {
          const char = starting;
          starting = null;
          startPlace = editorState.read(() => {
            const selection = $getSelection();
            if (
              $isRangeSelection(selection) === false ||
              selection.anchor.type !== "text"
            ) {
              return null;
            }
            const { key, offset } = selection.anchor;
            const node = $getNodeByKey(key);
            return $isTextNode(node) &&
              offset > 0 &&
              node.getTextContent()[offset - 1] === char
              ? { key, offset: offset - 1, char }
              : null;
          });
        } else if (editor.isComposing() === false || tags.has("historic")) {
          startPlace = null;
        }
        // a start that inserted no character is over at its commit (a
        // commit before it, made while not composing, leaves it)
        if (editor.isComposing()) {
          starting = null;
        }
        const history = cmsHistory.get(editor);
        if (history === undefined) {
          return;
        }
        // R1: the end that removed the start character is the
        // composition's own commit: the state it replaced (the composing
        // one, which held the character) is no step of its own
        if (removedAtEnd) {
          removedAtEnd = false;
          if (history.undoStack.at(-1)?.editorState === prevEditorState) {
            history.undoStack.pop();
          }
        }
        const start = compositionStarts.get(editor);
        if (tags.has("historic")) {
          if (start !== undefined) {
            compositionStarts.delete(editor);
            if (start.ended === false) {
              compositionVoided.set(editor, "voided");
            }
          }
          return;
        }
        if (editor.isComposing()) {
          // the voided composition runs on (an undo can end the page's
          // composition, and the input method starts it again)
          if (compositionVoided.get(editor) === "voided") {
            compositionVoided.set(editor, "resumed");
          }
          if (start === undefined && compositionVoided.has(editor) === false) {
            // the history may already have taken this commit's step: its
            // newest entry is then the state before this commit
            const length = history.undoStack.length;
            const pushedHere =
              history.undoStack.at(-1)?.editorState === prevEditorState;
            const index = pushedHere ? length - 1 : length;
            compositionEndText.delete(editor);
            compositionStarts.set(editor, {
              before: prevEditorState,
              index,
              below: index > 0 ? history.undoStack[index - 1] : undefined,
              redo: [...history.redoStack],
              ended: false,
            });
          }
          return;
        }
        if (start === undefined) {
          // the voided composition's own end
          if (compositionVoided.get(editor) === "resumed") {
            compositionVoided.delete(editor);
          }
          return;
        }
        if (
          history.undoStack.length < start.index ||
          (start.index > 0 &&
            history.undoStack[start.index - 1] !== start.below)
        ) {
          compositionStarts.delete(editor);
          return;
        }
        const before = d7Document(start.before);
        // a cancelled composition: the history exactly as before it. A
        // composition that ended with no text is a cancel, and the commit
        // that takes out its leftover belongs to it; one that ended with
        // text is decided at its end, and the next edit is the person's
        if (d7Document(editorState) === before) {
          compositionStarts.delete(editor);
          history.undoStack.length = start.index;
          history.redoStack.length = 0;
          history.redoStack.push(...start.redo);
          editor.dispatchCommand(
            CAN_UNDO_COMMAND,
            history.undoStack.length > 0
          );
          editor.dispatchCommand(
            CAN_REDO_COMMAND,
            history.redoStack.length > 0
          );
          return;
        }
        if (start.ended) {
          // a commit that changes no node is not the one read after the end
          if (dirtyElements.size > 0 || dirtyLeaves.size > 0) {
            compositionStarts.delete(editor);
          }
          return;
        }
        if (compositionEndText.get(editor) === "") {
          start.ended = true;
        } else {
          compositionStarts.delete(editor);
        }
        const entry = history.undoStack[start.index];
        if (entry !== undefined && d7Document(entry.editorState) === before) {
          return;
        }
        history.undoStack.splice(start.index, 0, {
          editor,
          editorState: start.before,
        });
        history.redoStack.length = 0;
        editor.dispatchCommand(CAN_UNDO_COMMAND, true);
        editor.dispatchCommand(CAN_REDO_COMMAND, false);
      }
    )
  );
};

export const CmsHistoryPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const [historyState] = useState(createEmptyHistoryState);
  useEffect(() => {
    cmsHistory.set(editor, historyState);
    return () => {
      cmsHistory.delete(editor);
    };
  }, [editor, historyState]);
  return createElement(HistoryPlugin, { externalHistoryState: historyState });
};

export const historyStateOf = (editor: LexicalEditor): HistoryState => {
  const state = cmsHistory.get(editor);
  if (state === undefined) {
    throw new Error("cms history: no history state for this editor");
  }
  return state;
};
