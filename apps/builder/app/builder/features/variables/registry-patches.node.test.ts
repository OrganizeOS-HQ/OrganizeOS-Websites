import { applyPatches, enablePatches, type Patch } from "immer";
import { expect, test } from "vitest";
import type {
  RegistryVariable,
  VariablesRegistry,
} from "@webstudio-is/project-build";
import type { BuilderPatch } from "@webstudio-is/project-build/contracts";
import {
  addCollectionPatches,
  addVariableEntryPatches,
  ensureRegistryPatches,
  moveCollectionPatches,
  moveVariableEntryPatches,
  pruneRegistryPatches,
  removeCollectionPatches,
  removeVariableEntriesPatches,
  updateCollectionPatches,
  updateVariableEntryPatches,
} from "./registry-patches";

enablePatches();

const site = { id: "site", name: "Site", system: "site" } as const;
const entry = (cssName: string, collectionId = "site") =>
  ({ cssName, collectionId, type: "size", name: cssName }) as const;
const registry = {
  version: 1,
  collections: [site, { id: "c1", name: "Spacing" }],
  variables: [entry("a"), entry("b"), entry("a", "c1")],
} as VariablesRegistry;
const at = (...path: (string | number)[]) => [
  "organizeos",
  "variables",
  ...path,
];
const stored = (patches: BuilderPatch[]) =>
  applyPatches(
    { meta: {}, compiler: {}, organizeos: { variables: registry } },
    patches as Patch[]
  ).organizeos.variables;

test("ensure: absent is one add of a v1 registry with Site", () => {
  const v1 = { version: 1, collections: [site], variables: [] };
  expect(ensureRegistryPatches({ status: "absent" }, undefined)).toEqual([
    { op: "add", path: ["organizeos"], value: { variables: v1 } },
  ]);
  expect(ensureRegistryPatches({ status: "absent" }, { other: 1 })).toEqual([
    { op: "add", path: at(), value: v1 },
  ]);
  expect(
    ensureRegistryPatches(
      { status: "readable", registry },
      { variables: registry }
    )
  ).toEqual([]);
  expect(() => ensureRegistryPatches({ status: "unreadable" }, "x")).toThrow();
});

test("entries: single-index add, replace, remove", () => {
  expect(addVariableEntryPatches(registry, entry("c"))).toEqual([
    { op: "add", path: at("variables", 3), value: entry("c") },
  ]);
  expect(addVariableEntryPatches(registry, entry("c"), 0)).toEqual([
    { op: "add", path: at("variables", 0), value: entry("c") },
  ]);
  expect(updateVariableEntryPatches(registry, "b", { name: "Gap" })).toEqual([
    {
      op: "replace",
      path: at("variables", 1),
      value: { ...entry("b"), name: "Gap" },
    },
  ]);
  expect(removeVariableEntriesPatches(registry, ["a"])).toEqual([
    { op: "remove", path: at("variables", 2) },
    { op: "remove", path: at("variables", 0) },
  ]);
  expect(moveVariableEntryPatches(registry, "b", 0)).toEqual([
    { op: "remove", path: at("variables", 1) },
    { op: "add", path: at("variables", 0), value: entry("b") },
  ]);
  expect(moveVariableEntryPatches(registry, "b", 1)).toEqual([]);
});

test("prune: every unlisted entry and every repeat after the first, in descending index order", () => {
  const withGone = {
    ...registry,
    variables: [...registry.variables, entry("gone")],
  };
  expect(pruneRegistryPatches(withGone, new Set(["a", "b"]))).toEqual([
    { op: "remove", path: at("variables", 3) },
    { op: "remove", path: at("variables", 2) },
  ]);
  expect(
    pruneRegistryPatches(
      { ...registry, variables: [entry("a"), entry("b")] },
      new Set(["a", "b"])
    )
  ).toEqual([]);
});

test("collections: the same on collections", () => {
  expect(addCollectionPatches(registry, { id: "c2", name: "Motion" })).toEqual([
    {
      op: "add",
      path: at("collections", 2),
      value: { id: "c2", name: "Motion" },
    },
  ]);
  expect(updateCollectionPatches(registry, "c1", { name: "Space" })).toEqual([
    {
      op: "replace",
      path: at("collections", 1),
      value: { id: "c1", name: "Space" },
    },
  ]);
  expect(removeCollectionPatches(registry, "c1")).toEqual([
    { op: "remove", path: at("collections", 1) },
  ]);
  expect(moveCollectionPatches(registry, "c1", 0)).toEqual([
    { op: "remove", path: at("collections", 1) },
    {
      op: "add",
      path: at("collections", 0),
      value: { id: "c1", name: "Spacing" },
    },
  ]);
});

test("patches land on the stored JSON as intended", () => {
  expect(
    stored(removeVariableEntriesPatches(registry, ["a"])).variables
  ).toEqual([entry("b")]);
  expect(
    stored(moveVariableEntryPatches(registry, "b", 0)).variables.map(
      (e: RegistryVariable) => e.cssName
    )
  ).toEqual(["b", "a", "a"]);
});
