import { ws } from "@webstudio-is/template";
import { pictureEntry } from "./picture";
import {
  faqTwoColumns,
  opportunitiesCards,
  pageHeader,
  signUpSideBySide,
} from "./sections";
import type { StarterPage } from "./types";
import pictureUrl from "./images/volunteer.jpg?url&no-inline";

// The Volunteer page (spec 6.2): ways to help, and a sign-up.
export const volunteerStarterPage: StarterPage = {
  id: "volunteer",
  name: "Volunteer",
  pageName: "Volunteer",
  path: "/volunteer",
  title: "Volunteer",
  description: "Give some time. Here are the ways you can help.",
  status: "draft",
  picture: "volunteer.jpg",
  images: { "volunteer.jpg": pictureEntry("Volunteer", pictureUrl) },
  blocks: ["@organizeos/site-components:SignupForm"],
  body: ({ look, placeBlock }) => (
    <ws.element ws:tag="body">
      {pageHeader({
        look,
        eyebrow: "Volunteer",
        title: "Lend a hand",
        intro: "Say in one sentence what volunteers make possible.",
      })}
      {opportunitiesCards({
        look,
        heading: "Ways to help",
        intro: "Find one that fits your time and your skills.",
        opportunities: [
          ["[A few hours a month]", "[A role]", "Say what the role involves."],
          ["[One weekend]", "[A role]", "Say what the role involves."],
          ["[From home]", "[A role]", "Say what the role involves."],
        ],
      })}
      {signUpSideBySide({
        look,
        placeBlock,
        heading: "Sign up to help",
        intro:
          "Tell us how to reach you, and we'll be in touch about what's next.",
        formHeading: "Sign up to volunteer",
      })}
      {faqTwoColumns({
        look,
        heading: "About volunteering",
        questions: [
          ["Do I need experience?", "Say what training you give."],
          ["How much time does it take?", "Say what a typical commitment is."],
          ["Is there an age limit?", "[Say who can volunteer.]"],
          ["Can I volunteer with friends?", "Say whether groups are welcome."],
        ],
      })}
    </ws.element>
  ),
};
