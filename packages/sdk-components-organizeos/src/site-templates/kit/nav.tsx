import { $, css, ws, type TemplateStyleDecl } from "@webstudio-is/template";
import type { PageContext } from "../types";
import {
  BREAKPOINT,
  type KitStyle,
  SPACE,
  container,
  focusRing,
  fontWeight,
  tapTarget,
} from "./layout";
import {
  type SiteLink,
  buttonStyles,
  linkProps,
  pageHref,
  textLink,
} from "./links";

/**
 * "split": the name on the left, the links and the button on the right.
 * "centered": the name centred over a centred row of the links and the
 * button.
 */
export type NavVariant = "split" | "centered";

type NavOptions = KitStyle & {
  pageIds: PageContext["pageIds"];
  name: string;
  links: SiteLink[];
  cta?: SiteLink;
};

const headerStyles = () => css`
  background-color: var(--base);
  color: var(--text);
`;

const barStyles = (layout: TemplateStyleDecl[]) => [
  ...container("wide"),
  ...css`
    padding-top: ${SPACE[16]};
    padding-bottom: ${SPACE[16]};
    ${BREAKPOINT.landscape} {
      padding-top: ${SPACE[8]};
      padding-bottom: ${SPACE[8]};
    }
  `,
  ...layout,
];

/** The org's name as text where a logo goes, linking Home. */
const nameLink = (
  { pageIds, name, headingWeight }: NavOptions,
  layout: TemplateStyleDecl[]
) => (
  <$.Link
    key="name"
    ws:label="Name"
    href={pageHref(pageIds, "home")}
    ws:style={[
      ...tapTarget(),
      ...css`
        font-family: var(--font-heading);
        font-size: 20px;
        line-height: 1.2;
        color: inherit;
        text-decoration-line: none;
      `,
      ...fontWeight(headingWeight),
      ...layout,
      ...focusRing(),
    ]}
  >
    {name}
  </$.Link>
);

const button = (
  options: NavOptions,
  cta: SiteLink,
  layout: TemplateStyleDecl[] = []
) => (
  <$.Link
    key="button"
    ws:label="Button"
    {...linkProps(options.pageIds, cta)}
    ws:style={[...buttonStyles(options), ...layout]}
  >
    {cta.label}
  </$.Link>
);

/**
 * One row from 992px up, which never wraps: when the links do not fit they
 * wrap within their own box, beside the button. At BREAKPOINT.tablet and
 * below the name and the button share the first row, the name wrapping its
 * own text before the button would leave the row, and the links take a row
 * of their own beneath, wrapping as they need. So no item is ever left alone
 * on a row, whatever the name's length.
 */
const splitNav = (options: NavOptions) => (
  <ws.element ws:tag="header" ws:label="Nav" ws:style={headerStyles()}>
    <ws.element
      ws:tag="div"
      ws:style={barStyles(css`
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        column-gap: ${SPACE[32]};
        ${BREAKPOINT.tablet} {
          flex-wrap: wrap;
        }
        ${BREAKPOINT.landscape} {
          column-gap: ${SPACE[16]};
        }
      `)}
    >
      {[
        nameLink(
          options,
          css`
            margin-right: auto;
            ${BREAKPOINT.tablet} {
              flex-grow: 1;
              flex-basis: 0;
            }
          `
        ),
        <ws.element
          key="links"
          ws:tag="nav"
          ws:label="Links"
          aria-label="Main"
          ws:style={css`
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            column-gap: ${SPACE[24]};
            ${BREAKPOINT.tablet} {
              order: 1;
              flex-basis: 100%;
              justify-content: flex-start;
            }
            ${BREAKPOINT.landscape} {
              column-gap: ${SPACE[16]};
            }
          `}
        >
          {options.links.map((link, index) =>
            textLink(options.pageIds, link, index)
          )}
        </ws.element>,
        ...(options.cta === undefined
          ? []
          : [
              button(
                options,
                options.cta,
                css`
                  flex-shrink: 0;
                `
              ),
            ]),
      ]}
    </ws.element>
  </ws.element>
);

/**
 * The name centred over one centred row of the links and the button, which
 * wraps, still centred, when it does not fit.
 */
const centeredNav = (options: NavOptions) => (
  <ws.element
    ws:tag="header"
    ws:label="Nav: Centered"
    ws:style={headerStyles()}
  >
    <ws.element
      ws:tag="div"
      ws:style={barStyles(css`
        display: flex;
        flex-direction: column;
        align-items: center;
        row-gap: ${SPACE[8]};
        text-align: center;
      `)}
    >
      {nameLink(
        options,
        css`
          justify-content: center;
        `
      )}
      <ws.element
        ws:tag="nav"
        ws:label="Links"
        aria-label="Main"
        ws:style={css`
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
          column-gap: ${SPACE[24]};
          row-gap: ${SPACE[8]};
          ${BREAKPOINT.landscape} {
            column-gap: ${SPACE[16]};
          }
        `}
      >
        {[
          ...options.links.map((link, index) =>
            textLink(options.pageIds, link, index)
          ),
          ...(options.cta === undefined ? [] : [button(options, options.cta)]),
        ]}
      </ws.element>
    </ws.element>
  </ws.element>
);

/**
 * The site's top bar on the base colours: the org's name as text where a
 * logo goes, linking Home; the links, to pages by key or to anchors on the
 * page; and at most one primary button (`cta`), drawn with the template's
 * KitStyle. CSS only, since a template ships no script.
 */
export const nav = ({
  name = "[Organization name]",
  variant = "split",
  ...options
}: KitStyle & {
  pageIds: PageContext["pageIds"];
  name?: string;
  links: SiteLink[];
  cta?: SiteLink;
  variant?: NavVariant;
}): JSX.Element =>
  variant === "centered"
    ? centeredNav({ name, ...options })
    : splitNav({ name, ...options });
