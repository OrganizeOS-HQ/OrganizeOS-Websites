import { expect, test } from "vitest";
import { parseCssValue } from "@webstudio-is/css-data";
import type { StyleValue } from "@webstudio-is/css-engine";
import { variableTypes } from "@webstudio-is/project-build";
import {
  inferVariableType,
  validateVariableValue,
  VARIABLE_TYPE_LABELS,
} from "./value-types";

const unit = (value: number, unit: string) => ({ type: "unit", value, unit });

test("type labels, in variableTypes order", () => {
  expect(variableTypes.map((type) => VARIABLE_TYPE_LABELS[type])).toEqual([
    "Color",
    "Size",
    "Percentage",
    "Number",
    "Font family",
  ]);
});

test.each([
  ["size", "-8px", unit(-8, "px")],
  ["size", "1.5rem", unit(1.5, "rem")],
  ["size", "16dvh", unit(16, "dvh")],
  ["percentage", "-50%", unit(-50, "%")],
  ["number", "-1", unit(-1, "number")],
  ["number", "0.5", unit(0.5, "number")],
] as const)("%s accepts %s", (type, input, value) => {
  expect(validateVariableValue(type, input)).toEqual({ ok: true, value });
});

test.each([
  ["size", "16"],
  ["size", "16deg"],
  ["percentage", "50"],
  ["number", "1px"],
  ["number", "Infinity"],
  ["color", "inherit"],
  ["color", "nope"],
  ["fontFamily", ""],
] as const)("%s refuses %s", (type, input) => {
  expect(validateVariableValue(type, input).ok).toBe(false);
});

test("color: hex 3, 4, 6, 8, rgb(), hsl(), a named colour as its keyword", () => {
  for (const input of [
    "#fff",
    "#ffff",
    "#ffffff",
    "#ffffff80",
    "rgb(0 0 0)",
    "hsl(0 0% 0%)",
  ]) {
    expect(validateVariableValue("color", input).ok).toBe(true);
  }
  expect(validateVariableValue("color", "red")).toEqual({
    ok: true,
    value: { type: "keyword", value: "red" },
  });
});

test("font family writes what the Font family control writes", () => {
  expect(validateVariableValue("fontFamily", "Inter")).toEqual({
    ok: true,
    value: parseCssValue("font-family", "Inter"),
  });
});

test("inference per stored kind", () => {
  const none = new Set<string>();
  expect(
    [
      { type: "rgb", r: 0, g: 0, b: 0, alpha: 1 },
      { type: "unparsed", value: "teal" },
      unit(8, "px"),
      unit(50, "%"),
      unit(2, "number"),
      unit(90, "deg"),
    ].map((value) => inferVariableType(value as StyleValue, none))
  ).toEqual(["color", "color", "size", "percentage", "number", undefined]);
  for (const value of ['"Inter"', "Inter, sans-serif", "serif", "system-ui"]) {
    expect(inferVariableType({ type: "unparsed", value }, none)).toBe(
      "fontFamily"
    );
  }
  expect(
    inferVariableType({ type: "unparsed", value: "Inter" }, new Set(["Inter"]))
  ).toBe("fontFamily");
  for (const value of [
    "Inter",
    "flex",
    "bold",
    "ease-in-out",
    "clamp(1rem, 2vw, 3rem)",
    "inherit",
  ]) {
    expect(
      inferVariableType({ type: "unparsed", value }, none)
    ).toBeUndefined();
  }
  expect(
    inferVariableType({ type: "var", value: "brand" }, none)
  ).toBeUndefined();
});
