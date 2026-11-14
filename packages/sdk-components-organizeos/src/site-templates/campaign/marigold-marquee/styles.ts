import { css, type TemplateStyleDecl } from "@webstudio-is/template";
import {
  BREAKPOINT,
  CONTAINER,
  type KitStyle,
  SPACE,
  focusRing,
  tapTarget,
} from "../../kit";

// Marigold Marquee's look (OrganizeOS spec
// 2026-10-31-website-template-directions.md, section 2.4): confident and
// high-contrast, read at a glance on a phone. An ink page with marigold
// buttons and mint highlights; Archivo Black headings in sentence case over
// Public Sans at 18px (400 and 600); 6px corners on buttons, cards, photos
// and the form. Archivo Black has one weight: every heading asks for 400,
// and the page turns off synthesized bold, so a heading the template does
// not style (the Signup Form's own) keeps the face's true weight rather than
// a smeared fake bold. Mint (accent-2) is for the base alone: on a band the
// labels and links take the band's text colour. The styles every piece and
// page draws with.

/** The template's corners and weights, for the kit. */
export const LOOK = {
  buttonRadius: "6px",
  buttonWeight: 600,
  headingWeight: 400,
} satisfies KitStyle;

/** The corners of buttons, cards, photos and panels. */
export const RADIUS = "6px";

/** The page's own type and colours, which every section inherits. */
export const bodyStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  background-color: var(--base);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 18px;
  font-weight: 400;
  line-height: 1.55;
  font-synthesis-weight: none;
`;

// The type scale. Headings in --font-heading at its one weight, a hair
// tight, balanced over their lines; sizes by clamp() between a phone's and a
// wide window's.

const headingBase = (): TemplateStyleDecl[] => css`
  margin: 0;
  font-family: var(--font-heading);
  font-weight: 400;
  letter-spacing: -0.01em;
  text-wrap-style: balance;
`;

/** The hero's h1: heavy, up to 84px, two lines on a wide window. */
export const displayStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: clamp(44px, 3.6vw + 30px, 84px);
    line-height: 1.02;
    letter-spacing: -0.02em;
  `,
];

/** A page header's h1: up to 64px. */
export const titleStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: clamp(38px, 2.4vw + 26px, 64px);
    line-height: 1.05;
  `,
];

/** A section's h2: up to 48px. */
export const headingStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: clamp(30px, 1.6vw + 22px, 48px);
    line-height: 1.08;
  `,
];

/** An item's h3: 26px, 22px on phones, or the sizes given. */
export const subheadingStyles = (
  size = "26px",
  phoneSize = "22px"
): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: ${size};
    line-height: 1.15;
    ${BREAKPOINT.landscape} {
      font-size: ${phoneSize};
    }
  `,
];

/**
 * The eyebrow over a heading: Public Sans capitals at 600, widely tracked,
 * in mint on the base, or in the band's text colour on a band.
 */
export const eyebrowStyles = ({
  onBand = false,
} = {}): TemplateStyleDecl[] => css`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${onBand ? "inherit" : "var(--accent-2)"};
`;

/** A small label over an item, in the surrounding text colour. */
export const labelStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

/**
 * A large numeral in mint: an issue's number, a figure. Only on the base,
 * where mint is checked.
 */
export const numeralStyles = (size: string): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: ${size};
    line-height: 0.9;
    letter-spacing: -0.02em;
    color: var(--accent-2);
    font-variant-numeric: lining-nums tabular-nums;
  `,
];

/** The sentence under a hero's or a page header's h1. */
export const leadStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  max-width: 32em;
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

/** A note under a form or a band's sentence: 16px. */
export const noteStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  text-wrap-style: pretty;
`;

/** A stack of children with a gap. */
export const stackStyles = (gap: string): TemplateStyleDecl[] => css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  row-gap: ${gap};
`;

/**
 * A grid of `columns` equal columns (`tablet` from 768px to 991px), one on
 * phones, its items as tall as the row, rows `rowGap` apart (`phoneRowGap`
 * on phones).
 */
export const gridStyles = (
  columns: number,
  tablet: number = columns,
  {
    rowGap = SPACE[48],
    phoneRowGap = SPACE[32],
  }: { rowGap?: string; phoneRowGap?: string } = {}
): TemplateStyleDecl[] => css`
  display: grid;
  grid-template-columns: repeat(${String(columns)}, minmax(0, 1fr));
  align-items: stretch;
  column-gap: ${SPACE[32]};
  row-gap: ${rowGap};
  ${BREAKPOINT.tablet} {
    grid-template-columns: repeat(${String(tablet)}, minmax(0, 1fr));
    column-gap: ${SPACE[24]};
  }
  ${BREAKPOINT.landscape} {
    grid-template-columns: minmax(0, 1fr);
    row-gap: ${phoneRowGap};
  }
`;

/**
 * A hairline: the text colour at 28% over the background, a quiet rule
 * between rows that follows the palette, light or dark.
 */
export const HAIRLINE = "color-mix(in srgb, var(--text) 28%, transparent)";

/** A hairline rule above an item. */
export const hairlineAboveStyles = (): TemplateStyleDecl[] => css`
  border-top-width: 1px;
  border-top-style: solid;
  border-top-color: ${HAIRLINE};
`;

/** A 2px outline in `colour`, with the template's corners. */
export const outlineStyles = (colour: string): TemplateStyleDecl[] => css`
  border-width: 2px;
  border-style: solid;
  border-top-color: ${colour};
  border-right-color: ${colour};
  border-bottom-color: ${colour};
  border-left-color: ${colour};
  border-radius: ${RADIUS};
`;

/**
 * A button's shape: at least 52px tall, its label centred in Public Sans at
 * 600, with the template's corners; full width on phones, where the
 * direction asks for buttons that are easy to hit. Its colours are the
 * caller's.
 */
const buttonShape = (): TemplateStyleDecl[] => css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 52px;
  padding-left: ${SPACE[32]};
  padding-right: ${SPACE[32]};
  border-width: 2px;
  border-style: solid;
  border-radius: ${RADIUS};
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
  text-decoration-line: none;
  ${BREAKPOINT.landscape} {
    width: 100%;
    padding-left: ${SPACE[24]};
    padding-right: ${SPACE[24]};
  }
`;

/** A button filled with `fill` and labelled in `label`. */
const filledButtonStyles = (
  fill: string,
  label: string
): TemplateStyleDecl[] => [
  ...buttonShape(),
  ...css`
    border-top-color: ${fill};
    border-right-color: ${fill};
    border-bottom-color: ${fill};
    border-left-color: ${fill};
    background-color: ${fill};
    color: ${label};
  `,
  ...focusRing(),
];

/** The primary button on the base: marigold, labelled in ink. */
export const primaryButtonStyles = (): TemplateStyleDecl[] =>
  filledButtonStyles("var(--accent-1)", "var(--base)");

/**
 * The primary button on a marigold band: ink, labelled in marigold, the
 * band's own pair the other way round.
 */
export const invertedButtonStyles = (): TemplateStyleDecl[] =>
  filledButtonStyles("var(--base)", "var(--accent-1)");

/**
 * The second button: outlined 2px in the surrounding text colour, with no
 * fill: chalk on the ink page, ink on a band.
 */
export const outlineButtonStyles = (): TemplateStyleDecl[] => [
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

/**
 * A link that reads as one: underlined, 600, 44px tall; mint on the base,
 * the band's text colour on a band.
 */
export const quietLinkStyles = ({
  onBand = false,
} = {}): TemplateStyleDecl[] => [
  ...tapTarget(),
  ...css`
    color: ${onBand ? "inherit" : "var(--accent-2)"};
    font-weight: 600;
    text-decoration-line: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 6px;
    &:hover {
      text-decoration-thickness: 3px;
    }
  `,
  ...focusRing(),
];
