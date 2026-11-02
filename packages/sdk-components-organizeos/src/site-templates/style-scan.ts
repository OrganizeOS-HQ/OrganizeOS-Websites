import { keywordValues } from "@webstudio-is/css-data";
import {
  hyphenateProperty,
  toValue,
  type StyleValue,
} from "@webstudio-is/css-engine";
import {
  BAND_VARIABLES,
  CANONICAL_COLOR_NAMES,
  isCanonicalName,
} from "./canonical-variables";

// The style half of the template check: a template's own styles reach
// colours and fonts only through the canonical variables (spec rule 2), and
// images only through the template's images (rule 6). The only other
// variables are the band's (BAND_VARIABLES: the focus ring and the accent
// text), which a band sets to a canonical colour and every read names a
// canonical colour behind. Only Global Root declares the six, from the
// template's variables.

// The properties whose value is a colour, hyphenated: a keyword there is a
// colour's name. Every border colour longhand is one too.
const colourProperties = new Set([
  "color",
  "background-color",
  "outline-color",
  "fill",
  "stroke",
  "caret-color",
  "text-decoration-color",
  "column-rule-color",
  "accent-color",
  "text-emphasis-color",
  "-webkit-text-stroke-color",
  "-webkit-tap-highlight-color",
  "scrollbar-color",
  "flood-color",
  "lighting-color",
  "stop-color",
]);

const isColourProperty = (property: string) => {
  const name = hyphenateProperty(property);
  return colourProperties.has(name) || /^border(-[a-z]+)*-color$/.test(name);
};

const bandVariables: readonly string[] = BAND_VARIABLES;

/** A variable a template's styles may read: a canonical one, or a band's. */
const isAllowedVariable = (name: string) =>
  isCanonicalName(name) || bandVariables.includes(name);

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

// A colour written out in unparsed text (a gradient, a color-mix()): a hex
// colour, or a colour function.
const literalColourInText =
  /#[0-9a-f]{3,8}\b|(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;

// The colours CSS names (`black`, `white`, the system colours such as
// `Canvas`): every keyword a colour property takes but those that name no
// colour of their own. In unparsed text a name is a whole word of CSS, not
// part of a longer name (`background-color`, `fade-white`).
const namedColours = keywordValues["background-color"].filter(
  (keyword) => allowedColourKeywords.has(keyword.toLowerCase()) === false
);

const namedColourInText = new RegExp(
  `(?<![\\w-])(?:${namedColours.join("|")})(?![\\w-])`,
  "i"
);

// Quoted strings in unparsed text (`grid-template-areas: "tan red"`, a
// `content` string) name no colour.
const quotedStrings = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;

const variableInText = /var\(\s*--([\w-]+)/g;

// A band variable is unset on the base, so a read names a canonical colour
// behind it: `var(--focus-ring, var(--accent-2))`.
const canonicalColourFallback = new RegExp(
  `^var\\(\\s*--(?:${CANONICAL_COLOR_NAMES.join("|")})\\s*\\)$`
);

const bandReadInText = new RegExp(
  `var\\(\\s*--(${BAND_VARIABLES.join("|")})\\s*([,)])`,
  "g"
);

/** The fallback of a band variable read in unparsed text, after its comma. */
const fallbackInText = (text: string) => {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "(") {
      depth += 1;
    } else if (text[index] === ")") {
      if (depth === 0) {
        return text.slice(0, index).trim();
      }
      depth -= 1;
    }
  }
  return text.trim();
};

/** The band variables `text` reads with no canonical colour behind them. */
const findBandReadsInText = (text: string) =>
  Array.from(text.matchAll(bandReadInText)).flatMap((match) => {
    const [read, name, after] = match;
    const fallback =
      after === ")"
        ? ""
        : fallbackInText(text.slice((match.index ?? 0) + read.length));
    return canonicalColourFallback.test(fallback) ? [] : [name];
  });

const bandReadProblem = (name: string) =>
  `--${name} with no canonical colour behind it: read var(--${name}, var(--accent-2))`;

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
 * or a colour's name inside unparsed text (a gradient, a `color-mix()`, a
 * variable's fallback), a variable outside the canonical set
 * and the band's, a font-family that is not a font variable, an image by
 * URL rather than one of the template's images (an asset), a band variable
 * set to anything but a bare canonical colour variable or read with no
 * canonical colour behind it, or a canonical variable declared as the
 * property itself, which only Global Root declares.
 */
export const findStyleProblems = (
  property: string,
  value: StyleValue
): string[] => {
  const bandVariable = BAND_VARIABLES.find((name) => property === `--${name}`);
  if (bandVariable !== undefined) {
    const colours: readonly string[] = CANONICAL_COLOR_NAMES;
    return value.type === "var" &&
      colours.includes(value.value) &&
      value.fallback === undefined
      ? []
      : [
          // "the focus ring", "the accent text"
          `the ${bandVariable.replace("-", " ")} set to ${toValue(value)}, not a colour variable`,
        ];
  }
  if (property.startsWith("--") && isCanonicalName(property.slice(2))) {
    return [
      `${property} as its own property, a canonical variable only Global Root declares (the template's variables)`,
    ];
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
      const text = item.value.replace(quotedStrings, "");
      if (literalColourInText.test(text)) {
        problems.push(`a literal colour in "${item.value}"`);
      }
      const named = namedColourInText.exec(text)?.[0];
      if (named !== undefined) {
        problems.push(`the named colour "${named}" in "${item.value}"`);
      }
      for (const [, name] of item.value.matchAll(variableInText)) {
        if (isAllowedVariable(name) === false) {
          problems.push(nonCanonical(name));
        }
      }
      problems.push(...findBandReadsInText(item.value).map(bandReadProblem));
    }
    if (item.type === "var" && isAllowedVariable(item.value) === false) {
      problems.push(nonCanonical(item.value));
    }
    if (
      item.type === "var" &&
      bandVariables.includes(item.value) &&
      (item.fallback?.type !== "unparsed" ||
        canonicalColourFallback.test(item.fallback.value.trim()) === false)
    ) {
      problems.push(bandReadProblem(item.value));
    }
  });
  return problems;
};
