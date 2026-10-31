import ibmPlexSansUrl from "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url&no-inline";
import instrumentSerifUrl from "@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url&no-inline";
import { css } from "@webstudio-is/template";
import { BREAKPOINT, SPACE } from "../../kit";
import type { SiteTemplate } from "../../types";
import { home } from "./home";
import heroUrl from "./images/hero.jpg?url&no-inline";
import thumbnailUrl from "./images/thumbnail.jpg?url&no-inline";
import { RULE } from "./styles";

// Riso Broadside, the first Single-issue drive or petition template
// (OrganizeOS spec 2026-10-30-website-template-inventory-design.md, section
// 5.1, template 5; its look is 2026-10-31-website-template-directions.md,
// section 2.5): one page for one goal. Its page is ./home; its hero is
// ./hero, its other sections ./sections, its nav and footer ./parts, all
// drawn with its look (./styles). The Signup Form, the stand-in for a
// petition until a petition block exists, wears its look through
// blockTokens below: an Instrument Serif heading, square fields in 2px
// outlines and a square blue button, its label the page's ask.
//
// The photo is a public domain work of a United States federal agency, from
// Wikimedia Commons: Dan McCoy's photograph for DOCUMERICA (the
// Environmental Protection Agency's 1970s photographic survey, in the
// National Archives) of people reading the handouts at a public forum in
// New York, August 1973. It is cropped inside the slide's border, turned to
// greys with the weights of CSS `grayscale()`, its levels stretched, its
// midtones lifted (gamma 0.7), and compressed, since the slide is
// low-key and the duotone sets its shadows in ink. Painted out: a printed
// mark (a ring and a wave) on the cover of a booklet on a lap, filled with
// the cover's own shading and grain. The hero shows it in duotone
// (./hero), so a photo an org puts there takes the palette the same way.
//
// thumbnail.jpg, the chooser's picture, is OrganizeOS's own: the top of Home as
// the preview tool draws it, which `corepack pnpm preview:template
// riso-broadside --thumbnail` writes. No page shows it, so applying never
// uploads it.

export const risoBroadsideTemplate: SiteTemplate = {
  id: "riso-broadside",
  category: "single-issue",
  name: "Riso Broadside",
  oneLine: "One page for one goal.",
  styleTags: ["urgent", "printed", "photo-led"],
  status: "draft",
  dependsOn: [],
  thumbnail: "thumbnail.jpg",
  variables: {
    base: "#FFFFFF",
    "accent-1": "#2B2FC9",
    "accent-2": "#C8006A",
    text: "#111114",
    "font-heading": `"Instrument Serif", Georgia, "Times New Roman", serif`,
    "font-body": `"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  },
  images: {
    "hero.jpg": {
      url: heroUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:CITIZENS%27_MEETING_ON_TRANSPORTATION,_A_FORUM_ON_%22STRATEGIES_FOR_CLEAN_AIR%22_PUT_FORTH_BY_NEW_YORK_CITY_EPA_-_NARA_-_554332.jpg",
      alt: "Replace with a photo of the people behind the ask, together",
    },
    "thumbnail.jpg": {
      url: thumbnailUrl,
      sourceUrl:
        "organizeos:generated/../../../../scripts/preview-site-template.mjs",
      alt: "A picture of the template's Home page, for the template chooser",
    },
  },
  fonts: {
    "instrument-serif-latin-400-normal.woff2": {
      url: instrumentSerifUrl,
      family: "Instrument Serif",
      licence: "OFL-1.1",
      source: "@fontsource/instrument-serif",
    },
    "ibm-plex-sans-latin-wght-normal.woff2": {
      url: ibmPlexSansUrl,
      family: "IBM Plex Sans",
      licence: "OFL-1.1",
      source: "@fontsource-variable/ibm-plex-sans",
    },
  },
  pages: [home],
  blockTokens: {
    // The Signup Form's heading set as the page's h2s are: Instrument Serif
    // at its one weight (an h2 would otherwise ask for a bold the browser
    // synthesizes), with no margins of its own: the form box pads it.
    "OS Form Heading": css`
      margin-top: 0;
      margin-bottom: 0;
      font-size: 44px;
      font-weight: 400;
      line-height: 1.02;
      letter-spacing: -0.01em;
      ${BREAKPOINT.landscape} {
        font-size: 38px;
      }
    `,
    "OS Field": css`
      row-gap: ${SPACE[8]};
    `,
    // Square fields in the page's 2px outline, in the body size, 51px tall;
    // an invalid field's border is 3px, its extra pixel taken from the
    // padding, so the field keeps its size.
    "OS Input": css`
      padding-top: 10px;
      padding-right: 14px;
      padding-bottom: 10px;
      padding-left: 14px;
      border-top-width: ${RULE};
      border-right-width: ${RULE};
      border-bottom-width: ${RULE};
      border-left-width: ${RULE};
      border-top-left-radius: 0;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-left-radius: 0;
      font-size: 18px;
      &[data-invalid] {
        padding-top: 9px;
        padding-right: 13px;
        padding-bottom: 9px;
        padding-left: 13px;
        border-top-width: 3px;
        border-right-width: 3px;
        border-bottom-width: 3px;
        border-left-width: 3px;
      }
    `,
    // The template's own button: square, 52px tall, Plex at 600, blue.
    "OS Button": css`
      min-height: 52px;
      padding-top: 0;
      padding-right: ${SPACE[32]};
      padding-bottom: 0;
      padding-left: ${SPACE[32]};
      border-top-left-radius: 0;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-left-radius: 0;
      font-size: 18px;
    `,
  },
};
