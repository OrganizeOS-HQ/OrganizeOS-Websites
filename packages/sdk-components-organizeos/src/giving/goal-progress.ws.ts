import { SliderIcon } from "@webstudio-is/icons/svg";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import { div } from "@webstudio-is/sdk/normalize.css";
import { organizeos } from "../shared/meta";

// Builder rows (organizeos-giving-controls.tsx): Give to draws `record`;
// `data` is bound at insert to the Fundraisers Resource and drawn by no row;
// Show donors keeps upstream's switch.
export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Goal Progress",
  description: "A fundraiser's raised and goal figures, with a bar.",
  icon: SliderIcon,
  contentModel: {
    category: "instance",
    children: ["instance"],
    descendants: [organizeos.GoalProgressFigure],
  },
  presetStyle: { div },
  initialProps: ["id", "class", "record", "showDonors"],
  props: {
    record: {
      type: "string",
      control: "text",
      required: false,
      label: "Give to",
    },
    data: {
      type: "json",
      control: "json",
      required: false,
      label: "Fundraisers data",
    },
    showDonors: {
      type: "boolean",
      control: "boolean",
      required: false,
      defaultValue: false,
      label: "Show donors",
    },
  },
};

export const figureMeta: WsComponentMeta = {
  category: "hidden",
  label: "Goal Progress Figure",
  icon: SliderIcon,
  contentModel: {
    category: "none",
    children: [],
  },
  presetStyle: { div },
  initialProps: ["id", "class", "figure"],
  props: {
    figure: {
      type: "string",
      control: "select",
      required: false,
      defaultValue: "raised",
      options: ["raised", "goal", "donors"],
      label: "Figure",
    },
  },
};
