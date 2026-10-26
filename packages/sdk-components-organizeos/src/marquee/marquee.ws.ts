import { ArrowRightLeftIcon } from "@webstudio-is/icons/svg";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import { div } from "@webstudio-is/sdk/normalize.css";

const namespaced = (name: string) => `@organizeos/site-components:${name}`;

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Marquee",
  description:
    "Drifts its track's items in a loop on the published page, behind its Pause button. Never on the canvas or under reduced motion, and it stops for good when keyboard focus enters the track.",
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
      description: "Pixels per second, from 10 to 200.",
    },
    direction: {
      type: "string",
      control: "radio",
      required: false,
      options: ["left", "right"],
      label: "Direction",
      description:
        "Which way the items drift. Unset, they drift left, or right on a right-to-left page.",
    },
  },
};
