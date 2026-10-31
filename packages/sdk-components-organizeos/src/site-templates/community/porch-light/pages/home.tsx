import { css, ws } from "@webstudio-is/template";
import { BREAKPOINT, SPACE, sample, section } from "../../../kit";
import type { PageContext, SiteTemplatePage } from "../../../types";
import {
  JOIN,
  buttons,
  keyed,
  photo,
  siteFooter,
  siteNav,
  text,
} from "../parts";
import {
  aboutSection,
  contactSection,
  eventsSection,
  opportunitiesSection,
  signUpSection,
} from "../sections";
import { OPPORTUNITIES } from "../sample-content";
import {
  bodyStyles,
  displayStyles,
  leadStyles,
  stackStyles,
  tagStyles,
} from "../styles";

// Home (directions 2.2): Nav; Hero: Centered; About: Image right; Events:
// Card grid; Volunteer opportunities: Cards; Sign-up: Centered on the berry
// band; Contact: Split; Footer: Simple.

/**
 * One of the hero's snapshots, set askew: `tilt` on a wide window and
 * `phoneTilt` below 768px. The `large` one comes first and spans both
 * columns on a phone, where the photos are one large over two small, cropped
 * at `phonePosition` when given.
 */
const snapshot = (
  context: PageContext,
  file: string,
  {
    ratio,
    tilt,
    phoneTilt,
    large = false,
    position,
    phonePosition,
  }: {
    ratio: string;
    tilt: string;
    phoneTilt: string;
    large?: boolean;
    position?: string;
    phonePosition?: string;
  }
) =>
  photo(context, file, {
    ratio,
    phoneRatio: large ? "4 / 3" : "1 / 1",
    position,
    outlined: true,
    styles: [
      ...css`
        transform: rotate(${tilt});
        ${BREAKPOINT.landscape} {
          transform: rotate(${phoneTilt});
        }
      `,
      ...(phonePosition === undefined
        ? []
        : css`
            ${BREAKPOINT.landscape} {
              object-position: ${phonePosition};
            }
          `),
      ...(large
        ? css`
            ${BREAKPOINT.landscape} {
              grid-column-start: 1;
              grid-column-end: -1;
              order: -1;
            }
          `
        : []),
    ],
  });

/**
 * Hero: Centered. A very large headline over two or three lines, one
 * sentence and two pill buttons, centred; then three rounded snapshots set
 * slightly askew. Below 768px the buttons are full width and the snapshots
 * are one large over two small.
 */
const hero = (context: PageContext) =>
  section({
    label: "Hero: Centered",
    children: keyed([
      <ws.element
        ws:tag="div"
        ws:style={[
          ...stackStyles(SPACE[24], "center"),
          ...css`
            text-align: center;
          `,
        ]}
      >
        {text("p", tagStyles(), "[Your neighborhood]", "Tag")}
        <ws.element
          ws:tag="h1"
          ws:style={[
            ...displayStyles(),
            ...css`
              max-width: 11em;
            `,
          ]}
        >
          {sample("Say what brings your neighbors together")}
        </ws.element>
        {text(
          "p",
          leadStyles({ centred: true }),
          "Add one sentence on who you are, where you meet, and how a neighbor can join in."
        )}
        <ws.element
          ws:tag="div"
          ws:style={css`
            margin-top: ${SPACE[8]};
            ${BREAKPOINT.landscape} {
              align-self: stretch;
            }
          `}
        >
          {buttons({
            pageIds: context.pageIds,
            primary: JOIN,
            secondary: { label: "See what's on", pageKey: "events" },
            justify: "center",
          })}
        </ws.element>
      </ws.element>,
      <ws.element
        ws:tag="div"
        ws:label="Snapshots"
        ws:style={css`
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          align-items: center;
          column-gap: ${SPACE[32]};
          margin-top: ${SPACE[64]};
          padding-left: ${SPACE[16]};
          padding-right: ${SPACE[16]};
          ${BREAKPOINT.tablet} {
            column-gap: ${SPACE[24]};
            padding-left: ${SPACE[8]};
            padding-right: ${SPACE[8]};
          }
          ${BREAKPOINT.landscape} {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: ${SPACE[16]};
            row-gap: ${SPACE[16]};
            margin-top: ${SPACE[48]};
          }
        `}
      >
        {keyed([
          snapshot(context, "snapshot-garden.jpg", {
            ratio: "1 / 1",
            tilt: "-3deg",
            phoneTilt: "-2deg",
            position: "40% 50%",
          }),
          snapshot(context, "snapshot-block-party.jpg", {
            ratio: "4 / 5",
            tilt: "2deg",
            phoneTilt: "-1deg",
            large: true,
            position: "50% 25%",
            phonePosition: "50% 10%",
          }),
          snapshot(context, "snapshot-meeting.jpg", {
            ratio: "1 / 1",
            tilt: "-1.5deg",
            phoneTilt: "2deg",
          }),
        ])}
      </ws.element>,
    ]),
  });

export const home: SiteTemplatePage = {
  key: "home",
  name: "Home",
  path: "",
  title: "[Organization name]",
  description:
    "Neighbors in [your neighborhood] working together: when we meet, what is coming up and how to help.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {hero(context)}
      {aboutSection({
        context,
        imageSide: "right",
        file: "about.jpg",
        tag: "About us",
        heading: "Say how your group got started",
        paragraphs: [
          "Tell the story in a few sentences: who started the group, on which street, and what first brought people together.",
          "Then say what you do now, and who it is for.",
        ],
        pullLine: "Put the one line a new neighbor should remember here.",
        link: { label: "More about us", pageKey: "about" },
      })}
      {eventsSection({
        placeBlock: context.placeBlock,
        pageIds: context.pageIds,
        tag: "Events",
        heading: "Come and meet your neighbors",
        intro:
          "Say what kinds of events you hold, such as [a monthly potluck].",
        link: { label: "All events", pageKey: "events" },
      })}
      {opportunitiesSection({
        pageIds: context.pageIds,
        heading: "Ways to pitch in",
        intro:
          "List the jobs that need doing, and how much time each one takes.",
        link: { label: "All the ways to help", pageKey: "get-involved" },
        items: OPPORTUNITIES,
      })}
      {signUpSection({
        placeBlock: context.placeBlock,
        tag: "Stay in the loop",
        heading: "Stay in touch with [your street]",
        body: "Leave your email and we will send meeting dates, events and ways to help.",
        note: "One email a [month]. Unsubscribe at any time.",
      })}
      {contactSection({
        heading: "Come to the next meeting",
        methods: [
          ["Email", "[hello@example.org]"],
          ["Phone or text", "[(000) 000-0000]"],
          ["Social", "[@yourgroup]"],
        ],
      })}
      {siteFooter(context.pageIds)}
    </ws.element>
  ),
};
