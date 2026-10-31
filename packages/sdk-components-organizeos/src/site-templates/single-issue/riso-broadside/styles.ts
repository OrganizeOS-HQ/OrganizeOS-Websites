import { css, type TemplateStyleDecl } from "@webstudio-is/template";
import {
  BREAKPOINT,
  CONTAINER,
  type KitStyle,
  SPACE,
  focusRing,
} from "../../kit";

// Riso Broadside's look (OrganizeOS spec
// 2026-10-31-website-template-directions.md, section 2.5): urgent and
// printed-looking, like a two-colour risograph poster. Instrument Serif
// headings in its one weight, set large, over IBM Plex Sans at 18px (400 and
// 600); square corners everywhere; 2px rules and outlines in the text
// colour; blue (accent-1) for fields of colour and pink (accent-2) for the
// count and the large numerals on the base. Accent-2 is checked against the
// base alone, at the 3:1 of large text and graphics, so it sets no small
// text and nothing on a band. The styles every section draws with.

/**
 * The template's choices for the kit: square corners (none set), buttons in
 * Plex at 600, and the name at 28px in the nav and the footer alike, since
 * Instrument Serif's narrow face reads as a caption at the kit's 20px.
 * Instrument Serif has one weight, so the kit's name and footer titles in
 * the heading face are asked for none (the browser would synthesize a bold).
 */
export const LOOK: KitStyle = {
  buttonWeight: 600,
  navNameSize: "28px",
  footerNameSize: "28px",
};

/** A rule's or an outline's weight: 2px, as printed. */
export const RULE = "2px";

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

// The type scale. Headings in --font-heading at its one weight (400, which
// a heading element would otherwise ask in bold), balanced over their lines;
// sizes by clamp() between a phone's and a wide window's.

const headingBase = (tracking = "-0.01em"): TemplateStyleDecl[] => css`
  margin: 0;
  font-family: var(--font-heading);
  font-weight: 400;
  letter-spacing: ${tracking};
  text-wrap-style: balance;
`;

/** The hero's ask: up to 112px, centred. */
export const displayStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: clamp(46px, 5.2vw + 26px, 112px);
    line-height: 0.98;
  `,
];

/** A section's h2: up to 68px. */
export const headingStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: clamp(40px, 2.6vw + 30px, 68px);
    line-height: 1.02;
  `,
];

/** An item's h3, or a question: 32px, 28px on phones, or the sizes given. */
export const subheadingStyles = (
  size = "32px",
  phoneSize = "28px"
): TemplateStyleDecl[] => [
  ...headingBase("0"),
  ...css`
    font-size: ${size};
    line-height: 1.1;
    ${BREAKPOINT.landscape} {
      font-size: ${phoneSize};
    }
  `,
];

/**
 * A label over a heading: Plex capitals at 600, widely tracked, in the
 * surrounding text colour (accent-2 is held to the base only at the 3:1 of
 * large text, so small text never wears it).
 */
export const labelStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

/**
 * The count: Plex at 600, large, in tabular figures, so the line does not
 * shift as staff update it; pink on the base, or the band's colour.
 */
export const countStyles = (
  size: string,
  colour: "accent-2" | "inherit" = "accent-2"
): TemplateStyleDecl[] => css`
  margin: 0;
  font-size: ${size};
  font-weight: 600;
  line-height: 0.9;
  letter-spacing: -0.03em;
  font-variant-numeric: lining-nums tabular-nums;
  color: ${colour === "inherit" ? "inherit" : `var(--${colour})`};
`;

/**
 * The space a question's marker hangs in, at the rule's left edge: a
 * question and its answer start after it.
 */
const MARKER_SPACE = { base: "30px", phone: "26px" } as const;

/**
 * A question in the FAQ, its summary: the heading face at 28px, 24px on
 * phones, its marker (the disclosure triangle, in pink: a graphic, which
 * accent-2 may draw) hung at the rule's edge, so a question that wraps
 * keeps its left edge.
 */
export const questionStyles = (): TemplateStyleDecl[] => css`
  margin-top: 0;
  margin-right: 0;
  margin-bottom: 0;
  margin-left: ${MARKER_SPACE.base};
  padding-top: ${SPACE[16]};
  padding-bottom: ${SPACE[16]};
  font-family: var(--font-heading);
  font-size: 28px;
  font-weight: 400;
  line-height: 1.1;
  text-wrap-style: balance;
  list-style-position: outside;
  cursor: pointer;
  ${BREAKPOINT.landscape} {
    margin-left: ${MARKER_SPACE.phone};
    font-size: 24px;
  }
  &::marker {
    color: var(--accent-2);
  }
`;

/** A question's answer, under the question's text. */
export const answerStyles = (): TemplateStyleDecl[] => css`
  margin-top: 0;
  margin-right: 0;
  margin-bottom: 0;
  margin-left: ${MARKER_SPACE.base};
  max-width: ${CONTAINER.text};
  padding-bottom: ${SPACE[24]};
  text-wrap-style: pretty;
  ${BREAKPOINT.landscape} {
    margin-left: ${MARKER_SPACE.phone};
  }
`;

/**
 * A large numeral in the heading face: a value's number. Its colour is the
 * surrounding text's unless the caller sets one.
 */
export const numeralStyles = (
  size: string,
  phoneSize: string
): TemplateStyleDecl[] => [
  ...headingBase("0"),
  ...css`
    font-size: ${size};
    line-height: 0.8;
    font-variant-numeric: lining-nums;
    ${BREAKPOINT.landscape} {
      font-size: ${phoneSize};
    }
  `,
];

/**
 * The sentence under a heading: left-aligned text wraps `pretty` (no lone
 * last word); centred text balances its lines.
 */
export const leadStyles = ({
  wrap = "pretty",
  maxWidth = "34em",
}: {
  wrap?: "pretty" | "balance";
  maxWidth?: string;
} = {}): TemplateStyleDecl[] => css`
  margin: 0;
  max-width: ${maxWidth};
  font-size: 21px;
  line-height: 1.5;
  text-wrap-style: ${wrap};
  ${BREAKPOINT.landscape} {
    font-size: 19px;
  }
`;

/** Running text, at most the 65-character measure, with no lone last word. */
export const paragraphStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  max-width: ${CONTAINER.text};
  text-wrap-style: pretty;
`;

/** A stack of children with a gap. */
export const stackStyles = (
  gap: string,
  align: "flex-start" | "center" = "flex-start"
): TemplateStyleDecl[] => css`
  display: flex;
  flex-direction: column;
  align-items: ${align};
  row-gap: ${gap};
`;

/**
 * A 2px outline on every side, in the surrounding text colour, or in
 * `colour`.
 */
export const outlineStyles = (
  colour = "currentcolor"
): TemplateStyleDecl[] => css`
  border-top-width: ${RULE};
  border-right-width: ${RULE};
  border-bottom-width: ${RULE};
  border-left-width: ${RULE};
  border-top-style: solid;
  border-right-style: solid;
  border-bottom-style: solid;
  border-left-style: solid;
  border-top-color: ${colour};
  border-right-color: ${colour};
  border-bottom-color: ${colour};
  border-left-color: ${colour};
`;

/** A full-width rule above an item, in the surrounding text colour. */
export const ruleAboveStyles = (): TemplateStyleDecl[] => css`
  border-top-width: ${RULE};
  border-top-style: solid;
  border-top-color: currentcolor;
`;

/**
 * A square button's shape: at least 52px tall, its label centred, in Plex
 * at 600. Its colours are the caller's.
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
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
  text-decoration-line: none;
  ${BREAKPOINT.landscape} {
    padding-left: ${SPACE[24]};
    padding-right: ${SPACE[24]};
  }
`;

/**
 * The button on a blue field (the hero, the share band): the base colour,
 * labelled in blue, the band's own pair the other way round.
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
