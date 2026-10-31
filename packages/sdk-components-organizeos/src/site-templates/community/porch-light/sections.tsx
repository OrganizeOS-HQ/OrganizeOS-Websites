import { css, ws } from "@webstudio-is/template";
import {
  BREAKPOINT,
  CONTAINER,
  SPACE,
  type SiteLink,
  contentBlock,
  sample,
  section,
} from "../../kit";
import type { PageContext } from "../../types";
import {
  buttons,
  eventsBoard,
  keyed,
  photo,
  quietLink,
  sectionHeader,
  text,
  type PageIds,
} from "./parts";
import {
  RADIUS,
  cardStyles,
  gridStyles,
  headingStyles,
  invertedButtonStyles,
  labelStyles,
  leadStyles,
  paragraphStyles,
  pullLineStyles,
  secondaryButtonStyles,
  stackStyles,
  subheadingStyles,
  tagStyles,
  titleStyles,
} from "./styles";

// The sections more than one of Porch Light's pages use, each a kit section
// named from the vocabulary.

/**
 * Page header: Plain. The tag names the page, the h1 says what it is for, a
 * sentence leads in.
 */
export const pageHeader = ({
  tag,
  title,
  intro,
}: {
  tag: string;
  title: string;
  intro: string;
}): JSX.Element =>
  section({
    label: "Page header",
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
        {text("p", tagStyles(), tag, "Tag")}
        <ws.element
          ws:tag="h1"
          ws:style={[
            ...titleStyles(),
            ...css`
              max-width: 15em;
            `,
          ]}
        >
          {sample(title)}
        </ws.element>
        {text("p", leadStyles(), intro)}
      </ws.element>
    ),
  });

/**
 * About: Image right (or left): the story beside a 4:5 photo, with one pull
 * line underlined in teal and an optional link to the page that has more.
 * Below 768px the text comes first and the photo follows, cropped 4:3.
 */
export const aboutSection = ({
  context,
  imageSide,
  file,
  position,
  tag,
  heading,
  paragraphs,
  pullLine,
  link,
}: {
  context: PageContext;
  imageSide: "left" | "right";
  file: string;
  position?: string;
  tag: string;
  heading: string;
  paragraphs: string[];
  pullLine: string;
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
          row-gap: ${SPACE[32]};
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
            text("p", tagStyles(), tag, "Tag"),
            text("h2", headingStyles(), heading),
            ...paragraphs.map((paragraph) =>
              text("p", paragraphStyles(), paragraph)
            ),
            text("p", pullLineStyles(), pullLine, "Pull line"),
            ...(link === undefined ? [] : [quietLink(context.pageIds, link)]),
          ])}
        </ws.element>
        {photo(context, file, {
          ratio: "4 / 5",
          phoneRatio: "4 / 3",
          position,
          outlined: true,
        })}
      </ws.element>
    ),
  });

/** [what it takes, the role, a line about it] */
export type Opportunity = [string, string, string];

/**
 * One way to help, in an outlined card: what it takes in teal, its name, a
 * line, and a link down to the sign-up form.
 */
const opportunity = (
  pageIds: PageIds,
  [commitment, name, line]: Opportunity
) => (
  <ws.element ws:tag="article" ws:label="Opportunity" ws:style={cardStyles()}>
    {text("p", labelStyles(), commitment, "Label")}
    {text("h3", subheadingStyles(), name)}
    {text("p", paragraphStyles(), line)}
    <ws.element
      ws:tag="div"
      ws:style={css`
        margin-top: auto;
      `}
    >
      {quietLink(pageIds, { label: "Sign up to help", href: "#sign-up" })}
    </ws.element>
  </ws.element>
);

/**
 * Volunteer opportunities: Cards, two by two in 2px outlined cards, one
 * column on phones. Each card links to the page's `#sign-up`.
 */
export const opportunitiesSection = ({
  pageIds,
  heading,
  intro,
  link,
  items,
}: {
  pageIds: PageIds;
  heading: string;
  intro: string;
  link?: SiteLink;
  items: Opportunity[];
}): JSX.Element =>
  section({
    label: "Volunteer opportunities: Cards",
    children: keyed([
      sectionHeader({ pageIds, tag: "Pitch in", heading, intro, link }),
      <ws.element
        ws:tag="div"
        ws:label="Cards"
        ws:style={[
          ...gridStyles(2),
          ...css`
            align-items: stretch;
          `,
        ]}
      >
        {contentBlock({
          label: "Opportunities",
          template: opportunity(pageIds, [
            "[Time it takes]",
            "[Role]",
            "[What the role does.]",
          ]),
          items: items.map((item) => opportunity(pageIds, item)),
        })}
      </ws.element>,
    ]),
  });

/**
 * Events: Card grid. The Event List of everything coming up, in its
 * noticeboard, under its heading.
 */
export const eventsSection = ({
  placeBlock,
  pageIds,
  tag,
  heading,
  intro,
  link,
}: Pick<PageContext, "placeBlock" | "pageIds"> & {
  tag: string;
  heading: string;
  intro: string;
  link?: SiteLink;
}): JSX.Element =>
  section({
    label: "Events: Card grid",
    children: keyed([
      sectionHeader({ pageIds, tag, heading, intro, link }),
      eventsBoard(
        placeBlock("@organizeos/site-components:EventList", "events")
      ),
    ]),
  });

/**
 * Sign-up: Centered, on the berry band: the reason to sign up centred in
 * the band's base text, then the Signup Form in a base-coloured panel, since
 * a placed block's text reads --text, which is checked against the base
 * alone. The section is `#sign-up`, for in-page links.
 */
export const signUpSection = ({
  placeBlock,
  tag,
  heading,
  body,
  note,
}: Pick<PageContext, "placeBlock"> & {
  tag: string;
  heading: string;
  body: string;
  note: string;
}): JSX.Element =>
  section({
    label: "Sign-up: Centered",
    id: "sign-up",
    background: "accent-1",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: flex;
          flex-direction: column;
          align-items: center;
          row-gap: ${SPACE[16]};
          text-align: center;
        `}
      >
        {text("p", tagStyles({ onBand: true }), tag, "Tag")}
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
        {text("p", paragraphStyles("34em", { centred: true }), body)}
        {/*
          The form opens with its own h2, whose top margin (about 22px) adds
          to the panel's: the panel gives up as much at the top, so the form
          sits evenly in it. Its text is left-aligned, as a form reads.
        */}
        <ws.element
          ws:tag="div"
          ws:label="Form panel"
          ws:style={css`
            box-sizing: border-box;
            width: 100%;
            max-width: 34rem;
            margin-top: ${SPACE[16]};
            padding-top: ${SPACE[12]};
            padding-right: ${SPACE[32]};
            padding-bottom: ${SPACE[32]};
            padding-left: ${SPACE[32]};
            border-radius: ${RADIUS};
            background-color: var(--base);
            color: var(--text);
            text-align: left;
            ${BREAKPOINT.landscape} {
              padding-top: ${SPACE[4]};
              padding-right: ${SPACE[24]};
              padding-bottom: ${SPACE[24]};
              padding-left: ${SPACE[24]};
            }
          `}
        >
          {placeBlock("@organizeos/site-components:SignupForm", "signup")}
        </ws.element>
        {text(
          "p",
          css`
            margin: 0;
            font-size: 16px;
            line-height: 1.5;
          `,
          note,
          "Note"
        )}
      </ws.element>
    ),
  });

/** [kind, the address or number] */
export type Method = [string, string];

/** One way to reach the group: what it is, then the address. */
const method = ([kind, value]: Method) => (
  <ws.element
    ws:tag="div"
    ws:label="Contact method"
    ws:style={stackStyles(SPACE[4])}
  >
    {text("p", labelStyles(), kind, "Label")}
    {text(
      "p",
      css`
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        line-height: 1.35;
        overflow-wrap: anywhere;
      `,
      value,
      "Value"
    )}
  </ws.element>
);

/**
 * Contact: Split, leading with the meeting: the heading across the top,
 * then where and when the group meets, large, in an outlined card on the
 * left, and the other ways to reach it on the right, level with the card's
 * first line. One column on phones, the meeting first.
 */
export const contactSection = ({
  heading,
  methods,
}: {
  heading: string;
  methods: Method[];
}): JSX.Element =>
  section({
    label: "Contact: Split",
    children: keyed([
      <ws.element
        ws:tag="div"
        ws:label="Heading"
        ws:style={[
          ...stackStyles(SPACE[16]),
          ...css`
            margin-bottom: ${SPACE[48]};
            ${BREAKPOINT.landscape} {
              margin-bottom: ${SPACE[32]};
            }
          `,
        ]}
      >
        {text("p", tagStyles(), "Come along", "Tag")}
        {text("h2", headingStyles(), heading)}
      </ws.element>,
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
          align-items: start;
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
        <ws.element
          ws:tag="div"
          ws:label="Meeting"
          ws:style={cardStyles(SPACE[24])}
        >
          <ws.element ws:tag="div" ws:style={stackStyles(SPACE[4])}>
            {text("p", labelStyles(), "Where", "Label")}
            {text("h3", subheadingStyles(), "[Meeting place]")}
            {text("p", paragraphStyles(), "[Street address], [City]")}
          </ws.element>
          <ws.element ws:tag="div" ws:style={stackStyles(SPACE[4])}>
            {text("p", labelStyles(), "When", "Label")}
            {text("h3", subheadingStyles(), "[Tuesdays] at [7pm]")}
            {text(
              "p",
              paragraphStyles(),
              "Say how often you meet, such as [twice a month], how to find the room, and that anyone who lives nearby is welcome."
            )}
          </ws.element>
        </ws.element>
        <ws.element
          ws:tag="div"
          ws:label="Other ways"
          ws:style={[
            ...stackStyles(SPACE[24]),
            ...css`
              padding-top: ${SPACE[32]};
              ${BREAKPOINT.landscape} {
                padding-top: 0;
              }
            `,
          ]}
        >
          {text(
            "p",
            [
              ...paragraphStyles(),
              ...css`
                font-weight: 700;
              `,
            ],
            "Can't make it? Reach us another way."
          )}
          <ws.element
            ws:tag="div"
            ws:label="Methods"
            ws:style={stackStyles(SPACE[24])}
          >
            {contentBlock({
              label: "Contact methods",
              template: method(["[Kind]", "[Address or number]"]),
              items: methods.map(method),
            })}
          </ws.element>
        </ws.element>
      </ws.element>,
    ]),
  });

/** [question, answer] */
export type Question = [string, string];

/** One question over its answer. */
const question = ([asked, answer]: Question): JSX.Element => (
  <ws.element ws:tag="div" ws:label="Question" ws:style={stackStyles(SPACE[8])}>
    {text("h3", subheadingStyles(), asked)}
    {text("p", paragraphStyles(), answer)}
  </ws.element>
);

/** FAQ: Two columns, every answer open. */
export const faqSection = ({
  pageIds,
  heading,
  questions,
}: {
  pageIds: PageIds;
  heading: string;
  questions: Question[];
}): JSX.Element =>
  section({
    label: "FAQ: Two columns",
    children: keyed([
      sectionHeader({ pageIds, tag: "Questions", heading }),
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: ${SPACE[64]};
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

/**
 * Call to action band: Centered, on the berry band: a heading, a sentence
 * and two pills, the first base-coloured and the second outlined in the
 * band's text colour.
 */
export const ctaBand = ({
  pageIds,
  tag,
  heading,
  body,
  primary,
  secondary,
}: {
  pageIds: PageIds;
  tag: string;
  heading: string;
  body: string;
  primary: SiteLink;
  secondary?: SiteLink;
}): JSX.Element =>
  section({
    label: "Call to action band: Centered",
    background: "accent-1",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: flex;
          flex-direction: column;
          align-items: center;
          row-gap: ${SPACE[16]};
          text-align: center;
        `}
      >
        {text("p", tagStyles({ onBand: true }), tag, "Tag")}
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
        {text("p", paragraphStyles(CONTAINER.narrow, { centred: true }), body)}
        <ws.element
          ws:tag="div"
          ws:style={css`
            margin-top: ${SPACE[16]};
            ${BREAKPOINT.landscape} {
              align-self: stretch;
            }
          `}
        >
          {buttons({
            pageIds,
            primary,
            secondary,
            justify: "center",
            styles: [invertedButtonStyles(), secondaryButtonStyles()],
          })}
        </ws.element>
      </ws.element>
    ),
  });
