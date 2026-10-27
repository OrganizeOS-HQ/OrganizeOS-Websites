import { CalendarIcon } from "@webstudio-is/icons/svg";
import type { TemplateMeta } from "@webstudio-is/template";
import { eventsTemplate } from "./events/event-card.template";

// The Event List's template with one card: the next upcoming public event.
// Picking a specific event needs a lookup by id, which expressions cannot do,
// so it waits for the events virtual collection (plan decision D12). The
// insert binds it as the list, but takes the first event only.
export const meta: TemplateMeta = {
  category: "hidden",
  label: "Event Card",
  description: "Your next public event",
  icon: CalendarIcon,
  template: eventsTemplate({ label: "Event Card" }),
};
