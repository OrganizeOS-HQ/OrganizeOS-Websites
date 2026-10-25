import type {
  CssProperty,
  LayerValueItem,
  StyleValue,
} from "@webstudio-is/css-engine";
import { parseCssValue } from "@webstudio-is/css-data";
import { composite, contrastRatio, luminance, type Rgba } from "./color";

/**
 * Section background presets: recipes from a three-color palette to ordinary
 * style declarations, which `apply-preset.ts` writes to the selected element's
 * local style source. A preset keeps no link to the element afterwards; the
 * designer edits the layers in the style panel like any others.
 *
 * Writing rules (spec 3.2), kept in `paint` below:
 * - a stop or color with alpha below 1, or a tint (a color mixed with
 *   another), is a literal `rgb(r g b / a)` computed from the palette at apply
 *   time, because upstream's parser reads no alpha on a variable color
 *   (`color-mix()` stays unparsed) and its gradient editor would drop the stop;
 * - an opaque, untinted palette color that came from a Global Root variable
 *   is `var(--name)`.
 *
 * Every preset writes `background-color` and all nine layer lists upstream's
 * Backgrounds section reads (`repeatedProperties` in
 * `style-panel/sections/backgrounds/background-thumbnail.tsx`), one entry
 * per layer, so no list cascades in from a token. Never the
 * `background-position` shorthand, which that section does not read.
 */

export type PaletteColor = {
  rgba: Rgba;
  /**
   * The Global Root variable the color came from, without the leading dashes,
   * as Webstudio's VarValue stores it (`{ type: "var", value: "brand" }`
   * renders `var(--brand)`).
   */
  variable?: string;
};

export type Palette = {
  /** the page surface */
  base: PaletteColor;
  accent1: PaletteColor;
  accent2: PaletteColor;
  /**
   * The darkest text color in the palette, the reference the light variants
   * (and the light scrim) are tuned for. `#111111` when absent.
   */
  text?: PaletteColor;
};

const hex = (value: string): Rgba => {
  const n = Number.parseInt(value.slice(1), 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
    a: 1,
  };
};

const black: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const white: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/** The reference text color for light variants when the palette has none. */
export const defaultDarkText: Rgba = hex("#111111");

/** Used when Global Root defines no color variables: written as literals. */
export const builtInPalette: Palette = {
  base: { rgba: white },
  accent1: { rgba: hex("#1597B0") },
  accent2: { rgba: hex("#3FC9E0") },
  text: { rgba: defaultDarkText },
};

export type PresetId =
  | "bloom-light"
  | "bloom-strong"
  | "bloom-dark"
  | "wash-light"
  | "wash-dark"
  | "tint-light"
  | "tint-dark"
  | "image-scrim-light"
  | "image-scrim-dark";

export type PresetFamily = "bloom" | "wash" | "tint" | "image-scrim";

export type PresetStyles = Array<{ property: CssProperty; value: StyleValue }>;

export type PresetOptions = {
  /** the image layer's asset, for the image-scrim presets */
  imageAssetId?: string;
};

export type Preset = {
  id: PresetId;
  family: PresetFamily;
  label: string;
  /** light presets are tuned for dark text, dark presets for white text */
  tone: "light" | "dark";
  build: (palette: Palette, options?: PresetOptions) => PresetStyles;
};

/** The text color a preset is tuned for: what the scrim alpha targets. */
export const getReferenceTextColor = (
  preset: Pick<Preset, "tone">,
  palette: Palette
): Rgba =>
  preset.tone === "dark" ? white : (palette.text?.rgba ?? defaultDarkText);

/**
 * The nine layer lists upstream's Backgrounds section reads and writes. The
 * apply-preset test pins this list to upstream's `repeatedProperties`.
 */
export const layerProperties = [
  "background-image",
  "background-position-x",
  "background-position-y",
  "background-size",
  "background-repeat",
  "background-attachment",
  "background-clip",
  "background-origin",
  "background-blend-mode",
] as const satisfies readonly CssProperty[];

const to8bit = (channel: number) =>
  Math.round(Math.min(1, Math.max(0, channel)) * 255);

const roundAlpha = (alpha: number) => Math.round(alpha * 1000) / 1000;

/**
 * The one place a palette color becomes CSS text. `alpha` multiplies the
 * color's own alpha; `tint` paints the color at `tint.amount` over
 * `tint.over` first. Only an opaque, untinted color with a variable is
 * written as `var(--name)`.
 */
const paint = (
  color: PaletteColor,
  {
    alpha = 1,
    tint,
  }: { alpha?: number; tint?: { over: Rgba; amount: number } } = {}
): string => {
  const rgba =
    tint === undefined
      ? color.rgba
      : composite({ ...color.rgba, a: color.rgba.a * tint.amount }, tint.over);
  const finalAlpha = roundAlpha(rgba.a * alpha);
  if (color.variable !== undefined && tint === undefined && finalAlpha === 1) {
    return `var(--${color.variable})`;
  }
  const channels = `${to8bit(rgba.r)} ${to8bit(rgba.g)} ${to8bit(rgba.b)}`;
  return finalAlpha === 1
    ? `rgb(${channels})`
    : `rgb(${channels} / ${finalAlpha})`;
};

/** A dark surface for the dark variants: accent 1 deeply shaded. */
const darkSurface = (palette: Palette): PaletteColor => ({
  rgba: composite({ ...palette.accent1.rgba, a: 0.22 }, black),
});

type Layer =
  | { type: "gradient"; css: string }
  | { type: "image"; assetId: string };

/** Per-layer settings for the recipe's opinionated lists. */
const layerSettings = (layer: Layer) =>
  layer.type === "image"
    ? { x: "50%", y: "50%", size: "cover", repeat: "no-repeat" }
    : { x: "0%", y: "0%", size: "auto", repeat: "no-repeat" };

const parse = (property: CssProperty, css: string): StyleValue => {
  const value = parseCssValue(property, css);
  if (value.type === "invalid") {
    // a recipe bug, caught by the preset tests
    throw new Error(`Preset wrote an invalid ${property}: ${css}`);
  }
  return value;
};

/**
 * Background color plus the nine layer lists. With no layers, one `none`
 * image layer, as upstream's Backgrounds section adds a new layer, so the
 * lists still replace a token's.
 */
const writeBackground = (
  backgroundColor: string,
  layers: Layer[]
): PresetStyles => {
  // "none" is not a gradient, but it is written the same way
  const items: Layer[] =
    layers.length === 0 ? [{ type: "gradient", css: "none" }] : layers;
  const image: LayerValueItem[] = [];
  const gradients = items.flatMap((layer) =>
    layer.type === "gradient" ? [layer.css] : []
  );
  const parsedGradients = parse("background-image", gradients.join(", "));
  if (parsedGradients.type !== "layers") {
    throw new Error("Preset wrote a background-image that is not a list");
  }
  const gradientItems = [...parsedGradients.value];
  for (const layer of items) {
    if (layer.type === "image") {
      image.push({
        type: "image",
        value: { type: "asset", value: layer.assetId },
      });
    } else {
      const item = gradientItems.shift();
      if (item === undefined) {
        throw new Error("Preset wrote fewer gradients than layers");
      }
      image.push(item);
    }
  }
  const list = (pick: (layer: Layer) => string) => items.map(pick).join(", ");
  return [
    {
      property: "background-color",
      value: parse("background-color", backgroundColor),
    },
    { property: "background-image", value: { type: "layers", value: image } },
    {
      property: "background-position-x",
      value: parse(
        "background-position-x",
        list((layer) => layerSettings(layer).x)
      ),
    },
    {
      property: "background-position-y",
      value: parse(
        "background-position-y",
        list((layer) => layerSettings(layer).y)
      ),
    },
    {
      property: "background-size",
      value: parse(
        "background-size",
        list((layer) => layerSettings(layer).size)
      ),
    },
    {
      property: "background-repeat",
      value: parse(
        "background-repeat",
        list((layer) => layerSettings(layer).repeat)
      ),
    },
    {
      property: "background-attachment",
      value: parse(
        "background-attachment",
        list(() => "scroll")
      ),
    },
    {
      property: "background-clip",
      value: parse(
        "background-clip",
        list(() => "border-box")
      ),
    },
    {
      property: "background-origin",
      value: parse(
        "background-origin",
        list(() => "padding-box")
      ),
    },
    {
      property: "background-blend-mode",
      value: parse(
        "background-blend-mode",
        list(() => "normal")
      ),
    },
  ];
};

/** A radial bloom: the color at its center, fading to the same color at 0. */
const bloom = (
  color: PaletteColor,
  alpha: number,
  position: string
): Layer => ({
  type: "gradient",
  css: `radial-gradient(circle at ${position}, ${paint(color, { alpha })} 0%, ${paint(color, { alpha: 0 })} 60%)`,
});

const bloomLayers = (
  palette: Palette,
  alphas: [number, number, number, number]
): Layer[] => [
  bloom(palette.accent1, alphas[0], "12% 18%"),
  bloom(palette.accent2, alphas[1], "88% 12%"),
  bloom(palette.accent2, alphas[2], "18% 92%"),
  bloom(palette.accent1, alphas[3], "86% 84%"),
];

const wash = (
  from: PaletteColor,
  fromAlpha: number,
  to: PaletteColor,
  toAlpha: number
): Layer => ({
  type: "gradient",
  css: `linear-gradient(180deg, ${paint(from, { alpha: fromAlpha })} 0%, ${paint(to, { alpha: toAlpha })} 100%)`,
});

/**
 * The smallest alpha, in 0.01 steps, for a scrim of `base` over an image such
 * that `referenceText` gets 4.5:1 whatever the image is: the scrim composited
 * over pure black and pure white bounds the luminance the stack can produce
 * (spec 4.5), so the text's luminance must lie outside that range and pass
 * against both ends. 1 when no alpha does (the base itself fails).
 */
export const scrimAlpha = (base: Rgba, referenceText: Rgba): number => {
  const textLuminance = luminance(referenceText);
  for (let step = 0; step <= 100; step += 1) {
    const alpha = step / 100;
    const overBlack = composite({ ...base, a: base.a * alpha }, black);
    const overWhite = composite({ ...base, a: base.a * alpha }, white);
    const low = Math.min(luminance(overBlack), luminance(overWhite));
    const high = Math.max(luminance(overBlack), luminance(overWhite));
    const outside = textLuminance < low || textLuminance > high;
    if (
      outside &&
      contrastRatio(referenceText, overBlack) >= 4.5 &&
      contrastRatio(referenceText, overWhite) >= 4.5
    ) {
      return alpha;
    }
  }
  return 1;
};

const scrim = (color: PaletteColor, referenceText: Rgba): Layer => {
  const alpha = scrimAlpha(color.rgba, referenceText);
  const stop = paint({ rgba: color.rgba }, { alpha });
  return {
    type: "gradient",
    css: `linear-gradient(180deg, ${stop} 0%, ${stop} 100%)`,
  };
};

const imageLayers = (
  surface: PaletteColor,
  referenceText: Rgba,
  options?: PresetOptions
): Layer[] => {
  const layers: Layer[] = [scrim(surface, referenceText)];
  if (options?.imageAssetId !== undefined) {
    // listed last, so painted beneath the scrim
    layers.push({ type: "image", assetId: options.imageAssetId });
  }
  return layers;
};

export const presets: Preset[] = [
  {
    id: "bloom-light",
    family: "bloom",
    label: "Bloom",
    tone: "light",
    build: (palette) =>
      writeBackground(
        paint(palette.base),
        bloomLayers(palette, [0.22, 0.2, 0.16, 0.18])
      ),
  },
  {
    id: "bloom-strong",
    family: "bloom",
    label: "Bloom, strong",
    tone: "light",
    // accent alpha capped so the light variant stays light
    build: (palette) =>
      writeBackground(
        paint(palette.base),
        bloomLayers(palette, [0.45, 0.4, 0.32, 0.38])
      ),
  },
  {
    id: "bloom-dark",
    family: "bloom",
    label: "Bloom, dark",
    tone: "dark",
    build: (palette) =>
      writeBackground(
        paint(darkSurface(palette)),
        bloomLayers(palette, [0.2, 0.14, 0.12, 0.16])
      ),
  },
  {
    id: "wash-light",
    family: "wash",
    label: "Wash",
    tone: "light",
    build: (palette) =>
      writeBackground(paint(palette.base), [
        wash(palette.accent1, 0.06, palette.accent2, 0.16),
      ]),
  },
  {
    id: "wash-dark",
    family: "wash",
    label: "Wash, dark",
    tone: "dark",
    build: (palette) =>
      writeBackground(paint(darkSurface(palette)), [
        wash(palette.accent1, 0.1, palette.accent2, 0.18),
      ]),
  },
  {
    id: "tint-light",
    family: "tint",
    label: "Solid tint",
    tone: "light",
    build: (palette) =>
      writeBackground(
        paint(palette.accent1, {
          tint: { over: palette.base.rgba, amount: 0.12 },
        }),
        []
      ),
  },
  {
    id: "tint-dark",
    family: "tint",
    label: "Solid tint, dark",
    tone: "dark",
    build: (palette) =>
      writeBackground(
        paint(palette.accent1, { tint: { over: black, amount: 0.3 } }),
        []
      ),
  },
  {
    id: "image-scrim-light",
    family: "image-scrim",
    label: "Image with scrim",
    tone: "light",
    build: (palette, options) =>
      writeBackground(
        paint(palette.base),
        imageLayers(
          palette.base,
          getReferenceTextColor({ tone: "light" }, palette),
          options
        )
      ),
  },
  {
    id: "image-scrim-dark",
    family: "image-scrim",
    label: "Image with scrim, dark",
    tone: "dark",
    build: (palette, options) => {
      const surface = darkSurface(palette);
      return writeBackground(
        paint(surface),
        imageLayers(
          surface,
          getReferenceTextColor({ tone: "dark" }, palette),
          options
        )
      );
    },
  },
];
