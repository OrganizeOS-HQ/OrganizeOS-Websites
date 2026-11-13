import type { HtmlTags } from "@webstudio-is/html-data";
import type { CssProperty, StyleValue } from "@webstudio-is/css-engine";
import {
  getHtmlTagFromInstance,
  ROOT_INSTANCE_ID,
  rootComponent,
  type Instance,
} from "@webstudio-is/sdk";
import { $propsIndex, $registeredComponentMetas } from "~/shared/nano-states";
import {
  $instances,
  $props,
  $styleSourceSelections,
  $styles,
} from "~/shared/sync/data-stores";
import {
  getComputedStyleDecl,
  getPresetStyleDeclKey,
  type StyleObjectModel,
} from "~/shared/style-object-model";
import type { InstanceSelector } from "@webstudio-is/project-build/runtime";
import { $matchingBreakpoints } from "~/builder/features/style-panel/shared/model";
import { toRgba, type Rgba } from "./color";

export type PaletteColor = {
  rgba: Rgba;
  /**
   * The Global Root variable the color came from, without the leading dashes,
   * as Webstudio's VarValue stores it (`{ type: "var", value: "brand" }`
   * renders `var(--brand)`).
   */
  variable?: string;
};

/**
 * A style model for one element's subtree and its ancestors, from the
 * builder's stores.
 *
 * The style panel's `$styleObjectModel` knows tags and components only for
 * the selected instance and its ancestors, and takes the selected element's
 * live states, so it would drop a link's default color inside an element.
 * This model is built from the same stores (`$styles`,
 * `$styleSourceSelections`, `$matchingBreakpoints`, and the components'
 * preset styles, rebuilt from `$registeredComponentMetas` as
 * `style-panel/shared/model.tsx` does, since upstream's `$presetStyles` is
 * module-private), with tags and components for the element's ancestors and
 * its whole subtree, base state only.
 *
 * Values are read only through `getComputedStyleDecl`; nothing here keeps a
 * cascade of its own. No builder code calls it yet: with
 * `listRootColorVariables` it is kept as the reader of the agent's
 * `website_set_colours` (builder variables spec 7.2).
 */
export const buildSectionStyleModel = (
  sectionSelector: InstanceSelector
): StyleObjectModel => {
  const metas = $registeredComponentMetas.get();
  const instances = $instances.get();
  // a component's rendered tag can read a prop (a List's `ordered`)
  const props = $props.get();
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
      props,
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

/**
 * The color variables defined on Global Root itself (builder variables spec
 * 7.2 keeps this meaning for the agent's `website_set_colours`): the `--*`
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
