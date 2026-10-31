// OrganizeOS fork: the preview tool's command line and its thumbnail
// (scripts/preview-site-template.mjs, which imports this module). Plain
// JavaScript, as stub-api.mjs is, so the script runs it with node alone;
// preview-arguments.test.ts holds it.

import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";

export const usage =
  "Usage: corepack pnpm preview:template <template-id> [--palette <file>] [--no-events] [--thumbnail]";

/**
 * A template id, and a palette's run name: lowercase letters, digits and
 * hyphens, so each names one folder under previews/.
 */
const namePattern = /^[a-z0-9-]+$/;

/**
 * The chooser's picture of a template, which --thumbnail writes into the
 * template's images/ folder: the top of Home at 1440 CSS pixels wide,
 * cropped to the chooser's 16:10 frame, at 1600 by 1000 pixels (the
 * 1440-wide layout drawn at 10/9 device pixels a CSS pixel), a JPEG under
 * 400 KB at the highest quality of `qualities` that fits.
 */
export const THUMBNAIL = {
  file: "thumbnail.jpg",
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 10 / 9,
  width: 1600,
  height: 1000,
  maxBytes: 400_000,
  qualities: [90, 85, 80, 75, 70, 65, 60, 55, 50],
};

/**
 * @typedef {{
 *   templateId: string,
 *   paletteFile: string | undefined,
 *   paletteName: string,
 *   runName: string,
 *   events: "sample" | "none",
 *   thumbnail: boolean,
 * }} PreviewArguments
 */

/**
 * The tool's arguments: the template's id; `--palette <file>`, a JSON file
 * of the six canonical values, read from `cwd` when relative, whose name
 * without `.json` names the run ("default" without one); `--no-events`, the
 * blocks' empty state, which adds ".no-events" to the run's name; and
 * `--thumbnail`, which writes the template's thumbnail in place of a run
 * and so takes neither of the other two. The run's folder is removed before
 * a run writes it, so a run name is held to `namePattern`: a file named
 * `..json` would name the template's whole folder, and `...json` previews/
 * itself. Throws with the usage, or with what is wrong.
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
      "no-events": { type: "boolean", default: false },
      thumbnail: { type: "boolean", default: false },
    },
  });
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
  const events = values["no-events"] ? "none" : "sample";
  if (values.thumbnail && (paletteFile !== undefined || events === "none")) {
    throw new Error(
      `--thumbnail takes the template's own palette and the sample events, so neither --palette nor --no-events. ${usage}`
    );
  }
  return {
    templateId: positionals[0],
    paletteFile,
    paletteName,
    runName: events === "none" ? `${paletteName}.no-events` : paletteName,
    events,
    thumbnail: values.thumbnail ?? false,
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
