/**
 * Every font file the approved direction board names (OrganizeOS
 * docs/superpowers/specs/2026-10-31-website-template-directions.md, section
 * 4), by its path in the `@fontsource` package that bundles it (a
 * devDependency of `@organizeos/site-components`), with what the builder
 * derives from it on upload (`getAssetData`): the family a template's `fonts`
 * entry records and its font variable names first, and the weights the file
 * covers. A variable package's file is its default, `wght` axis only; a
 * static family is the weights the board names.
 *
 * Several families come out with a weight or optical size in their name:
 * the `@fontsource` files lack the typographic family name (name ID 16), and
 * the builder reads the legacy one (name ID 1). Recorded as derived, since
 * that is the name a publish keeps a font by.
 */
export const BOARD_FONT_FILES: Array<{
  file: string;
  family: string;
  /** `[min, max]` of a variable file's `wght` axis, or a static file's weight. */
  weight: [number, number] | number;
}> = [
  // Field Journal
  {
    file: "@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2",
    family: "Newsreader 16pt 16pt",
    weight: [200, 800],
  },
  {
    file: "@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2",
    family: "Source Sans 3",
    weight: [200, 900],
  },
  // Porch Light
  {
    file: "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
    family: "Bricolage Grotesque 96pt ExtraBold",
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
  // Workwear: Barlow's 500 is a family of its own, at 400
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
    family: "Barlow Medium",
    weight: 400,
  },
  // Marigold Marquee
  {
    file: "@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2",
    family: "Archivo Black",
    weight: 400,
  },
  {
    file: "@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2",
    family: "Public Sans Thin",
    weight: [100, 900],
  },
  // Riso Broadside
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
