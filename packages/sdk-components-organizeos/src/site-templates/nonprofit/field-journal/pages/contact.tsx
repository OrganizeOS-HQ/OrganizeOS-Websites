import { css, ws } from "@webstudio-is/template";
import { BREAKPOINT, SPACE, contentBlock, section, text } from "../../../kit";
import type { SiteTemplatePage } from "../../../types";
import { siteFooter, siteNav } from "../parts";
import { faqSection, pageHeader } from "../sections";
import {
  bodyStyles,
  eyebrowStyles,
  headingStyles,
  paragraphStyles,
  ruleStyles,
  stackStyles,
  subheadingStyles,
} from "../styles";

// Contact (spec section 4's page): Page header, Contact: Split, FAQ. The
// methods are plain text, typed in by the organization; a contact form
// waits for a contact form type (spec section 8, open decision 2).

type Method = [string, string];

/** One way to reach the organization: what it is, then the address. */
const method = ([kind, value]: Method) => (
  <ws.element
    ws:tag="div"
    ws:label="Contact method"
    ws:style={[...ruleStyles(), ...stackStyles(SPACE[4])]}
  >
    {text("p", eyebrowStyles(), kind, "Eyebrow")}
    {text(
      "p",
      css`
        margin: 0;
        font-family: var(--font-heading);
        font-weight: 600;
        font-size: 24px;
        line-height: 1.3;
        overflow-wrap: anywhere;
      `,
      value,
      "Value"
    )}
  </ws.element>
);

/**
 * Contact: Split. The ways to reach the organization on the left; where to
 * find it, in a 1px accent-1 box, on the right.
 */
const contactSplit = () =>
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
        <ws.element ws:tag="div" ws:style={stackStyles(SPACE[32])}>
          <ws.element ws:tag="div" ws:style={stackStyles(SPACE[12])}>
            {text("p", eyebrowStyles(), "Reach us", "Eyebrow")}
            {text("h2", headingStyles(), "The quickest ways to reach us")}
          </ws.element>
          <ws.element
            ws:tag="div"
            ws:label="Methods"
            ws:style={css`
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              column-gap: ${SPACE[32]};
              row-gap: ${SPACE[32]};
              width: 100%;
              ${BREAKPOINT.landscape} {
                grid-template-columns: minmax(0, 1fr);
                row-gap: ${SPACE[24]};
              }
            `}
          >
            {contentBlock({
              label: "Contact methods",
              template: method(["[Kind]", "[Address or number]"]),
              items: (
                [
                  ["Email", "[hello@example.org]"],
                  ["Phone", "[(000) 000-0000]"],
                  ["Press", "[press@example.org]"],
                  ["Volunteering", "[volunteer@example.org]"],
                ] as Method[]
              ).map(method),
            })}
          </ws.element>
        </ws.element>
        <ws.element
          ws:tag="div"
          ws:label="Visit"
          ws:style={[
            ...stackStyles(SPACE[12]),
            ...css`
              padding: ${SPACE[32]};
              border-width: 1px;
              border-style: solid;
              border-top-color: var(--accent-1);
              border-right-color: var(--accent-1);
              border-bottom-color: var(--accent-1);
              border-left-color: var(--accent-1);
              ${BREAKPOINT.landscape} {
                padding: ${SPACE[24]};
              }
            `,
          ]}
        >
          {text("h3", subheadingStyles(), "Visit us")}
          {text(
            "p",
            paragraphStyles(),
            "[Street address], [City], [Postal code]"
          )}
          {text(
            "p",
            paragraphStyles(),
            "Open [Monday to Friday], [9am to 5pm]. Say whether people should call ahead, and how to find the entrance."
          )}
        </ws.element>
      </ws.element>
    ),
  });

export const contact: SiteTemplatePage = {
  key: "contact",
  name: "Contact",
  path: "/contact",
  title: "Contact | [Organization name]",
  description:
    "How to reach [Organization name] by email or phone, and where to find us.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        eyebrow: "Contact",
        title: "Get in touch",
        intro:
          "Add a sentence on who answers and how soon, such as [within two days].",
      })}
      {contactSplit()}
      {faqSection({
        pageIds: context.pageIds,
        heading: "Answers to common questions",
        questions: [
          [
            "How can I get help from a program?",
            "Say how someone asks for help: who to call, what to bring, and whether there is a waiting list.",
          ],
          [
            "Can I donate goods instead of money?",
            "Say which goods you accept, where to drop them off, and what you cannot take.",
          ],
          [
            "Do you speak at schools and events?",
            "Say whether you give talks, and how much notice you need to arrange one.",
          ],
          [
            "How do I get a receipt for my gift?",
            "Say how and when donors receive a receipt, and who to ask if one goes missing.",
          ],
        ],
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
