import { afterEach, describe, expect, test, vi } from "vitest";
import type { ResourceRequest } from "@webstudio-is/sdk";
import { getResourceKey } from "~/shared/resource-utils";

// OrganizeOS fork: the loader's marked change, end to end. The preview's own
// conditions are covered by shared/organizeos-preview.server.test.ts; here
// they all hold, and the test checks what reaches fetch and what the client
// is keyed by.

// shared/resources.ts re-exports the key from resource-utils.ts; the rest of
// it is browser code.
vi.mock("~/shared/resources", async () => ({
  getResourceKey: (await import("~/shared/resource-utils")).getResourceKey,
}));
vi.mock("~/services/no-cross-origin-cookie", () => ({
  preventCrossOriginCookie: () => {},
}));
vi.mock("~/services/csrf-session.server", () => ({
  checkCsrf: async () => {},
}));
vi.mock("~/shared/organizeos-preview.server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/shared/organizeos-preview.server")>();
  return {
    ...actual,
    createPreviewAssertion: (request: Request) =>
      actual.createPreviewAssertion(request, {
        secret: "test-secret",
        appUrl: "https://app.organizeos.org",
        now: () => 1_793_016_000_000,
        readSession: async () => ({
          userId: "user-1",
          createdAt: 0,
          organizeosSid: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          organizeosUserId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        }),
        isSessionLive: async () => true,
        canViewProject: async () => true,
        loadProjectOwner: async () => ({
          provider: "organizeos-service",
          email:
            "org+aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa@svc.organizeos.internal",
        }),
      }),
  };
});

const { action } = await import("../routes/rest.resources-loader");

afterEach(() => {
  vi.unstubAllGlobals();
});

const projectId = "11111111-1111-4111-8111-111111111111";

const call = async (requests: ResourceRequest[]) => {
  const response = (await action({
    request: new Request(
      `https://p-${projectId}.builder.organizeos.org/rest/resources-loader`,
      { method: "POST", body: JSON.stringify(requests) }
    ),
    params: {},
    context: {},
  })) as Response;
  return (await response.json()) as Array<[string, unknown]>;
};

describe("rest.resources-loader with the draft preview", () => {
  const collections: ResourceRequest = {
    name: "News",
    method: "get",
    url: "https://app.organizeos.org/api/public/v1/collections/news/items",
    searchParams: [],
    headers: [
      { name: "Authorization", value: "Bearer osk_token" },
      { name: "x-oos-preview", value: "v1.stored.value" },
    ],
  };
  const events: ResourceRequest = {
    name: "Events",
    method: "get",
    url: "https://app.organizeos.org/api/public/v1/events",
    searchParams: [],
    headers: [{ name: "Authorization", value: "Bearer osk_token" }],
  };

  test("replaces the stored header with one minted assertion, and keys the result as the client does", async () => {
    const fetch = vi.fn(async () => Response.json({ items: [] }));
    vi.stubGlobal("fetch", fetch);

    const output = await call([collections, events]);

    expect(output.map(([key]) => key)).toEqual([
      getResourceKey(collections),
      getResourceKey(events),
    ]);

    const byUrl = new Map(
      fetch.mock.calls.map((args) => {
        const [url, init] = args as unknown as [string, RequestInit];
        return [url, new Headers(init.headers)];
      })
    );
    const previewed = byUrl.get(collections.url)!;
    const header = previewed.get("X-OOS-Preview")!;
    expect(header).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(header).not.toContain("stored");
    expect(previewed.get("authorization")).toBe("Bearer osk_token");

    const other = byUrl.get(events.url)!;
    expect(other.get("X-OOS-Preview")).toBeNull();
  });
});
