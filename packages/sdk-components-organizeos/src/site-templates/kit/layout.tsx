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
 * The focus ring of every link and button: 2px of `--accent-2` at a 2px
 * offset. A nested rule, so it goes last among an element's styles.
 */
export const focusRing = (): TemplateStyleDecl[] => css`
  &:focus-visible {
    outline-width: 2px;
    outline-style: solid;
    outline-color: var(--accent-2);
    outline-offset: 2px;
  }
`;

/**
 * A full-bleed `<section>` named `label` in the Navigator, in one of the
 * checked colour pairs (base by default), padded above and below, around a
 * wide container holding `children`. `id` is the target of an in-page link
 * (`#sign-up`).
 */
export const section = ({
  label,
  children,
  background = "base",
  id,
}: {
  label: string;
  children: JSX.Element | JSX.Element[];
  background?: SectionBackground;
  id?: string;
}): JSX.Element => {
  const colours = sectionColours[background];
  return (
    <ws.element
      ws:tag="section"
      ws:label={label}
      // an undefined prop would render as a prop with no value
      {...(id === undefined ? {} : { id })}
      ws:style={css`
        padding-top: ${sectionPadding.base};
        padding-bottom: ${sectionPadding.base};
        background-color: var(--${colours.background});
        color: var(--${colours.text});
        ${BREAKPOINT.landscape} {
          padding-top: ${sectionPadding.phone};
          padding-bottom: ${sectionPadding.phone};
        }
      `}
    >
      <ws.element ws:tag="div" ws:style={container("wide")}>
        {children}
      </ws.element>
    </ws.element>
  );
};
