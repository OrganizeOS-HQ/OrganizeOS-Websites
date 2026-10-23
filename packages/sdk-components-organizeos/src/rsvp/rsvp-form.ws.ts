import { CalendarIcon } from "@webstudio-is/icons/svg";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import { form } from "@webstudio-is/sdk/normalize.css";
import { organizeos } from "../shared/meta";
import { rsvpFormStates } from "./states";

export const meta: WsComponentMeta = {
  category: "hidden",
  label: "RSVP Form",
  description:
    "Takes RSVPs for one of the organization's events, with its guests, shifts, roles and registration questions.",
  icon: CalendarIcon,
  contentModel: {
    category: "instance",
    children: ["instance"],
    // The names of the parts are written into every build that uses them, so
    // they never change: Guests, Shift Options, Questions and Email Consent
    // are the components "Guests", "ShiftOptions", "Questions" and
    // "EmailConsent" of this package.
    descendants: [
      organizeos.Field,
      organizeos.SubmitButton,
      organizeos.Guests,
      organizeos.ShiftOptions,
      organizeos.Questions,
      organizeos.EmailConsent,
    ],
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
      label: "Event",
      description:
        "The event this block takes RSVPs for, by its id. Without one, the live site shows the Unavailable state.",
    },
    data: {
      type: "json",
      control: "json",
      required: false,
      label: "Events data",
      description:
        "The organization's public events (the project's Events data), where the block finds its event: when it starts and ends, whether it is full, and its guests, shifts and questions.",
    },
    state: {
      type: "string",
      control: "select",
      required: false,
      defaultValue: "initial",
      options: [...rsvpFormStates],
      description:
        "Reveals a state on the canvas so it can be styled. A published site starts in Initial and moves through the states as the visitor submits.",
    },
    action: {
      type: "string",
      control: "radio",
      required: false,
      defaultValue: "state",
      options: ["state", "page"],
      label: "After submit",
      description:
        "What happens after a successful RSVP: show the Registered state, or go to a page. A visitor who lands on the waitlist always sees the Waitlisted state.",
    },
    actionPage: {
      type: "string",
      control: "url",
      required: false,
      label: "Page",
      description:
        "The page to open after a successful RSVP, when After submit is page.",
    },
  },
};
