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
import { DONATE, photo, sectionHeader, siteFooter, siteNav } from "../parts";
import { ctaBand, pageHeader, statsBand } from "../sections";
import {
  bodyStyles,
  eyebrowStyles,
  gridStyles,
  headingStyles,
  paragraphStyles,
  ruleStyles,
  stackStyles,
  subheadingStyles,
} from "../styles";

// About (spec section 4's About page): Page header, About, Mission and
// values, Team, Stats, Call to action band.

/** About: Image left, the story beside a 4:5 photo. */
const story = (context: PageContext) =>
  section({
    label: "About: Image left",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
          align-items: center;
          column-gap: ${SPACE[64]};
          ${BREAKPOINT.tablet} {
            column-gap: ${SPACE[48]};
          }
          ${BREAKPOINT.landscape} {
            grid-template-columns: minmax(0, 1fr);
            row-gap: ${SPACE[32]};
          }
        `}
      >
        {photo(context, "about.jpg", {
          ratio: "4 / 5",
          phoneRatio: "3 / 2",
          position: "5% 50%",
        })}
        <ws.element ws:tag="div" ws:style={stackStyles(SPACE[16])}>
          {text("p", eyebrowStyles(), "Our story", "Eyebrow")}
          {text("h2", headingStyles(), "How the work began")}
          {text(
            "p",
            paragraphStyles(),
            "Tell the story in two or three short paragraphs: who started the work, in what year, and what they saw that needed doing."
          )}
          {text(
            "p",
            paragraphStyles(),
            "Then say what has grown since: the people who joined, the places you now reach, and what you have learned along the way."
          )}
          {text(
            "p",
            paragraphStyles(),
            "End with where the work is going next, in a sentence a new volunteer could repeat."
          )}
        </ws.element>
      </ws.element>
    ),
  });

/** [number, name, a sentence] */
type Value = [string, string, string];

/** One value: its number in ochre, then its name and a sentence. */
const value = ([number, name, line]: Value) => (
  <ws.element
    ws:tag="div"
    ws:label="Value"
    ws:style={[...ruleStyles(), ...stackStyles(SPACE[8])]}
  >
    {text(
      "p",
      css`
        margin: 0;
        font-family: var(--font-heading);
        font-weight: 600;
        font-size: 28px;
        line-height: 1.2;
        color: var(--accent-2);
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
        eyebrow: "Mission and values",
        heading: "State your mission in one sentence here",
        intro: "Then name the few values that decide how you do the work.",
      }),
      <ws.element ws:tag="div" ws:label="Values" ws:style={gridStyles(3)}>
        {contentBlock({
          label: "Values",
          template: value(["[00]", "[Value]", "[What it means.]"]),
          items: (
            [
              [
                "01",
                "[First value]",
                "One sentence on what this value means in practice.",
              ],
              [
                "02",
                "[Second value]",
                "One sentence on what this value means in practice.",
              ],
              [
                "03",
                "[Third value]",
                "One sentence on what this value means in practice.",
              ],
            ] as Value[]
          ).map(value),
        })}
      </ws.element>,
    ]),
  });

/** [name, role, a line about them] */
type Person = [string, string, string];

/** One person: name, role in ochre, a line about them. */
const person = ([name, role, line]: Person) => (
  <ws.element
    ws:tag="div"
    ws:label="Person"
    ws:style={[...ruleStyles(), ...stackStyles(SPACE[8])]}
  >
    {text("h3", subheadingStyles(), name)}
    {text("p", eyebrowStyles(), role, "Role")}
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

/** Team: Compact, four to a row. */
const team = (context: PageContext) =>
  section({
    label: "Team: Compact",
    children: keyed([
      sectionHeader({
        pageIds: context.pageIds,
        eyebrow: "Team",
        heading: "The people behind the work",
        intro: "Name your staff and board, and say in a line what each does.",
      }),
      <ws.element ws:tag="div" ws:label="People" ws:style={gridStyles(4, 2)}>
        {contentBlock({
          label: "People",
          template: person(["[Name]", "[Role]", "[A line about them.]"]),
          items: (
            [
              [
                "[Full name]",
                "[Executive director]",
                "A line on what they do, and since when.",
              ],
              [
                "[Full name]",
                "[Program lead]",
                "A line on what they do, and since when.",
              ],
              [
                "[Full name]",
                "[Coordinator]",
                "A line on what they do, and since when.",
              ],
              [
                "[Full name]",
                "[Board chair]",
                "A line on what they do, and since when.",
              ],
            ] as Person[]
          ).map(person),
        })}
      </ws.element>,
    ]),
  });

export const about: SiteTemplatePage = {
  key: "about",
  name: "About",
  path: "/about",
  title: "About [Organization name]",
  description:
    "Who [Organization name] is, why it began and the people who do the work.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        eyebrow: "About",
        title: "Say in a sentence why your organization exists",
        intro:
          "Add a sentence or two for someone who has just heard of you: what you do, where, and with whom.",
      })}
      {story(context)}
      {values(context)}
      {team(context)}
      {statsBand({
        heading: "What the work adds up to",
        stats: [
          ["[12]", "years of work in [your place]"],
          ["[1,200]", "people who took part last year"],
          ["[340]", "volunteers who gave their time"],
          ["[18]", "partners we work alongside"],
        ],
      })}
      {ctaBand({
        pageIds: context.pageIds,
        eyebrow: "Take part",
        heading: "There is a place for you in this",
        body: "Say in a sentence how someone new can start, such as [a volunteer day].",
        primary: { label: "Get involved", pageKey: "get-involved" },
        secondary: DONATE,
        // the Stats band's edge already divides the page
        ruled: false,
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
