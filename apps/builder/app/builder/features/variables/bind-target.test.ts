import { enableMapSet } from "immer";
import { beforeEach, expect, test, vi } from "vitest";
import { camelCaseProperty } from "@webstudio-is/css-data";
import type { CssProperty } from "@webstudio-is/css-engine";
import { ROOT_INSTANCE_ID, getStyleDeclKey } from "@webstudio-is/sdk";
import { readVariablesRegistry } from "@webstudio-is/project-build";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
import {
  $projectSettings,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import {
  $selectedBreakpointId,
  $selectedStyleSources,
  $selectedStyleState,
  selectInstance,
} from "~/shared/nano-states";
import { registerTestMetas } from "~/builder/features/organizeos-panel/test-fixtures";
import { createBatchUpdate } from "~/builder/features/style-panel/shared/use-style-data";
import {
  boxStyle,
  localSourceOf,
  project,
  selectPageTemplateWithoutBuildAccess,
  undoDepth,
} from "./test-stores";
import { validateVariableValue } from "./value-types";
import { resolveBindTarget } from "./bind-target";
import { createAndBindVariable } from "./operations";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: toastError, info: vi.fn() } },
}));

enableMapSet();
registerContainers();

beforeEach(() => {
  toastError.mockClear();
});

type Case = {
  token: boolean;
  breakpoint: string;
  state: string | undefined;
};

/**
 * The plan's store setup: body > box with a width on the box's local source,
 * an absent registry, the box selected at the case's breakpoint and state,
 * and, for a token case, token1 on the box and selected.
 */
const setup = ({ token, breakpoint, state }: Case) => {
  registerTestMetas();
  project({
    styles: [{ on: "box", property: "width", value: "10px" }],
    tokens: token ? [{ id: "token1", name: "Primary", on: ["box"] }] : [],
  });
  $selectedBreakpointId.set(breakpoint);
  $projectSettings.set({ meta: {}, compiler: {} });
  selectInstance(["box", "body"]);
  $selectedStyleSources.set(
    token ? new Map([["box", "token1"]]) : new Map<string, string>()
  );
  $selectedStyleState.set(state);
};

const lockToken = () => {
  $styleSources.set(
    new Map(
      Array.from($styleSources.get(), ([id, source]) => [
        id,
        id === "token1" && source.type === "token"
          ? { ...source, locked: true }
          : source,
      ])
    )
  );
};

const borders: CssProperty[] = [
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
];

const brand = validateVariableValue("color", "#1597b0");
if (brand.ok === false) {
  throw new Error(brand.error);
}

/** Every declaration that is not a CSS variable, by key, sorted. */
const boxKeys = () =>
  Array.from($styles.get())
    .filter(([, decl]) => decl.property.startsWith("--") === false)
    .map(([key]) => key)
    .sort();

test.each([
  {
    name: "a local source",
    token: false,
    breakpoint: "tablet",
    state: ":hover",
    source: "local-box",
  },
  {
    name: "a token",
    token: true,
    breakpoint: "base",
    state: undefined,
    source: "token1",
  },
])(
  "binds on $name where publishUpdates writes for the same selection",
  (item) => {
    setup(item);
    const before = new Set(boxKeys());
    expect(
      createAndBindVariable({
        type: "color",
        displayName: "Brand",
        value: brand.value,
        properties: borders,
      })
    ).toEqual({ ok: true, cssName: "brand" });
    const staged = boxKeys().filter((key) => before.has(key) === false);
    for (const key of staged) {
      expect($styles.get().get(key)?.value).toEqual({
        type: "var",
        value: "brand",
      });
    }

    setup(item);
    const batch = createBatchUpdate();
    for (const property of borders) {
      batch.setProperty(property)({ type: "var", value: "brand" });
    }
    batch.publish();
    expect(staged).toEqual(
      boxKeys().filter((key) => before.has(key) === false)
    );
    expect(staged).toEqual(
      borders
        .map((property) =>
          getStyleDeclKey({
            styleSourceId: item.source,
            breakpointId: item.breakpoint,
            property: camelCaseProperty(property),
            state: item.state,
          })
        )
        .sort()
    );
  }
);

test("resolveBindTarget reads the selection publishUpdates reads", () => {
  setup({ token: false, breakpoint: "tablet", state: ":hover" });
  expect(resolveBindTarget()).toEqual({
    instanceId: "box",
    breakpointId: "tablet",
    state: ":hover",
    styleSource: { type: "local", id: "local-box" },
  });
  setup({ token: true, breakpoint: "base", state: undefined });
  lockToken();
  expect(resolveBindTarget()).toBe(undefined);
  setup({ token: false, breakpoint: "base", state: undefined });
  selectInstance(undefined);
  expect(resolveBindTarget()).toBe(undefined);
});

test("creates the variable in Site and binds it, in one undo step", () => {
  setup({ token: false, breakpoint: "base", state: undefined });
  const styles = $styles.get();
  const settings = $projectSettings.get();
  expect(
    createAndBindVariable({
      type: "color",
      displayName: "Brand",
      value: brand.value,
      properties: ["color"],
    })
  ).toEqual({ ok: true, cssName: "brand" });
  const declared = Array.from($styles.get().values()).filter(
    (decl) => decl.property === "--brand"
  );
  expect(declared).toEqual([
    expect.objectContaining({
      styleSourceId: localSourceOf(ROOT_INSTANCE_ID),
      breakpointId: "base",
      value: brand.value,
    }),
  ]);
  expect(declared[0].state).toBe(undefined);
  const registry = readVariablesRegistry($projectSettings.get()?.organizeos);
  expect(registry.status).toBe("readable");
  expect(
    registry.status === "readable" ? registry.registry.variables : undefined
  ).toEqual([
    { cssName: "brand", collectionId: "site", type: "color", name: "Brand" },
  ]);
  expect(boxStyle("color")).toEqual({ type: "var", value: "brand" });
  expect(undoDepth()).toBe(1);
  serverSyncStore.undo();
  expect($styles.get()).toEqual(styles);
  expect($projectSettings.get()).toEqual(settings);
});

test("refuses a fractional Number on z-index and order, and stages nothing", () => {
  for (const property of ["z-index", "order"] as CssProperty[]) {
    setup({ token: false, breakpoint: "base", state: undefined });
    const styles = $styles.get();
    expect(
      createAndBindVariable({
        type: "number",
        displayName: "Layer",
        value: { type: "unit", unit: "number", value: 1.5 },
        properties: [property],
      })
    ).toEqual({ ok: false, error: "Use a whole number" });
    expect($styles.get()).toBe(styles);
    expect(undoDepth()).toBe(0);
    expect(
      createAndBindVariable({
        type: "number",
        displayName: "Layer",
        value: { type: "unit", unit: "number", value: 2 },
        properties: [property],
      }).ok
    ).toBe(true);
  }
});

test("refuses on a locked token and stages nothing", () => {
  setup({ token: true, breakpoint: "base", state: undefined });
  lockToken();
  const styles = $styles.get();
  expect(
    createAndBindVariable({
      type: "color",
      displayName: "Brand",
      value: brand.value,
      properties: ["color"],
    }).ok
  ).toBe(false);
  expect($styles.get()).toBe(styles);
  expect(undoDepth()).toBe(0);
});

test("refuses while a page template is open without build access, and stages nothing", () => {
  setup({ token: false, breakpoint: "base", state: undefined });
  selectPageTemplateWithoutBuildAccess();
  const styles = $styles.get();
  expect(
    createAndBindVariable({
      type: "color",
      displayName: "Brand",
      value: brand.value,
      properties: ["color"],
    }).ok
  ).toBe(false);
  expect($styles.get()).toBe(styles);
  expect(undoDepth()).toBe(0);
});
