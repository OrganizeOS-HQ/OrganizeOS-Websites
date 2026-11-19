// Edits at a caret where the editor finds no block (an item or quote that
// starts with a block), with real clicks, keys, pastes, drops and the Image
// button, against the same edits at ordinary carets.
import { act } from "react-dom/test-utils";
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { $getSelection, $isRangeSelection } from "lexical";
import {
  byLabel,
  clickInWord,
  editable,
  editorOf,
  expectFixedPoint,
  fieldContainer,
  lastHtml,
  paste,
  plain,
  renderField,
  settle,
  undo,
} from "./rich-text-test-harness";

describe("an edit at a caret where the editor finds no block (X1)", () => {
  const ITEM_QUOTE =
    "<ul><li><blockquote><p>q1</p></blockquote>q2</li><li>t1</li></ul>";
  const ITEM_RULE = "<ul><li><hr /></li><li>t1</li></ul>";
  /** A real click at the start of `word`, then `keys`. */
  const fromStartOf = (word: string, keys: string) => async () => {
    await clickInWord(word, 0);
    await userEvent.keyboard(keys);
    await settle();
  };
  /** A real click on the rule, then Left. */
  const beforeRule = async () => {
    await userEvent.click(editable()!.querySelector<HTMLElement>("hr")!);
    await settle();
    await userEvent.keyboard("{ArrowLeft}");
    await settle();
  };
  /** The caret as "text:<text>@<offset>" or "element:<type>@<offset>". */
  const caret = () =>
    editorOf()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) === false) {
          return "none";
        }
        const { anchor } = selection;
        const node = anchor.getNode();
        return anchor.type === "text"
          ? `text:${node.getTextContent()}@${anchor.offset}`
          : `element:${node.getType()}@${anchor.offset}`;
      });
  type Caret = [string, string, () => Promise<void>, string];
  const CARETS: Caret[] = [
    [
      "the end of an item's text after a quote",
      ITEM_QUOTE,
      () => clickInWord("q2"),
      "text:q2@2",
    ],
    [
      "the middle of an item's text after a quote",
      ITEM_QUOTE,
      () => clickInWord("q2", 1),
      "text:q2@1",
    ],
    [
      "the start of an item's text after a quote",
      ITEM_QUOTE,
      () => clickInWord("q2", 0),
      "text:q2@0",
    ],
    [
      "the end of an item's text after a heading",
      "<ul><li><h3>Title</h3>desc</li><li>t1</li></ul>",
      () => clickInWord("desc"),
      "text:desc@4",
    ],
    [
      "the end of an item's text after a code block",
      "<ul><li><pre><code>cmd</code></pre>after</li><li>t1</li></ul>",
      () => clickInWord("after"),
      "text:after@5",
    ],
    [
      "the end of an item's text after a rule",
      "<ul><li><hr />Z</li><li>t1</li></ul>",
      () => clickInWord("Z"),
      "text:Z@1",
    ],
    [
      "the start of an item holding a rule, then text",
      "<ul><li><hr />Z</li><li>t1</li></ul>",
      beforeRule,
      "element:listitem@0",
    ],
    [
      "the end of an item holding only a rule",
      ITEM_RULE,
      fromStartOf("t1", "{ArrowLeft}"),
      "element:listitem@1",
    ],
    [
      "the start of an item holding only a rule",
      ITEM_RULE,
      fromStartOf("t1", "{ArrowUp}"),
      "element:listitem@0",
    ],
    [
      "the end of an item holding a quote, then a rule",
      "<ul><li><blockquote><p>Z1</p></blockquote><hr /></li><li>t1</li></ul>",
      fromStartOf("t1", "{ArrowLeft}"),
      "element:listitem@2",
    ],
    [
      "the end of a quote holding a paragraph, then a rule",
      "<blockquote><p>a</p><hr /></blockquote><p>t1</p>",
      fromStartOf("t1", "{ArrowLeft}"),
      "element:quote@2",
    ],
    [
      "the end of a numbered item's text after a quote",
      "<ol><li><blockquote><p>q1</p></blockquote>q2</li><li>t1</li></ol>",
      () => clickInWord("q2"),
      "text:q2@2",
    ],
    [
      "the end of an item's text after a quote, three levels deep",
      "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2</li><li>t1</li></ul></li></ul></li></ul>",
      () => clickInWord("q2"),
      "text:q2@2",
    ],
    [
      "the end of an item's text after a heading, in a quote",
      "<blockquote><ul><li><h3>T</h3>q2</li><li>t1</li></ul></blockquote>",
      () => clickInWord("q2"),
      "text:q2@2",
    ],
  ];
  const CONTROLS: Caret[] = [
    [
      "the end of an ordinary item",
      "<ul><li>aa</li><li>bb</li></ul>",
      () => clickInWord("aa"),
      "text:aa@2",
    ],
    [
      "an empty item",
      "<ul><li>aa</li><li></li><li>bb</li></ul>",
      fromStartOf("bb", "{ArrowUp}"),
      "element:listitem@0",
    ],
    [
      "the end of a paragraph",
      "<p>pp</p><p>t1</p>",
      () => clickInWord("pp"),
      "text:pp@2",
    ],
    [
      "the end of a quote's paragraph",
      "<blockquote><p>qq</p></blockquote><p>t1</p>",
      () => clickInWord("qq"),
      "text:qq@2",
    ],
  ];
  const plainPaste = (text: string) => async () => {
    paste({ "text/plain": text });
    await settle();
  };
  const plainDrop = (text: string) => async () => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", text);
    await act(async () => {
      editable()!.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertFromDrop",
          dataTransfer,
        })
      );
    });
    await settle();
  };
  const pngFile = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 3;
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((result) => resolve(result!), "image/png")
    );
    return new File([blob], "a.png", { type: "image/png" });
  };
  const image = (onChange: ReturnType<typeof vi.fn>) => async () => {
    const file = await pngFile();
    await act(async () => {
      byLabel("Image")!.click();
    });
    const input =
      fieldContainer()!.querySelector<HTMLInputElement>('input[type="file"]')!;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    await act(async () => {
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await vi.waitFor(() => expect(lastHtml(onChange)).toContain("<img"));
    await settle();
  };
  type Edit = [
    string,
    (onChange: ReturnType<typeof vi.fn>) => () => Promise<void>,
  ];
  const EDITS: Edit[] = [
    [
      "Shift+Enter",
      () => async () => {
        await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
        await settle();
      },
    ],
    ["a two-line plain-text paste", () => plainPaste("L1\nL2")],
    ["a three-line plain-text paste", () => plainPaste("L1\nL2\nL3")],
    ["a CRLF plain-text paste", () => plainPaste("L1\r\nL2")],
    ["a two-line plain-text drop", () => plainDrop("L1\nL2")],
    ["a plain-text paste holding a tab", () => plainPaste("a\tb")],
    ["the Image button", image],
    [
      "Enter",
      () => async () => {
        await userEvent.keyboard("{Enter}");
        await settle();
      },
    ],
    [
      "an HTML paste of two paragraphs",
      () => async () => {
        paste({ "text/html": "<p>H1</p><p>H2</p>", "text/plain": "x" });
        await settle();
      },
    ],
  ];
  const IMG =
    '<img src="https://cdn.example.org/x.png" alt="" width="2" height="3" />';
  /** What each edit writes at each caret: as at a caret in an ordinary item. */
  const WRITES: Record<string, Record<string, string>> = {
    "the end of an item's text after a quote": {
      "Shift+Enter":
        "<ul><li><blockquote><p>q1</p></blockquote>q2<br /></li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>L3</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><blockquote><p>q1</p></blockquote>q2a\tb</li><li>t1</li></ul>",
      "the Image button": `<ul><li><blockquote><p>q1</p></blockquote>q2${IMG}</li><li>t1</li></ul>`,
      Enter:
        "<ul><li><blockquote><p>q1</p></blockquote>q2</li><li></li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><blockquote><p>q1</p></blockquote>q2H1</li></ul><p>H2</p><ul><li>t1</li></ul>",
    },
    "the middle of an item's text after a quote": {
      "Shift+Enter":
        "<ul><li><blockquote><p>q1</p></blockquote>q<br />2</li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>qL1</li><li>L22</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>qL1</li><li>L2</li><li>L32</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>qL1</li><li>L22</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><blockquote><p>q1</p></blockquote>qL1</li><li>L22</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><blockquote><p>q1</p></blockquote>qa\tb2</li><li>t1</li></ul>",
      "the Image button": `<ul><li><blockquote><p>q1</p></blockquote>q${IMG}2</li><li>t1</li></ul>`,
      Enter:
        "<ul><li><blockquote><p>q1</p></blockquote>q</li><li>2</li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><blockquote><p>q1</p></blockquote>qH1</li></ul><p>H22</p><ul><li>t1</li></ul>",
    },
    "the start of an item's text after a quote": {
      "Shift+Enter":
        "<ul><li><blockquote><p>q1</p></blockquote><br />q2</li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>L1</li><li>L2q2</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>L1</li><li>L2</li><li>L3q2</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>L1</li><li>L2q2</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><blockquote><p>q1</p></blockquote>L1</li><li>L2q2</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><blockquote><p>q1</p></blockquote>a\tbq2</li><li>t1</li></ul>",
      "the Image button": `<ul><li><blockquote><p>q1</p></blockquote>${IMG}q2</li><li>t1</li></ul>`,
      Enter:
        "<ul><li><blockquote><p>q1</p></blockquote></li><li>q2</li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><blockquote><p>q1</p></blockquote>H1</li></ul><p>H2q2</p><ul><li>t1</li></ul>",
    },
    "the end of an item's text after a heading": {
      "Shift+Enter": "<ul><li><h3>Title</h3>desc<br /></li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><h3>Title</h3>descL1</li><li>L2</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><h3>Title</h3>descL1</li><li>L2</li><li>L3</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><h3>Title</h3>descL1</li><li>L2</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><h3>Title</h3>descL1</li><li>L2</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><h3>Title</h3>desca\tb</li><li>t1</li></ul>",
      "the Image button": `<ul><li><h3>Title</h3>desc${IMG}</li><li>t1</li></ul>`,
      Enter: "<ul><li><h3>Title</h3>desc</li><li></li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><h3>Title</h3>descH1</li></ul><p>H2</p><ul><li>t1</li></ul>",
    },
    "the end of an item's text after a code block": {
      "Shift+Enter":
        "<ul><li><pre><code>cmd</code></pre>after<br /></li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><pre><code>cmd</code></pre>afterL1</li><li>L2</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><pre><code>cmd</code></pre>afterL1</li><li>L2</li><li>L3</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><pre><code>cmd</code></pre>afterL1</li><li>L2</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><pre><code>cmd</code></pre>afterL1</li><li>L2</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><pre><code>cmd</code></pre>aftera\tb</li><li>t1</li></ul>",
      "the Image button": `<ul><li><pre><code>cmd</code></pre>after${IMG}</li><li>t1</li></ul>`,
      Enter:
        "<ul><li><pre><code>cmd</code></pre>after</li><li></li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><pre><code>cmd</code></pre>afterH1</li></ul><p>H2</p><ul><li>t1</li></ul>",
    },
    "the end of an item's text after a rule": {
      "Shift+Enter": "<ul><li><hr />Z<br /></li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><hr />ZL1</li><li>L2</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><hr />ZL1</li><li>L2</li><li>L3</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><hr />ZL1</li><li>L2</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><hr />ZL1</li><li>L2</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><hr />Za\tb</li><li>t1</li></ul>",
      "the Image button": `<ul><li><hr />Z${IMG}</li><li>t1</li></ul>`,
      Enter: "<ul><li><hr />Z</li><li></li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><hr />ZH1</li></ul><p>H2</p><ul><li>t1</li></ul>",
    },
    "the start of an item holding a rule, then text": {
      "Shift+Enter": "<ul><li><br /><hr />Z</li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li>L1</li><li>L2<hr />Z</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li>L1</li><li>L2</li><li>L3<hr />Z</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li>L1</li><li>L2<hr />Z</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li>L1</li><li>L2<hr />Z</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li>a\tb<hr />Z</li><li>t1</li></ul>",
      "the Image button": `<ul><li>${IMG}<hr />Z</li><li>t1</li></ul>`,
      Enter: "<ul><li></li><li><hr />Z</li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li>H1</li></ul><p>H2</p><hr /><p>Z</p><ul><li>t1</li></ul>",
    },
    "the end of an item holding only a rule": {
      "Shift+Enter": "<ul><li><hr /><br /></li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><hr />L1</li><li>L2</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><hr />L1</li><li>L2</li><li>L3</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><hr />L1</li><li>L2</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><hr />L1</li><li>L2</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><hr />a\tb</li><li>t1</li></ul>",
      "the Image button": `<ul><li><hr />${IMG}</li><li>t1</li></ul>`,
      Enter: "<ul><li><hr /></li><li></li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><hr />H1</li></ul><p>H2</p><ul><li>t1</li></ul>",
    },
    "the start of an item holding only a rule": {
      "Shift+Enter": "<ul><li><br /><hr /></li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li>L1</li><li>L2<hr /></li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li>L1</li><li>L2</li><li>L3<hr /></li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li>L1</li><li>L2<hr /></li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li>L1</li><li>L2<hr /></li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li>a\tb<hr /></li><li>t1</li></ul>",
      "the Image button": `<ul><li>${IMG}<hr /></li><li>t1</li></ul>`,
      Enter: "<ul><li></li><li><hr /></li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li>H1</li></ul><p>H2</p><hr /><ul><li>t1</li></ul>",
    },
    "the end of an item holding a quote, then a rule": {
      "Shift+Enter":
        "<ul><li><blockquote><p>Z1</p></blockquote><hr /><br /></li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><blockquote><p>Z1</p></blockquote><hr />L1</li><li>L2</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><blockquote><p>Z1</p></blockquote><hr />L1</li><li>L2</li><li>L3</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><blockquote><p>Z1</p></blockquote><hr />L1</li><li>L2</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><blockquote><p>Z1</p></blockquote><hr />L1</li><li>L2</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><blockquote><p>Z1</p></blockquote><hr />a\tb</li><li>t1</li></ul>",
      "the Image button": `<ul><li><blockquote><p>Z1</p></blockquote><hr />${IMG}</li><li>t1</li></ul>`,
      Enter:
        "<ul><li><blockquote><p>Z1</p></blockquote><hr /></li><li></li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><blockquote><p>Z1</p></blockquote><hr />H1</li></ul><p>H2</p><ul><li>t1</li></ul>",
    },
    "the end of a quote holding a paragraph, then a rule": {
      "Shift+Enter":
        "<blockquote><p>a</p><hr /><p><br /></p></blockquote><p>t1</p>",
      "a two-line plain-text paste":
        "<blockquote><p>a</p><hr /><p>L1</p><p>L2</p></blockquote><p>t1</p>",
      "a three-line plain-text paste":
        "<blockquote><p>a</p><hr /><p>L1</p><p>L2</p><p>L3</p></blockquote><p>t1</p>",
      "a CRLF plain-text paste":
        "<blockquote><p>a</p><hr /><p>L1</p><p>L2</p></blockquote><p>t1</p>",
      "a two-line plain-text drop":
        "<blockquote><p>a</p><hr /><p>L1</p><p>L2</p></blockquote><p>t1</p>",
      "a plain-text paste holding a tab":
        "<blockquote><p>a</p><hr /><p>a\tb</p></blockquote><p>t1</p>",
      "the Image button": `<blockquote><p>a</p><hr /><p>${IMG}</p></blockquote><p>t1</p>`,
      Enter: "<blockquote><p>a</p><hr /><p></p></blockquote><p>t1</p>",
      "an HTML paste of two paragraphs":
        "<blockquote><p>a</p><hr /><p>H1</p><p>H2</p></blockquote><p>t1</p>",
    },
    "the end of a numbered item's text after a quote": {
      "Shift+Enter":
        "<ol><li><blockquote><p>q1</p></blockquote>q2<br /></li><li>t1</li></ol>",
      "a two-line plain-text paste":
        "<ol><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ol>",
      "a three-line plain-text paste":
        "<ol><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>L3</li><li>t1</li></ol>",
      "a CRLF plain-text paste":
        "<ol><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ol>",
      "a two-line plain-text drop":
        "<ol><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ol>",
      "a plain-text paste holding a tab":
        "<ol><li><blockquote><p>q1</p></blockquote>q2a\tb</li><li>t1</li></ol>",
      "the Image button": `<ol><li><blockquote><p>q1</p></blockquote>q2${IMG}</li><li>t1</li></ol>`,
      Enter:
        "<ol><li><blockquote><p>q1</p></blockquote>q2</li><li></li><li>t1</li></ol>",
      "an HTML paste of two paragraphs":
        "<ol><li><blockquote><p>q1</p></blockquote>q2H1</li></ol><p>H2</p><ol><li>t1</li></ol>",
    },
    "the end of an item's text after a quote, three levels deep": {
      "Shift+Enter":
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2<br /></li><li>t1</li></ul></li></ul></li></ul>",
      "a two-line plain-text paste":
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ul></li></ul></li></ul>",
      "a three-line plain-text paste":
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>L3</li><li>t1</li></ul></li></ul></li></ul>",
      "a CRLF plain-text paste":
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ul></li></ul></li></ul>",
      "a two-line plain-text drop":
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ul></li></ul></li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2a\tb</li><li>t1</li></ul></li></ul></li></ul>",
      "the Image button": `<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2${IMG}</li><li>t1</li></ul></li></ul></li></ul>`,
      Enter:
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2</li><li></li><li>t1</li></ul></li></ul></li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2H1</li></ul></li><li>H2<ul><li>t1</li></ul></li></ul></li></ul>",
    },
    "the end of an item's text after a heading, in a quote": {
      "Shift+Enter":
        "<blockquote><ul><li><h3>T</h3>q2<br /></li><li>t1</li></ul></blockquote>",
      "a two-line plain-text paste":
        "<blockquote><ul><li><h3>T</h3>q2L1</li><li>L2</li><li>t1</li></ul></blockquote>",
      "a three-line plain-text paste":
        "<blockquote><ul><li><h3>T</h3>q2L1</li><li>L2</li><li>L3</li><li>t1</li></ul></blockquote>",
      "a CRLF plain-text paste":
        "<blockquote><ul><li><h3>T</h3>q2L1</li><li>L2</li><li>t1</li></ul></blockquote>",
      "a two-line plain-text drop":
        "<blockquote><ul><li><h3>T</h3>q2L1</li><li>L2</li><li>t1</li></ul></blockquote>",
      "a plain-text paste holding a tab":
        "<blockquote><ul><li><h3>T</h3>q2a\tb</li><li>t1</li></ul></blockquote>",
      "the Image button": `<blockquote><ul><li><h3>T</h3>q2${IMG}</li><li>t1</li></ul></blockquote>`,
      Enter:
        "<blockquote><ul><li><h3>T</h3>q2</li><li></li><li>t1</li></ul></blockquote>",
      "an HTML paste of two paragraphs":
        "<blockquote><ul><li><h3>T</h3>q2H1</li></ul><p>H2</p><ul><li>t1</li></ul></blockquote>",
    },
  };
  /** What each edit writes at an ordinary caret, unchanged. */
  const CONTROL_WRITES: Record<string, Record<string, string>> = {
    "the end of an ordinary item": {
      "Shift+Enter": "<ul><li>aa<br /></li><li>bb</li></ul>",
      "a two-line plain-text paste":
        "<ul><li>aaL1</li><li>L2</li><li>bb</li></ul>",
      "a three-line plain-text paste":
        "<ul><li>aaL1</li><li>L2</li><li>L3</li><li>bb</li></ul>",
      "a CRLF plain-text paste": "<ul><li>aaL1</li><li>L2</li><li>bb</li></ul>",
      "a two-line plain-text drop":
        "<ul><li>aaL1</li><li>L2</li><li>bb</li></ul>",
      "a plain-text paste holding a tab": "<ul><li>aaa\tb</li><li>bb</li></ul>",
      "the Image button": `<ul><li>aa${IMG}</li><li>bb</li></ul>`,
      Enter: "<ul><li>aa</li><li></li><li>bb</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li>aaH1</li></ul><p>H2</p><ul><li>bb</li></ul>",
    },
    "an empty item": {
      "Shift+Enter": "<ul><li>aa</li><li><br /></li><li>bb</li></ul>",
      "a two-line plain-text paste":
        "<ul><li>aa</li><li>L1</li><li>L2</li><li>bb</li></ul>",
      "a three-line plain-text paste":
        "<ul><li>aa</li><li>L1</li><li>L2</li><li>L3</li><li>bb</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li>aa</li><li>L1</li><li>L2</li><li>bb</li></ul>",
      "a two-line plain-text drop":
        "<ul><li>aa</li><li>L1</li><li>L2</li><li>bb</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li>aa</li><li>a\tb</li><li>bb</li></ul>",
      "the Image button": `<ul><li>aa</li><li>${IMG}</li><li>bb</li></ul>`,
      Enter: "<ul><li>aa</li></ul><p></p><ul><li>bb</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li>aa</li><li>H1</li></ul><p>H2</p><ul><li>bb</li></ul>",
    },
    "the end of a paragraph": {
      "Shift+Enter": "<p>pp<br /></p><p>t1</p>",
      "a two-line plain-text paste": "<p>ppL1</p><p>L2</p><p>t1</p>",
      "a three-line plain-text paste": "<p>ppL1</p><p>L2</p><p>L3</p><p>t1</p>",
      "a CRLF plain-text paste": "<p>ppL1</p><p>L2</p><p>t1</p>",
      "a two-line plain-text drop": "<p>ppL1</p><p>L2</p><p>t1</p>",
      "a plain-text paste holding a tab": "<p>ppa\tb</p><p>t1</p>",
      "the Image button": `<p>pp${IMG}</p><p>t1</p>`,
      Enter: "<p>pp</p><p></p><p>t1</p>",
      "an HTML paste of two paragraphs": "<p>ppH1</p><p>H2</p><p>t1</p>",
    },
    "the end of a quote's paragraph": {
      "Shift+Enter": "<blockquote><p>qq<br /></p></blockquote><p>t1</p>",
      "a two-line plain-text paste":
        "<blockquote><p>qqL1</p><p>L2</p></blockquote><p>t1</p>",
      "a three-line plain-text paste":
        "<blockquote><p>qqL1</p><p>L2</p><p>L3</p></blockquote><p>t1</p>",
      "a CRLF plain-text paste":
        "<blockquote><p>qqL1</p><p>L2</p></blockquote><p>t1</p>",
      "a two-line plain-text drop":
        "<blockquote><p>qqL1</p><p>L2</p></blockquote><p>t1</p>",
      "a plain-text paste holding a tab":
        "<blockquote><p>qqa\tb</p></blockquote><p>t1</p>",
      "the Image button": `<blockquote><p>qq${IMG}</p></blockquote><p>t1</p>`,
      Enter: "<blockquote><p>qq</p><p></p></blockquote><p>t1</p>",
      "an HTML paste of two paragraphs":
        "<blockquote><p>qqH1</p><p>H2</p></blockquote><p>t1</p>",
    },
  };
  const run = async ([, html, place, at]: Caret, [name, edit]: Edit) => {
    const onChange = await renderField(html, {
      source: {
        uploadImage: vi.fn(async () => ({
          url: "https://cdn.example.org/x.png",
          path: "org/x.png",
        })),
      } as never,
    });
    await place();
    expect(caret()).toBe(at);
    const before = JSON.stringify(editorOf()!.getEditorState().toJSON());
    const errors = vi.spyOn(console, "error");
    const start = performance.now();
    await edit(onChange)();
    expect(performance.now() - start, name).toBeLessThan(2000);
    expect(
      errors.mock.calls
        .map((args) => String(args[0]))
        .filter((message) => message.includes("not wrapped in act") === false)
    ).toEqual([]);
    const written = plain(lastHtml(onChange));
    editable()!.focus();
    await undo();
    expect(JSON.stringify(editorOf()!.getEditorState().toJSON())).toBe(before);
    return written;
  };
  const cases = (carets: Caret[]) =>
    carets.flatMap((place) =>
      EDITS.map((edit) => ({
        caret: place[0],
        edit: edit[0],
        place,
        run: edit,
      }))
    );
  test.each(cases(CARETS))(
    "$edit at $caret finishes at once and lands at the caret",
    async ({ caret: name, edit, place, run: step }) => {
      const written = await run(place, step);
      expect(written).toBe(WRITES[name][edit]);
      // a tab reloads as a space in any block
      if (written.includes("\t") === false) {
        expectFixedPoint(written);
      }
    },
    60000
  );
  test.each(cases(CONTROLS))(
    "$edit at $caret writes what it wrote before",
    async ({ caret: name, edit, place, run: step }) => {
      const written = await run(place, step);
      expect(written).toBe(CONTROL_WRITES[name][edit]);
    },
    60000
  );
});
