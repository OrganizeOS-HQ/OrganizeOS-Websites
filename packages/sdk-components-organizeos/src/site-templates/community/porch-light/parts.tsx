import { cloneElement } from "react";
import { $, css, ws, type TemplateStyleDecl } from "@webstudio-is/template";
import {
  BREAKPOINT,
  CONTAINER,
  SPACE,
  type SiteLink,
  footer,
  linkProps,
  nav,
  sample,
} from "../../kit";
import type { PageContext } from "../../types";
import {
  LOOK,
  RADIUS,
  headingStyles,
  outlineStyles,
  paragraphStyles,
  primaryButtonStyles,
  quietLinkStyles,
  secondaryButtonStyles,
  stackStyles,
  tagStyles,
} from "./styles";

// Porch Light's shared pieces: the nav and footer every page carries, its
// links and buttons, photos and section headings. Each is a function
// returning fresh JSX.

export type PageIds = PageContext["pageIds"];

/** The one ask: the Get involved page, where the ways to help and the form are. */
export const JOIN: SiteLink = { label: "Join us", pageKey: "get-involved" };

// Three, so they take one row on a phone; Get involved is the button.
const NAV_LINKS: SiteLink[] = [
  { label: "About", pageKey: "about" },
  { label: "Events", pageKey: "events" },
  { label: "Contact", pageKey: "contact" },
];

export const siteNav = (pageIds: PageIds): JSX.Element =>
  nav({ pageIds, links: NAV_LINKS, cta: JOIN, ...LOOK });

/** Footer: Simple: the name, a line, and a row of every page. */
export const siteFooter = (pageIds: PageIds): JSX.Element =>
  footer({
    pageIds,
    tagline: sample(
      "Neighbors in [your neighborhood], working on it together."
    ),
    links: [
      { label: "About", pageKey: "about" },
      { label: "Events", pageKey: "events" },
      { label: "Get involved", pageKey: "get-involved" },
      { label: "Contact", pageKey: "contact" },
    ],
    headingWeight: LOOK.headingWeight,
  });

/**
 * A list of children, keyed for React's list check, for an element whose
 * children are built conditionally: the renderer takes one flat list, not a
 * nested one.
 */
export const keyed = (elements: JSX.Element[]): JSX.Element[] =>
  elements.map((element, index) => cloneElement(element, { key: index }));

/** Sample text in a tag, unstyled beyond the given styles. */
export const text = (
  tag: string,
  styles: TemplateStyleDecl[],
  value: string,
  label?: string
): JSX.Element => (
  <ws.element
    ws:tag={tag}
    {...(label === undefined ? {} : { "ws:label": label })}
    ws:style={styles}
  >
    {sample(value)}
  </ws.element>
);

export const quietLink = (pageIds: PageIds, link: SiteLink): JSX.Element => (
  <$.Link
    ws:label="Link"
    {...linkProps(pageIds, link)}
    ws:style={quietLinkStyles()}
  >
    {link.label}
  </$.Link>
);

/** A pill button: berry (`primary`) or outlined in the text colour. */
export const button = (
  pageIds: PageIds,
  link: SiteLink,
  styles: TemplateStyleDecl[] = primaryButtonStyles()
): JSX.Element => (
  <$.Link ws:label="Button" {...linkProps(pageIds, link)} ws:style={styles}>
    {link.label}
  </$.Link>
);

/**
 * Up to two pill buttons in a row, the first berry and the second outlined,
 * stacked full width on phones. `styles` replaces the pair's styles, as a
 * band's buttons do.
 */
export const buttons = ({
  pageIds,
  primary,
  secondary,
  justify = "flex-start",
  styles = [primaryButtonStyles(), secondaryButtonStyles()],
}: {
  pageIds: PageIds;
  primary: SiteLink;
  secondary?: SiteLink;
  justify?: "flex-start" | "center";
  styles?: [TemplateStyleDecl[], TemplateStyleDecl[]];
}): JSX.Element => (
  <ws.element
    ws:tag="div"
    ws:label="Buttons"
    ws:style={css`
      display: flex;
      flex-wrap: wrap;
      justify-content: ${justify};
      align-items: center;
      column-gap: ${SPACE[16]};
      row-gap: ${SPACE[12]};
      ${BREAKPOINT.landscape} {
        flex-direction: column;
        align-items: stretch;
        width: 100%;
      }
    `}
  >
    {keyed([
      button(pageIds, primary, styles[0]),
      ...(secondary === undefined
        ? []
        : [button(pageIds, secondary, styles[1])]),
    ])}
  </ws.element>
);

/**
 * A photo at a fixed ratio (`4 / 5`) with the template's 20px corners,
 * cropped to fill it, over an accent-1 field that shows when the photo is
 * gone. `phoneRatio` replaces the ratio below 768px; `outlined` draws the
 * 2px text-coloured outline. With no file it is the builder's placeholder,
 * the "put your image here" slot a Content Block's new item starts with.
 */
export const photo = (
  { image, imageAlt }: PageContext,
  file: string | undefined,
  {
    ratio,
    phoneRatio = ratio,
    position = "50% 50%",
    outlined = false,
    styles = [],
  }: {
    ratio: string;
    phoneRatio?: string;
    position?: string;
    outlined?: boolean;
    styles?: TemplateStyleDecl[];
  }
): JSX.Element => (
  <$.Image
    ws:label="Photo"
    {...(file === undefined
      ? { alt: "Replace with a photo" }
      : { src: image(file), alt: imageAlt(file) })}
    ws:style={[
      ...css`
        display: block;
        box-sizing: border-box;
        width: 100%;
        height: auto;
        aspect-ratio: ${ratio};
        object-fit: cover;
        object-position: ${position};
        background-color: var(--accent-1);
        ${BREAKPOINT.landscape} {
          aspect-ratio: ${phoneRatio};
        }
      `,
      ...(outlined
        ? outlineStyles()
        : css`
            border-radius: ${RADIUS};
          `),
      ...styles,
    ]}
  />
);

/**
 * A section's heading block: the tag, the h2 and a sentence, with an
 * optional quiet link to the page that has more, on the right, on the
 * baseline of the block's last line.
 */
export const sectionHeader = ({
  pageIds,
  tag,
  heading,
  intro,
  link,
}: {
  pageIds: PageIds;
  tag: string;
  heading: string;
  intro?: string;
  link?: SiteLink;
}): JSX.Element => (
  <ws.element
    ws:tag="div"
    ws:label="Heading"
    ws:style={css`
      display: flex;
      flex-wrap: wrap;
      align-items: last baseline;
      justify-content: space-between;
      column-gap: ${SPACE[48]};
      row-gap: ${SPACE[16]};
      margin-bottom: ${SPACE[48]};
      ${BREAKPOINT.landscape} {
        margin-bottom: ${SPACE[32]};
      }
    `}
  >
    {keyed([
      <ws.element
        ws:tag="div"
        ws:style={[
          ...stackStyles(SPACE[16]),
          ...css`
            max-width: ${CONTAINER.narrow};
          `,
        ]}
      >
        {keyed([
          text("p", tagStyles(), tag, "Tag"),
          text("h2", headingStyles(), heading),
          ...(intro === undefined ? [] : [text("p", paragraphStyles(), intro)]),
        ])}
      </ws.element>,
      ...(link === undefined ? [] : [quietLink(pageIds, link)]),
    ])}
  </ws.element>
);

/**
 * A placed Event List in a noticeboard: a 2px outlined panel with the
 * template's corners, which holds its cards, and its "No upcoming events"
 * line when there are none. The block's cards are at least 260px wide, so
 * below 480px the panel's sides narrow with the window, to 8px on a 320px
 * phone, which leaves them room.
 */
export const eventsBoard = (block: JSX.Element): JSX.Element => (
  <ws.element
    ws:tag="div"
    ws:label="Events board"
    ws:style={[
      ...outlineStyles(),
      ...css`
        padding: ${SPACE[32]};
        ${BREAKPOINT.landscape} {
          padding: ${SPACE[16]};
        }
        ${BREAKPOINT.portrait} {
          padding-left: clamp(8px, 10vw - 24px, 16px);
          padding-right: clamp(8px, 10vw - 24px, 16px);
        }
      `,
    ]}
  >
    {block}
  </ws.element>
);
