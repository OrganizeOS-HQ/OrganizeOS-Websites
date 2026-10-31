import atkinson400Url from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2?url&no-inline";
import atkinson700Url from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2?url&no-inline";
import bricolageUrl from "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url&no-inline";
import type { SiteTemplate } from "../../types";
import { blockTokens } from "./block-tokens";
import aboutUrl from "./images/about.jpg?url&no-inline";
import snapshotBlockPartyUrl from "./images/snapshot-block-party.jpg?url&no-inline";
import snapshotGardenUrl from "./images/snapshot-garden.jpg?url&no-inline";
import snapshotMeetingUrl from "./images/snapshot-meeting.jpg?url&no-inline";
import storyUrl from "./images/story.jpg?url&no-inline";
import { about } from "./pages/about";
import { contact } from "./pages/contact";
import { events } from "./pages/events";
import { getInvolved } from "./pages/get-involved";
import { home } from "./pages/home";

// Porch Light, the first Community or advocacy group template (OrganizeOS
// spec 2026-10-30-website-template-inventory-design.md, section 5.1,
// template 2, deliberately the smallest site; its look is
// 2026-10-31-website-template-directions.md, section 2.2). Its pages are in
// ./pages; what they share is its look (./styles), its pieces (./parts), the
// sections more than one page uses (./sections) and the ways to help Home and
// Get involved both list (./sample-content); its look for the platform blocks
// it places is ./block-tokens.
//
// The photos are public domain works of United States federal agencies, from
// Wikimedia Commons, cropped, resized and compressed. Painted out: in
// snapshot-garden.jpg, the brand patch on a cap and the brand on a pair of
// sunglasses; in snapshot-block-party.jpg, a brand emblem on a T-shirt (its
// print continued over it), an embroidered emblem on a cap's visor, a
// printed carton in the bottom-left corner (and the seam where that fill met
// the cloth and the arm, cloned from the cloth and the arm beside it), and a
// third person cut off at the left edge (the field behind cloned from the
// field between the two volunteers, and a fleck of him left at her chin
// cloned from the field beside it); in snapshot-meeting.jpg, the printing on
// the back of a cap and of a T-shirt; in about.jpg, the agency emblem on a
// cap and a name tag on a jacket (each filled from the cap's or the jacket's
// own fabric) and a vehicle maker's name; in story.jpg, the title on a
// booklet.

export const porchLightTemplate: SiteTemplate = {
  id: "porch-light",
  category: "community",
  name: "Porch Light",
  oneLine: "For a neighborhood group, tenant association or volunteer network.",
  styleTags: ["friendly", "bold", "photo-led"],
  status: "draft",
  dependsOn: [],
  thumbnail: "snapshot-block-party.jpg",
  variables: {
    base: "#FFF3D6",
    "accent-1": "#7B2352",
    "accent-2": "#1D7468",
    text: "#2B1F15",
    "font-heading": `"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
    "font-body": `"Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  },
  images: {
    "snapshot-garden.jpg": {
      url: snapshotGardenUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:20220804-NRCS-TEW-0058_(52264014347).jpg",
      alt: "Replace with a photo of neighbors working on something together",
    },
    "snapshot-block-party.jpg": {
      url: snapshotBlockPartyUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Peterson_SFB_Neighborhood_Block_Party_(8644752).jpg",
      alt: "Replace with a photo of your group at one of its events",
    },
    "snapshot-meeting.jpg": {
      url: snapshotMeetingUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Valley_Fire_community_meeting_(31770695708).jpg",
      alt: "Replace with a photo of one of your meetings",
    },
    "about.jpg": {
      url: aboutUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:District_staff_welcome_neighbors_(6188456493).jpg",
      alt: "Replace with a photo of the people who started your group",
    },
    "story.jpg": {
      url: storyUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:FEMA_-_44103_-_Community_Meeting_In_Bordeaux.jpg",
      alt: "Replace with a photo from one of your first meetings",
    },
  },
  fonts: {
    "bricolage-grotesque-latin-wght-normal.woff2": {
      url: bricolageUrl,
      family: "Bricolage Grotesque",
      licence: "OFL-1.1",
      source: "@fontsource-variable/bricolage-grotesque",
    },
    "atkinson-hyperlegible-latin-400-normal.woff2": {
      url: atkinson400Url,
      family: "Atkinson Hyperlegible",
      licence: "OFL-1.1",
      source: "@fontsource/atkinson-hyperlegible",
    },
    "atkinson-hyperlegible-latin-700-normal.woff2": {
      url: atkinson700Url,
      family: "Atkinson Hyperlegible",
      licence: "OFL-1.1",
      source: "@fontsource/atkinson-hyperlegible",
    },
  },
  pages: [home, about, events, getInvolved, contact],
  blockTokens,
};
