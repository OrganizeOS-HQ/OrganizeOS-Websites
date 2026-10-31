import { css } from "@webstudio-is/template";
import { BREAKPOINT, SPACE, buttonStyles } from "../../kit";
import type { BlockStyle, SiteTemplate } from "../../types";
import {
  LOOK,
  gridStyles,
  quietLinkStyles,
  ruleStyles,
  subheadingStyles,
} from "./styles";

// Field Journal's look for the platform blocks it places (SiteTemplate
// .blockTokens and the Event List's root style): the event cards in the
// Programs grid's idiom, the list's empty line as a ruled note across it,
// and the Signup Form's fields and button in the template's own corners and
// forest accent. Where a look is the template's own (./styles, the kit's
// buttons) it is used, not restated; every declaration replaces the block's
// own of the same key, so shorthands are written as the longhands the
// blocks declare.

export const blockTokens: SiteTemplate["blockTokens"] = {
  // A card is the Programs card without its photo slot: no box, a 1px rule
  // in the text colour above, the cover photo (when the event has one) and
  // the text beneath it. The title's 4px (below) makes the rule's 12px the
  // template's 16px over a card's first text, and sets a cover photo 12px
  // from the rule and from the title alike.
  "OS Card": css`
    row-gap: ${SPACE[8]};
    padding-top: ${SPACE[12]};
    padding-right: 0;
    padding-bottom: 0;
    padding-left: 0;
    border-top-width: 1px;
    border-right-width: 0;
    border-bottom-width: 0;
    border-left-width: 0;
    border-top-color: var(--text);
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  `,
  // A cover photo cropped to the Programs photos' 3:2, square, whatever the
  // org uploads.
  "OS Event Cover": css`
    aspect-ratio: 3 / 2;
    object-fit: cover;
  `,
  // "No upcoming events" (or "Events are unavailable"), across the whole
  // grid under the cards' 1px rule, in Newsreader at the cards' title size:
  // the section's first view for a new org reads as a page of the journal,
  // not a line left over.
  "OS Event Note": [
    ...ruleStyles(),
    ...css`
      grid-column-start: 1;
      grid-column-end: -1;
      margin-top: 0;
      margin-bottom: 0;
      font-family: var(--font-heading);
      font-size: 24px;
      font-weight: 400;
      line-height: 1.3;
      ${BREAKPOINT.landscape} {
        font-size: 22px;
      }
    `,
  ],
  // The Programs cards' h3, with the card's 4px over it (above).
  "OS Event Title": [
    ...subheadingStyles().filter(({ property }) => property !== "margin-top"),
    ...css`
      margin-top: ${SPACE[4]};
    `,
  ],
  // The template's quiet link, as wide as its words.
  "OS Event Link": [
    ...quietLinkStyles(),
    ...css`
      align-self: flex-start;
    `,
  ],
  // Fields outlined 1px in forest, as the box the form sits in, with the
  // buttons' corners, at the page's 18px; an invalid field's 2px border
  // still takes its pixel from the padding.
  "OS Input": [
    ...css`
      padding-top: 9px;
      padding-right: 12px;
      padding-bottom: 9px;
      padding-left: 12px;
      border-top-color: var(--accent-1);
      border-right-color: var(--accent-1);
      border-bottom-color: var(--accent-1);
      border-left-color: var(--accent-1);
      border-radius: ${LOOK.buttonRadius ?? "0"};
      font-size: 18px;
    `,
    ...css`
      &[data-invalid] {
        padding-top: 8px;
        padding-right: 11px;
        padding-bottom: 8px;
        padding-left: 11px;
      }
    `,
  ],
  // The template's button (the kit's, with LOOK), as wide as its label, at
  // the page's 18px, 44px tall as the nav's.
  "OS Button": [
    ...buttonStyles(LOOK),
    ...css`
      align-self: flex-start;
      padding-top: 0;
      padding-bottom: 0;
      font-size: 18px;
      line-height: 1.3;
    `,
  ],
};

/**
 * The Event List's grid, as the Programs grid: three columns, two from 768px
 * to 991px, one on phones.
 */
export const eventGridStyle = (): BlockStyle => gridStyles(3, 2);
