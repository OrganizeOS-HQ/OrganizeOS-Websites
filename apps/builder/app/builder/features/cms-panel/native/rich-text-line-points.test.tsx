// SPIKE: the line prototype's pinned measurements. A point is named by the
// block it stands before, resolved in each build, never by a child index
// carried between builds (an inline run is several children at the head
// and one line in the build). Runs in both builds: with VITE_LINES_OFF the
// head's results, without it the build's.
import { describe, expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import {
  $createRangeSelection,
  $getRoot,
  $isDecoratorNode,
  $isElementNode,
  $setSelection,
  type ElementNode,
} from "lexical";
import {
  click,
  clickInWord,
  editable,
  editorOf,
  lastHtml,
  renderField,
  settle,
} from "./rich-text-test-harness";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";

const linesOff =
  String(
    (import.meta as { env?: Record<string, string> }).env?.VITE_LINES_OFF ?? ""
  ) !== "";

const IMG =
  '<img src="https://cdn.example.org/x.png" alt="" width="2" height="3" />';
const LI = (x: string) => `<ul><li>Pw</li><li>${x}</li><li>Nw</li></ul>`;

/** The point directly before the container's first block child. */
const beforeFirstBlock = async () => {
  await click(editable());
  await act(async () => {
    editorOf()!.update(() => {
      const item = $getRoot()
        .getFirstChildOrThrow<ElementNode>()
        .getChildAtIndex(1) as ElementNode;
      const block = item
        .getChildren()
        .find(
          (child) =>
            child.getType() !== "cms-line" &&
            ($isElementNode(child) || $isDecoratorNode(child)) &&
            child.isInline() === false
        )!;
      const at = block.getIndexWithinParent();
      const selection = $createRangeSelection();
      selection.anchor.set(item.getKey(), at, "element");
      selection.focus.set(item.getKey(), at, "element");
      $setSelection(selection);
    });
  });
  await settle();
};

describe("a letter at the point before a block, after a line that ends in a line break (D18 step 2)", () => {
  // the head's results, measured at lines off in round 12: the letter lands
  // at the line's end, after its last line break
  const ENDINGS: Array<[string, string]> = [
    ["text then a break", "T0w<br>"],
    ["text then two breaks", "T0w<br><br>"],
    ["an image then a break", `${IMG}<br>`],
    ["a link then a break", '<a href="https://example.org/a">Lw</a><br>'],
    ["a break, text, a break", "<br>T0w<br>"],
    ["a break only", "<br>"],
  ];
  const BLOCKS: Array<[string, string]> = [
    ["a quote", "<blockquote><p>Q9w</p></blockquote>"],
    ["a heading", "<h3>H9w</h3>"],
    ["a code block", "<pre><code>C9w</code></pre>"],
  ];
  const cases = ENDINGS.flatMap(([ending, line]) =>
    BLOCKS.map(([block, html]) => ({ ending, line, block, html }))
  );
  test.each(cases)("$ending, then $block", async ({ line, html }) => {
    const onChange = await renderField(LI(`${line}${html}`));
    await beforeFirstBlock();
    await userEvent.keyboard("k");
    await settle();
    expect(sanitizeRichTextHtml(lastHtml(onChange))).toBe(
      sanitizeRichTextHtml(LI(`${line}k${html}`))
    );
  });
});

describe("FS9 by keys: a copy from a quote's end, Shift+Right, before a trailing break", () => {
  const strip = (html: string) =>
    html.replace(/ (class|dir|style|value)="[^"]*"/g, "").replace(/<\/?span>/g, "");
  const copy = async (html: string) => {
    await renderField(html);
    await clickInWord("Q0w");
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    await settle();
    const data = new DataTransfer();
    await act(async () => {
      editable()!.dispatchEvent(
        new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: data })
      );
    });
    await settle();
    return { html: strip(data.getData("text/html")), text: data.getData("text/plain") };
  };
  const ALONE = "<ul><li><blockquote><p>Q0w</p></blockquote><br></li></ul>";
  const WITH_NEXT =
    "<ul><li><blockquote><p>Q0w</p></blockquote><br></li><li>Iw</li></ul>";

  // a measured fact of Lexical 0.21 at the head (lines off): its walk
  // overshoots when the end steps back onto an ancestor of the start, and
  // the copy holds the trailing break, and the whole next item where there
  // is one
  test.runIf(linesOff)("the head over-copies: the trailing break", async () => {
    expect(await copy(ALONE)).toEqual({
      html: "<ul><li><blockquote><p></p></blockquote><br></li></ul>",
      text: "\n\n\n",
    });
  });
  test.runIf(linesOff)("the head over-copies: the whole next item", async () => {
    expect(await copy(WITH_NEXT)).toEqual({
      html: "<ul><li><blockquote><p></p></blockquote><br></li><li>Iw</li></ul>",
      text: "\n\n\nIw\n",
    });
  });

  // D6: the selection ends at the line's start, so the line contributes
  // nothing; the copy is the quote, and text/plain is read from that
  test.runIf(linesOff === false)("the build copies the quote", async () => {
    expect(await copy(ALONE)).toEqual({
      html: "<blockquote><p></p></blockquote>",
      text: "\n",
    });
  });
  test.runIf(linesOff === false)("the build copies the quote, with an item after", async () => {
    expect(await copy(WITH_NEXT)).toEqual({
      html: "<blockquote><p></p></blockquote>",
      text: "\n",
    });
  });
});
