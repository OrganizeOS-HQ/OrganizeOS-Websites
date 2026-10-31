import { css, ws } from "@webstudio-is/template";
import { BREAKPOINT, SPACE, section, text } from "../../../kit";
import type { PageContext, SiteTemplatePage } from "../../../types";
import {
  DONATE,
  VOLUNTEER,
  buttons,
  portrait,
  siteFooter,
  siteNav,
} from "../parts";
import { HOME_ISSUES, HOME_OPPORTUNITIES } from "../sample-content";
import {
  featuredEvent,
  issuesRows,
  opportunitiesSection,
  signUpSection,
} from "../sections";
import {
  bodyStyles,
  displayStyles,
  eyebrowStyles,
  leadStyles,
  stackStyles,
} from "../styles";

// Home (directions 2.4 and section 3): Nav with Donate as its button; Hero:
// Split with Volunteer and Donate; Issues or programs: Alternating rows,
// numbered; one featured event (the Event List is on the Events page);
// Volunteer opportunities: Cards; Sign-up: Side by side on the chalk band,
// the page's one light section; Footer: Columns with the paid-for-by box.

/**
 * Hero: Split. Name and office as the eyebrow, a heavy two-line headline,
 * one sentence, then Volunteer (marigold) and Donate (chalk outline) side by
 * side; on the right a 4:5 portrait with the marigold block offset behind
 * it. On phones: the text, both buttons full width (Volunteer on top), then
 * the portrait.
 */
const hero = (context: PageContext) =>
  section({
    label: "Hero: Split",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
          align-items: center;
          column-gap: ${SPACE[64]};
          ${BREAKPOINT.tablet} {
            column-gap: ${SPACE[48]};
          }
          ${BREAKPOINT.landscape} {
            grid-template-columns: minmax(0, 1fr);
            row-gap: ${SPACE[48]};
          }
        `}
      >
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
          {text(
            "p",
            eyebrowStyles(),
            "[Candidate name] for [Office]",
            "Eyebrow"
          )}
          <ws.element
            ws:tag="h1"
            ws:style={[
              ...displayStyles(),
              ...css`
                max-width: 9em;
              `,
            ]}
          >
            {"Say why you are running"}
          </ws.element>
          {text(
            "p",
            leadStyles(),
            "Then say in one sentence what you will do in office, or what the measure changes."
          )}
          <ws.element
            ws:tag="div"
            ws:style={css`
              margin-top: ${SPACE[8]};
              ${BREAKPOINT.landscape} {
                width: 100%;
              }
            `}
          >
            {buttons({
              pageIds: context.pageIds,
              primary: VOLUNTEER,
              secondary: DONATE,
            })}
          </ws.element>
        </ws.element>
        {portrait(context, "hero.jpg")}
      </ws.element>
    ),
  });

export const home: SiteTemplatePage = {
  key: "home",
  name: "Home",
  path: "",
  title: "[Candidate name] for [Office]",
  description:
    "[Candidate name] is running for [Office] in [Place]: the issues, the next events, and how to volunteer or give.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {hero(context)}
      {issuesRows({
        pageIds: context.pageIds,
        eyebrow: "The issues",
        heading: "Say what you will work on",
        intro:
          "Name the few things the campaign is about, each in a line a voter remembers.",
        link: { label: "Every issue", pageKey: "issues" },
        issues: HOME_ISSUES,
      })}
      {featuredEvent({
        placeBlock: context.placeBlock,
        pageIds: context.pageIds,
        eyebrow: "Next event",
        heading: "Come and meet the campaign",
        intro:
          "Say what happens at your events, and that everyone is welcome to come and ask questions.",
      })}
      {opportunitiesSection({
        pageIds: context.pageIds,
        eyebrow: "Volunteer",
        heading: "Pick a way to help",
        intro: "Say what volunteers do, and how much time each way takes.",
        headerLink: { label: "All the ways to help", pageKey: "volunteer" },
        cardLink: { label: "Sign up", pageKey: "volunteer" },
        items: HOME_OPPORTUNITIES,
      })}
      {signUpSection({
        placeBlock: context.placeBlock,
        eyebrow: "Stay in touch",
        heading: "Get campaign news first",
        body: "Sign up for news on events, volunteer shifts and the days that matter, such as [election day].",
        note: "One or two emails a [month]. Unsubscribe at any time.",
        formHeading: "Join the list",
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
