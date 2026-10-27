import type { WsComponentMeta } from "@webstudio-is/sdk";
import { div } from "@webstudio-is/sdk/normalize.css";

// No props of its own: every prop a designer sets passes through to the div.
export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Share Code Carrier",
  description:
    "Carries a visitor's share code (?r=) to the organization's donate, events, join and shop pages when a link inside it is clicked on the published site.",
  contentModel: {
    category: "instance",
    children: ["instance"],
  },
  presetStyle: { div },
  initialProps: ["id", "class"],
};
