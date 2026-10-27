import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import fixture from "~/shared/__fixtures__/site-addresses.json";

// OrganizeOS fork: the Publish dialog's read of the site's addresses and
// launch state. Its answer is validated in
// shared/db/organizeos-site-addresses.server.test.ts; here the route decides
// who may read it, and for which org.

const state = vi.hoisted(() => ({
  authorization: { type: "user" } as { type: string },
  permitted: true,
  owner: null as null | { provider: string | null; email: string | null },
  rpc: undefined as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock("~/services/csrf-session.server", () => ({
  checkCsrf: async () => {},
}));

vi.mock("~/shared/context.server", () => {
  // The project and its owner, as the builder's typed client reads them
  const row = (table: string) =>
    table === "Project"
      ? { userId: "owner-1" }
      : table === "User"
        ? state.owner
        : null;
  const query = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: row(table), error: null }),
    };
    return chain;
  };
  return {
    createContext: async () =>
      ({
        authorization: state.authorization,
        postgrest: { client: { from: query } },
      }) as unknown as AppContext,
  };
});

vi.mock("@webstudio-is/trpc-interface/index.server", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@webstudio-is/trpc-interface/index.server")
    >();
  return {
    ...actual,
    authorizeProject: {
      ...actual.authorizeProject,
      hasProjectPermit: async () => state.permitted,
    },
  };
});

vi.mock("@webstudio-is/postgrest/index.server", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@webstudio-is/postgrest/index.server")
  >()),
  createClient: () => ({
    rpc: (...args: unknown[]) => state.rpc(...args),
  }),
}));

const { loader } = await import("../routes/rest.organizeos-site.$projectId");

const projectId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const orgOwner = {
  provider: "organizeos-service",
  email: `org+${organizationId}@svc.organizeos.internal`,
};

const call = async ({
  destination = "empty",
  search = "",
}: { destination?: string; search?: string } = {}) => {
  const request = new Request(
    `https://p-${projectId}.builder.organizeos.org/rest/organizeos-site/${projectId}${search}`,
    {
      headers: {
        "sec-fetch-site": "same-origin",
        "sec-fetch-dest": destination,
      },
    }
  );
  return (await loader({
    request,
    params: { projectId },
    context: {},
  })) as Response;
};

beforeEach(() => {
  state.authorization = { type: "user" };
  state.permitted = true;
  state.owner = orgOwner;
  state.rpc = vi.fn(async () => ({ data: fixture, error: null }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rest.organizeos-site", () => {
  test("answers the org's addresses and launch state to a signed-in user who may view the project", async () => {
    const response = await call();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      host: "votelabor.org",
      origin: "https://votelabor.org",
      status: "not_launched",
      manageDomainsUrl: "https://app.organizeos.org/laborparty/settings/domain",
      websiteUrl: "https://app.organizeos.org/laborparty/website",
    });
  });

  test("is refused without a session", async () => {
    state.authorization = { type: "anonymous" };
    const response = await call();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  test("is refused to a share link's token with 403, and reads nothing", async () => {
    state.authorization = { type: "token" };
    const response = await call();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  test("is refused to a user who may not view the project", async () => {
    state.permitted = false;
    const response = await call();
    expect(response.status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  test("answers { ok: false } with no RPC call for a project a human owns", async () => {
    // even one whose email has the service account's shape
    for (const email of ["someone@example.org", orgOwner.email]) {
      state.owner = { provider: "github", email };
      const response = await call();
      expect(await response.json(), email).toEqual({ ok: false });
    }
    expect(state.rpc).not.toHaveBeenCalled();
  });

  test("answers { ok: false } with no RPC call when the owner's org id is not a UUID", async () => {
    for (const email of [
      "org+hq@svc.organizeos.internal",
      `org+${organizationId}x@svc.organizeos.internal`,
      "org+,@svc.organizeos.internal",
    ]) {
      state.owner = { provider: "organizeos-service", email };
      const response = await call();
      expect(await response.json(), email).toEqual({ ok: false });
    }
    expect(state.rpc).not.toHaveBeenCalled();
  });

  test("reads the org from the owner's email, whatever the query says", async () => {
    await call({
      search:
        "?p_org=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&organizationId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.rpc).toHaveBeenCalledWith("websites2_site_addresses", {
      p_org: organizationId,
    });
  });

  test("answers { ok: false } when the read fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.rpc = vi.fn(async () => ({ data: null, error: { message: "x" } }));
    expect(await (await call()).json()).toEqual({ ok: false });
    state.rpc = vi.fn(async () => ({ data: [], error: null }));
    expect(await (await call()).json()).toEqual({ ok: false });
  });

  test("is never stored", async () => {
    for (const response of [
      await call(),
      await (async () => {
        state.authorization = { type: "token" };
        return call();
      })(),
    ]) {
      const cacheControl = response.headers.get("Cache-Control") ?? "";
      expect(cacheControl).toContain("private");
      expect(cacheControl).toContain("no-store");
    }
  });

  test("refuses a document or iframe load: it is a fetch only", async () => {
    for (const destination of ["document", "iframe"]) {
      const refused = await call({ destination }).then(
        () => undefined,
        (thrown: unknown) => thrown
      );
      expect(refused, destination).toBeInstanceOf(Response);
      expect((refused as Response).status, destination).toBe(403);
    }
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
