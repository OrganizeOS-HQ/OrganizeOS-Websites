// SPIKE: no tag outlives its update (prototype round 14). Each site's
// correction or no-op, then a real edit: one onChange with the new value and
// one undo step of its own.
import { act } from "react-dom/test-utils";
import { describe, expect, test } from "vitest";
import { cdp, userEvent } from "@vitest/browser/context";
import { $createRangeSelection, $getRoot, $getSelection, $isElementNode, $isRangeSelection, $setSelection, DELETE_CHARACTER_COMMAND, type LexicalNode } from "lexical";
import { clickInWord, editable, editorOf, lastHtml, renderField, settle, undo } from "./rich-text-test-harness";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import { cmsHistory, lineSpike } from "./rich-text-line-node";
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

describe("the selection-change handler", () => {
  test("a node selection that moves makes a caret line, and no commit fires an onChange", async () => {
    // Lexical's commit of the moved node selection runs the handler's update
    // inside itself (R13 D)
    const html = "<ul><li>Pw</li><li><br /><hr /></li><li>Nw</li></ul>";
    const onChange = await renderField(html);
    await clickInWord("Nw", 0);
    const before = onChange.mock.calls.length;
    const lines = () => nodes().filter((node) => node.getType() === "cms-line").length;
    const linesBefore = editorOf()!.getEditorState().read(lines);
    let most = linesBefore;
    const off = editorOf()!.registerUpdateListener(({ editorState }) => {
      most = Math.max(most, editorState.read(lines));
    });
    await keys("{ArrowLeft}{ArrowLeft}");
    off();
    expect(most).toBeGreaterThan(linesBefore);
    expect(onChange.mock.calls.length).toBe(before);
    await keys("k");
    expect(onChange.mock.calls.length).toBe(before + 1);
    expect(written(onChange)).toBe(stored("<ul><li>Pw</li><li><br /><hr />k</li><li>Nw</li></ul>"));
  });
});

describe("marks end with the task that ran their update", () => {
  // two updates run in one task share their marks, as Lexical batches them
  // into one commit: a removal that removes nothing, then a letter, in one
  // task, write what the two write in two tasks
  const html = `<ul><li>Pw</li><li><h3>X0w${IMG}</h3></li></ul>`;
  const run = async (oneTask: boolean) => {
    const onChange = await renderField(html);
    await userEvent.click(editable()!.querySelector("img")!);
    await settle();
    await keys("{Escape}");
    const removal = () => editorOf()!.dispatchCommand(DELETE_CHARACTER_COMMAND, false);
    const letter = () =>
      editorOf()!.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.insertText("k");
      });
    if (oneTask) {
      await act(async () => {
        removal();
        letter();
      });
    } else {
      await act(async () => {
        removal();
      });
      await settle();
      await act(async () => {
        letter();
      });
    }
    await settle();
    return written(onChange);
  };
  test("a no-op removal and a letter in two tasks", async () => {
    expect(await run(false)).toBe(stored(`<ul><li>Pw</li><li><h3>X0w${IMG}k</h3></li></ul>`));
  });
  test("a no-op removal and a letter in one task", async () => {
    expect(await run(true)).toBe(stored(`<ul><li>Pw</li><li><h3>X0w${IMG}k</h3></li></ul>`));
  });
});

describe("undo into a state whose point rests on a lined container", () => {
  // the third place corrects such a point at once, and the page's selection
  // moves a kept state's point into text, so the history holds one only as
  // given here: the state an edit committed, before any correction, as the
  // step under the last edit
  test("then a letter: one onChange, and an undo step of its own", async () => {
    const html = "<ul><li>Pw</li><li>T0w<hr /></li><li>Nw</li></ul>";
    const onChange = await renderField(html);
    taggedNoChange.splice(0);
    await clickInWord("Pw");
    let kept: ReturnType<NonNullable<ReturnType<typeof editorOf>>["getEditorState"]> | undefined;
    lineSpike.thirdPlaceOff = true;
    try {
      await act(async () => {
        editorOf()!.update(
          () => {
            const text = nodes().find((node) => node.getType() === "text" && node.getTextContent() === "Pw")!;
            (text as unknown as { setTextContent: (value: string) => void }).setTextContent("Pwx");
            // between the item's line and its rule
            const item = nodes().filter((node) => node.getType() === "listitem")[1];
            const range = $createRangeSelection();
            range.anchor.set(item.getKey(), 1, "element");
            range.focus.set(item.getKey(), 1, "element");
            $setSelection(range);
          },
          { discrete: true }
        );
        kept = editorOf()!.getEditorState();
      });
    } finally {
      lineSpike.thirdPlaceOff = false;
    }
    expect(
      kept!.read(() => {
        const selection = $getSelection();
        return $isRangeSelection(selection) ? selection.anchor.getNode().getType() : "";
      })
    ).toBe("listitem");
    await settle();
    await clickInWord("Nw");
    await keys("k");
    // the step under the last edit is the state the edit committed
    const history = cmsHistory.get(editorOf()!)!;
    history.undoStack[history.undoStack.length - 1] = { editor: editorOf()!, editorState: kept! };
    await undo();
    expect(written(onChange)).toBe(stored("<ul><li>Pwx</li><li>T0w<hr /></li><li>Nw</li></ul>"));
    const before = onChange.mock.calls.length;
    const steps = undoSteps();
    await keys("m");
    expect(onChange.mock.calls.length - before).toBe(1);
    expect(undoSteps()).toBe(steps + 1);
    expect(written(onChange)).toBe(stored("<ul><li>Pwx</li><li>T0wm<hr /></li><li>Nw</li></ul>"));
    await undo();
    expect(written(onChange)).toBe(stored("<ul><li>Pwx</li><li>T0w<hr /></li><li>Nw</li></ul>"));
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
