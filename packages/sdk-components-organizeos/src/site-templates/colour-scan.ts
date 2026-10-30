import { toValue, type StyleValue } from "@webstudio-is/css-engine";
import { isCanonicalName } from "./canonical-variables";

// The colour half of the template check (spec rule 2): a template's own
// styles reach colours only through the canonical variables.

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

// Keywords that name no colour of their own.
const allowedColourKeywords = new Set([
  "transparent",
  "currentcolor",
  "inherit",
  "initial",
  "unset",
]);

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
 * What is wrong with one style declaration's value, one phrase per problem:
 * a literal colour, a colour keyword where a colour goes, a literal colour
 * inside unparsed text (a gradient), or a variable outside the canonical set.
 */
export const findColourProblems = (
  property: string,
  value: StyleValue
): string[] => {
  const problems: string[] = [];
  const nonCanonical = (name: string) =>
    `--${name}, which is not a canonical variable`;
  visitStyleValue(value, isColourProperty(property), (item, isColourSlot) => {
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
        if (isCanonicalName(name) === false) {
          problems.push(nonCanonical(name));
        }
      }
    }
    if (item.type === "var" && isCanonicalName(item.value) === false) {
      problems.push(nonCanonical(item.value));
    }
  });
  return problems;
};
