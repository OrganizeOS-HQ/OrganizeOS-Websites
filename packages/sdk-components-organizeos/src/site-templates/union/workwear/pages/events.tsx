import { ws } from "@webstudio-is/template";
import type { SiteTemplatePage } from "../../../types";
import { JOIN, siteFooter, siteNav } from "../parts";
import { ctaBand, eventsList, pageHeader } from "../sections";
import { bodyStyles } from "../styles";

// Events: Page header; one Event List as dated rows under its heading, so a
// local with no events sees one empty state; Call to action band: Split,
// "Join".

export const events: SiteTemplatePage = {
  key: "events",
  name: "Events",
  path: "/events",
  title: "Events | [Organization name]",
  description:
    "Meetings, trainings and events of [Local 000], and how to come along.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        label: "Events",
        title: "Come to the next meeting",
        intro: "Say how often the local meets, where, and who can come.",
      })}
      {eventsList({
        placeBlock: context.placeBlock,
        pageIds: context.pageIds,
        label: "Calendar",
        heading: "Everything coming up",
        intro:
          "Say which meetings are for members, and which are open to anyone.",
      })}
      {ctaBand({
        pageIds: context.pageIds,
        heading: "Join before the next meeting",
        body: "Say what a member can do at meetings, and how soon after joining.",
        link: JOIN,
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
