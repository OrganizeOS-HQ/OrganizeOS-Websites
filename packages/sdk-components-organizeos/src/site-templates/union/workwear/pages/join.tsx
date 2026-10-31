import { css, ws } from "@webstudio-is/template";
import { BREAKPOINT, SPACE, contentBlock, section, text } from "../../../kit";
import type { PageContext, SiteTemplatePage } from "../../../types";
import { siteFooter, siteNav } from "../parts";
import { faqSection, pageHeader } from "../sections";
import {
  RULE,
  bodyStyles,
  headingStyles,
  labelStyles,
  numeralStyles,
  paragraphStyles,
  ruleAboveStyles,
  ruleBelowStyles,
  stackStyles,
} from "../styles";

// Join (spec 5.1, template 3: Sign-up until the Join Form, W3): Page header;
// Sign-up: Side by side, what happens after joining beside the Signup Form;
// FAQ: Two columns, on joining. The page is at /join-us: the platform serves
// its own /join (memberships) on the site's host, so a page there would never
// show.

/** [number, what happens] */
type Step = [string, string];

/** One step under a rule: its number large in accent-2, then what happens. */
const step = ([number, line]: Step) => (
  <ws.element
    ws:tag="li"
    ws:label="Step"
    ws:style={[
      ...ruleAboveStyles(),
      ...css`
        display: grid;
        grid-template-columns: 4rem minmax(0, 1fr);
        align-items: baseline;
        column-gap: ${SPACE[16]};
        padding-top: ${SPACE[16]};
        padding-bottom: ${SPACE[16]};
      `,
    ]}
  >
    {text("p", numeralStyles("40px"), number, "Number")}
    {text("p", paragraphStyles(), line)}
  </ws.element>
);

/**
 * Sign-up: Side by side. What happens after joining, as numbered steps, on
 * the left; the Signup Form in a 2px outlined box on the right; one column
 * on phones, the steps first. The section is `#sign-up`.
 */
const signUp = ({ placeBlock }: PageContext) =>
  section({
    label: "Sign-up: Side by side",
    id: "sign-up",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          align-items: start;
          column-gap: ${SPACE[64]};
          row-gap: ${SPACE[48]};
          ${BREAKPOINT.tablet} {
            column-gap: ${SPACE[48]};
          }
          ${BREAKPOINT.landscape} {
            grid-template-columns: minmax(0, 1fr);
            row-gap: ${SPACE[32]};
          }
        `}
      >
        <ws.element ws:tag="div" ws:style={stackStyles(SPACE[16])}>
          {text("p", labelStyles(), "What happens next", "Label")}
          {text("h2", headingStyles(), "Three steps to joining")}
          {text(
            "p",
            paragraphStyles(),
            "Say what joining asks of a new member, and how long each step takes."
          )}
          <ws.element
            ws:tag="ol"
            ws:label="Steps"
            ws:style={[
              ...css`
                align-self: stretch;
                margin-top: ${SPACE[16]};
                margin-bottom: 0;
                padding-left: 0;
                list-style-type: none;
              `,
              ...ruleBelowStyles(),
            ]}
          >
            {contentBlock({
              label: "Steps",
              template: step(["[0]", "[What happens.]"]),
              items: (
                [
                  ["01", "Leave your details with the form."],
                  [
                    "02",
                    "A steward gets in touch within [two days] to talk it through.",
                  ],
                  ["03", "You sign your card and come to your first meeting."],
                ] as Step[]
              ).map(step),
            })}
          </ws.element>
        </ws.element>
        {/*
          The form opens with its own h2 (its text the template's, its look
          "OS Form Heading" in index.tsx), whose top margin adds to the box's:
          the box gives up as much at the top, so the form sits evenly in it.
        */}
        <ws.element
          ws:tag="div"
          ws:label="Form box"
          ws:style={css`
            box-sizing: border-box;
            padding-top: ${SPACE[12]};
            padding-right: ${SPACE[32]};
            padding-bottom: ${SPACE[32]};
            padding-left: ${SPACE[32]};
            border-width: ${RULE};
            border-style: solid;
            border-top-color: var(--text);
            border-right-color: var(--text);
            border-bottom-color: var(--text);
            border-left-color: var(--text);
            ${BREAKPOINT.landscape} {
              padding-top: ${SPACE[4]};
              padding-right: ${SPACE[24]};
              padding-bottom: ${SPACE[24]};
              padding-left: ${SPACE[24]};
            }
          `}
        >
          {placeBlock("@organizeos/site-components:SignupForm", "signup", {
            heading: "Sign up to join",
          })}
        </ws.element>
      </ws.element>
    ),
  });

export const join: SiteTemplatePage = {
  key: "join",
  name: "Join",
  path: "/join-us",
  title: "Join | [Organization name]",
  description:
    "How to join [Local 000]: who can join, what it costs and what happens after you sign up.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        label: "Join",
        title: "Join [Local 000]",
        intro: "Say who can join, what it costs, and why members do.",
      })}
      {signUp(context)}
      {faqSection({
        pageIds: context.pageIds,
        heading: "Before you join",
        questions: [
          ["Who can join?", "Say which jobs and worksites the local covers."],
          [
            "What are the dues?",
            "Say what dues are, how they are paid, and when they start.",
          ],
          [
            "Can part-time workers join?",
            "Say whether part-time and temporary workers can join, and how.",
          ],
          [
            "Who sees that I signed up?",
            "Say who sees the form, and what the local does with it.",
          ],
        ],
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
