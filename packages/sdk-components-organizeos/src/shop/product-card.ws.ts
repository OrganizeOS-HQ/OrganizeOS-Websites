import type { WsComponentMeta } from "@webstudio-is/sdk";
import { div } from "@webstudio-is/sdk/normalize.css";

// Product is drawn by the builder's OrganizeOS controls, which write the
// card's own Resource, never the prop (organizeos-controls.tsx).
export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Product Card",
  contentModel: {
    category: "instance",
    children: ["instance"],
  },
  presetStyle: { div },
  initialProps: ["id", "class", "product"],
  props: {
    product: {
      type: "string",
      control: "text",
      required: false,
      label: "Product",
    },
  },
};
