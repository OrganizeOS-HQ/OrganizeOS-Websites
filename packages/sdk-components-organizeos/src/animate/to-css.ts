import type { KeyframeStyles } from "@webstudio-is/sdk";

/** A keyframe value as upstream's `animationAction` stores it. */
export type KeyframeValue = KeyframeStyles[string];

type Part = { type: string; hidden?: boolean };

const toNumber = (value: number, unit: string) =>
  `${value}${unit === "number" ? "" : unit}`;

const toHex = (channel: number) =>
  Math.round(Math.min(Math.max(channel, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");

/**
 * One value, as `toValue` from `@webstudio-is/css-engine` writes it, for the
 * types the serializer supports; `undefined` for any other type, or where
 * `toValue` would write nothing.
 */
const serialize = (value: Part): string | undefined => {
  const style = value as KeyframeValue;
  switch (style.type) {
    case "unit":
      return toNumber(style.value, style.unit);
    case "keyword":
      return style.hidden === true ? undefined : style.value;
    case "unparsed":
      return style.hidden === true ? "none" : style.value;
    case "var": {
      if (style.hidden === true) {
        return undefined;
      }
      if (style.fallback === undefined) {
        return `var(--${style.value})`;
      }
      const fallback = serialize(style.fallback);
      return fallback === undefined
        ? undefined
        : `var(--${style.value}, ${fallback})`;
    }
    case "rgb":
      return `rgb(${style.r} ${style.g} ${style.b} / ${style.alpha})`;
    case "color": {
      const [c1, c2, c3] = style.components;
      if (style.colorSpace === "hex") {
        const alpha = typeof style.alpha === "number" ? style.alpha : 1;
        const hex = `#${toHex(c1)}${toHex(c2)}${toHex(c3)}`;
        return alpha < 1 ? hex + toHex(alpha) : hex;
      }
      if (style.colorSpace === "srgb") {
        const alpha =
          typeof style.alpha === "number"
            ? String(style.alpha)
            : serialize(style.alpha);
        if (alpha === undefined) {
          return;
        }
        const r = Math.round(c1 * 255);
        const g = Math.round(c2 * 255);
        const b = Math.round(c3 * 255);
        return `rgb(${r} ${g} ${b} / ${alpha})`;
      }
      return;
    }
    case "tuple": {
      if (style.hidden === true) {
        return "none";
      }
      const items: string[] = [];
      for (const item of style.value) {
        if (item.hidden === true) {
          continue;
        }
        const css = serialize(item);
        if (css === undefined) {
          return;
        }
        items.push(css);
      }
      return items.join(" ");
    }
    case "layers": {
      const layers: string[] = [];
      for (const layer of style.value) {
        if (layer.hidden === true) {
          continue;
        }
        const css = serialize(layer);
        if (css === undefined) {
          return;
        }
        layers.push(css);
      }
      return layers.length === 0 ? "none" : layers.join(", ");
    }
    default:
      return;
  }
};

/**
 * A keyframe value as a CSS string for `Element.animate` (spec 4.3), for the
 * types upstream's keyframe editor writes: `unit`, `keyword`, `unparsed`,
 * `var` (with its fallback), `rgb`, `color` in sRGB or hex, and `tuple` and
 * `layers` of those. Anything else (`function`, `shadow`, `image`, other
 * color spaces) is `undefined`: part A does not play it (spec 14.5).
 *
 * The output equals `toValue` from `@webstudio-is/css-engine`, which this
 * package does not ship; `to-css.test.ts` pins that.
 */
export const toCss = (value: KeyframeValue): string | undefined => {
  if (typeof value !== "object" || value === null) {
    return;
  }
  const css = serialize(value);
  return css === "" ? undefined : css;
};

/**
 * A hyphenated CSS property name as the IDL attribute name `Element.animate`
 * expects in a keyframe: `clip-path` is `clipPath`, `float` is `cssFloat`,
 * `offset` is `cssOffset` (a keyframe's own `offset` is its position), and a
 * custom property `--x` stays as it is.
 */
export const toKeyframeProperty = (name: string): string => {
  if (name.startsWith("--")) {
    return name;
  }
  if (name === "float" || name === "offset") {
    return `css${name[0].toUpperCase()}${name.slice(1)}`;
  }
  return name
    .replace(/^-/, "")
    .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
};
