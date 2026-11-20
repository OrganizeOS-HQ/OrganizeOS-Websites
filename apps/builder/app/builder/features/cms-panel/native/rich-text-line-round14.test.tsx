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
  type LexicalNode,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COPY_COMMAND,
  type LexicalEditor,
} from "lexical";
import { TooltipProvider } from "@webstudio-is/design-system";
import { RichTextField } from "./rich-text-field";
import { byLabel, click, clickInWord, editable, editorOf, lastHtml, paste, renderField, settle } from "./rich-text-test-harness";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import { lineSpike } from "./rich-text-line-node";

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
  // 15.2: a cancelled composition leaves the history exactly as it was
  ["bold", false, [T("T2w")], [T("T2wx")]],
  [
    "element",
    true,
    [T(`${ITEM("T2wx")}`), T("T2wx"), T("T2w")],
    [T("T2wx"), T(ITEM("T2wx")), T(`${ITEM("T2wx")}ab`)],
  ],
  ["element", false, [T("T2wx"), T("T2w")], [T("T2wx"), T(ITEM("T2wx"))]],
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
 * Round 14 rulings (14.4 withdrawn): a caret just after an image that ends
 * its block or line is that block's or line's end. Delete, the word form
 * and the line form there do what they do at the end of the same block ending in a word (the
 * twin: the image replaced by the word Zw, the caret after it), and so
 * does the line form; a forward delete never removes the image. The write in the twin's form: the image
 * written as Zw.
 */
const E_IMG = `<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />`;
const E_ENDS: Record<string, (x: string) => string> = {
  quote: (x) => `<blockquote><p>X0w${x}</p></blockquote>`,
  heading: (x) => `<h3>X0w${x}</h3>`,
  line: (x) => `<blockquote><p>Q0w</p></blockquote>X1w${x}`,
};
const E_ORDINARY_ENDS: Record<string, (x: string) => string> = {
  quote: (x) => `<blockquote><p>X0w${x}</p></blockquote>`,
  heading: (x) => `<h3>X0w${x}</h3>`,
  line: (x) => `<p>X1w${x}</p>`,
};
const E_LINED_FOLLOWERS: Record<string, string> = {
  line: "T1w",
  block: "<blockquote><p>B1w</p></blockquote>",
  rule: "<hr>",
  nested: "<ul><li>L1w</li></ul>",
  itemEnd: "",
  contentEnd: "",
};
const E_ORDINARY_FOLLOWERS: Record<string, string> = {
  line: "<p>T1w</p>",
  block: "<blockquote><p>B1w</p></blockquote>",
  rule: "<hr>",
  nested: "<ul><li>L1w</li></ul>",
  contentEnd: "",
};
const eShape = (context: string, end: string, follower: string) => {
  if (context === "ordinary") {
    return `${E_ORDINARY_ENDS[end](E_IMG)}${E_ORDINARY_FOLLOWERS[follower]}`;
  }
  const inner = `${context === "lineLed" ? "T9w" : ""}${E_ENDS[end](E_IMG)}${E_LINED_FOLLOWERS[follower]}`;
  return follower === "contentEnd"
    ? `<ul><li>Pw</li><li>${inner}</li></ul>`
    : `<ul><li>Pw</li><li>${inner}</li><li>Nw</li></ul>`;
};
/** The caret just after the image: a click on it, then Escape. */
const caretAfterImage = async () => {
  await userEvent.click(editable()!.querySelector("img")!);
  await settle();
  await keys("{Escape}");
};
const E_CELLS: [string, string, string, string, string][] = [
  ["blockLed", "quote", "line", "del", "<ul><li>Pw</li><li><blockquote><p>X0wZwT1w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "line", "word", "<ul><li>Pw</li><li><blockquote><p>X0wZwT1w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "line", "line", "NOOP"],
  ["blockLed", "quote", "block", "del", "<ul><li>Pw</li><li><blockquote><p>X0wZwB1w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "block", "word", "<ul><li>Pw</li><li><blockquote><p>X0wZwB1w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "block", "line", "NOOP"],
  ["blockLed", "quote", "rule", "del", "<ul><li>Pw</li><li><blockquote><p>X0wZw</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "rule", "word", "<ul><li>Pw</li><li><blockquote><p>X0wZw</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "rule", "line", "<ul><li>Pw</li><li><blockquote><p>X0wZw</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "nested", "del", "<ul><li>Pw</li><li><blockquote><p>X0wZwL1w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "nested", "word", "<ul><li>Pw</li><li><blockquote><p>X0wZwL1w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "nested", "line", "NOOP"],
  ["blockLed", "quote", "itemEnd", "del", "<ul><li>Pw</li><li><blockquote><p>X0wZwNw</p></blockquote></li></ul>"],
  ["blockLed", "quote", "itemEnd", "word", "<ul><li>Pw</li><li><blockquote><p>X0wZwNw</p></blockquote></li></ul>"],
  ["blockLed", "quote", "itemEnd", "line", "NOOP"],
  ["blockLed", "quote", "contentEnd", "del", "NOOP"],
  ["blockLed", "quote", "contentEnd", "word", "NOOP"],
  ["blockLed", "quote", "contentEnd", "line", "NOOP"],
  ["blockLed", "heading", "line", "del", "<ul><li>Pw</li><li><h3>X0wZwT1w</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "line", "word", "<ul><li>Pw</li><li><h3>X0wZwT1w</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "line", "line", "NOOP"],
  ["blockLed", "heading", "block", "del", "<ul><li>Pw</li><li><h3>X0wZwB1w</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "block", "word", "<ul><li>Pw</li><li><h3>X0wZwB1w</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "block", "line", "NOOP"],
  ["blockLed", "heading", "rule", "del", "<ul><li>Pw</li><li><h3>X0wZw</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "rule", "word", "<ul><li>Pw</li><li><h3>X0wZw</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "rule", "line", "<ul><li>Pw</li><li><h3>X0wZw</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "nested", "del", "<ul><li>Pw</li><li><h3>X0wZwL1w</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "nested", "word", "<ul><li>Pw</li><li><h3>X0wZwL1w</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "nested", "line", "NOOP"],
  ["blockLed", "heading", "itemEnd", "del", "<ul><li>Pw</li><li><h3>X0wZwNw</h3></li></ul>"],
  ["blockLed", "heading", "itemEnd", "word", "<ul><li>Pw</li><li><h3>X0wZwNw</h3></li></ul>"],
  ["blockLed", "heading", "itemEnd", "line", "NOOP"],
  ["blockLed", "heading", "contentEnd", "del", "NOOP"],
  ["blockLed", "heading", "contentEnd", "word", "NOOP"],
  ["blockLed", "heading", "contentEnd", "line", "NOOP"],
  ["blockLed", "line", "line", "del", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X1wZw1w</li><li>Nw</li></ul>"],
  ["blockLed", "line", "line", "word", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X1wZw</li><li>Nw</li></ul>"],
  ["blockLed", "line", "line", "line", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X1wZw</li><li>Nw</li></ul>"],
  ["blockLed", "line", "block", "del", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X1wZwB1w</li><li>Nw</li></ul>"],
  ["blockLed", "line", "block", "word", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X1wZwB1w</li><li>Nw</li></ul>"],
  ["blockLed", "line", "block", "line", "NOOP"],
  ["blockLed", "line", "rule", "del", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X1wZw</li><li>Nw</li></ul>"],
  ["blockLed", "line", "rule", "word", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X1wZw</li><li>Nw</li></ul>"],
  ["blockLed", "line", "rule", "line", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X1wZw</li><li>Nw</li></ul>"],
  ["blockLed", "line", "nested", "del", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X1wZwL1w</li><li>Nw</li></ul>"],
  ["blockLed", "line", "nested", "word", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X1wZwL1w</li><li>Nw</li></ul>"],
  ["blockLed", "line", "nested", "line", "NOOP"],
  ["blockLed", "line", "itemEnd", "del", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X1wZwNw</li></ul>"],
  ["blockLed", "line", "itemEnd", "word", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>X1wZwNw</li></ul>"],
  ["blockLed", "line", "itemEnd", "line", "NOOP"],
  ["blockLed", "line", "contentEnd", "del", "NOOP"],
  ["blockLed", "line", "contentEnd", "word", "NOOP"],
  ["blockLed", "line", "contentEnd", "line", "NOOP"],
  ["lineLed", "quote", "line", "del", "<ul><li>Pw</li><li>T9w<blockquote><p>X0wZwT1w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "line", "word", "<ul><li>Pw</li><li>T9w<blockquote><p>X0wZwT1w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "line", "line", "NOOP"],
  ["lineLed", "quote", "block", "del", "<ul><li>Pw</li><li>T9w<blockquote><p>X0wZwB1w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "block", "word", "<ul><li>Pw</li><li>T9w<blockquote><p>X0wZwB1w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "block", "line", "NOOP"],
  ["lineLed", "quote", "rule", "del", "<ul><li>Pw</li><li>T9w<blockquote><p>X0wZw</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "rule", "word", "<ul><li>Pw</li><li>T9w<blockquote><p>X0wZw</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "rule", "line", "<ul><li>Pw</li><li>T9w<blockquote><p>X0wZw</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "nested", "del", "<ul><li>Pw</li><li>T9w<blockquote><p>X0wZwL1w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "nested", "word", "<ul><li>Pw</li><li>T9w<blockquote><p>X0wZwL1w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "nested", "line", "NOOP"],
  ["lineLed", "quote", "itemEnd", "del", "<ul><li>Pw</li><li>T9w<blockquote><p>X0wZwNw</p></blockquote></li></ul>"],
  ["lineLed", "quote", "itemEnd", "word", "<ul><li>Pw</li><li>T9w<blockquote><p>X0wZwNw</p></blockquote></li></ul>"],
  ["lineLed", "quote", "itemEnd", "line", "NOOP"],
  ["lineLed", "quote", "contentEnd", "del", "NOOP"],
  ["lineLed", "quote", "contentEnd", "word", "NOOP"],
  ["lineLed", "quote", "contentEnd", "line", "NOOP"],
  ["lineLed", "heading", "line", "del", "<ul><li>Pw</li><li>T9w<h3>X0wZwT1w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "line", "word", "<ul><li>Pw</li><li>T9w<h3>X0wZwT1w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "line", "line", "NOOP"],
  ["lineLed", "heading", "block", "del", "<ul><li>Pw</li><li>T9w<h3>X0wZwB1w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "block", "word", "<ul><li>Pw</li><li>T9w<h3>X0wZwB1w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "block", "line", "NOOP"],
  ["lineLed", "heading", "rule", "del", "<ul><li>Pw</li><li>T9w<h3>X0wZw</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "rule", "word", "<ul><li>Pw</li><li>T9w<h3>X0wZw</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "rule", "line", "<ul><li>Pw</li><li>T9w<h3>X0wZw</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "nested", "del", "<ul><li>Pw</li><li>T9w<h3>X0wZwL1w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "nested", "word", "<ul><li>Pw</li><li>T9w<h3>X0wZwL1w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "nested", "line", "NOOP"],
  ["lineLed", "heading", "itemEnd", "del", "<ul><li>Pw</li><li>T9w<h3>X0wZwNw</h3></li></ul>"],
  ["lineLed", "heading", "itemEnd", "word", "<ul><li>Pw</li><li>T9w<h3>X0wZwNw</h3></li></ul>"],
  ["lineLed", "heading", "itemEnd", "line", "NOOP"],
  ["lineLed", "heading", "contentEnd", "del", "NOOP"],
  ["lineLed", "heading", "contentEnd", "word", "NOOP"],
  ["lineLed", "heading", "contentEnd", "line", "NOOP"],
  ["lineLed", "line", "line", "del", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X1wZw1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "line", "word", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X1wZw</li><li>Nw</li></ul>"],
  ["lineLed", "line", "line", "line", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X1wZw</li><li>Nw</li></ul>"],
  ["lineLed", "line", "block", "del", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X1wZwB1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "block", "word", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X1wZwB1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "block", "line", "NOOP"],
  ["lineLed", "line", "rule", "del", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X1wZw</li><li>Nw</li></ul>"],
  ["lineLed", "line", "rule", "word", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X1wZw</li><li>Nw</li></ul>"],
  ["lineLed", "line", "rule", "line", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X1wZw</li><li>Nw</li></ul>"],
  ["lineLed", "line", "nested", "del", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X1wZwL1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "nested", "word", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X1wZwL1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "nested", "line", "NOOP"],
  ["lineLed", "line", "itemEnd", "del", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X1wZwNw</li></ul>"],
  ["lineLed", "line", "itemEnd", "word", "<ul><li>Pw</li><li>T9w<blockquote><p>Q0w</p></blockquote>X1wZwNw</li></ul>"],
  ["lineLed", "line", "itemEnd", "line", "NOOP"],
  ["lineLed", "line", "contentEnd", "del", "NOOP"],
  ["lineLed", "line", "contentEnd", "word", "NOOP"],
  ["lineLed", "line", "contentEnd", "line", "NOOP"],
  ["ordinary", "quote", "line", "del", "<blockquote><p>X0wZwT1w</p></blockquote>"],
  ["ordinary", "quote", "line", "word", "<blockquote><p>X0wZwT1w</p></blockquote>"],
  ["ordinary", "quote", "line", "line", "NOOP"],
  ["ordinary", "quote", "block", "del", "<blockquote><p>X0wZwB1w</p></blockquote>"],
  ["ordinary", "quote", "block", "word", "<blockquote><p>X0wZwB1w</p></blockquote>"],
  ["ordinary", "quote", "block", "line", "NOOP"],
  ["ordinary", "quote", "rule", "del", "NOOP"],
  ["ordinary", "quote", "rule", "word", "<blockquote><p>X0wZw</p></blockquote>"],
  ["ordinary", "quote", "rule", "line", "NOOP"],
  ["ordinary", "quote", "nested", "del", "<blockquote><p>X0wZwL1w</p></blockquote>"],
  ["ordinary", "quote", "nested", "word", "<blockquote><p>X0wZwL1w</p></blockquote>"],
  ["ordinary", "quote", "nested", "line", "NOOP"],
  ["ordinary", "quote", "contentEnd", "del", "NOOP"],
  ["ordinary", "quote", "contentEnd", "word", "NOOP"],
  ["ordinary", "quote", "contentEnd", "line", "NOOP"],
  ["ordinary", "heading", "line", "del", "<h3>X0wZwT1w</h3>"],
  ["ordinary", "heading", "line", "word", "<h3>X0wZwT1w</h3>"],
  ["ordinary", "heading", "line", "line", "NOOP"],
  ["ordinary", "heading", "block", "del", "<h3>X0wZwB1w</h3>"],
  ["ordinary", "heading", "block", "word", "<h3>X0wZwB1w</h3>"],
  ["ordinary", "heading", "block", "line", "NOOP"],
  ["ordinary", "heading", "rule", "del", "<h3>X0wZw</h3>"],
  ["ordinary", "heading", "rule", "word", "<h3>X0wZw</h3>"],
  ["ordinary", "heading", "rule", "line", "<h3>X0wZw</h3>"],
  ["ordinary", "heading", "nested", "del", "<h3>X0wZwL1w</h3>"],
  ["ordinary", "heading", "nested", "word", "<h3>X0wZwL1w</h3>"],
  ["ordinary", "heading", "nested", "line", "NOOP"],
  ["ordinary", "heading", "contentEnd", "del", "NOOP"],
  ["ordinary", "heading", "contentEnd", "word", "NOOP"],
  ["ordinary", "heading", "contentEnd", "line", "NOOP"],
  ["ordinary", "line", "line", "del", "<p>X1wZwT1w</p>"],
  ["ordinary", "line", "line", "word", "<p>X1wZwT1w</p>"],
  ["ordinary", "line", "line", "line", "NOOP"],
  ["ordinary", "line", "block", "del", "<p>X1wZwB1w</p>"],
  ["ordinary", "line", "block", "word", "<p>X1wZwB1w</p>"],
  ["ordinary", "line", "block", "line", "NOOP"],
  ["ordinary", "line", "rule", "del", "<p>X1wZw</p>"],
  ["ordinary", "line", "rule", "word", "<p>X1wZw</p>"],
  ["ordinary", "line", "rule", "line", "<p>X1wZw</p>"],
  ["ordinary", "line", "nested", "del", "<p>X1wZwL1w</p>"],
  ["ordinary", "line", "nested", "word", "<p>X1wZwL1w</p>"],
  ["ordinary", "line", "nested", "line", "NOOP"],
  ["ordinary", "line", "contentEnd", "del", "NOOP"],
  ["ordinary", "line", "contentEnd", "word", "NOOP"],
  ["ordinary", "line", "contentEnd", "line", "NOOP"],
];

describe("a caret just after an image that ends its block or line is its end", () => {
  test.each(E_CELLS)("%s, %s then %s, %s", async (context, end, follower, form, expected) => {
    const html = eShape(context, end, follower);
    const onChange = await renderField(html);
    await caretAfterImage();
    if (form === "line") {
      act(() => {
        editable()!.dispatchEvent(
          new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "deleteSoftLineForward" })
        );
      });
      await settle();
    } else {
      await keys(form === "del" ? "{Delete}" : "{Control>}{Delete}{/Control}");
    }
    const write = lastHtml(onChange) === "" ? "NOOP" : written(onChange);
    expect(write === stored(html) ? "NOOP" : write.replace(/<img[^>]*>/g, "Zw")).toBe(expected);
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
    if (node.tagName === "HR") {
      expect(nodeSelected()).toBe(true);
      return;
    }
    // the control's premise: a clicked image or figure opens its popover
    // and selects nothing
    const alt = [...document.querySelectorAll("label")].find((label) => label.textContent === "Alt");
    expect(alt).toBeDefined();
    expect(editorOf()!.getEditorState().read(() => $getSelection())).toBeNull();
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

const C_CASES: [string, string, string, "click" | "arrow"][] = [];
for (const shapeName of Object.keys(C_SHAPES)) {
  for (const nodeName of Object.keys(C_NODES)) {
    for (const way of ["click", "arrow"] as const) {
      // a figure in a list item is content the field does not edit
      if (shapeName === "lined" && nodeName === "figure") {
        continue;
      }
      // a click on an image or a figure selects nothing: those cells are
      // controls, named for what they do
      const control = way === "click" && nodeName !== "rule";
      C_CASES.push([
        control ? "14.2 controls (no node selection)" : "14.2: a click into text while a node is selected puts the caret where clicked",
        shapeName,
        nodeName,
        way,
      ]);
    }
  }
}
const cTitle = (shapeName: string, nodeName: string, way: string, action: string) =>
  way === "click" && nodeName !== "rule"
    ? `${shapeName}: a click on ${nodeName === "image" ? "an image" : "a figure"} opens its popover and selects nothing; ${action} then ${action === "a double click" ? "selects the word at the click" : "gives a caret at the click"}`
    : `${shapeName}, ${nodeName} selected by ${way}: ${action}`;
for (const group of new Set(C_CASES.map(([title]) => title))) describe(group, () => {
  for (const [title, shapeName, nodeName, way] of C_CASES) {
    if (title !== group) {
      continue;
    }
    const shape = C_SHAPES[shapeName];
    const node = C_NODES[nodeName];
    for (const [actionName, action, expected] of C_ACTIONS) test(cTitle(shapeName, nodeName, way, actionName), async () => {
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
    test(cTitle(shapeName, nodeName, way, "a click in text with the Link popover open"), async () => {
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

describe("14.9: one writer for a range", () => {
  const CODE = "<pre><code>C1w</code></pre>";
  const ITEM = "T0w<blockquote><p>Q1w</p></blockquote>T2w";
  const PLACES: [string, string][] = [
    ["after the list", `${LI(ITEM)}${CODE}`],
    ["before the list", `${CODE}${LI(ITEM)}`],
    ["in another item", `<ul><li>Pw${CODE}</li><li>${ITEM}</li><li>Nw</li></ul>`],
    ["in a root quote", `<blockquote>${CODE}</blockquote>${LI(ITEM)}`],
    ["in the item itself", LI(`${ITEM}${CODE}`)],
  ];
  /** The head's clipboard for T0w@1 to T2w@2 in that item, with a code block anywhere. */
  const HEAD_HTML = "0w<blockquote><p>Q1w</p></blockquote>T2";
  const HEAD_NODES = "[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"0w\",\"type\":\"text\",\"version\":1},{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Q1w\",\"type\":\"text\",\"version\":1}],\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,}],\"format\":\"\",\"indent\":0,\"type\":\"quote\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"T2\",\"type\":\"text\",\"version\":1}]";
  const editorNodes = (data: DataTransfer) => {
    const lexical = data.getData("application/x-lexical-editor");
    return lexical === ""
      ? ""
      : JSON.stringify(JSON.parse(lexical).nodes).replace(
          /"direction":"(ltr|rtl)",?|"direction":null,?|"textFormat":\d+,?|"textStyle":"[^"]*",?/g,
          ""
        );
  };
  const selectT0toT2 = async () => {
    await clickInWord("T0w", 1);
    await userEvent.keyboard("{Shift>}");
    await clickInWord("T2w", 2);
    await userEvent.keyboard("{/Shift}");
    await settle();
  };
  const clipboard = (type: "copy" | "cut") => {
    const data = new DataTransfer();
    act(() => {
      editable()!.dispatchEvent(new ClipboardEvent(type, { bubbles: true, cancelable: true, clipboardData: data }));
    });
    return data;
  };
  test.each(PLACES)("a code block %s: the copy's text/html and editor data are the head's", async (_place, html) => {
    await renderField(html);
    await selectT0toT2();
    const data = clipboard("copy");
    expect(stored(data.getData("text/html"))).toBe(HEAD_HTML);
    expect(editorNodes(data)).toBe(HEAD_NODES);
    // F7: text/plain from the structure, a new line between the quote and the line after it
    expect(data.getData("text/plain")).toBe("0w\nQ1w\nT2");
  });
  for (const [label, html] of [
    ["no code block", LI(ITEM)],
    ["a code block in the field", `${LI(ITEM)}${CODE}`],
  ] as const) {
    test(`the scratch write fails, ${label}: a copy writes text/plain only and the assertion reports it`, async () => {
      await renderField(html);
      await selectT0toT2();
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      lineSpike.scratchClipboardFails = true;
      try {
        const data = clipboard("copy");
        expect(data.getData("text/html")).toBe("");
        expect(data.getData("application/x-lexical-editor")).toBe("");
        expect(data.getData("text/plain")).toBe("0w\nQ1w\nT2");
        expect(errors.mock.calls.some((args) => String(args[0]).includes("cms-line clipboard"))).toBe(true);
      } finally {
        lineSpike.scratchClipboardFails = false;
      }
    });
    test(`the scratch write fails, ${label}: a cut writes text/plain only and removes nothing`, async () => {
      const onChange = await renderField(html);
      await selectT0toT2();
      const calls = onChange.mock.calls.length;
      vi.spyOn(console, "error").mockImplementation(() => {});
      lineSpike.scratchClipboardFails = true;
      try {
        const data = clipboard("cut");
        await settle();
        expect(data.getData("text/html")).toBe("");
        expect(data.getData("text/plain")).toBe("0w\nQ1w\nT2");
        expect(onChange.mock.calls.length).toBe(calls);
      } finally {
        lineSpike.scratchClipboardFails = false;
      }
    });
  }
  test("a copy dispatched in an uncommitted update copies the state it runs in", async () => {
    await renderField(LI("q<hr>yq"));
    await click(editable());
    const data = new DataTransfer();
    await act(async () => {
      editorOf()!.update(() => {
        const texts = $getRoot().getAllTextNodes();
        const q = texts.find((node) => node.getTextContent() === "q")!;
        const yq = texts.find((node) => node.getTextContent() === "yq")!;
        q.setTextContent("xq");
        const range = $createRangeSelection();
        range.anchor.set(q.getKey(), 0, "text");
        range.focus.set(yq.getKey(), 2, "text");
        $setSelection(range);
        editorOf()!.dispatchCommand(COPY_COMMAND, new ClipboardEvent("copy", { clipboardData: data }));
      });
    });
    await settle();
    expect(stored(data.getData("text/html"))).toBe("<ul><li>xq<hr />yq</li></ul>");
  });
});

describe("ruled no change: a cut from code text into the line after it", () => {
  const html = LI("T0w<pre><code>C1w</code></pre>T2w");
  const select = async () => {
    await clickInWord("C1w", 1);
    await userEvent.keyboard("{Shift>}");
    await clickInWord("T2w", 1);
    await userEvent.keyboard("{/Shift}");
    await settle();
  };
  // 5.4's join: the rest of the line joins the code block
  const joined = stored(LI("T0w<pre><code>C2w</code></pre>"));
  test("the cut", async () => {
    const onChange = await renderField(html);
    await select();
    act(() => {
      editable()!.dispatchEvent(
        new ClipboardEvent("cut", { bubbles: true, cancelable: true, clipboardData: new DataTransfer() })
      );
    });
    await settle();
    expect(written(onChange)).toBe(joined);
  });
  test("one Backspace over the same range writes the same", async () => {
    const onChange = await renderField(html);
    await select();
    await keys("{Backspace}");
    expect(written(onChange)).toBe(joined);
  });
});

describe("round 14 rulings, item 2: D3's second case after a block that ends in an image", () => {
  const IMG2 = `<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />`;
  test("Backspace at T2w's start after a quote of only an image: the image stays, the caret before T2w", async () => {
    const onChange = await renderField(LI(`T0w<blockquote><p>${IMG2}</p></blockquote>T2w`));
    await clickInWord("T2w", 0);
    await keys("{Backspace}");
    expect(written(onChange)).toBe(stored(LI(`T0w<blockquote><p>${IMG2}T2w</p></blockquote>`)));
    await keys("k");
    expect(written(onChange)).toBe(stored(LI(`T0w<blockquote><p>${IMG2}kT2w</p></blockquote>`)));
  });
  test("the same after a heading of only an image", async () => {
    const onChange = await renderField(LI(`T0w<h3>${IMG2}</h3>T2w`));
    await clickInWord("T2w", 0);
    await keys("{Backspace}");
    expect(written(onChange)).toBe(stored(LI(`T0w<h3>${IMG2}T2w</h3>`)));
  });
});

/**
 * Round 14 rulings, b.2 (5.4): a removal removes what its range holds and
 * nothing else. A range whose start is an element point at the end of a
 * node with children (just after an image, a line break, inline code or
 * text at the end of a line or paragraph) to Q2w@1, forward and backward,
 * in a lined item and in ordinary content. Image is the old image, NEW an
 * uploaded one.
 */
const B2_IMG = `<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />`;
const B2_X: Record<string, string> = { image: B2_IMG, br: "<br>", code: "<code>cw</code>", text: "" };
const B2_SHAPES = {
  lined: (x: string) => LI(`<blockquote><p>Q0w</p></blockquote>T1w${x}<blockquote><p>Q2w</p></blockquote>`),
  ordinary: (x: string) => `<p>T1w${x}</p><blockquote><p>Q2w</p></blockquote>`,
};
const b2Leaves = () => {
  const out: LexicalNode[] = [];
  const walk = (node: LexicalNode) => {
    if ($isElementNode(node) && node.getChildrenSize() > 0) {
      node.getChildren().forEach(walk);
      return;
    }
    out.push(node);
  };
  walk($getRoot());
  return out;
};
/** The range from just after the edge node (`x`) at its parent's end to Q2w@1. */
const b2Select = async (x: string, direction: "fwd" | "back") => {
  await click(editable());
  await act(async () => {
    editorOf()!.update(() => {
      const leaves = b2Leaves();
      const edge =
        x === "image"
          ? leaves.find((node) => node.getType() === "cms-image")!
          : x === "br"
            ? leaves.find((node) => node.getType() === "linebreak")!
            : leaves.find((node) => node.getTextContent() === (x === "code" ? "cw" : "T1w"))!;
      const q2 = leaves.find((node) => node.getTextContent() === "Q2w")!;
      const range = $createRangeSelection();
      const [from, to] = direction === "fwd" ? [range.anchor, range.focus] : [range.focus, range.anchor];
      from.set(edge.getParentOrThrow().getKey(), edge.getIndexWithinParent() + 1, "element");
      to.set(q2.getKey(), 1, "text");
      $setSelection(range);
    });
  });
  await settle();
};
const b2Cut = async () => {
  act(() => {
    editable()!.dispatchEvent(
      new ClipboardEvent("cut", { bubbles: true, cancelable: true, clipboardData: new DataTransfer() })
    );
  });
  await settle();
};
const B2_CELLS: [keyof typeof B2_SHAPES, string, "fwd" | "back", string, string][] = [
  ["lined", "image", "fwd", "backspace", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1wIMG2w</li><li>Nw</li></ul>"],
  ["lined", "image", "fwd", "cut", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1wIMG2w</li><li>Nw</li></ul>"],
  ["lined", "image", "back", "backspace", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1wIMG2w</li><li>Nw</li></ul>"],
  ["lined", "image", "back", "cut", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1wIMG2w</li><li>Nw</li></ul>"],
  ["ordinary", "image", "fwd", "backspace", "<p>T1wIMG2w</p>"],
  ["ordinary", "image", "fwd", "cut", "<p>T1wIMG2w</p>"],
  ["ordinary", "image", "back", "backspace", "<p>T1wIMG2w</p>"],
  ["ordinary", "image", "back", "cut", "<p>T1wIMG2w</p>"],
  ["lined", "br", "fwd", "backspace", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<br />2w</li><li>Nw</li></ul>"],
  ["lined", "br", "fwd", "cut", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<br />2w</li><li>Nw</li></ul>"],
  ["lined", "br", "back", "backspace", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<br />2w</li><li>Nw</li></ul>"],
  ["lined", "br", "back", "cut", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<br />2w</li><li>Nw</li></ul>"],
  ["ordinary", "br", "fwd", "backspace", "<p>T1w<br />2w</p>"],
  ["ordinary", "br", "fwd", "cut", "<p>T1w<br />2w</p>"],
  ["ordinary", "br", "back", "backspace", "<p>T1w<br />2w</p>"],
  ["ordinary", "br", "back", "cut", "<p>T1w<br />2w</p>"],
  ["lined", "code", "fwd", "backspace", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<code>cw</code>2w</li><li>Nw</li></ul>"],
  ["lined", "code", "fwd", "cut", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<code>cw</code>2w</li><li>Nw</li></ul>"],
  ["lined", "code", "back", "backspace", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<code>cw</code>2w</li><li>Nw</li></ul>"],
  ["lined", "code", "back", "cut", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<code>cw</code>2w</li><li>Nw</li></ul>"],
  ["ordinary", "code", "fwd", "backspace", "<p>T1w<code>cw</code>2w</p>"],
  ["ordinary", "code", "fwd", "cut", "<p>T1w<code>cw</code>2w</p>"],
  ["ordinary", "code", "back", "backspace", "<p>T1w<code>cw</code>2w</p>"],
  ["ordinary", "code", "back", "cut", "<p>T1w<code>cw</code>2w</p>"],
  ["lined", "text", "fwd", "backspace", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w2w</li><li>Nw</li></ul>"],
  ["lined", "text", "fwd", "cut", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w2w</li><li>Nw</li></ul>"],
  ["lined", "text", "back", "backspace", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w2w</li><li>Nw</li></ul>"],
  ["lined", "text", "back", "cut", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w2w</li><li>Nw</li></ul>"],
  ["ordinary", "text", "fwd", "backspace", "<p>T1w2w</p>"],
  ["ordinary", "text", "fwd", "cut", "<p>T1w2w</p>"],
  ["ordinary", "text", "back", "backspace", "<p>T1w2w</p>"],
  ["ordinary", "text", "back", "cut", "<p>T1w2w</p>"],
];
const b2Write = (onChange: Parameters<typeof lastHtml>[0]) =>
  written(onChange)
    .replace(/<img[^>]*x\.png[^>]*>/g, "IMG")
    .replace(/<img[^>]*y\.png[^>]*>/g, "NEW");

describe("round 14 rulings, b.2: a removal removes what its range holds", () => {
  test.each(B2_CELLS)("%s, %s at the end, %s, %s", async (shape, x, direction, action, expected) => {
    const onChange = await renderField(B2_SHAPES[shape](B2_X[x]));
    await b2Select(x, direction);
    if (action === "cut") {
      await b2Cut();
    } else {
      await keys("{Backspace}");
    }
    expect(b2Write(onChange)).toBe(expected);
  });
  const LINED = B2_SHAPES.lined(B2_IMG);
  test("lined, Delete: the image stays", async () => {
    const onChange = await renderField(LINED);
    await b2Select("image", "fwd");
    await keys("{Delete}");
    expect(b2Write(onChange)).toBe(stored(LI("<blockquote><p>Q0w</p></blockquote>T1wIMG2w")));
  });
  test("lined, Enter: the image stays, the rest a new item", async () => {
    const onChange = await renderField(LINED);
    await b2Select("image", "fwd");
    await keys("{Enter}");
    expect(b2Write(onChange)).toBe("<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1wIMG</li><li>2w</li><li>Nw</li></ul>");
  });
  test("lined, Image: the old image stays and the new one follows it", async () => {
    const source = {
      uploadImage: vi.fn(async () => ({ url: "https://cdn.example.org/y.png", path: "org/y.png" })),
    } as never;
    const onChange = await renderField(LINED, { source });
    await b2Select("image", "fwd");
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 3;
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((result) => resolve(result!), "image/png"));
    await act(async () => {
      byLabel("Image")!.click();
    });
    const input = editable()!.closest("div")!.ownerDocument.querySelector<HTMLInputElement>('input[type="file"]')!;
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "a.png", { type: "image/png" }));
    await act(async () => {
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    for (let round = 0; round < 20; round += 1) {
      await settle();
    }
    expect(b2Write(onChange)).toBe("<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1wIMGNEW2w</li><li>Nw</li></ul>");
  });
});

describe("the caret's move into text inside a delete", () => {
  const lineForm = async () => {
    act(() => {
      editable()!.dispatchEvent(
        new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "deleteSoftLineForward" })
      );
    });
    await settle();
  };
  const FORMS: [string, () => Promise<void>][] = [
    ["Delete", () => keys("{Delete}")],
    ["the word form", () => keys("{Control>}{Delete}{/Control}")],
    ["the line form", lineForm],
  ];
  /** D7's state: direction and empty lines left out. */
  const d7 = () => {
    const strip = (node: Record<string, unknown>): Record<string, unknown> => {
      const { direction: _direction, ...rest } = node;
      if (Array.isArray(rest.children)) {
        rest.children = (rest.children as Record<string, unknown>[])
          .filter((child) => (child.type === "cms-line" && (child.children as unknown[]).length === 0) === false)
          .map(strip);
      }
      return rest;
    };
    return JSON.stringify(strip(editorOf()!.getEditorState().toJSON().root as unknown as Record<string, unknown>));
  };
  const emptyTexts = () =>
    editorOf()!
      .getEditorState()
      .read(() => $getRoot().getAllTextNodes().filter((node) => node.getTextContent() === "").length);

  test("the cell that hung at b9c3ad75b: a line-led item, the line form after an image ending a quote, then a line", async () => {
    const onChange = await renderField(LI(`T0w<blockquote><p>X0w${E_IMG}</p></blockquote>T1w`));
    await caretAfterImage();
    const calls = onChange.mock.calls.length;
    const started = performance.now();
    await lineForm();
    expect(performance.now() - started).toBeLessThan(2000);
    // the twin: the line form at the end of a block has nothing to remove
    expect(onChange.mock.calls.length).toBe(calls);
  });

  const AT_CONTENT_END: [string, string][] = [
    ["a lined item", `<ul><li>Pw</li><li><blockquote><p>X0w${E_IMG}</p></blockquote></li></ul>`],
    ["ordinary content", `<blockquote><p>X0w${E_IMG}</p></blockquote>`],
  ];
  for (const [where, html] of AT_CONTENT_END) {
    for (const [name, form] of FORMS) {
      test(`at the content's end, ${where}, ${name}: no onChange, no undo step, nothing left behind`, async () => {
        const onChange = await renderField(html);
        await clickInWord("X0w");
        await keys("a");
        const typed = written(onChange);
        await caretAfterImage();
        const before = d7();
        const calls = onChange.mock.calls.length;
        await form();
        expect(onChange.mock.calls.length).toBe(calls);
        expect(emptyTexts()).toBe(0);
        expect(d7()).toBe(before);
        expect(typed).toBe(stored(html.replace("X0w", "X0wa")));
        await keys("{Control>}z{/Control}");
        expect(written(onChange)).toBe(stored(html));
      });
      test(`at the content's end, ${where}, ${name}: the caret stays after the image`, async () => {
        const onChange = await renderField(html);
        await caretAfterImage();
        await form();
        await keys("k");
        expect(written(onChange)).toBe(stored(html.replace(`${E_IMG}`, `${E_IMG}k`)));
      });
    }
  }
  test("a caret just after an image with text after it: Delete takes the next character", async () => {
    const onChange = await renderField(LI(`T0w${E_IMG}T1w`));
    await caretAfterImage();
    await keys("{Delete}");
    expect(written(onChange)).toBe(stored(LI(`T0w${E_IMG}1w`)));
  });
  test("Backspace just after an image that ends a quote's paragraph removes the image", async () => {
    const onChange = await renderField(LI(`<blockquote><p>X0w${E_IMG}</p></blockquote>T1w`));
    await caretAfterImage();
    await keys("{Backspace}");
    expect(written(onChange)).toBe(stored(LI("<blockquote><p>X0w</p></blockquote>T1w")));
  });
});

/**
 * Round 14 rulings, the mirror: a caret just before an image that starts its
 * block or line is that block's or line's start. Backspace, the word form and
 * the line form there do what they do at the start of the same block
 * starting with a word (the twin: the image replaced by the word Zw, the
 * caret before it). The write in the twin's form: the image written as Zw.
 */
const M_STARTS: Record<string, (x: string) => string> = {
  quote: (x) => `<blockquote><p>${x}X0w</p></blockquote>`,
  heading: (x) => `<h3>${x}X0w</h3>`,
  line: (x) => `${x}X1w`,
};
const M_ORDINARY_STARTS: Record<string, (x: string) => string> = {
  quote: (x) => `<blockquote><p>${x}X0w</p></blockquote>`,
  heading: (x) => `<h3>${x}X0w</h3>`,
  line: (x) => `<p>${x}X1w</p>`,
};
const M_LINED_BEFORE: Record<string, string> = {
  line: "T0w<br>",
  block: "<blockquote><p>B0w</p></blockquote>",
  rule: "<hr>",
  itemStart: "",
  contentStart: "",
};
const M_ORDINARY_BEFORE: Record<string, string> = {
  line: "<p>T0w</p>",
  block: "<blockquote><p>B0w</p></blockquote>",
  rule: "<hr>",
  contentStart: "",
};
const mShape = (context: string, start: string, before: string) => {
  if (context === "ordinary") {
    return `${M_ORDINARY_BEFORE[before]}${M_ORDINARY_STARTS[start](E_IMG)}<p>Ew</p>`;
  }
  const inner = `${context === "lineLed" && before !== "line" ? "T9w<br>" : ""}${M_LINED_BEFORE[before]}${M_STARTS[start](E_IMG)}`;
  return before === "contentStart"
    ? `<ul><li>${inner}</li><li>Nw</li></ul>`
    : `<ul><li>Pw</li><li>${inner}</li><li>Nw</li></ul>`;
};
/** The caret just before the image, by structure: the element point at its index. */
const caretBeforeImage = async () => {
  await click(editable());
  await act(async () => {
    editorOf()!.update(() => {
      const image = b2Leaves().find((node) => node.getType() === "cms-image")!;
      const parent = image.getParentOrThrow();
      const range = $createRangeSelection();
      range.anchor.set(parent.getKey(), image.getIndexWithinParent(), "element");
      range.focus.set(parent.getKey(), image.getIndexWithinParent(), "element");
      $setSelection(range);
    });
  });
  await settle();
};
const backwardForm = async (form: string) => {
  if (form === "line") {
    act(() => {
      editable()!.dispatchEvent(
        new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "deleteSoftLineBackward" })
      );
    });
    await settle();
    return;
  }
  await keys(form === "bs" ? "{Backspace}" : "{Control>}{Backspace}{/Control}");
};
const M_CELLS: [string, string, string, string, string][] = [
  ["blockLed", "quote", "line", "bs", "<ul><li>Pw</li><li>T0w<blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "line", "word", "<ul><li>Pw</li><li>T0w<blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "line", "line", "<ul><li>Pw</li><li>T0w<blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "block", "bs", "<ul><li>Pw</li><li><blockquote><p>B0wZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "block", "word", "<ul><li>Pw</li><li><blockquote><p>B0wZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "block", "line", "<ul><li>Pw</li><li><blockquote><p>B0wZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "rule", "bs", "<ul><li>Pw</li><li><blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "rule", "word", "<ul><li>Pw</li><li><blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "rule", "line", "<ul><li>Pw</li><li><blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "quote", "itemStart", "bs", "<ul><li>PwZwX0w</li><li>Nw</li></ul>"],
  ["blockLed", "quote", "itemStart", "word", "<ul><li>PwZwX0w</li><li>Nw</li></ul>"],
  ["blockLed", "quote", "itemStart", "line", "<ul><li>PwZwX0w</li><li>Nw</li></ul>"],
  ["blockLed", "quote", "contentStart", "bs", "NOOP"],
  ["blockLed", "quote", "contentStart", "word", "NOOP"],
  ["blockLed", "quote", "contentStart", "line", "NOOP"],
  ["blockLed", "heading", "line", "bs", "<ul><li>Pw</li><li>T0w<h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "line", "word", "<ul><li>Pw</li><li>T0w<h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "line", "line", "<ul><li>Pw</li><li>T0w<h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "block", "bs", "<ul><li>Pw</li><li><blockquote><p>B0wZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "block", "word", "<ul><li>Pw</li><li><blockquote><p>B0wZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "block", "line", "<ul><li>Pw</li><li><blockquote><p>B0wZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "rule", "bs", "<ul><li>Pw</li><li><h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "rule", "word", "<ul><li>Pw</li><li><h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "rule", "line", "<ul><li>Pw</li><li><h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["blockLed", "heading", "itemStart", "bs", "<ul><li>PwZwX0w</li><li>Nw</li></ul>"],
  ["blockLed", "heading", "itemStart", "word", "<ul><li>PwZwX0w</li><li>Nw</li></ul>"],
  ["blockLed", "heading", "itemStart", "line", "<ul><li>PwZwX0w</li><li>Nw</li></ul>"],
  ["blockLed", "heading", "contentStart", "bs", "NOOP"],
  ["blockLed", "heading", "contentStart", "word", "NOOP"],
  ["blockLed", "heading", "contentStart", "line", "NOOP"],
  ["blockLed", "line", "line", "bs", "<ul><li>Pw</li><li>T0wZwX1w</li><li>Nw</li></ul>"],
  ["blockLed", "line", "line", "word", "<ul><li>Pw</li><li>T0wZwX1w</li><li>Nw</li></ul>"],
  ["blockLed", "line", "line", "line", "<ul><li>Pw</li><li>T0wZwX1w</li><li>Nw</li></ul>"],
  ["blockLed", "line", "block", "bs", "<ul><li>Pw</li><li><blockquote><p>B0wZwX1w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "line", "block", "word", "<ul><li>Pw</li><li><blockquote><p>B0wZwX1w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "line", "block", "line", "<ul><li>Pw</li><li><blockquote><p>B0wZwX1w</p></blockquote></li><li>Nw</li></ul>"],
  ["blockLed", "line", "rule", "bs", "<ul><li>Pw</li><li>ZwX1w</li><li>Nw</li></ul>"],
  ["blockLed", "line", "rule", "word", "<ul><li>Pw</li><li>ZwX1w</li><li>Nw</li></ul>"],
  ["blockLed", "line", "rule", "line", "<ul><li>Pw</li><li>ZwX1w</li><li>Nw</li></ul>"],
  ["blockLed", "line", "itemStart", "bs", "<ul><li>PwZwX1w</li><li>Nw</li></ul>"],
  ["blockLed", "line", "itemStart", "word", "<ul><li>PwZwX1w</li><li>Nw</li></ul>"],
  ["blockLed", "line", "itemStart", "line", "<ul><li>PwZwX1w</li><li>Nw</li></ul>"],
  ["blockLed", "line", "contentStart", "bs", "<p>ZwX1w</p><ul><li>Nw</li></ul>"],
  ["blockLed", "line", "contentStart", "word", "NOOP"],
  ["blockLed", "line", "contentStart", "line", "NOOP"],
  ["lineLed", "quote", "line", "bs", "<ul><li>Pw</li><li>T0w<blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "line", "word", "<ul><li>Pw</li><li>T0w<blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "line", "line", "<ul><li>Pw</li><li>T0w<blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "block", "bs", "<ul><li>Pw</li><li>T9w<br /><blockquote><p>B0wZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "block", "word", "<ul><li>Pw</li><li>T9w<br /><blockquote><p>B0wZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "block", "line", "<ul><li>Pw</li><li>T9w<br /><blockquote><p>B0wZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "rule", "bs", "<ul><li>Pw</li><li>T9w<br /><blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "rule", "word", "<ul><li>Pw</li><li>T9w<br /><blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "rule", "line", "<ul><li>Pw</li><li>T9w<br /><blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "itemStart", "bs", "<ul><li>Pw</li><li>T9w<blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "itemStart", "word", "<ul><li>Pw</li><li>T9w<blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "itemStart", "line", "<ul><li>Pw</li><li>T9w<blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "contentStart", "bs", "<ul><li>T9w<blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "contentStart", "word", "<ul><li>T9w<blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "quote", "contentStart", "line", "<ul><li>T9w<blockquote><p>ZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "line", "bs", "<ul><li>Pw</li><li>T0w<h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "line", "word", "<ul><li>Pw</li><li>T0w<h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "line", "line", "<ul><li>Pw</li><li>T0w<h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "block", "bs", "<ul><li>Pw</li><li>T9w<br /><blockquote><p>B0wZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "block", "word", "<ul><li>Pw</li><li>T9w<br /><blockquote><p>B0wZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "block", "line", "<ul><li>Pw</li><li>T9w<br /><blockquote><p>B0wZwX0w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "rule", "bs", "<ul><li>Pw</li><li>T9w<br /><h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "rule", "word", "<ul><li>Pw</li><li>T9w<br /><h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "rule", "line", "<ul><li>Pw</li><li>T9w<br /><h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "itemStart", "bs", "<ul><li>Pw</li><li>T9w<h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "itemStart", "word", "<ul><li>Pw</li><li>T9w<h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "itemStart", "line", "<ul><li>Pw</li><li>T9w<h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "contentStart", "bs", "<ul><li>T9w<h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "contentStart", "word", "<ul><li>T9w<h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "heading", "contentStart", "line", "<ul><li>T9w<h3>ZwX0w</h3></li><li>Nw</li></ul>"],
  ["lineLed", "line", "line", "bs", "<ul><li>Pw</li><li>T0wZwX1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "line", "word", "<ul><li>Pw</li><li>T0wZwX1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "line", "line", "<ul><li>Pw</li><li>T0wZwX1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "block", "bs", "<ul><li>Pw</li><li>T9w<br /><blockquote><p>B0wZwX1w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "line", "block", "word", "<ul><li>Pw</li><li>T9w<br /><blockquote><p>B0wZwX1w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "line", "block", "line", "<ul><li>Pw</li><li>T9w<br /><blockquote><p>B0wZwX1w</p></blockquote></li><li>Nw</li></ul>"],
  ["lineLed", "line", "rule", "bs", "<ul><li>Pw</li><li>T9w<br />ZwX1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "rule", "word", "<ul><li>Pw</li><li>T9w<br />ZwX1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "rule", "line", "<ul><li>Pw</li><li>T9w<br />ZwX1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "itemStart", "bs", "<ul><li>Pw</li><li>T9wZwX1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "itemStart", "word", "<ul><li>Pw</li><li>T9wZwX1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "itemStart", "line", "<ul><li>Pw</li><li>T9wZwX1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "contentStart", "bs", "<ul><li>T9wZwX1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "contentStart", "word", "<ul><li>T9wZwX1w</li><li>Nw</li></ul>"],
  ["lineLed", "line", "contentStart", "line", "<ul><li>T9wZwX1w</li><li>Nw</li></ul>"],
  ["ordinary", "quote", "line", "bs", "<p>T0wZwX0w</p><p>Ew</p>"],
  ["ordinary", "quote", "line", "word", "<p>T0wZwX0w</p><p>Ew</p>"],
  ["ordinary", "quote", "line", "line", "<p>T0wZwX0w</p><p>Ew</p>"],
  ["ordinary", "quote", "block", "bs", "<blockquote><p>B0wZwX0w</p></blockquote><p>Ew</p>"],
  ["ordinary", "quote", "block", "word", "<blockquote><p>B0wZwX0w</p></blockquote><p>Ew</p>"],
  ["ordinary", "quote", "block", "line", "<blockquote><p>B0wZwX0w</p></blockquote><p>Ew</p>"],
  ["ordinary", "quote", "rule", "bs", "NOOP"],
  ["ordinary", "quote", "rule", "word", "NOOP"],
  ["ordinary", "quote", "rule", "line", "NOOP"],
  ["ordinary", "quote", "contentStart", "bs", "NOOP"],
  ["ordinary", "quote", "contentStart", "word", "NOOP"],
  ["ordinary", "quote", "contentStart", "line", "NOOP"],
  ["ordinary", "heading", "line", "bs", "<p>T0wZwX0w</p><p>Ew</p>"],
  ["ordinary", "heading", "line", "word", "<p>T0wZwX0w</p><p>Ew</p>"],
  ["ordinary", "heading", "line", "line", "<p>T0wZwX0w</p><p>Ew</p>"],
  ["ordinary", "heading", "block", "bs", "<blockquote><p>B0wZwX0w</p></blockquote><p>Ew</p>"],
  ["ordinary", "heading", "block", "word", "<blockquote><p>B0wZwX0w</p></blockquote><p>Ew</p>"],
  ["ordinary", "heading", "block", "line", "<blockquote><p>B0wZwX0w</p></blockquote><p>Ew</p>"],
  ["ordinary", "heading", "rule", "bs", "<h3>ZwX0w</h3><p>Ew</p>"],
  ["ordinary", "heading", "rule", "word", "<h3>ZwX0w</h3><p>Ew</p>"],
  ["ordinary", "heading", "rule", "line", "<h3>ZwX0w</h3><p>Ew</p>"],
  ["ordinary", "heading", "contentStart", "bs", "NOOP"],
  ["ordinary", "heading", "contentStart", "word", "NOOP"],
  ["ordinary", "heading", "contentStart", "line", "NOOP"],
  ["ordinary", "line", "line", "bs", "<p>T0wZwX1w</p><p>Ew</p>"],
  ["ordinary", "line", "line", "word", "<p>T0wZwX1w</p><p>Ew</p>"],
  ["ordinary", "line", "line", "line", "<p>T0wZwX1w</p><p>Ew</p>"],
  ["ordinary", "line", "block", "bs", "<blockquote><p>B0wZwX1w</p></blockquote><p>Ew</p>"],
  ["ordinary", "line", "block", "word", "<blockquote><p>B0wZwX1w</p></blockquote><p>Ew</p>"],
  ["ordinary", "line", "block", "line", "<blockquote><p>B0wZwX1w</p></blockquote><p>Ew</p>"],
  ["ordinary", "line", "rule", "bs", "<p>ZwX1w</p><p>Ew</p>"],
  ["ordinary", "line", "rule", "word", "<p>ZwX1w</p><p>Ew</p>"],
  ["ordinary", "line", "rule", "line", "<p>ZwX1w</p><p>Ew</p>"],
  ["ordinary", "line", "contentStart", "bs", "NOOP"],
  ["ordinary", "line", "contentStart", "word", "NOOP"],
  ["ordinary", "line", "contentStart", "line", "NOOP"],
];

describe("a caret just before an image that starts its block or line is its start", () => {
  test.each(M_CELLS)("%s, %s after %s, %s", async (context, start, before, form, expected) => {
    const html = mShape(context, start, before);
    const onChange = await renderField(html);
    await caretBeforeImage();
    await backwardForm(form);
    const write = lastHtml(onChange) === "" ? "NOOP" : written(onChange);
    expect(write === stored(html) ? "NOOP" : write.replace(/<img[^>]*>/g, "Zw")).toBe(expected);
  });
  const AT_CONTENT_START: [string, string][] = [
    ["ordinary content", `<p>${E_IMG}X1w</p><p>Ew</p>`],
    ["a heading at the content's start", `<h3>${E_IMG}X0w</h3><p>Ew</p>`],
  ];
  const emptyTexts = () =>
    editorOf()!
      .getEditorState()
      .read(() => $getRoot().getAllTextNodes().filter((node) => node.getTextContent() === "").length);
  for (const [where, html] of AT_CONTENT_START) {
    // Backspace at a heading at the content's start fires an onChange with
    // the same value in the twin too (Lexical's own collapse at start)
    for (const form of where.startsWith("a heading") ? ["word", "line"] : ["bs", "word", "line"]) {
      test(`at the content's start, ${where}, ${form}: no onChange, no undo step, nothing left behind`, async () => {
        const onChange = await renderField(html);
        await clickInWord("Ew");
        await keys("a");
        await caretBeforeImage();
        const before = JSON.stringify(editorOf()!.getEditorState().toJSON());
        const calls = onChange.mock.calls.length;
        await backwardForm(form);
        expect(onChange.mock.calls.length).toBe(calls);
        expect(emptyTexts()).toBe(0);
        expect(JSON.stringify(editorOf()!.getEditorState().toJSON())).toBe(before);
        await keys("{Control>}z{/Control}");
        expect(written(onChange)).toBe(stored(html));
      });
    }
  }
  test("a backward delete that takes the break before the image leaves no empty text behind", async () => {
    const onChange = await renderField(mShape("blockLed", "line", "line"));
    await caretBeforeImage();
    await backwardForm("line");
    expect(written(onChange).replace(/<img[^>]*>/g, "Zw")).toBe("<ul><li>Pw</li><li>T0wZwX1w</li><li>Nw</li></ul>");
    expect(emptyTexts()).toBe(0);
  });
});

describe("14.9 (b): every cut checks that its clipboard holds its selection", () => {
  const html = LI("T0w<blockquote><p>Q1w</p></blockquote>T2w");
  const select = async () => {
    await clickInWord("T0w", 1);
    await userEvent.keyboard("{Shift>}");
    await clickInWord("T2w", 2);
    await userEvent.keyboard("{/Shift}");
    await settle();
  };
  const cut = () => {
    const data = new DataTransfer();
    act(() => {
      editable()!.dispatchEvent(new ClipboardEvent("cut", { bubbles: true, cancelable: true, clipboardData: data }));
    });
    return data;
  };
  test("a clipboard that holds the selection: the cut writes it and removes the range", async () => {
    const onChange = await renderField(html);
    await select();
    const data = cut();
    await settle();
    expect(data.getData("application/x-lexical-editor")).not.toBe("");
    expect(written(onChange)).toBe(stored(LI("Tw")));
  });
  test("a clipboard that does not: the assertion reports it, text/plain only, nothing removed", async () => {
    const onChange = await renderField(html);
    await select();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls = onChange.mock.calls.length;
    lineSpike.cutCheckFails = true;
    try {
      const data = cut();
      await settle();
      expect(data.getData("text/html")).toBe("");
      expect(data.getData("application/x-lexical-editor")).toBe("");
      expect(data.getData("text/plain")).toBe("0w\nQ1w\nT2");
      expect(onChange.mock.calls.length).toBe(calls);
      expect(errors.mock.calls.some((args) => String(args[0]).includes("does not hold its selection"))).toBe(true);
    } finally {
      lineSpike.cutCheckFails = false;
    }
  });
});
