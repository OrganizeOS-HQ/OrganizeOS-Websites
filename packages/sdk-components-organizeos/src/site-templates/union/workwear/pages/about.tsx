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
import { JOIN, photo, sectionHeader, siteFooter, siteNav } from "../parts";
import { ctaBand, pageHeader } from "../sections";
import {
  bodyStyles,
  headingStyles,
  labelStyles,
  paragraphStyles,
  ruledCellStyles,
  ruledGridStyles,
  stackStyles,
  subheadingStyles,
} from "../styles";

// About (spec 5.1, template 3: About with leadership): Page header; About:
// Image left, a short history beside a 4:5 photo; Leadership: Grid, the
// officers and stewards in a ruled grid; Call to action band: Split, "Join".

/**
 * About: Image left. The local's short history beside a 4:5 photo; on
 * phones the photo comes first, cropped 3:2.
 */
const history = (context: PageContext) =>
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
          // the phone's 3:2 band keeps both hard hats and faces
          phonePosition: "50% 20%",
        })}
        <ws.element ws:tag="div" ws:style={stackStyles(SPACE[16])}>
          {text("p", labelStyles(), "Our history", "Label")}
          {text("h2", headingStyles(), "How the local began")}
          {text(
            "p",
            paragraphStyles(),
            "Say when the local was chartered, by whom, and what the first members came together over."
          )}
          {text(
            "p",
            paragraphStyles(),
            "Then name the turns since: the first contract, the worksites that joined, and the members who carried it."
          )}
          {text(
            "p",
            paragraphStyles(),
            "End with what the local is working on now, in a sentence a new member could repeat."
          )}
        </ws.element>
      </ws.element>
    ),
  });

/** [role, name, where to find them] */
type Person = [string, string, string];

/** One officer or steward in a ruled cell: role on top, name, then a line. */
const person = ([role, name, line]: Person) => (
  <ws.element
    ws:tag="div"
    ws:label="Person"
    ws:style={[...ruledCellStyles(), ...stackStyles(SPACE[8])]}
  >
    {text("p", labelStyles(), role, "Role")}
    {text("h3", subheadingStyles(), name)}
    {text("p", paragraphStyles(), line)}
  </ws.element>
);

/**
 * Leadership: Grid. The officers and stewards in a ruled grid that shares
 * its borders: three up, two from 768px to 991px, one on phones.
 */
const leadership = (context: PageContext) =>
  section({
    label: "Leadership: Grid",
    children: keyed([
      sectionHeader({
        pageIds: context.pageIds,
        label: "Leadership",
        heading: "Who to talk to",
        intro:
          "Name your officers and stewards, and say where members can find each of them.",
      }),
      <ws.element
        ws:tag="div"
        ws:label="People"
        ws:style={ruledGridStyles({ columns: 3, tablet: 2, phone: 1 })}
      >
        {contentBlock({
          label: "People",
          template: person(["[Role]", "[Full name]", "[Where to find them.]"]),
          items: (
            [
              ["President", "[Full name]", "[Department], since [year]."],
              ["Vice president", "[Full name]", "[Department], since [year]."],
              [
                "Secretary-treasurer",
                "[Full name]",
                "[Department], since [year].",
              ],
              ["Chief steward", "[Full name]", "[Worksite], [shift]."],
              ["Steward", "[Full name]", "[Worksite], [shift]."],
              ["Steward", "[Full name]", "[Worksite], [shift]."],
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
  title: "About | [Organization name]",
  description:
    "The history of [Local 000], its officers and stewards, and how to reach them.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        label: "About",
        title: "Say who the local is and who it brings together",
        intro:
          "A sentence on the workers you represent, where they work, and since when.",
      })}
      {history(context)}
      {leadership(context)}
      {ctaBand({
        pageIds: context.pageIds,
        heading: "Every worker at [Employer] can join",
        body: "Say who can join, what it costs, and what happens after you sign up.",
        link: JOIN,
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
