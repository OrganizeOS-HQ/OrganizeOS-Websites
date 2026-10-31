import { css, type TemplateStyleDecl } from "@webstudio-is/template";
import {
  BREAKPOINT,
  CONTAINER,
  type KitStyle,
  SPACE,
  focusRing,
  tapTarget,
} from "../../kit";

// Workwear's look (OrganizeOS spec
// 2026-10-31-website-template-directions.md, section 2.3): sturdy and
// plain-spoken, like a well-made notice on a break-room board. Barlow
// Condensed headings at 700, uppercase and slightly tracked, over Barlow at
// 18px (400 and 500, the two weights it bundles); square corners everywhere;
// rules and ruled grids in the text colour instead of cards. Accent-2 is
// large text only (numerals of at least 24px) and the focus ring, never body
// text, labels or links: it is 4.14:1 on the base, which large text and a
// ring pass and small text does not. The styles every piece and page draws
// with.

/** The template's corners (square: none set) and weights, for the kit. */
export const LOOK: KitStyle = {
  buttonWeight: 500,
  headingWeight: 700,
};

/** The page's own type and colours, which every section inherits. */
export const bodyStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  background-color: var(--base);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 18px;
  font-weight: 400;
  line-height: 1.55;
`;

// The type scale. Headings in --font-heading at 700, uppercase with a
// little tracking, balanced over their lines; sizes by clamp() between a
// phone's and a wide window's.

const headingBase = (tracking = "0.01em"): TemplateStyleDecl[] => css`
  margin: 0;
  font-family: var(--font-heading);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: ${tracking};
  text-wrap-style: balance;
`;

/** The hero's h1: up to 96px, stacked over up to three lines. */
export const displayStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: clamp(44px, 4.4vw + 26px, 96px);
    line-height: 0.94;
  `,
];

/** A page header's h1: up to 76px. */
export const titleStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: clamp(40px, 2.8vw + 28px, 76px);
    line-height: 0.96;
  `,
];

/** A section's h2: up to 56px. */
export const headingStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: clamp(34px, 1.6vw + 26px, 56px);
    line-height: 1;
  `,
];

/** An item's h3: 28px, 25px on phones, or the sizes given. */
export const subheadingStyles = (
  size = "28px",
  phoneSize = "25px"
): TemplateStyleDecl[] => [
  ...headingBase("0.02em"),
  ...css`
    font-size: ${size};
    line-height: 1.05;
    ${BREAKPOINT.landscape} {
      font-size: ${phoneSize};
    }
  `,
];

/**
 * A label over a heading or an item, in the surrounding text colour (on the
 * base or a band alike): condensed capitals, widely tracked.
 */
export const labelStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  font-family: var(--font-heading);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

/**
 * A large numeral in accent-2: a value's number, a figure, an event's day.
 * Only ever 24px or more, on the base (accent-2 is checked against the base
 * alone, at the 3:1 of large text).
 */
export const numeralStyles = (size: string): TemplateStyleDecl[] => [
  ...headingBase("0.01em"),
  ...css`
    font-size: ${size};
    line-height: 0.9;
    color: var(--accent-2);
    font-variant-numeric: lining-nums tabular-nums;
  `,
];

/** The sentence under a hero's or a page header's h1. */
export const leadStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  max-width: 34em;
  font-size: 20px;
  line-height: 1.5;
  text-wrap-style: pretty;
  ${BREAKPOINT.landscape} {
    font-size: 18px;
  }
`;

/** Running text, at most the 65-character measure, with no lone last word. */
export const paragraphStyles = (
  maxWidth: string = CONTAINER.text
): TemplateStyleDecl[] => css`
  margin: 0;
  max-width: ${maxWidth};
  text-wrap-style: pretty;
`;

/** A rule's weight: 2px, sturdy. */
export const RULE = "2px";

/** A full-width rule above an item, in the surrounding text colour. */
export const ruleAboveStyles = (): TemplateStyleDecl[] => css`
  border-top-width: ${RULE};
  border-top-style: solid;
  border-top-color: currentcolor;
`;

/** A stack of children with a gap. */
export const stackStyles = (gap: string): TemplateStyleDecl[] => css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  row-gap: ${gap};
`;

/**
 * A ruled grid: `columns` cells a row (`tablet` from 768px to 991px,
 * `phone` below 768px), sharing 2px rules in the text colour, the outer
 * edge included. The grid draws the top and left rules and each cell
 * (`ruledCellStyles`) its right and bottom ones, so a rule is never doubled
 * however many cells the last row holds.
 */
export const ruledGridStyles = ({
  columns,
  tablet = columns,
  phone = 1,
}: {
  columns: number;
  tablet?: number;
  phone?: number;
}): TemplateStyleDecl[] => css`
  display: grid;
  grid-template-columns: repeat(${String(columns)}, minmax(0, 1fr));
  border-top-width: ${RULE};
  border-top-style: solid;
  border-top-color: var(--text);
  border-left-width: ${RULE};
  border-left-style: solid;
  border-left-color: var(--text);
  ${BREAKPOINT.tablet} {
    grid-template-columns: repeat(${String(tablet)}, minmax(0, 1fr));
  }
  ${BREAKPOINT.landscape} {
    grid-template-columns: repeat(${String(phone)}, minmax(0, 1fr));
  }
`;

/** A cell of a ruled grid: its right and bottom rules, and its padding. */
export const ruledCellStyles = (): TemplateStyleDecl[] => css`
  box-sizing: border-box;
  min-width: 0;
  padding-top: ${SPACE[24]};
  padding-right: ${SPACE[24]};
  padding-bottom: ${SPACE[24]};
  padding-left: ${SPACE[24]};
  border-right-width: ${RULE};
  border-right-style: solid;
  border-right-color: var(--text);
  border-bottom-width: ${RULE};
  border-bottom-style: solid;
  border-bottom-color: var(--text);
  ${BREAKPOINT.landscape} {
    padding-top: ${SPACE[16]};
    padding-right: ${SPACE[16]};
    padding-bottom: ${SPACE[16]};
    padding-left: ${SPACE[16]};
  }
`;

/**
 * A square button's shape: at least 52px tall, its label centred, in the
 * body font at 500. Its colours are the caller's.
 */
const buttonShape = (): TemplateStyleDecl[] => css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 52px;
  padding-left: ${SPACE[32]};
  padding-right: ${SPACE[32]};
  border-width: ${RULE};
  border-style: solid;
  font-weight: 500;
  line-height: 1.3;
  text-align: center;
  text-decoration-line: none;
  ${BREAKPOINT.landscape} {
    padding-left: ${SPACE[24]};
    padding-right: ${SPACE[24]};
  }
`;

/** The primary button on the base: denim, labelled in the base colour. */
export const solidButtonStyles = (): TemplateStyleDecl[] => [
  ...buttonShape(),
  ...css`
    border-top-color: var(--accent-1);
    border-right-color: var(--accent-1);
    border-bottom-color: var(--accent-1);
    border-left-color: var(--accent-1);
    background-color: var(--accent-1);
    color: var(--base);
  `,
  ...focusRing(),
];

/**
 * The primary button on denim (the hero): the base colour, labelled in
 * denim, the band's own pair the other way round.
 */
export const invertedButtonStyles = (): TemplateStyleDecl[] => [
  ...buttonShape(),
  ...css`
    border-top-color: var(--base);
    border-right-color: var(--base);
    border-bottom-color: var(--base);
    border-left-color: var(--base);
    background-color: var(--base);
    color: var(--accent-1);
  `,
  ...focusRing(),
];

/**
 * A button outlined 2px in the surrounding text colour, with no fill: the
 * base colour on a denim band.
 */
export const outlinedButtonStyles = (): TemplateStyleDecl[] => [
  ...buttonShape(),
  ...css`
    border-top-color: currentcolor;
    border-right-color: currentcolor;
    border-bottom-color: currentcolor;
    border-left-color: currentcolor;
    background-color: transparent;
    color: inherit;
  `,
  ...focusRing(),
];

/** A link that reads as one: underlined, in the text colour, 44px tall. */
export const quietLinkStyles = (): TemplateStyleDecl[] => [
  ...tapTarget(),
  ...css`
    color: inherit;
    font-weight: 500;
    text-decoration-line: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 5px;
    &:hover {
      text-decoration-thickness: 3px;
    }
  `,
  ...focusRing(),
];
