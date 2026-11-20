// SPIKE: the named writes of the third record-set check (prototype round
// 14), one assertion each, with real input.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { describe, expect, test, vi } from "vitest";
import { cdp, userEvent } from "@vitest/browser/context";
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $setSelection,
  type ElementNode,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  type LexicalEditor,
} from "lexical";
import { TooltipProvider } from "@webstudio-is/design-system";
import { RichTextField } from "./rich-text-field";
import { byLabel, click, clickInWord, editable, editorOf, lastHtml, paste, renderField, settle } from "./rich-text-test-harness";
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
  test("a heading of only an image, the range form", async () => {
    const onChange = await renderField(LI(`T0w<h3>${IMG}</h3>T2w`));
    await clickInWord("T0w");
    await keys("{Shift>}{ArrowRight}{/Shift}{Backspace}");
    expect(written(onChange)).toBe(stored(LI(`T0w${IMG}<br />T2w`)));
  });
  test("a quote whose first paragraph is empty and whose second holds text, Delete at T0w's end: the empty paragraph goes, as at the head", async () => {
    const onChange = await renderField(LI("T0w<blockquote><p></p><p>Q2w</p></blockquote>T3w"));
    await clickInWord("T0w");
    await keys("{Delete}");
    expect(written(onChange)).toBe(stored(LI("T0w<blockquote><p>Q2w</p></blockquote>T3w")));
  });
  test("head hazard (the head throws and hangs): Backspace at T2w's start after a quote of one empty paragraph", async () => {
    const onChange = await renderField(LI("T0w<blockquote><p></p></blockquote>T2w"));
    await clickInWord("T2w", 0);
    await keys("{Backspace}");
    expect(written(onChange)).toBe(stored(LI("T0w<blockquote><p>T2w</p></blockquote>")));
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
  direction: "undo" | "redo",
  unchangedAllowed: number[] = []
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
      if (unchangedAllowed.includes(press + 1)) {
        continue;
      }
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
  test("a slow composition: a pause of more than 1 s after the first composed character; the head's step for the half-composed text, plus F12's", async () => {
    const onChange = await renderField(TQT);
    const history = historyOf(editorOf()!);
    await clickInWord("T2w");
    await keys("x");
    await quiet();
    await imeSet("a");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await imeSet("ab");
    await imeCommit("ab");
    await quiet();
    expect(await pressAll(onChange, history, "undo")).toEqual([T("T2wxa"), T("T2wx"), T("T2w")]);
    expect(await pressAll(onChange, history, "redo")).toEqual([T("T2wx"), T("T2wxa"), T("T2wxab")]);
  });
  test("undo, then a composition that writes text at a plain caret: nothing to redo, as after a typed letter", async () => {
    const onChange = await renderField(TQT);
    const history = historyOf(editorOf()!);
    await clickInWord("T2w");
    await keys("x");
    await quiet();
    await keys("{Control>}z{/Control}");
    await compose(true);
    expect(written(onChange)).toBe(T("T2wab"));
    expect(history.canRedo).toBe(false);
    expect(await pressAll(onChange, history, "undo")).toEqual([T("T2w")]);
  });
  /** A composition that starts within 30 ms of the letter's keydown (Lexical's zero-width heuristic on). */
  const composeFast = async (wrote: boolean) => {
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
    await userEvent.keyboard("x");
    await session().send("Input.imeSetComposition", { text: "a", selectionStart: 1, selectionEnd: 1 });
    await settle();
    if (wrote) {
      await imeSet("ab");
      await imeCommit("ab");
    } else {
      await imeSet("");
      await imeCommit("");
    }
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("compositionstart", onStart, true);
    expect(started - lastKeyDown).toBeLessThan(30);
    await quiet();
  };
  test("a composition within 30 ms of a key, writing text: the head's steps", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onChange = await renderField(TQT);
    const history = historyOf(editorOf()!);
    await clickInWord("T2w");
    await composeFast(true);
    expect(await pressAll(onChange, history, "undo")).toEqual([T("T2wx"), T("T2w")]);
    expect(await pressAll(onChange, history, "redo")).toEqual([T("T2wx"), T("T2wxab")]);
  });
  test("a composition within 30 ms of a key, cancelled: the head's steps, with the head's own unchanged press", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onChange = await renderField(TQT);
    const history = historyOf(editorOf()!);
    await clickInWord("T2w");
    await composeFast(false);
    expect(await pressAll(onChange, history, "undo", [1])).toEqual([T("T2wx"), T("T2w")]);
    expect(await pressAll(onChange, history, "redo", [2])).toEqual([T("T2wx"), T("T2wx")]);
  });
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

/**
 * 14.3 walks: [shape, direction, stored, start (word, offset), the press whose
 * range first holds a rule, the write of a letter typed there, the presses
 * to the content's edge, the write of a letter typed at the edge]. Each
 * write equals the head's for the same two ends; going right the head's
 * walk has one stop more, on the container point between the block and the
 * rule, which D18 resolves to the block's edge.
 */
const SHIFT_WALKS: [string, "R" | "L", string, [string, number], number, string, number, string][] = [
  ["QR", "R", LI("<blockquote><p>Q0w</p></blockquote><hr>"), ["Pw", 2], 5, "<ul><li>Pwk</li><li>Nw</li></ul>", 7, "<ul><li>Pwkw</li></ul>"],
  ["QR", "L", LI("<blockquote><p>Q0w</p></blockquote><hr>"), ["Nw", 0], 2, "<ul><li>Pw</li><li><blockquote><p>Q0wkNw</p></blockquote></li></ul>", 7, "<ul><li>PkNw</li></ul>"],
  ["QRT", "R", LI("<blockquote><p>Q0w</p></blockquote><hr>T2w"), ["Pw", 2], 5, "<ul><li>PwkT2w</li><li>Nw</li></ul>", 10, "<ul><li>Pwkw</li></ul>"],
  ["QRT", "L", LI("<blockquote><p>Q0w</p></blockquote><hr>T2w"), ["Nw", 0], 5, "<ul><li>Pw</li><li><blockquote><p>Q0wkNw</p></blockquote></li></ul>", 10, "<ul><li>PkNw</li></ul>"],
  ["TQRT", "R", LI("T0w<blockquote><p>Q1w</p></blockquote><hr>T3w"), ["Pw", 2], 9, "<ul><li>PwkT3w</li><li>Nw</li></ul>", 14, "<ul><li>Pwkw</li></ul>"],
  ["TQRT", "L", LI("T0w<blockquote><p>Q1w</p></blockquote><hr>T3w"), ["Nw", 0], 5, "<ul><li>Pw</li><li>T0w<blockquote><p>Q1wkNw</p></blockquote></li></ul>", 14, "<ul><li>PkNw</li></ul>"],
  ["BQR", "R", LI("<br><blockquote><p>Q1w</p></blockquote><hr>"), ["Pw", 2], 6, "<ul><li>Pwk</li><li>Nw</li></ul>", 8, "<ul><li>Pwkw</li></ul>"],
  ["BQR", "L", LI("<br><blockquote><p>Q1w</p></blockquote><hr>"), ["Nw", 0], 2, "<ul><li>Pw</li><li><br /><blockquote><p>Q1wkNw</p></blockquote></li></ul>", 8, "<ul><li>PkNw</li></ul>"],
  ["QQR", "R", LI("<blockquote><p>Q0w</p></blockquote><blockquote><p>Q1w</p></blockquote><hr>"), ["Pw", 2], 9, "<ul><li>Pwk</li><li>Nw</li></ul>", 11, "<ul><li>Pwkw</li></ul>"],
  ["QQR", "L", LI("<blockquote><p>Q0w</p></blockquote><blockquote><p>Q1w</p></blockquote><hr>"), ["Nw", 0], 2, "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><blockquote><p>Q1wkNw</p></blockquote></li></ul>", 11, "<ul><li>PkNw</li></ul>"],
  ["QRB", "R", LI("<blockquote><p>Q0w</p></blockquote><hr><br>"), ["Pw", 2], 5, "<ul><li>Pwk<br /></li><li>Nw</li></ul>", 8, "<ul><li>Pwkw</li></ul>"],
  ["QRB", "L", LI("<blockquote><p>Q0w</p></blockquote><hr><br>"), ["Nw", 0], 3, "<ul><li>Pw</li><li><blockquote><p>Q0wkNw</p></blockquote></li></ul>", 8, "<ul><li>PkNw</li></ul>"],
  ["QRL", "R", LI("<blockquote><p>Q0w</p></blockquote><hr><ul><li>L2w</li></ul>"), ["Pw", 2], 5, "<ul><li>Pwk<ul><li>L2w</li></ul></li><li>Nw</li></ul>", 11, "<ul><li>Pwkw</li></ul>"],
  ["QRL", "L", LI("<blockquote><p>Q0w</p></blockquote><hr><ul><li>L2w</li></ul>"), ["Nw", 0], 6, "<ul><li>Pw</li><li><blockquote><p>Q0wkNw</p></blockquote></li></ul>", 11, "<ul><li>PkNw</li></ul>"],
  ["QRQ", "R", LI("<blockquote><p>Q0w</p></blockquote><hr><blockquote><p>Q2w</p></blockquote>"), ["Pw", 2], 5, "<ul><li>PwkQ2w</li><li>Nw</li></ul>", 10, "<ul><li>Pwkw</li></ul>"],
  ["QRQ", "L", LI("<blockquote><p>Q0w</p></blockquote><hr><blockquote><p>Q2w</p></blockquote>"), ["Nw", 0], 5, "<ul><li>Pw</li><li><blockquote><p>Q0wkNw</p></blockquote></li></ul>", 10, "<ul><li>PkNw</li></ul>"],
  ["QRR", "R", LI("<blockquote><p>Q0w</p></blockquote><hr><hr>"), ["Pw", 2], 5, "<ul><li>Pwk<hr /></li><li>Nw</li></ul>", 8, "<ul><li>Pwkw</li></ul>"],
  ["QRR", "L", LI("<blockquote><p>Q0w</p></blockquote><hr><hr>"), ["Nw", 0], 2, "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />kNw</li></ul>", 8, "<ul><li>PkNw</li></ul>"],
  ["RQR", "R", LI("<hr><blockquote><p>Q1w</p></blockquote><hr>"), ["Pw", 2], 2, "<ul><li>PwkQ1w</li><li><hr /></li><li>Nw</li></ul>", 8, "<ul><li>Pwkw</li></ul>"],
  ["RQR", "L", LI("<hr><blockquote><p>Q1w</p></blockquote><hr>"), ["Nw", 0], 2, "<ul><li>Pw</li><li><hr /><blockquote><p>Q1wkNw</p></blockquote></li></ul>", 8, "<ul><li>PkNw</li></ul>"],
  ["TQR", "R", LI("T0w<blockquote><p>Q1w</p></blockquote><hr>"), ["Pw", 2], 9, "<ul><li>Pwk</li><li>Nw</li></ul>", 11, "<ul><li>Pwkw</li></ul>"],
  ["TQR", "L", LI("T0w<blockquote><p>Q1w</p></blockquote><hr>"), ["Nw", 0], 2, "<ul><li>Pw</li><li>T0w<blockquote><p>Q1wkNw</p></blockquote></li></ul>", 11, "<ul><li>PkNw</li></ul>"],
  ["QRTQ", "R", LI("<blockquote><p>Q0w</p></blockquote><hr>T2w<blockquote><p>Q3w</p></blockquote>"), ["Pw", 2], 5, "<ul><li>PwkT2w<blockquote><p>Q3w</p></blockquote></li><li>Nw</li></ul>", 14, "<ul><li>Pwkw</li></ul>"],
  ["QRTQ", "L", LI("<blockquote><p>Q0w</p></blockquote><hr>T2w<blockquote><p>Q3w</p></blockquote>"), ["Nw", 0], 9, "<ul><li>Pw</li><li><blockquote><p>Q0wkNw</p></blockquote></li></ul>", 14, "<ul><li>PkNw</li></ul>"],
  ["QRd2", "R", "<ul><li>Pw<ul><li>Aw</li><li><blockquote><p>Q0w</p></blockquote><hr></li><li>Zw</li></ul></li><li>Nw</li></ul>", ["Aw", 2], 5, "<ul><li>Pw<ul><li>Awk</li><li>Zw</li></ul></li><li>Nw</li></ul>", 7, "<ul><li>Pw<ul><li>Awkw</li></ul></li><li>Nw</li></ul>"],
  ["QRd2", "L", "<ul><li>Pw<ul><li>Aw</li><li><blockquote><p>Q0w</p></blockquote><hr></li><li>Zw</li></ul></li><li>Nw</li></ul>", ["Zw", 0], 2, "<ul><li>Pw<ul><li>Aw</li><li><blockquote><p>Q0wkZw</p></blockquote></li></ul></li><li>Nw</li></ul>", 7, "<ul><li>Pw<ul><li>AkZw</li></ul></li><li>Nw</li></ul>"],
  ["QRol", "R", "<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr></li><li>Nw</li></ol>", ["Pw", 2], 5, "<ol><li>Pwk</li><li>Nw</li></ol>", 7, "<ol><li>Pwkw</li></ol>"],
  ["QRol", "L", "<ol><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr></li><li>Nw</li></ol>", ["Nw", 0], 2, "<ol><li>Pw</li><li><blockquote><p>Q0wkNw</p></blockquote></li></ol>", 7, "<ol><li>PkNw</li></ol>"],
];

describe("14.3: Shift and an arrow pass a rule beside a block", () => {
  test.each(SHIFT_WALKS)(
    "%s, Shift+Arrow%s",
    async (_shape, direction, html, [word, offset], pass, passWrite, edge, edgeWrite) => {
      const onChange = await renderField(html);
      await clickInWord(word, offset);
      const arrow = direction === "R" ? "{Shift>}{ArrowRight}{/Shift}" : "{Shift>}{ArrowLeft}{/Shift}";
      for (let press = 0; press < pass; press += 1) {
        await keys(arrow);
      }
      await keys("k");
      expect(written(onChange)).toBe(stored(passWrite));
      await keys("{Control>}z{/Control}");
      expect(written(onChange)).toBe(stored(html));
      for (let press = pass; press < edge; press += 1) {
        await keys(arrow);
      }
      await keys("k");
      expect(written(onChange)).toBe(stored(edgeWrite));
    },
    40_000
  );
});

/**
 * 14.4: Delete, its word form and its line form just after an image that
 * ends a quote's last paragraph, a heading or a line, by what follows in
 * the item. The write in the grid's short form: the item's middle, the
 * image as I, paragraphs unwrapped, quotes as q; NOOP is no write.
 */
const H_IMG = `<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />`;
const H_ENDS: Record<string, string> = {
  quote: `<blockquote><p>X0w${H_IMG}</p></blockquote>`,
  heading: `<h3>X0w${H_IMG}</h3>`,
  line: `<blockquote><p>Q0w</p></blockquote>X1w${H_IMG}`,
};
const H_FOLLOWERS: Record<string, string> = {
  line: "T1w",
  lineBr: "<br>T1w",
  block: "<blockquote><p>B1w</p></blockquote>",
  rule: "<hr>",
  nested: "<ul><li>L1w</li></ul>",
  itemEnd: "",
  contentEnd: "",
};
const H_FORMS: Record<string, () => Promise<void>> = {
  del: () => keys("{Delete}"),
  word: () => keys("{Control>}{Delete}{/Control}"),
  line: async () => {
    act(() => {
      editable()!.dispatchEvent(
        new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "deleteSoftLineForward" })
      );
    });
    await settle();
  },
};
const H_CELLS: [string, string, string, string][] = [
  ["quote", "line", "del", "<q>X0w</q>T1w</li>"],
  ["quote", "line", "word", "<q>X0w</q>T1w</li>"],
  ["quote", "line", "line", "<q>X0wI</q>1w</li>"],
  ["quote", "block", "del", "<q>X0wB1w</q></li>"],
  ["quote", "block", "word", "<q>X0wB1w</q></li>"],
  ["quote", "block", "line", "<q>X0wI1w</q></li>"],
  ["quote", "rule", "del", "<q>X0wI</q></li>"],
  ["quote", "rule", "word", "<q>X0wNw</q></li></ul>"],
  ["quote", "rule", "line", "<q>X0wI </q><hr /></li>"],
  ["quote", "nested", "del", "<q>X0wL1w</q></li>"],
  ["quote", "nested", "word", "<q>X0wL1w</q></li>"],
  ["quote", "nested", "line", "<q>X0wI1w</q></li>"],
  ["quote", "itemEnd", "del", "<q>X0wNw</q></li></ul>"],
  ["quote", "itemEnd", "word", "<q>X0wNw</q></li></ul>"],
  ["quote", "itemEnd", "line", "<q>X0wIw</q></li></ul>"],
  ["quote", "contentEnd", "del", "NOOP"],
  ["quote", "contentEnd", "word", "NOOP"],
  ["quote", "contentEnd", "line", "NOOP"],
  ["heading", "line", "del", "<h3>X0w</h3>T1w</li>"],
  ["heading", "line", "word", "<h3>X0w</h3>T1w</li>"],
  ["heading", "line", "line", "<h3>X0wI</h3>1w</li>"],
  ["heading", "block", "del", "<h3>X0wB1w</h3></li>"],
  ["heading", "block", "word", "<h3>X0wB1w</h3></li>"],
  ["heading", "block", "line", "<h3>X0wI1w</h3></li>"],
  ["heading", "rule", "del", "<h3>X0wI</h3></li>"],
  ["heading", "rule", "word", "<h3>X0w</h3></li>"],
  ["heading", "rule", "line", "<h3>X0wI </h3></li>"],
  ["heading", "nested", "del", "<h3>X0wL1w</h3></li>"],
  ["heading", "nested", "word", "<h3>X0wL1w</h3></li>"],
  ["heading", "nested", "line", "<h3>X0wI1w</h3></li>"],
  ["heading", "itemEnd", "del", "<h3>X0wNw</h3></li></ul>"],
  ["heading", "itemEnd", "word", "<h3>X0wNw</h3></li></ul>"],
  ["heading", "itemEnd", "line", "<h3>X0wIw</h3></li></ul>"],
  ["heading", "contentEnd", "del", "NOOP"],
  ["heading", "contentEnd", "word", "NOOP"],
  ["heading", "contentEnd", "line", "NOOP"],
  ["line", "line", "del", "<q>Q0w</q>X1wI1w</li>"],
  ["line", "line", "word", "<q>Q0w</q>X1wI</li>"],
  ["line", "line", "line", "<q>Q0w</q>X1wI</li>"],
  ["line", "lineBr", "del", "<q>Q0w</q>X1wIT1w</li>"],
  ["line", "lineBr", "word", "<q>Q0w</q>X1wIT1w</li>"],
  ["line", "lineBr", "line", "<q>Q0w</q>X1wI1w</li>"],
  ["line", "block", "del", "<q>Q0w</q>X1wB1w</li>"],
  ["line", "block", "word", "<q>Q0w</q>X1wB1w</li>"],
  ["line", "block", "line", "<q>Q0w</q>X1wI1w</li>"],
  ["line", "rule", "del", "<q>Q0w</q>X1wI</li>"],
  ["line", "rule", "word", "<q>Q0w</q>X1wI</li>"],
  ["line", "rule", "line", "<q>Q0w</q>X1wI </li>"],
  ["line", "nested", "del", "<q>Q0w</q>X1w<ul><li>L1w</li></ul></li>"],
  ["line", "nested", "word", "<q>Q0w</q>X1w<ul><li>L1w</li></ul></li>"],
  ["line", "nested", "line", "<q>Q0w</q>X1wI<ul><li>1w</li></ul></li>"],
  ["line", "itemEnd", "del", "<q>Q0w</q>X1w</li>"],
  ["line", "itemEnd", "word", "<q>Q0w</q>X1w</li>"],
  ["line", "itemEnd", "line", "<q>Q0w</q>X1wI</li><li>w</li></ul>"],
  ["line", "contentEnd", "del", "NOOP"],
  ["line", "contentEnd", "word", "NOOP"],
  ["line", "contentEnd", "line", "NOOP"],
];

describe("14.4: a delete just after an image that ends a block or a line", () => {
  test.each(H_CELLS)("%s, then %s, %s", async (end, follower, form, expected) => {
    const html =
      follower === "contentEnd"
        ? `<ul><li>Pw</li><li>${H_ENDS[end]}</li></ul>`
        : `<ul><li>Pw</li><li>${H_ENDS[end]}${H_FOLLOWERS[follower]}</li><li>Nw</li></ul>`;
    const onChange = await renderField(html);
    await userEvent.click(editable()!.querySelector("img")!);
    await settle();
    await keys("{Escape}");
    await H_FORMS[form]();
    const write = lastHtml(onChange) === "" ? "" : written(onChange);
    const short =
      write === "" || write === stored(html)
        ? "NOOP"
        : write
            .replace(/<img[^>]*>/g, "I")
            .replace(/<\/?p>/g, "")
            .replace(/blockquote/g, "q")
            .replace("<ul><li>Pw</li><li>", "")
            .replace("<li>Nw</li></ul>", "");
    expect(short).toBe(expected);
  });
});

/** 14.2: a click after a node selection, in ordinary content and in a lined item. */
const C_IMG = `<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />`;
const C_NODES: Record<string, string> = {
  rule: "<hr>",
  image: C_IMG,
  figure: `<figure>${C_IMG}<figcaption>c</figcaption></figure>`,
};
const C_LINK = `<a href="https://example.org/l">Lw</a>`;
const C_SHAPES: Record<string, (node: string) => string> = {
  ordinary: (node) => `<p>Aw${C_LINK}</p>${node.startsWith("<img") ? `<p>${node}</p>` : node}<p>Cw</p>`,
  lined: (node) => `<ul><li>Aw${C_LINK}${node}Cw</li></ul>`,
};
const nodeSelected = () =>
  editorOf()!
    .getEditorState()
    .read(() => $isNodeSelection($getSelection()));
const selectNode = async (way: "click" | "arrow") => {
  const root = editable()!;
  if (way === "click") {
    const node = root.querySelector("hr, img")!;
    await userEvent.click(node as HTMLElement);
    await settle();
    // a clicked image or figure opens its own popover and leaves the
    // selection empty; a clicked rule is node-selected
    if (node.tagName === "HR") {
      expect(nodeSelected()).toBe(true);
    }
    return;
  }
  await clickInWord("Cw", 0);
  for (let press = 0; press < 3 && nodeSelected() === false; press += 1) {
    await keys("{ArrowLeft}");
  }
  expect(nodeSelected()).toBe(true);
};
const clickAtEnd = async () => {
  const root = editable()!;
  const box = root.getBoundingClientRect();
  await userEvent.click(root, { position: { x: box.width - 4, y: box.height - 3 } } as never);
  await settle();
};
type ClickAction = [string, () => Promise<void>, (shape: string) => string];
const C_ACTIONS: ClickAction[] = [
  ["a click in text", () => clickInWord("Aw", 1), () => "Akw"],
  ["a click on a link", () => clickInWord("Lw", 1), () => "Lkw"],
  ["a click at the content's end", clickAtEnd, () => "Cwk"],
  [
    "Shift+click",
    async () => {
      await userEvent.keyboard("{Shift>}");
      await clickInWord("Aw", 1);
      await userEvent.keyboard("{/Shift}");
      await settle();
    },
    () => "Akw",
  ],
  [
    "a double click",
    async () => {
      const span = [...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]")].find(
        (element) => element.textContent === "Aw"
      )!;
      await userEvent.dblClick(span);
      await settle();
    },
    () => "k<",
  ],
];

describe("14.2: a click into text while a node is selected puts the caret where clicked", () => {
  for (const [shapeName, shape] of Object.entries(C_SHAPES)) {
    for (const [nodeName, node] of Object.entries(C_NODES)) {
      for (const way of ["click", "arrow"] as const) {
        // a figure in a list item is content the field does not edit
        if (shapeName === "lined" && nodeName === "figure") {
          continue;
        }
        test.each(C_ACTIONS)(`${shapeName}, ${nodeName} selected by ${way}: %s`, async (_name, action, expected) => {
          const html = shape(node);
          const onChange = await renderField(html);
          await selectNode(way);
          await action();
          await keys("k");
          const write = written(onChange);
          const cw = expected(shapeName);
          // the letter where clicked; a double click selects the page's word there, which the letter replaces
          const want =
            cw === "Lkw"
              ? html.replace(">Lw<", ">Lkw<")
              : cw === "Cwk"
                ? html.replace(">Cw<", ">Cwk<").replace("Cw</li>", "Cwk</li>")
                : cw === "k<"
                  ? // the page's word at the click: Aw and the link's Lw touch
                    html.replace(`Aw${C_LINK}`, "k")
                  : html.replace("Aw<a", `${cw}<a`);
          expect(write).toBe(stored(want));
        });
        test(`${shapeName}, ${nodeName} selected by ${way}: a click in text with the Link popover open`, async () => {
          const html = shape(node);
          const onChange = await renderField(html);
          await selectNode(way);
          await click(byLabel("Link"));
          expect(byLabel("URL")).not.toBeNull();
          await clickInWord("Aw", 1);
          await keys("k");
          expect(written(onChange)).toBe(stored(html.replace("Aw<a", "Akw<a")));
        });
      }
    }
  }
});

describe("14.7: the arrow rules take the direction the key moves the caret in the block", () => {
  const ruleIsSelected = () =>
    editorOf()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        return $isNodeSelection(selection) && selection.getNodes()[0]?.getType() === "horizontalrule";
      });
  test("a right-to-left quote before a rule: ArrowRight at the text's logical end moves back into the text, as at the head", async () => {
    const onChange = await renderField(LI("<blockquote><p>אבג</p></blockquote><hr>T2w"));
    await clickInWord("אבג");
    await keys("{ArrowRight}");
    expect(ruleIsSelected()).toBe(false);
    await keys("k");
    expect(written(onChange)).toBe(stored(LI("<blockquote><p>אבkג</p></blockquote><hr />T2w")));
  });
  test("there ArrowLeft moves forward and selects the rule; a letter lands after it", async () => {
    const onChange = await renderField(LI("<blockquote><p>אבג</p></blockquote><hr>T2w"));
    await clickInWord("אבג");
    await keys("{ArrowLeft}");
    expect(ruleIsSelected()).toBe(true);
    await keys("k");
    expect(written(onChange)).toBe(stored(LI("<blockquote><p>אבג</p></blockquote><hr />kT2w")));
  });
  test("a right-to-left quote after a rule: ArrowRight at the text's logical start moves backward and selects the rule", async () => {
    await renderField(LI("T0w<hr><blockquote><p>אבג</p></blockquote>"));
    await clickInWord("אבג", 0);
    await keys("{ArrowRight}");
    expect(ruleIsSelected()).toBe(true);
  });
  test("there ArrowLeft moves forward into the text", async () => {
    const onChange = await renderField(LI("T0w<hr><blockquote><p>אבג</p></blockquote>"));
    await clickInWord("אבג", 0);
    await keys("{ArrowLeft}");
    expect(ruleIsSelected()).toBe(false);
    await keys("k");
    expect(written(onChange)).toBe(stored(LI("T0w<hr /><blockquote><p>אkבג</p></blockquote>")));
  });
});

describe("14.1: Divider beside a block splits up to the root", () => {
  const divider = () => click(byLabel("Divider"));
  test("QT, at Q0w's end: the caret at T1w's start", async () => {
    const onChange = await renderField(LI("<blockquote><p>Q0w</p></blockquote>T1w"));
    await clickInWord("Q0w");
    await divider();
    expect(written(onChange)).toBe(
      stored("<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li></ul><hr /><ul><li>T1w</li><li>Nw</li></ul>")
    );
    await keys("k");
    expect(written(onChange)).toBe(
      stored("<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li></ul><hr /><ul><li>kT1w</li><li>Nw</li></ul>")
    );
  });
  test("QT, at T1w's start: the same write", async () => {
    const onChange = await renderField(LI("<blockquote><p>Q0w</p></blockquote>T1w"));
    await clickInWord("T1w", 0);
    await divider();
    expect(written(onChange)).toBe(
      stored("<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li></ul><hr /><ul><li>T1w</li><li>Nw</li></ul>")
    );
  });
  test("TQT, at Q1w's end", async () => {
    const onChange = await renderField(LI("T0w<blockquote><p>Q1w</p></blockquote>T2w"));
    await clickInWord("Q1w");
    await divider();
    expect(written(onChange)).toBe(
      stored("<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote></li></ul><hr /><ul><li>T2w</li><li>Nw</li></ul>")
    );
  });
  test("HT, at H0w's end", async () => {
    const onChange = await renderField(LI("<h3>H0w</h3>T1w"));
    await clickInWord("H0w");
    await divider();
    expect(written(onChange)).toBe(
      stored("<ul><li>Pw</li><li><h3>H0w</h3></li></ul><hr /><ul><li>T1w</li><li>Nw</li></ul>")
    );
  });
  test("QR, at Q0w's end: the caret on the empty line before the second rule", async () => {
    const onChange = await renderField(LI("<blockquote><p>Q0w</p></blockquote><hr>"));
    await clickInWord("Q0w");
    await divider();
    expect(written(onChange)).toBe(
      stored("<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li></ul><hr /><ul><li><hr /></li><li>Nw</li></ul>")
    );
    await keys("k");
    expect(written(onChange)).toBe(
      stored("<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li></ul><hr /><ul><li>k<hr /></li><li>Nw</li></ul>")
    );
  });
  test("RQ, at Q0w's start", async () => {
    const onChange = await renderField(LI("<hr><blockquote><p>Q0w</p></blockquote>"));
    await clickInWord("Q0w", 0);
    await divider();
    expect(written(onChange)).toBe(
      stored("<ul><li>Pw</li><li><hr /></li></ul><hr /><ul><li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li></ul>")
    );
  });
  test("a quote in a nested item, at Q1w's end", async () => {
    const onChange = await renderField("<ul><li>Pw<ul><li><blockquote><p>Q1w</p></blockquote></li></ul></li><li>Nw</li></ul>");
    await clickInWord("Q1w");
    await divider();
    expect(written(onChange)).toBe(
      stored("<ul><li>Pw<ul><li><blockquote><p>Q1w</p></blockquote></li></ul></li></ul><hr /><ul><li>Nw</li></ul>")
    );
  });
  test("a list in a root quote, at Q1w's end: the rule leaves the root quote too", async () => {
    const html = "<blockquote><ul><li>T0w<blockquote><p>Q1w</p></blockquote></li></ul></blockquote>";
    const onChange = await renderField(html);
    await clickInWord("Q1w");
    await divider();
    expect(written(onChange)).toBe(stored(`${html}<hr /><p></p>`));
  });
});

describe("14.10: tests that guard their fix", () => {
  const $placeOnItem = (find: (item: ElementNode) => boolean, offset: number) => {
    const items: ElementNode[] = [];
    const walk = (node: ElementNode) => {
      for (const child of node.getChildren()) {
        if ($isElementNode(child)) {
          if (child.getType() === "listitem") {
            items.push(child);
          }
          walk(child);
        }
      }
    };
    walk($getRoot());
    const item = items.find(find)!;
    const selection = $createRangeSelection();
    selection.anchor.set(item.getKey(), offset, "element");
    selection.focus.set(item.getKey(), offset, "element");
    $setSelection(selection);
  };
  const anchorType = () =>
    editorOf()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        return $isRangeSelection(selection) ? selection.anchor.getNode().getType() : "none";
      });
  test("J: a point on the wrapper item that holds only a nested list resolves into it", async () => {
    await renderField("<ul><li>a1q</li><li><ul><li><hr>T1q</li></ul></li></ul>");
    await click(editable());
    const errors = vi.spyOn(console, "error");
    await act(async () => {
      editorOf()!.update(() =>
        $placeOnItem((item) => item.getChildrenSize() === 1 && item.getFirstChild()?.getType() === "list", 0)
      );
    });
    await settle();
    expect(errors.mock.calls.map((args) => String(args[0])).filter((m) => m.includes("cms-line"))).toEqual([]);
    expect(anchorType()).not.toBe("listitem");
  });
  test("J: check 2's shape, a point before the nested list of an item with text", async () => {
    await renderField("<ul><li>a1q<ul><li><hr>T1q</li></ul></li></ul>");
    await click(editable());
    const errors = vi.spyOn(console, "error");
    await act(async () => {
      editorOf()!.update(() => $placeOnItem((item) => item.getTextContent().startsWith("a1q"), 1));
    });
    await settle();
    expect(errors.mock.calls.map((args) => String(args[0])).filter((m) => m.includes("cms-line"))).toEqual([]);
    expect(anchorType()).not.toBe("listitem");
  });
  test("M1: a heading's whole text in an item, Enter, undo, redo: the redo gives the Enter's write", async () => {
    const onChange = await renderField(LI("<h3>H0w</h3>"));
    await clickInWord("H0w", 0);
    await userEvent.keyboard("{Shift>}{End}{/Shift}");
    await settle();
    await keys("{Enter}");
    const enter = written(onChange);
    expect(enter).toBe(stored(LI("<h3></h3><br />")));
    await keys("{Control>}z{/Control}");
    expect(written(onChange)).toBe(stored(LI("<h3>H0w</h3>")));
    await keys("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(written(onChange)).toBe(enter);
  });
  test("the container point at QB el1 stays: a letter lands after the quote, before the break", async () => {
    const onChange = await renderField(LI("<blockquote><p>Q0w</p></blockquote><br>"));
    await click(editable());
    await act(async () => {
      editorOf()!.update(() => $placeOnItem((item) => item.getTextContent().startsWith("Q0w"), 1));
    });
    await settle();
    await keys("k");
    expect(written(onChange)).toBe(stored(LI("<blockquote><p>Q0w</p></blockquote>k<br />")));
  });
});

/**
 * 14.8: a paste with a rule node-selected in an item that starts with a
 * block (the head's own path does not end there): Lexical's order with the
 * point after the rule resolved by D18 first, so the paste runs at that
 * caret and the rule then goes; no step over 2 s. An item that starts with
 * a line keeps the head's write. The write in the grid's short form.
 */
const P_Q = (word: string) => `<blockquote><p>${word}</p></blockquote>`;
const P_SHAPES: Record<string, string> = {
  QR: LI(`${P_Q("Q0w")}<hr>`),
  QRT: LI(`${P_Q("Q0w")}<hr>T2w`),
  QQR: LI(`${P_Q("Q0w")}${P_Q("Q1w")}<hr>`),
  QRB: LI(`${P_Q("Q0w")}<hr><br>`),
  QRL: LI(`${P_Q("Q0w")}<hr><ul><li>L2w</li></ul>`),
  QRQ: LI(`${P_Q("Q0w")}<hr>${P_Q("Q2w")}`),
  QRR: LI(`${P_Q("Q0w")}<hr><hr>`),
  RQR: LI(`<hr>${P_Q("Q1w")}<hr>`),
  QRTQ: LI(`${P_Q("Q0w")}<hr>T2w${P_Q("Q3w")}`),
  QRd2: `<ul><li>Pw<ul><li>Aw</li><li>${P_Q("Q0w")}<hr></li><li>Zw</li></ul></li><li>Nw</li></ul>`,
  QRol: `<ol><li>Pw</li><li>${P_Q("Q0w")}<hr></li><li>Nw</li></ol>`,
  XRY: LI("xq<hr>yq"),
};
const P_DATA: Record<string, Record<string, string>> = {
  p1: { "text/html": "<p>Aq</p>", "text/plain": "Aq" },
  p2: { "text/html": "<p>Aq</p><p>Bq</p>", "text/plain": "Aq\nBq" },
  list: { "text/html": "<ul><li>Aq</li></ul>", "text/plain": "Aq" },
  emptyP: { "text/html": "<p></p>", "text/plain": "" },
};
const P_CELLS: [string, string, string][] = [
  ["QQR", "emptyP", "<ul><li>Pw</li><li><q>Q0w</q><q>Q1w</q></li><li>Nw</li></ul>"],
  ["QQR", "list", "<ul><li>Pw</li><li><q>Q0w</q><q>Q1w</q></li><li>Aq</li><li>Nw</li></ul>"],
  ["QQR", "own", "<ul><li>Pw</li><li><q>Q0w</q><q>Q1w</q></li><li>Pw</li><li>Nw</li></ul>"],
  ["QQR", "p1", "<ul><li>Pw</li><li><q>Q0w</q><q>Q1w</q>Aq</li><li>Nw</li></ul>"],
  ["QQR", "p2", "<ul><li>Pw</li><li><q>Q0w</q><q>Q1w</q>Aq</li></ul>Bq<ul><li>Nw</li></ul>"],
  ["QR", "emptyP", "<ul><li>Pw</li><li><q>Q0w</q></li><li>Nw</li></ul>"],
  ["QR", "list", "<ul><li>Pw</li><li><q>Q0w</q></li><li>Aq</li><li>Nw</li></ul>"],
  ["QR", "own", "<ul><li>Pw</li><li><q>Q0w</q></li><li>Pw</li><li>Nw</li></ul>"],
  ["QR", "p1", "<ul><li>Pw</li><li><q>Q0w</q>Aq</li><li>Nw</li></ul>"],
  ["QR", "p2", "<ul><li>Pw</li><li><q>Q0w</q>Aq</li></ul>Bq<ul><li>Nw</li></ul>"],
  ["QRB", "emptyP", "<ul><li>Pw</li><li><q>Q0w</q><br /></li><li>Nw</li></ul>"],
  ["QRB", "list", "<ul><li>Pw</li><li><q>Q0w</q></li><li>Aq<br /></li><li>Nw</li></ul>"],
  ["QRB", "own", "<ul><li>Pw</li><li><q>Q0w</q></li><li>Pw<br /></li><li>Nw</li></ul>"],
  ["QRB", "p1", "<ul><li>Pw</li><li><q>Q0w</q>Aq<br /></li><li>Nw</li></ul>"],
  ["QRB", "p2", "<ul><li>Pw</li><li><q>Q0w</q>Aq</li></ul>Bq<br /><ul><li>Nw</li></ul>"],
  ["QRL", "emptyP", "<ul><li>Pw</li><li><q>Q0w</q><ul><li>L2w</li></ul></li><li>Nw</li></ul>"],
  ["QRL", "list", "<ul><li>Pw</li><li><q>Q0w</q></li><li>Aq<ul><li>L2w</li></ul></li><li>Nw</li></ul>"],
  ["QRL", "own", "<ul><li>Pw</li><li><q>Q0w</q></li><li>Pw<ul><li>L2w</li></ul></li><li>Nw</li></ul>"],
  ["QRL", "p1", "<ul><li>Pw</li><li><q>Q0w</q>Aq<ul><li>L2w</li></ul></li><li>Nw</li></ul>"],
  ["QRL", "p2", "<ul><li>Pw</li><li><q>Q0w</q>Aq</li></ul>Bq<ul><li><ul><li>L2w</li></ul></li><li>Nw</li></ul>"],
  ["QRQ", "emptyP", "<ul><li>Pw</li><li><q>Q0w</q><q>Q2w</q></li><li>Nw</li></ul>"],
  ["QRQ", "list", "<ul><li>Pw</li><li><q>Q0w</q><q><ul><li>Aq</li></ul>Q2w</q></li><li>Nw</li></ul>"],
  ["QRQ", "own", "<ul><li>Pw</li><li><q>Q0w</q><q><ul><li>Pw</li></ul>Q2w</q></li><li>Nw</li></ul>"],
  ["QRQ", "p1", "<ul><li>Pw</li><li><q>Q0w</q><q>AqQ2w</q></li><li>Nw</li></ul>"],
  ["QRQ", "p2", "<ul><li>Pw</li><li><q>Q0w</q><q>AqBqQ2w</q></li><li>Nw</li></ul>"],
  ["QRR", "emptyP", "<ul><li>Pw</li><li><q>Q0w</q><hr /></li><li>Nw</li></ul>"],
  ["QRR", "list", "<ul><li>Pw</li><li><q>Q0w</q></li><li>Aq<hr /></li><li>Nw</li></ul>"],
  ["QRR", "own", "<ul><li>Pw</li><li><q>Q0w</q></li><li>Pw<hr /></li><li>Nw</li></ul>"],
  ["QRR", "p1", "<ul><li>Pw</li><li><q>Q0w</q>Aq<hr /></li><li>Nw</li></ul>"],
  ["QRR", "p2", "<ul><li>Pw</li><li><q>Q0w</q>Aq</li></ul>Bq<hr /><ul><li>Nw</li></ul>"],
  ["QRT", "emptyP", "<ul><li>Pw</li><li><q>Q0w</q>T2w</li><li>Nw</li></ul>"],
  ["QRT", "list", "<ul><li>Pw</li><li><q>Q0w</q></li><li>AqT2w</li><li>Nw</li></ul>"],
  ["QRT", "own", "<ul><li>Pw</li><li><q>Q0w</q></li><li>PwT2w</li><li>Nw</li></ul>"],
  ["QRT", "p1", "<ul><li>Pw</li><li><q>Q0w</q>AqT2w</li><li>Nw</li></ul>"],
  ["QRT", "p2", "<ul><li>Pw</li><li><q>Q0w</q>Aq</li></ul>BqT2w<ul><li>Nw</li></ul>"],
  ["QRTQ", "emptyP", "<ul><li>Pw</li><li><q>Q0w</q>T2w<q>Q3w</q></li><li>Nw</li></ul>"],
  ["QRTQ", "list", "<ul><li>Pw</li><li><q>Q0w</q></li><li>AqT2w<q>Q3w</q></li><li>Nw</li></ul>"],
  ["QRTQ", "own", "<ul><li>Pw</li><li><q>Q0w</q></li><li>PwT2w<q>Q3w</q></li><li>Nw</li></ul>"],
  ["QRTQ", "p1", "<ul><li>Pw</li><li><q>Q0w</q>AqT2w<q>Q3w</q></li><li>Nw</li></ul>"],
  ["QRTQ", "p2", "<ul><li>Pw</li><li><q>Q0w</q>Aq</li></ul>BqT2w<q>Q3w</q><ul><li>Nw</li></ul>"],
  ["QRd2", "emptyP", "<ul><li>Pw<ul><li>Aw</li><li><q>Q0w</q></li><li>Zw</li></ul></li><li>Nw</li></ul>"],
  ["QRd2", "list", "<ul><li>Pw<ul><li>Aw</li><li><q>Q0w</q></li><li>Aq</li><li>Zw</li></ul></li><li>Nw</li></ul>"],
  ["QRd2", "own", "<ul><li>Pw<ul><li>Aw</li><li><q>Q0w</q></li><li>Pw</li><li>Zw</li></ul></li><li>Nw</li></ul>"],
  ["QRd2", "p1", "<ul><li>Pw<ul><li>Aw</li><li><q>Q0w</q>Aq</li><li>Zw</li></ul></li><li>Nw</li></ul>"],
  ["QRd2", "p2", "<ul><li>Pw<ul><li>Aw</li><li><q>Q0w</q>Aq</li></ul></li><li>Bq<ul><li>Zw</li></ul></li><li>Nw</li></ul>"],
  ["QRol", "emptyP", "<ol><li>Pw</li><li><q>Q0w</q></li><li>Nw</li></ol>"],
  ["QRol", "list", "<ol><li>Pw</li><li><q>Q0w</q></li></ol><ul><li>Aq</li></ul><ol><li>Nw</li></ol>"],
  ["QRol", "own", "<ol><li>Pw</li><li><q>Q0w</q></li><li>Pw</li><li>Nw</li></ol>"],
  ["QRol", "p1", "<ol><li>Pw</li><li><q>Q0w</q>Aq</li><li>Nw</li></ol>"],
  ["QRol", "p2", "<ol><li>Pw</li><li><q>Q0w</q>Aq</li></ol>Bq<ol><li>Nw</li></ol>"],
  ["RQR", "emptyP", "<ul><li>Pw</li><li><q>Q1w</q><hr /></li><li>Nw</li></ul>"],
  ["RQR", "list", "<ul><li>Pw</li><li><q><ul><li>Aq</li></ul>Q1w</q><hr /></li><li>Nw</li></ul>"],
  ["RQR", "own", "<ul><li>Pw</li><li><q><ul><li>Pw</li></ul>Q1w</q><hr /></li><li>Nw</li></ul>"],
  ["RQR", "p1", "<ul><li>Pw</li><li><q>AqQ1w</q><hr /></li><li>Nw</li></ul>"],
  ["RQR", "p2", "<ul><li>Pw</li><li><q>AqBqQ1w</q><hr /></li><li>Nw</li></ul>"],
  ["XRY", "emptyP", "<ul><li>Pw</li><li>xq</li></ul>yq<ul><li>Nw</li></ul>"],
];

describe("14.8: a paste with a rule node-selected in a lined item", () => {
  test.each(P_CELLS)("%s, a paste of %s", async (shape, kind, expected) => {
    const onChange = await renderField(P_SHAPES[shape]);
    let data = P_DATA[kind];
    if (kind === "own") {
      // the field's own nodes: a real copy of the first item's text
      await clickInWord("Pw", 0);
      await keys("{Shift>}{End}{/Shift}");
      const transfer = new DataTransfer();
      act(() => {
        editable()!.dispatchEvent(
          new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: transfer })
        );
      });
      data = {
        "application/x-lexical-editor": transfer.getData("application/x-lexical-editor"),
        "text/html": transfer.getData("text/html"),
        "text/plain": transfer.getData("text/plain"),
      };
    }
    await userEvent.click(editable()!.querySelector("hr")!);
    await settle();
    expect(nodeSelected()).toBe(true);
    const started = performance.now();
    paste(data);
    await settle();
    expect(performance.now() - started).toBeLessThan(2000);
    const write = written(onChange);
    const short = (write.length > 400 ? `LONG(${write.length})` : write)
      .replace(/<img[^>]*>/g, "I")
      .replace(/blockquote/g, "q")
      .replace(/<\/?p>/g, "");
    expect(short).toBe(expected);
  });
});
