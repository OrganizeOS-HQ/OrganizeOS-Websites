import { css } from "@webstudio-is/template";
import { BREAKPOINT, SPACE, focusRing } from "../../kit";
import type { BlockStyle, SiteTemplate } from "../../types";
import { RADIUS, gridStyles } from "./styles";

// Porch Light's look for the platform blocks it places (SiteTemplate
// .blockTokens and the Event List's root style): dated event cards like
// flyers on a noticeboard, outlined 2px in the text colour with the
// template's 20px corners, each with a day-number chip; the list's empty
// line as an empty, dashed slot on the board; and the Signup Form's fields
// and button in the same outlines and pills. Every
// declaration replaces the block's own of the same key, so shorthands are
// written as the longhands the blocks declare.

/**
 * A 2px outline in the text colour with corners of `radius`, solid unless
 * `style` says otherwise; its style is written out, since the date column
 * and the note declare no border of their own.
 */
const outline = (radius: string, style: "solid" | "dashed" = "solid") => css`
  border-top-style: ${style};
  border-right-style: ${style};
  border-bottom-style: ${style};
  border-left-style: ${style};
  border-top-width: 2px;
  border-right-width: 2px;
  border-bottom-width: 2px;
  border-left-width: 2px;
  border-top-color: var(--text);
  border-right-color: var(--text);
  border-bottom-color: var(--text);
  border-left-color: var(--text);
  border-top-left-radius: ${radius};
  border-top-right-radius: ${radius};
  border-bottom-left-radius: ${radius};
  border-bottom-right-radius: ${radius};
`;

export const blockTokens: SiteTemplate["blockTokens"] = {
  // The card: outlined, with no shadow, as the volunteer cards are.
  "OS Card": [
    ...outline(RADIUS),
    ...css`
      padding-top: ${SPACE[24]};
      padding-right: ${SPACE[24]};
      padding-bottom: ${SPACE[24]};
      padding-left: ${SPACE[24]};
      ${BREAKPOINT.portrait} {
        padding-top: ${SPACE[16]};
        padding-right: ${SPACE[16]};
        padding-bottom: ${SPACE[16]};
        padding-left: ${SPACE[16]};
      }
    `,
  ],
  // "No upcoming events" (or "Events are unavailable"): an empty slot on the
  // noticeboard across the whole grid, outlined as the cards are but dashed,
  // with the line centred in the cards' title type.
  "OS Event Note": [
    ...outline(RADIUS, "dashed"),
    ...css`
      grid-column-start: 1;
      grid-column-end: -1;
      margin-top: 0;
      margin-bottom: 0;
      padding-top: ${SPACE[48]};
      padding-right: ${SPACE[24]};
      padding-bottom: ${SPACE[48]};
      padding-left: ${SPACE[24]};
      font-family: var(--font-heading);
      font-size: 26px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.015em;
      text-align: center;
      text-wrap-style: balance;
      ${BREAKPOINT.landscape} {
        padding-top: ${SPACE[32]};
        padding-bottom: ${SPACE[32]};
        font-size: 23px;
      }
    `,
  ],
  // The date chip over the details in a card, beside them in a phone's row.
  "OS Event Row": css`
    flex-direction: column;
    align-items: stretch;
    row-gap: ${SPACE[16]};
    ${BREAKPOINT.landscape} {
      flex-direction: row;
      align-items: flex-start;
      column-gap: ${SPACE[16]};
    }
  `,
  // The chip: the month over the day number, framed as the cards are, with
  // smaller corners; not filled, since accent-2 is held only against the
  // base.
  "OS Event Date": [
    ...outline("14px"),
    ...css`
      width: 76px;
      box-sizing: border-box;
      padding-top: ${SPACE[8]};
      padding-bottom: 10px;
      row-gap: 2px;
      background-color: var(--base);
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      ${BREAKPOINT.landscape} {
        width: 64px;
      }
    `,
  ],
  // The day number: large, in the heading font at 800, in teal.
  "OS Event Day": css`
    font-size: 44px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--accent-2);
    ${BREAKPOINT.landscape} {
      font-size: 36px;
    }
  `,
  // An item's h3 (./styles subheadingStyles).
  "OS Event Title": css`
    font-size: 26px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.015em;
    text-wrap-style: balance;
    ${BREAKPOINT.landscape} {
      font-size: 23px;
    }
    ${BREAKPOINT.portrait} {
      font-size: 21px;
    }
  `,
  // The template's quiet link: bold, underlined 2px, teal on hover, as wide
  // as its words, with the kit's focus ring.
  "OS Event Link": [
    ...css`
      align-self: flex-start;
      font-weight: 700;
      text-decoration-thickness: 2px;
      text-underline-offset: 6px;
    `,
    ...css`
      &:hover {
        text-decoration-color: var(--accent-2);
      }
    `,
    ...focusRing(),
  ],
  // Fields outlined 2px in the text colour, with rounded corners, at the
  // page's 18px and the buttons' 52px; an invalid field's border is 3px,
  // its extra pixel taken from the padding.
  "OS Input": [
    ...outline("14px"),
    ...css`
      padding-top: 11px;
      padding-right: 18px;
      padding-bottom: 11px;
      padding-left: 18px;
      font-size: 18px;
    `,
    ...css`
      &[data-invalid] {
        padding-top: 10px;
        padding-right: 17px;
        padding-bottom: 10px;
        padding-left: 17px;
        border-top-width: 3px;
        border-right-width: 3px;
        border-bottom-width: 3px;
        border-left-width: 3px;
      }
    `,
  ],
  // The template's primary button (./styles primaryButtonStyles): a berry
  // pill, 52px tall, as wide as its label, full width on phones.
  "OS Button": css`
    align-self: flex-start;
    min-height: 52px;
    padding-top: 0;
    padding-right: ${SPACE[32]};
    padding-bottom: 0;
    padding-left: ${SPACE[32]};
    border-top-left-radius: 999px;
    border-top-right-radius: 999px;
    border-bottom-left-radius: 999px;
    border-bottom-right-radius: 999px;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.3;
    ${BREAKPOINT.landscape} {
      align-self: stretch;
    }
  `,
};

/**
 * The Event List's grid: three cards up, two from 768px to 991px, and on
 * phones one column of rows.
 */
export const eventGridStyle = (): BlockStyle => gridStyles(3, { tablet: 2 });
