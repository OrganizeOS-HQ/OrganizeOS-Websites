import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  Hook,
  HookContext,
  InstanceData,
} from "@webstudio-is/react-sdk/runtime";
import { animationCanPlayOnCanvasProperty } from "@webstudio-is/sdk/runtime";

const animateChildren = "@organizeos/site-components:AnimateChildren";
const convergenceField = "@organizeos/site-components:ConvergenceField";

type Instance = { id: string; component: string };

/**
 * The builder's side of the hooks, as `subscribeComponentHooks`
 * (apps/builder/app/shared/nano-states/components.ts) drives them: memory
 * props keyed by instance key, and on each selection change an unselect
 * with the previous path built from the current instances (an instance
 * that no longer exists is left out), then a select with the new one.
 */
const createBuilder = (hooks: Hook[]) => {
  const instances = new Map<string, Instance>();
  const memoryProps = new Map<string, Map<string, unknown>>();
  let lastSelector: string[] | undefined;

  const context: HookContext = {
    indexesWithinAncestors: new Map(),
    getPropValue: () => undefined,
    setMemoryProp: ({ instanceKey }, name, value) => {
      const props = new Map(memoryProps.get(instanceKey));
      if (value === undefined) {
        props.delete(name);
      } else {
        props.set(name, value);
      }
      memoryProps.set(instanceKey, props);
    },
  };

  const toPath = (selector: string[]): InstanceData[] =>
    selector.flatMap((id, index, array) => {
      const instance = instances.get(id);
      if (instance === undefined) {
        return [];
      }
      return {
        id,
        instanceKey: JSON.stringify(array.slice(index)),
        component: instance.component,
      };
    });

  const select = (selector: string[] | undefined) => {
    if (lastSelector !== undefined) {
      for (const hook of hooks) {
        hook.onNavigatorUnselect?.(context, {
          instancePath: toPath(lastSelector),
        });
      }
    }
    if (selector !== undefined) {
      for (const hook of hooks) {
        hook.onNavigatorSelect?.(context, { instancePath: toPath(selector) });
      }
    }
    lastSelector = selector;
  };

  const add = (id: string, component = "ws:element") =>
    instances.set(id, { id, component });

  const flag = (selector: string[]) =>
    memoryProps
      .get(JSON.stringify(selector))
      ?.get(animationCanPlayOnCanvasProperty);

  const flagged = () =>
    Array.from(memoryProps)
      .filter(([, props]) => props.has(animationCanPlayOnCanvasProperty))
      .map(([key]) => key);

  return { instances, add, select, flag, flagged, context };
};

let hooks: Hook[];

beforeEach(async () => {
  // the hook keeps the instance it flagged last at module level
  vi.resetModules();
  ({ hooks } = await import("./hooks"));
});

const setup = () => {
  const builder = createBuilder(hooks);
  builder.add("body", "ws:element");
  builder.add("section");
  builder.add("card");
  builder.add("other");
  return builder;
};

describe("the canvas play hook", () => {
  test("selecting an Animate Children sets the flag on it", () => {
    const builder = setup();
    builder.add("wrapper", animateChildren);
    builder.select(["wrapper", "body"]);
    expect(builder.flag(["wrapper", "body"])).toBe(true);
    expect(builder.flagged()).toEqual([JSON.stringify(["wrapper", "body"])]);
  });

  test("selecting an instance inside one sets the flag on the closest", () => {
    const builder = setup();
    builder.add("outer", animateChildren);
    builder.add("inner", animateChildren);
    builder.select(["card", "inner", "section", "outer", "body"]);
    expect(builder.flag(["inner", "section", "outer", "body"])).toBe(true);
    expect(builder.flagged()).toHaveLength(1);
  });

  test("selecting an instance outside one sets nothing", () => {
    const builder = setup();
    builder.select(["section", "body"]);
    expect(builder.flagged()).toEqual([]);
  });

  test("unselecting clears the flag", () => {
    const builder = setup();
    builder.add("wrapper", animateChildren);
    builder.select(["card", "wrapper", "body"]);
    builder.select(undefined);
    expect(builder.flagged()).toEqual([]);
    builder.select(["wrapper", "body"]);
    builder.select(["other", "body"]);
    expect(builder.flagged()).toEqual([]);
  });

  test("moving between two wrappers leaves only the new one flagged", () => {
    const builder = setup();
    builder.add("a", animateChildren);
    builder.add("b", animateChildren);
    builder.select(["a", "body"]);
    builder.select(["b", "body"]);
    expect(builder.flagged()).toEqual([JSON.stringify(["b", "body"])]);
  });

  test("an empty path sets nothing and does not throw", () => {
    const builder = setup();
    builder.add("wrapper", animateChildren);
    builder.select(["wrapper", "body"]);
    for (const hook of hooks) {
      hook.onNavigatorSelect?.(builder.context, { instancePath: [] });
    }
    expect(builder.flagged()).toEqual([]);
  });

  test("wrap, select, undo, click elsewhere, redo: the wrapper holds no flag", () => {
    const builder = setup();
    // wrap the section: the wrapper is selected
    builder.add("wrapper", animateChildren);
    builder.select(["wrapper", "body"]);
    expect(builder.flag(["wrapper", "body"])).toBe(true);
    // undo removes the wrapper; the unselect path no longer holds it
    builder.instances.delete("wrapper");
    builder.select(["section", "body"]);
    builder.select(["other", "body"]);
    // redo brings it back under the same key
    builder.add("wrapper", animateChildren);
    expect(builder.flag(["wrapper", "body"])).toBeUndefined();
    expect(builder.flagged()).toEqual([]);
  });

  test("select, delete, undo: the wrapper holds no flag", () => {
    const builder = setup();
    builder.add("wrapper", animateChildren);
    builder.select(["card", "wrapper", "body"]);
    // delete the wrapper: the selection moves to its parent
    builder.instances.delete("wrapper");
    builder.select(["body"]);
    // undo restores it, unselected
    builder.add("wrapper", animateChildren);
    expect(builder.flag(["wrapper", "body"])).toBeUndefined();
    expect(builder.flagged()).toEqual([]);
  });

  test("sets upstream's flag, the one the component reads", async () => {
    const { canPlayOnCanvasProperty } = await import("./animate/flag");
    expect(canPlayOnCanvasProperty).toBe(animationCanPlayOnCanvasProperty);
    const builder = setup();
    builder.add("wrapper", animateChildren);
    builder.select(["wrapper", "body"]);
    expect(builder.flag(["wrapper", "body"])).toBe(true);
  });
});

describe("the canvas play hook and the Convergence Field", () => {
  test("selecting a Convergence Field sets the flag on it", () => {
    const builder = setup();
    builder.add("field", convergenceField);
    builder.select(["field", "body"]);
    expect(builder.flag(["field", "body"])).toBe(true);
    expect(builder.flagged()).toEqual([JSON.stringify(["field", "body"])]);
  });

  test("selecting its content flags the field", () => {
    const builder = setup();
    builder.add("field", convergenceField);
    builder.select(["card", "field", "body"]);
    expect(builder.flagged()).toEqual([JSON.stringify(["field", "body"])]);
  });

  test("a field inside an Animate Children: the field, the nearest, wins", () => {
    const builder = setup();
    builder.add("wrapper", animateChildren);
    builder.add("field", convergenceField);
    builder.select(["card", "field", "section", "wrapper", "body"]);
    expect(builder.flagged()).toEqual([
      JSON.stringify(["field", "section", "wrapper", "body"]),
    ]);
  });

  test("an Animate Children inside a field: the Animate Children, the nearest, wins", () => {
    const builder = setup();
    builder.add("field", convergenceField);
    builder.add("wrapper", animateChildren);
    builder.select(["card", "wrapper", "field", "body"]);
    expect(builder.flagged()).toEqual([
      JSON.stringify(["wrapper", "field", "body"]),
    ]);
    // selecting the field itself moves the flag to it
    builder.select(["field", "body"]);
    expect(builder.flagged()).toEqual([JSON.stringify(["field", "body"])]);
  });

  test("unselecting clears the field's flag", () => {
    const builder = setup();
    builder.add("field", convergenceField);
    builder.select(["card", "field", "body"]);
    builder.select(undefined);
    expect(builder.flagged()).toEqual([]);
    builder.select(["field", "body"]);
    builder.select(["other", "body"]);
    expect(builder.flagged()).toEqual([]);
  });

  test("insert, select, undo, click elsewhere, redo: the field holds no flag", () => {
    const builder = setup();
    builder.add("field", convergenceField);
    builder.select(["field", "body"]);
    expect(builder.flag(["field", "body"])).toBe(true);
    // undo removes the field; the unselect path no longer holds it
    builder.instances.delete("field");
    builder.select(["section", "body"]);
    builder.select(["other", "body"]);
    // redo brings it back under the same key
    builder.add("field", convergenceField);
    expect(builder.flag(["field", "body"])).toBeUndefined();
    expect(builder.flagged()).toEqual([]);
  });
});
