import type { WsComponentMeta } from "@webstudio-is/sdk";
import { div } from "@webstudio-is/sdk/normalize.css";

// Show is drawn by the builder's OrganizeOS controls, which write the block's
// collection data, never the prop (organizeos-controls.tsx).
export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Product Grid",
  contentModel: {
    category: "instance",
    children: ["instance"],
  },
  presetStyle: { div },
  initialProps: ["id", "class", "show", "columns"],
  props: {
    columns: {
      type: "string",
      control: "select",
      required: false,
      label: "Columns",
      options: ["2", "3", "4"],
      defaultValue: "3",
    },
    show: {
      type: "string",
      control: "select",
      required: false,
      label: "Show",
      options: ["3", "4", "6", "8", "12", "All"],
    },
  },
};
