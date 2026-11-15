import { ws } from "@webstudio-is/template";
import { pictureEntry } from "./picture";
import { contactSplit, faqTwoColumns, pageHeader } from "./sections";
import type { StarterPage } from "./types";
import pictureUrl from "./images/contact.jpg?url&no-inline";

// The Contact page (spec 6.2). It places no form until the site-forms
// switch is on for every org (plan ruling 1); then it places Contact us.
export const contactStarterPage: StarterPage = {
  id: "contact",
  name: "Contact",
  pageName: "Contact",
  path: "/contact",
  title: "Contact",
  description: "How to reach us, and where to find us.",
  status: "draft",
  picture: "contact.jpg",
  images: { "contact.jpg": pictureEntry("Contact", pictureUrl) },
  blocks: [],
  body: ({ look }) => (
    <ws.element ws:tag="body">
      {pageHeader({
        look,
        eyebrow: "Contact",
        title: "Get in touch",
        intro: "Say how quickly you reply, and the best way to reach you.",
      })}
      {contactSplit({
        look,
        heading: "Reach us",
        methods: [
          ["Email", "[name@example.org]"],
          ["Phone", "[(555) 555-0100]"],
        ],
        visit: {
          heading: "Visit us",
          lines: [
            "[Street address]",
            "[City, region and postal code]",
            "[Opening hours]",
          ],
        },
      })}
      {faqTwoColumns({
        look,
        heading: "Before you write",
        questions: [
          ["How soon will I hear back?", "[Say how long a reply takes.]"],
          [
            "Who do I contact for the press?",
            "[Name a person and how to reach them.]",
          ],
          ["Can I visit without an appointment?", "[Say whether, and when.]"],
          [
            "Where else can I find you?",
            "[List the other places people can reach you.]",
          ],
        ],
      })}
    </ws.element>
  ),
};
