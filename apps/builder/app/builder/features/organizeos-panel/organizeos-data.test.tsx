import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { enableMapSet } from "immer";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import { $, renderData } from "@webstudio-is/template";
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
import { $resourcesCache, getResourceKey } from "~/shared/resources";
import { findAvailableVariables } from "~/shared/data-variables";
import { getResourcePresetIds } from "~/shared/organizeos-preset-ids";
import { buildOrgResourcePresets } from "~/shared/db/resource-presets.server";
import {
  addCatalogResourceToPage,
  isCatalogResourceOnPage,
} from "./organizeos-data";

const { loaderFetch } = vi.hoisted(() => ({
  // the builder's resources loader posts to /rest/resources-loader with this
  loaderFetch: vi.fn(),
}));
vi.mock("~/shared/fetch.client", () => ({ fetch: loaderFetch }));

enableMapSet();
registerContainers();

const projectId = "project-1";
const { resources: catalog } = await buildOrgResourcePresets({
  projectId,
  apiBaseUrl: "https://staging.example.org/api/public/v1",
  readToken: "osk_token",
});
const events = await getResourcePresetIds(projectId, "events");
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
  selectInstance(["boxId", "bodyId"]);
  $project.set({ id: projectId } as Project);
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

beforeEach(() => {
  loaderFetch.mockReset();
  $resourcesCache.set(new Map());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("addCatalogResourceToPage", () => {
  test("binds the Resource at the page's root, named like it, once", () => {
    setProject();

    expect(addCatalogResourceToPage(events.resourceId)).toBe(true);
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

    expect(addCatalogResourceToPage(events.resourceId)).toBe(false);
    expect(getEventsBindings()).toHaveLength(1);
  });

  test("takes the next free name when the page root already has one", () => {
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

    expect(addCatalogResourceToPage(events.resourceId)).toBe(true);
    expect(getEventsBindings()).toEqual([
      expect.objectContaining({ name: "Events 2", scopeInstanceId: "bodyId" }),
    ]);
    // the designer's own variable keeps its name
    expect($dataSources.get().get("own-events")?.name).toBe("Events");
  });

  test("takes the next free name when `:root` already has one, and `:root` keeps its expressions", () => {
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

    expect(addCatalogResourceToPage(events.resourceId)).toBe(true);
    expect(getEventsBindings()).toEqual([
      expect.objectContaining({ name: "Events 2", scopeInstanceId: "bodyId" }),
    ]);
    expect($dataSources.get().get("root-events")?.name).toBe("Events");
    expect($props.get().get(prop.id)).toEqual(prop);
  });

  test("a name used only inside a block is still free on the page root", () => {
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

    expect(addCatalogResourceToPage(events.resourceId)).toBe(true);
    expect(getEventsBindings()).toEqual([
      expect.objectContaining({ name: "Events", scopeInstanceId: "bodyId" }),
    ]);
  });

  test("the data panel lists it on the page's elements, and the builder loads it", async () => {
    setProject();
    expect(addCatalogResourceToPage(events.resourceId)).toBe(true);
    const [binding] = getEventsBindings();

    expect(
      findAvailableVariables({
        startingInstanceId: "boxId",
        instances: $instances.get(),
        dataSources: $dataSources.get(),
      })
    ).toContainEqual(binding);

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
    unsubscribe();

    // Events alone: nothing else in the catalog is used on the page
    expect(loaderFetch).toHaveBeenCalledTimes(1);
    expect(
      (JSON.parse(loaderFetch.mock.calls[0][1].body) as ResourceRequest[]).map(
        (request) => request.url
      )
    ).toEqual(["https://staging.example.org/api/public/v1/events"]);
    expect(
      $variableValuesByInstanceSelector
        .get()
        .get(getInstanceKey(["boxId", "bodyId", ROOT_INSTANCE_ID]))
        ?.get(binding.id)
    ).toEqual(eventsResult);
  });

  test("adds nothing where the org is not on the blocks' allowlist", () => {
    setProject({ blocksEnabled: false });

    expect(addCatalogResourceToPage(events.resourceId)).toBe(false);
    expect(getEventsBindings()).toEqual([]);
  });

  test("adds nothing for a Resource the project does not have", () => {
    setProject();
    const before = $dataSources.get();

    expect(addCatalogResourceToPage("missing")).toBe(false);
    expect($dataSources.get()).toBe(before);
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
