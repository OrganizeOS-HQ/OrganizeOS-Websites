import { ws, type TemplateMeta } from "@webstudio-is/template";
import { organizeos } from "../shared/proxy";
import { meta as richTextMeta } from "./rich-text.ws";

/**
 * Rich Text (OrganizeOS design section 4.7): the root and one `ws:descendant`
 * per element it renders, so a designer styles each tag once for the block.
 * The CSS generator appends a descendant's selector to the root's class as it
 * stands, so each selector names one tag; a selector naming several would sit
 * inside `:where()`, or it would style matching elements across the page.
 * `value` is left unbound: a designer binds it to an item's field inside a
 * collection, and the insert binds nothing.
 */
export const descendants = [
  ["Paragraph", " p"],
  ["Heading 2", " h2"],
  ["Heading 3", " h3"],
  ["Heading 4", " h4"],
  ["Bulleted List", " ul"],
  ["Numbered List", " ol"],
  ["List Item", " li"],
  ["Link", " a"],
  ["Blockquote", " blockquote"],
  ["Code Block", " pre"],
  ["Code Text", " code"],
  ["Separator", " hr"],
  ["Image", " img"],
  ["Figure", " figure"],
  ["Caption", " figcaption"],
  ["Bold", " strong"],
  ["Italic", " em"],
] as const;

export const meta: TemplateMeta = {
  category: "hidden",
  label: richTextMeta.label,
  description: richTextMeta.description,
  icon: richTextMeta.icon,
  template: (
    <organizeos.RichText>
      {descendants.map(([label, selector]) => (
        <ws.descendant key={selector} ws:label={label} selector={selector} />
      ))}
    </organizeos.RichText>
  ),
};
