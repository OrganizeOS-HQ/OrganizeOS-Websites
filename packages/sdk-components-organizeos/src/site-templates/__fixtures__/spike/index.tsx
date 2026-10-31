import { $, css, ws } from "@webstudio-is/template";
import { BLANK_CANONICAL_VALUES } from "../../canonical-variables";
import type { SiteTemplate, SiteTemplatePage } from "../../types";
import heroUrl from "./images/hero.jpg?url&no-inline";

// A fixture that exists to prove the apply path end to end in a test org: one
// page with a background image, two Events blocks (one to a section) and a
// Sign-up form. It is not in the catalog (catalog.ts), so the chooser never
// offers it; the apply tests and the preview tool import it from here.

// A section of the page holding one Events block under a heading.
const eventsSection = ({
  label,
  heading,
  block,
}: {
  label: string;
  heading: string;
  block: JSX.Element;
}) => (
  <ws.element
    ws:tag="section"
    ws:label={label}
    ws:style={css`
      display: flex;
      flex-direction: column;
      gap: 32px;
      max-width: 1100px;
      margin: 0 auto;
      padding: 64px 24px;
    `}
  >
    <ws.element
      ws:tag="h2"
      ws:style={css`
        margin: 0;
        font-family: var(--font-heading);
        font-size: 32px;
      `}
    >
      {heading}
    </ws.element>
    {block}
  </ws.element>
);

const home: SiteTemplatePage = {
  key: "home",
  name: "Home",
  path: "",
  title: "Home",
  description: "Say in one sentence what your organization is working toward.",
  body: ({ placeBlock, backgroundImage }) => (
    <ws.element
      ws:tag="body"
      ws:style={css`
        background-color: var(--base);
        color: var(--text);
        font-family: var(--font-body);
        line-height: 1.5;
      `}
    >
      <ws.element
        ws:tag="section"
        ws:label="Hero"
        ws:style={[
          ...css`
            display: flex;
            align-items: center;
            min-height: 560px;
            padding: 64px 48px;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
          `,
          ...backgroundImage("hero.jpg"),
        ]}
      >
        <ws.element
          ws:tag="div"
          ws:label="Hero panel"
          ws:style={css`
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 20px;
            max-width: 640px;
            padding: 40px;
            border-radius: 8px;
            background-color: var(--base);
            color: var(--text);
          `}
        >
          <ws.element
            ws:tag="h1"
            ws:style={css`
              margin: 0;
              font-family: var(--font-heading);
              font-size: 44px;
              line-height: 1.1;
            `}
          >
            {"Say in one sentence what your organization is working toward"}
          </ws.element>
          <ws.element
            ws:tag="p"
            ws:style={css`
              margin: 0;
              font-size: 18px;
            `}
          >
            {
              "Add two sentences about who you work with and how people can take part."
            }
          </ws.element>
          <$.Link
            href="#sign-up"
            ws:style={css`
              display: inline-block;
              padding: 12px 24px;
              border-radius: 6px;
              background-color: var(--accent-1);
              color: var(--base);
              font-weight: 600;
              text-decoration: none;
            `}
          >
            {"Get involved"}
          </$.Link>
        </ws.element>
      </ws.element>
      {eventsSection({
        label: "Events: Featured",
        heading: "Next event",
        block: placeBlock("@organizeos/site-components:EventCard", "featured"),
      })}
      {eventsSection({
        label: "Events",
        heading: "Upcoming events",
        block: placeBlock("@organizeos/site-components:EventList", "upcoming"),
      })}
      <ws.element
        ws:tag="section"
        ws:label="Sign-up"
        id="sign-up"
        ws:style={css`
          max-width: 560px;
          margin: 0 auto;
          padding: 64px 24px;
        `}
      >
        {placeBlock("@organizeos/site-components:SignupForm", "signup")}
      </ws.element>
    </ws.element>
  ),
};

export const spikeTemplate: SiteTemplate = {
  id: "spike",
  category: "community",
  name: "Spike",
  oneLine: "A one-page draft for testing how a template is applied.",
  styleTags: [],
  status: "draft",
  dependsOn: [],
  thumbnail: "hero.jpg",
  variables: BLANK_CANONICAL_VALUES,
  images: {
    "hero.jpg": {
      url: heroUrl,
      sourceUrl: "organizeos:generated/spike/images/generate.py",
      alt: "Replace with a photo of your members at work",
    },
  },
  pages: [home],
};
