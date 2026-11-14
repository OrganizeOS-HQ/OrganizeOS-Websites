import atkinson400Url from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2?url&no-inline";
import atkinson700Url from "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2?url&no-inline";
import bricolageUrl from "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url&no-inline";
import type { SiteTemplate } from "../../types";
import { LOOK } from "./styles";
import { blockTokens } from "./block-tokens";
import aboutUrl from "./images/about.jpg?url&no-inline";
import snapshotBlockPartyUrl from "./images/snapshot-block-party.jpg?url&no-inline";
import snapshotGardenUrl from "./images/snapshot-garden.jpg?url&no-inline";
import snapshotMeetingUrl from "./images/snapshot-meeting.jpg?url&no-inline";
import storyUrl from "./images/story.jpg?url&no-inline";
import aboutPictureUrl from "./images/page-about.jpg?url&no-inline";
import eventsPictureUrl from "./images/page-events.jpg?url&no-inline";
import getInvolvedPictureUrl from "./images/page-get-involved.jpg?url&no-inline";
import contactPictureUrl from "./images/page-contact.jpg?url&no-inline";
import thumbnailUrl from "./images/thumbnail.jpg?url&no-inline";
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
// Wikimedia Commons, cropped, resized and compressed. None has a face as its
// subject (owner ruling 2026-11-01): people are seen from behind, at work
// with their heads down, or small in a street or a hall.
// - snapshot-garden.jpg: volunteers' hands planting pansies in the People's
//   Garden, Washington, D.C., 1 April 2022. USDA photo by Preston Keres
//   (Commons licence {{PD-USGov-USDA}}; Flickr review: Public Domain Mark).
//   Not retouched.
// - snapshot-block-party.jpg: a block party on a street closed to traffic,
//   seen from a stoop: a table of wares, a bicycle, balloons and roses. EPA
//   DOCUMERICA, photographed by Suzanne Szasz, June 1973 (National Archives
//   551686; Commons licence {{PD-USGov-EPA}}). The faded film's colour
//   restored (each channel stretched from its 0.5th to its 99.5th
//   percentile). Painted out: the lettering on three cards and a parking
//   sign on the posts (each now a blank card of its own light), the design
//   on a pennant, and a poster on a wall (the wall and the bush tops beside
//   it cloned over it).
// - snapshot-meeting.jpg: residents seen from behind at a community meeting.
//   US Forest Service. Painted out: the printing on the back of a cap and of
//   a T-shirt.
// - about.jpg: neighbors with rakes and shovels planting a greenbelt for
//   National Public Lands Day, Lompoc, California, 27 September 2024. U.S.
//   Space Force photo by Airman 1st Class Olga Houtsma (DVIDS 8666458;
//   Commons licence {{PD-USGov-Military-Space Force}}). Painted out: the
//   printing on two work gloves, a logo on a glove's cuff, a brand mark on a
//   sneaker, a logo on a boot, embroidery and a pin on one cap and a patch
//   on another, the printed sleeves on a lopper's handle (the red handle run
//   on over them), and the model badge on a pickup's door.
// - story.jpg: residents on folding chairs, seen from behind, at a
//   neighborhood meeting in a hall, Melbourne, Florida, 27 August 2008. FEMA
//   photo by George Armstrong (FEMA photo 37821; Commons licence
//   {{PD-USGov-FEMA}}). Cropped to leave out a flag. Not retouched.
//
// thumbnail.jpg, the chooser's picture, is OrganizeOS's own: the top of Home as
// the preview tool draws it, which `corepack pnpm preview:template porch-light
// --thumbnail` writes. No page shows it, so applying never uploads it.

export const porchLightTemplate: SiteTemplate = {
  id: "porch-light",
  category: "community",
  name: "Porch Light",
  oneLine: "For a neighborhood group, tenant association or volunteer network.",
  styleTags: ["friendly", "bold", "photo-led"],
  status: "listed",
  dependsOn: [],
  thumbnail: "thumbnail.jpg",
  pagePictures: {
    about: "page-about.jpg",
    events: "page-events.jpg",
    "get-involved": "page-get-involved.jpg",
    contact: "page-contact.jpg",
  },
  // the kit look page templates draw with: LOOK, with what it leaves unset
  // filled with what the kit draws then, so nothing here renders differently
  look: { ...LOOK, navNameSize: "20px", footerNameSize: "20px" },
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
        "https://commons.wikimedia.org/wiki/File:The_People%27s_Garden_(20220401-FPAC-PJK-017).jpg",
      alt: "Replace with a photo of neighbors working on something together",
    },
    "snapshot-block-party.jpg": {
      url: snapshotBlockPartyUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:BLOCK_PARTY_ON_EAST_35TH_STREET_BETWEEN_LEXINGTON_AND_MADISON_AVENUES._STREET_WAS_CLOSED_TO_MOTOR_TRAFFIC_AND_GIVEN..._-_NARA_-_551686.jpg",
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
        "https://commons.wikimedia.org/wiki/File:Vandenberg_SFB_Takes_Action_for_National_Public_Lands_Day_(8666458).jpg",
      alt: "Replace with a photo of the people who started your group",
    },
    "story.jpg": {
      url: storyUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:FEMA_-_37821_-_FEMA_CR_provides_disaster_information_at_community_meeting.jpg",
      alt: "Replace with a photo from one of your first meetings",
    },
    "thumbnail.jpg": {
      url: thumbnailUrl,
      sourceUrl:
        "organizeos:generated/../../../../scripts/preview-site-template.mjs",
      alt: "A picture of the template's Home page, for the Templates screen",
    },
    "page-about.jpg": {
      url: aboutPictureUrl,
      sourceUrl:
        "organizeos:generated/../../../../scripts/preview-site-template.mjs",
      alt: "A picture of the template's About page, for the Templates screen",
    },
    "page-events.jpg": {
      url: eventsPictureUrl,
      sourceUrl:
        "organizeos:generated/../../../../scripts/preview-site-template.mjs",
      alt: "A picture of the template's Events page, for the Templates screen",
    },
    "page-get-involved.jpg": {
      url: getInvolvedPictureUrl,
      sourceUrl:
        "organizeos:generated/../../../../scripts/preview-site-template.mjs",
      alt: "A picture of the template's Get involved page, for the Templates screen",
    },
    "page-contact.jpg": {
      url: contactPictureUrl,
      sourceUrl:
        "organizeos:generated/../../../../scripts/preview-site-template.mjs",
      alt: "A picture of the template's Contact page, for the Templates screen",
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
