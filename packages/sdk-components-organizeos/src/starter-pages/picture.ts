import type { ImageEntry } from "../site-templates/types";

/**
 * A page template's picture: the card the New page screen shows, drawn by
 * the preview tool (`--starter <id> --thumbnail`), whose path from this
 * folder the source records (catalog.test.ts holds it to a file).
 */
export const pictureEntry = (name: string, url: string): ImageEntry => ({
  url,
  sourceUrl:
    "organizeos:generated/../../../../scripts/preview-site-template.mjs",
  alt: `A picture of the ${name} page template`,
});
