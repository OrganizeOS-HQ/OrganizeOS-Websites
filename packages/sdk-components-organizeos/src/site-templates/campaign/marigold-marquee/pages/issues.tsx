import { ws } from "@webstudio-is/template";
import type { SiteTemplatePage } from "../../../types";
import { siteFooter, siteNav } from "../parts";
import { ISSUES } from "../sample-content";
import { donateBand, issuesRows, pageHeader } from "../sections";
import { bodyStyles } from "../styles";

// Issues: Page header; every issue as a numbered row with the steps it
// takes; the donate ask on marigold.

export const issues: SiteTemplatePage = {
  key: "issues",
  name: "Issues",
  path: "/issues",
  title: "Issues | [Candidate name] for [Office]",
  description:
    "What [Candidate name] will work on as [Office], issue by issue, and the first steps on each.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        eyebrow: "Issues",
        title: "Say what the campaign is about",
        intro:
          "Then take each issue in turn: what you will do, who it helps, and how people will know.",
      })}
      {issuesRows({
        pageIds: context.pageIds,
        eyebrow: "The plan",
        heading: "What [Candidate] will do",
        intro:
          "Say in a sentence what the plan sets out to change, and for whom.",
        issues: ISSUES,
      })}
      {donateBand({
        pageIds: context.pageIds,
        heading: "Help put the plan in front of voters",
        body: "Say what a gift pays for, such as [printing] or [ads], and how far a small one goes.",
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
