import { expect, test } from "vitest";
import {
  BRAND_DISPLAY_NAMES,
  CSS_NAME_PATTERN,
  displayNameFromCssName,
  isProtectedName,
  slugifyDisplayName,
  uniqueCssName,
} from "./names";

test("slugs: NFKD without diacritics, lowercase, / as --, other runs as one -", () => {
  expect(
    [
      "Spacing/Large",
      " Spacing / Large ",
      "Brand Blue",
      "Café  Crème",
      "!!!",
    ].map(slugifyDisplayName)
  ).toEqual([
    "spacing--large",
    "spacing--large",
    "brand-blue",
    "cafe-creme",
    "variable",
  ]);
});

// Review Focus 2
test("display names that collide or vanish when slugged stay distinct, never empty, never protected", () => {
  const taken = new Set<string>();
  const add = (displayName: string) => {
    const name = uniqueCssName(slugifyDisplayName(displayName), taken);
    taken.add(name);
    return name;
  };
  expect(
    [
      "Cafe",
      "Café",
      "Brand Blue",
      "brand-blue",
      "!!!",
      "???",
      "Base",
      "Text",
      "Focus ring",
    ].map(add)
  ).toEqual([
    "cafe",
    "cafe-2",
    "brand-blue",
    "brand-blue-2",
    "variable",
    "variable-2",
    "base-2",
    "text-2",
    "focus-ring-2",
  ]);
  // accent-2 is canonical
  expect(uniqueCssName("accent", new Set(["accent"]))).toBe("accent-3");
});

test("the six canonical and the two band names are protected; Brand display names", () => {
  for (const name of [
    "base",
    "accent-1",
    "accent-2",
    "text",
    "font-heading",
    "font-body",
    "focus-ring",
    "accent-text",
  ]) {
    expect(isProtectedName(name)).toBe(true);
  }
  expect(isProtectedName("brand-blue")).toBe(false);
  expect(Object.values(BRAND_DISPLAY_NAMES)).toEqual([
    "Base",
    "Accent 1",
    "Accent 2",
    "Text",
    "Heading font",
    "Body font",
  ]);
});

test("the Cmd+K name pattern", () => {
  for (const name of ["a", "a1", "a-b", "a--b", "spacing--large"]) {
    expect(name).toMatch(CSS_NAME_PATTERN);
  }
  for (const name of ["a-", "-a", "a---b", "Big", "a b", ""]) {
    expect(name).not.toMatch(CSS_NAME_PATTERN);
  }
});

test("display names from CSS names", () => {
  expect(displayNameFromCssName("spacing--large")).toBe("spacing/large");
});
