// OrganizeOS fork (docs/ORGANIZEOS-FORK.md section 9, "Catalog Resources
// outlive their bindings"): every runtime path that deletes a binding keeps an
// org catalog Resource, and resources.delete refuses one (owner decision D12).
import { describe, expect, test } from "vitest";
import type { DataSource, Instance, Prop, Resource } from "@webstudio-is/sdk";
import { createDefaultPages } from "../shared/pages-utils";
import type { BuilderState } from "../state/builder-state";
import { applyBuilderPatchTransactions } from "../state/patch";
import type { BuilderRuntimeMutation } from "./mutation";
import { executeBuilderRuntimeOperation } from "./registry";
import { isOrganizeosCatalogResourceId } from "./organizeos-catalog";

// uuidV5("project-1:v1:events:resource"): the id provisioning writes for the
// Events catalog Resource of the provisioning tests' project
// (apps/builder/app/shared/organizeos-preset-ids.node.test.ts pins it).
const catalogResourceId = "385fcd4c-92f8-5d7c-abfe-cb941b8f2449";
// A nanoid: a Resource Webstudio creates for one binding and deletes with it.
const ownResourceId = "V1StGXR8_Z5jdHi6B-myT";

const createInstance = (
  id: Instance["id"],
  children: Instance["id"][] = []
): Instance => ({
  type: "instance",
  id,
  component: "Box",
  children: children.map((value) => ({ type: "id", value })),
});

const createResource = (id: Resource["id"], name: string): Resource => ({
  id,
  name,
  method: "get",
  url: `"https://api.example.org/${name}"`,
  headers: [],
});

/**
 * Body > Box on the home page, a Post page, and a page template. The
 * instance `scopeInstanceId` binds the catalog Resource and a Resource of its
 * own (nanoid): the second is the control, deleted with its binding as
 * upstream intends.
 */
const createState = (scopeInstanceId: Instance["id"]): BuilderState => {
  const pages = createDefaultPages({
    rootInstanceId: "body",
    homePageId: "home",
  });
  pages.pages.set("post", {
    id: "post",
    name: "Post",
    path: "/post",
    title: `"Post"`,
    meta: {},
    rootInstanceId: "post-body",
  });
  pages.folders.get(pages.rootFolderId)?.children.push("post");
  pages.pageTemplates = new Map([
    [
      "template",
      {
        id: "template",
        name: "Template",
        title: `"Template"`,
        meta: {},
        rootInstanceId: "template-body",
      },
    ],
  ]);
  const instances = new Map<Instance["id"], Instance>([
    ["body", createInstance("body", ["box"])],
    ["box", createInstance("box")],
    ["post-body", createInstance("post-body")],
    ["template-body", createInstance("template-body")],
  ]);
  const dataSources = new Map<DataSource["id"], DataSource>([
    [
      "catalog-binding",
      {
        type: "resource",
        id: "catalog-binding",
        scopeInstanceId,
        name: "OrganizeOS Events",
        resourceId: catalogResourceId,
      },
    ],
    [
      "own-binding",
      {
        type: "resource",
        id: "own-binding",
        scopeInstanceId,
        name: "Posts",
        resourceId: ownResourceId,
      },
    ],
  ]);
  return {
    pages,
    instances,
    props: new Map(),
    dataSources,
    resources: new Map([
      [catalogResourceId, createResource(catalogResourceId, "events")],
      [ownResourceId, createResource(ownResourceId, "posts")],
    ]),
    assets: new Map(),
    breakpoints: new Map([["base", { id: "base", label: "" }]]),
    styles: new Map(),
    styleSources: new Map(),
    styleSourceSelections: new Map(),
  };
};

const run = (state: BuilderState, id: string, input: unknown) => {
  const mutation = executeBuilderRuntimeOperation<BuilderRuntimeMutation>({
    id,
    state,
    input,
    context: { createId: () => "generated-id" },
  });
  if (mutation instanceof Promise) {
    throw Error(`${id} is expected to run synchronously`);
  }
  return applyBuilderPatchTransactions(state, [
    { id, payload: mutation.payload },
  ]).state;
};

const expectCatalogKeptOwnDeleted = (state: BuilderState) => {
  expect(state.resources?.has(catalogResourceId)).toBe(true);
  expect(state.resources?.has(ownResourceId)).toBe(false);
};

describe("isOrganizeosCatalogResourceId", () => {
  test("tells the derived v5 ids from Webstudio's nanoids", () => {
    expect(isOrganizeosCatalogResourceId(catalogResourceId)).toBe(true);
    expect(isOrganizeosCatalogResourceId(ownResourceId)).toBe(false);
    // a v4 UUID is not one of ours
    expect(
      isOrganizeosCatalogResourceId("f0e1d2c3-b4a5-4697-8877-665544332211")
    ).toBe(false);
    expect(isOrganizeosCatalogResourceId("")).toBe(false);
  });
});

describe("catalog Resources outlive their bindings", () => {
  test("a catalog Resource survives deleting the instance that binds it", () => {
    const state = createState("box");
    // a resource prop is a binding too
    const props = new Map<Prop["id"], Prop>([
      [
        "catalog-prop",
        {
          id: "catalog-prop",
          instanceId: "box",
          name: "action",
          type: "resource",
          value: catalogResourceId,
        },
      ],
    ]);
    const next = run({ ...state, props }, "instances.delete", {
      instanceIds: ["box"],
    });
    expect(next.instances?.has("box")).toBe(false);
    expect(next.props?.has("catalog-prop")).toBe(false);
    expect(next.dataSources?.has("catalog-binding")).toBe(false);
    expect(next.dataSources?.has("own-binding")).toBe(false);
    expectCatalogKeptOwnDeleted(next);
  });

  test("a catalog Resource survives deleting the page that holds it", () => {
    const next = run(createState("post-body"), "pages.delete", {
      pageId: "post",
    });
    expect(next.pages?.pages.has("post")).toBe(false);
    expect(next.dataSources?.has("catalog-binding")).toBe(false);
    expectCatalogKeptOwnDeleted(next);
  });

  test("a catalog Resource survives a page-copy cleanup", () => {
    const next = run(createState("template-body"), "pageTemplates.delete", {
      templateId: "template",
    });
    expect(next.pages?.pageTemplates?.has("template")).toBe(false);
    expect(next.dataSources?.has("catalog-binding")).toBe(false);
    expectCatalogKeptOwnDeleted(next);
  });

  test("a catalog Resource survives deleting its variable", () => {
    let next = run(createState("box"), "variables.delete", {
      dataSourceId: "catalog-binding",
    });
    next = run(next, "variables.delete", { dataSourceId: "own-binding" });
    expect(next.dataSources?.size).toBe(0);
    expectCatalogKeptOwnDeleted(next);
  });

  test("a catalog Resource survives turning it into a value variable", () => {
    let next = run(createState("box"), "variables.update", {
      dataSourceId: "catalog-binding",
      values: { value: { type: "string", value: "Events" } },
    });
    next = run(next, "variables.update", {
      dataSourceId: "own-binding",
      values: { value: { type: "string", value: "Posts" } },
    });
    expect(next.dataSources?.get("catalog-binding")).toMatchObject({
      type: "variable",
      value: { type: "string", value: "Events" },
    });
    expectCatalogKeptOwnDeleted(next);
  });

  test("a catalog Resource survives deleting the prop that references it", () => {
    const state = createState("box");
    const props = new Map<Prop["id"], Prop>([
      [
        "catalog-prop",
        {
          id: "catalog-prop",
          instanceId: "box",
          name: "action",
          type: "resource",
          value: catalogResourceId,
        },
      ],
      [
        "own-prop",
        {
          id: "own-prop",
          instanceId: "box",
          name: "source",
          type: "resource",
          value: ownResourceId,
        },
      ],
    ]);
    const next = run({ ...state, props }, "instances.deleteProps", {
      deletions: [
        { instanceId: "box", name: "action" },
        { instanceId: "box", name: "source" },
      ],
    });
    expect(next.props?.size).toBe(0);
    expectCatalogKeptOwnDeleted(next);
  });

  test("resources.delete refuses a catalog id", () => {
    const state = createState("box");
    // unbound, as the catalog sits until a block or a page uses it
    const unbound = { ...state, dataSources: new Map() };
    for (const input of [
      { resourceId: catalogResourceId },
      { resourceId: catalogResourceId, force: true },
    ]) {
      expect(() => run(unbound, "resources.delete", input)).toThrow(
        expect.objectContaining({
          name: "BuilderRuntimeError",
          code: "BAD_REQUEST",
        })
      );
    }
    const next = run(unbound, "resources.delete", {
      resourceId: ownResourceId,
    });
    expectCatalogKeptOwnDeleted(next);
  });
});
