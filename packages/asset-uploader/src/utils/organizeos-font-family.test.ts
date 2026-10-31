import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename } from "node:path";
import { describe, expect, test } from "vitest";
import { getAssetData } from "./get-asset-data";
import { dropInstanceNames } from "./organizeos-font-family";

describe("dropInstanceNames", () => {
  test("keeps a family that names no instance", () => {
    expect(
      dropInstanceNames({
        family: "IBM Plex Sans",
        subfamily: "Regular",
        weightClass: 400,
      })
    ).toEqual({ family: "IBM Plex Sans" });
  });

  test("keeps a weight word that is not the declared weight", () => {
    expect(
      dropInstanceNames({
        family: "Archivo Black",
        subfamily: "Regular",
        weightClass: 400,
      })
    ).toEqual({ family: "Archivo Black" });
  });

  test("drops the declared weight, and gives it when the subfamily names none", () => {
    expect(
      dropInstanceNames({
        family: "Barlow Medium",
        subfamily: "Regular",
        weightClass: 500,
      })
    ).toEqual({ family: "Barlow", weight: 500 });
    expect(
      dropInstanceNames({
        family: "Public Sans Thin",
        subfamily: "Italic",
        weightClass: 100,
      })
    ).toEqual({ family: "Public Sans", weight: 100 });
  });

  test("a weight the subfamily names stays the subfamily's", () => {
    expect(
      dropInstanceNames({
        family: "Sample Medium",
        subfamily: "Bold Italic",
        weightClass: 500,
      })
    ).toEqual({ family: "Sample" });
  });

  test("reads a weight of one word or two", () => {
    for (const family of [
      "Source Sans 3 ExtraLight",
      "Source Sans 3 Extra Light",
    ]) {
      expect(
        dropInstanceNames({ family, subfamily: "Regular", weightClass: 200 }),
        family
      ).toEqual({ family: "Source Sans 3", weight: 200 });
    }
  });

  test("drops an optical size", () => {
    expect(
      dropInstanceNames({
        family: "Newsreader 16pt 16pt",
        subfamily: "Regular",
        weightClass: 400,
      })
    ).toEqual({ family: "Newsreader" });
    expect(
      dropInstanceNames({
        family: "Bricolage Grotesque 96pt ExtraBold",
        subfamily: "Regular",
        weightClass: 800,
      })
    ).toEqual({ family: "Bricolage Grotesque", weight: 800 });
  });

  test("never leaves a family empty", () => {
    expect(
      dropInstanceNames({ family: "Black", subfamily: "", weightClass: 900 })
    ).toEqual({ family: "Black" });
    expect(
      dropInstanceNames({ family: "12pt", subfamily: "", weightClass: 400 })
    ).toEqual({ family: "12pt" });
  });

  test("without a declared weight, only an optical size goes", () => {
    expect(
      dropInstanceNames({
        family: "Sample 9pt Bold",
        subfamily: "Regular",
        weightClass: undefined,
      })
    ).toEqual({ family: "Sample Bold" });
  });
});

// The font files the approved website-template direction board names
// (OrganizeOS docs/superpowers/specs/2026-10-31-website-template-directions.md,
// section 4), with the family and weights an upload of each derives. The
// files come from @fontsource packages, devDependencies of the blocks
// package (@organizeos/site-components), which is where they resolve from.
const requireFromBlocks = createRequire(
  new URL("../../../sdk-components-organizeos/package.json", import.meta.url)
);

const BOARD_FONT_FILES: Array<{
  file: string;
  family: string;
  /** `[min, max]` of a variable file's `wght` axis, or a static file's weight. */
  weight: [number, number] | number;
}> = [
  {
    file: "@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2",
    family: "Newsreader",
    weight: [200, 800],
  },
  {
    file: "@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2",
    family: "Source Sans 3",
    weight: [200, 900],
  },
  {
    file: "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
    family: "Bricolage Grotesque",
    weight: [200, 800],
  },
  {
    file: "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2",
    family: "Atkinson Hyperlegible",
    weight: 400,
  },
  {
    file: "@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2",
    family: "Atkinson Hyperlegible",
    weight: 700,
  },
  {
    file: "@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2",
    family: "Barlow Condensed",
    weight: 700,
  },
  {
    file: "@fontsource/barlow/files/barlow-latin-400-normal.woff2",
    family: "Barlow",
    weight: 400,
  },
  {
    file: "@fontsource/barlow/files/barlow-latin-500-normal.woff2",
    family: "Barlow",
    weight: 500,
  },
  {
    file: "@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2",
    family: "Archivo Black",
    weight: 400,
  },
  {
    file: "@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2",
    family: "Public Sans",
    weight: [100, 900],
  },
  {
    file: "@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2",
    family: "Instrument Serif",
    weight: 400,
  },
  {
    file: "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2",
    family: "IBM Plex Sans",
    weight: [100, 700],
  },
];

describe("the board's font files", () => {
  test.each(BOARD_FONT_FILES)(
    "$file derives $family",
    async ({ file, family, weight }) => {
      const path = requireFromBlocks.resolve(file);
      const data = await readFile(path);
      const { format, meta } = await getAssetData({
        type: "font",
        size: data.byteLength,
        data,
        // the upload's name (getUniqueFilename)
        name: basename(path).replace(
          /\.woff2$/,
          "_0123456789abcdefghijk.woff2"
        ),
      });
      expect(format).toBe("woff2");
      expect(meta).toEqual(
        Array.isArray(weight)
          ? {
              family,
              variationAxes: expect.objectContaining({
                wght: expect.objectContaining({
                  min: weight[0],
                  max: weight[1],
                }),
              }),
            }
          : { family, style: "normal", weight }
      );
    }
  );
});
