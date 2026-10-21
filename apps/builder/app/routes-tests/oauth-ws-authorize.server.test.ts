import { beforeEach, describe, expect, test, vi } from "vitest";

const env = vi.hoisted(() => ({
  AUTH_WS_CLIENT_ID: "12345",
  AUTH_WS_CLIENT_SECRET: "12345678",
  ORGANIZEOS_SSO_PUBLIC_KEY: "pem" as string | undefined,
  ORGANIZEOS_SESSION_BINDING: "enforce" as "observe" | "enforce",
  POSTGREST_URL: "http://localhost:3000",
  POSTGREST_API_KEY: "",
}));

const authenticator = vi.hoisted(() => ({ isAuthenticated: vi.fn() }));
const rpc = vi.hoisted(() => vi.fn());
const createCodeToken = vi.hoisted(() => vi.fn(async () => "code-token"));
const bloomFilter = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock("~/env/env.server", () => ({ default: env }));
vi.mock("~/services/auth.server", () => ({ authenticator }));
vi.mock("~/services/builder-auth.server", () => ({
  builderAuthenticator: { isAuthenticated: vi.fn() },
}));
vi.mock("@webstudio-is/postgrest/index.server", () => ({
  createClient: vi.fn(() => ({ rpc })),
}));
vi.mock("~/services/token.server", () => ({ createCodeToken }));
vi.mock("~/services/builder-access.server", () => ({
  isUserAuthorizedForProject: vi.fn(async () => true),
}));
vi.mock("~/services/session.server", () => ({
  readLoginSessionBloomFilter: vi.fn(async () => bloomFilter),
  writeLoginSessionBloomFilter: vi.fn(
    async (_request: Request, response: Response) => response
  ),
}));

import { loader } from "../routes/oauth.ws.authorize";
import { resetOrganizeosBindingCache } from "~/services/auth-strategy/organizeos-session.server";

const projectId = "042d35b0-718e-4c5f-a5dd-8568282366e5";
const dashboardOrigin = "https://apps.webstudio.is";
const projectOrigin = `https://p-${projectId}.apps.webstudio.is`;

const boundSession = {
  userId: "builder-user",
  createdAt: 1,
  organizeosSid: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
  organizeosUserId: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
};

const authorizeRequest = () => {
  const url = new URL(`${dashboardOrigin}/oauth/ws/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", `${projectOrigin}/auth/ws/callback`);
  url.searchParams.set("client_id", env.AUTH_WS_CLIENT_ID);
  url.searchParams.set("state", "state-1");
  url.searchParams.set("scope", `project:${projectId}`);
  url.searchParams.set("code_challenge", "challenge");
  url.searchParams.set("code_challenge_method", "S256");
  return new Request(url, {
    headers: {
      "sec-fetch-site": "same-site",
      "sec-fetch-mode": "navigate",
      "sec-fetch-dest": "document",
    },
  });
};

const callLoader = async (request: Request) =>
  (await loader({ request, params: {}, context: {} })) as Response;

describe("oauth.ws.authorize and the OrganizeOS session binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrganizeosBindingCache();
    env.ORGANIZEOS_SESSION_BINDING = "enforce";
    authenticator.isAuthenticated.mockResolvedValue(boundSession);
  });

  test("a dead dashboard binding goes to login and mints no code", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await callLoader(authorizeRequest());

    expect(response.status).toBe(302);
    const location = new URL(
      response.headers.get("Location") ?? "",
      dashboardOrigin
    );
    expect(location.pathname).toBe("/login");
    expect(createCodeToken).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("a live binding mints a code that carries it", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    const response = await callLoader(authorizeRequest());

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location") ?? "");
    expect(location.origin).toBe(projectOrigin);
    expect(location.searchParams.get("code")).toBe("code-token");
    expect(createCodeToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "builder-user",
        projectId,
        organizeosSid: boundSession.organizeosSid,
        organizeosUserId: boundSession.organizeosUserId,
      }),
      env.AUTH_WS_CLIENT_SECRET,
      expect.anything()
    );
  });
});
