import { expect, test } from "vitest";
import { toValue, type StyleValue } from "@webstudio-is/css-engine";
import { countVariableInText, replaceVariableReferences } from "./references";

const px = (value: number) => ({ type: "unit", value, unit: "px" }) as const;
const v = (value: string) => ({ type: "var", value }) as const;
const teal = { type: "keyword", value: "teal" } as const;
const alpha: Extract<StyleValue, { type: "color" }> = {
  type: "color",
  colorSpace: "srgb",
  components: [0, 0, 0],
  alpha: v("opacity"),
};

test("a whole VarValue becomes the literal; another or a longer name returns the same object", () => {
  expect(replaceVariableReferences(v("large"), "large", px(16))).toEqual(
    px(16)
  );
  const other = v("spacing--large");
  expect(replaceVariableReferences(other, "large", px(16))).toBe(other);
});

test("tuple, layer and function-argument items take the literal", () => {
  expect(
    replaceVariableReferences(
      { type: "tuple", value: [px(0), v("large")] },
      "large",
      px(16)
    )
  ).toEqual({ type: "tuple", value: [px(0), px(16)] });
  expect(
    replaceVariableReferences(
      { type: "layers", value: [v("large")] },
      "large",
      px(16)
    )
  ).toEqual({ type: "layers", value: [px(16)] });
  expect(
    replaceVariableReferences(
      { type: "function", name: "blur", args: v("large") },
      "large",
      px(16)
    )
  ).toEqual({ type: "function", name: "blur", args: px(16) });
});

test("shadow length slots take a unit, its colour slot a colour; a colour alpha takes a number", () => {
  const shadow = {
    type: "shadow",
    position: "outset",
    offsetX: v("large"),
    offsetY: px(0),
    color: v("ink"),
  } as const;
  expect(replaceVariableReferences(shadow, "large", px(16))).toEqual({
    ...shadow,
    offsetX: px(16),
  });
  expect(replaceVariableReferences(shadow, "ink", teal)).toEqual({
    ...shadow,
    color: teal,
  });
  expect(
    replaceVariableReferences(alpha, "opacity", {
      type: "unit",
      value: 0.5,
      unit: "number",
    })
  ).toEqual({ ...alpha, alpha: 0.5 });
});

test("a literal a slot cannot take turns the whole declaration value into unparsed text", () => {
  const layers: StyleValue = {
    type: "layers",
    value: [
      {
        type: "shadow",
        position: "outset",
        offsetX: v("large"),
        offsetY: px(0),
      },
    ],
  };
  const calc = { type: "unparsed", value: "calc(1px + 2px)" } as const;
  expect(replaceVariableReferences(layers, "large", calc)).toEqual({
    type: "unparsed",
    value: toValue(layers).replace("var(--large)", "calc(1px + 2px)"),
  });
  expect(replaceVariableReferences(alpha, "opacity", px(1))).toEqual({
    type: "unparsed",
    value: toValue(alpha).replace("var(--opacity)", "1px"),
  });
});

test("unparsed text and fallbacks: var(--name) and var(--name, fallback), balanced, whole name only", () => {
  expect(
    replaceVariableReferences(
      {
        type: "unparsed",
        value:
          "calc(var(--large) + var( --large , calc(1px + 2px)) + var(--spacing--large) + var(--large-x))",
      },
      "large",
      px(16)
    )
  ).toEqual({
    type: "unparsed",
    value: "calc(16px + 16px + var(--spacing--large) + var(--large-x))",
  });
  expect(
    replaceVariableReferences(
      {
        type: "var",
        value: "accent-text",
        fallback: { type: "unparsed", value: "var(--ink)" },
      },
      "ink",
      teal
    )
  ).toEqual({
    type: "var",
    value: "accent-text",
    fallback: { type: "unparsed", value: "teal" },
  });
});

test("countVariableInText counts --name with a boundary on both sides", () => {
  expect(
    countVariableInText(
      ":root{--large:1px} a{margin:var(--large)} b{gap:var(--spacing--large) var(--large-2)}",
      "large"
    )
  ).toBe(2);
});
