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
import { eventCardStyle, eventListStyle } from "./block-tokens";
import {
  DONATE,
  VOLUNTEER,
  buttons,
  quietLink,
  sectionHeader,
  type PageIds,
} from "./parts";
import {
  HAIRLINE,
  RADIUS,
  eyebrowStyles,
  gridStyles,
  hairlineAboveStyles,
  headingStyles,
  invertedButtonStyles,
  labelStyles,
  leadStyles,
  noteStyles,
  numeralStyles,
  outlineButtonStyles,
  outlineStyles,
  paragraphStyles,
  stackStyles,
  subheadingStyles,
  titleStyles,
} from "./styles";

// The sections more than one of Marigold Marquee's pages use, each a kit
// section named from the vocabulary.

/**
 * Page header: Plain, on the ink: the eyebrow names the page, the h1 says
 * what it is for, a sentence leads in; a full-width hairline closes it off
 * from the page's first section, on the same ink.
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
    styles: css`
      border-bottom-width: 1px;
      border-bottom-style: solid;
      border-bottom-color: ${HAIRLINE};
    `,
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

/** [number, title, a line, the steps it takes (the Issues page)] */
export type Issue = [string, string, string, string[]?];

/**
 * One issue as a row under a hairline: its number large in mint, its title,
 * and a line, with the steps under the line when there are any. Three
 * columns on a wide window (number, title, line), the line under the title
 * from 992px down, and the number above the title on phones.
 */
const issue = ([number, title, line, steps = []]: Issue) => (
  <ws.element
    ws:tag="div"
    ws:label="Issue"
    ws:style={[
      ...hairlineAboveStyles(),
      ...css`
        display: grid;
        grid-template-columns: 9rem minmax(0, 5fr) minmax(0, 7fr);
        align-items: baseline;
        column-gap: ${SPACE[32]};
        row-gap: ${SPACE[12]};
        padding-top: ${SPACE[32]};
        padding-bottom: ${SPACE[32]};
        ${BREAKPOINT.tablet} {
          grid-template-columns: 6.5rem minmax(0, 1fr);
        }
        ${BREAKPOINT.landscape} {
          grid-template-columns: minmax(0, 1fr);
          row-gap: ${SPACE[8]};
          padding-top: ${SPACE[24]};
          padding-bottom: ${SPACE[24]};
        }
      `,
    ]}
  >
    {keyed([
      text(
        "p",
        [
          ...numeralStyles("clamp(56px, 2.4vw + 40px, 84px)"),
          ...css`
            ${BREAKPOINT.landscape} {
              font-size: 48px;
              margin-bottom: ${SPACE[4]};
            }
          `,
        ],
        number,
        "Number"
      ),
      text("h3", subheadingStyles("30px", "24px"), title),
      <ws.element
        ws:tag="div"
        ws:style={[
          ...stackStyles(SPACE[16]),
          ...css`
            ${BREAKPOINT.tablet} {
              grid-column-start: 2;
            }
            ${BREAKPOINT.landscape} {
              grid-column-start: 1;
            }
          `,
        ]}
      >
        {keyed([
          text("p", paragraphStyles(), line),
          ...(steps.length === 0
            ? []
            : [
                <ws.element
                  ws:tag="ul"
                  ws:label="Steps"
                  ws:style={css`
                    display: flex;
                    flex-direction: column;
                    row-gap: ${SPACE[8]};
                    margin: 0;
                    padding-left: 1.2em;
                  `}
                >
                  {keyed(
                    steps.map((step) =>
                      text(
                        "li",
                        css`
                          padding-left: ${SPACE[4]};
                        `,
                        step,
                        "Step"
                      )
                    )
                  )}
                </ws.element>,
              ]),
        ])}
      </ws.element>,
    ])}
  </ws.element>
);

/**
 * Issues or programs: Alternating rows, numbered and text-first: the issues
 * as rows of a big mint number, a title and a line, between hairlines, the
 * last closed by one.
 */
export const issuesRows = ({
  pageIds,
  eyebrow,
  heading,
  intro,
  link,
  issues,
}: {
  pageIds: PageIds;
  eyebrow: string;
  heading: string;
  intro: string;
  link?: SiteLink;
  issues: Issue[];
}): JSX.Element =>
  section({
    label: "Issues or programs: Alternating rows",
    children: keyed([
      sectionHeader({ pageIds, eyebrow, heading, intro, link }),
      <ws.element
        ws:tag="div"
        ws:label="Issues"
        ws:style={css`
          border-bottom-width: 1px;
          border-bottom-style: solid;
          border-bottom-color: ${HAIRLINE};
        `}
      >
        {contentBlock({
          label: "Issues",
          template: issue([
            "[00]",
            "[Issue]",
            "[One line on what you will do.]",
          ]),
          items: issues.map(issue),
        })}
      </ws.element>,
    ]),
  });

/**
 * Events: Card grid, of one: the next event, featured in a marigold-outlined
 * panel beside the reason to come and a "See all dates" link to the Events
 * page, where the Event List is. On phones the card follows the text and the
 * link follows the card.
 */
export const featuredEvent = ({
  placeBlock,
  pageIds,
  eyebrow,
  heading,
  intro,
}: Pick<PageContext, "placeBlock" | "pageIds"> & {
  eyebrow: string;
  heading: string;
  intro: string;
}): JSX.Element =>
  section({
    label: "Events: Card grid",
    children: (
      <ws.element
        ws:tag="div"
        ws:label="Panel"
        ws:style={[
          ...outlineStyles("var(--accent-1)"),
          ...css`
            display: grid;
            grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
            grid-template-rows: auto 1fr;
            column-gap: ${SPACE[64]};
            row-gap: ${SPACE[24]};
            padding-top: ${SPACE[48]};
            padding-right: ${SPACE[48]};
            padding-bottom: ${SPACE[48]};
            padding-left: ${SPACE[48]};
            ${BREAKPOINT.tablet} {
              column-gap: ${SPACE[32]};
              padding-top: ${SPACE[32]};
              padding-right: ${SPACE[32]};
              padding-bottom: ${SPACE[32]};
              padding-left: ${SPACE[32]};
            }
            ${BREAKPOINT.landscape} {
              grid-template-columns: minmax(0, 1fr);
              grid-template-rows: auto;
              row-gap: ${SPACE[24]};
              padding-top: ${SPACE[24]};
              padding-right: ${SPACE[16]};
              padding-bottom: ${SPACE[16]};
              padding-left: ${SPACE[16]};
            }
          `,
        ]}
      >
        <ws.element ws:tag="div" ws:style={stackStyles(SPACE[16])}>
          {text("p", eyebrowStyles(), eyebrow, "Eyebrow")}
          {text("h2", headingStyles(), heading)}
          {text("p", paragraphStyles(), intro)}
        </ws.element>
        <ws.element
          ws:tag="div"
          ws:style={css`
            align-self: end;
            ${BREAKPOINT.landscape} {
              order: 2;
            }
          `}
        >
          {quietLink(pageIds, { label: "See all dates", pageKey: "events" })}
        </ws.element>
        {placeBlock("@organizeos/site-components:EventCard", "featured", {
          style: eventCardStyle(),
        })}
      </ws.element>
    ),
  });

/**
 * Events: List. The Event List of everything coming up as dated rows, each
 * under a hairline as the issues' rows are; its looks are in the template's
 * blockTokens (./block-tokens).
 */
export const eventsList = ({
  placeBlock,
  pageIds,
  eyebrow,
  heading,
  intro,
}: Pick<PageContext, "placeBlock" | "pageIds"> & {
  eyebrow: string;
  heading: string;
  intro: string;
}): JSX.Element =>
  section({
    label: "Events: List",
    children: keyed([
      sectionHeader({ pageIds, eyebrow, heading, intro }),
      placeBlock("@organizeos/site-components:EventList", "events", {
        card: "dated",
        style: eventListStyle(),
      }),
    ]),
  });

/** [what it takes, the role, a line about it] */
export type Opportunity = [string, string, string];

/**
 * One way to help as a card under a mint top rule: what it takes, its name,
 * a line, and a link to the sign-up.
 */
const opportunity = (
  pageIds: PageIds,
  link: SiteLink,
  [commitment, role, line]: Opportunity
) => (
  <ws.element
    ws:tag="article"
    ws:label="Opportunity"
    ws:style={[
      ...stackStyles(SPACE[12]),
      ...css`
        padding-top: ${SPACE[24]};
        border-top-width: 4px;
        border-top-style: solid;
        border-top-color: var(--accent-2);
      `,
    ]}
  >
    {text("p", labelStyles(), commitment, "Label")}
    {text("h3", subheadingStyles(), role)}
    {text("p", paragraphStyles(), line)}
    <ws.element
      ws:tag="div"
      ws:style={css`
        margin-top: auto;
      `}
    >
      {quietLink(pageIds, link)}
    </ws.element>
  </ws.element>
);

/**
 * Volunteer opportunities: Cards, three up (two from 768px to 991px), one
 * column on phones, each under a mint top rule with a link to `link`.
 */
export const opportunitiesSection = ({
  pageIds,
  eyebrow,
  heading,
  intro,
  headerLink,
  cardLink,
  items,
}: {
  pageIds: PageIds;
  eyebrow: string;
  heading: string;
  intro: string;
  headerLink?: SiteLink;
  cardLink: SiteLink;
  items: Opportunity[];
}): JSX.Element =>
  section({
    label: "Volunteer opportunities: Cards",
    children: keyed([
      sectionHeader({
        pageIds,
        eyebrow,
        heading,
        intro,
        link: headerLink,
      }),
      <ws.element ws:tag="div" ws:label="Cards" ws:style={gridStyles(3)}>
        {contentBlock({
          label: "Opportunities",
          template: opportunity(pageIds, cardLink, [
            "[Time it takes]",
            "[Role]",
            "[What the role does.]",
          ]),
          items: items.map((item) => opportunity(pageIds, cardLink, item)),
        })}
      </ws.element>,
    ]),
  });

/**
 * Sign-up: Side by side, on the chalk band (a text background with base
 * text), the page's one light section: the reason to sign up on the left,
 * the Signup Form under a heading of its own in an ink panel on the right (a
 * placed block's text reads --text, which is checked against the base
 * alone), under the text below 768px. The section is `#sign-up`, for in-page
 * links.
 */
export const signUpSection = ({
  placeBlock,
  eyebrow,
  heading,
  body,
  note,
  formHeading,
}: Pick<PageContext, "placeBlock"> & {
  eyebrow: string;
  heading: string;
  body: string;
  note: string;
  /** The Signup Form's own heading. */
  formHeading: string;
}): JSX.Element =>
  section({
    label: "Sign-up: Side by side",
    id: "sign-up",
    background: "text",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
          align-items: center;
          column-gap: ${SPACE[64]};
          row-gap: ${SPACE[32]};
          ${BREAKPOINT.tablet} {
            column-gap: ${SPACE[32]};
          }
          ${BREAKPOINT.landscape} {
            grid-template-columns: minmax(0, 1fr);
          }
        `}
      >
        <ws.element ws:tag="div" ws:style={stackStyles(SPACE[16])}>
          {text("p", eyebrowStyles({ onBand: true }), eyebrow, "Eyebrow")}
          {text("h2", headingStyles(), heading)}
          {text("p", paragraphStyles(), body)}
          {text(
            "p",
            [
              ...noteStyles(),
              ...css`
                margin-top: ${SPACE[8]};
              `,
            ],
            note,
            "Note"
          )}
        </ws.element>
        {/*
          The form's heading sits flush with the panel's top padding (OS Form
          Heading has no top margin), so the panel is padded evenly.
        */}
        <ws.element
          ws:tag="div"
          ws:label="Form panel"
          ws:style={css`
            padding-top: ${SPACE[48]};
            padding-right: ${SPACE[48]};
            padding-bottom: ${SPACE[48]};
            padding-left: ${SPACE[48]};
            border-radius: ${RADIUS};
            background-color: var(--base);
            color: var(--text);
            ${BREAKPOINT.tablet} {
              padding-top: ${SPACE[32]};
              padding-right: ${SPACE[32]};
              padding-bottom: ${SPACE[32]};
              padding-left: ${SPACE[32]};
            }
            ${BREAKPOINT.landscape} {
              padding-top: ${SPACE[24]};
              padding-right: ${SPACE[24]};
              padding-bottom: ${SPACE[24]};
              padding-left: ${SPACE[24]};
            }
          `}
        >
          {placeBlock("@organizeos/site-components:SignupForm", "signup", {
            heading: formHeading,
          })}
        </ws.element>
      </ws.element>
    ),
  });

/**
 * Call to action band: Split, on marigold: a claim and a sentence on the
 * left, Donate (ink, labelled in marigold) and Volunteer (outlined in ink)
 * on the right; stacked full width on phones, Donate on top.
 */
export const donateBand = ({
  pageIds,
  heading,
  body,
}: {
  pageIds: PageIds;
  heading: string;
  body: string;
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
          align-items: center;
          column-gap: ${SPACE[64]};
          row-gap: ${SPACE[32]};
          ${BREAKPOINT.tablet} {
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
        {buttons({
          pageIds,
          primary: DONATE,
          secondary: VOLUNTEER,
          styles: [invertedButtonStyles(), outlineButtonStyles()],
        })}
      </ws.element>
    ),
  });

/** [the quote, the name, the role] */
export type Quote = [string, string, string];

/**
 * One endorsement in a card outlined by a hairline: a large mint quotation
 * mark, the words, and who said them.
 */
const quote = ([words, name, role]: Quote) => (
  <ws.element
    ws:tag="figure"
    ws:label="Quote"
    ws:style={css`
      display: flex;
      flex-direction: column;
      row-gap: ${SPACE[16]};
      margin: 0;
      padding-top: ${SPACE[32]};
      padding-right: ${SPACE[32]};
      padding-bottom: ${SPACE[32]};
      padding-left: ${SPACE[32]};
      border-width: 1px;
      border-style: solid;
      border-top-color: ${HAIRLINE};
      border-right-color: ${HAIRLINE};
      border-bottom-color: ${HAIRLINE};
      border-left-color: ${HAIRLINE};
      border-radius: ${RADIUS};
      ${BREAKPOINT.landscape} {
        padding-top: ${SPACE[24]};
        padding-right: ${SPACE[24]};
        padding-bottom: ${SPACE[24]};
        padding-left: ${SPACE[24]};
      }
    `}
  >
    {text(
      "p",
      [
        ...numeralStyles("72px"),
        ...css`
          height: 0.5em;
        `,
      ],
      "“",
      "Mark"
    )}
    <ws.element
      ws:tag="blockquote"
      ws:style={css`
        margin: 0;
        font-size: 20px;
        line-height: 1.5;
        text-wrap-style: pretty;
        ${BREAKPOINT.landscape} {
          font-size: 18px;
        }
      `}
    >
      {text("p", paragraphStyles(), words)}
    </ws.element>
    <ws.element
      ws:tag="figcaption"
      ws:style={css`
        display: flex;
        flex-direction: column;
        row-gap: ${SPACE[4]};
        margin-top: auto;
        padding-top: ${SPACE[8]};
      `}
    >
      {text(
        "p",
        css`
          margin: 0;
          font-weight: 600;
        `,
        name,
        "Name"
      )}
      {text("p", noteStyles(), role, "Role")}
    </ws.element>
  </ws.element>
);

/**
 * Endorsements and testimonials: Quote cards, three up (two from 768px to
 * 991px), one column on phones.
 */
export const quoteCards = ({
  pageIds,
  eyebrow,
  heading,
  intro,
  quotes,
}: {
  pageIds: PageIds;
  eyebrow: string;
  heading: string;
  intro: string;
  quotes: Quote[];
}): JSX.Element =>
  section({
    label: "Endorsements and testimonials: Quote cards",
    children: keyed([
      sectionHeader({ pageIds, eyebrow, heading, intro }),
      <ws.element
        ws:tag="div"
        ws:label="Cards"
        ws:style={gridStyles(3, 2, {
          rowGap: SPACE[32],
          phoneRowGap: SPACE[24],
        })}
      >
        {contentBlock({
          label: "Quotes",
          template: quote([
            "Their words, in a sentence or two.",
            "[Full name]",
            "[Role], [Place]",
          ]),
          items: quotes.map(quote),
        })}
      </ws.element>,
    ]),
  });

/**
 * About: Image left (or right): the story beside its picture (a portrait in
 * its frame, or a photo), vertically centred. Below 768px the text comes
 * first and the picture follows.
 */
export const aboutSection = ({
  pageIds,
  imageSide,
  media,
  eyebrow,
  heading,
  paragraphs,
  link,
}: {
  pageIds: PageIds;
  imageSide: "left" | "right";
  media: JSX.Element;
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  link?: SiteLink;
}): JSX.Element =>
  section({
    label: `About: Image ${imageSide}`,
    children: (
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: ${imageSide === "right"
            ? "minmax(0, 7fr) minmax(0, 5fr)"
            : "minmax(0, 5fr) minmax(0, 7fr)"};
          align-items: center;
          column-gap: ${SPACE[64]};
          row-gap: ${SPACE[48]};
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
          ws:style={[
            ...stackStyles(SPACE[16]),
            ...css`
              order: ${imageSide === "right" ? "0" : "2"};
              ${BREAKPOINT.landscape} {
                order: 0;
              }
            `,
          ]}
        >
          {keyed([
            text("p", eyebrowStyles(), eyebrow, "Eyebrow"),
            text("h2", headingStyles(), heading),
            ...paragraphs.map((paragraph) =>
              text("p", paragraphStyles(), paragraph)
            ),
            ...(link === undefined ? [] : [quietLink(pageIds, link)]),
          ])}
        </ws.element>
        {media}
      </ws.element>
    ),
  });

/** [figure, what it counts] */
export type Stat = [string, string];

/** One figure, large in mint, over what it counts. */
const stat = ([figure, label]: Stat) => (
  <ws.element
    ws:tag="div"
    ws:label="Stat"
    ws:style={[
      ...hairlineAboveStyles(),
      ...stackStyles(SPACE[12]),
      ...css`
        padding-top: ${SPACE[24]};
      `,
    ]}
  >
    {text(
      "p",
      numeralStyles("clamp(48px, 2vw + 34px, 64px)"),
      figure,
      "Figure"
    )}
    {text("p", paragraphStyles(), label, "Label")}
  </ws.element>
);

/**
 * Stats: Inline row: three figures side by side under hairlines, one column
 * on phones.
 */
export const statsRow = ({
  pageIds,
  eyebrow,
  heading,
  stats,
}: {
  pageIds: PageIds;
  eyebrow: string;
  heading: string;
  stats: Stat[];
}): JSX.Element =>
  section({
    label: "Stats: Inline row",
    children: keyed([
      sectionHeader({ pageIds, eyebrow, heading }),
      <ws.element
        ws:tag="div"
        ws:label="Figures"
        ws:style={gridStyles(3, 3, {
          rowGap: SPACE[32],
          phoneRowGap: SPACE[24],
        })}
      >
        {contentBlock({
          label: "Stats",
          template: stat(["[0]", "[What the figure counts]"]),
          items: stats.map(stat),
        })}
      </ws.element>,
    ]),
  });
