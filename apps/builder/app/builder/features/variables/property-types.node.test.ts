import { describe, expect, test } from "vitest";
import { propertiesData } from "@webstudio-is/css-data";
import type { CssProperty } from "@webstudio-is/css-engine";
import {
  COLOR_PROPERTIES,
  EXCLUDED_PROPERTIES,
  INTEGER_PROPERTIES,
  getBindableTypes,
} from "./property-types";

const typesOf = (properties: CssProperty[]) => {
  const types = getBindableTypes(properties);
  return types && [...types].sort();
};

const unitGroupsOf = (property: string) =>
  (propertiesData as Record<string, { unitGroups: readonly string[] }>)[
    property
  ]?.unitGroups;

const borderColors: CssProperty[] = [
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
];

const radii: CssProperty[] = [
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
];

const exclusions = [
  "aspect-ratio",
  "background-attachment",
  "background-blend-mode",
  "background-clip",
  "background-image",
  "background-origin",
  "background-position-x",
  "background-position-y",
  "background-repeat",
  "background-size",
  "font-weight",
  "grid-column-end",
  "grid-column-start",
  "grid-row-end",
  "grid-row-start",
  "object-position",
  "perspective-origin",
  "transform-origin",
];

describe("getBindableTypes", () => {
  test("colour properties take Color, font-family takes Font family", () => {
    expect([...COLOR_PROPERTIES].sort()).toEqual([
      "background-color",
      "border-bottom-color",
      "border-left-color",
      "border-right-color",
      "border-top-color",
      "color",
      "outline-color",
    ]);
    for (const property of COLOR_PROPERTIES) {
      expect(typesOf([property]), property).toEqual(["color"]);
    }
    expect(typesOf(["font-family"])).toEqual(["fontFamily"]);
  });

  test("other properties take their unit groups' types", () => {
    for (const property of [
      "width",
      "margin-top",
      "top",
      "font-size",
      "flex-basis",
    ] as CssProperty[]) {
      expect(typesOf([property]), property).toEqual(["percentage", "size"]);
    }
    expect(typesOf(["line-height"])).toEqual(["number", "percentage", "size"]);
    for (const property of [
      "letter-spacing",
      "outline-offset",
      "border-top-width",
      "perspective",
    ] as CssProperty[]) {
      expect(typesOf([property]), property).toEqual(["size"]);
    }
    for (const property of ["z-index", "order", "flex-grow"] as CssProperty[]) {
      expect(typesOf([property]), property).toEqual(["number"]);
    }
  });

  test("a row binds only when every property maps to the same types", () => {
    expect(typesOf(borderColors)).toEqual(["color"]);
    expect(typesOf(radii)).toEqual(["percentage", "size"]);
    expect(typesOf(["flex-grow", "flex-shrink", "flex-basis"])).toBe(undefined);
    expect(typesOf([])).toBe(undefined);
  });

  test("keyword-only properties take nothing", () => {
    for (const property of [
      "display",
      "position",
      "overflow-x",
      "object-fit",
      "border-top-style",
      "list-style-type",
    ] as CssProperty[]) {
      expect(typesOf([property]), property).toBe(undefined);
    }
  });

  test("the exclusions take nothing; background-color keeps Color", () => {
    expect([...EXCLUDED_PROPERTIES].sort()).toEqual(exclusions);
    for (const property of EXCLUDED_PROPERTIES) {
      expect(typesOf([property]), property).toBe(undefined);
    }
    expect(typesOf(["background-color"])).toEqual(["color"]);
  });

  test("the types come in the form's order", () => {
    expect([...(getBindableTypes(["line-height"]) ?? [])]).toEqual([
      "size",
      "percentage",
      "number",
    ]);
  });
});

test("the lists name real properties", () => {
  for (const property of [
    ...COLOR_PROPERTIES,
    ...EXCLUDED_PROPERTIES,
    ...INTEGER_PROPERTIES,
  ]) {
    expect(unitGroupsOf(property), property).toBeDefined();
  }
  for (const property of COLOR_PROPERTIES) {
    expect(unitGroupsOf(property), property).toEqual([]);
  }
  expect([...INTEGER_PROPERTIES].sort()).toEqual(["order", "z-index"]);
  for (const property of INTEGER_PROPERTIES) {
    expect(unitGroupsOf(property), property).toEqual(["number"]);
  }
});
