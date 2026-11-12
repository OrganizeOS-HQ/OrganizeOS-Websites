import { enableMapSet } from "immer";
import { beforeEach, expect, test, vi } from "vitest";
import { parseCssValue } from "@webstudio-is/css-data";
import type { CssProperty } from "@webstudio-is/css-engine";
import type { BuilderPatchChange } from "@webstudio-is/project-build/contracts";
import { readVariablesRegistry } from "@webstudio-is/project-build";
import {
  createBuildPatchUpdate,
  type BuildPatchTransaction,
} from "@webstudio-is/project/build-patch-core.server";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
import {
  $breakpoints,
  $projectSettings,
  $styles,
} from "~/shared/sync/data-stores";
import {
  executeStagedRuntimeMutation,
  getWebstudioData,
} from "~/shared/instance-utils/data";
import {
  registerTestMetas,
  root,
} from "~/builder/features/organizeos-panel/test-fixtures";
import {
  allDecls,
  boxStyle,
  css,
  embed,
  project,
  prop,
  px,
  registry,
  rootStyle,
  selectPageTemplateWithoutBuildAccess,
  site,
  size,
  teal,
  tokenStyle,
  undoDepth,
  v,
  type Fixture,
} from "./test-stores";
import {
  createVariable,
  deleteVariables,
  duplicateVariable,
  getVariableUsage,
  moveVariables,
  renameVariable,
  reorderVariable,
  setVariableType,
  setVariableValue,
} from "./operations";

const { toastError, toastInfo } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: toastError, info: toastInfo } },
}));
// Spied, not replaced: a factory that imports the original module waits on
// itself in the browser runner (the module is in an import cycle).
vi.mock("~/shared/instance-utils/data", { spy: true });

enableMapSet();
registerContainers();

beforeEach(() => {
  registerTestMetas();
  vi.mocked(executeStagedRuntimeMutation).mockClear();
  toastError.mockClear();
  toastInfo.mockClear();
});

const renameFixture: Fixture = {
  styles: [
    ...css({
      "--x": "1px",
      "--large": "16px",
      "--y": "1px",
      "--spacing--large": "2px",
    }),
    { on: "box", property: "padding-top", value: v("large") },
    { on: "box", property: "margin-top", value: v("spacing--large") },
    { on: "box", property: "--large" as CssProperty, value: "4px" },
  ],
  props: [embed(".a{margin:var(--large)}")],
  code: "<style>a{gap:var(--large);row-gap:var(--spacing--large)}</style>",
  organizeos: {
    variables: site(
      size("x", "c1"),
      { cssName: "large", collectionId: "c1", type: "size", name: "Large" },
      size("y", "c1")
    ),
  },
};

const buildRow = {
  id: "build-1",
  projectId: "project-1",
  version: 3,
  lastTransactionId: "previous-tx",
  isCleaned: null,
  publishStatus: "PUBLISHED" as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  pages: JSON.stringify({
    meta: {},
    homePage: {
      id: "page-1",
      name: "Home",
      path: "",
      title: "Home",
      meta: {},
      rootInstanceId: "body-1",
    },
    pages: [],
    folders: [{ id: "root", name: "Root", slug: "", children: [] }],
  }),
  breakpoints: JSON.stringify([]),
  styles: JSON.stringify([]),
  styleSources: JSON.stringify([]),
  styleSourceSelections: JSON.stringify([]),
  props: JSON.stringify([]),
  dataSources: JSON.stringify([]),
  resources: JSON.stringify([]),
  instances: JSON.stringify([
    { id: "body-1", type: "instance", component: "Body", children: [] },
  ]),
  deployment: null,
  marketplaceProduct: JSON.stringify({}),
  projectSettings: JSON.stringify({ meta: {}, compiler: {} }),
};

test("createVariable: the root declaration and the entry in one undo step; clashes with element names; stale entries dropped", () => {
  project({
    styles: [{ on: "box", property: "--gap" as CssProperty, value: "1px" }],
    organizeos: {
      variables: site({
        cssName: "gone",
        collectionId: "site",
        type: "size",
        name: "Gone",
      }),
    },
  });
  const before = getWebstudioData();
  expect(
    createVariable({
      collectionId: "site",
      type: "size",
      displayName: "Gap",
      value: px(16),
    })
  ).toEqual({ ok: true, cssName: "gap-2" });
  expect(rootStyle("--gap-2")).toEqual(px(16));
  expect(registry().variables).toEqual([
    { cssName: "gap-2", collectionId: "site", type: "size", name: "Gap" },
  ]);
  expect(undoDepth()).toBe(1);
  serverSyncStore.undo();
  expect(getWebstudioData()).toEqual(before);
});

test("the transaction passes createBuildPatchUpdate", async () => {
  project({});
  // the first subscriber gets every transaction queued while none listened:
  // drain those, earlier tests' included, before collecting this one
  serverSyncStore.subscribe(() => {})();
  const sent: BuildPatchTransaction[] = [];
  const off = serverSyncStore.subscribe((id, payload) => {
    sent.push({ id, payload: payload as BuilderPatchChange[] });
  });
  createVariable({
    collectionId: "site",
    type: "size",
    displayName: "Spacing/Large",
    value: px(16),
  });
  off();
  expect(sent).toHaveLength(1);
  const result = await createBuildPatchUpdate({
    build: {
      ...buildRow,
      breakpoints: JSON.stringify(Array.from($breakpoints.get().values())),
    } as Parameters<typeof createBuildPatchUpdate>[0]["build"],
    clientVersion: 3,
    transactions: sent,
    loadAssets: async () => ({ assets: [], changedAssetIds: new Set() }),
  });
  expect(result).toMatchObject({ status: "ok" });
});

test("setVariableValue: one undo step; a missing Brand variable is restored only while another of the six exists", () => {
  project({ styles: css({ "--base": "#ffffff", "--text": "#111111" }) });
  expect(setVariableValue("accent-1", teal)).toEqual({ ok: true });
  expect($styles.get().get("local-:root:base:--accent-1:")?.value).toEqual(
    teal
  );
  expect(undoDepth()).toBe(1);
  project({ styles: css({ "--brand-blue": "#1597b0" }) });
  expect(setVariableValue("accent-1", teal)).toEqual({
    ok: false,
    error: "Can't change this variable",
  });
});

test("setVariableValue writes a non-var value as given, and refuses an invalid one", () => {
  project({ styles: css({ "--face": "Inter" }) });
  expect(
    setVariableValue("face", parseCssValue("--face" as CssProperty, "flex"))
  ).toEqual({ ok: true });
  expect(rootStyle("--face")).toEqual({ type: "unparsed", value: "flex" });
  expect(setVariableValue("face", { type: "invalid", value: "a(" })).toEqual({
    ok: false,
    error: "Invalid value",
  });
});

test.each([
  [
    "an unreadable registry",
    () => project({ organizeos: { variables: { version: 2 } } }),
    () =>
      createVariable({
        collectionId: "site",
        type: "size",
        displayName: "Gap",
        value: px(1),
      }),
    "Reload to edit variables",
  ],
  [
    "a page template without build access",
    selectPageTemplateWithoutBuildAccess,
    () => setVariableValue("gap", px(2)),
    "Page templates can be edited only in design mode, with build access.",
  ],
  [
    "a protected rename",
    undefined,
    () => renameVariable({ from: "focus-ring", to: "ring" }),
    "Can't rename this variable",
  ],
  [
    "a protected delete",
    undefined,
    () => deleteVariables(["base"]),
    "Can't delete this variable",
  ],
  [
    "a bad name",
    undefined,
    () => renameVariable({ from: "gap", to: "Gap" }),
    "Use lowercase letters, digits and single hyphens",
  ],
  [
    "a reserved name",
    undefined,
    () => renameVariable({ from: "gap", to: "text" }),
    "This name is reserved",
  ],
  [
    "an alias cycle",
    undefined,
    () => setVariableValue("a", { type: "var", value: "b" }),
    "This link would loop",
  ],
  [
    "an alias to another type",
    undefined,
    () => setVariableValue("gap", { type: "var", value: "brand-blue" }),
    "Link to a variable of the same type",
  ],
] as const)(
  "refuses %s synchronously, staging nothing",
  (_, arrange, act, error) => {
    project({
      styles: css({
        "--base": "#ffffff",
        "--focus-ring": "#000000",
        "--gap": "8px",
        "--brand-blue": "#1597b0",
        "--a": "1px",
        "--b": "var(--a)",
      }),
    });
    arrange?.();
    const styles = $styles.get();
    const settings = $projectSettings.get();
    expect(act()).toEqual({ ok: false, error });
    expect($styles.get()).toBe(styles);
    expect($projectSettings.get()).toBe(settings);
    expect(undoDepth()).toBe(0);
    expect(executeStagedRuntimeMutation).not.toHaveBeenCalled();
  }
);

test("renameVariable rewrites styles, Embed code and custom code, renames element declarations, keeps the entry", () => {
  project(renameFixture);
  expect(renameVariable({ from: "large", displayName: "Big" })).toEqual({
    ok: true,
    cssName: "big",
  });
  expect(boxStyle("paddingTop")).toEqual({ type: "var", value: "big" });
  expect(boxStyle("marginTop")).toEqual({
    type: "var",
    value: "spacing--large",
  });
  expect(boxStyle("--big")).toEqual(px(4));
  expect(prop("code")).toBe(".a{margin:var(--big)}");
  expect($projectSettings.get()?.meta.code).toBe(
    "<style>a{gap:var(--big);row-gap:var(--spacing--large)}</style>"
  );
  expect(registry().variables[1]).toEqual({
    cssName: "big",
    collectionId: "c1",
    type: "size",
    name: "Big",
  });
  expect(renameVariable({ from: "big", to: "huge" })).toEqual({
    ok: true,
    cssName: "huge",
  });
  expect(registry().variables[1]).toMatchObject({
    cssName: "huge",
    name: "huge",
  });
  const depth = undoDepth();
  // as upstream accepts it
  expect(renameVariable({ from: "huge", to: "huge" })).toEqual({
    ok: true,
    cssName: "huge",
  });
  expect(undoDepth()).toBe(depth);
});

const deleteFixture: Fixture = {
  styles: [
    ...css({ "--large": "16px", "--gap": "var(--large)" }),
    {
      on: root,
      property: "--large" as CssProperty,
      value: "8px",
      breakpoint: "tablet",
    },
    { on: "box", property: "padding-top", value: v("large") },
    {
      on: "box",
      property: "box-shadow",
      value: {
        type: "layers",
        value: [
          {
            type: "shadow",
            position: "outset",
            offsetX: v("large"),
            offsetY: px(0),
          },
        ],
      },
    },
    {
      on: "box",
      property: "width",
      value: { type: "unparsed", value: "calc(var(--large) * 2)" },
    },
    { on: "box", property: "--large" as CssProperty, value: "4px" },
    { on: "box", property: "margin-left", value: v("large"), token: "loose" },
    {
      on: "box",
      property: "--large" as CssProperty,
      value: "2px",
      token: "loose",
    },
  ],
  tokens: [{ id: "loose", name: "Loose", on: [] }],
  props: [embed(".a{margin:var(--large)}")],
  code: "<style>a{gap:var(--large)}</style>",
  organizeos: { variables: site(size("large"), size("gap")) },
};

test("deleteVariables: references take the base value, every declaration goes, usage counts an unattached token", () => {
  project(deleteFixture);
  expect(getVariableUsage("large")).toBe(7);
  expect(deleteVariables(["large"])).toEqual({ ok: true, deleted: 1 });
  expect(allDecls().filter((decl) => decl.property === "--large")).toEqual([]);
  expect([
    rootStyle("--gap"),
    boxStyle("paddingTop"),
    tokenStyle("loose", "marginLeft"),
  ]).toEqual([px(16), px(16), px(16)]);
  expect(boxStyle("boxShadow")).toMatchObject({
    value: [{ offsetX: px(16) }],
  });
  expect(boxStyle("width")).toEqual({
    type: "unparsed",
    value: "calc(16px * 2)",
  });
  expect(prop("code")).toContain("var(--large)");
  expect($projectSettings.get()?.meta.code).toContain("var(--large)");
  expect(registry().variables.some((entry) => entry.cssName === "large")).toBe(
    false
  );
  expect(undoDepth()).toBe(1);
});

// Review Focus 4
test("undo right after a rename or a delete restores styles, Embed code, custom code and the registry in one step", () => {
  for (const write of [
    () => renameVariable({ from: "large", displayName: "Big" }),
    () => deleteVariables(["large"]),
  ]) {
    project(renameFixture);
    const before = getWebstudioData();
    expect(write().ok).toBe(true);
    expect(undoDepth()).toBe(1);
    serverSyncStore.undo();
    expect(getWebstudioData()).toEqual(before);
  }
});

test("duplicate, move and setVariableType", () => {
  project({
    styles: css({
      "--brand-blue": "#1597b0",
      "--b": "1px",
      "--c": "2px",
      "--face": "Inter",
    }),
    organizeos: {
      variables: site(
        {
          cssName: "brand-blue",
          collectionId: "site",
          type: "color",
          name: "Brand Blue",
        },
        size("b"),
        size("c")
      ),
    },
  });
  expect(duplicateVariable("brand-blue")).toEqual({
    ok: true,
    cssName: "brand-blue-copy",
  });
  expect(registry().variables[1]).toEqual({
    cssName: "brand-blue-copy",
    collectionId: "site",
    type: "color",
    name: "Brand Blue copy",
  });
  expect(moveVariables(["brand-blue"], "c1")).toEqual({ ok: true });
  expect(registry().variables.at(-1)).toMatchObject({
    cssName: "brand-blue",
    collectionId: "c1",
  });
  expect(setVariableType("face", "fontFamily")).toEqual({ ok: true });
  expect(rootStyle("--face")).toEqual({ type: "fontFamily", value: ["Inter"] });
  expect(setVariableType("b", "number")).toEqual({
    ok: false,
    error: "This variable already has a type",
  });
});

test("reorderVariable maps a row position to a registry index; an unregistered typed row is registered there", () => {
  project({
    styles: css({ "--a": "1px", "--x": "1px", "--b": "1px", "--free": "2px" }),
    organizeos: { variables: site(size("a"), size("x", "c1"), size("b")) },
  });
  expect(reorderVariable("b", 0)).toEqual({ ok: true });
  expect(registry().variables.map((entry) => entry.cssName)).toEqual([
    "b",
    "a",
    "x",
  ]);
  expect(reorderVariable("free", 1)).toEqual({ ok: true });
  expect(registry().variables.map((entry) => entry.cssName)).toEqual([
    "b",
    "free",
    "a",
    "x",
  ]);
  // stages nothing: ok, no undo step
  expect(reorderVariable("b", 0)).toEqual({ ok: true });
  expect(undoDepth()).toBe(2);
});

const long = (letter: string) => letter.repeat(140);

test.each([
  [
    "a rename by CSS name",
    () => renameVariable({ from: "a", to: long("r") }),
    "r",
  ],
  ["a move", () => moveVariables([long("m")], "c1"), "m"],
  ["a reorder", () => reorderVariable(long("m"), 0), "m"],
  ["a first type", () => setVariableType(long("t"), "fontFamily"), "t"],
] as const)(
  "%s: a display name derived from a CSS name over 128 characters is cut to 128, so the registry stays readable",
  (_label, write, letter) => {
    project({
      styles: css({
        "--a": "1px",
        [`--${long("m")}`]: "2px",
        [`--${long("t")}`]: "Inter",
      }),
      organizeos: { variables: site(size("a")) },
    });
    expect(write()).toMatchObject({ ok: true });
    expect(
      readVariablesRegistry($projectSettings.get()?.organizeos).status
    ).toBe("readable");
    expect(
      registry().variables.find((entry) => entry.cssName === long(letter))?.name
    ).toBe(letter.repeat(128));
  }
);

test("a stage that throws returns ok false, commits nothing and shows the error toast", async () => {
  // a real stage on a real accumulator throws: executeStagedRuntimeMutation
  // turns it into a rejection after the call returns
  const { executeStagedRuntimeMutation: realExecute } = await vi.importActual<
    typeof import("~/shared/instance-utils/data")
  >("~/shared/instance-utils/data");
  project({});
  vi.mocked(executeStagedRuntimeMutation).mockImplementationOnce((stage) =>
    realExecute((accumulator) => {
      stage(accumulator);
      throw new Error("Commit refused");
    })
  );
  expect(
    createVariable({
      collectionId: "site",
      type: "size",
      displayName: "Gap",
      value: px(1),
    })
  ).toEqual({ ok: false, error: "Can't change this variable" });
  expect(undoDepth()).toBe(0);
  await vi.waitFor(() =>
    expect(toastError).toHaveBeenCalledWith("Commit refused")
  );
});
