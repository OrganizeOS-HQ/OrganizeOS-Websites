import { css, ws, type TemplateStyleDecl } from "@webstudio-is/template";
import { $ } from "../shared/proxy";
import {
  BREAKPOINT,
  CONTAINER,
  SPACE,
  buttonStyles,
  contentBlock,
  focusRing,
  keyed,
  sample,
  section,
  tapTarget,
  text,
} from "../site-templates/kit";
import { fontWeight, textCase } from "../site-templates/kit/layout";
import type { PlaceBlock } from "../site-templates/place-block";
import type { PlatformPath } from "../site-templates/platform-paths";
import type { CompleteKitStyle } from "../site-templates/types";
import type { StarterPageContext } from "./types";

// The sections the page templates are built from (OrganizeOS design
// 2026-11-13-builder-templates-screen-and-page-templates-design.md, section
// 6.3; Fork C2 plan, rulings 2 and 3). Each is written once against the kit
// and drawn in the site's look: headings take only its weight and case, and
// body-font emphasis its button weight, a weight the site's body face
// carries, so a single-weight face is never asked for a bold it lacks. Sizes
// are the page templates' own neutral scale. accent-2 colours only rules and
// numerals of 24px and up, since Workwear's accent-2 passes only large text.
// Bands are accent-1, with the kit button inverted on them; every placed
// block sits on base.

type Look = CompleteKitStyle;
type Image = StarterPageContext["image"];

const EventList = "@organizeos/site-components:EventList" as const;
const SignupForm = "@organizeos/site-components:SignupForm" as const;
const RsvpForm = "@organizeos/site-components:RsvpForm" as const;

const headingBase = (look: Look): TemplateStyleDecl[] => [
  ...css`
    margin: 0;
    font-family: var(--font-heading);
    text-wrap-style: balance;
  `,
  ...fontWeight(look.headingWeight),
  ...textCase(look.headingCase),
];

const displayStyles = (look: Look) => [
  ...headingBase(look),
  ...css`
    font-size: clamp(40px, 3vw + 26px, 72px);
    line-height: 1.04;
  `,
];

const titleStyles = (look: Look) => [
  ...headingBase(look),
  ...css`
    font-size: clamp(36px, 2.4vw + 24px, 60px);
    line-height: 1.08;
  `,
];

const h2Styles = (look: Look) => [
  ...headingBase(look),
  ...css`
    font-size: clamp(30px, 1.4vw + 22px, 46px);
    line-height: 1.12;
  `,
];

const h3Styles = (look: Look) => [
  ...headingBase(look),
  ...css`
    font-size: 24px;
    line-height: 1.25;
    ${BREAKPOINT.landscape} {
      font-size: 22px;
    }
  `,
];

/** A heading-font figure in accent-2, never under 24px. */
const numeralStyles = (look: Look, size: string) => [
  ...headingBase(look),
  ...css`
    font-size: ${size};
    line-height: 1;
    color: var(--accent-2);
  `,
];

const eyebrowStyles = (look: Look) => [
  ...css`
    margin: 0;
    font-size: 14px;
    line-height: 1.4;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  `,
  ...fontWeight(look.buttonWeight),
];

const leadStyles = () => css`
  margin: 0;
  max-width: 34em;
  font-size: 20px;
  line-height: 1.5;
  text-wrap-style: pretty;
  ${BREAKPOINT.landscape} {
    font-size: 18px;
  }
`;

const paragraphStyles = (maxWidth: string = CONTAINER.text) => css`
  margin: 0;
  max-width: ${maxWidth};
  text-wrap-style: pretty;
`;

const stack = (gap: string) => css`
  display: flex;
  flex-direction: column;
  row-gap: ${gap};
`;

/** `columns` across, `tablet` across under 991px, one across on phones. */
const grid = (columns: number, tablet: number = columns) => css`
  display: grid;
  grid-template-columns: repeat(${String(columns)}, minmax(0, 1fr));
  column-gap: ${SPACE[32]};
  row-gap: ${SPACE[48]};
  ${BREAKPOINT.tablet} {
    grid-template-columns: repeat(${String(tablet)}, minmax(0, 1fr));
  }
  ${BREAKPOINT.landscape} {
    grid-template-columns: minmax(0, 1fr);
    row-gap: ${SPACE[32]};
  }
`;

/** A 1px rule in the text colour above an item. */
const rule = () => css`
  padding-top: ${SPACE[16]};
  border-top-width: 1px;
  border-top-style: solid;
  border-top-color: var(--text);
`;

/** A 1px box in the text colour, on base: a placed block's frame. */
const formBox = () => css`
  box-sizing: border-box;
  width: 100%;
  padding-top: ${SPACE[12]};
  padding-right: ${SPACE[32]};
  padding-bottom: ${SPACE[32]};
  padding-left: ${SPACE[32]};
  border-width: 1px;
  border-style: solid;
  border-top-color: var(--text);
  border-right-color: var(--text);
  border-bottom-color: var(--text);
  border-left-color: var(--text);
  background-color: var(--base);
  text-align: left;
  ${BREAKPOINT.landscape} {
    padding-top: ${SPACE[4]};
    padding-right: ${SPACE[24]};
    padding-bottom: ${SPACE[24]};
    padding-left: ${SPACE[24]};
  }
`;

const h1 = (styles: TemplateStyleDecl[], title: string) => (
  <ws.element ws:tag="h1" ws:style={styles}>
    {sample(title)}
  </ws.element>
);

/** A section's heading row: an optional eyebrow, the h2 and an intro. */
const sectionHeader = ({
  look,
  eyebrow,
  heading,
  intro,
}: {
  look: Look;
  eyebrow?: string;
  heading: string;
  intro?: string;
}) => (
  <ws.element
    ws:tag="div"
    ws:style={[
      ...stack(SPACE[12]),
      ...css`
        max-width: ${CONTAINER.narrow};
        margin-bottom: ${SPACE[48]};
        ${BREAKPOINT.landscape} {
          margin-bottom: ${SPACE[32]};
        }
      `,
    ]}
  >
    {keyed([
      ...(eyebrow ? [text("p", eyebrowStyles(look), eyebrow, "Eyebrow")] : []),
      text("h2", h2Styles(look), heading),
      ...(intro ? [text("p", leadStyles(), intro)] : []),
    ])}
  </ws.element>
);

/** A photo the org adds: the builder's placeholder until then. */
const photo = (image: Image, ratio: string, phoneRatio: string) => (
  <$.Image
    ws:label="Photo"
    {...image()}
    ws:style={css`
      display: block;
      width: 100%;
      height: auto;
      aspect-ratio: ${ratio};
      object-fit: cover;
      background-color: var(--accent-1);
      ${BREAKPOINT.landscape} {
        aspect-ratio: ${phoneRatio};
      }
    `}
  />
);

/** The kit button with the band's checked pair reversed. */
export const invertedButtonStyles = (look: Look): TemplateStyleDecl[] => [
  ...buttonStyles(look).filter(
    ({ property }) => property !== "background-color" && property !== "color"
  ),
  ...css`
    background-color: var(--base);
    color: var(--accent-1);
  `,
];

/** A link to a route the platform serves on the site's host. */
const platformButton = (
  { label, href }: { label: string; href: PlatformPath },
  styles: TemplateStyleDecl[]
) => (
  <$.Link ws:label="Button" href={href} reloadDocument ws:style={styles}>
    {label}
  </$.Link>
);

/** A quiet in-page link, underlined. */
const anchorLink = (label: string, href: `#${string}`) => (
  <$.Link
    ws:label="Link"
    href={href}
    ws:style={[
      ...tapTarget(),
      ...css`
        color: inherit;
        text-decoration-line: underline;
        text-underline-offset: 0.2em;
      `,
      ...focusRing(),
    ]}
  >
    {label}
  </$.Link>
);

export const pageHeader = ({
  look,
  eyebrow,
  title,
  intro,
}: {
  look: Look;
  eyebrow: string;
  title: string;
  intro: string;
}) =>
  section({
    label: "Page header",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={[
          ...stack(SPACE[24]),
          ...css`
            ${BREAKPOINT.landscape} {
              row-gap: ${SPACE[16]};
            }
          `,
        ]}
      >
        {text("p", eyebrowStyles(look), eyebrow, "Eyebrow")}
        {h1(
          [
            ...titleStyles(look),
            ...css`
              max-width: 16em;
            `,
          ],
          title
        )}
        {text("p", leadStyles(), intro)}
      </ws.element>
    ),
  });

export const heroSplit = ({
  look,
  image,
  eyebrow,
  title,
  intro,
}: {
  look: Look;
  image: Image;
  eyebrow: string;
  title: string;
  intro: string;
}) =>
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
        <ws.element ws:tag="div" ws:style={stack(SPACE[24])}>
          {text("p", eyebrowStyles(look), eyebrow, "Eyebrow")}
          {h1(
            [
              ...displayStyles(look),
              ...css`
                max-width: 12em;
              `,
            ],
            title
          )}
          {text("p", leadStyles(), intro)}
        </ws.element>
        {photo(image, "4 / 5", "4 / 3")}
      </ws.element>
    ),
  });

export const eventsCardGrid = ({
  look,
  placeBlock,
  heading,
  intro,
}: {
  look: Look;
  placeBlock: PlaceBlock;
  heading: string;
  intro?: string;
}) =>
  section({
    label: "Events: Card grid",
    children: keyed([
      sectionHeader({ look, heading, intro }),
      placeBlock(EventList, "events", { card: "dated" }),
    ]),
  });

export const signUpSideBySide = ({
  look,
  placeBlock,
  heading,
  intro,
  formHeading,
}: {
  look: Look;
  placeBlock: PlaceBlock;
  heading: string;
  intro: string;
  formHeading: string;
}) =>
  section({
    label: "Sign-up: Side by side",
    id: "sign-up",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
          align-items: start;
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
        <ws.element ws:tag="div" ws:style={stack(SPACE[12])}>
          {text("h2", h2Styles(look), heading)}
          {text("p", paragraphStyles(), intro)}
        </ws.element>
        <ws.element ws:tag="div" ws:label="Form box" ws:style={formBox()}>
          {placeBlock(SignupForm, "signup", { heading: formHeading })}
        </ws.element>
      </ws.element>
    ),
  });

export const signUpCentered = ({
  look,
  placeBlock,
  heading,
  intro,
}: {
  look: Look;
  placeBlock: PlaceBlock;
  heading: string;
  intro: string;
}) =>
  section({
    label: "Sign-up: Centered",
    id: "sign-up",
    width: "narrow",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={[
          ...stack(SPACE[16]),
          ...css`
            align-items: center;
            text-align: center;
          `,
        ]}
      >
        {text("h2", h2Styles(look), heading)}
        {text("p", paragraphStyles(), intro)}
        <ws.element ws:tag="div" ws:label="Form box" ws:style={formBox()}>
          {placeBlock(RsvpForm, "rsvp")}
        </ws.element>
      </ws.element>
    ),
  });

type Button = { label: string; href: PlatformPath };

export const ctaBandCentered = ({
  look,
  heading,
  intro,
  button,
}: {
  look: Look;
  heading: string;
  intro: string;
  button: Button;
}) =>
  section({
    label: "Call to action band: Centered",
    background: "accent-1",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={[
          ...stack(SPACE[16]),
          ...css`
            align-items: center;
            text-align: center;
          `,
        ]}
      >
        {text(
          "h2",
          [
            ...h2Styles(look),
            ...css`
              max-width: 16em;
            `,
          ],
          heading
        )}
        {text("p", paragraphStyles(CONTAINER.narrow), intro)}
        <ws.element
          ws:tag="div"
          ws:style={css`
            margin-top: ${SPACE[16]};
          `}
        >
          {platformButton(button, invertedButtonStyles(look))}
        </ws.element>
      </ws.element>
    ),
  });

export const ctaBandSplit = ({
  look,
  heading,
  intro,
  button,
}: {
  look: Look;
  heading: string;
  intro: string;
  button: Button;
}) =>
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
          ${BREAKPOINT.landscape} {
            grid-template-columns: minmax(0, 1fr);
            row-gap: ${SPACE[24]};
          }
        `}
      >
        <ws.element ws:tag="div" ws:style={stack(SPACE[12])}>
          {text("h2", h2Styles(look), heading)}
          {text("p", paragraphStyles(CONTAINER.narrow), intro)}
        </ws.element>
        <ws.element ws:tag="div">
          {platformButton(button, invertedButtonStyles(look))}
        </ws.element>
      </ws.element>
    ),
  });

type Value = [string, string, string];

const ruledValue = (look: Look, [number, name, line]: Value) => (
  <ws.element
    ws:tag="div"
    ws:label="Value"
    ws:style={[...rule(), ...stack(SPACE[8])]}
  >
    {text("p", numeralStyles(look, "28px"), number, "Number")}
    {text("h3", h3Styles(look), name)}
    {text("p", paragraphStyles(), line)}
  </ws.element>
);

const valueTemplate: Value = ["00", "[A value]", "[What it means.]"];

export const valuesThreeColumns = ({
  look,
  heading,
  intro,
  values,
}: {
  look: Look;
  heading: string;
  intro?: string;
  values: Value[];
}) =>
  section({
    label: "Mission and values: Three columns",
    children: keyed([
      sectionHeader({ look, heading, intro }),
      <ws.element ws:tag="div" ws:label="Values" ws:style={grid(3, 1)}>
        {contentBlock({
          label: "Values",
          template: ruledValue(look, valueTemplate),
          items: values.map((value) => ruledValue(look, value)),
        })}
      </ws.element>,
    ]),
  });

const listedValue = (look: Look, [number, name, line]: Value) => (
  <ws.element
    ws:tag="div"
    ws:label="Value"
    ws:style={css`
      display: grid;
      grid-template-columns: 7rem minmax(0, 5fr) minmax(0, 7fr);
      align-items: baseline;
      column-gap: ${SPACE[32]};
      row-gap: ${SPACE[12]};
      padding-top: ${SPACE[32]};
      padding-bottom: ${SPACE[32]};
      border-top-width: 1px;
      border-top-style: solid;
      border-top-color: var(--text);
      ${BREAKPOINT.tablet} {
        grid-template-columns: 5rem minmax(0, 1fr);
      }
      ${BREAKPOINT.landscape} {
        grid-template-columns: minmax(0, 1fr);
        padding-top: ${SPACE[24]};
        padding-bottom: ${SPACE[24]};
      }
    `}
  >
    {text(
      "p",
      numeralStyles(look, "clamp(36px, 2vw + 24px, 52px)"),
      number,
      "Number"
    )}
    {text("h3", h3Styles(look), name)}
    {text(
      "p",
      [
        ...paragraphStyles(),
        ...css`
          ${BREAKPOINT.tablet} {
            grid-column-start: 2;
          }
          ${BREAKPOINT.landscape} {
            grid-column-start: 1;
          }
        `,
      ],
      line
    )}
  </ws.element>
);

export const valuesList = ({
  look,
  heading,
  intro,
  values,
}: {
  look: Look;
  heading: string;
  intro?: string;
  values: Value[];
}) =>
  section({
    label: "Mission and values: List",
    children: keyed([
      sectionHeader({ look, heading, intro }),
      <ws.element ws:tag="div" ws:label="Values">
        {contentBlock({
          label: "Values",
          template: listedValue(look, valueTemplate),
          items: values.map((value) => listedValue(look, value)),
        })}
      </ws.element>,
    ]),
  });

export const aboutTextOnly = ({
  look,
  heading,
  paragraphs,
}: {
  look: Look;
  heading: string;
  paragraphs: string[];
}) =>
  section({
    label: "About: Text only",
    width: "text",
    children: (
      <ws.element ws:tag="div" ws:style={stack(SPACE[16])}>
        {keyed([
          text("h2", h2Styles(look), heading),
          ...paragraphs.map((paragraph) =>
            text("p", paragraphStyles(), paragraph)
          ),
        ])}
      </ws.element>
    ),
  });

export const aboutImageLeft = ({
  look,
  image,
  heading,
  paragraphs,
}: {
  look: Look;
  image: Image;
  heading: string;
  paragraphs: string[];
}) =>
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
        {photo(image, "4 / 5", "3 / 2")}
        <ws.element ws:tag="div" ws:style={stack(SPACE[16])}>
          {keyed([
            text("h2", h2Styles(look), heading),
            ...paragraphs.map((paragraph) =>
              text("p", paragraphStyles(), paragraph)
            ),
          ])}
        </ws.element>
      </ws.element>
    ),
  });

type Opportunity = [string, string, string];

const opportunity = (look: Look, [when, role, line]: Opportunity) => (
  <ws.element
    ws:tag="article"
    ws:label="Opportunity"
    ws:style={[
      ...stack(SPACE[12]),
      ...css`
        padding-top: ${SPACE[24]};
        border-top-width: 4px;
        border-top-style: solid;
        border-top-color: var(--accent-2);
      `,
    ]}
  >
    {text("p", eyebrowStyles(look), when, "Label")}
    {text("h3", h3Styles(look), role)}
    {text("p", paragraphStyles(), line)}
    <ws.element
      ws:tag="div"
      ws:style={css`
        margin-top: auto;
      `}
    >
      {anchorLink("Sign up to help", "#sign-up")}
    </ws.element>
  </ws.element>
);

export const opportunitiesCards = ({
  look,
  heading,
  intro,
  opportunities,
}: {
  look: Look;
  heading: string;
  intro?: string;
  opportunities: Opportunity[];
}) =>
  section({
    label: "Volunteer opportunities: Cards",
    children: keyed([
      sectionHeader({ look, heading, intro }),
      <ws.element
        ws:tag="div"
        ws:label="Cards"
        ws:style={[
          ...grid(3, 2),
          ...css`
            align-items: stretch;
          `,
        ]}
      >
        {contentBlock({
          label: "Opportunities",
          template: opportunity(look, [
            "[How often]",
            "[A role]",
            "[What it involves.]",
          ]),
          items: opportunities.map((item) => opportunity(look, item)),
        })}
      </ws.element>,
    ]),
  });

type Person = [string, string, string];

const person = (look: Look, [name, role, line]: Person) => (
  <ws.element
    ws:tag="div"
    ws:label="Person"
    ws:style={[...rule(), ...stack(SPACE[8])]}
  >
    {text("h3", h3Styles(look), name)}
    {text("p", eyebrowStyles(look), role, "Label")}
    {text(
      "p",
      css`
        margin: 0;
        font-size: 16px;
        line-height: 1.5;
      `,
      line
    )}
  </ws.element>
);

export const teamCompact = ({
  look,
  heading,
  people,
}: {
  look: Look;
  heading: string;
  people: Person[];
}) =>
  section({
    label: "Team or leadership: Compact",
    children: keyed([
      sectionHeader({ look, heading }),
      <ws.element ws:tag="div" ws:label="People" ws:style={grid(4, 2)}>
        {contentBlock({
          label: "People",
          template: person(look, ["[Name]", "[Role]", "[A line about them.]"]),
          items: people.map((item) => person(look, item)),
        })}
      </ws.element>,
    ]),
  });

type Method = [string, string];

const method = (look: Look, [kind, value]: Method) => (
  <ws.element
    ws:tag="div"
    ws:label="Method"
    ws:style={[...rule(), ...stack(SPACE[4])]}
  >
    {text("p", eyebrowStyles(look), kind, "Label")}
    {text(
      "p",
      [
        ...css`
          margin: 0;
          font-size: 20px;
          line-height: 1.3;
          overflow-wrap: anywhere;
        `,
        ...fontWeight(look.buttonWeight),
      ],
      value
    )}
  </ws.element>
);

export const contactSplit = ({
  look,
  heading,
  methods,
  visit,
}: {
  look: Look;
  heading: string;
  methods: Method[];
  visit: { heading: string; lines: string[] };
}) =>
  section({
    label: "Contact: Split",
    children: (
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
          align-items: start;
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
        <ws.element ws:tag="div" ws:style={stack(SPACE[32])}>
          {text("h2", h2Styles(look), heading)}
          <ws.element
            ws:tag="div"
            ws:label="Methods"
            ws:style={css`
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              column-gap: ${SPACE[32]};
              row-gap: ${SPACE[24]};
              ${BREAKPOINT.landscape} {
                grid-template-columns: minmax(0, 1fr);
              }
            `}
          >
            {contentBlock({
              label: "Contact methods",
              template: method(look, ["[Kind]", "[Address or number]"]),
              items: methods.map((item) => method(look, item)),
            })}
          </ws.element>
        </ws.element>
        <ws.element
          ws:tag="div"
          ws:label="Visit"
          ws:style={[
            ...stack(SPACE[12]),
            ...css`
              padding-top: ${SPACE[32]};
              padding-right: ${SPACE[24]};
              padding-bottom: ${SPACE[32]};
              padding-left: ${SPACE[24]};
              border-width: 1px;
              border-style: solid;
              border-top-color: var(--text);
              border-right-color: var(--text);
              border-bottom-color: var(--text);
              border-left-color: var(--text);
            `,
          ]}
        >
          {keyed([
            text("h3", h3Styles(look), visit.heading),
            ...visit.lines.map((line) => text("p", paragraphStyles(), line)),
          ])}
        </ws.element>
      </ws.element>
    ),
  });

type Question = [string, string];

const question = (look: Look, [asked, answer]: Question) => (
  <ws.element
    ws:tag="div"
    ws:label="Question"
    ws:style={[...rule(), ...stack(SPACE[8])]}
  >
    {text("h3", h3Styles(look), asked)}
    {text("p", paragraphStyles(), answer)}
  </ws.element>
);

export const faqTwoColumns = ({
  look,
  heading,
  questions,
}: {
  look: Look;
  heading: string;
  questions: Question[];
}) =>
  section({
    label: "FAQ: Two columns",
    children: keyed([
      sectionHeader({ look, eyebrow: "Questions", heading }),
      <ws.element ws:tag="div" ws:label="Questions" ws:style={grid(2, 2)}>
        {contentBlock({
          label: "Questions",
          template: question(look, [
            "[A question people ask]",
            "[Its answer.]",
          ]),
          items: questions.map((item) => question(look, item)),
        })}
      </ws.element>,
    ]),
  });
