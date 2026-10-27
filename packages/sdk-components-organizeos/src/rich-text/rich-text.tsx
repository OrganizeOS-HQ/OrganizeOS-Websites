import {
  Fragment,
  forwardRef,
  useContext,
  useMemo,
  type ComponentProps,
  type ElementRef,
  type ReactNode,
} from "react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { safeImageSrc, safeLinkHref } from "../shared/safe-href";
import { richTextSample } from "./sample";

/**
 * Rich Text (OrganizeOS design
 * `docs/superpowers/specs/2026-10-26-cms-in-the-builder-design.md` section
 * 4.7): renders the `nodes` tree `/v1/collections*` sends beside a rich-text
 * value's `html` and `text` as React elements, never as markup. The format,
 * version 1, is the platform's (`client/lib/collections/rich-text-nodes.ts`)
 * and is pinned by the shared fixture `__fixtures__/rich-text.json`.
 *
 * A published site freezes this code while `/v1` can change, so the tree is
 * checked again here with the platform's rules: a node of a kind this build
 * does not know renders nothing, a link whose address fails `safeLinkHref`
 * renders its text, an image whose source is not `https:` is left out, a
 * quote or list nested past the depth limit renders nothing, and rendering
 * stops after the node limit. Text is React text, so it is escaped.
 *
 * Styled like upstream's Markdown Embed: the root is a `div` (`display:
 * contents` in its preset) that takes the canvas's and the page's props, and
 * `ws:descendant` instances style the tags it renders.
 */

/** Deepest block nesting: top-level blocks are at depth 1. */
export const richTextMaxDepth = 8;

/** Most nodes rendered (blocks and inlines; the root is not counted). */
export const richTextMaxNodes = 5000;

type Budget = { left: number };

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

/** Takes one node from the budget; false once it is spent. */
const take = (budget: Budget) => {
  if (budget.left < 1) {
    return false;
  }
  budget.left -= 1;
  return true;
};

const markTags = {
  b: "strong",
  i: "em",
  u: "u",
  s: "s",
  code: "code",
} as const;

/** Outermost first, the platform's mark order. */
const markOrder = ["b", "i", "u", "s", "code"] as const;

const renderText = (node: Node, key: number): ReactNode => {
  if (typeof node.text !== "string") {
    return null;
  }
  const marks = Array.isArray(node.marks) ? node.marks : [];
  let content: ReactNode = node.text;
  for (const mark of [...markOrder].reverse()) {
    if (marks.includes(mark)) {
      const Tag = markTags[mark];
      content = <Tag>{content}</Tag>;
    }
  }
  return <Fragment key={key}>{content}</Fragment>;
};

const renderInlines = (
  nodes: unknown,
  budget: Budget,
  inLink: boolean
): ReactNode[] => {
  if (Array.isArray(nodes) === false) {
    return [];
  }
  const out: ReactNode[] = [];
  for (const [index, node] of nodes.entries()) {
    if (isNode(node) === false) {
      continue;
    }
    if (take(budget) === false) {
      break;
    }
    if (node.t === "text") {
      out.push(renderText(node, index));
    } else if (node.t === "br") {
      out.push(<br key={index} />);
    } else if (node.t === "a") {
      const content = renderInlines(node.c, budget, true);
      const href = safeLinkHref(node.href);
      // A link with a bad address, or one inside a link, is its text.
      if (href === undefined || inLink) {
        out.push(<Fragment key={index}>{content}</Fragment>);
      } else if (content.length > 0) {
        out.push(
          <a
            key={index}
            href={href}
            rel="noopener noreferrer"
            target={node.newTab === true ? "_blank" : undefined}
          >
            {content}
          </a>
        );
      }
    }
    // any other kind renders nothing
  }
  return out;
};

const dimension = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;

const renderImage = (node: Node, budget: Budget, key: number): ReactNode => {
  const src = safeImageSrc(node.src);
  if (src === undefined) {
    return null;
  }
  const image = (
    <img
      src={src}
      alt={typeof node.alt === "string" ? node.alt : ""}
      width={dimension(node.width)}
      height={dimension(node.height)}
      loading="lazy"
    />
  );
  const caption = renderInlines(node.caption, budget, false);
  if (caption.length === 0) {
    return <Fragment key={key}>{image}</Fragment>;
  }
  return (
    <figure key={key}>
      {image}
      <figcaption>{caption}</figcaption>
    </figure>
  );
};

const headingTags = { 2: "h2", 3: "h3", 4: "h4" } as const;

const renderBlocks = (
  nodes: unknown,
  depth: number,
  budget: Budget
): ReactNode[] => {
  if (Array.isArray(nodes) === false) {
    return [];
  }
  const out: ReactNode[] = [];
  for (const [index, node] of nodes.entries()) {
    if (isNode(node) === false) {
      continue;
    }
    if (take(budget) === false) {
      break;
    }
    switch (node.t) {
      case "p":
        out.push(<p key={index}>{renderInlines(node.c, budget, false)}</p>);
        break;
      case "h": {
        const Tag =
          node.level === 2 || node.level === 3 || node.level === 4
            ? headingTags[node.level]
            : undefined;
        if (Tag !== undefined) {
          out.push(
            <Tag key={index}>{renderInlines(node.c, budget, false)}</Tag>
          );
        }
        break;
      }
      case "ul":
      case "ol": {
        if (depth >= richTextMaxDepth || Array.isArray(node.items) === false) {
          break;
        }
        const List = node.t;
        const items: ReactNode[] = [];
        for (const [itemIndex, item] of node.items.entries()) {
          if (Array.isArray(item) === false) {
            continue;
          }
          items.push(
            <li key={itemIndex}>{renderBlocks(item, depth + 1, budget)}</li>
          );
        }
        out.push(<List key={index}>{items}</List>);
        break;
      }
      case "quote":
        if (depth < richTextMaxDepth) {
          out.push(
            <blockquote key={index}>
              {renderBlocks(node.children, depth + 1, budget)}
            </blockquote>
          );
        }
        break;
      case "code":
        if (typeof node.text === "string") {
          out.push(
            <pre key={index}>
              <code>{node.text}</code>
            </pre>
          );
        }
        break;
      case "hr":
        out.push(<hr key={index} />);
        break;
      case "img":
        out.push(renderImage(node, budget, index));
        break;
      // any other kind renders nothing
    }
  }
  return out;
};

/**
 * The blocks of a rich-text value: the version 1 root `{ v: 1, children }`,
 * or a whole rich-text value `{ html, text, nodes }` bound by mistake in
 * place of its `nodes`. Anything else is undefined.
 */
const readBlocks = (value: unknown): undefined | unknown[] => {
  const root = isNode(value) && value.v === undefined ? value.nodes : value;
  if (isNode(root) && root.v === 1 && Array.isArray(root.children)) {
    return root.children;
  }
};

/** The React elements of a rich-text value; nothing for one it cannot read. */
export const renderRichText = (value: unknown): ReactNode[] => {
  const blocks = readBlocks(value);
  if (blocks === undefined) {
    return [];
  }
  return renderBlocks(blocks, 1, { left: richTextMaxNodes });
};

type RichTextProps = Omit<ComponentProps<"div">, "children"> & {
  value?: unknown;
  /** Ignored: the descendants the builder places only style the tree. */
  children?: ReactNode;
};

export const RichText = forwardRef<ElementRef<"div">, RichTextProps>(
  ({ value, children: _children, ...rest }, ref) => {
    const { renderer } = useContext(ReactSdkContext);
    // On the canvas, a Rich Text with no value yet (placed, not bound, or
    // its item still loading) shows a sample a designer can style.
    const shown =
      renderer === "canvas" && (value === undefined || value === null)
        ? richTextSample
        : value;
    const content = useMemo(() => renderRichText(shown), [shown]);
    return (
      <div {...rest} ref={ref}>
        {content}
      </div>
    );
  }
);

RichText.displayName = "RichText";
