// Spec section 12: the Lexical 0.21.0 behaviours the line rules lean on
// that need a page (a DOM selection, real input, the React plugins), each
// pinned in a fresh editor so an upgrade that changes one fails here first.
// The history's two run here: @lexical/history reaches the builder only
// through @lexical/react's history plugin.
import { afterEach, describe, expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "@vitest/browser/context";
import {
  $createNodeSelection,
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $selectAll,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  createEditor,
  type DOMExportOutput,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type SerializedElementNode,
  type TextNode,
  UNDO_COMMAND,
} from "lexical";
import { $generateHtmlFromNodes } from "@lexical/html";
import {
  $createListItemNode,
  $createListNode,
  ListItemNode,
} from "@lexical/list";
import { $createQuoteNode, registerRichText } from "@lexical/rich-text";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { $createHorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { richTextNodes } from "./rich-text-html";
import { CmsLineNode } from "./rich-text-line-node";

const onError = (error: Error) => {
  throw error;
};

const write = (editor: LexicalEditor, fn: () => void, tag?: string) =>
  editor.update(fn, { discrete: true, ...(tag === undefined ? {} : { tag }) });

/** Two animation frames: the page's selectionchange has been handled. */
const frames = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    cleanup();
  }
});

/** The plain editor on a contentEditable root, with Lexical's rich text. */
const plainEditor = () => {
  const root = document.createElement("div");
  root.contentEditable = "true";
  document.body.appendChild(root);
  const editor = createEditor({ nodes: richTextNodes, onError });
  editor.setRootElement(root);
  const unregister = registerRichText(editor);
  cleanups.push(() => {
    unregister();
    editor.setRootElement(null);
    root.remove();
  });
  return { editor, root };
};

/** A composer with `children` as its plugins; resolves to its editor. */
const composer = async (children: React.ReactNode) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | undefined;
  let editor: LexicalEditor | undefined;
  const Capture = () => {
    [editor] = useLexicalComposerContext();
    return null;
  };
  await act(async () => {
    root = createRoot(container);
    root.render(
      <LexicalComposer
        initialConfig={{ namespace: "t", nodes: richTextNodes, onError }}
      >
        <Capture />
        {children}
      </LexicalComposer>
    );
  });
  cleanups.push(() => {
    act(() => root?.unmount());
    container.remove();
  });
  return editor!;
};

/** A list of one item per entry, each item's children made by `make`. */
const $list = (...items: Array<() => LexicalNode[]>) => {
  const list = $createListNode("bullet");
  for (const make of items) {
    list.append($createListItemNode().append(...make()));
  }
  $getRoot().clear().append(list);
  return list;
};

/**
 * A line whose export is a real `div[data-cms-line]` (the field's line
 * exports an empty fragment, whose children Lexical splices in either way),
 * so only `excludeFromCopy` keeps the div out of a copy.
 */
class ExportedLineNode extends CmsLineNode {
  static getType() {
    return "test-exported-line";
  }

  static clone(node: ExportedLineNode) {
    return new ExportedLineNode(node.__key);
  }

  static importJSON() {
    return new ExportedLineNode();
  }

  exportJSON(): SerializedElementNode {
    return { ...super.exportJSON(), type: "test-exported-line" };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.setAttribute("data-cms-line", "");
    return { element };
  }

  excludeFromCopy() {
    return true;
  }
}

const text = (editor: LexicalEditor, key: NodeKey) =>
  editor.getEditorState().read(() => $getNodeByKey(key)?.getTextContent());

describe("Lexical 0.21.0 as the line rules read it, on a page (spec section 12)", () => {
  // D6: a copy carries the line's children, never the line
  test("an excluded element's children are promoted in copied HTML", () => {
    const editor = createEditor({
      nodes: [...richTextNodes, ExportedLineNode],
      onError,
    });
    let html = "";
    write(editor, () => {
      $list(
        () => [
          $createQuoteNode().append($createTextNode("Q0w")),
          new ExportedLineNode().append($createTextNode("Aw")),
        ],
        () => [$createTextNode("Bw")]
      );
      $selectAll();
      html = $generateHtmlFromNodes(editor, $getSelection());
    });
    const copied = new DOMParser().parseFromString(html, "text/html");
    expect(copied.querySelector("div[data-cms-line]")).toBe(null);
    expect(copied.querySelector("div")).toBe(null);
    const item = copied.querySelector("li");
    expect(item).not.toBe(null);
    const direct = Array.from(item!.childNodes).filter(
      (child) => child.nodeName !== "BLOCKQUOTE"
    );
    expect(direct.map((child) => child.textContent)).toEqual(["Aw"]);
  });

  // 5.3
  test("selection change is dispatched from the DOM selectionchange handler, at commit only for a selection that is not a range, and inside deleteCharacter", async () => {
    const { editor, root } = plainEditor();
    let textKey = "";
    let ruleKey = "";
    write(editor, () => {
      const rule = $createHorizontalRuleNode();
      const node = $createTextNode("Tw");
      $getRoot().clear().append(rule, $createParagraphNode().append(node));
      ruleKey = rule.getKey();
      textKey = node.getKey();
    });
    await frames();
    const seen: Array<{ inside: boolean }> = [];
    editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        // inside an update that has removed the rule, before its commit
        const attached = () => $getNodeByKey(ruleKey)?.isAttached() === true;
        const committed = editor.getEditorState().read(attached);
        seen.push({ inside: committed && attached() === false });
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );

    // a real click: from the page's selectionchange
    const paragraph = root.querySelector("p")!;
    await userEvent.click(paragraph);
    await frames();
    expect(seen).toHaveLength(1);

    // a range selection set in an update: none at its commit
    seen.length = 0;
    write(editor, () => {
      const range = $createRangeSelection();
      range.anchor.set(textKey, 0, "text");
      range.focus.set(textKey, 0, "text");
      $setSelection(range);
    });
    expect(seen).toHaveLength(0);
    await frames();

    // a node selection set in an update: one at its commit
    seen.length = 0;
    write(editor, () => {
      const selection = $createNodeSelection();
      selection.add(ruleKey);
      $setSelection(selection);
    });
    expect(seen).toHaveLength(1);
    await frames();

    // Backspace at the start of the text after the rule: one, inside the
    // update that deletes
    write(editor, () => {
      const range = $createRangeSelection();
      range.anchor.set(textKey, 0, "text");
      range.focus.set(textKey, 0, "text");
      $setSelection(range);
    });
    await frames();
    seen.length = 0;
    await userEvent.keyboard("{Backspace}");
    await frames();
    expect(seen).toEqual([{ inside: true }]);
  });

  // 5.3
  test("the onChange plugin skips every update tagged history-merge", async () => {
    const changes: EditorState[] = [];
    const editor = await composer(
      <OnChangePlugin
        ignoreHistoryMergeTagChange={true}
        onChange={(editorState) => {
          changes.push(editorState);
        }}
      />
    );
    let key = "";
    write(editor, () => {
      const node = $createTextNode("Aw");
      $getRoot().clear().append($createParagraphNode().append(node));
      key = node.getKey();
    });
    changes.length = 0;
    write(
      editor,
      () => {
        $getNodeByKey<TextNode>(key)?.setTextContent("Awk");
      },
      "history-merge"
    );
    expect(text(editor, key)).toBe("Awk");
    expect(changes).toHaveLength(0);
    write(editor, () => {
      $getNodeByKey<TextNode>(key)?.setTextContent("Awkk");
    });
    expect(changes).toHaveLength(1);
  });

  // section 12 (2): the selection-change handler never changes a node
  // without history-merge
  test("a commit that changed a node selection dispatches SELECTION_CHANGE from inside itself", () => {
    const { editor } = plainEditor();
    let textKey = "";
    let ruleKey = "";
    write(editor, () => {
      const rule = $createHorizontalRuleNode();
      const node = $createTextNode("Tw");
      $getRoot().clear().append($createParagraphNode().append(node), rule);
      ruleKey = rule.getKey();
      textKey = node.getKey();
    });
    let once = true;
    editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        if (once) {
          once = false;
          editor.update(
            () => {
              $getNodeByKey<TextNode>(textKey)?.setTextContent("Twy");
            },
            { tag: "y" }
          );
        }
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
    const updates: Array<{ tags: Set<string>; state: EditorState }> = [];
    editor.registerUpdateListener(({ tags, editorState }) => {
      updates.push({ tags: new Set(tags), state: editorState });
    });
    write(editor, () => {
      const selection = $createNodeSelection();
      selection.add(ruleKey);
      $setSelection(selection);
    });
    // the outer commit: its state holds the node selection and the old text
    const outer = updates.filter(({ state }) =>
      state.read(
        () =>
          $isNodeSelection($getSelection()) &&
          $getNodeByKey(textKey)?.getTextContent() === "Tw"
      )
    );
    expect(outer).toHaveLength(1);
    expect(outer[0].tags.has("y")).toBe(true);
  });

  // D15, the typing listener
  test("Lexical leaves `insertText` over a node selection to the browser", () => {
    const { editor, root } = plainEditor();
    let ruleKey = "";
    let paragraphKey = "";
    write(editor, () => {
      const rule = $createHorizontalRuleNode();
      const paragraph = $createParagraphNode().append($createTextNode("Tw"));
      $getRoot().clear().append(paragraph, rule);
      ruleKey = rule.getKey();
      paragraphKey = paragraph.getKey();
    });
    const typeK = () => {
      const event = new InputEvent("beforeinput", {
        inputType: "insertText",
        data: "k",
        bubbles: true,
        cancelable: true,
      });
      root.dispatchEvent(event);
      return event.defaultPrevented;
    };
    // the control: an element point, which Lexical handles itself
    write(editor, () => {
      const range = $createRangeSelection();
      range.anchor.set(paragraphKey, 0, "element");
      range.focus.set(paragraphKey, 0, "element");
      $setSelection(range);
    });
    expect(typeK()).toBe(true);
    write(editor, () => {
      const selection = $createNodeSelection();
      selection.add(ruleKey);
      $setSelection(selection);
    });
    expect(
      editor.getEditorState().read(() => $isNodeSelection($getSelection()))
    ).toBe(true);
    expect(typeK()).toBe(false);
  });

  // 5.4: redo does not rerun the emptied rule
  test("redo restores a recorded state without running transforms", async () => {
    const editor = await composer(<HistoryPlugin delay={0} />);
    let itemKey = "";
    write(editor, () => {
      itemKey = $list(() => [$createTextNode("Aw")])
        .getFirstChildOrThrow()
        .getKey();
    });
    let runs = 0;
    cleanups.push(
      editor.registerNodeTransform(ListItemNode, () => {
        runs += 1;
      })
    );
    await frames();
    write(editor, () => {
      $getNodeByKey<ListItemNode>(itemKey)?.append($createTextNode("k"));
    });
    expect(runs).toBeGreaterThan(0);
    expect(text(editor, itemKey)).toBe("Awk");
    editor.dispatchCommand(UNDO_COMMAND, undefined);
    await frames();
    expect(text(editor, itemKey)).toBe("Aw");
    const before = runs;
    editor.dispatchCommand(REDO_COMMAND, undefined);
    await frames();
    expect(text(editor, itemKey)).toBe("Awk");
    expect(runs).toBe(before);
  });

  // 5.3
  test("a history-merge update replaces the history's current entry", async () => {
    const editor = await composer(<HistoryPlugin delay={0} />);
    let key = "";
    write(editor, () => {
      const node = $createTextNode("Aw");
      $getRoot().clear().append($createParagraphNode().append(node));
      key = node.getKey();
    });
    write(editor, () => {
      $getNodeByKey<TextNode>(key)?.setTextContent("Awk");
    });
    write(
      editor,
      () => {
        $getNodeByKey<TextNode>(key)?.setTextContent("Awkm");
      },
      "history-merge"
    );
    expect(text(editor, key)).toBe("Awkm");
    editor.dispatchCommand(UNDO_COMMAND, undefined);
    await frames();
    expect(text(editor, key)).toBe("Aw");
  });
});
