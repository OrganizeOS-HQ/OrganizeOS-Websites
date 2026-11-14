import { describe, expect, test } from "vitest";
import { $createRangeSelection, $getRoot, createEditor } from "lexical";
import { $generateHtmlFromNodes } from "@lexical/html";
import fixture from "./__fixtures__/rich-text-roundtrip.json";
import {
  exportRichTextHtml,
  getRichTextReadOnlyReason,
  importRichTextHtml,
  markRichTextCopy,
  readRichTextValue,
  richTextHref,
  richTextHtmlConfig,
  richTextImportHref,
  richTextNodes,
  sameRichTextContent,
  settleRichTextHtml,
  writeRichTextHeadless,
} from "./rich-text-html";
import corpus from "./__fixtures__/rich-text-corpus.json";
import { toRichTextNodes } from "./rich-text-nodes";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";

/**
 * A value the editor opens editable saves a value that opens editable too,
 * and saves the same again: the read-only rule never locks the editor's own
 * write, and a second save changes nothing.
 */
const expectStableIfEditable = (html: string) => {
  if (getRichTextReadOnlyReason(html) !== undefined) {
    return;
  }
  const saved = sanitizeRichTextHtml(writeRichTextHeadless(html));
  expect(sanitizeRichTextHtml(saved)).toBe(saved);
  expect(getRichTextReadOnlyReason(saved)).toBeUndefined();
  expect(sanitizeRichTextHtml(writeRichTextHeadless(saved))).toBe(saved);
};

/** Loads stored HTML into the editor's node set, then writes it back. */
const roundTrip = (html: string) => {
  const editor = createEditor({
    nodes: [...richTextNodes],
    html: richTextHtmlConfig,
    onError: (error) => {
      throw error;
    },
  });
  editor.update(() => importRichTextHtml(editor, html), { discrete: true });
  return exportRichTextHtml(editor);
};

describe("the round trip (spec 8)", () => {
  test.each(fixture.cases)(
    "$name: loading input and writing gives editor",
    ({ input, editor }) => {
      expect(roundTrip(input)).toBe(editor);
    }
  );

  test.each(fixture.readOnly)(
    "$name opens read-only: $reason",
    ({ input, reason }) => {
      expect(getRichTextReadOnlyReason(input)).toBe(reason);
    }
  );

  test.each(fixture.cases)("$name is not read-only", ({ input }) => {
    expect(getRichTextReadOnlyReason(input)).toBeUndefined();
  });

  test("every case is pinned by the platform", () => {
    for (const c of fixture.cases) {
      expect(
        "stored" in c && (c.stored === null || typeof c.stored === "string")
      ).toBe(true);
    }
  });

  test.each(fixture.cases)(
    "$name: loading stored and writing again gives editor",
    ({ stored, editor }) => {
      expect(roundTrip(stored ?? "")).toBe(editor);
    }
  );

  test("only a value the editor would not keep whole is read-only", () => {
    expect(new Set(fixture.readOnly.map(({ reason }) => reason))).toEqual(
      new Set(["lossy"])
    );
  });

  // a figure is kept whole only at the value's top level; a nested one loads
  // through the other rules and reads lossy, whatever its caption holds
  const IMG = '<img src="https://example.org/a.png" alt="A" />';
  const figures = [
    `<figure>${IMG}<figcaption>c</figcaption></figure>`,
    `<figure>${IMG}<figcaption>\u00a0</figcaption></figure>`,
    `<figure>\n  ${IMG}\n  <figcaption>\n    c\n  </figcaption>\n</figure>`,
    `<figure>${IMG}</figure>`,
  ];
  const nestings = [
    (inner: string) => `<blockquote>${inner}</blockquote>`,
    (inner: string) =>
      `<blockquote><blockquote>${inner}</blockquote></blockquote>`,
    (inner: string) => `<ul><li>${inner}</li></ul><p></p>`,
    (inner: string) => `<ol><li>${inner}</li></ol><p></p>`,
    (inner: string) => `<ul><li><ul><li>${inner}</li></ul></li></ul><p></p>`,
    (inner: string) => `<ul><li><p>a</p>${inner}</li></ul><p></p>`,
    (inner: string) => `<ul><li>${inner}<p>a</p></li></ul><p></p>`,
    (inner: string) => `<h2>${inner}</h2>`,
    (inner: string) => `<h3>${inner}</h3>`,
    (inner: string) => `<pre>${inner}</pre>`,
    (inner: string) => `<pre><code>${inner}</code></pre>`,
    (inner: string) => `<ul><li><h3>${inner}</h3></li></ul><p></p>`,
    (inner: string) =>
      `<blockquote><a href="https://example.org/">${inner}</a></blockquote>`,
  ];
  test.each(nestings.flatMap((nest) => figures.map((figure) => nest(figure))))(
    "a nested figure loads without failing, and an editable one saves stably: %s",
    (html) => {
      expect(() => roundTrip(html)).not.toThrow();
      expectStableIfEditable(html);
    }
  );

  test.each([
    ...figures,
    `<figure>${IMG} <figcaption>c</figcaption></figure>`,
    `<figure>${IMG}<figcaption> c</figcaption></figure>`,
  ])("a figure at the top level stays editable: %s", (figure) => {
    expect(getRichTextReadOnlyReason(`<p>a</p>${figure}`)).toBeUndefined();
  });

  // the import's edge mark (U+E000) never reaches what the editor writes
  test.each([
    ...fixture.cases.map(({ input }) => input),
    ...nestings.flatMap((nest) => figures.map((figure) => nest(figure))),
    `<p>a</p><figure>${IMG}<figcaption> c</figcaption></figure>`,
    `<p>See <a href="https://example.org/">${IMG}</a> here</p>`,
    `<p><strong>Bold </strong>${IMG}<em> after</em></p>`,
  ])("no mark in the export: %s", (html) => {
    expect(roundTrip(html)).not.toContain("\uE000");
  });

  test("a value already holding U+E000 keeps it, and the spaces beside its image", () => {
    const written = roundTrip(`<p>a\uE000 ${IMG} b</p>`);
    expect(written).toContain("a\uE000 </span><img");
    expect(written).toContain(
      'alt="A"><span style="white-space: pre-wrap;"> b'
    );
  });

  const WRITTEN_IMG = '<img src="https://example.org/a.png" alt="A">';
  test("the space beside an image survives a mark around its neighbour", () => {
    expect(
      roundTrip(`<p><strong>Bold </strong>${IMG}<em> after</em></p>`)
    ).toBe(
      `<p><b><strong style="white-space: pre-wrap;">Bold </strong></b>${WRITTEN_IMG}<i><em style="white-space: pre-wrap;"> after</em></i></p>`
    );
  });

  test("a line break stops the search for an image's neighbour", () => {
    expect(roundTrip(`<p>a <br>${IMG}<br> b</p>`)).toBe(
      `<p><span style="white-space: pre-wrap;">a</span><br>${WRITTEN_IMG}<br><span style="white-space: pre-wrap;">b</span></p>`
    );
  });

  test("a link with nothing in it stays editable and is dropped on save", () => {
    const html = `<p>x<a href="https://example.org/"></a>y</p>`;
    expect(getRichTextReadOnlyReason(html)).toBeUndefined();
    expect(roundTrip(html)).not.toContain("<a");
  });

  test("a link holding only a space reads lossy, with an image or without", () => {
    expect(
      getRichTextReadOnlyReason(
        `<p>x${IMG}<a href="https://example.org/"> </a></p>`
      )
    ).toBe("lossy");
    expect(
      getRichTextReadOnlyReason(`<p>x<a href="https://example.org/"> </a></p>`)
    ).toBe("lossy");
  });

  test.each([
    `<ul><li>${IMG}<p>b</p></li></ul><p></p>`,
    `<ul><li><p>Step one</p>${IMG}</li><li><p>Step two</p></li></ul><p></p>`,
    `<ul><li><p>a</p>${IMG}<p>b</p></li></ul><p></p>`,
    `<ol><li>${IMG}<p>b</p></li></ol><p></p>`,
    `<blockquote><ul><li>${IMG}<p>b</p></li></ul></blockquote>`,
    `<ul><li><strong>${IMG}</strong><p>b</p></li></ul><p></p>`,
  ])(
    "a list item holding a paragraph beside an image reads lossy: %s",
    (html) => {
      expect(getRichTextReadOnlyReason(html)).toBe("lossy");
    }
  );

  test("an empty mark beside an image does not cost the space", () => {
    const linkAfter = roundTrip(
      `<p><a href="https://example.org/">x${IMG}<strong></strong></a> after</p>`
    );
    expect(linkAfter).toContain(
      '<span style="white-space: pre-wrap;"> after</span>'
    );
    const linkBefore = roundTrip(
      `<p>before <a href="https://example.org/"><em></em>${IMG}y</a></p>`
    );
    expect(linkBefore).toContain(
      '<span style="white-space: pre-wrap;">before </span>'
    );
  });

  test("a value with an image and no private-use character free reads lossy", () => {
    let every = "";
    for (let code = 0xe000; code <= 0xf8ff; code += 1) {
      every += String.fromCharCode(code);
    }
    expect(
      getRichTextReadOnlyReason(`<p>${every}</p><p>Join us ${IMG} today</p>`)
    ).toBe("lossy");
  });

  test("an image in a link the editor unwraps reads lossy", () => {
    expect(getRichTextReadOnlyReason(`<p>More <a>${IMG}</a> after</p>`)).toBe(
      "lossy"
    );
  });

  test("the editor never writes a tag outside the allowlist but span", () => {
    const allowed = new Set([
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "a",
      "ul",
      "ol",
      "li",
      "h2",
      "h3",
      "h4",
      "blockquote",
      "code",
      "pre",
      "hr",
      "img",
      "figure",
      "figcaption",
      "span",
    ]);
    for (const { editor } of fixture.cases) {
      const tags = [...editor.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g)].map(
        (match) => match[1].toLowerCase()
      );
      expect(tags.filter((tag) => allowed.has(tag) === false)).toEqual([]);
    }
  });
});

describe("link addresses", () => {
  test.each([
    ["https://a.org", "https://a.org"],
    ["/about", "/about"],
    ["#join", "#join"],
    ["mailto:a@b.org", "mailto:a@b.org"],
    ["tel:+1", "tel:+1"],
    [" https://a.org ", "https://a.org"],
    ["//a.org", null],
    ["/\\a.org", null],
    ["javascript:alert(1)", null],
    ["data:text/html,x", null],
    ["https://a.\u0001org", null],
    ["https://a.org/\u0001", "https://a.org/"],
    ["contact", null],
    ["", null],
  ])("richTextHref(%j) is %j", (raw, out) => {
    expect(richTextHref(raw)).toBe(out);
  });

  test.each([
    ["https://a.org", "https://a.org"],
    ["contact", "contact"],
    ["//a.org/", "//a.org/"],
    ["#join", "#join"],
    ["mailto:a@b.org", "mailto:a@b.org"],
    ["javascript:alert(1)", null],
    ["data:text/html,x", null],
    ["", null],
  ])("richTextImportHref(%j) is %j", (raw, out) => {
    expect(richTextImportHref(raw)).toBe(out);
  });
});

describe("readRichTextValue", () => {
  test.each([null, 42, {}, { html: 1 }])(
    "readRichTextValue(%j) is null",
    (value) => {
      expect(readRichTextValue(value)).toBeNull();
    }
  );

  test("readRichTextValue derives the text a value without one lacks", () => {
    expect(readRichTextValue("<p>a</p><p>b</p>")).toEqual({
      html: "<p>a</p><p>b</p>",
      text: "a b",
    });
    expect(readRichTextValue({ html: "<p>x &amp; y<br />z</p>" })).toEqual({
      html: "<p>x &amp; y<br />z</p>",
      text: "x & y z",
    });
    expect(readRichTextValue({ html: "<p>a</p>", text: "kept" })).toEqual({
      html: "<p>a</p>",
      text: "kept",
    });
  });
});

test("a copy reaching partway into a code block writes only its selected text", () => {
  const editor = createEditor({
    nodes: [...richTextNodes],
    html: richTextHtmlConfig,
    onError: (error) => {
      throw error;
    },
  });
  editor.update(
    () =>
      importRichTextHtml(
        editor,
        "<p>before</p><pre><code>first line\nsecond line</code></pre>"
      ),
    { discrete: true }
  );
  let copied = "";
  let saved = "";
  editor.update(
    () => {
      const before = $getRoot().getFirstDescendant();
      const firstLine = $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent().startsWith("first"));
      if (before === null || firstLine === undefined) {
        throw new Error("not loaded");
      }
      const selection = $createRangeSelection();
      selection.anchor.set(before.getKey(), 0, "text");
      selection.focus.set(firstLine.getKey(), 5, "text");
      markRichTextCopy(selection);
      copied = $generateHtmlFromNodes(editor, selection);
      // the mark clears once the copy is done; a save after it writes all
      markRichTextCopy(null);
      saved = $generateHtmlFromNodes(editor, null);
    },
    { discrete: true }
  );
  expect(copied).toContain("<code>first</code>");
  expect(saved).toContain("<code>first line\nsecond line</code>");
});

describe("what the editor cannot read as the platform does (W4 verification)", () => {
  test.each(fixture.cases.filter((c) => c.stored !== null))(
    "a pinned case's stored value stays editable: $name",
    ({ stored }) => {
      expect(getRichTextReadOnlyReason(stored as string)).toBeUndefined();
    }
  );

  test.each([
    ['<p><a href="https://e.org/"><h2>Title</h2></a></p>', "heading in a link"],
    ['<p>x<a href="https://e.org/"><hr /></a>y</p>', "rule in a link"],
    [
      '<a href="https://e.org/"><h2>Title</h2></a><p>b</p>',
      "top-level link around a heading",
    ],
    ["<p><em><h2>Title</h2></em></p>", "heading in a mark"],
    ["<strong><p>Bold</p></strong>", "paragraph in a mark"],
    [
      '<p><a href="https://example.org/">News<h3>Title</h3></a></p>',
      "heading in a link after its text",
    ],
    ["<p>x<em><h2>u</h2></em>y</p>", "heading in a mark between words"],
    ["<p>x<strong>a<ul><li>u</li></ul>b</strong>y</p>", "list in a mark"],
    ["<p><strong><br /></strong></p><p>x</p>", "a marked line break alone"],
    ["<p>one<br /><strong></strong></p>", "a last break before an empty mark"],
    ["<p>one<br /><br /><em></em></p>", "two last breaks before an empty mark"],
    [
      '<p>one<br /><a href="https://e.org/"></a></p>',
      "a last break before an empty link",
    ],
    ["<ul><li>one<br /><u></u></li></ul>", "in a list item"],
    ["<pre><code>a\r\nb</code></pre>", "a carriage return"],
    ["<p>a\u0000b</p>", "a NUL"],
    ["x<br />y", "a line break outside any block"],
  ])("%s loads, and saves stably when editable (%s)", (html) => {
    expect(() => roundTrip(html)).not.toThrow();
    expectStableIfEditable(html);
  });

  // exact-guard round, item 10: a list item the parser leaves with no list
  // around it holds no block or list command
  test.each([
    "<p><li>x</li></p>",
    "<li><p>stray</p></li>",
    // and at any depth (part 3, item 2)
    "<blockquote><li>x</li></blockquote>",
    "<h2><li>x</li></h2>",
    "<ul><li><blockquote><li>x</li></blockquote></li></ul>",
  ])("a list item with no list around it reads lossy: %s", (html) => {
    expect(getRichTextReadOnlyReason(html)).toBe("lossy");
  });

  // item 11: a stored address with spaces around it is the same link
  test("a stored href with spaces around it stays editable and is written back as stored", () => {
    const html = '<p><a href=" https://example.org/ ">x</a></p>';
    expect(getRichTextReadOnlyReason(html)).toBeUndefined();
    expect(roundTrip(html)).toContain('href=" https://example.org/ "');
  });

  // item 12: an emptied parent bullet keeps its sub-bullets its own
  test.each([
    "<ul><li><p>a</p></li><li><ul><li><p>child</p></li></ul></li></ul>",
    "<ol><li><p>a</p></li><li><ol><li><p>child</p></li></ol></li><li><p>b</p></li></ol>",
  ])("an emptied parent bullet stays editable and saves stably: %s", (html) => {
    expect(getRichTextReadOnlyReason(html)).toBeUndefined();
    expectStableIfEditable(html);
  });

  test("a > inside an attribute does not end the tag", () => {
    expect(
      getRichTextReadOnlyReason(
        '<p><a href="https://e.org/" title="x><h2>">x</a></p>'
      )
    ).toBeUndefined();
  });

  test.each([
    "<h2></h2><p>x</p>",
    "<h3></h3><p>x</p>",
    "<blockquote></blockquote><p>x</p>",
  ])("an empty heading or quote writes no line break: %s", (html) => {
    expect(roundTrip(html)).not.toContain("<br");
  });
});

// V11: a stored value's load keeps every line break, and its save writes
// them back as they were (owner decision, 2026-11-14)
describe("a block's last line break", () => {
  const plain = (html: string) =>
    roundTrip(html)
      .replace(/<span[^>]*>/g, "")
      .replace(/<\/span>/g, "")
      .replace(/ value="\d+"/g, "");

  test.each([
    "<p>one<br></p>",
    "<p>one<br><br></p>",
    "<p>one<br><br><br></p>",
    "<h2>one<br></h2>",
    "<blockquote>one<br></blockquote>",
    "<ul><li>one<br></li></ul>",
    "<ul><li>one<br><br></li></ul>",
    "<ol><li>a<br>b<br></li></ol>",
    "<ul><li>one<br><ul><li>two</li></ul></li></ul>",
  ])("%s reloads as it was, editable", (html) => {
    expect(plain(html)).toBe(html);
    expect(getRichTextReadOnlyReason(html)).toBeUndefined();
  });

  test.each([
    "<p><strong>one<br></strong></p>",
    "<p><strong>one<br></strong>two</p>",
    "<p>one<br><strong></strong></p>",
    '<p><a href="https://example.org/">one<br></a></p>',
    '<p>x<a href="https://e.org/">Read more<br /></a></p>',
    '<p><img src="https://e.org/a.png" alt="A" /><br /></p>',
    '<p><img src="https://e.org/a.png" alt="A" /><br /><br /></p>',
    '<p>a<img src="https://e.org/a.png" alt="A" /><br />b</p>',
    "<ul><li><p>one<br /></p></li></ul>",
    "<ul><li><p>one<br /><br /></p></li></ul>",
  ])("%s keeps its nodes, editable", (html) => {
    expect(getRichTextReadOnlyReason(html)).toBeUndefined();
    expectStableIfEditable(html);
  });
});

// a blank line kept as the page shows it (P4g verification, items 1 and 3)
describe("a block holding only line breaks, or only a space that shows", () => {
  const plain = (html: string) =>
    roundTrip(html)
      .replace(/<span[^>]*>/g, "")
      .replace(/<\/span>/g, "")
      .replace(/ value="\d+"/g, "")
      .replace(/&nbsp;/g, "\u00a0");

  test.each([
    ["<p><br></p><p>x</p>", "<p><br></p><p>x</p>"],
    ["<p><br><br></p><p>x</p>", "<p><br><br></p><p>x</p>"],
    ["<p> <br> </p><p>x</p>", "<p><br></p><p>x</p>"],
    ["<h2><br></h2><p>x</p>", "<h2><br></h2><p>x</p>"],
    [
      "<blockquote><br></blockquote><p>x</p>",
      "<blockquote><br></blockquote><p>x</p>",
    ],
    ["<ul><li><br></li></ul><p>x</p>", "<ul><li><br></li></ul><p>x</p>"],
    ["<p>a</p><p>\u00a0</p><p>b</p>", "<p>a</p><p>\u00a0</p><p>b</p>"],
    ["<h2>\u00a0</h2><p>x</p>", "<h2>\u00a0</h2><p>x</p>"],
    ["<p>\u2003</p><p>x</p>", "<p>\u2003</p><p>x</p>"],
  ])("%s writes %s, editable", (html, written) => {
    expect(plain(html)).toBe(written);
    expect(getRichTextReadOnlyReason(html)).toBeUndefined();
  });
});

describe("the platform's node and depth limits (exact-guard round)", () => {
  const lines = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      index % 2 === 0 ? "x" : "<br />"
    ).join("");

  test("a tree cut at the node limit reads lossy, even when the cut empties containers", () => {
    const html = `<p>${lines(4994)}</p><blockquote><ul><li><p>t</p></li></ul></blockquote><ul><li><p>a</p><p>b</p></li></ul>`;
    expect(getRichTextReadOnlyReason(html)).toBe("lossy");
  });

  test.each([
    [
      "a root hr then textless lists",
      "<hr /><ol><li><hr /></li></ol><ol><li><br /></li></ol>",
    ],
    [
      "a root hr then figures",
      `<hr />${'<figure><img src="https://example.org/a.png" alt="" /><figcaption></figcaption></figure>'.repeat(6)}`,
    ],
    ["a list item ending in an hr", "<ul><li><p><br /></p><hr /></li></ul>"],
  ])("a cut in %s, with no text after it, reads lossy", (_, tail) => {
    const html = `<p>${lines(4996)}</p>${tail}`;
    // the platform does cut it: its last node is not the tail's
    expect(toRichTextNodes(html).children.at(-1)).not.toEqual(
      toRichTextNodes(tail).children.at(-1)
    );
    expect(getRichTextReadOnlyReason(html)).toBe("lossy");
  });

  test("a cut inside a nested sub-list's link reads lossy", () => {
    const html = `<p>${lines(4994)}</p><ul><li><p>a</p><ul><li><p><a href="https://example.org/">deep link</a> and more</p></li></ul></li></ul>`;
    expect(getRichTextReadOnlyReason(html)).toBe("lossy");
  });

  test("a tree under the node limit reads as its round trip does", () => {
    const html = `<p>${lines(3000)}</p><ul><li><p>a</p></li></ul>`;
    expect(getRichTextReadOnlyReason(html)).toBeUndefined();
    expectStableIfEditable(html);
  });

  const nested = (levels: number) => {
    let html = "<p>deepest</p>";
    for (let level = 0; level < levels; level += 1) {
      html = `<ul><li>${html}</li></ul>`;
    }
    return html;
  };

  test.each([6, 7])("%i nested lists open editable", (levels) => {
    expect(getRichTextReadOnlyReason(nested(levels))).toBeUndefined();
    expectStableIfEditable(nested(levels));
  });

  test("a list past the depth limit, which the platform flattens, reads lossy", () => {
    expect(getRichTextReadOnlyReason(nested(8))).toBe("lossy");
    expect(
      getRichTextReadOnlyReason(`<blockquote>${nested(7)}</blockquote>`)
    ).toBe("lossy");
  });
});

// the save-time backstop (self-lock decision, 2026-11-14)
describe("settleRichTextHtml", () => {
  test("every corpus value the guard reads editable comes back unchanged, as the same string", () => {
    const moved: string[] = [];
    for (const entry of corpus.entries) {
      if (entry.verdict !== "editable") {
        continue;
      }
      const result = settleRichTextHtml(entry.input);
      if (result.outcome !== "unchanged" || result.html !== entry.input) {
        moved.push(entry.input);
      }
    }
    expect(moved).toEqual([]);
  });

  test.each([
    "<p>Thanks</p><ol><li>On Mon wrote:<p>a</p><p>b</p></li></ol>",
    "<ol><li><p>a</p><p>b</p><blockquote><blockquote><p>a</p><p>b</p></blockquote></blockquote><p></p></li></ol>",
    '<p><a href="https://example.org/a b"><u>  </u></a><img src="https://cdn.example.org/u19.png" alt="" width="2" height="3" /></p>',
  ])(
    "a self-locking write settles, reopens editable, and settles to itself: %s",
    (html) => {
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

  test.each([
    "<ul><li>a</li><li><ul><li>bone</li></ul><p>two</p></li></ul>",
    '<ul><li>a</li><li><ul><li>bone</li></ul><p><img src="https://e.org/a.png" alt="A" /></p></li></ul>',
    "<ul><li>a</li><li><ul><li>bone</li></ul><hr /></li></ul>",
    "<ul><li><ul><li></li></ul><p>b</p></li></ul>",
    '<ul><li><figure><img src="https://e.org/a.png" alt="A" /><figcaption>cap</figcaption></figure></li></ul>',
    "<ul><li><p>a</p><hr /><p>b</p></li></ul>",
  ])(
    "a write whose rewrite would move content is kept as written: %s",
    (html) => {
      expect(settleRichTextHtml(html)).toEqual({ html, outcome: "kept" });
    }
  );

  test("the field's own markup (its pre-wrap spans) settles as the platform stores it", () => {
    const html =
      '<p class="x" dir="ltr"><a href="tel:+15550100" target="_blank" rel="noopener noreferrer"><span style="white-space: pre-wrap;"> b</span></a></p>';
    const settled = settleRichTextHtml(html);
    expect(settled.outcome).toBe("settled");
    expect(settled.html).toBe(
      '<p><a href="tel:+15550100" target="_blank" rel="noopener noreferrer">b</a></p>'
    );
  });

  test("the content comparison sees a removed space between words, a removed non-breaking space and changed code whitespace", () => {
    expect(sameRichTextContent("<p>a b</p>", "<p>a  b</p>")).toBe(true);
    expect(sameRichTextContent("<p>a b</p>", "<p>ab</p>")).toBe(false);
    expect(sameRichTextContent("<p>a&nbsp;b</p>", "<p>ab</p>")).toBe(false);
    expect(sameRichTextContent("<p>a&nbsp;b</p>", "<p>a b</p>")).toBe(false);
    expect(
      sameRichTextContent(
        "<pre><code>a  b</code></pre>",
        "<pre><code>a b</code></pre>"
      )
    ).toBe(false);
  });

  test("a list item's paragraphs read as one joined by line breaks; an empty paragraph and an empty link read as nothing", () => {
    expect(
      sameRichTextContent(
        "<ul><li><p>a</p><p>b</p></li></ul>",
        "<ul><li>a<br />b</li></ul>"
      )
    ).toBe(true);
    expect(sameRichTextContent("<p>a</p><p></p>", "<p>a</p>")).toBe(true);
    expect(
      sameRichTextContent(
        '<p>a <a href="https://e.org/"> </a>b</p>',
        "<p>a b</p>"
      )
    ).toBe(true);
    // but an image, a rule or an item moving is a difference
    expect(
      sameRichTextContent("<p>a</p><hr /><p>b</p>", "<p>a</p><p>b</p><hr />")
    ).toBe(false);
    expect(
      sameRichTextContent("<ul><li>a</li><li></li></ul>", "<ul><li>a</li></ul>")
    ).toBe(false);
  });
});

// self-lock decision, 4b: an emptied parent never grows on a load and save
describe("an emptied parent item (self-lock decision, 4b)", () => {
  test.each([
    "<ul><li>a</li><li>&nbsp;<ul><li>n</li></ul></li></ul>",
    "<ul><li>a</li><li><ul><li>x</li></ul><ul><li>y</li></ul></li></ul>",
    "<ul><li>a</li><li> <ul><li>n</li></ul></li></ul>",
    "<ol><li>a<ol><li>b</li><li><ol><li>c</li></ol></li></ol></li></ol>",
  ])("%s writes a fixed point", (html) => {
    const once = sanitizeRichTextHtml(writeRichTextHeadless(html));
    const twice = sanitizeRichTextHtml(writeRichTextHeadless(once));
    const thrice = sanitizeRichTextHtml(writeRichTextHeadless(twice));
    expect(twice).toBe(once);
    expect(thrice).toBe(once);
    expect(getRichTextReadOnlyReason(once)).toBeUndefined();
  });
});
