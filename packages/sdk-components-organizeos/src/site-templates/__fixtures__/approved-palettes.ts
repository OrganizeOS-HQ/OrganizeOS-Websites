import {
  BLANK_CANONICAL_VALUES,
  type CanonicalValues,
} from "../canonical-variables";

// The palettes the owner approved for the first site templates (the template
// directions board, section 2), and the blank start. Tests that hold a block
// or a template to a contrast ratio run over all of them, so a colour that
// reads well on one palette cannot hide one that fails on another.

export type ApprovedPalette = {
  name: string;
  colors: Pick<CanonicalValues, "base" | "accent-1" | "accent-2" | "text">;
};

export const approvedPalettes: readonly ApprovedPalette[] = [
  {
    name: "Field Journal",
    colors: {
      base: "#F6F2E9",
      "accent-1": "#23533D",
      "accent-2": "#8F6312",
      text: "#1C2A23",
    },
  },
  {
    name: "Porch Light",
    colors: {
      base: "#FFF3D6",
      "accent-1": "#7B2352",
      "accent-2": "#1D7468",
      text: "#2B1F15",
    },
  },
  {
    name: "Workwear",
    colors: {
      base: "#E8EAEC",
      "accent-1": "#1F3557",
      "accent-2": "#C2470F",
      text: "#15181D",
    },
  },
  {
    name: "Marigold Marquee",
    colors: {
      base: "#12151A",
      "accent-1": "#F2B230",
      "accent-2": "#7FD6C2",
      text: "#F4F1EA",
    },
  },
  {
    name: "Riso Broadside",
    colors: {
      base: "#FFFFFF",
      "accent-1": "#2B2FC9",
      "accent-2": "#C8006A",
      text: "#111114",
    },
  },
  {
    name: "Blank",
    colors: {
      base: BLANK_CANONICAL_VALUES.base,
      "accent-1": BLANK_CANONICAL_VALUES["accent-1"],
      "accent-2": BLANK_CANONICAL_VALUES["accent-2"],
      text: BLANK_CANONICAL_VALUES.text,
    },
  },
];
