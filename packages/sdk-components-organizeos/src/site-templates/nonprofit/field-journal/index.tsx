import newsreaderUrl from "@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2?url&no-inline";
import sourceSans3Url from "@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2?url&no-inline";
import type { SiteTemplate } from "../../types";
import { blockTokens } from "./block-tokens";
import aboutUrl from "./images/about.jpg?url&no-inline";
import heroUrl from "./images/hero.jpg?url&no-inline";
import programOneUrl from "./images/program-one.jpg?url&no-inline";
import programThreeUrl from "./images/program-three.jpg?url&no-inline";
import programTwoUrl from "./images/program-two.jpg?url&no-inline";
import thumbnailUrl from "./images/thumbnail.jpg?url&no-inline";
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
// from Wikimedia Commons, resized and compressed. No photo's subject is a
// face (the owner's ruling of 2026-11-01): the hero is a volunteer seen from
// behind, program-two a pair of hands. Painted out: in the hero, the shop
// prints on the two front tote bags, refilled from the bag's own green and
// grain; in about.jpg, a billboard and a filling station's lettering and sign
// on the skyline. program-two's midtones are lifted (gamma 0.85).
//
// thumbnail.jpg, the chooser's picture, is OrganizeOS's own: the top of Home as
// the preview tool draws it, which `corepack pnpm preview:template
// field-journal --thumbnail` writes. No page shows it, so applying never
// uploads it.

export const fieldJournalTemplate: SiteTemplate = {
  id: "field-journal",
  category: "nonprofit",
  name: "Field Journal",
  oneLine: "A home for a nonprofit that organizes people around a cause.",
  styleTags: ["editorial", "warm", "photo-led"],
  status: "draft",
  dependsOn: [],
  thumbnail: "thumbnail.jpg",
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
      // USFWS Southeast, 2017, {{PD-USGov-FWS}}: volunteers carrying red
      // spruce seedlings to planting sites on Pisgah National Forest
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Volunteers_carry_trees_to_planting_sites_(37287300136).jpg",
      alt: "Replace with a photo of your people at work",
    },
    "program-one.jpg": {
      url: programOneUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Volunteers_Planting_Trees_on_the_Ankeny_National_Wildlife_Refuge_-_DPLA_-_34d3d852428a6bd0c316855d00d1d8ea.jpg",
      alt: "Replace with a photo of your first program in action",
    },
    "program-two.jpg": {
      url: programTwoUrl,
      // USDA, 2015, {{PD-USGov-USDA}}: a volunteer bagging gleaned potatoes
      // at a food distribution warehouse
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:2015_Feds_Feeds_Families-Gleaning_at_MAGNET_(Food)_Warehouse_(20150911-DM-LSC-3017).jpg",
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
    "thumbnail.jpg": {
      url: thumbnailUrl,
      sourceUrl:
        "organizeos:generated/../../../../scripts/preview-site-template.mjs",
      alt: "A picture of the template's Home page, for the template chooser",
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
