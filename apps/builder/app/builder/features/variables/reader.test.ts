import { enableMapSet } from "immer";
import { beforeEach, expect, test } from "vitest";
import type { CssProperty } from "@webstudio-is/css-engine";
import { $assets, $projectSettings } from "~/shared/sync/data-stores";
import {
  el,
  registerTestMetas,
  root,
  setupProject,
  type TestStyle,
  type TestToken,
} from "~/builder/features/organizeos-panel/test-fixtures";
import {
  $rootVariables,
  $variableCollections,
  resolveRootVariable,
} from "./reader";

enableMapSet();

beforeEach(() => {
  registerTestMetas();
});

const project = (
  styles: TestStyle[],
  organizeos?: unknown,
  tokens: TestToken[] = []
) => {
  setupProject({
    tree: el("body", "Body", [el("box", "Box")]),
    styles,
    tokens,
  });
  $projectSettings.set({ meta: {}, compiler: {}, organizeos });
  $assets.set(new Map());
};

const css = (pairs: Record<string, string>): TestStyle[] =>
  Object.entries(pairs).map(([property, value]) => ({
    on: root,
    property: property as CssProperty,
    value,
  }));

const rows = (id: string) =>
  $variableCollections.get().find((collection) => collection.id === id)?.rows;

test("listRootVariables: Global Root's local source, base breakpoint, no state", () => {
  project(
    [
      { on: root, property: "--a", value: "1px" },
      { on: root, property: "--b", value: "1px", breakpoint: "tablet" },
      { on: root, property: "--c", value: "1px", state: ":hover" },
      { on: root, property: "--d", value: "1px", token: "t" },
      { on: "box", property: "--e", value: "1px" },
    ],
    undefined,
    [{ id: "t", name: "T", on: [root] }]
  );
  expect($rootVariables.get()).toEqual([
    {
      cssName: "a",
      value: { type: "unit", value: 1, unit: "px" },
      styleDeclKey: "local-:root:base:--a:",
    },
  ]);
});

test("Brand: the six in canonical order, a missing one as an empty row, all locked", () => {
  project(
    css({
      "--text": "#111111",
      "--base": "#ffffff",
      "--font-body": "system-ui, sans-serif",
      "--brand-blue": "#1597b0",
    })
  );
  const [brand] = $variableCollections.get();
  expect(brand).toMatchObject({ id: "brand", name: "Brand", system: "brand" });
  expect(
    brand.rows.map((row) => [
      row.cssName,
      row.displayName,
      row.type,
      row.value === undefined,
      row.locked,
    ])
  ).toEqual([
    ["base", "Base", "color", false, true],
    ["accent-1", "Accent 1", "color", true, true],
    ["accent-2", "Accent 2", "color", true, true],
    ["text", "Text", "color", false, true],
    ["font-heading", "Heading font", "fontFamily", true, true],
    ["font-body", "Body font", "fontFamily", false, true],
  ]);
  project(css({ "--brand-blue": "#1597b0" }));
  expect($variableCollections.get().map((collection) => collection.id)).toEqual(
    ["site"]
  );
});

test("Site, then the registry's collections; registered rows, then unregistered in declaration order; stale and duplicate entries skipped", () => {
  project(
    css({
      "--zeta": "1px",
      "--gap": "8px",
      "--spacing--large": "2px",
      "--alpha": "1px",
      "--focus-ring": "#000000",
    }),
    {
      variables: {
        version: 1,
        collections: [
          { id: "c2", name: "Motion" },
          { id: "site", name: "Site", system: "site" },
          { id: "c1", name: "Spacing" },
        ],
        variables: [
          { cssName: "gap", collectionId: "c1", type: "size", name: "Gap" },
          { cssName: "gone", collectionId: "c1", type: "size", name: "Gone" },
          { cssName: "gap", collectionId: "c2", type: "size", name: "Gap" },
        ],
      },
    }
  );
  expect($variableCollections.get().map((collection) => collection.id)).toEqual(
    ["site", "c2", "c1"]
  );
  expect(rows("site")?.map((row) => row.cssName)).toEqual([
    "zeta",
    "spacing--large",
    "alpha",
    "focus-ring",
  ]);
  expect(rows("c1")?.map((row) => row.cssName)).toEqual(["gap"]);
  expect(rows("c2")).toEqual([]);
  expect(rows("site")?.[1]).toMatchObject({
    displayName: "spacing/large",
    group: "spacing",
    type: "size",
    registered: false,
    locked: false,
  });
  expect(rows("site")?.[3]).toMatchObject({ registered: false, locked: true });
  expect(rows("c1")?.[0]).toMatchObject({
    displayName: "Gap",
    registered: true,
    locked: false,
  });
});

test("an unreadable registry lists every variable unregistered in Site", () => {
  project(css({ "--gap": "8px", "--alpha": "1px" }), {
    variables: { version: 2 },
  });
  expect($variableCollections.get().map((collection) => collection.id)).toEqual(
    ["site"]
  );
  expect(rows("site")?.map((row) => [row.cssName, row.registered])).toEqual([
    ["gap", false],
    ["alpha", false],
  ]);
});

// Review Focus 3
test("a value gone bad outside the manager renders untyped and resolves without throwing", () => {
  project(
    css({
      "--gone": "var(--deleted)",
      "--a": "var(--b)",
      "--b": "var(--a)",
      "--flex": "flex",
      "--c": "flex",
    }),
    {
      variables: {
        version: 1,
        collections: [{ id: "site", name: "Site", system: "site" }],
        variables: [
          { cssName: "c", collectionId: "site", type: "color", name: "C" },
        ],
      },
    }
  );
  expect(rows("site")?.map((row) => [row.cssName, row.type])).toEqual([
    ["c", "color"],
    ["gone", undefined],
    ["a", undefined],
    ["b", undefined],
    ["flex", undefined],
  ]);
  expect(resolveRootVariable("gone")).toEqual({ type: "guaranteedInvalid" });
  expect(resolveRootVariable("a").type).toBe("invalid");
});

test("an alias takes its target's type and value; the local base declaration wins over a token's", () => {
  project(
    [
      ...css({ "--brand": "#1597b0", "--link": "var(--brand)", "--x": "blue" }),
      { on: root, property: "--x", value: "red", token: "t" },
    ],
    undefined,
    [{ id: "t", name: "T", on: [root] }]
  );
  expect(rows("site")?.find((row) => row.cssName === "link")?.type).toBe(
    "color"
  );
  expect(resolveRootVariable("link")).toEqual(resolveRootVariable("brand"));
  expect(resolveRootVariable("x")).toEqual({ type: "unparsed", value: "blue" });
});
