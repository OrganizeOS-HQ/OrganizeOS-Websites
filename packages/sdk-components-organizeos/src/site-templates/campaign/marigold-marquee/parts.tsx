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
  RADIUS,
  eyebrowStyles,
  headingStyles,
  outlineButtonStyles,
  paragraphStyles,
  primaryButtonStyles,
  quietLinkStyles,
  stackStyles,
} from "./styles";

// Marigold Marquee's shared pieces: the nav and footer every page carries,
// its links and buttons, the portrait frame and section headings. Each is a
// function returning fresh JSX.

export type PageIds = PageContext["pageIds"];

/** The platform's donation page on the site's own host. */
export const DONATE: SiteLink = { label: "Donate", href: "/donate" };

/** The other ask: the Volunteer page, with every way to help and the form. */
export const VOLUNTEER: SiteLink = { label: "Volunteer", pageKey: "volunteer" };

/** The campaign's name where a logo goes, in the nav and the footer. */
const NAME = "[Campaign name]";

const NAV_LINKS: SiteLink[] = [
  { label: "Issues", pageKey: "issues" },
  { label: "About", pageKey: "about" },
  { label: "Endorsements", pageKey: "endorsements" },
  { label: "Volunteer", pageKey: "volunteer" },
  { label: "Events", pageKey: "events" },
];

/** Nav: Default, with Donate as its one button. */
export const siteNav = (pageIds: PageIds): JSX.Element =>
  nav({ pageIds, name: NAME, links: NAV_LINKS, cta: DONATE, ...LOOK });

/**
 * Footer: Columns, with the paid-for-by line most jurisdictions require in
 * the kit's boxed note, as one bracketed statement for the campaign to
 * replace with the exact wording. It wraps as a sentence does, so it does
 * not go through `sample`, which would keep the whole bracket on one line.
 */
export const siteFooter = (pageIds: PageIds): JSX.Element =>
  footer({
    pageIds,
    name: NAME,
    tagline: sample("[Candidate name] for [Office]"),
    columns: [
      {
        heading: "The campaign",
        links: [
          { label: "Issues", pageKey: "issues" },
          { label: "About", pageKey: "about" },
          { label: "Endorsements", pageKey: "endorsements" },
        ],
      },
      {
        heading: "Take part",
        links: [
          { label: "Volunteer", pageKey: "volunteer" },
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
          text-wrap-style: pretty;
        `}
      >
        {
          "[Paid for by Committee name, in the exact wording your jurisdiction requires]"
        }
      </ws.element>
    ),
    headingWeight: LOOK.headingWeight,
  });

/** An underlined link: mint on the base, the band's colour on a band. */
export const quietLink = (
  pageIds: PageIds,
  link: SiteLink,
  { onBand = false } = {}
): JSX.Element => (
  <$.Link
    ws:label="Link"
    {...linkProps(pageIds, link)}
    ws:style={quietLinkStyles({ onBand })}
  >
    {link.label}
  </$.Link>
);

/** A button: marigold on the base unless `styles` says otherwise. */
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
 * Two buttons side by side, the first filled and the second outlined;
 * stacked full width on phones, the first on top. `styles` replaces the
 * pair's, as a band's buttons do.
 */
export const buttons = ({
  pageIds,
  primary,
  secondary,
  styles = [primaryButtonStyles(), outlineButtonStyles()],
}: {
  pageIds: PageIds;
  primary: SiteLink;
  secondary: SiteLink;
  styles?: [TemplateStyleDecl[], TemplateStyleDecl[]];
}): JSX.Element => (
  <ws.element
    ws:tag="div"
    ws:label="Buttons"
    ws:style={css`
      display: flex;
      flex-wrap: wrap;
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
    {button(pageIds, primary, styles[0])}
    {button(pageIds, secondary, styles[1])}
  </ws.element>
);

/** How far the marigold block sits behind a portrait: right and down. */
const BLOCK_OFFSET = { base: SPACE[24], phone: SPACE[16] };

/**
 * The band of the page's own colour around a portrait, which parts it from
 * the block behind: with no photo, the frame's accent-1 field and the block's
 * would otherwise run together as one shape.
 */
const PORTRAIT_GAP = "6px";

/**
 * A portrait in a 4:5 frame with a solid marigold block offset behind it,
 * down and to the right; the frame keeps that room inside its own column.
 * The photo has the template's corners and is cropped to fill the frame,
 * over an accent-1 field that shows when the photo is gone, and is ringed in
 * the base colour where it overlaps the block (PORTRAIT_GAP).
 */
export const portrait = (
  { image, imageAlt }: PageContext,
  file: string
): JSX.Element => (
  <ws.element
    ws:tag="div"
    ws:label="Portrait"
    ws:style={css`
      position: relative;
      margin-right: ${BLOCK_OFFSET.base};
      margin-bottom: ${BLOCK_OFFSET.base};
      ${BREAKPOINT.landscape} {
        margin-right: ${BLOCK_OFFSET.phone};
        margin-bottom: ${BLOCK_OFFSET.phone};
      }
    `}
  >
    <ws.element
      ws:tag="div"
      ws:label="Block"
      ws:style={css`
        position: absolute;
        top: ${BLOCK_OFFSET.base};
        left: ${BLOCK_OFFSET.base};
        right: -${BLOCK_OFFSET.base};
        bottom: -${BLOCK_OFFSET.base};
        border-radius: ${RADIUS};
        background-color: var(--accent-1);
        ${BREAKPOINT.landscape} {
          top: ${BLOCK_OFFSET.phone};
          left: ${BLOCK_OFFSET.phone};
          right: -${BLOCK_OFFSET.phone};
          bottom: -${BLOCK_OFFSET.phone};
        }
      `}
    />
    <$.Image
      ws:label="Photo"
      src={image(file)}
      alt={imageAlt(file)}
      ws:style={css`
        position: relative;
        display: block;
        width: 100%;
        height: auto;
        aspect-ratio: 4 / 5;
        object-fit: cover;
        border-radius: ${RADIUS};
        background-color: var(--accent-1);
        box-shadow: 0 0 0 ${PORTRAIT_GAP} var(--base);
      `}
    />
  </ws.element>
);

/**
 * A photo at a fixed ratio with the template's corners, cropped to fill it,
 * over an accent-1 field that shows when the photo is gone.
 */
export const photo = (
  { image, imageAlt }: PageContext,
  file: string,
  { ratio }: { ratio: string }
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
      border-radius: ${RADIUS};
      background-color: var(--accent-1);
    `}
  />
);

/**
 * A section's heading block: the eyebrow, the h2 and a sentence, with an
 * optional link to the page that has more, on the right, on the baseline of
 * the block's last line. `onBand` sets the eyebrow and link in the band's
 * text colour.
 */
export const sectionHeader = ({
  pageIds,
  eyebrow,
  heading,
  intro,
  link,
  onBand = false,
}: {
  pageIds: PageIds;
  eyebrow: string;
  heading: string;
  intro?: string;
  link?: SiteLink;
  onBand?: boolean;
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
          text("p", eyebrowStyles({ onBand }), eyebrow, "Eyebrow"),
          text("h2", headingStyles(), heading),
          ...(intro === undefined ? [] : [text("p", paragraphStyles(), intro)]),
        ])}
      </ws.element>,
      ...(link === undefined ? [] : [quietLink(pageIds, link, { onBand })]),
    ])}
  </ws.element>
);
