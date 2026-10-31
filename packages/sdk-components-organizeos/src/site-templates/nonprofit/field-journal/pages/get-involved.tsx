import { ws } from "@webstudio-is/template";
import { SPACE, contentBlock, section } from "../../../kit";
import type { PageContext, SiteTemplatePage } from "../../../types";
import {
  eventsFrame,
  keyed,
  quietLink,
  sectionHeader,
  siteFooter,
  siteNav,
  text,
} from "../parts";
import { faqSection, pageHeader, signUpSection } from "../sections";
import {
  bodyStyles,
  eyebrowStyles,
  gridStyles,
  paragraphStyles,
  ruleStyles,
  stackStyles,
  subheadingStyles,
} from "../styles";

// Get involved (spec section 4's page): Page header, Volunteer
// opportunities, Sign-up, Events: List, FAQ.

type Opportunity = [string, string, string];

/** One way to help: how much time it takes, its name, a line, a link down to the form. */
const opportunity = (
  context: PageContext,
  [commitment, name, line]: Opportunity
) => (
  <ws.element
    ws:tag="article"
    ws:label="Opportunity"
    ws:style={[...ruleStyles(), ...stackStyles(SPACE[8])]}
  >
    {text("p", eyebrowStyles(), commitment, "Eyebrow")}
    {text("h3", subheadingStyles(), name)}
    {text("p", paragraphStyles(), line)}
    {quietLink(context.pageIds, { label: "Sign up to help", href: "#sign-up" })}
  </ws.element>
);

/** Volunteer opportunities: Cards, three up. */
const opportunities = (context: PageContext) =>
  section({
    label: "Volunteer opportunities: Cards",
    children: keyed([
      sectionHeader({
        pageIds: context.pageIds,
        eyebrow: "Volunteer",
        heading: "Ways to help",
        intro:
          "List the roles you need filled, with the time each one asks for.",
      }),
      <ws.element ws:tag="div" ws:label="Cards" ws:style={gridStyles(3)}>
        {contentBlock({
          label: "Opportunities",
          template: opportunity(context, [
            "[Time it takes]",
            "[Role]",
            "[What the role does.]",
          ]),
          items: (
            [
              [
                "[Two hours a week]",
                "[A regular role]",
                "Say what someone in this role does each week, and who they work alongside.",
              ],
              [
                "[One day a month]",
                "[A volunteer day]",
                "Say what a volunteer day involves, and that no experience is needed.",
              ],
              [
                "[From home]",
                "[A skills role]",
                "Say which skills you are looking for, such as [design] or [writing].",
              ],
            ] as Opportunity[]
          ).map((item) => opportunity(context, item)),
        })}
      </ws.element>,
    ]),
  });

/** Events: List, the Event List of volunteer days and gatherings. */
const events = (context: PageContext) =>
  section({
    label: "Events: List",
    children: keyed([
      sectionHeader({
        pageIds: context.pageIds,
        eyebrow: "Events",
        heading: "Volunteer days and gatherings",
        intro: "Come to one first: it is the easiest way to start.",
        link: { label: "All events", pageKey: "events" },
      }),
      eventsFrame(
        context.placeBlock("@organizeos/site-components:EventList", "events")
      ),
    ]),
  });

export const getInvolved: SiteTemplatePage = {
  key: "get-involved",
  name: "Get involved",
  path: "/get-involved",
  title: "Get involved | [Organization name]",
  description:
    "Ways to volunteer with [Organization name], upcoming volunteer days and answers to common questions.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        eyebrow: "Get involved",
        title: "Say in one sentence how people can take part",
        intro:
          "Add a sentence for someone ready to help: they need no experience, only [an hour or two].",
      })}
      {opportunities(context)}
      {signUpSection({
        placeBlock: context.placeBlock,
        eyebrow: "Volunteer",
        heading: "Hear when a role opens",
        body: "Leave your details and [our coordinator] will write when a role suits you.",
        note: "We only use your details to contact you about volunteering.",
      })}
      {events(context)}
      {faqSection({
        pageIds: context.pageIds,
        heading: "Before you sign up",
        questions: [
          [
            "Do I need any experience?",
            "Say what training or support a new volunteer gets, and what they need to bring.",
          ],
          [
            "How much time does it take?",
            "Say what the smallest commitment is, and how people can do more if they want to.",
          ],
          [
            "Where does the work happen?",
            "Say where volunteers meet, and whether any roles can be done from home.",
          ],
          [
            "Can I volunteer with a group?",
            "Say whether you host groups from workplaces, schools or faith communities, and how to arrange it.",
          ],
        ],
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
