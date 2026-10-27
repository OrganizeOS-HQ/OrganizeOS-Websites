import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { enableMapSet } from "immer";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import {
  $,
  Parameter,
  expression,
  renderData,
  ws,
} from "@webstudio-is/template";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import * as radixMetas from "@webstudio-is/sdk-components-react-radix/metas";
import {
  ROOT_INSTANCE_ID,
  coreMetas,
  encodeDataSourceVariable,
  lintExpression,
  type DataSource,
  type Instance,
  type Resource,
  type ResourceRequest,
} from "@webstudio-is/sdk";
import * as organizeosMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import {
  $organizeosSite,
  $propValuesByInstanceSelector,
  $registeredComponentMetas,
  $variableValuesByInstanceSelector,
  getInstanceKey,
  getInstancePath,
  registerComponentLibrary,
  selectInstance,
  subscribeResources,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { registerContainers } from "~/shared/sync/sync-stores";
import {
  $assets,
  $breakpoints,
  $dataSources,
  $instances,
  $pages,
  $project,
  $props,
  $resources,
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import {
  $resourcesCache,
  computeResourceRequest,
  getResourceKey,
} from "~/shared/resources";
import { getComponentTemplateData } from "~/shared/instance-utils/insert";
import { isTreeSatisfyingContentModel } from "~/shared/content-model";
import { updateWebstudioData } from "~/shared/instance-utils/data";
import { deleteInstanceMutable } from "~/shared/instance-utils/mutation";
import { deleteVariableMutable } from "~/shared/data-variables";
import { instanceText } from "~/shared/copy-paste/plugin-instance";
import { emitCommand } from "~/builder/shared/commands";
import { buildOrgResourcePresets } from "~/shared/db/resource-presets.server";
import eventsBody from "../../../../../../packages/sdk-components-organizeos/src/__fixtures__/events.json";
import {
  UPCOMING_EVENTS_BINDING_NAME,
  EVENTS_BINDING_NAME,
} from "~/shared/organizeos-preset-ids";
import {
  type BlockData,
  completeOrganizeosFragment,
  getOrganizeosPresetIds,
  insertOrganizeosBlock,
  organizeosBlockData,
} from "./insert-organizeos-block";

const { toastError, loaderFetch, beforeNextTransaction } = vi.hoisted(() => ({
  toastError: vi.fn(),
  // the builder's resources loader posts to /rest/resources-loader with this
  loaderFetch: vi.fn(),
  // runs once, just before the next transaction opens
  beforeNextTransaction: { run: undefined as undefined | (() => void) },
}));
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: toastError } },
}));
vi.mock("~/shared/fetch.client", () => ({ fetch: loaderFetch }));
// An edit can land between the insert's completion, which reads the stores,
// and the transaction that writes the preset; this opens that gap.
vi.mock("~/shared/instance-utils/data", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/shared/instance-utils/data")>();
  return {
    ...actual,
    updateWebstudioData: (
      ...args: Parameters<typeof actual.updateWebstudioData>
    ) => {
      const { run } = beforeNextTransaction;
      beforeNextTransaction.run = undefined;
      run?.();
      return actual.updateWebstudioData(...args);
    },
  };
});

enableMapSet();
registerContainers();

$registeredComponentMetas.set(
  new Map(Object.entries({ ...defaultMetas, ...coreMetas }))
);
// Upstream's Radix metas, as the builder registers them: Rotating Tabs is
// built on upstream's Tabs.
registerComponentLibrary({
  namespace: "@webstudio-is/sdk-components-react-radix",
  components: {},
  metas: radixMetas,
  templates: {},
});
registerComponentLibrary({
  namespace: "@organizeos/site-components",
  components: {},
  metas: organizeosMetas,
  templates: organizeosTemplates,
});

// Test-only blocks under the namespace, to exercise the completion table
// without the real templates: a `ws:element` root (not a component of the
// namespace, like an Event List's) holding a collection and a box, each with a
// prop of its own that a bind replaces.
const eventItem = new Parameter("item");
registerComponentLibrary({
  namespace: "@organizeos/site-components",
  components: {},
  metas: {},
  templates: {
    TestEventBlock: {
      category: "hidden",
      label: "Test Event Block",
      template: (
        <ws.element ws:tag="div" ws:label="Test Event Block">
          <ws.collection
            ws:id="events"
            ws:label="Events"
            data={[{ title: "made by the template" }]}
            item={eventItem}
          >
            <ws.element ws:tag="p" ws:label="Item">
              {expression`${eventItem}.title`}
            </ws.element>
          </ws.collection>
          <ws.element
            ws:tag="p"
            ws:id="empty"
            ws:label="Empty"
            ws:show={false}
          />
        </ws.element>
      ),
    },
    TestPlainBlock: {
      category: "hidden",
      label: "Test Plain Block",
      template: <ws.element ws:tag="section" ws:label="Test Plain Block" />,
    },
  },
});

const signupForm = "@organizeos/site-components:SignupForm";
const testBlock = "@organizeos/site-components:TestEventBlock";
const plainBlock = "@organizeos/site-components:TestPlainBlock";
const projectId = "project-1";
const refusal =
  "Cannot add Signup Form: this site's link to your organization's data was removed or changed. Contact OrganizeOS support to restore it.";
const notOnAllowlist =
  "Cannot add Signup Form: OrganizeOS blocks are not available for this site yet.";

// The catalog provisioning builds for this project, Forms included, so the
// panel's view of a project is the real one.
const provisioned = await buildOrgResourcePresets({
  projectId,
  apiBaseUrl: "https://staging.example.org/api/public/v1",
  readToken: "osk_eventstoken",
});
const { events, forms, upcomingEvents } =
  await getOrganizeosPresetIds(projectId);
const formsResource = provisioned.resources.find(
  (resource) => resource.id === forms.resourceId
) as Resource;
const upcomingResource = provisioned.resources.find(
  (resource) => resource.id === upcomingEvents.resourceId
) as Resource;
const eventsResource = provisioned.resources.find(
  (resource) => resource.id === events.resourceId
) as Resource;

// The Forms catalog Resource as both writers write it.
const expectedFormsResource: Resource = {
  id: forms.resourceId,
  name: "OrganizeOS Forms",
  method: "get",
  url: `"https://staging.example.org/api/public/v1/forms"`,
  headers: [{ name: "Authorization", value: `"Bearer osk_eventstoken"` }],
};

// The Upcoming Events catalog Resource as both writers write it.
const expectedUpcomingResource: Resource = {
  id: upcomingEvents.resourceId,
  name: "Upcoming Events",
  method: "get",
  url: `"https://staging.example.org/api/public/v1/events?upcoming=true"`,
  headers: [{ name: "Authorization", value: `"Bearer osk_eventstoken"` }],
};

// An admin's own variables named "Forms", global and on the page.
const globalForms: DataSource = {
  type: "variable",
  id: "user-forms-global",
  scopeInstanceId: ROOT_INSTANCE_ID,
  name: "Forms",
  value: { type: "json", value: { data: [] } },
};
const pageForms: DataSource = {
  type: "variable",
  id: "user-forms-body",
  scopeInstanceId: "bodyId",
  name: "Forms",
  value: { type: "json", value: { data: [] } },
};

// A project as provisioning seeds it: the first Signup Form adds Forms.
const withoutForms = {
  resources: provisioned.resources.filter(
    (resource) => resource.id !== forms.resourceId
  ),
  dataSources: [] as DataSource[],
};
const withForms = { resources: provisioned.resources, dataSources: [] };
const withoutUpcoming = {
  resources: provisioned.resources.filter(
    (resource) => resource.id !== upcomingEvents.resourceId
  ),
  dataSources: [] as DataSource[],
};

const setProject = (
  {
    resources,
    dataSources,
  }: {
    resources: Resource[];
    dataSources: DataSource[];
  },
  { blocksEnabled = true }: { blocksEnabled?: boolean } = {}
) => {
  const data = renderData(<$.Body ws:id="bodyId"></$.Body>);
  $instances.set(data.instances);
  $props.set(data.props);
  $breakpoints.set(new Map());
  $styles.set(new Map());
  $styleSources.set(new Map());
  $styleSourceSelections.set(new Map());
  $assets.set(new Map());
  $resources.set(new Map(resources.map((resource) => [resource.id, resource])));
  $dataSources.set(
    new Map(dataSources.map((dataSource) => [dataSource.id, dataSource]))
  );
  const pages = createDefaultPages({ rootInstanceId: "bodyId" });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
  selectInstance(["bodyId"]);
  $project.set({ id: projectId } as Project);
  $organizeosSite.set({
    organizationId: "org-1",
    manageUrl: "https://app.example.org/dashboard",
    platformUrl: "https://app.example.org",
    blocksEnabled,
  });
};

const getBlockRoots = () =>
  [...$instances.get().values()].filter(
    (instance) => instance.component === signupForm
  );

const getBlockDataProps = () =>
  getBlockRoots().map((root) =>
    [...$props.get().values()].find(
      (prop) => prop.instanceId === root.id && prop.name === "data"
    )
  );

// The resource bindings scoped to each block's root.
const getBlockBindings = () =>
  getBlockRoots().map((root) =>
    [...$dataSources.get().values()].filter(
      (dataSource) =>
        dataSource.type === "resource" && dataSource.scopeInstanceId === root.id
    )
  );

// Each block's `data` bound, by id, to the `.data` of the one binding its root
// brings, which references the Forms catalog Resource (or, for a copy, the copy
// of it Webstudio made).
const expectBoundToOwnBinding = ({ copies = 0 } = {}) => {
  const roots = getBlockRoots();
  const bindings = getBlockBindings();
  const props = getBlockDataProps();
  roots.forEach((root, index) => {
    expect(bindings[index]).toEqual([
      {
        type: "resource",
        id: expect.any(String),
        scopeInstanceId: root.id,
        name: "OrganizeOS Forms",
        resourceId: expect.any(String),
      },
    ]);
    const [binding] = bindings[index] as [
      Extract<DataSource, { type: "resource" }>,
    ];
    expect(props[index]).toEqual({
      id: expect.any(String),
      instanceId: root.id,
      name: "data",
      type: "expression",
      value: `${encodeDataSourceVariable(binding.id)}.data`,
    });
  });
  const resourceIds = bindings.map(
    ([binding]) => (binding as { resourceId: string }).resourceId
  );
  expect(
    resourceIds.filter((resourceId) => resourceId === forms.resourceId)
  ).toHaveLength(roots.length - copies);
  for (const resourceId of resourceIds) {
    expect($resources.get().get(resourceId)).toEqual({
      ...expectedFormsResource,
      id: resourceId,
    });
  }
  // never page-wide
  expect(
    [...$dataSources.get().values()].filter(
      (dataSource) =>
        dataSource.type === "resource" &&
        (dataSource.scopeInstanceId === ROOT_INSTANCE_ID ||
          dataSource.scopeInstanceId === "bodyId" ||
          dataSource.scopeInstanceId === undefined)
    )
  ).toEqual([]);
};

// Each block's `data` as the canvas renders it.
const getBlockDataValues = () => {
  const propValues = $propValuesByInstanceSelector.get();
  return getBlockRoots().map((root) =>
    propValues.get(getInstanceKey([root.id, "bodyId"]))?.get("data")
  );
};

// The value of each block's binding in its root's variable scope, which the
// Settings panel's expression editor and Variables section read.
const getBlockScopeFormsValues = () => {
  const variableValues = $variableValuesByInstanceSelector.get();
  const bindings = getBlockBindings();
  return getBlockRoots().map((root, index) =>
    variableValues
      .get(getInstanceKey([root.id, "bodyId", ROOT_INSTANCE_ID]))
      ?.get(bindings[index]?.[0]?.id ?? "")
  );
};

// GET /v1/forms's body, and the loader's result for it.
const formsBody = {
  data: [
    {
      id: "form-1",
      kind: "contact-signup",
      name: "Newsletter",
      fields: [
        {
          name: "email",
          label: "Email",
          type: "email",
          required: true,
          options: null,
        },
      ],
      opt_in: "single",
    },
  ],
};
const formsResult = { ok: true, status: 200, statusText: "", data: formsBody };

const cacheFormsResult = () => {
  const request = computeResourceRequest(expectedFormsResource, new Map());
  $resourcesCache.set(new Map([[getResourceKey(request), formsResult]]));
};

const getStores = () => ({
  instances: $instances.get(),
  props: $props.get(),
  dataSources: $dataSources.get(),
  resources: $resources.get(),
  styles: $styles.get(),
  styleSources: $styleSources.get(),
  styleSourceSelections: $styleSourceSelections.get(),
  breakpoints: $breakpoints.get(),
});

const expectNothingWritten = (before: ReturnType<typeof getStores>) => {
  const after = getStores();
  for (const [name, store] of Object.entries(before)) {
    expect(after[name as keyof typeof after], name).toBe(store);
  }
};

// The completion table entry of the test block: what an Event List's will be,
// with the collection and the empty box named by the ids the template gives.
const upcomingBlockData: BlockData = {
  catalog: "upcoming-events",
  bindingName: UPCOMING_EVENTS_BINDING_NAME,
  binds: [
    {
      instance: "events",
      prop: "data",
      value: (variable) =>
        `(${variable}.ok === true ? ${variable}.data.data : [])`,
    },
    {
      instance: "empty",
      prop: "data-ws-show",
      value: (variable) =>
        `${variable}.ok === true && ${variable}.data.data.length === 0`,
    },
  ],
};

beforeEach(() => {
  organizeosBlockData.set(testBlock, upcomingBlockData);
  organizeosBlockData.delete(plainBlock);
  toastError.mockClear();
  loaderFetch.mockReset();
  beforeNextTransaction.run = undefined;
  $resourcesCache.set(new Map());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("insertOrganizeosBlock", () => {
  test("gives the block its own binding, scoped to its root, of the existing Forms Resource", async () => {
    setProject(withForms);

    expect(await insertOrganizeosBlock(signupForm)).toBe(true);

    expectBoundToOwnBinding();
    const [root] = getBlockRoots();
    expect($instances.get().get("bodyId")?.children).toEqual([
      { type: "id", value: root.id },
    ]);
    // the Resource is used as it is, never rewritten or copied
    expect($resources.get()).toEqual(
      new Map(provisioned.resources.map((resource) => [resource.id, resource]))
    );
    expect(toastError).not.toHaveBeenCalled();
  });

  test("creates a missing Forms Resource with the deterministic id and the Events header, and never a second", async () => {
    setProject(withoutForms);

    expect(await insertOrganizeosBlock(signupForm)).toBe(true);

    // from the Events base with /forms and the Events Authorization header:
    // exactly what provisioning writes for this project
    expect($resources.get().get(forms.resourceId)).toEqual(
      expectedFormsResource
    );
    expect(expectedFormsResource.headers).toEqual(eventsResource.headers);
    expect(formsResource).toEqual(expectedFormsResource);
    expectBoundToOwnBinding();

    expect(await insertOrganizeosBlock(signupForm)).toBe(true);

    expect(getBlockRoots()).toHaveLength(2);
    expectBoundToOwnBinding();
    expect($resources.get().size).toBe(provisioned.resources.length);
  });

  test("adds the block, its binding and the Forms Resource in one undoable step", async () => {
    setProject(withoutForms);
    const before = getStores();

    expect(await insertOrganizeosBlock(signupForm)).toBe(true);
    emitCommand("undo");

    expect(getStores()).toEqual(before);
  });

  test("keeps a Forms Resource that appeared while the ids were derived", async () => {
    setProject(withoutForms);
    const inserting = insertOrganizeosBlock(signupForm);
    // e.g. a second click, or a re-provision synced in meanwhile
    const edited = { ...formsResource, name: "Forms (edited)" };
    $resources.set(new Map($resources.get()).set(edited.id, edited));

    expect(await inserting).toBe(true);
    expect($resources.get().get(forms.resourceId)).toBe(edited);
  });

  test("keeps a Forms Resource that appeared between the completion and the transaction", async () => {
    setProject(withoutForms);
    const edited = { ...formsResource, name: "Forms (edited)" };
    beforeNextTransaction.run = () => {
      $resources.set(new Map($resources.get()).set(edited.id, edited));
    };

    expect(await insertOrganizeosBlock(signupForm)).toBe(true);

    expect(beforeNextTransaction.run).toBeUndefined();
    expect($resources.get().get(forms.resourceId)).toBe(edited);
    expect(getBlockBindings()[0]).toEqual([
      expect.objectContaining({ resourceId: forms.resourceId }),
    ]);
  });

  test("leaves a Forms binding an older builder scoped at :root alone, and binds the block to its own", async () => {
    const rootBinding: DataSource = {
      type: "resource",
      id: forms.bindingId,
      scopeInstanceId: ROOT_INSTANCE_ID,
      name: "OrganizeOS Forms",
      resourceId: forms.resourceId,
    };
    setProject({ ...withForms, dataSources: [rootBinding] });

    expect(await insertOrganizeosBlock(signupForm)).toBe(true);

    expect($dataSources.get().get(forms.bindingId)).toBe(rootBinding);
    const [[binding]] = getBlockBindings();
    expect(binding.id).not.toBe(forms.bindingId);
    expect(getBlockDataProps()[0]?.value).toBe(
      `${encodeDataSourceVariable(binding.id)}.data`
    );
  });

  test("inserts at the drop target it is given", async () => {
    setProject(withForms);
    const data = renderData(
      <$.Body ws:id="bodyId">
        <$.Box ws:id="boxId"></$.Box>
      </$.Body>
    );
    $instances.set(data.instances);

    expect(
      await insertOrganizeosBlock(signupForm, {
        parentSelector: ["bodyId"],
        position: 0,
      })
    ).toBe(true);

    expectBoundToOwnBinding();
    const [root] = getBlockRoots();
    expect($instances.get().get("bodyId")?.children).toEqual([
      { type: "id", value: root.id },
      { type: "id", value: "boxId" },
    ]);
  });

  describe("refuses, writing nothing", () => {
    const withEvents = (headers: Resource["headers"], url?: string) => ({
      ...withoutForms,
      resources: withoutForms.resources.map((resource) =>
        resource.id === events.resourceId
          ? { ...resource, headers, url: url ?? resource.url }
          : resource
      ),
    });

    test.each([
      [
        "the Events Resource is missing",
        {
          ...withoutForms,
          resources: withoutForms.resources.filter(
            (resource) => resource.id !== events.resourceId
          ),
        },
      ],
      [
        "the Events Resource is missing but Forms is there",
        {
          ...withForms,
          resources: withForms.resources.filter(
            (resource) => resource.id !== events.resourceId
          ),
        },
      ],
      ["the Events Resource has no headers", withEvents([])],
      [
        "the Events Resource has a blank Authorization header",
        withEvents([{ name: "Authorization", value: `""` }]),
      ],
      [
        "the Events Resource has another header only",
        withEvents([{ name: "Cache-Control", value: `"max-age=60"` }]),
      ],
      [
        "Forms must be created and the Events URL is not the provisioned one",
        withEvents(eventsResource.headers, `"https://example.org/" + path`),
      ],
    ])("when %s", async (_case, project) => {
      setProject(project);
      const before = getStores();

      expect(await insertOrganizeosBlock(signupForm)).toBe(false);

      expectNothingWritten(before);
      expect(toastError).toHaveBeenCalledTimes(1);
      expect(toastError).toHaveBeenCalledWith(refusal);
    });

    test("when there is no project", async () => {
      setProject(withForms);
      $project.set(undefined);
      const before = getStores();

      expect(await insertOrganizeosBlock(signupForm)).toBe(false);

      expectNothingWritten(before);
    });

    test.each([
      ["clicked", undefined],
      ["dropped", { parentSelector: ["bodyId"], position: 0 }],
    ] as const)(
      "when the org is denied the blocks, %s",
      async (_case, insertable) => {
        setProject(withForms, { blocksEnabled: false });
        const before = getStores();

        expect(
          await insertOrganizeosBlock(
            signupForm,
            insertable === undefined
              ? undefined
              : {
                  ...insertable,
                  parentSelector: [...insertable.parentSelector],
                }
          )
        ).toBe(false);

        expectNothingWritten(before);
        expect(toastError).toHaveBeenCalledWith(notOnAllowlist);
      }
    );

    test("when the project is not an org's", async () => {
      setProject(withForms);
      $organizeosSite.set(undefined);
      const before = getStores();

      expect(await insertOrganizeosBlock(signupForm)).toBe(false);

      expectNothingWritten(before);
      expect(toastError).toHaveBeenCalledWith(notOnAllowlist);
    });
  });

  test.each([
    ["exists", withForms],
    ["is created", withoutForms],
  ])(
    "binds the block's own binding, not a user variable named Forms, when the Forms Resource %s",
    async (_case, project) => {
      setProject({
        resources: project.resources,
        dataSources: [globalForms, pageForms],
      });

      expect(await insertOrganizeosBlock(signupForm)).toBe(true);

      expectBoundToOwnBinding();
      expect($dataSources.get().get(globalForms.id)).toBe(globalForms);
      expect($dataSources.get().get(pageForms.id)).toBe(pageForms);
    }
  );
});

describe("the inserted block's data", () => {
  test("the builder's loader requests Forms for the page with the block, and the block renders its body", async () => {
    setProject(withoutForms);
    expect(await insertOrganizeosBlock(signupForm)).toBe(true);
    loaderFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const requests = JSON.parse(String(init.body)) as ResourceRequest[];
      return {
        ok: true,
        json: async () =>
          requests.map((request) => [getResourceKey(request), formsResult]),
      };
    });

    vi.useFakeTimers();
    const unsubscribe = subscribeResources();
    await vi.advanceTimersByTimeAsync(1000);
    unsubscribe();

    // Forms alone: nothing else in the catalog is used on the page
    expect(loaderFetch).toHaveBeenCalledTimes(1);
    const [url, init] = loaderFetch.mock.calls[0];
    expect(url).toBe("/rest/resources-loader");
    expect(JSON.parse(init.body)).toEqual([
      {
        name: "OrganizeOS Forms",
        method: "get",
        url: "https://staging.example.org/api/public/v1/forms",
        searchParams: [],
        headers: [{ name: "Authorization", value: "Bearer osk_eventstoken" }],
      },
    ]);
    expect(getBlockDataValues()).toEqual([formsBody]);
    expect(getBlockScopeFormsValues()).toEqual([formsResult]);
  });

  test("the builder loads nothing on a page without a block", async () => {
    setProject(withoutForms);
    expect(await insertOrganizeosBlock(signupForm)).toBe(true);
    const pages = $pages.get()!;
    const other = {
      ...pages.pages.get(pages.homePageId)!,
      id: "other",
      path: "/other",
      rootInstanceId: "otherBody",
    };
    $instances.set(
      new Map($instances.get()).set("otherBody", {
        type: "instance",
        id: "otherBody",
        component: "Body",
        children: [],
      })
    );
    $pages.set({ ...pages, pages: new Map(pages.pages).set("other", other) });
    $selectedPageId.set("other");

    vi.useFakeTimers();
    const unsubscribe = subscribeResources();
    await vi.advanceTimersByTimeAsync(1000);
    unsubscribe();

    expect(loaderFetch).not.toHaveBeenCalled();
  });

  test("keeps the binding's value with a :root variable named Forms listed after it", async () => {
    setProject(withoutForms);
    expect(await insertOrganizeosBlock(signupForm)).toBe(true);
    $dataSources.set(
      new Map($dataSources.get()).set(globalForms.id, globalForms)
    );
    expect([...$dataSources.get().keys()].slice(-1)).toEqual([globalForms.id]);
    cacheFormsResult();

    expect(getBlockDataValues()).toEqual([formsBody]);
    expect(getBlockScopeFormsValues()).toEqual([formsResult]);
  });
});

describe("a copy of an inserted block, with a page variable named Forms", () => {
  const insertNextToPageForms = async () => {
    setProject({ ...withForms, dataSources: [pageForms] });
    expect(await insertOrganizeosBlock(signupForm)).toBe(true);
    cacheFormsResult();
  };

  test("keeps its own binding when it is duplicated, and reads the same forms", async () => {
    await insertNextToPageForms();

    emitCommand("duplicateInstance");

    // Webstudio copies the binding with the block, and gives the copy its
    // own copy of the Resource
    expect(getBlockRoots()).toHaveLength(2);
    expectBoundToOwnBinding({ copies: 1 });
    expect(getBlockDataValues()).toEqual([formsBody, formsBody]);
  });

  test("keeps its own binding when it is copied and pasted", async () => {
    await insertNextToPageForms();

    const clipboardData = instanceText.onCopy?.() ?? "";
    expect(await instanceText.onPaste?.(clipboardData)).toBe(true);

    expect(getBlockRoots()).toHaveLength(2);
    expectBoundToOwnBinding({ copies: 1 });
    expect(getBlockDataValues()).toEqual([formsBody, formsBody]);
  });
});

describe("deleting what uses the catalog", () => {
  test("a deleted block takes its binding, and leaves the Forms Resource", async () => {
    setProject(withoutForms);
    expect(await insertOrganizeosBlock(signupForm)).toBe(true);
    expect(await insertOrganizeosBlock(signupForm)).toBe(true);
    const [first, second] = getBlockRoots();
    const [[firstBinding]] = getBlockBindings();

    updateWebstudioData((data) => {
      deleteInstanceMutable(
        data,
        getInstancePath([first.id, "bodyId"], data.instances)
      );
    });

    expect($dataSources.get().has(firstBinding.id)).toBe(false);
    expect($resources.get().get(forms.resourceId)).toEqual(
      expectedFormsResource
    );
    // so the other block still reads it
    cacheFormsResult();
    expect(getBlockRoots()).toEqual([second]);
    expect(getBlockDataValues()).toEqual([formsBody]);
  });

  test("a deleted copy takes its own copy of the Resource", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(signupForm)).toBe(true);
    emitCommand("duplicateInstance");
    const [, copy] = getBlockRoots();
    const [, [copyBinding]] = getBlockBindings();
    const copiedResourceId = (copyBinding as { resourceId: string }).resourceId;
    expect(copiedResourceId).not.toBe(forms.resourceId);

    updateWebstudioData((data) => {
      deleteInstanceMutable(
        data,
        getInstancePath([copy.id, "bodyId"], data.instances)
      );
    });

    expect($resources.get().has(copiedResourceId)).toBe(false);
    expect($resources.get().has(forms.resourceId)).toBe(true);
  });

  test("a binding deleted in the data panel leaves the catalog Resource", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(signupForm)).toBe(true);
    const [[binding]] = getBlockBindings();

    updateWebstudioData((data) => {
      deleteVariableMutable(data, binding.id);
    });

    expect($dataSources.get().has(binding.id)).toBe(false);
    expect($resources.get().get(forms.resourceId)).toBe(formsResource);
  });
});

// The test block's instances, in the order they were inserted.
const getTestBlocks = () => {
  const instances = $instances.get();
  return [...instances.values()]
    .filter((instance) => instance.label === "Test Event Block")
    .map((root) => {
      const children = root.children.flatMap((child) =>
        child.type === "id" ? [instances.get(child.value) as Instance] : []
      );
      return {
        root,
        collection: children.find(
          (child) => child.component === "ws:collection"
        ) as Instance,
        empty: children.find((child) => child.label === "Empty") as Instance,
      };
    });
};

const getInstanceProps = (instanceId: Instance["id"], name: string) =>
  [...$props.get().values()].filter(
    (prop) => prop.instanceId === instanceId && prop.name === name
  );

const getResourceBindings = () =>
  [...$dataSources.get().values()].filter(
    (dataSource): dataSource is Extract<DataSource, { type: "resource" }> =>
      dataSource.type === "resource"
  );

describe("an Events block, through the completion table", () => {
  const upcomingResult = (data: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    data,
  });
  const cacheUpcomingResult = (result: unknown) => {
    const request = computeResourceRequest(expectedUpcomingResource, new Map());
    $resourcesCache.set(new Map([[getResourceKey(request), result]]));
  };

  test("creates a missing Upcoming Events Resource with the deterministic id, the Events header and <base>/events?upcoming=true, and never a second", async () => {
    setProject(withoutUpcoming);

    expect(await insertOrganizeosBlock(testBlock)).toBe(true);

    // exactly what provisioning writes for this project
    expect($resources.get().get(upcomingEvents.resourceId)).toEqual(
      expectedUpcomingResource
    );
    expect(expectedUpcomingResource.headers).toEqual(eventsResource.headers);
    expect(upcomingResource).toEqual(expectedUpcomingResource);
    expect(getResourceBindings().map((binding) => binding.resourceId)).toEqual([
      upcomingEvents.resourceId,
    ]);

    expect(await insertOrganizeosBlock(testBlock)).toBe(true);

    expect(getTestBlocks()).toHaveLength(2);
    expect(getResourceBindings().map((binding) => binding.resourceId)).toEqual([
      upcomingEvents.resourceId,
      upcomingEvents.resourceId,
    ]);
    expect($resources.get().size).toBe(provisioned.resources.length);
    // no Forms, nor anything else the block does not use
    expect($resources.get().get(forms.resourceId)).toEqual(formsResource);
  });

  test("uses an Upcoming Events Resource the project has as it is", async () => {
    setProject(withForms);

    expect(await insertOrganizeosBlock(testBlock)).toBe(true);

    expect($resources.get()).toEqual(
      new Map(provisioned.resources.map((resource) => [resource.id, resource]))
    );
    expect(getResourceBindings()).toEqual([
      expect.objectContaining({ resourceId: upcomingEvents.resourceId }),
    ]);
  });

  test("keeps an Upcoming Events Resource that appeared between the completion and the transaction", async () => {
    setProject(withoutUpcoming);
    const edited = { ...upcomingResource, name: "Upcoming (edited)" };
    beforeNextTransaction.run = () => {
      $resources.set(new Map($resources.get()).set(edited.id, edited));
    };

    expect(await insertOrganizeosBlock(testBlock)).toBe(true);

    expect($resources.get().get(upcomingEvents.resourceId)).toBe(edited);
  });

  test("binds the collection's data and the empty box's show to its own binding, scoped to the block's root, by id", async () => {
    setProject(withoutUpcoming);

    expect(await insertOrganizeosBlock(testBlock)).toBe(true);

    const [{ root, collection, empty }] = getTestBlocks();
    expect($instances.get().get("bodyId")?.children).toEqual([
      { type: "id", value: root.id },
    ]);
    const bindings = getResourceBindings();
    expect(bindings).toEqual([
      {
        type: "resource",
        id: expect.any(String),
        scopeInstanceId: root.id,
        name: "OrganizeOS Upcoming Events",
        resourceId: upcomingEvents.resourceId,
      },
    ]);
    const variable = encodeDataSourceVariable(bindings[0].id);
    expect(getInstanceProps(collection.id, "data")).toEqual([
      {
        id: expect.any(String),
        instanceId: collection.id,
        name: "data",
        type: "expression",
        value: `(${variable}.ok === true ? ${variable}.data.data : [])`,
      },
    ]);
    expect(getInstanceProps(empty.id, "data-ws-show")).toEqual([
      {
        id: expect.any(String),
        instanceId: empty.id,
        name: "data-ws-show",
        type: "expression",
        value: `${variable}.ok === true && ${variable}.data.data.length === 0`,
      },
    ]);
    // what the template made under the same names is replaced, and the rest
    // of the collection's props stay
    expect(getInstanceProps(collection.id, "item")).toEqual([
      expect.objectContaining({ type: "parameter" }),
    ]);
    // never page-wide
    expect(
      getResourceBindings().filter(
        (binding) =>
          binding.scopeInstanceId === ROOT_INSTANCE_ID ||
          binding.scopeInstanceId === "bodyId" ||
          binding.scopeInstanceId === undefined
      )
    ).toEqual([]);
  });

  test("gives each block its own binding", async () => {
    setProject(withForms);

    expect(await insertOrganizeosBlock(testBlock)).toBe(true);
    expect(await insertOrganizeosBlock(testBlock)).toBe(true);

    const blocks = getTestBlocks();
    const bindings = getResourceBindings();
    expect(bindings).toHaveLength(2);
    expect(bindings[0].id).not.toBe(bindings[1].id);
    blocks.forEach(({ root, collection }) => {
      const binding = bindings.find(
        (item) => item.scopeInstanceId === root.id
      ) as DataSource;
      expect(getInstanceProps(collection.id, "data")[0]?.value).toBe(
        `(${encodeDataSourceVariable(binding.id)}.ok === true ? ${encodeDataSourceVariable(binding.id)}.data.data : [])`
      );
    });
  });

  test("the collection and the boxes read the cached result", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(testBlock)).toBe(true);
    const [{ root, collection, empty }] = getTestBlocks();
    const read = (instance: Instance, name: string) =>
      $propValuesByInstanceSelector
        .get()
        .get(getInstanceKey([instance.id, root.id, "bodyId"]))
        ?.get(name);
    const body = { data: [{ title: "a" }, { title: "b" }] };

    cacheUpcomingResult(upcomingResult(body));
    expect(read(collection, "data")).toEqual(body.data);
    expect(read(empty, "data-ws-show")).toBe(false);

    cacheUpcomingResult(upcomingResult({ data: [] }));
    expect(read(collection, "data")).toEqual([]);
    expect(read(empty, "data-ws-show")).toBe(true);

    // a failed read hands over an error body, never a list
    cacheUpcomingResult(upcomingResult({ error: "unavailable" }, 503));
    expect(read(collection, "data")).toEqual([]);
    expect(read(empty, "data-ws-show")).toBe(false);
  });

  test("one undo removes the block, its binding and an Upcoming Events Resource it created", async () => {
    setProject(withoutUpcoming);
    const before = getStores();

    expect(await insertOrganizeosBlock(testBlock)).toBe(true);
    expect($resources.get().has(upcomingEvents.resourceId)).toBe(true);
    emitCommand("undo");

    expect(getStores()).toEqual(before);
  });

  test("inserts a template key with no entry untouched", async () => {
    // Events is missing: a block that reads no data does not need it
    setProject({
      ...withForms,
      resources: withForms.resources.filter(
        (resource) => resource.id !== events.resourceId
      ),
    });
    const resources = $resources.get();
    const dataSources = $dataSources.get();

    expect(await insertOrganizeosBlock(plainBlock)).toBe(true);

    const section = [...$instances.get().values()].filter(
      (instance) => instance.label === "Test Plain Block"
    );
    expect(section).toHaveLength(1);
    expect($instances.get().get("bodyId")?.children).toEqual([
      { type: "id", value: section[0].id },
    ]);
    expect($resources.get()).toBe(resources);
    expect($dataSources.get()).toBe(dataSources);
    expect([...$props.get().values()]).toEqual([]);
    expect(toastError).not.toHaveBeenCalled();
  });

  test("an events entry binds Events as it is, and creates nothing", async () => {
    organizeosBlockData.set(testBlock, {
      catalog: "events",
      bindingName: EVENTS_BINDING_NAME,
      binds: [
        { instance: "events", prop: "data", value: (variable) => variable },
      ],
    });
    // neither Forms nor Upcoming Events
    const project = {
      resources: provisioned.resources.filter(
        (resource) =>
          resource.id !== forms.resourceId &&
          resource.id !== upcomingEvents.resourceId
      ),
      dataSources: [] as DataSource[],
    };
    setProject(project);

    expect(await insertOrganizeosBlock(testBlock)).toBe(true);

    expect($resources.get().size).toBe(project.resources.length);
    expect(getResourceBindings()).toEqual([
      {
        type: "resource",
        id: expect.any(String),
        scopeInstanceId: getTestBlocks()[0].root.id,
        name: "OrganizeOS Events",
        resourceId: events.resourceId,
      },
    ]);
    const [{ collection }] = getTestBlocks();
    expect(getInstanceProps(collection.id, "data")[0]?.value).toBe(
      encodeDataSourceVariable(getResourceBindings()[0].id)
    );
  });

  describe("refuses, writing nothing", () => {
    const testRefusal =
      "Cannot add Test Event Block: this site's link to your organization's data was removed or changed. Contact OrganizeOS support to restore it.";
    const withEvents = (
      project: typeof withoutUpcoming,
      headers: Resource["headers"],
      url?: string
    ) => ({
      ...project,
      resources: project.resources.map((resource) =>
        resource.id === events.resourceId
          ? { ...resource, headers, url: url ?? resource.url }
          : resource
      ),
    });

    test.each([
      [
        "Events is missing",
        {
          ...withoutUpcoming,
          resources: withoutUpcoming.resources.filter(
            (resource) => resource.id !== events.resourceId
          ),
        },
      ],
      [
        "Events is missing but Upcoming Events is there",
        {
          ...withForms,
          resources: withForms.resources.filter(
            (resource) => resource.id !== events.resourceId
          ),
        },
      ],
      ["Events has no headers", withEvents(withoutUpcoming, [])],
      [
        "Events has a blank Authorization header",
        withEvents(withoutUpcoming, [{ name: "Authorization", value: `""` }]),
      ],
      [
        "Events has another header only",
        withEvents(withoutUpcoming, [
          { name: "Cache-Control", value: `"max-age=60"` },
        ]),
      ],
      [
        "Upcoming Events must be created and the Events URL is not the provisioned one",
        withEvents(
          withoutUpcoming,
          eventsResource.headers,
          `"https://example.org/" + path`
        ),
      ],
    ])("when %s", async (_case, project) => {
      setProject(project);
      const before = getStores();

      expect(await insertOrganizeosBlock(testBlock)).toBe(false);

      expectNothingWritten(before);
      expect(toastError).toHaveBeenCalledTimes(1);
      expect(toastError).toHaveBeenCalledWith(testRefusal);
    });

    test("for an events entry too, when Events has no Authorization", async () => {
      organizeosBlockData.set(testBlock, {
        catalog: "events",
        bindingName: EVENTS_BINDING_NAME,
        binds: [
          { instance: "events", prop: "data", value: (variable) => variable },
        ],
      });
      setProject(withEvents(withForms, []));
      const before = getStores();

      expect(await insertOrganizeosBlock(testBlock)).toBe(false);

      expectNothingWritten(before);
      expect(toastError).toHaveBeenCalledWith(testRefusal);
    });

    test("when a bind names an instance the template does not have", async () => {
      organizeosBlockData.set(testBlock, {
        ...upcomingBlockData,
        binds: [
          ...upcomingBlockData.binds,
          { instance: "not-in-the-template", prop: "data", value: () => "1" },
        ],
      });
      setProject(withForms);
      const before = getStores();

      expect(await insertOrganizeosBlock(testBlock)).toBe(false);

      expectNothingWritten(before);
      expect(toastError).toHaveBeenCalledTimes(1);
    });

    test("not when the Events URL is not the literal but Upcoming Events exists", async () => {
      setProject(
        withEvents(
          withForms,
          eventsResource.headers,
          `"https://example.org/" + path`
        )
      );

      expect(await insertOrganizeosBlock(testBlock)).toBe(true);
      expect(toastError).not.toHaveBeenCalled();
    });
  });
});

describe("shared tokens", () => {
  const getTokens = (name: string) =>
    [...$styleSources.get().values()].filter(
      (source) => source.type === "token" && source.name.startsWith(name)
    );

  test("a second Signup Form after OS Input was restyled uses the restyled token, and adds no OS Input-1", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(signupForm)).toBe(true);
    const [input] = getTokens("OS Input");
    expect(getTokens("OS Input")).toHaveLength(1);

    // the designer restyles the token
    const restyled = { type: "rgb", r: 255, g: 0, b: 0, alpha: 1 } as const;
    const styles = new Map($styles.get());
    for (const [key, style] of styles) {
      if (
        style.styleSourceId === input.id &&
        style.property === "backgroundColor"
      ) {
        styles.set(key, { ...style, value: restyled });
      }
    }
    $styles.set(styles);

    expect(await insertOrganizeosBlock(signupForm)).toBe(true);

    expect(getBlockRoots()).toHaveLength(2);
    // one token of each name, the designer's
    expect(getTokens("OS Input")).toEqual([input]);
    expect(getTokens("OS Input-1")).toEqual([]);
    for (const name of ["OS Field", "OS Button", "OS Message"]) {
      expect(getTokens(name)).toHaveLength(1);
    }
    expect(
      [...$styles.get().values()].filter(
        (style) =>
          style.styleSourceId === input.id &&
          style.property === "backgroundColor"
      )
    ).toEqual([expect.objectContaining({ value: restyled })]);
    // and both blocks' inputs wear it
    const inputs = [...$instances.get().values()].filter(
      (instance) =>
        instance.component === "@organizeos/site-components:FieldInput"
    );
    expect(inputs).toHaveLength(4);
    for (const instance of inputs) {
      expect($styleSourceSelections.get().get(instance.id)?.values).toContain(
        input.id
      );
    }
  });
});

describe("the inserted Event List's and Event Card's data", () => {
  const eventList = "@organizeos/site-components:EventList";
  const eventCard = "@organizeos/site-components:EventCard";
  const cachedResult = (data: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    data,
  });
  const cacheUpcoming = (result?: unknown) => {
    const request = computeResourceRequest(expectedUpcomingResource, new Map());
    $resourcesCache.set(
      new Map(result === undefined ? [] : [[getResourceKey(request), result]])
    );
  };

  // The block's instances and what the canvas computes for them, by the
  // selector of the first card's: block root > collection > item 0 > card.
  const readBlock = (block: Instance["id"]) => {
    const instances = $instances.get();
    const byLabel = (label: string) =>
      [...instances.values()].filter((instance) => instance.label === label);
    const root = instances.get(block) as Instance;
    const [collection] = byLabel("Events");
    const [empty] = byLabel("No upcoming events");
    const [unavailable] = byLabel("Events unavailable");
    const [card] = [...instances.values()].filter(
      (instance) => instance.tag === "article"
    );
    const [starts] = byLabel("Starts");
    const [link] = byLabel("Event link");
    const [title] = byLabel("Title");
    const propValues = $propValuesByInstanceSelector.get();
    const read = (selector: string[], name: string) =>
      propValues.get(getInstanceKey(selector))?.get(name);
    const outer = [root.id, "bodyId"];
    const item = (index: number) => [
      `${collection.id}[${index}]`,
      collection.id,
      ...outer,
    ];
    return {
      root,
      collection,
      items: [...propValues.keys()].filter((key) =>
        key.includes(`${collection.id}[`)
      ),
      collectionData: read([collection.id, ...outer], "data"),
      emptyShown: read([empty.id, ...outer], "data-ws-show"),
      unavailableShown: read([unavailable.id, ...outer], "data-ws-show"),
      timeZone: (index: number) =>
        read([starts.id, card.id, ...item(index)], "timeZone"),
      datetime: (index: number) =>
        read([starts.id, card.id, ...item(index)], "datetime"),
      href: (index: number) => read([link.id, card.id, ...item(index)], "href"),
      reloadDocument: (index: number) =>
        read([link.id, card.id, ...item(index)], "reloadDocument"),
      titleExpression: title.children,
    };
  };
  // The root and the card share the label "Event Card"; the root is the Share
  // Code Carrier, and the card is the article.
  const getRoot = (label: string) =>
    [...$instances.get().values()].filter(
      (instance) =>
        instance.label === label &&
        instance.component === "@organizeos/site-components:ShareCodeCarrier"
    )[0] as Instance;

  test("an Event List brings an Upcoming Events binding scoped to its root, never page-wide", async () => {
    setProject(withoutUpcoming);

    expect(await insertOrganizeosBlock(eventList)).toBe(true);

    const root = getRoot("Event List");
    expect($instances.get().get("bodyId")?.children).toEqual([
      { type: "id", value: root.id },
    ]);
    expect(getResourceBindings()).toEqual([
      {
        type: "resource",
        id: expect.any(String),
        scopeInstanceId: root.id,
        name: "OrganizeOS Upcoming Events",
        resourceId: upcomingEvents.resourceId,
      },
    ]);
    expect($resources.get().get(upcomingEvents.resourceId)).toEqual(
      expectedUpcomingResource
    );
    // the card's parameter is the collection's, and nothing else is a binding
    expect(
      [...$dataSources.get().values()].map((dataSource) => dataSource.type)
    ).toEqual(["parameter", "resource"]);
  });

  // The published page iterates `Object.entries(<bind> ?? {})`, and `??` binds
  // tighter than `?:`: the condition has to be parenthesized, or `?? {}` guards
  // only the `[]` branch and a 200 without a list throws during render.
  test.each([
    [
      "an Event List",
      eventList,
      "Event List",
      (variable: string) => `${variable}.data.data`,
    ],
    [
      "an Event Card",
      eventCard,
      "Event Card",
      (variable: string) => `${variable}.data.data.slice(0, 1)`,
    ],
  ])(
    "binds %s's collection to a parenthesized condition",
    async (_case, name, label, list) => {
      setProject(withoutUpcoming);
      expect(await insertOrganizeosBlock(name)).toBe(true);

      const [binding] = getResourceBindings();
      const variable = encodeDataSourceVariable(binding.id);
      const [collection] = [...$instances.get().values()].filter(
        (instance) => instance.label === "Events"
      );
      expect(getRoot(label)).toBeDefined();
      expect(getInstanceProps(collection.id, "data")).toEqual([
        expect.objectContaining({
          value: `(${variable}.ok === true ? ${list(variable)} : [])`,
        }),
      ]);
    }
  );

  test("renders the fixture's events in order, each start time in the event's own zone, with the link to its page", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(eventList)).toBe(true);
    cacheUpcoming(cachedResult(eventsBody));

    const block = readBlock(getRoot("Event List").id);

    expect(block.collectionData).toEqual(eventsBody.data);
    expect(block.items.length).toBeGreaterThan(0);
    eventsBody.data.forEach((event, index) => {
      expect(block.timeZone(index)).toBe(event.timezone);
      expect(block.datetime(index)).toBe(event.start_time);
      // the platform's event page on the site's own host, as a document
      // navigation (the site has no route there)
      expect(block.href(index)).toBe(`/events/${event.slug}`);
      expect(block.reloadDocument(index)).toBe(true);
    });
    expect(block.timeZone(0)).toBe("America/Chicago");
    expect(block.timeZone(2)).toBe("America/Los_Angeles");
    // neither the empty box nor the Unavailable box
    expect(block.emptyShown).toBe(false);
    expect(block.unavailableShown).toBe(false);
  });

  test("shows the empty box, and no item, for an empty list", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(eventList)).toBe(true);
    cacheUpcoming(cachedResult({ data: [] }));

    const block = readBlock(getRoot("Event List").id);

    expect(block.collectionData).toEqual([]);
    expect(block.items).toEqual([]);
    expect(block.emptyShown).toBe(true);
    expect(block.unavailableShown).toBe(false);
  });

  test.each([
    ["a 503", cachedResult({ error: "unavailable" }, 503)],
    [
      "a 429, with its retryAfter",
      cachedResult({ error: "rate_limited", retryAfter: 30 }, 429),
    ],
    ["a 401", cachedResult({ error: "unauthorized" }, 401)],
  ])(
    "shows the Unavailable box, and no item, after %s",
    async (_case, result) => {
      setProject(withForms);
      expect(await insertOrganizeosBlock(eventList)).toBe(true);
      cacheUpcoming(result);

      const block = readBlock(getRoot("Event List").id);

      expect(block.collectionData).toEqual([]);
      expect(block.items).toEqual([]);
      expect(block.emptyShown).toBe(false);
      expect(block.unavailableShown).toBe(true);
    }
  );

  test("shows nothing while the Resource has not loaded", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(eventList)).toBe(true);
    cacheUpcoming();

    const block = readBlock(getRoot("Event List").id);

    expect(block.collectionData).toEqual([]);
    expect(block.items).toEqual([]);
    expect(block.emptyShown).toBe(false);
    expect(block.unavailableShown).toBe(false);
  });

  test("an Event Card renders the first event only, and the same boxes", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(eventCard)).toBe(true);
    cacheUpcoming(cachedResult(eventsBody));

    let block = readBlock(getRoot("Event Card").id);

    expect(block.collectionData).toEqual(eventsBody.data.slice(0, 1));
    expect(block.timeZone(0)).toBe(eventsBody.data[0].timezone);
    expect(block.href(0)).toBe(`/events/${eventsBody.data[0].slug}`);
    expect(block.reloadDocument(0)).toBe(true);
    expect(block.items.some((key) => key.includes("[1]"))).toBe(false);
    expect(block.emptyShown).toBe(false);

    cacheUpcoming(cachedResult({ data: [] }));
    block = readBlock(getRoot("Event Card").id);
    expect(block.collectionData).toEqual([]);
    expect(block.emptyShown).toBe(true);

    cacheUpcoming(cachedResult({ error: "unavailable" }, 503));
    block = readBlock(getRoot("Event Card").id);
    expect(block.collectionData).toEqual([]);
    expect(block.unavailableShown).toBe(true);
  });

  test("the builder's loader requests Upcoming Events for the page, and nothing else", async () => {
    setProject(withoutUpcoming);
    expect(await insertOrganizeosBlock(eventList)).toBe(true);
    loaderFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const requests = JSON.parse(String(init.body)) as ResourceRequest[];
      return {
        ok: true,
        json: async () =>
          requests.map((request) => [
            getResourceKey(request),
            cachedResult(eventsBody),
          ]),
      };
    });

    vi.useFakeTimers();
    const unsubscribe = subscribeResources();
    await vi.advanceTimersByTimeAsync(1000);
    unsubscribe();

    expect(loaderFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(loaderFetch.mock.calls[0][1].body)).toEqual([
      {
        name: "Upcoming Events",
        method: "get",
        url: "https://staging.example.org/api/public/v1/events?upcoming=true",
        searchParams: [],
        headers: [{ name: "Authorization", value: "Bearer osk_eventstoken" }],
      },
    ]);
    expect(readBlock(getRoot("Event List").id).collectionData).toEqual(
      eventsBody.data
    );
  });

  test("one undo removes the Event List, its binding and the Upcoming Events Resource it created", async () => {
    setProject(withoutUpcoming);
    const before = getStores();

    expect(await insertOrganizeosBlock(eventList)).toBe(true);
    emitCommand("undo");

    expect(getStores()).toEqual(before);
  });

  test("refuses, writing nothing, when Events is missing", async () => {
    setProject({
      ...withoutUpcoming,
      resources: withoutUpcoming.resources.filter(
        (resource) => resource.id !== events.resourceId
      ),
    });
    const before = getStores();

    expect(await insertOrganizeosBlock(eventCard)).toBe(false);

    expectNothingWritten(before);
    expect(toastError).toHaveBeenCalledWith(
      "Cannot add Event Card: this site's link to your organization's data was removed or changed. Contact OrganizeOS support to restore it."
    );
  });

  test("every expression the table binds is a valid expression of the binding's variable", () => {
    const variable = encodeDataSourceVariable("binding-id");
    let checked = 0;
    for (const [key, entry] of organizeosBlockData) {
      for (const bind of entry.binds) {
        expect(
          lintExpression({
            expression: bind.value(variable),
            availableVariables: new Set([variable]),
          }),
          `${key} ${bind.instance}.${bind.prop}`
        ).toEqual([]);
        checked += 1;
      }
    }
    // the Signup Form's one bind, the Event List's and Event Card's three
    // each, and the RSVP Form's one
    expect(checked).toBeGreaterThanOrEqual(8);
  });
});

describe("the inserted RSVP Form", () => {
  const rsvpForm = "@organizeos/site-components:RsvpForm";
  const eventList = "@organizeos/site-components:EventList";
  const cachedResult = (data: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    data,
  });
  const cacheEvents = (result?: unknown) => {
    const request = computeResourceRequest(eventsResource, new Map());
    $resourcesCache.set(
      new Map(result === undefined ? [] : [[getResourceKey(request), result]])
    );
  };
  const getRoots = () =>
    [...$instances.get().values()].filter(
      (instance) => instance.component === rsvpForm
    );
  // the root's `data`, as the canvas computes it
  const getRootData = (root: Instance) =>
    $propValuesByInstanceSelector
      .get()
      .get(getInstanceKey([root.id, "bodyId"]))
      ?.get("data");
  const withoutCatalogExtras = () => ({
    resources: provisioned.resources.filter(
      (resource) =>
        resource.id !== forms.resourceId &&
        resource.id !== upcomingEvents.resourceId
    ),
    dataSources: [] as DataSource[],
  });

  test("brings an Events binding scoped to its root, never page-wide, and binds data to its body", async () => {
    setProject(withForms);

    expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);

    const [root, ...others] = getRoots();
    expect(others).toEqual([]);
    expect($instances.get().get("bodyId")?.children).toEqual([
      { type: "id", value: root.id },
    ]);
    expect(getResourceBindings()).toEqual([
      {
        type: "resource",
        id: expect.any(String),
        scopeInstanceId: root.id,
        name: "OrganizeOS Events",
        resourceId: events.resourceId,
      },
    ]);
    const [binding] = getResourceBindings();
    expect(getInstanceProps(root.id, "data")).toEqual([
      {
        id: expect.any(String),
        instanceId: root.id,
        name: "data",
        type: "expression",
        value: `${encodeDataSourceVariable(binding.id)}.data`,
      },
    ]);
    // the template's rsvpState variable and the binding, and nothing at :root
    // or on the page
    expect(
      [...$dataSources.get().values()].map((dataSource) => [
        dataSource.type,
        dataSource.scopeInstanceId,
      ])
    ).toEqual([
      ["variable", root.id],
      ["resource", root.id],
    ]);
    // the template binds the state, and the insert adds the data and the
    // designer picks the event: no record is set
    expect(getInstanceProps(root.id, "record")).toEqual([]);
    expect(
      [...$props.get().values()]
        .filter((prop) => prop.instanceId === root.id)
        .map((prop) => prop.name)
        .sort()
    ).toEqual(["data", "onStateChange", "state"]);
  });

  test("uses the Events Resource as it is and creates no Resource, with neither Forms nor Upcoming Events in the project", async () => {
    const project = withoutCatalogExtras();
    setProject(project);

    expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);

    expect([...$resources.get().values()]).toEqual(project.resources);
    expect($resources.get().get(events.resourceId)).toBe(eventsResource);
    expect(getResourceBindings()).toEqual([
      expect.objectContaining({ resourceId: events.resourceId }),
    ]);
    expect(toastError).not.toHaveBeenCalled();
  });

  test("gives each RSVP Form a binding of its own, of the same Events Resource", async () => {
    setProject(withForms);

    expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);
    expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);

    const roots = getRoots();
    expect(roots).toHaveLength(2);
    const bindings = getResourceBindings();
    expect(bindings.map((binding) => binding.scopeInstanceId).sort()).toEqual(
      roots.map((root) => root.id).sort()
    );
    expect(new Set(bindings.map((binding) => binding.id)).size).toBe(2);
    expect(bindings.map((binding) => binding.resourceId)).toEqual([
      events.resourceId,
      events.resourceId,
    ]);
    expect($resources.get().size).toBe(withForms.resources.length);
    for (const root of roots) {
      const binding = bindings.find(
        (item) => item.scopeInstanceId === root.id
      ) as DataSource;
      expect(getInstanceProps(root.id, "data")[0]).toMatchObject({
        value: `${encodeDataSourceVariable(binding.id)}.data`,
      });
    }
  });

  test("the root's data is the Events body once the loader has it, and nothing before", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);
    const [root] = getRoots();

    cacheEvents();
    expect(getRootData(root)).toBeUndefined();

    cacheEvents(cachedResult(eventsBody));
    expect(getRootData(root)).toEqual(eventsBody);
    // the fixture has the event with shifts and questions the form reads
    expect(eventsBody.data.some((event) => event.shifts.length > 0)).toBe(true);
    expect(eventsBody.data.some((event) => event.questions.length > 0)).toBe(
      true
    );
  });

  test.each([
    ["a 503", cachedResult({ error: "unavailable" }, 503)],
    [
      "a 429, with its retryAfter",
      cachedResult({ error: "rate_limited", retryAfter: 30 }, 429),
    ],
    ["a 401", cachedResult({ error: "unauthorized" }, 401)],
  ])(
    "the root's data is the error body after %s, which the form reads as no data",
    async (_case, result) => {
      setProject(withForms);
      expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);
      const [root] = getRoots();

      cacheEvents(result);

      const data = getRootData(root);
      expect(data).toEqual(result.data);
      expect(Array.isArray((data as { data?: unknown }).data)).toBe(false);
    }
  );

  test("the builder's loader requests Events for the page, and nothing else", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);
    loaderFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const requests = JSON.parse(String(init.body)) as ResourceRequest[];
      return {
        ok: true,
        json: async () =>
          requests.map((request) => [
            getResourceKey(request),
            cachedResult(eventsBody),
          ]),
      };
    });

    vi.useFakeTimers();
    const unsubscribe = subscribeResources();
    await vi.advanceTimersByTimeAsync(1000);
    unsubscribe();

    expect(loaderFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(loaderFetch.mock.calls[0][1].body)).toEqual([
      {
        name: "Events",
        method: "get",
        url: "https://staging.example.org/api/public/v1/events",
        searchParams: [],
        headers: [{ name: "Authorization", value: "Bearer osk_eventstoken" }],
      },
    ]);
    expect(getRootData(getRoots()[0])).toEqual(eventsBody);
  });

  test("an RSVP Form and an Event List on one page each bring a binding of their own Resource, scoped to their own root", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);
    // the insert selects the block it added, and the next goes inside the
    // selection: the designer clicks the page body to add a sibling
    selectInstance(["bodyId"]);
    expect(await insertOrganizeosBlock(eventList)).toBe(true);

    const [form] = getRoots();
    const [list] = [...$instances.get().values()].filter(
      (instance) => instance.label === "Event List"
    );
    expect($instances.get().get("bodyId")?.children).toEqual([
      { type: "id", value: form.id },
      { type: "id", value: list.id },
    ]);
    expect(
      getResourceBindings().map((binding) => [
        binding.name,
        binding.scopeInstanceId,
        binding.resourceId,
      ])
    ).toEqual([
      ["OrganizeOS Events", form.id, events.resourceId],
      ["OrganizeOS Upcoming Events", list.id, upcomingEvents.resourceId],
    ]);
  });

  test("one undo removes the RSVP Form and its binding, and a Resource it did not create is left", async () => {
    setProject(withForms);
    const before = getStores();

    expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);
    emitCommand("undo");

    expect(getStores()).toEqual(before);
  });

  test.each([
    [
      "Events is missing",
      {
        ...withForms,
        resources: withForms.resources.filter(
          (resource) => resource.id !== events.resourceId
        ),
      },
    ],
    [
      "Events has no Authorization header",
      {
        ...withForms,
        resources: withForms.resources.map((resource) =>
          resource.id === events.resourceId
            ? { ...resource, headers: [] }
            : resource
        ),
      },
    ],
    [
      "Events has a blank Authorization header",
      {
        ...withForms,
        resources: withForms.resources.map((resource) =>
          resource.id === events.resourceId
            ? {
                ...resource,
                headers: [{ name: "Authorization", value: `""` }],
              }
            : resource
        ),
      },
    ],
  ])("refuses, writing nothing, when %s", async (_case, project) => {
    setProject(project);
    const before = getStores();

    expect(await insertOrganizeosBlock(rsvpForm)).toBe(false);

    expectNothingWritten(before);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "Cannot add RSVP Form: this site's link to your organization's data was removed or changed. Contact OrganizeOS support to restore it."
    );
  });

  test("refuses, writing nothing, for a denied org", async () => {
    setProject(withForms, { blocksEnabled: false });
    const before = getStores();

    expect(await insertOrganizeosBlock(rsvpForm)).toBe(false);

    expectNothingWritten(before);
    expect(toastError).toHaveBeenCalledWith(
      "Cannot add RSVP Form: OrganizeOS blocks are not available for this site yet."
    );
  });

  test("the inserted form satisfies the content model: every part is allowed where the template puts it", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);
    const [root] = getRoots();
    const errors: string[] = [];

    expect(
      isTreeSatisfyingContentModel({
        instances: $instances.get(),
        props: $props.get(),
        metas: $registeredComponentMetas.get(),
        instanceSelector: [root.id, "bodyId"],
        onError: (message) => errors.push(message),
      }),
      errors.join("\n")
    ).toBe(true);
    expect(errors).toEqual([]);
    // and it holds all of the form's parts
    const components = new Set(
      [...$instances.get().values()].map((instance) => instance.component)
    );
    for (const part of [
      "Field",
      "FieldLabel",
      "FieldInput",
      "FieldMessage",
      "SubmitButton",
      "Guests",
      "ShiftOptions",
      "Questions",
      "EmailConsent",
    ]) {
      expect(components, part).toContain(`@organizeos/site-components:${part}`);
    }
  });

  describe("the shared tokens", () => {
    const getTokens = (name: string) =>
      [...$styleSources.get().values()].filter(
        (source) => source.type === "token" && source.name.startsWith(name)
      );
    const descendantsOf = (component: string) => {
      const instances = $instances.get();
      const [part] = [...instances.values()].filter(
        (instance) => instance.component === component
      );
      return part.children.flatMap((child) =>
        child.type === "id" ? [instances.get(child.value) as Instance] : []
      );
    };
    const tokensOf = (instance: Instance) =>
      $styleSourceSelections.get().get(instance.id)?.values ?? [];

    test("the inner controls of Guests, Shift Options and Questions wear the same OS tokens as the Fields", async () => {
      setProject(withForms);
      expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);

      for (const name of ["OS Field", "OS Input", "OS Button", "OS Message"]) {
        expect(getTokens(name), name).toHaveLength(1);
      }
      const [input] = getTokens("OS Input");
      const [button] = getTokens("OS Button");
      const [message] = getTokens("OS Message");
      const fieldInputs = [...$instances.get().values()].filter(
        (instance) =>
          instance.component === "@organizeos/site-components:FieldInput"
      );
      expect(fieldInputs).toHaveLength(4);
      for (const instance of fieldInputs) {
        expect(tokensOf(instance)).toEqual([input.id]);
      }
      for (const part of ["Guests", "ShiftOptions", "Questions"]) {
        const descendants = descendantsOf(
          `@organizeos/site-components:${part}`
        );
        expect(
          descendants.map((instance) => [
            instance.component,
            getInstanceProps(instance.id, "selector")[0]?.value,
            tokensOf(instance),
          ]),
          part
        ).toEqual([
          [
            "ws:descendant",
            " :is(input:not([type=checkbox]):not([type=radio]), select, textarea)",
            [input.id],
          ],
          ["ws:descendant", " button", [button.id]],
          ["ws:descendant", " [data-message]", [message.id]],
        ]);
      }
    });

    test("a Signup Form inserted after an RSVP Form, and the other way round, adds no second token", async () => {
      setProject(withForms);
      expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);
      expect(await insertOrganizeosBlock(signupForm)).toBe(true);
      expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);

      for (const name of ["OS Field", "OS Input", "OS Button", "OS Message"]) {
        expect(getTokens(name), name).toHaveLength(1);
      }
      expect(getTokens("OS ").map((source) => source.type)).toHaveLength(4);
    });

    test("a second RSVP Form after OS Input was restyled uses the restyled token, on its inner controls too", async () => {
      setProject(withForms);
      expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);
      const [input] = getTokens("OS Input");
      const restyled = { type: "rgb", r: 255, g: 0, b: 0, alpha: 1 } as const;
      const styles = new Map($styles.get());
      for (const [key, style] of styles) {
        if (
          style.styleSourceId === input.id &&
          style.property === "backgroundColor"
        ) {
          styles.set(key, { ...style, value: restyled });
        }
      }
      $styles.set(styles);

      expect(await insertOrganizeosBlock(rsvpForm)).toBe(true);

      expect(getRoots()).toHaveLength(2);
      expect(getTokens("OS Input")).toEqual([input]);
      expect(getTokens("OS Input-1")).toEqual([]);
      const inputDescendants = [...$instances.get().values()].filter(
        (instance) =>
          instance.component === "ws:descendant" &&
          getInstanceProps(instance.id, "selector")[0]
            ?.value?.toString()
            .startsWith(" :is(")
      );
      // three parts in each of two forms
      expect(inputDescendants).toHaveLength(6);
      for (const instance of inputDescendants) {
        expect(tokensOf(instance)).toEqual([input.id]);
      }
      expect(
        [...$styles.get().values()].filter(
          (style) =>
            style.styleSourceId === input.id &&
            style.property === "backgroundColor"
        )
      ).toEqual([expect.objectContaining({ value: restyled })]);
    });
  });
});

describe("completeOrganizeosFragment", () => {
  const presets = {
    presetIds: { events, forms, upcomingEvents },
    resources: new Map(provisioned.resources.map((item) => [item.id, item])),
  };

  test("leaves the registered template unbound, and names the Forms Resource", () => {
    const template = getComponentTemplateData(signupForm);
    const props = template.props;

    const completion = completeOrganizeosFragment({
      component: signupForm,
      fragment: template,
      ...presets,
    });

    expect(completion).toEqual({
      status: "ready",
      fragment: expect.anything(),
      binding: {
        resourceId: forms.resourceId,
        resource: undefined,
        name: "OrganizeOS Forms",
        binds: [
          {
            instanceId: template.instances[0].id,
            prop: "data",
            value: expect.any(Function),
          },
        ],
      },
    });
    // the bind turns the binding's variable into the root's `data` expression
    expect(
      completion.status === "ready" &&
        completion.binding?.binds[0].value("$ws$dataSource$x")
    ).toBe("$ws$dataSource$x.data");
    expect(template.props).toBe(props);
    expect(template.props.some((prop) => prop.name === "data")).toBe(false);
  });

  test("adds the Forms Resource a project lacks as provisioning builds it", () => {
    const completion = completeOrganizeosFragment({
      component: signupForm,
      fragment: getComponentTemplateData(signupForm),
      presetIds: { events, forms, upcomingEvents },
      resources: new Map(withoutForms.resources.map((item) => [item.id, item])),
    });

    expect(completion).toEqual({
      status: "ready",
      fragment: expect.anything(),
      binding: expect.objectContaining({
        resourceId: forms.resourceId,
        resource: expectedFormsResource,
      }),
    });
  });

  test("drops a data prop the template binds by name", () => {
    const template = getComponentTemplateData(signupForm);
    const rootId = template.instances[0].id;
    const byName = {
      ...template,
      props: [
        ...template.props,
        {
          id: "by-name",
          instanceId: rootId,
          name: "data",
          type: "expression" as const,
          value: "Forms.data",
        },
      ],
    };

    const completion = completeOrganizeosFragment({
      component: signupForm,
      fragment: byName,
      ...presets,
    });

    expect(
      completion.status === "ready" &&
        completion.fragment.props.filter((prop) => prop.name === "data")
    ).toEqual([]);
  });

  test("leaves a fragment whose root reads no platform data alone", () => {
    const fragment = getComponentTemplateData("Box");
    expect(
      completeOrganizeosFragment({
        component: "Box",
        fragment,
        presetIds: { events, forms, upcomingEvents },
        resources: new Map(),
      })
    ).toEqual({ status: "ready", fragment });
  });
});

describe("Rotating Tabs", () => {
  const rotatingTabs = "@organizeos/site-components:RotatingTabs";
  const radix = "@webstudio-is/sdk-components-react-radix";
  const getTabsRoots = () =>
    [...$instances.get().values()].filter(
      (instance) => instance.component === `${radix}:Tabs`
    );

  test("inserts unbound: no catalog data, no Resource and no binding, only its own activeTab variable", async () => {
    // a project missing every catalog Resource: the block reads none of them
    setProject({ resources: [], dataSources: [] });
    const resources = $resources.get();

    expect(await insertOrganizeosBlock(rotatingTabs)).toBe(true);

    const [root, ...others] = getTabsRoots();
    expect(others).toEqual([]);
    expect($instances.get().get("bodyId")?.children).toEqual([
      { type: "id", value: root.id },
    ]);
    expect($resources.get()).toBe(resources);
    const dataSources = [...$dataSources.get().values()];
    expect(dataSources).toEqual([
      {
        type: "variable",
        id: expect.any(String),
        scopeInstanceId: root.id,
        name: "activeTab",
        value: { type: "string", value: "0" },
      },
    ]);
    const variable = encodeDataSourceVariable(dataSources[0].id);
    const [control] = [...$instances.get().values()].filter(
      (instance) =>
        instance.component === "@organizeos/site-components:RotationControl"
    );
    const propsOf = (instanceId: string) =>
      [...$props.get().values()]
        .filter((prop) => prop.instanceId === instanceId)
        .map(({ name, type, value }) => ({ name, type, value }));
    expect(propsOf(root.id)).toEqual([
      { name: "value", type: "expression", value: variable },
    ]);
    expect(propsOf(control.id)).toEqual([
      { name: "value", type: "expression", value: variable },
      {
        name: "onValueChange",
        type: "action",
        value: [
          { type: "execute", args: ["value"], code: `${variable} = value` },
        ],
      },
    ]);
    expect(toastError).not.toHaveBeenCalled();
  });

  test("the inserted section satisfies the content model with upstream's Radix metas registered", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(rotatingTabs)).toBe(true);
    const [root] = getTabsRoots();
    const errors: string[] = [];

    expect(
      isTreeSatisfyingContentModel({
        instances: $instances.get(),
        props: $props.get(),
        metas: $registeredComponentMetas.get(),
        instanceSelector: [root.id, "bodyId"],
        onError: (message) => errors.push(message),
      }),
      errors.join("\n")
    ).toBe(true);
    expect(errors).toEqual([]);
    // the control is a child of the Tabs, before its list
    expect(
      root.children.map((child) => $instances.get().get(child.value)?.component)
    ).toEqual([
      "@organizeos/site-components:RotationControl",
      `${radix}:TabsList`,
      `${radix}:TabsContent`,
      `${radix}:TabsContent`,
      `${radix}:TabsContent`,
    ]);
  });
});

describe("Marquee", () => {
  const namespace = "@organizeos/site-components";
  const marquee = `${namespace}:Marquee`;
  const getMarqueeRoots = () =>
    [...$instances.get().values()].filter(
      (instance) => instance.component === marquee
    );

  test("inserts unbound: no catalog data, no Resource, no variable and no binding", async () => {
    // a project missing every catalog Resource: the block reads none of them
    setProject({ resources: [], dataSources: [] });
    const resources = $resources.get();

    expect(await insertOrganizeosBlock(marquee)).toBe(true);

    const [root, ...others] = getMarqueeRoots();
    expect(others).toEqual([]);
    expect($instances.get().get("bodyId")?.children).toEqual([
      { type: "id", value: root.id },
    ]);
    expect($resources.get()).toBe(resources);
    expect([...$dataSources.get().values()]).toEqual([]);
    expect(
      [...$props.get().values()].filter(
        (prop) => prop.type === "expression" || prop.type === "action"
      )
    ).toEqual([]);
    expect(toastError).not.toHaveBeenCalled();
  });

  test("the inserted section satisfies the content model with the package's metas", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(marquee)).toBe(true);
    const [root] = getMarqueeRoots();
    const errors: string[] = [];

    expect(
      isTreeSatisfyingContentModel({
        instances: $instances.get(),
        props: $props.get(),
        metas: $registeredComponentMetas.get(),
        instanceSelector: [root.id, "bodyId"],
        onError: (message) => errors.push(message),
      }),
      errors.join("\n")
    ).toBe(true);
    expect(errors).toEqual([]);
    // the Pause button first, then the track of five plain items
    const componentOf = (id: string) => $instances.get().get(id)?.component;
    expect(root.children.map((child) => componentOf(child.value))).toEqual([
      `${namespace}:MarqueePauseButton`,
      `${namespace}:MarqueeTrack`,
    ]);
    const track = $instances.get().get(root.children[1].value);
    expect(track?.children.map((child) => componentOf(child.value))).toEqual(
      Array.from({ length: 5 }, () => "ws:element")
    );
  });

  test("the content model refuses a Marquee Track outside a Marquee", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(marquee)).toBe(true);
    const [root] = getMarqueeRoots();
    const trackId = root.children[1].value;
    const instances = new Map($instances.get());
    // the track moved up to the body, beside its Marquee
    instances.set("bodyId", {
      ...instances.get("bodyId")!,
      children: [
        { type: "id", value: root.id },
        { type: "id", value: trackId },
      ],
    });
    instances.set(root.id, { ...root, children: [root.children[0]] });

    expect(
      isTreeSatisfyingContentModel({
        instances,
        props: $props.get(),
        metas: $registeredComponentMetas.get(),
        instanceSelector: [trackId, "bodyId"],
      })
    ).toBe(false);
  });
});

describe("Convergence Field", () => {
  const namespace = "@organizeos/site-components";
  const field = `${namespace}:ConvergenceField`;
  const getFieldRoots = () =>
    [...$instances.get().values()].filter(
      (instance) => instance.component === field
    );

  test("inserts unbound, with no props: the runtime's defaults apply", async () => {
    setProject({ resources: [], dataSources: [] });
    const resources = $resources.get();

    expect(await insertOrganizeosBlock(field)).toBe(true);

    const [root, ...others] = getFieldRoots();
    expect(others).toEqual([]);
    expect($instances.get().get("bodyId")?.children).toEqual([
      { type: "id", value: root.id },
    ]);
    expect($resources.get()).toBe(resources);
    expect([...$dataSources.get().values()]).toEqual([]);
    expect([...$props.get().values()]).toEqual([]);
    expect(toastError).not.toHaveBeenCalled();
  });

  test("the inserted section satisfies the content model, and so does any element added inside it", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(field)).toBe(true);
    const [root] = getFieldRoots();
    const check = () => {
      const errors: string[] = [];
      const satisfied = isTreeSatisfyingContentModel({
        instances: $instances.get(),
        props: $props.get(),
        metas: $registeredComponentMetas.get(),
        instanceSelector: [root.id, "bodyId"],
        onError: (message) => errors.push(message),
      });
      return { satisfied, errors };
    };
    expect(check()).toEqual({ satisfied: true, errors: [] });
    // the content Box, holding a heading and a line of text
    const componentOf = (id: string) => $instances.get().get(id)?.component;
    expect(root.children.map((child) => componentOf(child.value))).toEqual([
      "ws:element",
    ]);

    // a designer's Box beside the content
    const instances = new Map($instances.get());
    instances.set("added-box", {
      type: "instance",
      id: "added-box",
      component: "Box",
      children: [],
    });
    instances.set(root.id, {
      ...root,
      children: [...root.children, { type: "id", value: "added-box" }],
    });
    $instances.set(instances);
    expect(check()).toEqual({ satisfied: true, errors: [] });
  });
});

describe("Rich Text", () => {
  const namespace = "@organizeos/site-components";
  const richText = `${namespace}:RichText`;
  const getRichTextRoots = () =>
    [...$instances.get().values()].filter(
      (instance) => instance.component === richText
    );

  test("inserts unbound: no catalog data, no Resource, no variable and no binding; a designer binds value", async () => {
    setProject({ resources: [], dataSources: [] });
    const resources = $resources.get();

    expect(await insertOrganizeosBlock(richText)).toBe(true);

    const [root, ...others] = getRichTextRoots();
    expect(others).toEqual([]);
    expect($instances.get().get("bodyId")?.children).toEqual([
      { type: "id", value: root.id },
    ]);
    expect($resources.get()).toBe(resources);
    expect([...$dataSources.get().values()]).toEqual([]);
    // only the descendants' selectors
    expect(
      [...$props.get().values()].filter((prop) => prop.name !== "selector")
    ).toEqual([]);
    expect(toastError).not.toHaveBeenCalled();
  });

  test("the inserted block satisfies the content model: its children are its descendants", async () => {
    setProject(withForms);
    expect(await insertOrganizeosBlock(richText)).toBe(true);
    const [root] = getRichTextRoots();
    const errors: string[] = [];
    expect(
      isTreeSatisfyingContentModel({
        instances: $instances.get(),
        props: $props.get(),
        metas: $registeredComponentMetas.get(),
        instanceSelector: [root.id, "bodyId"],
        onError: (message) => errors.push(message),
      }),
      errors.join("\n")
    ).toBe(true);
    expect(
      root.children.map((child) => $instances.get().get(child.value)?.component)
    ).toEqual(Array.from({ length: 17 }, () => "ws:descendant"));
  });
});
