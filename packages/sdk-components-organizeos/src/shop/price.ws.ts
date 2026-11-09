import type { WsComponentMeta } from "@webstudio-is/sdk";
import { span } from "@webstudio-is/sdk/normalize.css";

// The product card binds both props to the product (shop/product-card.template.tsx).
export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Price",
  contentModel: {
    category: "instance",
    children: [],
  },
  presetStyle: { span },
  initialProps: ["id", "class", "cents", "currency"],
  props: {
    cents: {
      type: "number",
      control: "number",
      required: false,
      label: "Cents",
    },
    currency: {
      type: "string",
      control: "text",
      required: false,
      label: "Currency",
      defaultValue: "USD",
    },
  },
};
