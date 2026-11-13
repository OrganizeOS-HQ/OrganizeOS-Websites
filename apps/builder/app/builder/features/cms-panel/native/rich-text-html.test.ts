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
  richTextBlockSignature,
  richTextHref,
  richTextHtmlConfig,
  richTextImportHref,
  richTextNodes,
} from "./rich-text-html";

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
    "a nested figure loads without failing and reads lossy: %s",
    (html) => {
      expect(() => roundTrip(html)).not.toThrow();
      expect(getRichTextReadOnlyReason(html)).toBe("lossy");
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

  test("a link the import leaves with nothing in it reads lossy, with an image or without", () => {
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

describe("the block signature", () => {
  test.each([
    ["<p>a</p><p></p>", "links=0"],
    [
      '<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul><p><a href="/x">x</a></p>',
      "ul@0 li@1:p1:br0 ul@2 li@3:p1:br0 links=1",
    ],
    ["<ul><li><p>a</p><p>b</p></li></ul>", "ul@0 li@1:p2:br0 links=0"],
    ["<ul><li>a<br>b</li></ul>", "ul@0 li@1:p1:br1 links=0"],
    [
      "<ul><li><p>One</p></li><li>Two</li></ul>",
      "ul@0 li@1:p1:br0 li@1:p1:br0 links=0",
    ],
    [
      "<ul><li>a<ul><li>b</li></ul>c</li></ul>",
      "ul@0 li@1:p2:br0 ul@2 li@3:p1:br0 links=0",
    ],
    ["<ul><li><p></p></li></ul>", "ul@0 li@1:p0:br0 links=0"],
    [
      '<blockquote><h2>A</h2></blockquote><p><a href="javascript:x">y</a></p>',
      "blockquote@0 h2@1 links=0",
    ],
    [
      '<ul><li><p>a<img src="https://a.org/x.png" />b</p></li></ul>',
      "ul@0 li@1:p2:br0 img@2 links=0",
    ],
    [
      '<ul><li>a<img src="https://a.org/x.png">b</li></ul>',
      "ul@0 li@1:p2:br0 img@2 links=0",
    ],
    [
      '<figure><img src="https://a.org/x.png" /><figcaption>c</figcaption></figure>',
      "figure@0 img@1 links=0",
    ],
  ])("richTextBlockSignature(%j) is %j", (html, signature) => {
    expect(richTextBlockSignature(html)).toBe(signature);
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
