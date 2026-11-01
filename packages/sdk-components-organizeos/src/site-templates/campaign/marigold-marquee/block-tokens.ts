import { css } from "@webstudio-is/template";
import { ACCENT_TEXT, BREAKPOINT, SPACE, focusRing } from "../../kit";
import type { BlockStyle, SiteTemplate } from "../../types";
import { HAIRLINE, RADIUS } from "./styles";

// Marigold Marquee's look for the platform blocks it places
// (SiteTemplate.blockTokens, and each events block's root style): the
// featured event as a cover card with no chrome of its own (the marigold
// panel around it is the frame), the Event List as dated rows with a mint
// date column, each under a hairline, the empty line ruled as a row,
// and the Signup Form's fields and button in the template's 6px corners.
// Every declaration replaces the block's own of the same key, so shorthands
// are written as the longhands the blocks declare.

export const blockTokens: SiteTemplate["blockTokens"] = {
  // A card has no box: the featured card sits in the marigold panel, and a
  // dated card's row draws its own hairline (OS Event Row).
  "OS Card": css`
    row-gap: ${SPACE[12]};
    padding-top: 0;
    padding-right: 0;
    padding-bottom: 0;
    padding-left: 0;
    border-top-width: 0;
    border-right-width: 0;
    border-bottom-width: 0;
    border-left-width: 0;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    background-color: transparent;
  `,
  // A cover photo cropped 3:2 with the template's corners, whatever the org
  // uploads.
  "OS Event Cover": css`
    aspect-ratio: 3 / 2;
    object-fit: cover;
    margin-bottom: ${SPACE[4]};
    border-top-left-radius: ${RADIUS};
    border-top-right-radius: ${RADIUS};
    border-bottom-left-radius: ${RADIUS};
    border-bottom-right-radius: ${RADIUS};
  `,
  // A card's title in Archivo Black, at its one weight.
  "OS Event Title": css`
    font-size: 28px;
    font-weight: 400;
    line-height: 1.15;
    letter-spacing: -0.01em;
    text-wrap-style: balance;
    ${BREAKPOINT.landscape} {
      font-size: 23px;
    }
  `,
  // The template's link: mint (in a band's text colour on a band,
  // ACCENT_TEXT, as the date's and the day's), underlined 2px, as wide as its
  // words, with the kit's focus ring.
  "OS Event Link": [
    ...css`
      align-self: flex-start;
      color: ${ACCENT_TEXT};
      text-decoration-thickness: 2px;
      text-underline-offset: 6px;
    `,
    ...css`
      &:hover {
        text-decoration-thickness: 3px;
      }
    `,
    ...focusRing(),
  ],
  // A dated card's row: the date column and the details, under a hairline,
  // as the issues' rows are; the list spaces the rows (eventListStyle).
  "OS Event Row": css`
    flex-wrap: nowrap;
    column-gap: ${SPACE[24]};
    padding-top: ${SPACE[24]};
    border-top-width: 1px;
    border-top-style: solid;
    border-top-color: ${HAIRLINE};
    ${BREAKPOINT.landscape} {
      column-gap: ${SPACE[16]};
      padding-top: ${SPACE[16]};
    }
  `,
  // The date column: the month in mint capitals over the day, large in
  // Archivo Black, left-aligned in a fixed 72px column (64px on phones).
  "OS Event Date": css`
    align-items: flex-start;
    width: 72px;
    row-gap: ${SPACE[4]};
    color: ${ACCENT_TEXT};
    font-size: 15px;
    letter-spacing: 0.1em;
    text-align: left;
    text-transform: uppercase;
    ${BREAKPOINT.landscape} {
      width: 64px;
    }
  `,
  "OS Event Day": css`
    font-size: 48px;
    font-weight: 400;
    line-height: 0.9;
    letter-spacing: -0.02em;
    color: ${ACCENT_TEXT};
    ${BREAKPOINT.landscape} {
      font-size: 40px;
    }
  `,
  // No upcoming events (or none readable): a line under a hairline, set like
  // a card's title, so on the Events page it is one more ruled row between
  // the hairlines the list's rows sit between (eventListStyle closes it).
  "OS Event Note": css`
    margin-top: 0;
    margin-bottom: 0;
    padding-top: ${SPACE[24]};
    border-top-width: 1px;
    border-top-style: solid;
    border-top-color: ${HAIRLINE};
    font-family: var(--font-heading);
    font-size: 24px;
    line-height: 1.2;
    ${BREAKPOINT.landscape} {
      padding-top: ${SPACE[16]};
      font-size: 22px;
    }
  `,
  // The Signup Form's heading, as an item's h3: Archivo Black at its one
  // weight, flush with the top of the panel it sits in, a little space above
  // the first field.
  "OS Form Heading": css`
    margin-top: 0;
    margin-bottom: ${SPACE[8]};
    font-size: 28px;
    font-weight: 400;
    line-height: 1.15;
    letter-spacing: -0.01em;
    text-wrap-style: balance;
    ${BREAKPOINT.landscape} {
      font-size: 24px;
    }
  `,
  // The Signup Form: fields 18px with the template's corners (the token's
  // own 6px), about 50px tall; an invalid field's 2px border still takes its
  // pixel from the padding.
  "OS Field": css`
    row-gap: ${SPACE[8]};
  `,
  "OS Input": [
    ...css`
      padding-top: 10px;
      padding-right: 14px;
      padding-bottom: 10px;
      padding-left: 14px;
      font-size: 18px;
    `,
    ...css`
      &[data-invalid] {
        padding-top: 9px;
        padding-right: 13px;
        padding-bottom: 9px;
        padding-left: 13px;
      }
    `,
  ],
  // The template's button: marigold, 52px tall, 600, as wide as its label;
  // full width on phones, as the template's buttons are.
  "OS Button": css`
    align-self: flex-start;
    min-height: 52px;
    padding-top: 0;
    padding-right: ${SPACE[32]};
    padding-bottom: 0;
    padding-left: ${SPACE[32]};
    font-size: 18px;
    line-height: 1.3;
    ${BREAKPOINT.landscape} {
      align-self: stretch;
    }
  `,
};

/**
 * The Event Card's root in the featured panel: one column, as tall as its
 * card or its empty line (the panel centres it beside the text).
 */
export const eventCardStyle = (): BlockStyle => css`
  grid-template-columns: minmax(0, 1fr);
`;

/**
 * The Event List's root on the Events page: one column of rows, each under
 * a hairline (OS Event Row), and the list closed by one beneath its last
 * row, as the issues' rows are; with no events, beneath its one ruled line
 * (OS Event Note).
 */
export const eventListStyle = (): BlockStyle => css`
  grid-template-columns: minmax(0, 1fr);
  column-gap: 0;
  row-gap: ${SPACE[24]};
  padding-bottom: ${SPACE[24]};
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: ${HAIRLINE};
  ${BREAKPOINT.landscape} {
    row-gap: ${SPACE[16]};
    padding-bottom: ${SPACE[16]};
  }
`;
