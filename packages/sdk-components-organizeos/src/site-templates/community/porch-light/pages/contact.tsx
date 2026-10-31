import { ws } from "@webstudio-is/template";
import type { SiteTemplatePage } from "../../../types";
import { siteFooter, siteNav } from "../parts";
import { contactSection, faqSection, pageHeader } from "../sections";
import { bodyStyles } from "../styles";

// Contact (spec section 4's page): Page header, Contact: Split leading with
// where and when the group meets, FAQ. The ways to reach it are plain text,
// typed in by the group; a contact form waits for a contact form type.

export const contact: SiteTemplatePage = {
  key: "contact",
  name: "Contact",
  path: "/contact",
  title: "Contact | [Organization name]",
  description:
    "Where and when [Organization name] meets, and how to reach us by email or phone.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {pageHeader({
        tag: "Contact",
        title: "Come and find us",
        intro:
          "Add a sentence on who answers and how soon, such as [within a day or two].",
      })}
      {contactSection({
        heading: "The easiest way is to come along",
        methods: [
          ["Email", "[hello@example.org]"],
          ["Phone or text", "[(000) 000-0000]"],
          ["Social", "[@yourgroup]"],
          ["Post", "[PO Box 000], [City]"],
        ],
      })}
      {faqSection({
        pageIds: context.pageIds,
        heading: "Answers to common questions",
        questions: [
          [
            "Is the meeting place accessible?",
            "Say whether there are steps, where the nearest accessible entrance is, and who to ask for help.",
          ],
          [
            "Can I bring a problem on my street to a meeting?",
            "Say how to raise something, and whether to tell someone ahead of time.",
          ],
          [
            "Who do I talk to about [a repair]?",
            "Say who handles what, and how long people usually wait for an answer.",
          ],
          [
            "Do you work with the [city council]?",
            "Say how the group raises issues with others, and how neighbors can take part.",
          ],
        ],
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
