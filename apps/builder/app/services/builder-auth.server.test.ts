import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SessionData } from "./auth.server.utils";

type Verify = (params: {
  tokens: { access_token: string };
  request: Request;
}) => Promise<SessionData>;

const captured = vi.hoisted(() => ({ verify: undefined as unknown }));
const isUserAuthorizedForProject = vi.hoisted(() => vi.fn(async () => true));

vi.mock("~/env/env.server", () => ({
  default: {
    AUTH_WS_CLIENT_ID: "client",
    AUTH_WS_CLIENT_SECRET: "secret",
  },
}));
vi.mock("./builder-session.server", () => ({ builderSessionStorage: {} }));
vi.mock("./builder-access.server", () => ({ isUserAuthorizedForProject }));
vi.mock("./auth-strategy/ws.server", () => ({
  WsStrategy: class {
    name = "ws";
    constructor(_options: unknown, verify: unknown) {
      captured.verify = verify;
    }
  },
}));

import { createAccessToken } from "./token.server";
import "./builder-auth.server";

const PROJECT_ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const request = new Request(
  `https://p-${PROJECT_ID}.wstd.dev/auth/ws/callback`
);

const signIn = async (payload: { purpose?: string }) => {
  const accessToken = await createAccessToken(
    { userId: "user-1", projectId: PROJECT_ID, ...payload },
    "secret",
    { maxAge: 60_000 }
  );
  return (captured.verify as Verify)({
    tokens: { access_token: accessToken },
    request,
  });
};

// OrganizeOS: only a WS OAuth access token (no purpose) opens a project-host
// session; a collab token is for collaboration writes only.
describe("the ws strategy callback", () => {
  beforeEach(() => {
    isUserAuthorizedForProject.mockClear();
  });

  test("an access token without a purpose opens a session", async () => {
    await expect(signIn({})).resolves.toMatchObject({ userId: "user-1" });
  });

  test("a collab token cannot open a session", async () => {
    await expect(signIn({ purpose: "collab" })).rejects.toThrow(
      "Invalid or expired access token"
    );
    expect(isUserAuthorizedForProject).not.toHaveBeenCalled();
  });
});
