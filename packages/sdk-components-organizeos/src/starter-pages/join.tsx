import { ws } from "@webstudio-is/template";
import { pictureEntry } from "./picture";
import {
  ctaBandCentered,
  faqTwoColumns,
  pageHeader,
  valuesThreeColumns,
} from "./sections";
import type { StarterPage } from "./types";
import pictureUrl from "./images/join.jpg?url&no-inline";

// The Join page (spec 6.2), at /join-us: the platform serves /join, which
// its button hands off to. The Join Form replaces the band when it ships.
export const joinStarterPage: StarterPage = {
  id: "join",
  name: "Join",
  pageName: "Join",
  path: "/join-us",
  title: "Join",
  description: "Become a member, and here's what you get when you do.",
  status: "listed",
  picture: "join.jpg",
  images: { "join.jpg": pictureEntry("Join", pictureUrl) },
  blocks: [],
  body: ({ look }) => (
    <ws.element ws:tag="body">
      {pageHeader({
        look,
        eyebrow: "Membership",
        title: "Join us",
        intro: "Say in one sentence why people become members.",
      })}
      {valuesThreeColumns({
        look,
        heading: "What members get",
        values: [
          ["01", "[A benefit]", "Say what members get and why it matters."],
          ["02", "[A benefit]", "Say what members get and why it matters."],
          ["03", "[A benefit]", "Say what members get and why it matters."],
        ],
      })}
      {ctaBandCentered({
        look,
        heading: "Ready to join?",
        intro: "It only takes a few minutes.",
        button: { label: "Become a member", href: "/join" },
      })}
      {faqTwoColumns({
        look,
        heading: "About membership",
        questions: [
          ["How much does it cost?", "Give the dues, and any reduced rates."],
          ["Who can join?", "[Say who is eligible.]"],
          ["How do I renew?", "Say when and how membership renews."],
          ["Can I cancel?", "Say how to cancel, and what happens then."],
        ],
      })}
    </ws.element>
  ),
};
