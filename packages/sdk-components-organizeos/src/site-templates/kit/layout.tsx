import { css, ws, type TemplateStyleDecl } from "@webstudio-is/template";

// The layout kit's measurements and page frame: the skeleton every template
// shares (OrganizeOS spec 2026-10-31-website-template-directions.md, section
// 1). Templates differ in colour, type, corners and images, never in these.
// Colours and fonts come only through the canonical variables.
//
// A `css` block drops the declarations and `@media` blocks that follow a
// nested rule such as `&:hover { ... }`, so state rules go last in a block,
// or in a block of their own. Shorthands that take a variable (`outline: 2px
// solid var(--accent-2)`) put the variable in every longhand: write
// longhands.

/**
 * The project's own breakpoints (`initialBreakpoints` in
 * packages/sdk/src/schema/breakpoints.ts) as media queries for a `css` block:
 * `${BREAKPOINT.landscape} { ... }`. Styles are written for desktop and
 * narrowed by these; a template uses no others and no min-width.
 */
export const BREAKPOINT = {
  tablet: "@media (max-width: 991px)",
  landscape: "@media (max-width: 767px)",
  portrait: "@media (max-width: 479px)",
} as const;

/** The spacing scale: `SPACE[24]` is "24px". */
export const SPACE = {
  4: "4px",
  8: "8px",
  12: "12px",
  16: "16px",
  24: "24px",
  32: "32px",
  48: "48px",
  64: "64px",
  96: "96px",
} as const;

/**
 * Column widths: the running-text measure (65 characters), forms, and the
 * page's content.
 */
export const CONTAINER = {
  text: "65ch",
  narrow: "40rem",
  wide: "1120px",
} as const;

export type ContainerWidth = keyof typeof CONTAINER;

/** Side gutters: 40px from 768px up, 20px on phones. */
const gutter = { base: "40px", phone: "20px" };

/** A section's top and bottom padding: 96px, 56px on phones. */
const sectionPadding = { base: SPACE[96], phone: "56px" };

/**
 * The styles of a centred column at most `CONTAINER[width]` wide, with the
 * side gutters outside that width (content-box), so the content keeps its
 * full width and the column never touches the window's edge. A column goes
 * on a full-bleed element; a narrower one inside it is a plain `max-width`,
 * since a second container would add its gutters again.
 */
export const container = (width: ContainerWidth): TemplateStyleDecl[] => css`
  box-sizing: content-box;
  max-width: ${CONTAINER[width]};
  margin-left: auto;
  margin-right: auto;
  padding-left: ${gutter.base};
  padding-right: ${gutter.base};
  ${BREAKPOINT.landscape} {
    padding-left: ${gutter.phone};
    padding-right: ${gutter.phone};
  }
`;

/**
 * A link's or button's tap target: at least 44px tall, its text centred
 * in it.
 */
export const tapTarget = (): TemplateStyleDecl[] => css`
  display: inline-flex;
  align-items: center;
  min-height: 44px;
`;

/** The checked colour pairs a band may use (directions, section 1). */
export type SectionBackground = "base" | "accent-1" | "text";

const sectionColours: Record<
  SectionBackground,
  { background: string; text: string }
> = {
  base: { background: "base", text: "text" },
  "accent-1": { background: "accent-1", text: "base" },
  text: { background: "text", text: "base" },
};

/**
 * The custom property (`--focus-ring`) a band sets to the colour of the
 * focus rings inside it. The check holds `--accent-2` against the base
 * alone, so on a band it can all but vanish; a band rings focus in its text
 * colour, `--base`, which the check holds against accent-1, as it holds the
 * text colour against the base. Unset, on the base, the ring is
 * `--accent-2`. A base-coloured panel inside a band that holds the kit's
 * links sets it back to `var(--accent-2)`.
 */
export const FOCUS_RING_VARIABLE = "focus-ring";

/**
 * The focus ring of every link and button: 2px at a 2px offset, of
 * `--accent-2`, or of a band's text colour inside a band
 * (`FOCUS_RING_VARIABLE`). A nested rule, so it goes last among an element's
 * styles.
 */
export const focusRing = (): TemplateStyleDecl[] => css`
  &:focus-visible {
    outline-width: 2px;
    outline-style: solid;
    outline-color: var(--${FOCUS_RING_VARIABLE}, var(--accent-2));
    outline-offset: 2px;
  }
`;

/**
 * A template's choices the kit draws with, given to `nav`, `footer` and
 * `buttonStyles` alike. Weights are the template's, never the kit's, so a
 * single-weight face (Archivo Black, Instrument Serif) is never asked for a
 * bold the browser would synthesize: unset, the kit declares none.
 */
export type KitStyle = {
  /** The corners of the kit's buttons: "3px", "6px", "999px" for a pill; square when unset. */
  buttonRadius?: string;
  /** The weight of a button's label, in `--font-body`. */
  buttonWeight?: number;
  /** The weight of the kit's text in `--font-heading`: the name and the footer's column titles. */
  headingWeight?: number;
  /** The case of that text, as the template's headings are set; as typed when unset. */
  headingCase?: "uppercase";
};

/** A `font-weight` declaration, or none when the template sets no weight. */
export const fontWeight = (weight: number | undefined): TemplateStyleDecl[] =>
  weight === undefined
    ? []
    : css`
        font-weight: ${String(weight)};
      `;

/** A `text-transform` declaration, or none when the template sets no case. */
export const textCase = (
  headingCase: KitStyle["headingCase"]
): TemplateStyleDecl[] =>
  headingCase === undefined
    ? []
    : css`
        text-transform: ${headingCase};
      `;

const declarationKey = ({ breakpoint, state, property }: TemplateStyleDecl) =>
  JSON.stringify([breakpoint ?? "", state ?? "", property]);

/**
 * A full-bleed `<section>` named `label` in the Navigator, in one of the
 * checked colour pairs (base by default), padded above and below, around a
 * container (`wide` by default) holding `children`. A band (accent-1 or
 * text) rings focus in its text colour (`FOCUS_RING_VARIABLE`). `id` is the
 * target of an in-page link (`#sign-up`). `styles` adds the template's own
 * to the section's (`position: relative`, so a full-bleed image inside the
 * container can cover the section); one that restates a declaration of the
 * kit's (the same property at the same breakpoint and state) throws, since
 * the later of the two would win unseen.
 */
export const section = ({
  label,
  children,
  background = "base",
  width = "wide",
  id,
  styles = [],
}: {
  label: string;
  children: JSX.Element | JSX.Element[];
  background?: SectionBackground;
  width?: ContainerWidth;
  id?: string;
  styles?: TemplateStyleDecl[];
}): JSX.Element => {
  const colours = sectionColours[background];
  const own = css`
    padding-top: ${sectionPadding.base};
    padding-bottom: ${sectionPadding.base};
    background-color: var(--${colours.background});
    color: var(--${colours.text});
    ${background === "base"
      ? ""
      : `--${FOCUS_RING_VARIABLE}: var(--${colours.text});`}
    ${BREAKPOINT.landscape} {
      padding-top: ${sectionPadding.phone};
      padding-bottom: ${sectionPadding.phone};
    }
  `;
  const ownKeys = new Set(own.map(declarationKey));
  const restated = styles.find((style) => ownKeys.has(declarationKey(style)));
  if (restated !== undefined) {
    throw new Error(
      `Section "${label}": its styles restate the kit's ${restated.property}${restated.breakpoint === undefined ? "" : ` under ${restated.breakpoint}`}`
    );
  }
  return (
    <ws.element
      ws:tag="section"
      ws:label={label}
      // an undefined prop would render as a prop with no value
      {...(id === undefined ? {} : { id })}
      ws:style={[...own, ...styles]}
    >
      <ws.element ws:tag="div" ws:style={container(width)}>
        {children}
      </ws.element>
    </ws.element>
  );
};
