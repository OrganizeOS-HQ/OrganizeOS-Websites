// The six variables every site template speaks (spec 6.3): four colours and
// two fonts. A template sets their values; the blocks and the pages read
// them as `var(--base)` and so on, so changing one value in the Style panel
// restyles the whole site.
//
// Small on purpose: the builder's Style panel imports this file for the
// names and the contrast check, so it must not reach the template catalog
// (see site-templates/index.ts).

export const CANONICAL_COLOR_NAMES = [
  "base",
  "accent-1",
  "accent-2",
  "text",
] as const;

export const CANONICAL_FONT_NAMES = ["font-heading", "font-body"] as const;

export type CanonicalName =
  | (typeof CANONICAL_COLOR_NAMES)[number]
  | (typeof CANONICAL_FONT_NAMES)[number];

/** CSS text per variable, e.g. "#ffffff". */
export type CanonicalValues = Record<CanonicalName, string>;

const systemFontStack =
  'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * What a blank site starts with: the look the blocks have today, so adding
 * the variables changes nothing on a site that never picks a template.
 */
export const BLANK_CANONICAL_VALUES: CanonicalValues = {
  base: "#ffffff",
  "accent-1": "#18181b",
  "accent-2": "#2563eb",
  text: "#18181b",
  "font-heading": systemFontStack,
  "font-body": systemFontStack,
};

const canonicalNames: readonly string[] = [
  ...CANONICAL_COLOR_NAMES,
  ...CANONICAL_FONT_NAMES,
];

export const isCanonicalName = (name: string): name is CanonicalName =>
  canonicalNames.includes(name);

const parseHex = (color: string): [number, number, number] => {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
  if (hex === undefined) {
    throw new Error(`Not a #rgb or #rrggbb colour: ${JSON.stringify(color)}`);
  }
  const full =
    hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
  const channel = (index: number) =>
    parseInt(full.slice(index * 2, index * 2 + 2), 16);
  return [channel(0), channel(1), channel(2)];
};

// WCAG 2.1 relative luminance: each sRGB channel linearised, then weighted.
const luminance = (color: string) => {
  const [r, g, b] = parseHex(color).map((value) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * The WCAG 2.1 contrast ratio of two colours, 1 to 21, whichever order they
 * come in. Throws on anything but `#rgb` or `#rrggbb`.
 */
export const contrastRatio = (a: string, b: string): number => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
