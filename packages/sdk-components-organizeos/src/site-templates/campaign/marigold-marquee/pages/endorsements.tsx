import { ws } from "@webstudio-is/template";
import type { SiteTemplatePage } from "../../../types";
import { siteFooter, siteNav } from "../parts";
import { QUOTES } from "../sample-content";
import { donateBand, pageHeader, quoteCards } from "../sections";
import { bodyStyles } from "../styles";

// Endorsements: Page header; Endorsements and testimonials: Quote cards,
// every name and role a bracket to fill; the donate ask on marigold.

export const endorsements: SiteTemplatePage = {
  key: "endorsements",
  name: "Endorsements",
  path: "/endorsements",
  title: "Endorsements | [Candidate name] for [Office]",
  description:
    "The people and groups who back [Candidate name] for [Office], in their own words.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        eyebrow: "Endorsements",
        title: "Say who backs [Candidate]",
        intro:
          "Add the people and groups behind the campaign, each with their words and their role.",
      })}
      {quoteCards({
        pageIds: context.pageIds,
        eyebrow: "In their words",
        heading: "Why they back the campaign",
        intro:
          "Ask each one for a sentence or two, and check the wording with them before it goes up.",
        quotes: QUOTES,
      })}
      {donateBand({
        pageIds: context.pageIds,
        heading: "Add your support",
        body: "Give what you can, or volunteer an hour this week.",
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
