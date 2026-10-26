import type { ClearZone, FieldPoint } from "./generate";

/**
 * The field box for each Shape, in the generator's user units (spec 10.1):
 * the SVG scales it with `slice`, so it is cropped on the section's narrower
 * axis, and focus and clear zone are percentages of it.
 */
export const shapes = {
  Band: { width: 1800, height: 600 },
  Wide: { width: 1600, height: 900 },
  Panel: { width: 1600, height: 800 },
  Square: { width: 1000, height: 1000 },
  Tall: { width: 900, height: 1200 },
} as const;

export type Shape = keyof typeof shapes;

export const shapeNames = Object.keys(shapes) as Shape[];

export const motions = ["None", "Settle"] as const;

export type Motion = (typeof motions)[number];

/**
 * The block's defaults (spec 10.9, plan amendment 6): a Band box, density 40,
 * the focus at the centre and a clear zone 60% by 50% of the box, in the
 * brand's aqua and cream. The shared fixture's `default-*` cases are these.
 */
export const fieldDefaults = {
  shape: "Band" as Shape,
  density: 40,
  focusX: 50,
  focusY: 50,
  zoneWidth: 60,
  zoneHeight: 50,
  innerColor: "#3FC9E0",
  outerColor: "#F4EFE6",
  motion: "None" as Motion,
};

/** The props a Convergence Field reads; a bound expression may give anything. */
export type FieldProps = {
  shape?: unknown;
  density?: unknown;
  focusX?: unknown;
  focusY?: unknown;
  zoneWidth?: unknown;
  zoneHeight?: unknown;
  innerColor?: unknown;
  outerColor?: unknown;
  motion?: unknown;
};

/** The generator's inputs and the drawing's colors, after every clamp. */
export type Field = {
  shape: Shape;
  width: number;
  height: number;
  spacing: number;
  focus: FieldPoint;
  zone: ClearZone;
  innerColor: string;
  outerColor: string;
  motion: Motion;
};

const clampNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number
) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

const isShape = (value: unknown): value is Shape =>
  typeof value === "string" && Object.hasOwn(shapes, value);

const isMotion = (value: unknown): value is Motion =>
  typeof value === "string" && (motions as readonly string[]).includes(value);

/** A clear zone stays inside 0.8 of the distance to the nearest edge. */
const zoneClamp = 0.8;

/**
 * The field a Convergence Field draws for its props (spec 4.4, 10.1, 10.7):
 * Density 24..96 is the generator's spacing in box units, identical on every
 * Shape (plan amendment 2); Focus X and Y 10..90 and the clear zone's width
 * and height 10..90 are percentages of the box, the zone's read as the
 * ellipse's diameters. Each zone radius is then held to 0.8 of the
 * focus-to-nearest-edge distance on its axis: at the edge the generator's fade
 * divides by zero (every arm solid) and past it the field is empty. Anything
 * else falls back to the default.
 */
export const clampField = (props: FieldProps): Field => {
  const shape = isShape(props.shape) ? props.shape : fieldDefaults.shape;
  const { width, height } = shapes[shape];
  const spacing = clampNumber(props.density, 24, 96, fieldDefaults.density);
  const focusX = clampNumber(props.focusX, 10, 90, fieldDefaults.focusX);
  const focusY = clampNumber(props.focusY, 10, 90, fieldDefaults.focusY);
  const zoneWidth = clampNumber(
    props.zoneWidth,
    10,
    90,
    fieldDefaults.zoneWidth
  );
  const zoneHeight = clampNumber(
    props.zoneHeight,
    10,
    90,
    fieldDefaults.zoneHeight
  );
  const focus = { x: (width * focusX) / 100, y: (height * focusY) / 100 };
  const zone = {
    rx: Math.min(
      (width * zoneWidth) / 100 / 2,
      zoneClamp * Math.min(focus.x, width - focus.x)
    ),
    ry: Math.min(
      (height * zoneHeight) / 100 / 2,
      zoneClamp * Math.min(focus.y, height - focus.y)
    ),
  };
  return {
    shape,
    width,
    height,
    spacing,
    focus,
    zone,
    innerColor: validColor(props.innerColor, fieldDefaults.innerColor),
    outerColor: validColor(props.outerColor, fieldDefaults.outerColor),
    motion: isMotion(props.motion) ? props.motion : fieldDefaults.motion,
  };
};

const hexPattern = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// A color function with plain arguments: numbers, units, percentages, `none`,
// a color space name, commas, spaces and the alpha slash. No parenthesis,
// quote, semicolon, brace or asterisk can occur in them.
const functionPattern =
  /^(?:rgba?|hsla?|oklch|oklab|color)\([0-9a-z.,%\s/+-]*\)$/i;
const namedPattern = /^[a-z]+$/i;
const varPattern = /^var\(\s*--[a-z0-9_-]+\s*(?:,\s*(.*?))?\s*\)$/is;

const isColor = (value: string, depth: number): boolean => {
  if (
    hexPattern.test(value) ||
    functionPattern.test(value) ||
    namedPattern.test(value)
  ) {
    return true;
  }
  const match = varPattern.exec(value);
  if (match === null || depth > 2) {
    return false;
  }
  const fallback = match[1];
  return fallback === undefined || isColor(fallback, depth + 1);
};

/**
 * A color prop as the field's `fill` may use it, or `fallback` (spec 10.6).
 * A conservative grammar: `#hex`; `rgb()`, `rgba()`, `hsl()`, `hsla()`,
 * `oklch()`, `oklab()` and `color()` with plain arguments; a named color; and
 * `var(--name)` with an optional fallback of the same grammar. So a value
 * such as `red; background: url(x)` never reaches the server's `style`
 * attribute as declarations of its own.
 */
export const validColor = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length <= 200 && isColor(trimmed, 0) ? trimmed : fallback;
};
