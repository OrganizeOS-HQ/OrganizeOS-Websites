import { describe, expect, test, vi } from "vitest";
import {
  createOrganizeosPublisher,
  createOrganizeosPublisherClient,
  parseOrganizationIdFromServiceEmail,
  resolveOrganizationIdForBuild,
} from "./organizeos-publisher.server";

type StatusUpdate = { table: string; values: unknown; buildId: string };

/**
 * A minimal client: `rows` answers the build -> project -> owner lookups, and
 * every publishStatus update is recorded in `statusUpdates`. With
 * `failUpdates` the status write reports a store error instead.
 */
const makeClient = (
  rows: Record<string, Record<string, unknown> | null>,
  statusUpdates: Array<StatusUpdate> = [],
  { failUpdates = false }: { failUpdates?: boolean } = {}
) => ({
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: rows[table] ?? null,
          error: rows[table] === null ? { message: "not found" } : null,
        }),
      }),
    }),
    update: (values: unknown) => ({
      eq: (_column: string, buildId: string) => ({
        not: () => ({
          select: async (): Promise<{
            data: Array<{ id: string }> | null;
            error: unknown;
          }> => {
            if (failUpdates) {
              return { data: null, error: { message: "down" } };
            }
            statusUpdates.push({ table, values, buildId });
            return { data: [{ id: buildId }], error: null };
          },
        }),
      }),
    }),
  }),
});

const ORG_ID = "f0e1d2c3-b4a5-4697-8877-665544332211";
const HAPPY_ROWS = {
  Build: { projectId: "proj-1" },
  Project: { userId: "svc-user-1" },
  User: { email: `org+${ORG_ID}@svc.organizeos.internal` },
};

describe("parseOrganizationIdFromServiceEmail", () => {
  test("extracts the org id from a synthetic owner email", () => {
    expect(
      parseOrganizationIdFromServiceEmail(
        `org+${ORG_ID}@svc.organizeos.internal`
      )
    ).toBe(ORG_ID);
  });

  test("returns null for human emails", () => {
    expect(parseOrganizationIdFromServiceEmail("admin@example.org")).toBeNull();
    expect(
      parseOrganizationIdFromServiceEmail("org+x@svc.other.internal")
    ).toBeNull();
  });
});

describe("resolveOrganizationIdForBuild", () => {
  test("resolves build -> project -> service owner -> org id", async () => {
    expect(
      await resolveOrganizationIdForBuild(makeClient(HAPPY_ROWS), "build-1")
    ).toBe(ORG_ID);
  });

  test("returns null when the owner is a human account", async () => {
    const client = makeClient({
      ...HAPPY_ROWS,
      User: { email: "human@example.org" },
    });
    expect(await resolveOrganizationIdForBuild(client, "build-1")).toBeNull();
  });

  test("returns null when any hop is missing", async () => {
    const client = makeClient({ ...HAPPY_ROWS, Project: null });
    expect(await resolveOrganizationIdForBuild(client, "build-1")).toBeNull();
  });
});

describe("createOrganizeosPublisher", () => {
  const deps = {
    client: makeClient(HAPPY_ROWS),
    repo: "OrganizeOS-HQ/OrganizeOS-Websites",
    githubToken: "gh-token",
  };

  test("dispatches the workflow with build + org inputs", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    const publisher = createOrganizeosPublisher({ ...deps, fetcher });

    const result = await (
      publisher.publish.mutate as (input: {
        buildId: string;
      }) => Promise<{ success: boolean }>
    )({ buildId: "build-1" });

    expect(result).toEqual({ success: true });
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://api.github.com/repos/OrganizeOS-HQ/OrganizeOS-Websites/actions/workflows/publish-site.yml/dispatches"
    );
    expect(JSON.parse(init.body as string)).toEqual({
      ref: "main",
      inputs: { build_id: "build-1", organization_id: ORG_ID },
    });
  });

  test("without targets the dispatch body is byte for byte what it was", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    const publisher = createOrganizeosPublisherClient({ ...deps, fetcher });

    await publisher.publish.mutate({ buildId: "build-1", destination: "saas" });

    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBe(
      `{"ref":"main","inputs":{"build_id":"build-1","organization_id":"${ORG_ID}"}}`
    );
  });

  test("with targets the dispatch adds them as one JSON input", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    const publisher = createOrganizeosPublisherClient({ ...deps, fetcher });

    const result = await publisher.publish.mutate({
      buildId: "build-1",
      destination: "saas",
      targets: ["builtin", "www.example.org"],
      expectedOrganizationId: ORG_ID,
    });

    expect(result).toEqual({ success: true });
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      ref: "main",
      inputs: {
        build_id: "build-1",
        organization_id: ORG_ID,
        targets: '["builtin","www.example.org"]',
      },
    });
  });

  test("a build whose project resolves to another org than the caller's is marked FAILED and never dispatched", async () => {
    const statusUpdates: Array<StatusUpdate> = [];
    const fetcher = vi.fn();
    const publisher = createOrganizeosPublisherClient({
      ...deps,
      client: makeClient(HAPPY_ROWS, statusUpdates),
      fetcher,
    });

    const result = await publisher.publish.mutate({
      buildId: "build-1",
      targets: ["builtin"],
      expectedOrganizationId: "00000000-0000-4000-8000-000000000000",
    });

    expect(result).toEqual({
      success: false,
      error: "This project cannot be published.",
      organizationMismatch: true,
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(statusUpdates.map((update) => update.values)).toEqual([
      { publishStatus: "FAILED" },
    ]);
  });

  test("a 422 for an input the workflow does not declare is a setup failure and marks the build FAILED", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const statusUpdates: Array<StatusUpdate> = [];
    const publisher = createOrganizeosPublisherClient({
      ...deps,
      client: makeClient(HAPPY_ROWS, statusUpdates),
      fetcher: vi.fn(
        async () =>
          new Response('{"message":"Unexpected inputs provided"}', {
            status: 422,
          })
      ),
    });

    const result = await publisher.publish.mutate({
      buildId: "build-1",
      targets: ["builtin"],
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error).toMatch(/not set up/i);
    expect(statusUpdates.map((update) => update.values)).toEqual([
      { publishStatus: "FAILED" },
    ]);
  });

  test("leaves the build pending while the executor runs", async () => {
    const statusUpdates: Array<StatusUpdate> = [];
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    const publisher = createOrganizeosPublisher({
      ...deps,
      client: makeClient(HAPPY_ROWS, statusUpdates),
      fetcher,
    });

    await (
      publisher.publish.mutate as (input: {
        buildId: string;
      }) => Promise<{ success: boolean }>
    )({ buildId: "build-1" });

    // The workflow reports PUBLISHED/FAILED itself once it knows.
    expect(statusUpdates).toEqual([]);
  });

  test("fails with generic copy for a non-service-owned project", async () => {
    const statusUpdates: Array<StatusUpdate> = [];
    const fetcher = vi.fn();
    const publisher = createOrganizeosPublisher({
      ...deps,
      client: makeClient(
        { ...HAPPY_ROWS, User: { email: "me@example.org" } },
        statusUpdates
      ),
      fetcher,
    });
    const result = await (
      publisher.publish.mutate as (input: {
        buildId: string;
      }) => Promise<{ success: boolean; error?: string }>
    )({ buildId: "build-1" });

    expect(result.success).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    // Nothing will ever report on this build, so it is failed right away.
    expect(statusUpdates).toEqual([
      {
        table: "Build",
        values: { publishStatus: "FAILED" },
        buildId: "build-1",
      },
    ]);
  });

  /** Run a publish against a fetcher, returning the result and status writes. */
  const publishWith = async (fetcher: typeof fetch) => {
    const statusUpdates: Array<StatusUpdate> = [];
    const publisher = createOrganizeosPublisher({
      ...deps,
      client: makeClient(HAPPY_ROWS, statusUpdates),
      fetcher,
    });
    const result = await (
      publisher.publish.mutate as (input: {
        buildId: string;
      }) => Promise<{ success: boolean; error?: string }>
    )({ buildId: "build-1" });
    return { result, statusUpdates };
  };

  test("fails with generic copy when the dispatch is rejected", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result, statusUpdates } = await publishWith(
      vi.fn(async () => new Response("nope", { status: 401 }))
    );

    expect(result.success).toBe(false);
    // Never leak provider/status detail into user-facing copy.
    expect(JSON.stringify(result)).not.toMatch(/github|401/i);
    expect(statusUpdates.map((update) => update.values)).toEqual([
      { publishStatus: "FAILED" },
    ]);
  });

  // A dispatch GitHub refuses on credentials, a missing repo/workflow or an
  // unacceptable payload refuses the next click identically: "try again" would
  // send the admin round a loop that cannot end.
  test.each([401, 403, 404, 422])(
    "tells the admin a %i is a setup problem, not something to retry",
    async (status) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { result } = await publishWith(
        vi.fn(async () => new Response("nope", { status }))
      );

      expect(result.error).toMatch(/not set up/i);
      expect(result.error).not.toMatch(/try again/i);
    }
  );

  test.each([500, 502, 429])("asks to retry after a %i", async (status) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = await publishWith(
      vi.fn(async () => new Response("nope", { status }))
    );

    expect(result.error).toMatch(/try again/i);
  });

  test("fails the build when the dispatch request never completes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result, statusUpdates } = await publishWith(
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/try again/i);
    // Without this the build sits PENDING until the dialog gives up on it.
    expect(statusUpdates.map((update) => update.values)).toEqual([
      { publishStatus: "FAILED" },
    ]);
  });

  test("refuses a static export build instead of deploying it as the live site", async () => {
    const statusUpdates: Array<StatusUpdate> = [];
    const fetcher = vi.fn();
    const publisher = createOrganizeosPublisher({
      ...deps,
      client: makeClient(HAPPY_ROWS, statusUpdates),
      fetcher,
    });
    const result = await (
      publisher.publish.mutate as (input: {
        buildId: string;
        destination: "static";
      }) => Promise<{ success: boolean; error?: string }>
    )({ buildId: "static-build", destination: "static" });

    expect(result.success).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(statusUpdates.map((update) => update.values)).toEqual([
      { publishStatus: "FAILED" },
    ]);
  });

  test("still reports the dispatch failure when marking the build fails too", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = makeClient(HAPPY_ROWS, [], { failUpdates: true });
    const fetcher = vi.fn(async () => new Response("nope", { status: 500 }));
    const publisher = createOrganizeosPublisher({ ...deps, client, fetcher });

    const result = await (
      publisher.publish.mutate as (input: {
        buildId: string;
      }) => Promise<{ success: boolean; error?: string }>
    )({ buildId: "build-1" });

    expect(result.success).toBe(false);
  });
});

describe("getOrganizeosPublisher", () => {
  const load = async (repo: string | undefined, token: string | undefined) => {
    vi.resetModules();
    vi.doMock("~/env/env.server", () => ({
      default: {
        POSTGREST_URL: "http://test-postgrest",
        POSTGREST_API_KEY: "",
        ORGANIZEOS_PUBLISH_REPO: repo,
        ORGANIZEOS_PUBLISH_GITHUB_TOKEN: token,
      },
    }));
    const module = await import("./organizeos-publisher.server");
    vi.doUnmock("~/env/env.server");
    return module.getOrganizeosPublisher;
  };

  test("is one instance, built when the repo and its token are both set", async () => {
    const get = await load("OrganizeOS-HQ/OrganizeOS-Websites", "gh-token");
    const publisher = get();
    expect(publisher).toBeDefined();
    expect(typeof publisher?.publish.mutate).toBe("function");
    expect(get()).toBe(publisher);
  });

  test("is undefined without the repo or its token", async () => {
    for (const [repo, token] of [
      [undefined, undefined],
      ["OrganizeOS-HQ/OrganizeOS-Websites", undefined],
      [undefined, "gh-token"],
      ["", "gh-token"],
    ]) {
      const get = await load(repo, token);
      expect(get(), `${repo} ${token}`).toBeUndefined();
    }
  });
});
