import { css, ws } from "@webstudio-is/template";
import type { PageContext } from "../types";
import {
  BREAKPOINT,
  CONTAINER,
  type KitStyle,
  SPACE,
  container,
  fontWeight,
} from "./layout";
import {
  type SiteLink,
  linkInRowStyles,
  linkRowStyles,
  textLink,
} from "./links";
import { sample } from "./sample";

/** A footer column: a title over links to pages or anchors. */
export type FooterColumn = { heading: string; links: SiteLink[] };

/**
 * One column: a `nav` named by its title for assistive technology, the
 * title as plain text (no heading, so a footer adds none to every page's
 * outline), then its links.
 */
const footerColumn = (
  pageIds: PageContext["pageIds"],
  column: FooterColumn,
  key: number,
  headingWeight: number | undefined
) => (
  <ws.element
    key={key}
    ws:tag="nav"
    ws:label="Column"
    aria-label={column.heading}
    ws:style={css`
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    `}
  >
    {[
      <ws.element
        key="title"
        ws:tag="p"
        ws:label="Column title"
        ws:style={[
          ...css`
            margin: 0;
            font-family: var(--font-heading);
            line-height: 1.3;
          `,
          ...fontWeight(headingWeight),
        ]}
      >
        {column.heading}
      </ws.element>,
      ...column.links.map((link, index) => textLink(pageIds, link, index)),
    ]}
  </ws.element>
);

/**
 * The site's footer on the base colours under a rule in the text colour:
 * the org's name (a [bracketed] placeholder in it kept together, `sample`)
 * and a one-line tagline; then the simple footer's `links`, if any, as
 * lines of text, balanced (`linkRowStyles`); then the columns of links, if any; then `note`, if any, in a
 * box of its own (a paid-for-by or imprint line, at 14px). The links and the
 * columns sit beside the name from 768px up, the columns wrapping under it
 * when they do not fit and the links narrowing the tagline instead; on
 * phones everything stacks to one column.
 */
export const footer = ({
  pageIds,
  name = "[Organization name]",
  tagline,
  links = [],
  columns = [],
  note,
  headingWeight,
}: Pick<KitStyle, "headingWeight"> & {
  pageIds: PageContext["pageIds"];
  name?: string;
  tagline: string;
  /** The simple footer's links: a row of pages or anchors. */
  links?: SiteLink[];
  columns?: FooterColumn[];
  note?: JSX.Element | JSX.Element[];
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
          flex-direction: column;
          row-gap: ${SPACE[48]};
          ${BREAKPOINT.landscape} {
            row-gap: ${SPACE[32]};
          }
        `,
      ]}
    >
      {[
        <ws.element
          key="bar"
          ws:tag="div"
          ws:style={css`
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            column-gap: ${SPACE[64]};
            row-gap: ${SPACE[48]};
            ${BREAKPOINT.landscape} {
              flex-direction: column;
              row-gap: ${SPACE[32]};
            }
          `}
        >
          {[
            <ws.element
              key="name-and-tagline"
              ws:tag="div"
              ws:label="Name and tagline"
              ws:style={[
                ...css`
                  display: flex;
                  flex-direction: column;
                  row-gap: ${SPACE[8]};
                  max-width: ${CONTAINER.narrow};
                `,
                // a row of links is short: the name and tagline give way to
                // it, their tagline wrapping, so it stays beside them on a
                // tablet rather than dropping under them
                ...(links.length === 0
                  ? []
                  : css`
                      flex-grow: 1;
                      flex-shrink: 1;
                      flex-basis: 18rem;
                      ${BREAKPOINT.landscape} {
                        flex-basis: auto;
                      }
                    `),
              ]}
            >
              <ws.element
                ws:tag="p"
                ws:label="Name"
                ws:style={[
                  ...css`
                    margin: 0;
                    font-family: var(--font-heading);
                    font-size: 20px;
                    line-height: 1.2;
                  `,
                  ...fontWeight(headingWeight),
                ]}
              >
                {sample(name)}
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
            ...(links.length === 0
              ? []
              : [
                  <ws.element
                    key="links"
                    ws:tag="nav"
                    ws:label="Links"
                    aria-label="Footer"
                    ws:style={[
                      ...linkRowStyles("all"),
                      // centred beside the name and tagline, as its links
                      // were in a flex row; on phones the bar is a column
                      ...css`
                        align-self: center;
                        ${BREAKPOINT.landscape} {
                          align-self: stretch;
                        }
                      `,
                    ]}
                  >
                    {links.map((link, index) =>
                      textLink(pageIds, link, index, linkInRowStyles("all"))
                    )}
                  </ws.element>,
                ]),
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
                    {columns.map((column, index) =>
                      footerColumn(pageIds, column, index, headingWeight)
                    )}
                  </ws.element>,
                ]),
          ]}
        </ws.element>,
        ...(note === undefined
          ? []
          : [
              <ws.element
                key="note"
                ws:tag="div"
                ws:label="Note"
                ws:style={css`
                  align-self: flex-start;
                  max-width: ${CONTAINER.text};
                  padding: ${SPACE[12]} ${SPACE[16]};
                  border-width: 1px;
                  border-style: solid;
                  border-color: var(--text);
                  font-size: 14px;
                  line-height: 1.5;
                `}
              >
                {note}
              </ws.element>,
            ]),
      ]}
    </ws.element>
  </ws.element>
);
