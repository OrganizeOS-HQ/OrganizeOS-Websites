import type { AssetValue, TemplateStyleDecl } from "@webstudio-is/template";
import type { CanonicalValues } from "./canonical-variables";
import type { BlockKey } from "./place-block";

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

/** What a page's body is rendered with. Images are named by file. */
export type PageContext = {
  /** Every page's id by its key, assigned before any body renders. */
  pageIds: Record<string, string>;
  placeBlock: (key: BlockKey, placementId: string) => JSX.Element;
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
  variables: CanonicalValues;
  /** By file name in the template's `images/` folder. */
  images: Record<string, ImageEntry>;
  pages: SiteTemplatePage[];
};
