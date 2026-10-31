import { ws } from "@webstudio-is/template";
import type { SiteTemplatePage } from "../../../types";
import { siteFooter, siteNav } from "../parts";
import { OPPORTUNITIES } from "../sample-content";
import {
  eventsSection,
  faqSection,
  opportunitiesSection,
  pageHeader,
  signUpSection,
} from "../sections";
import { bodyStyles } from "../styles";

// Get involved (spec section 4's page): Page header, Volunteer
// opportunities, Sign-up, Events, FAQ. The nav's "Join us" lands here.

export const getInvolved: SiteTemplatePage = {
  key: "get-involved",
  name: "Get involved",
  path: "/get-involved",
  title: "Get involved | [Organization name]",
  description:
    "Ways to help [Organization name], the next events to come to and answers to common questions.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        tag: "Get involved",
        title: "Say in one sentence how a neighbor can help",
        intro:
          "Add a sentence for someone ready to pitch in: no experience needed, only [an hour or two].",
      })}
      {opportunitiesSection({
        pageIds: context.pageIds,
        heading: "Pick something that fits your week",
        intro:
          "List the jobs that need doing, with the time each one asks for.",
        items: OPPORTUNITIES,
      })}
      {signUpSection({
        placeBlock: context.placeBlock,
        tag: "Join us",
        heading: "Hear when help is needed",
        body: "Leave your details and [our coordinator] will write when there is a job that suits you.",
        note: "We only use your details to contact you about the group.",
      })}
      {eventsSection({
        placeBlock: context.placeBlock,
        pageIds: context.pageIds,
        tag: "Events",
        heading: "Or start at an event",
        intro: "Come to one first: it is the easiest way to meet everyone.",
        link: { label: "All events", pageKey: "events" },
      })}
      {faqSection({
        pageIds: context.pageIds,
        heading: "Before you pitch in",
        questions: [
          [
            "Do I need to live on [your street]?",
            "Say who can join: everyone nearby, renters and owners alike, or only some streets.",
          ],
          [
            "How much time does it take?",
            "Say what the smallest commitment is, and how people can do more if they want to.",
          ],
          [
            "Does it cost anything?",
            "Say whether there are dues, and that no one is turned away for not paying.",
          ],
          [
            "Can I bring my family?",
            "Say which events are good for all ages, and whether there is help for anyone who needs it.",
          ],
        ],
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
