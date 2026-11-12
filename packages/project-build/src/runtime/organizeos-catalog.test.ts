// OrganizeOS fork (docs/ORGANIZEOS-FORK.md section 9, "Catalog Resources
// outlive their bindings"): every runtime path that deletes a binding keeps an
// org catalog Resource, and resources.delete refuses one (owner decision D12).
import { describe, expect, test } from "vitest";
import {
  resource as resourceSchema,
  type DataSource,
  type Instance,
  type Prop,
  type Resource,
  type WebstudioData,
} from "@webstudio-is/sdk";
import { createDefaultPages } from "../shared/pages-utils";
import type { BuilderState } from "../state/builder-state";
import { applyBuilderPatchTransactions } from "../state/patch";
import type { BuilderRuntimeMutation } from "./mutation";
import { executeBuilderRuntimeOperation } from "./registry";
import {
  assertCatalogRootBindingsKept,
  catalogChangeMessage,
  catalogResourceFields,
  isCatalogResourceChange,
  isOrganizeosCatalogResourceId,
  isOrganizeosCatalogRootBinding,
  keepOrganizeosCatalog,
} from "./organizeos-catalog";
import { createResourceFieldsFromFormData, createResourceValue } from "./data";
import { createPageCopyData } from "./page-copy";

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

// OrganizeOS fork (docs/ORGANIZEOS-FORK.md section 9, "Catalog Resources
// outlive their bindings", the data-automatic plan's D8): the catalog is
// locked in the builder. A change guard, not an id guard: an operation is
// refused only when it would change a catalog Resource's fields or a catalog
// `:root` binding, and a pass writes no catalog Resource.

// A v5 id of the catalog `:root` binding family, and one for a binding a
// cross-project paste brought without its Resource.
const rootBindingId = "6f1c2a3b-4d5e-5f60-8a1b-2c3d4e5f6a7b";
const foreignBindingId = "1a2b3c4d-5e6f-5a7b-8c9d-0e1f2a3b4c5d";
const foreignResourceId = "7a2b3c4d-5e6f-5a7b-9c8d-0e1f2a3b4c5d";
// uuidV5("project-1:signup:body"), a v5 id like the signup form's Resource
const signupResourceId = "c1910321-d483-530e-b85a-996b46e672e5";

// provisioning's shape (shared/db/resource-presets.server.ts)
const eventsResource: Resource = {
  id: catalogResourceId,
  name: "Events",
  method: "get",
  url: `"https://app.example.org/api/public/v1/events"`,
  headers: [{ name: "Authorization", value: `"Bearer osk_token"` }],
};
const signupResource: Resource = {
  id: signupResourceId,
  name: "Newsletter signup",
  method: "post",
  url: `"https://app.example.org/api/public/v1/signups"`,
  headers: [{ name: "Authorization", value: `"Bearer osk_token"` }],
  body: "formData",
};
const ownResource = createResource(ownResourceId, "posts");

const rootBinding: DataSource = {
  type: "resource",
  id: rootBindingId,
  scopeInstanceId: ":root",
  name: "Events",
  resourceId: catalogResourceId,
};
const pageBinding: DataSource = {
  type: "resource",
  id: "page-events",
  scopeInstanceId: "body",
  name: "Events on this page",
  resourceId: catalogResourceId,
};
const signupBinding: DataSource = {
  type: "resource",
  id: "signup-binding",
  scopeInstanceId: "form",
  name: "Newsletter signup",
  resourceId: signupResourceId,
};
const ownBinding: DataSource = {
  type: "resource",
  id: "own-binding",
  scopeInstanceId: "body",
  name: "Posts",
  resourceId: ownResourceId,
};

const createLockState = (
  first: "root" | "page" = "root",
  extra: DataSource[] = []
): BuilderState => {
  const state = createState("box");
  const bindings =
    first === "root" ? [rootBinding, pageBinding] : [pageBinding, rootBinding];
  state.instances?.set("form", createInstance("form"));
  state.instances?.get("body")?.children.push({ type: "id", value: "form" });
  return {
    ...state,
    dataSources: new Map(
      [...bindings, signupBinding, ownBinding, ...extra].map((dataSource) => [
        dataSource.id,
        dataSource,
      ])
    ),
    resources: new Map([
      [catalogResourceId, eventsResource],
      [signupResourceId, signupResource],
      [ownResourceId, ownResource],
    ]),
  };
};

const mutate = (state: BuilderState, id: string, input: unknown) => {
  const mutation = executeBuilderRuntimeOperation<BuilderRuntimeMutation>({
    id,
    state,
    input,
    context: { createId: () => "generated-id" },
  });
  if (mutation instanceof Promise) {
    throw Error(`${id} is expected to run synchronously`);
  }
  return mutation;
};

const hasResourcePatch = (mutation: BuilderRuntimeMutation, id?: string) =>
  mutation.payload.some(
    (change) =>
      change.namespace === "resources" &&
      (id === undefined || change.patches.some((patch) => patch.path[0] === id))
  );

const expectRefused = (state: BuilderState, id: string, input: unknown) => {
  const before = structuredClone({
    dataSources: state.dataSources,
    resources: state.resources,
  });
  expect(() => mutate(state, id, input)).toThrow(catalogChangeMessage);
  expect({
    dataSources: state.dataSources,
    resources: state.resources,
  }).toEqual(before);
};

const fieldsOf = (resource: Resource) => ({
  name: resource.name,
  method: resource.method,
  url: resource.url,
  searchParams: resource.searchParams ?? [],
  headers: resource.headers,
  ...(resource.body === undefined ? {} : { body: resource.body }),
  ...(resource.bodyFormat === undefined
    ? {}
    : { bodyFormat: resource.bodyFormat }),
});

describe("the catalog lock: the predicate and the schema", () => {
  test("a catalog :root binding is resource-typed, at :root, with v5 ids", () => {
    expect(isOrganizeosCatalogRootBinding(rootBinding)).toBe(true);
    // the legacy pre-deploy :root Forms binding has the same shape
    expect(
      isOrganizeosCatalogRootBinding({
        type: "resource",
        id: "9b8c7d6e-5f4a-5b3c-8d2e-1f0a9b8c7d6e",
        scopeInstanceId: ":root",
        name: "OrganizeOS Forms",
        resourceId: catalogResourceId,
      })
    ).toBe(true);
  });

  test("not a page-root binding, a block binding, a :root value variable or a :root binding of a nanoid Resource", () => {
    expect(isOrganizeosCatalogRootBinding(pageBinding)).toBe(false);
    expect(
      isOrganizeosCatalogRootBinding({ ...rootBinding, scopeInstanceId: "box" })
    ).toBe(false);
    expect(
      isOrganizeosCatalogRootBinding({
        type: "variable",
        id: rootBindingId,
        scopeInstanceId: ":root",
        name: "Events",
        value: { type: "string", value: "" },
      })
    ).toBe(false);
    expect(
      isOrganizeosCatalogRootBinding({
        ...rootBinding,
        resourceId: ownResourceId,
      })
    ).toBe(false);
  });

  test("the compared fields with id and name are the Resource schema's keys", () => {
    expect(Object.keys(resourceSchema.shape).sort()).toEqual(
      ["id", "name", ...catalogResourceFields].sort()
    );
  });

  test("each compared field is a change, the name is not", () => {
    const changes: Partial<Resource>[] = [
      { method: "post" },
      { url: `"https://example.org"` },
      { searchParams: [{ name: "a", value: `"b"` }] },
      { headers: [] },
      { body: `"x"` },
      { bodyFormat: "json" },
      { control: "graphql" },
      { email: { subject: `"Hi"` } },
    ];
    for (const change of changes) {
      expect(
        isCatalogResourceChange(eventsResource, {
          ...eventsResource,
          ...change,
        }),
        JSON.stringify(change)
      ).toBe(true);
    }
    expect(
      isCatalogResourceChange(eventsResource, {
        ...eventsResource,
        name: "Renamed",
      })
    ).toBe(false);
  });
});

describe("the catalog lock: the editor's real output", () => {
  const formDataOf = (resource: Resource, bodyFormat?: string) => {
    const formData = new FormData();
    formData.set("name", resource.name);
    formData.set("url", resource.url);
    formData.set("method", resource.method);
    for (const header of resource.headers) {
      formData.append("header-name", header.name);
      formData.append("header-value", header.value);
    }
    if (resource.body !== undefined) {
      formData.set("body", resource.body);
    }
    // the hidden body-format input renders for a non-GET method
    if (bodyFormat !== undefined) {
      formData.set("body-format", bodyFormat);
    }
    return formData;
  };

  test("an unchanged Save of provisioning's GET shape is no change", () => {
    const fields = createResourceFieldsFromFormData({
      formData: formDataOf(eventsResource),
    });
    expect(fields.searchParams).toEqual([]);
    const next = createResourceValue({ id: eventsResource.id, ...fields });
    expect(isCatalogResourceChange(eventsResource, next)).toBe(false);
  });

  test("an unchanged Save of the signup Resource's POST shape is no change", () => {
    const fields = createResourceFieldsFromFormData({
      formData: formDataOf(signupResource, "auto"),
    });
    expect(fields.bodyFormat).toBe("auto");
    const next = createResourceValue({ id: signupResource.id, ...fields });
    expect(isCatalogResourceChange(signupResource, next)).toBe(false);
  });
});

describe("the catalog lock: :root bindings", () => {
  test("variables.delete of a catalog :root binding is refused", () => {
    expectRefused(createLockState(), "variables.delete", {
      dataSourceId: rootBindingId,
    });
  });

  test("variables.update renaming, rescoping or retyping it is refused; an identical update passes", () => {
    for (const values of [
      { name: "My events" },
      { scopeInstanceId: "body" },
      { value: { type: "string", value: "Events" } },
    ]) {
      expectRefused(createLockState(), "variables.update", {
        dataSourceId: rootBindingId,
        values,
      });
    }
    const next = mutate(createLockState(), "variables.update", {
      dataSourceId: rootBindingId,
      values: { name: "Events" },
    });
    expect(hasResourcePatch(next)).toBe(false);
  });

  test("resources.upsert onto its id is refused, whatever the resourceId", () => {
    for (const input of [
      // repoints it to a new Resource
      { resourceId: undefined, scopeInstanceId: ":root" },
      // repoints it to a nanoid Resource
      { resourceId: ownResourceId, scopeInstanceId: ":root" },
      // rescopes it
      { resourceId: catalogResourceId, scopeInstanceId: "body" },
      // renames it
      {
        resourceId: catalogResourceId,
        scopeInstanceId: ":root",
        dataSourceName: "My events",
      },
    ]) {
      expectRefused(createLockState(), "resources.upsert", {
        resource: fieldsOf(
          input.resourceId === ownResourceId ? ownResource : eventsResource
        ),
        dataSourceId: rootBindingId,
        dataSourceName: "Events",
        ...input,
      });
    }
  });

  test("resources.update with the :root binding first is refused", () => {
    for (const change of [
      { dataSourceName: "My events" },
      { scopeInstanceId: "body" },
      { exposeAsDataSource: false },
    ]) {
      expectRefused(createLockState("root"), "resources.update", {
        resourceId: catalogResourceId,
        values: {},
        ...change,
      });
    }
  });

  test("resources.update with a page-root binding first acts on that one, as upstream does", () => {
    for (const change of [
      { dataSourceName: "Renamed" },
      { scopeInstanceId: "box" },
      { exposeAsDataSource: false },
    ]) {
      const state = createLockState("page");
      const next = run(state, "resources.update", {
        resourceId: catalogResourceId,
        values: {},
        ...change,
      });
      expect(next.dataSources?.get(rootBindingId)).toEqual(rootBinding);
      expect(next.resources?.get(catalogResourceId)).toBe(eventsResource);
      expect(next.dataSources?.get("page-events")).not.toEqual(pageBinding);
    }
  });

  test("resources.upsertProp with identical fields: refused with the :root binding first; the page-root alias goes otherwise", () => {
    const input = {
      instanceId: "box",
      propName: "action",
      resourceId: catalogResourceId,
      resource: fieldsOf(eventsResource),
    };
    expectRefused(createLockState("root"), "resources.upsertProp", input);
    const next = run(createLockState("page"), "resources.upsertProp", input);
    expect(next.dataSources?.has("page-events")).toBe(false);
    expect(next.dataSources?.get(rootBindingId)).toEqual(rootBinding);
    expect(next.resources?.get(catalogResourceId)).toBe(eventsResource);
  });

  test("a v5 :root binding whose Resource the build lacks can be deleted and renamed", () => {
    const foreign: DataSource = {
      type: "resource",
      id: foreignBindingId,
      scopeInstanceId: ":root",
      name: "Foreign",
      resourceId: foreignResourceId,
    };
    const renamed = run(
      createLockState("root", [foreign]),
      "variables.update",
      {
        dataSourceId: foreignBindingId,
        values: { name: "Theirs" },
      }
    );
    expect(renamed.dataSources?.get(foreignBindingId)?.name).toBe("Theirs");
    const deleted = run(
      createLockState("root", [foreign]),
      "variables.delete",
      {
        dataSourceId: foreignBindingId,
      }
    );
    expect(deleted.dataSources?.has(foreignBindingId)).toBe(false);
  });

  test("assertCatalogRootBindingsKept compares type, scope, name and resourceId", () => {
    const before = new Map([[rootBindingId, rootBinding]]);
    const resources = new Map([[catalogResourceId, eventsResource]]);
    expect(() =>
      assertCatalogRootBindingsKept(
        before,
        new Map([[rootBindingId, { ...rootBinding }]]),
        resources
      )
    ).not.toThrow();
    for (const after of [
      new Map(),
      new Map([[rootBindingId, { ...rootBinding, name: "X" }]]),
      new Map([[rootBindingId, { ...rootBinding, scopeInstanceId: "body" }]]),
      new Map([[rootBindingId, { ...rootBinding, resourceId: ownResourceId }]]),
    ]) {
      expect(() =>
        assertCatalogRootBindingsKept(before, after, resources)
      ).toThrow(catalogChangeMessage);
    }
  });
});

describe("the catalog lock: catalog Resources", () => {
  const upsertEvents = (resource: Partial<Resource>) => ({
    resourceId: catalogResourceId,
    resource: fieldsOf({ ...eventsResource, ...resource }),
    dataSourceId: "page-events",
    scopeInstanceId: "body",
    dataSourceName: "Events on this page",
  });

  test("resources.upsert is refused when a compared field differs", () => {
    for (const change of [
      { method: "post" as const },
      { url: `"https://evil.example.org/events"` },
      { searchParams: [{ name: "limit", value: `"3"` }] },
      { headers: [{ name: "Authorization", value: `"Bearer other"` }] },
      { method: "post" as const, body: `"x"` },
      { method: "post" as const, bodyFormat: "json" as const },
    ]) {
      expectRefused(
        createLockState(),
        "resources.upsert",
        upsertEvents(change)
      );
    }
  });

  test("an identical resources.upsert passes and writes no catalog Resource; a new name is kept on the binding only", () => {
    const identical = mutate(
      createLockState(),
      "resources.upsert",
      upsertEvents({})
    );
    expect(hasResourcePatch(identical)).toBe(false);

    const state = createLockState();
    const renamed = mutate(state, "resources.upsert", {
      ...upsertEvents({ name: "Renamed" }),
      dataSourceName: "Renamed",
    });
    expect(hasResourcePatch(renamed)).toBe(false);
    const next = applyBuilderPatchTransactions(state, [
      { id: "rename", payload: renamed.payload },
    ]).state;
    expect(next.dataSources?.get("page-events")?.name).toBe("Renamed");
    expect(next.resources?.get(catalogResourceId)).toBe(eventsResource);
  });

  test("resources.update that would change it is refused; an identical one writes no catalog Resource", () => {
    expectRefused(createLockState(), "resources.update", {
      resourceId: catalogResourceId,
      values: { url: `"https://evil.example.org/events"` },
    });
    const identical = mutate(createLockState(), "resources.update", {
      resourceId: catalogResourceId,
      values: { url: eventsResource.url },
    });
    expect(hasResourcePatch(identical)).toBe(false);
  });

  test("resources.replaceText skips catalog Resources, for name and url, and counts only what it changes", () => {
    const own: Resource = {
      ...ownResource,
      name: "Events",
      url: `"https://app.example.org/api/public/v1/own"`,
    };
    const state = { ...createLockState(), resources: undefined };
    // the catalog Resource first, then a nanoid one, both matching
    const withOwn: BuilderState = {
      ...state,
      resources: new Map([
        [catalogResourceId, eventsResource],
        [ownResourceId, own],
      ]),
    };
    for (const [fields, find, replace] of [
      [["name"], "Events", "News"],
      [["url"], "app.example.org", "app.example.net"],
    ] as const) {
      const mutation = mutate(withOwn, "resources.replaceText", {
        find,
        replace,
        match: "substring",
        fields,
      });
      expect(mutation.result).toMatchObject({
        changedCount: 1,
        matchingFieldCount: 1,
        truncated: false,
      });
      expect(hasResourcePatch(mutation, catalogResourceId)).toBe(false);
      expect(hasResourcePatch(mutation, ownResourceId)).toBe(true);
    }
    const limited = mutate(withOwn, "resources.replaceText", {
      find: "app.example.org",
      replace: "app.example.net",
      match: "substring",
      fields: ["url"],
      limit: 1,
    });
    expect(limited.result).toMatchObject({ changedCount: 1, truncated: false });
    expect(hasResourcePatch(limited, ownResourceId)).toBe(true);
  });

  test("resources.upsertProp with a catalog resourceId is refused when a field differs", () => {
    expectRefused(createLockState("page"), "resources.upsertProp", {
      instanceId: "box",
      propName: "action",
      resourceId: catalogResourceId,
      resource: fieldsOf({
        ...eventsResource,
        url: `"https://evil.example.org/events"`,
      }),
    });
  });

  test("the signup Resource is locked too; an unchanged Save and a rename of its variable pass", () => {
    const upsertSignup = (resource: Partial<Resource>, name?: string) => ({
      resourceId: signupResourceId,
      resource: fieldsOf({ ...signupResource, ...resource }),
      dataSourceId: "signup-binding",
      scopeInstanceId: "form",
      dataSourceName: name ?? "Newsletter signup",
    });
    for (const change of [
      { url: `"https://evil.example.org/signups"` },
      { body: `"other"` },
      { searchParams: [{ name: "a", value: `"b"` }] },
    ]) {
      expectRefused(
        createLockState(),
        "resources.upsert",
        upsertSignup(change)
      );
    }
    const unchanged = mutate(
      createLockState(),
      "resources.upsert",
      upsertSignup({ bodyFormat: "auto" })
    );
    expect(hasResourcePatch(unchanged)).toBe(false);

    const state = createLockState();
    const renamed = run(
      state,
      "resources.upsert",
      upsertSignup({ name: "My signup", bodyFormat: "auto" }, "My signup")
    );
    expect(renamed.dataSources?.get("signup-binding")?.name).toBe("My signup");
    expect(renamed.resources?.get(signupResourceId)?.name).toBe(
      "Newsletter signup"
    );
  });

  test("a nanoid Resource behaves as upstream under all four", () => {
    const url = `"https://api.example.org/changed"`;
    const upserted = run(createLockState(), "resources.upsert", {
      resourceId: ownResourceId,
      resource: fieldsOf({ ...ownResource, url }),
      dataSourceId: "own-binding",
      scopeInstanceId: "body",
      dataSourceName: "Posts",
    });
    expect(upserted.resources?.get(ownResourceId)?.url).toBe(url);
    const updated = run(createLockState(), "resources.update", {
      resourceId: ownResourceId,
      values: { url },
    });
    expect(updated.resources?.get(ownResourceId)?.url).toBe(url);
    const replaced = run(createLockState(), "resources.replaceText", {
      find: "posts",
      replace: "news",
      match: "substring",
      fields: ["url"],
    });
    expect(replaced.resources?.get(ownResourceId)?.url).toBe(
      `"https://api.example.org/news"`
    );
    const prop = run(createLockState(), "resources.upsertProp", {
      instanceId: "box",
      propName: "source",
      resourceId: ownResourceId,
      resource: fieldsOf({ ...ownResource, url }),
    });
    expect(prop.resources?.get(ownResourceId)?.url).toBe(url);
    expect(prop.dataSources?.has("own-binding")).toBe(false);
  });

  test("creating a missing catalog Resource passes", () => {
    const payload = [
      {
        namespace: "resources" as const,
        patches: [
          {
            op: "add" as const,
            path: [catalogResourceId],
            value: eventsResource,
          },
        ],
      },
    ];
    expect(
      keepOrganizeosCatalog(
        { resources: new Map(), dataSources: new Map() },
        payload
      )
    ).toBe(payload);
  });
});

describe("the catalog lock: page paste", () => {
  test("pasting a page back keeps the stored catalog Resource; a nanoid one is inserted as upstream", () => {
    const pages = createDefaultPages({
      rootInstanceId: "body",
      homePageId: "home",
    });
    const blockPage = {
      id: "post",
      name: "Post",
      path: "/post",
      title: `"Post"`,
      meta: {},
      rootInstanceId: "post-body",
    };
    pages.pages.set("post", blockPage);
    pages.folders.get(pages.rootFolderId)?.children.push("post");
    const slot: Instance = {
      type: "instance",
      id: "slot",
      component: "Slot",
      children: [{ type: "id", value: "slot-content" }],
    };
    const content: Instance = {
      type: "instance",
      id: "slot-content",
      component: "Fragment",
      children: [{ type: "id", value: "block" }],
    };
    const blockBinding: DataSource = {
      type: "resource",
      id: "block-binding",
      scopeInstanceId: "block",
      name: "OrganizeOS Events",
      resourceId: catalogResourceId,
    };
    const blockOwnBinding: DataSource = {
      type: "resource",
      id: "block-own-binding",
      scopeInstanceId: "block",
      name: "Posts",
      resourceId: ownResourceId,
    };
    const state: BuilderState = {
      pages,
      instances: new Map<Instance["id"], Instance>([
        ["body", createInstance("body")],
        ["post-body", createInstance("post-body", ["slot"])],
        ["slot", slot],
        ["slot-content", content],
        ["block", createInstance("block")],
      ]),
      props: new Map(),
      dataSources: new Map([
        [blockBinding.id, blockBinding],
        [blockOwnBinding.id, blockOwnBinding],
      ]),
      resources: new Map([
        [catalogResourceId, eventsResource],
        [ownResourceId, ownResource],
      ]),
      assets: new Map(),
      breakpoints: new Map([["base", { id: "base", label: "" }]]),
      styles: new Map(),
      styleSources: new Map(),
      styleSourceSelections: new Map(),
    };
    const copy = createPageCopyData({
      data: state as unknown as WebstudioData,
      page: blockPage,
    });
    // the clipboard holds an older snapshot of the catalog Resource
    const stale = {
      ...eventsResource,
      url: `"https://old.example.org/events"`,
    };
    const item = {
      type: "page" as const,
      ...copy,
      bodyFragment: {
        ...copy.bodyFragment,
        resources: copy.bodyFragment.resources.map((resource) =>
          resource.id === catalogResourceId ? stale : resource
        ),
      },
    };
    expect(
      item.bodyFragment.resources.map((resource) => resource.id).sort()
    ).toEqual([catalogResourceId, ownResourceId].sort());

    // the Slot's content is deleted, the catalog Resource outlives it
    const emptied = run(state, "instances.delete", {
      instanceIds: ["slot-content"],
    });
    expect(emptied.resources?.get(catalogResourceId)).toBe(eventsResource);
    expect(emptied.resources?.has(ownResourceId)).toBe(false);

    const pasted = run(emptied, "pageTransfer.insert", {
      projectId: "project-1",
      targetFolderId: pages.rootFolderId,
      item,
    });
    expect(pasted.instances?.has("slot-content")).toBe(true);
    expect(pasted.resources?.get(catalogResourceId)).toEqual(eventsResource);
    expect(pasted.resources?.get(ownResourceId)).toEqual(ownResource);
  });
});

describe("the catalog lock: unchanged behaviour", () => {
  test("variables.deleteUnused leaves resource bindings", () => {
    const next = run(createLockState(), "variables.deleteUnused", {});
    expect(next.dataSources?.get(rootBindingId)).toEqual(rootBinding);
    expect(next.dataSources?.get("page-events")).toEqual(pageBinding);
  });

  test("deleting a page, an instance or a page-root catalog binding keeps the Resource and the :root binding", () => {
    const afterBinding = run(createLockState(), "variables.delete", {
      dataSourceId: "page-events",
    });
    const afterInstance = run(createLockState(), "instances.delete", {
      instanceIds: ["box"],
    });
    const pageState = createLockState();
    pageState.dataSources?.set("post-events", {
      ...pageBinding,
      id: "post-events",
      scopeInstanceId: "post-body",
    });
    const afterPage = run(pageState, "pages.delete", { pageId: "post" });
    for (const next of [afterBinding, afterInstance, afterPage]) {
      expect(next.resources?.get(catalogResourceId)).toBe(eventsResource);
      expect(next.dataSources?.get(rootBindingId)).toEqual(rootBinding);
    }
    expect(afterBinding.dataSources?.has("page-events")).toBe(false);
    expect(afterPage.dataSources?.has("post-events")).toBe(false);
  });
});
