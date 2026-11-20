// SPIKE: the named writes of the second record-set check (prototype round
// 13), one assertion each, with real input.
import { describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import {
  byLabel,
  click,
  clickInWord,
  editable,
  lastHtml,
  renderField,
  settle,
} from "./rich-text-test-harness";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";

const LI = (x: string) => `<ul><li>Pw</li><li>${x}</li><li>Nw</li></ul>`;
const stored = (html: string) => sanitizeRichTextHtml(html);
const written = (onChange: Parameters<typeof lastHtml>[0]) =>
  sanitizeRichTextHtml(lastHtml(onChange));
const divider = () => click(byLabel("Divider"));
/** A range by real input: a click in `from`, then Shift+click in `to`. */
const selectWords = async (
  from: string,
  fromOffset: number | undefined,
  to: string,
  toOffset: number | undefined
) => {
  await clickInWord(from, fromOffset);
  await userEvent.keyboard("{Shift>}");
  await clickInWord(to, toOffset);
  await userEvent.keyboard("{/Shift}");
  await settle();
};

describe("A: Divider beside a block in a lined item", () => {
  test("A1: at a quote's text end, after the item when the quote ends it", async () => {
    const onChange = await renderField(LI("T0w<blockquote><p>Q1w</p></blockquote>"));
    await clickInWord("Q1w");
    await divider();
    expect(written(onChange)).toBe(
      stored("<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote></li></ul><hr /><ul><li>Nw</li></ul>")
    );
    await userEvent.keyboard("k");
    await settle();
    expect(written(onChange)).toContain("<li>kNw</li>");
  });
  test("A1: an item of only a quote", async () => {
    const onChange = await renderField(LI("<blockquote><p>Q0w</p></blockquote>"));
    await clickInWord("Q0w");
    await divider();
    expect(written(onChange)).toBe(
      stored("<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li></ul><hr /><ul><li>Nw</li></ul>")
    );
  });
  test("A2: at a quote's text start, before the item, no empty item", async () => {
    const onChange = await renderField(LI("<blockquote><p>Q0w</p></blockquote>"));
    await clickInWord("Q0w", 0);
    await divider();
    expect(written(onChange)).toBe(
      stored("<ul><li>Pw</li></ul><hr /><ul><li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li></ul>")
    );
  });
  test("A2: in the list's first item, no empty list", async () => {
    const onChange = await renderField(
      "<ul><li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li></ul>"
    );
    await clickInWord("Q0w", 0);
    await divider();
    expect(written(onChange)).toBe(
      stored("<hr /><ul><li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li></ul>")
    );
  });
  test("A4: over a range, the head's write", async () => {
    const onChange = await renderField(LI("<blockquote><p>Q0w</p></blockquote>T1w"));
    await selectWords("Q0w", 0, "T1w", undefined);
    await divider();
    expect(written(onChange)).toBe(
      stored("<ul><li>Pw</li></ul><hr /><ul><li><blockquote><p>Q0w</p></blockquote>T1w</li><li>Nw</li></ul>")
    );
  });
});

export { editable };
