import { describe, expect, test } from "vitest";
import { toValue, type StyleValue } from "@webstudio-is/css-engine";
import { parseCssValue } from "@webstudio-is/css-data";
import { toCss, toKeyframeProperty, type KeyframeValue } from "./to-css";

describe("toCss", () => {
  test("unit, with a number written bare", () => {
    expect(toCss({ type: "unit", value: 12, unit: "px" })).toBe("12px");
    expect(toCss({ type: "unit", value: -24.5, unit: "%" })).toBe("-24.5%");
    expect(toCss({ type: "unit", value: 0, unit: "number" })).toBe("0");
  });

  test("keyword", () => {
    expect(toCss({ type: "keyword", value: "none" })).toBe("none");
  });

  test("unparsed", () => {
    expect(toCss({ type: "unparsed", value: "inset(0 100% 0 0)" })).toBe(
      "inset(0 100% 0 0)"
    );
  });

  test("var, with and without a fallback", () => {
    expect(toCss({ type: "var", value: "rise" })).toBe("var(--rise)");
    expect(
      toCss({
        type: "var",
        value: "rise",
        fallback: { type: "unit", value: 12, unit: "px" },
      })
    ).toBe("var(--rise, 12px)");
    expect(
      toCss({
        type: "var",
        value: "tint",
        fallback: { type: "rgb", r: 1, g: 2, b: 3, alpha: 1 },
      })
    ).toBe("var(--tint, rgb(1 2 3 / 1))");
  });

  test("rgb", () => {
    expect(toCss({ type: "rgb", r: 255, g: 0, b: 10, alpha: 0.5 })).toBe(
      "rgb(255 0 10 / 0.5)"
    );
  });

  test("color in sRGB and hex", () => {
    expect(
      toCss({
        type: "color",
        colorSpace: "srgb",
        components: [1, 0.5, 0],
        alpha: 1,
      })
    ).toBe("rgb(255 128 0 / 1)");
    expect(
      toCss({
        type: "color",
        colorSpace: "srgb",
        components: [0, 0, 0],
        alpha: { type: "var", value: "a" },
      })
    ).toBe("rgb(0 0 0 / var(--a))");
    expect(
      toCss({
        type: "color",
        colorSpace: "hex",
        components: [1, 0, 0],
        alpha: 1,
      })
    ).toBe("#ff0000");
    expect(
      toCss({
        type: "color",
        colorSpace: "hex",
        components: [0, 0, 1],
        alpha: 0.5,
      })
    ).toBe("#0000ff80");
  });

  test("tuple of supported items, hidden items left out", () => {
    expect(
      toCss({
        type: "tuple",
        value: [
          { type: "unit", value: 0, unit: "number" },
          { type: "unit", value: 12, unit: "px" },
          { type: "unit", value: 3, unit: "px", hidden: true },
        ],
      })
    ).toBe("0 12px");
    expect(
      toCss({
        type: "tuple",
        value: [{ type: "unit", value: 1, unit: "px" }],
        hidden: true,
      })
    ).toBe("none");
  });

  test("layers of supported items", () => {
    expect(
      toCss({
        type: "layers",
        value: [
          { type: "keyword", value: "opacity" },
          { type: "unparsed", value: "translate" },
          { type: "keyword", value: "scale", hidden: true },
        ],
      })
    ).toBe("opacity, translate");
    expect(
      toCss({
        type: "layers",
        value: [
          {
            type: "tuple",
            value: [
              { type: "unit", value: 1, unit: "px" },
              { type: "unit", value: 2, unit: "px" },
            ],
          },
          { type: "var", value: "x" },
        ],
      })
    ).toBe("1px 2px, var(--x)");
  });

  test("function, shadow and image are not played (spec 14.5)", () => {
    expect(
      toCss({
        type: "function",
        name: "blur",
        args: {
          type: "layers",
          value: [{ type: "unit", value: 4, unit: "px" }],
        },
      })
    ).toBeUndefined();
    expect(
      toCss({
        type: "shadow",
        position: "outset",
        offsetX: { type: "unit", value: 1, unit: "px" },
        offsetY: { type: "unit", value: 1, unit: "px" },
      })
    ).toBeUndefined();
    expect(
      toCss({ type: "image", value: { type: "asset", value: "a" } })
    ).toBeUndefined();
  });

  test("anything else is unconvertible", () => {
    const unsupported: KeyframeValue[] = [
      { type: "fontFamily", value: ["Inter"] },
      { type: "invalid", value: "12qq" },
      { type: "unset", value: "" },
      { type: "guaranteedInvalid" },
      {
        type: "color",
        colorSpace: "oklch",
        components: [0.5, 0.1, 30],
        alpha: 1,
      },
      // one unsupported item makes the whole value unsupported
      {
        type: "tuple",
        value: [
          { type: "unit", value: 1, unit: "px" },
          { type: "image", value: { type: "asset", value: "a" } },
        ],
      },
      {
        type: "layers",
        value: [
          {
            type: "function",
            name: "blur",
            args: { type: "unit", value: 1, unit: "px" },
          },
        ],
      },
      // a value toValue writes as nothing
      { type: "keyword", value: "auto", hidden: true },
      { type: "var", value: "x", hidden: true },
    ];
    for (const value of unsupported) {
      expect(toCss(value)).toBeUndefined();
    }
    expect(toCss(undefined as unknown as KeyframeValue)).toBeUndefined();
    expect(toCss(null as unknown as KeyframeValue)).toBeUndefined();
  });
});

describe("parity with css-engine's toValue", () => {
  const supported: StyleValue[] = [
    { type: "unit", value: 12, unit: "px" },
    { type: "unit", value: 0.25, unit: "number" },
    { type: "unit", value: -1.5, unit: "rem", hidden: true },
    { type: "keyword", value: "auto" },
    { type: "unparsed", value: "inset(0 0 0 0)" },
    { type: "unparsed", value: "x", hidden: true },
    { type: "var", value: "rise" },
    {
      type: "var",
      value: "rise",
      fallback: { type: "unparsed", value: "1px 2px" },
    },
    {
      type: "var",
      value: "tint",
      fallback: {
        type: "color",
        colorSpace: "hex",
        components: [0.2, 0.4, 0.6],
        alpha: 0.3,
      },
    },
    { type: "rgb", r: 10, g: 20, b: 30, alpha: 0.4 },
    {
      type: "color",
      colorSpace: "srgb",
      components: [0.1, 0.2, 0.3],
      alpha: 0.7,
    },
    {
      type: "color",
      colorSpace: "srgb",
      components: [0, 0, 0],
      alpha: { type: "var", value: "alpha" },
    },
    {
      type: "color",
      colorSpace: "hex",
      components: [1.2, -0.1, 0.5],
      alpha: 1,
    },
    {
      type: "tuple",
      value: [
        { type: "unit", value: 0, unit: "number" },
        { type: "keyword", value: "auto" },
        { type: "var", value: "y" },
        { type: "rgb", r: 1, g: 1, b: 1, alpha: 1 },
      ],
    },
    { type: "tuple", value: [], hidden: true },
    {
      type: "layers",
      value: [
        { type: "unit", value: 1, unit: "s" },
        { type: "unparsed", value: "a b" },
        {
          type: "tuple",
          value: [{ type: "unit", value: 2, unit: "px" }],
        },
      ],
    },
    {
      type: "layers",
      value: [{ type: "keyword", value: "x", hidden: true }],
    },
  ];

  test("every supported type", () => {
    for (const value of supported) {
      expect(toCss(value)).toBe(toValue(value));
    }
  });

  // Upstream's preset literals (new-view-animations.ts and
  // new-scroll-animations.ts) and this spec's (4.4), as the editor parses them.
  const literals: Array<[property: string, value: string]> = [
    ["opacity", "0"],
    ["translate", "0 100px"],
    ["translate", "0 -100px"],
    ["clip-path", "inset(0 100% 0 0)"],
    ["clip-path", "inset(0 0 0 0)"],
    ["clip-path", "inset(0 0 0 100%)"],
    ["translate", "0 12px"],
    ["translate", "0 24px"],
    ["translate", "0 -24px"],
  ];

  test.each(literals)("%s: %s", (property, literal) => {
    const value = parseCssValue(
      property as Parameters<typeof parseCssValue>[0],
      literal
    );
    expect(value.type).not.toBe("invalid");
    const css = toCss(value);
    expect(css).toBeDefined();
    expect(css).toBe(toValue(value));
  });
});

describe("toKeyframeProperty", () => {
  test("hyphenated names become IDL camelCase", () => {
    expect(toKeyframeProperty("clip-path")).toBe("clipPath");
    expect(toKeyframeProperty("background-color")).toBe("backgroundColor");
    expect(toKeyframeProperty("border-top-left-radius")).toBe(
      "borderTopLeftRadius"
    );
    expect(toKeyframeProperty("opacity")).toBe("opacity");
    expect(toKeyframeProperty("translate")).toBe("translate");
  });

  test("custom properties stay as they are", () => {
    expect(toKeyframeProperty("--x")).toBe("--x");
    expect(toKeyframeProperty("--my-rise")).toBe("--my-rise");
  });

  test("names WAAPI renames", () => {
    expect(toKeyframeProperty("float")).toBe("cssFloat");
    expect(toKeyframeProperty("offset")).toBe("cssOffset");
    expect(toKeyframeProperty("-webkit-text-stroke")).toBe("webkitTextStroke");
  });
});
