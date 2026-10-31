import { css, ws } from "@webstudio-is/template";
import {
  BREAKPOINT,
  SPACE,
  contentBlock,
  keyed,
  section,
  text,
} from "../../../kit";
import type { PageContext, SiteTemplatePage } from "../../../types";
import { quietLink, sectionHeader, siteFooter, siteNav } from "../parts";
import { ctaBand, faqSection, pageHeader } from "../sections";
import {
  bodyStyles,
  labelStyles,
  paragraphStyles,
  ruleAboveStyles,
  ruleBelowStyles,
  stackStyles,
  subheadingStyles,
} from "../styles";

// Know your rights (spec 5.1, template 3): Page header; Resources: List, the
// documents and links members need, as bracketed placeholders (no legal
// text, no law or employer named); FAQ: Two columns; Call to action band:
// Split, to a steward.

/** [kind, title, a line] */
type Resource = [string, string, string];

/**
 * One resource as a ruled row: its kind, its title and a line, and a link
 * to open it on the right. The link is a placeholder (`#`) the org points
 * at its own file or page. Below 768px the row stacks.
 */
const resource = (
  pageIds: PageContext["pageIds"],
  [kind, title, line]: Resource
) => (
  <ws.element
    ws:tag="div"
    ws:label="Resource"
    ws:style={[
      ...ruleAboveStyles(),
      ...css`
        display: grid;
        grid-template-columns: 9rem minmax(0, 1fr) auto;
        align-items: baseline;
        column-gap: ${SPACE[32]};
        row-gap: ${SPACE[8]};
        padding-top: ${SPACE[24]};
        padding-bottom: ${SPACE[24]};
        ${BREAKPOINT.landscape} {
          grid-template-columns: minmax(0, 1fr);
          padding-top: ${SPACE[16]};
          padding-bottom: ${SPACE[16]};
        }
      `,
    ]}
  >
    {text("p", labelStyles(), kind, "Kind")}
    <ws.element ws:tag="div" ws:style={stackStyles(SPACE[8])}>
      {text("h3", subheadingStyles(), title)}
      {text("p", paragraphStyles(), line)}
    </ws.element>
    {quietLink(pageIds, { label: "Open", href: "#" })}
  </ws.element>
);

/** Resources: List. The documents and links, one ruled row each. */
const resources = (context: PageContext) =>
  section({
    label: "Resources: List",
    children: keyed([
      sectionHeader({
        pageIds: context.pageIds,
        label: "Resources",
        heading: "Documents and links",
        intro:
          "Link the papers members ask for most, and say in a line what each one is for.",
      }),
      <ws.element
        ws:tag="div"
        ws:label="Resources"
        ws:style={ruleBelowStyles()}
      >
        {contentBlock({
          label: "Resources",
          template: resource(context.pageIds, [
            "[Kind]",
            "[Title]",
            "[What it is for.]",
          ]),
          items: (
            [
              [
                "Document",
                "[Your contract]",
                "Say what it covers, and the dates it runs between.",
              ],
              [
                "Document",
                "[Bylaws]",
                "Say how the local is run, and how members vote.",
              ],
              [
                "Form",
                "[Report a problem]",
                "Say what to write down, and who it goes to.",
              ],
              [
                "Link",
                "[Steward list]",
                "Say who the steward is for each worksite and shift.",
              ],
            ] as Resource[]
          ).map((item) => resource(context.pageIds, item)),
        })}
      </ws.element>,
    ]),
  });

export const knowYourRights: SiteTemplatePage = {
  key: "know-your-rights",
  name: "Know your rights",
  path: "/know-your-rights",
  title: "Know your rights | [Organization name]",
  description:
    "The documents [Local 000] members need, and answers to the questions stewards hear most.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        label: "Know your rights",
        title: "Say what every member should know",
        intro:
          "Put the documents members need in one place, and answer the questions stewards hear most.",
      })}
      {resources(context)}
      {faqSection({
        pageIds: context.pageIds,
        heading: "What members ask",
        intro: "Answer in plain words, and say who to ask for more.",
        questions: [
          [
            "Who is my steward?",
            "Say how to find the steward for each worksite and shift.",
          ],
          [
            "Something went wrong at work. What do I do?",
            "Say who to tell first, what to write down, and how soon.",
          ],
          [
            "Does the contract cover me?",
            "Say which jobs it covers, and where to read it.",
          ],
          [
            "Is what I tell a steward kept private?",
            "Say how the local handles what members tell it.",
          ],
        ],
      })}
      {ctaBand({
        pageIds: context.pageIds,
        heading: "Not sure where you stand? Ask a steward",
        body: "Say how members reach a steward, and how soon they hear back.",
        link: { label: "Contact a steward", pageKey: "contact" },
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
