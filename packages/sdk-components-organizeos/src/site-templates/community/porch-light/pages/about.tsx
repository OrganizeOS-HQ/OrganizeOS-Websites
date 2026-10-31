import { css, ws } from "@webstudio-is/template";
import {
  BREAKPOINT,
  SPACE,
  contentBlock,
  keyed,
  section,
  text,
} from "../../../kit";
import type { PageContext, SiteTemplatePage } from "../../../types";
import { JOIN, sectionHeader, siteFooter, siteNav } from "../parts";
import { aboutSection, ctaBand, pageHeader } from "../sections";
import {
  bodyStyles,
  cardStyles,
  gridStyles,
  labelStyles,
  outlineStyles,
  paragraphStyles,
  stackStyles,
  subheadingStyles,
} from "../styles";

// About (spec section 4's About page): Page header, About, Mission and
// values, Team, Stats, Call to action band.

/** [number, name, a sentence] */
type Value = [string, string, string];

/** One value: its number large in teal, then its name and a sentence. */
const value = ([number, name, line]: Value) => (
  <ws.element ws:tag="div" ws:label="Value" ws:style={stackStyles(SPACE[8])}>
    {text(
      "p",
      css`
        margin: 0;
        color: var(--accent-2);
        font-family: var(--font-heading);
        font-size: 48px;
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.03em;
      `,
      number,
      "Number"
    )}
    {text("h3", subheadingStyles(), name)}
    {text("p", paragraphStyles(), line)}
  </ws.element>
);

/** Mission and values: Three columns. */
const values = (context: PageContext) =>
  section({
    label: "Mission and values: Three columns",
    children: keyed([
      sectionHeader({
        pageIds: context.pageIds,
        tag: "What we believe",
        heading: "State what the group is for in one sentence",
        intro: "Then name the few things that decide how you work together.",
      }),
      <ws.element
        ws:tag="div"
        ws:label="Values"
        ws:style={gridStyles(3, { gap: SPACE[48], phoneGap: SPACE[32] })}
      >
        {contentBlock({
          label: "Values",
          template: value(["[00]", "[Value]", "[What it means.]"]),
          items: (
            [
              [
                "01",
                "[Everyone is welcome]",
                "One sentence on what this means at a meeting or an event.",
              ],
              [
                "02",
                "[Neighbors decide]",
                "One sentence on how the group makes its choices together.",
              ],
              [
                "03",
                "[Small things count]",
                "One sentence on why no job is too small to matter.",
              ],
            ] as Value[]
          ).map(value),
        })}
      </ws.element>,
    ]),
  });

/** [name, role, a line about them] */
type Person = [string, string, string];

/** One person, in an outlined card: their role in teal, name, a line. */
const person = ([name, role, line]: Person) => (
  <ws.element ws:tag="div" ws:label="Person" ws:style={cardStyles(SPACE[8])}>
    {text("p", labelStyles(), role, "Role")}
    {text("h3", subheadingStyles(), name)}
    {text(
      "p",
      [
        ...paragraphStyles(),
        ...css`
          font-size: 16px;
          line-height: 1.5;
        `,
      ],
      line
    )}
  </ws.element>
);

/** Team: Compact, four outlined cards to a row, two from 768px to 991px. */
const team = (context: PageContext) =>
  section({
    label: "Team: Compact",
    children: keyed([
      sectionHeader({
        pageIds: context.pageIds,
        tag: "Who's who",
        heading: "The neighbors who keep it going",
        intro: "Name the people who run things, and say how to reach them.",
      }),
      <ws.element
        ws:tag="div"
        ws:label="People"
        ws:style={gridStyles(4, { tablet: 2 })}
      >
        {contentBlock({
          label: "People",
          template: person(["[Name]", "[Role]", "[A line about them.]"]),
          items: (
            [
              [
                "[Full name]",
                "[Chair]",
                "Lives on [your street]; runs the meetings.",
              ],
              [
                "[Full name]",
                "[Treasurer]",
                "Keeps the accounts and the receipts.",
              ],
              [
                "[Full name]",
                "[Events]",
                "Plans the potlucks and the cleanups.",
              ],
              [
                "[Full name]",
                "[Newsletter]",
                "Writes the email that goes out each month.",
              ],
            ] as Person[]
          ).map(person),
        })}
      </ws.element>,
    ]),
  });

/** One figure over its label. */
const stat = ([figure, label]: [string, string]) => (
  <ws.element ws:tag="div" ws:label="Stat" ws:style={stackStyles(SPACE[8])}>
    {text(
      "p",
      css`
        margin: 0;
        color: var(--accent-2);
        font-family: var(--font-heading);
        font-size: clamp(44px, 2.4vw + 28px, 64px);
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.03em;
        font-variant-numeric: lining-nums;
      `,
      figure,
      "Figure"
    )}
    {text(
      "p",
      css`
        margin: 0;
        line-height: 1.45;
        text-wrap-style: pretty;
      `,
      label,
      "Label"
    )}
  </ws.element>
);

/**
 * Stats: Inline row, in one outlined panel: four figures in teal, two by two
 * below 992px.
 */
const stats = () =>
  section({
    label: "Stats: Inline row",
    children: (
      <ws.element
        ws:tag="div"
        ws:label="Figures"
        ws:style={[
          ...outlineStyles(),
          ...css`
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            column-gap: ${SPACE[32]};
            row-gap: ${SPACE[32]};
            padding: ${SPACE[48]};
            ${BREAKPOINT.tablet} {
              grid-template-columns: repeat(2, minmax(0, 1fr));
              padding: ${SPACE[32]};
            }
            ${BREAKPOINT.landscape} {
              column-gap: ${SPACE[16]};
              padding: ${SPACE[24]};
            }
          `,
        ]}
      >
        {contentBlock({
          label: "Stats",
          template: stat(["[0]", "[What the figure counts]"]),
          items: (
            [
              ["[12]", "years of meeting on [your street]"],
              ["[240]", "households on our list"],
              ["[30]", "neighbors who helped this year"],
              ["[8]", "cleanups and potlucks a year"],
            ] as [string, string][]
          ).map(stat),
        })}
      </ws.element>
    ),
  });

export const about: SiteTemplatePage = {
  key: "about",
  name: "About",
  path: "/about",
  title: "About [Organization name]",
  description:
    "Who [Organization name] is, how it started and the neighbors who keep it going.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        tag: "About",
        title: "Say in a sentence why your group exists",
        intro:
          "Add a sentence or two for a neighbor who has just heard of you: what you do, where, and who can join.",
      })}
      {aboutSection({
        context,
        imageSide: "left",
        file: "story.jpg",
        tag: "Our story",
        heading: "How it started",
        paragraphs: [
          "Tell the story in two or three short paragraphs: who knocked on the first door, in what year, and what needed fixing.",
          "Then say what has grown since: the people who joined, the streets you now cover, and what you have changed together.",
        ],
        pullLine: "End with the line you would say to a neighbor on the porch.",
      })}
      {values(context)}
      {team(context)}
      {stats()}
      {ctaBand({
        pageIds: context.pageIds,
        tag: "Come along",
        heading: "There is a seat for you at the next meeting",
        body: "Say in a sentence how a new neighbor can start, such as [coming to a potluck].",
        primary: JOIN,
        secondary: { label: "Contact us", pageKey: "contact" },
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
