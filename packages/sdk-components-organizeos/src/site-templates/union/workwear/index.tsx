import barlow400Url from "@fontsource/barlow/files/barlow-latin-400-normal.woff2?url&no-inline";
import barlow500Url from "@fontsource/barlow/files/barlow-latin-500-normal.woff2?url&no-inline";
import barlowCondensed700Url from "@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2?url&no-inline";
import { css } from "@webstudio-is/template";
import { BREAKPOINT } from "../../kit";
import type { SiteTemplate } from "../../types";
import aboutUrl from "./images/about.jpg?url&no-inline";
import heroUrl from "./images/hero.jpg?url&no-inline";
import { about } from "./pages/about";
import { contactPage } from "./pages/contact";
import { events } from "./pages/events";
import { home } from "./pages/home";
import { join } from "./pages/join";
import { knowYourRights } from "./pages/know-your-rights";
import { RULE } from "./styles";

// Workwear, the first Union or worker organization template (OrganizeOS spec
// 2026-10-30-website-template-inventory-design.md, section 5.1, template 3;
// its look is 2026-10-31-website-template-directions.md, section 2.3). Its
// pages are in ./pages; what they share is its look (./styles), its pieces
// (./parts) and the sections more than one page uses (./sections). The
// platform blocks wear its look through blockTokens below: square fields
// and button, and the Event List as ruled rows with a fixed date column.
//
// The photos are public domain works of United States federal agencies,
// from Wikimedia Commons, cropped, resized, turned to greys (about.jpg's
// levels stretched, as the faded slide was) and compressed. Painted out: in
// hero.jpg, a company's logo and slogan on a white hard hat, a company's name
// on a navy one, a name sticker on a third (each filled with the hat's own
// shading and grain, the third keeping the edge between its crown and brim)
// and a round sticker at the top edge (cloned from the hat beside it); in
// about.jpg, an ID badge on a breast pocket (filled with the pocket's cloth).
// Every photo slot shows its photo in greys too (`filter: grayscale(1)`), so
// a photo an org puts there takes the palette as these do; the hero's lies
// under the denim overlay (pages/home).

export const workwearTemplate: SiteTemplate = {
  id: "workwear",
  category: "union",
  name: "Workwear",
  oneLine: "For a local, chapter or workers' committee.",
  styleTags: ["sturdy", "plain-spoken", "photo-led"],
  status: "draft",
  dependsOn: [],
  thumbnail: "hero.jpg",
  variables: {
    base: "#E8EAEC",
    "accent-1": "#1F3557",
    "accent-2": "#C2470F",
    text: "#15181D",
    "font-heading": `"Barlow Condensed", "Arial Narrow", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
    "font-body": `"Barlow", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  },
  images: {
    "hero.jpg": {
      url: heroUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:BLM_Arizona_staff_huddle_(53166029612).jpg",
      alt: "Replace with a photo of your members at work or meeting together",
    },
    "about.jpg": {
      url: aboutUrl,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:WORKERS_AT_THE_UNION_CARBIDE_URANIUM_MILL_-_NARA_-_543651.jpg",
      alt: "Replace with a photo from the local's early days, or of two of its members",
    },
  },
  fonts: {
    "barlow-condensed-latin-700-normal.woff2": {
      url: barlowCondensed700Url,
      family: "Barlow Condensed",
      licence: "OFL-1.1",
      source: "@fontsource/barlow-condensed",
    },
    "barlow-latin-400-normal.woff2": {
      url: barlow400Url,
      family: "Barlow",
      licence: "OFL-1.1",
      source: "@fontsource/barlow",
    },
    "barlow-latin-500-normal.woff2": {
      url: barlow500Url,
      family: "Barlow",
      licence: "OFL-1.1",
      source: "@fontsource/barlow",
    },
  },
  pages: [home, about, knowYourRights, join, events, contactPage],
  blockTokens: {
    // The Signup Form: its heading set as the template's h3s are (uppercase,
    // condensed, tracked a little), square fields and button, the fields
    // 48px tall in the body size, the button the template's own (52px,
    // denim, 500).
    "OS Form Heading": css`
      font-size: 30px;
      font-weight: 700;
      line-height: 1.05;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      ${BREAKPOINT.landscape} {
        font-size: 26px;
      }
    `,
    "OS Field": css`
      row-gap: 8px;
    `,
    "OS Input": css`
      padding-top: 11px;
      padding-right: 12px;
      padding-bottom: 11px;
      padding-left: 12px;
      border-top-left-radius: 0;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-left-radius: 0;
      font-size: 18px;
      &[data-invalid] {
        padding-top: 10px;
        padding-right: 11px;
        padding-bottom: 10px;
        padding-left: 11px;
      }
    `,
    "OS Button": css`
      min-height: 52px;
      padding-top: 0;
      padding-right: 32px;
      padding-bottom: 0;
      padding-left: 32px;
      border-top-left-radius: 0;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-left-radius: 0;
      font-size: 18px;
      font-weight: 500;
    `,
    // An invalid field's message is marked by weight: Barlow's 500, the
    // heavier of the two it bundles, where the token asks for a 600 the
    // browser would synthesize.
    "OS Message": css`
      &[data-invalid] {
        font-weight: 500;
      }
    `,
    // The Event List as ruled rows (its root's own style, in
    // sections.tsx, draws the rule above the first): no card chrome, a
    // rule beneath each row, a fixed 56px date column with the month over
    // the day, large in accent-2, and the title in the heading face.
    "OS Card": css`
      padding-top: 24px;
      padding-right: 0;
      padding-bottom: 24px;
      padding-left: 0;
      border-top-width: 0;
      border-right-width: 0;
      border-bottom-width: ${RULE};
      border-left-width: 0;
      border-bottom-color: var(--text);
      border-top-left-radius: 0;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-left-radius: 0;
      background-color: transparent;
      ${BREAKPOINT.landscape} {
        padding-top: 16px;
        padding-bottom: 16px;
      }
    `,
    // No upcoming events (or none readable): one more ruled row, its line
    // set like a row's title.
    "OS Event Note": css`
      margin-top: 0;
      margin-bottom: 0;
      padding-top: 24px;
      padding-bottom: 24px;
      border-bottom-width: ${RULE};
      border-bottom-style: solid;
      border-bottom-color: var(--text);
      font-family: var(--font-heading);
      font-size: 26px;
      font-weight: 700;
      line-height: 1.05;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      ${BREAKPOINT.landscape} {
        padding-top: 16px;
        padding-bottom: 16px;
        font-size: 23px;
      }
    `,
    "OS Event Row": css`
      flex-wrap: nowrap;
      column-gap: 24px;
      ${BREAKPOINT.landscape} {
        column-gap: 16px;
      }
    `,
    "OS Event Date": css`
      align-items: flex-start;
      width: 56px;
      row-gap: 4px;
      font-family: var(--font-heading);
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-align: left;
      text-transform: uppercase;
    `,
    "OS Event Day": css`
      font-size: 44px;
      font-weight: 700;
      line-height: 0.9;
      letter-spacing: 0;
      color: var(--accent-2);
    `,
    "OS Event Title": css`
      font-size: 26px;
      font-weight: 700;
      line-height: 1.05;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      ${BREAKPOINT.landscape} {
        font-size: 23px;
      }
    `,
    "OS Event Link": css`
      font-weight: 500;
      text-decoration-thickness: 2px;
      text-underline-offset: 5px;
    `,
  },
};
