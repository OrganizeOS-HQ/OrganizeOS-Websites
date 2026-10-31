import archivoBlackUrl from "@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2?url&no-inline";
import publicSansUrl from "@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2?url&no-inline";
import type { SiteTemplate } from "../../types";
import { blockTokens } from "./block-tokens";
import aboutUrl from "./images/about.jpg?url&no-inline";
import heroUrl from "./images/hero.jpg?url&no-inline";
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
// its pieces (./parts), the sections more than one page uses (./sections)
// and the sample items (./sample-content); its look for the platform blocks
// it places is ./block-tokens. Donate is the platform's /donate, linked,
// never a page of the template. Neutral for any party or none: no party,
// position, real person or place is named, and no photo shows a face that
// could be read as the candidate's.
//
// The two portraits are CC0 photos from Unsplash (2016 and 2017, before its
// licence changed), by way of Wikimedia Commons, each a figure in
// silhouette: cropped 4:5, resized and compressed. volunteer.jpg is a public
// domain work of the US Army Corps of Engineers, from Wikimedia Commons,
// cropped, resized and compressed; painted out: the agency's red mark and the
// two lines of its name on the comment card at the front (filled with the
// card's own paper and grain), and the crop leaves out that card's QR code.

export const marigoldMarqueeTemplate: SiteTemplate = {
  id: "marigold-marquee",
  category: "campaign",
  name: "Marigold Marquee",
  oneLine: "For a candidate, ballot measure or chapter.",
  styleTags: ["confident", "high-contrast", "dark"],
  status: "draft",
  dependsOn: [],
  thumbnail: "hero.jpg",
  // the preview's sample event cover: a photo on no page with events, so
  // Home never shows one twice
  previewEventCover: "volunteer.jpg",
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
        "https://commons.wikimedia.org/wiki/File:Silhouette_in_front_of_window_(Unsplash).jpg",
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
        "https://commons.wikimedia.org/wiki/File:LMR_Comp_scoping_meeting,_Hahnville,_03.05.2024_-_10.jpg",
      alt: "Replace with a photo of your volunteers signing in for a shift",
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
