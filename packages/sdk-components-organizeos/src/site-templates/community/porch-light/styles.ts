import { css, type TemplateStyleDecl } from "@webstudio-is/template";
import {
  BREAKPOINT,
  CONTAINER,
  type KitStyle,
  SPACE,
  focusRing,
  tapTarget,
} from "../../kit";

// Porch Light's look (OrganizeOS spec
// 2026-10-31-website-template-directions.md, section 2.2): friendly and
// neighbourly, like a good flyer on a community noticeboard. Bricolage
// Grotesque headings at 800 with tight tracking over Atkinson Hyperlegible at
// 18px; pill buttons; 20px corners on photos and cards; 2px outlines in the
// text colour where another look would use a shadow. The styles every piece
// and page draws with.

/** The template's corners and weights, for the kit's nav, footer and buttons. */
export const LOOK: KitStyle = {
  buttonRadius: "999px",
  buttonWeight: 700,
  headingWeight: 800,
};

/** The corners of a photo or a card. */
export const RADIUS = "20px";

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

// The type scale. Headings in --font-heading at 800 (an item's at 700),
// tracked tight and balanced over their lines; sizes by clamp() between a
// phone's and a wide window's.

const headingBase = (weight = 800): TemplateStyleDecl[] => css`
  margin: 0;
  font-family: var(--font-heading);
  font-weight: ${String(weight)};
  text-wrap-style: balance;
`;

/** The hero's h1: very large, up to 96px, over two or three lines. */
export const displayStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: clamp(44px, 5.4vw + 16px, 96px);
    line-height: 0.98;
    letter-spacing: -0.035em;
  `,
];

/** A page header's h1: up to 72px. */
export const titleStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: clamp(40px, 3.4vw + 22px, 72px);
    line-height: 1.02;
    letter-spacing: -0.03em;
  `,
];

/** A section's h2: up to 52px. */
export const headingStyles = (): TemplateStyleDecl[] => [
  ...headingBase(),
  ...css`
    font-size: clamp(32px, 2vw + 22px, 52px);
    line-height: 1.06;
    letter-spacing: -0.025em;
  `,
];

/** An item's h3. */
export const subheadingStyles = (): TemplateStyleDecl[] => [
  ...headingBase(700),
  ...css`
    font-size: 26px;
    line-height: 1.2;
    letter-spacing: -0.015em;
    ${BREAKPOINT.landscape} {
      font-size: 23px;
    }
  `,
];

/**
 * The tag over a heading: a pill outlined in its own colour, teal on the
 * base. On a coloured band it takes the band's text colour ("currentcolor"
 * and "inherit"), since accent-2 is checked against the base alone.
 */
export const tagStyles = ({ onBand = false } = {}): TemplateStyleDecl[] => {
  const colour = onBand ? "currentcolor" : "var(--accent-2)";
  return css`
    display: inline-flex;
    align-items: center;
    margin: 0;
    padding-top: ${SPACE[4]};
    padding-bottom: ${SPACE[4]};
    padding-left: ${SPACE[12]};
    padding-right: ${SPACE[12]};
    border-width: 2px;
    border-style: solid;
    border-top-color: ${colour};
    border-right-color: ${colour};
    border-bottom-color: ${colour};
    border-left-color: ${colour};
    border-radius: 999px;
    color: ${onBand ? "inherit" : "var(--accent-2)"};
    font-size: 15px;
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: 0.02em;
  `;
};

/** A small label over an item, in teal: what a role asks, when to meet. */
export const labelStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  color: var(--accent-2);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: 0.01em;
`;

/**
 * The sentence under a hero's or a page header's h1; `centred`, balanced
 * over its lines, as centred text reads best.
 */
export const leadStyles = ({
  centred = false,
} = {}): TemplateStyleDecl[] => css`
  margin: 0;
  max-width: 34em;
  font-size: 21px;
  line-height: 1.5;
  text-wrap-style: ${centred ? "balance" : "pretty"};
  ${BREAKPOINT.landscape} {
    font-size: 19px;
  }
`;

/**
 * Running text, at most the 65-character measure (or `maxWidth`), with no
 * lone last word; `centred`, balanced over its lines instead.
 */
export const paragraphStyles = (
  maxWidth: string = CONTAINER.text,
  { centred = false } = {}
): TemplateStyleDecl[] => css`
  margin: 0;
  max-width: ${maxWidth};
  text-wrap-style: ${centred ? "balance" : "pretty"};
`;

/**
 * The one line a section wants remembered: in the heading font, underlined
 * thick in teal, on the base only. Its spaces collapse, as the published
 * site's own default (preserve) would keep the space at the end of each
 * wrapped line and underline it too.
 */
export const pullLineStyles = (): TemplateStyleDecl[] => css`
  margin-top: ${SPACE[8]};
  margin-right: 0;
  margin-bottom: 0;
  margin-left: 0;
  max-width: 24em;
  font-family: var(--font-heading);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.01em;
  text-decoration-line: underline;
  text-decoration-color: var(--accent-2);
  text-decoration-thickness: 4px;
  text-underline-offset: 8px;
  text-wrap-style: pretty;
  white-space-collapse: collapse;
  ${BREAKPOINT.landscape} {
    font-size: 24px;
  }
`;

/** A stack of children with a gap, at its start or centred. */
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
 * Equal columns `gap` apart that stack to one below 768px, `phoneGap` apart;
 * `tablet` sets how many columns there are from 768px to 991px.
 */
export const gridStyles = (
  columns: number,
  {
    tablet = columns,
    gap = SPACE[24],
    phoneGap = SPACE[16],
  }: { tablet?: number; gap?: string; phoneGap?: string } = {}
): TemplateStyleDecl[] => css`
  display: grid;
  grid-template-columns: repeat(${String(columns)}, minmax(0, 1fr));
  column-gap: ${gap};
  row-gap: ${gap};
  ${BREAKPOINT.tablet} {
    grid-template-columns: repeat(${String(tablet)}, minmax(0, 1fr));
  }
  ${BREAKPOINT.landscape} {
    grid-template-columns: minmax(0, 1fr);
    row-gap: ${phoneGap};
  }
`;

/** A 2px outline in `colour` with the template's corners. */
export const outlineStyles = (
  colour = "var(--text)"
): TemplateStyleDecl[] => css`
  border-width: 2px;
  border-style: solid;
  border-top-color: ${colour};
  border-right-color: ${colour};
  border-bottom-color: ${colour};
  border-left-color: ${colour};
  border-radius: ${RADIUS};
`;

/**
 * A card: an outlined box on the base, padded, its children stacked `gap`
 * apart.
 */
export const cardStyles = (gap: string = SPACE[12]): TemplateStyleDecl[] => [
  ...outlineStyles(),
  ...stackStyles(gap),
  ...css`
    padding: ${SPACE[32]};
    background-color: var(--base);
    color: var(--text);
    ${BREAKPOINT.landscape} {
      padding: ${SPACE[24]};
    }
  `,
];

/**
 * A pill button's shape: at least 52px tall, its label centred, full width on
 * phones, where the direction asks for buttons that are easy to hit. Its
 * colours are the caller's.
 */
const pillStyles = (): TemplateStyleDecl[] => [
  ...css`
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    justify-content: center;
    min-height: 52px;
    padding-left: ${SPACE[32]};
    padding-right: ${SPACE[32]};
    border-width: 2px;
    border-style: solid;
    border-radius: 999px;
    font-weight: 700;
    line-height: 1.3;
    text-align: center;
    text-decoration-line: none;
    ${BREAKPOINT.landscape} {
      width: 100%;
    }
  `,
];

/** The primary button: a berry pill labelled in the base colour. */
export const primaryButtonStyles = (): TemplateStyleDecl[] => [
  ...pillStyles(),
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
 * The second button: a pill outlined 2px in the surrounding text colour,
 * with no fill, so it reads on the base and on a band alike.
 */
export const secondaryButtonStyles = (): TemplateStyleDecl[] => [
  ...pillStyles(),
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
 * The primary button on a berry band: a base-coloured pill labelled in
 * berry, the band's own pair the other way round.
 */
export const invertedButtonStyles = (): TemplateStyleDecl[] => [
  ...pillStyles(),
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

/** A link that reads as one: underlined, in the text colour, 44px tall. */
export const quietLinkStyles = (): TemplateStyleDecl[] => [
  ...tapTarget(),
  ...css`
    color: inherit;
    font-weight: 700;
    text-decoration-line: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 6px;
    &:hover {
      text-decoration-color: var(--accent-2);
    }
  `,
  ...focusRing(),
];
