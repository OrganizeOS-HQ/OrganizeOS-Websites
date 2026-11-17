import { ws } from "@webstudio-is/template";
import { pictureEntry } from "./picture";
import {
  aboutTextOnly,
  faqTwoColumns,
  pageHeader,
  signUpCentered,
} from "./sections";
import type { StarterPage } from "./types";
import pictureUrl from "./images/event.jpg?url&no-inline";

// The Event page (spec 6.2): one event, with its RSVP. The org picks the
// event in the RSVP Form's Settings; the header is sample text until an
// events read by id lets it show the event's own details.
export const eventStarterPage: StarterPage = {
  id: "event",
  name: "Event",
  pageName: "Event",
  path: "/event",
  title: "Event",
  description: "Everything you need to know, and a place to say you're coming.",
  status: "listed",
  picture: "event.jpg",
  images: { "event.jpg": pictureEntry("Event", pictureUrl) },
  blocks: ["@organizeos/site-components:RsvpForm"],
  body: ({ look, placeBlock }) => (
    <ws.element ws:tag="body">
      {pageHeader({
        look,
        eyebrow: "[Date], [Time]",
        title: "[Event name]",
        intro:
          "[Place]. Say in one sentence what the event is and who it is for.",
      })}
      {aboutTextOnly({
        look,
        heading: "What to expect",
        paragraphs: [
          "Say what will happen, from the moment people arrive to the moment they leave.",
          "Say what to bring, how to get there, and whether children, pets or guests are welcome.",
        ],
      })}
      {signUpCentered({
        look,
        placeBlock,
        heading: "Will you be there?",
        intro: "Let us know you're coming, so we can plan for everyone.",
      })}
      {faqTwoColumns({
        look,
        heading: "Before you come",
        questions: [
          ["Is it free?", "Say whether there is a cost, and how to pay it."],
          [
            "Is the venue accessible?",
            "Describe step-free access, seating and restrooms.",
          ],
          ["Can I bring someone?", "Say whether guests are welcome."],
          [
            "Who do I ask if I have a question?",
            "Name a person and how to reach them.",
          ],
        ],
      })}
    </ws.element>
  ),
};
