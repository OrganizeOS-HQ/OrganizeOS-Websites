import { createElement, createRef, type Ref } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { templateIconCodes } from "@organizeos/site-components/org-script";
import {
  insertUntrustedMarkup,
  untrustedMarkupConfig,
  untrustedMarkupPurifier,
  UntrustedMarkup,
} from "./organizeos-untrusted-markup";
import {
  assertInert,
  assertNoDataAttributes,
  corpus,
  nextFrames,
} from "./organizeos-untrusted-markup.test-helpers";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const SVG_NS = "http://www.w3.org/2000/svg";
const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

let host: HTMLElement;
let headBefore: string[];

const headNodes = () =>
  Array.from(document.head.children, (node) => node.outerHTML);

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  headBefore = headNodes();
});

afterEach(() => {
  host.remove();
  delete (window as { __pwned?: unknown }).__pwned;
});

/** Nothing reached the document: its body is inert, and its head unchanged. */
const assertDocumentInert = () => {
  assertInert(document.body);
  expect(headNodes()).toEqual(headBefore);
};

const insert = (markup: string, options?: { blobImages?: boolean }) => {
  const wrapper = document.createElement("div");
  host.appendChild(wrapper);
  return { wrapper, ...insertUntrustedMarkup(wrapper, markup, options) };
};

describe("insertUntrustedMarkup", () => {
  test.each(Object.entries(corpus))(
    "%s leaves nothing that runs",
    async (_name, markup) => {
      const { wrapper } = insert(markup);
      await nextFrames();
      assertInert(wrapper);
      assertNoDataAttributes(wrapper);
      assertDocumentInert();
    }
  );

  test("an id or name is prefixed, so it names no global", () => {
    const { wrapper } = insert(corpus.globalId);
    expect(wrapper.querySelector("img")?.id).toBe("user-content-cookie");
    expect(wrapper.querySelector("a")?.id).toBe("user-content-__pwned");
    expect(typeof document.getElementById).toBe("function");
  });

  test("a linearGradient fill follows its prefixed id", () => {
    const { wrapper } = insert(
      '<svg><defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs><rect fill="url(#g)" width="10" height="10"/></svg>'
    );
    const rect = wrapper.querySelector("rect");
    expect(rect?.getAttribute("fill")).toBe("url(#user-content-g)");
    expect(getComputedStyle(rect as Element).fill).toContain("#user-content-g");
  });

  test("a clip-path follows its prefixed id", () => {
    const { wrapper } = insert(
      '<svg><clipPath id="clip0"><rect width="1" height="1"/></clipPath><g clip-path="url(#clip0)"><rect width="2" height="2"/></g></svg>'
    );
    expect(wrapper.querySelector("g")?.getAttribute("clip-path")).toBe(
      "url(#user-content-clip0)"
    );
  });

  test("an href to a defined id follows it", () => {
    const { wrapper } = insert(
      '<a href="#x">to</a><h2 id="x">x</h2><p aria-labelledby="x y">p</p>'
    );
    expect(wrapper.querySelector("a")?.getAttribute("href")).toBe(
      "#user-content-x"
    );
    expect(wrapper.querySelector("p")?.getAttribute("aria-labelledby")).toBe(
      "user-content-x y"
    );
  });

  test("a reference to an id the fragment does not define is left alone", () => {
    const { wrapper } = insert(
      '<svg><rect fill="url(#elsewhere)" width="1" height="1"/></svg>'
    );
    expect(wrapper.querySelector("rect")?.getAttribute("fill")).toBe(
      "url(#elsewhere)"
    );
  });

  test("an id outside the pattern is left alone", () => {
    const { wrapper } = insert(
      '<svg><linearGradient id="1a"></linearGradient><rect fill="url(#1a)" width="1" height="1"/></svg>'
    );
    expect(wrapper.querySelector("rect")?.getAttribute("fill")).toBe(
      "url(#1a)"
    );
  });

  test("CSS text is not rewritten", () => {
    const { wrapper } = insert('<style>#g{fill:red}</style><svg id="g"></svg>');
    expect(wrapper.querySelector("style")?.textContent).toBe("#g{fill:red}");
  });

  describe.each([
    [
      "an svg parent",
      () => {
        const svg = document.createElementNS(SVG_NS, "svg");
        host.appendChild(svg);
        const wrapper = document.createElementNS(SVG_NS, "g");
        svg.appendChild(wrapper);
        return wrapper;
      },
    ],
    [
      "a math parent",
      () => {
        const math = document.createElementNS(MATHML_NS, "math");
        host.appendChild(math);
        const wrapper = document.createElementNS(MATHML_NS, "mrow");
        math.appendChild(wrapper);
        return wrapper;
      },
    ],
    [
      "a document with no window",
      () => document.implementation.createHTMLDocument().createElement("div"),
    ],
  ])("under %s", (_parent, makeWrapper) => {
    test.each(Object.entries(corpus))(
      "%s inserts nothing",
      async (_name, markup) => {
        const wrapper = makeWrapper();
        expect(insertUntrustedMarkup(wrapper, markup)).toEqual({
          rendered: false,
        });
        expect(wrapper.childNodes.length).toBe(0);
        await nextFrames();
        assertDocumentInert();
      }
    );
  });

  test("a style-only embed still styles a sibling", () => {
    const span = document.createElement("span");
    span.className = "probe-x";
    host.appendChild(span);
    const { rendered } = insert(
      "<style>.probe-x { color: rgb(1, 2, 3) }</style>"
    );
    expect(rendered).toBe(true);
    expect(getComputedStyle(span).color).toBe("rgb(1, 2, 3)");
  });

  test("a style holding < is dropped", () => {
    const { wrapper } = insert(
      "<style>@media (width<600px){.p{color:red}}</style><p>x</p>"
    );
    expect(wrapper.querySelector("style")).toBeNull();
    expect(wrapper.querySelector("p")?.textContent).toBe("x");
  });

  test("the fragment's own nodes are inserted", () => {
    const purify = untrustedMarkupPurifier(window);
    let sanitized: Node | undefined;
    purify.addHook("afterSanitizeElements", (node) => {
      if ((node as Element).localName === "img") {
        sanitized = node;
      }
    });
    try {
      const { wrapper } = insert('<p><img src="/a.png"></p>');
      expect(sanitized).toBeDefined();
      expect(wrapper.querySelector("img")).toBe(sanitized);
    } finally {
      purify.removeHook("afterSanitizeElements");
    }
  });

  test("an aria value is kept as text", () => {
    const { wrapper } = insert('<b aria-label="javascript:1">x</b>');
    expect(wrapper.querySelector("b")?.getAttribute("aria-label")).toBe(
      "javascript:1"
    );
  });

  test("ordinary SVG attributes are kept", () => {
    const { wrapper } = insert(
      '<svg viewBox="0 0 10 10"><path d="M0 0L10 10" transform="rotate(45)" fill="url(#a)"/></svg>'
    );
    expect(wrapper.querySelector("svg")?.getAttribute("viewBox")).toBe(
      "0 0 10 10"
    );
    const path = wrapper.querySelector("path");
    expect(path?.getAttribute("d")).toBe("M0 0L10 10");
    expect(path?.getAttribute("transform")).toBe("rotate(45)");
    expect(path?.getAttribute("fill")).toBe("url(#a)");
  });

  test("an HTML title is removed, an SVG title kept", () => {
    const { wrapper } = insert(
      "<title>page</title><p>x</p><svg><title>tip</title><rect/></svg>"
    );
    const titles = Array.from(wrapper.querySelectorAll("title"));
    expect(titles.map((title) => title.namespaceURI)).toEqual([SVG_NS]);
    expect(titles[0].textContent).toBe("tip");
  });

  test.each([...templateIconCodes])(
    "a template icon renders as an svg with its paths: %#",
    (icon) => {
      const { wrapper, rendered } = insert(icon);
      expect(rendered).toBe(true);
      expect(wrapper.querySelector("svg")).not.toBeNull();
      expect(wrapper.querySelector("svg path, svg circle")).not.toBeNull();
    }
  );

  test("only scripts, or only an iframe, renders nothing", () => {
    expect(insert("<script>1</script>").rendered).toBe(false);
    expect(insert("<iframe src=https://x.example></iframe>").rendered).toBe(
      false
    );
  });

  test("a blob image is kept only with blobImages, and nothing else is", async () => {
    const blob = "blob:https://x.example/1";
    expect(
      insert(`<img src="${blob}">`, { blobImages: true })
        .wrapper.querySelector("img")
        ?.getAttribute("src")
    ).toBe(blob);
    expect(
      insert(`<img src="${blob}">`)
        .wrapper.querySelector("img")
        ?.hasAttribute("src")
    ).toBe(false);
    for (const markup of [
      `<a href="${blob}">x</a>`,
      `<svg><a href="${blob}"><text>x</text></a></svg>`,
    ]) {
      const { wrapper } = insert(markup, { blobImages: true });
      for (const element of wrapper.querySelectorAll("[href]")) {
        expect(element.getAttribute("href")).not.toMatch(/^blob:/);
      }
    }
    const { wrapper: handler } = insert(
      `<img src="${blob}" onerror="window.__pwned=1">`,
      { blobImages: true }
    );
    expect(handler.querySelector("img")?.hasAttribute("onerror")).toBe(false);
    expect(
      insert('<img src="blob:javascript:1">', { blobImages: true })
        .wrapper.querySelector("img")
        ?.hasAttribute("src")
    ).toBe(false);
    await nextFrames();
    assertDocumentInert();
  });

  test("an address keeps only the allowed schemes", () => {
    const hrefs = [
      "https://x.example/",
      "http://x.example/",
      "mailto:a@x.example",
      "tel:+1",
      "#a",
      "/path",
      "./path",
      "../path",
      "?q=1",
      "path/to",
    ];
    for (const href of hrefs) {
      expect(
        insert(`<a href="${href}">x</a>`)
          .wrapper.querySelector("a")
          ?.getAttribute("href"),
        href
      ).toBe(href);
    }
    for (const href of [
      "javascript:1",
      " java\tscript:1",
      "JAVASCRIPT:1",
      "data:text/html,x",
      "vbscript:1",
      "blob:https://x.example/1",
      "file:///etc/passwd",
      "sms:1",
    ]) {
      expect(
        insert(`<a href="${href}">x</a>`)
          .wrapper.querySelector("a")
          ?.hasAttribute("href"),
        href
      ).toBe(false);
    }
  });
});

describe("UntrustedMarkup", () => {
  let root: Root;

  beforeEach(() => {
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  const fallback = ({
    ref,
    rest,
  }: {
    ref: Ref<HTMLElement>;
    rest: Record<string, unknown>;
  }) =>
    createElement(
      "div",
      { ...rest, ref, "data-fallback": "" },
      "Shows on the published site"
    );

  const render = (
    markup: string,
    props: Record<string, unknown> = {},
    ref?: Ref<HTMLElement>
  ) => {
    act(() => {
      root.render(
        createElement(UntrustedMarkup, {
          markup,
          renderFallback: fallback,
          ref,
          ...props,
        })
      );
    });
  };

  test("re-inserts only when its markup changes", () => {
    render("<p>a</p>");
    const p = host.querySelector("p");
    expect(p).not.toBeNull();
    render("<p>a</p>");
    expect(host.querySelector("p")).toBe(p);
    render("<b>b</b>");
    expect(host.querySelector("p")).toBeNull();
    expect(host.querySelectorAll("b")).toHaveLength(1);
  });

  test("goes from script-only to renderable and back", () => {
    render("<script>1</script>");
    expect(host.querySelector("[data-fallback]")).not.toBeNull();
    render("<p>a</p>");
    expect(host.querySelector("p")).not.toBeNull();
    expect(host.querySelector("[data-fallback]")).toBeNull();
    expect(host.querySelector("p")?.parentElement?.hidden).toBe(false);
    render("<script>1</script>");
    expect(host.querySelector("[data-fallback]")).not.toBeNull();
    expect(host.querySelector("p")).toBeNull();
  });

  test("a remount with the same markup fills the new wrapper", () => {
    render("<p>a</p>");
    act(() => root.unmount());
    root = createRoot(host);
    render("<p>a</p>");
    expect(host.querySelector("p")).not.toBeNull();
  });

  test("the wrapper carries the ref and data attributes while it renders", () => {
    const ref = createRef<HTMLElement>();
    render("<p>a</p>", { "data-ws-id": "e1" }, ref);
    expect(ref.current?.getAttribute("data-ws-id")).toBe("e1");
    expect(ref.current?.querySelector("p")).not.toBeNull();
  });

  test("the fallback carries the ref and data attributes", () => {
    const ref = createRef<HTMLElement>();
    render("<script>1</script>", { "data-ws-id": "e1" }, ref);
    const shown = host.querySelectorAll('[data-ws-id="e1"]');
    expect(shown).toHaveLength(1);
    expect(shown[0].hasAttribute("data-fallback")).toBe(true);
    expect(ref.current).toBe(shown[0]);
    // and back: the wrapper holds them again
    render("<p>a</p>", { "data-ws-id": "e1" }, ref);
    expect(ref.current?.querySelector("p")).not.toBeNull();
    expect(host.querySelectorAll('[data-ws-id="e1"]')).toHaveLength(1);
  });
});

describe("untrustedMarkupConfig", () => {
  test("the configuration is the reviewed allowlist", () => {
    expect(untrustedMarkupConfig).toMatchInlineSnapshot(`
      {
        "ALLOWED_ATTR": [
          "class",
          "style",
          "id",
          "name",
          "title",
          "lang",
          "dir",
          "role",
          "hidden",
          "href",
          "rel",
          "hreflang",
          "src",
          "alt",
          "width",
          "height",
          "loading",
          "decoding",
          "colspan",
          "rowspan",
          "scope",
          "headers",
          "span",
          "datetime",
          "start",
          "reversed",
          "type",
          "value",
          "open",
          "cite",
          "viewbox",
          "xmlns",
          "fill",
          "fill-opacity",
          "fill-rule",
          "stroke",
          "stroke-width",
          "stroke-linecap",
          "stroke-linejoin",
          "stroke-dasharray",
          "stroke-dashoffset",
          "stroke-miterlimit",
          "stroke-opacity",
          "d",
          "cx",
          "cy",
          "r",
          "rx",
          "ry",
          "x",
          "y",
          "x1",
          "y1",
          "x2",
          "y2",
          "fx",
          "fy",
          "points",
          "transform",
          "opacity",
          "clip-path",
          "clip-rule",
          "mask",
          "filter",
          "offset",
          "stop-color",
          "stop-opacity",
          "gradientunits",
          "gradienttransform",
          "spreadmethod",
          "preserveaspectratio",
          "shape-rendering",
          "text-rendering",
          "font-family",
          "font-size",
          "font-weight",
          "text-anchor",
          "dominant-baseline",
          "dx",
          "dy",
          "display",
          "visibility",
          "overflow",
          "color",
          "vector-effect",
          "patternunits",
          "patterncontentunits",
          "maskunits",
          "maskcontentunits",
          "clippathunits",
          "filterunits",
          "primitiveunits",
          "in",
          "in2",
          "result",
          "stddeviation",
          "mode",
          "operator",
          "k1",
          "k2",
          "k3",
          "k4",
          "values",
          "flood-color",
          "flood-opacity",
          "radius",
          "focusable",
          "version",
        ],
        "ALLOWED_NAMESPACES": [
          "http://www.w3.org/1999/xhtml",
          "http://www.w3.org/2000/svg",
        ],
        "ALLOWED_TAGS": [
          "a",
          "abbr",
          "address",
          "article",
          "aside",
          "b",
          "bdi",
          "bdo",
          "blockquote",
          "br",
          "caption",
          "cite",
          "code",
          "col",
          "colgroup",
          "dd",
          "del",
          "details",
          "dfn",
          "div",
          "dl",
          "dt",
          "em",
          "figcaption",
          "figure",
          "footer",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "header",
          "hgroup",
          "hr",
          "i",
          "img",
          "ins",
          "kbd",
          "li",
          "main",
          "mark",
          "nav",
          "ol",
          "p",
          "pre",
          "q",
          "rp",
          "rt",
          "ruby",
          "s",
          "samp",
          "section",
          "small",
          "span",
          "strong",
          "style",
          "sub",
          "summary",
          "sup",
          "table",
          "tbody",
          "td",
          "tfoot",
          "th",
          "thead",
          "time",
          "tr",
          "u",
          "ul",
          "var",
          "wbr",
          "svg",
          "g",
          "path",
          "circle",
          "ellipse",
          "line",
          "polyline",
          "polygon",
          "rect",
          "text",
          "tspan",
          "defs",
          "lineargradient",
          "radialgradient",
          "stop",
          "clippath",
          "mask",
          "pattern",
          "title",
          "desc",
          "filter",
          "feblend",
          "fecolormatrix",
          "fecomposite",
          "fedropshadow",
          "feflood",
          "fegaussianblur",
          "femerge",
          "femergenode",
          "femorphology",
          "feoffset",
        ],
        "ALLOWED_URI_REGEXP": /\\^\\(\\?:\\(\\?:https\\?\\|mailto\\|tel\\):\\|\\[\\^a-z\\]\\|\\[a-z\\+\\.-\\]\\+\\(\\?:\\[\\^a-z\\+\\.\\\\-:\\]\\|\\$\\)\\)/i,
        "ALLOW_ARIA_ATTR": true,
        "ALLOW_DATA_ATTR": false,
        "ALLOW_SELF_CLOSE_IN_ATTR": false,
        "ALLOW_UNKNOWN_PROTOCOLS": false,
        "FORBID_ATTR": [
          "srcdoc",
          "action",
          "formaction",
          "form",
          "srcset",
          "xlink:href",
          "target",
          "ping",
        ],
        "FORBID_TAGS": [
          "script",
          "iframe",
          "object",
          "embed",
          "link",
          "meta",
          "base",
          "form",
          "input",
          "button",
          "select",
          "textarea",
          "foreignobject",
          "animate",
          "set",
          "use",
          "math",
          "template",
          "noscript",
        ],
        "FORCE_BODY": true,
        "KEEP_CONTENT": true,
        "RETURN_DOM_FRAGMENT": true,
        "SAFE_FOR_TEMPLATES": false,
        "SAFE_FOR_XML": true,
        "SANITIZE_DOM": true,
        "SANITIZE_NAMED_PROPS": true,
        "WHOLE_DOCUMENT": false,
      }
    `);
    for (const key of [
      "USE_PROFILES",
      "ADD_TAGS",
      "ADD_ATTR",
      "ADD_DATA_URI_TAGS",
    ]) {
      expect(Object.keys(untrustedMarkupConfig)).not.toContain(key);
    }
    expect(Object.isFrozen(untrustedMarkupConfig)).toBe(true);
  });
});
