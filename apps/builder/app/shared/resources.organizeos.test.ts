import { afterEach, describe, expect, test, vi } from "vitest";
import { createDefaultPages } from "@webstudio-is/project-build";
import {
  encodeDataSourceVariable,
  type Resource,
  type ResourceRequest,
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
  $resourcesCache,
  computeResourceRequest,
  getResourceKey,
  invalidateResource,
} from "./resources";

// OrganizeOS fork (fork doc section 9): the two exports the CMS panel and the
// record picker use.

afterEach(() => {
  __testing__.reset();
});

describe("invalidateResource", () => {
  const request: ResourceRequest = {
    name: "Blog posts",
    method: "get",
    url: "https://app.example.org/api/public/v1/collections/blog/items",
    searchParams: [],
    headers: [{ name: "Authorization", value: "Bearer osk_token" }],
  };
  const key = getResourceKey(request);
  const answer = (data: unknown) =>
    vi.fn<typeof globalThis.fetch>(async () =>
      Response.json([[key, { ok: true, status: 200, data }]])
    );

  test("drops the cached result, posts the request once and caches the new one", async () => {
    const firstFetch = answer({ data: ["first"] });
    __testing__.queueResources([request]);
    __testing__.startLoading(firstFetch);
    await vi.waitFor(() =>
      expect($resourcesCache.get().get(key)).toEqual({
        ok: true,
        status: 200,
        data: { data: ["first"] },
      })
    );

    let respond: (response: Response) => void = () => {};
    const reloadFetch = vi.fn<typeof globalThis.fetch>(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        })
    );
    invalidateResource(request, reloadFetch);

    // while the reload is pending, the old result is gone
    expect($resourcesCache.get().has(key)).toBe(false);
    expect(reloadFetch).toHaveBeenCalledTimes(1);
    const [url, init] = reloadFetch.mock.calls[0];
    expect(String(url)).toContain("/rest/resources-loader");
    expect(JSON.parse(String(init?.body))).toEqual([request]);

    respond(Response.json([[key, { ok: true, status: 200, data: "second" }]]));
    await vi.waitFor(() =>
      expect($resourcesCache.get().get(key)).toEqual({
        ok: true,
        status: 200,
        data: "second",
      })
    );
    expect(firstFetch).toHaveBeenCalledTimes(1);
    expect(reloadFetch).toHaveBeenCalledTimes(1);
  });
});

describe("$computedResourceRequests", () => {
  const resource: Resource = {
    id: "resource",
    name: "Blog posts",
    method: "get",
    url: `"https://app.example.org/api/public/v1/collections/blog/items"`,
    headers: [],
  };

  test("is the page's requests while the plan is subscribed, and none after", async () => {
    const pages = createDefaultPages({ rootInstanceId: "body" });
    $pages.set(pages);
    $selectedPageId.set(pages.homePageId);
    $instances.set(
      new Map([
        [
          "body",
          {
            type: "instance",
            id: "body",
            component: "Body",
            children: [{ type: "id", value: "box" }],
          },
        ],
        [
          "box",
          { type: "instance", id: "box", component: "Box", children: [] },
        ],
      ])
    );
    $resources.set(new Map([[resource.id, resource]]));
    $dataSources.set(
      new Map([
        [
          "binding",
          {
            type: "resource",
            id: "binding",
            scopeInstanceId: "body",
            name: "Blog posts",
            resourceId: resource.id,
          },
        ],
      ])
    );
    // 0.309.0 requests only what the page's expressions read
    $props.set(
      new Map([
        [
          "prop",
          {
            id: "prop",
            instanceId: "box",
            name: "title",
            type: "expression",
            value: `${encodeDataSourceVariable("binding")}.data`,
          },
        ],
      ])
    );
    const expected = await computeResourceRequest(resource, new Map());

    const unsubscribe = subscribeResourceRequestPlan(() => {});
    await vi.waitFor(() =>
      expect($computedResourceRequests.get()).toEqual([expected])
    );
    unsubscribe();

    expect($computedResourceRequests.get()).toEqual([]);
  });
});
