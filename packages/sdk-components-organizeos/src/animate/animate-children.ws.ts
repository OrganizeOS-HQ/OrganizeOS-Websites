import { AnimationGroupIcon } from "@webstudio-is/icons/svg";
import type { WsComponentMeta } from "@webstudio-is/sdk";

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Animate Children",
  description: "Animates each child on scroll",
  icon: AnimationGroupIcon,
  contentModel: {
    category: "instance",
    children: ["instance"],
  },
  // a wrapper that keeps the layout of what it wraps (spec decision 7)
  presetStyle: {
    div: [
      { property: "display", value: { type: "keyword", value: "contents" } },
    ],
  },
  // The animationAction prop among initialProps is what shows upstream's
  // Animation section, which replaces the props panel; Stagger is edited in
  // the OrganizeOS panel's Motion area (spec 14.11).
  initialProps: ["action"],
  props: {
    action: {
      type: "animationAction",
      control: "animationAction",
      required: false,
      description: "The animation each child plays.",
    },
    stagger: {
      type: "number",
      control: "number",
      required: false,
      defaultValue: 0,
      label: "Stagger",
      description:
        "Percent of the range between one child's start and the next, from 0 to 20; 0 is off.",
    },
  },
};
