import { ws } from "@webstudio-is/template";
import type { SiteTemplatePage } from "../../../types";
import { siteFooter, siteNav } from "../parts";
import { donateBand, eventsList, pageHeader } from "../sections";
import { bodyStyles } from "../styles";

// Events: Page header; one Event List of everything coming up, so an org
// with no events sees one empty state; the donate ask on marigold.

export const events: SiteTemplatePage = {
  key: "events",
  name: "Events",
  path: "/events",
  title: "Events | [Candidate name] for [Office]",
  description:
    "Town halls, canvasses and gatherings with [Candidate name] and the campaign.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        eyebrow: "Events",
        title: "Come out and meet the campaign",
        intro:
          "Say what kinds of events you hold, such as [town halls] and [canvasses], and that everyone is welcome.",
      })}
      {eventsList({
        placeBlock: context.placeBlock,
        pageIds: context.pageIds,
        eyebrow: "Calendar",
        heading: "Everything coming up",
        intro: "Say where most events happen, and how to get there.",
      })}
      {donateBand({
        pageIds: context.pageIds,
        heading: "Can't make it in person?",
        body: "Give what you can, or pick a way to help from home.",
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
