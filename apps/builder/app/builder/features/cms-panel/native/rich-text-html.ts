/**
 * The rich text value's HTML, in and out of the editor (4.3.3.1), with no
 * React: the rule that keeps a value it cannot hold read-only, the import
 * and the export.
 *
 * Until W2 adds `@lexical/html` and the block nodes, the import and export
 * are this file's own; W2 swaps them for `$generateNodesFromDOM` and
 * `$generateHtmlFromNodes`.
 */
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isTextNode,
  type ElementNode,
  type LexicalNode,
  type TextFormatType,
} from "lexical";
import { $createLinkNode, $isLinkNode } from "@lexical/link";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import type { CmsRichTextValue } from "./cms-source";

/** The tags this node set keeps; any other block opens read-only. */
const IMAGE_TAGS = "img, figure, figcaption";
const UNKEPT_TAGS = "h1, h2, h3, h4, h5, h6, blockquote, ul, ol, pre, table";

export type RichTextReadOnlyReason = "images" | "unsupported";

export const getRichTextReadOnlyReason = (
  html: string
): RichTextReadOnlyReason | undefined => {
  if (html === "" || typeof DOMParser === "undefined") {
    return;
  }
  // An inert document: never inserted into the live page.
  const body = new DOMParser().parseFromString(html, "text/html").body;
  if (body.querySelector(IMAGE_TAGS) !== null) {
    return "images";
  }
  if (body.querySelector(UNKEPT_TAGS) !== null) {
    return "unsupported";
  }
};

const formatTags: Array<[string, TextFormatType]> = [
  ["STRONG", "bold"],
  ["B", "bold"],
  ["EM", "italic"],
  ["I", "italic"],
  ["U", "underline"],
  ["S", "strikethrough"],
  ["DEL", "strikethrough"],
  ["STRIKE", "strikethrough"],
  ["CODE", "code"],
];

const importInline = (
  node: Node,
  formats: TextFormatType[],
  parent: ElementNode
) => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (text !== "") {
      const textNode = $createTextNode(text);
      for (const format of formats) {
        textNode.toggleFormat(format);
      }
      parent.append(textNode);
    }
    return;
  }
  if (node instanceof Element === false) {
    return;
  }
  if (node.tagName === "BR") {
    parent.append($createLineBreakNode());
    return;
  }
  if (node.tagName === "A") {
    const link = $createLinkNode(node.getAttribute("href") ?? "", {
      target: node.getAttribute("target"),
      rel: node.getAttribute("rel"),
      title: node.getAttribute("title"),
    });
    for (const child of node.childNodes) {
      importInline(child, formats, link);
    }
    parent.append(link);
    return;
  }
  const format = formatTags.find(([tag]) => tag === node.tagName)?.[1];
  const nextFormats = format === undefined ? formats : [...formats, format];
  for (const child of node.childNodes) {
    importInline(child, nextFormats, parent);
  }
};

/** W2: `$generateNodesFromDOM`. Runs inside an editor update. */
export const importRichTextHtml = (html: string) => {
  const root = $getRoot();
  root.clear();
  const body = new DOMParser().parseFromString(html, "text/html").body;
  let loose: ElementNode | undefined;
  for (const child of body.childNodes) {
    if (child instanceof Element && child.tagName === "P") {
      loose = undefined;
      const paragraph = $createParagraphNode();
      for (const inline of child.childNodes) {
        importInline(inline, [], paragraph);
      }
      root.append(paragraph);
    } else if (child instanceof Element && child.tagName === "HR") {
      loose = undefined;
      root.append($createHorizontalRuleNode());
    } else {
      if (loose === undefined) {
        loose = $createParagraphNode();
        root.append(loose);
      }
      importInline(child, [], loose);
    }
  }
  if (root.getChildrenSize() === 0) {
    root.append($createParagraphNode());
  }
};

const escapeText = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttribute = (text: string) =>
  escapeText(text).replace(/"/g, "&quot;");

const formatWrappers: Array<[TextFormatType, string]> = [
  ["code", "code"],
  ["strikethrough", "s"],
  ["underline", "u"],
  ["italic", "em"],
  ["bold", "strong"],
];

const exportInline = (node: LexicalNode): string => {
  if ($isLineBreakNode(node)) {
    return "<br>";
  }
  if ($isTextNode(node)) {
    let html = escapeText(node.getTextContent());
    for (const [format, tag] of formatWrappers) {
      if (node.hasFormat(format)) {
        html = `<${tag}>${html}</${tag}>`;
      }
    }
    return html;
  }
  if ($isLinkNode(node)) {
    const attributes = [
      `href="${escapeAttribute(node.getURL())}"`,
      node.getTarget()
        ? `target="${escapeAttribute(node.getTarget() ?? "")}"`
        : "",
      node.getRel() ? `rel="${escapeAttribute(node.getRel() ?? "")}"` : "",
      node.getTitle()
        ? `title="${escapeAttribute(node.getTitle() ?? "")}"`
        : "",
    ].filter(Boolean);
    return `<a ${attributes.join(" ")}>${node
      .getChildren()
      .map(exportInline)
      .join("")}</a>`;
  }
  if ($isElementNode(node)) {
    return node.getChildren().map(exportInline).join("");
  }
  return "";
};

/** W2: `$generateHtmlFromNodes`. Runs inside an editor read. */
export const exportRichTextHtml = () =>
  $getRoot()
    .getChildren()
    .map((node) => {
      if ($isHorizontalRuleNode(node)) {
        return "<hr>";
      }
      if ($isParagraphNode(node)) {
        return `<p>${node.getChildren().map(exportInline).join("")}</p>`;
      }
      return exportInline(node);
    })
    .join("");

export const readRichTextValue = (
  value: unknown
): CmsRichTextValue | undefined =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as CmsRichTextValue).html === "string"
    ? (value as CmsRichTextValue)
    : undefined;
