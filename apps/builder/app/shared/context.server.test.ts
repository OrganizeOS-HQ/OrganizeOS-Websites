import { beforeEach, describe, expect, test, vi } from "vitest";

const env = vi.hoisted(() => ({
  TRPC_SERVER_API_TOKEN: undefined as string | undefined,
  POSTGREST_URL: "http://localhost:3000",
  POSTGREST_API_KEY: "",
  PUBLISHER_HOST: "wstd.work",
  ORGANIZEOS_SSO_PUBLIC_KEY: undefined as string | undefined,
  ORGANIZEOS_SESSION_BINDING: "observe" as "observe" | "enforce",
}));

const rpc = vi.hoisted(() => vi.fn());

const authenticator = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
}));
const builderAuthenticator = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
}));
const isBuilder = vi.hoisted(() => vi.fn(() => false));
const isCanvas = vi.hoisted(() => vi.fn(() => false));

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
  trpcSharedClient: {
    domain: {},
    deployment: {},
  },
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

vi.mock("@webstudio-is/postgrest/index.server", () => ({
  createClient: vi.fn(() => ({ rpc })),
}));

vi.mock("~/services/session.server", () => ({
  readLoginSessionBloomFilter: vi.fn(),
}));

vi.mock("./router-utils", () => ({
  isBuilder,
  isCanvas,
}));

vi.mock("@webstudio-is/http-client", () => ({
  parseBuilderUrl: vi.fn(),
}));

import { extractAuthFromRequest } from "./context.server";
import { resetOrganizeosBindingCache } from "~/services/auth-strategy/organizeos-session.server";

describe("extractAuthFromRequest", () => {
  beforeEach(() => {
    env.TRPC_SERVER_API_TOKEN = undefined;
    authenticator.isAuthenticated.mockResolvedValue(undefined);
    builderAuthenticator.isAuthenticated.mockResolvedValue(undefined);
    isBuilder.mockReturnValue(false);
    isCanvas.mockReturnValue(false);
    env.ORGANIZEOS_SSO_PUBLIC_KEY = undefined;
    env.ORGANIZEOS_SESSION_BINDING = "observe";
    rpc.mockReset();
    resetOrganizeosBindingCache();
  });

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
  });

  describe("OrganizeOS session binding", () => {
    const boundSession = {
      userId: "builder-user",
      createdAt: 1,
      organizeosSid: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
      organizeosUserId: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    };

    test.each([
      ["dashboard", false],
      ["builder", true],
    ])(
      "a dead binding reads as no %s session under enforce",
      async (_label, builder) => {
        env.ORGANIZEOS_SSO_PUBLIC_KEY = "pem";
        env.ORGANIZEOS_SESSION_BINDING = "enforce";
        isBuilder.mockReturnValue(builder);
        authenticator.isAuthenticated.mockResolvedValue(boundSession);
        builderAuthenticator.isAuthenticated.mockResolvedValue(boundSession);
        rpc.mockResolvedValue({ data: false, error: null });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const auth = await extractAuthFromRequest(
          new Request("https://webstudio.is/trpc")
        );

        expect(auth.sessionData).toBeNull();
        expect(rpc).toHaveBeenCalledWith("websites2_sso_session_live", {
          p_session_id: boundSession.organizeosSid,
          p_user_id: boundSession.organizeosUserId,
        });
        warn.mockRestore();
      }
    );

    test("a live binding keeps the session", async () => {
      env.ORGANIZEOS_SSO_PUBLIC_KEY = "pem";
      env.ORGANIZEOS_SESSION_BINDING = "enforce";
      authenticator.isAuthenticated.mockResolvedValue(boundSession);
      rpc.mockResolvedValue({ data: true, error: null });

      const auth = await extractAuthFromRequest(
        new Request("https://webstudio.is/trpc")
      );

      expect(auth.sessionData).toEqual(boundSession);
    });
  });
});
