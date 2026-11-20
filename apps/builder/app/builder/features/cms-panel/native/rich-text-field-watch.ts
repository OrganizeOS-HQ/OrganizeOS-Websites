// The field's development checks: a tagged update that changes no node, and
// the harness invariant every browser test and probe record is held to.
import type { LexicalEditor } from "lexical";
import { d7Document } from "./rich-text-line-node";

export type FieldValue = { html: string; text: string } | null;

type Watched = {
  editor: LexicalEditor;
  valueOf: () => FieldValue;
  mounted: string | undefined;
  changes: number;
  last: FieldValue | undefined;
};

const watched = new Set<Watched>();

/** Every commit that carried tags and changed no node, in order. */
export const taggedNoChange: string[] = [];

/**
 * A tag reaches only its own update. Lexical keeps the tags of a commit that
 * changes no node for the next update, so such a commit is reported.
 */
export const registerTagCheck = (editor: LexicalEditor) =>
  editor.registerUpdateListener(({ tags, dirtyElements, dirtyLeaves, editorState, prevEditorState }) => {
    // a state set whole (undo, redo) marks no node dirty but changes the
    // document, and Lexical resets its tags
    if (
      tags.size > 0 &&
      dirtyElements.size === 0 &&
      dirtyLeaves.size === 0 &&
      JSON.stringify(editorState.toJSON()) === JSON.stringify(prevEditorState.toJSON())
    ) {
      const message = `cms tags: a tagged update changed no node [${[...tags].join(",")}]`;
      taggedNoChange.push(message);
      console.error(message);
    }
  });

/**
 * Watches a mounted field: its document under D7 right after mount, once
 * the updates the mount queued have committed, and each value it reports.
 */
export const watchField = (editor: LexicalEditor, valueOf: () => FieldValue) => {
  const entry: Watched = { editor, valueOf, mounted: undefined, changes: 0, last: undefined };
  watched.add(entry);
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
    if (entry.changes > 0) {
      const now = JSON.stringify(entry.valueOf()?.html ?? null);
      if (JSON.stringify(entry.last?.html ?? null) !== now) {
        failures.push(`field invariant: last onChange ${JSON.stringify(entry.last)} is not the editor's export ${now}`);
      }
    } else if (entry.mounted !== undefined) {
      const now = d7Document(entry.editor.getEditorState());
      if (now !== entry.mounted) {
        failures.push(`field invariant: no onChange, but the document changed since mount: ${entry.mounted} -> ${now}`);
      }
    }
  }
  if (clear) {
    watched.clear();
  }
  return failures;
};
