// SPIKE: no tag outlives its update (prototype round 14). Each site's
// correction or no-op, then a real edit: one onChange with the new value and
// one undo step of its own.
import { act } from "react-dom/test-utils";
import { describe, expect, test } from "vitest";
import { cdp, userEvent } from "@vitest/browser/context";
import { $createRangeSelection, $getRoot, $isElementNode, $setSelection, type LexicalNode } from "lexical";
import { clickInWord, editable, editorOf, lastHtml, renderField, settle, undo } from "./rich-text-test-harness";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import { cmsHistory } from "./rich-text-line-node";
import { fieldInvariantFailures, taggedNoChange } from "./rich-text-field-watch";

const IMG = `<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />`;
const LINK = `<a href="https://example.org/l">Lw</a>`;
const stored = (html: string) => sanitizeRichTextHtml(html);
const written = (onChange: Parameters<typeof lastHtml>[0]) => sanitizeRichTextHtml(lastHtml(onChange));
const keys = async (input: string) => {
  await userEvent.keyboard(input);
  await settle();
};
const undoSteps = () => cmsHistory.get(editorOf()!)?.undoStack.length ?? -1;
const session = () => cdp() as unknown as { send: (method: string, params: object) => Promise<unknown> };
const quiet = () => new Promise((resolve) => setTimeout(resolve, 150));

/**
 * After `correction`, the edit `edit` gives one onChange with `expected` (a
 * composition reports each of its updates: `composing`) and one undo step,
 * whose undo restores `html`; no commit kept its tags.
 */
const holds = async (
  html: string,
  correction: () => Promise<void>,
  edit: () => Promise<void>,
  expected: string,
  composing = false
) => {
  const onChange = await renderField(html);
  taggedNoChange.splice(0);
  await correction();
  const before = onChange.mock.calls.length;
  const steps = undoSteps();
  await edit();
  if (composing) {
    expect(onChange.mock.calls.length - before).toBeGreaterThan(0);
  } else {
    expect(onChange.mock.calls.length - before).toBe(1);
  }
  expect(written(onChange)).toBe(stored(expected));
  expect(undoSteps()).toBe(steps + 1);
  await undo();
  expect(written(onChange)).toBe(stored(html));
  expect(taggedNoChange.splice(0)).toEqual([]);
};

const nodes = (): LexicalNode[] => {
  const out: LexicalNode[] = [];
  const walk = (node: LexicalNode) => {
    out.push(node);
    if ($isElementNode(node)) node.getChildren().forEach(walk);
  };
  walk($getRoot());
  return out;
};

describe("no tag outlives its update", () => {
  test("the point rule moves a point off a lined container, then a letter", async () => {
    const html = "<ul><li>Pw</li><li>T9w<h3>X0w</h3><hr /></li><li>Nw</li></ul>";
    await holds(
      html,
      async () => {
        await clickInWord("X0w");
        await act(async () => {
          editorOf()!.update(() => {
            const item = nodes().filter((node) => node.getType() === "listitem")[1];
            const range = $createRangeSelection();
            range.anchor.set(item.getKey(), 2, "element");
            range.focus.set(item.getKey(), 2, "element");
            $setSelection(range);
          });
        });
        await settle();
      },
      async () => {
        await clickInWord("Pw");
        await keys("k");
      },
      "<ul><li>Pwk</li><li>T9w<h3>X0w</h3><hr /></li><li>Nw</li></ul>"
    );
  });
  test("an arrow steps off a node-selected rule, then a letter", async () => {
    const html = "<ul><li>xq<hr />yq</li></ul>";
    await holds(
      html,
      async () => {
        await clickInWord("xq");
        await keys("{ArrowRight}");
        await keys("{ArrowRight}");
      },
      async () => {
        await keys("k");
      },
      "<ul><li>xq<hr />kyq</li></ul>"
    );
  });
  test("a Delete at the content's end after an image removes nothing, then a letter", async () => {
    const html = `<ul><li>Pw</li><li><h3>X0w${IMG}</h3></li></ul>`;
    await holds(
      html,
      async () => {
        await userEvent.click(editable()!.querySelector("img")!);
        await settle();
        await keys("{Escape}");
        await keys("{Delete}");
      },
      async () => {
        await keys("k");
      },
      `<ul><li>Pw</li><li><h3>X0w${IMG}k</h3></li></ul>`
    );
  });
  test("a composition at the start of a link-led line", async () => {
    const html = `<ul><li>${LINK}<blockquote><p>Q1w</p></blockquote></li></ul>`;
    await holds(
      html,
      async () => {
        await clickInWord("Lw", 0);
        await quiet();
      },
      async () => {
        await session().send("Input.imeSetComposition", { text: "ab", selectionStart: 2, selectionEnd: 2 });
        await settle();
        await session().send("Input.insertText", { text: "ab" });
        await settle();
        await quiet();
      },
      `<ul><li>ab${LINK}<blockquote><p>Q1w</p></blockquote></li></ul>`,
      true
    );
  });
  test("a typing run, a point the point rule corrects, then a letter: the letter is its own step, the run one step", async () => {
    const html = "<ul><li>Pw</li><li>T0w<hr /></li><li>Nw</li></ul>";
    const onChange = await renderField(html);
    taggedNoChange.splice(0);
    let corrected = 0;
    const off = editorOf()!.registerUpdateListener(({ prevEditorState }) => {
      const on = prevEditorState.read(() => {
        const selection = prevEditorState._selection as unknown as {
          anchor?: { type: string; getNode: () => LexicalNode };
        } | null;
        return selection?.anchor?.type === "element" ? selection.anchor.getNode().getType() : "";
      });
      if (on === "listitem") {
        corrected += 1;
      }
    });
    await clickInWord("Pw");
    await keys("abc");
    // a point on the item between its line and its rule, as code sets one
    // (no click lands there: the field's click rule resolves a click's point
    // first); the correction only moves it, to the line's end
    await act(async () => {
      editorOf()!.update(() => {
        const item = nodes().filter((node) => node.getType() === "listitem")[1];
        const range = $createRangeSelection();
        range.anchor.set(item.getKey(), 1, "element");
        range.focus.set(item.getKey(), 1, "element");
        $setSelection(range);
      });
    });
    await settle();
    await keys("k");
    off();
    expect(corrected).toBeGreaterThan(0);
    expect(written(onChange)).toBe(stored("<ul><li>Pwabc</li><li>T0wk<hr /></li><li>Nw</li></ul>"));
    await undo();
    expect(written(onChange)).toBe(stored("<ul><li>Pwabc</li><li>T0w<hr /></li><li>Nw</li></ul>"));
    await undo();
    expect(written(onChange)).toBe(stored(html));
    expect(taggedNoChange.splice(0)).toEqual([]);
  });
});

describe("undo into a state whose point rests on a lined container", () => {
  test("then a letter: one onChange, and an undo step of its own", async () => {
    const html = "<ul><li>Pw</li><li>T0w<hr /></li><li>Nw</li></ul>";
    const onChange = await renderField(html);
    taggedNoChange.splice(0);
    await clickInWord("Pw");
    // an edit that leaves its point on the item, between its line and its rule
    await act(async () => {
      editorOf()!.update(() => {
        const text = nodes().find((node) => node.getTextContent() === "Pw" && node.getType() === "text")!;
        (text as unknown as { setTextContent: (value: string) => void }).setTextContent("Pwx");
        const item = nodes().filter((node) => node.getType() === "listitem")[1];
        const range = $createRangeSelection();
        range.anchor.set(item.getKey(), 1, "element");
        range.focus.set(item.getKey(), 1, "element");
        $setSelection(range);
      });
    });
    await settle();
    await clickInWord("Nw");
    await keys("k");
    await undo();
    expect(written(onChange)).toBe(stored("<ul><li>Pwx</li><li>T0w<hr /></li><li>Nw</li></ul>"));
    const before = onChange.mock.calls.length;
    const steps = undoSteps();
    await keys("m");
    expect(onChange.mock.calls.length - before).toBe(1);
    expect(undoSteps()).toBe(steps + 1);
    const typed = written(onChange);
    await undo();
    expect(written(onChange)).toBe(stored("<ul><li>Pwx</li><li>T0w<hr /></li><li>Nw</li></ul>"));
    expect(typed).toContain("m");
    expect(taggedNoChange.splice(0)).toEqual([]);
  });
});

describe("the no-value decision does not read empty lines", () => {
  // empty caret lines add only new lines to the text, which the decision trims
  test("a list item that comes to hold only a rule, the caret on its empty line", async () => {
    const onChange = await renderField("<ul><li>Aw<hr /></li></ul>");
    await clickInWord("Aw");
    await keys("{Backspace}{Backspace}");
    expect(onChange.mock.lastCall?.[0]).toBe(null);
    expect(fieldInvariantFailures(false)).toEqual([]);
  });
  test("a list item that comes to hold only a rule, the caret then off its empty line", async () => {
    const onChange = await renderField("<ul><li>Aw<hr /></li></ul><p>Bw</p>");
    await clickInWord("Aw");
    await keys("{Backspace}{Backspace}");
    await clickInWord("Bw");
    await keys("{Backspace}{Backspace}");
    expect(onChange.mock.lastCall?.[0]).toBe(null);
    expect(fieldInvariantFailures(false)).toEqual([]);
  });
});
