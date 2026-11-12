import {
  SITE_COLLECTION_ID,
  type RegistryCollection,
  type RegistryState,
  type RegistryVariable,
  type VariablesRegistry,
} from "@webstudio-is/project-build";
import type { BuilderPatch } from "@webstudio-is/project-build/contracts";

/**
 * Narrow `projectSettings` patches for every registry change (spec 4.2).
 * Each is a single-index add, remove or replace: the server applies patches
 * to the stored JSON in order, so a whole-array replace could undo another
 * tab's change. Add, update and move act on the first entry of a name;
 * remove and prune act on every entry they name, in descending index order
 * so earlier indexes stay valid.
 */

type Patch = BuilderPatch;

const at = (...path: (string | number)[]) => [
  "organizeos",
  "variables",
  ...path,
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

const emptyRegistry = (): VariablesRegistry => ({
  version: 1,
  collections: [{ id: SITE_COLLECTION_ID, name: "Site", system: "site" }],
  variables: [],
});

/** Absent: one add of a v1 registry holding Site. Never for an unreadable one. */
export const ensureRegistryPatches = (
  state: RegistryState,
  organizeos: unknown
): Patch[] => {
  if (state.status === "readable") {
    return [];
  }
  if (state.status === "unreadable") {
    throw Error("The variables registry is unreadable");
  }
  return isRecord(organizeos)
    ? [{ op: "add", path: at(), value: emptyRegistry() }]
    : [
        {
          op: "add",
          path: ["organizeos"],
          value: { variables: emptyRegistry() },
        },
      ];
};

const descending = (indexes: number[]) =>
  [...indexes].sort((left, right) => right - left);

const removeAt = (field: "variables" | "collections", indexes: number[]) =>
  descending(indexes).map(
    (index): Patch => ({ op: "remove", path: at(field, index) })
  );

const moveTo = <Item>(
  field: "variables" | "collections",
  items: readonly Item[],
  from: number,
  toIndex: number
): Patch[] => {
  if (from === -1 || from === toIndex) {
    return [];
  }
  return [
    { op: "remove", path: at(field, from) },
    { op: "add", path: at(field, toIndex), value: items[from] },
  ];
};

const variableIndex = (registry: VariablesRegistry, cssName: string) =>
  registry.variables.findIndex((entry) => entry.cssName === cssName);

const collectionIndex = (registry: VariablesRegistry, id: string) =>
  registry.collections.findIndex((collection) => collection.id === id);

export const addVariableEntryPatches = (
  registry: VariablesRegistry,
  entry: RegistryVariable,
  index = registry.variables.length
): Patch[] => [{ op: "add", path: at("variables", index), value: entry }];

export const updateVariableEntryPatches = (
  registry: VariablesRegistry,
  cssName: string,
  changes: Partial<RegistryVariable>
): Patch[] => {
  const index = variableIndex(registry, cssName);
  if (index === -1) {
    return [];
  }
  return [
    {
      op: "replace",
      path: at("variables", index),
      value: { ...registry.variables[index], ...changes },
    },
  ];
};

export const removeVariableEntriesPatches = (
  registry: VariablesRegistry,
  cssNames: readonly string[]
): Patch[] => {
  const names = new Set(cssNames);
  const indexes = registry.variables.flatMap((entry, index) =>
    names.has(entry.cssName) ? [index] : []
  );
  return removeAt("variables", indexes);
};

export const moveVariableEntryPatches = (
  registry: VariablesRegistry,
  cssName: string,
  toIndex: number
): Patch[] =>
  moveTo(
    "variables",
    registry.variables,
    variableIndex(registry, cssName),
    toIndex
  );

/** Every entry whose name is not listed, and every repeat after the first. */
export const pruneRegistryPatches = (
  registry: VariablesRegistry,
  listed: ReadonlySet<string>
): Patch[] => {
  const seen = new Set<string>();
  const indexes: number[] = [];
  registry.variables.forEach((entry, index) => {
    if (listed.has(entry.cssName) === false || seen.has(entry.cssName)) {
      indexes.push(index);
    }
    seen.add(entry.cssName);
  });
  return removeAt("variables", indexes);
};

export const addCollectionPatches = (
  registry: VariablesRegistry,
  collection: RegistryCollection
): Patch[] => [
  {
    op: "add",
    path: at("collections", registry.collections.length),
    value: collection,
  },
];

export const updateCollectionPatches = (
  registry: VariablesRegistry,
  id: string,
  changes: { name: string }
): Patch[] => {
  const index = collectionIndex(registry, id);
  if (index === -1) {
    return [];
  }
  return [
    {
      op: "replace",
      path: at("collections", index),
      value: { ...registry.collections[index], ...changes },
    },
  ];
};

export const removeCollectionPatches = (
  registry: VariablesRegistry,
  id: string
): Patch[] =>
  removeAt(
    "collections",
    registry.collections.flatMap((collection, index) =>
      collection.id === id ? [index] : []
    )
  );

export const moveCollectionPatches = (
  registry: VariablesRegistry,
  id: string,
  toIndex: number
): Patch[] =>
  moveTo(
    "collections",
    registry.collections,
    collectionIndex(registry, id),
    toIndex
  );
