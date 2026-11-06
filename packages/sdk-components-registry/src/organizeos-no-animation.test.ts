/**
 * OrganizeOS fork: the registry offers nothing from upstream's animation
 * package, which is EULA-proprietary and removed from the fork
 * (docs/ORGANIZEOS-FORK.md section 2). The builder's metas, the canvas and the
 * CLI's generated imports all come from here.
 */
import { expect, test } from "vitest";
import { canvasComponentLibraries } from "./canvas";
import { componentsById } from "./components";
import { createFrameworkComponentRegistry } from "./framework";
import { componentMetas } from "./metas";
import { componentMetaLibraries } from "./shared";

// Component ids and generated import entries are "<package>:<export>".
const isAnimation = (value: string) =>
  value.startsWith("@webstudio-is/sdk-components-animation:");

test("registers no animation component, meta or template", () => {
  expect([...componentsById.keys()].filter(isAnimation)).toEqual([]);
  expect([...componentMetas.keys()].filter(isAnimation)).toEqual([]);
  for (const library of canvasComponentLibraries) {
    const namespace = "namespace" in library ? library.namespace : "";
    expect(isAnimation(`${namespace}:`)).toBe(false);
  }
  for (const library of componentMetaLibraries) {
    expect(isAnimation(`${library.importSource}:`)).toBe(false);
  }
});

test("generates no animation import for a published site", () => {
  const registry = createFrameworkComponentRegistry();
  expect(Object.keys(registry.components).filter(isAnimation)).toEqual([]);
  expect(Object.values(registry.components).filter(isAnimation)).toEqual([]);
  expect(Object.keys(registry.metas).filter(isAnimation)).toEqual([]);
});
