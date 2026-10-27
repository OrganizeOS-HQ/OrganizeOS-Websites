import { EmailIcon } from "@webstudio-is/icons/svg";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import { form } from "@webstudio-is/sdk/normalize.css";
import { organizeos } from "../shared/meta";
import { signupFormStates } from "./states";

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "Signup Form",
  description:
    "Signs visitors up to the organization through one of its forms, or the org defaults.",
  icon: EmailIcon,
  contentModel: {
    category: "instance",
    children: ["instance"],
    descendants: [organizeos.Field, organizeos.SubmitButton],
  },
  presetStyle: { form },
  initialProps: [
    "id",
    "class",
    "record",
    "data",
    "state",
    "action",
    "actionPage",
  ],
  props: {
    record: {
      type: "string",
      control: "text",
      required: false,
      label: "Form",
    },
    data: {
      type: "json",
      control: "json",
      required: false,
      label: "Forms data",
    },
    state: {
      type: "string",
      control: "select",
      required: false,
      defaultValue: "initial",
      options: [...signupFormStates],
      description: "Shown on the canvas",
    },
    action: {
      type: "string",
      control: "radio",
      required: false,
      defaultValue: "state",
      options: ["state", "page"],
      label: "After submit",
      description: "Success state, or a page",
    },
    actionPage: {
      type: "string",
      control: "url",
      required: false,
      label: "Page",
    },
  },
};
