// OrganizeOS fork: the preview tool's command line and its thumbnail
// (scripts/preview-site-template.mjs, which imports this module). Plain
// JavaScript, as stub-api.mjs is, so the script runs it with node alone;
// preview-arguments.node.test.ts holds it.

import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";

// the pictures of a template and its pages, in a module of its own
// (thumbnail.mjs)
export { PAGE_PICTURE, THUMBNAIL, pagePictureFile } from "./thumbnail.mjs";

export const usage =
  "Usage: corepack pnpm preview:template <template-id> [--palette <file>] [--no-events] [--thumbnail] [--pages], or --starter <page-template-id> [--look <template-id>] [--no-events] [--thumbnail]";

/**
 * A template id, a page template's, and a palette's run name: lowercase
 * letters, digits and hyphens, so each names one folder under previews/.
 */
const namePattern = /^[a-z0-9-]+$/;

/**
 * @typedef {{
 *   templateId: string | undefined,
 *   starterId?: string,
 *   lookId?: string,
 *   paletteFile: string | undefined,
 *   paletteName: string,
 *   runName: string,
 *   events: "sample" | "none",
 *   thumbnail: boolean,
 *   pages: boolean,
 * }} PreviewArguments
 */

/**
 * The tool's arguments: the template's id; `--palette <file>`, a JSON file
 * of the six canonical values, read from `cwd` when relative, whose name
 * without `.json` names the run ("default" without one); `--no-events`, the
 * blocks' empty state, which adds ".no-events" to the run's name; and
 * `--thumbnail`, which writes the template's thumbnail in place of a run
 * and so takes neither of the other two; and `--pages`, which writes a
 * picture of every page but Home in place of a run, alone or with
 * `--thumbnail`, and likewise takes neither. The run's folder is removed before
 * a run writes it, so a run name is held to `namePattern`: a file named
 * `..json` would name the template's whole folder, and `...json` previews/
 * itself.
 *
 * Or a page template: `--starter <id>` and no template id, drawn on a blank
 * site (the run "neutral") or, with `--look <template-id>`, on that site
 * template applied (the run named after it); `--no-events` as above, and
 * `--thumbnail`, which writes the page template's picture from the blank site
 * and the sample events, so takes neither. Its run folder is under
 * previews/starter-pages/. Throws with the usage, or with what is wrong.
 *
 * @param {string[]} args
 * @param {string} cwd
 * @returns {PreviewArguments}
 */
export const parsePreviewArguments = (args, cwd) => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      palette: { type: "string" },
      starter: { type: "string" },
      look: { type: "string" },
      "no-events": { type: "boolean", default: false },
      thumbnail: { type: "boolean", default: false },
      pages: { type: "boolean", default: false },
    },
  });
  const events = values["no-events"] ? "none" : "sample";
  if (values.starter !== undefined) {
    return parseStarterArguments(values, positionals, events);
  }
  if (values.look !== undefined) {
    throw new Error(
      `--look takes --starter: a template is its own look. ${usage}`
    );
  }
  if (positionals.length !== 1 || namePattern.test(positionals[0]) === false) {
    throw new Error(usage);
  }
  const paletteFile =
    values.palette === undefined ? undefined : resolve(cwd, values.palette);
  const paletteName =
    paletteFile === undefined ? "default" : basename(paletteFile, ".json");
  if (namePattern.test(paletteName) === false) {
    throw new Error(
      `The palette file's name without .json names the run's folder, so it is lowercase letters, digits and hyphens: not "${paletteName}"`
    );
  }
  if (values.thumbnail && (paletteFile !== undefined || events === "none")) {
    throw new Error(
      `--thumbnail takes the template's own palette and the sample events, so neither --palette nor --no-events. ${usage}`
    );
  }
  if (values.pages && (paletteFile !== undefined || events === "none")) {
    throw new Error(
      `--pages takes the template's own palette and the sample events, so neither --palette nor --no-events. ${usage}`
    );
  }
  return {
    templateId: positionals[0],
    paletteFile,
    paletteName,
    runName: events === "none" ? `${paletteName}.no-events` : paletteName,
    events,
    thumbnail: values.thumbnail ?? false,
    pages: values.pages ?? false,
  };
};

/**
 * A page template's arguments (`--starter`), from parsePreviewArguments.
 *
 * @param {{ starter?: string, look?: string, palette?: string, thumbnail?: boolean, pages?: boolean }} values
 * @param {string[]} positionals
 * @param {"sample" | "none"} events
 * @returns {PreviewArguments}
 */
const parseStarterArguments = (values, positionals, events) => {
  const starterId = values.starter ?? "";
  if (positionals.length !== 0) {
    throw new Error(
      `--starter draws a page template, so it takes no template id. ${usage}`
    );
  }
  if (namePattern.test(starterId) === false) {
    throw new Error(
      `--starter takes a page template's id, lowercase letters, digits and hyphens: not "${starterId}"`
    );
  }
  if (values.look !== undefined && namePattern.test(values.look) === false) {
    throw new Error(
      `--look takes a site template's id, lowercase letters, digits and hyphens: not "${values.look}"`
    );
  }
  if (values.palette !== undefined) {
    throw new Error(
      `--palette is a template's; --starter takes a look instead (--look). ${usage}`
    );
  }
  if (values.pages) {
    throw new Error(
      `--pages draws a template's pages; --starter's picture is --thumbnail. ${usage}`
    );
  }
  if (values.thumbnail && (values.look !== undefined || events === "none")) {
    throw new Error(
      `--thumbnail draws a page template on the blank site with the sample events, so neither --look nor --no-events. ${usage}`
    );
  }
  const lookName = values.look ?? "neutral";
  return {
    templateId: undefined,
    starterId,
    lookId: values.look,
    paletteFile: undefined,
    paletteName: "default",
    runName: events === "none" ? `${lookName}.no-events` : lookName,
    events,
    thumbnail: values.thumbnail ?? false,
    pages: false,
  };
};

/**
 * A JPEG's width and height, from its start-of-frame segment, or undefined
 * when the bytes are not a JPEG that has one.
 *
 * @param {Uint8Array} bytes
 * @returns {{ width: number, height: number } | undefined}
 */
export const readJpegSize = (bytes) => {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return;
  }
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    // the start-of-frame markers: C0 to CF but for C4, C8 and CC
    const isFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isFrame && offset + 9 <= bytes.length) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }
    offset += 2 + length;
  }
  return;
};
