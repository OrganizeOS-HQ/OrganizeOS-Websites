import { beforeEach, describe, expect, test } from "vitest";
import { createDefaultPages } from "@webstudio-is/project-build";
import type { Instance, Prop } from "@webstudio-is/sdk";
import {
  $dataSources,
  $instances,
  $pages,
  $props,
  $resources,
} from "~/shared/sync/data-stores";
import { findPublishBlocker } from "./organizeos-publish-code-check";

// The dialog's own cases (it does not dispatch, and names the place) are in
// organizeos-publish.test.tsx, beside the dialog's other tests, which mock its
// fetch: two files mocking one module in parallel browser sessions break
// each other.

const box: Instance = {
  type: "instance",
  id: "box",
  component: "Box",
  label: "Hero",
  children: [],
};

const expressionProp = (value: string): Prop => ({
  id: "p",
  instanceId: "box",
  name: "title",
  type: "expression",
  value,
});

const stores = () => ({
  pages: $pages.get(),
  instances: $instances.get(),
  props: $props.get(),
  resources: $resources.get(),
  dataSources: $dataSources.get(),
});

beforeEach(() => {
  $pages.set(createDefaultPages({ rootInstanceId: "body" }));
  $instances.set(new Map([["box", box]]));
  $props.set(new Map());
  $resources.set(new Map());
  $dataSources.set(new Map());
});

describe("findPublishBlocker", () => {
  test("names the element and the field in one line", () => {
    $props.set(new Map([["p", expressionProp("a()")]]));
    expect(findPublishBlocker(stores())).toBe(
      `Can't publish: the property "title" of "Hero". This function is not allowed.`
    );
  });

  test("names a page by its name", () => {
    const pages = createDefaultPages({ rootInstanceId: "body" });
    const home = pages.pages.get(pages.homePageId);
    if (home === undefined) {
      throw new Error("no home page");
    }
    home.meta.description = "a()";
    $pages.set(pages);
    expect(findPublishBlocker(stores())).toBe(
      `Can't publish: the description of page "${home.name}". This function is not allowed.`
    );
  });

  test("an element with no label is named by its component", () => {
    $instances.set(new Map([["box", { ...box, label: undefined }]]));
    $props.set(new Map([["p", expressionProp("a()")]]));
    expect(findPublishBlocker(stores())).toContain(`of "Box"`);
  });

  test("a clean build has none", () => {
    $props.set(new Map([["p", expressionProp(`"a"`)]]));
    expect(findPublishBlocker(stores())).toBeUndefined();
  });
});
