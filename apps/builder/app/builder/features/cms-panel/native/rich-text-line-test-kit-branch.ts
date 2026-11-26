// The kit's helpers that read the field's own modules, so they run only on
// the branch, never in a fork-main worktree: the forced failures a test
// installs from its own side, and the net.
import { afterEach } from "vitest";
import {
  $createRangeSelection,
  $getRoot,
  $isElementNode,
  $isTextNode,
  createEditor,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
} from "lexical";
import { fieldInvariantFailures } from "./rich-text-field-watch";
import { historyStateOf } from "./rich-text-line-history";
import { editorOf } from "./rich-text-test-harness";

type Restore = () => void;
const installed = new Set<Restore>();

const editorPrototype = Object.getPrototypeOf(createEditor()) as {
  update: LexicalEditor["update"];
  registerUpdateListener: LexicalEditor["registerUpdateListener"];
};

const rangeSelectionPrototype = (() => {
  let prototype: { removeText: RangeSelection["removeText"] } | undefined;
  createEditor().update(
    () => {
      prototype = Object.getPrototypeOf($createRangeSelection());
    },
    { discrete: true }
  );
  return prototype!;
})();

const $findText = (text: string) => {
  const walk = (node: LexicalNode): LexicalNode | undefined => {
    if ($isTextNode(node) && node.getTextContent() === text) {
      return node;
    }
    if ($isElementNode(node)) {
      for (const child of node.getChildren()) {
        const found = walk(child);
        if (found !== undefined) {
          return found;
        }
      }
    }
    return undefined;
  };
  return walk($getRoot());
};

/** Holds the update listener named `name`: skipped while installed. */
const holdUpdateListener = (name: string): Restore => {
  const original = editorPrototype.registerUpdateListener;
  let active = true;
  editorPrototype.registerUpdateListener = function (
    this: LexicalEditor,
    listener
  ) {
    if (listener.name !== name) {
      return original.call(this, listener);
    }
    return original.call(this, (payload) => {
      if (active === false) {
        listener(payload);
      }
    });
  };
  return () => {
    active = false;
    editorPrototype.registerUpdateListener = original;
  };
};

const install: Record<
  | "scratch-write"
  | "cut-removal-differs"
  | "check-after-commit-off"
  | "start-char-kept",
  () => Restore
> = {
  // the scratch editor the clipboard writer makes has no root element; a
  // mounted field always has one
  "scratch-write": () => {
    const original = editorPrototype.update;
    editorPrototype.update = function (this: LexicalEditor, ...args) {
      if (this.getRootElement() === null) {
        throw new Error("forced failure: scratch-write");
      }
      return original.apply(this, args);
    };
    return () => {
      editorPrototype.update = original;
    };
  },
  // during a cut, the removal also changes the text Zw, which lies outside
  // the cut's range, in the same update
  "cut-removal-differs": () => {
    const original = rangeSelectionPrototype.removeText;
    rangeSelectionPrototype.removeText = function (this: RangeSelection) {
      original.call(this);
      if (window.event?.type === "cut") {
        const text = $findText("Zw");
        if ($isTextNode(text)) {
          text.setTextContent("Zwx");
        }
      }
    };
    return () => {
      rangeSelectionPrototype.removeText = original;
    };
  },
  // the check after a commit (Task 12 names its listener so)
  "check-after-commit-off": () => holdUpdateListener("pointCheckListener"),
  // the removal of the composition-start character (Task 20 names its
  // listener so): a composition leaves the character where Lexical put it
  "start-char-kept": () => holdUpdateListener("startCharRemovalListener"),
};

/**
 * Installs a failure from the test's side and returns its restore; every
 * failure still installed is restored after the test.
 */
export const forcedFailure = (kind: keyof typeof install) => {
  const undo = install[kind]();
  const restore = () => {
    if (installed.delete(restore)) {
      undo();
    }
  };
  installed.add(restore);
  return restore;
};

/** The lengths of the undo and redo stacks of a field's history (the harness's by default). */
export const undoDepth = (
  editor: LexicalEditor = editorOf()!
): { undo: number; redo: number } => {
  const state = historyStateOf(editor);
  return { undo: state.undoStack.length, redo: state.redoStack.length };
};

/** The harness invariant's failures for the test that just ran. */
export const net = () => fieldInvariantFailures(true);

afterEach(() => {
  for (const restore of [...installed].reverse()) {
    restore();
  }
});
