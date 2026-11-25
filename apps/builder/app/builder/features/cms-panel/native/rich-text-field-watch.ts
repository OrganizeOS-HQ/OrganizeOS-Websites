// The field's development checks: a tagged update that changes no node, and
// the harness invariant every browser test and probe record is held to.
import { $getRoot, type EditorState, type LexicalEditor } from "lexical";
import { d7Document, unkeptEmptyLines } from "./rich-text-line-node";

export type FieldValue = { html: string; text: string } | null;

type Watched = {
  editor: LexicalEditor;
  valueOf: () => FieldValue;
  mounted: string | undefined;
  changes: number;
  last: FieldValue | undefined;
  /**
   * R1: the composition-start characters (U+200B, Chrome's) the document
   * held before the composition under way began; undefined while none is.
   */
  startCharsBefore: number | undefined;
  /** The characters each ended composition left beyond its start's count. */
  startCharsLeft: number[];
  unwatch: () => void;
};

const startChars = (state: EditorState) =>
  state.read(() => $getRoot().getTextContent().split("\u200b").length - 1);

const watched = new Set<Watched>();

/** Every commit that carried tags and changed no node, in order. */
export const taggedNoChange: string[] = [];

/**
 * A tag reaches only its own update. Lexical keeps the tag set of a commit
 * that changes no node (it resets the set only when a node is dirty) and
 * hands the same set to the next update, so a set that comes back to the
 * listener on the next commit came from a tagged update that changed no
 * node; it is reported with the tags it carried. Not reported:
 * - Lexical's own tags that nothing reads, by name. "focus" (editor.focus):
 *   neither Lexical 0.21 nor the field reads it.
 * - "historic" on the commit just before an undo or redo: setEditorState
 *   adds its tag to the set of the update pending when it runs and commits
 *   that update first; the tag is the undo's own.
 */
const UNREAD_LEXICAL_TAGS = new Set(["focus"]);

export const registerTagCheck = (editor: LexicalEditor) => {
  let previous:
    | { tags: Set<string>; names: string[]; nested: boolean }
    | undefined;
  return editor.registerUpdateListener(({ tags }) => {
    // Lexical's commit of a changed node selection dispatches
    // SELECTION_CHANGE_COMMAND before its listeners run, and that update runs
    // at once, adding its tags to the set of the commit under way; the set
    // is that update's own when it commits next, and is not reported. Dev
    // check only: it reads whether an update is pending
    const nested = previous?.nested === true;
    const leaked =
      nested === false && previous !== undefined && previous.tags === tags
        ? previous.names.filter(
            (name) =>
              UNREAD_LEXICAL_TAGS.has(name) === false &&
              (name === "historic" && tags.has("historic")) === false
          )
        : [];
    if (leaked.length > 0) {
      const message = `cms tags: a tagged update changed no node [${leaked.join(",")}]`;
      taggedNoChange.push(message);
      console.error(message);
    }
    previous = {
      tags,
      names: [...tags],
      nested:
        (editor as unknown as { _pendingEditorState: unknown })
          ._pendingEditorState !== null,
    };
  });
};

/**
 * Watches a mounted field: its document under D7 right after mount, once
 * the updates the mount queued have committed, and each value it reports.
 */
export const watchField = (
  editor: LexicalEditor,
  valueOf: () => FieldValue
) => {
  const entry: Watched = {
    editor,
    valueOf,
    mounted: undefined,
    changes: 0,
    last: undefined,
    startCharsBefore: undefined,
    startCharsLeft: [],
    unwatch: () => {},
  };
  watched.add(entry);
  // the composition-start count is taken around a composition, never
  // against the mount: before its start (the last commit before composing),
  // and after its end (the commit in which the editor stops composing), so
  // a character an edit brings, a paste's or a drop's, is never counted
  let composing = editor.isComposing();
  if (composing) {
    entry.startCharsBefore = startChars(editor.getEditorState());
  }
  entry.unwatch = editor.registerUpdateListener(
    ({ editorState, prevEditorState }) => {
      const now = editor.isComposing();
      if (composing === false && now) {
        entry.startCharsBefore = startChars(prevEditorState);
      } else if (composing && now === false) {
        const left =
          startChars(editorState) - (entry.startCharsBefore ?? Infinity);
        if (left > 0) {
          entry.startCharsLeft.push(left);
        }
        entry.startCharsBefore = undefined;
      }
      composing = now;
    }
  );
  queueMicrotask(() => {
    entry.mounted = d7Document(editor.getEditorState());
  });
  return (value: FieldValue) => {
    entry.changes += 1;
    entry.last = value;
  };
};

/**
 * The harness invariant: a field that reported a value last reported the
 * editor's HTML export as it stands; one that reported none holds its document
 * as mounted, under D7. Empties the watch when `clear` is set.
 */
export const fieldInvariantFailures = (clear: boolean) => {
  const failures: string[] = [];
  for (const entry of watched) {
    // 15.13 (a): after a key or an edit no empty line stands that does not
    // hold the caret; only a press keeps one
    const left = unkeptEmptyLines(entry.editor);
    if (left > 0) {
      failures.push(
        `field invariant: ${left} empty line(s) that hold no caret and no press kept`
      );
    }
    // R1: no composition leaves a composition-start character the document
    // did not hold before it began
    for (const left of entry.startCharsLeft) {
      failures.push(
        `field invariant: ${left} composition-start character(s) a composition left that the document did not hold before it`
      );
    }
    if (entry.changes > 0) {
      const now = JSON.stringify(entry.valueOf()?.html ?? null);
      if (JSON.stringify(entry.last?.html ?? null) !== now) {
        failures.push(
          `field invariant: last onChange ${JSON.stringify(entry.last)} is not the editor's export ${now}`
        );
      }
      // the "no value" decision (neither text nor an image) as it stands
      if ((entry.last === null) !== (entry.valueOf() === null)) {
        failures.push(
          `field invariant: the last onChange's no-value decision (${entry.last === null}) is not the editor's`
        );
      }
    } else if (entry.mounted !== undefined) {
      const now = d7Document(entry.editor.getEditorState());
      if (now !== entry.mounted) {
        failures.push(
          `field invariant: no onChange, but the document changed since mount: ${entry.mounted} -> ${now}`
        );
      }
    }
  }
  if (clear) {
    for (const entry of watched) {
      entry.unwatch();
    }
    watched.clear();
  }
  return failures;
};
