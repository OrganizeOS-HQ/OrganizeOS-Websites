import { expect, test } from "vitest";
import type { Instance, WebstudioFragment } from "@webstudio-is/sdk";
import { renderTemplate } from "@webstudio-is/template";
import { toValue } from "@webstudio-is/css-engine";
import * as metas from "../metas";
import { meta } from "./goal-progress.template";

const namespace = "@organizeos/site-components";

const fragment: WebstudioFragment = renderTemplate(meta.template);

const getInstance = (id: string) => {
  const instance = fragment.instances.find((item) => item.id === id);
  if (instance === undefined) {
    throw new Error(`no instance ${id}`);
  }
  return instance;
};

const childInstances = (instance: Instance) =>
  instance.children.flatMap((child) =>
    child.type === "id" ? [getInstance(child.value)] : []
  );

const tokenSources = (instance: Instance) => {
  const selected =
    fragment.styleSourceSelections.find(
      (selection) => selection.instanceId === instance.id
    )?.values ?? [];
  return selected.flatMap((id) => {
    const source = fragment.styleSources.find((item) => item.id === id);
    return source?.type === "token" ? [source] : [];
  });
};

const tokensOf = (instance: Instance) =>
  tokenSources(instance).map((source) => (source as { name: string }).name);

const propOf = (instance: Instance, name: string) =>
  fragment.props.find(
    (prop) => prop.instanceId === instance.id && prop.name === name
  )?.value;

const root = getInstance(
  fragment.children.find((child) => child.type === "id")!.value
);

test("the root holds the block's settings", () => {
  expect(root.component).toBe(`${namespace}:GoalProgress`);
  expect(root.label).toBe("Goal Progress");
  expect(propOf(root, "record")).toBe("");
  expect(propOf(root, "showDonors")).toBe(false);
});

test("a hidden track and its fill, then the raised, goal and donors figures", () => {
  const [track, raised, goal, donors, ...rest] = childInstances(root);
  expect(rest).toEqual([]);
  expect(track.label).toBe("Track");
  expect(propOf(track, "aria-hidden")).toBe("true");
  expect(tokensOf(track)).toEqual(["OS Progress Track"]);
  const [fill] = childInstances(track);
  expect(fill.label).toBe("Fill");
  expect(tokensOf(fill)).toEqual(["OS Progress Fill"]);
  const [fillToken] = tokenSources(fill);
  const width = fragment.styles.find(
    (style) =>
      style.styleSourceId === fillToken.id && style.property === "width"
  );
  expect(width && toValue(width.value)).toBe("var(--os-progress, 0%)");
  for (const [figure, label, part] of [
    ["raised", "Raised", raised],
    ["goal", "Goal", goal],
    ["donors", "Donors", donors],
  ] as const) {
    expect(part.component).toBe(`${namespace}:GoalProgressFigure`);
    expect(part.label).toBe(label);
    expect(propOf(part, "figure")).toBe(figure);
    expect(tokensOf(part)).toEqual(["OS Progress Label"]);
  }
});

test("the root and its figure are registered", () => {
  expect(metas.GoalProgress.label).toBe("Goal Progress");
  expect(metas.GoalProgressFigure.label).toBe("Goal Progress Figure");
});
