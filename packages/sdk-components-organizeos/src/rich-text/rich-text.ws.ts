import { DescriptionIcon } from "@webstudio-is/icons/svg";
import { descendantComponent, type WsComponentMeta } from "@webstudio-is/sdk";

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Rich Text",
  description:
    "Shows a rich-text field of a collection item, such as a post's body: headings, paragraphs, lists, quotes, links and images. Bind its value to the field's nodes inside a collection.",
  icon: DescriptionIcon,
  // The tree is the component's own; ws:descendant instances style its tags
  // through their selectors, as upstream's Markdown Embed's do.
  contentModel: {
    category: "instance",
    children: [descendantComponent],
  },
  // The root lays out as its content, so the tree's blocks are the parent's
  // children for its layout. Styles set on the root itself draw no box.
  presetStyle: {
    div: [
      {
        property: "display",
        value: { type: "keyword", value: "contents" },
      },
    ],
  },
  initialProps: ["id", "class", "value"],
  props: {
    value: {
      type: "json",
      control: "json",
      required: false,
      label: "Value",
      description:
        "The rich text to show: a collection item's rich-text field, as its nodes (for example item.body.nodes). Without one, the canvas shows a sample to style and the live site shows nothing.",
    },
  },
};
