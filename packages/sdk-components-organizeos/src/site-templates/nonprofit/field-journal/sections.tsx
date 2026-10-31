import { css, ws } from "@webstudio-is/template";
import {
  BREAKPOINT,
  CONTAINER,
  SPACE,
  type SiteLink,
  contentBlock,
  keyed,
  sample,
  section,
  text,
} from "../../kit";
import type { PageContext } from "../../types";
import { actions, sectionHeader, type PageIds } from "./parts";
import {
  eyebrowStyles,
  gridStyles,
  headingStyles,
  leadStyles,
  paragraphStyles,
  ruleStyles,
  stackStyles,
  subheadingStyles,
  titleStyles,
} from "./styles";

// The sections more than one of Field Journal's pages use, each a kit
// section named from the vocabulary.

/**
 * Page header: Plain. The eyebrow names the page, the h1 says what it is
 * for, a sentence leads in.
 */
export const pageHeader = ({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}): JSX.Element =>
  section({
    label: "Page header",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={[
          ...stackStyles(SPACE[24]),
          ...css`
            ${BREAKPOINT.landscape} {
              row-gap: ${SPACE[16]};
            }
          `,
        ]}
      >
        {text("p", eyebrowStyles(), eyebrow, "Eyebrow")}
        <ws.element
          ws:tag="h1"
          ws:style={[
            ...titleStyles(),
            ...css`
              max-width: 18em;
            `,
          ]}
        >
          {sample(title)}
        </ws.element>
        {text("p", leadStyles(), intro)}
      </ws.element>
    ),
  });

/** One figure over its label, under a thin rule in the band's colour. */
const stat = ([figure, label]: [string, string]): JSX.Element => (
  <ws.element
    ws:tag="div"
    ws:label="Stat"
    ws:style={[...ruleStyles(true), ...stackStyles(SPACE[8])]}
  >
    <ws.element
      ws:tag="p"
      ws:label="Figure"
      ws:style={css`
        margin: 0;
        font-family: var(--font-heading);
        font-weight: 600;
        font-size: clamp(40px, 2.5vw + 24px, 60px);
        line-height: 1;
        letter-spacing: -0.02em;
        font-variant-numeric: lining-nums;
      `}
    >
      {sample(figure)}
    </ws.element>
    <ws.element
      ws:tag="p"
      ws:label="Label"
      ws:style={css`
        margin: 0;
        line-height: 1.45;
        text-wrap-style: pretty;
      `}
    >
      {sample(label)}
    </ws.element>
  </ws.element>
);

/**
 * Stats: Band, edge to edge in accent-1: a heading over four figures in a
 * row, two by two below 992px.
 */
export const statsBand = ({
  heading,
  stats,
}: {
  heading: string;
  stats: [string, string][];
}): JSX.Element =>
  section({
    label: "Stats: Band",
    background: "accent-1",
    children: keyed([
      <ws.element
        ws:tag="h2"
        ws:style={[
          ...headingStyles(),
          ...css`
            margin-bottom: ${SPACE[48]};
            ${BREAKPOINT.landscape} {
              margin-bottom: ${SPACE[32]};
            }
          `,
        ]}
      >
        {sample(heading)}
      </ws.element>,
      <ws.element
        ws:tag="div"
        ws:label="Figures"
        ws:style={css`
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          column-gap: ${SPACE[32]};
          row-gap: ${SPACE[48]};
          ${BREAKPOINT.tablet} {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          ${BREAKPOINT.landscape} {
            column-gap: ${SPACE[24]};
            row-gap: ${SPACE[32]};
          }
        `}
      >
        {contentBlock({
          label: "Stats",
          template: stat(["[0]", "[What the figure counts]"]),
          items: stats.map(stat),
        })}
      </ws.element>,
    ]),
  });

/**
 * Call to action band: Split, on the paper under a rule, as every item of
 * the template is: the ask on the left, its button and a quiet second link
 * on the right. After a coloured band, whose edge already divides the page,
 * it has no rule (`ruled: false`).
 */
export const ctaBand = ({
  pageIds,
  eyebrow,
  heading,
  body,
  primary,
  secondary,
  ruled = true,
}: {
  pageIds: PageIds;
  eyebrow: string;
  heading: string;
  body: string;
  primary: SiteLink;
  secondary?: SiteLink;
  ruled?: boolean;
}): JSX.Element =>
  section({
    label: "Call to action band: Split",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={[
          ...css`
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            column-gap: ${SPACE[64]};
            row-gap: ${SPACE[32]};
            ${BREAKPOINT.landscape} {
              grid-template-columns: minmax(0, 1fr);
              row-gap: ${SPACE[24]};
            }
          `,
          ...(ruled
            ? css`
                padding-top: ${SPACE[48]};
                border-top-width: 1px;
                border-top-style: solid;
                border-top-color: var(--text);
                ${BREAKPOINT.landscape} {
                  padding-top: ${SPACE[32]};
                }
              `
            : []),
        ]}
      >
        <ws.element
          ws:tag="div"
          ws:style={[
            ...stackStyles(SPACE[12]),
            ...css`
              max-width: ${CONTAINER.narrow};
            `,
          ]}
        >
          {text("p", eyebrowStyles(), eyebrow, "Eyebrow")}
          {text("h2", headingStyles(), heading)}
          {text("p", paragraphStyles(), body)}
        </ws.element>
        {actions(pageIds, primary, secondary)}
      </ws.element>
    ),
  });

/**
 * Sign-up: Side by side, on the paper: the reason to sign up on the left,
 * the Signup Form in a 1px accent-1 box on the right, under the text below
 * 768px. The section is `#sign-up`, for in-page links.
 */
export const signUpSection = ({
  placeBlock,
  eyebrow,
  heading,
  body,
  note,
}: Pick<PageContext, "placeBlock"> & {
  eyebrow: string;
  heading: string;
  body: string;
  note: string;
}): JSX.Element =>
  section({
    label: "Sign-up: Side by side",
    id: "sign-up",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
          align-items: start;
          column-gap: ${SPACE[64]};
          row-gap: ${SPACE[32]};
          ${BREAKPOINT.tablet} {
            column-gap: ${SPACE[48]};
          }
          ${BREAKPOINT.landscape} {
            grid-template-columns: minmax(0, 1fr);
          }
        `}
      >
        <ws.element ws:tag="div" ws:style={stackStyles(SPACE[12])}>
          {text("p", eyebrowStyles(), eyebrow, "Eyebrow")}
          {text("h2", headingStyles(), heading)}
          {text("p", paragraphStyles(), body)}
          {text(
            "p",
            css`
              margin: 0;
              margin-top: ${SPACE[12]};
              font-size: 16px;
              line-height: 1.5;
            `,
            note,
            "Note"
          )}
        </ws.element>
        {/*
          The form opens with its own h2, whose top margin (about 22px) adds
          to the box's: the box gives up as much at the top, so the form sits
          evenly in it.
        */}
        <ws.element
          ws:tag="div"
          ws:label="Form box"
          ws:style={css`
            padding-top: ${SPACE[12]};
            padding-right: ${SPACE[32]};
            padding-bottom: ${SPACE[32]};
            padding-left: ${SPACE[32]};
            border-width: 1px;
            border-style: solid;
            border-top-color: var(--accent-1);
            border-right-color: var(--accent-1);
            border-bottom-color: var(--accent-1);
            border-left-color: var(--accent-1);
            background-color: var(--base);
            ${BREAKPOINT.landscape} {
              padding-top: ${SPACE[4]};
              padding-right: ${SPACE[24]};
              padding-bottom: ${SPACE[24]};
              padding-left: ${SPACE[24]};
            }
          `}
        >
          {placeBlock("@organizeos/site-components:SignupForm", "signup")}
        </ws.element>
      </ws.element>
    ),
  });

/** One question over its answer, under a thin rule. */
const question = ([asked, answer]: [string, string]): JSX.Element => (
  <ws.element
    ws:tag="div"
    ws:label="Question"
    ws:style={[...ruleStyles(), ...stackStyles(SPACE[8])]}
  >
    {text("h3", subheadingStyles(), asked)}
    {text("p", paragraphStyles(), answer)}
  </ws.element>
);

/** FAQ: Two columns, every answer open. */
export const faqSection = ({
  pageIds,
  heading,
  questions,
}: {
  pageIds: PageIds;
  heading: string;
  questions: [string, string][];
}): JSX.Element =>
  section({
    label: "FAQ: Two columns",
    children: keyed([
      sectionHeader({ pageIds, eyebrow: "Questions", heading }),
      <ws.element ws:tag="div" ws:style={gridStyles(2)}>
        {contentBlock({
          label: "Questions",
          template: question(["[A question people ask]", "[Its answer.]"]),
          items: questions.map(question),
        })}
      </ws.element>,
    ]),
  });
