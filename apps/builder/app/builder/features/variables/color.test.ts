import { describe, expect, test } from "vitest";
import { parseColor } from "@webstudio-is/css-data";
import {
  composite,
  contrastRatio,
  interpolate,
  luminance,
  quantize,
  toRgba,
  type Rgba,
} from "./color";

const black: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const white: Rgba = { r: 1, g: 1, b: 1, a: 1 };
const red: Rgba = { r: 1, g: 0, b: 0, a: 1 };
const blue: Rgba = { r: 0, g: 0, b: 1, a: 1 };

const expectInGamut = (c: Rgba | undefined) => {
  expect(c).toBeDefined();
  for (const channel of [c!.r, c!.g, c!.b, c!.a]) {
    expect(channel).toBeGreaterThanOrEqual(0);
    expect(channel).toBeLessThanOrEqual(1);
  }
};

describe("contrastRatio", () => {
  test("black on white is 21:1", () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5);
  });

  test("#767676 on white is 4.54:1", () => {
    const gray = toRgba(parseColor("#767676")!)!;
    expect(contrastRatio(gray, white).toFixed(2)).toBe("4.54");
  });

  test("a color against itself is 1:1", () => {
    const teal = toRgba(parseColor("#1597b0")!)!;
    expect(contrastRatio(teal, teal)).toBe(1);
  });
});

describe("toRgba", () => {
  test("reads an sRGB color value", () => {
    expect(
      toRgba({
        type: "color",
        colorSpace: "srgb",
        components: [1, 0.5, 0],
        alpha: 0.25,
      })
    ).toEqual({ r: 1, g: 0.5, b: 0, a: 0.25 });
  });

  test("reads a hex color value", () => {
    expect(
      toRgba({
        type: "color",
        colorSpace: "hex",
        components: [1, 0, 0],
        alpha: 1,
      })
    ).toEqual(red);
  });

  test("reads a legacy rgb value with 0..255 channels", () => {
    expect(toRgba({ type: "rgb", r: 255, g: 0, b: 51, alpha: 0.5 })).toEqual({
      r: 1,
      g: 0,
      b: 0.2,
      a: 0.5,
    });
  });

  test("reads a named color keyword", () => {
    expect(toRgba({ type: "keyword", value: "white" })).toEqual(white);
    const teal = toRgba({ type: "keyword", value: "teal" })!;
    expect(quantize(teal)).toBe("0,128,128,255");
  });

  test("reads transparent as a keyword and as an alpha-0 color", () => {
    expect(toRgba({ type: "keyword", value: "transparent" })?.a).toBe(0);
    expect(
      toRgba({
        type: "color",
        colorSpace: "srgb",
        components: [0, 0, 0],
        alpha: 0,
      })?.a
    ).toBe(0);
  });

  test("reads an unparsed string parseColor reads", () => {
    expect(toRgba({ type: "unparsed", value: " teal " })).toEqual(
      toRgba({ type: "keyword", value: "teal" })
    );
    expect(
      quantize(toRgba({ type: "unparsed", value: "rgb(21 151 176 / 0.5)" })!)
    ).toBe("21,151,176,128");
  });

  test("currentcolor resolves to the currentColor argument", () => {
    expect(toRgba({ type: "keyword", value: "currentcolor" }, red)).toEqual(
      red
    );
    expect(toRgba({ type: "keyword", value: "currentColor" }, blue)).toEqual(
      blue
    );
    expect(toRgba({ type: "unparsed", value: "currentcolor" }, red)).toEqual(
      red
    );
  });

  test("currentcolor without the currentColor argument is unreadable", () => {
    expect(toRgba({ type: "keyword", value: "currentcolor" })).toBeUndefined();
    expect(toRgba({ type: "unparsed", value: "currentColor" })).toBeUndefined();
  });

  test("clips an out-of-gamut oklch color to sRGB", () => {
    const value = parseColor("oklch(0.9 0.4 150)")!;
    expect(value.colorSpace).toBe("oklch");
    const c = toRgba(value);
    expectInGamut(c);
    expect(c!.g).toBeGreaterThan(c!.r);
    expect(c!.g).toBeGreaterThan(c!.b);
  });

  test("clips an out-of-gamut display-p3 color to sRGB", () => {
    const value = parseColor("color(display-p3 0 1 0)")!;
    expect(value.colorSpace).toBe("p3");
    const c = toRgba(value);
    expectInGamut(c);
    expect(c!.g).toBeGreaterThan(0.9);
    expect(c!.r).toBeLessThan(0.3);
  });

  test("converts an in-gamut hsl color", () => {
    const c = toRgba(parseColor("hsl(0 100% 50%)")!)!;
    expect(quantize(c)).toBe("255,0,0,255");
  });

  test("anything it cannot read is undefined", () => {
    expect(toRgba({ type: "var", value: "brand" })).toBeUndefined();
    expect(
      toRgba({ type: "unparsed", value: "color-mix(in srgb, red, blue)" })
    ).toBeUndefined();
    expect(toRgba({ type: "keyword", value: "inherit" })).toBeUndefined();
    expect(toRgba({ type: "unit", unit: "px", value: 1 })).toBeUndefined();
    expect(
      toRgba({
        type: "color",
        colorSpace: "srgb",
        components: [0, 0, 0],
        alpha: { type: "var", value: "opacity" },
      })
    ).toBeUndefined();
  });
});

describe("composite", () => {
  test("50% black over white is mid gray", () => {
    expect(composite({ ...black, a: 0.5 }, white)).toEqual({
      r: 0.5,
      g: 0.5,
      b: 0.5,
      a: 1,
    });
  });

  test("an opaque top hides the bottom, a transparent one shows it", () => {
    expect(composite(red, white)).toEqual(red);
    expect(composite({ ...red, a: 0 }, blue)).toEqual(blue);
  });

  test("two translucent layers stay translucent", () => {
    const c = composite({ ...red, a: 0.5 }, { ...blue, a: 0.5 });
    expect(c.a).toBeCloseTo(0.75, 10);
    expect(c.r).toBeCloseTo(2 / 3, 10);
    expect(c.b).toBeCloseTo(1 / 3, 10);
  });
});

describe("interpolate", () => {
  test("the red to blue midpoint is darker than both ends", () => {
    const mid = interpolate(red, blue, 0.5);
    expect(mid).toEqual({ r: 0.5, g: 0, b: 0.5, a: 1 });
    expect(luminance(mid)).toBeCloseTo(0.061, 3);
    expect(luminance(mid)).toBeLessThan(luminance(red));
    expect(luminance(mid)).toBeLessThan(luminance(blue));
  });

  test("premultiplied alpha keeps the hue when fading to transparent", () => {
    const mid = interpolate(red, { r: 0, g: 0, b: 0, a: 0 }, 0.5);
    expect(mid).toEqual({ r: 1, g: 0, b: 0, a: 0.5 });
  });

  test("the ends are the stops", () => {
    expect(interpolate(red, blue, 0)).toEqual(red);
    expect(interpolate(red, blue, 1)).toEqual(blue);
  });
});

describe("quantize", () => {
  test("is an 8-bit key with alpha", () => {
    expect(quantize(white)).toBe("255,255,255,255");
    expect(quantize({ r: 0.5, g: 0, b: 1, a: 0.5 })).toBe("128,0,255,128");
    expect(quantize({ r: 0.2005, g: 0, b: 1, a: 0.5 })).toBe(
      quantize({ r: 0.1995, g: 0, b: 1, a: 0.5 })
    );
  });
});
