import { ws } from "@webstudio-is/template";
import type { SiteTemplatePage } from "../../../types";
import { siteFooter, siteNav } from "../parts";
import { eventsSection, pageHeader, signUpSection } from "../sections";
import { bodyStyles } from "../styles";

// Events: Page header, one Event List under its heading, then Sign-up on the
// berry band. One events section, so a group with no events sees one empty
// state.

export const events: SiteTemplatePage = {
  key: "events",
  name: "Events",
  path: "/events",
  title: "Events | [Organization name]",
  description:
    "Meetings, potlucks and cleanup days with [Organization name], and how to come along.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        tag: "Events",
        title: "Come to something on your street",
        intro:
          "Say what kinds of events you hold, and that everyone who lives nearby is welcome.",
      })}
      {eventsSection({
        placeBlock: context.placeBlock,
        pageIds: context.pageIds,
        tag: "Calendar",
        heading: "Everything coming up",
        intro: "Say how often you meet, and where most events take place.",
      })}
      {signUpSection({
        placeBlock: context.placeBlock,
        tag: "Stay in the loop",
        heading: "Hear about the next one first",
        body: "Leave your email and we will send new dates as soon as they are set.",
        note: "One email a [month]. Unsubscribe at any time.",
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
