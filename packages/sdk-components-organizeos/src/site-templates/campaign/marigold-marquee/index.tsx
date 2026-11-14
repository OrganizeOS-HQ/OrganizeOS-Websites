import archivoBlackUrl from "@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2?url&no-inline";
import publicSansUrl from "@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2?url&no-inline";
import type { SiteTemplate } from "../../types";
import { LOOK } from "./styles";
import { blockTokens } from "./block-tokens";
import aboutUrl from "./images/about.jpg?url&no-inline";
import heroUrl from "./images/hero.jpg?url&no-inline";
import issuesPictureUrl from "./images/page-issues.jpg?url&no-inline";
import aboutPictureUrl from "./images/page-about.jpg?url&no-inline";
import endorsementsPictureUrl from "./images/page-endorsements.jpg?url&no-inline";
import volunteerPictureUrl from "./images/page-volunteer.jpg?url&no-inline";
import eventsPictureUrl from "./images/page-events.jpg?url&no-inline";
import thumbnailUrl from "./images/thumbnail.jpg?url&no-inline";
import volunteerUrl from "./images/volunteer.jpg?url&no-inline";
import { about } from "./pages/about";
import { endorsements } from "./pages/endorsements";
import { events } from "./pages/events";
import { home } from "./pages/home";
import { issues } from "./pages/issues";
import { volunteer } from "./pages/volunteer";

// Marigold Marquee, the first Campaign template, for a candidate or a ballot
// measure (OrganizeOS spec 2026-10-30-website-template-inventory-design.md,
// section 5.1, template 4; its look is
// 2026-10-31-website-template-directions.md, section 2.4, the wave's one dark
// base). Its pages are in ./pages; what they share is its look (./styles),
// its pieces (./parts), the sections its pages are built from (./sections)
// and the sample items (./sample-content); its look for the platform blocks
// it places is ./block-tokens. Donate is the platform's /donate, linked,
// never a page of the template. Neutral for any party or none: no party,
// position, real person or place is named, and no photo shows a face that
// could be read as the candidate's.
//
// The photos, each cropped, resized and compressed:
// - hero.jpg: a speaker seen from behind, notes in hand, before the feet of
//   a seated front row: no face in the frame. A public domain work of the
//   National Cancer Institute (NIH), by its staff photographer Bill Branson,
//   November 1988 (NCI Visuals Online 2385, "Reuse Restrictions: None";
//   Commons licence {{PD-USGov-HHS-NIH}}). Cropped below the audience's faces
//   and turned to greys, so its red carpet does not set a party colour beside
//   the marigold.
// - about.jpg: a figure in silhouette against a sunset sky. CC0 from Unsplash
//   (photo kypCqYxosY4, Evan Kirby), published before Unsplash's licence
//   changed on 5 June 2017: its image id (photo-1455595708577) is a
//   timestamp, 2016-02-16, and the Wayback Machine holds its Unsplash page as
//   of 2017-05-03 (web.archive.org/web/20170503081051/https://unsplash.com/
//   photos/kypCqYxosY4), both recorded on the Commons page.
// - volunteer.jpg: a phone bank seen from behind, six people at a long table
//   with handsets to their ears, a clock on the wall above: no face in the
//   frame (the owner's ruling of 2026-11-01). A public domain work of FEMA,
//   by Ed Edahl, Milwaukee, September 2010 (FEMA Photo Library 45427; Commons
//   licence {{PD-USGov-FEMA}}). From Commons' 1920px rendition, cropped to
//   4:3, which leaves out a seventh caller seen in profile at the right edge
//   and a poster at the left. Painted out, each filled with its own surface's
//   shading and grain: on the wall, the agency's registration signs, an
//   incident notice, a handwritten note, a calendar and two bulletin boards
//   with their flyers (a union's among them); an event's slogans printed on
//   the back of a black T-shirt (the chair in front of it kept) and small
//   print on a white one; a lettered board under the table; a mark on a
//   water bottle.
//
// thumbnail.jpg, the chooser's picture, is OrganizeOS's own: the top of Home as
// the preview tool draws it, which `corepack pnpm preview:template
// marigold-marquee --thumbnail` writes. No page shows it, so applying never
// uploads it.

export const marigoldMarqueeTemplate: SiteTemplate = {
  id: "marigold-marquee",
  category: "campaign",
  name: "Marigold Marquee",
  oneLine: "For a candidate, ballot measure or chapter.",
  styleTags: ["confident", "high-contrast", "dark"],
  status: "listed",
  dependsOn: [],
  thumbnail: "thumbnail.jpg",
  // the preview's sample event cover: a photo on no page with events, so
  // Home never shows one twice
  previewEventCover: "volunteer.jpg",
  pagePictures: {
    issues: "page-issues.jpg",
    about: "page-about.jpg",
    endorsements: "page-endorsements.jpg",
    volunteer: "page-volunteer.jpg",
    events: "page-events.jpg",
  },
  // the kit look page templates draw with: LOOK, with what it leaves unset
  // filled with what the kit draws then, so nothing here renders differently
  look: { ...LOOK, navNameSize: "20px", footerNameSize: "20px" },
  variables: {
    base: "#12151A",
    "accent-1": "#F2B230",
    "accent-2": "#7FD6C2",
    text: "#F4F1EA",
    "font-heading": `"Archivo Black", "Arial Black", "Helvetica Neue", Arial, sans-serif`,
    "font-body": `"Public Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`,
  },
  images: {
    "hero.jpg": {
      url: heroUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Woman_speaks_to_crowd.jpg",
      alt: "Replace with a portrait of your candidate, or a picture for your measure",
    },
    "about.jpg": {
      url: aboutUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Sunset_silhouette_of_man_(Unsplash).jpg",
      alt: "Replace with a portrait of your candidate",
    },
    "volunteer.jpg": {
      url: volunteerUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:FEMA_-_45427_-_Phone_bank_for_residents_at_a_Disaster_Recovery_Center.jpg",
      alt: "Replace with a photo of your volunteers on a shift, making calls or knocking on doors",
    },
    "thumbnail.jpg": {
      url: thumbnailUrl,
      sourceUrl:
        "organizeos:generated/../../../../scripts/preview-site-template.mjs",
      alt: "A picture of the template's Home page, for the Templates screen",
    },
    "page-issues.jpg": {
      url: issuesPictureUrl,
      sourceUrl:
        "organizeos:generated/../../../../scripts/preview-site-template.mjs",
      alt: "A picture of the template's Issues page, for the Templates screen",
    },
    "page-about.jpg": {
      url: aboutPictureUrl,
      sourceUrl:
        "organizeos:generated/../../../../scripts/preview-site-template.mjs",
      alt: "A picture of the template's About page, for the Templates screen",
    },
    "page-endorsements.jpg": {
      url: endorsementsPictureUrl,
      sourceUrl:
        "organizeos:generated/../../../../scripts/preview-site-template.mjs",
      alt: "A picture of the template's Endorsements page, for the Templates screen",
    },
    "page-volunteer.jpg": {
      url: volunteerPictureUrl,
      sourceUrl:
        "organizeos:generated/../../../../scripts/preview-site-template.mjs",
      alt: "A picture of the template's Volunteer page, for the Templates screen",
    },
    "page-events.jpg": {
      url: eventsPictureUrl,
      sourceUrl:
        "organizeos:generated/../../../../scripts/preview-site-template.mjs",
      alt: "A picture of the template's Events page, for the Templates screen",
    },
  },
  fonts: {
    "archivo-black-latin-400-normal.woff2": {
      url: archivoBlackUrl,
      family: "Archivo Black",
      licence: "OFL-1.1",
      source: "@fontsource/archivo-black",
    },
    "public-sans-latin-wght-normal.woff2": {
      url: publicSansUrl,
      family: "Public Sans",
      licence: "OFL-1.1",
      source: "@fontsource-variable/public-sans",
    },
  },
  pages: [home, issues, about, endorsements, volunteer, events],
  blockTokens,
};
