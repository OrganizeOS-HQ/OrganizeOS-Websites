import { cloneElement } from "react";
import { $, css, ws, type TemplateStyleDecl } from "@webstudio-is/template";
import {
  BREAKPOINT,
  CONTAINER,
  SPACE,
  type SiteLink,
  buttonStyles,
  footer,
  linkHref,
  nav,
} from "../../kit";
import type { PageContext } from "../../types";
import {
  LOOK,
  eyebrowStyles,
  headingStyles,
  paragraphStyles,
  quietLinkStyles,
  stackStyles,
} from "./styles";

// Field Journal's shared pieces: the nav and footer every page carries, its
// links and buttons, photos and section headings. Each is a function
// returning fresh JSX.

export type PageIds = PageContext["pageIds"];

/** The platform's donation page on the site's own host. */
export const DONATE: SiteLink = { label: "Donate", href: "/donate" };

const NAV_LINKS: SiteLink[] = [
  { label: "About", pageKey: "about" },
  { label: "Programs", pageKey: "programs" },
  { label: "Get involved", pageKey: "get-involved" },
  { label: "Events", pageKey: "events" },
  { label: "Contact", pageKey: "contact" },
];

export const siteNav = (pageIds: PageIds): JSX.Element =>
  nav({ pageIds, links: NAV_LINKS, cta: DONATE, ...LOOK });

export const siteFooter = (pageIds: PageIds): JSX.Element =>
  footer({
    pageIds,
    tagline: "Say in one line what [Organization name] works toward.",
    columns: [
      {
        heading: "Organization",
        links: [
          { label: "About", pageKey: "about" },
          { label: "Programs", pageKey: "programs" },
          { label: "Contact", pageKey: "contact" },
        ],
      },
      {
        heading: "Take part",
        links: [
          { label: "Get involved", pageKey: "get-involved" },
          { label: "Events", pageKey: "events" },
          DONATE,
        ],
      },
    ],
    note: (
      <ws.element
        ws:tag="p"
        ws:style={css`
          margin: 0;
        `}
      >
        {
          "[Organization name] is a registered nonprofit, [registration number]."
        }
      </ws.element>
    ),
    headingWeight: LOOK.headingWeight,
  });

export const quietLink = (pageIds: PageIds, link: SiteLink): JSX.Element => (
  <$.Link
    ws:label="Link"
    href={linkHref(pageIds, link)}
    ws:style={quietLinkStyles()}
  >
    {link.label}
  </$.Link>
);

export const button = (pageIds: PageIds, link: SiteLink): JSX.Element => (
  <$.Link
    ws:label="Button"
    href={linkHref(pageIds, link)}
    ws:style={buttonStyles(LOOK)}
  >
    {link.label}
  </$.Link>
);

/** A button and, beside it, a quiet link: the page's one ask and the next. */
export const actions = (
  pageIds: PageIds,
  primary: SiteLink,
  secondary?: SiteLink
): JSX.Element => (
  <ws.element
    ws:tag="div"
    ws:label="Buttons"
    ws:style={css`
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      column-gap: ${SPACE[24]};
      row-gap: ${SPACE[12]};
    `}
  >
    {keyed([
      button(pageIds, primary),
      ...(secondary === undefined ? [] : [quietLink(pageIds, secondary)]),
    ])}
  </ws.element>
);

/**
 * A list of children, keyed for React's list check, for an element whose
 * children are built conditionally: the renderer takes one flat list, not a
 * nested one.
 */
export const keyed = (elements: JSX.Element[]): JSX.Element[] =>
  elements.map((element, index) => cloneElement(element, { key: index }));

/** Plain text in a tag, unstyled beyond the given styles. */
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
    {value}
  </ws.element>
);

/**
 * A square-cornered photo at a fixed ratio (`4 / 5`), cropped to fill it,
 * over an accent-1 field that shows when the photo is gone. `phoneRatio`
 * replaces the ratio below 768px.
 */
export const photo = (
  { image, imageAlt }: PageContext,
  file: string,
  {
    ratio,
    phoneRatio = ratio,
    position = "50% 50%",
  }: { ratio: string; phoneRatio?: string; position?: string }
): JSX.Element => (
  <$.Image
    ws:label="Photo"
    src={image(file)}
    alt={imageAlt(file)}
    ws:style={css`
      display: block;
      width: 100%;
      height: auto;
      aspect-ratio: ${ratio};
      object-fit: cover;
      object-position: ${position};
      background-color: var(--accent-1);
      ${BREAKPOINT.landscape} {
        aspect-ratio: ${phoneRatio};
      }
    `}
  />
);

/**
 * A section's heading block: the eyebrow, the h2 and a sentence, with an
 * optional quiet link to the page that has more, on the right.
 */
export const sectionHeader = ({
  pageIds,
  eyebrow,
  heading,
  intro,
  link,
}: {
  pageIds: PageIds;
  eyebrow: string;
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
      align-items: flex-end;
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
          ...stackStyles(SPACE[12]),
          ...css`
            max-width: ${CONTAINER.narrow};
          `,
        ]}
      >
        {keyed([
          text("p", eyebrowStyles(), eyebrow, "Eyebrow"),
          text("h2", headingStyles(), heading),
          ...(intro === undefined ? [] : [text("p", paragraphStyles(), intro)]),
        ])}
      </ws.element>,
      ...(link === undefined ? [] : [quietLink(pageIds, link)]),
    ])}
  </ws.element>
);

/**
 * A placed Event Card or Event List under a rule, which frames its cards,
 * and its "No upcoming events" line when there are none.
 */
export const eventsFrame = (block: JSX.Element): JSX.Element => (
  <ws.element
    ws:tag="div"
    ws:label="Events frame"
    ws:style={css`
      padding-top: ${SPACE[32]};
      border-top-width: 1px;
      border-top-style: solid;
      border-top-color: var(--text);
      ${BREAKPOINT.landscape} {
        padding-top: ${SPACE[24]};
      }
    `}
  >
    {block}
  </ws.element>
);
