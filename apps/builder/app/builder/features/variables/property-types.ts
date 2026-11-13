import { propertiesData } from "@webstudio-is/css-data";
import type { CssProperty } from "@webstudio-is/css-engine";
import { variableTypes, type VariableType } from "@webstudio-is/project-build";

/**
 * Which variable types a Style panel row takes (spec 6.2, 6.3). Pure: no
 * store or design-system import, so it runs in the node project.
 */

export const COLOR_PROPERTIES: ReadonlySet<CssProperty> = new Set<CssProperty>([
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
]);

/** A fractional Number would bind and compute to the initial value. */
export const INTEGER_PROPERTIES: ReadonlySet<CssProperty> =
  new Set<CssProperty>(["z-index", "order"]);

/**
 * Rows the "+" never binds: the layered background properties (one bind
 * would wipe every layer), position pairs, the grid lines (one Number for all
 * four), a ratio, and a weight its Select cannot show.
 */
export const EXCLUDED_PROPERTIES: ReadonlySet<CssProperty> =
  new Set<CssProperty>([
    "background-image",
    "background-position-x",
    "background-position-y",
    "background-size",
    "background-repeat",
    "background-attachment",
    "background-clip",
    "background-origin",
    "background-blend-mode",
    "transform-origin",
    "perspective-origin",
    "object-position",
    "grid-column-start",
    "grid-column-end",
    "grid-row-start",
    "grid-row-end",
    "aspect-ratio",
    "font-weight",
  ]);

const typesByUnitGroup: Record<string, VariableType> = {
  length: "size",
  percentage: "percentage",
  number: "number",
};

const typesOf = (property: CssProperty): ReadonlySet<VariableType> => {
  if (COLOR_PROPERTIES.has(property)) {
    return new Set(["color"]);
  }
  if (property === "font-family") {
    return new Set(["fontFamily"]);
  }
  const data = (
    propertiesData as Record<string, { unitGroups: readonly string[] }>
  )[property];
  return new Set(
    (data?.unitGroups ?? []).flatMap((group) => {
      const type = typesByUnitGroup[group];
      return type === undefined ? [] : [type];
    })
  );
};

/**
 * The types every property of a row takes, in the form's order, or
 * undefined when the row takes none: empty, excluded, unknown, a property
 * with no type, or properties that disagree.
 */
export const getBindableTypes = (
  properties: readonly CssProperty[]
): ReadonlySet<VariableType> | undefined => {
  if (properties.length === 0) {
    return;
  }
  let shared: ReadonlySet<VariableType> | undefined;
  for (const property of properties) {
    if (
      EXCLUDED_PROPERTIES.has(property) ||
      property in propertiesData === false
    ) {
      return;
    }
    const types = typesOf(property);
    if (types.size === 0) {
      return;
    }
    if (shared === undefined) {
      shared = types;
      continue;
    }
    if (
      shared.size !== types.size ||
      [...types].some((type) => shared?.has(type) === false)
    ) {
      return;
    }
  }
  return new Set(variableTypes.filter((type) => shared?.has(type)));
};
