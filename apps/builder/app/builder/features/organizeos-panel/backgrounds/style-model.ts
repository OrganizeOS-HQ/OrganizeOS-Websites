import type { HtmlTags } from "html-tags";
import type { CssProperty, StyleValue } from "@webstudio-is/css-engine";
import { camelCaseProperty, html } from "@webstudio-is/css-data";
import {
  getHtmlTagFromInstance,
  getStyleDeclKey,
  ROOT_INSTANCE_ID,
  rootComponent,
  type Instance,
} from "@webstudio-is/sdk";
import { $propsIndex, $registeredComponentMetas } from "~/shared/nano-states";
import {
  $instances,
  $styleSourceSelections,
  $styles,
} from "~/shared/sync/data-stores";
import {
  getComputedStyleDecl,
  getPresetStyleDeclKey,
  type StyleObjectModel,
} from "~/shared/style-object-model";
import type { InstanceSelector } from "~/shared/instance-utils/tree";
import { $matchingBreakpoints } from "~/builder/features/style-panel/shared/model";
import { toRgba } from "./color";
import type { PaletteColor } from "./presets";

/**
 * The contrast check's own style model (spec 4.2).
 *
 * The style panel's `$styleObjectModel` knows tags and components only for
 * the selected instance and its ancestors, and takes the selected element's
 * live states, so it would drop an `h1`'s default size and weight and a
 * link's default color for the text inside a section. This model is built
 * from the same stores (`$styles`, `$styleSourceSelections`,
 * `$matchingBreakpoints`, and the components' preset styles, rebuilt from
 * `$registeredComponentMetas` as `style-panel/shared/model.tsx` does, since
 * upstream's `$presetStyles` is module-private), with tags and components for
 * the section's ancestors and its whole subtree, base state only.
 *
 * Values are read only through `getComputedStyleDecl`; nothing here keeps a
 * cascade of its own.
 */
export const buildSectionStyleModel = (
  sectionSelector: InstanceSelector
): StyleObjectModel => {
  const metas = $registeredComponentMetas.get();
  const instances = $instances.get();
  const { htmlTagsByInstanceId } = $propsIndex.get();

  const presetStyles = new Map<string, StyleValue>();
  for (const [component, meta] of metas) {
    for (const [tag, styles] of Object.entries(meta.presetStyle ?? {})) {
      for (const styleDecl of styles) {
        const key = getPresetStyleDeclKey({
          component,
          tag,
          state: styleDecl.state,
          property: styleDecl.property,
        });
        presetStyles.set(key, styleDecl.value);
      }
    }
  }

  const instanceTags = new Map<Instance["id"], HtmlTags>();
  // seeded as upstream's model is
  const instanceComponents = new Map<Instance["id"], Instance["component"]>([
    [ROOT_INSTANCE_ID, rootComponent],
  ]);
  const add = (instance: Instance) => {
    instanceComponents.set(instance.id, instance.component);
    const tag = getHtmlTagFromInstance({
      instance,
      metas,
      htmlTagsByInstanceId,
    });
    if (tag !== undefined) {
      instanceTags.set(instance.id, tag as HtmlTags);
    }
  };

  // the section and its ancestors
  for (const instanceId of sectionSelector) {
    const instance = instances.get(instanceId);
    if (instance !== undefined) {
      add(instance);
    }
  }
  // the section's whole subtree
  const [sectionId] = sectionSelector;
  const visited = new Set<Instance["id"]>();
  const stack = sectionId === undefined ? [] : [sectionId];
  while (stack.length > 0) {
    const instanceId = stack.pop()!;
    if (visited.has(instanceId)) {
      continue;
    }
    visited.add(instanceId);
    const instance = instances.get(instanceId);
    if (instance === undefined) {
      continue;
    }
    add(instance);
    for (const child of instance.children) {
      if (child.type === "id") {
        stack.push(child.value);
      }
    }
  }

  return {
    styles: $styles.get(),
    styleSourceSelections: $styleSourceSelections.get(),
    presetStyles,
    instanceTags,
    instanceComponents,
    matchingBreakpoints: $matchingBreakpoints.get(),
    matchingStates: new Set(),
  };
};

/** The selector with the Global Root appended, as style lookups need it. */
export const withRoot = (selector: InstanceSelector): InstanceSelector =>
  selector.at(-1) === ROOT_INSTANCE_ID
    ? selector
    : [...selector, ROOT_INSTANCE_ID];

/**
 * The full selector of `instanceId`, a descendant of the section (or the
 * section itself), up to `ROOT_INSTANCE_ID`, so Global Root variables
 * resolve for it. Undefined when the instance is not in the section's
 * subtree. Drop the trailing `ROOT_INSTANCE_ID` before `selectInstance`.
 */
export const selectorOf = (
  instanceId: Instance["id"],
  sectionSelector: InstanceSelector
): InstanceSelector | undefined => {
  const instances = $instances.get();
  const sectionPath = withRoot(sectionSelector);
  const find = (
    currentId: Instance["id"],
    path: InstanceSelector,
    visited: Set<Instance["id"]>
  ): InstanceSelector | undefined => {
    if (currentId === instanceId) {
      return path;
    }
    if (visited.has(currentId)) {
      return;
    }
    visited.add(currentId);
    for (const child of instances.get(currentId)?.children ?? []) {
      if (child.type === "id") {
        const found = find(child.value, [child.value, ...path], visited);
        if (found !== undefined) {
          return found;
        }
      }
    }
  };
  const [sectionId] = sectionPath;
  return find(sectionId, sectionPath, new Set());
};

/**
 * The color variables defined on Global Root itself (spec 3.3): the `--*`
 * decls of the root's own style sources at a matching breakpoint, base state,
 * each resolved through `getComputedStyleDecl` on `[ROOT_INSTANCE_ID]` so
 * variable-to-variable chains resolve. Kept when the resolved value reads as
 * a color, including an `unparsed` named color (a named color typed into a
 * custom property is stored unparsed). In the order the decls are stored.
 */
export const listRootColorVariables = (
  model: StyleObjectModel
): PaletteColor[] => {
  const styleSourceIds = new Set(
    model.styleSourceSelections.get(ROOT_INSTANCE_ID)?.values ?? []
  );
  const matchingBreakpoints = new Set(model.matchingBreakpoints);
  const names = new Set<string>();
  for (const styleDecl of model.styles.values()) {
    if (
      styleDecl.property.startsWith("--") &&
      styleDecl.state === undefined &&
      styleSourceIds.has(styleDecl.styleSourceId) &&
      matchingBreakpoints.has(styleDecl.breakpointId)
    ) {
      names.add(styleDecl.property);
    }
  }
  const colors: PaletteColor[] = [];
  for (const name of names) {
    const { usedValue } = getComputedStyleDecl({
      model,
      instanceSelector: [ROOT_INSTANCE_ID],
      property: name as CssProperty,
    });
    const rgba = toRgba(usedValue);
    if (rgba !== undefined) {
      colors.push({ rgba, variable: name.slice(2) });
    }
  }
  return colors;
};

/**
 * Whether the instance declares the property itself, base state: a browser
 * default for its tag, its component's preset for that tag, or a decl in its
 * own style sources at a matching breakpoint.
 */
const declaresOwn = (
  model: StyleObjectModel,
  instanceId: Instance["id"],
  property: CssProperty
) => {
  const tag = model.instanceTags.get(instanceId);
  const component = model.instanceComponents.get(instanceId);
  if (tag !== undefined && html.has(`${tag}:${property}`)) {
    return true;
  }
  if (
    tag !== undefined &&
    component !== undefined &&
    model.presetStyles.has(getPresetStyleDeclKey({ component, tag, property }))
  ) {
    return true;
  }
  const styleSourceIds =
    model.styleSourceSelections.get(instanceId)?.values ?? [];
  for (const styleSourceId of styleSourceIds) {
    for (const breakpointId of model.matchingBreakpoints) {
      const key = getStyleDeclKey({
        styleSourceId,
        breakpointId,
        property: camelCaseProperty(property),
      });
      if (model.styles.has(key)) {
        return true;
      }
    }
  }
  return false;
};

const defaultFontSize = 16;

// CSS absolute-size keywords, medium being 16px
const absoluteSizes: Record<string, number> = {
  "xx-small": 9,
  "x-small": 10,
  small: 13,
  medium: 16,
  large: 18,
  "x-large": 24,
  "xx-large": 32,
  "xxx-large": 48,
};

const isDefaultingKeyword = (value: StyleValue) =>
  value.type === "keyword" &&
  ["inherit", "unset", "revert", "revert-layer"].includes(
    value.value.toLowerCase()
  );

const toPx = (
  value: StyleValue,
  parentPx: number | undefined,
  rootPx: number
): number | undefined => {
  if (value.type === "keyword") {
    return absoluteSizes[value.value.toLowerCase()];
  }
  if (value.type !== "unit") {
    // calc(), clamp(), variables left unresolved and the like
    return;
  }
  switch (value.unit) {
    case "px":
      return value.value;
    case "rem":
      return value.value * rootPx;
    case "em":
      return parentPx === undefined ? undefined : value.value * parentPx;
    case "%":
      return parentPx === undefined
        ? undefined
        : (value.value / 100) * parentPx;
    case "number":
      // a unitless 0 is a length
      return value.value === 0 ? 0 : undefined;
    default:
      // viewport units, pt and others: not resolved, so not large
      return;
  }
};

/**
 * The resolved font size in px of the instance at `selector` (spec 4.2),
 * computed top-down from the root. `getComputedStyleDecl` hands an inherited
 * `2em` down unchanged, so an instance scales only when it declares a size
 * itself (see `declaresOwn`); otherwise it carries its parent's px forward,
 * which keeps a Bold inside an `h1` at 32px, not 64px. `px` as is, `rem`
 * against the root's resolved size (16px unless Global Root sets one), `em`
 * and `%` against the parent, absolute keywords per CSS. Anything else is
 * undefined, which the check holds to 4.5:1.
 */
export const resolveFontSize = (
  model: StyleObjectModel,
  selector: InstanceSelector
): number | undefined => {
  const path = withRoot(selector);
  let px: number | undefined = defaultFontSize;
  let rootPx = defaultFontSize;
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const instanceId = path[index];
    if (declaresOwn(model, instanceId, "font-size") === false) {
      continue;
    }
    const decl = getComputedStyleDecl({
      model,
      instanceSelector: path.slice(index),
      property: "font-size",
    });
    if (isDefaultingKeyword(decl.cascadedValue)) {
      continue;
    }
    px = toPx(decl.computedValue, px, rootPx);
    if (instanceId === ROOT_INSTANCE_ID && px !== undefined) {
      rootPx = px;
    }
  }
  return px;
};

/**
 * The resolved font weight of the instance at `selector`: numbers as is,
 * `normal` 400, `bold` 700; anything else (`bolder`, `lighter`, an
 * unresolved variable) is undefined and counts as not bold.
 */
export const resolveFontWeight = (
  model: StyleObjectModel,
  selector: InstanceSelector
): number | undefined => {
  const { computedValue } = getComputedStyleDecl({
    model,
    instanceSelector: withRoot(selector),
    property: "font-weight",
  });
  if (computedValue.type === "unit" && computedValue.unit === "number") {
    return computedValue.value;
  }
  if (computedValue.type === "keyword") {
    const keyword = computedValue.value.toLowerCase();
    if (keyword === "normal") {
      return 400;
    }
    if (keyword === "bold") {
      return 700;
    }
  }
};
