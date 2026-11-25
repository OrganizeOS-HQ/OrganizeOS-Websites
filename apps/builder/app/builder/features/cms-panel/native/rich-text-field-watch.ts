// The field's development check: the harness invariant every browser test
// and probe record is held to, per mounted editor.
import { $getRoot, type EditorState, type LexicalEditor } from "lexical";
import { d7Document, unkeptEmptyLines } from "./rich-text-line-points";

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
  /** Removes the watch's update listener. */
  unregister: () => void;
};

const startChars = (state: EditorState) =>
  state.read(() => $getRoot().getTextContent().split("\u200b").length - 1);

/** The fields mounted now; each leaves the set at its unmount. */
const watched = new Set<Watched>();

/** The most failures kept from fields that have unmounted. */
const KEPT_FAILURES_BOUND = 100;

/** The failures of fields that have unmounted, up to the bound, in order. */
const kept: string[] = [];

const keep = (failures: string[]) => {
  for (const failure of failures) {
    if (kept.length >= KEPT_FAILURES_BOUND) {
      return;
    }
    kept.push(failure);
  }
};

/**
 * The harness invariant for one field: a field that reported a value last
 * reported the editor's HTML export as it stands; one that reported none
 * holds its document as mounted, under D7.
 */
const failuresOf = (entry: Watched) => {
  const failures: string[] = [];
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
  return failures;
};

/**
 * Watches a mounted field: its document under D7 right after mount, once
 * the updates the mount queued have committed, and each value it reports.
 * `changed` takes each value the field reports; `unwatch`, called at the
 * field's unmount, evaluates its invariant, keeps any failures and drops it.
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
    unregister: () => {},
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
  entry.unregister = editor.registerUpdateListener(
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
  return {
    changed: (value: FieldValue) => {
      entry.changes += 1;
      entry.last = value;
    },
    unwatch: () => {
      if (watched.has(entry)) {
        keep(failuresOf(entry));
        watched.delete(entry);
      }
      entry.unregister();
    },
  };
};

/**
 * The harness invariant's failures: those kept from fields that have
 * unmounted, then those of the fields mounted now. When `clear` is set,
 * every failure is reported once: the kept ones are emptied, and each field
 * mounted now is watched on from the state it holds now.
 */
export const fieldInvariantFailures = (clear: boolean) => {
  const failures = [...kept];
  for (const entry of watched) {
    failures.push(...failuresOf(entry));
  }
  if (clear) {
    kept.length = 0;
    // a field mounted now stays watched from the state it holds now, so a
    // failure already reported is not reported again and a later one is
    for (const entry of watched) {
      entry.changes = 0;
      entry.last = undefined;
      entry.mounted = d7Document(entry.editor.getEditorState());
      entry.startCharsLeft = [];
    }
  }
  return failures;
};
