// Rich text as a structured node tree: the `nodes` twin of a rich-text value
// on /v1 (design docs/superpowers/specs/2026-10-26-cms-in-the-builder-design.md
// section 4.7). A published site renders this tree to React elements, so it
// never needs the HTML.
//
// Built at read time from HTML that has already been through
// sanitizeRichTextHtml. The rules here are narrower than the sanitizer's on
// purpose: protocol-relative links and non-https images pass the sanitizer
// but not this converter. Pure and DOM-free: htmlparser2 parses, so the module
// loads in every server runtime.
//
// Format, version 1, pinned by client/tests/fixtures/site-components/rich-text.json
// (the builder fork copies that file and tests its renderer against it).

import { parseDocument } from 'htmlparser2';

export type RichTextMark = 'b' | 'i' | 'u' | 's' | 'code';

export type RichTextInline =
  | { t: 'text'; text: string; marks?: RichTextMark[] }
  | { t: 'br' }
  | { t: 'a'; href: string; newTab?: true; c: RichTextInline[] };

export type RichTextBlock =
  | { t: 'p'; c: RichTextInline[] }
  | { t: 'h'; level: 2 | 3 | 4; c: RichTextInline[] }
  | { t: 'ul' | 'ol'; items: RichTextBlock[][] }
  | { t: 'quote'; children: RichTextBlock[] }
  | { t: 'code'; text: string }
  | { t: 'hr' }
  | {
      t: 'img';
      src: string;
      alt: string;
      width?: number;
      height?: number;
      caption?: RichTextInline[];
    };

export interface RichTextDoc {
  v: 1;
  children: RichTextBlock[];
}

/**
 * Deepest block nesting. Top-level blocks are at depth 1; the blocks of a
 * quote or of a list item are one deeper. A quote or list that would sit at
 * this depth becomes a paragraph of its plain text instead.
 */
export const RICH_TEXT_MAX_DEPTH = 8;

/**
 * Most nodes in a tree (blocks and inlines; the root is not counted). Past
 * it, everything from the first node that does not fit onwards becomes one
 * trailing paragraph of plain text.
 */
export const RICH_TEXT_MAX_NODES = 5_000;

const LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);
const MARK_ORDER: RichTextMark[] = ['b', 'i', 'u', 's', 'code'];

const MARK_TAGS: Record<string, RichTextMark> = {
  strong: 'b',
  b: 'b',
  em: 'i',
  i: 'i',
  u: 'u',
  s: 's',
  code: 'code',
};

/** Elements that end the paragraph they appear in. */
const BLOCK_TAGS = new Set([
  'p',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'hr',
  'img',
  'figure',
  'figcaption',
]);

/** Elements whose content is never text (the sanitizer removes them anyway). */
const DROPPED_TAGS = new Set([
  'script',
  'style',
  'template',
  'noscript',
  'iframe',
  'object',
  'textarea',
  'select',
  'title',
]);

// The parts of a htmlparser2 (domhandler) node this module reads.
interface DomNode {
  type: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
  children?: DomNode[];
}

const isElement = (n: DomNode): boolean =>
  n.type === 'tag' || n.type === 'script' || n.type === 'style';

// ============================================================
// URL rules
// ============================================================

/** What a browser strips from a URL before parsing it. */
function cleanUrl(raw: string | undefined): string {
  if (typeof raw !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return raw.replace(/^[\u0000- ]+|[\u0000- ]+$/g, '').replace(/[\t\n\r]/g, '');
}

function schemeOf(url: string): string | null {
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url);
  return m ? m[1].toLowerCase() : null;
}

/**
 * The href a link may keep: http:, https:, mailto:, tel:, a root path (not
 * `//` and not `/\`, which browsers read as protocol-relative) or a fragment.
 * Anything else returns null and the link becomes its text.
 */
export function richTextHref(raw: string | undefined): string | null {
  const href = cleanUrl(raw);
  if (!href) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(href)) return null;
  if (href.startsWith('#')) return href;
  if (href.startsWith('/')) return href[1] === '/' || href[1] === '\\' ? null : href;
  const scheme = schemeOf(href);
  return scheme && LINK_SCHEMES.has(scheme) ? href : null;
}

/** The src an image may keep: https: only. Anything else drops the image. */
export function richTextImageSrc(raw: string | undefined): string | null {
  const src = cleanUrl(raw);
  // eslint-disable-next-line no-control-regex
  if (!src || /[\u0000-\u001f\u007f]/.test(src)) return null;
  return schemeOf(src) === 'https' ? src : null;
}

function dimension(raw: string | undefined): number | undefined {
  if (typeof raw !== 'string' || !/^\d{1,6}$/.test(raw.trim())) return undefined;
  const n = Number(raw.trim());
  return n > 0 ? n : undefined;
}

// ============================================================
// Text helpers
// ============================================================

const collapse = (s: string): string => s.replace(/[ \t\n\r\f]+/g, ' ');

/** Plain text of DOM nodes, block boundaries as spaces. */
function domText(nodes: DomNode[]): string {
  const parts: string[] = [];
  const walk = (n: DomNode) => {
    if (n.type === 'text') {
      parts.push(n.data ?? '');
      return;
    }
    if (!isElement(n)) return;
    const name = n.name ?? '';
    if (DROPPED_TAGS.has(name)) return;
    if (name === 'br' || name === 'hr') {
      parts.push(' ');
      return;
    }
    const block = BLOCK_TAGS.has(name);
    if (block) parts.push(' ');
    for (const c of n.children ?? []) walk(c);
    if (block) parts.push(' ');
  };
  for (const n of nodes) walk(n);
  return collapse(parts.join('')).trim();
}

function textParagraph(text: string): RichTextBlock[] {
  return text ? [{ t: 'p', c: [{ t: 'text', text }] }] : [];
}

function sameMarks(a: RichTextMark[] | undefined, b: RichTextMark[] | undefined): boolean {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((m, i) => m === y[i]);
}

/**
 * Merge neighbouring text with the same marks, collapse whitespace across
 * text boundaries, and (for a paragraph, heading or caption) trim the edges
 * and the spaces beside a line break. Empty text goes.
 */
function tidy(inlines: RichTextInline[], trimEdges: boolean): RichTextInline[] {
  const out: RichTextInline[] = [];
  for (const node of inlines) {
    if (node.t !== 'text') {
      out.push(node);
      continue;
    }
    const prev = out[out.length - 1];
    if (prev && prev.t === 'text' && sameMarks(prev.marks, node.marks)) {
      prev.text = collapse(prev.text + node.text);
      continue;
    }
    let text = node.text;
    if (prev && prev.t === 'text' && prev.text.endsWith(' ') && text.startsWith(' ')) {
      text = text.slice(1);
    }
    out.push({ ...node, text });
  }
  if (trimEdges) {
    for (let i = 0; i < out.length; i++) {
      const node = out[i];
      if (node.t !== 'text') continue;
      const before = out[i - 1];
      const after = out[i + 1];
      if (!before || before.t === 'br') node.text = node.text.replace(/^ +/, '');
      if (!after || after.t === 'br') node.text = node.text.replace(/ +$/, '');
    }
  }
  return out.filter((n) => n.t !== 'text' || n.text !== '');
}

function textNode(text: string, marks: RichTextMark[]): RichTextInline {
  const ordered = MARK_ORDER.filter((m) => marks.includes(m));
  return ordered.length ? { t: 'text', text, marks: ordered } : { t: 'text', text };
}

// ============================================================
// Pass 1: DOM to tree (with the depth limit)
// ============================================================

interface InlineSink {
  push(node: RichTextInline): void;
}

/** Called with a block element met in inline content; null inside a link or caption. */
type Hoist = ((el: DomNode) => void) | null;

function collectInline(
  node: DomNode,
  marks: RichTextMark[],
  sink: InlineSink,
  hoist: Hoist,
  inLink: boolean
): void {
  if (node.type === 'text') {
    const text = collapse(node.data ?? '');
    if (text) sink.push(textNode(text, marks));
    return;
  }
  if (!isElement(node)) return;
  const name = node.name ?? '';
  const children = node.children ?? [];
  if (DROPPED_TAGS.has(name)) return;

  if (name === 'br') {
    sink.push({ t: 'br' });
    return;
  }
  const mark = MARK_TAGS[name];
  if (mark) {
    const next = marks.includes(mark) ? marks : [...marks, mark];
    for (const c of children) collectInline(c, next, sink, hoist, inLink);
    return;
  }
  if (name === 'a' && !inLink) {
    const inner: RichTextInline[] = [];
    const innerSink: InlineSink = { push: (n) => inner.push(n) };
    for (const c of children) collectInline(c, marks, innerSink, null, true);
    const c = tidy(inner, false);
    const href = richTextHref(node.attribs?.href);
    if (!href) {
      for (const n of c) sink.push(n);
      return;
    }
    if (c.length === 0) return;
    const newTab = (node.attribs?.target ?? '').trim().toLowerCase() === '_blank';
    sink.push(newTab ? { t: 'a', href, newTab: true, c } : { t: 'a', href, c });
    return;
  }
  if (BLOCK_TAGS.has(name)) {
    if (hoist) {
      hoist(node);
      return;
    }
    // Inside a link or a caption a block has no place: its text stays, an
    // image or rule goes.
    if (name === 'img' || name === 'hr') return;
    sink.push(textNode(' ', marks));
    for (const c of children) collectInline(c, marks, sink, null, inLink);
    sink.push(textNode(' ', marks));
    return;
  }
  // An element the format has no node for (a nested link included): its content.
  for (const c of children) collectInline(c, marks, sink, hoist, inLink);
}

/**
 * Lay out DOM nodes as blocks: inline content gathers into paragraphs (or the
 * block `make` builds), and a block element ends the paragraph it is in.
 */
function flow(
  nodes: DomNode[],
  depth: number,
  out: RichTextBlock[],
  make: (c: RichTextInline[]) => RichTextBlock
): void {
  let run: RichTextInline[] = [];
  const flush = () => {
    const c = tidy(run, true);
    run = [];
    if (c.length) out.push(make(c));
  };
  const sink: InlineSink = { push: (n) => run.push(n) };
  const hoist = (el: DomNode) => {
    flush();
    blockElement(el, depth, out);
  };
  for (const n of nodes) collectInline(n, [], sink, hoist, false);
  flush();
}

const paragraph = (c: RichTextInline[]): RichTextBlock => ({ t: 'p', c });

function blocks(nodes: DomNode[], depth: number): RichTextBlock[] {
  const out: RichTextBlock[] = [];
  flow(nodes, depth, out, paragraph);
  return out;
}

function imageBlock(el: DomNode, caption: RichTextInline[] | null): RichTextBlock | null {
  const src = richTextImageSrc(el.attribs?.src);
  if (!src) return null;
  const node: Extract<RichTextBlock, { t: 'img' }> = {
    t: 'img',
    src,
    alt: el.attribs?.alt ?? '',
  };
  const width = dimension(el.attribs?.width);
  const height = dimension(el.attribs?.height);
  if (width !== undefined) node.width = width;
  if (height !== undefined) node.height = height;
  if (caption && caption.length) node.caption = caption;
  return node;
}

/** The first element named `name` under `nodes`, and the direct child holding it. */
function findDescendant(
  nodes: DomNode[],
  name: string,
  skip: string | null
): { el: DomNode; top: DomNode } | null {
  for (const top of nodes) {
    if (!isElement(top)) continue;
    if (top.name === name) return { el: top, top };
    if (skip && top.name === skip) continue;
    const found = findDescendant(top.children ?? [], name, skip);
    if (found) return { el: found.el, top };
  }
  return null;
}

function figure(el: DomNode, depth: number, out: RichTextBlock[]): void {
  const children = el.children ?? [];
  const img = findDescendant(children, 'img', 'figcaption');
  if (!img) {
    flow(children, depth, out, paragraph);
    return;
  }
  const cap = children.find((c) => isElement(c) && c.name === 'figcaption') ?? null;
  let caption: RichTextInline[] | null = null;
  if (cap) {
    const inner: RichTextInline[] = [];
    const sink: InlineSink = { push: (n) => inner.push(n) };
    for (const c of cap.children ?? []) collectInline(c, [], sink, null, false);
    caption = tidy(inner, true);
  }
  // An image that fails the source rule goes with its caption.
  const node = imageBlock(img.el, caption);
  if (node) out.push(node);
  const rest = children.filter((c) => c !== img.top && c !== cap);
  if (img.top !== img.el) {
    // The image sat inside a wrapper: keep the wrapper's other content.
    const wrapperRest = (img.top.children ?? []).filter((c) => c !== img.el);
    flow(wrapperRest, depth, out, paragraph);
  }
  flow(rest, depth, out, paragraph);
}

function blockElement(el: DomNode, depth: number, out: RichTextBlock[]): void {
  const name = el.name ?? '';
  const children = el.children ?? [];
  switch (name) {
    case 'p':
    case 'li':
    case 'figcaption':
      flow(children, depth, out, paragraph);
      return;
    case 'h2':
    case 'h3':
    case 'h4': {
      const level = Number(name[1]) as 2 | 3 | 4;
      flow(children, depth, out, (c) => ({ t: 'h', level, c }));
      return;
    }
    case 'ul':
    case 'ol': {
      if (depth >= RICH_TEXT_MAX_DEPTH) {
        out.push(...textParagraph(domText([el])));
        return;
      }
      const items: RichTextBlock[][] = [];
      let loose: DomNode[] = [];
      const flushLoose = () => {
        if (loose.length && domText(loose)) items.push(blocks(loose, depth + 1));
        loose = [];
      };
      for (const c of children) {
        if (isElement(c) && c.name === 'li') {
          flushLoose();
          items.push(blocks(c.children ?? [], depth + 1));
        } else {
          loose.push(c);
        }
      }
      flushLoose();
      if (items.length) out.push({ t: name, items });
      return;
    }
    case 'blockquote': {
      if (depth >= RICH_TEXT_MAX_DEPTH) {
        out.push(...textParagraph(domText([el])));
        return;
      }
      const inner = blocks(children, depth + 1);
      if (inner.length) out.push({ t: 'quote', children: inner });
      return;
    }
    case 'pre': {
      const parts: string[] = [];
      const walk = (n: DomNode) => {
        if (n.type === 'text') parts.push(n.data ?? '');
        else if (isElement(n) && !DROPPED_TAGS.has(n.name ?? '')) {
          if (n.name === 'br') parts.push('\n');
          else for (const c of n.children ?? []) walk(c);
        }
      };
      for (const c of children) walk(c);
      // As an HTML parser does, a newline straight after <pre> is not content.
      const text = parts.join('').replace(/^\r?\n/, '');
      if (text) out.push({ t: 'code', text });
      return;
    }
    case 'hr':
      out.push({ t: 'hr' });
      return;
    case 'img': {
      const node = imageBlock(el, null);
      if (node) out.push(node);
      return;
    }
    case 'figure':
      figure(el, depth, out);
      return;
    default:
      flow(children, depth, out, paragraph);
  }
}

// ============================================================
// Pass 2: the node limit
// ============================================================

function countInlines(nodes: RichTextInline[]): number {
  let n = 0;
  for (const node of nodes) n += 1 + (node.t === 'a' ? countInlines(node.c) : 0);
  return n;
}

function countBlocks(nodes: RichTextBlock[]): number {
  let n = 0;
  for (const node of nodes) {
    n += 1;
    if (node.t === 'p' || node.t === 'h') n += countInlines(node.c);
    else if (node.t === 'ul' || node.t === 'ol')
      for (const item of node.items) n += countBlocks(item);
    else if (node.t === 'quote') n += countBlocks(node.children);
    else if (node.t === 'img' && node.caption) n += countInlines(node.caption);
  }
  return n;
}

function inlineText(nodes: RichTextInline[], parts: string[]): void {
  for (const node of nodes) {
    if (node.t === 'text') parts.push(node.text);
    else if (node.t === 'br') parts.push(' ');
    else inlineText(node.c, parts);
  }
}

function blockText(node: RichTextBlock, parts: string[]): void {
  parts.push(' ');
  if (node.t === 'p' || node.t === 'h') inlineText(node.c, parts);
  else if (node.t === 'ul' || node.t === 'ol')
    for (const item of node.items) for (const b of item) blockText(b, parts);
  else if (node.t === 'quote') for (const b of node.children) blockText(b, parts);
  else if (node.t === 'code') parts.push(node.text);
  else if (node.t === 'img' && node.caption) inlineText(node.caption, parts);
  parts.push(' ');
}

interface Budget {
  left: number;
  cut: boolean;
  tail: string[];
}

function take(budget: Budget): boolean {
  if (budget.cut || budget.left < 1) {
    budget.cut = true;
    return false;
  }
  budget.left -= 1;
  return true;
}

function keepInlines(nodes: RichTextInline[], budget: Budget): RichTextInline[] {
  const out: RichTextInline[] = [];
  for (const node of nodes) {
    if (!take(budget)) {
      inlineText([node], budget.tail);
      continue;
    }
    if (node.t !== 'a') {
      out.push(node);
      continue;
    }
    const c = keepInlines(node.c, budget);
    if (c.length) out.push({ ...node, c });
  }
  return out;
}

function keepBlocks(nodes: RichTextBlock[], budget: Budget): RichTextBlock[] {
  const out: RichTextBlock[] = [];
  for (const node of nodes) {
    if (!take(budget)) {
      blockText(node, budget.tail);
      continue;
    }
    // A container the cut emptied goes; its text is already in the tail.
    if (node.t === 'p' || node.t === 'h') {
      const c = keepInlines(node.c, budget);
      if (c.length) out.push({ ...node, c });
    } else if (node.t === 'ul' || node.t === 'ol') {
      const items: RichTextBlock[][] = [];
      for (const item of node.items) {
        const before = budget.cut;
        const kept = keepBlocks(item, budget);
        // An item that was empty to begin with stays only if it came before the cut.
        if (kept.length || (item.length === 0 && !before)) items.push(kept);
      }
      if (items.length) out.push({ ...node, items });
    } else if (node.t === 'quote') {
      const children = keepBlocks(node.children, budget);
      if (children.length) out.push({ ...node, children });
    } else if (node.t === 'img' && node.caption) {
      const caption = keepInlines(node.caption, budget);
      const image = { ...node };
      if (caption.length) image.caption = caption;
      else delete image.caption;
      out.push(image);
    } else {
      out.push(node);
    }
  }
  return out;
}

function limitNodes(children: RichTextBlock[]): RichTextBlock[] {
  if (countBlocks(children) <= RICH_TEXT_MAX_NODES) return children;
  // Two nodes stay free for the trailing paragraph and its text.
  const budget: Budget = { left: RICH_TEXT_MAX_NODES - 2, cut: false, tail: [] };
  const kept = keepBlocks(children, budget);
  return [...kept, ...textParagraph(collapse(budget.tail.join('')).trim())];
}

// ============================================================
// Entry point
// ============================================================

/**
 * The node tree of already-sanitised rich-text HTML. Never throws; empty or
 * unparseable input gives an empty document.
 */
export function toRichTextNodes(sanitizedHtml: string): RichTextDoc {
  if (typeof sanitizedHtml !== 'string' || !sanitizedHtml) return { v: 1, children: [] };
  const doc = parseDocument(sanitizedHtml) as unknown as DomNode;
  const children = blocks(doc.children ?? [], 1);
  return { v: 1, children: limitNodes(children) };
}

/** Nodes in a tree, as the limit counts them (the root is not counted). */
export function countRichTextNodes(doc: RichTextDoc): number {
  return countBlocks(doc.children);
}
