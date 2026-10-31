import newsreaderUrl from "@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2?url&no-inline";
import sourceSans3Url from "@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2?url&no-inline";
import type { SiteTemplate } from "../../types";
import { blockTokens } from "./block-tokens";
import aboutUrl from "./images/about.jpg?url&no-inline";
import heroUrl from "./images/hero.jpg?url&no-inline";
import programOneUrl from "./images/program-one.jpg?url&no-inline";
import programThreeUrl from "./images/program-three.jpg?url&no-inline";
import programTwoUrl from "./images/program-two.jpg?url&no-inline";
import { about } from "./pages/about";
import { contact } from "./pages/contact";
import { events } from "./pages/events";
import { getInvolved } from "./pages/get-involved";
import { home } from "./pages/home";
import { programs } from "./pages/programs";

// Field Journal, the first Nonprofit or coalition template (OrganizeOS spec
// 2026-10-30-website-template-inventory-design.md, section 5.1, template 1;
// its look is 2026-10-31-website-template-directions.md, section 2.1). Its
// pages are in ./pages; what they share is its look (./styles), its pieces
// (./parts) and the sections more than one page uses (./sections); its look
// for the platform blocks it places is ./block-tokens. Donate is the
// platform's /donate, linked, never a page of the template.
//
// The photos are public domain works of United States federal agencies,
// from Wikimedia Commons, resized and compressed. Painted out: in the hero, a
// maker's mark on the birdhouse and a glove's brand patch; in about.jpg, a
// billboard and a filling station's lettering and sign on the skyline.

export const fieldJournalTemplate: SiteTemplate = {
  id: "field-journal",
  category: "nonprofit",
  name: "Field Journal",
  oneLine: "A home for a nonprofit that organizes people around a cause.",
  styleTags: ["editorial", "warm", "photo-led"],
  status: "draft",
  dependsOn: [],
  thumbnail: "hero.jpg",
  // the preview's sample event cover: a photo on no page with events, so
  // Home never shows one twice
  previewEventCover: "about.jpg",
  variables: {
    base: "#F6F2E9",
    "accent-1": "#23533D",
    "accent-2": "#8F6312",
    text: "#1C2A23",
    "font-heading": `"Newsreader", Georgia, "Times New Roman", serif`,
    "font-body": `"Source Sans 3", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  },
  images: {
    "hero.jpg": {
      url: heroUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:National_Public_Lands_Day_2015_(21712958636).jpg",
      alt: "Replace with a photo of one of your people at work, looking at the camera",
    },
    "program-one.jpg": {
      url: programOneUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Volunteers_Planting_Trees_on_the_Ankeny_National_Wildlife_Refuge_-_DPLA_-_34d3d852428a6bd0c316855d00d1d8ea.jpg",
      alt: "Replace with a photo of your first program in action",
    },
    "program-two.jpg": {
      url: programTwoUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Cherry_Point_Commissary_donates_more_than_30,000_lbs._to_food_bank_140702-M-SR938-047.jpg",
      alt: "Replace with a photo of your second program in action",
    },
    "program-three.jpg": {
      url: programThreeUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:People%27s_Garden_Celebrates_150th_Annivarsary_of_USDA_(20120515-OC-LSC-0764).jpg",
      alt: "Replace with a photo of your third program in action",
    },
    "about.jpg": {
      url: aboutUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:RMA-Urban_Roots_St_Paul-Ag_in_the_city_(20220928-RMA-CDP-0056).jpg",
      alt: "Replace with a photo of the place where your work began",
    },
  },
  fonts: {
    "newsreader-latin-wght-normal.woff2": {
      url: newsreaderUrl,
      family: "Newsreader",
      licence: "OFL-1.1",
      source: "@fontsource-variable/newsreader",
    },
    "source-sans-3-latin-wght-normal.woff2": {
      url: sourceSans3Url,
      family: "Source Sans 3",
      licence: "OFL-1.1",
      source: "@fontsource-variable/source-sans-3",
    },
  },
  pages: [home, about, programs, getInvolved, events, contact],
  blockTokens,
};
