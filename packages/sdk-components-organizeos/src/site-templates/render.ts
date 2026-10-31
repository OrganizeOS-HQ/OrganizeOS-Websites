import {
  type Breakpoint,
  type StyleDecl,
  type WebstudioFragment,
  getStyleDeclKey,
} from "@webstudio-is/sdk";
import { camelCaseProperty, parseMediaQuery } from "@webstudio-is/css-data";
import { AssetValue, renderTemplate } from "@webstudio-is/template";
import { createBlockPlacer, type BlockPlacement } from "./place-block";
import type {
  BlockStyle,
  BlockTokenName,
  ImageEntry,
  PageContext,
  SiteTemplate,
} from "./types";

export type RenderedPage = {
  key: string;
  pageId: string;
  name: string;
  path: string;
  title: string;
  description: string;
  /** Rooted at the page's body. */
  fragment: WebstudioFragment;
  /** The platform blocks the page placed, for the apply routine to bind. */
  placements: BlockPlacement[];
};

/**
 * A block token's declarations from a template (`blockTokens`) as styles of
 * the token `styleSourceId`, each on the breakpoint of `breakpoints` that its
 * media query names, or on a new one, which `newBreakpoints` returns for the
 * caller to add (`createBreakpointId` names it). A query that does not parse
 * is skipped, as `renderTemplate` skips it. The render merges these into each
 * page's fragment, and the apply routine into a token the project already
 * holds.
 */
export const getBlockTokenStyles = ({
  styleSourceId,
  style,
  breakpoints,
  createBreakpointId,
}: {
  styleSourceId: StyleDecl["styleSourceId"];
  style: BlockStyle;
  breakpoints: Breakpoint[];
  createBreakpointId: () => Breakpoint["id"];
}): { styles: StyleDecl[]; newBreakpoints: Breakpoint[] } => {
  const known = [...breakpoints];
  const newBreakpoints: Breakpoint[] = [];
  const styles: StyleDecl[] = [];
  for (const { breakpoint: mediaQuery, state, property, value } of style) {
    const media = mediaQuery === undefined ? {} : parseMediaQuery(mediaQuery);
    if (media === undefined) {
      continue;
    }
    let breakpoint = known.find(
      (item) =>
        item.minWidth === media.minWidth &&
        item.maxWidth === media.maxWidth &&
        item.condition === media.condition
    );
    if (breakpoint === undefined) {
      const label = media.minWidth ?? media.maxWidth ?? media.condition;
      breakpoint = {
        id: createBreakpointId(),
        label: label === undefined ? "" : String(label),
        ...media,
      };
      known.push(breakpoint);
      newBreakpoints.push(breakpoint);
    }
    styles.push({
      styleSourceId,
      breakpointId: breakpoint.id,
      state,
      property: camelCaseProperty(property),
      value,
    });
  }
  return { styles, newBreakpoints };
};

/**
 * A page's fragment with the template's block tokens merged into each token
 * of their names: a declaration replaces the token's own of the same key, or
 * is added. Into the fragment, never into the module's `token()` objects,
 * which every other render and the Components panel share.
 */
const mergeBlockTokens = (
  fragment: WebstudioFragment,
  blockTokens: SiteTemplate["blockTokens"]
): WebstudioFragment => {
  if (blockTokens === undefined) {
    return fragment;
  }
  let breakpoints = fragment.breakpoints;
  const styles = new Map(
    fragment.styles.map((decl) => [getStyleDeclKey(decl), decl])
  );
  // a new breakpoint's id, a count as renderTemplate's are, unused in the
  // fragment and by any breakpoint added before it
  const usedIds = new Set(breakpoints.map((breakpoint) => breakpoint.id));
  const createBreakpointId = () => {
    let count = usedIds.size;
    while (usedIds.has(String(count))) {
      count += 1;
    }
    usedIds.add(String(count));
    return String(count);
  };
  for (const source of fragment.styleSources) {
    if (
      source.type !== "token" ||
      Object.hasOwn(blockTokens, source.name) === false
    ) {
      continue;
    }
    const style = blockTokens[source.name as BlockTokenName];
    if (style === undefined) {
      continue;
    }
    const merged = getBlockTokenStyles({
      styleSourceId: source.id,
      style,
      breakpoints,
      createBreakpointId,
    });
    breakpoints = [...breakpoints, ...merged.newBreakpoints];
    for (const decl of merged.styles) {
      styles.set(getStyleDeclKey(decl), decl);
    }
  }
  return { ...fragment, breakpoints, styles: Array.from(styles.values()) };
};

/**
 * Renders every page of a template into a fragment of its own. Pure: the
 * caller supplies the asset id of each image file and the page ids, so the
 * builder can pass uploaded ids and `nanoid` and a test fixed ones.
 *
 * Every page gets its id before any body renders, so a page can link to one
 * that comes after it. Each page has a block placer of its own, and the
 * template's block tokens are merged into each fragment, so a preview and the
 * check see the styles an applied site gets. An image the template does not
 * list, or one with no asset id, throws, as does a page key used twice; a
 * body's error is rethrown naming its page.
 */
export const renderSiteTemplate = (
  template: SiteTemplate,
  options: {
    /** By image file name. */
    assetIds: Map<string, string>;
    generatePageId: () => string;
  }
): RenderedPage[] => {
  const pageIds: Record<string, string> = {};
  for (const page of template.pages) {
    if (Object.hasOwn(pageIds, page.key)) {
      throw new Error(`Two pages have the key "${page.key}"`);
    }
    pageIds[page.key] = options.generatePageId();
  }

  const imageEntry = (file: string): ImageEntry => {
    if (Object.hasOwn(template.images, file) === false) {
      throw new Error(`Image "${file}" is not in the template's images`);
    }
    return template.images[file];
  };
  const assetId = (file: string) => {
    imageEntry(file);
    const id = options.assetIds.get(file);
    if (id === undefined) {
      throw new Error(`Image "${file}" has no asset id`);
    }
    return id;
  };

  return template.pages.map((page) => {
    const { placeBlock, placements } = createBlockPlacer();
    const context: PageContext = {
      pageIds,
      placeBlock,
      image: (file) => new AssetValue(assetId(file)),
      backgroundImage: (file) => [
        {
          property: "background-image",
          value: {
            type: "layers",
            value: [
              { type: "image", value: { type: "asset", value: assetId(file) } },
            ],
          },
        },
      ],
      imageAlt: (file) => imageEntry(file).alt,
    };
    let fragment: WebstudioFragment;
    try {
      fragment = mergeBlockTokens(
        renderTemplate(page.body(context)),
        template.blockTokens
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Page "${page.key}": ${message}`, { cause: error });
    }
    return {
      key: page.key,
      pageId: pageIds[page.key],
      name: page.name,
      path: page.path,
      title: page.title,
      description: page.description,
      fragment,
      placements,
    };
  });
};
