import { color, type StyleValue } from "@webstudio-is/css-engine";
import { parseColor } from "@webstudio-is/css-data";

/**
 * Color math for the Section background area: reading Webstudio's color
 * values as sRGB, compositing them, and the WCAG 2.x contrast ratio.
 *
 * Every function here is pure. Colors are sRGB with gamma-encoded channels
 * and straight (not premultiplied) alpha, each in 0..1.
 */
export type Rgba = { r: number; g: number; b: number; a: number };

const clamp01 = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

const fromSrgb = (r: number, g: number, b: number, a: number): Rgba => ({
  r: clamp01(r),
  g: clamp01(g),
  b: clamp01(b),
  a: clamp01(a),
});

const isCurrentColor = (value: string) =>
  value.trim().toLowerCase() === "currentcolor";

/**
 * Reads a style value as an sRGB color, or undefined when it is not one this
 * module can read (a variable, an alpha bound to a variable, `color-mix()`,
 * relative color syntax, a system color). The caller reports "Can't check".
 *
 * - `{ type: "color" }` in any color space; spaces other than sRGB are
 *   converted and gamut-mapped to sRGB through colorjs.io;
 * - legacy `{ type: "rgb" }` with 0..255 channels;
 * - `keyword` and `unparsed` strings that upstream's `parseColor` reads
 *   (named colors, `transparent`, hex and color functions);
 * - `currentcolor` as `currentColor`, the instance's resolved `color`,
 *   checked before `parseColor`, which does not read it as a color.
 */
export const toRgba = (
  value: StyleValue,
  currentColor?: Rgba
): Rgba | undefined => {
  if (value.type === "color") {
    if (typeof value.alpha !== "number") {
      return;
    }
    const [c0, c1, c2] = value.components;
    if (value.colorSpace === "hex" || value.colorSpace === "srgb") {
      return fromSrgb(c0, c1, c2, value.alpha);
    }
    try {
      const space = color.ColorSpace.get(value.colorSpace);
      const srgb = color.to(
        { space, coords: [c0, c1, c2], alpha: value.alpha },
        "srgb",
        { inGamut: true }
      );
      const [r, g, b] = srgb.coords;
      return fromSrgb(r ?? 0, g ?? 0, b ?? 0, value.alpha);
    } catch {
      return;
    }
  }
  if (value.type === "rgb") {
    return fromSrgb(value.r / 255, value.g / 255, value.b / 255, value.alpha);
  }
  if (value.type === "keyword" || value.type === "unparsed") {
    if (isCurrentColor(value.value)) {
      return currentColor;
    }
    const parsed = parseColor(value.value.trim());
    return parsed === undefined ? undefined : toRgba(parsed);
  }
};

/** `top` painted over `bottom` (source-over), computed premultiplied. */
export const composite = (top: Rgba, bottom: Rgba): Rgba => {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const channel = (t: number, b: number) =>
    (t * top.a + b * bottom.a * (1 - top.a)) / a;
  return {
    r: channel(top.r, bottom.r),
    g: channel(top.g, bottom.g),
    b: channel(top.b, bottom.b),
    a,
  };
};

const linearize = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** WCAG 2.x relative luminance. Alpha is ignored: pass an opaque color. */
export const luminance = (c: Rgba): number =>
  0.2126 * linearize(c.r) + 0.7152 * linearize(c.g) + 0.0722 * linearize(c.b);

/** WCAG 2.x contrast ratio, 1 to 21, of two opaque colors. */
export const contrastRatio = (a: Rgba, b: Rgba): number => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const to8bit = (channel: number) => Math.round(clamp01(channel) * 255);

/** An 8-bit-per-channel key, so near-identical colors deduplicate. */
export const quantize = (c: Rgba): string =>
  `${to8bit(c.r)},${to8bit(c.g)},${to8bit(c.b)},${to8bit(c.a)}`;

/**
 * The color at `t` (0..1) between `a` and `b`, interpolated in gamma-encoded
 * sRGB with premultiplied alpha, the CSS default for gradients.
 */
export const interpolate = (a: Rgba, b: Rgba, t: number): Rgba => {
  const alpha = a.a * (1 - t) + b.a * t;
  if (alpha === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const channel = (ca: number, cb: number) =>
    (ca * a.a * (1 - t) + cb * b.a * t) / alpha;
  return {
    r: channel(a.r, b.r),
    g: channel(a.g, b.g),
    b: channel(a.b, b.b),
    a: alpha,
  };
};
