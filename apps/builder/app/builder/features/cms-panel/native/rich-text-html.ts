/**
 * The rich text value's HTML, in and out of the editor (4.3.3.1), with no
 * React: the node set, the export map, the node rules, the link rules, the
 * read-only rule (an exact round trip against the platform's sanitiser and
 * /v1 nodes, spec V12), the import and the export.
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
  TextNode,
  type BaseSelection,
  $createLineBreakNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type HTMLConfig,
  type Klass,
  type LexicalEditor,
  type LexicalNode,
} from "lexical";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { $isLinkNode, LinkNode } from "@lexical/link";
import {
  $isListItemNode,
  $isListNode,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import {
  $createHeadingNode,
  HeadingNode,
  QuoteNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import { $isCodeNode, CodeHighlightNode, CodeNode } from "@lexical/code";
import { mergeRegister } from "@lexical/utils";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import type { CmsRichTextValue } from "./cms-source";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import {
  RICH_TEXT_MAX_DEPTH,
  toRichTextNodes,
  type RichTextBlock,
  type RichTextInline,
} from "./rich-text-nodes";
import {
  CmsFigureNode,
  CmsImageNode,
  importStoredImages,
} from "./rich-text-image-node";

/**
 * One node for each tag of the platform's allowlist, and the code block's
 * highlight: the live editor and the read-only check load with the same set.
 */
export const richTextNodes: ReadonlyArray<Klass<LexicalNode>> = [
  CodeHighlightNode,
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

/**
 * Only the whitespace a browser collapses: a non-breaking space or an em
 * space shows, and the editor's import keeps it.
 */
const COLLAPSIBLE_RE = /^[ \t\n\r\f]*$/;
const isCollapsible = (text: string) => COLLAPSIBLE_RE.test(text);

/**
 * Nothing but collapsible whitespace: no text, no line break, no image and
 * no list (a list item's nested list, even an empty one, is its indent).
 */
const holdsNothing = (node: LexicalNode): boolean =>
  ($isTextNode(node) && isCollapsible(node.getTextContent())) ||
  ($isElementNode(node) &&
    $isListNode(node) === false &&
    node.getChildren().every(holdsNothing));

/**
 * A paragraph, heading, quote or list item holding nothing writes `<p></p>`
 * (or its tag). Anything else, line breaks included, is written as it is: a
 * stored value's import keeps every line break (`loadingStored`), so a load
 * and save keeps them all.
 */
const exportBlock = (
  editor: LexicalEditor,
  node: LexicalNode
): DOMExportOutput => {
  const output = node.exportDOM(editor);
  if ($isElementNode(node) === false || holdsNothing(node) === false) {
    return output;
  }
  // the children are written after this export: cleared once they are in
  const after = output.after;
  return {
    ...output,
    after: (generated) => {
      const element =
        after === undefined ? generated : after.call(node, generated);
      if (isHtmlElement(element)) {
        element.replaceChildren();
        return element;
      }
      // an export map's after never returns a fragment: anything else stands
      return element instanceof DocumentFragment ? undefined : element;
    },
  };
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
    // an item holding only lists (and collapsible whitespace)
    const lists = Array.from(item.children);
    if (
      item.tagName === "LI" &&
      previous?.tagName === "LI" &&
      lists.length > 0 &&
      lists.every(isListElement) &&
      Array.from(item.childNodes).every(
        (child) =>
          child instanceof Element || isCollapsible(child.textContent ?? "")
      )
    ) {
      for (const nested of lists) {
        previous.appendChild(nested);
      }
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
 * Whether a stored value is loading. Lexical drops a block's only or last
 * line break; a stored value's load keeps every one, so its save writes them
 * back as they were. Pasted HTML keeps Lexical's rule.
 */
let loadingStored = false;

const inlineCodeImport: DOMConversionMap = {
  br: () =>
    loadingStored
      ? {
          conversion: () => ({ node: $createLineBreakNode() }),
          priority: 1,
        }
      : null,
  // a `code` element outside a `pre` is the inline code format, even across
  // a line break; `CodeNode` would read that one as a code block
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
    [ParagraphNode, exportBlock],
    [HeadingNode, exportBlock],
    [QuoteNode, exportBlock],
    [ListItemNode, exportBlock],
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

export type RichTextReadOnlyReason = "lossy";

const $plainInCode = (node: TextNode) => {
  if (node.getFormat() !== 0 && $isCodeNode(node.getParent())) {
    node.setFormat(0);
  }
};

/** The heading tags the site keeps: h1 becomes h2, h5 and h6 become h4. */
const allowedHeadingTag = (tag: HeadingTagType): HeadingTagType =>
  tag === "h1" ? "h2" : tag === "h5" || tag === "h6" ? "h4" : tag;

/**
 * The node rules the live editor and the read-only check both run: a heading
 * the site does not keep takes the nearest kept tag, an empty link goes, a
 * link whose address the editor refuses gives way to its text, and a code
 * block holds plain text (no format, no link).
 */
export const registerRichTextTransforms = (editor: LexicalEditor) =>
  mergeRegister(
    editor.registerNodeTransform(HeadingNode, (node) => {
      const tag = allowedHeadingTag(node.getTag());
      if (tag === node.getTag()) {
        return;
      }
      const heading = $createHeadingNode(tag);
      heading.setFormat(node.getFormatType());
      heading.setIndent(node.getIndent());
      heading.setDirection(node.getDirection());
      node.replace(heading, true);
    }),
    editor.registerNodeTransform(LinkNode, (node) => {
      // a link with nothing in it is not kept: the next load drops it
      if (node.isEmpty()) {
        node.remove();
        return;
      }
      if (
        richTextImportHref(node.getURL()) !== null &&
        $isCodeNode(node.getParent()) === false
      ) {
        return;
      }
      for (const child of node.getChildren()) {
        node.insertBefore(child);
      }
      node.remove();
    }),
    editor.registerNodeTransform(TextNode, $plainInCode),
    editor.registerNodeTransform(CodeHighlightNode, $plainInCode)
  );

/** The editor's load and save of a stored value, with no view. */
export const writeRichTextHeadless = (html: string) => {
  const editor = createEditor({
    namespace: "cms-rich-text-check",
    nodes: [...richTextNodes],
    html: richTextHtmlConfig,
    onError: (error) => {
      throw error;
    },
  });
  registerRichTextTransforms(editor);
  editor.update(() => importRichTextHtml(editor, html), { discrete: true });
  return exportRichTextHtml(editor);
};

/** Whether the value holds an image tag. */
export const richTextHasImage = (html: string) =>
  html !== "" &&
  typeof DOMParser !== "undefined" &&
  parseHtml(html).body.querySelector("img, figure, figcaption") !== null;

/** Each attribute of a tag, sorted, so attribute order is no difference. */
const attributesOf = (tag: string) =>
  (tag.match(/\s[a-z-]+="[^"]*"/g) ?? []).sort().join("");

/**
 * The links the page shows, in order, each with every attribute: an anchor
 * with no address is no link, and a link with no text and no image shows
 * nothing, so both sides drop it.
 */
const linksOf = (html: string) =>
  [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .filter(
      (match) =>
        /\shref="/.test(match[1]) &&
        (/<img\b/.test(match[2]) || match[2].replace(/<[^>]*>/g, "") !== "")
    )
    .map((match) => attributesOf(match[1]));

/** The images, in order, each with every attribute. */
const imagesOf = (html: string) =>
  [...html.matchAll(/<img\b[^>]*>/g)].map((match) => attributesOf(match[0]));

const sameList = (left: string[], right: string[]) =>
  left.length === right.length &&
  left.every((entry, index) => entry === right[index]);

/**
 * Whether the platform cuts the tree at its node limit: a code block holding
 * text, added at the end, comes back whole as the last node only when the
 * tree has room for it. A tree of exactly the limit reads as cut too.
 */
const isCutAtNodeLimit = (stored: string) => {
  const last = toRichTextNodes(
    `${stored}<pre><code>x</code></pre>`
  ).children.at(-1);
  return !(last?.t === "code" && last.text === "x");
};

/**
 * Whether the platform flattens a list or quote past its depth limit to
 * plain text: one with RICH_TEXT_MAX_DEPTH - 1 lists or quotes around it.
 */
const isFlattenedAtDepthLimit = (stored: string) =>
  Array.from(
    parseHtml(stored).body.querySelectorAll("ul, ol, blockquote")
  ).some((element) => {
    let around = 0;
    for (
      let parent = element.parentElement;
      parent !== null;
      parent = parent.parentElement
    ) {
      if (/^(UL|OL|BLOCKQUOTE)$/.test(parent.tagName)) {
        around += 1;
      }
    }
    return around >= RICH_TEXT_MAX_DEPTH - 1;
  });

const readOnlyMemo = new Map<string, RichTextReadOnlyReason | undefined>();
const READ_ONLY_MEMO_SIZE = 8;

/**
 * "lossy" for a value the editor would change on a load and save: the value
 * as the platform stores and serves it (sanitised, its /v1 nodes, its links
 * and images with every attribute) against the editor's own write of it, run
 * through the same sanitiser. A value the editor cannot load, one at the
 * platform's node or depth limit, and any value where no DOM parser exists
 * open read-only too.
 */
const inspect = (
  html: string
): { reason: RichTextReadOnlyReason | undefined; written?: string } => {
  if (typeof DOMParser === "undefined") {
    return { reason: "lossy" };
  }
  let written: string | undefined;
  try {
    const stored = sanitizeRichTextHtml(html);
    // no free mark: the spaces beside its images would not be kept
    if (
      /<img\b/.test(stored) &&
      pickImageEdgeMark(parseHtml(html).body.textContent ?? "") === undefined
    ) {
      return { reason: "lossy" };
    }
    // at a limit the platform serves a tail of plain text, which hides
    // what the editor would change there
    if (isCutAtNodeLimit(stored) || isFlattenedAtDepthLimit(stored)) {
      return { reason: "lossy" };
    }
    written = sanitizeRichTextHtml(writeRichTextHeadless(html));
    const before = toRichTextNodes(stored).children;
    const after = toRichTextNodes(written).children;
    if (
      JSON.stringify(before) !== JSON.stringify(after) ||
      sameList(linksOf(stored), linksOf(written)) === false ||
      sameList(imagesOf(stored), imagesOf(written)) === false
    ) {
      return { reason: "lossy", written };
    }
    return { reason: undefined, written };
  } catch {
    // a value the editor cannot load opens read-only, never as a failure
    return { reason: "lossy" };
  }
};

export const getRichTextReadOnlyReason = (
  html: string
): RichTextReadOnlyReason | undefined => {
  if (html === "") {
    return;
  }
  if (readOnlyMemo.has(html)) {
    return readOnlyMemo.get(html);
  }
  const { reason } = inspect(html);
  if (readOnlyMemo.size >= READ_ONLY_MEMO_SIZE) {
    readOnlyMemo.delete(readOnlyMemo.keys().next().value as string);
  }
  readOnlyMemo.set(html, reason);
  return reason;
};

type ContentToken =
  | { k: "char"; ch: string; marks: string; href?: string; newTab?: true }
  | { k: "space" }
  | { k: "br" };

const COLLAPSIBLE_CHAR_RE = /[ \t\n\r\f]/;

/** Each character of an inline run, with its marks and its link. */
const rawTokens = (
  inlines: RichTextInline[],
  link?: { href: string; newTab?: true }
): ContentToken[] => {
  const tokens: ContentToken[] = [];
  for (const inline of inlines) {
    if (inline.t === "br") {
      tokens.push({ k: "br" });
    } else if (inline.t === "a") {
      tokens.push(
        ...rawTokens(inline.c, { href: inline.href, newTab: inline.newTab })
      );
    } else {
      const marks = (inline.marks ?? []).join(",");
      for (const ch of inline.text) {
        tokens.push(
          COLLAPSIBLE_CHAR_RE.test(ch)
            ? { k: "space" }
            : {
                k: "char",
                ch,
                marks,
                ...(link === undefined ? {} : link),
              }
        );
      }
    }
  }
  return tokens;
};

/**
 * A block's whole inline run as visible characters, collapsed spaces and
 * line breaks, collapsed once across its links and marks.
 */
const inlineTokens = (inlines: RichTextInline[]): ContentToken[] => {
  // one space for a run; none at an edge or beside a line break
  const kept: ContentToken[] = [];
  for (const token of rawTokens(inlines)) {
    if (token.k === "space") {
      const last = kept.at(-1);
      if (last === undefined || last.k !== "char") {
        continue;
      }
    } else if (token.k === "br" && kept.at(-1)?.k === "space") {
      kept.pop();
    }
    kept.push(token);
  }
  if (kept.at(-1)?.k === "space") {
    kept.pop();
  }
  return kept;
};

const BREAK: ContentToken = { k: "br" };

type TokenBlock =
  | Exclude<RichTextBlock, { t: "p" }>
  | { t: "p"; tokens: ContentToken[] };

/** A block list as the content comparison sees it. */
const normaliseBlocks = (
  blocks: RichTextBlock[],
  inItem = false
): unknown[] => {
  // a paragraph with nothing in it counts as nothing
  const tokenised: TokenBlock[] = [];
  for (const block of blocks) {
    if (block.t === "p") {
      const tokens = inlineTokens(block.c);
      if (tokens.length > 0) {
        tokenised.push({ t: "p", tokens });
      }
    } else {
      tokenised.push(block);
    }
  }
  // inside one list item, consecutive paragraphs read as one with breaks
  const merged: TokenBlock[] = [];
  for (const block of tokenised) {
    const last = merged.at(-1);
    if (inItem && block.t === "p" && last?.t === "p") {
      merged[merged.length - 1] = {
        t: "p",
        tokens: [...last.tokens, BREAK, ...block.tokens],
      };
    } else {
      merged.push(block);
    }
  }
  const out: unknown[] = [];
  for (const block of merged) {
    switch (block.t) {
      case "p":
        out.push(block);
        break;
      case "h":
        out.push({ t: "h", level: block.level, tokens: inlineTokens(block.c) });
        break;
      case "ul":
      case "ol":
        out.push({
          t: block.t,
          items: block.items.map((item) => normaliseBlocks(item, true)),
        });
        break;
      case "quote":
        out.push({ t: "quote", children: normaliseBlocks(block.children) });
        break;
      case "img":
        out.push({
          ...block,
          caption:
            block.caption === undefined
              ? undefined
              : inlineTokens(block.caption),
        });
        break;
      default:
        out.push(block);
    }
  }
  return out;
};

/** The links that show something, each with every attribute. */
const visibleLinksOf = (html: string) =>
  [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .filter(
      (match) =>
        /\shref="/.test(match[1]) &&
        (/<img\b/.test(match[2]) ||
          isCollapsible(
            match[2].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "\u00a0")
          ) === false)
    )
    .map((match) => attributesOf(match[1]));

/**
 * Whether two values hold the same content: the same blocks in order (type,
 * heading level, list type and nesting, quotes and their children, code text
 * exactly), images with every attribute and their captions, and the same
 * visible characters in order with their marks and links, and line breaks.
 * Collapsible whitespace reads as one space, none at a block's edge or
 * beside a line break, and carries no mark or link; it collapses once over
 * the block's whole inline run, across its links and marks. A non-breaking
 * space is visible. A paragraph with no visible character and no line break,
 * and a link with no visible text and no image, count as nothing; once those
 * paragraphs are dropped, a list item's consecutive paragraphs read as one
 * joined by line breaks.
 */
export const sameRichTextContent = (left: string, right: string) => {
  const a = sanitizeRichTextHtml(left);
  const b = sanitizeRichTextHtml(right);
  return (
    JSON.stringify(normaliseBlocks(toRichTextNodes(a).children)) ===
      JSON.stringify(normaliseBlocks(toRichTextNodes(b).children)) &&
    sameList(visibleLinksOf(a), visibleLinksOf(b)) &&
    sameList(imagesOf(a), imagesOf(b))
  );
};

/**
 * The value a Save sends for a changed rich-text field. One the guard reads
 * editable is sent as written. One that would reopen read-only is replaced by
 * the editor's own write of it only when that write reopens editable and
 * holds the same content (`sameRichTextContent`); otherwise it is sent as
 * written.
 */
export const settleRichTextHtml = (
  html: string
): { html: string; outcome: "unchanged" | "settled" | "kept" } => {
  // as the platform stores it: the field's own markup carries styles that
  // would change how a load reads its spaces
  const stored = sanitizeRichTextHtml(html);
  if (getRichTextReadOnlyReason(stored) === undefined) {
    return { html, outcome: "unchanged" };
  }
  try {
    const { written } = inspect(stored);
    if (
      written !== undefined &&
      getRichTextReadOnlyReason(written) === undefined &&
      sameRichTextContent(stored, written)
    ) {
      return { html: written, outcome: "settled" };
    }
  } catch {
    // a write that fails keeps the value as written
  }
  return { html, outcome: "kept" };
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
 * with no children, which shows nothing and which the platform's nodes drop
 * too.
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

const PASTE_BLOCKS =
  "p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, hr, figure, figcaption, div";
const PASTE_MARKS = "a, b, strong, i, em, u, s, code, span";

/**
 * A link or mark around blocks moves inside them: each run of its inline
 * content, block by block, gets its own copy, so the editor never writes a
 * block inside a link or mark (which the site reads differently). Runs on a
 * paste and on a stored value's load.
 */
export const pushMarksIntoBlocks = (body: HTMLElement) => {
  let moved = false;
  for (const mark of Array.from(body.querySelectorAll(PASTE_MARKS)).reverse()) {
    if (mark.querySelector(PASTE_BLOCKS) === null) {
      continue;
    }
    const wrapRuns = (parent: Element) => {
      let run: Element | null = null;
      for (const child of Array.from(parent.childNodes)) {
        // a figure stays whole; a block, or a wrapper holding blocks
        // (article, section, table), takes the mark inside
        if (child instanceof Element && child.matches("figure")) {
          run = null;
          continue;
        }
        if (
          child instanceof Element &&
          (child.matches(PASTE_BLOCKS) ||
            (child.matches(PASTE_MARKS) === false &&
              child.querySelector(PASTE_BLOCKS) !== null))
        ) {
          run = null;
          wrapRuns(child);
          continue;
        }
        if (run === null) {
          run = mark.cloneNode(false) as Element;
          parent.insertBefore(run, child);
        }
        run.appendChild(child);
      }
    };
    wrapRuns(mark);
    mark.replaceWith(...Array.from(mark.childNodes));
    moved = true;
  }
  return moved;
};

/**
 * Loads stored HTML into the editor. Runs inside an editor update: the root
 * is cleared and filled with the value's nodes.
 */
export const importRichTextHtml = (editor: LexicalEditor, html: string) => {
  const dom = parseHtml(html);
  // a link the rule refuses becomes its text; a kept one keeps its stored
  // address as it is, so the save writes it back unchanged
  for (const anchor of Array.from(dom.body.querySelectorAll("a"))) {
    if (richTextImportHref(anchor.getAttribute("href") ?? undefined) === null) {
      anchor.replaceWith(...Array.from(anchor.childNodes));
    }
  }
  // an item holding only a nested list, after another item, is an emptied
  // parent: an empty item before it keeps the list its own on the save.
  // Lexical makes that empty item itself for an item holding several lists
  for (const item of Array.from(dom.body.querySelectorAll("li"))) {
    if (
      item.previousElementSibling?.tagName === "LI" &&
      item.children.length === 1 &&
      Array.from(item.childNodes).every((child) =>
        child instanceof Element
          ? isListElement(child)
          : isCollapsible(child.textContent ?? "")
      )
    ) {
      item.parentNode?.insertBefore(dom.createElement("li"), item);
    }
  }
  pushMarksIntoBlocks(dom.body);
  const mark = markImageEdges(dom.body);
  const imported = importStoredImages(() => {
    loadingStored = true;
    try {
      return $generateNodesFromDOM(editor, dom);
    } finally {
      loadingStored = false;
    }
  });
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
  // a list item with no list around it holds no block type or list
  // command: such a value is not the editor's to load
  if (nodes.some((node) => $isListItemNode(node) || hasStrayListItem(node))) {
    throw new Error("A list item outside a list");
  }
  const root = $getRoot();
  root.clear();
  if (nodes.length === 0) {
    nodes.push($createParagraphNode());
  }
  root.append(...nodes);
};

/** Whether a list item sits in anything but a list, at any depth. */
const hasStrayListItem = (node: LexicalNode): boolean =>
  $isElementNode(node) &&
  node
    .getChildren()
    .some(
      (child) =>
        ($isListItemNode(child) && $isListNode(node) === false) ||
        hasStrayListItem(child)
    );

const linkEdgeBlocks = "p, li, h1, h2, h3, h4, h5, h6, blockquote, figcaption";

/**
 * The spaces at a link's edges, written as a load reads them, so the save is
 * a fixed point: of two collapsible spaces meeting at a link's edge the
 * second goes, and a link's last space before a line break or the end of its
 * line goes too.
 */
const fixLinkEdgeSpaces = (html: string) => {
  if (html.includes("<a ") === false || typeof DOMParser === "undefined") {
    return html;
  }
  const dom = parseHtml(html);
  let changed = false;
  for (const block of Array.from(dom.body.querySelectorAll(linkEdgeBlocks))) {
    // the block's own line: its text, line breaks and images, in order
    const tokens: Array<Text | "break" | "image"> = [];
    const walk = (node: Node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child instanceof Text) {
          tokens.push(child);
        } else if (child instanceof Element) {
          if (child.matches(linkEdgeBlocks) || child.matches("ul, ol")) {
            continue;
          }
          if (child.tagName === "BR") {
            tokens.push("break");
          } else if (child.tagName === "IMG") {
            tokens.push("image");
          } else {
            walk(child);
          }
        }
      }
    };
    walk(block);
    tokens.push("break");
    const linkOf = (text: Text) => text.parentElement?.closest("a") ?? null;
    tokens.forEach((token, index) => {
      if (token === "break" || token === "image") {
        return;
      }
      const next = tokens[index + 1];
      if (next === "image") {
        return;
      }
      if (next === "break") {
        if (linkOf(token) !== null && / +$/.test(token.data)) {
          token.data = token.data.replace(/ +$/, "");
          changed = true;
        }
        return;
      }
      if (
        linkOf(token) !== linkOf(next) &&
        / $/.test(token.data) &&
        /^ /.test(next.data)
      ) {
        next.data = next.data.replace(/^ +/, "");
        changed = true;
      }
    });
  }
  return changed ? dom.body.innerHTML : html;
};

/** The editor's HTML, under its current state. */
export const exportRichTextHtml = (editor: LexicalEditor) => {
  // a save writes every code block whole, whatever a copy left marked
  copying = null;
  return fixLinkEdgeSpaces(
    editor.getEditorState().read(() => $generateHtmlFromNodes(editor, null))
  );
};

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
