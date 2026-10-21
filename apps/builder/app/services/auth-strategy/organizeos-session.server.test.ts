import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SessionData } from "~/services/auth.server.utils";

const env = vi.hoisted(() => ({
  ORGANIZEOS_SSO_PUBLIC_KEY: undefined as string | undefined,
  ORGANIZEOS_SESSION_BINDING: "observe" as "observe" | "enforce",
  POSTGREST_URL: "http://localhost:3000",
  POSTGREST_API_KEY: "service-key",
}));

const authenticator = vi.hoisted(() => ({ isAuthenticated: vi.fn() }));
const builderAuthenticator = vi.hoisted(() => ({ isAuthenticated: vi.fn() }));
const rpc = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn(() => ({ rpc })));

vi.mock("~/env/env.server", () => ({ default: env }));
vi.mock("~/services/auth.server", () => ({ authenticator }));
vi.mock("~/services/builder-auth.server", () => ({ builderAuthenticator }));
vi.mock("@webstudio-is/postgrest/index.server", () => ({ createClient }));

import {
  checkOrganizeosBinding,
  readBuilderSession,
  readDashboardSession,
  resetOrganizeosBindingCache,
  type OrganizeosBindingDeps,
} from "./organizeos-session.server";

const SID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ORGANIZEOS_USER = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

const boundSession: SessionData = {
  userId: "builder-user",
  createdAt: 1,
  organizeosSid: SID,
  organizeosUserId: ORGANIZEOS_USER,
};
const unboundSession: SessionData = { userId: "builder-user", createdAt: 1 };

const makeDeps = (
  overrides: Partial<OrganizeosBindingDeps> = {}
): OrganizeosBindingDeps & {
  isSessionLive: ReturnType<typeof vi.fn>;
  log: ReturnType<typeof vi.fn>;
} =>
  ({
    ssoConfigured: true,
    mode: "observe",
    isSessionLive: vi.fn(async () => true),
    now: () => 1_000_000,
    log: vi.fn(),
    ...overrides,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  resetOrganizeosBindingCache();
  env.ORGANIZEOS_SSO_PUBLIC_KEY = undefined;
  env.ORGANIZEOS_SESSION_BINDING = "observe";
});

describe("checkOrganizeosBinding", () => {
  test("passes without a check when SSO is not configured", async () => {
    const deps = makeDeps({ ssoConfigured: false, mode: "enforce" });
    expect(await checkOrganizeosBinding(unboundSession, deps)).toEqual({
      outcome: "pass",
      allow: true,
    });
    expect(deps.isSessionLive).not.toHaveBeenCalled();
    expect(deps.log).not.toHaveBeenCalled();
  });

  test("a live binding is allowed and not logged", async () => {
    const deps = makeDeps({ mode: "enforce" });
    expect(await checkOrganizeosBinding(boundSession, deps)).toEqual({
      outcome: "live",
      allow: true,
    });
    expect(deps.isSessionLive).toHaveBeenCalledWith(SID, ORGANIZEOS_USER);
    expect(deps.log).not.toHaveBeenCalled();
  });

  test.each([
    ["observe", true],
    ["enforce", false],
  ] as const)("missing under %s", async (mode, allow) => {
    const deps = makeDeps({ mode });
    expect(await checkOrganizeosBinding(unboundSession, deps)).toEqual({
      outcome: "missing",
      allow,
    });
    expect(deps.isSessionLive).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith({
      organizeosBinding: "missing",
      mode,
      userId: "builder-user",
    });
  });

  test("a sid without the user id is missing", async () => {
    const deps = makeDeps({ mode: "enforce" });
    const { organizeosUserId: _omit, ...sidOnly } = boundSession;
    expect((await checkOrganizeosBinding(sidOnly, deps)).outcome).toBe(
      "missing"
    );
    expect(deps.isSessionLive).not.toHaveBeenCalled();
  });

  test.each([
    ["observe", true],
    ["enforce", false],
  ] as const)("dead under %s", async (mode, allow) => {
    const deps = makeDeps({ mode, isSessionLive: vi.fn(async () => false) });
    expect(await checkOrganizeosBinding(boundSession, deps)).toEqual({
      outcome: "dead",
      allow,
    });
    const entry = deps.log.mock.calls[0][0];
    expect(entry).toMatchObject({
      organizeosBinding: "dead",
      mode,
      userId: "builder-user",
    });
    // A hash of the sid, never the sid itself.
    expect(entry.sidHash).toMatch(/^[0-9a-f]{12}$/);
    expect(JSON.stringify(entry)).not.toContain(SID);
  });

  test.each([
    ["observe", true],
    ["enforce", false],
  ] as const)("error under %s", async (mode, allow) => {
    const deps = makeDeps({
      mode,
      isSessionLive: vi.fn(async () => {
        throw new Error("rpc down");
      }),
    });
    expect(await checkOrganizeosBinding(boundSession, deps)).toEqual({
      outcome: "error",
      allow,
    });
    expect(deps.log.mock.calls[0][0]).toMatchObject({
      organizeosBinding: "error",
      reason: "rpc down",
    });
  });

  test("reuses a dead verdict within 60 s and re-queries after", async () => {
    let now = 1_000_000;
    const deps = makeDeps({
      mode: "enforce",
      now: () => now,
      isSessionLive: vi.fn(async () => false),
    });
    expect((await checkOrganizeosBinding(boundSession, deps)).outcome).toBe(
      "dead"
    );
    now += 59_000;
    deps.isSessionLive.mockResolvedValue(true);
    expect((await checkOrganizeosBinding(boundSession, deps)).outcome).toBe(
      "dead"
    );
    expect(deps.isSessionLive).toHaveBeenCalledTimes(1);

    now += 2_000;
    expect((await checkOrganizeosBinding(boundSession, deps)).outcome).toBe(
      "live"
    );
    expect(deps.isSessionLive).toHaveBeenCalledTimes(2);
  });

  test("logs a repeated outcome once a minute", async () => {
    let now = 1_000_000;
    const deps = makeDeps({ now: () => now });
    await checkOrganizeosBinding(unboundSession, deps);
    now += 30_000;
    await checkOrganizeosBinding(unboundSession, deps);
    expect(deps.log).toHaveBeenCalledTimes(1);
    now += 30_000;
    await checkOrganizeosBinding(unboundSession, deps);
    expect(deps.log).toHaveBeenCalledTimes(2);
  });

  test("reuses an error only briefly", async () => {
    let now = 1_000_000;
    const deps = makeDeps({
      now: () => now,
      isSessionLive: vi.fn(async () => {
        throw new Error("rpc down");
      }),
    });
    await checkOrganizeosBinding(boundSession, deps);
    now += 4_000;
    await checkOrganizeosBinding(boundSession, deps);
    expect(deps.isSessionLive).toHaveBeenCalledTimes(1);
    now += 2_000;
    await checkOrganizeosBinding(boundSession, deps);
    expect(deps.isSessionLive).toHaveBeenCalledTimes(2);
  });

  test("caches per sid and user, not per sid alone", async () => {
    const deps = makeDeps({ isSessionLive: vi.fn(async () => true) });
    await checkOrganizeosBinding(boundSession, deps);
    await checkOrganizeosBinding(
      { ...boundSession, organizeosUserId: "someone-else" },
      deps
    );
    expect(deps.isSessionLive).toHaveBeenCalledTimes(2);
  });
});

describe("the default liveness check", () => {
  test("asks the RPC with the session and the user", async () => {
    env.ORGANIZEOS_SSO_PUBLIC_KEY = "pem";
    env.ORGANIZEOS_SESSION_BINDING = "enforce";
    rpc.mockResolvedValue({ data: true, error: null });

    expect(await checkOrganizeosBinding(boundSession)).toEqual({
      outcome: "live",
      allow: true,
    });
    expect(createClient).toHaveBeenCalledWith(
      "http://localhost:3000",
      "service-key"
    );
    expect(rpc).toHaveBeenCalledWith("websites2_sso_session_live", {
      p_session_id: SID,
      p_user_id: ORGANIZEOS_USER,
    });
  });

  test("a missing RPC is an error, allowed under observe", async () => {
    env.ORGANIZEOS_SSO_PUBLIC_KEY = "pem";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Could not find the function", code: "PGRST202" },
    });

    expect(await checkOrganizeosBinding(boundSession)).toEqual({
      outcome: "error",
      allow: true,
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ organizeosBinding: "error", mode: "observe" })
    );
    warn.mockRestore();
  });

  test("a non-boolean answer is an error", async () => {
    env.ORGANIZEOS_SSO_PUBLIC_KEY = "pem";
    env.ORGANIZEOS_SESSION_BINDING = "enforce";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: "true", error: null });

    expect((await checkOrganizeosBinding(boundSession)).outcome).toBe("error");
    warn.mockRestore();
  });
});

describe("session readers", () => {
  const request = new Request("https://apps.webstudio.is/dashboard");

  test("return no session when there is none, without a check", async () => {
    env.ORGANIZEOS_SSO_PUBLIC_KEY = "pem";
    authenticator.isAuthenticated.mockResolvedValue(null);
    builderAuthenticator.isAuthenticated.mockResolvedValue(null);
    expect(await readDashboardSession(request)).toBeNull();
    expect(await readBuilderSession(request)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  test("return the session when the binding is live", async () => {
    env.ORGANIZEOS_SSO_PUBLIC_KEY = "pem";
    env.ORGANIZEOS_SESSION_BINDING = "enforce";
    rpc.mockResolvedValue({ data: true, error: null });
    authenticator.isAuthenticated.mockResolvedValue(boundSession);
    builderAuthenticator.isAuthenticated.mockResolvedValue(boundSession);
    expect(await readDashboardSession(request)).toEqual(boundSession);
    expect(await readBuilderSession(request)).toEqual(boundSession);
  });

  test("read a dead binding as no session under enforce", async () => {
    env.ORGANIZEOS_SSO_PUBLIC_KEY = "pem";
    env.ORGANIZEOS_SESSION_BINDING = "enforce";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: false, error: null });
    authenticator.isAuthenticated.mockResolvedValue(boundSession);
    builderAuthenticator.isAuthenticated.mockResolvedValue(boundSession);
    expect(await readDashboardSession(request)).toBeNull();
    expect(await readBuilderSession(request)).toBeNull();
    warn.mockRestore();
  });

  test("keep a dead binding under observe", async () => {
    env.ORGANIZEOS_SSO_PUBLIC_KEY = "pem";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: false, error: null });
    authenticator.isAuthenticated.mockResolvedValue(boundSession);
    expect(await readDashboardSession(request)).toEqual(boundSession);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("every session read goes through the binding check", () => {
  // apps/builder/app
  const appRoot = fileURLToPath(new URL("../..", import.meta.url));
  const self = "services/auth-strategy/organizeos-session.server.ts";

  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        return name === "node_modules" || name === "__generated__"
          ? []
          : walk(path);
      }
      return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });

  test("no other module calls isAuthenticated(", () => {
    const files = walk(appRoot).map((path) => relative(appRoot, path));
    // The walk really covers the app (a broken root would pass vacuously).
    expect(files).toContain("shared/context.server.ts");
    expect(files).toContain("routes/oauth.ws.authorize.tsx");
    const offenders = files
      .filter((path) => path !== self && /\.test\./.test(path) === false)
      .filter((path) =>
        readFileSync(join(appRoot, path), "utf8").includes("isAuthenticated(")
      );
    expect(offenders).toEqual([]);
  });

  test("the binding module never builds a context (recursion trap)", () => {
    const source = readFileSync(join(appRoot, self), "utf8");
    expect(source).not.toMatch(/from\s+["'][^"']*context\.server["']/);
    expect(source).not.toMatch(/\bcreateContext\s*\(/);
  });
});
