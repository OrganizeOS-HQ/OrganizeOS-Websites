import { toValue, type StyleValue } from "@webstudio-is/css-engine";
import { CANONICAL_COLOR_NAMES, isCanonicalName } from "./canonical-variables";
import { FOCUS_RING_VARIABLE } from "./kit/layout";

// The style half of the template check: a template's own styles reach
// colours and fonts only through the canonical variables (spec rule 2), and
// images only through the template's images (rule 6). The one other
// variable is the kit's focus ring (FOCUS_RING_VARIABLE), which a band sets
// to a canonical colour.

const colourProperties = new Set([
  "color",
  "backgroundColor",
  "outlineColor",
  "fill",
  "stroke",
  "caretColor",
  "textDecorationColor",
]);

const isColourProperty = (property: string) =>
  colourProperties.has(property) || /^border\w*Color$/.test(property);

/** A variable a template's styles may read: a canonical one, or the kit's ring. */
const isAllowedVariable = (name: string) =>
  isCanonicalName(name) || name === FOCUS_RING_VARIABLE;

// Keywords that name no colour of their own (`none` for an SVG's fill or
// stroke, `auto` for a caret).
const allowedColourKeywords = new Set([
  "transparent",
  "currentcolor",
  "inherit",
  "initial",
  "unset",
  "none",
  "auto",
]);

const fontVariables = new Set(["font-heading", "font-body"]);

const allowedFontKeywords = new Set(["inherit", "initial", "unset"]);

const literalColourInText = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|color\(/i;

const variableInText = /var\(\s*--([\w-]+)/g;

/**
 * Visits every value inside a style value with whether it sits where a
 * colour goes: the property's own slot, or a shadow's colour. Descends into
 * layers, tuples, shadows, a function's arguments and a variable's fallback,
 * as the builder's private `traverseStyleValue` does
 * (apps/builder/app/shared/instance-utils/fragment.ts), and visits the
 * variable itself too.
 */
const visitStyleValue = (
  value: StyleValue,
  isColourSlot: boolean,
  visit: (value: StyleValue, isColourSlot: boolean) => void
) => {
  if (value.type === "tuple" || value.type === "layers") {
    for (const item of value.value) {
      visitStyleValue(item, isColourSlot, visit);
    }
    return;
  }
  if (value.type === "shadow") {
    for (const length of [
      value.offsetX,
      value.offsetY,
      value.blur,
      value.spread,
    ]) {
      if (length) {
        visitStyleValue(length, false, visit);
      }
    }
    if (value.color) {
      visitStyleValue(value.color, true, visit);
    }
    return;
  }
  if (value.type === "function") {
    visitStyleValue(value.args, isColourSlot, visit);
    return;
  }
  visit(value, isColourSlot);
  if (value.type === "var" && value.fallback) {
    visitStyleValue(value.fallback, isColourSlot, visit);
  }
};

/**
 * A font-family reads `var(--font-heading)` or `var(--font-body)`. A
 * variable outside the canonical set is left to the colour scan, which
 * already reports it.
 */
const findFontProblem = (value: StyleValue): string | undefined => {
  if (value.type === "var") {
    if (
      fontVariables.has(value.value) ||
      isCanonicalName(value.value) === false
    ) {
      return;
    }
    return `--${value.value}, which is not a font variable`;
  }
  if (
    value.type === "keyword" &&
    allowedFontKeywords.has(value.value.toLowerCase())
  ) {
    return;
  }
  return `the font ${toValue(value)}, not var(--font-heading) or var(--font-body)`;
};

/**
 * What is wrong with one style declaration's value, one phrase per problem:
 * a literal colour, a colour keyword where a colour goes, a literal colour
 * inside unparsed text (a gradient), a variable outside the canonical set
 * and the kit's focus ring, a font-family that is not a font variable, an
 * image by URL rather than one of the template's images (an asset), or the
 * focus ring set to anything but a colour variable.
 */
export const findStyleProblems = (
  property: string,
  value: StyleValue
): string[] => {
  if (property === `--${FOCUS_RING_VARIABLE}`) {
    const colours: readonly string[] = CANONICAL_COLOR_NAMES;
    return value.type === "var" &&
      colours.includes(value.value) &&
      value.fallback === undefined
      ? []
      : [`the focus ring set to ${toValue(value)}, not a colour variable`];
  }
  const problems: string[] = [];
  if (property === "fontFamily") {
    const fontProblem = findFontProblem(value);
    if (fontProblem !== undefined) {
      problems.push(fontProblem);
    }
  }
  const nonCanonical = (name: string) =>
    `--${name}, which is not a canonical variable`;
  visitStyleValue(value, isColourProperty(property), (item, isColourSlot) => {
    if (item.type === "image" && item.value.type === "url") {
      problems.push(
        `the image url(${item.value.url}), not one of the template's images`
      );
    }
    if (item.type === "rgb" || item.type === "color") {
      problems.push(`the literal colour ${toValue(item)}`);
    }
    if (
      item.type === "keyword" &&
      isColourSlot &&
      allowedColourKeywords.has(item.value.toLowerCase()) === false
    ) {
      problems.push(`the colour keyword "${item.value}"`);
    }
    if (item.type === "unparsed") {
      if (literalColourInText.test(item.value)) {
        problems.push(`a literal colour in "${item.value}"`);
      }
      for (const [, name] of item.value.matchAll(variableInText)) {
        if (isAllowedVariable(name) === false) {
          problems.push(nonCanonical(name));
        }
      }
    }
    if (item.type === "var" && isAllowedVariable(item.value) === false) {
      problems.push(nonCanonical(item.value));
    }
  });
  return problems;
};
