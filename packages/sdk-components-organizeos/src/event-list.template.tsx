import { CalendarIcon } from "@webstudio-is/icons/svg";
import type { TemplateMeta } from "@webstudio-is/template";
import { eventsTemplate } from "./events/event-card.template";

// The org's upcoming public events as a grid of cards. The template leaves the
// collection's `data` and the two state boxes' `data-ws-show` unbound: the
// OrganizeOS panel binds them to the block's own Upcoming Events binding when
// it inserts the block (apps/builder insert-organizeos-block.ts).
export const meta: TemplateMeta = {
  category: "hidden",
  label: "Event List",
  description: "Your upcoming public events",
  icon: CalendarIcon,
  template: eventsTemplate({ label: "Event List" }),
};
