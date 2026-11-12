import { toValue, type StyleValue } from "@webstudio-is/css-engine";
import {
  BRAND_COLLECTION_ID,
  readVariablesRegistry,
  SITE_COLLECTION_ID,
  type RegistryVariable,
  type VariablesRegistry,
  type VariableType,
} from "@webstudio-is/project-build";
import type { BuilderPatch } from "@webstudio-is/project-build/contracts";
import {
  createRuntimeMutation,
  getCssVariableUsageCounts,
  getDefinedCssVariableNames,
  rewriteCssVariableReferencesInString,
  validateCssVariableNameWithStyles,
  type CssVariableNameError,
} from "@webstudio-is/project-build/runtime";
import {
  canCommitWebstudioData,
  executeStagedRuntimeMutation,
  type RuntimeMutationAccumulator,
} from "~/shared/instance-utils/data";
import { builderApi } from "~/shared/builder-api";
import { serverSyncStore } from "~/shared/sync/sync-stores";
import { $projectSettings, $props, $styles } from "~/shared/sync/data-stores";
import {
  CANONICAL_CSS_NAMES,
  CSS_NAME_PATTERN,
  displayNameFromCssName,
  isProtectedName,
  slugifyDisplayName,
  uniqueCssName,
} from "./names";
import { validateVariableValue } from "./value-types";
import { countVariableInText, replaceVariableReferences } from "./references";
import {
  $rootVariables,
  $variableCollections,
  $variablesRegistryState,
  listRootVariables,
  resolveRootVariable,
  type VariableRow,
} from "./reader";
import {
  addVariableEntryPatches,
  ensureRegistryPatches,
  moveVariableEntryPatches,
  pruneRegistryPatches,
  removeVariableEntriesPatches,
  updateVariableEntryPatches,
} from "./registry-patches";

/**
 * Every write of the Variables manager (spec 4.10): one transaction and one
 * undo step, styles and registry together. Each operation runs its checks
 * against the stores and returns a refusal before anything is staged; a
 * stage reads only `accumulator.state`, so several stages compose in one
 * accumulator. Names are written without the leading `--`.
 */

export type WriteResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

type Prepared<T extends object> =
  | { ok: false; error: string }
  | {
      ok: true;
      result: T;
      stage: (accumulator: RuntimeMutationAccumulator) => void;
    };

const refuse = (error: string): { ok: false; error: string } => ({
  ok: false,
  error,
});

const templateRefusal =
  "Page templates can be edited only in design mode, with build access.";

/**
 * Runs the shared checks, then commits. A synchronous stage commits before
 * executeStagedRuntimeMutation first awaits, so whether the transaction
 * landed is known on the next line: a new top of the undo stack, or a stage
 * that staged nothing. The top is compared, not the length, because the
 * stack is capped and drops its oldest entry on a push.
 */
const commitPrepared = <T extends object>(
  prepared: Prepared<T>
): WriteResult<T> => {
  if (canCommitWebstudioData() === false) {
    return refuse(templateRefusal);
  }
  if ($variablesRegistryState.get().status === "unreadable") {
    return refuse("Reload to edit variables");
  }
  if (prepared.ok === false) {
    return prepared;
  }
  const top = serverSyncStore.transactionManager.currentStack.at(-1);
  let empty = false;
  executeStagedRuntimeMutation((accumulator) => {
    const start = accumulator.state;
    prepared.stage(accumulator);
    empty = accumulator.state === start;
  }).catch((error: unknown) => {
    builderApi.toast.error(
      error instanceof Error ? error.message : String(error)
    );
  });
  const landed = serverSyncStore.transactionManager.currentStack.at(-1) !== top;
  if (landed || empty) {
    return { ok: true, ...prepared.result };
  }
  return refuse("Can't change this variable");
};

// Staging helpers: they read accumulator.state only.

/** Never stages an empty change: one would copy the state and add nothing. */
const stagePatches = (
  accumulator: RuntimeMutationAccumulator,
  namespace: "styles" | "projectSettings",
  patches: BuilderPatch[]
) => {
  if (patches.length === 0) {
    return;
  }
  accumulator.stage(
    createRuntimeMutation({
      payload: [{ namespace, patches }],
      result: {},
      invalidatesNamespaces: [namespace],
    })
  );
};

/** The accumulator's state, every namespace present (getWebstudioData). */
const stateOf = (accumulator: RuntimeMutationAccumulator) =>
  accumulator.state as Required<RuntimeMutationAccumulator["state"]>;

const registryIn = (accumulator: RuntimeMutationAccumulator) =>
  readVariablesRegistry(stateOf(accumulator).projectSettings.organizeos);

const readableIn = (
  accumulator: RuntimeMutationAccumulator
): VariablesRegistry | undefined => {
  const state = registryIn(accumulator);
  return state.status === "readable" ? state.registry : undefined;
};

const takenIn = (accumulator: RuntimeMutationAccumulator) =>
  new Set(
    Array.from(
      getDefinedCssVariableNames(stateOf(accumulator).styles.values())
    ).map((name) => name.slice(2))
  );

/** A write that adds an entry first makes sure a registry exists. */
const stageEnsure = (accumulator: RuntimeMutationAccumulator) => {
  const state = registryIn(accumulator);
  if (state.status === "absent") {
    stagePatches(
      accumulator,
      "projectSettings",
      ensureRegistryPatches(
        state,
        stateOf(accumulator).projectSettings.organizeos
      )
    );
  }
};

/** Every registry write first drops stale and repeated entries. */
const stagePrune = (accumulator: RuntimeMutationAccumulator) => {
  const registry = readableIn(accumulator);
  if (registry !== undefined) {
    const listed = new Set(
      listRootVariables(stateOf(accumulator)).map(
        (variable) => variable.cssName
      )
    );
    stagePatches(
      accumulator,
      "projectSettings",
      pruneRegistryPatches(registry, listed)
    );
  }
};

const stageDefine = (
  accumulator: RuntimeMutationAccumulator,
  cssName: string,
  value: StyleValue,
  overwrite: boolean
) => {
  accumulator.execute({
    id: "cssVariables.define",
    input: { vars: { [`--${cssName}`]: value }, overwrite },
  });
};

// Store readers for the checks.

const findRow = (cssName: string): VariableRow | undefined =>
  $variableCollections
    .get()
    .flatMap((collection) => collection.rows)
    .find((row) => row.cssName === cssName);

const isCanonical = (cssName: string) =>
  (CANONICAL_CSS_NAMES as readonly string[]).includes(cssName);

const checkDisplayName = (displayName: string) => {
  const name = displayName.trim();
  if (name === "") {
    return "Name is required";
  }
  if (name.length > 128) {
    return "Name is too long";
  }
  return;
};

/** A link must name a listed variable of the same type, and never loop. */
const checkAlias = (
  cssName: string | undefined,
  type: VariableType | undefined,
  value: StyleValue
) => {
  if (value.type !== "var") {
    return;
  }
  const target = findRow(value.value);
  if (
    target === undefined ||
    target.value === undefined ||
    target.type === undefined ||
    target.type !== type
  ) {
    return "Link to a variable of the same type";
  }
  const values = new Map(
    $rootVariables.get().map((variable) => [variable.cssName, variable.value])
  );
  const seen = new Set<string>();
  let current: string | undefined = value.value;
  while (current !== undefined && seen.has(current) === false) {
    if (current === cssName) {
      return "This link would loop";
    }
    seen.add(current);
    const next = values.get(current);
    current = next?.type === "var" ? next.value : undefined;
  }
  return;
};

// The composable core: A2's and B's operations run these stages together.

type CreateInput = {
  collectionId: string;
  /** undefined: a declaration only, with no registry entry (an untyped duplicate) */
  type: VariableType | undefined;
  displayName: string;
  value: StyleValue;
  /** the entry goes before the entry of the collection's row at this position */
  index?: number;
  /** the entry goes right after this variable's entry */
  after?: string;
};

const prepareCreateVariable = (
  input: CreateInput
): Prepared<{ cssName: string }> => {
  if (input.collectionId === BRAND_COLLECTION_ID) {
    return refuse("Can't change this variable");
  }
  const collection = $variableCollections
    .get()
    .find((item) => item.id === input.collectionId);
  if (collection === undefined) {
    return refuse("Collection not found");
  }
  const nameError = checkDisplayName(input.displayName);
  if (nameError !== undefined) {
    return refuse(nameError);
  }
  if (input.value.type === "invalid") {
    return refuse("Invalid value");
  }
  const aliasError = checkAlias(undefined, input.type, input.value);
  if (aliasError !== undefined) {
    return refuse(aliasError);
  }
  const before =
    input.index === undefined
      ? undefined
      : collection.rows.find(
          (row, position) => position >= input.index! && row.registered
        )?.cssName;
  const result = { cssName: "" };
  return {
    ok: true,
    result,
    stage: (accumulator) => {
      const displayName = input.displayName.trim();
      const cssName = uniqueCssName(
        slugifyDisplayName(displayName),
        takenIn(accumulator)
      );
      result.cssName = cssName;
      if (input.type !== undefined) {
        stageEnsure(accumulator);
        stagePrune(accumulator);
      }
      stageDefine(accumulator, cssName, input.value, false);
      const registry = readableIn(accumulator);
      if (input.type === undefined || registry === undefined) {
        return;
      }
      const entry: RegistryVariable = {
        cssName,
        collectionId: input.collectionId,
        type: input.type,
        name: displayName,
      };
      const anchor = input.after ?? before;
      const anchorIndex =
        anchor === undefined
          ? -1
          : registry.variables.findIndex((item) => item.cssName === anchor);
      const index =
        anchorIndex === -1
          ? registry.variables.length
          : input.after === undefined
            ? anchorIndex
            : anchorIndex + 1;
      stagePatches(
        accumulator,
        "projectSettings",
        addVariableEntryPatches(registry, entry, index)
      );
    },
  };
};

type RenameInput = { from: string; displayName?: string; to?: string };

const prepareRenameVariable = (
  input: RenameInput
): Prepared<{ cssName: string }> => {
  const { from, to } = input;
  if (isProtectedName(from)) {
    return refuse("Can't rename this variable");
  }
  const row = findRow(from);
  if (row === undefined) {
    return refuse("Variable not found");
  }
  if (to !== undefined) {
    if (to === from) {
      return { ok: true, result: { cssName: from }, stage: () => {} };
    }
    if (CSS_NAME_PATTERN.test(to) === false) {
      return refuse("Use lowercase letters, digits and single hyphens");
    }
    if (isProtectedName(to)) {
      return refuse("This name is reserved");
    }
    if (getDefinedCssVariableNames($styles.get().values()).has(`--${to}`)) {
      return refuse(`CSS variable "--${to}" already exists`);
    }
  }
  if (input.displayName !== undefined) {
    const nameError = checkDisplayName(input.displayName);
    if (nameError !== undefined) {
      return refuse(nameError);
    }
  }
  const displayName = input.displayName?.trim();
  const registers =
    displayName !== undefined &&
    row.registered === false &&
    row.type !== undefined;
  const result = { cssName: from };
  return {
    ok: true,
    result,
    stage: (accumulator) => {
      let cssName = to;
      if (cssName === undefined) {
        const taken = takenIn(accumulator);
        taken.delete(from);
        cssName = uniqueCssName(slugifyDisplayName(displayName ?? ""), taken);
      }
      result.cssName = cssName;
      if (registers) {
        stageEnsure(accumulator);
      }
      // the prune runs before the rename: after it, only the new name is listed
      stagePrune(accumulator);
      if (cssName !== from) {
        accumulator.execute({
          id: "cssVariables.rename",
          input: { oldName: `--${from}`, newName: `--${cssName}` },
        });
        const code = stateOf(accumulator).projectSettings.meta.code;
        if (code !== undefined) {
          const next = rewriteCssVariableReferencesInString(code, {
            [`--${from}`]: `--${cssName}`,
          });
          if (next !== code) {
            stagePatches(accumulator, "projectSettings", [
              { op: "replace", path: ["meta", "code"], value: next },
            ]);
          }
        }
      }
      const registry = readableIn(accumulator);
      if (registry === undefined) {
        return;
      }
      const name = displayName ?? displayNameFromCssName(cssName);
      if (registry.variables.some((entry) => entry.cssName === from)) {
        stagePatches(
          accumulator,
          "projectSettings",
          updateVariableEntryPatches(registry, from, { cssName, name })
        );
      } else if (registers && row.type !== undefined) {
        stagePatches(
          accumulator,
          "projectSettings",
          addVariableEntryPatches(registry, {
            cssName,
            collectionId: SITE_COLLECTION_ID,
            type: row.type,
            name,
          })
        );
      }
    },
  };
};

const unresolved = new Set(["invalid", "guaranteedInvalid", "var"]);

const prepareDeleteVariables = (
  cssNames: readonly string[]
): Prepared<{ deleted: number }> => {
  if (cssNames.some(isProtectedName)) {
    return refuse("Can't delete this variable");
  }
  // The base value each reference takes; one that does not resolve takes
  // `unset` (deviation 11).
  const literals = new Map(
    cssNames.map((cssName) => {
      const value = resolveRootVariable(cssName);
      return [
        cssName,
        unresolved.has(value.type)
          ? ({ type: "keyword", value: "unset" } as const)
          : value,
      ];
    })
  );
  return {
    ok: true,
    result: { deleted: cssNames.length },
    stage: (accumulator) => {
      stagePrune(accumulator);
      const deleted = new Set(cssNames.map((cssName) => `--${cssName}`));
      const patches: BuilderPatch[] = [];
      for (const [key, decl] of stateOf(accumulator).styles) {
        if (deleted.has(decl.property)) {
          continue;
        }
        let value = decl.value;
        for (const [cssName, literal] of literals) {
          value = replaceVariableReferences(value, cssName, literal);
        }
        if (value !== decl.value) {
          patches.push({
            op: "replace",
            path: [key],
            value: { ...decl, value },
          });
        }
      }
      stagePatches(accumulator, "styles", patches);
      accumulator.execute({
        id: "cssVariables.delete",
        input: { names: Array.from(deleted), force: true },
      });
      const registry = readableIn(accumulator);
      if (registry !== undefined) {
        stagePatches(
          accumulator,
          "projectSettings",
          removeVariableEntriesPatches(registry, cssNames)
        );
      }
    },
  };
};

// The A1 operations.

export const createVariable = (input: {
  collectionId: string;
  type: VariableType;
  displayName: string;
  value: StyleValue;
  index?: number;
}): WriteResult<{ cssName: string }> =>
  commitPrepared(prepareCreateVariable(input));

/**
 * Writes a non-var value as given (callers validate typed values); a var
 * value follows the alias rule. A missing Brand variable is written back
 * only while another of the six exists (spec 4.9).
 */
export const setVariableValue = (
  cssName: string,
  value: StyleValue
): WriteResult => {
  const row = findRow(cssName);
  let prepared: Prepared<object>;
  if (row === undefined) {
    prepared = refuse(
      isCanonical(cssName) ? "Can't change this variable" : "Variable not found"
    );
  } else if (value.type === "invalid") {
    prepared = refuse("Invalid value");
  } else {
    const aliasError = checkAlias(cssName, row.type, value);
    prepared =
      aliasError === undefined
        ? {
            ok: true,
            result: {},
            stage: (accumulator) =>
              stageDefine(accumulator, cssName, value, true),
          }
        : refuse(aliasError);
  }
  return commitPrepared(prepared);
};

export const renameVariable = (
  input: RenameInput
): WriteResult<{ cssName: string }> =>
  commitPrepared(prepareRenameVariable(input));

export const deleteVariables = (
  cssNames: readonly string[]
): WriteResult<{ deleted: number }> =>
  commitPrepared(prepareDeleteVariables(cssNames));

/** Styles and props, plus project custom code as one place. */
export const getVariableUsage = (cssName: string) => {
  const counts = getCssVariableUsageCounts({
    styles: $styles.get().values(),
    props: $props.get().values(),
  });
  const code = $projectSettings.get()?.meta.code ?? "";
  return (
    (counts.get(`--${cssName}`) ?? 0) +
    (countVariableInText(code, cssName) > 0 ? 1 : 0)
  );
};

export const duplicateVariable = (
  cssName: string
): WriteResult<{ cssName: string }> => {
  const row = findRow(cssName);
  if (isCanonical(cssName)) {
    return commitPrepared(refuse("Can't change this variable"));
  }
  if (row === undefined || row.value === undefined) {
    return commitPrepared(refuse("Variable not found"));
  }
  return commitPrepared(
    prepareCreateVariable({
      collectionId: row.collectionId,
      type: row.type,
      displayName: `${row.displayName} copy`,
      value: row.value,
      after: row.registered ? cssName : undefined,
    })
  );
};

export const moveVariables = (
  cssNames: readonly string[],
  collectionId: string
): WriteResult => {
  const collections = $variableCollections.get();
  const rows = cssNames.map(findRow);
  let error: string | undefined;
  if (collectionId === BRAND_COLLECTION_ID || cssNames.some(isCanonical)) {
    error = "Can't change this variable";
  } else if (collections.some((item) => item.id === collectionId) === false) {
    error = "Collection not found";
  } else if (rows.some((row) => row === undefined)) {
    error = "Variable not found";
  } else if (rows.some((row) => row?.type === undefined)) {
    error = "Set a type first";
  }
  if (error !== undefined) {
    return commitPrepared(refuse(error));
  }
  return commitPrepared({
    ok: true,
    result: {},
    stage: (accumulator) => {
      stageEnsure(accumulator);
      stagePrune(accumulator);
      for (const row of rows) {
        if (row === undefined || row.type === undefined) {
          continue;
        }
        const registry = readableIn(accumulator);
        if (registry === undefined) {
          return;
        }
        const entry = registry.variables.find(
          (item) => item.cssName === row.cssName
        );
        stagePatches(
          accumulator,
          "projectSettings",
          removeVariableEntriesPatches(registry, [row.cssName])
        );
        const pruned = readableIn(accumulator) ?? registry;
        stagePatches(
          accumulator,
          "projectSettings",
          addVariableEntryPatches(pruned, {
            ...(entry ?? {
              cssName: row.cssName,
              type: row.type,
              name: row.displayName,
            }),
            collectionId,
          })
        );
      }
    },
  });
};

/**
 * `toIndex` is a position among the collection's rows as
 * $variableCollections lists them, clamped to its registered rows. The
 * anchor is named here and turned into a registry index in the stage.
 */
export const reorderVariable = (
  cssName: string,
  toIndex: number
): WriteResult => {
  const row = findRow(cssName);
  if (row === undefined) {
    return commitPrepared(refuse("Variable not found"));
  }
  if (row.collectionId === BRAND_COLLECTION_ID) {
    return commitPrepared(refuse("Can't change this variable"));
  }
  if (row.type === undefined) {
    return commitPrepared(refuse("Set a type first"));
  }
  const type = row.type;
  const registeredRows =
    $variableCollections
      .get()
      .find((collection) => collection.id === row.collectionId)
      ?.rows.filter((item) => item.registered) ?? [];
  const position = Math.min(
    Math.max(toIndex, 0),
    Math.max(registeredRows.length - 1, 0)
  );
  const anchor = registeredRows[position]?.cssName;
  if (anchor === cssName) {
    return commitPrepared({ ok: true, result: {}, stage: () => {} });
  }
  return commitPrepared({
    ok: true,
    result: {},
    stage: (accumulator) => {
      if (row.registered === false) {
        stageEnsure(accumulator);
      }
      stagePrune(accumulator);
      const registry = readableIn(accumulator);
      if (registry === undefined) {
        return;
      }
      const anchorIndex =
        anchor === undefined
          ? -1
          : registry.variables.findIndex((item) => item.cssName === anchor);
      if (row.registered) {
        stagePatches(
          accumulator,
          "projectSettings",
          moveVariableEntryPatches(
            registry,
            cssName,
            anchorIndex === -1 ? registry.variables.length - 1 : anchorIndex
          )
        );
        return;
      }
      stagePatches(
        accumulator,
        "projectSettings",
        addVariableEntryPatches(
          registry,
          {
            cssName,
            collectionId: row.collectionId,
            type,
            name: row.displayName,
          },
          anchorIndex === -1 ? registry.variables.length : anchorIndex
        )
      );
    },
  });
};

/** An untyped variable takes its first type; the value must validate. */
export const setVariableType = (
  cssName: string,
  type: VariableType
): WriteResult => {
  const row = findRow(cssName);
  if (row === undefined || row.value === undefined) {
    return commitPrepared(refuse("Variable not found"));
  }
  if (row.type !== undefined) {
    return commitPrepared(refuse("This variable already has a type"));
  }
  const validated = validateVariableValue(type, toValue(row.value));
  if (validated.ok === false) {
    return commitPrepared(refuse(validated.error));
  }
  return commitPrepared({
    ok: true,
    result: {},
    stage: (accumulator) => {
      stageEnsure(accumulator);
      stagePrune(accumulator);
      stageDefine(accumulator, cssName, validated.value, true);
      const registry = readableIn(accumulator);
      if (registry !== undefined) {
        stagePatches(
          accumulator,
          "projectSettings",
          addVariableEntryPatches(registry, {
            cssName,
            collectionId: SITE_COLLECTION_ID,
            type,
            name: row.displayName,
          })
        );
      }
    },
  });
};

// The Cmd+K routing (spec 4.9). Inputs are upstream's "--"-prefixed
// properties. A name Global Root declares at the base breakpoint goes
// through the operations above; any other keeps upstream's behaviour.

const isListedRoot = (cssName: string) =>
  $rootVariables.get().some((variable) => variable.cssName === cssName);

const isUnreadable = () =>
  $variablesRegistryState.get().status === "unreadable";

/** "upstream": not a listed root variable, so upstream's rename runs. */
export const routeCssVariableRename = (
  oldProperty: string,
  newProperty: string
): CssVariableNameError | undefined | "upstream" => {
  const from = oldProperty.slice(2);
  if (isProtectedName(from)) {
    return { type: "invalid", message: "Can't rename this variable" };
  }
  if (isListedRoot(from) === false) {
    return "upstream";
  }
  if (isUnreadable()) {
    return { type: "invalid", message: "Reload to rename this variable" };
  }
  const validationError = validateCssVariableNameWithStyles({
    name: newProperty,
    currentProperty: oldProperty,
    styles: $styles.get().values(),
  });
  if (validationError !== undefined) {
    return validationError;
  }
  const result = renameVariable({ from, to: newProperty.slice(2) });
  return result.ok ? undefined : { type: "invalid", message: result.error };
};

/**
 * The number deleted, 0 on a refusal or a commit that did not land, or
 * undefined when no name is a listed root variable (upstream deletes).
 */
export const routeCssVariableDelete = (
  properties: readonly string[]
): number | undefined => {
  const names = properties.map((property) => property.slice(2));
  if (names.some(isProtectedName)) {
    return 0;
  }
  if (names.some(isListedRoot) === false) {
    return;
  }
  if (isUnreadable()) {
    return 0;
  }
  const result = deleteVariables(names);
  return result.ok ? result.deleted : 0;
};

/** The line a delete dialog shows instead of deleting. */
export const getCssVariableDeleteRefusal = (
  properties: readonly string[]
): string | undefined => {
  const names = properties.map((property) => property.slice(2));
  if (names.some(isProtectedName)) {
    return "Can't delete this variable";
  }
  if (isUnreadable() && names.some(isListedRoot)) {
    return "Reload to delete variables";
  }
  return;
};

/** "Delete unused" never offers a protected name or one in custom code. */
export const withoutKeptCssVariables = (
  names: Set<string>,
  code: string | undefined
) =>
  new Set(
    Array.from(names).filter((property) => {
      const name = property.slice(2);
      return (
        isProtectedName(name) === false &&
        countVariableInText(code ?? "", name) === 0
      );
    })
  );
