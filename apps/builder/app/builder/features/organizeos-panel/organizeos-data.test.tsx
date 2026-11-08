import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { enableMapSet } from "immer";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import { renderData } from "@webstudio-is/template";
import { findAvailableVariables } from "@webstudio-is/project-build/runtime";
import { $ } from "@organizeos/site-components/site-templates";
import {
  ROOT_INSTANCE_ID,
  encodeDataVariableId,
  type DataSource,
  type Prop,
  type Resource,
  type ResourceRequest,
} from "@webstudio-is/sdk";
import {
  $organizeosSite,
  $variableValuesByInstanceSelector,
  getInstanceKey,
  selectInstance,
  subscribeResources,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { $authPermit, $builderMode } from "~/shared/nano-states/misc";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
import { getWebstudioData } from "~/shared/instance-utils/data";
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
  __testing__ as resourcesLoader,
  $resourcesCache,
  getResourceKey,
} from "~/shared/resources";
import {
  findCatalogResources,
  getResourcePresetIds,
} from "~/shared/organizeos-preset-ids";
import { buildOrgResourcePresets } from "~/shared/db/resource-presets.server";
import {
  addCatalogResourceToPage,
  isCatalogResourceOnPage,
} from "./organizeos-data";

const { loaderFetch, toastError } = vi.hoisted(() => ({
  // the builder's resources loader posts to /rest/resources-loader with this
  loaderFetch: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("~/shared/fetch.client", () => ({ fetch: loaderFetch }));
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: toastError } },
}));

enableMapSet();
registerContainers();

const projectId = "project-1";
const { resources: catalog } = await buildOrgResourcePresets({
  projectId,
  apiBaseUrl: "https://staging.example.org/api/public/v1",
  readToken: "osk_token",
});
const events = await getResourcePresetIds(projectId, "events");
const upcoming = await getResourcePresetIds(projectId, "upcoming-events");
const eventsResource = catalog.find(
  (resource) => resource.id === events.resourceId
) as Resource;

const setProject = ({
  dataSources = [],
  blocksEnabled = true,
}: { dataSources?: DataSource[]; blocksEnabled?: boolean } = {}) => {
  const data = renderData(
    <$.Body ws:id="bodyId">
      <$.Box ws:id="boxId"></$.Box>
    </$.Body>
  );
  $instances.set(data.instances);
  $props.set(data.props);
  $breakpoints.set(new Map());
  $styles.set(new Map());
  $styleSources.set(new Map());
  $styleSourceSelections.set(new Map());
  $assets.set(new Map());
  $resources.set(new Map(catalog.map((resource) => [resource.id, resource])));
  $dataSources.set(
    new Map(dataSources.map((dataSource) => [dataSource.id, dataSource]))
  );
  const pages = createDefaultPages({ rootInstanceId: "bodyId" });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
  $builderMode.set("design");
  $authPermit.set("build");
  selectInstance(["boxId", "bodyId"]);
  $project.set({ id: projectId } as Project);
  serverSyncStore.transactionManager.currentStack = [];
  serverSyncStore.transactionManager.undoneStack = [];
  $organizeosSite.set({
    organizationId: "org-1",
    manageUrl: "https://app.example.org/dashboard",
    platformUrl: "https://app.example.org",
    blocksEnabled,
  });
};

const getEventsBindings = () =>
  [...$dataSources.get().values()].filter(
    (dataSource) =>
      dataSource.type === "resource" &&
      dataSource.resourceId === events.resourceId
  );

// 0.309.0 loads a Resource only for a page whose expressions read it
// (getPageResourceRootIds), in the builder and on a published page alike
const useOnBox = (binding: DataSource) => {
  const prop: Prop = {
    id: "box-uses-it",
    instanceId: "boxId",
    name: "title",
    type: "expression",
    value: `${encodeDataVariableId(binding.id)}.data`,
  };
  $props.set(new Map([...$props.get(), [prop.id, prop]]));
};

beforeEach(() => {
  loaderFetch.mockReset();
  toastError.mockClear();
  // the loader keeps what it loaded: a case loads nothing an earlier one did
  resourcesLoader.reset();
  $resourcesCache.set(new Map());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("addCatalogResourceToPage", () => {
  test("binds the Resource at the page's root, named like it, once", async () => {
    setProject();
    const before = getWebstudioData();

    expect(await addCatalogResourceToPage(events.resourceId)).toBe(true);
    expect(getEventsBindings()).toEqual([
      {
        type: "resource",
        id: expect.any(String),
        scopeInstanceId: "bodyId",
        name: "Events",
        resourceId: events.resourceId,
      },
    ]);
    // never a copy of the Resource, nor a change to it
    expect($resources.get().get(events.resourceId)).toBe(eventsResource);
    // one undo step
    expect(serverSyncStore.transactionManager.currentStack).toHaveLength(1);

    expect(await addCatalogResourceToPage(events.resourceId)).toBe(false);
    expect(getEventsBindings()).toHaveLength(1);
    expect(serverSyncStore.transactionManager.currentStack).toHaveLength(1);

    // and one undo takes it back
    serverSyncStore.undo();
    expect(getEventsBindings()).toEqual([]);
    expect(getWebstudioData()).toEqual(before);
  });

  test("takes the next free name when the page root already has one", async () => {
    setProject({
      dataSources: [
        {
          type: "variable",
          id: "own-events",
          scopeInstanceId: "bodyId",
          name: "Events",
          value: { type: "string", value: "" },
        },
      ],
    });

    expect(await addCatalogResourceToPage(events.resourceId)).toBe(true);
    expect(getEventsBindings()).toEqual([
      expect.objectContaining({ name: "Events 2", scopeInstanceId: "bodyId" }),
    ]);
    // the designer's own variable keeps its name
    expect($dataSources.get().get("own-events")?.name).toBe("Events");
  });

  test("takes the next free name when `:root` already has one, and `:root` keeps its expressions", async () => {
    setProject({
      dataSources: [
        {
          type: "variable",
          id: "root-events",
          scopeInstanceId: ROOT_INSTANCE_ID,
          name: "Events",
          value: { type: "string", value: "" },
        },
      ],
    });
    // an expression on the page already resolves "Events" to the `:root`
    // variable: a page-root binding of the same name would mask it, and the
    // re-resolution that follows the add would then read the Resource
    const prop: Prop = {
      id: "title-prop",
      instanceId: "boxId",
      name: "title",
      type: "expression",
      value: encodeDataVariableId("root-events"),
    };
    $props.set(new Map([...$props.get(), [prop.id, prop]]));

    expect(await addCatalogResourceToPage(events.resourceId)).toBe(true);
    expect(getEventsBindings()).toEqual([
      expect.objectContaining({ name: "Events 2", scopeInstanceId: "bodyId" }),
    ]);
    expect($dataSources.get().get("root-events")?.name).toBe("Events");
    expect($props.get().get(prop.id)).toEqual(prop);
  });

  test("takes the next free name when an unscoped binding has it, which counts as `:root`", async () => {
    // what older provisioning wrote next to each Resource: no scope, so the
    // builder's variable scope treats it as a `:root` variable
    const unscoped: DataSource = {
      type: "resource",
      id: events.bindingId,
      name: "Events",
      resourceId: events.resourceId,
    };
    setProject({ dataSources: [unscoped] });

    expect(await addCatalogResourceToPage(events.resourceId)).toBe(true);
    expect(getEventsBindings()).toEqual([
      unscoped,
      expect.objectContaining({ name: "Events 2", scopeInstanceId: "bodyId" }),
    ]);
  });

  test("a name used only inside a block is still free on the page root", async () => {
    setProject({
      dataSources: [
        {
          type: "variable",
          id: "box-events",
          scopeInstanceId: "boxId",
          name: "Events",
          value: { type: "string", value: "" },
        },
      ],
    });

    expect(await addCatalogResourceToPage(events.resourceId)).toBe(true);
    expect(getEventsBindings()).toEqual([
      expect.objectContaining({ name: "Events", scopeInstanceId: "bodyId" }),
    ]);
  });

  test("the data panel lists it on the page's elements, and the builder loads it once one uses it", async () => {
    setProject();
    expect(await addCatalogResourceToPage(events.resourceId)).toBe(true);
    const [binding] = getEventsBindings();

    expect(
      findAvailableVariables({
        startingInstanceId: "boxId",
        instances: $instances.get(),
        dataSources: $dataSources.get(),
      })
    ).toContainEqual(binding);
    useOnBox(binding);

    const eventsResult = {
      ok: true,
      status: 200,
      statusText: "",
      data: { data: [{ id: "event-1" }] },
    };
    loaderFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const requests = JSON.parse(String(init.body)) as ResourceRequest[];
      return {
        ok: true,
        json: async () =>
          requests.map((request) => [getResourceKey(request), eventsResult]),
      };
    });
    vi.useFakeTimers();
    const unsubscribe = subscribeResources();
    await vi.advanceTimersByTimeAsync(1000);

    // Events alone: nothing else in the catalog is used on the page
    expect(loaderFetch).toHaveBeenCalledTimes(1);
    expect(
      (JSON.parse(loaderFetch.mock.calls[0][1].body) as ResourceRequest[]).map(
        (request) => request.url
      )
    ).toEqual(["https://staging.example.org/api/public/v1/events"]);
    // read before the plan is unsubscribed, which empties it; the values
    // are computed asynchronously
    await vi.waitFor(() =>
      expect(
        $variableValuesByInstanceSelector
          .get()
          .get(getInstanceKey(["boxId", "bodyId", ROOT_INSTANCE_ID]))
          ?.get(binding.id)
      ).toEqual(eventsResult)
    );
    unsubscribe();
  });

  test("adds nothing where the org is denied the blocks", async () => {
    setProject({ blocksEnabled: false });

    expect(await addCatalogResourceToPage(events.resourceId)).toBe(false);
    expect(getEventsBindings()).toEqual([]);
  });

  test("adds nothing for a Resource the project does not have", async () => {
    setProject();
    const before = $dataSources.get();

    expect(await addCatalogResourceToPage("missing")).toBe(false);
    expect($dataSources.get()).toBe(before);
    expect(serverSyncStore.transactionManager.currentStack).toHaveLength(0);
  });

  test("adds nothing without build access", async () => {
    setProject();
    // a page template, the one place the runtime layer refuses a commit
    const pages = $pages.get()!;
    $pages.set({
      ...pages,
      pageTemplates: new Map([
        [
          "template",
          {
            id: "template",
            name: "Template",
            title: "Template",
            rootInstanceId: "bodyId",
            meta: {},
          },
        ],
      ]),
    });
    $selectedPageId.set("template");
    $authPermit.set("view");
    const before = $dataSources.get();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(await addCatalogResourceToPage(events.resourceId)).toBe(false);
    consoleError.mockRestore();
    expect($dataSources.get()).toBe(before);
    expect(serverSyncStore.transactionManager.currentStack).toHaveLength(0);
    // the runtime's refusal is what the admin sees
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "Page templates can be edited only in design mode, with build access."
    );
  });
});

describe("Upcoming Events in the Data section", () => {
  const getUpcomingBindings = () =>
    [...$dataSources.get().values()].filter(
      (dataSource) =>
        dataSource.type === "resource" &&
        dataSource.resourceId === upcoming.resourceId
    );

  test("is listed after Forms, before Products, when the project has it, and not when it lacks it", async () => {
    setProject();
    const keys = async () =>
      (await findCatalogResources(projectId, $resources.get().values())).map(
        (entry) => [entry.key, entry.resource.name]
      );

    expect(await keys()).toEqual([
      ["events", "Events"],
      ["fundraisers", "Fundraisers"],
      ["stats", "Stats"],
      ["forms", "OrganizeOS Forms"],
      ["upcoming-events", "Upcoming Events"],
      ["products", "Products"],
    ]);

    $resources.set(
      new Map(
        [...$resources.get()].filter(([id]) => id !== upcoming.resourceId)
      )
    );
    expect((await keys()).map(([key]) => key)).not.toContain("upcoming-events");
  });

  test('"Add to this page" names its binding Upcoming Events, scoped to the page root, once', async () => {
    setProject();

    expect(await addCatalogResourceToPage(upcoming.resourceId)).toBe(true);
    expect(getUpcomingBindings()).toEqual([
      {
        type: "resource",
        id: expect.any(String),
        scopeInstanceId: "bodyId",
        name: "Upcoming Events",
        resourceId: upcoming.resourceId,
      },
    ]);
    expect(
      isCatalogResourceOnPage({
        page: { rootInstanceId: "bodyId" },
        dataSources: $dataSources.get(),
        resourceId: upcoming.resourceId,
      })
    ).toBe(true);
    // Events is a Resource of its own: this page does not have it
    expect(getEventsBindings()).toEqual([]);

    expect(await addCatalogResourceToPage(upcoming.resourceId)).toBe(false);
    expect(getUpcomingBindings()).toHaveLength(1);
  });

  test("the builder loads the upcoming read for the page, and not Events, which another page reads", async () => {
    setProject();
    // another page reads Events, through a binding of its own
    const pages = $pages.get()!;
    $pages.set({
      ...pages,
      pages: new Map(pages.pages).set("other", {
        ...pages.pages.get(pages.homePageId)!,
        id: "other",
        name: "Other",
        path: "/other",
        rootInstanceId: "otherBody",
      }),
    });
    $instances.set(
      new Map($instances.get()).set("otherBody", {
        type: "instance",
        id: "otherBody",
        component: "Body",
        children: [],
      })
    );
    const otherBinding: DataSource = {
      type: "resource",
      id: "other-events",
      scopeInstanceId: "otherBody",
      name: "Events",
      resourceId: events.resourceId,
    };
    $dataSources.set(
      new Map($dataSources.get()).set(otherBinding.id, otherBinding)
    );
    $props.set(
      new Map($props.get()).set("other-reads-events", {
        id: "other-reads-events",
        instanceId: "otherBody",
        name: "title",
        type: "expression",
        value: `${encodeDataVariableId(otherBinding.id)}.data`,
      })
    );
    expect(await addCatalogResourceToPage(upcoming.resourceId)).toBe(true);
    const [binding] = getUpcomingBindings();
    useOnBox(binding);
    loaderFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const requests = JSON.parse(String(init.body)) as ResourceRequest[];
      return {
        ok: true,
        json: async () =>
          requests.map((request) => [
            getResourceKey(request),
            { ok: true, status: 200, statusText: "", data: { data: [] } },
          ]),
      };
    });
    vi.useFakeTimers();
    const unsubscribe = subscribeResources();
    await vi.advanceTimersByTimeAsync(1000);

    expect(loaderFetch).toHaveBeenCalledTimes(1);
    const requests = JSON.parse(
      loaderFetch.mock.calls[0][1].body
    ) as ResourceRequest[];
    expect(requests.map(({ name, url }) => [name, url])).toEqual([
      [
        "Upcoming Events",
        "https://staging.example.org/api/public/v1/events?upcoming=true",
      ],
    ]);

    // the other page, opened, loads its Events
    $selectedPageId.set("other");
    await vi.advanceTimersByTimeAsync(1000);
    unsubscribe();
    expect(loaderFetch).toHaveBeenCalledTimes(2);
    expect(
      (JSON.parse(loaderFetch.mock.calls[1][1].body) as ResourceRequest[]).map(
        ({ url }) => url
      )
    ).toEqual(["https://staging.example.org/api/public/v1/events"]);
  });
});

describe("isCatalogResourceOnPage", () => {
  const page = { rootInstanceId: "bodyId" };
  const binding = (scopeInstanceId?: string): DataSource => ({
    type: "resource",
    id: `binding-${scopeInstanceId}`,
    scopeInstanceId,
    name: "Events",
    resourceId: events.resourceId,
  });

  test.each([
    ["the page's root", binding("bodyId"), true],
    ["`:root`", binding(ROOT_INSTANCE_ID), true],
    ["a block on the page", binding("boxId"), false],
    ["nothing (an older provision's)", binding(undefined), false],
  ])("a binding scoped at %s: %s", (_case, dataSource, expected) => {
    expect(
      isCatalogResourceOnPage({
        page,
        dataSources: new Map([[dataSource.id, dataSource]]),
        resourceId: events.resourceId,
      })
    ).toBe(expected);
  });

  test("a binding of another Resource does not count", () => {
    const other = { ...binding("bodyId"), resourceId: "other" };
    expect(
      isCatalogResourceOnPage({
        page,
        dataSources: new Map([[other.id, other]]),
        resourceId: events.resourceId,
      })
    ).toBe(false);
  });
});
