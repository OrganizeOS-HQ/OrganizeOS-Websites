// SPIKE: the named writes of the third record-set check (prototype round
// 14), one assertion each, with real input.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { describe, expect, test, vi } from "vitest";
import { cdp, userEvent } from "@vitest/browser/context";
import { CAN_REDO_COMMAND, CAN_UNDO_COMMAND, COMMAND_PRIORITY_CRITICAL, type LexicalEditor } from "lexical";
import { TooltipProvider } from "@webstudio-is/design-system";
import { RichTextField } from "./rich-text-field";
import { clickInWord, editorOf, lastHtml, renderField, settle } from "./rich-text-test-harness";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";

const LI = (x: string) => `<ul><li>Pw</li><li>${x}</li><li>Nw</li></ul>`;
const stored = (html: string) => sanitizeRichTextHtml(html);
const written = (onChange: Parameters<typeof lastHtml>[0]) =>
  sanitizeRichTextHtml(lastHtml(onChange));
const keys = async (input: string) => {
  await userEvent.keyboard(input);
  await settle();
};
const IMG = `<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />`;

describe("14.6: D3's first case, an empty block that joins goes whole with no break", () => {
  const EMPTY: [string, string][] = [
    ["heading", "<h3></h3>"],
    ["quote", "<blockquote></blockquote>"],
    ["quote of an empty paragraph", "<blockquote><p></p></blockquote>"],
    ["code block", "<pre><code></code></pre>"],
  ];
  test.each(EMPTY)("an empty %s, Delete at T0w's end", async (_name, block) => {
    const onChange = await renderField(LI(`T0w${block}T2w`));
    await clickInWord("T0w");
    await keys("{Delete}");
    expect(written(onChange)).toBe(stored(LI("T0wT2w")));
  });
  test.each(EMPTY)("an empty %s, the range form: Shift+ArrowRight from T0w's end, Backspace", async (_name, block) => {
    const onChange = await renderField(LI(`T0w${block}T2w`));
    await clickInWord("T0w");
    await keys("{Shift>}{ArrowRight}{/Shift}{Backspace}");
    expect(written(onChange)).toBe(stored(LI("T0wT2w")));
  });
  test.each(EMPTY)("an empty %s, the range form, then a letter", async (_name, block) => {
    const onChange = await renderField(LI(`T0w${block}T2w`));
    await clickInWord("T0w");
    await keys("{Shift>}{ArrowRight}{/Shift}k");
    expect(written(onChange)).toBe(stored(LI("T0wkT2w")));
  });
  test("a heading of only an image: the image stands in the line, which keeps its break (D3's third case)", async () => {
    const onChange = await renderField(LI(`T0w<h3>${IMG}</h3>T2w`));
    await clickInWord("T0w");
    await keys("{Delete}");
    expect(written(onChange)).toBe(stored(LI(`T0w${IMG}<br />T2w`)));
  });
  test("a quote of only an image, the range form", async () => {
    const onChange = await renderField(LI(`T0w<blockquote><p>${IMG}</p></blockquote>T2w`));
    await clickInWord("T0w");
    await keys("{Shift>}{ArrowRight}{/Shift}{Backspace}");
    expect(written(onChange)).toBe(stored(LI(`T0w${IMG}<br />T2w`)));
  });
  test("Backspace at T2w's start after an empty heading: D3's second case", async () => {
    const onChange = await renderField(LI("T0w<h3></h3>T2w"));
    await clickInWord("T2w", 0);
    await keys("{Backspace}");
    expect(written(onChange)).toBe(stored(LI("T0w<h3>T2w</h3>")));
  });
});

const quiet = () => new Promise((resolve) => setTimeout(resolve, 150));
const session = () => cdp() as unknown as { send: (method: string, params: object) => Promise<unknown> };
const imeSet = async (text: string) => {
  await session().send("Input.imeSetComposition", {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });
  await settle();
};
const imeCommit = async (text: string) => {
  await session().send("Input.insertText", { text });
  await settle();
};
/**
 * A composition at quiet timing: it starts more than 30 ms after the last
 * keydown (Lexical's zero-width heuristic stays off at a plain caret).
 */
const compose = async (wrote: boolean) => {
  let lastKeyDown = 0;
  let started = 0;
  const onKeyDown = (event: KeyboardEvent) => {
    lastKeyDown = event.timeStamp;
  };
  const onStart = (event: CompositionEvent) => {
    started = event.timeStamp;
  };
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("compositionstart", onStart, true);
  await quiet();
  await imeSet("a");
  if (wrote) {
    await imeSet("ab");
    await imeCommit("ab");
  } else {
    await imeSet("");
    await imeCommit("");
  }
  document.removeEventListener("keydown", onKeyDown, true);
  document.removeEventListener("compositionstart", onStart, true);
  expect(started).toBeGreaterThan(0);
  expect(started - lastKeyDown).toBeGreaterThan(30);
  await quiet();
};
/** Whether the editor can undo and redo, as its history reports it. */
const historyOf = (editor: LexicalEditor) => {
  const state = { canUndo: false, canRedo: false };
  editor.registerCommand(
    CAN_UNDO_COMMAND,
    (payload) => {
      state.canUndo = payload;
      return false;
    },
    COMMAND_PRIORITY_CRITICAL
  );
  editor.registerCommand(
    CAN_REDO_COMMAND,
    (payload) => {
      state.canRedo = payload;
      return false;
    },
    COMMAND_PRIORITY_CRITICAL
  );
  return state;
};
/**
 * Presses undo (or redo) until there is nothing left to undo (or redo); the
 * value after each press. Every press fires onChange with a changed value.
 */
const pressAll = async (
  onChange: Parameters<typeof lastHtml>[0],
  history: { canUndo: boolean; canRedo: boolean },
  direction: "undo" | "redo"
) => {
  const values: string[] = [];
  for (let press = 0; press < 8; press += 1) {
    if (direction === "undo" ? history.canUndo === false : history.canRedo === false) {
      break;
    }
    const before = written(onChange);
    const calls = onChange.mock.calls.length;
    await userEvent.keyboard(direction === "undo" ? "{Control>}z{/Control}" : "{Control>}{Shift>}z{/Shift}{/Control}");
    await settle();
    for (const [value] of onChange.mock.calls.slice(calls)) {
      expect(sanitizeRichTextHtml((value as { html: string }).html), `${direction} ${press + 1}`).not.toBe(before);
    }
    values.push(written(onChange));
  }
  return values;
};

const TQT = LI("T0w<blockquote><p>Q1w</p></blockquote>T2w");
const T = (x: string) => stored(LI(`T0w<blockquote><p>Q1w</p></blockquote>${x}`));
const STARTS = {
  plain: async () => {},
  range: () => keys("{Shift>}{ArrowLeft}{/Shift}"),
  bold: () => keys("{Control>}b{/Control}"),
  element: () => keys("{Enter}"),
};
const BOLD = (x: string) => `<b><strong>${x}</strong></b>`;
const ITEM = (x: string) => `${x}</li><li>`;
/** The head's undo and redo values per cell, plus F12's step at a plain caret that wrote text. */
const CELLS: [keyof typeof STARTS, boolean, string[], string[]][] = [
  ["plain", true, [T("T2wx"), T("T2w")], [T("T2wx"), T("T2wxab")]],
  ["plain", false, [T("T2w")], [T("T2wx")]],
  ["range", true, [T("T2wx"), T("T2w")], [T("T2wx"), T("T2wab")]],
  ["range", false, [T("T2wx"), T("T2w")], [T("T2wx"), T("T2w")]],
  ["bold", true, [T("T2wx"), T("T2w")], [T("T2wx"), T(`T2wx${BOLD("ab")}`)]],
  ["bold", false, [T(`T2wx${BOLD("a")}`), T("T2wx"), T("T2w")], [T("T2wx"), T(`T2wx${BOLD("a")}`), T("T2wx")]],
  [
    "element",
    true,
    [T(`${ITEM("T2wx")}`), T("T2wx"), T("T2w")],
    [T("T2wx"), T(ITEM("T2wx")), T(`${ITEM("T2wx")}ab`)],
  ],
  [
    "element",
    false,
    [T(`${ITEM("T2wx")}a`), T(ITEM("T2wx")), T("T2wx"), T("T2w")],
    [T("T2wx"), T(ITEM("T2wx")), T(`${ITEM("T2wx")}a`), T(ITEM("T2wx"))],
  ],
];

/** A second field on the page, mounted after the first; returns its unmount. */
const mountSecondField = (html: string) => {
  const container = document.createElement("div");
  container.style.width = "480px";
  document.body.appendChild(container);
  const root = createRoot(container);
  const onChange = vi.fn();
  act(() => {
    root.render(
      createElement(
        TooltipProvider,
        null,
        createElement(RichTextField, {
          id: "cms-field-second",
          labelId: "cms-field-second-label",
          value: { html },
          onChange,
          onOpenClassic: vi.fn(),
        })
      )
    );
  });
  const clickWord = async (word: string) => {
    const span = [...container.querySelectorAll<HTMLElement>("[data-lexical-text]")].find(
      (element) => element.textContent === word
    )!;
    const box = span.getBoundingClientRect();
    await userEvent.click(span, { position: { x: box.width - 1, y: box.height / 2 } } as never);
    await settle();
  };
  const editor = () =>
    (container.querySelector('[contenteditable="true"]') as
      | (HTMLElement & { __lexicalEditor?: LexicalEditor })
      | null)?.__lexicalEditor;
  return {
    onChange,
    editor,
    clickWord,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

const runCell = async (
  start: keyof typeof STARTS,
  wrote: boolean,
  undoValues: string[],
  redoValues: string[],
  spy: boolean
) => {
  if (spy) {
    vi.spyOn(console, "error").mockImplementation(() => {});
  }
  const onChange = await renderField(TQT);
  const history = historyOf(editorOf()!);
  await clickInWord("T2w");
  await keys("x");
  await quiet();
  await STARTS[start]();
  await compose(wrote);
  expect(await pressAll(onChange, history, "undo")).toEqual(undoValues);
  expect(written(onChange)).toBe(T("T2w"));
  expect(await pressAll(onChange, history, "redo")).toEqual(redoValues);
};

describe("14.5 K: a composition's undo steps at quiet timing", () => {
  for (const spy of [false, true]) {
    test.each(CELLS)(`%s, wrote text %s${spy ? ", console.error spied" : ""}`, async (start, wrote, undoValues, redoValues) => {
      await runCell(start, wrote, undoValues, redoValues, spy);
    });
  }
  for (const spy of [false, true]) {
    test(`undo, then an empty composition, then redo: the letter comes back${spy ? ", console.error spied" : ""}`, async () => {
      if (spy) {
        vi.spyOn(console, "error").mockImplementation(() => {});
      }
      const onChange = await renderField(TQT);
      const history = historyOf(editorOf()!);
      await clickInWord("T2w");
      await keys("x");
      await quiet();
      await keys("{Control>}z{/Control}");
      expect(written(onChange)).toBe(T("T2w"));
      await compose(false);
      expect(written(onChange)).toBe(T("T2w"));
      expect(await pressAll(onChange, history, "redo")).toEqual([T("T2wx")]);
    });
  }
  test.each(CELLS.slice(0, 2))("two fields: %s, wrote text %s, composing in the second after typing in the first", async (_start, wrote, undoValues, redoValues) => {
    const first = await renderField(LI("F1w"));
    const second = mountSecondField(TQT);
    try {
      await settle();
      const history = historyOf(second.editor()!);
      await clickInWord("F1w");
      await keys("y");
      await quiet();
      await second.clickWord("T2w");
      await keys("x");
      await quiet();
      await compose(wrote);
      const values = await pressAll(second.onChange, history, "undo");
      expect(values).toEqual(undoValues);
      expect(await pressAll(second.onChange, history, "redo")).toEqual(redoValues);
      expect(written(first)).toBe(stored(LI("F1wy")));
    } finally {
      second.unmount();
    }
  });
});
