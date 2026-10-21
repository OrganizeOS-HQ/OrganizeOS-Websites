import { ListIcon } from "@webstudio-is/icons/svg";
import { descendantComponent, type WsComponentMeta } from "@webstudio-is/sdk";
import { div } from "@webstudio-is/sdk/normalize.css";

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Guests",
  description:
    "Lets a visitor name the guests they bring, up to the event's allowance. Shows nothing for an event that takes no guests.",
  icon: ListIcon,
  // The inputs and buttons are the part's own; ws:descendant instances style
  // them through their selectors.
  contentModel: {
    category: "none",
    children: [descendantComponent],
  },
  states: [{ label: "Invalid", selector: "[data-invalid]" }],
  presetStyle: { div },
  initialProps: [
    "id",
    "class",
    "addLabel",
    "removeLabel",
    "firstNamePlaceholder",
    "lastNamePlaceholder",
  ],
  props: {
    addLabel: {
      type: "string",
      control: "text",
      required: false,
      defaultValue: "Add a guest",
      label: "Add button",
      description: "The text of the button that adds a guest.",
    },
    removeLabel: {
      type: "string",
      control: "text",
      required: false,
      defaultValue: "Remove",
      label: "Remove button",
      description: "The text of the button that removes a guest.",
    },
    firstNamePlaceholder: {
      type: "string",
      control: "text",
      required: false,
      defaultValue: "First name",
      label: "First name placeholder",
    },
    lastNamePlaceholder: {
      type: "string",
      control: "text",
      required: false,
      defaultValue: "Last name",
      label: "Last name placeholder",
    },
  },
};
