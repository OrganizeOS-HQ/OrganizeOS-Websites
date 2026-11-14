import { describe, expect, test } from "vitest";
import {
  getRichTextReadOnlyReason,
  settleRichTextHtml,
} from "./rich-text-html";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";

// Editor writes that reopened read-only (self-lock decision, 2026-11-14),
// as the editor wrote them before this round's fixes. Ids are the
// verification's: X3 to X31, seed 70419, and the 4a live cases (L4a).

// A save settles each: the editor's own write, which reopens editable and
// holds the same content.
const SETTLED: Record<string, string> = {
  X3a: "<ul><li><p>a</p><p>b</p></li></ul>",
  X3b: "<ol><li><p>a</p><p>b</p></li></ol>",
  X3c: "<ol><li><p>x</p><p>a</p><p>b</p></li></ol>",
  X3d: "<p>Thanks</p><ol><li>On Mon wrote:<p>a</p><p>b</p></li></ol>",
  X3e: "<ul><li><p>Intro</p><p>one</p><p>two</p></li></ul>",
  X3f: "<ol><li>q<p>a</p><p>b</p></li><li>r</li></ol>",
  X4a: '<p><a href="https://example.org/"> Read</a> more</p>',
  X4b: '<p>Join<br /><a href="https://example.org/"> here</a></p>',
  X4c: '<ul><li><a href="https://example.org/"> x</a></li></ul>',
  X4d: '<p><a href="https://example.org/"> b</a></p>',
  X5a: "<p>three <i><em> </em></i></p>",
  X5b: "<p><b><strong>Done. </strong></b> </p><p>Next</p>",
  X5c: "<p>a <b><strong> </strong></b>b</p>",
  X6a: '<p>go <a href="https://example.org/">here </a></p>',
  X6b: '<p>go <a href="https://example.org/">here </a><br />x</p>',
  X6c: '<p>go <a href="https://example.org/">here </a><s></s></p>',
  X6d: '<ol><li>a<br /><a href="https://example.org/">bw </a><s></s></li></ol>',
  X9a: "<ol><li>x<p>a</p><p>b</p></li></ol>",
  X9b: "<ol><li><p>a</p><p>b</p></li></ol>",
  X9c: "<ul><li><p>a</p><p>b</p></li></ul>",
  X9d: "<ol><li><p>a</p></li><li><p>c</p><p>d</p></li></ol>",
  X9e: "<ul><li><p>x</p><p>a</p><p>b</p></li></ul>",
  X15a: '<p><a href="https://example.org/"> x</a></p>',
  X15b: '<p><a href="https://example.org/"> here</a></p>',
  X15c: '<p>x<br /><a href="https://example.org/"> y</a></p>',
  X15d: '<h2><a href="https://example.org/"> x</a></h2>',
  X15e: '<blockquote><p><a href="https://example.org/"> x</a></p></blockquote>',
  X16a: '<p>see <a href="https://example.org/">this </a></p>',
  X16b: '<p>see <a href="https://example.org/">this </a><br />y</p>',
  X16c: '<p>see\t<a href="https://example.org/"> this</a></p>',
  X29a: '<p><a href="https://example.org/"> world</a></p>',
  X29b: '<p><a href="https://example.org/">x now </a></p>',
  X29c: '<p>x <a href="https://example.org/">Donate </a><br />today</p>',
  X29d: '<p>x our <a href="https://example.org/"><br />website</a></p>',
  X30a: "<ol><li><p>Step one</p><p>Step two</p></li></ol>",
  X30b: "<ul><li><p>Step one</p><p>Step two</p></li></ul><p>after</p>",
  X30c: "<ul><li><p>Said</p><p>Quoted</p></li></ul>",
};

// The editor no longer writes these (the emptied-parent import, and a list
// item outside a list read once sanitised): each reads editable as it is.
const UNCHANGED: Record<string, string> = {
  X8a: "<ul><li>z</li><li>&nbsp;<ul><li>n</li></ul></li></ul>",
  X8b: "<ol><li>z</li><li>&nbsp;<ul><li>n</li></ul></li></ol>",
  X8c: "<ul><li>a</li><li>&nbsp;<ul><li>n</li></ul></li></ul>",
  X8d: "<ul><li>a</li><li>\u2003<ul><li>n</li></ul></li></ul>",
  X17a: "<ul><li>x</li><li><ul><li>b</li></ul><ol><li>c</li></ol></li></ul>",
  X17b: "<ul><li>x</li><li><ul><li>b</li></ul><ul><li>c</li></ul></li></ul>",
  X22c: "<ul><li><li>x</li></li></ul>",
  X1c: "<ul><li><li>minutes</li></li></ul>",
  X31a: "<ul><li>a</li><li>&nbsp;<ul><li>b</li></ul></li></ul>",
  X31b: "<ul><li>a</li><li><ul><li>b</li></ul><ol><li>c</li></ol></li></ul>",
  S70419:
    "<ol><li>one<ol><li>two</li><li><ol><li>three</li></ol><ul><li>p1</li><li>p2<ul><li>n</li></ul></li></ul></li></ol></li></ol>",
};

// A rewrite of these would move content, or the editor cannot load them, so
// a save sends them as written. The editor no longer writes them: blocks
// pasted after a nested list (X7, L4a), a list item with no list around it
// (X1, X22), a list pasted past the depth limit (X20).
const KEPT: Record<string, string> = {
  X7a: "<ul><li>a</li><li><ul><li>bone</li></ul><p>two</p></li></ul>",
  X7b: "<ul><li>a</li><li><ul><li>b</li></ul><pre><code>c1\nc2</code></pre></li></ul>",
  X7c: "<ul><li>a</li><li><ul><li>b</li></ul><blockquote><p>q</p></blockquote></li></ul>",
  X7d: '<ul><li>Agenda</li><li><ul><li>BudgetMinutes</li></ul><p>Approved.</p><p>Next <a href="https://e.org/">here</a>.</p></li></ul>',
  X7e: "<ol><li>a</li><li><ol><li>one</li></ol><p>twob</p></li></ol>",
  X22a: "<li>x</li>",
  X22b: "<p>a</p><li>b</li>",
  X1a: "<li>today</li>",
  X1b: "<p>a</p><li>today</li>",
  X20a: "<p>x</p><ul><li>1<ul><li>2<ul><li>3<ul><li>4<ul><li>5<ul><li>6<ul><li>7<ul><li>8</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>",
  X20b: "<p>x</p><ul><li>1</li><ul><li>2</li><ul><li>3</li><ul><li>4</li><ul><li>5</li><ul><li>6</li><ul><li>7</li><ul><li>8</li><ul><li>9</li></ul></ul></ul></ul></ul></ul></ul></ul></ul>",
  L4a1: "<ul><li>a</li><li><ul><li>bone</li></ul><hr /><ul><li></li></ul></li></ul>",
  L4a2: '<ul><li>a</li><li><ul><li>bone</li></ul><p><img src="https://example.org/a.png" alt="A" /></p></li></ul>',
  L4a3: '<ul><li>a</li><li><ul><li>b</li></ul><p></p><p><img src="https://example.org/a.png" alt="A" /></p></li></ul>',
  L4a4: '<ul><li>a</li><li><ul><li>bone</li></ul><figure><img src="https://example.org/a.png" alt="A" /><figcaption>Cap</figcaption></figure><ul><li></li></ul></li></ul>',
  L4a5: '<ul><li>a</li><li><ul><li>bone</li></ul><blockquote><img src="https://example.org/a.png" alt="A" /></blockquote></li></ul>',
};

describe("the save backstop over the recorded self-locks", () => {
  test.each(Object.entries(SETTLED))(
    "%s settles to a value that reopens editable and settles to itself",
    (_, html) => {
      expect(getRichTextReadOnlyReason(sanitizeRichTextHtml(html))).toBe(
        "lossy"
      );
      const settled = settleRichTextHtml(html);
      expect(settled.outcome).toBe("settled");
      expect(getRichTextReadOnlyReason(settled.html)).toBeUndefined();
      expect(settleRichTextHtml(settled.html)).toEqual({
        html: settled.html,
        outcome: "unchanged",
      });
    }
  );

  test.each(Object.entries(UNCHANGED))(
    "%s reads editable and comes back unchanged",
    (_, html) => {
      expect(settleRichTextHtml(html)).toEqual({ html, outcome: "unchanged" });
    }
  );

  test.each(Object.entries(KEPT))("%s is kept as written", (_, html) => {
    expect(settleRichTextHtml(html)).toEqual({ html, outcome: "kept" });
  });
});
