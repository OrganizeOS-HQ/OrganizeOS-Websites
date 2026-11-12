import { toValue, type StyleValue } from "@webstudio-is/css-engine";
import { keywordValues } from "@webstudio-is/css-data";
import type { VariableRow } from "./reader";
import { quantize, toRgba, type Rgba } from "./color";

/**
 * The manager's search (spec 5.4): by display name, group, CSS name and
 * value text, and for a colour by its hex, short hex and CSS names. Pure.
 */

const notNames = new Set(["transparent", "initial", "inherit", "unset"]);

let namedColors: Map<string, string[]> | undefined;

/** The CSS colour names, by their quantized colour. */
const getNamedColors = () => {
  if (namedColors === undefined) {
    namedColors = new Map();
    for (const name of keywordValues.color ?? []) {
      if (/^[a-z]+$/.test(name) === false || notNames.has(name)) {
        continue;
      }
      const rgba = toRgba({ type: "keyword", value: name });
      if (rgba === undefined) {
        continue;
      }
      const key = quantize(rgba);
      namedColors.set(key, [...(namedColors.get(key) ?? []), name]);
    }
  }
  return namedColors;
};

const hex2 = (channel: number) =>
  Math.round(channel * 255)
    .toString(16)
    .padStart(2, "0");

/** The long hex (alpha only below 1) and, when it has one, the short hex. */
const hexesOf = (rgba: Rgba) => {
  const pairs = [rgba.r, rgba.g, rgba.b, ...(rgba.a < 1 ? [rgba.a] : [])].map(
    hex2
  );
  const long = pairs.join("");
  const short = pairs.every((pair) => pair[0] === pair[1])
    ? pairs.map((pair) => pair[0]).join("")
    : undefined;
  return short === undefined ? [long] : [long, short];
};

const textOf = (value: StyleValue | undefined) => {
  if (value === undefined) {
    return;
  }
  try {
    return toValue(value).toLowerCase();
  } catch {
    return;
  }
};

const rgbaOf = (value: StyleValue | undefined) => {
  if (value === undefined) {
    return;
  }
  try {
    return toRgba(value);
  } catch {
    return;
  }
};

export const matchesVariableSearch = (
  row: VariableRow,
  resolved: StyleValue | undefined,
  query: string
): boolean => {
  const term = query.trim().toLowerCase();
  if (term === "") {
    return true;
  }
  const texts = [
    row.displayName,
    row.group,
    row.cssName,
    textOf(row.value),
    textOf(resolved),
  ];
  if (
    texts.some(
      (text) => text !== undefined && text.toLowerCase().includes(term)
    )
  ) {
    return true;
  }
  const rgba = rgbaOf(resolved ?? row.value);
  if (rgba === undefined) {
    return false;
  }
  const hexTerm = term.replace(/^#/, "");
  if (hexTerm !== "" && hexesOf(rgba).some((hex) => hex.includes(hexTerm))) {
    return true;
  }
  return (getNamedColors().get(quantize(rgba)) ?? []).some((name) =>
    name.includes(term)
  );
};
