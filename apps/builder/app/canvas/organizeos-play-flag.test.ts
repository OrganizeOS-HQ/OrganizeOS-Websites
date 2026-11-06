import { afterEach, describe, expect, test } from "vitest";
import { createDefaultPages } from "@webstudio-is/project-build";
import {
  getIndexesWithinAncestors,
  type Instance,
  type Instances,
  type WsComponentMeta,
} from "@webstudio-is/sdk";
import { animationCanPlayOnCanvasProperty } from "@webstudio-is/sdk/runtime";
import * as organizeosComponents from "@organizeos/site-components";
import * as organizeosComponentMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import {
  $builderMode,
  $propValuesByInstanceSelectorWithMemoryProps,
  $registeredComponentMetas,
  $registeredComponents,
  $registeredTemplates,
  registerComponentLibrary,
  selectInstance,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { getSelectionOverrides } from "~/shared/nano-states/selection-reveal";
import { $instances, $pages } from "~/shared/sync/data-stores";

// The canvas play flag (spec 4.5, 14.9; field spec 10.4): an Animate Children
// or a Convergence Field plays on the canvas while it, or an instance inside
// it, is selected. 0.309.0 removed component hooks; the flag is a selection
// override from the players' meta (selectionReveal, "fixed" on "self"), which
// upstream's getSelectionOverrides resolves from the selection alone. These
// cases are the old hook's (packages/sdk-components-organizeos hooks.test.ts).

const namespace = "@organizeos/site-components";
const animateChildren = `${namespace}:AnimateChildren`;
const convergenceField = `${namespace}:ConvergenceField`;
const flag = animationCanPlayOnCanvasProperty;

const metas = new Map<string, WsComponentMeta>(
  Object.entries(organizeosComponentMetas).map(([name, meta]) => [
    `${namespace}:${name}`,
    meta,
  ])
);

const instance = (
  id: string,
  component: string,
  ...children: string[]
): Instance => ({
  type: "instance",
  id,
  component,
  children: children.map((value) => ({ type: "id", value })),
});

const key = (...selector: string[]) => JSON.stringify(selector);

/** body > section > card, with other beside section, and the given players. */
const page = (...extra: Array<[string, Instance]>): Instances =>
  new Map([
    ["body", instance("body", "ws:element", "section", "other")],
    ["section", instance("section", "ws:element", "card")],
    ["card", instance("card", "ws:element")],
    ["other", instance("other", "ws:element")],
    ...extra,
  ]);

/** The instance keys flagged when `selected` is selected. */
const flagged = (instances: Instances, selected: string[] | undefined) => {
  const overrides = getSelectionOverrides({
    selectedSelector: selected,
    rootInstanceId: "body",
    instances,
    metas,
    propValues: new Map(),
    indexesWithinAncestors: getIndexesWithinAncestors(metas, instances, [
      "body",
    ]),
  });
  return Array.from(overrides).flatMap(([instanceKey, props]) =>
    props.get(flag) === true ? [instanceKey] : []
  );
};

describe.each([
  ["an Animate Children", animateChildren],
  ["a Convergence Field", convergenceField],
])("the canvas play flag on %s", (_label, player) => {
  // body > wrapper > section > card
  const wrapped = () =>
    page(
      ["body", instance("body", "ws:element", "wrapper", "other")],
      ["wrapper", instance("wrapper", player, "section")]
    );

  test("selecting it flags it", () => {
    expect(flagged(wrapped(), ["wrapper", "body"])).toEqual([
      key("wrapper", "body"),
    ]);
  });

  test("selecting an instance inside it flags it", () => {
    expect(flagged(wrapped(), ["card", "section", "wrapper", "body"])).toEqual([
      key("wrapper", "body"),
    ]);
  });

  test("selecting an instance outside it, or nothing, flags nothing", () => {
    expect(flagged(wrapped(), ["other", "body"])).toEqual([]);
    expect(flagged(wrapped(), ["body"])).toEqual([]);
    expect(flagged(wrapped(), undefined)).toEqual([]);
  });

  test("moving between two flags only the new one", () => {
    const instances = page(
      ["body", instance("body", "ws:element", "a", "b")],
      ["a", instance("a", player)],
      ["b", instance("b", player)]
    );
    expect(flagged(instances, ["a", "body"])).toEqual([key("a", "body")]);
    expect(flagged(instances, ["b", "body"])).toEqual([key("b", "body")]);
  });

  // The old hook cleared the instance it flagged last, so undo and redo never
  // left a player playing. The override holds no state: a selector the
  // instances no longer hold flags nothing.
  test("a stale selection flags nothing: the player deleted, or the child moved out", () => {
    const deleted = wrapped();
    deleted.delete("wrapper");
    deleted.set("body", instance("body", "ws:element", "section", "other"));
    expect(flagged(deleted, ["wrapper", "body"])).toEqual([]);
    expect(flagged(deleted, ["card", "section", "wrapper", "body"])).toEqual(
      []
    );
    const moved = wrapped();
    moved.set("wrapper", instance("wrapper", player));
    moved.set("body", instance("body", "ws:element", "wrapper", "section"));
    expect(flagged(moved, ["card", "section", "wrapper", "body"])).toEqual([]);
    // the control: the same selector flags it while the tree holds it
    expect(flagged(wrapped(), ["card", "section", "wrapper", "body"])).toEqual([
      key("wrapper", "body"),
    ]);
  });
});

// The old hook flagged only the nearest player; the meta's rule flags every
// player on the selected path (the controller's ruling, canvas OQ2: accept).
test("the play flag reveals a nested player", () => {
  const fieldInWrapper = page(
    ["body", instance("body", "ws:element", "wrapper", "other")],
    ["wrapper", instance("wrapper", animateChildren, "field")],
    ["field", instance("field", convergenceField, "section")]
  );
  expect(
    flagged(fieldInWrapper, ["card", "section", "field", "wrapper", "body"])
  ).toEqual([key("field", "wrapper", "body"), key("wrapper", "body")]);
  // selecting the outer player alone flags only it
  expect(flagged(fieldInWrapper, ["wrapper", "body"])).toEqual([
    key("wrapper", "body"),
  ]);

  const wrapperInField = page(
    ["body", instance("body", "ws:element", "field", "other")],
    ["field", instance("field", convergenceField, "wrapper")],
    ["wrapper", instance("wrapper", animateChildren, "section")]
  );
  expect(
    flagged(wrapperInField, ["card", "section", "wrapper", "field", "body"])
  ).toEqual([key("wrapper", "field", "body"), key("field", "body")]);
});

test("the flag is upstream's, the one the Navigator and the players read", () => {
  for (const player of [animateChildren, convergenceField]) {
    expect(metas.get(player)?.selectionReveal).toMatchObject({
      prop: "data-ws-animation-can-play-on-canvas",
    });
  }
});

describe("as the canvas registers the blocks", () => {
  afterEach(() => {
    selectInstance(undefined);
    $selectedPageId.set(undefined);
    $pages.set(undefined);
    $instances.set(new Map());
    $builderMode.set("design");
    $registeredComponents.set(new Map());
    $registeredComponentMetas.set(new Map());
    $registeredTemplates.set(new Map());
  });

  test("a selected player's props hold the flag in design mode, and not in preview", () => {
    registerComponentLibrary({
      namespace,
      components: organizeosComponents,
      metas: organizeosComponentMetas,
      templates: organizeosTemplates,
    });
    $instances.set(
      page(
        ["body", instance("body", "ws:element", "field", "other")],
        ["field", instance("field", convergenceField, "section")]
      )
    );
    const pages = createDefaultPages({
      homePageId: "home",
      rootInstanceId: "body",
    });
    $pages.set(pages);
    $selectedPageId.set(pages.homePageId);
    selectInstance(["card", "section", "field", "body"]);

    const props = () =>
      $propValuesByInstanceSelectorWithMemoryProps
        .get()
        .get(key("field", "body"));
    expect(props()?.get(flag)).toBe(true);
    $builderMode.set("preview");
    expect(props()?.get(flag)).toBeUndefined();
    $builderMode.set("design");
    selectInstance(["other", "body"]);
    expect(props()?.get(flag)).toBeUndefined();
  });
});
