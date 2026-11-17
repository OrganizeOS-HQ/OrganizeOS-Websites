import { ws } from "@webstudio-is/template";
import { pictureEntry } from "./picture";
import {
  aboutImageLeft,
  pageHeader,
  teamCompact,
  valuesThreeColumns,
} from "./sections";
import type { StarterPage } from "./types";
import pictureUrl from "./images/about.jpg?url&no-inline";

// The About page (spec 6.2): who the org is, what it values, who runs it.
export const aboutStarterPage: StarterPage = {
  id: "about",
  name: "About",
  pageName: "About",
  path: "/about",
  title: "About",
  description:
    "Who we are, what we care about, and the people behind our work.",
  status: "listed",
  picture: "about.jpg",
  images: { "about.jpg": pictureEntry("About", pictureUrl) },
  blocks: [],
  body: ({ look, image }) => (
    <ws.element ws:tag="body">
      {pageHeader({
        look,
        eyebrow: "About us",
        title: "Who we are",
        intro:
          "Say in one sentence who your organization is and who it serves.",
      })}
      {aboutImageLeft({
        look,
        image,
        heading: "Our story",
        paragraphs: [
          "Say how your organization started, and what it set out to change.",
          "Say what you've done since, and where you're headed next.",
        ],
      })}
      {valuesThreeColumns({
        look,
        heading: "What we believe",
        values: [
          ["01", "[A value]", "Say what this value means in practice."],
          ["02", "[A value]", "Say what this value means in practice."],
          ["03", "[A value]", "Say what this value means in practice."],
        ],
      })}
      {teamCompact({
        look,
        heading: "Our team",
        people: [
          ["[Name]", "[Role]", "[A line about them.]"],
          ["[Name]", "[Role]", "[A line about them.]"],
          ["[Name]", "[Role]", "[A line about them.]"],
          ["[Name]", "[Role]", "[A line about them.]"],
        ],
      })}
    </ws.element>
  ),
};
