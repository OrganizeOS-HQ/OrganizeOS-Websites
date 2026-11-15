import { EmbedIcon } from "@webstudio-is/icons/svg";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import { div } from "@webstudio-is/sdk/normalize.css";
import { organizeos } from "../shared/meta";

// Builder-only rows (organizeos-giving-controls.tsx): Give to, State and After
// the gift. organizationId and platformOrigin are written at insert and drawn
// by no row; a published site reads all six through the root.
export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Donation Form",
  description:
    "Takes a gift on the page, through the platform's donation form.",
  icon: EmbedIcon,
  contentModel: {
    category: "instance",
    children: ["instance"],
    descendants: [organizeos.DonationFrame],
  },
  presetStyle: { div },
  initialProps: [
    "id",
    "class",
    "target",
    "state",
    "afterGift",
    "afterGiftPage",
  ],
  props: {
    target: {
      type: "string",
      control: "text",
      required: false,
      label: "Give to",
    },
    state: {
      type: "string",
      control: "select",
      required: false,
      defaultValue: "ready",
      options: ["ready", "unavailable"],
      description: "Shown on the canvas",
    },
    afterGift: {
      type: "string",
      control: "radio",
      required: false,
      defaultValue: "message",
      options: ["message", "page"],
      label: "After the gift",
    },
    afterGiftPage: {
      type: "string",
      control: "url",
      required: false,
      label: "Page",
    },
    organizationId: {
      type: "string",
      control: "text",
      required: false,
      label: "Organization",
    },
    platformOrigin: {
      type: "string",
      control: "text",
      required: false,
      label: "Platform",
    },
  },
};

export const frameMeta: WsComponentMeta = {
  category: "hidden",
  label: "Donation Frame",
  icon: EmbedIcon,
  contentModel: {
    category: "none",
    children: [],
  },
  presetStyle: { div },
  initialProps: ["id", "class"],
};
