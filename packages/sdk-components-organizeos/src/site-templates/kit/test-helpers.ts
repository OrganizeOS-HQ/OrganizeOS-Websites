import { hyphenateProperty, toValue } from "@webstudio-is/css-engine";
import type { Instance, WebstudioFragment } from "@webstudio-is/sdk";

// What the kit's tests read a rendered fragment with. Not exported from the
// kit, and imported only by its tests.

export const byLabel = (fragment: WebstudioFragment, label: string) => {
  const instance = fragment.instances.find((item) => item.label === label);
  if (instance === undefined) {
    throw new Error(`No instance is labelled "${label}"`);
  }
  return instance;
};

export const childInstances = (fragment: WebstudioFragment, parent: Instance) =>
  parent.children.flatMap((child) => {
    if (child.type !== "id") {
      return [];
    }
    const instance = fragment.instances.find((item) => item.id === child.value);
    return instance ? [instance] : [];
  });

/** An instance's own text children. */
export const textOf = (instance: Instance) =>
  instance.children.flatMap((child) =>
    child.type === "text" ? [child.value] : []
  );

export const propOf = (
  fragment: WebstudioFragment,
  instance: Instance,
  name: string
) =>
  fragment.props.find(
    (prop) => prop.instanceId === instance.id && prop.name === name
  );

/**
 * An instance's styles, without states, as a window of the given width
 * applies them: the base breakpoint, then each max-width one the width is
 * within, widest first. Property names hyphenated, values as CSS text.
 */
export const stylesAt = (
  fragment: WebstudioFragment,
  instance: Instance,
  viewportWidth: number
): Record<string, string> => {
  const breakpoints = fragment.breakpoints
    .filter(
      (breakpoint) =>
        breakpoint.minWidth === undefined &&
        (breakpoint.maxWidth === undefined ||
          viewportWidth <= breakpoint.maxWidth)
    )
    .sort((a, b) => (b.maxWidth ?? Infinity) - (a.maxWidth ?? Infinity));
  const sources =
    fragment.styleSourceSelections.find(
      (selection) => selection.instanceId === instance.id
    )?.values ?? [];
  const styles: Record<string, string> = {};
  for (const breakpoint of breakpoints) {
    for (const decl of fragment.styles) {
      if (
        decl.breakpointId === breakpoint.id &&
        decl.state === undefined &&
        sources.includes(decl.styleSourceId)
      ) {
        styles[hyphenateProperty(decl.property)] = toValue(decl.value);
      }
    }
  }
  return styles;
};

/** An instance's declarations under a state (`:focus-visible`), any width. */
export const stateStyles = (
  fragment: WebstudioFragment,
  instance: Instance,
  state: string
): Record<string, string> => {
  const sources =
    fragment.styleSourceSelections.find(
      (selection) => selection.instanceId === instance.id
    )?.values ?? [];
  return Object.fromEntries(
    fragment.styles
      .filter(
        (decl) => decl.state === state && sources.includes(decl.styleSourceId)
      )
      .map((decl) => [hyphenateProperty(decl.property), toValue(decl.value)])
  );
};
