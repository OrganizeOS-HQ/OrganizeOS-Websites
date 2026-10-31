import { css, ws } from "@webstudio-is/template";
import { BREAKPOINT, SPACE, contentBlock, section, text } from "../../../kit";
import type { PageContext, SiteTemplatePage } from "../../../types";
import { DONATE, photo, siteFooter, siteNav } from "../parts";
import { ctaBand, pageHeader } from "../sections";
import {
  bodyStyles,
  eyebrowStyles,
  headingStyles,
  paragraphStyles,
  ruleStyles,
  stackStyles,
} from "../styles";
import { PROGRAMS, PROGRAM_TEMPLATE, type Program } from "../sample-programs";

// Programs (the Issues or programs page): Page header, the programs as
// alternating rows, and an ask to take part.

/** What a program row says beyond the card on Home. */
const DETAILS = [
  "Say what happens in this program, week to week: where it meets, who leads it, and what someone who comes along will do.",
  "Say who this program is for and how they find it: a referral, a sign-up, or simply turning up on the day.",
  "Say what has changed because of this program, with one figure, such as [how many people] in [the last year].",
];

/**
 * One program: a 3:2 photo and its text side by side, the photo on the
 * right when `reversed`; below 768px the photo always comes first.
 */
const programRow = (
  context: PageContext,
  [file, area, name, summary]: Program,
  details: string,
  reversed: boolean
) => (
  <ws.element
    ws:tag="article"
    ws:label="Program"
    ws:style={css`
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: center;
      column-gap: ${SPACE[64]};
      row-gap: ${SPACE[24]};
      ${BREAKPOINT.tablet} {
        column-gap: ${SPACE[48]};
      }
      ${BREAKPOINT.landscape} {
        grid-template-columns: minmax(0, 1fr);
      }
    `}
  >
    <ws.element
      ws:tag="div"
      ws:style={css`
        order: ${reversed ? "2" : "0"};
        ${BREAKPOINT.landscape} {
          order: 0;
        }
      `}
    >
      {photo(context, file, { ratio: "3 / 2" })}
    </ws.element>
    <ws.element
      ws:tag="div"
      ws:style={[...ruleStyles(), ...stackStyles(SPACE[12])]}
    >
      {text("p", eyebrowStyles(), area, "Eyebrow")}
      {text("h2", headingStyles(), name)}
      {text("p", paragraphStyles(), summary)}
      {text("p", paragraphStyles(), details)}
    </ws.element>
  </ws.element>
);

/** Programs: Alternating rows. */
const programRows = (context: PageContext) =>
  section({
    label: "Programs: Alternating rows",
    children: (
      <ws.element
        ws:tag="div"
        ws:label="Rows"
        ws:style={css`
          display: flex;
          flex-direction: column;
          row-gap: ${SPACE[96]};
          ${BREAKPOINT.landscape} {
            row-gap: ${SPACE[64]};
          }
        `}
      >
        {contentBlock({
          label: "Programs",
          template: programRow(
            context,
            PROGRAM_TEMPLATE,
            "[What happens in it, week to week.]",
            false
          ),
          items: PROGRAMS.map((program, index) =>
            programRow(context, program, DETAILS[index], index % 2 === 1)
          ),
        })}
      </ws.element>
    ),
  });

export const programs: SiteTemplatePage = {
  key: "programs",
  name: "Programs",
  path: "/programs",
  title: "Programs | [Organization name]",
  description:
    "The programs [Organization name] runs, who each one serves and how to take part.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        eyebrow: "Programs",
        title: "Say what your programs do, together, in one sentence",
        intro:
          "Add a sentence on how the programs fit together, and who can take part in them.",
      })}
      {programRows(context)}
      {ctaBand({
        pageIds: context.pageIds,
        eyebrow: "Take part",
        heading: "Every program runs on volunteers",
        body: "Say in a sentence what a volunteer does here, such as [two hours a week].",
        primary: { label: "Get involved", pageKey: "get-involved" },
        secondary: DONATE,
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
