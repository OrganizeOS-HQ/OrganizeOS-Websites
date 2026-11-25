// The point check after a commit (5.3's third place), per editor: what its
// resolving update tags, an undo into a state whose point rests on a lined
// container, two fields side by side, its development assertion, and the
// watch module's state per editor (16.24).
import { describe, expect, test, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { $findMatchingParent } from "@lexical/utils";
import {
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  createEditor,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type TextNode,
} from "lexical";
import {
  $wherePoint,
  at,
  caretKey,
  imageNode,
  IMG,
  itemPoint,
  keys,
  letter,
  LI,
  mount,
  mountExtraField,
  short,
} from "./rich-text-line-test-kit";
import { forcedFailure, undoDepth } from "./rich-text-line-test-kit-branch";
import {
  editorOf,
  lastHtml,
  settle,
  unmountField,
} from "./rich-text-test-harness";
import { richTextNodes } from "./rich-text-html";
import { $isCmsLineNode } from "./rich-text-line-node";
import { registerPointCheck } from "./rich-text-line-points";
import * as watch from "./rich-text-field-watch";
import watchSource from "./rich-text-field-watch.ts?raw";

const QUOTE1 = "<blockquote><p>Q1w</p></blockquote>";

const $items = () => {
  const items: ElementNode[] = [];
  const walk = (node: LexicalNode) => {
    if ($isElementNode(node)) {
      if (node.getType() === "listitem") {
        items.push(node);
      }
      node.getChildren().forEach(walk);
    }
  };
  walk($getRoot());
  return items;
};

const $text = (word: string) =>
  $getRoot()
    .getAllTextNodes()
    .find((text) => text.getTextContent() === word) as TextNode;

/** A collapsed element point at baseline `offset` on the `item`-th item. */
const $pointOn = (item: number, offset: number) => {
  const { key, offset: where } = $wherePoint($items()[item], offset);
  const selection = $getRoot().selectStart();
  selection.anchor.set(key, where, "element");
  selection.focus.set(key, where, "element");
};

/** The committed anchor's node type, or "in cms-line" inside a line. */
const anchorOf = (editor: LexicalEditor = editorOf()!) =>
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection) === false) {
      return "none";
    }
    const node = selection.anchor.getNode();
    return $findMatchingParent(node, $isCmsLineNode) !== null
      ? "in cms-line"
      : node.getType();
  });

/** Every update the mounted editor commits from now on, with its tags. */
const recordUpdates = () => {
  const updates: string[][] = [];
  const off = editorOf()!.registerUpdateListener(({ tags }) => {
    updates.push([...tags].sort());
  });
  return { updates, off };
};

/** The console errors from now on, but React's act warnings (as the kit). */
const consoleErrors = () => {
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    const text = args.map(String).join(" ");
    if (text.includes("not wrapped in act") === false) {
      errors.push(text);
    }
  });
  return errors;
};

describe("the resolving update's tags", () => {
  test("a point set in an update that dirties nothing is resolved once", async () => {
    const onChange = await mount(LI("T0w<hr>"));
    await at("Pw")();
    const { updates, off } = recordUpdates();
    await act(async () => {
      editorOf()!.update(() => $pointOn(1, 2));
    });
    await settle();
    off();
    // the update that set the point, then the check's own: it made a caret
    // line, so it is merged into the current step (T12.6: no "historic")
    expect(updates).toHaveLength(2);
    expect(updates[1]).toContain("history-merge");
    expect(updates[1]).not.toContain("historic");
    expect(anchorOf()).toBe("in cms-line");
    const calls = onChange.mock.calls.length;
    const steps = undoDepth().undo;
    await letter();
    expect(onChange.mock.calls.length - calls).toBe(1);
    expect(undoDepth().undo).toBe(steps + 1);
  });

  test("a resolving update that only moves a point carries no tag", async () => {
    const onChange = await mount(LI(`T0w${QUOTE1}`));
    await at("Pw")();
    const { updates, off } = recordUpdates();
    await act(async () => {
      editorOf()!.update(() => $pointOn(1, 1));
    });
    await settle();
    off();
    expect(updates).toHaveLength(2);
    expect(updates[1]).toEqual([]);
    const calls = onChange.mock.calls.length;
    const steps = undoDepth().undo;
    await letter();
    expect(onChange.mock.calls.length - calls).toBe(1);
    expect(short(lastHtml(onChange))).toBe(
      short(`<ul><li>Pw</li><li>T0wk${QUOTE1}</li><li>Nw</li></ul>`)
    );
    expect(undoDepth().undo).toBe(steps + 1);
  });
});

describe("undo into a state whose point rests on a lined container", () => {
  test("undo into a state whose point rests on a lined container, then a letter", async () => {
    // T15.6: the check after a commit is off while the state is made
    const checkOn = forcedFailure("check-after-commit-off");
    const onChange = await mount(LI("T0w<hr>"));
    await at("Pw")();
    const editor = editorOf()!;
    let anchor = "";
    let steps = 0;
    await act(async () => {
      // the text of another item than the middle one, so the middle item's
      // container transform does not run and resolve the point
      editor.update(
        () => {
          $text("Pw").setTextContent("Pwx");
          $pointOn(1, 1);
        },
        { discrete: true }
      );
      anchor = editor.getEditorState().read(() => {
        const selection = $getSelection();
        return $isRangeSelection(selection)
          ? selection.anchor.getNode().getType()
          : "none";
      });
      steps = undoDepth().undo;
      // T16.1: changes a node and no selection, so the state above is pushed
      editor.update(() => $text("Nw").setTextContent("Nwy"), {
        discrete: true,
      });
    });
    expect(anchor).toBe("listitem");
    expect(undoDepth().undo).toBe(steps + 1);
    await settle();
    checkOn();
    await keys("{Control>}z{/Control}")();
    expect(short(lastHtml(onChange))).toBe(
      short("<ul><li>Pwx</li><li>T0w<hr /></li><li>Nw</li></ul>")
    );
    const calls = onChange.mock.calls.length;
    const after = undoDepth().undo;
    await letter();
    expect(onChange.mock.calls.length - calls).toBe(1);
    expect(short(lastHtml(onChange))).toBe(
      short("<ul><li>Pwx</li><li>T0wk<hr /></li><li>Nw</li></ul>")
    );
    expect(undoDepth().undo).toBe(after + 1);
  });
});

describe("the watch module (16.24)", () => {
  test("the watch module is per editor and bounded", async () => {
    const editors: LexicalEditor[] = [];
    await mount("<p>Aw</p>");
    editors.push(editorOf()!);
    const b = await mountExtraField("<p>Bw</p>");
    const c = await mountExtraField("<p>Cw</p>");
    editors.push(b.editor, c.editor);
    expect(watch.fieldInvariantFailures(false)).toEqual([]);
    c.unmount();
    b.unmount();
    await mount("<p>Dw</p>");
    const d = editorOf()!;
    // the last of the three goes; a fourth stays mounted for the harness
    editors.push(d);
    await act(async () => {
      for (const editor of editors.slice(0, 3)) {
        // unwatched: the document changes with no onChange, unseen
        editor.update(
          () => {
            const text = $getRoot().getAllTextNodes()[0];
            if ($isTextNode(text)) {
              text.setTextContent(`${text.getTextContent()}x`);
            }
          },
          { discrete: true }
        );
      }
    });
    expect(watch.fieldInvariantFailures(false)).toEqual([]);

    // bounded: editors that unmount with a failure each, more than the bound
    const unwatches = Array.from({ length: 150 }, () => {
      const editor = createEditor({ nodes: richTextNodes, onError: () => {} });
      const { changed, unwatch } = watch.watchField(editor, () => ({
        html: "<p>now</p>",
        text: "now",
      }));
      changed({ html: "<p>then</p>", text: "then" });
      return unwatch;
    });
    for (const unwatch of unwatches) {
      unwatch();
    }
    const kept = watch.fieldInvariantFailures(true);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThanOrEqual(100);
    expect(watch.fieldInvariantFailures(true)).toEqual([]);

    // one update listener per watched editor, and no tag listener (T14.5)
    const editor = createEditor({ nodes: richTextNodes, onError: () => {} });
    const register = vi.spyOn(editor, "registerUpdateListener");
    const { unwatch } = watch.watchField(editor, () => null);
    expect(register).toHaveBeenCalledTimes(1);
    unwatch();
    expect(Object.keys(watch).sort()).toEqual([
      "fieldInvariantFailures",
      "watchField",
    ]);
    expect(watchSource).not.toMatch(/_pending|\._/);
  });

  test("an editor's invariant is evaluated at its unmount", async () => {
    const onChange = await mount("<p>Aw</p>");
    await at("Aw")();
    await letter();
    const last = lastHtml(onChange);
    const editor = editorOf()!;
    await act(async () => {
      editor.update(
        () => {
          $text("Awk").setTextContent("Awkx");
        },
        { tag: "history-merge" }
      );
    });
    await settle();
    unmountField();
    const failures = watch.fieldInvariantFailures(true);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(JSON.stringify(last));
    expect(watch.fieldInvariantFailures(true)).toEqual([]);
  });
});

describe("two fields", () => {
  test("two fields keep separate point checks", async () => {
    const errors = consoleErrors();
    const onChange = await mount(LI("T0w<hr>"));
    const b = await mountExtraField(LI("T0w<hr>"));
    await itemPoint(1, 2)();
    await itemPoint(1, 2, { in: b.element })();
    expect(anchorOf(editorOf()!)).toBe("in cms-line");
    expect(anchorOf(b.editor)).toBe("in cms-line");
    expect(onChange).not.toHaveBeenCalled();
    expect(b.onChange).not.toHaveBeenCalled();
    expect(errors).toEqual([]);
  });

  test("two fields keep separate image arrows", async () => {
    const errors = consoleErrors();
    const onChange = await mount(`<p>Aw${IMG}Zw</p>`);
    await at("Zw", 0)();
    await keys("{ArrowLeft}")();
    expect(caretKey()).toBe("node:cms-image");
    const b = await mountExtraField(`<p>Bw${IMG}</p>`);
    await imageNode({ in: b.element })();
    await act(async () => {
      editorOf()!.focus();
      // editor.focus() with a node selection writes no page range, so the
      // page's focus stays in B; the letter must reach A
      editorOf()!.getRootElement()!.focus();
    });
    await settle();
    expect(caretKey(editorOf()!)).toBe("node:cms-image");
    await letter();
    // M47: A's own last arrow decided the side
    expect(short(lastHtml(onChange))).toBe("<p>Awk<img />Zw</p>");
    expect(b.onChange).not.toHaveBeenCalled();
    expect(errors).toEqual([]);
  });
});

describe("the development assertion", () => {
  test("the point rule's listener reports a line holding a block", () => {
    const editor = createEditor({ nodes: richTextNodes, onError: () => {} });
    const off = registerPointCheck(editor);
    const errors = consoleErrors();
    const element = (type: string, children: unknown[], extra = {}) => ({
      type,
      children,
      direction: null,
      format: "",
      indent: 0,
      version: 1,
      ...extra,
    });
    const json = {
      root: element("root", [
        element(
          "list",
          [
            element(
              "listitem",
              [
                element("cms-line", [
                  {
                    type: "text",
                    text: "Aw",
                    detail: 0,
                    format: 0,
                    mode: "normal",
                    style: "",
                    version: 1,
                  },
                  { type: "horizontalrule", version: 1 },
                ]),
              ],
              { value: 1 }
            ),
          ],
          { listType: "bullet", start: 1, tag: "ul" }
        ),
      ]),
    };
    editor.setEditorState(editor.parseEditorState(JSON.stringify(json)));
    off();
    expect(
      errors.some((message) =>
        message.startsWith("cms-line rule: a line holds a block")
      )
    ).toBe(true);
  });
});
