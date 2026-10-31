import { $, css, ws, type TemplateStyleDecl } from "@webstudio-is/template";
import {
  BREAKPOINT,
  CONTAINER,
  SPACE,
  type SiteLink,
  footer,
  keyed,
  linkProps,
  nav,
  sample,
  text,
} from "../../kit";
import type { PageContext } from "../../types";
import {
  LOOK,
  headingStyles,
  labelStyles,
  paragraphStyles,
  quietLinkStyles,
  solidButtonStyles,
  stackStyles,
} from "./styles";

// Workwear's shared pieces: the nav and footer every page carries, its
// links and buttons, photos and section headings. Each is a function
// returning fresh JSX.

export type PageIds = PageContext["pageIds"];

/** The one ask: the Join page, where the form and what happens next are. */
export const JOIN: SiteLink = { label: "Join", pageKey: "join" };

const NAV_LINKS: SiteLink[] = [
  { label: "About", pageKey: "about" },
  { label: "Your rights", pageKey: "know-your-rights" },
  { label: "Events", pageKey: "events" },
  { label: "Contact", pageKey: "contact" },
];

export const siteNav = (pageIds: PageIds): JSX.Element =>
  nav({ pageIds, links: NAV_LINKS, cta: JOIN, ...LOOK });

/** Footer: Columns, with the local's charter line in the note. */
export const siteFooter = (pageIds: PageIds): JSX.Element =>
  footer({
    pageIds,
    tagline: sample("The workers of [Employer] in [City], together."),
    columns: [
      {
        heading: "The local",
        links: [
          { label: "About", pageKey: "about" },
          { label: "Know your rights", pageKey: "know-your-rights" },
          { label: "Contact", pageKey: "contact" },
        ],
      },
      {
        heading: "Take part",
        links: [
          { label: "Join", pageKey: "join" },
          { label: "Events", pageKey: "events" },
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
        {sample("[Local 000] is chartered by [parent union].")}
      </ws.element>
    ),
    headingWeight: LOOK.headingWeight,
    headingCase: LOOK.headingCase,
  });

export const quietLink = (pageIds: PageIds, link: SiteLink): JSX.Element => (
  <$.Link
    ws:label="Link"
    {...linkProps(pageIds, link)}
    ws:style={quietLinkStyles()}
  >
    {link.label}
  </$.Link>
);

/** A square button: denim on the base unless `styles` says otherwise. */
export const button = (
  pageIds: PageIds,
  link: SiteLink,
  styles: TemplateStyleDecl[] = solidButtonStyles()
): JSX.Element => (
  <$.Link ws:label="Button" {...linkProps(pageIds, link)} ws:style={styles}>
    {link.label}
  </$.Link>
);

/**
 * A square photo at a fixed ratio (`4 / 5`), cropped to fill it, in greys
 * as the hero's is (any photo takes the cool palette the same way), over an
 * accent-1 field that shows when the photo is gone. `phoneRatio` replaces
 * the ratio below 768px, and `phonePosition` the crop.
 */
export const photo = (
  { image, imageAlt }: PageContext,
  file: string,
  {
    ratio,
    phoneRatio = ratio,
    position = "50% 50%",
    phonePosition = position,
  }: {
    ratio: string;
    phoneRatio?: string;
    position?: string;
    phonePosition?: string;
  }
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
      filter: grayscale(1);
      ${BREAKPOINT.landscape} {
        aspect-ratio: ${phoneRatio};
        object-position: ${phonePosition};
      }
    `}
  />
);

/**
 * A section's heading block: the label, the h2 and a sentence, with an
 * optional quiet link to the page that has more, on the right, on the
 * baseline of the block's last line.
 */
export const sectionHeader = ({
  pageIds,
  label,
  heading,
  intro,
  link,
}: {
  pageIds: PageIds;
  label: string;
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
          text("p", labelStyles(), label, "Label"),
          text("h2", headingStyles(), heading),
          ...(intro === undefined ? [] : [text("p", paragraphStyles(), intro)]),
        ])}
      </ws.element>,
      ...(link === undefined ? [] : [quietLink(pageIds, link)]),
    ])}
  </ws.element>
);
