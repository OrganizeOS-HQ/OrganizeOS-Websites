import { describe, expect, test } from "vitest";
import { createEditor } from "lexical";
import { LinkNode } from "@lexical/link";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import {
  exportRichTextHtml,
  getRichTextReadOnlyReason,
  importRichTextHtml,
} from "./rich-text-html";

/** Loads stored HTML into the editor's node set, then writes it back. */
const roundTrip = (html: string) => {
  const editor = createEditor({
    namespace: "cms-rich-text-test",
    nodes: [LinkNode, HorizontalRuleNode],
    onError: (error) => {
      throw error;
    },
  });
  editor.update(() => importRichTextHtml(html), { discrete: true });
  return editor.getEditorState().read(exportRichTextHtml);
};

describe("the rich text round trip", () => {
  test.each([
    ["a paragraph", "<p>Members voted.</p>"],
    [
      "every text format",
      "<p><strong>bold</strong> <em>italic</em> <u>underline</u> <s>struck</s> <code>code</code></p>",
    ],
    [
      "a link with a new tab",
      '<p>Ask your <a href="https://eastbrookworkers.example/stewards" target="_blank" rel="noopener noreferrer">steward</a>.</p>',
    ],
    [
      "a link with a title",
      '<p><a href="https://eastbrookworkers.example" title="Home">Home</a></p>',
    ],
    ["a line break", "<p>Every signature<br>is counted.</p>"],
    ["a divider between paragraphs", "<p>Before</p><hr><p>After</p>"],
    ["text that needs escaping", "<p>Pay &amp; safety &lt;now&gt;</p>"],
  ])("keeps %s", (_, html) => {
    expect(roundTrip(html)).toBe(html);
  });

  test("a stable second pass", () => {
    const html =
      '<p>Across <strong>Eastbrook</strong>, <em>members</em> organize.</p><hr><p><a href="https://eastbrookworkers.example">Join</a><br>today</p>';
    expect(roundTrip(roundTrip(html))).toBe(roundTrip(html));
  });

  test("b and i write their semantic tags", () => {
    expect(roundTrip("<p><b>bold</b> <i>italic</i></p>")).toBe(
      "<p><strong>bold</strong> <em>italic</em></p>"
    );
  });

  test("an empty value is one empty paragraph", () => {
    expect(roundTrip("")).toBe("<p></p>");
  });
});

describe("what opens read-only, so nothing is lost silently", () => {
  test.each([
    [
      "an image",
      '<p><img src="https://example.com/a.png" alt="A"></p>',
      "images",
    ],
    ["a figure", "<figure><figcaption>Caption</figcaption></figure>", "images"],
    ["a heading", "<h2>Heading</h2><p>Body</p>", "unsupported"],
    ["a list", "<ul><li>One</li></ul>", "unsupported"],
    ["a numbered list", "<ol><li>One</li></ol>", "unsupported"],
    ["a quote", "<blockquote><p>Quote</p></blockquote>", "unsupported"],
    ["a code block", "<pre><code>code</code></pre>", "unsupported"],
  ])("%s", (_, html, reason) => {
    expect(getRichTextReadOnlyReason(html)).toBe(reason);
  });

  test("what the node set keeps opens for editing", () => {
    expect(
      getRichTextReadOnlyReason(
        '<p><strong>b</strong> <a href="https://example.com">a</a><br>x</p><hr>'
      )
    ).toBeUndefined();
    expect(getRichTextReadOnlyReason("")).toBeUndefined();
  });
});
