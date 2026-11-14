// A copy of the OrganizeOS platform's rich-text sanitiser
// (client/lib/collections/rich-text.ts, from RICH_TEXT_ALLOWED_TAGS through
// sanitizeRichTextHtml), with its comment lines left out. The native CMS's
// read-only check runs a value through it as the platform stores it. Kept
// identical to the platform's by the round-trip fixture's pins
// (rich-text-roundtrip.json, `pins`), which both repositories test.

import sanitizeHtml from 'sanitize-html';

export const RICH_TEXT_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'a',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'code',
  'pre',
  'hr',
  'img',
  'figure',
  'figcaption',
];

export const RICH_TEXT_ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'width',
  'height',
  'title',
];

export const RICH_TEXT_MAX_HTML = 200_000;

const LINK_SCHEMES = ['http', 'https', 'mailto', 'tel'];

const IMAGE_SCHEMES = ['http', 'https'];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: RICH_TEXT_ALLOWED_TAGS,
  allowedAttributes: { '*': RICH_TEXT_ALLOWED_ATTR },
  allowedSchemes: LINK_SCHEMES,
  allowedSchemesByTag: { img: IMAGE_SCHEMES },
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: true,
  transformTags: {
    a: (tagName, attribs) =>
      (attribs.target ?? '').toLowerCase() === '_blank' && !attribs.rel
        ? { tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } }
        : { tagName, attribs },
  },
  exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
};

export function sanitizeRichTextHtml(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
