import { cloneElement } from "react";
import { ws } from "@webstudio-is/template";

// A Content Block (spec section 2, rule 3): a template's repeating items
// (cards, stats, people, questions) as the builder's "ws:block", so Simple
// mode can add, remove and reorder them. The block draws no element of its
// own, on the published site or the canvas, so its items are laid out by the
// element that holds it, as a grid's cells or a stack's rows.

const BlockTemplate = ws["block-template"];

/**
 * The block named `label` in the Navigator: `template` is the item a new one
 * starts from (it is never shown), then `items`, which a page shows. Each is
 * fresh JSX, like every shared piece.
 */
export const contentBlock = ({
  label,
  template,
  items,
}: {
  label: string;
  template: JSX.Element;
  items: JSX.Element[];
}): JSX.Element => (
  // One flat list, since the renderer does not flatten a nested array of
  // children; the keys only quiet React's list check.
  <ws.block ws:label={label}>
    {[
      <BlockTemplate key="template">{template}</BlockTemplate>,
      ...items.map((item, index) => cloneElement(item, { key: index })),
    ]}
  </ws.block>
);
