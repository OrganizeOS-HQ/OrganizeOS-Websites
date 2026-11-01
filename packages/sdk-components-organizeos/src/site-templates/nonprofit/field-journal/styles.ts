import { css, type TemplateStyleDecl } from "@webstudio-is/template";
import {
  BREAKPOINT,
  CONTAINER,
  type KitStyle,
  SPACE,
  focusRing,
  tapTarget,
} from "../../kit";

// Field Journal's look (OrganizeOS spec
// 2026-10-31-website-template-directions.md, section 2.1): calm, credible and
// warm, like a well-kept annual report. Newsreader headings at 600 over
// Source Sans 3 at 18px, 3px buttons, square photos, and thin rules instead
// of card chrome. The styles every piece and page draws with.

/** The template's corners and weights, for the kit's nav, footer and buttons. */
export const LOOK: KitStyle = {
  buttonRadius: "3px",
  buttonWeight: 600,
  headingWeight: 600,
};

/** The page's own type and colours, which every section inherits. */
export const bodyStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  background-color: var(--base);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 18px;
  font-weight: 400;
  line-height: 1.6;
`;

// The type scale. Headings in --font-heading at 600, balanced over their
// lines; sizes by clamp() between a phone's and a wide window's.

const headingBase = (): TemplateStyleDecl[] => css`
  margin: 0;
  font-family: var(--font-heading);
  font-weight: 600;
  text-wrap-style: balance;
`;

/** The hero's h1: up to 64px. */
export const displayStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: clamp(40px, 2.6vw + 26px, 64px);
    line-height: 1.06;
    letter-spacing: -0.015em;
  `,
];

/** A page header's h1: up to 54px. */
export const titleStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: clamp(36px, 2vw + 26px, 54px);
    line-height: 1.1;
    letter-spacing: -0.01em;
  `,
];

/** A section's h2: up to 42px. */
export const headingStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: clamp(30px, 1.2vw + 24px, 42px);
    line-height: 1.15;
    letter-spacing: -0.01em;
  `,
];

/** An item's h3. */
export const subheadingStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: 24px;
    line-height: 1.25;
    ${BREAKPOINT.landscape} {
      font-size: 22px;
    }
  `,
];

/**
 * The small capitals over a heading, in ochre: only ever on the paper, since
 * accent-2 is checked against the base alone.
 */
export const eyebrowStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-2);
`;

/** The sentence under a hero's or a page header's h1. */
export const leadStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  max-width: 34em;
  font-size: 20px;
  line-height: 1.55;
  text-wrap-style: pretty;
  ${BREAKPOINT.landscape} {
    font-size: 18px;
  }
`;

/** Running text, at most the 65-character measure, with no lone last word. */
export const paragraphStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  max-width: ${CONTAINER.text};
  text-wrap-style: pretty;
`;

/** A thin rule above an item, in the text colour or the band's. */
export const ruleStyles = (onBand = false): TemplateStyleDecl[] => css`
  padding-top: ${SPACE[16]};
  border-top-width: 1px;
  border-top-style: solid;
  border-top-color: ${onBand ? "var(--base)" : "var(--text)"};
`;

/** A stack of children with a gap. */
export const stackStyles = (gap: string): TemplateStyleDecl[] => css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  row-gap: ${gap};
`;

/**
 * Equal columns that stack to one below 768px; `tabletColumns` sets how many
 * there are from 768px to 991px.
 */
export const gridStyles = (
  columns: number,
  tabletColumns = columns
): TemplateStyleDecl[] => css`
  display: grid;
  grid-template-columns: repeat(${String(columns)}, minmax(0, 1fr));
  column-gap: ${SPACE[32]};
  row-gap: ${SPACE[48]};
  ${BREAKPOINT.tablet} {
    grid-template-columns: repeat(${String(tabletColumns)}, minmax(0, 1fr));
  }
  ${BREAKPOINT.landscape} {
    grid-template-columns: minmax(0, 1fr);
    row-gap: ${SPACE[32]};
  }
`;

/** A link that reads as one: underlined, in the text colour, 44px tall. */
export const quietLinkStyles = (): TemplateStyleDecl[] => [
  ...tapTarget(),
  ...css`
    color: inherit;
    font-weight: 600;
    text-decoration-line: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 6px;
    &:hover {
      text-decoration-thickness: 2px;
    }
  `,
  ...focusRing(),
];
