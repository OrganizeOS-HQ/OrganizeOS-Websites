import { expect, test } from "vitest";
import type { Instance, WebstudioFragment } from "@webstudio-is/sdk";
import { renderTemplate } from "@webstudio-is/template";
import * as metas from "../metas";
import { meta } from "./donation-form.template";

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

const tokensOf = (instance: Instance) => {
  const selected =
    fragment.styleSourceSelections.find(
      (selection) => selection.instanceId === instance.id
    )?.values ?? [];
  return selected.flatMap((id) => {
    const source = fragment.styleSources.find((item) => item.id === id);
    return source?.type === "token" ? [source.name] : [];
  });
};

const propOf = (instance: Instance, name: string) =>
  fragment.props.find(
    (prop) => prop.instanceId === instance.id && prop.name === name
  )?.value;

const textOf = (instance: Instance) =>
  instance.children.flatMap((child) =>
    child.type === "text" ? [child.value] : []
  );

const root = getInstance(
  fragment.children.find((child) => child.type === "id")!.value
);

test("the root is a card with the block's settings", () => {
  expect(root.component).toBe(`${namespace}:DonationForm`);
  expect(root.label).toBe("Donation Form");
  expect(tokensOf(root)).toEqual(["OS Form Card"]);
  expect(propOf(root, "target")).toBe("general");
  expect(propOf(root, "afterGift")).toBe("message");
  expect(propOf(root, "state")).toBe("ready");
  // written at insert from the builder's site record, never by the template
  expect(propOf(root, "organizationId")).toBeUndefined();
  expect(propOf(root, "platformOrigin")).toBeUndefined();
});

test("a heading, an intro and the frame, in that order", () => {
  const [heading, intro, frame, ...rest] = childInstances(root);
  expect(rest).toEqual([]);
  expect(heading.tag).toBe("h2");
  expect(tokensOf(heading)).toEqual(["OS Form Heading"]);
  expect(textOf(heading)).toEqual(["Support our work"]);
  expect(intro.tag).toBe("p");
  expect(intro.label).toBe("Intro");
  expect(tokensOf(intro)).toEqual(["OS Form Intro"]);
  expect(textOf(intro)).toEqual(["Every gift powers our work."]);
  expect(frame.component).toBe(`${namespace}:DonationFrame`);
  expect(frame.label).toBe("Frame");
});

test("the root and its frame are registered", () => {
  expect(metas.DonationForm.label).toBe("Donation Form");
  expect(metas.DonationFrame.label).toBe("Donation Frame");
  expect(metas.DonationForm.contentModel).toMatchObject({
    descendants: [`${namespace}:DonationFrame`],
  });
});
