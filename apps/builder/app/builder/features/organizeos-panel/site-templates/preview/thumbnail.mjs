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
