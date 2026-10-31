import { ws } from "@webstudio-is/template";
import { keyed, section } from "../../../kit";
import type { PageContext, SiteTemplatePage } from "../../../types";
import { eventList, sectionHeader, siteFooter, siteNav } from "../parts";
import { pageHeader, signUpSection } from "../sections";
import { bodyStyles } from "../styles";

// Events: Page header, one Event List under its heading, then Sign-up. One
// events section, so an org with no events sees one empty state.

/** Events: Card grid, the Event List of everything coming up. */
const upcoming = (context: PageContext) =>
  section({
    label: "Events: Card grid",
    children: keyed([
      sectionHeader({
        pageIds: context.pageIds,
        eyebrow: "Calendar",
        heading: "Everything coming up",
        intro: "Say how often you meet, and where most events take place.",
      }),
      eventList(context),
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
        title: "Come to something with us",
        intro: "Say what kinds of events you hold, such as [volunteer days].",
      })}
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
