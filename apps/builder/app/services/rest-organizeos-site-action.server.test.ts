import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import targetsFixture from "~/shared/__fixtures__/site-addresses-targets.json";
import type { SessionData } from "~/services/auth.server.utils";
import type { OrganizeosBindingOutcome } from "~/services/auth-strategy/organizeos-session.server";
import type { SiteAddressesRow } from "~/shared/db/organizeos-site-addresses.server";
import type { ProjectOrganization } from "~/shared/db/organizeos-project-org.server";
import type { SiteActionAnswer } from "~/shared/organizeos-site-action.server";
import {
  handleSiteActionRequest,
  type SiteActionRouteDeps,
} from "./organizeos-site-action-route.server";

// OrganizeOS fork: the Publish dialog's Unpublish of one address. The route
// decides who may ask, checks the target against the org's own addresses
// read, then mints the assertion for the session's OrganizeOS user and sends
// it to OrganizeOS, which decides.

const projectId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "builder-user";
const sub = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const sid = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const jti = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const fixtureRow = targetsFixture[0] as SiteAddressesRow;

type State = {
  authorization: { type: string; userId?: string };
  session: SessionData | null;
  outcome: OrganizeosBindingOutcome;
  admin: boolean;
  owner: ProjectOrganization;
  row: SiteAddressesRow | undefined;
  secret: string | undefined;
  answer: SiteActionAnswer;
};

let state: State;
let sent: string[];
let order: string[];
let logged: ReturnType<typeof vi.spyOn>;

const deps = (): SiteActionRouteDeps => ({
  checkCsrf: async () => {},
  createContext: async () =>
    ({ authorization: state.authorization }) as unknown as AppContext,
  readSession: async () => state.session,
  bindingOutcome: async () => state.outcome,
  hasAdminPermit: async () => state.admin,
  resolveOrganization: async () => {
    order.push("owner");
    return state.owner;
  },
  fetchAddresses: async () => {
    order.push("addresses");
    return state.row;
  },
  secret: state.secret,
  now: () => 1793016000_000,
  randomId: () => {
    order.push("mint");
    return jti;
  },
  send: async (header) => {
    order.push("send");
    sent.push(header);
    return state.answer;
  },
  publisherHost: "organizeos.org",
  platformUrl: "https://app.organizeos.org",
});

const call = async ({
  body = { action: "unpublish", target: "builtin" } as unknown,
  method = "POST",
  destination = "empty",
}: { body?: unknown; method?: string; destination?: string } = {}) => {
  const request = new Request(
    `https://p-${projectId}.builder.organizeos.org/rest/organizeos-site-action/${projectId}`,
    {
      method,
      headers: {
        "sec-fetch-site": "same-origin",
        "sec-fetch-dest": destination,
        "content-type": "application/json",
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    }
  );
  return handleSiteActionRequest(request, projectId, deps());
};

const claimsOf = (header: string) =>
  JSON.parse(Buffer.from(header.split(".")[1], "base64url").toString("utf8"));

beforeEach(() => {
  state = {
    authorization: { type: "user", userId },
    session: {
      userId,
      createdAt: 1,
      organizeosUserId: sub,
      organizeosSid: sid,
    },
    outcome: "live",
    admin: true,
    owner: { organizationId },
    row: fixtureRow,
    secret: "s3cret",
    answer: { kind: "ok", changed: true },
  };
  sent = [];
  order = [];
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rest.organizeos-site-action", () => {
  test("mints the assertion for the session's OrganizeOS user and session, and sends it once", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(claimsOf(sent[0])).toEqual({
      aud: "site-action",
      act: "unpublish",
      tgt: "builtin",
      org: organizationId,
      sub,
      sid,
      jti,
      iat: 1793016000,
      exp: 1793016060,
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  test("takes the org from the owner, whatever the body says", async () => {
    await call({ body: { action: "unpublish", target: "builtin", org: "x" } });
    expect(sent).toEqual([]);
    await call();
    expect(claimsOf(sent[0]).org).toBe(organizationId);
  });

  test("refuses a GET and a document load", async () => {
    expect((await call({ method: "GET" })).status).toBe(405);
    await expect(call({ destination: "document" })).rejects.toBeDefined();
    expect(sent).toEqual([]);
  });

  test("refuses a share token, another user's session and no session, reading nothing", async () => {
    for (const change of [
      () => (state.authorization = { type: "token" }),
      () => (state.session = { userId: "someone-else", createdAt: 1 }),
      () => (state.session = null),
    ]) {
      change();
      expect((await call()).status).toBe(403);
      state.authorization = { type: "user", userId };
      state.session = {
        userId,
        createdAt: 1,
        organizeosUserId: sub,
        organizeosSid: sid,
      };
    }
    expect(order).toEqual([]);
  });

  test("needs a live binding: pass, missing, dead and error are refused", async () => {
    for (const outcome of ["pass", "missing", "dead", "error"] as const) {
      state.outcome = outcome;
      expect((await call()).status).toBe(403);
    }
    expect(order).toEqual([]);
  });

  test("needs the session's OrganizeOS user and session", async () => {
    state.session = { userId, createdAt: 1, organizeosUserId: sub };
    expect((await call()).status).toBe(403);
    state.session = { userId, createdAt: 1, organizeosSid: sid };
    expect((await call()).status).toBe(403);
    expect(order).toEqual([]);
  });

  test("needs the project's admin permit", async () => {
    state.admin = false;
    expect((await call()).status).toBe(403);
    expect(order).toEqual([]);
  });

  test("refuses a body that is not strict, another action and a bad key", async () => {
    for (const body of [
      { action: "publish", target: "builtin" },
      { action: "unpublish", target: "Builtin" },
      { action: "unpublish", target: "https://example.org" },
      { action: "unpublish" },
      { action: "unpublish", target: "builtin", extra: 1 },
    ]) {
      expect((await call({ body })).status).toBe(400);
    }
    expect(order).toEqual([]);
  });

  test("mints and sends nothing without the secret", async () => {
    state.secret = undefined;
    const response = await call();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "unavailable" });
    expect(order).toEqual([]);
    state.secret = "  ";
    expect((await call()).status).toBe(404);
    expect(sent).toEqual([]);
  });

  test("mints and sends nothing for a target that is not listed or has no recorded build", async () => {
    for (const target of ["www.example.org", "other.example", "example.net"]) {
      order = [];
      const response = await call({ body: { action: "unpublish", target } });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ ok: false, error: "not_live" });
      expect(order).toEqual(["owner", "addresses"]);
    }
    expect(sent).toEqual([]);
  });

  test("a recorded build that is not serving can still be unpublished", async () => {
    const [builtin, ...rest] = fixtureRow.targets!;
    state.row = {
      ...fixtureRow,
      targets: [{ ...builtin, serving: false }, ...rest],
    } as SiteAddressesRow;
    expect((await call()).status).toBe(200);
  });

  test("answers 503 when the read fails or carries no targets, and refuses a human-owned project", async () => {
    state.row = undefined;
    expect((await call()).status).toBe(503);
    state.row = { ...fixtureRow, targets: null };
    expect((await call()).status).toBe(503);
    state.row = fixtureRow;
    state.owner = { failed: true };
    expect((await call()).status).toBe(503);
    state.owner = { none: true };
    expect((await call()).status).toBe(403);
    expect(sent).toEqual([]);
  });

  test("maps each answer from OrganizeOS", async () => {
    const cases: Array<[SiteActionAnswer, number, string | undefined]> = [
      [{ kind: "ok", changed: false }, 200, undefined],
      [{ kind: "status", status: 404 }, 404, "unavailable"],
      [{ kind: "status", status: 409 }, 409, "unknown_target"],
      [{ kind: "status", status: 401 }, 502, "failed"],
      [{ kind: "status", status: 403 }, 403, "forbidden"],
      [{ kind: "status", status: 429 }, 429, "rate_limited"],
      [{ kind: "status", status: 500 }, 502, "failed"],
      [{ kind: "status", status: 503 }, 502, "failed"],
      [{ kind: "timeout" }, 502, "failed"],
      [{ kind: "failed" }, 502, "failed"],
    ];
    for (const [answer, status, error] of cases) {
      state.answer = answer;
      const response = await call();
      expect(response.status, JSON.stringify(answer)).toBe(status);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe(error);
    }
  });

  test("logs codes only: never a host, an id or the header", async () => {
    state.answer = { kind: "status", status: 401 };
    await call();
    await call({ body: { action: "unpublish", target: "example.net" } });
    const text = JSON.stringify(logged.mock.calls);
    expect(text).not.toContain(sent[0]);
    expect(text).not.toContain(organizationId);
    expect(text).not.toContain(sub);
    expect(text).not.toContain("example.net");
  });
});
