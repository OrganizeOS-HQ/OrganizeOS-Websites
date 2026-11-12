import { expect, test } from "vitest";
import type { CssProperty, StyleValue } from "@webstudio-is/css-engine";
import { parseCssValue } from "@webstudio-is/css-data";
import type { VariableRow } from "./reader";
import { matchesVariableSearch } from "./search";

const row = (overrides: Partial<VariableRow>): VariableRow => ({
  cssName: "accent",
  displayName: "Accent",
  group: undefined,
  collectionId: "site",
  type: "color",
  value: parseCssValue("color", "#ff0000"),
  registered: true,
  locked: false,
  ...overrides,
});

test("matches display name, group, CSS name and value text, ignoring case; an empty query matches all", () => {
  const large = row({
    cssName: "spacing--large",
    displayName: "Spacing/Large",
    group: "Spacing",
    type: "size",
    value: parseCssValue("--x" as CssProperty, "16px"),
  });
  for (const query of [
    "large",
    "SPACING",
    "spacing--",
    "16px",
    "16",
    "",
    "  ",
  ]) {
    expect(matchesVariableSearch(large, undefined, query), query).toBe(true);
  }
  expect(matchesVariableSearch(large, undefined, "nope")).toBe(false);
});

test("#ff0000 matches '#ff0000', 'ff0000', '#f00', 'f00' and 'red'; rgb(255 0 0) matches 'red' and '#f00'; #1597b0 does not match '#f00'", () => {
  const red = row({});
  for (const query of ["#ff0000", "ff0000", "#f00", "f00", "red", "RED"]) {
    expect(matchesVariableSearch(red, undefined, query), query).toBe(true);
  }
  const rgb = row({ value: parseCssValue("color", "rgb(255 0 0)") });
  expect(matchesVariableSearch(rgb, undefined, "red")).toBe(true);
  expect(matchesVariableSearch(rgb, undefined, "#f00")).toBe(true);
  const teal = row({ value: parseCssValue("color", "#1597b0") });
  expect(matchesVariableSearch(teal, undefined, "#f00")).toBe(false);
  expect(matchesVariableSearch(teal, undefined, "red")).toBe(false);
});

test("an alias matches by the colour it resolves to", () => {
  const alias = row({ value: { type: "var", value: "brand-blue" } });
  const resolved: StyleValue = parseCssValue("color", "#ff0000");
  expect(matchesVariableSearch(alias, resolved, "red")).toBe(true);
  expect(matchesVariableSearch(alias, resolved, "brand-blue")).toBe(true);
});

test("an unresolved colour matches by name only and never throws", () => {
  const gone = row({ value: { type: "var", value: "gone" } });
  const unresolved: StyleValue = { type: "guaranteedInvalid" };
  expect(matchesVariableSearch(gone, unresolved, "red")).toBe(false);
  expect(matchesVariableSearch(gone, unresolved, "accent")).toBe(true);
  const missing = row({ value: undefined });
  expect(matchesVariableSearch(missing, undefined, "red")).toBe(false);
  expect(matchesVariableSearch(missing, undefined, "accent")).toBe(true);
});
