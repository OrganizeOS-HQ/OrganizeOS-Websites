import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import vector from "~/shared/__fixtures__/cms-actor-assertion.json";
import type { SessionData } from "~/services/auth.server.utils";
import type { OrganizeosBindingOutcome } from "~/services/auth-strategy/organizeos-session.server";
import type { ProjectOrganization } from "~/shared/db/organizeos-project-org.server";
import {
  CMS_PLATFORM_BASE_PATH,
  cmsCanonicalTarget,
  hashCmsBytes,
  type CmsForwardAnswer,
  type CmsForwardRequest,
} from "~/shared/organizeos-cms.server";

// The enforce cases run the real session read over these.
const env = vi.hoisted(() => ({
  ORGANIZEOS_SSO_PUBLIC_KEY: "key",
  ORGANIZEOS_SESSION_BINDING: "enforce",
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
  resetOrganizeosBindingCache,
} from "~/services/auth-strategy/organizeos-session.server";
import {
  CMS_JSON_BODY_MAX_BYTES,
  CMS_UPLOAD_BODY_MAX_BYTES,
  CMS_UPLOAD_FILE_MAX_BYTES,
  handleCmsRequest,
  matchCmsPath,
  type CmsRouteDeps,
} from "./organizeos-cms-route.server";

// OrganizeOS fork: the native CMS screen's door to OrganizeOS. The route
// checks the person, forwards only a request whose path and query match one
// of its fixed endpoints, rebuilt from the parsed values, with an actor
// assertion minted for that one request, and relays OrganizeOS's answer.

const c = "22222222-2222-4222-8222-222222222222";
const i = "33333333-3333-4333-8333-333333333333";
// An id with hex letters, so its upper-case spelling differs.
const lettered = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const match = (method: string, splat: string, search = "") =>
  matchCmsPath(method, splat, new URLSearchParams(search));

describe("matchCmsPath", () => {
  test.each([
    ["GET", "access", "", "E0", "access", []],
    ["GET", "collections", "", "E1", "collections", []],
    ["GET", `collections/${c}`, "", "E2", `collections/${c}`, []],
    [
      "GET",
      `collections/${c}/items`,
      "?q=caf%C3%A9&page=2",
      "E3",
      `collections/${c}/items`,
      [
        ["page", "2"],
        ["q", "café"],
      ],
    ],
    [
      "GET",
      `collections/${c}/items/${i}`,
      "",
      "E4",
      `collections/${c}/items/${i}`,
      [],
    ],
    [
      "GET",
      `collections/${c}/items/search`,
      `?ids=${c},${i}`,
      "E5",
      `collections/${c}/items/search`,
      [["ids", `${c},${i}`]],
    ],
    [
      "GET",
      `collections/${c}/items/search`,
      "?q=news",
      "E5",
      `collections/${c}/items/search`,
      [["q", "news"]],
    ],
    ["POST", `collections/${c}/items`, "", "E6", `collections/${c}/items`, []],
    [
      "PUT",
      `collections/${c}/items/${i}`,
      "",
      "E7",
      `collections/${c}/items/${i}`,
      [],
    ],
    [
      "POST",
      `collections/${c}/items/${i}/publish`,
      "",
      "E8a",
      `collections/${c}/items/${i}/publish`,
      [],
    ],
    [
      "POST",
      `collections/${c}/items/${i}/discard`,
      "",
      "E8b",
      `collections/${c}/items/${i}/discard`,
      [],
    ],
    ["POST", "uploads/image", "", "E9", "uploads/image", []],
  ])("%s %s%s is %s", (method, splat, search, endpoint, path, query) =>
    expect(match(method, splat, search)).toMatchObject({
      endpoint,
      path,
      query,
    })
  );

  test("GETs carry no body, E6 to E8b JSON, E9 multipart", () => {
    const bodies = [
      match("GET", "access"),
      match("GET", "collections"),
      match("GET", `collections/${c}`),
      match("GET", `collections/${c}/items`),
      match("GET", `collections/${c}/items/${i}`),
      match("GET", `collections/${c}/items/search`, "?q=news"),
      match("POST", `collections/${c}/items`),
      match("PUT", `collections/${c}/items/${i}`),
      match("POST", `collections/${c}/items/${i}/publish`),
      match("POST", `collections/${c}/items/${i}/discard`),
      match("POST", "uploads/image"),
    ].map((matched) => [matched?.endpoint, matched?.method, matched?.body]);
    expect(bodies).toEqual([
      ["E0", "GET", "none"],
      ["E1", "GET", "none"],
      ["E2", "GET", "none"],
      ["E3", "GET", "none"],
      ["E4", "GET", "none"],
      ["E5", "GET", "none"],
      ["E6", "POST", "json"],
      ["E7", "PUT", "json"],
      ["E8a", "POST", "json"],
      ["E8b", "POST", "json"],
      ["E9", "POST", "multipart"],
    ]);
  });

  test.each([
    ["POST", "access", ""],
    ["PUT", `collections/${c}/items`, ""],
    ["GET", "uploads/image", ""],
    ["GET", "access/", ""],
    ["GET", "", ""],
    ["GET", "nothing", ""],
    ["GET", `collections/${c}/items/${i}/extra`, ""],
    ["GET", "collections/not-a-uuid", ""],
    ["GET", `collections/${lettered.toUpperCase()}`, ""],
    ["GET", `collections/${c}/../access`, ""],
    ["GET", `collections/${c}/%2e%2e/access`, ""],
    ["GET", "access", "?x=1"],
    ["GET", `collections/${c}`, "?q=a"],
    ["GET", `collections/${c}/items`, "?page=0"],
    ["GET", `collections/${c}/items`, "?page=02"],
    ["GET", `collections/${c}/items`, "?page=10001"],
    ["GET", `collections/${c}/items`, "?page=1&page=2"],
    ["GET", `collections/${c}/items`, "?q="],
    ["GET", `collections/${c}/items`, `?q=${"a".repeat(201)}`],
    ["GET", `collections/${c}/items`, `?org=${c}`],
    ["GET", `collections/${c}/items/search`, ""],
    ["GET", `collections/${c}/items/search`, "?ids="],
    [
      "GET",
      `collections/${c}/items/search`,
      `?ids=${Array(101).fill(c).join(",")}`,
    ],
    ["GET", `collections/${c}/items/search`, `?ids=${c},`],
    ["GET", `collections/${c}/items/search`, "?ids=x"],
    ["POST", `collections/${c}/items`, "?clientId=1"],
    ["GET", "access", "?__proto__=x"],
    ["GET", `collections/${c}/items`, "?constructor=x"],
  ])("%s %s%s matches nothing", (method, splat, search) =>
    expect(match(method, splat, search)).toBeUndefined()
  );
});

const projectId = "11111111-1111-4111-8111-111111111111";
const userId = "builder-user";
const org = vector.payload.org;
const base = `${CMS_PLATFORM_BASE_PATH}/${org}`;

const utf8 = (text: string) => new TextEncoder().encode(text);

const liveSession: SessionData = {
  userId,
  createdAt: 1,
  organizeosUserId: vector.payload.sub,
  organizeosSid: vector.payload.sid,
};

type State = {
  authorization: { type: string; userId?: string };
  session: SessionData | null;
  outcome: OrganizeosBindingOutcome;
  permits: { view: boolean; edit: boolean };
  owner: ProjectOrganization;
  secret: string | undefined;
  answer: CmsForwardAnswer;
  csrfInvalid: boolean;
};

let state: State;
let sent: CmsForwardRequest[];
let order: string[];
let asked: string[];
let contexts: number;
let logged: ReturnType<typeof vi.spyOn>;

const deps = (): CmsRouteDeps => ({
  checkCsrf: async () => {
    if (state.csrfInvalid) {
      throw new Response(null, { status: 403 });
    }
  },
  createContext: async () => {
    contexts += 1;
    return { authorization: state.authorization } as unknown as AppContext;
  },
  readSession: async () => state.session,
  bindingOutcome: async () => state.outcome,
  hasPermit: async (_projectId, permit) => {
    asked.push(permit);
    return state.permits[permit];
  },
  resolveOrganization: async () => {
    order.push("owner");
    return state.owner;
  },
  secret: state.secret,
  now: () => vector.payload.iat * 1000,
  randomId: () => {
    order.push("mint");
    return vector.payload.jti;
  },
  send: async (request) => {
    order.push("send");
    sent.push(request);
    return state.answer;
  },
});

type Call = {
  method?: string;
  splat?: string;
  /** The request's own path after the project id, when it is not the splat. */
  rawPath?: string;
  search?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  destination?: string;
  routeProjectId?: string;
  with?: CmsRouteDeps;
};

const call = ({
  method = "GET",
  splat = "access",
  rawPath,
  search = "",
  headers = {},
  body,
  destination = "empty",
  with: given,
  ...rest
}: Call = {}) => {
  const request = new Request(
    `https://p-${projectId}.builder.organizeos.org/rest/organizeos-cms/${projectId}/${rawPath ?? splat}${search}`,
    {
      method,
      headers: {
        "sec-fetch-site": "same-origin",
        "sec-fetch-dest": destination,
        ...headers,
      },
      ...(body === undefined ? {} : { body, duplex: "half" }),
    } as RequestInit
  );
  const routeProjectId =
    "routeProjectId" in rest ? rest.routeProjectId : projectId;
  return handleCmsRequest(request, routeProjectId, splat, given ?? deps());
};

const claimsOf = (header: string) =>
  JSON.parse(Buffer.from(header.split(".")[1], "base64url").toString("utf8"));

const errorOf = async (response: Response) =>
  ((await response.json()) as { error?: string }).error;

const rejection = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
};

beforeEach(() => {
  state = {
    authorization: { type: "user", userId },
    session: { ...liveSession },
    outcome: "live",
    permits: { view: true, edit: true },
    owner: { organizationId: org },
    secret: vector.secret,
    answer: { kind: "answer", status: 200, bytes: utf8('{"ok":1}') },
    csrfInvalid: false,
  };
  sent = [];
  order = [];
  asked = [];
  contexts = 0;
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rest.organizeos-cms", () => {
  test("mints the fixture's assertion for the fixture's request and sends it once", async () => {
    const target = new URL(vector.target, "https://app.organizeos.org");
    const splat = target.pathname.slice(
      `${CMS_PLATFORM_BASE_PATH}/${vector.payload.org}/`.length
    );
    const response = await call({
      splat,
      search: target.search,
      headers:
        vector.payload.ip === null ? {} : { "x-real-ip": vector.payload.ip },
    });
    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      method: "GET",
      target: cmsCanonicalTarget(target.pathname, target.searchParams),
      header: vector.header,
      timeoutMs: 15_000,
    });
    expect(sent[0].target).toBe(vector.target);
  });

  test("sends the rebuilt path and query, keys sorted, never the request's", async () => {
    await call({
      splat: `collections/${c}/items`,
      search: "?q=caf%C3%A9&page=2",
    });
    const expected = `${base}/collections/${c}/items?page=2&q=caf%C3%A9`;
    expect(sent[0].target).toBe(expected);
    expect(claimsOf(sent[0].header).p).toBe(hashCmsBytes(expected));
  });

  test("answers 404 for the forms door's paths and still mints aud cms", async () => {
    for (const [splat, search] of [
      ["forms", "?kind=contact-signup"],
      ["catalog", "?kind=membership"],
    ]) {
      const response = await call({ splat, search });
      expect(response.status, splat).toBe(404);
    }
    expect(sent).toEqual([]);
    await call();
    expect(claimsOf(sent[0].header).aud).toBe("cms");
    expect(sent[0].target.startsWith(`${CMS_PLATFORM_BASE_PATH}/`)).toBe(true);
  });

  test("takes the org from the project's owner, whatever the request says", async () => {
    await call({ headers: { "x-organization-id": c } });
    expect(sent[0].target).toBe(`${base}/access`);
    expect(claimsOf(sent[0].header).org).toBe(org);
  });

  test("lower-cases a mixed-case org before minting and building the path", async () => {
    state.owner = { organizationId: org.toUpperCase() };
    expect(org.toUpperCase()).not.toBe(org);
    await call();
    expect(claimsOf(sent[0].header).org).toBe(org);
    expect(sent[0].target).toBe(`${base}/access`);
  });

  test("answers 405 to any method but GET, POST and PUT, reading nothing", async () => {
    for (const method of ["DELETE", "PATCH", "HEAD"]) {
      const response = await call({ method });
      expect(response.status, method).toBe(405);
      if (method !== "HEAD") {
        expect(await errorOf(response)).toBe("invalid");
      }
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    expect(contexts).toBe(0);
    expect(order).toEqual([]);
  });

  test("a missing project id is 404 not_found", async () => {
    const response = await call({ routeProjectId: undefined });
    expect(response.status).toBe(404);
    expect(await errorOf(response)).toBe("not_found");
    expect(contexts).toBe(0);
  });

  test("refuses a cross-origin request, a document load and a bad CSRF token", async () => {
    const refusals = [
      await rejection(call({ headers: { "sec-fetch-site": "cross-site" } })),
      await rejection(call({ destination: "document" })),
    ];
    state.csrfInvalid = true;
    refusals.push(await rejection(call()));
    for (const refusal of refusals) {
      expect(refusal).toBeInstanceOf(Response);
      expect((refusal as Response).status).toBe(403);
    }
    expect(contexts).toBe(0);
    expect(order).toEqual([]);
  });

  test("an anonymous request or no session is 401 unauthorized, nothing minted", async () => {
    state.authorization = { type: "anonymous" };
    let response = await call();
    expect(response.status).toBe(401);
    expect(await errorOf(response)).toBe("unauthorized");
    state.authorization = { type: "user", userId };
    state.session = null;
    response = await call();
    expect(response.status).toBe(401);
    expect(await errorOf(response)).toBe("unauthorized");
    expect(order).toEqual([]);
  });

  test("a share link's token, a service call and another user's session are 403 forbidden", async () => {
    for (const change of [
      () => (state.authorization = { type: "token" }),
      () => (state.authorization = { type: "service" }),
      () => (state.session = { ...liveSession, userId: "someone-else" }),
    ]) {
      change();
      const response = await call();
      expect(response.status).toBe(403);
      expect(await errorOf(response)).toBe("forbidden");
      state.authorization = { type: "user", userId };
      state.session = { ...liveSession };
    }
    expect(order).toEqual([]);
  });

  test("under observe, a binding of pass, missing or dead is 401 unauthorized and error is 503 unavailable", async () => {
    for (const [outcome, status, error] of [
      ["pass", 401, "unauthorized"],
      ["missing", 401, "unauthorized"],
      ["dead", 401, "unauthorized"],
      ["error", 503, "unavailable"],
    ] as const) {
      state.outcome = outcome;
      const response = await call();
      expect(response.status, outcome).toBe(status);
      expect(await errorOf(response)).toBe(error);
    }
    expect(asked).toEqual([]);
    expect(order).toEqual([]);
  });

  test("a live binding without the session's OrganizeOS user or session is 401 unauthorized", async () => {
    state.session = {
      userId,
      createdAt: 1,
      organizeosUserId: vector.payload.sub,
    };
    expect((await call()).status).toBe(401);
    state.session = { userId, createdAt: 1, organizeosSid: vector.payload.sid };
    expect((await call()).status).toBe(401);
    expect(order).toEqual([]);
  });

  test("asks for view on a GET and edit on a POST and a PUT", async () => {
    await call();
    await call({ method: "POST", splat: `collections/${c}/items`, body: "{}" });
    await call({
      method: "PUT",
      splat: `collections/${c}/items/${i}`,
      body: "{}",
    });
    expect(asked).toEqual(["view", "edit", "edit"]);
  });

  test("without the permit, 403 forbidden, nothing read", async () => {
    state.permits = { view: false, edit: true };
    const response = await call();
    expect(response.status).toBe(403);
    expect(await errorOf(response)).toBe("forbidden");
    state.permits = { view: true, edit: false };
    const write = await call({
      method: "POST",
      splat: `collections/${c}/items`,
      body: "{}",
    });
    expect(write.status).toBe(403);
    expect(order).toEqual([]);
  });

  test("without the secret, or with a blank one, 503 unavailable, nothing read or minted", async () => {
    for (const secret of [undefined, "", "  "]) {
      state.secret = secret;
      const response = await call();
      expect(response.status).toBe(503);
      expect(await errorOf(response)).toBe("unavailable");
    }
    expect(order).toEqual([]);
  });

  test("an owner read that fails is 503 unavailable; a project no org owns is 403 forbidden", async () => {
    state.owner = { failed: true };
    let response = await call();
    expect(response.status).toBe(503);
    expect(await errorOf(response)).toBe("unavailable");
    expect(order).toEqual(["owner"]);
    order = [];
    state.owner = { none: true };
    response = await call();
    expect(response.status).toBe(403);
    expect(await errorOf(response)).toBe("forbidden");
    expect(order).toEqual(["owner"]);
  });

  test("an unmatched path is 404 not_found and is never forwarded", async () => {
    for (const splat of ["nothing", "access/", `collections/${c}/../access`]) {
      order = [];
      const response = await call({ splat });
      expect(response.status, splat).toBe(404);
      expect(await errorOf(response)).toBe("not_found");
      expect(order).toEqual(["owner"]);
    }
    expect(sent).toEqual([]);
  });

  test("an encoded slash, backslash or dot in the request's path is 404, whatever the splat", async () => {
    for (const rawPath of [
      `collections%2F${c}`,
      `collections/${c}%5Citems`,
      `collections/%2E%2E/access`,
      `collections/${c}%2e`,
    ]) {
      const response = await call({ rawPath, splat: `collections/${c}` });
      expect(response.status, rawPath).toBe(404);
      expect(await errorOf(response)).toBe("not_found");
    }
    expect(sent).toEqual([]);
  });

  test("relays the platform's answer byte for byte, private and no-store", async () => {
    const sentBytes =
      '{ "item" : { "updatedAt" : "2026-11-07T10:00:00.123456+00:00" } }';
    state.answer = { kind: "answer", status: 200, bytes: utf8(sentBytes) };
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(sentBytes);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  test("relays a platform 401 with its code, refused and unauthorized each", async () => {
    for (const code of ["refused", "unauthorized"]) {
      const bytes = JSON.stringify({ error: code });
      state.answer = { kind: "answer", status: 401, bytes: utf8(bytes) };
      const response = await call();
      expect(response.status).toBe(401);
      expect(await response.text()).toBe(bytes);
    }
  });

  test("a timeout, a failed send and an answer that is not JSON are 502 unavailable, sent once", async () => {
    for (const answer of [
      { kind: "timeout" },
      { kind: "failed" },
      { kind: "not_json" },
    ] as const) {
      sent = [];
      state.answer = answer;
      const response = await call();
      expect(response.status, answer.kind).toBe(502);
      expect(await errorOf(response)).toBe("unavailable");
      expect(sent).toHaveLength(1);
    }
  });

  test("two requests get two jtis, each a lower-case UUID, and ip is null without an address header", async () => {
    const given = { ...deps(), randomId: randomUUID };
    await call({ with: given });
    await call({ with: given });
    const [first, second] = sent.map((request) => claimsOf(request.header));
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(first.jti).toMatch(uuid);
    expect(second.jti).toMatch(uuid);
    expect(first.jti).not.toBe(second.jti);
    expect(first.ip).toBeNull();
    expect(second.ip).toBeNull();
  });

  test("logs codes only: never the org, the user, the session, the project or the header", async () => {
    await call({ headers: { "x-real-ip": "203.0.113.7" } });
    const header = sent[0].header;
    for (const answer of [
      { kind: "timeout" },
      { kind: "failed" },
      { kind: "not_json" },
    ] as const) {
      state.answer = answer;
      await call({ headers: { "x-real-ip": "203.0.113.7" } });
    }
    state.owner = { failed: true };
    await call();
    state.secret = undefined;
    await call();
    state.outcome = "error";
    await call();
    state.outcome = "dead";
    await call();
    expect(logged.mock.calls).toHaveLength(7);
    for (const args of logged.mock.calls) {
      expect(args).toHaveLength(1);
      expect(args[0]).toMatch(/^\[organizeos-cms\] [a-z_]+$/);
    }
    const text = JSON.stringify(logged.mock.calls);
    for (const value of [
      org,
      vector.payload.sub,
      vector.payload.sid,
      projectId,
      userId,
      header,
      "203.0.113.7",
    ]) {
      expect(text).not.toContain(value);
    }
  });
});

describe("under ORGANIZEOS_SESSION_BINDING=enforce", () => {
  const enforceDeps = (): CmsRouteDeps => ({
    ...deps(),
    readSession: readBuilderSession,
    bindingOutcome: async (session) =>
      (await checkOrganizeosBinding(session)).outcome,
    // createContext answers anonymous when the session read is null, as it
    // then does.
    createContext: async (request) =>
      ({
        authorization:
          (await readBuilderSession(request)) === null
            ? { type: "anonymous" }
            : { type: "user", userId },
      }) as unknown as AppContext,
  });

  beforeEach(() => {
    resetOrganizeosBindingCache();
    authenticator.isAuthenticated.mockReset();
    builderAuthenticator.isAuthenticated.mockReset();
    builderAuthenticator.isAuthenticated.mockResolvedValue({ ...liveSession });
    rpc.mockReset();
    rpc.mockResolvedValue({ data: true, error: null });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  test.each([
    [
      "missing",
      () =>
        builderAuthenticator.isAuthenticated.mockResolvedValue({
          userId,
          createdAt: 1,
        }),
    ],
    ["dead", () => rpc.mockResolvedValue({ data: false, error: null })],
    [
      "error",
      () => rpc.mockResolvedValue({ data: null, error: { message: "down" } }),
    ],
  ])(
    "a %s binding is 401 unauthorized, never 403, nothing minted",
    async (_, arrange) => {
      arrange();
      const response = await call({ with: enforceDeps() });
      expect(response.status).toBe(401);
      expect(await errorOf(response)).toBe("unauthorized");
      expect(order).toEqual([]);
      expect(sent).toEqual([]);
    }
  );

  test("a live binding is forwarded", async () => {
    const response = await call({ with: enforceDeps() });
    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(rpc).toHaveBeenCalled();
  });
});

describe("bodies", () => {
  const send = (
    method: string,
    splat: string,
    body: BodyInit,
    contentType = "application/json"
  ) => call({ method, splat, body, headers: { "content-type": contentType } });

  /** A stream of `chunks` chunks of `size` bytes, read on demand. */
  const countingStream = (chunks: number, size: number, last = 0) => {
    const counter = { pulls: 0, cancelled: false };
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          counter.pulls += 1;
          if (counter.pulls <= chunks) {
            controller.enqueue(new Uint8Array(size).fill(0x61));
          } else if (counter.pulls === chunks + 1 && last > 0) {
            controller.enqueue(new Uint8Array(last).fill(0x61));
          } else {
            controller.close();
          }
        },
        cancel() {
          counter.cancelled = true;
        },
      },
      { highWaterMark: 0 }
    );
    return { stream, counter };
  };

  const multipart = async (form: FormData) => {
    const prepared = new Request("https://example.test/", {
      method: "POST",
      body: form,
    });
    return {
      type: prepared.headers.get("content-type") ?? "",
      bytes: new Uint8Array(await prepared.arrayBuffer()),
    };
  };

  const png = (size: number, name = "a.png") =>
    new File([new Uint8Array(size)], name, { type: "image/png" });

  test("caps a write's body at 2 MB and an upload's at 4 MB plus 64 KB, a file at 4 MB", () => {
    expect(CMS_JSON_BODY_MAX_BYTES).toBe(2_097_152);
    expect(CMS_UPLOAD_BODY_MAX_BYTES).toBe(4_259_840);
    expect(CMS_UPLOAD_FILE_MAX_BYTES).toBe(4_194_304);
  });

  test.each([
    ["POST", `collections/${c}/items`],
    ["PUT", `collections/${c}/items/${i}`],
    ["POST", `collections/${c}/items/${i}/publish`],
    ["POST", `collections/${c}/items/${i}/discard`],
  ])(
    "%s %s forwards its JSON bytes untouched, bound into m, p and h",
    async (method, splat) => {
      const body =
        '{ "expectedUpdatedAt" : "2026-11-07T10:00:00.123456+00:00" }';
      const response = await send(method, splat, body);
      expect(response.status).toBe(200);
      expect(sent).toHaveLength(1);
      expect(new TextDecoder().decode(sent[0].body)).toBe(body);
      expect(sent[0].contentType).toBe("application/json");
      expect(sent[0].timeoutMs).toBe(15_000);
      expect(sent[0].target).toBe(`${base}/${splat}`);
      const claims = claimsOf(sent[0].header);
      expect(claims.m).toBe(method);
      expect(claims.h).toBe(hashCmsBytes(body));
      expect(claims.p).toBe(hashCmsBytes(sent[0].target));
    }
  );

  test("takes application/json with a charset and forwards it as application/json", async () => {
    const response = await send(
      "POST",
      `collections/${c}/items`,
      "{}",
      "Application/JSON; charset=utf-8"
    );
    expect(response.status).toBe(200);
    expect(sent[0].contentType).toBe("application/json");
  });

  test("takes JSON of exactly 2 MB and refuses a byte more, minting nothing", async () => {
    const exact = `"${"a".repeat(2_097_150)}"`;
    expect(utf8(exact).byteLength).toBe(2_097_152);
    expect((await send("POST", `collections/${c}/items`, exact)).status).toBe(
      200
    );
    order = [];
    sent = [];
    const over = `"${"a".repeat(2_097_151)}"`;
    const response = await send("POST", `collections/${c}/items`, over);
    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe("invalid");
    expect(order).not.toContain("mint");
    expect(sent).toEqual([]);
  });

  test("stops reading a body at its cap", async () => {
    const { stream, counter } = countingStream(48, 65_536);
    const response = await send("POST", `collections/${c}/items`, stream);
    expect(response.status).toBe(400);
    expect(counter.pulls).toBeLessThan(48);
    expect(counter.cancelled).toBe(true);
    expect(sent).toEqual([]);
  });

  test("refuses a declared Content-Length over the cap before reading", async () => {
    const { stream, counter } = countingStream(1, 2);
    const response = await call({
      method: "POST",
      splat: `collections/${c}/items`,
      body: stream,
      headers: {
        "content-type": "application/json",
        "content-length": "2097153",
      },
    });
    expect(response.status).toBe(400);
    expect(counter.pulls).toBe(0);
    expect(sent).toEqual([]);
  });

  test.each(["text/plain", "multipart/form-data; boundary=x", ""])(
    "a JSON route refuses a body of type %j",
    async (type) => {
      const response = await send("POST", `collections/${c}/items`, "{}", type);
      expect(response.status).toBe(400);
      expect(await errorOf(response)).toBe("invalid");
      expect(sent).toEqual([]);
    }
  );

  test.each(["{", "", "[1,"])(
    "a JSON route refuses the malformed body %j",
    async (body) => {
      const response = await send("PUT", `collections/${c}/items/${i}`, body);
      expect(response.status).toBe(400);
      expect(sent).toEqual([]);
    }
  );

  test("a JSON route refuses bytes that are not UTF-8", async () => {
    const response = await send(
      "POST",
      `collections/${c}/items`,
      new Uint8Array([0x22, 0xff, 0x22])
    );
    expect(response.status).toBe(400);
    expect(sent).toEqual([]);
  });

  test("a refused body logs nothing", async () => {
    await send("POST", `collections/${c}/items`, "{", "application/json");
    await send("POST", "uploads/image", "{}", "application/json");
    expect(logged).not.toHaveBeenCalled();
  });

  test("forwards an upload with its own Content-Type, boundary included, and a 30 s timeout", async () => {
    const form = new FormData();
    form.append("file", png(4_194_304));
    const { type, bytes } = await multipart(form);
    expect(type).toMatch(/^multipart\/form-data; boundary=/);
    const response = await send("POST", "uploads/image", bytes, type);
    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].contentType).toBe(type);
    expect(Buffer.compare(Buffer.from(sent[0].body!), Buffer.from(bytes))).toBe(
      0
    );
    expect(sent[0].timeoutMs).toBe(30_000);
    expect(sent[0].target).toBe(`${base}/uploads/image`);
    expect(claimsOf(sent[0].header).h).toBe(hashCmsBytes(bytes));
    expect(asked).toEqual(["edit"]);
  });

  test("refuses an upload whose file is over 4 MB, whose body is over 4 MB plus 64 KB, or that is not one part named file", async () => {
    const forms: FormData[] = [];
    const big = new FormData();
    big.append("file", png(4_194_305));
    forms.push(big);
    const two = new FormData();
    two.append("file", png(10));
    two.append("file", png(10, "b.png"));
    forms.push(two);
    const fileAndMore = new FormData();
    fileAndMore.append("file", png(10));
    fileAndMore.append("alt", "x");
    forms.push(fileAndMore);
    const misnamed = new FormData();
    misnamed.append("image", png(10));
    forms.push(misnamed);
    const text = new FormData();
    text.append("file", "not a file");
    forms.push(text);
    for (const form of forms) {
      const { type, bytes } = await multipart(form);
      const response = await send("POST", "uploads/image", bytes, type);
      expect(response.status).toBe(400);
      expect(await errorOf(response)).toBe("invalid");
    }
    // 4 MB plus 64 KB is 65 chunks of 64 KiB: one byte more is refused, its
    // read stopped.
    const { stream, counter } = countingStream(65, 65_536, 1);
    const response = await send(
      "POST",
      "uploads/image",
      stream,
      "multipart/form-data; boundary=b"
    );
    expect(response.status).toBe(400);
    expect(counter.cancelled).toBe(true);
    expect(sent).toEqual([]);
  });

  test("refuses an upload without a boundary", async () => {
    const form = new FormData();
    form.append("file", png(10));
    const { bytes } = await multipart(form);
    for (const type of [
      "multipart/form-data",
      "multipart/form-data; boundary=",
    ]) {
      expect((await send("POST", "uploads/image", bytes, type)).status).toBe(
        400
      );
    }
    expect(sent).toEqual([]);
  });

  test("refuses JSON on the upload route and a multipart body on a JSON route", async () => {
    expect((await send("POST", "uploads/image", "{}")).status).toBe(400);
    const form = new FormData();
    form.append("file", png(10));
    const { type, bytes } = await multipart(form);
    expect(
      (await send("POST", `collections/${c}/items`, bytes, type)).status
    ).toBe(400);
    expect(sent).toEqual([]);
  });

  // Names as Chromium sends them: raw UTF-8 in filename=.
  test.each([
    [
      "a macOS screenshot name (U+202F before AM)",
      "Screenshot 2026-11-10 at 10.00.00 AM.png",
    ],
    ["an accented name with spaces", "café été.png"],
    ["a name holding a quote, as Chromium escapes it", "a%22b.png"],
  ])(
    "forwards an upload named with %s, its bytes untouched",
    async (_, name) => {
      const head = utf8(
        `--b\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: image/png\r\n\r\n`
      );
      const bytes = new Uint8Array([
        ...head,
        ...new Uint8Array(10),
        ...utf8("\r\n--b--\r\n"),
      ]);
      const response = await send(
        "POST",
        "uploads/image",
        bytes,
        "multipart/form-data; boundary=b"
      );
      expect(response.status).toBe(200);
      expect(
        Buffer.compare(Buffer.from(sent[0].body!), Buffer.from(bytes))
      ).toBe(0);
      expect(sent[0].contentType).toBe("multipart/form-data; boundary=b");
      expect(claimsOf(sent[0].header).h).toBe(hashCmsBytes(bytes));
    }
  );
});
