import { $, css, ws } from "@webstudio-is/template";
import type { PageContext } from "../types";
import { BREAKPOINT, CONTAINER, SPACE, container } from "./layout";
import { type PageLink, pageHref, textLinkStyles } from "./nav";

/** A footer column: a heading over links to the template's pages. */
export type FooterColumn = { heading: string; links: PageLink[] };

/**
 * The site's footer on the base colours under a rule in the text colour:
 * the org's name and a one-line tagline, then the columns of links, if any
 * (with none it is the simple footer). The columns sit beside the name from
 * 768px up, wrapping under it when they do not fit; on phones everything
 * stacks to one column.
 */
export const footer = ({
  pageIds,
  name = "[Organization name]",
  tagline,
  columns = [],
}: {
  pageIds: PageContext["pageIds"];
  name?: string;
  tagline: string;
  columns?: FooterColumn[];
}): JSX.Element => (
  <ws.element
    ws:tag="footer"
    ws:label="Footer"
    ws:style={css`
      padding-top: ${SPACE[64]};
      padding-bottom: ${SPACE[64]};
      border-top-width: 1px;
      border-top-style: solid;
      border-top-color: var(--text);
      background-color: var(--base);
      color: var(--text);
      ${BREAKPOINT.landscape} {
        padding-top: ${SPACE[48]};
        padding-bottom: ${SPACE[48]};
      }
    `}
  >
    <ws.element
      ws:tag="div"
      ws:style={[
        ...container("wide"),
        ...css`
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          column-gap: ${SPACE[64]};
          row-gap: ${SPACE[48]};
          ${BREAKPOINT.landscape} {
            flex-direction: column;
            row-gap: ${SPACE[32]};
          }
        `,
      ]}
    >
      {[
        <ws.element
          key="name-and-tagline"
          ws:tag="div"
          ws:label="Name and tagline"
          ws:style={css`
            display: flex;
            flex-direction: column;
            row-gap: ${SPACE[8]};
            max-width: ${CONTAINER.narrow};
          `}
        >
          <ws.element
            ws:tag="p"
            ws:label="Name"
            ws:style={css`
              margin: 0;
              font-family: var(--font-heading);
              font-size: 20px;
              line-height: 1.2;
            `}
          >
            {name}
          </ws.element>
          <ws.element
            ws:tag="p"
            ws:style={css`
              margin: 0;
            `}
          >
            {tagline}
          </ws.element>
        </ws.element>,
        ...(columns.length === 0
          ? []
          : [
              <ws.element
                key="columns"
                ws:tag="div"
                ws:label="Columns"
                ws:style={css`
                  display: flex;
                  flex-wrap: wrap;
                  column-gap: ${SPACE[48]};
                  row-gap: ${SPACE[32]};
                  ${BREAKPOINT.landscape} {
                    flex-direction: column;
                  }
                `}
              >
                {columns.map((column, columnIndex) => (
                  <ws.element
                    key={columnIndex}
                    ws:tag="div"
                    ws:label="Column"
                    ws:style={css`
                      display: flex;
                      flex-direction: column;
                      align-items: flex-start;
                    `}
                  >
                    {[
                      <ws.element
                        key="heading"
                        ws:tag="h2"
                        ws:style={css`
                          margin: 0;
                          font-family: var(--font-heading);
                          font-size: 1em;
                          line-height: 1.3;
                        `}
                      >
                        {column.heading}
                      </ws.element>,
                      ...column.links.map((link, index) => (
                        <$.Link
                          key={index}
                          href={pageHref(pageIds, link.pageKey)}
                          ws:style={textLinkStyles()}
                        >
                          {link.label}
                        </$.Link>
                      )),
                    ]}
                  </ws.element>
                ))}
              </ws.element>,
            ]),
      ]}
    </ws.element>
  </ws.element>
);
