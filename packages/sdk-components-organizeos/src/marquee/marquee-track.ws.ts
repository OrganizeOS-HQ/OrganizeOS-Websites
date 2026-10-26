import { RepeatRowIcon } from "@webstudio-is/icons/svg";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import { div } from "@webstudio-is/sdk/normalize.css";

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Marquee Track",
  description:
    "Holds the Marquee's items, in a row, and is the part that moves. Copies of the items follow them on the published page, hidden from assistive technology and the keyboard.",
  icon: RepeatRowIcon,
  contentModel: {
    category: "none",
    children: ["instance"],
  },
  presetStyle: { div },
  initialProps: ["id", "class"],
};
