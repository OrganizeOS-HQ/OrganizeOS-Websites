import { createTemplateComponentFixture } from "@webstudio-is/template";

type Component = ReturnType<typeof createTemplateComponentFixture>;

/**
 * Components for templates by registered name. 0.309.0 removed the template
 * package's createProxy, and its renderer names a component either by the
 * object a template passes (with the registry's `componentIds`) or by
 * upstream's component marker. A marker renders the same with or without
 * `componentIds` (the builder's registry, `site-templates/render.ts`, a
 * collection page's Rich Text and the tests), so the templates keep naming
 * components by id, as they did, and carry no component code.
 * `block-factories.test.tsx` pins the mechanism.
 */
const createProxy = (prefix: string): Record<string, Component> => {
  const markers = new Map<string, Component>();
  return new Proxy({} as Record<string, Component>, {
    get(_target, name) {
      // a symbol (Symbol.toStringTag, an iterator) names no component
      if (typeof name !== "string") {
        return undefined;
      }
      let marker = markers.get(name);
      if (marker === undefined) {
        marker = createTemplateComponentFixture(`${prefix}${name}`);
        markers.set(name, marker);
      }
      return marker;
    },
  });
};

/** Upstream's base components by name, e.g. `<$.Link>`, `<$.Image>`. */
export const $ = createProxy("");

/** Namespaced components for templates, e.g. `<organizeos.SignupForm>`. */
export const organizeos = createProxy("@organizeos/site-components:");

/**
 * Upstream's Radix components by their registered names, for a template that
 * builds on them (as upstream's own templates proxy theirs). Only the names:
 * a template importing this pulls no Radix code into the package.
 */
export const radix = createProxy("@webstudio-is/sdk-components-react-radix:");
