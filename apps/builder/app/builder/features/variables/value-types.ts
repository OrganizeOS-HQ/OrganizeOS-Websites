import {
  isValidDeclaration,
  keywordValues,
  parseColor,
  parseCssValue,
} from "@webstudio-is/css-data";
import type { StyleValue, Unit } from "@webstudio-is/css-engine";
import type { VariableType } from "@webstudio-is/project-build";

/** Spec 4.5: what each variable type accepts, and how a value is stored. */

export const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  color: "Color",
  size: "Size",
  percentage: "Percentage",
  number: "Number",
  fontFamily: "Font family",
};

export type ValidationResult =
  | { ok: true; value: StyleValue }
  | { ok: false; error: string };

const number = "-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)";

const sizeUnits = "px|em|rem|ch|vw|vh|vmin|vmax|dvh|dvw|svh|svw|lvh|lvw".split(
  "|"
);

const sizePattern = new RegExp(`^(${number})(${sizeUnits.join("|")})$`);
const percentagePattern = new RegExp(`^(${number})%$`);
const numberPattern = new RegExp(`^(${number})$`);

const errors: Record<VariableType, string> = {
  color: "Invalid color",
  size: "Invalid size",
  percentage: "Invalid percentage",
  number: "Invalid number",
  fontFamily: "Invalid font",
};

const refuse = (type: VariableType): ValidationResult => ({
  ok: false,
  error: errors[type],
});

/**
 * Sizes, percentages and numbers are checked directly, negatives included:
 * a representative property such as `width` would refuse the negative
 * values margins, insets, letter spacing and z-index need.
 */
export const validateVariableValue = (
  type: VariableType,
  input: string
): ValidationResult => {
  const text = input.trim();
  if (type === "size") {
    const match = text.match(sizePattern);
    return match
      ? {
          ok: true,
          value: {
            type: "unit",
            value: Number(match[1]),
            unit: match[2] as Unit,
          },
        }
      : refuse(type);
  }
  if (type === "percentage") {
    const match = text.match(percentagePattern);
    return match
      ? {
          ok: true,
          value: { type: "unit", value: Number(match[1]), unit: "%" },
        }
      : refuse(type);
  }
  if (type === "number") {
    const match = text.match(numberPattern);
    return match
      ? {
          ok: true,
          value: { type: "unit", value: Number(match[1]), unit: "number" },
        }
      : refuse(type);
  }
  if (type === "color") {
    return isValidDeclaration("color", text) && parseColor(text) !== undefined
      ? { ok: true, value: parseCssValue("color", text) }
      : refuse(type);
  }
  return text !== "" && isValidDeclaration("font-family", text)
    ? { ok: true, value: parseCssValue("font-family", text) }
    : refuse(type);
};

const cssWideKeywords = new Set(["initial", "inherit", "unset"]);

const genericFamilies = new Set(
  keywordValues["font-family"].filter(
    (family) => cssWideKeywords.has(family) === false
  )
);

/**
 * Font family only for text that reads as one: quoted, a comma-separated
 * list with no parenthesis (deviation 10), one of the site's fonts, or a
 * generic family. `flex`, `bold` or `ease-in-out` stay untyped.
 */
const isFontFamilyText = (text: string, fontNames: ReadonlySet<string>) => {
  const value = text.trim();
  return (
    /^["'].*["']$/.test(value) ||
    (value.includes(",") && value.includes("(") === false) ||
    fontNames.has(value) ||
    genericFamilies.has(value)
  );
};

const unitTypes: Record<string, VariableType> = {
  "%": "percentage",
  number: "number",
};

/**
 * The type an unregistered variable's stored value reads as (spec 4.5), or
 * undefined when no type accepts it. A `var` value is resolved by the
 * reader, which knows the target's type.
 */
export const inferVariableType = (
  value: StyleValue,
  fontNames: ReadonlySet<string>
): VariableType | undefined => {
  if (value.type === "color" || value.type === "rgb") {
    return "color";
  }
  if (value.type === "unit") {
    if (unitTypes[value.unit] !== undefined) {
      return unitTypes[value.unit];
    }
    return sizeUnits.includes(value.unit) ? "size" : undefined;
  }
  if (value.type === "fontFamily") {
    return "fontFamily";
  }
  if (value.type === "keyword" || value.type === "unparsed") {
    if (parseColor(value.value) !== undefined) {
      return "color";
    }
    if (value.type === "unparsed" && isFontFamilyText(value.value, fontNames)) {
      return "fontFamily";
    }
  }
  return;
};
