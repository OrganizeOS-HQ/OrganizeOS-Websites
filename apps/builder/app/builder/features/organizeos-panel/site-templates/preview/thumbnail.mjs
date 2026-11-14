// OrganizeOS fork: the preview tool's thumbnail, in a module that imports
// nothing, so a browser suite (apply-site-template.test.tsx) can read it.
// preview-arguments.mjs re-exports it for scripts/preview-site-template.mjs.

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
 * A template page's picture, which --pages writes into the template's
 * images/ folder for every page but Home (whose picture is the thumbnail),
 * for the Templates screen's page view: the top of the page at 1440 CSS
 * pixels wide in the same 16:10 frame, at 1200 by 750 pixels (5/6 of a
 * device pixel a CSS pixel), a JPEG under 150 KB at the highest quality of
 * `qualities` that fits.
 */
export const PAGE_PICTURE = {
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 5 / 6,
  width: 1200,
  height: 750,
  maxBytes: 150_000,
  qualities: THUMBNAIL.qualities,
};

/**
 * The file of a page's picture in the template's images/ folder, named by
 * the page's key, which is held to lowercase letters, digits and hyphens
 * since it names a file.
 *
 * @param {string} key
 * @returns {string}
 */
export const pagePictureFile = (key) => {
  if (/^[a-z0-9-]+$/.test(key) === false) {
    throw new Error(`A page key names its picture's file: not "${key}"`);
  }
  return `page-${key}.jpg`;
};
