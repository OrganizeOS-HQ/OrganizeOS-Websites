import { $, css, ws } from "@webstudio-is/template";
import { BREAKPOINT, SPACE, keyed, sample, section, text } from "../../../kit";
import type { PageContext, SiteTemplatePage } from "../../../types";
import { JOIN, button, siteFooter, siteNav } from "../parts";
import { ctaBand, eventsList, statsCards, valuesList } from "../sections";
import {
  bodyStyles,
  displayStyles,
  invertedButtonStyles,
  labelStyles,
  leadStyles,
} from "../styles";

// Home (directions 2.3): Nav with Join as its button; Hero: Full-bleed
// image; Mission and values: List; Stats: Cards; Events: List; Call to
// action band: Split, "Join"; Footer: Columns.

/**
 * Where the hero's text ends, from the section's left edge: the container's
 * gutter or margin, then 740px, wider than the headline's longest line at
 * 96px and the sentence. The overlay holds at least 78% denim up to it.
 */
const TEXT_EDGE = "calc(max(40px, 50% - 560px) + 740px)";

/** The overlay's denim at `alpha` percent, over the photo. */
const denim = (alpha: number) =>
  `color-mix(in srgb, var(--accent-1) ${alpha}%, transparent)`;

/**
 * Hero: Full-bleed image. The photo fills the section, in greys so any
 * photo takes the denim cleanly, under a denim overlay: at least 78% denim
 * over the text's column, and below 992px, where the text spans the hero,
 * 74% at the top rising to 94% at the foot. From 74% up, the base-coloured
 * text holds 4.5:1 over a white or a black pixel, in either palette; to the
 * right the photo shows through a light tint. With no photo the section's
 * own accent-1 shows, a plain denim field.
 * The label, an uppercase headline of up to three lines, one sentence and
 * one inverted Join button sit bottom-left. The hero is 4:5 on a portrait
 * phone and square on a landscape one, and grows when its text needs more.
 */
const hero = (context: PageContext) =>
  section({
    label: "Hero: Full-bleed image",
    background: "accent-1",
    styles: css`
      position: relative;
    `,
    children: keyed([
      <$.Image
        ws:label="Photo"
        src={context.image("hero.jpg")}
        alt={context.imageAlt("hero.jpg")}
        ws:style={css`
          position: absolute;
          top: 0;
          left: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: 60% 30%;
          filter: grayscale(1);
          ${BREAKPOINT.landscape} {
            object-position: 62% 30%;
          }
        `}
      />,
      <ws.element
        ws:tag="div"
        ws:label="Overlay"
        ws:style={css`
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          background-image:
            linear-gradient(
              to right,
              ${denim(84)} 0,
              ${denim(78)} ${TEXT_EDGE},
              ${denim(0)} calc(${TEXT_EDGE} + 300px)
            ),
            linear-gradient(to top, ${denim(62)} 0%, ${denim(30)} 100%);
          ${BREAKPOINT.tablet} {
            background-image: linear-gradient(
              to top,
              ${denim(94)} 0%,
              ${denim(82)} 75%,
              ${denim(74)} 100%
            );
          }
        `}
      />,
      <ws.element
        ws:tag="div"
        ws:label="Text"
        ws:style={css`
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: flex-start;
          row-gap: ${SPACE[24]};
          min-height: clamp(380px, 38vw + 40px, 600px);
          ${BREAKPOINT.landscape} {
            row-gap: ${SPACE[16]};
            min-height: calc(100vw - 112px);
          }
          ${BREAKPOINT.portrait} {
            min-height: calc(125vw - 112px);
          }
        `}
      >
        {text("p", labelStyles(), "[Local 000], [City]", "Label")}
        <ws.element
          ws:tag="h1"
          ws:style={[
            ...displayStyles(),
            ...css`
              max-width: 8.5em;
            `,
          ]}
        >
          {sample("Say what your members are organizing for")}
        </ws.element>
        {text(
          "p",
          leadStyles(),
          "Say who you represent, where you work, and how to join."
        )}
        <ws.element
          ws:tag="div"
          ws:style={css`
            margin-top: ${SPACE[8]};
          `}
        >
          {button(context.pageIds, JOIN, invertedButtonStyles())}
        </ws.element>
      </ws.element>,
    ]),
  });

export const home: SiteTemplatePage = {
  key: "home",
  name: "Home",
  path: "",
  title: "[Organization name]",
  description:
    "[Local 000] brings together the workers of [Employer] in [City]: what we stand for, when we meet and how to join.",
  body: (context) => (
    <ws.element ws:tag="body" ws:style={bodyStyles()}>
      {siteNav(context.pageIds)}
      {hero(context)}
      {valuesList({
        pageIds: context.pageIds,
        heading: "Say what the local is here to do",
        intro:
          "Then name the few things members hold to, in the words they use on the job.",
        link: { label: "About the local", pageKey: "about" },
        values: [
          [
            "01",
            "[First value]",
            "One sentence on what this value means at work, in plain words.",
          ],
          [
            "02",
            "[Second value]",
            "One sentence on what this value means at work, in plain words.",
          ],
          [
            "03",
            "[Third value]",
            "One sentence on what this value means at work, in plain words.",
          ],
        ],
      })}
      {statsCards({
        pageIds: context.pageIds,
        heading: "Show the size of the local",
        intro:
          "Replace each figure with your own, and keep the ones members ask about.",
        stats: [
          ["[000]", "Members"],
          ["[00]", "Stewards"],
          ["[00]", "Worksites"],
          ["[0000]", "Year chartered"],
        ],
      })}
      {eventsList({
        placeBlock: context.placeBlock,
        pageIds: context.pageIds,
        heading: "Meetings and events",
        intro: "Say when the local meets, and that every member is welcome.",
        link: { label: "All events", pageKey: "events" },
      })}
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
