// SPIKE: the reviewer's hazard shapes (A to D) by real keys, with the line
// invariant on.
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import {
  clickInWord,
  lastHtml,
  mountAt,
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
import { lineSpike } from "./rich-text-line-node";

const BS = "{Backspace}";
const DEL = "{Delete}";
const ENTER = "{Enter}";
const CBS = "{Control>}{Backspace}{/Control}";
const CDEL = "{Control>}{Delete}{/Control}";
const CUT = "{Control>}x{/Control}";

const B = (x: string) =>
  `<ul><li>Pw</li><li>${x}</li><li>Nw</li></ul>`;
const BMIX = B("T0w<blockquote><p>Q1w</p></blockquote>T2w");

type Caret =
  | { word: string; at: number }
  | { from: string; fromAt: number; to: string; toAt: number };
type Hazard = [name: string, html: string, caret: Caret, keys: string];
const at = (word: string, offset: number): Caret => ({ word, at: offset });
const range = (from: string, fromAt: number, to: string, toAt: number): Caret => ({
  from,
  fromAt,
  to,
  toAt,
});

const QI = "<ul><li>Pw</li><li><blockquote>Q0w</blockquote>T1w</li><li>Nw</li></ul>";

export const HAZARDS: Hazard[] = [
  ["A1 Backspace at the run's start", QI, at("T1w", 0), BS],
  ["A2 Delete at the block's end", QI, at("Q0w", 3), DEL],
  ["A3 Delete at the item's end", QI, at("T1w", 3), DEL],
  ["A5 range from the run into the next item", QI, range("T1w", 1, "Nw", 1), BS],
  ["A6 Enter over T0w before a rule", "<ul><li>T0w<hr></li></ul>", range("T0w", 0, "T0w", 3), ENTER],
  ["B1 Backspace at the start of T2w", BMIX, at("T2w", 0), BS],
  ["B2 Delete at the end of Q1w", BMIX, at("Q1w", 3), DEL],
  ["B3 Ctrl+Backspace at the start of T2w", BMIX, at("T2w", 0), CBS],
  ["B4 Ctrl+Delete at the end of Q1w", BMIX, at("Q1w", 3), CDEL],
  ["B5 range T2w to Q1w, Backspace", BMIX, range("T2w", 1, "Q1w", 1), BS],
  ["B6 range T2w to Q1w, Enter", BMIX, range("T2w", 1, "Q1w", 1), ENTER],
  ["B7 range T2w to Q1w, cut", BMIX, range("T2w", 1, "Q1w", 1), CUT],
  ["B8 line break for T0w, Backspace at T2w", B("<br><blockquote><p>Q1w</p></blockquote>T2w"), at("T2w", 0), BS],
  ["B9 quote x list y, Backspace at y", "<blockquote>Xw<ul><li>Aw</li></ul>Yw</blockquote>", at("Yw", 0), BS],
  ["B10 heading between, Backspace at T2w", B("T0w<h3>H1w</h3>T2w"), at("T2w", 0), BS],
  ["B11 code between, Backspace at T2w", B("T0w<pre><code>C1w</code></pre>T2w"), at("T2w", 0), BS],
  ["B12 Delete at the end of T0w", BMIX, at("T0w", 3), DEL],
  ["B13 Backspace at the start of Q1w", BMIX, at("Q1w", 0), BS],
  ["C1 Backspace at a quote leading the first item", "<ul><li><blockquote>Q0w</blockquote>T1w</li></ul>", at("Q0w", 0), BS],
  ["C1b Backspace at a code block leading the first item", "<ul><li><pre><code>C0w</code></pre>T1w</li></ul>", at("C0w", 0), BS],
  ["C2 Enter at the end of a quote in an item", QI, at("Q0w", 3), ENTER],
  ["D1 Backspace at a root quote's line", "<p>Pw</p><blockquote><p>Q0w</p></blockquote>", at("Q0w", 0), BS],
  ["D1b Backspace at a quote's line in an item", "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li></ul>", at("Q0w", 0), BS],
  ["D2 Delete before an item of only a quote", "<ul><li>Pw</li><li><blockquote>Q0w</blockquote></li></ul>", at("Pw", 2), DEL],
  ["D2b Delete before an item of only a heading", "<ul><li>Pw</li><li><h3>H0w</h3></li></ul>", at("Pw", 2), DEL],
  ["D2c Delete before an item of only a code block", "<ul><li>Pw</li><li><pre><code>C0w</code></pre></li></ul>", at("Pw", 2), DEL],
  ["D3 range into an item's block", "<ul><li>Pw</li><li><blockquote>Q0w</blockquote></li></ul>", range("Pw", 1, "Q0w", 3), BS],
  ["D3b range into a quote's paragraph", "<p>Pw</p><blockquote><p>Q0w</p><p>Q1w</p></blockquote>", range("Pw", 1, "Q0w", 3), BS],
  ["D4 Backspace after a rule-only item", "<ul><li><hr></li><li>Nw</li></ul>", at("Nw", 0), BS],
  ["D5 Delete before a nested list", "<ul><li>Aw<ul><li>Bw</li></ul></li></ul>", at("Aw", 2), DEL],
  ["D5b Delete before a nested list, mixed item", "<ul><li><blockquote>Q0w</blockquote>Aw<ul><li>Bw</li></ul></li></ul>", at("Aw", 2), DEL],
];

const EMPTY = /<li><\/li>|<li><br ?\/?><\/li>|<blockquote><\/blockquote>|<li><p><\/p><\/li>|<p><\/p>/;

const place = async (html: string, caret: Caret) => {
  if ("word" in caret) {
    const onChange = await renderField(html);
    await clickInWord(caret.word, caret.at);
    return onChange;
  }
  return mountAt(html, caret.from, caret.fromAt, caret.to, caret.toAt);
};

describe("line hazards", () => {
  const filter = (import.meta as { env?: Record<string, string> }).env?.VITE_HAZARD;
  for (const [name, html, caret, keys] of HAZARDS) {
    if (filter && name.startsWith(filter) === false) continue;
    test(name, async () => {
      lineSpike.on = true;
      lineSpike.noEmptied = true;
      clearRichTextReadOnlyMemo();
      const stored = sanitizeRichTextHtml(html);
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...args) => {
        errors.push(String(args[0]).slice(0, 200));
      });
      window.addEventListener("error", (event) => errors.push(event.message));
      const onChange = await place(stored, caret);
      onChange.mockClear();
      const t0 = performance.now();
      await userEvent.keyboard(keys);
      await settle();
      const ms = Math.round(performance.now() - t0);
      const calls = onChange.mock.calls.length;
      const after = calls > 0 ? sanitizeRichTextHtml(lastHtml(onChange)) : stored;
      clearRichTextReadOnlyMemo();
      const reopens = getRichTextReadOnlyReason(after) === undefined;
      await undo();
      const undone = sanitizeRichTextHtml(lastHtml(onChange));
      const report = {
        name,
        ms,
        errors,
        calls,
        before: stored,
        after,
        orderBefore: readingOrder(stored),
        orderAfter: readingOrder(after),
        empty: EMPTY.test(after),
        reopens,
        undoRestores: undone === stored,
      };
      console.log(`HAZARD ${JSON.stringify(report)}`);
      expect(ms).toBeLessThan(2000);
    }, 60_000);
  }
});
