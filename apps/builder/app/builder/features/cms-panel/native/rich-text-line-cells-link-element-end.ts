// The cells of `base-link-element-end` (Task 5 Step 6; T11.7, check 5,
// 16.11): the Link command over a range with an element-point end beside a
// trailing or leading link. Generated as check 5's keys lens generates them
// (`item1Cells("link", ["linkBtn"])` of the keys probe's cells1.ts): 13
// templates, the other end in the same line, the next or previous block or
// another item, each forward and backward. The fixture's cells are the
// lined cells where `451f20f04` throws and the ordinary cells where `<base>`
// throws (`LINK_ELEMENT_END_IDS`). It imports nothing from the line modules,
// so the same file records the fixture at fork main.
import { act } from "react-dom/test-utils";
import { expect } from "vitest";
import {
  $createRangeSelection,
  $getRoot,
  $isElementNode,
  $isTextNode,
  $setSelection,
  type LexicalNode,
} from "lexical";
import { click, editable, editorOf, settle } from "./rich-text-test-harness";
import { LI, type Step } from "./rich-text-line-test-kit";

const LINK = `<a href="https://example.org/l">Lw</a>`;

/** A text point (`word` at `offset`) or the element point beside the link. */
export type End = { word: string; offset: number | "end" } | "link";

type Template = {
  name: string;
  side: "after" | "before";
  lined: boolean;
  html: string;
  others: Partial<Record<"same" | "next" | "prev" | "other", End>>;
};

const tp = (word: string, offset = 1): End => ({ word, offset });

const TEMPLATES: Template[] = [
  {
    name: "BLend",
    side: "after",
    lined: true,
    html: LI(
      `<blockquote><p>Q0w</p></blockquote>T1w${LINK}<blockquote><p>Q2w</p></blockquote>`
    ),
    others: { same: tp("T1w"), next: tp("Q2w"), other: tp("Nw") },
  },
  {
    name: "BLtrail",
    side: "after",
    lined: true,
    html: LI(`<blockquote><p>Q0w</p></blockquote>T1w${LINK}`),
    others: { same: tp("T1w"), prev: tp("Q0w"), other: tp("Nw") },
  },
  {
    name: "BLstart",
    side: "before",
    lined: true,
    html: LI(
      `<blockquote><p>Q0w</p></blockquote>${LINK}T1w<blockquote><p>Q2w</p></blockquote>`
    ),
    others: { same: tp("T1w"), prev: tp("Q0w"), other: tp("Pw") },
  },
  {
    name: "LLend",
    side: "after",
    lined: true,
    html: LI(`T1w${LINK}<blockquote><p>Q2w</p></blockquote>T3w`),
    others: { same: tp("T1w"), next: tp("Q2w"), other: tp("Nw") },
  },
  {
    name: "LLstart",
    side: "before",
    lined: true,
    html: LI(`T0w<blockquote><p>Q1w</p></blockquote>${LINK}T2w`),
    others: { same: tp("T2w"), prev: tp("Q1w"), other: tp("Pw") },
  },
  {
    name: "ULend",
    side: "after",
    lined: false,
    html: `<ul><li>Pw</li><li>T1w${LINK}</li><li>Nw</li></ul>`,
    others: { same: tp("T1w"), next: tp("Nw"), other: tp("Nw", 1) },
  },
  {
    name: "ULstart",
    side: "before",
    lined: false,
    html: `<ul><li>Pw</li><li>${LINK}T1w</li><li>Nw</li></ul>`,
    others: { same: tp("T1w"), prev: tp("Pw"), other: tp("Pw", 1) },
  },
  {
    name: "RPend",
    side: "after",
    lined: false,
    html: `<p>A0w</p><p>T1w${LINK}</p><blockquote><p>Q2w</p></blockquote>`,
    others: {
      same: tp("T1w"),
      next: tp("Q2w"),
      prev: tp("A0w"),
      other: tp("A0w"),
    },
  },
  {
    name: "RPstart",
    side: "before",
    lined: false,
    html: `<p>A0w</p><p>${LINK}T1w</p><p>B2w</p>`,
    others: {
      same: tp("T1w"),
      prev: tp("A0w"),
      next: tp("B2w"),
      other: tp("B2w"),
    },
  },
  {
    name: "RHend",
    side: "after",
    lined: false,
    html: `<p>A0w</p><h3>T1w${LINK}</h3><p>B2w</p>`,
    others: {
      same: tp("T1w"),
      next: tp("B2w"),
      prev: tp("A0w"),
      other: tp("A0w"),
    },
  },
  {
    name: "RHstart",
    side: "before",
    lined: false,
    html: `<p>A0w</p><h3>${LINK}T1w</h3><p>B2w</p>`,
    others: {
      same: tp("T1w"),
      prev: tp("A0w"),
      next: tp("B2w"),
      other: tp("B2w"),
    },
  },
  {
    name: "RQend",
    side: "after",
    lined: false,
    html: `<p>A0w</p><blockquote><p>T1w${LINK}</p></blockquote><p>B2w</p>`,
    others: {
      same: tp("T1w"),
      next: tp("B2w"),
      prev: tp("A0w"),
      other: tp("A0w"),
    },
  },
  {
    name: "RQstart",
    side: "before",
    lined: false,
    html: `<p>A0w</p><blockquote><p>${LINK}T1w</p></blockquote><p>B2w</p>`,
    others: {
      same: tp("T1w"),
      prev: tp("A0w"),
      next: tp("B2w"),
      other: tp("B2w"),
    },
  },
];

const $all = () => {
  const out: LexicalNode[] = [];
  const walk = (node: LexicalNode) => {
    out.push(node);
    if ($isElementNode(node)) {
      node.getChildren().forEach(walk);
    }
  };
  walk($getRoot());
  return out;
};

/**
 * Where `end` is: a text point, or for `"link"` the element point directly
 * after (or before) the first link, on its parent; with `asText` the link's
 * own text edge on the same side.
 */
const $point = (end: End, side: "after" | "before", asText: boolean) => {
  if (end === "link") {
    const link = $all().find((node) => node.getType() === "link");
    expect(link, "the link").toBeDefined();
    if (asText) {
      const text = $isElementNode(link)
        ? side === "after"
          ? link.getLastDescendant()
          : link.getFirstDescendant()
        : null;
      expect($isTextNode(text), "the link's text").toBe(true);
      return {
        key: text!.getKey(),
        offset: side === "after" ? text!.getTextContentSize() : 0,
        type: "text" as const,
      };
    }
    return {
      key: link!.getParentOrThrow().getKey(),
      offset: link!.getIndexWithinParent() + (side === "after" ? 1 : 0),
      type: "element" as const,
    };
  }
  const text = $all().find(
    (node) => $isTextNode(node) && node.getTextContent() === end.word
  );
  expect(text, end.word).toBeDefined();
  return {
    key: text!.getKey(),
    offset: end.offset === "end" ? text!.getTextContentSize() : end.offset,
    type: "text" as const,
  };
};

/** The range from `anchor` to `focus`, set directly after a real click. */
const rangeOf =
  (anchor: End, focus: End, side: "after" | "before", asText: boolean): Step =>
  async () => {
    await click(editable());
    await act(async () => {
      editorOf()!.update(() => {
        const from = $point(anchor, side, asText);
        const to = $point(focus, side, asText);
        const selection = $createRangeSelection();
        selection.anchor.set(from.key, from.offset, from.type);
        selection.focus.set(to.key, to.offset, to.type);
        $setSelection(selection);
      });
    });
    await settle();
  };

export type LinkCell = {
  id: string;
  lined: boolean;
  stored: string;
  /** the range with its element-point end */
  place: Step;
  /** the same range with the link's text edge in place of that end */
  textPlace: Step;
};

/** Every cell of the generator: 30 lined, 60 ordinary. */
export const linkCells = (): LinkCell[] => {
  const cells: LinkCell[] = [];
  for (const template of TEMPLATES) {
    for (const [name, other] of Object.entries(template.others)) {
      for (const direction of ["fwd", "bwd"] as const) {
        const [anchor, focus]: [End, End] =
          direction === "fwd" ? [other, "link"] : ["link", other];
        cells.push({
          id: `link|${template.name}|${name}|${direction}|linkBtn`,
          lined: template.lined,
          stored: template.html,
          place: rangeOf(anchor, focus, template.side, false),
          textPlace: rangeOf(anchor, focus, template.side, true),
        });
      }
    }
  }
  return cells;
};

/**
 * The fixture's cells: the lined cells where `451f20f04` throws (10: check
 * 5 counts 8, leaving out the two `BLtrail|other` cells, which throw at
 * `<base>` too) and the ordinary cells where `<base>` throws (12), each
 * measured with the toolbar's Link (Task 19 Step 1b).
 */
export const LINK_ELEMENT_END_IDS: readonly string[] = [
  ...[
    "BLend|next",
    "BLend|other",
    "BLtrail|other",
    "LLend|next",
    "LLend|other",
  ],
  ...["ULend|next", "ULend|other", "RPend|next", "RHend|next", "RQend|next"],
].flatMap((cell) =>
  (["fwd", "bwd"] as const).map(
    (direction) => `link|${cell}|${direction}|linkBtn`
  )
);

/** The fixture's cells, in the generator's order. */
export const linkElementEndCells = () =>
  linkCells().filter((cell) => LINK_ELEMENT_END_IDS.includes(cell.id));
