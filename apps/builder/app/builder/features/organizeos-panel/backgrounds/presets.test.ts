import { beforeEach, describe, expect, test } from "vitest";
import { toValue, type StyleValue } from "@webstudio-is/css-engine";
import { parseCssValue } from "@webstudio-is/css-data";
import { parseAnyGradient } from "~/builder/features/style-panel/sections/backgrounds/gradient-utils";
import { composite, contrastRatio, quantize, type Rgba } from "./color";
import {
  builtInPalette,
  getReferenceTextColor,
  layerProperties,
  presets,
  scrimAlpha,
  type Palette,
  type PresetId,
  type PresetStyles,
} from "./presets";
import { checkSectionContrast } from "./contrast";
import {
  el,
  registerTestMetas,
  root,
  setupProject,
  type TestStyle,
} from "./test-fixtures";

const black: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const white: Rgba = { r: 1, g: 1, b: 1, a: 1 };

const variablePalette: Palette = {
  base: {
    rgba: { r: 0.99, g: 0.98, b: 0.96, a: 1 },
    variable: "surface",
  },
  accent1: { rgba: { r: 0.04, g: 0.43, b: 0.31, a: 1 }, variable: "brand" },
  accent2: {
    rgba: { r: 0.95, g: 0.6, b: 0.2, a: 1 },
    variable: "brand-warm",
  },
};

const palettes = [
  ["the built-in palette", builtInPalette],
  ["a variable-backed palette", variablePalette],
] as const;

// gradient stop counts per background-image layer, as each recipe writes them
const stopCounts: Record<PresetId, number[]> = {
  "bloom-light": [2, 2, 2, 2],
  "bloom-strong": [2, 2, 2, 2],
  "bloom-dark": [2, 2, 2, 2],
  "wash-light": [2],
  "wash-dark": [2],
  "tint-light": [],
  "tint-dark": [],
  "image-scrim-light": [2],
  "image-scrim-dark": [2],
};

// presets whose background-color is the palette's base, opaque and untinted
const untintedBase = new Set<PresetId>([
  "bloom-light",
  "bloom-strong",
  "wash-light",
  "image-scrim-light",
]);

const getValue = (styles: PresetStyles, property: string) =>
  styles.find((entry) => entry.property === property)?.value;

const layerItems = (value: StyleValue | undefined) => {
  expect(value?.type).toBe("layers");
  return value?.type === "layers" ? value.value : [];
};

describe("presets", () => {
  test("nine presets, one per id, with distinct labels", () => {
    expect(presets.map((preset) => preset.id)).toEqual(Object.keys(stopCounts));
    expect(new Set(presets.map((preset) => preset.label)).size).toBe(9);
  });

  test("the built-in palette is white with OrganizeOS teal and aqua", () => {
    expect(quantize(builtInPalette.base.rgba)).toBe("255,255,255,255");
    expect(quantize(builtInPalette.accent1.rgba)).toBe("21,151,176,255");
    expect(quantize(builtInPalette.accent2.rgba)).toBe("63,201,224,255");
    expect(quantize(builtInPalette.text!.rgba)).toBe("17,17,17,255");
    expect(builtInPalette.base.variable).toBeUndefined();
  });

  describe.each(palettes)("with %s", (_name, palette) => {
    describe.each(presets.map((preset) => [preset.id, preset] as const))(
      "%s",
      (id, preset) => {
        const optionsList = [
          undefined,
          ...(preset.family === "image-scrim"
            ? [{ imageAssetId: "asset-1" }]
            : []),
        ];

        test.each(optionsList.map((options) => [options] as const))(
          "writes background-color and the nine layer lists, never background-position (options %o)",
          (options) => {
            const styles = preset.build(palette, options);
            expect(styles.map((entry) => entry.property)).toEqual([
              "background-color",
              ...layerProperties,
            ]);
            expect(
              styles.some(
                (entry) => (entry.property as string) === "background-position"
              )
            ).toBe(false);
            const lengths = layerProperties.map(
              (property) => layerItems(getValue(styles, property)).length
            );
            const imageLayers =
              stopCounts[id].length === 0
                ? 1
                : stopCounts[id].length + (options?.imageAssetId ? 1 : 0);
            expect(lengths).toEqual(layerProperties.map(() => imageLayers));
          }
        );

        test("every gradient layer round-trips through parseAnyGradient with all its stops", () => {
          const styles = preset.build(palette, { imageAssetId: "asset-1" });
          const items = layerItems(getValue(styles, "background-image"));
          const gradients = items.filter(
            (item) => item.type === "unparsed" && item.value !== "none"
          );
          expect(gradients.length).toBe(stopCounts[id].length);
          gradients.forEach((item, index) => {
            const parsed =
              item.type === "unparsed"
                ? parseAnyGradient(item.value)
                : undefined;
            expect(parsed).toBeDefined();
            expect(parsed!.stops.length).toBe(stopCounts[id][index]);
            for (const stop of parsed!.stops) {
              expect(stop.hint).toBeUndefined();
              expect(stop.position).toBeDefined();
              // every stop a recipe writes carries alpha, so it is a literal
              expect(stop.color?.type).toBe("color");
              if (stop.color?.type === "color") {
                expect(typeof stop.color.alpha).toBe("number");
                expect(stop.color.alpha).toBeLessThan(1);
              }
            }
          });
          if (preset.family === "image-scrim") {
            expect(items.at(-1)).toEqual({
              type: "image",
              value: { type: "asset", value: "asset-1" },
            });
          }
        });

        test("every written value round-trips through parseCssValue", () => {
          const styles = preset.build(palette);
          for (const { property, value } of styles) {
            expect(parseCssValue(property, toValue(value))).toEqual(value);
          }
        });

        test("background-color is var(--name) only for an untinted base with a variable", () => {
          const value = getValue(preset.build(palette), "background-color");
          if (untintedBase.has(id) && palette.base.variable !== undefined) {
            expect(value).toEqual({
              type: "var",
              value: palette.base.variable,
            });
          } else {
            expect(value?.type).toBe("color");
          }
        });
      }
    );
  });

  test("the reference text is the palette's text for light presets and white for dark", () => {
    const light = presets.find((preset) => preset.id === "bloom-light")!;
    const dark = presets.find((preset) => preset.id === "bloom-dark")!;
    expect(quantize(getReferenceTextColor(light, builtInPalette))).toBe(
      "17,17,17,255"
    );
    expect(quantize(getReferenceTextColor(light, variablePalette))).toBe(
      "17,17,17,255"
    );
    expect(getReferenceTextColor(dark, builtInPalette)).toEqual(white);
  });
});

describe("scrimAlpha", () => {
  const passesOverAnyImage = (base: Rgba, text: Rgba, alpha: number) =>
    contrastRatio(text, composite({ ...base, a: alpha }, black)) >= 4.5 &&
    contrastRatio(text, composite({ ...base, a: alpha }, white)) >= 4.5;

  test.each([
    ["a white scrim for #111111", white, builtInPalette.text!.rgba],
    [
      "a dark teal scrim for white",
      composite({ ...builtInPalette.accent1.rgba, a: 0.22 }, black),
      white,
    ],
    ["a black scrim for white", black, white],
  ])(
    "is the smallest 0.01 step that passes over black and white: %s",
    (_name, base, text) => {
      const alpha = scrimAlpha(base, text);
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThan(1);
      expect(Math.round(alpha * 100)).toBe(alpha * 100);
      expect(passesOverAnyImage(base, text, alpha)).toBe(true);
      expect(passesOverAnyImage(base, text, alpha - 0.01)).toBe(false);
    }
  );

  test("a white scrim for #111111 needs about half alpha", () => {
    expect(scrimAlpha(white, builtInPalette.text!.rgba)).toBe(0.49);
  });

  test("is 1 when even the opaque base fails the reference", () => {
    const gray: Rgba = { r: 0.6, g: 0.6, b: 0.6, a: 1 };
    expect(scrimAlpha(gray, white)).toBe(1);
  });

  test("the scrim presets write the alpha scrimAlpha computes", () => {
    const light = presets.find((preset) => preset.id === "image-scrim-light")!;
    const items = layerItems(
      getValue(light.build(builtInPalette), "background-image")
    );
    const parsed =
      items[0].type === "unparsed"
        ? parseAnyGradient(items[0].value)
        : undefined;
    for (const stop of parsed!.stops) {
      expect(stop.color).toMatchObject({ type: "color", alpha: 0.49 });
    }
  });
});

describe("each preset passes AA for its reference text color", () => {
  beforeEach(() => {
    registerTestMetas();
  });

  const toCss = ({ r, g, b }: Rgba) =>
    `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;

  describe.each(palettes)("with %s", (_name, palette) => {
    test.each(presets.map((preset) => [preset.id, preset] as const))(
      "%s",
      (_id, preset) => {
        // a variable-backed palette's variables live on Global Root
        const rootVariables: TestStyle[] = [];
        for (const color of [palette.base, palette.accent1, palette.accent2]) {
          if (color.variable !== undefined) {
            rootVariables.push({
              on: root,
              property: `--${color.variable}`,
              value: toCss(color.rgba),
            });
          }
        }
        const styles = preset
          .build(palette, { imageAssetId: "asset-1" })
          .map(({ property, value }) => ({ on: "section", property, value }));
        setupProject({
          tree: el("body", "Body", [
            el("section", "Box", [el("text", "Text", ["Hello"])]),
          ]),
          styles: [
            ...rootVariables,
            ...styles,
            {
              on: "text",
              property: "color",
              value: toCss(getReferenceTextColor(preset, palette)),
            },
          ],
        });
        const report = checkSectionContrast(["section", "body"]);
        expect(report.summary).toBe("pass");
        expect(report.groups).toHaveLength(1);
        expect(report.groups[0].result).toBe("pass");
      }
    );
  });
});
