import { afterEach, describe, expect, test, vi } from "vitest";
import { createDefaultPages } from "@webstudio-is/project-build";
import { findAvailableVariables } from "@webstudio-is/project-build/runtime";
import { showAttribute } from "@webstudio-is/react-sdk";
import {
  encodeDataSourceVariable,
  getPageResourceRootIds,
  type DataSource,
  type Instance,
  type Prop,
  type Resource,
} from "@webstudio-is/sdk";
import {
  $dataSources,
  $instances,
  $pages,
  $props,
  $resources,
} from "./sync/data-stores";
import { $selectedPageId } from "./nano-states/pages";
import {
  $computedResourceRequests,
  subscribeResourceRequestPlan,
} from "./nano-states/props";
import {
  __testing__,
  computeResourceRequest,
  computeResourceRequestPlan,
} from "./resources";
import { getResourcePresetIds } from "./organizeos-preset-ids";

// OrganizeOS fork (fork doc section 9, "Data loads only where it is used"):
// the catalog's `:root` bindings rest on 0.309.0 loading a Resource only where
// a page's expressions read it, and on `:root` being in every scope, Slot
// content included. These pin both, so an upstream merge that loads by scope
// again, or narrows `:root`'s reach, fails here.

const projectId = "project-reach";

afterEach(() => {
  __testing__.reset();
});

const resource = (id: string, name: string, path: string): Resource => ({
  id,
  name,
  method: "get",
  url: JSON.stringify(`https://app.example.org/api/public/v1/${path}`),
  headers: [{ name: "Authorization", value: `"Bearer osk_reach"` }],
});

const rootBinding = (id: string, name: string, resourceId: string) =>
  ({
    type: "resource",
    id,
    scopeInstanceId: ":root",
    name,
    resourceId,
  }) satisfies DataSource;

const setup = async () => {
  const events = await getResourcePresetIds(projectId, "events");
  const fundraisers = await getResourcePresetIds(projectId, "fundraisers");
  const resources = new Map<Resource["id"], Resource>([
    [events.resourceId, resource(events.resourceId, "Events", "events")],
    [
      fundraisers.resourceId,
      resource(fundraisers.resourceId, "Fundraisers", "fundraisers"),
    ],
  ]);
  const dataSources = new Map<DataSource["id"], DataSource>([
    ["events-root", rootBinding("events-root", "Events", events.resourceId)],
    [
      "fundraisers-root",
      rootBinding("fundraisers-root", "Fundraisers", fundraisers.resourceId),
    ],
  ]);
  const instances = new Map<Instance["id"], Instance>([
    [
      "body",
      {
        type: "instance",
        id: "body",
        component: "Body",
        children: [
          { type: "id", value: "text" },
          { type: "id", value: "slot" },
        ],
      },
    ],
    [
      "text",
      {
        type: "instance",
        id: "text",
        component: "Text",
        children: [
          {
            type: "expression",
            value: `${encodeDataSourceVariable("events-root")}.data`,
          },
        ],
      },
    ],
    [
      "slot",
      {
        type: "instance",
        id: "slot",
        component: "Slot",
        children: [{ type: "id", value: "fragment" }],
      },
    ],
    [
      "fragment",
      {
        type: "instance",
        id: "fragment",
        component: "Fragment",
        children: [{ type: "id", value: "footer-text" }],
      },
    ],
    [
      "footer-text",
      {
        type: "instance",
        id: "footer-text",
        component: "Text",
        children: [],
      },
    ],
  ]);
  return { events, fundraisers, resources, dataSources, instances };
};

const page = { rootInstanceId: "body", title: `"Home"`, meta: {} };

describe("OrganizeOS catalog: a page loads only what it uses", () => {
  test("only the catalog Resource an expression reads is a root", async () => {
    const { events, dataSources, instances } = await setup();
    const roots = getPageResourceRootIds({
      page,
      instances,
      props: new Map(),
      dataSources,
    });
    expect([...roots]).toEqual([events.resourceId]);
  });

  test("a page that reads nothing has no root", async () => {
    const { dataSources, instances } = await setup();
    const text = instances.get("text");
    if (text === undefined) {
      throw new Error("no text");
    }
    instances.set("text", { ...text, children: [] });
    const roots = getPageResourceRootIds({
      page,
      instances,
      props: new Map(),
      dataSources,
    });
    expect([...roots]).toEqual([]);
  });

  test("the plan requests the read Resource only, with its own url and headers", async () => {
    const { events, resources, dataSources, instances } = await setup();
    const plan = await computeResourceRequestPlan({
      rootResourceIds: getPageResourceRootIds({
        page,
        instances,
        props: new Map(),
        dataSources,
      }),
      resources,
      dataSources,
      values: new Map(),
      resourceCache: new Map(),
    });
    expect(plan.requests).toHaveLength(1);
    const [request] = plan.requests;
    const eventsResource = resources.get(events.resourceId);
    expect(request.url).toBe(JSON.parse(eventsResource?.url ?? ""));
    expect(request.headers).toEqual([
      { name: "Authorization", value: "Bearer osk_reach" },
    ]);
  });

  test("the canvas requests only what the page reads, and a statically hidden reader does not count", async () => {
    const { events, resources, dataSources, instances } = await setup();
    const pages = createDefaultPages({ rootInstanceId: "body" });
    $pages.set(pages);
    $selectedPageId.set(pages.homePageId);
    $instances.set(instances);
    $resources.set(resources);
    $dataSources.set(dataSources);
    $props.set(new Map());
    const eventsResource = resources.get(events.resourceId);
    if (eventsResource === undefined) {
      throw new Error("no events");
    }
    const expected = await computeResourceRequest(eventsResource, new Map());

    const unsubscribe = subscribeResourceRequestPlan(() => {});
    try {
      await vi.waitFor(() =>
        expect($computedResourceRequests.get()).toEqual([expected])
      );

      const hidden: Prop = {
        id: "hide-text",
        instanceId: "text",
        name: showAttribute,
        type: "boolean",
        value: false,
      };
      $props.set(new Map([[hidden.id, hidden]]));
      await vi.waitFor(() =>
        expect($computedResourceRequests.get()).toEqual([])
      );
    } finally {
      unsubscribe();
    }
  });

  test("content inside a Slot sees the :root binding, not a page-root one", async () => {
    const { events, dataSources, instances } = await setup();
    dataSources.set("events-page", {
      type: "resource",
      id: "events-page",
      scopeInstanceId: "body",
      name: "Events on this page",
      resourceId: events.resourceId,
    });
    const available = findAvailableVariables({
      startingInstanceId: "footer-text",
      instances,
      dataSources,
    }).map((variable) => variable.id);
    expect(available).toContain("events-root");
    expect(available).not.toContain("events-page");
  });
});
