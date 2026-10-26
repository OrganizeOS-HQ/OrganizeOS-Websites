import { PlayIcon } from "@webstudio-is/icons/svg";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import { button } from "@webstudio-is/sdk/normalize.css";

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Rotation Control",
  description:
    "The Pause and Play button of Rotating Tabs. It rotates the tabs on the published page, and never on the canvas or under reduced motion.",
  icon: PlayIcon,
  contentModel: {
    category: "instance",
    children: [],
  },
  presetStyle: { button },
  initialProps: ["id", "class", "interval", "fade", "pauseLabel", "playLabel"],
  props: {
    interval: {
      type: "number",
      control: "number",
      required: false,
      defaultValue: 5.5,
      label: "Interval",
      description:
        "Seconds each tab shows before the next, from 3 to 20. Rotation stops for good when a visitor moves focus into the section or picks a tab.",
    },
    fade: {
      type: "number",
      control: "number",
      required: false,
      defaultValue: 250,
      label: "Fade",
      description:
        "Milliseconds the incoming panel fades in, from 0 to 600; 0 switches at once. Never under reduced motion.",
    },
    pauseLabel: {
      type: "string",
      control: "text",
      required: false,
      defaultValue: "Pause",
      label: "Pause label",
      description: "The button's text while the tabs rotate.",
    },
    playLabel: {
      type: "string",
      control: "text",
      required: false,
      defaultValue: "Play",
      label: "Play label",
      description: "The button's text once rotation has stopped.",
    },
    value: {
      type: "string",
      control: "text",
      required: false,
      description:
        "The selected tab, bound to the same variable as the Tabs' value.",
    },
    onValueChange: {
      type: "action",
      control: "action",
      required: false,
      description: "Sets that variable to the next tab's value.",
    },
  },
};
