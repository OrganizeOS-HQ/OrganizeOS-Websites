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
import { button, sectionHeader, type PageIds } from "./parts";
import {
  RULE,
  headingStyles,
  labelStyles,
  leadStyles,
  numeralStyles,
  outlinedButtonStyles,
  paragraphStyles,
  ruleAboveStyles,
  ruleBelowStyles,
  ruledCellStyles,
  ruledGridStyles,
  stackStyles,
  subheadingStyles,
  titleStyles,
} from "./styles";

// The sections more than one of Workwear's pages use, each a kit section
// named from the vocabulary.

/**
 * Page header: Plain, on denim, as the hero is: the label names the page,
 * the h1 says what it is for, a sentence leads in.
 */
export const pageHeader = ({
  label,
  title,
  intro,
}: {
  label: string;
  title: string;
  intro: string;
}): JSX.Element =>
  section({
    label: "Page header",
    background: "accent-1",
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
        {text("p", labelStyles(), label, "Label")}
        <ws.element
          ws:tag="h1"
          ws:style={[
            ...titleStyles(),
            ...css`
              max-width: 14em;
            `,
          ]}
        >
          {sample(title)}
        </ws.element>
        {text("p", leadStyles(), intro)}
      </ws.element>
    ),
  });

/** [number, name, a sentence] */
export type Value = [string, string, string];

/**
 * One value as a row under a full-width rule: its number large in accent-2,
 * its name, and a sentence. Below 768px the number sits above the name.
 */
const value = ([number, name, line]: Value) => (
  <ws.element
    ws:tag="div"
    ws:label="Value"
    ws:style={[
      ...ruleAboveStyles(),
      ...css`
        display: grid;
        grid-template-columns: 7rem minmax(0, 5fr) minmax(0, 7fr);
        align-items: baseline;
        column-gap: ${SPACE[32]};
        row-gap: ${SPACE[12]};
        padding-top: ${SPACE[32]};
        padding-bottom: ${SPACE[32]};
        ${BREAKPOINT.tablet} {
          grid-template-columns: 5rem minmax(0, 1fr);
        }
        ${BREAKPOINT.landscape} {
          grid-template-columns: minmax(0, 1fr);
          padding-top: ${SPACE[24]};
          padding-bottom: ${SPACE[24]};
        }
      `,
    ]}
  >
    {text(
      "p",
      numeralStyles("clamp(44px, 2vw + 32px, 64px)"),
      number,
      "Number"
    )}
    {text("h3", subheadingStyles(), name)}
    {text(
      "p",
      [
        ...paragraphStyles(),
        ...css`
          ${BREAKPOINT.tablet} {
            grid-column-start: 2;
          }
          ${BREAKPOINT.landscape} {
            grid-column-start: 1;
          }
        `,
      ],
      line
    )}
  </ws.element>
);

/**
 * Mission and values: List. The mission over numbered rows, 01 to 03 in
 * accent-2, separated by full-width rules, the last closed by one.
 */
export const valuesList = ({
  pageIds,
  heading,
  intro,
  link,
  values,
}: {
  pageIds: PageIds;
  heading: string;
  intro: string;
  link?: SiteLink;
  values: Value[];
}): JSX.Element =>
  section({
    label: "Mission and values: List",
    children: keyed([
      sectionHeader({ pageIds, label: "Mission", heading, intro, link }),
      <ws.element ws:tag="div" ws:label="Values" ws:style={ruleBelowStyles()}>
        {contentBlock({
          label: "Values",
          template: value(["[00]", "[Value]", "[What it means at work.]"]),
          items: values.map(value),
        })}
      </ws.element>,
    ]),
  });

/** [figure, what it counts] */
export type Stat = [string, string];

/** One figure in a ruled cell: its label on top, the number bottom-left. */
const stat = ([figure, label]: Stat) => (
  <ws.element
    ws:tag="div"
    ws:label="Stat"
    ws:style={[
      ...ruledCellStyles(),
      ...css`
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        row-gap: ${SPACE[32]};
        min-height: 13rem;
        ${BREAKPOINT.landscape} {
          row-gap: ${SPACE[24]};
          min-height: 10rem;
        }
      `,
    ]}
  >
    {text(
      "p",
      [
        ...labelStyles(),
        ...css`
          text-wrap-style: pretty;
        `,
      ],
      label,
      "Label"
    )}
    {/*
      Two up on the smallest phones, a cell's text is about 100px wide: the
      figure narrows with the window, so "[0000]" still fits it at 320px.
    */}
    {text(
      "p",
      [
        ...numeralStyles("clamp(48px, 3vw + 30px, 80px)"),
        ...css`
          ${BREAKPOINT.portrait} {
            font-size: clamp(34px, 10vw + 2px, 48px);
          }
        `,
      ],
      figure,
      "Figure"
    )}
  </ws.element>
);

/**
 * Stats: Cards, as a ruled grid that shares its borders: four up, two up
 * below 992px, on phones too.
 */
export const statsCards = ({
  pageIds,
  heading,
  intro,
  stats,
}: {
  pageIds: PageIds;
  heading: string;
  intro?: string;
  stats: Stat[];
}): JSX.Element =>
  section({
    label: "Stats: Cards",
    children: keyed([
      sectionHeader({ pageIds, label: "By the numbers", heading, intro }),
      <ws.element
        ws:tag="div"
        ws:label="Figures"
        ws:style={ruledGridStyles({ columns: 4, tablet: 2, phone: 2 })}
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
 * Events: List. The Event List of everything coming up as dated rows under
 * a rule, its looks in the template's blockTokens (index.tsx).
 */
export const eventsList = ({
  placeBlock,
  pageIds,
  label = "Events",
  heading,
  intro,
  link,
}: Pick<PageContext, "placeBlock" | "pageIds"> & {
  label?: string;
  heading: string;
  intro: string;
  link?: SiteLink;
}): JSX.Element =>
  section({
    label: "Events: List",
    children: keyed([
      sectionHeader({ pageIds, label, heading, intro, link }),
      placeBlock("@organizeos/site-components:EventList", "events", {
        card: "dated",
        // one column of ruled rows under a rule; each row draws its own
        // rule beneath (OS Card)
        style: css`
          grid-template-columns: minmax(0, 1fr);
          row-gap: 0;
          column-gap: 0;
          border-top-width: ${RULE};
          border-top-style: solid;
          border-top-color: var(--text);
        `,
      }),
    ]),
  });

/**
 * Call to action band: Split, on denim: an uppercase claim and a sentence
 * on the left, an outlined button in the base colour on the right. One
 * column on phones.
 */
export const ctaBand = ({
  pageIds,
  heading,
  body,
  link,
}: {
  pageIds: PageIds;
  heading: string;
  body: string;
  link: SiteLink;
}): JSX.Element =>
  section({
    label: "Call to action band: Split",
    background: "accent-1",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: end;
          column-gap: ${SPACE[64]};
          row-gap: ${SPACE[32]};
          ${BREAKPOINT.landscape} {
            grid-template-columns: minmax(0, 1fr);
            align-items: start;
          }
        `}
      >
        <ws.element ws:tag="div" ws:style={stackStyles(SPACE[16])}>
          {text(
            "h2",
            [
              ...headingStyles(),
              ...css`
                max-width: 16em;
              `,
            ],
            heading
          )}
          {text("p", paragraphStyles(CONTAINER.narrow), body)}
        </ws.element>
        {button(pageIds, link, outlinedButtonStyles())}
      </ws.element>
    ),
  });

/** [question, answer] */
export type Question = [string, string];

/** One question over its answer, under a rule. */
const question = ([asked, answer]: Question): JSX.Element => (
  <ws.element
    ws:tag="div"
    ws:label="Question"
    ws:style={[
      ...ruleAboveStyles(),
      ...stackStyles(SPACE[12]),
      ...css`
        padding-top: ${SPACE[24]};
      `,
    ]}
  >
    {text("h3", subheadingStyles("24px", "22px"), asked)}
    {text("p", paragraphStyles(), answer)}
  </ws.element>
);

/** FAQ: Two columns, every answer open, each question under a rule. */
export const faqSection = ({
  pageIds,
  heading,
  intro,
  questions,
}: {
  pageIds: PageIds;
  heading: string;
  intro?: string;
  questions: Question[];
}): JSX.Element =>
  section({
    label: "FAQ: Two columns",
    children: keyed([
      sectionHeader({ pageIds, label: "Questions", heading, intro }),
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: ${SPACE[48]};
          row-gap: ${SPACE[48]};
          ${BREAKPOINT.tablet} {
            column-gap: ${SPACE[32]};
          }
          ${BREAKPOINT.landscape} {
            grid-template-columns: minmax(0, 1fr);
            row-gap: ${SPACE[32]};
          }
        `}
      >
        {contentBlock({
          label: "Questions",
          template: question(["[A question people ask]", "[Its answer.]"]),
          items: questions.map(question),
        })}
      </ws.element>,
    ]),
  });
