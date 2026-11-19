// SPIKE: Q5 (history) and Q6 (the edges of a line), by real input.
import { describe, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { $getSelection, $isRangeSelection } from "lexical";
import {
  byLabel,
  click,
  clickInWord,
  editable,
  editorOf,
  lastHtml,
  mountAt,
  paste,
  renderField,
  settle,
  undo,
} from "./rich-text-test-harness";
import {
  clearRichTextReadOnlyMemo,
  getRichTextReadOnlyReason,
  writeRichTextHeadless,
} from "./rich-text-html";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";

const G1 = "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>";
const hasLines = () =>
  JSON.stringify(editorOf()!.getEditorState().toJSON()).includes("cms-line");
const caret = () =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) === false) return "none";
      const node = selection.anchor.getNode();
      return `${selection.anchor.type}:${node.getType()}:${node.getTextContent().slice(0, 8)}@${selection.anchor.offset}`;
    });
const quiet = () => {
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    const text = String(args[0]);
    if (text.startsWith("Warning: An update") === false) errors.push(text.slice(0, 200));
  });
  return errors;
};
const log = (record: object) => console.log(`Q56 ${JSON.stringify(record)}`);
const fixed = (html: string) => {
  clearRichTextReadOnlyMemo();
  const stored = sanitizeRichTextHtml(html);
  let rewritten = "";
  try {
    rewritten = sanitizeRichTextHtml(writeRichTextHeadless(stored));
  } catch (error) {
    rewritten = `THROW ${String(error)}`;
  }
  return {
    reason: getRichTextReadOnlyReason(stored) ?? "editable",
    fixedPoint: rewritten === stored,
  };
};

describe("Q5 history", () => {
  test("mount, Ctrl+Z five times, then the group 1 Backspace", async () => {
    const errors = quiet();
    const onChange = await renderField(G1);
    await clickInWord("T2w", 0);
    const linesBefore = hasLines();
    for (let i = 0; i < 5; i += 1) await undo();
    const afterUndo = { calls: onChange.mock.calls.length, lines: hasLines(), caret: caret() };
    await clickInWord("T2w", 0);
    await userEvent.keyboard("{Backspace}");
    await settle();
    log({ q: "Q5a", linesBefore, afterUndo, calls: onChange.mock.calls.length, html: lastHtml(onChange), caret: caret(), errors });
  });
  test("mount, one letter, Ctrl+Z twice, redo", async () => {
    const errors = quiet();
    const onChange = await renderField(G1);
    await clickInWord("T2w", 1);
    await userEvent.keyboard("k");
    await settle();
    const typed = lastHtml(onChange);
    await undo();
    const once = { calls: onChange.mock.calls.length, html: lastHtml(onChange), lines: hasLines(), caret: caret() };
    await undo();
    const twice = { calls: onChange.mock.calls.length, html: lastHtml(onChange), lines: hasLines(), caret: caret() };
    await userEvent.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    await settle();
    log({ q: "Q5b", typed, once, twice, redo: { html: lastHtml(onChange), lines: hasLines(), caret: caret() }, errors });
  });
});

type Edge = [name: string, html: string, place: () => Promise<void>, act: () => Promise<void>];
const key = (k: string) => async () => {
  await userEvent.keyboard(k);
  await settle();
};
const QT = "<ul><li><blockquote>Q0w</blockquote>T1w</li><li>Nw</li></ul>";
const nested = (depth: number, inner: string) => {
  let html = inner;
  for (let level = depth; level >= 1; level -= 1) {
    html = level === depth ? `<ul><li>${html}</li></ul>` : `<ul><li>s${level}${html}</li></ul>`;
  }
  return html;
};
const EDGES: Edge[] = [
  ["an empty line after a block", QT, async () => {
    await clickInWord("T1w");
    await userEvent.keyboard("{Shift>}{Home}{/Shift}");
    await settle();
  }, key("{Backspace}")],
  ["a line of one line break", QT, async () => {
    await clickInWord("T1w");
    await userEvent.keyboard("{Shift>}{Home}{/Shift}");
    await settle();
  }, key("{Shift>}{Enter}{/Shift}")],
  ["a line of two line breaks", QT, async () => {
    await clickInWord("T1w");
    await userEvent.keyboard("{Shift>}{Home}{/Shift}");
    await settle();
  }, key("{Shift>}{Enter}{Enter}{/Shift}")],
  ["text with a trailing line break", QT, () => clickInWord("T1w"), key("{Shift>}{Enter}{/Shift}")],
  ["a line of white space", QT, async () => {
    await clickInWord("T1w");
    await userEvent.keyboard("{Shift>}{Home}{/Shift}");
    await settle();
  }, key(" ")],
  ["a line of only a link", '<ul><li><blockquote>Q0w</blockquote><a href="https://example.org/">T1w</a></li></ul>', () => clickInWord("T1w"), key("{End}")],
  ["a line in a quote in an item at depth 2, letter and Enter", "<ul><li>Aw<ul><li><blockquote>Xw<ul><li>Yw</li></ul>Zw</blockquote></li></ul></li></ul>", () => clickInWord("Zw"), key("k{Enter}m")],
  ...[6, 7].flatMap((depth): Edge[] => {
    const html = nested(depth, "T0w<blockquote>Q1w</blockquote>T2w");
    return [
      [`depth ${depth} Bulleted`, html, () => clickInWord("T0w", 1), () => click(byLabel("Bulleted list"))],
      [`depth ${depth} Block type Quote`, html, () => clickInWord("T2w", 1), async () => {
        await click(byLabel("Block type"));
        await click([...document.querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent === "Quote"));
      }],
      [`depth ${depth} Enter`, html, () => clickInWord("T0w"), key("{Enter}")],
      [`depth ${depth} list paste`, html, () => clickInWord("T0w"), async () => {
        paste({ "text/html": "<ul><li>Aq</li><li>Bq<blockquote>Cq</blockquote></li></ul>", "text/plain": "x" });
        await settle();
      }],
    ];
  }),
];

describe("Q6 edges", () => {
  for (const [name, html, place, act] of EDGES) {
    test(name, async () => {
      const errors = quiet();
      const stored = sanitizeRichTextHtml(html);
      const mounted = fixed(stored);
      const onChange = await renderField(stored);
      await place();
      onChange.mockClear();
      await act();
      editable()!.focus();
      const written = onChange.mock.calls.length > 0 ? sanitizeRichTextHtml(lastHtml(onChange)) : stored;
      log({ q: "Q6", name, mounted, calls: onChange.mock.calls.length, written, ...fixed(written), errors });
      void mountAt;
    }, 30_000);
  }
});
