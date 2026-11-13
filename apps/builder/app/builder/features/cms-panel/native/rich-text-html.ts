/**
 * The rich text value's HTML, in and out of the editor (4.3.3.1), with no
 * React: the node set, the export map, the link rules, the read-only rule,
 * the import and the export.
 */
import {
  $createParagraphNode,
  $getRoot,
  $isDecoratorNode,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  createEditor,
  ParagraphNode,
  type BaseSelection,
  type DOMConversionMap,
  type DOMExportOutput,
  type HTMLConfig,
  type Klass,
  type LexicalEditor,
  type LexicalNode,
} from "lexical";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { $isLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { CodeNode } from "@lexical/code";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import type { CmsRichTextValue } from "./cms-source";
import {
  CmsFigureNode,
  CmsImageNode,
  importStoredImages,
} from "./rich-text-image-node";

/** One node for each tag of the platform's allowlist. */
export const richTextNodes: ReadonlyArray<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  CodeNode,
  HorizontalRuleNode,
  CmsImageNode,
  CmsFigureNode,
];

const parseHtml = (html: string) =>
  // An inert document: never inserted into the live page.
  new DOMParser().parseFromString(html, "text/html");

const isHtmlElement = (node: unknown): node is HTMLElement =>
  node instanceof HTMLElement;

/** An empty paragraph writes `<p></p>`, not `<p><br></p>`. */
const exportParagraph = (
  editor: LexicalEditor,
  node: LexicalNode
): DOMExportOutput => {
  const output = node.exportDOM(editor);
  const { element } = output;
  if (
    node instanceof ParagraphNode &&
    node.isEmpty() &&
    isHtmlElement(element)
  ) {
    element.replaceChildren();
  }
  return output;
};

/**
 * The selection a copy or cut is writing, while it writes: a code block it
 * reaches partway writes only its selected text. Cleared once the copy is done.
 */
let copying: BaseSelection | null = null;

export const markRichTextCopy = (selection: BaseSelection | null) => {
  copying = selection;
  queueMicrotask(() => {
    copying = null;
  });
};

const selectedText = (node: LexicalNode) => {
  const selection = copying;
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() ||
    $isElementNode(node) === false
  ) {
    return node.getTextContent();
  }
  const [start, end] = selection.isBackward()
    ? [selection.focus, selection.anchor]
    : [selection.anchor, selection.focus];
  const selected = new Set(selection.getNodes().map((each) => each.getKey()));
  // a code block may hold a code node: its text is read down to the leaves
  const textOf = (parent: LexicalNode): string =>
    $isElementNode(parent) === false
      ? ""
      : parent
          .getChildren()
          .filter((child) => selected.has(child.getKey()))
          .map((child) => {
            if ($isElementNode(child)) {
              return textOf(child);
            }
            const text = child.getTextContent();
            if ($isTextNode(child) === false) {
              return text;
            }
            const from = child.getKey() === start.key ? start.offset : 0;
            const to = child.getKey() === end.key ? end.offset : text.length;
            return text.slice(from, to);
          })
          .join("");
  return textOf(node);
};

/** A code block writes `<pre><code>`, its line breaks as "\n". */
const exportCode = (
  _editor: LexicalEditor,
  node: LexicalNode
): DOMExportOutput => {
  const text = selectedText(node);
  return {
    element: document.createElement("pre"),
    after: () => {
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = text;
      pre.appendChild(code);
      return pre;
    },
  };
};

const isListElement = (node: Element) =>
  node.tagName === "UL" || node.tagName === "OL";

/** Moves each list item that holds only a nested list into the one before. */
const nestListItems = (list: HTMLElement) => {
  for (const item of Array.from(list.children)) {
    const previous = item.previousElementSibling;
    const nested = item.firstElementChild;
    if (
      item.tagName === "LI" &&
      previous?.tagName === "LI" &&
      nested !== null &&
      item.childNodes.length === 1 &&
      isListElement(nested)
    ) {
      previous.appendChild(nested);
      item.remove();
    }
  }
};

/** A list item that holds only a nested list writes it in the previous item. */
const exportList = (
  editor: LexicalEditor,
  node: LexicalNode
): DOMExportOutput => {
  const output = node.exportDOM(editor);
  return {
    ...output,
    after: (generated) => {
      const replaced = output.after?.call(node, generated) ?? undefined;
      const element = replaced ?? generated;
      if (isHtmlElement(element)) {
        nestListItems(element);
      }
      return replaced;
    },
  };
};

/**
 * A `code` element outside a `pre` is the inline code format, even across a
 * line break; `CodeNode` would read that one as a code block.
 */
const inlineCodeImport: DOMConversionMap = {
  code: (domNode) =>
    domNode.parentElement?.tagName === "PRE"
      ? null
      : {
          conversion: () => ({
            node: null,
            forChild: (child) => {
              if ($isTextNode(child) && child.hasFormat("code") === false) {
                child.toggleFormat("code");
              }
              return child;
            },
          }),
          priority: 2,
        },
};

export const richTextHtmlConfig: HTMLConfig = {
  export: new Map<
    Klass<LexicalNode>,
    (editor: LexicalEditor, target: LexicalNode) => DOMExportOutput
  >([
    [ParagraphNode, exportParagraph],
    [CodeNode, exportCode],
    [ListNode, exportList],
  ]),
  import: inlineCodeImport,
};

/** What a browser strips from a URL before parsing it. */
const cleanUrl = (raw: string | undefined) =>
  typeof raw === "string"
    ? raw
        // eslint-disable-next-line no-control-regex
        .replace(/^[\u0000- ]+|[\u0000- ]+$/g, "")
        .replace(/[\t\n\r]/g, "")
    : "";

const schemeOf = (url: string) =>
  /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url)?.[1].toLowerCase();

const linkSchemes = new Set(["http", "https", "mailto", "tel"]);

/**
 * The address a link may take from the Link control, as the site keeps it:
 * http, https, mailto, tel, a root path (not `//` or `/\`) or a fragment.
 */
export const richTextHref = (raw: string | undefined): string | null => {
  const href = cleanUrl(raw);
  if (href === "") {
    return null;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(href)) {
    return null;
  }
  if (href.startsWith("#")) {
    return href;
  }
  if (href.startsWith("/")) {
    return href[1] === "/" || href[1] === "\\" ? null : href;
  }
  const scheme = schemeOf(href);
  return scheme !== undefined && linkSchemes.has(scheme) ? href : null;
};

/**
 * The address a stored link keeps on load, as the platform's sanitiser
 * stores it: no scheme, or http, https, mailto or tel.
 */
export const richTextImportHref = (raw: string | undefined): string | null => {
  const href = cleanUrl(raw);
  if (href === "") {
    return null;
  }
  const scheme = schemeOf(href);
  return scheme === undefined || linkSchemes.has(scheme) ? href : null;
};

const signatureTags = new Set([
  "H2",
  "H3",
  "H4",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "PRE",
  "HR",
  "IMG",
  "FIGURE",
]);

/** Elements that end the paragraph they stand in, as the site reads them. */
const paragraphBreakTags = new Set([
  ...signatureTags,
  "P",
  "IMG",
  "FIGURE",
  "FIGCAPTION",
]);

const hasContent = (node: Node): boolean =>
  node.nodeType === Node.TEXT_NODE
    ? (node.textContent ?? "").trim() !== ""
    : node instanceof Element &&
      (node.tagName === "BR" || Array.from(node.childNodes).some(hasContent));

/**
 * The paragraphs a list item holds, as the site counts them: each `p` with
 * content is one, and each run of inline content between blocks is one.
 */
const countListItemParagraphs = (item: Element) => {
  let count = 0;
  let inRun = false;
  const endRun = () => {
    if (inRun) {
      count += 1;
      inRun = false;
    }
  };
  const walk = (parent: Element) => {
    for (const child of Array.from(parent.childNodes)) {
      if (child instanceof Element && paragraphBreakTags.has(child.tagName)) {
        endRun();
        if (child.tagName === "P") {
          // a paragraph's images end the runs within it
          walk(child);
          endRun();
        }
        continue;
      }
      if (hasContent(child)) {
        inRun = true;
      }
    }
  };
  walk(item);
  endRun();
  return count;
};

/** The line breaks a list item holds itself, outside its nested lists. */
const countOwnBreaks = (item: Element) =>
  Array.from(item.querySelectorAll("br")).filter(
    (br) => br.parentElement?.closest("li") === item
  ).length;

/**
 * The nesting of the value's headings, quotes, lists, list items (each with
 * its count of paragraphs), code blocks, rules, images and figures, in document order, and
 * the number of its kept links.
 */
export const richTextBlockSignature = (html: string) => {
  const body = parseHtml(html).body;
  const tokens: string[] = [];
  let links = 0;
  for (const element of Array.from(body.querySelectorAll("*"))) {
    if (signatureTags.has(element.tagName)) {
      let depth = 0;
      for (
        let parent = element.parentElement;
        parent !== null && parent !== body;
        parent = parent.parentElement
      ) {
        if (signatureTags.has(parent.tagName)) {
          depth += 1;
        }
      }
      const token = `${element.tagName.toLowerCase()}@${depth}`;
      tokens.push(
        element.tagName === "LI"
          ? `${token}:p${countListItemParagraphs(element)}:br${countOwnBreaks(element)}`
          : token
      );
    }
    if (
      element.tagName === "A" &&
      richTextImportHref(element.getAttribute("href") ?? undefined) !== null
    ) {
      links += 1;
    }
  }
  tokens.push(`links=${links}`);
  return tokens.join(" ");
};

export type RichTextReadOnlyReason = "lossy";

const writeHeadless = (html: string) => {
  const editor = createEditor({
    namespace: "cms-rich-text-check",
    nodes: [...richTextNodes],
    html: richTextHtmlConfig,
    onError: (error) => {
      throw error;
    },
  });
  editor.update(() => importRichTextHtml(editor, html), { discrete: true });
  return exportRichTextHtml(editor);
};

/** Whether the value holds an image tag. */
export const richTextHasImage = (html: string) =>
  html !== "" &&
  typeof DOMParser !== "undefined" &&
  parseHtml(html).body.querySelector("img, figure, figcaption") !== null;

/**
 * "lossy" for a value whose block signature the editor's own export of it
 * does not reproduce.
 */
export const getRichTextReadOnlyReason = (
  html: string
): RichTextReadOnlyReason | undefined => {
  if (html === "" || typeof DOMParser === "undefined") {
    return;
  }
  const body = parseHtml(html).body;
  if (body.querySelector("img") !== null) {
    // no free mark: the spaces beside its images would not be kept
    if (pickImageEdgeMark(body.textContent ?? "") === undefined) {
      return "lossy";
    }
    // an image in a link the editor unwraps would join the line it hides from
    for (const anchor of Array.from(body.querySelectorAll("a"))) {
      if (
        richTextImportHref(anchor.getAttribute("href") ?? undefined) === null &&
        anchor.querySelector("img") !== null
      ) {
        return "lossy";
      }
    }
  }
  let written: string;
  try {
    written = writeHeadless(html);
  } catch {
    // a value the editor cannot load opens read-only, never as a failure
    return "lossy";
  }
  if (richTextBlockSignature(html) !== richTextBlockSignature(written)) {
    return "lossy";
  }
};

/**
 * Lexical's import trims a space at a line's edge, and an image ends the
 * line for it, so "Join us <img> today" would lose both spaces. Before the
 * import, each text edge touching an image gets this mark, which keeps its
 * space; the imported text then drops the mark.
 */
const pickImageEdgeMark = (text: string) => {
  // the first private-use character the value does not already hold
  for (let code = 0xe000; code <= 0xf8ff; code += 1) {
    const mark = String.fromCharCode(code);
    if (text.includes(mark) === false) {
      return mark;
    }
  }
};

/** The inline wrappers an image's neighbouring text may sit in. */
const INLINE_TAGS = new Set([
  "A",
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "CODE",
  "SPAN",
  "SUB",
  "SUP",
]);

const isInlineElement = (node: Node) =>
  node.nodeType === Node.ELEMENT_NODE &&
  INLINE_TAGS.has((node as Element).tagName);

/** The next node in `node`'s line, climbing out of inline wrappers only. */
const stepInLine = (node: Node, forward: boolean): Node | null => {
  let from: Node = node;
  let sibling = forward ? from.nextSibling : from.previousSibling;
  // an image first or last in a link or a mark: its line goes on outside it
  while (sibling === null) {
    const parent = from.parentNode;
    if (parent === null || isInlineElement(parent) === false) {
      return null;
    }
    from = parent;
    sibling = forward ? from.nextSibling : from.previousSibling;
  }
  return sibling;
};

/**
 * The nearest text beside `node` in its line, through inline wrappers only;
 * an empty wrapper or text is passed over, as Lexical's own import does.
 */
const textBeside = (node: Node, forward: boolean): Text | undefined => {
  let current = stepInLine(node, forward);
  while (current !== null) {
    if (current.nodeType === Node.TEXT_NODE) {
      if ((current as Text).data !== "") {
        return current as Text;
      }
      current = stepInLine(current, forward);
      continue;
    }
    if (isInlineElement(current) === false) {
      return;
    }
    const child: Node | null = forward ? current.firstChild : current.lastChild;
    current = child ?? stepInLine(current, forward);
  }
};

const markImageEdges = (body: HTMLElement) => {
  const mark = pickImageEdgeMark(body.textContent ?? "");
  if (mark === undefined) {
    return;
  }
  for (const image of Array.from(body.querySelectorAll("img"))) {
    // a figure's image is kept with its caption by the figure node
    if (image.parentElement?.tagName === "FIGURE") {
      continue;
    }
    const before = textBeside(image, false);
    if (before !== undefined && /\s$/.test(before.data)) {
      before.data = `${before.data}${mark}`;
    }
    const after = textBeside(image, true);
    if (after !== undefined && /^\s/.test(after.data)) {
      after.data = `${mark}${after.data}`;
    }
  }
  return mark;
};

/**
 * After the import: drops the edge mark from the text, and drops a link left
 * with no children, which Lexical would not load again (so such a value
 * reads lossy rather than locking itself after a save).
 */
const tidyImported = (
  nodes: LexicalNode[],
  mark: string | undefined
): LexicalNode[] =>
  nodes.flatMap((node) => {
    if ($isTextNode(node)) {
      const text = node.getTextContent();
      if (mark !== undefined && text.includes(mark)) {
        const kept = text.split(mark).join("");
        if (kept === "") {
          return [];
        }
        node.setTextContent(kept);
      }
      return [node];
    }
    if ($isElementNode(node)) {
      const children = node.getChildren();
      const kept = tidyImported(children, mark);
      for (const child of children) {
        if (kept.includes(child) === false) {
          child.remove(true);
        }
      }
      if ($isLinkNode(node) && node.getChildrenSize() === 0) {
        return [];
      }
    }
    return [node];
  });

/** Text, line breaks and inline elements; blocks stand at the root. */
const isInlineNode = (node: LexicalNode) =>
  $isElementNode(node) || $isDecoratorNode(node) ? node.isInline() : true;

/**
 * Loads stored HTML into the editor. Runs inside an editor update: the root
 * is cleared and filled with the value's nodes.
 */
export const importRichTextHtml = (editor: LexicalEditor, html: string) => {
  const dom = parseHtml(html);
  for (const anchor of Array.from(dom.body.querySelectorAll("a"))) {
    const href = richTextImportHref(anchor.getAttribute("href") ?? undefined);
    if (href === null) {
      anchor.replaceWith(...Array.from(anchor.childNodes));
    } else {
      anchor.setAttribute("href", href);
    }
  }
  const mark = markImageEdges(dom.body);
  const imported = importStoredImages(() => $generateNodesFromDOM(editor, dom));
  const nodes: LexicalNode[] = [];
  let run: ParagraphNode | undefined;
  for (const node of tidyImported(imported, mark)) {
    if (isInlineNode(node)) {
      if (run === undefined) {
        run = $createParagraphNode();
        nodes.push(run);
      }
      run.append(node);
    } else {
      run = undefined;
      nodes.push(node);
    }
  }
  const root = $getRoot();
  root.clear();
  if (nodes.length === 0) {
    nodes.push($createParagraphNode());
  }
  root.append(...nodes);
};

/** The editor's HTML, under its current state. */
export const exportRichTextHtml = (editor: LexicalEditor) =>
  editor.getEditorState().read(() => $generateHtmlFromNodes(editor, null));

const blockEnds = new Set([
  "P",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "PRE",
  "DIV",
  "FIGCAPTION",
  "TR",
]);

/** The value's text as the platform derives it: blocks and breaks as spaces. */
const toPlainText = (html: string) => {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? "");
      return;
    }
    if (node instanceof Element === false) {
      return;
    }
    if (node.tagName === "BR" || node.tagName === "HR") {
      parts.push(" ");
      return;
    }
    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
    if (blockEnds.has(node.tagName)) {
      parts.push(" ");
    }
  };
  walk(parseHtml(html).body);
  return parts.join("").replace(/\s+/g, " ").trim();
};

/** A string or `{ html, text? }`; anything else is no value. */
export const readRichTextValue = (value: unknown): CmsRichTextValue | null => {
  if (typeof value === "string") {
    return { html: value, text: toPlainText(value) };
  }
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { html?: unknown }).html === "string"
  ) {
    const { html, text } = value as { html: string; text?: unknown };
    return { html, text: typeof text === "string" ? text : toPlainText(html) };
  }
  return null;
};
