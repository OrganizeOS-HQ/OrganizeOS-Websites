// The history plugin's external state and the composition's step: the
// only module that writes the history's undo and redo stacks (T10.10).
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  createEmptyHistoryState,
  HistoryPlugin,
  type HistoryState,
} from "@lexical/react/LexicalHistoryPlugin";
import { mergeRegister } from "@lexical/utils";
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $setCompositionKey,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  CLEAR_EDITOR_COMMAND,
  CLEAR_HISTORY_COMMAND,
  COMMAND_PRIORITY_LOW,
  type EditorState,
  type LexicalEditor,
  type NodeKey,
} from "lexical";
import { createElement, useEffect, useState } from "react";
import {
  d7Document,
  endPageComposition,
  registerPageComposition,
} from "./rich-text-line-points";

/** The field's history (Lexical's HistoryPlugin state), per editor. */
const cmsHistory = new WeakMap<LexicalEditor, HistoryState>();

type HistoryEntry = HistoryState["undoStack"][number];

/** Chrome's composition-start character; Firefox and Safari insert U+00A0. */
const CHROME_START_CHAR = "​";

/**
 * Per editor, the composition under way, from its start until it is
 * settled:
 * - `armed`: remembered at the page's `compositionstart`, before Lexical's
 *   own handler has made any change;
 * - `composing`: the editor composes;
 * - `ended`: the editor stopped composing with no text (a cancel); the
 *   commit that takes out its leftover belongs to it, until the person's
 *   next key or input that is no composition's;
 * - `removing`: the editor stopped composing and the composition-start
 *   character is being removed, in the update that follows the end.
 */
type Composition = {
  phase: "armed" | "composing" | "ended" | "removing";
  /** The state before the composition's first change. */
  before: EditorState;
  /** The undo stack's length then, and the entry below that length. */
  index: number;
  below: HistoryEntry | undefined;
  /** The redo stack as it stood before the composition's first change (16.1). */
  redo: HistoryEntry[];
  /**
   * The text the selection held then: what the composition replaces
   * (T59 defect 7).
   */
  held: string;
  /** The text node the composition wrote in, as last seen while composing. */
  composedKey: NodeKey | null;
  /** The removal found no character to remove in the composed node. */
  unremovable: boolean;
};

const compositions = new WeakMap<LexicalEditor, Composition>();

/**
 * Per editor, the composition-start character Lexical inserted for the
 * composition under way (a controlled text insertion while composing).
 */
const startCharOf = new WeakMap<LexicalEditor, string>();

/** Per editor, the text the page's last composition ended with. */
const compositionEndText = new WeakMap<LexicalEditor, string>();

/**
 * Per editor, a composition an undo, a redo or a clear of the history
 * voided while it ran: void until it runs on and then ends, or until the
 * page's composition ends, or until the person's next key or input that is
 * no composition's (the voided composition is then over; the next
 * composition is one of its own).
 */
const compositionVoided = new WeakMap<LexicalEditor, "voided" | "resumed">();

const countIn = (text: string, char: string) => text.split(char).length - 1;

const countOf = (state: EditorState, char: string) =>
  state.read(() => countIn($getRoot().getTextContent(), char));

/** The text a range selection holds in `state`; none for a caret. */
const heldIn = (state: EditorState) =>
  state.read(() => {
    const selection = $getSelection();
    return $isRangeSelection(selection) && selection.isCollapsed() === false
      ? selection.getTextContent()
      : "";
  });

const startCharsOf = (editor: LexicalEditor) => {
  const recorded = startCharOf.get(editor);
  return recorded === undefined || recorded === CHROME_START_CHAR
    ? [CHROME_START_CHAR]
    : [CHROME_START_CHAR, recorded];
};

/**
 * How many composition-start characters the editor's document holds beyond
 * the count it held before the composition under way, less those the
 * range it composes over held (the composition replaces them; T59 defect
 * 7, first example: a range over `B<U+200B>1w` in `<p>A0w<strong>B<U+200B>1w
 * </strong></p>`): 0 when none is.
 */
const startCharsLeft = (editor: LexicalEditor, state: EditorState) => {
  const composition = compositions.get(editor);
  if (composition === undefined || composition.unremovable) {
    return 0;
  }
  let left = 0;
  for (const char of startCharsOf(editor)) {
    left += Math.max(
      0,
      countOf(state, char) -
        (countOf(composition.before, char) - countIn(composition.held, char))
    );
  }
  return left;
};

/**
 * 16.21: whether the editor's document holds a composition-start character
 * the composition under way added. The field hands out no such value.
 */
export const compositionHoldsStartChar = (editor: LexicalEditor) =>
  startCharsLeft(editor, editor.getEditorState()) > 0;

/**
 * R1: the composition-start character Lexical inserts at a composition's
 * start reaches the field as a controlled text insertion while composing;
 * the character is kept per editor (the table's
 * `history.compositionStartChar`). Never handles the command.
 */
export const compositionStartChar = (
  editor: LexicalEditor,
  payload: unknown
): boolean => {
  if (
    editor.isComposing() &&
    startCharOf.has(editor) === false &&
    (payload === CHROME_START_CHAR || payload === " ")
  ) {
    startCharOf.set(editor, payload);
  }
  return false;
};

/**
 * Remembers, per editor, what the composition about to start needs at its
 * end: the state before it, the undo stack's length with the entry below
 * it, and the redo stack, taken before Lexical's own `compositionstart`
 * handler can change the document and the history plugin empty the redo
 * stack (16.1). Called at the page's `compositionstart`, before Lexical's
 * listener runs. Makes no update.
 */
export const rememberCompositionStart = (
  editor: LexicalEditor,
  before: EditorState = editor.getEditorState()
) => {
  const history = cmsHistory.get(editor);
  if (history === undefined || editor.isComposing()) {
    return;
  }
  const index = history.undoStack.length;
  compositionEndText.delete(editor);
  startCharOf.delete(editor);
  compositions.set(editor, {
    phase: "armed",
    before,
    index,
    below: index > 0 ? history.undoStack[index - 1] : undefined,
    redo: [...history.redoStack],
    held: heldIn(before),
    composedKey: null,
    unremovable: false,
  });
};

const announce = (editor: LexicalEditor, history: HistoryState) => {
  editor.dispatchCommand(CAN_UNDO_COMMAND, history.undoStack.length > 0);
  editor.dispatchCommand(CAN_REDO_COMMAND, history.redoStack.length > 0);
};

/**
 * F12 (K) and 15.2, decided once the composition has ended, from state:
 * - a document equal under D7 to the one before (a cancelled composition):
 *   the undo stack is cut back to the remembered length and the redo stack
 *   is the one remembered (invariant: both stacks as they stood before the
 *   composition's first change);
 * - a different document: the undo stack holds, from the remembered
 *   length on, one step with the remembered state, and the redo stack is
 *   emptied
 *   (invariant: the composition is one step, and one undo restores the
 *   document before it);
 * - a history that moved since the start (a stack shorter than the
 *   remembered length, or another entry below it) voids what was
 *   remembered (15.1), as an undo, a redo or a clear during the
 *   composition does (16.2): the history stays as Lexical left it.
 * A composition that ended with no text waits for the commit that takes out
 * its leftover. Returns whether the composition is settled.
 */
export const settleCompositionEnd = (
  editor: LexicalEditor,
  endText: string
): boolean => {
  const composition = compositions.get(editor);
  const history = cmsHistory.get(editor);
  if (composition === undefined || history === undefined) {
    return true;
  }
  const editorState = editor.getEditorState();
  // invariant: what was remembered still describes this history (15.1)
  if (
    history.undoStack.length < composition.index ||
    (composition.index > 0 &&
      history.undoStack[composition.index - 1] !== composition.below)
  ) {
    compositions.delete(editor);
    return true;
  }
  const before = d7Document(composition.before);
  // a cancelled composition: both stacks exactly as before it
  if (d7Document(editorState) === before) {
    compositions.delete(editor);
    history.undoStack.length = composition.index;
    history.redoStack.length = 0;
    history.redoStack.push(...composition.redo);
    announce(editor, history);
    return true;
  }
  if (composition.phase === "ended") {
    // the leftover's commit was not this one: the next edit is the person's
    return false;
  }
  if (endText === "") {
    // ended with no text: the commit that takes out its leftover decides
    composition.phase = "ended";
  } else {
    compositions.delete(editor);
  }
  // a written composition: exactly one step of its own, holding the state
  // before it, the person's selection included; the composing states the
  // history plugin pushed while it ran (a half-composed text, the
  // composition-start character) are no steps
  history.undoStack.length = composition.index;
  history.undoStack.push({ editor, editorState: composition.before });
  history.redoStack.length = 0;
  announce(editor, history);
  return composition.phase !== "ended";
};

/**
 * 16.19: removes, in an update of its own right after the commit that ends
 * a composition, the composition-start characters the composition left
 * beyond the count the document held before it, from the composed node
 * only, nearest the caret first (a character the value held before stays).
 * The caret is corrected. Exact by count: it depends on no dirty node, on
 * no commit of the start being seen, and on no place of the character.
 */
const $removeStartChars = (
  editor: LexicalEditor,
  composedKey: NodeKey | null,
  count: number
) => {
  const selection = $getSelection();
  const caret =
    $isRangeSelection(selection) && selection.anchor.type === "text"
      ? selection.anchor
      : null;
  const keys = [caret?.key ?? null, composedKey].filter(
    (key, index, all): key is NodeKey =>
      key !== null && all.indexOf(key) === index
  );
  let left = count;
  for (const key of keys) {
    const node = $getNodeByKey(key);
    if (
      left === 0 ||
      $isTextNode(node) === false ||
      node.isAttached() === false
    ) {
      continue;
    }
    let text = node.getTextContent();
    const from = caret?.key === key ? caret.offset : text.length;
    const removed: number[] = [];
    // nearest the caret first, before it, then after it
    const order = [
      ...Array.from({ length: from }, (_, index) => from - 1 - index),
      ...Array.from({ length: text.length - from }, (_, index) => from + index),
    ];
    for (const index of order) {
      if (left === 0) {
        break;
      }
      if (startCharsOf(editor).includes(text[index])) {
        removed.push(index);
        left -= 1;
      }
    }
    if (removed.length === 0) {
      continue;
    }
    removed.sort((a, b) => b - a);
    for (const index of removed) {
      text = text.slice(0, index) + text.slice(index + 1);
    }
    node.setTextContent(text);
    if ($isRangeSelection(selection)) {
      for (const point of [selection.anchor, selection.focus]) {
        if (point.type === "text" && point.key === key) {
          const shift = removed.filter((index) => index < point.offset).length;
          point.set(key, point.offset - shift, "text");
        }
      }
    }
  }
  return count - left;
};

/**
 * T55.1: the history plugin's own merge of a commit whose only dirty leaf is
 * a text node left unchanged (`@lexical/history` 0.21, `isTextNodeUnchanged`):
 * the same parent and the same JSON in both states. The time-based merges
 * (letters typed, characters deleted, one after another) leave a changed
 * leaf and stay merged.
 */
const onlyLeafUnchanged = (
  dirtyLeaves: Set<NodeKey>,
  prevEditorState: EditorState,
  editorState: EditorState
) => {
  if (dirtyLeaves.size !== 1) {
    return false;
  }
  const [key] = dirtyLeaves;
  const prev = prevEditorState._nodeMap.get(key);
  const next = editorState._nodeMap.get(key);
  return (
    $isTextNode(prev) &&
    $isTextNode(next) &&
    prev.__parent === next.__parent &&
    JSON.stringify(prevEditorState.read(() => prev.exportJSON())) ===
      JSON.stringify(editorState.read(() => next.exportJSON()))
  );
};

/**
 * F12 (K): a composition that changes the document is its own undo step,
 * decided at the composition's own end from state (check 3, 14.5, ruling
 * 4): no update at its start, no tag, no timer. Registers, per editor, the
 * `compositionend` listener on the root (the text the composition ended
 * with: none is a cancel), the clear of the history voiding what was
 * remembered (16.2), and the two update listeners: the composition's
 * bookkeeping and `startCharRemovalListener`.
 */
export const registerCompositionStep = (editor: LexicalEditor) => {
  // T55.1, the mirror of 16.10's second contract: an edit outside a
  // composition that changes the document under D7 is an undo step of its
  // own even where the history plugin merged it into the entry before (its
  // only dirty leaf a text node left unchanged, while element nodes moved:
  // a link joined into the quote before, P26-1); the entry the history held
  // after the previous commit is pushed, and the redo stack emptied
  // (invariant: one undo restores the document before every such edit).
  // `before` and `lengthBefore` are the history as it stood after the
  // previous commit, every listener of it done (`refreshBefore`, registered
  // last); the history plugin's own listener runs before this one
  // (CmsHistoryPlugin mounts before the field's TransformsPlugin)
  let before: HistoryEntry | null = null;
  let lengthBefore = 0;
  const refreshBefore = () => {
    const history = cmsHistory.get(editor);
    before = history?.current ?? null;
    lengthBefore = history?.undoStack.length ?? 0;
  };
  const onEnd = (event: CompositionEvent) => {
    compositionEndText.set(editor, event.data ?? "");
    // the voided composition ends here
    compositionVoided.delete(editor);
  };
  // the person's key or input that belongs to no composition: a voided
  // composition is over, and a cancel's wait for its leftover ends (an
  // edit after it is the person's own, never the cancel's: its undo step
  // stays, and no earlier step is cut)
  const onPersonInput = (event: KeyboardEvent | InputEvent) => {
    if (
      event.isComposing ||
      (event instanceof KeyboardEvent && event.keyCode === 229) ||
      (event instanceof InputEvent &&
        event.inputType.includes("Composition")) ||
      editor.isComposing()
    ) {
      return;
    }
    compositionVoided.delete(editor);
    if (compositions.get(editor)?.phase === "ended") {
      compositions.delete(editor);
    }
  };
  // 16.2: a cleared history voids what was remembered (Lexical's own clear
  // empties both stacks; this runs before the history plugin's handler)
  const voidOnClear = () => {
    before = null;
    if (compositions.has(editor)) {
      compositions.delete(editor);
      if (editor.isComposing()) {
        compositionVoided.set(editor, "voided");
      }
    }
    return false;
  };
  // 16.19: at the commit where the editor stops composing, the
  // composition-start characters it left are removed, by count, from the
  // composed node, in an update of their own; the composition's bookkeeping
  // pops the composing state that update makes a step of
  const startCharRemovalListener = ({
    editorState,
  }: {
    editorState: EditorState;
  }) => {
    const composition = compositions.get(editor);
    if (
      composition === undefined ||
      composition.phase === "armed" ||
      composition.phase === "removing" ||
      editor.isComposing()
    ) {
      return;
    }
    const left = startCharsLeft(editor, editorState);
    if (left === 0) {
      return;
    }
    composition.phase = "removing";
    editor.update(() => {
      // none found where the composition wrote: the composition settles
      // at the next commit, with what it left (the watch reports it)
      if ($removeStartChars(editor, composition.composedKey, left) === 0) {
        composition.phase = "composing";
        composition.unremovable = true;
      }
    });
  };
  // 16.10, second contract (T33.4, T37.3): an edit outside a composition
  // that leaves the document unchanged under D7 makes no undo step: the
  // step the history plugin pushed for it is taken back, and the redo stack
  // its push emptied is put back (invariant: every undo step changes the
  // document)
  let redoBefore: HistoryEntry[] = [];
  const unchangedEditListener = ({
    editorState,
    prevEditorState,
    tags,
  }: {
    editorState: EditorState;
    prevEditorState: EditorState;
    tags: Set<string>;
  }) => {
    const history = cmsHistory.get(editor);
    if (history === undefined) {
      return;
    }
    if (
      tags.has("historic") === false &&
      editor.isComposing() === false &&
      compositions.has(editor) === false &&
      history.undoStack.at(-1)?.editorState === prevEditorState &&
      d7Document(prevEditorState) === d7Document(editorState)
    ) {
      history.undoStack.pop();
      history.redoStack.length = 0;
      history.redoStack.push(...redoBefore);
      announce(editor, history);
    }
    redoBefore = [...history.redoStack];
  };
  const mergedEditListener = ({
    editorState,
    prevEditorState,
    tags,
    dirtyLeaves,
  }: {
    editorState: EditorState;
    prevEditorState: EditorState;
    tags: Set<string>;
    dirtyLeaves: Set<NodeKey>;
  }) => {
    const history = cmsHistory.get(editor);
    if (history === undefined) {
      return;
    }
    if (
      tags.has("historic") === false &&
      tags.has("history-merge") === false &&
      editor.isComposing() === false &&
      compositions.has(editor) === false &&
      before !== null &&
      history.undoStack.length === lengthBefore &&
      history.current?.editorState === editorState &&
      onlyLeafUnchanged(dirtyLeaves, prevEditorState, editorState) &&
      d7Document(prevEditorState) !== d7Document(editorState)
    ) {
      history.undoStack.push(before);
      history.redoStack.length = 0;
      announce(editor, history);
    }
    refreshBefore();
  };
  return mergeRegister(
    () => {
      compositions.delete(editor);
      startCharOf.delete(editor);
      compositionVoided.delete(editor);
      compositionEndText.delete(editor);
    },
    editor.registerRootListener((root, previous) => {
      previous?.removeEventListener("compositionend", onEnd, true);
      previous?.removeEventListener("keydown", onPersonInput, true);
      previous?.removeEventListener("beforeinput", onPersonInput, true);
      root?.addEventListener("compositionend", onEnd, true);
      root?.addEventListener("keydown", onPersonInput, true);
      root?.addEventListener("beforeinput", onPersonInput, true);
    }),
    editor.registerCommand(
      CLEAR_HISTORY_COMMAND,
      voidOnClear,
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand(
      CLEAR_EDITOR_COMMAND,
      voidOnClear,
      COMMAND_PRIORITY_LOW
    ),
    editor.registerUpdateListener(mergedEditListener),
    editor.registerUpdateListener(unchangedEditListener),
    editor.registerUpdateListener(
      ({ editorState, prevEditorState, tags, dirtyElements, dirtyLeaves }) => {
        const history = cmsHistory.get(editor);
        if (history === undefined) {
          return;
        }
        let composition = compositions.get(editor);
        const composing = editor.isComposing();
        // an undo or a redo during the composition voids it (15.1)
        if (tags.has("historic")) {
          if (composition !== undefined) {
            compositions.delete(editor);
            if (composition.phase !== "ended") {
              compositionVoided.set(editor, "voided");
            }
          }
          return;
        }
        if (composing) {
          // the voided composition runs on (an undo can end the page's
          // composition, and the input method starts it again)
          if (compositionVoided.get(editor) === "voided") {
            compositionVoided.set(editor, "resumed");
          }
          if (compositionVoided.has(editor)) {
            // a start remembered again while it runs on is void too
            compositions.delete(editor);
            return;
          }
          if (composition === undefined || composition.phase === "ended") {
            // no compositionstart seen: the last commit before composing,
            // whose step the history may already have taken
            const length = history.undoStack.length;
            const pushedHere =
              history.undoStack.at(-1)?.editorState === prevEditorState;
            const index = pushedHere ? length - 1 : length;
            compositionEndText.delete(editor);
            composition = {
              phase: "composing",
              before: prevEditorState,
              index,
              below: index > 0 ? history.undoStack[index - 1] : undefined,
              redo: [...history.redoStack],
              held: heldIn(prevEditorState),
              composedKey: null,
              unremovable: false,
            };
            compositions.set(editor, composition);
          }
          composition.phase = "composing";
          composition.composedKey = editorState.read(() => {
            const selection = $getSelection();
            return $isRangeSelection(selection) &&
              selection.anchor.type === "text"
              ? selection.anchor.key
              : composition!.composedKey;
          });
          return;
        }
        if (composition === undefined) {
          // the voided composition's own end
          if (compositionVoided.get(editor) === "resumed") {
            compositionVoided.delete(editor);
          }
          return;
        }
        if (composition.phase === "armed") {
          // a start that never composed: remembered again from this commit,
          // unless the composition ended in it (its start's commit unseen)
          if (compositionEndText.has(editor) === false) {
            rememberCompositionStart(editor);
            return;
          }
          composition.phase = "composing";
        }
        if (composition.phase === "removing") {
          // the removal's commit: the composing state it replaced, which held
          // the character, is no step of its own
          if (history.undoStack.at(-1)?.editorState === prevEditorState) {
            history.undoStack.pop();
          }
          composition.phase = "composing";
        } else if (startCharsLeft(editor, editorState) > 0) {
          // startCharRemovalListener removes them in the next update
          return;
        }
        if (
          composition.phase === "ended" &&
          dirtyElements.size === 0 &&
          dirtyLeaves.size === 0
        ) {
          // a commit that changes no node is not the leftover's
          return;
        }
        if (composition.phase === "ended") {
          if (settleCompositionEnd(editor, "") === false) {
            compositions.delete(editor);
          }
          return;
        }
        settleCompositionEnd(editor, compositionEndText.get(editor) ?? "x");
      }
    ),
    editor.registerUpdateListener(startCharRemovalListener),
    editor.registerUpdateListener(refreshBefore)
  );
};

/**
 * T95.6: the history's composition state ends with a keydown that belongs
 * to no composition, as Lexical's key (T43.1) and the page's state (T83.2)
 * do. Runs after the clear of Lexical's key has committed, so a
 * composition that clear settles is settled first (F12).
 */
const endHistoryComposition = (editor: LexicalEditor) => {
  compositions.delete(editor);
};

/**
 * T43.1: a keydown that belongs to no composition (`isComposing` false, no
 * key code 229, a key other than "Process" and "Unidentified") while the
 * editor still composes: the browser has ended the composition without
 * telling the editor (a cancel that fired no `compositionend`), so the
 * editor's composition state is cleared, in an update of its own, before
 * any other handler of the key, and the key acts. A capture listener on the
 * root registered before every other keydown listener of the field (the
 * field calls this first), so the line rules' steps before a key and
 * Lexical's own keydown handler (on the root, bubbling) see the editor no
 * longer composing.
 */
export const registerCompositionEndOnKey = (editor: LexicalEditor) => {
  const onKeyDown = (event: KeyboardEvent) => {
    if (
      event.isComposing ||
      event.keyCode === 229 ||
      event.key === "Process" ||
      event.key === "Unidentified"
    ) {
      return;
    }
    // T83: the page's composing state, with Lexical's key or with none,
    // ends with it
    endPageComposition(editor);
    if (editor.isComposing() === false) {
      endHistoryComposition(editor);
      return;
    }
    // the clear's commit writes Lexical's selection to the page: the page's
    // own selection, a step not yet read back (15.12), is put back after it
    const root = editor.getRootElement();
    const dom = window.getSelection();
    const page =
      dom !== null &&
      root !== null &&
      dom.anchorNode !== null &&
      dom.focusNode !== null &&
      root.contains(dom.anchorNode) &&
      root.contains(dom.focusNode)
        ? ([
            dom.anchorNode,
            dom.anchorOffset,
            dom.focusNode,
            dom.focusOffset,
          ] as const)
        : null;
    editor.update(() => $setCompositionKey(null), { discrete: true });
    endHistoryComposition(editor);
    if (
      page !== null &&
      dom !== null &&
      page[0].isConnected &&
      page[2].isConnected &&
      (dom.anchorNode !== page[0] ||
        dom.anchorOffset !== page[1] ||
        dom.focusNode !== page[2] ||
        dom.focusOffset !== page[3])
    ) {
      dom.setBaseAndExtent(...page);
    }
  };
  return mergeRegister(
    // T83: the page's composition, seen before every other listener of the
    // field
    registerPageComposition(editor),
    editor.registerRootListener((root, previous) => {
      previous?.removeEventListener("keydown", onKeyDown, true);
      root?.addEventListener("keydown", onKeyDown, true);
    })
  );
};

/** Lexical's history, held where the line rules can reach it (K). */
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
