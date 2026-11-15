import { ws } from "@webstudio-is/template";
import { pictureEntry } from "./picture";
import { eventsCardGrid, pageHeader, signUpSideBySide } from "./sections";
import type { StarterPage } from "./types";
import pictureUrl from "./images/events.jpg?url&no-inline";

// The Events page (spec 6.2): the org's upcoming events, and a sign-up for
// news of the next ones.
export const eventsStarterPage: StarterPage = {
  id: "events",
  name: "Events",
  pageName: "Events",
  path: "/events",
  title: "Events",
  description: "See what's coming up, and come along.",
  status: "draft",
  picture: "events.jpg",
  images: { "events.jpg": pictureEntry("Events", pictureUrl) },
  blocks: [
    "@organizeos/site-components:EventList",
    "@organizeos/site-components:SignupForm",
  ],
  body: ({ look, placeBlock }) => (
    <ws.element ws:tag="body">
      {pageHeader({
        look,
        eyebrow: "Events",
        title: "Come and meet us",
        intro:
          "Say in one sentence what happens at your events and who they are for.",
      })}
      {eventsCardGrid({
        look,
        placeBlock,
        heading: "Coming up",
        intro: "Pick one that suits you. Everyone is welcome.",
      })}
      {signUpSideBySide({
        look,
        placeBlock,
        heading: "Never miss an event",
        intro: "Hear about new events as soon as they're announced.",
        formHeading: "Get event updates",
      })}
    </ws.element>
  ),
};
