import type { AssetValue, TemplateStyleDecl } from "@webstudio-is/template";
import type { CanonicalValues } from "./canonical-variables";
import type { PlaceBlock } from "./place-block";

// The site-template format (spec 6.1): a template is a module that exports one
// SiteTemplate, rendered by ./render and held to the rules by ./check.

export type TemplateCategory =
  | "nonprofit"
  | "association"
  | "community"
  | "union"
  | "campaign"
  | "single-issue"
  | "cooperative"
  | "emergency-services"
  | "foundation";

/** The chooser's order: the audience order of the positioning (spec 5). */
export const CATEGORY_ORDER: TemplateCategory[] = [
  "nonprofit",
  "association",
  "community",
  "union",
  "campaign",
  "single-issue",
  "cooperative",
  "emergency-services",
  "foundation",
];

export type ImageEntry = {
  /** From a `?url&no-inline` import of the file in the template's `images/` folder. */
  url: string;
  /** Where the image came from: its source (CC0 or OrganizeOS's own). */
  sourceUrl: string;
  /** Says what to replace the image with. */
  alt: string;
};

export type FontEntry = {
  /** From a `?url&no-inline` import of a `woff2` file in a `@fontsource` package. */
  url: string;
  /**
   * The family the builder derives from the file when it is uploaded
   * (`getAssetData`), which `--font-heading` or `--font-body` names first.
   */
  family: string;
  /** The SPDX id of its licence: OFL-1.1 or Apache-2.0. */
  licence: string;
  /** Where it came from: the npm package that bundles the file. */
  source: string;
};

/**
 * Declarations a template gives a platform block: what `css` returns, as
 * page styles are written. A placed block's root style
 * (`placeBlock`'s `style`) or a block token's look (`blockTokens`).
 */
export type BlockStyle = TemplateStyleDecl[];

/** The tokens the platform blocks wear, which a template may restyle. */
export type BlockTokenName =
  | "OS Form Heading"
  | "OS Field"
  | "OS Input"
  | "OS Button"
  | "OS Message"
  | "OS Card"
  | "OS Event Title"
  | "OS Event Link"
  | "OS Event Row"
  | "OS Event Date"
  | "OS Event Day"
  | "OS Event Cover"
  | "OS Event Note";

/** What a page's body is rendered with. Images are named by file. */
export type PageContext = {
  /** Every page's id by its key, assigned before any body renders. */
  pageIds: Record<string, string>;
  placeBlock: PlaceBlock;
  image: (file: string) => AssetValue;
  backgroundImage: (file: string) => TemplateStyleDecl[];
  imageAlt: (file: string) => string;
};

export type SiteTemplatePage = {
  key: string;
  name: string;
  /** `""` for Home, whose key is "home". */
  path: string;
  title: string;
  description: string;
  /**
   * Fresh JSX on every call, rooted at `<ws.element ws:tag="body">`: the
   * renderer keys instances by element identity, so a shared piece (Nav,
   * Footer, a card) is a function too, never a module-level constant.
   */
  body: (context: PageContext) => JSX.Element;
};

export type SiteTemplate = {
  id: string;
  category: TemplateCategory;
  name: string;
  oneLine: string;
  styleTags: string[];
  /** Only "listed" templates are offered; a "draft" is applied for review. */
  status: "draft" | "listed";
  /** The PRs the template needs merged first. */
  dependsOn: string[];
  /** The chooser's picture of the template: a file name in `images`. */
  thumbnail: string;
  /**
   * A file name in `images` that the preview tool's sample events show as
   * the first event's cover (scripts/preview-site-template.mjs), in place of
   * the thumbnail: one that no page with an events block shows, so a preview
   * never shows a photo twice. Only the preview reads it; it is never applied
   * to a site, whose events and covers are the org's.
   */
  previewEventCover?: string;
  variables: CanonicalValues;
  /** By file name in the template's `images/` folder. */
  images: Record<string, ImageEntry>;
  /**
   * By file name, a `.woff2` file: the fonts `--font-heading` and
   * `--font-body` name, uploaded with the template when it is applied.
   */
  fonts: Record<string, FontEntry>;
  pages: SiteTemplatePage[];
  /**
   * The template's look for the block tokens, by name: each declaration
   * replaces the token's own of the same key (breakpoint, state, property)
   * or is added. One look per name, as a project holds one token per name:
   * a block the org inserts later wears it too. Each name is worn by a block
   * the template places.
   */
  blockTokens?: Partial<Record<BlockTokenName, BlockStyle>>;
};
