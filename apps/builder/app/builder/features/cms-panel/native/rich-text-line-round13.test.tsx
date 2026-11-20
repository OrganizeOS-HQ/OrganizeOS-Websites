// SPIKE: the named writes of the second record-set check (prototype round
// 13), one assertion each, with real input.
import { describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { $getSelection, $isNodeSelection } from "lexical";
import {
  byLabel,
  click,
  clickInWord,
  editable,
  editorOf,
  dropHtml,
  lastHtml,
  paste,
  renderField,
  settle,
} from "./rich-text-test-harness";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";

const LI = (x: string) => `<ul><li>Pw</li><li>${x}</li><li>Nw</li></ul>`;
const stored = (html: string) => sanitizeRichTextHtml(html);
const written = (onChange: Parameters<typeof lastHtml>[0]) =>
  sanitizeRichTextHtml(lastHtml(onChange));
const divider = () => click(byLabel("Divider"));
const keys = async (input: string) => {
  await userEvent.keyboard(input);
  await settle();
};
const ruleSelected = () =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      return $isNodeSelection(selection) && selection.getNodes()[0]?.getType() === "horizontalrule";
    });
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

describe("B: an arrow from a block's text edge to a rule beside the block", () => {
  test("ArrowRight at a quote's end selects the rule after it, then the text after the rule", async () => {
    const onChange = await renderField(LI("<blockquote><p>Q0w</p></blockquote><hr>T2w"));
    await clickInWord("Q0w");
    await keys("{ArrowRight}");
    expect(ruleSelected()).toBe(true);
    await keys("{ArrowRight}k");
    expect(written(onChange)).toBe(stored(LI("<blockquote><p>Q0w</p></blockquote><hr />kT2w")));
  });
  test("ArrowLeft at a quote's start selects the rule before it", async () => {
    await renderField(LI("<hr><blockquote><p>Q1w</p></blockquote>"));
    await clickInWord("Q1w", 0);
    await keys("{ArrowLeft}");
    expect(ruleSelected()).toBe(true);
  });
});

/** A real click at the left or right end of the item's first rule. */
const clickRule = async (side: "start" | "end") => {
  const rule = editable()!.querySelector<HTMLElement>("hr")!;
  const box = rule.getBoundingClientRect();
  await userEvent.click(rule, {
    position: { x: side === "start" ? 1 : box.width - 2, y: 1 },
    force: true,
  } as never);
  await settle();
};

/** A real click at the bottom-right corner of the item holding `word`. */
const clickItemEnd = async (word: string) => {
  const span = [...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]")].find(
    (element) => element.textContent === word
  )!;
  const item = span.closest("li")!;
  const box = item.getBoundingClientRect();
  await userEvent.click(item, { position: { x: box.width - 2, y: box.height - 2 }, force: true } as never);
  await settle();
};

describe("C: a point at a line's start, and an empty caret line after its rule goes", () => {
  test("C1: ArrowLeft from the text after a break that follows a quote, then a letter", async () => {
    const onChange = await renderField(LI("<blockquote><p>Q0w</p></blockquote><br>T2w"));
    await clickInWord("T2w", 0);
    await keys("{ArrowLeft}k");
    expect(written(onChange)).toBe(stored(LI("<blockquote><p>Q0wk</p></blockquote><br />T2w")));
  });
  test("C1: ArrowLeft there, then Enter, adds a paragraph to the quote", async () => {
    const onChange = await renderField(LI("<blockquote><p>Q0w</p></blockquote><br>T2w"));
    await clickInWord("T2w", 0);
    await keys("{ArrowLeft}{Enter}");
    expect(written(onChange)).toBe(stored(LI("<blockquote><p>Q0w</p><p></p></blockquote><br />T2w")));
  });
  test("C2: RQ, the rule clicked at its start, Delete, then a letter", async () => {
    const onChange = await renderField(LI("<hr><blockquote><p>Q1w</p></blockquote>"));
    await clickRule("start");
    await keys("{Delete}k");
    expect(written(onChange)).toBe(stored(LI("<blockquote><p>kQ1w</p></blockquote>")));
  });
  test("C2: QR, the item's end, Backspace, then a letter", async () => {
    const onChange = await renderField(LI("<blockquote><p>Q0w</p></blockquote><hr>"));
    await clickItemEnd("Q0w");
    await keys("{Backspace}k");
    expect(written(onChange)).toBe(stored(LI("<blockquote><p>Q0wk</p></blockquote>")));
  });
});

describe("E: D3's break, decided before the edit", () => {
  const TQT = LI("T0w<blockquote><p>Q1w</p></blockquote>T2w");
  const BQT = LI("<br><blockquote><p>Q1w</p></blockquote>T2w");
  test("E1: Enter over T0w's end to Q1w@1 is the join, then Enter", async () => {
    const onChange = await renderField(TQT);
    await selectWords("T0w", undefined, "Q1w", 1);
    await keys("{Enter}");
    expect(written(onChange)).toBe(stored("<ul><li>Pw</li><li>T0w</li><li>1w<br />T2w</li><li>Nw</li></ul>"));
  });
  test("E2: a letter over a range from the item before into the quote", async () => {
    const onChange = await renderField(BQT);
    await selectWords("Pw", 1, "Q1w", 2);
    await keys("k");
    expect(written(onChange)).toBe(stored("<ul><li>Pkw</li><li>T2w</li><li>Nw</li></ul>"));
  });
  test("E2: Backspace over that range", async () => {
    const onChange = await renderField(BQT);
    await selectWords("Pw", 1, "Q1w", 2);
    await keys("{Backspace}");
    expect(written(onChange)).toBe(stored("<ul><li>Pw</li><li>T2w</li><li>Nw</li></ul>"));
  });
  test("E3: Backspace at a code block's start between two lines", async () => {
    const onChange = await renderField(LI("T0w<pre><code>C1w</code></pre>T2w"));
    await clickInWord("C1w", 0);
    await keys("{Backspace}");
    expect(written(onChange)).toBe(stored(LI("T0wC1w<br />T2w")));
  });
  test("E3: Delete at the end of the line before a code block", async () => {
    const onChange = await renderField(LI("T0w<pre><code>C1w</code></pre>T2w"));
    await clickInWord("T0w");
    await keys("{Delete}");
    expect(written(onChange)).toBe(stored(LI("T0wC1w<br />T2w")));
  });
});

describe("F: a block paste or drop over a range in a lined item: the removal, then the paste", () => {
  const S2 = "<ul><li>xq<blockquote><p>qq</p></blockquote>yyq</li><li>nq</li></ul><p>sepq</p>";
  const S2ol = "<ol><li>xq<blockquote><p>qq</p></blockquote>yyq</li><li>nq</li></ol><p>sepq</p>";
  const timed = async (step: () => Promise<void> | void) => {
    const start = performance.now();
    await step();
    await settle();
    return performance.now() - start;
  };
  const CASES: Array<[string, string, [string, number, string, number], () => Promise<void> | void, string | undefined]> = [
    ["a paragraph from the quote's start into the line after", S2, ["qq", 0, "yyq", 1], () => paste({ "text/html": "<p>Aq</p>", "text/plain": "Aq" }),
      "<ul><li>xq<blockquote><p>Aqyq</p></blockquote></li><li>nq</li></ul><p>sepq</p>"],
    ["a paragraph from the first line into the quote", S2, ["xq", 1, "qq", 1], () => paste({ "text/html": "<p>Aq</p>", "text/plain": "Aq" }),
      "<ul><li>xAqq<br />yyq</li><li>nq</li></ul><p>sepq</p>"],
    ["bold from the first line into the quote", S2, ["xq", 1, "qq", 1], () => paste({ "text/html": "<b>Aq</b>", "text/plain": "Aq" }),
      "<ul><li>x<b><strong>Aq</strong></b>q<br />yyq</li><li>nq</li></ul><p>sepq</p>"],
    ["two paragraphs from the first line into the quote", S2, ["xq", 1, "qq", 1], () => paste({ "text/html": "<p>Aq</p><p>Bq</p>", "text/plain": "x" }),
      "<ul><li>xAq</li></ul><p>Bqq<br />yyq</p><ul><li>nq</li></ul><p>sepq</p>"],
    ["two paragraphs dropped from the first line into the quote", S2, ["xq", 1, "qq", 1], () => dropHtml("<p>Aq</p><p>Bq</p>"),
      "<ul><li>xAq</li></ul><p>Bqq<br />yyq</p><ul><li>nq</li></ul><p>sepq</p>"],
    ["a paragraph from inside the quote into the line after", S2, ["qq", 1, "yyq", 1], () => paste({ "text/html": "<p>Aq</p>", "text/plain": "Aq" }), undefined],
    ["bold from the quote's start into the line after", S2, ["qq", 0, "yyq", 1], () => paste({ "text/html": "<b>Aq</b>", "text/plain": "Aq" }), undefined],
    ["two paragraphs dropped from the quote's start", S2, ["qq", 0, "yyq", 1], () => dropHtml("<p>Aq</p><p>Bq</p>"), undefined],
    ["two paragraphs into a numbered item's quote", S2ol, ["qq", 1, "yyq", 1], () => paste({ "text/html": "<p>Aq</p><p>Bq</p>", "text/plain": "Aq\nBq" }), undefined],
  ];
  test.each(CASES)("%s: no hang", async (_name, html, [from, fromOffset, to, toOffset], step, expected) => {
    const onChange = await renderField(html);
    await selectWords(from, fromOffset, to, toOffset);
    expect(await timed(step)).toBeLessThan(2000);
    if (expected !== undefined) {
      expect(written(onChange)).toBe(stored(expected));
    }
  });
  test("a cut from inside a quote into the line after: no hang", async () => {
    await renderField("<ul><li>xq<blockquote><p>qq</p></blockquote>yq</li></ul>");
    await selectWords("qq", 1, "yq", 1);
    const data = new DataTransfer();
    expect(
      await timed(() => {
        editable()!.dispatchEvent(new ClipboardEvent("cut", { bubbles: true, cancelable: true, clipboardData: data }));
      })
    ).toBeLessThan(2000);
  });
});

/** A real copy or cut: the clipboard event the browser dispatches. */
const clipboard = async (type: "copy" | "cut") => {
  const data = new DataTransfer();
  editable()!.dispatchEvent(new ClipboardEvent(type, { bubbles: true, cancelable: true, clipboardData: data }));
  await settle();
  return {
    html: data.getData("text/html").replace(/ (class|dir|style|value)="[^"]*"/g, "").replace(/<\/?span>/g, ""),
    text: data.getData("text/plain"),
  };
};

describe("G: the clipboard holds what the selection holds, and a cut removes that", () => {
  test("a line's whole text before a quote copies the text only", async () => {
    await renderField("<ul><li>xxq<blockquote><p>qq</p></blockquote>yyq</li></ul>");
    await selectWords("xxq", 0, "xxq", undefined);
    expect(await clipboard("copy")).toEqual({ html: "xxq", text: "xxq" });
  });
  test("a whole lined item copies with its list item", async () => {
    await renderField("<ul><li>xq<hr>yq</li></ul>");
    await selectWords("xq", 0, "yq", undefined);
    expect(await clipboard("copy")).toEqual({ html: "<ul><li>xq<hr>yq</li></ul>", text: "xq\nyq" });
  });
  test("a cut from the item before to the end of the line before a trailing rule", async () => {
    const onChange = await renderField(LI("<blockquote><p>Q0w</p></blockquote>T1w<hr>"));
    await selectWords("Pw", 0, "T1w", undefined);
    const clip = await clipboard("cut");
    expect(clip.text).toContain("T1w");
    expect(written(onChange)).toBe(stored("<ul><li><hr /></li><li>Nw</li></ul>"));
  });
});

export { editable };
