import { RepeatGridIcon } from "@webstudio-is/icons/svg";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import { div } from "@webstudio-is/sdk/normalize.css";
import { fieldDefaults, motions, shapeNames } from "./shape";

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Convergence Field",
  description:
    "Draws the brand's field of arms pointing at a focus behind its children, from its settings. The field is a box of the chosen Shape scaled to cover the element, so it is cropped on the narrower side.",
  icon: RepeatGridIcon,
  contentModel: {
    category: "instance",
    children: ["instance"],
  },
  // the field's containing block and its own stacking context, so the field
  // (z-index -1) sits behind the children and above the element's background
  presetStyle: {
    div: [
      ...div,
      { property: "position", value: { type: "keyword", value: "relative" } },
      { property: "isolation", value: { type: "keyword", value: "isolate" } },
    ],
  },
  initialProps: [
    "id",
    "class",
    "shape",
    "density",
    "focusX",
    "focusY",
    "zoneWidth",
    "zoneHeight",
    "innerColor",
    "outerColor",
    "motion",
  ],
  props: {
    shape: {
      type: "string",
      control: "select",
      required: false,
      options: shapeNames,
      defaultValue: fieldDefaults.shape,
      label: "Shape",
      description:
        "The field's box: Band 3:1, Wide 16:9, Panel 2:1, Square 1:1 or Tall 3:4. It covers the element and is cropped on the narrower side, so pick the Shape closest to the element's, and Tall for sections taller than wide on phones.",
    },
    density: {
      type: "number",
      control: "number",
      required: false,
      defaultValue: fieldDefaults.density,
      label: "Density",
      description:
        "The grid step in field units, from 24 (dense) to 96 (sparse), the same on every Shape: a Wide field is 1600 units across.",
    },
    focusX: {
      type: "number",
      control: "number",
      required: false,
      defaultValue: fieldDefaults.focusX,
      label: "Focus X",
      description:
        "Where the arms point, across the field, in percent from 10 to 90.",
    },
    focusY: {
      type: "number",
      control: "number",
      required: false,
      defaultValue: fieldDefaults.focusY,
      label: "Focus Y",
      description:
        "Where the arms point, down the field, in percent from 10 to 90.",
    },
    zoneWidth: {
      type: "number",
      control: "number",
      required: false,
      defaultValue: fieldDefaults.zoneWidth,
      label: "Zone width",
      description:
        "Width of the clear ellipse around the focus, in percent of the field from 10 to 90, kept clear of the edges.",
    },
    zoneHeight: {
      type: "number",
      control: "number",
      required: false,
      defaultValue: fieldDefaults.zoneHeight,
      label: "Zone height",
      description:
        "Height of the clear ellipse around the focus, in percent of the field from 10 to 90, kept clear of the edges.",
    },
    innerColor: {
      type: "string",
      control: "color",
      required: false,
      defaultValue: fieldDefaults.innerColor,
      label: "Inner color",
      description:
        "The arms' color near the clear zone, where they are faint: a hex, rgb(), hsl(), oklch() or named color, or var(--name).",
    },
    outerColor: {
      type: "string",
      control: "color",
      required: false,
      defaultValue: fieldDefaults.outerColor,
      label: "Outer color",
      description:
        "The arms' color at the edges, where they are solid: a hex, rgb(), hsl(), oklch() or named color, or var(--name).",
    },
    motion: {
      type: "string",
      control: "radio",
      required: false,
      options: [...motions],
      defaultValue: fieldDefaults.motion,
      label: "Motion",
      description:
        "Settle turns the arms into place as the element scrolls into view, never under reduced motion.",
    },
  },
};
