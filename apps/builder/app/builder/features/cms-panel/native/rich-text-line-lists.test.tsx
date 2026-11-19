// SPIKE: lists, toolbar and clipboard over items that hold lines.
import { describe, expect, test, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import {
  byLabel,
  click,
  clickInWord,
  editable,
  editorOf,
  lastHtml,
  mountAt,
  paste,
  readingOrder,
  renderField,
  settle,
  undo,
} from "./rich-text-test-harness";
import {
  clearRichTextReadOnlyMemo,
  getRichTextReadOnlyReason,
} from "./rich-text-html";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";

const blockType = async (name: string) => {
  await click(byLabel("Block type"));
  await click(
    [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (option) => option.textContent === name
    )
  );
};

let clip: DataTransfer | undefined;
const copy = async () => {
  clip = new DataTransfer();
  await act(async () => {
    editable()!.dispatchEvent(
      new ClipboardEvent("copy", {
        bubbles: true,
        cancelable: true,
        clipboardData: clip,
      })
    );
  });
  await settle();
};
const pasteClip = async (formats: string[]) => {
  const data: Record<string, string> = {};
  for (const format of formats) {
    data[format] = clip!.getData(format);
  }
  paste(data);
  await settle();
};

type Step = () => Promise<void>;
type Probe = [name: string, html: string, place: Step | [string, number, string, number], act: Step];
const keys = (k: string): Step => async () => {
  await userEvent.keyboard(k);
  await settle();
};
const caret = (word: string, at?: number): Step => () => clickInWord(word, at);

const MIX = "<ul><li>Pw</li><li>T0w<blockquote>Q1w</blockquote>T2w</li><li>Nw</li></ul>";
const NESTED = "<ul><li>Aw<ul><li>T0w<blockquote>Q1w</blockquote></li><li>Bw</li></ul></li></ul>";

const PROBES: Probe[] = [
  ["6.1 Enter twice at a quote's end in a mixed item (Enter in an empty line)", "<ul><li><blockquote>Q0w</blockquote>T1w</li><li>Nw</li></ul>", caret("Q0w"), keys("{Enter}{Enter}")],
  ["6.1b Enter at the end of a line before a quote, twice", MIX, caret("T0w"), keys("{Enter}{Enter}")],
  ["6.1c Enter at the end of T2w (last line), twice", MIX, caret("T2w"), keys("{Enter}{Enter}")],
  ["6.2 Backspace at the first line of the first item", "<ul><li>T0w<blockquote>Q1w</blockquote>T2w</li><li>Nw</li></ul>", caret("T0w", 0), keys("{Backspace}")],
  ["6.3 outdent of a nested mixed item", NESTED, caret("T0w", 1), keys("{Shift>}{Tab}{/Shift}")],
  ["6.3b indent of a mixed item", MIX, caret("T0w", 1), keys("{Tab}")],
  ["6.4 bulleted list off over a mixed item", MIX, caret("T0w", 1), () => click(byLabel("Bulleted list"))],
  ["6.4b numbered list switch over a mixed item", MIX, caret("T0w", 1), () => click(byLabel("Numbered list"))],
  ["6.4c bulleted list on over a mixed quote's line", "<blockquote>T0w<h3>H1w</h3></blockquote>", caret("T0w", 1), () => click(byLabel("Bulleted list"))],
  ["6.4d bulleted list off, range over two mixed items", "<ul><li>T0w<hr>T1w</li><li>T2w<blockquote>Q3w</blockquote></li></ul>", ["T0w", 1, "Q3w", 1], () => click(byLabel("Bulleted list"))],
  ["6.5 Block type Heading 2 in a line", MIX, caret("T0w", 1), () => blockType("Heading 2")],
  ["6.5b Block type Quote in a line", MIX, caret("T2w", 1), () => blockType("Quote")],
  ["6.5c Block type in an item inside a text-led quote (B)", "<blockquote>Xw<ul><li>Aw</li></ul>Yw</blockquote>", caret("Aw", 1), () => blockType("Heading 2")],
  ["6.5d Block type Paragraph in a quote's line", "<blockquote>Xw<ul><li>Aw</li></ul>Yw</blockquote>", caret("Xw", 1), () => blockType("Paragraph")],
  ["6.6 Divider at the end of a line", MIX, caret("T0w"), () => click(byLabel("Divider"))],
  ["6.6b Divider in the middle of a line", MIX, caret("T2w", 1), () => click(byLabel("Divider"))],
  ["6.7 paste two paragraphs into a nested mixed item's line", NESTED, caret("T0w"), async () => {
    paste({ "text/html": "<p>one</p><p>two</p>", "text/plain": "x" });
    await settle();
  }],
  ["6.7b paste a list into a nested mixed item's line", NESTED, caret("T0w"), async () => {
    paste({ "text/html": "<ul><li>one</li><li>two<blockquote>q</blockquote></li></ul>", "text/plain": "x" });
    await settle();
  }],
  ["6.7c paste a quote then text into a line (block after nested list)", "<ul><li>Aw<ul><li>Bw</li></ul></li></ul>", caret("Bw"), async () => {
    paste({ "text/html": "<blockquote>q</blockquote>tail", "text/plain": "x" });
    await settle();
  }],
  ["7.1 copy a mixed item, paste at the end of Nw (same field, lexical data)", MIX, ["T0w", 0, "T2w", 3], async () => {
    await copy();
    await clickInWord("Nw");
    await pasteClip(["application/x-lexical-editor", "text/html", "text/plain"]);
  }],
  ["7.2 copy a mixed item, paste into an ordinary item (Pw end)", MIX, ["T0w", 0, "T2w", 3], async () => {
    await copy();
    await clickInWord("Pw");
    await pasteClip(["application/x-lexical-editor", "text/html", "text/plain"]);
  }],
  ["7.3 copy a mixed item, paste as HTML only at Nw", MIX, ["T0w", 0, "T2w", 3], async () => {
    await copy();
    await clickInWord("Nw");
    await pasteClip(["text/html", "text/plain"]);
  }],
  ["7.4 copy the whole list with the mixed item, paste HTML at root end", `<p>Rw</p>${MIX}`, ["Pw", 0, "Nw", 2], async () => {
    await copy();
    await clickInWord("Rw");
    await pasteClip(["text/html", "text/plain"]);
  }],
  ["7.5 cut a line's text and a quote, paste at Pw (drag stand-in)", MIX, ["T0w", 1, "Q1w", 2], async () => {
    await copy();
    await userEvent.keyboard("{Backspace}");
    await settle();
    await clickInWord("Pw");
    await pasteClip(["application/x-lexical-editor", "text/html", "text/plain"]);
  }],
];

const EMPTY = /<li><\/li>|<blockquote><\/blockquote>|<li><p><\/p><\/li>/;

describe("line lists and clipboard", () => {
  for (const [name, html, place, run] of PROBES) {
    test(name, async () => {
      clearRichTextReadOnlyMemo();
      const stored = sanitizeRichTextHtml(html);
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...args) => {
        const text = String(args[0]);
        if (text.startsWith("Warning: An update") === false) {
          errors.push(text.slice(0, 300));
        }
      });
      let onChange;
      if (Array.isArray(place)) {
        onChange = await mountAt(stored, place[0], place[1], place[2], place[3]);
      } else {
        onChange = await renderField(stored);
        await place();
      }
      onChange.mockClear();
      const t0 = performance.now();
      let thrown = "";
      try {
        await run();
      } catch (error) {
        thrown = String(error);
      }
      const ms = Math.round(performance.now() - t0);
      const calls = onChange.mock.calls.length;
      const after = calls > 0 ? sanitizeRichTextHtml(lastHtml(onChange)) : stored;
      clearRichTextReadOnlyMemo();
      const reopens = getRichTextReadOnlyReason(after) === undefined;
      const lexical = clip?.getData("application/x-lexical-editor") ?? "";
      const report = {
        name,
        ms,
        thrown,
        errors,
        calls,
        before: stored,
        after,
        orderBefore: readingOrder(stored),
        orderAfter: readingOrder(after),
        empty: EMPTY.test(after),
        reopens,
        clipHtml: name.startsWith("7") ? clip?.getData("text/html") : undefined,
        clipHasLine: name.startsWith("7") ? lexical.includes("cms-line") : undefined,
        editorState: JSON.stringify(editorOf()!.getEditorState().toJSON().root).length,
        undoRestores: false,
      };
      for (let i = 0; i < 3; i += 1) await undo();
      report.undoRestores = sanitizeRichTextHtml(lastHtml(onChange)) === stored;
      console.log(`PROBE ${JSON.stringify(report)}`);
      clip = undefined;
      expect(ms).toBeLessThan(4000);
    }, 60_000);
  }
});
