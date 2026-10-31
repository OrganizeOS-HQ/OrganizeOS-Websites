import { createElement } from "react";
import { expect, test } from "vitest";
import { renderTemplate, ws, type Token } from "@webstudio-is/template";
import { cardToken } from "../events/event-card.template";
import { approvedPalettes } from "../site-templates/__fixtures__/approved-palettes";
import {
  CANONICAL_COLOR_NAMES,
  contrastRatio,
} from "../site-templates/canonical-variables";
import { buttonToken, inputToken, messageToken } from "./form-tokens";

// The block tokens read the site's canonical variables (spec rule 2) with
// their old literal colours as fallbacks, so a site that defines no variable
// looks as it did.

const stylesOf = (token: Token) =>
  renderTemplate(
    createElement(ws.element, { "ws:tokens": [token] })
  ).styles.map(({ property, state, value }) => ({ property, state, value }));

const valueOf = (token: Token, property: string, state?: string) =>
  stylesOf(token).find(
    (style) => style.property === property && style.state === state
  )?.value;

const variable = (name: string, fallback: string) => ({
  type: "var",
  value: name,
  fallback: { type: "unparsed", value: fallback },
});

test("tokens read the canonical variables with fallbacks", () => {
  expect(valueOf(inputToken, "backgroundColor")).toEqual(
    variable("base", "#ffffff")
  );
  expect(valueOf(inputToken, "color")).toEqual(variable("text", "#18181b"));
  expect(valueOf(inputToken, "outlineColor", ":focus-visible")).toEqual(
    variable("accent-2", "#2563eb")
  );
  expect(valueOf(buttonToken, "backgroundColor")).toEqual(
    variable("accent-1", "#18181b")
  );
  expect(valueOf(buttonToken, "color")).toEqual(variable("base", "#ffffff"));
  expect(valueOf(buttonToken, "outlineColor", ":focus-visible")).toEqual(
    variable("accent-2", "#2563eb")
  );
  expect(valueOf(cardToken, "backgroundColor")).toEqual(
    variable("base", "#ffffff")
  );
  expect(valueOf(cardToken, "color")).toEqual(variable("text", "#18181b"));
  expect(valueOf(messageToken, "color")).toEqual(variable("text", "#52525b"));
  expect(valueOf(messageToken, "color", "[data-invalid]")).toEqual(
    variable("text", "#b91c1c")
  );
  // the invalid border is longhands, as the focus ring: the shorthand would
  // resolve the variable to its fallback when it is parsed
  expect(valueOf(inputToken, "borderTopColor", "[data-invalid]")).toEqual(
    variable("text", "#dc2626")
  );
});

test("an invalid message is bolder and an invalid input's border thicker, so colour is not the only mark", () => {
  expect(valueOf(messageToken, "fontWeight")).toBeUndefined();
  expect(valueOf(messageToken, "fontWeight", "[data-invalid]")).toEqual({
    type: "unit",
    unit: "number",
    value: 600,
  });
  for (const side of ["Top", "Right", "Bottom", "Left"]) {
    expect(valueOf(inputToken, `border${side}Width`, "[data-invalid]")).toEqual(
      { type: "unit", unit: "px", value: 2 }
    );
    expect(valueOf(inputToken, `border${side}Style`, "[data-invalid]")).toEqual(
      { type: "keyword", value: "solid" }
    );
  }
});

test("an invalid input keeps its size: the extra border width is taken from the padding", () => {
  const px = (token: Token, property: string, state?: string) => {
    const value = valueOf(token, property, state);
    if (value?.type !== "unit" || value.unit !== "px") {
      throw new Error(`${property} ${state ?? ""} is not a px length`);
    }
    return value.value;
  };
  for (const side of ["Top", "Right", "Bottom", "Left"]) {
    const outer = (state?: string) =>
      px(inputToken, `padding${side}`, state) +
      px(inputToken, `border${side}Width`, state);
    // the invalid state sets all of its own, so none falls back to the
    // resting value by omission
    expect(outer("[data-invalid]"), side).toBe(outer());
  }
});

test("the focus ring keeps its width, style and offset as longhands", () => {
  for (const token of [inputToken, buttonToken]) {
    expect(valueOf(token, "outlineWidth", ":focus-visible")).toEqual({
      type: "unit",
      unit: "px",
      value: 2,
    });
    expect(valueOf(token, "outlineStyle", ":focus-visible")).toEqual({
      type: "keyword",
      value: "solid",
    });
    expect(valueOf(token, "outlineOffset", ":focus-visible")).toBeDefined();
  }
});

test("the resting borders stay literal", () => {
  expect(valueOf(inputToken, "borderTopColor")?.type).not.toBe("var");
  expect(valueOf(cardToken, "borderTopColor")?.type).not.toBe("var");
});

// Every colour a block's text or border reads from a variable, on the
// background the same token sets (the base when it sets none), over every
// approved palette and the blank start. Text is read, so it needs 4.5:1
// (WCAG AA); a border or an invalid-state outline is a graphic, 3:1.
const colourNames: readonly string[] = CANONICAL_COLOR_NAMES;
const tokens = [
  ["OS Input", inputToken],
  ["OS Button", buttonToken],
  ["OS Message", messageToken],
  ["OS Card", cardToken],
] as const;

type Reading = {
  label: string;
  foreground: string;
  background: string;
  minimum: number;
};

const readings = (): Reading[] =>
  tokens.flatMap(([name, token]) => {
    const background = valueOf(token, "backgroundColor");
    const backgroundName =
      background?.type === "var" ? background.value : "base";
    return stylesOf(token).flatMap(({ property, state, value }) => {
      const isText = property === "color";
      const isBorder = /^border(Top|Right|Bottom|Left)Color$/.test(property);
      if (
        (isText === false && isBorder === false) ||
        value.type !== "var" ||
        colourNames.includes(value.value) === false
      ) {
        return [];
      }
      return {
        label: `${name} ${property}${state ?? ""}`,
        foreground: value.value,
        background: backgroundName,
        minimum: isText ? 4.5 : 3,
      };
    });
  });

test("the colours the contrast test reads are the ones the blocks read from variables", () => {
  // a token that stops reading a variable, or starts reading one, changes
  // this list and is looked at here before the ratios are
  expect(
    readings().map(({ label, foreground, background }) => [
      label,
      foreground,
      background,
    ])
  ).toEqual([
    ["OS Input color", "text", "base"],
    ["OS Input borderTopColor[data-invalid]", "text", "base"],
    ["OS Input borderRightColor[data-invalid]", "text", "base"],
    ["OS Input borderBottomColor[data-invalid]", "text", "base"],
    ["OS Input borderLeftColor[data-invalid]", "text", "base"],
    ["OS Button color", "base", "accent-1"],
    ["OS Message color", "text", "base"],
    ["OS Message color[data-invalid]", "text", "base"],
    ["OS Card color", "text", "base"],
  ]);
});

test("the contrast test runs over the five approved palettes and the blank start", () => {
  expect(approvedPalettes.map(({ name }) => name)).toEqual([
    "Field Journal",
    "Porch Light",
    "Workwear",
    "Marigold Marquee",
    "Riso Broadside",
    "Blank",
  ]);
});

test.each(approvedPalettes.map((palette) => [palette.name, palette] as const))(
  "block text and borders keep their contrast on the %s palette",
  (_name, palette) => {
    for (const { label, foreground, background, minimum } of readings()) {
      const ratio = contrastRatio(
        palette.colors[foreground as keyof typeof palette.colors],
        palette.colors[background as keyof typeof palette.colors]
      );
      expect(ratio, label).toBeGreaterThanOrEqual(minimum);
    }
  }
);
