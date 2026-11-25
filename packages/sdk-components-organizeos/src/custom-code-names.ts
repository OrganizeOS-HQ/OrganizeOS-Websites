import {
  defaultTreeAdapter,
  parseFragment,
  type DefaultTreeAdapterMap,
} from "parse5";

/**
 * OrganizeOS fork: input validation for the site-wide custom code
 * (Settings > General) before it is compiled. Upstream's `htmlToJsx`
 * (packages/cli/src/html-to-jsx.ts) writes custom code into the home page's
 * module, which runs on the server, as JSX. It escapes text and attribute
 * values, but writes tag names and attribute names as parse5 read them, and an
 * HTML name may hold `{`, `}`, `(`, `"` and `.`. So a crafted name is code in
 * the sites' server functions (spec 2026-11-20-builder-code-embeds-design.md,
 * 4.4, in the OrganizeOS repo).
 *
 * Every tag name and attribute name must match this pattern: an ASCII letter,
 * then letters, digits, `_` and `-`, with at most one namespace colon between
 * two such parts. Each part is a JSXIdentifier and the pair a
 * JSXNamespacedName. `$`, a leading `_`, non-ASCII letters and `.` (which
 * would make a tag a JSXMemberExpression, a component reference) are valid in
 * some JSX names but left out on purpose.
 */
export const customCodeNamePattern =
  /^[A-Za-z][A-Za-z0-9_-]*(?::[A-Za-z][A-Za-z0-9_-]*)?$/;

type ParentNode = DefaultTreeAdapterMap["parentNode"];

// Walks exactly as htmlToJsx's walkChildNodes does: an element's childNodes
// only (so a `<template>`'s content, which htmlToJsx does not write, is not
// read), comments and text skipped, each element's tagName and each
// attribute's name (htmlToJsx writes attr.name, not a foreign prefix).
// eslint-disable-next-line func-style
function* readNames(node: ParentNode): IterableIterator<string> {
  for (const child of node.childNodes) {
    if (defaultTreeAdapter.isElementNode(child) === false) {
      continue;
    }
    yield child.tagName;
    for (const attribute of child.attrs) {
      yield attribute.name;
    }
    yield* readNames(child);
  }
}

/**
 * Reads custom code with the parser and options `htmlToJsx` uses (parse5
 * 7.3.0, `scriptingEnabled: false`) and refuses it when any tag or attribute
 * name is outside `customCodeNamePattern`, naming the first in document
 * order. Pure: the builder's Publish dialog and the CLI's prebuild both run it
 * on the exact string that would be compiled.
 */
export const checkCustomCodeNames = (
  code: string
): { ok: true } | { ok: false; name: string } => {
  const fragment = parseFragment(code, { scriptingEnabled: false });
  for (const name of readNames(fragment)) {
    if (customCodeNamePattern.test(name) === false) {
      return { ok: false, name };
    }
  }
  return { ok: true };
};
