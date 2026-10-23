import { HelpIcon } from "@webstudio-is/icons/svg";
import { descendantComponent, type WsComponentMeta } from "@webstudio-is/sdk";
import { div } from "@webstudio-is/sdk/normalize.css";

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Questions",
  description:
    "Asks the event's registration questions, each with a control for its type. Shows nothing for an event with no questions.",
  icon: HelpIcon,
  // The controls are the part's own; ws:descendant instances style them
  // through their selectors.
  contentModel: {
    category: "none",
    children: [descendantComponent],
  },
  states: [{ label: "Invalid", selector: "[data-invalid]" }],
  presetStyle: { div },
  initialProps: ["id", "class"],
};
