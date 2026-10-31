import { css, ws } from "@webstudio-is/template";
import { BREAKPOINT, SPACE, contentBlock, section } from "../../../kit";
import type { PageContext, SiteTemplatePage } from "../../../types";
import {
  DONATE,
  actions,
  eventsFrame,
  keyed,
  photo,
  sectionHeader,
  siteFooter,
  siteNav,
  text,
} from "../parts";
import { ctaBand, signUpSection, statsBand } from "../sections";
import {
  bodyStyles,
  displayStyles,
  eyebrowStyles,
  gridStyles,
  leadStyles,
  paragraphStyles,
  ruleStyles,
  stackStyles,
  subheadingStyles,
} from "../styles";
import { PROGRAMS, type Program } from "../sample-programs";

// Home (directions 2.1 and section 3): Nav with Donate as its button; Hero:
// Split with the photo on the right; Stats: Band, the page's one coloured
// band; Programs as a card grid; the donate ask; the next events; Sign-up;
// Footer: Columns.

/**
 * Hero: Split. The headline, one sentence, Get involved and a quiet Donate
 * on the left; a tall 4:5 photo on the right. Below 768px the text and
 * buttons come first and the photo follows, cropped 4:3.
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
        <ws.element ws:tag="div" ws:style={stackStyles(SPACE[24])}>
          {text(
            "p",
            eyebrowStyles(),
            "[Your cause] in [your place]",
            "Eyebrow"
          )}
          <ws.element ws:tag="h1" ws:style={displayStyles()}>
            {"Say in one sentence what your organization is working toward"}
          </ws.element>
          {text(
            "p",
            leadStyles(),
            "Add one sentence about who you work with, and how people can take part."
          )}
          <ws.element
            ws:tag="div"
            ws:style={css`
              margin-top: ${SPACE[8]};
            `}
          >
            {actions(
              context.pageIds,
              { label: "Get involved", pageKey: "get-involved" },
              DONATE
            )}
          </ws.element>
        </ws.element>
        {photo(context, "hero.jpg", {
          ratio: "4 / 5",
          phoneRatio: "4 / 3",
          position: "50% 15%",
        })}
      </ws.element>
    ),
  });

/** One program: a 3:2 photo, then under a rule its area, name and two lines. */
const programCard = (
  context: PageContext,
  [file, area, name, summary]: Program
) => (
  <ws.element
    ws:tag="article"
    ws:label="Program"
    ws:style={stackStyles(SPACE[24])}
  >
    {photo(context, file, { ratio: "3 / 2" })}
    <ws.element
      ws:tag="div"
      ws:style={[
        ...ruleStyles(),
        ...stackStyles(SPACE[8]),
        ...css`
          width: 100%;
        `,
      ]}
    >
      {text("p", eyebrowStyles(), area, "Eyebrow")}
      {text("h3", subheadingStyles(), name)}
      {text("p", paragraphStyles(), summary)}
    </ws.element>
  </ws.element>
);

/** Programs: Card grid, three up without card chrome. */
const programs = (context: PageContext) =>
  section({
    label: "Programs: Card grid",
    children: keyed([
      sectionHeader({
        pageIds: context.pageIds,
        eyebrow: "Programs",
        heading: "What we do, and who it is for",
        intro: "Introduce your programs in a sentence or two.",
        link: { label: "All programs", pageKey: "programs" },
      }),
      <ws.element ws:tag="div" ws:label="Cards" ws:style={gridStyles(3)}>
        {contentBlock({
          label: "Programs",
          template: programCard(context, PROGRAMS[0]),
          items: PROGRAMS.map((program) => programCard(context, program)),
        })}
      </ws.element>,
    ]),
  });

/** Events: Card grid, the Event List under its heading. */
const events = (context: PageContext) =>
  section({
    label: "Events: Card grid",
    children: (
      <ws.element ws:tag="div">
        {sectionHeader({
          pageIds: context.pageIds,
          eyebrow: "Events",
          heading: "Come to something",
          intro:
            "Your upcoming events appear here as you publish them in OrganizeOS.",
          link: { label: "All events", pageKey: "events" },
        })}
        {eventsFrame(
          context.placeBlock("@organizeos/site-components:EventList", "events")
        )}
      </ws.element>
    ),
  });

export const home: SiteTemplatePage = {
  key: "home",
  name: "Home",
  path: "",
  title: "[Organization name]",
  description:
    "Say in one sentence what your organization is working toward, and who it works with.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {hero(context)}
      {statsBand({
        heading: "[Year] at a glance",
        stats: [
          ["[1,200]", "people who took part in a program"],
          ["[340]", "volunteers who gave their time"],
          ["[18]", "partners we work alongside"],
          ["[92%]", "of every gift spent on programs"],
        ],
      })}
      {programs(context)}
      {ctaBand({
        pageIds: context.pageIds,
        eyebrow: "Support the work",
        heading: "Help keep the work going",
        body: "Say in a sentence what a gift pays for, such as [a month of meals].",
        primary: DONATE,
        secondary: { label: "Other ways to give", pageKey: "get-involved" },
      })}
      {events(context)}
      {signUpSection({
        placeBlock: context.placeBlock,
        eyebrow: "Newsletter",
        heading: "Stay close to the work",
        body: "Sign up for [monthly] updates: what changed, what is next, and where you can help.",
        note: "One email a [month]. Unsubscribe at any time.",
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
