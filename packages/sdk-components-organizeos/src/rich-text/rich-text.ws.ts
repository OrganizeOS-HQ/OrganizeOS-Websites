import { DescriptionIcon } from "@webstudio-is/icons/svg";
import { descendantComponent, type WsComponentMeta } from "@webstudio-is/sdk";

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Rich Text",
  description: "A collection item's rich text",
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
      description: "A rich-text field's nodes",
    },
  },
};
