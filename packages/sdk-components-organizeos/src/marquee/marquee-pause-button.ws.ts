import { PlayIcon } from "@webstudio-is/icons/svg";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import { button } from "@webstudio-is/sdk/normalize.css";

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Marquee Pause Button",
  description:
    "The Pause and Play button of a Marquee, first in its tab order. Hidden while the marquee does not move.",
  icon: PlayIcon,
  contentModel: {
    category: "none",
    children: [],
  },
  presetStyle: { button },
  initialProps: ["id", "class", "pauseLabel", "playLabel"],
  props: {
    pauseLabel: {
      type: "string",
      control: "text",
      required: false,
      defaultValue: "Pause",
      label: "Pause label",
      description: "The button's text while the marquee moves.",
    },
    playLabel: {
      type: "string",
      control: "text",
      required: false,
      defaultValue: "Play",
      label: "Play label",
      description: "The button's text once the marquee has stopped.",
    },
  },
};
