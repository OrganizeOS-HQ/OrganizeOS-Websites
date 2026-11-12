import { expect, test } from "vitest";
import { parseCssValue } from "@webstudio-is/css-data";
import type { CssProperty } from "@webstudio-is/css-engine";
import { describeBrandContrast } from "./brand-contrast";

const color = (text: string) => parseCssValue("color", text);

test("every pair at AA or better: undefined", () => {
  expect(
    describeBrandContrast({
      base: color("#ffffff"),
      text: color("#767676"),
      "accent-1": color("#0b5394"),
    })
  ).toBeUndefined();
});

test("names the failing pair: 'Base on Accent 1 3.4:1'", () => {
  expect(
    describeBrandContrast({
      base: color("#ffffff"),
      text: color("#1a1a1a"),
      "accent-1": color("#1597b0"),
    })
  ).toBe("Base on Accent 1 3.4:1");
});

test("floors to one decimal and joins with ', ': 'Text on Base 4.4:1, Base on Text 4.4:1'", () => {
  expect(
    describeBrandContrast({
      base: color("#ffffff"),
      text: color("#777777"),
      "accent-1": color("#0b5394"),
    })
  ).toBe("Text on Base 4.4:1, Base on Text 4.4:1");
});

test("a pair with an unresolved value is skipped", () => {
  for (const unresolved of [
    { type: "var", value: "gone" } as const,
    parseCssValue("--x" as CssProperty, "flex"),
  ]) {
    expect(
      describeBrandContrast({
        base: color("#ffffff"),
        text: color("#1a1a1a"),
        "accent-1": unresolved,
      })
    ).toBeUndefined();
  }
});
