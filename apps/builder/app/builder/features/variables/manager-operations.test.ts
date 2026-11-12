import { enableMapSet } from "immer";
import { beforeEach, expect, test, vi } from "vitest";
import type { CssProperty } from "@webstudio-is/css-engine";
import type { RegistryVariable } from "@webstudio-is/project-build";
import { registerContainers } from "~/shared/sync/sync-stores";
import { $projectSettings, $styles } from "~/shared/sync/data-stores";
import { executeStagedRuntimeMutation } from "~/shared/instance-utils/data";
import { registerTestMetas } from "~/builder/features/organizeos-panel/test-fixtures";
import {
  allDecls,
  boxStyle,
  css,
  project,
  px,
  registry,
  size,
  undoDepth,
  v,
} from "./test-stores";
import {
  createCollection,
  deleteCollection,
  groupVariables,
  orderVariables,
  renameCollection,
  reorderCollection,
} from "./operations";
import { $variableCollections } from "./reader";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: toastError, info: vi.fn() } },
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
});

/** A registry with Site, Spacing (c1) and Motion (c2). */
const three = (...variables: RegistryVariable[]) => ({
  version: 1,
  collections: [
    { id: "site", name: "Site", system: "site" },
    { id: "c1", name: "Spacing" },
    { id: "c2", name: "Motion" },
  ],
  variables,
});

/** Nothing staged: no commit, no undo step, the stores unchanged. */
const expectNothingStaged = (run: () => void) => {
  const styles = $styles.get();
  const settings = $projectSettings.get();
  run();
  expect(executeStagedRuntimeMutation).not.toHaveBeenCalled();
  expect(undoDepth()).toBe(0);
  expect($styles.get()).toBe(styles);
  expect($projectSettings.get()).toBe(settings);
};

test("createCollection('Spacing') on an absent registry writes v1 with Site and Spacing, returns its id, one undo step", () => {
  project({});
  const result = createCollection("Spacing");
  expect(result.ok).toBe(true);
  const id = result.ok ? result.id : "";
  expect(id).not.toBe("");
  expect(registry().version).toBe(1);
  expect(registry().collections).toEqual([
    { id: "site", name: "Site", system: "site" },
    { id, name: "Spacing" },
  ]);
  expect(undoDepth()).toBe(1);
});

test.each([
  ["", "Name is required"],
  ["   ", "Name is required"],
  ["x".repeat(65), "Name is too long"],
])("createCollection(%j) refuses with %s, staging nothing", (name, error) => {
  project({});
  expectNothingStaged(() => {
    expect(createCollection(name)).toEqual({ ok: false, error });
  });
});

test("an unreadable registry refuses every collection operation with 'Reload to edit variables', staging nothing", () => {
  project({ organizeos: { variables: { version: 2 } } });
  const refusal = { ok: false, error: "Reload to edit variables" };
  expectNothingStaged(() => {
    expect(createCollection("A")).toEqual(refusal);
    expect(renameCollection("site", "B")).toEqual(refusal);
    expect(deleteCollection("c1")).toEqual(refusal);
    expect(reorderCollection("c1", 0)).toEqual(refusal);
  });
});

test("renameCollection renames Site; brand gives 'Can't change this collection'; an unknown id gives 'Collection not found'", () => {
  project({ organizeos: { variables: three() } });
  expect(renameCollection("site", "Pages")).toEqual({ ok: true });
  expect(registry().collections[0]).toEqual({
    id: "site",
    name: "Pages",
    system: "site",
  });
  expect(undoDepth()).toBe(1);
  expect(renameCollection("brand", "B")).toEqual({
    ok: false,
    error: "Can't change this collection",
  });
  expect(renameCollection("nope", "B")).toEqual({
    ok: false,
    error: "Collection not found",
  });
  expect(renameCollection("c1", " ")).toEqual({
    ok: false,
    error: "Name is required",
  });
  expect(undoDepth()).toBe(1);
});

test("deleteCollection on an empty collection removes it", () => {
  project({ organizeos: { variables: three() } });
  expect(deleteCollection("c2")).toEqual({ ok: true, deleted: 0 });
  expect(registry().collections.map((collection) => collection.id)).toEqual([
    "site",
    "c1",
  ]);
  expect(undoDepth()).toBe(1);
});

test("deleteCollection on c1 holding gap, pad and a stale entry deletes both by 4.8 (var(--gap) takes 8px), leaves no c1 entry and no c1, one undo step, { deleted: 2 }", () => {
  project({
    styles: [
      ...css({ "--gap": "8px", "--pad": "4px" }),
      { on: "box", property: "margin-top" as CssProperty, value: v("gap") },
    ],
    organizeos: {
      variables: three(
        size("gap", "c1"),
        size("pad", "c1"),
        size("stale", "c1")
      ),
    },
  });
  expect(deleteCollection("c1")).toEqual({ ok: true, deleted: 2 });
  expect(boxStyle("marginTop")).toEqual(px(8));
  expect(
    allDecls().some(
      (decl) => decl.property === "--gap" || decl.property === "--pad"
    )
  ).toBe(false);
  expect(
    registry().variables.some((entry) => entry.collectionId === "c1")
  ).toBe(false);
  expect(registry().collections.map((collection) => collection.id)).toEqual([
    "site",
    "c2",
  ]);
  expect(undoDepth()).toBe(1);
});

test("deleteCollection refuses brand and site with 'Can't change this collection', staging nothing", () => {
  project({ organizeos: { variables: three() } });
  const refusal = { ok: false, error: "Can't change this collection" };
  expectNothingStaged(() => {
    expect(deleteCollection("brand")).toEqual(refusal);
    expect(deleteCollection("site")).toEqual(refusal);
  });
});

test("reorderCollection('c2', 0) puts c2 before c1; Site stays first; brand and site give 'Can't change this collection'", () => {
  project({ organizeos: { variables: three() } });
  expect(reorderCollection("c2", 0)).toEqual({ ok: true });
  expect(registry().collections.map((collection) => collection.id)).toEqual([
    "site",
    "c2",
    "c1",
  ]);
  expect(undoDepth()).toBe(1);
  expect(reorderCollection("brand", 0)).toEqual({
    ok: false,
    error: "Can't change this collection",
  });
  expect(reorderCollection("site", 1)).toEqual({
    ok: false,
    error: "Can't change this collection",
  });
  expect(reorderCollection("gone", 0)).toEqual({
    ok: false,
    error: "Collection not found",
  });
});

const named = (cssName: string, name: string): RegistryVariable => ({
  cssName,
  collectionId: "site",
  type: "size",
  name,
});

test("groupVariables(['a--gap', 'b--gap'], 'Spacing'): A/Gap and B/Gap become spacing--gap and spacing--gap-2, both named Spacing/Gap, one undo step", () => {
  project({
    styles: css({ "--a--gap": "1px", "--b--gap": "2px" }),
    organizeos: {
      variables: three(named("a--gap", "A/Gap"), named("b--gap", "B/Gap")),
    },
  });
  expect(groupVariables(["a--gap", "b--gap"], "Spacing")).toEqual({ ok: true });
  expect(registry().variables.map((item) => [item.cssName, item.name])).toEqual(
    [
      ["spacing--gap", "Spacing/Gap"],
      ["spacing--gap-2", "Spacing/Gap"],
    ]
  );
  expect(undoDepth()).toBe(1);
});

test("groupVariables keeps everything after the first /: X/Y/Z grouped into G becomes G/Y/Z (g--y--z)", () => {
  project({
    styles: css({ "--x--y--z": "1px" }),
    organizeos: { variables: three(named("x--y--z", "X/Y/Z")) },
  });
  expect(groupVariables(["x--y--z"], "G")).toEqual({ ok: true });
  expect(registry().variables[0]).toMatchObject({
    cssName: "g--y--z",
    name: "G/Y/Z",
  });
});

test.each([
  ["  ", "Name is required"],
  ["a/b", "Use a name without /"],
])(
  "groupVariables refuses the group %j with %s, staging nothing",
  (group, error) => {
    project({
      styles: css({ "--gap": "1px" }),
      organizeos: { variables: three(named("gap", "Gap")) },
    });
    expectNothingStaged(() => {
      expect(groupVariables(["gap"], group)).toEqual({ ok: false, error });
    });
  }
);

test("groupVariables(['base'], 'Spacing') refuses with 'Can't rename this variable', staging nothing", () => {
  project({ styles: css({ "--base": "#ffffff", "--text": "#111111" }) });
  expectNothingStaged(() => {
    expect(groupVariables(["base"], "Spacing")).toEqual({
      ok: false,
      error: "Can't rename this variable",
    });
  });
});

const rowsOf = (collectionId: string) =>
  $variableCollections
    .get()
    .find((collection) => collection.id === collectionId)
    ?.rows.map((row) => row.cssName);

test("orderVariables stores a collection's rows in the asked order: A/X, B, A/Y (shown A/X, A/Y, B) asked as A/Y, A/X, B keeps the group above B, one undo step", () => {
  project({
    styles: css({ "--a--x": "1px", "--b": "2px", "--a--y": "3px" }),
    organizeos: {
      variables: three(
        named("a--x", "A/X"),
        named("b", "B"),
        named("a--y", "A/Y")
      ),
    },
  });
  expect(orderVariables("site", ["a--y", "a--x", "b"])).toEqual({ ok: true });
  expect(registry().variables.map((entry) => entry.cssName)).toEqual([
    "a--y",
    "a--x",
    "b",
  ]);
  expect(rowsOf("site")).toEqual(["a--y", "a--x", "b"]);
  expect(undoDepth()).toBe(1);
});

test("orderVariables moves only the collection's entries, in place among other collections' entries", () => {
  project({
    styles: css({ "--s1": "1px", "--g1": "2px", "--s2": "3px", "--g2": "4px" }),
    organizeos: {
      variables: three(
        size("s1"),
        size("g1", "c1"),
        size("s2"),
        size("g2", "c1")
      ),
    },
  });
  expect(orderVariables("c1", ["g2", "g1"])).toEqual({ ok: true });
  expect(registry().variables.map((entry) => entry.cssName)).toEqual([
    "s1",
    "g2",
    "g1",
    "s2",
  ]);
  expect(rowsOf("site")).toEqual(["s1", "s2"]);
});

test("orderVariables registers the typed unregistered rows placed before the last moved or registered row; an untyped row stays unregistered, at the end", () => {
  project({
    styles: css({ "--p": "1px", "--q": "2px", "--r": "3px", "--flex": "flex" }),
    organizeos: { variables: three(named("p", "P")) },
  });
  expect(rowsOf("site")).toEqual(["p", "q", "r", "flex"]);
  expect(orderVariables("site", ["q", "p", "r", "flex"])).toEqual({ ok: true });
  expect(
    registry().variables.map((entry) => [entry.cssName, entry.type])
  ).toEqual([
    ["q", "size"],
    ["p", "size"],
  ]);
  expect(rowsOf("site")).toEqual(["q", "p", "r", "flex"]);
  expect(orderVariables("site", ["flex", "q", "r", "p"])).toEqual({ ok: true });
  expect(registry().variables.map((entry) => entry.cssName)).toEqual([
    "q",
    "r",
    "p",
  ]);
  expect(rowsOf("site")).toEqual(["q", "r", "p", "flex"]);
});

test("orderVariables on an absent registry writes v1 holding the moved rows; the same order again stages nothing", () => {
  project({ styles: css({ "--p": "1px", "--q": "2px" }) });
  expect(orderVariables("site", ["q", "p"])).toEqual({ ok: true });
  expect(registry().version).toBe(1);
  expect(registry().variables.map((entry) => entry.cssName)).toEqual([
    "q",
    "p",
  ]);
  expect(undoDepth()).toBe(1);
  vi.mocked(executeStagedRuntimeMutation).mockClear();
  expect(orderVariables("site", ["q", "p"])).toEqual({ ok: true });
  expect(undoDepth()).toBe(1);
});

test("orderVariables refuses Brand, an unknown collection and a name not in the collection, staging nothing", () => {
  project({
    styles: [...css({ "--p": "1px" }), ...css({ "--base": "#fff" })],
    organizeos: { variables: three(named("p", "P")) },
  });
  expectNothingStaged(() => {
    expect(orderVariables("brand", ["base"])).toEqual({
      ok: false,
      error: "Can't change this collection",
    });
    expect(orderVariables("gone", [])).toEqual({
      ok: false,
      error: "Collection not found",
    });
    expect(orderVariables("site", ["p", "nope"])).toEqual({
      ok: false,
      error: "Variable not found",
    });
  });
});

test("orderVariables stages nothing when the asked order would show the same: a typed row asked below an untyped one stays above it", () => {
  project({ styles: css({ "--radius": "8px", "--shadow": "flex" }) });
  expect(rowsOf("site")).toEqual(["radius", "shadow"]);
  const styles = $styles.get();
  const settings = $projectSettings.get();
  expect(orderVariables("site", ["shadow", "radius"])).toEqual({ ok: true });
  expect(undoDepth()).toBe(0);
  expect($styles.get()).toBe(styles);
  expect($projectSettings.get()).toBe(settings);
  expect(rowsOf("site")).toEqual(["radius", "shadow"]);
});
