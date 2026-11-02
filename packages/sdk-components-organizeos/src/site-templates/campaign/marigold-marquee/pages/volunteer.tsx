import { ws } from "@webstudio-is/template";
import type { SiteTemplatePage } from "../../../types";
import { photo, siteFooter, siteNav } from "../parts";
import { OPPORTUNITIES } from "../sample-content";
import {
  aboutSection,
  opportunitiesSection,
  pageHeader,
  signUpSection,
} from "../sections";
import { bodyStyles } from "../styles";

// Volunteer: Page header; About: Image right, what a first shift is like;
// Volunteer opportunities: Cards, all six, each to the sign-up below;
// Sign-up: Side by side on the chalk band.

export const volunteer: SiteTemplatePage = {
  key: "volunteer",
  name: "Volunteer",
  path: "/volunteer",
  title: "Volunteer | [Candidate name] for [Office]",
  description:
    "Knock on doors, make calls, host a house meeting or help at events with the [Candidate name] campaign.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        eyebrow: "Volunteer",
        title: "Help the campaign reach every voter",
        intro:
          "Say what volunteers make possible, and that no one needs experience to start.",
      })}
      {aboutSection({
        pageIds: context.pageIds,
        imageSide: "right",
        media: photo(context, "volunteer.jpg", { ratio: "4 / 3" }),
        eyebrow: "Your first shift",
        heading: "What a shift is like",
        paragraphs: [
          "Say where volunteers meet, who greets them, and what they bring.",
          "Then say how a shift goes, from a short training to the last door, and that everyone goes out with a partner.",
        ],
      })}
      {opportunitiesSection({
        pageIds: context.pageIds,
        eyebrow: "Ways to help",
        heading: "Pick what suits you",
        intro: "Say what each role does and how much time it takes.",
        cardLink: { label: "Sign up for this", href: "#sign-up" },
        items: OPPORTUNITIES,
      })}
      {signUpSection({
        placeBlock: context.placeBlock,
        eyebrow: "Sign up",
        heading: "Tell us you are in",
        body: "Leave your name and email, and a volunteer coordinator will be in touch about a first shift.",
        note: "We only use your details for the campaign. Unsubscribe at any time.",
        formHeading: "Sign up to volunteer",
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
