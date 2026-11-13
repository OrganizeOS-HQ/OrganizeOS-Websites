import { describe, expect, test } from "vitest";
import { createEditor } from "lexical";
import fixture from "./__fixtures__/rich-text-roundtrip.json";
import {
  exportRichTextHtml,
  getRichTextReadOnlyReason,
  importRichTextHtml,
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

  test("a compact figure at the top level stays editable; a pretty-printed one reads lossy", () => {
    const [captioned, blankCaption, prettyPrinted, bare] = figures;
    for (const figure of [captioned, blankCaption, bare]) {
      expect(getRichTextReadOnlyReason(`<p>a</p>${figure}`)).toBeUndefined();
    }
    expect(getRichTextReadOnlyReason(`<p>a</p>${prettyPrinted}`)).toBe("lossy");
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
      "ul@0 li@1:p1 ul@2 li@3:p1 links=1",
    ],
    ["<ul><li><p>a</p><p>b</p></li></ul>", "ul@0 li@1:p2 links=0"],
    ["<ul><li>a<br>b</li></ul>", "ul@0 li@1:p1 links=0"],
    [
      "<ul><li><p>One</p></li><li>Two</li></ul>",
      "ul@0 li@1:p1 li@1:p1 links=0",
    ],
    [
      "<ul><li>a<ul><li>b</li></ul>c</li></ul>",
      "ul@0 li@1:p2 ul@2 li@3:p1 links=0",
    ],
    ["<ul><li><p></p></li></ul>", "ul@0 li@1:p0 links=0"],
    [
      '<blockquote><h2>A</h2></blockquote><p><a href="javascript:x">y</a></p>',
      "blockquote@0 h2@1 links=0",
    ],
    [
      '<ul><li><p>a<img src="https://a.org/x.png" />b</p></li></ul>',
      "ul@0 li@1:p2 img@2 links=0",
    ],
    [
      '<ul><li>a<img src="https://a.org/x.png">b</li></ul>',
      "ul@0 li@1:p2 img@2 links=0",
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
