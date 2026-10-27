import { ArrowRightLeftIcon } from "@webstudio-is/icons/svg";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import { div } from "@webstudio-is/sdk/normalize.css";

const namespaced = (name: string) => `@organizeos/site-components:${name}`;

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Marquee",
  description: "Drifts its items in a loop",
  icon: ArrowRightLeftIcon,
  contentModel: {
    category: "instance",
    children: [namespaced("MarqueePauseButton"), namespaced("MarqueeTrack")],
  },
  presetStyle: { div },
  initialProps: ["id", "class", "speed", "direction"],
  props: {
    speed: {
      type: "number",
      control: "number",
      required: false,
      defaultValue: 40,
      label: "Speed",
      description: "10–200 px/s",
    },
    direction: {
      type: "string",
      control: "radio",
      required: false,
      options: ["left", "right"],
      label: "Direction",
    },
  },
};
