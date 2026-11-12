import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import type { CssProperty } from "@webstudio-is/css-engine";
import { spaceProperties } from "../style-panel/sections/space/properties";
import { getBindableTypes } from "./property-types";

/**
 * Every PropertyLabel call site in the Style panel, classified (spec 10): the
 * "+" shows exactly where spec 6.2 says and nowhere 6.3 excludes. A new or
 * moved upstream row fails here until it is classified.
 */

const typesOf = (properties: readonly CssProperty[]) => {
  const types = getBindableTypes(properties);
  return types && [...types].sort();
};

const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

const stylePanel = fileURLToPath(new URL("../style-panel/", import.meta.url));
const sections = join(stylePanel, "sections");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return entry.name.endsWith(".tsx") &&
      entry.name.includes(".test.") === false &&
      entry.name.includes(".stories.") === false
      ? [path]
      : [];
  });

type Outcome = readonly string[] | undefined;
const C = ["color"];
const F = ["fontFamily"];
const N = ["number"];
const S = ["size"];
const SP = ["percentage", "size"];
const NSP = ["number", "percentage", "size"];
const X = undefined;

/** [file under sections/, the literal's properties, outcome, count] */
const literalSites: Array<[string, string[], Outcome, number?]> = [
  ["backgrounds/background-content.tsx", ["background-blend-mode"], X],
  ["backgrounds/background-content.tsx", ["background-repeat"], X],
  ["backgrounds/background-content.tsx", ["background-attachment"], X],
  ["backgrounds/background-content.tsx", ["background-clip"], X],
  ["backgrounds/background-content.tsx", ["background-origin"], X],
  ["backgrounds/background-size.tsx", ["background-size"], X, 2],
  ["backgrounds/backgrounds.tsx", ["background-color"], C],
  ["flex-child/flex-child.tsx", ["flex-grow", "flex-shrink", "flex-basis"], X],
  ["flex-child/flex-child.tsx", ["flex-grow"], N],
  ["flex-child/flex-child.tsx", ["flex-shrink"], N],
  ["flex-child/flex-child.tsx", ["flex-basis"], SP],
  [
    "grid-child/grid-child.tsx",
    ["grid-column-start", "grid-column-end", "grid-row-start", "grid-row-end"],
    X,
  ],
  ["layout/layout.tsx", ["display"], X],
  ["list-item.tsx", ["list-style-type"], X],
  ["outline/outline.tsx", ["outline-style"], X],
  ["outline/outline.tsx", ["outline-color"], C],
  ["outline/outline.tsx", ["outline-width"], S],
  ["outline/outline.tsx", ["outline-offset"], S],
  ["position/position.tsx", ["position"], X],
  ["position/position.tsx", ["z-index"], N, 2],
  ["shared/align-self.tsx", ["align-self"], X],
  ["shared/align-self.tsx", ["justify-self"], X],
  ["shared/order.tsx", ["order"], N, 2],
  ["size/size.tsx", ["aspect-ratio"], X],
  ["size/size.tsx", ["overflow-x", "overflow-y"], X],
  ["size/size.tsx", ["object-fit"], X],
  ["size/size.tsx", ["object-position"], X],
  ["transforms/transforms.tsx", ["backface-visibility"], X],
  ["transforms/transforms.tsx", ["perspective"], S],
  ["typography/typography.tsx", ["font-family"], F],
  ["typography/typography.tsx", ["color"], C],
  ["typography/typography.tsx", ["font-size"], SP],
  ["typography/typography.tsx", ["line-height"], NSP],
  ["typography/typography.tsx", ["letter-spacing"], S],
  ...[
    "font-weight",
    "white-space-collapse",
    "text-wrap-mode",
    "text-wrap-style",
    "direction",
    "hyphens",
    "text-overflow",
  ].map((property): [string, string[], Outcome] => [
    "typography/typography.tsx",
    [property],
    X,
  ]),
];

const sides = (pattern: string) =>
  ["top", "right", "bottom", "left"].map((side) => pattern.replace("*", side));

/** [file under sections/, expression, every array it takes, its outcome] */
const dynamicSites: Array<[string, string, Array<[string[], Outcome]>]> = [
  [
    "backgrounds/background-position.tsx",
    "combinedProperties",
    [[["background-position-x", "background-position-y"], X]],
  ],
  [
    "backgrounds/background-position.tsx",
    "xAxis.properties",
    [[["background-position-x"], X]],
  ],
  [
    "backgrounds/background-position.tsx",
    "yAxis.properties",
    [[["background-position-y"], X]],
  ],
  ["backgrounds/background-size.tsx", "[property]", [[["background-size"], X]]],
  ["borders/border-color.tsx", "properties", [[sides("border-*-color"), C]]],
  [
    "borders/border-property.tsx",
    "borderProperties",
    [
      [
        [
          "border-top-width",
          "border-right-width",
          "border-left-width",
          "border-bottom-width",
        ],
        S,
      ],
      [
        [
          "border-top-left-radius",
          "border-top-right-radius",
          "border-bottom-left-radius",
          "border-bottom-right-radius",
        ],
        SP,
      ],
    ],
  ],
  ["borders/border-style.tsx", "properties", [[sides("border-*-style"), X]]],
  [
    "shared/input-popover.tsx",
    "[property]",
    [...spaceProperties, "top", "right", "bottom", "left"].map(
      (property): [string[], Outcome] => [[property], SP]
    ),
  ],
  [
    "size/size.tsx",
    "[property]",
    [
      "width",
      "height",
      "min-width",
      "min-height",
      "max-width",
      "max-height",
    ].map((property): [string[], Outcome] => [[property], SP]),
  ],
  [
    "transforms/transform-and-perspective-origin.tsx",
    "[property]",
    [
      [["transform-origin"], X],
      [["perspective-origin"], X],
    ],
  ],
];

const scan = () => {
  const found = new Map<string, number>();
  for (const path of sourceFiles(stylePanel)) {
    const source = withoutComments(readFileSync(path, "utf8"));
    const opens = source.match(/<PropertyLabel\b/g)?.length ?? 0;
    if (opens === 0) {
      continue;
    }
    const expressions = [
      ...source.matchAll(
        /<PropertyLabel\b[^>]*?\bproperties=\{((?:[^{}]|\{[^{}]*\})*)\}/gs
      ),
    ].map((match) => match[1].replace(/\s+/g, "").replace(/,\]$/, "]"));
    const file = relative(sections, path);
    // a call site the pattern cannot read fails here, never goes unchecked
    expect(expressions.length, file).toBe(opens);
    for (const expression of expressions) {
      const key = `${file}|${expression}`;
      found.set(key, (found.get(key) ?? 0) + 1);
    }
  }
  return found;
};

test("every PropertyLabel call site in the Style panel is classified, 54 in all", () => {
  const expected = new Map<string, number>();
  for (const [file, properties, , count = 1] of literalSites) {
    const key = `${file}|${JSON.stringify(properties)}`;
    expected.set(key, (expected.get(key) ?? 0) + count);
  }
  for (const [file, expression] of dynamicSites) {
    expected.set(`${file}|${expression}`, 1);
  }
  const found = scan();
  expect(Object.fromEntries([...found].sort())).toEqual(
    Object.fromEntries([...expected].sort())
  );
  expect([...found.values()].reduce((sum, count) => sum + count, 0)).toBe(54);
});

test("each classified row gets the '+' exactly where spec 6.2 and 6.3 say", () => {
  for (const [file, properties, outcome] of literalSites) {
    expect(
      typesOf(properties as CssProperty[]),
      `${file} ${properties.join(" ")}`
    ).toEqual(outcome);
  }
  for (const [file, expression, arrays] of dynamicSites) {
    for (const [properties, outcome] of arrays) {
      expect(
        typesOf(properties as CssProperty[]),
        `${file} ${expression} ${properties.join(" ")}`
      ).toEqual(outcome);
    }
  }
});
