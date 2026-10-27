/**
 * @vitest-environment jsdom
 */
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import fixture from "../__fixtures__/rich-text.json";
import {
  RichText,
  renderRichText,
  richTextMaxDepth,
  richTextMaxNodes,
} from "./rich-text";
import { richTextSample } from "./sample";

const markup = (value: unknown) =>
  renderToStaticMarkup(<>{renderRichText(value)}</>);

const doc = (...children: unknown[]) => ({ v: 1, children });
const p = (...c: unknown[]) => ({ t: "p", c });
const text = (value: string, marks?: string[]) =>
  marks === undefined
    ? { t: "text", text: value }
    : { t: "text", text: value, marks };

const rel = 'rel="noopener noreferrer"';

/**
 * The markup each fixture case's nodes render to, written out by hand from
 * design section 4.7. A case the fixture gains fails until it is added here.
 */
const expected: Record<string, string> = {
  "every mark":
    "<p>Plain <strong>strong</strong> <strong>b</strong> <em>em</em> <em>i</em> <u>u</u> <s>s</s> <code>code</code> <strong><em>both</em></strong></p>",
  "headings, entities and collapsed whitespace":
    "<h2>Two &amp; more</h2><h3>Three</h3><h4>Four four</h4>",
  "lists, nested":
    "<ul><li><p>One</p></li><li><p>Two</p><ul><li><p>Nested</p></li></ul></li></ul><ol><li><p>First</p><p>Second paragraph</p></li></ol>",
  "quote, code block and rule":
    "<blockquote><p>Quoted <em>words</em></p></blockquote><pre><code>const a = 1;\n  if (a &lt; 2) go();\n</code></pre><hr/>",
  "line break": "<p>Line one<br/>line two</p>",
  "every allowed link target": [
    "<p>",
    `<a href="https://example.org" ${rel} target="_blank">new tab</a> `,
    `<a href="http://example.org/a" ${rel}><strong>bold link</strong></a> `,
    `<a href="/about" ${rel}>root path</a> `,
    `<a href="#top" ${rel}>fragment</a> `,
    `<a href="mailto:press@example.org" ${rel}>mail</a> `,
    `<a href="tel:+15550100100" ${rel}>call</a>`,
    "</p>",
  ].join(""),
  image:
    '<img src="https://cdn.example.org/a.jpg" alt="Members at a meeting" width="1600" height="900" loading="lazy"/>',
  "figure with a caption":
    '<figure><img src="https://cdn.example.org/b.jpg" alt="" loading="lazy"/><figcaption>Photo by <em>Ada</em></figcaption></figure>',
  "image inside a paragraph splits it":
    '<p>Before</p><img src="https://cdn.example.org/c.png" alt="c" loading="lazy"/><p>after</p>',
  "loose text becomes a paragraph":
    "<p>Loose text and <strong>bold</strong></p>",
  "allowed elements with no node become their text": `<p>Stray item</p><p>Stray caption</p><p><a href="https://example.org" ${rel}>outer </a><a href="https://example.net" ${rel}>inner</a></p>`,
  "empty blocks are left out": "",
  "dropped: protocol-relative link": "<p>See this page now</p>",
  "dropped: protocol-relative link with a backslash": "<p>back</p>",
  "dropped: javascript: link": "<p><strong>click</strong> me</p>",
  "dropped: relative path and missing href": "<p>relative bare</p>",
  "dropped: data: image": "<p>After</p>",
  "dropped: http: image": "<p>After</p>",
  "dropped: http: image in a figure takes its caption": "",
  "dropped: protocol-relative image and bad dimensions":
    '<img src="https://cdn.example.org/d.jpg" alt="d" loading="lazy"/>',
  "depth past 8: quotes": `${"<blockquote>".repeat(7)}<p>Too deep to keep</p>${"</blockquote>".repeat(7)}`,
  "depth past 8: lists": `${["1", "2", "3", "4", "5", "6"]
    .map((n) => `<ul><li><p>${n}</p>`)
    .join("")}<ul><li><p>7</p><p>8 9</p></li></ul>${"</li></ul>".repeat(6)}`,
};

describe("the shared fixture's nodes", () => {
  test("every case has its expected markup here", () => {
    expect(fixture.cases.map((item) => item.name).sort()).toEqual(
      Object.keys(expected).sort()
    );
  });

  for (const item of fixture.cases) {
    test(item.name, () => {
      expect(markup(item.nodes)).toBe(expected[item.name]);
    });
  }

  test("the limits are the fixture's", () => {
    expect(richTextMaxDepth).toBe(fixture.limits.maxDepth);
    expect(richTextMaxNodes).toBe(fixture.limits.maxNodes);
  });
});

describe("re-validation of a tree a later /v1 might send", () => {
  test("a node of a kind it does not know renders nothing, at any level", () => {
    expect(
      markup(
        doc(
          { t: "table", rows: [["a"]] },
          { t: "html", html: "<script>alert(1)</script>" },
          p(
            text("kept"),
            { t: "script", text: "alert(1)" },
            { t: "html", html: "<b>x</b>" },
            { t: "img", src: "https://cdn.example.org/a.jpg" }
          ),
          { t: "h", level: 1, c: [text("h1")] },
          { t: "h", level: 5, c: [text("h5")] },
          { t: "h", level: "2", c: [text("string level")] },
          { t: "code", text: 42 },
          { t: "ul", items: "not a list" },
          { t: "ul", items: [[p(text("item"))], "not an item"] },
          "a string",
          null,
          [p(text("an array"))],
          { c: [text("no kind")] }
        )
      )
    ).toBe("<p>kept</p><ul><li><p>item</p></li></ul>");
  });

  test("a mark it does not know is left off, and text that is not a string goes", () => {
    expect(
      markup(
        doc(
          p(
            text("a", ["b", "sup", "onclick"]),
            { t: "text", text: 1 },
            { t: "text" },
            text("<b>escaped</b>")
          )
        )
      )
    ).toBe("<p><strong>a</strong>&lt;b&gt;escaped&lt;/b&gt;</p>");
  });

  test("a link with a bad address renders its text", () => {
    for (const href of [
      "javascript:alert(1)",
      " JavaScript:alert(1)",
      "java\tscript:alert(1)",
      "data:text/html,<p>hi</p>",
      "vbscript:x",
      "//evil.example",
      "/\\evil.example",
      "relative",
      undefined,
      42,
    ]) {
      expect(
        markup(doc(p({ t: "a", href, c: [text("click", ["b"])] }))),
        String(href)
      ).toBe("<p><strong>click</strong></p>");
    }
  });

  test("a link inside a link renders its text, and target is set only by newTab true", () => {
    expect(
      markup(
        doc(
          p({
            t: "a",
            href: "https://example.org",
            newTab: "yes",
            c: [
              text("outer "),
              {
                t: "a",
                href: "https://example.net",
                newTab: true,
                c: [text("inner")],
              },
            ],
          })
        )
      )
    ).toBe(`<p><a href="https://example.org" ${rel}>outer inner</a></p>`);
  });

  test("the address a link keeps is cleaned as a browser cleans it", () => {
    expect(
      markup(
        doc(p({ t: "a", href: " https://exa\nmple.org ", c: [text("x")] }))
      )
    ).toBe(`<p><a href="https://example.org" ${rel}>x</a></p>`);
  });

  test("an image whose source is not https: is dropped, with its caption", () => {
    for (const src of [
      "http://cdn.example.org/a.jpg",
      "data:image/png;base64,iVBORw0KGgo=",
      "//cdn.example.org/a.jpg",
      "/a.jpg",
      "javascript:alert(1)",
      undefined,
    ]) {
      expect(
        markup(
          doc(
            { t: "img", src, alt: "a", caption: [text("caption")] },
            p(text("after"))
          )
        ),
        String(src)
      ).toBe("<p>after</p>");
    }
  });

  test("an image keeps only a string alt and positive whole dimensions", () => {
    expect(
      markup(
        doc({
          t: "img",
          src: "https://cdn.example.org/a.jpg",
          alt: 7,
          width: -1,
          height: 1.5,
          onerror: "alert(1)",
        })
      )
    ).toBe('<img src="https://cdn.example.org/a.jpg" alt="" loading="lazy"/>');
  });

  test("a quote or list past the depth limit renders nothing", () => {
    let quote: unknown = p(text("deep"));
    for (let level = 0; level < 12; level++) {
      quote = { t: "quote", children: [quote] };
    }
    const rendered = markup(doc(quote));
    expect(rendered.match(/<blockquote>/g)).toHaveLength(richTextMaxDepth - 1);
    expect(rendered).not.toContain("deep");

    let list: unknown = p(text("deep"));
    for (let level = 0; level < 12; level++) {
      list = { t: "ol", items: [[list]] };
    }
    expect(markup(doc(list)).match(/<ol>/g)).toHaveLength(richTextMaxDepth - 1);
  });

  test("rendering stops at the node limit", () => {
    // 3,000 paragraphs of one word are 6,000 nodes, as the fixture's
    // generated case: 2,500 paragraphs fit
    const tree = doc(
      ...Array.from({ length: 3000 }, (_, index) => p(text(`w${index}`)))
    );
    const rendered = markup(tree);
    expect(rendered.match(/<p>/g)).toHaveLength(richTextMaxNodes / 2);
    expect(rendered).toContain("<p>w2499</p>");
    expect(rendered).not.toContain("w2500");
  });

  test("a value it cannot read renders nothing", () => {
    for (const value of [
      undefined,
      null,
      "<p>html</p>",
      42,
      [p(text("x"))],
      { children: [p(text("x"))] },
      { v: 2, children: [p(text("x"))] },
      { v: 1, children: "x" },
      { v: 1 },
    ]) {
      expect(markup(value), JSON.stringify(value)).toBe("");
    }
  });

  test("a whole rich-text value, bound in place of its nodes, renders its nodes", () => {
    expect(
      markup({ html: "<p>x</p>", text: "x", nodes: doc(p(text("x"))) })
    ).toBe("<p>x</p>");
  });
});

const inContext = (
  renderer: undefined | "canvas" | "preview",
  element: JSX.Element
) => (
  <ReactSdkContext.Provider
    value={{
      assetBaseUrl: "/",
      imageLoader: ({ src }) => src,
      resources: {},
      breakpoints: [],
      onError: () => {},
      renderer,
    }}
  >
    {element}
  </ReactSdkContext.Provider>
);

describe("the RichText component", () => {
  test("a div that takes the canvas's and the page's props, never its children", () => {
    const html = renderToStaticMarkup(
      inContext(
        undefined,
        <RichText
          className="c1 c2"
          data-ws-id="abc"
          value={doc(p(text("Hello")))}
        >
          <span>descendant</span>
        </RichText>
      )
    );
    expect(html).toBe('<div class="c1 c2" data-ws-id="abc"><p>Hello</p></div>');
  });

  test("forwards its ref to the div", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      inContext(undefined, <RichText ref={ref} value={undefined} />)
    );
    expect(ref.current).toBe(container.firstElementChild);
    expect(ref.current?.tagName).toBe("DIV");
    cleanup();
  });

  test("on the canvas with no value, the sample; on a published page or in preview, nothing", () => {
    const sample = renderToStaticMarkup(<>{renderRichText(richTextSample)}</>);
    for (const value of [undefined, null]) {
      expect(
        renderToStaticMarkup(inContext("canvas", <RichText value={value} />))
      ).toBe(`<div>${sample}</div>`);
      for (const renderer of [undefined, "preview"] as const) {
        expect(
          renderToStaticMarkup(inContext(renderer, <RichText value={value} />))
        ).toBe("<div></div>");
      }
    }
    // a value, even an empty one, is shown as it is
    expect(
      renderToStaticMarkup(inContext("canvas", <RichText value={doc()} />))
    ).toBe("<div></div>");
  });

  test("the sample is the fixture's, node for node, and holds every element the template styles", () => {
    const cases = [
      "headings, entities and collapsed whitespace",
      "every mark",
      "every allowed link target",
      "line break",
      "lists, nested",
      "quote, code block and rule",
      "figure with a caption",
    ];
    expect(richTextSample).toEqual({
      v: 1,
      children: cases.flatMap((name): unknown[] => {
        const item = fixture.cases.find((item) => item.name === name);
        return item === undefined
          ? [`missing case ${name}`]
          : item.nodes.children;
      }),
    });
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      <>{renderRichText(richTextSample)}</>
    );
    for (const tag of [
      "p",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "a",
      "blockquote",
      "pre",
      "code",
      "hr",
      "img",
      "figure",
      "figcaption",
      "strong",
      "em",
    ]) {
      expect(host.querySelector(tag), tag).not.toBeNull();
    }
  });
});
