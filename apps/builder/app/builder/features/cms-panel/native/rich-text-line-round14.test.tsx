// SPIKE: the named writes of the third record-set check (prototype round
// 14), one assertion each, with real input.
import { describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { clickInWord, lastHtml, renderField, settle } from "./rich-text-test-harness";
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
