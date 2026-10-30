import { describe, expect, test } from "vitest";
import {
  BLANK_CANONICAL_VALUES,
  CANONICAL_COLOR_NAMES,
  CANONICAL_FONT_NAMES,
  contrastRatio,
  isCanonicalName,
} from "./canonical-variables";

describe("the canonical names", () => {
  test("canonical names are the six of spec 6.3", () => {
    expect([...CANONICAL_COLOR_NAMES, ...CANONICAL_FONT_NAMES]).toEqual([
      "base",
      "accent-1",
      "accent-2",
      "text",
      "font-heading",
      "font-body",
    ]);
  });

  test("isCanonicalName tells a canonical name from any other string", () => {
    for (const name of [
      "base",
      "accent-1",
      "accent-2",
      "text",
      "font-heading",
      "font-body",
    ]) {
      expect(isCanonicalName(name), name).toBe(true);
    }
    for (const name of ["brand", "accent", "Base", "--base", "", "toString"]) {
      expect(isCanonicalName(name), name).toBe(false);
    }
  });
});

describe("the blank-start values", () => {
  test("blank values keep the blocks' current look", () => {
    expect(BLANK_CANONICAL_VALUES.base).toBe("#ffffff");
    expect(BLANK_CANONICAL_VALUES["accent-1"]).toBe("#18181b");
    expect(BLANK_CANONICAL_VALUES["accent-2"]).toBe("#2563eb");
    expect(BLANK_CANONICAL_VALUES.text).toBe("#18181b");
  });

  test("both fonts are the system stack", () => {
    const stack = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    expect(BLANK_CANONICAL_VALUES["font-heading"]).toBe(stack);
    expect(BLANK_CANONICAL_VALUES["font-body"]).toBe(stack);
  });

  test("there is a value for every canonical name, and no other", () => {
    expect(Object.keys(BLANK_CANONICAL_VALUES).sort()).toEqual(
      [...CANONICAL_COLOR_NAMES, ...CANONICAL_FONT_NAMES].sort()
    );
  });

  test("the blank text reads on the blank base", () => {
    expect(
      contrastRatio(BLANK_CANONICAL_VALUES.text, BLANK_CANONICAL_VALUES.base)
    ).toBeGreaterThan(4.5);
  });
});

describe("contrastRatio", () => {
  test("black on white is 21", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 2);
  });

  test("the same colour twice is 1", () => {
    expect(contrastRatio("#2563eb", "#2563eb")).toBeCloseTo(1, 5);
  });

  test("dark zinc on white passes AA for body text", () => {
    expect(contrastRatio("#18181b", "#ffffff")).toBeGreaterThan(4.5);
  });

  test("it is symmetric", () => {
    expect(contrastRatio("#18181b", "#ffffff")).toBe(
      contrastRatio("#ffffff", "#18181b")
    );
    expect(contrastRatio("#2563eb", "#f4f4f5")).toBe(
      contrastRatio("#f4f4f5", "#2563eb")
    );
  });

  test("it follows WCAG 2.1 for a mid colour", () => {
    // #777777 on white is the textbook 4.48:1, just under AA.
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    // #767676 is the lightest grey that passes AA on white.
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  test("it reads a colour case-insensitively", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 2);
  });

  test("it reads the three-digit shorthand", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 2);
    expect(contrastRatio("#f80", "#ff8800")).toBeCloseTo(1, 5);
  });

  test("it throws on anything that is not a hex colour", () => {
    for (const value of [
      "",
      "white",
      "ffffff",
      "#ffff",
      "#fffffff",
      "#gggggg",
      "#ffffff80",
      "rgb(0, 0, 0)",
      "var(--base)",
      " #ffffff",
    ]) {
      expect(() => contrastRatio(value, "#000000"), value).toThrow();
      expect(() => contrastRatio("#000000", value), value).toThrow();
    }
  });
});
