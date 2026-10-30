import type { WebstudioFragment } from "@webstudio-is/sdk";
import { AssetValue, renderTemplate } from "@webstudio-is/template";
import { createBlockPlacer, type BlockPlacement } from "./place-block";
import type { ImageEntry, PageContext, SiteTemplate } from "./types";

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
 * Renders every page of a template into a fragment of its own. Pure: the
 * caller supplies the asset id of each image file and the page ids, so the
 * builder can pass uploaded ids and `nanoid` and a test fixed ones.
 *
 * Every page gets its id before any body renders, so a page can link to one
 * that comes after it. Each page has a block placer of its own. An image the
 * template does not list, or one with no asset id, throws, as does a page key
 * used twice; a body's error is rethrown naming its page.
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
      fragment = renderTemplate(page.body(context));
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
