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
  renameCollection,
  reorderCollection,
} from "./operations";

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
