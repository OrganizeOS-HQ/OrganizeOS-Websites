import { ws } from "@webstudio-is/template";
import type { SiteTemplatePage } from "../../../types";
import { portrait, siteFooter, siteNav } from "../parts";
import { aboutSection, donateBand, pageHeader, statsRow } from "../sections";
import { bodyStyles } from "../styles";

// About (the candidate): Page header; About: Image left, the bio beside the
// portrait frame; Stats: Inline row, three facts; the donate ask on
// marigold.

export const about: SiteTemplatePage = {
  key: "about",
  name: "About",
  path: "/about",
  title: "About [Candidate name] | [Candidate name] for [Office]",
  description:
    "Who [Candidate name] is, where they come from, and why they are running for [Office].",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        eyebrow: "About",
        title: "Meet [Candidate]",
        intro:
          "Say in one sentence who [Candidate name] is, and why they are running now.",
      })}
      {aboutSection({
        pageIds: context.pageIds,
        imageSide: "left",
        media: portrait(context, "about.jpg"),
        eyebrow: "The story",
        heading: "Where [Candidate] comes from",
        paragraphs: [
          "Say where [Candidate name] grew up, what they did for work, and what brought them to [Place].",
          "Then say what they have done here: the work, the groups, the people they have stood up for since [year].",
          "End with the moment they decided to run, in a sentence or two.",
        ],
        link: { label: "Who backs the campaign", pageKey: "endorsements" },
      })}
      {statsRow({
        pageIds: context.pageIds,
        eyebrow: "At a glance",
        heading: "A few facts",
        stats: [
          ["[00]", "Years living in [Place]"],
          ["[00]", "Years working as a [job]"],
          ["[0,000]", "Doors knocked so far"],
        ],
      })}
      {donateBand({
        pageIds: context.pageIds,
        heading: "Back [Candidate] today",
        body: "Give what you can, or give an hour of your time.",
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
