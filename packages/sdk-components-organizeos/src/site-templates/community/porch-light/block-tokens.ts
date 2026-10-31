import { css } from "@webstudio-is/template";
import { BREAKPOINT, SPACE } from "../../kit";
import type { BlockStyle, SiteTemplate } from "../../types";
import {
  cardPaddingStyles,
  gridStyles,
  outlineStyles,
  primaryButtonStyles,
  quietLinkStyles,
  subheadingStyles,
} from "./styles";

// Porch Light's look for the platform blocks it places (SiteTemplate
// .blockTokens and the Event List's root style): dated event cards like
// flyers on a noticeboard, outlined and padded as the volunteer cards are,
// each with a day-number chip; the list's empty line as an empty, dashed
// slot on the board; and the Signup Form's fields and button in the same
// outlines and pills. Each look is the template's own (./styles), so it is
// written once; every declaration replaces the block's own of the same key.

/** The chip's and the fields' corners, smaller than a card's. */
const SMALL_RADIUS = "14px";

export const blockTokens: SiteTemplate["blockTokens"] = {
  // The card: outlined and padded as the volunteer cards are, no shadow.
  "OS Card": [...outlineStyles(), ...cardPaddingStyles()],
  // "No upcoming events" (or "Events are unavailable"): an empty slot on the
  // noticeboard across the whole grid, outlined as the cards are but dashed,
  // with the line centred in the cards' title type.
  "OS Event Note": [
    ...outlineStyles("var(--text)", { style: "dashed" }),
    ...subheadingStyles(),
    ...css`
      grid-column-start: 1;
      grid-column-end: -1;
      padding-top: ${SPACE[48]};
      padding-right: ${SPACE[24]};
      padding-bottom: ${SPACE[48]};
      padding-left: ${SPACE[24]};
      text-align: center;
      ${BREAKPOINT.landscape} {
        padding-top: ${SPACE[32]};
        padding-bottom: ${SPACE[32]};
      }
    `,
  ],
  // The date chip over the details in a card, beside them in a phone's row;
  // a little closer on the smallest phones, where the card's padding leaves
  // the details least room.
  "OS Event Row": css`
    flex-direction: column;
    align-items: stretch;
    row-gap: ${SPACE[16]};
    ${BREAKPOINT.landscape} {
      flex-direction: row;
      align-items: flex-start;
      column-gap: ${SPACE[16]};
    }
    ${BREAKPOINT.portrait} {
      column-gap: ${SPACE[12]};
    }
  `,
  // The chip: the month over the day number, framed as the cards are, with
  // smaller corners; not filled, since accent-2 is held only against the
  // base.
  "OS Event Date": [
    ...outlineStyles("var(--text)", { radius: SMALL_RADIUS }),
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
      ${BREAKPOINT.portrait} {
        width: 56px;
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
  // An item's h3, a size smaller in a 320px phone's row beside the chip.
  "OS Event Title": [
    ...subheadingStyles(),
    ...css`
      ${BREAKPOINT.portrait} {
        font-size: 21px;
      }
    `,
  ],
  // The template's quiet link, as wide as its words.
  "OS Event Link": [
    ...quietLinkStyles(),
    ...css`
      align-self: flex-start;
    `,
  ],
  // Fields outlined as the chip is, at the page's 18px and the buttons'
  // 52px; an invalid field's border is 3px, its extra pixel taken from the
  // padding.
  "OS Input": [
    ...outlineStyles("var(--text)", { radius: SMALL_RADIUS }),
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
  // The template's primary button, the berry pill, as wide as its label and
  // full width on phones, at the page's 18px.
  "OS Button": [
    ...primaryButtonStyles(),
    ...css`
      align-self: flex-start;
      font-size: 18px;
    `,
  ],
};

/**
 * The Event List's grid: three cards up, two from 768px to 991px, and on
 * phones one column of rows.
 */
export const eventGridStyle = (): BlockStyle => gridStyles(3, { tablet: 2 });
