import { describe, expect, test } from "vitest";
import {
  THUMBNAIL,
  parsePreviewArguments,
  readJpegSize,
} from "./preview-arguments.mjs";

// The preview tool's command line (scripts/preview-site-template.mjs): which
// template, which palette and events, and the run's folder under previews/.

const cwd = "/work";

describe("parsePreviewArguments", () => {
  test("a template id alone: its own palette, the sample events", () => {
    expect(parsePreviewArguments(["field-journal"], cwd)).toEqual({
      templateId: "field-journal",
      paletteFile: undefined,
      paletteName: "default",
      runName: "default",
      events: "sample",
      thumbnail: false,
    });
  });

  test("a palette file, read from the caller's folder, names the run", () => {
    expect(
      parsePreviewArguments(
        ["porch-light", "--palette", "palettes/night.json", "--no-events"],
        cwd
      )
    ).toEqual({
      templateId: "porch-light",
      paletteFile: "/work/palettes/night.json",
      paletteName: "night",
      runName: "night.no-events",
      events: "none",
      thumbnail: false,
    });
  });

  test.each(["field journal", "Field-Journal", "../spike", ""])(
    'the template id "%s" is refused',
    (id) => {
      expect(() => parsePreviewArguments([id], cwd)).toThrow(/Usage/);
    }
  );

  // The run's folder is removed before a run writes to it: "..json" names
  // the run ".", the template's whole folder, and "...json" names it "..",
  // previews/ itself.
  test.each([
    "..json",
    "...json",
    "../..json",
    ".json",
    "Night press.json",
    "night_2.json",
  ])("a palette file named %s is refused", (file) => {
    expect(() =>
      parsePreviewArguments(["spike", "--palette", file], cwd)
    ).toThrow(/palette/);
  });

  test("--thumbnail takes the template's own palette and the sample events", () => {
    expect(parsePreviewArguments(["spike", "--thumbnail"], cwd)).toEqual({
      templateId: "spike",
      paletteFile: undefined,
      paletteName: "default",
      runName: "default",
      events: "sample",
      thumbnail: true,
    });
    expect(() =>
      parsePreviewArguments(
        ["spike", "--thumbnail", "--palette", "night.json"],
        cwd
      )
    ).toThrow(/--thumbnail/);
    expect(() =>
      parsePreviewArguments(["spike", "--thumbnail", "--no-events"], cwd)
    ).toThrow(/--thumbnail/);
  });

  test("an option it does not know is refused", () => {
    expect(() => parsePreviewArguments(["spike", "--wide"], cwd)).toThrow();
  });
});

describe("the thumbnail", () => {
  test("is the chooser's 16:10 frame of Home at 1440 wide, 1600 by 1000", () => {
    expect(THUMBNAIL.width / THUMBNAIL.height).toBe(16 / 10);
    expect(THUMBNAIL.viewport.width / THUMBNAIL.viewport.height).toBe(16 / 10);
    expect(THUMBNAIL.viewport.width).toBe(1440);
    expect(THUMBNAIL.viewport.width * THUMBNAIL.deviceScaleFactor).toBe(1600);
    expect(THUMBNAIL.viewport.height * THUMBNAIL.deviceScaleFactor).toBe(1000);
    expect(THUMBNAIL.file).toBe("thumbnail.jpg");
    expect(THUMBNAIL.maxBytes).toBe(400_000);
  });

  // A JPEG's size is in its start-of-frame segment, after any others.
  test("readJpegSize reads a JPEG's width and height from its frame header", () => {
    const jpeg = new Uint8Array([
      // start of image
      0xff, 0xd8,
      // an APP0 segment of 6 bytes, length included
      0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46,
      // start of frame: length 11, precision 8, height 1000, width 1600
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x03, 0xe8, 0x06, 0x40, 0x01, 0x01, 0x11,
      0x00,
    ]);
    expect(readJpegSize(jpeg)).toEqual({ width: 1600, height: 1000 });
    expect(readJpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(
      undefined
    );
  });
});
