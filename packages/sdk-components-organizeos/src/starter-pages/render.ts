import type { BlockPlacement } from "../site-templates/place-block";
import { renderPageBody, type RenderedPage } from "../site-templates/render";
import type { CompleteKitStyle } from "../site-templates/types";
import type { StarterPage } from "./types";

/** The alt text of a photo a page template leaves for the org to add. */
const PLACEHOLDER_ALT = "Replace with a photo";

/**
 * A page template as one rendered page: its body under `look`, with the
 * blocks it placed, its id the page's key and its pageName the page's name.
 * The page id is `generatePageId()`'s; adding the page re-ids the rest.
 */
export const renderStarterPage = (
  page: StarterPage,
  options: {
    look: CompleteKitStyle;
    generatePageId: () => string;
    inspectBody?: (body: JSX.Element, placements: BlockPlacement[]) => void;
  }
): RenderedPage => {
  const { fragment, placements } = renderPageBody(
    page.id,
    (placeBlock) =>
      page.body({
        placeBlock,
        look: options.look,
        image: () => ({ alt: PLACEHOLDER_ALT }),
      }),
    { inspectBody: options.inspectBody }
  );
  return {
    key: page.id,
    pageId: options.generatePageId(),
    name: page.pageName,
    path: page.path,
    title: page.title,
    description: page.description,
    fragment,
    placements,
  };
};
