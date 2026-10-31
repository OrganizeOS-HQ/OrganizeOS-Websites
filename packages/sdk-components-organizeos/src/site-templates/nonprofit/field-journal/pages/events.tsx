import { ws } from "@webstudio-is/template";
import { section } from "../../../kit";
import type { PageContext, SiteTemplatePage } from "../../../types";
import {
  eventsFrame,
  keyed,
  sectionHeader,
  siteFooter,
  siteNav,
} from "../parts";
import { pageHeader, signUpSection } from "../sections";
import { bodyStyles } from "../styles";

// Events (spec section 4's page, Events: Featured plus list): the next event
// and the full list in two sections with their own headings, one events
// block to a section; then Sign-up.

/** Events: Featured, the Event Card under its heading. */
const featured = (context: PageContext) =>
  section({
    label: "Events: Featured",
    children: keyed([
      sectionHeader({
        pageIds: context.pageIds,
        eyebrow: "Next up",
        heading: "Our next event",
      }),
      eventsFrame(
        context.placeBlock(
          "@organizeos/site-components:EventCard",
          "next-event"
        )
      ),
    ]),
  });

/** Events, the Event List of everything coming up. */
const upcoming = (context: PageContext) =>
  section({
    label: "Events",
    children: keyed([
      sectionHeader({
        pageIds: context.pageIds,
        eyebrow: "Calendar",
        heading: "Everything coming up",
        intro:
          "Every event you publish in OrganizeOS appears here, soonest first.",
      }),
      eventsFrame(
        context.placeBlock(
          "@organizeos/site-components:EventList",
          "all-events"
        )
      ),
    ]),
  });

export const events: SiteTemplatePage = {
  key: "events",
  name: "Events",
  path: "/events",
  title: "Events | [Organization name]",
  description:
    "Upcoming events, volunteer days and gatherings with [Organization name].",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        eyebrow: "Events",
        title: "Come to something with [Organization name]",
        intro:
          "Add a sentence on the kinds of events you hold, such as [volunteer days, open evenings and talks].",
      })}
      {featured(context)}
      {upcoming(context)}
      {signUpSection({
        placeBlock: context.placeBlock,
        eyebrow: "Newsletter",
        heading: "Hear about events first",
        body: "Sign up and we will send you new dates as soon as they are set.",
        note: "One email a [month]. Unsubscribe at any time.",
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
