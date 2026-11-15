import { ws } from "@webstudio-is/template";
import { pictureEntry } from "./picture";
import { ctaBandSplit, faqTwoColumns, heroSplit, valuesList } from "./sections";
import type { StarterPage } from "./types";
import pictureUrl from "./images/fundraiser.jpg?url&no-inline";

// The Fundraiser page (spec 6.2): one campaign's story. It shows no progress
// figures (a typed total goes stale; Goal Progress ships later), and its
// button hands off to /donate, which the org points at its campaign.
export const fundraiserStarterPage: StarterPage = {
  id: "fundraiser",
  name: "Fundraiser",
  pageName: "Fundraiser",
  path: "/campaign",
  title: "Fundraiser",
  description:
    "Help us reach our goal. Here's the story, and where the money goes.",
  status: "draft",
  picture: "fundraiser.jpg",
  images: { "fundraiser.jpg": pictureEntry("Fundraiser", pictureUrl) },
  blocks: [],
  body: ({ look, image }) => (
    <ws.element ws:tag="body">
      {heroSplit({
        look,
        image,
        eyebrow: "[Campaign name]",
        title: "Say what this campaign will make happen",
        intro:
          "Tell the story: who it helps, why now, and what changes when you reach the goal.",
      })}
      {valuesList({
        look,
        heading: "Where the money goes",
        values: [
          ["01", "[First use]", "[Say what this part of the money pays for.]"],
          ["02", "[Second use]", "[Say what this part of the money pays for.]"],
          ["03", "[Third use]", "[Say what this part of the money pays for.]"],
        ],
      })}
      {ctaBandSplit({
        look,
        heading: "Help us get there",
        intro: "Every gift brings the goal closer.",
        button: { label: "Donate", href: "/donate" },
      })}
      {faqTwoColumns({
        look,
        heading: "About this campaign",
        questions: [
          ["When does it end?", "[Give the end date.]"],
          ["What if you pass the goal?", "[Say what happens to the extra.]"],
          [
            "Is my gift tax-deductible?",
            "[Say whether, and what your tax status is.]",
          ],
          [
            "How else can I help?",
            "[Suggest sharing, volunteering or hosting.]",
          ],
        ],
      })}
    </ws.element>
  ),
};
