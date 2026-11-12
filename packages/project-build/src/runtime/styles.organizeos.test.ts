// OrganizeOS fork: the whole-name CSS variable rename (docs/ORGANIZEOS-FORK.md section 7)
import { expect, test } from "vitest";
import type { StyleDecl } from "@webstudio-is/sdk";
import type { StyleProperty, StyleValue } from "@webstudio-is/css-engine";
import {
  collectCssVariableReferences,
  createCssVariableNamesRegex,
  createCssVariableRenamePayload,
  getCssVariableUsageCounts,
  rewriteCssVariableReferencesInString,
  rewriteCssVariableReferencesInStyleValue,
} from "./styles";

const v = (value: string) => ({ type: "var", value }) as const;

const decl = (
  styleSourceId: string,
  property: string,
  value: string | StyleValue
): StyleDecl => ({
  styleSourceId,
  breakpointId: "base",
  property: property as StyleProperty,
  value: typeof value === "string" ? { type: "unparsed", value } : value,
});

const rename = (value: StyleValue, from = "--large", to = "--big") =>
  rewriteCssVariableReferencesInStyleValue(value, { [from]: to });

test("keywords equal to the bare name are untouched", () => {
  expect(
    rename({ type: "keyword", value: "black" }, "--black", "--ink")
  ).toEqual({ type: "keyword", value: "black" });
  expect(
    rename(
      { type: "layers", value: [{ type: "keyword", value: "text" }] },
      "--text",
      "--copy"
    )
  ).toEqual({ type: "layers", value: [{ type: "keyword", value: "text" }] });
});

test("VarValues are renamed by whole name: whole, tuple, layer, function args, shadow, colour alpha", () => {
  expect(rename(v("large"))).toEqual(v("big"));
  expect(
    rename({ type: "tuple", value: [v("large"), v("spacing--large")] })
  ).toEqual({ type: "tuple", value: [v("big"), v("spacing--large")] });
  expect(
    rename({
      type: "layers",
      value: [
        {
          type: "function",
          name: "drop-shadow",
          args: { type: "tuple", value: [v("large")] },
        },
      ],
    })
  ).toEqual({
    type: "layers",
    value: [
      {
        type: "function",
        name: "drop-shadow",
        args: { type: "tuple", value: [v("big")] },
      },
    ],
  });
  expect(
    rename({
      type: "shadow",
      position: "outset",
      offsetX: v("large"),
      offsetY: v("spacing--large"),
      blur: v("large"),
    })
  ).toMatchObject({
    offsetX: v("big"),
    offsetY: v("spacing--large"),
    blur: v("big"),
  });
  expect(
    rename({
      type: "color",
      colorSpace: "srgb",
      components: [0, 0, 0],
      alpha: v("large"),
    })
  ).toMatchObject({ alpha: v("big") });
  expect(
    rename({
      type: "var",
      value: "large",
      fallback: { type: "unparsed", value: "var(--large)" },
    })
  ).toEqual({
    type: "var",
    value: "big",
    fallback: { type: "unparsed", value: "var(--big)" },
  });
});

test("--large leaves --spacing--large alone in unparsed text, fallbacks and Embed code", () => {
  expect(
    rename({
      type: "unparsed",
      value: "calc(var(--spacing--large) + var(--large))",
    })
  ).toEqual({
    type: "unparsed",
    value: "calc(var(--spacing--large) + var(--big))",
  });
  expect(
    rename({
      type: "var",
      value: "gap",
      fallback: {
        type: "unparsed",
        value: "var(--spacing--large, var(--large))",
      },
    })
  ).toEqual({
    type: "var",
    value: "gap",
    fallback: { type: "unparsed", value: "var(--spacing--large, var(--big))" },
  });
  expect(
    rewriteCssVariableReferencesInString(
      ".a{margin:var(--spacing--large);padding:var(--large, 1rem)}",
      { "--large": "--big" }
    )
  ).toBe(".a{margin:var(--spacing--large);padding:var(--big, 1rem)}");
});

test("the rename payload touches --large's references only", () => {
  const styles = [
    decl("root", "--large", "1px"),
    decl("root", "--spacing--large", "2px"),
    decl("box", "paddingTop", v("spacing--large")),
    decl("box", "marginTop", v("large")),
  ];
  const { styleKeys } = createCssVariableRenamePayload({
    oldName: "--large",
    newName: "--big",
    styles,
    props: [],
  });
  expect(styleKeys).toEqual([
    "root:base:--large:",
    "root:base:--big:",
    "box:base:marginTop:",
  ]);
});

test("usage counts no longer count --spacing--large for --large", () => {
  const counts = getCssVariableUsageCounts({
    styles: [
      decl("root", "--large", "1px"),
      decl("root", "--spacing--large", "2px"),
      decl("box", "paddingTop", "var(--spacing--large)"),
    ],
    props: [],
  });
  expect(counts.get("--large")).toBeUndefined();
  expect(counts.get("--spacing--large")).toBe(1);
  expect(
    collectCssVariableReferences(
      "var(--spacing--large)",
      createCssVariableNamesRegex(new Set(["--large"]))
    )
  ).toEqual(new Set());
});

test("a var() inside a font family stack is renamed by whole name, as upstream's JSON rewrite did", () => {
  expect(
    rename(
      {
        type: "fontFamily",
        value: ["var(--display)", "var(--display-alt)", "Georgia", "serif"],
      },
      "--display",
      "--headline"
    )
  ).toEqual({
    type: "fontFamily",
    value: ["var(--headline)", "var(--display-alt)", "Georgia", "serif"],
  });
});
