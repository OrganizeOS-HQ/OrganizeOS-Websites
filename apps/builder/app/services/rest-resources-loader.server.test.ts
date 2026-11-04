import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ResourceRequest } from "@webstudio-is/sdk";
import { getResourceKey } from "~/shared/resource-utils";

// OrganizeOS fork: the loader's marked change, end to end. The preview's own
// conditions are covered by shared/organizeos-preview.server.test.ts; here
// they all hold, and the test checks what reaches the SSRF-guarded fetch and
// what the client is keyed by.

const { createContext, hasProjectPermit, safeResourceFetch } = vi.hoisted(
  () => ({
    createContext: vi.fn(),
    hasProjectPermit: vi.fn(),
    safeResourceFetch: vi.fn(),
  })
);

vi.mock("~/shared/context.server", () => ({ createContext }));
vi.mock("@webstudio-is/trpc-interface/index.server", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@webstudio-is/trpc-interface/index.server")
    >();
  return {
    ...actual,
    authorizeProject: { ...actual.authorizeProject, hasProjectPermit },
  };
});
vi.mock("~/services/safe-resource-fetch.server", () => ({
  safeResourceFetch,
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

const projectId = "11111111-1111-4111-8111-111111111111";

const globalFetch = vi.fn(async () => {
  throw new Error("The resources loader must not use the global fetch");
});

beforeEach(() => {
  vi.clearAllMocks();
  createContext.mockResolvedValue({
    authorization: { type: "user", userId: "user-1" },
  });
  hasProjectPermit.mockResolvedValue(true);
  safeResourceFetch.mockImplementation(async () =>
    Response.json({ items: [] })
  );
  vi.stubGlobal("fetch", globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const call = async (requests: ResourceRequest[], search = "") => {
  const response = (await action({
    request: new Request(
      `https://p-${projectId}.builder.organizeos.org/rest/resources-loader${search}`,
      { method: "POST", body: JSON.stringify(requests) }
    ),
    params: {},
    context: {},
  })) as Response;
  return await response.json();
};

const sentHeaders = () =>
  new Map(
    safeResourceFetch.mock.calls.map((args) => {
      const [url, init] = args as [string, RequestInit];
      return [url, { init, headers: new Headers(init.headers) }];
    })
  );

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

  test("a canvas fetch to the app origin carries X-OOS-Preview and goes through safeResourceFetch", async () => {
    const output = (await call([collections, events])) as Array<
      [string, unknown]
    >;

    // keyed as the client keys it, before the assertion was added
    expect(output.map(([key]) => key)).toEqual([
      getResourceKey(collections),
      getResourceKey(events),
    ]);
    expect(globalFetch).not.toHaveBeenCalled();
    expect(safeResourceFetch).toHaveBeenCalledTimes(2);

    const sent = sentHeaders();
    const previewed = sent.get(collections.url)!;
    const header = previewed.headers.get("X-OOS-Preview")!;
    // one minted assertion, replacing the stored value
    expect(header).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(header).not.toContain("stored");
    expect(previewed.headers.get("authorization")).toBe("Bearer osk_token");
    // a redirect must not carry the assertion anywhere else
    expect(previewed.init.redirect).toBe("manual");

    const other = sent.get(events.url)!;
    expect(other.headers.get("X-OOS-Preview")).toBeNull();
    expect(other.init.redirect).toBeUndefined();
  });

  test("the inspect response never echoes X-OOS-Preview", async () => {
    const inspected: ResourceRequest = {
      ...collections,
      headers: [{ name: "Authorization", value: "Bearer osk_token" }],
    };
    const output = (await call(
      [inspected],
      `?inspect=${encodeURIComponent(getResourceKey(inspected))}`
    )) as { resources: Array<[string, unknown]>; inspection?: unknown };

    // the assertion was minted and sent
    const header = sentHeaders()
      .get(inspected.url)!
      .headers.get("X-OOS-Preview")!;
    expect(header).toMatch(/^v1\./);
    // and the inspection describes the request without it
    expect(output.inspection).toBeDefined();
    const echoed = JSON.stringify(output);
    expect(echoed).not.toMatch(/x-oos-preview/i);
    expect(echoed).not.toContain(header);
    expect(echoed).not.toContain(header.split(".")[2]);
  });

  test("refuses an anonymous request before any fetch", async () => {
    createContext.mockResolvedValue({ authorization: { type: "anonymous" } });
    const thrown = await call([collections]).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(401);
    expect(safeResourceFetch).not.toHaveBeenCalled();
  });
});
