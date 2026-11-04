import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const env = vi.hoisted(() => ({
  TRPC_SERVER_API_TOKEN: undefined as string | undefined,
  POSTGREST_URL: "http://test-postgrest",
  POSTGREST_API_KEY: "",
  PUBLISHER_HOST: "wstd.work",
  // OrganizeOS: the session binding and the publish seam.
  ORGANIZEOS_SSO_PUBLIC_KEY: undefined as string | undefined,
  ORGANIZEOS_SESSION_BINDING: "observe" as "observe" | "enforce",
  ORGANIZEOS_PUBLISH_REPO: undefined as string | undefined,
  ORGANIZEOS_PUBLISH_GITHUB_TOKEN: undefined as string | undefined,
}));

const authenticator = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
}));
const builderAuthenticator = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
}));
const isBuilder = vi.hoisted(() => vi.fn(() => false));
const isCanvas = vi.hoisted(() => vi.fn(() => false));
const trpcSharedClient = vi.hoisted(() => ({
  domain: {},
  deployment: { upstream: true },
}));
const createOrganizeosPublisher = vi.hoisted(() =>
  vi.fn(() => ({ organizeos: true }))
);

vi.mock("~/env/env.server", () => ({
  default: env,
}));

vi.mock("~/env/env.static.server", () => ({
  staticEnv: {},
}));

vi.mock("~/services/auth.server", () => ({
  authenticator,
}));

vi.mock("~/services/builder-auth.server", () => ({
  builderAuthenticator,
}));

vi.mock("~/services/trpc.server", () => ({
  trpcSharedClient,
}));

vi.mock("~/services/organizeos-publisher.server", () => ({
  createOrganizeosPublisher,
}));

vi.mock("~/shared/entri/entri-api.server", () => ({
  entryApi: {},
}));

vi.mock("@webstudio-is/plans", () => ({
  defaultPlanFeatures: {},
}));

vi.mock("@webstudio-is/plans/index.server", () => ({
  getAuthorizationOwnerId: vi.fn(),
  getPlanInfo: vi.fn(),
}));

vi.mock("~/services/session.server", () => ({
  readLoginSessionBloomFilter: vi.fn(),
}));

vi.mock("./router-utils", () => ({
  isBuilder,
  isCanvas,
}));

import { createTestServer, db, json } from "@webstudio-is/postgrest/testing";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { procedure, router } from "@webstudio-is/trpc-interface/index.server";
import { createContext, extractAuthFromRequest } from "./context.server";
import { resetOrganizeosBindingCache } from "~/services/auth-strategy/organizeos-session.server";

const server = createTestServer();

beforeEach(() => {
  vi.clearAllMocks();
  env.TRPC_SERVER_API_TOKEN = undefined;
  env.ORGANIZEOS_SSO_PUBLIC_KEY = undefined;
  env.ORGANIZEOS_SESSION_BINDING = "observe";
  env.ORGANIZEOS_PUBLISH_REPO = undefined;
  env.ORGANIZEOS_PUBLISH_GITHUB_TOKEN = undefined;
  authenticator.isAuthenticated.mockResolvedValue(null);
  builderAuthenticator.isAuthenticated.mockResolvedValue(null);
  isBuilder.mockReturnValue(false);
  isCanvas.mockReturnValue(false);
  resetOrganizeosBindingCache();
});

describe("extractAuthFromRequest", () => {
  test("does not treat an empty service token as service authorization", async () => {
    env.TRPC_SERVER_API_TOKEN = "";
    const request = new Request("https://webstudio.is/trpc", {
      headers: { Authorization: "" },
    });

    const auth = await extractAuthFromRequest(request);

    expect(auth.isServiceCall).toBe(false);
  });

  test("accepts a matching non-empty service token", async () => {
    env.TRPC_SERVER_API_TOKEN = "service-token";
    const request = new Request("https://webstudio.is/trpc", {
      headers: { Authorization: "service-token" },
    });

    const auth = await extractAuthFromRequest(request);

    expect(auth.isServiceCall).toBe(true);
    expect(authenticator.isAuthenticated).not.toHaveBeenCalled();
  });

  test("prefers an explicit token without reading the cookie session", async () => {
    const request = new Request("https://webstudio.is/trpc", {
      headers: { "x-auth-token": "project-token" },
    });

    const auth = await extractAuthFromRequest(request);

    expect(auth.authToken).toBe("project-token");
    expect(auth.sessionData).toBeUndefined();
    expect(authenticator.isAuthenticated).not.toHaveBeenCalled();
  });

  test("reads the cookie session when no explicit credential is available", async () => {
    const sessionData = { userId: "user-1", createdAt: 1 };
    authenticator.isAuthenticated.mockResolvedValue(sessionData);

    const auth = await extractAuthFromRequest(
      new Request("https://webstudio.is/trpc")
    );

    expect(auth.authToken).toBeUndefined();
    expect(auth.sessionData).toBe(sessionData);
  });
});

describe("invalid token authorization", () => {
  const appRouter = router({ check: procedure.query(() => "authorized") });
  const request = () =>
    fetchRequestHandler({
      endpoint: "/trpc",
      req: new Request("http://localhost/trpc/check", {
        headers: { "x-auth-token": "private-token" },
      }),
      router: appRouter,
      createContext: ({ req }) => createContext(req),
    });

  test.each([
    { scenario: "revoked token", rows: [] },
    { scenario: "unavailable project", rows: [{ project: null }] },
    {
      scenario: "project without an owner",
      rows: [{ project: { userId: null } }],
    },
  ])("returns a structured 401 for $scenario", async ({ rows }) => {
    server.use(db.get("AuthorizationToken", () => json(rows)));
    const response = await request();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({
      error: {
        data: { code: "UNAUTHORIZED", webstudioCode: "INVALID_AUTH_TOKEN" },
      },
    });
    expect(JSON.stringify(body)).not.toContain("private-token");
  });

  test("reports a database outage as a server failure rather than invalid credentials", async () => {
    server.use(
      db.get("AuthorizationToken", () =>
        json(
          { code: "08006", message: "Database unavailable" },
          { status: 503 }
        )
      )
    );
    const response = await request();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({
      error: { data: { code: "INTERNAL_SERVER_ERROR" } },
    });
    expect(body).not.toMatchObject({
      error: { data: { webstudioCode: "INVALID_AUTH_TOKEN" } },
    });
    expect(JSON.stringify(body)).not.toContain("private-token");
  });
});

// OrganizeOS fork: every session read goes through the binding readers
// (services/auth-strategy/organizeos-session.server.ts), which ask the
// platform whether the OrganizeOS session that opened it is still live.
describe("OrganizeOS session binding", () => {
  const boundSession = {
    userId: "builder-user",
    createdAt: 1,
    organizeosSid: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    organizeosUserId: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  };

  const answerLiveness = (live: boolean) => {
    const bodies: unknown[] = [];
    server.use(
      db.post("rpc/websites2_sso_session_live", async ({ request }) => {
        bodies.push(await request.json());
        return json(live);
      })
    );
    return bodies;
  };

  const signIn = () => {
    env.ORGANIZEOS_SSO_PUBLIC_KEY = "pem";
    authenticator.isAuthenticated.mockResolvedValue(boundSession);
    builderAuthenticator.isAuthenticated.mockResolvedValue(boundSession);
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe.each([
    ["dashboard", false],
    ["builder", true],
  ])("on the %s host", (_host, builder) => {
    test("a bound session whose OrganizeOS session is dead reads as signed out under enforce", async () => {
      signIn();
      env.ORGANIZEOS_SESSION_BINDING = "enforce";
      isBuilder.mockReturnValue(builder);
      const bodies = answerLiveness(false);
      vi.spyOn(console, "warn").mockImplementation(() => {});

      const context = await createContext(
        new Request("https://webstudio.is/trpc")
      );

      expect(context.authorization).toEqual({ type: "anonymous" });
      expect(bodies).toEqual([
        {
          p_session_id: boundSession.organizeosSid,
          p_user_id: boundSession.organizeosUserId,
        },
      ]);
      expect(
        builder
          ? builderAuthenticator.isAuthenticated
          : authenticator.isAuthenticated
      ).toHaveBeenCalledTimes(1);
    });
  });

  test("a bound session whose OrganizeOS session is dead is allowed and logged under observe", async () => {
    signIn();
    const bodies = answerLiveness(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const context = await createContext(
      new Request("https://webstudio.is/trpc")
    );

    expect(context.authorization).toMatchObject({
      type: "user",
      userId: boundSession.userId,
    });
    expect(bodies).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        organizeosBinding: "dead",
        mode: "observe",
        userId: boundSession.userId,
      })
    );
    // A hash of the sid, never the sid itself.
    expect(JSON.stringify(warn.mock.calls)).not.toContain(
      boundSession.organizeosSid
    );
  });

  test("a live binding keeps the session under enforce", async () => {
    signIn();
    env.ORGANIZEOS_SESSION_BINDING = "enforce";
    answerLiveness(true);

    const context = await createContext(
      new Request("https://webstudio.is/trpc")
    );

    expect(context.authorization).toMatchObject({
      type: "user",
      userId: boundSession.userId,
    });
  });

  test("an explicit token is not read through the session", async () => {
    signIn();
    env.ORGANIZEOS_SESSION_BINDING = "enforce";
    // A dead binding: were the session read, the request would still be a
    // token request, but the liveness RPC (unhandled here) would fail the test.
    server.use(
      db.get("AuthorizationToken", () =>
        json([{ project: { id: "project-1", userId: "owner-1" } }])
      )
    );

    const context = await createContext(
      new Request("https://webstudio.is/trpc", {
        headers: { "x-auth-token": "project-token" },
      })
    );

    expect(context.authorization).toEqual({
      type: "token",
      authToken: "project-token",
      ownerId: "owner-1",
    });
    expect(authenticator.isAuthenticated).not.toHaveBeenCalled();
    expect(builderAuthenticator.isAuthenticated).not.toHaveBeenCalled();

    env.TRPC_SERVER_API_TOKEN = "service-token";
    const service = await createContext(
      new Request("https://webstudio.is/trpc", {
        headers: { Authorization: "service-token" },
      })
    );
    expect(service.authorization).toEqual({
      type: "service",
      isServiceCall: true,
    });
    expect(authenticator.isAuthenticated).not.toHaveBeenCalled();
    expect(builderAuthenticator.isAuthenticated).not.toHaveBeenCalled();
  });
});

// OrganizeOS fork: the publish seam (ORGANIZEOS-FORK.md §5). The publisher is
// built once, when the module loads, from the two variables.
describe("OrganizeOS publisher", () => {
  const loadContext = async () => {
    vi.resetModules();
    const module = await import("./context.server");
    return module.createContext(new Request("https://webstudio.is/trpc"));
  };

  test("deployment.deploymentTrpc is the OrganizeOS publisher when ORGANIZEOS_PUBLISH_REPO and ORGANIZEOS_PUBLISH_GITHUB_TOKEN are set, and upstream's deployment client otherwise", async () => {
    env.ORGANIZEOS_PUBLISH_REPO = "OrganizeOS-HQ/OrganizeOS-Websites";
    env.ORGANIZEOS_PUBLISH_GITHUB_TOKEN = "github-token";
    const published = await loadContext();
    expect(published.deployment.deploymentTrpc).toEqual({ organizeos: true });
    expect(createOrganizeosPublisher).toHaveBeenCalledTimes(1);
    expect(createOrganizeosPublisher).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: "OrganizeOS-HQ/OrganizeOS-Websites",
        githubToken: "github-token",
      })
    );

    for (const [repo, token] of [
      [undefined, undefined],
      ["OrganizeOS-HQ/OrganizeOS-Websites", undefined],
      [undefined, "github-token"],
    ]) {
      createOrganizeosPublisher.mockClear();
      env.ORGANIZEOS_PUBLISH_REPO = repo;
      env.ORGANIZEOS_PUBLISH_GITHUB_TOKEN = token;
      const upstream = await loadContext();
      expect(upstream.deployment.deploymentTrpc).toBe(
        trpcSharedClient.deployment
      );
      expect(createOrganizeosPublisher).not.toHaveBeenCalled();
    }
  });
});
