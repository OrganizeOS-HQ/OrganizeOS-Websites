import type { BlockKey, PlaceBlock } from "../site-templates/place-block";
import type { CompleteKitStyle, ImageEntry } from "../site-templates/types";

// The page-template format (OrganizeOS design
// 2026-11-13-builder-templates-screen-and-page-templates-design.md, section
// 6.3): a page template, "starter page" in code, is one page body a site gets
// from New page, rendered by ./render and held to the rules by ./check. It
// has no fonts, variables or block tokens of its own: adding it takes the
// site's nav, footer, colours and fonts.

/** What a page template's body is drawn with. */
export type StarterPageContext = {
  placeBlock: PlaceBlock;
  /** The site's kit style: its template's, or NEUTRAL_LOOK. */
  look: CompleteKitStyle;
  /**
   * An Image's props for a photo the org replaces: the alt text only, so the
   * canvas draws the builder's placeholder. A page template holds no image.
   */
  image: () => { alt: string };
};

export type StarterPage = {
  id: string;
  /** The card's name on the New page screen. */
  name: string;
  /** The page's default name. */
  pageName: string;
  /** The page's default path, never "" (Home) or one the platform serves. */
  path: string;
  title: string;
  description: string;
  /** Offered only once the owner has seen its pictures (inventory rule 12). */
  status: "draft" | "listed";
  /** The card's picture: a file of `images`. */
  picture: string;
  /** The picture, and nothing else. */
  images: Record<string, ImageEntry>;
  /**
   * The platform blocks it places, so the New page screen hides it from an
   * org on the blocks deny list without rendering it. The check holds this
   * equal to what the body places.
   */
  blocks: readonly BlockKey[];
  /**
   * Fresh JSX on every call, rooted at `<ws.element ws:tag="body">` with no
   * style, holding labelled sections and no nav or footer.
   */
  body: (context: StarterPageContext) => JSX.Element;
};
