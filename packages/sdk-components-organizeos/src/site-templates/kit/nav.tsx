import {
  $,
  PageValue,
  css,
  ws,
  type TemplateStyleDecl,
} from "@webstudio-is/template";
import type { PageContext } from "../types";
import { BREAKPOINT, SPACE, container, focusRing, tapTarget } from "./layout";

/** A link to one of the template's pages, named by its key. */
export type PageLink = { label: string; pageKey: string };

/** The page's id as a link target; a key the template lacks fails its check. */
export const pageHref = (
  pageIds: PageContext["pageIds"],
  pageKey: string
): PageValue => new PageValue(pageIds[pageKey]);

/**
 * The Link's "Current page" state, written as its meta writes it so the
 * Style panel offers it (a quoted value would be another state).
 */
const currentPage = "[aria-current=page]";

/**
 * A plain text link in the surrounding colour, underlined on hover and when
 * it is the current page.
 */
export const textLinkStyles = (): TemplateStyleDecl[] => [
  ...tapTarget(),
  ...css`
    color: inherit;
    text-decoration-line: none;
    text-underline-offset: 4px;
    &:hover {
      text-decoration-line: underline;
    }
    &${currentPage} {
      text-decoration-line: underline;
    }
  `,
  ...focusRing(),
];

/**
 * The site's top bar on the base colours: the org's name as text where a
 * logo goes, linking Home; the links; and at most one primary button, in
 * accent-1. One row from 768px up. On phones (BREAKPOINT.landscape) the name
 * and the button share the first row, the name wrapping before the button
 * would, and the links take a row of their own beneath, wrapping as they
 * need: CSS only, since a template ships no script.
 */
export const nav = ({
  pageIds,
  name = "[Organization name]",
  links,
  cta,
}: {
  pageIds: PageContext["pageIds"];
  name?: string;
  links: PageLink[];
  cta?: PageLink;
}): JSX.Element => (
  <ws.element
    ws:tag="header"
    ws:label="Nav"
    ws:style={css`
      background-color: var(--base);
      color: var(--text);
    `}
  >
    <ws.element
      ws:tag="div"
      ws:style={[
        ...container("wide"),
        ...css`
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          column-gap: ${SPACE[32]};
          padding-top: ${SPACE[16]};
          padding-bottom: ${SPACE[16]};
          ${BREAKPOINT.landscape} {
            column-gap: ${SPACE[16]};
            padding-top: ${SPACE[8]};
            padding-bottom: ${SPACE[8]};
          }
        `,
      ]}
    >
      {[
        <$.Link
          key="name"
          ws:label="Name"
          href={pageHref(pageIds, "home")}
          ws:style={[
            ...tapTarget(),
            ...css`
              margin-right: auto;
              font-family: var(--font-heading);
              font-size: 20px;
              line-height: 1.2;
              color: inherit;
              text-decoration-line: none;
              ${BREAKPOINT.landscape} {
                flex-grow: 1;
                flex-basis: 0;
              }
            `,
            ...focusRing(),
          ]}
        >
          {name}
        </$.Link>,
        <ws.element
          key="links"
          ws:tag="nav"
          ws:label="Links"
          ws:style={css`
            display: flex;
            flex-wrap: wrap;
            column-gap: ${SPACE[24]};
            ${BREAKPOINT.landscape} {
              order: 1;
              flex-basis: 100%;
              column-gap: ${SPACE[16]};
            }
          `}
        >
          {links.map((link, index) => (
            <$.Link
              key={index}
              href={pageHref(pageIds, link.pageKey)}
              ws:style={textLinkStyles()}
            >
              {link.label}
            </$.Link>
          ))}
        </ws.element>,
        ...(cta === undefined
          ? []
          : [
              <$.Link
                key="button"
                ws:label="Button"
                href={pageHref(pageIds, cta.pageKey)}
                ws:style={[
                  ...tapTarget(),
                  ...css`
                    justify-content: center;
                    padding-left: ${SPACE[24]};
                    padding-right: ${SPACE[24]};
                    background-color: var(--accent-1);
                    color: var(--base);
                    font-weight: 600;
                    text-decoration-line: none;
                    ${BREAKPOINT.landscape} {
                      padding-left: ${SPACE[16]};
                      padding-right: ${SPACE[16]};
                    }
                  `,
                  ...focusRing(),
                ]}
              >
                {cta.label}
              </$.Link>,
            ]),
      ]}
    </ws.element>
  </ws.element>
);
