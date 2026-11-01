/**
 * @vitest-environment node
 */
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { SITE_TEMPLATES } from "@organizeos/site-components/site-templates";
import { getAssetData } from "../../../../../../../packages/asset-uploader/src/utils/get-asset-data";
import { spikeTemplate } from "../../../../../../../packages/sdk-components-organizeos/src/site-templates/__fixtures__/spike";

// What the builder stores for a template's font: the upload's own reading
// of the file (getAssetData, which the asset upload route runs on it). What it
// derives from every font file the approved direction board names is held in
// the asset uploader's organizeos-font-family.test.ts. The node environment,
// since getAssetData's font reader checks Node's Buffer.

/** apps/builder, the vitest root a root-relative `?url` import is under. */
const vitestRoot = fileURLToPath(
  new URL("../../../../../../", import.meta.url)
);

/**
 * The file behind a `?url` import: its path from the vitest root, or `/@fs/`
 * and its absolute path outside it (as the preview tool's dump reads it).
 */
const fileOfUrl = (url: string) => {
  const path = decodeURI(url.split("?")[0]);
  return path.startsWith("/@fs/")
    ? path.slice("/@fs".length)
    : join(vitestRoot, path);
};

describe("a template's fonts", () => {
  // The family a font variable names first is the one a publish keeps the
  // font by, so it must be the one the builder derives from the file.
  test("each records the family the builder derives from its file", async () => {
    const templates = [...SITE_TEMPLATES, spikeTemplate];
    const fonts = templates.flatMap((template) =>
      Object.entries(template.fonts).map(([file, entry]) => ({
        name: `${template.id}: ${file}`,
        ...entry,
      }))
    );
    expect(fonts.length).toBeGreaterThan(0);
    for (const { name, url, family } of fonts) {
      const path = fileOfUrl(url);
      const data = await readFile(path);
      const { meta } = await getAssetData({
        type: "font",
        size: data.byteLength,
        data,
        // the upload's name (getUniqueFilename)
        name: basename(path).replace(
          /\.woff2$/,
          "_0123456789abcdefghijk.woff2"
        ),
      });
      expect(meta, name).toEqual(expect.objectContaining({ family }));
    }
  });
});
