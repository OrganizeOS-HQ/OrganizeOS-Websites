import { css } from "@webstudio-is/template";
import { BREAKPOINT, SPACE, focusRing } from "../../kit";
import type { BlockStyle, SiteTemplate } from "../../types";
import { gridStyles } from "./styles";

// Field Journal's look for the platform blocks it places (SiteTemplate
// .blockTokens and the Event List's root style): the event cards in the
// Programs grid's idiom, and the Signup Form's fields and button in the
// template's own corners and forest accent. Every declaration replaces the
// block's own of the same key, so shorthands are written as the longhands
// the blocks declare.

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
  // The Programs cards' h3: Newsreader at 600, balanced.
  "OS Event Title": css`
    margin-top: ${SPACE[4]};
    font-size: 24px;
    font-weight: 600;
    line-height: 1.25;
    text-wrap-style: balance;
    ${BREAKPOINT.landscape} {
      font-size: 22px;
    }
  `,
  // The template's quiet link: underlined 1px, 2px on hover, as wide as its
  // words, with the kit's focus ring.
  "OS Event Link": [
    ...css`
      align-self: flex-start;
      text-decoration-thickness: 1px;
      text-underline-offset: 6px;
    `,
    ...css`
      &:hover {
        text-decoration-thickness: 2px;
      }
    `,
    ...focusRing(),
  ],
  // Fields outlined 1px in forest, as the box the form sits in, with the
  // buttons' 3px corners, at the page's 18px; an invalid field's 2px border
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
      border-top-left-radius: 3px;
      border-top-right-radius: 3px;
      border-bottom-left-radius: 3px;
      border-bottom-right-radius: 3px;
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
  // The template's button (kit buttonStyles with LOOK): forest, 3px corners,
  // 44px tall, as wide as its label.
  "OS Button": css`
    align-self: flex-start;
    min-height: 44px;
    padding-top: 0;
    padding-right: ${SPACE[24]};
    padding-bottom: 0;
    padding-left: ${SPACE[24]};
    border-top-left-radius: 3px;
    border-top-right-radius: 3px;
    border-bottom-left-radius: 3px;
    border-bottom-right-radius: 3px;
    font-size: 18px;
    line-height: 1.3;
    ${BREAKPOINT.landscape} {
      padding-right: ${SPACE[16]};
      padding-left: ${SPACE[16]};
    }
  `,
};

/**
 * The Event List's grid, as the Programs grid: three columns, two from 768px
 * to 991px, one on phones.
 */
export const eventGridStyle = (): BlockStyle => gridStyles(3, 2);
