import { computed } from "nanostores";
import type { CssProperty, StyleValue } from "@webstudio-is/css-engine";
import {
  getStyleDeclKey,
  ROOT_INSTANCE_ID,
  rootComponent,
  type WebstudioData,
} from "@webstudio-is/sdk";
import {
  BRAND_COLLECTION_ID,
  readVariablesRegistry,
  SITE_COLLECTION_ID,
  type RegistryState,
  type VariableType,
} from "@webstudio-is/project-build";
import { isBaseWidthBreakpoint } from "@webstudio-is/project-build/runtime";
import {
  getComputedStyleDecl,
  type StyleObjectModel,
} from "~/shared/style-object-model";
import {
  $assets,
  $breakpoints,
  $projectSettings,
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import {
  BRAND_DISPLAY_NAMES,
  CANONICAL_CSS_NAMES,
  displayNameFromCssName,
  isProtectedName,
} from "./names";
import { inferVariableType } from "./value-types";

/**
 * The Variables manager's rows, computed from styles and never stored
 * (spec 4.3): every `--*` declaration on Global Root's local source at the
 * base breakpoint is listed, registered or not. Names are written without
 * the leading `--`.
 */

export type RootVariable = {
  cssName: string;
  value: StyleValue;
  styleDeclKey: string;
};

export type VariableRow = {
  cssName: string;
  /** the full name, group prefix included ("Spacing/Large") */
  displayName: string;
  /** the text before the first "/"; the leaf is the text after it */
  group: string | undefined;
  collectionId: string;
  /** undefined: untyped */
  type: VariableType | undefined;
  /** undefined: a missing Brand row */
  value: StyleValue | undefined;
  registered: boolean;
  /** Brand, or a protected name */
  locked: boolean;
};

export type CollectionView = {
  id: string;
  name: string;
  system?: "brand" | "site";
  rows: VariableRow[];
};

type RootData = Pick<
  WebstudioData,
  "styles" | "styleSources" | "styleSourceSelections" | "breakpoints"
>;

const findRootTarget = (data: RootData) => {
  const localId = data.styleSourceSelections
    .get(ROOT_INSTANCE_ID)
    ?.values.find((id) => data.styleSources.get(id)?.type === "local");
  const base = Array.from(data.breakpoints.values()).find(
    isBaseWidthBreakpoint
  );
  return { localId, baseId: base?.id };
};

/** Global Root's local source, the base breakpoint, no state. */
export const listRootVariables = (data: RootData): RootVariable[] => {
  const { localId, baseId } = findRootTarget(data);
  if (localId === undefined || baseId === undefined) {
    return [];
  }
  const variables: RootVariable[] = [];
  for (const decl of data.styles.values()) {
    if (
      decl.styleSourceId === localId &&
      decl.breakpointId === baseId &&
      decl.state === undefined &&
      decl.property.startsWith("--")
    ) {
      variables.push({
        cssName: decl.property.slice(2),
        value: decl.value,
        styleDeclKey: getStyleDeclKey(decl),
      });
    }
  }
  return variables;
};

const isSameVariables = (
  previous: RootVariable[],
  next: RootVariable[]
): boolean =>
  previous.length === next.length &&
  previous.every(
    (variable, index) =>
      variable.cssName === next[index].cssName &&
      variable.styleDeclKey === next[index].styleDeclKey &&
      JSON.stringify(variable.value) === JSON.stringify(next[index].value)
  );

const groupOf = (displayName: string) => {
  const slash = displayName.indexOf("/");
  return slash === -1 ? undefined : displayName.slice(0, slash);
};

const brandType = (cssName: string): VariableType =>
  cssName.startsWith("font-") ? "fontFamily" : "color";

export const reconcileVariables = ({
  rootVariables,
  registry,
  fontNames,
}: {
  rootVariables: RootVariable[];
  registry: RegistryState;
  fontNames: ReadonlySet<string>;
}): CollectionView[] => {
  const byName = new Map(
    rootVariables.map((variable) => [variable.cssName, variable])
  );
  const canonical = new Set<string>(CANONICAL_CSS_NAMES);
  const stored = registry.status === "readable" ? registry.registry : undefined;
  const collections: CollectionView[] = [];

  if (CANONICAL_CSS_NAMES.some((name) => byName.has(name))) {
    collections.push({
      id: BRAND_COLLECTION_ID,
      name: "Brand",
      system: "brand",
      rows: CANONICAL_CSS_NAMES.map((cssName) => ({
        cssName,
        displayName: BRAND_DISPLAY_NAMES[cssName],
        group: undefined,
        collectionId: BRAND_COLLECTION_ID,
        type: brandType(cssName),
        value: byName.get(cssName)?.value,
        registered: false,
        locked: true,
      })),
    });
  }

  const storedSite = stored?.collections.find(
    (collection) => collection.id === SITE_COLLECTION_ID
  );
  const site: CollectionView = {
    id: SITE_COLLECTION_ID,
    name: storedSite?.name ?? "Site",
    system: "site",
    rows: [],
  };
  collections.push(site);
  const views = new Map<string, CollectionView>([[site.id, site]]);
  for (const collection of stored?.collections ?? []) {
    if (
      collection.id === SITE_COLLECTION_ID ||
      collection.id === BRAND_COLLECTION_ID ||
      views.has(collection.id)
    ) {
      continue;
    }
    const view = { id: collection.id, name: collection.name, rows: [] };
    views.set(view.id, view);
    collections.push(view);
  }

  // The first entry of a listed, non-canonical name wins; stale and repeated
  // entries are skipped here, and dropped on the next registry write.
  const entries = new Map<string, (typeof stored & {})["variables"][number]>();
  for (const entry of stored?.variables ?? []) {
    if (
      canonical.has(entry.cssName) === false &&
      byName.has(entry.cssName) &&
      entries.has(entry.cssName) === false
    ) {
      entries.set(entry.cssName, entry);
    }
  }

  const typeOf = (
    cssName: string,
    visited: ReadonlySet<string>
  ): VariableType | undefined => {
    const entry = entries.get(cssName);
    if (entry !== undefined) {
      return entry.type;
    }
    if (canonical.has(cssName)) {
      return brandType(cssName);
    }
    const value = byName.get(cssName)?.value;
    if (value === undefined) {
      return;
    }
    if (value.type === "var") {
      return visited.has(value.value)
        ? undefined
        : typeOf(value.value, new Set([...visited, cssName]));
    }
    return inferVariableType(value, fontNames);
  };

  for (const entry of entries.values()) {
    const view = views.get(entry.collectionId) ?? site;
    view.rows.push({
      cssName: entry.cssName,
      displayName: entry.name,
      group: groupOf(entry.name),
      collectionId: view.id,
      type: entry.type,
      value: byName.get(entry.cssName)?.value,
      registered: true,
      locked: isProtectedName(entry.cssName),
    });
  }

  for (const variable of rootVariables) {
    if (canonical.has(variable.cssName) || entries.has(variable.cssName)) {
      continue;
    }
    const displayName = displayNameFromCssName(variable.cssName);
    site.rows.push({
      cssName: variable.cssName,
      displayName,
      group: groupOf(displayName),
      collectionId: site.id,
      type: typeOf(variable.cssName, new Set([variable.cssName])),
      value: variable.value,
      registered: false,
      locked: isProtectedName(variable.cssName),
    });
  }

  return collections;
};

let previousRootVariables: RootVariable[] = [];

/** Republished only when a variable's name, value or key changes. */
export const $rootVariables = computed(
  [$styles, $styleSources, $styleSourceSelections, $breakpoints],
  (styles, styleSources, styleSourceSelections, breakpoints) => {
    const next = listRootVariables({
      styles,
      styleSources,
      styleSourceSelections,
      breakpoints,
    });
    if (isSameVariables(previousRootVariables, next)) {
      return previousRootVariables;
    }
    previousRootVariables = next;
    return next;
  }
);

export const $variablesRegistryState = computed(
  $projectSettings,
  (projectSettings): RegistryState =>
    readVariablesRegistry(projectSettings?.organizeos)
);

/** The families of the site's uploaded fonts. */
const $fontNames = computed($assets, (assets) => {
  const names = new Set<string>();
  for (const asset of assets.values()) {
    if (asset.type === "font" && "family" in asset.meta) {
      names.add(asset.meta.family);
    }
  }
  return names;
});

export const $variableCollections = computed(
  [$rootVariables, $variablesRegistryState, $fontNames],
  (rootVariables, registry, fontNames) =>
    reconcileVariables({ rootVariables, registry, fontNames })
);

/** Each listed variable's display name, for the Style panel's bind control. */
export const $variableDisplayNames = computed(
  $variableCollections,
  (collections) =>
    new Map(
      collections.flatMap((collection) =>
        collection.rows.map((row) => [row.cssName, row.displayName] as const)
      )
    )
);

/**
 * One model of Global Root alone: its local source only, so a root token's
 * declaration never shadows the base value; the base breakpoint; no states.
 */
const $rootStyleModel = computed(
  [$styles, $styleSources, $styleSourceSelections, $breakpoints],
  (
    styles,
    styleSources,
    styleSourceSelections,
    breakpoints
  ): StyleObjectModel => {
    const { localId, baseId } = findRootTarget({
      styles,
      styleSources,
      styleSourceSelections,
      breakpoints,
    });
    return {
      styles,
      styleSourceSelections: new Map([
        [
          ROOT_INSTANCE_ID,
          {
            instanceId: ROOT_INSTANCE_ID,
            values: localId === undefined ? [] : [localId],
          },
        ],
      ]),
      presetStyles: new Map(),
      instanceTags: new Map(),
      instanceComponents: new Map([[ROOT_INSTANCE_ID, rootComponent]]),
      matchingBreakpoints: baseId === undefined ? [] : [baseId],
      matchingStates: new Set(),
    };
  }
);

/** A variable's resolved base value, alias chains followed. */
export const resolveRootVariable = (cssName: string): StyleValue =>
  getComputedStyleDecl({
    model: $rootStyleModel.get(),
    instanceSelector: [ROOT_INSTANCE_ID],
    property: `--${cssName}` as CssProperty,
  }).usedValue;
