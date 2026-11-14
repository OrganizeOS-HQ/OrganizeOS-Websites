import { css, type TemplateStyleDecl } from "@webstudio-is/template";
import type { CompleteKitStyle } from "../site-templates/types";

/**
 * The kit style of a site that did not come from a catalog template: square
 * enough buttons, bold headings, typed as written, and the kit's name sizes.
 */
export const NEUTRAL_LOOK: CompleteKitStyle = {
  buttonRadius: "6px",
  buttonWeight: 600,
  headingWeight: 700,
  navNameSize: "20px",
  footerNameSize: "20px",
};

/**
 * A new page's body when Home's body has no style of its own (a blank site):
 * the site's colours and body font through the canonical variables.
 */
export const neutralBodyStyles = (): TemplateStyleDecl[] => css`
  margin: 0;
  background-color: var(--base);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 18px;
  line-height: 1.6;
`;
