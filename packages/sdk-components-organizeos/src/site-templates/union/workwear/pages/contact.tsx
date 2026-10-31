import { css, ws } from "@webstudio-is/template";
import {
  BREAKPOINT,
  SPACE,
  contentBlock,
  keyed,
  section,
  text,
} from "../../../kit";
import type { SiteTemplatePage } from "../../../types";
import { JOIN, siteFooter, siteNav } from "../parts";
import { ctaBand, pageHeader } from "../sections";
import {
  RULE,
  bodyStyles,
  headingStyles,
  labelStyles,
  paragraphStyles,
  ruleAboveStyles,
  stackStyles,
  subheadingStyles,
} from "../styles";

// Contact: Page header; Contact: Split, the union hall and its hours beside
// the other ways to reach the local; Call to action band: Split, "Join".

/** [kind, the address or number] */
type Method = [string, string];

/** One way to reach the local, under a rule: what it is, then the address. */
const method = ([kind, value]: Method) => (
  <ws.element
    ws:tag="div"
    ws:label="Contact method"
    ws:style={[
      ...ruleAboveStyles(),
      ...stackStyles(SPACE[4]),
      ...css`
        padding-top: ${SPACE[16]};
        padding-bottom: ${SPACE[16]};
      `,
    ]}
  >
    {text("p", labelStyles(), kind, "Label")}
    {text(
      "p",
      css`
        margin: 0;
        font-size: 22px;
        font-weight: 500;
        line-height: 1.35;
        overflow-wrap: anywhere;
      `,
      value,
      "Value"
    )}
  </ws.element>
);

/**
 * Contact: Split. The heading across the top; the union hall, its address
 * and office hours on the left, large; the other ways to reach the local
 * in ruled rows on the right. One column on phones, the hall first.
 */
const contact = () =>
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
        {text("p", labelStyles(), "Find us", "Label")}
        {text("h2", headingStyles(), "The union hall")}
      </ws.element>,
      <ws.element
        ws:tag="div"
        ws:style={css`
          display: grid;
          grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
          align-items: start;
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
        <ws.element
          ws:tag="div"
          ws:label="Hall"
          ws:style={[
            ...ruleAboveStyles(),
            ...stackStyles(SPACE[24]),
            ...css`
              padding-top: ${SPACE[24]};
            `,
          ]}
        >
          <ws.element ws:tag="div" ws:style={stackStyles(SPACE[8])}>
            {text("p", labelStyles(), "Address", "Label")}
            {text("h3", subheadingStyles(), "[Hall name]")}
            {text("p", paragraphStyles(), "[Street address], [City]")}
          </ws.element>
          <ws.element ws:tag="div" ws:style={stackStyles(SPACE[8])}>
            {text("p", labelStyles(), "Office hours", "Label")}
            {text("h3", subheadingStyles(), "[Mon] to [Fri], [9am] to [5pm]")}
            {text(
              "p",
              paragraphStyles(),
              "Say when someone is in, how to find the door, and whether members can drop by without calling first."
            )}
          </ws.element>
        </ws.element>
        <ws.element
          ws:tag="div"
          ws:label="Methods"
          ws:style={css`
            border-bottom-width: ${RULE};
            border-bottom-style: solid;
            border-bottom-color: var(--text);
          `}
        >
          {contentBlock({
            label: "Contact methods",
            template: method(["[Kind]", "[Address or number]"]),
            items: (
              [
                ["Email", "[office@example.org]"],
                ["Phone", "[(000) 000-0000]"],
                ["Steward line", "[(000) 000-0000]"],
              ] as Method[]
            ).map(method),
          })}
        </ws.element>
      </ws.element>,
    ]),
  });

export const contactPage: SiteTemplatePage = {
  key: "contact",
  name: "Contact",
  path: "/contact",
  title: "Contact | [Organization name]",
  description:
    "Where to find the [Local 000] union hall, its office hours, and how to reach a steward.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        label: "Contact",
        title: "Get in touch with the local",
        intro:
          "Say how fast the office replies, and the best way to reach a steward in a hurry.",
      })}
      {contact()}
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
