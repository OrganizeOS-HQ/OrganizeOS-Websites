/**
 * OrganizeOS fork: the one path by which untrusted markup (an org's HTML
 * Embed code, a Markdown Embed's rendered HTML, the builder UI's Markdown
 * preview) enters a builder document (docs/ORGANIZEOS-FORK.md section 10,
 * "The builder never runs embed code"; spec
 * 2026-11-20-builder-code-embeds-design.md, 4.2, in the OrganizeOS repo).
 *
 * The builder canvas shares an origin with the builder UI, so markup that ran
 * there would act as the person looking at the page. This module:
 *
 * 1. sanitizes the string with DOMPurify, in the window it is inserted into,
 *    to a document fragment (no second parse of a string), against the
 *    allowlist below;
 * 2. inserts that fragment's own nodes into a wrapper it has checked to be an
 *    HTML element of that window (under `svg` or `math` React creates the
 *    wrapper in the parent's namespace, where markup parses differently);
 * 3. is memoized on its input (`UntrustedMarkup`).
 *
 * Nothing else in apps/builder/app writes raw HTML into a builder document
 * beyond a short reviewed list (organizeos-org-script.wiring.node.test.ts).
 */
import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type Ref,
} from "react";
import createDOMPurify, { type Config, type DOMPurify } from "dompurify";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const html = [
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
];
const svg = [
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
];
const attributes = [
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
];

/**
 * The reviewed allowlist. Form controls, media, `picture`, `srcset`, SVG
 * `use`, `symbol`, `textPath`, `feImage` and the animation elements are left
 * out on purpose: the canvas shows less than the live page (spec R2).
 * `organizeos-untrusted-markup.test.tsx` pins it.
 */
export const untrustedMarkupConfig: Readonly<Config> = Object.freeze({
  ALLOWED_TAGS: [...html, ...svg],
  ALLOWED_ATTR: attributes,
  ALLOWED_NAMESPACES: [HTML_NAMESPACE, SVG_NAMESPACE],
  ALLOW_ARIA_ATTR: true,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ALLOW_SELF_CLOSE_IN_ATTR: false,
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: [
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
  FORBID_ATTR: [
    "srcdoc",
    "action",
    "formaction",
    "form",
    "srcset",
    "xlink:href",
    "target",
    "ping",
  ],
  SAFE_FOR_XML: true,
  SANITIZE_DOM: true,
  SANITIZE_NAMED_PROPS: true,
  SAFE_FOR_TEMPLATES: false,
  WHOLE_DOCUMENT: false,
  FORCE_BODY: true,
  KEEP_CONTENT: true,
  RETURN_DOM_FRAGMENT: true,
});

/**
 * The builder UI's Markdown preview writes into the builder's own top
 * document, where a style of the org's would restyle the builder itself, so
 * its configuration also forbids the `style` element and attribute. The
 * canvas keeps both: an embed's CSS styling the page is what embeds are for.
 */
export const untrustedPreviewMarkupConfig: Readonly<Config> = Object.freeze({
  ...untrustedMarkupConfig,
  FORBID_TAGS: [...(untrustedMarkupConfig.FORBID_TAGS as string[]), "style"],
  FORBID_ATTR: [...(untrustedMarkupConfig.FORBID_ATTR as string[]), "style"],
});

const addressAttributes = new Set(["href", "src", "cite"]);
const allowedSchemes = new Set(["http", "https", "mailto", "tel"]);
// eslint-disable-next-line no-control-regex
const asciiControls = /[\u0000-\u001f\u007f]/g;

/**
 * Whether an address may stay: a fragment, a path, a query, no scheme, or the
 * scheme `http`, `https`, `mailto` or `tel`. DOMPurify keeps a `data:` image
 * whatever its URI pattern says, so this hook is what refuses it.
 */
const addressMayStay = (value: string) => {
  const address = value.trim().replace(asciiControls, "");
  if (/^(?:#|\/|\.\/|\.\.\/|\?)/.test(address)) {
    return true;
  }
  const scheme = /^([^:/?#]*):/.exec(address)?.[1];
  if (scheme === undefined) {
    return true;
  }
  return allowedSchemes.has(scheme.toLowerCase());
};

// D9: an image that is still uploading, shown by its object URL, in the
// builder UI's Markdown preview only
const blobImageAddress = /^blob:https?:\/\/[^\s"'<>]+$/;

type Instances = { strict: DOMPurify; blobImages: DOMPurify };

/** The canvas's configuration, or the Markdown preview's (`blobImages`). */
const configOf = (blobImages: boolean): Readonly<Config> =>
  blobImages ? untrustedPreviewMarkupConfig : untrustedMarkupConfig;
const instancesByWindow = new WeakMap<Window, Instances>();

const createInstance = (
  view: Window & typeof globalThis,
  blobImages: boolean
): DOMPurify => {
  const purify = createDOMPurify(view);
  purify.setConfig({ ...configOf(blobImages) });
  // the title element only inside SVG, where it is a tooltip, never as the
  // document's title
  purify.addHook("uponSanitizeElement", (node, data) => {
    if (
      data.tagName === "title" &&
      (node as Element).namespaceURI !== SVG_NAMESPACE
    ) {
      node.parentNode?.removeChild(node);
    }
  });
  // only ever tightens, except the one blob: image branch of the preview
  purify.addHook("uponSanitizeAttribute", (node, data) => {
    const name = data.attrName;
    if (/^on/i.test(name)) {
      data.keepAttr = false;
      return;
    }
    if (addressAttributes.has(name) === false) {
      return;
    }
    if (
      blobImages &&
      name === "src" &&
      (node as Element).namespaceURI === HTML_NAMESPACE &&
      (node as Element).localName === "img" &&
      blobImageAddress.test(data.attrValue)
    ) {
      data.forceKeepAttr = true;
      return;
    }
    if (addressMayStay(data.attrValue) === false) {
      data.keepAttr = false;
    }
  });
  return purify;
};

const instancesOf = (view: Window & typeof globalThis): Instances => {
  let instances = instancesByWindow.get(view);
  if (instances === undefined) {
    instances = {
      strict: createInstance(view, false),
      blobImages: createInstance(view, true),
    };
    instancesByWindow.set(view, instances);
  }
  return instances;
};

/**
 * The window's strict purifier, for the tests that observe or stub what it
 * produces. No module but this one and its tests may name it:
 * `organizeos-org-script.wiring.node.test.ts` fails on any other.
 */
export const untrustedMarkupPurifier = (
  view: Window & typeof globalThis
): DOMPurify => instancesOf(view).strict;

const prefix = "user-content-";
const referableId = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const urlReferenceAttributes = [
  "fill",
  "stroke",
  "clip-path",
  "mask",
  "filter",
];
const idListAttributes = ["aria-labelledby", "aria-describedby"];

/**
 * DOMPurify prefixes every `id` (SANITIZE_NAMED_PROPS), which would break an
 * inline SVG's `fill="url(#g)"`, `clip-path`, `mask`, `filter`, an `href="#x"`
 * and the aria id lists. A reference is rewritten to the prefixed id only
 * when this fragment defines that id and the id is a plain name, on the
 * sanitized nodes, with no second parse. CSS text is not rewritten.
 */
const rewriteIdReferences = (fragment: DocumentFragment) => {
  const defined = new Set<string>();
  for (const element of fragment.querySelectorAll("[id]")) {
    const id = element.getAttribute("id") ?? "";
    if (id.startsWith(prefix) && referableId.test(id.slice(prefix.length))) {
      defined.add(id.slice(prefix.length));
    }
  }
  if (defined.size === 0) {
    return;
  }
  for (const element of fragment.querySelectorAll("*")) {
    for (const name of urlReferenceAttributes) {
      const value = element.getAttribute(name);
      const id = value === null ? undefined : /^url\(#(.*)\)$/.exec(value)?.[1];
      if (id !== undefined && defined.has(id)) {
        element.setAttribute(name, `url(#${prefix}${id})`);
      }
    }
    const href = element.getAttribute("href");
    if (href !== null && href.startsWith("#") && defined.has(href.slice(1))) {
      element.setAttribute("href", `#${prefix}${href.slice(1)}`);
    }
    for (const name of idListAttributes) {
      const value = element.getAttribute(name);
      if (value === null) {
        continue;
      }
      const ids = value.split(/\s+/).filter((id) => id !== "");
      if (ids.some((id) => defined.has(id))) {
        element.setAttribute(
          name,
          ids.map((id) => (defined.has(id) ? `${prefix}${id}` : id)).join(" ")
        );
      }
    }
  }
};

const isRendered = (fragment: DocumentFragment) =>
  Array.from(fragment.childNodes).some(
    (node) =>
      node.nodeType === 1 ||
      (node.nodeType === 3 && (node.textContent ?? "").trim() !== "")
  );

/**
 * Sanitizes `markup` and puts what is left into `wrapper`, replacing its
 * children. Inserts nothing, and answers `{ rendered: false }`, when the
 * wrapper is not an HTML element of a window, or the sanitizer gives back
 * anything but a document fragment of that window.
 */
export const insertUntrustedMarkup = (
  wrapper: Element,
  markup: string,
  { blobImages = false }: { blobImages?: boolean } = {}
): { rendered: boolean } => {
  const document = wrapper.ownerDocument;
  const view = document.defaultView;
  if (
    view === null ||
    wrapper instanceof view.HTMLElement === false ||
    wrapper.namespaceURI !== HTML_NAMESPACE
  ) {
    return { rendered: false };
  }
  const instances = instancesOf(view);
  const purify = blobImages ? instances.blobImages : instances.strict;
  if (purify.isSupported !== true) {
    return { rendered: false };
  }
  const result: unknown = purify.sanitize(markup, {
    ...configOf(blobImages),
    RETURN_DOM_FRAGMENT: true,
  });
  // DOMPurify gives back the dirty string when it is not supported, and may
  // give null; only a fragment of this window's realm is inserted, owned by
  // this document or by the inert one DOMPurify parsed into. Its nodes are
  // adopted, never parsed again.
  const owner =
    result instanceof view.DocumentFragment ? result.ownerDocument : undefined;
  if (
    owner === undefined ||
    (owner !== document && owner.defaultView !== null)
  ) {
    return { rendered: false };
  }
  const fragment = document.adoptNode(result as DocumentFragment);
  rewriteIdReferences(fragment);
  const rendered = isRendered(fragment);
  wrapper.replaceChildren(fragment);
  return { rendered };
};

const assignRef = <Value,>(
  ref: Ref<Value> | undefined,
  value: Value | null
) => {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref !== null && ref !== undefined) {
    (ref as { current: Value | null }).current = value;
  }
};

const withoutDataAttributes = (rest: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(rest).filter(([name]) => name.startsWith("data-") === false)
  );

type UntrustedMarkupProps = ComponentPropsWithoutRef<"div"> & {
  markup: string;
  blobImages?: boolean;
  renderFallback: (props: {
    ref: Ref<HTMLElement>;
    rest: Record<string, unknown>;
  }) => ReactNode;
};

/**
 * Renders a wrapper `div` with `rest` and `ref` and fills it through
 * `insertUntrustedMarkup` in a layout effect keyed on the wrapper and the
 * markup: the same pair inserts nothing again, so a re-render keeps the
 * inserted nodes (and a selection on the canvas), and a new markup replaces
 * every old node. When nothing renderable is left, the wrapper is hidden,
 * keeping its place, and `renderFallback` stands beside it with the `ref` and
 * `rest` (its `data-ws-*` among them, which the hidden wrapper then drops, so
 * the canvas maps the instance to one element).
 */
export const UntrustedMarkup = forwardRef<HTMLElement, UntrustedMarkupProps>(
  ({ markup, blobImages = false, renderFallback, ...rest }, ref) => {
    const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null);
    const [rendered, setRendered] = useState(true);
    const inserted = useRef<{
      wrapper: Element;
      markup: string;
      blobImages: boolean;
    }>();

    useLayoutEffect(() => {
      if (wrapper === null) {
        return;
      }
      const last = inserted.current;
      if (
        last?.wrapper === wrapper &&
        last.markup === markup &&
        last.blobImages === blobImages
      ) {
        return;
      }
      const result = insertUntrustedMarkup(wrapper, markup, { blobImages });
      inserted.current = { wrapper, markup, blobImages };
      setRendered(result.rendered);
    }, [wrapper, markup, blobImages]);

    const wrapperRef = useCallback(
      (element: HTMLDivElement | null) => {
        if (element !== null) {
          setWrapper(element);
        }
        if (rendered) {
          assignRef(ref, element);
        }
      },
      [ref, rendered]
    );

    return (
      <>
        {rendered === false && renderFallback({ ref, rest })}
        <div
          {...(rendered ? rest : withoutDataAttributes(rest))}
          ref={wrapperRef}
          hidden={rendered === false || undefined}
        />
      </>
    );
  }
);
UntrustedMarkup.displayName = "UntrustedMarkup";
