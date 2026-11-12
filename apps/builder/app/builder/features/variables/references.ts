import { toValue, type StyleValue } from "@webstudio-is/css-engine";
import { parseCssValue } from "@webstudio-is/css-data";

/**
 * Delete's replacement pass (spec 4.8): every whole-name reference to a
 * variable becomes the variable's resolved base value. Names here are
 * written without the leading `--`.
 */

type Slot = "any" | "tuple" | "layer" | "length" | "shadowColor";

const tupleKinds = new Set([
  "unit",
  "keyword",
  "unparsed",
  "image",
  "color",
  "rgb",
  "function",
]);

const layerKinds = new Set([...tupleKinds, "tuple", "shadow", "invalid"]);

const accepts = (slot: Slot, literal: StyleValue) => {
  switch (slot) {
    case "any":
      return true;
    case "tuple":
      return tupleKinds.has(literal.type);
    case "layer":
      return layerKinds.has(literal.type);
    case "length":
      return literal.type === "unit";
    case "shadowColor":
      return (
        literal.type === "color" ||
        literal.type === "rgb" ||
        literal.type === "keyword"
      );
  }
};

/** A slot refused the literal: the whole value is rewritten as text. */
class Refused extends Error {}

const isOwnVar = (node: unknown, cssName: string) =>
  typeof node === "object" &&
  node !== null &&
  (node as { type?: unknown }).type === "var" &&
  (node as { value?: unknown }).value === cssName;

/** An alpha takes a number: a unitless number, or a percentage over 100. */
const toAlpha = (literal: StyleValue) => {
  if (literal.type === "unit" && literal.unit === "number") {
    return literal.value;
  }
  if (literal.type === "unit" && literal.unit === "%") {
    return literal.value / 100;
  }
  throw new Refused();
};

const replaceInNode = (
  node: StyleValue,
  slot: Slot,
  cssName: string,
  literal: StyleValue,
  literalText: string
): StyleValue => {
  if (isOwnVar(node, cssName)) {
    if (accepts(slot, literal) === false) {
      throw new Refused();
    }
    return literal;
  }
  const replaceChild = <Child extends StyleValue>(
    child: Child,
    childSlot: Slot
  ) => replaceInNode(child, childSlot, cssName, literal, literalText);
  switch (node.type) {
    case "unparsed": {
      const value = replaceVariableInText(node.value, cssName, literalText);
      return value === node.value ? node : { ...node, value };
    }
    case "var": {
      if (node.fallback === undefined) {
        return node;
      }
      const fallback = replaceChild(node.fallback, "any");
      return fallback === node.fallback
        ? node
        : { ...node, fallback: fallback as typeof node.fallback };
    }
    case "tuple": {
      const value = node.value.map((item) => replaceChild(item, "tuple"));
      return value.every((item, index) => item === node.value[index])
        ? node
        : { ...node, value: value as typeof node.value };
    }
    case "layers": {
      const value = node.value.map((item) => replaceChild(item, "layer"));
      return value.every((item, index) => item === node.value[index])
        ? node
        : { ...node, value: value as typeof node.value };
    }
    case "function": {
      const args = replaceChild(node.args, "any");
      return args === node.args ? node : { ...node, args };
    }
    case "shadow": {
      const next = { ...node };
      let changed = false;
      for (const key of ["offsetX", "offsetY", "blur", "spread"] as const) {
        const child = node[key];
        if (child !== undefined) {
          const replaced = replaceChild(child, "length");
          if (replaced !== child) {
            next[key] = replaced as typeof child;
            changed = true;
          }
        }
      }
      if (node.color !== undefined) {
        const replaced = replaceChild(node.color, "shadowColor");
        if (replaced !== node.color) {
          next.color = replaced as typeof node.color;
          changed = true;
        }
      }
      return changed ? next : node;
    }
    case "color": {
      return isOwnVar(node.alpha, cssName)
        ? { ...node, alpha: toAlpha(literal) }
        : node;
    }
    case "fontFamily": {
      let changed = false;
      const value: string[] = [];
      for (const family of node.value) {
        if (replaceVariableInText(family, cssName, literalText) === family) {
          value.push(family);
          continue;
        }
        changed = true;
        value.push(...familiesOf(family, cssName, literal, literalText));
      }
      return changed ? { ...node, value } : node;
    }
    default:
      return node;
  }
};

const WHOLE = "\u0000";

/**
 * A stack item that is exactly `var(--name[, fallback])` takes the literal's
 * families; text is parsed as a font-family list, since one item of text
 * would be quoted as a single family when printed.
 */
const familiesOf = (
  family: string,
  cssName: string,
  literal: StyleValue,
  literalText: string
) => {
  if (replaceVariableInText(family.trim(), cssName, WHOLE) !== WHOLE) {
    throw new Refused();
  }
  if (literal.type === "fontFamily") {
    return literal.value;
  }
  const parsed = parseCssValue("font-family", literalText);
  if (parsed.type !== "fontFamily") {
    throw new Refused();
  }
  return parsed.value;
};

/**
 * Replaces every whole-name reference to `cssName` with `literal`, slot by
 * slot. A slot that cannot take the literal (a shadow length given text, an
 * alpha given a length) turns the whole value into unparsed text with the
 * reference replaced there. An unchanged value is returned as the same object.
 */
export const replaceVariableReferences = (
  value: StyleValue,
  cssName: string,
  literal: StyleValue
): StyleValue => {
  const literalText = toValue(literal);
  try {
    return replaceInNode(value, "any", cssName, literal, literalText);
  } catch (error) {
    if (error instanceof Refused) {
      return {
        type: "unparsed",
        value: replaceVariableInText(toValue(value), cssName, literalText),
      };
    }
    throw error;
  }
};

const isNameChar = (char: string | undefined) =>
  char !== undefined && /[\w-]/.test(char);

const skipSpaces = (text: string, index: number) => {
  let next = index;
  while (next < text.length && /\s/.test(text[next])) {
    next += 1;
  }
  return next;
};

/**
 * Replaces `var(--name)` and `var(--name, fallback)` (any case, spaces
 * allowed, the fallback's parentheses balanced) with `literalText`. A longer
 * name such as `--spacing--name` or `--name-x` is left alone.
 */
export const replaceVariableInText = (
  text: string,
  cssName: string,
  literalText: string
) => {
  const property = `--${cssName}`;
  let result = "";
  let index = 0;
  while (index < text.length) {
    const start = text.toLowerCase().indexOf("var(", index);
    if (start === -1) {
      break;
    }
    if (isNameChar(text[start - 1])) {
      result += text.slice(index, start + 4);
      index = start + 4;
      continue;
    }
    const nameStart = skipSpaces(text, start + 4);
    const nameEnd = nameStart + property.length;
    if (
      text.slice(nameStart, nameEnd) !== property ||
      isNameChar(text[nameEnd])
    ) {
      result += text.slice(index, start + 4);
      index = start + 4;
      continue;
    }
    const after = skipSpaces(text, nameEnd);
    let end: number | undefined;
    if (text[after] === ")") {
      end = after + 1;
    } else if (text[after] === ",") {
      let depth = 1;
      for (let position = after + 1; position < text.length; position += 1) {
        if (text[position] === "(") {
          depth += 1;
        } else if (text[position] === ")") {
          depth -= 1;
          if (depth === 0) {
            end = position + 1;
            break;
          }
        }
      }
    }
    if (end === undefined) {
      result += text.slice(index, start + 4);
      index = start + 4;
      continue;
    }
    result += text.slice(index, start) + literalText;
    index = end;
  }
  return result + text.slice(index);
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** How many times `--name` appears as a whole name. */
export const countVariableInText = (text: string, cssName: string) =>
  text.match(new RegExp(`(?<![\\w-])--${escapeRegex(cssName)}(?![\\w-])`, "g"))
    ?.length ?? 0;
