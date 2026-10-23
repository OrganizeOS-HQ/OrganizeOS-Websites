import { CheckboxCheckedIcon } from "@webstudio-is/icons/svg";
import { descendantComponent, type WsComponentMeta } from "@webstudio-is/sdk";
import { div } from "@webstudio-is/sdk/normalize.css";

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Shift Options",
  description:
    "Lets a visitor pick the event's shifts and, for a single shift, a role. Shows nothing for an event with no shifts.",
  icon: CheckboxCheckedIcon,
  // The checkboxes and the role buttons are the part's own; ws:descendant
  // instances style them through their selectors.
  contentModel: {
    category: "none",
    children: [descendantComponent],
  },
  states: [
    { label: "Full", selector: "[data-full]" },
    { label: "Invalid", selector: "[data-invalid]" },
  ],
  presetStyle: { div },
  initialProps: ["id", "class"],
};
