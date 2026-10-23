import { EmailIcon } from "@webstudio-is/icons/svg";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import { label } from "@webstudio-is/sdk/normalize.css";

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Email Consent",
  description:
    "An unchecked checkbox, labelled by the text inside it, that opts the visitor in to the organization's email.",
  icon: EmailIcon,
  contentModel: {
    category: "none",
    children: ["instance", "rich-text"],
  },
  states: [{ label: "Invalid", selector: "[data-invalid]" }],
  presetStyle: { label },
  initialProps: ["id", "class"],
};
