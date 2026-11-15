import { ws } from "@webstudio-is/template";
import { pictureEntry } from "./picture";
import {
  ctaBandCentered,
  faqTwoColumns,
  pageHeader,
  valuesThreeColumns,
} from "./sections";
import type { StarterPage } from "./types";
import pictureUrl from "./images/donate.jpg?url&no-inline";

// The Donate page (spec 6.2), at /give: the platform serves /donate, which
// its button hands off to. The Donation Form replaces the band when it ships.
export const donateStarterPage: StarterPage = {
  id: "donate",
  name: "Donate",
  pageName: "Donate",
  path: "/give",
  title: "Donate",
  description: "Your gift keeps our work going. Here's what it makes possible.",
  status: "draft",
  picture: "donate.jpg",
  images: { "donate.jpg": pictureEntry("Donate", pictureUrl) },
  blocks: [],
  body: ({ look }) => (
    <ws.element ws:tag="body">
      {pageHeader({
        look,
        eyebrow: "Donate",
        title: "Your gift keeps us going",
        intro:
          "Say in one sentence what your organization does with every gift.",
      })}
      {valuesThreeColumns({
        look,
        heading: "What a gift does",
        values: [
          ["[$25]", "[What it pays for]", "Say what this gift makes possible."],
          ["[$50]", "[What it pays for]", "Say what this gift makes possible."],
          [
            "[$100]",
            "[What it pays for]",
            "Say what this gift makes possible.",
          ],
        ],
      })}
      {ctaBandCentered({
        look,
        heading: "Give today",
        intro: "Every gift, of any size, goes to work right away.",
        button: { label: "Donate", href: "/donate" },
      })}
      {faqTwoColumns({
        look,
        heading: "About giving",
        questions: [
          [
            "Is my gift tax-deductible?",
            "Say whether, and what your tax status is.",
          ],
          ["Can I give every month?", "Say how to set up a monthly gift."],
          ["How is my gift used?", "Say where the money goes."],
          [
            "Can I give another way?",
            "List checks, transfers or other ways to give.",
          ],
        ],
      })}
    </ws.element>
  ),
};
