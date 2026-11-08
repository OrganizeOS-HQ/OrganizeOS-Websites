import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import type { Deployment } from "@webstudio-is/sdk";
import targetsFixture from "~/shared/__fixtures__/site-addresses-targets.json";
import oldSiteFixture from "~/shared/__fixtures__/site-addresses-old-site.json";
import type { SessionData } from "~/services/auth.server.utils";
import type { OrganizeosBindingOutcome } from "~/services/auth-strategy/organizeos-session.server";
import type {
  OrganizeosPublishInput,
  OrganizeosPublishResult,
} from "~/services/organizeos-publisher.server";
import type { SiteAddressesRow } from "~/shared/db/organizeos-site-addresses.server";
import type { ProjectOrganization } from "~/shared/db/organizeos-project-org.server";
import {
  handlePublishRequest,
  type PublishRouteDeps,
} from "./organizeos-publish-route.server";

// OrganizeOS fork: the Publish dialog's publish to the ticked addresses. The
// route decides who may publish, checks every ticked address against the
// org's own addresses read, writes the build row as before and dispatches the
// read's keys.

const projectId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherOrganizationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userId = "builder-user";

const fixtureRow = targetsFixture[0] as SiteAddressesRow;

type State = {
  authorization: { type: string; userId?: string };
  session: SessionData | null;
  outcome: OrganizeosBindingOutcome;
  admin: boolean;
  owner: ProjectOrganization;
  row: SiteAddressesRow | undefined;
  domain: string | undefined;
  buildError: Error | undefined;
  publisher: boolean;
  publishResult: OrganizeosPublishResult | Error;
};

let state: State;
let builds: Array<{ projectId: string; deployment: Deployment }>;
let dispatches: OrganizeosPublishInput[];
let addressReads: string[];
let logged: ReturnType<typeof vi.spyOn>;

const deps = (): PublishRouteDeps => ({
  checkCsrf: async () => {},
  createContext: async () =>
    ({ authorization: state.authorization }) as unknown as AppContext,
  readSession: async () => state.session,
  bindingOutcome: async () => state.outcome,
  hasAdminPermit: async () => state.admin,
  resolveOrganization: async () => state.owner,
  fetchAddresses: async (organization) => {
    addressReads.push(organization);
    return state.row;
  },
  loadProjectDomain: async () => state.domain,
  createBuild: async (props) => {
    if (state.buildError !== undefined) {
      throw state.buildError;
    }
    builds.push(props);
    return { id: "build-1" };
  },
  getPublisher: () =>
    state.publisher
      ? {
          publish: {
            mutate: async (input) => {
              dispatches.push(input);
              if (state.publishResult instanceof Error) {
                throw state.publishResult;
              }
              return state.publishResult;
            },
          },
          unpublish: {
            mutate: async () => ({ success: false as const, error: "" }),
          },
        }
      : undefined,
  publisherHost: "organizeos.org",
  platformUrl: "https://app.organizeos.org",
});

const call = async ({
  body = { targets: ["builtin", "www.example.org"] } as unknown,
  method = "POST",
  destination = "empty",
  rawBody,
}: {
  body?: unknown;
  method?: string;
  destination?: string;
  rawBody?: string;
} = {}) => {
  const request = new Request(
    `https://p-${projectId}.builder.organizeos.org/rest/organizeos-publish/${projectId}`,
    {
      method,
      headers: {
        "sec-fetch-site": "same-origin",
        "sec-fetch-dest": destination,
        "content-type": "application/json",
      },
      ...(method === "GET" ? {} : { body: rawBody ?? JSON.stringify(body) }),
    }
  );
  return handlePublishRequest(request, projectId, deps());
};

const expectNothingWritten = () => {
  expect(builds).toEqual([]);
  expect(dispatches).toEqual([]);
};

beforeEach(() => {
  state = {
    authorization: { type: "user", userId },
    session: { userId, createdAt: 1 },
    outcome: "live",
    admin: true,
    owner: { organizationId },
    row: fixtureRow,
    domain: "example-org",
    buildError: undefined,
    publisher: true,
    publishResult: { success: true },
  };
  builds = [];
  dispatches = [];
  addressReads = [];
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rest.organizeos-publish", () => {
  test("a publish to the built-in and the main writes one build as before and dispatches their keys", async () => {
    const response = await call();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(builds).toEqual([
      {
        projectId,
        deployment: {
          destination: "saas",
          target: "production",
          domains: ["example-org"],
          assetsDomain: "example-org",
          excludeWstdDomainFromSearch: false,
        },
      },
    ]);
    expect(dispatches).toEqual([
      {
        buildId: "build-1",
        destination: "saas",
        targets: ["builtin", "www.example.org"],
        expectedOrganizationId: organizationId,
      },
    ]);
  });

  test("a domain served on www is sent by its served host, in the read's order", async () => {
    await call({ body: { targets: ["example.net", "www.example.org"] } });
    expect(dispatches[0].targets).toEqual(["www.example.org", "example.net"]);
  });

  test("reads the org from the project's owner, whatever the body says", async () => {
    const response = await call({
      body: {
        targets: ["builtin"],
        organizationId: otherOrganizationId,
      },
    });
    // an extra key is refused by the strict body
    expect(response.status).toBe(400);
    await call({ body: { targets: ["builtin"] } });
    expect(addressReads).toEqual([organizationId]);
  });

  test.each([
    ["no session", { authorization: { type: "anonymous" } }],
    ["a share link's token", { authorization: { type: "token" } }],
    ["no builder session", { session: null }],
    [
      "a builder session of another user",
      { session: { userId: "someone-else", createdAt: 1 } },
    ],
    ["a missing binding", { outcome: "missing" as const }],
    ["a dead binding", { outcome: "dead" as const }],
    ["a binding the check could not read", { outcome: "error" as const }],
    ["a view or build permit only", { admin: false }],
    ["a project no org owns", { owner: { none: true as const } }],
  ])("is refused with 403, writing nothing, for %s", async (_name, change) => {
    Object.assign(state, change);
    const response = await call();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false });
    expectNothingWritten();
  });

  test("a live binding is required in either binding mode: the readers' observe allowance does not reach here", async () => {
    // readBuilderSession returns the session under observe whatever its
    // outcome; the route asks for the outcome itself
    for (const outcome of ["missing", "dead", "error"] as const) {
      state.outcome = outcome;
      expect((await call()).status, outcome).toBe(403);
    }
    // SSO not configured: local development
    state.outcome = "pass";
    expect((await call()).status).toBe(200);
  });

  test.each([
    ["an empty list", { targets: [] }],
    [
      "21 keys",
      {
        targets: Array.from({ length: 21 }, (_, index) => `d${index}.example`),
      },
    ],
    ["a duplicate", { targets: ["builtin", "builtin"] }],
    ["an upper-case key", { targets: ["Builtin"] }],
    ["a schemed host", { targets: ["https://example.net"] }],
    ["a host with a port", { targets: ["example.net:443"] }],
    ["a key that is not a string", { targets: [1] }],
    ["no targets", {}],
    ["targets that are not a list", { targets: "builtin" }],
  ])("is refused with 400, writing nothing, for %s", async (_name, body) => {
    const response = await call({ body });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: "invalid_request",
    });
    expectNothingWritten();
  });

  test("is refused with 400 for a body that is not JSON or is too large", async () => {
    expect((await call({ rawBody: "not json" })).status).toBe(400);
    const large = JSON.stringify({
      targets: ["builtin"],
      pad: "x".repeat(5000),
    });
    expect((await call({ rawBody: large })).status).toBe(400);
    expectNothingWritten();
  });

  test("a key that is not one of the org's targets refuses the whole publish with 409", async () => {
    for (const targets of [
      ["builtin", "another-org.example"],
      ["example.org.evil"],
      // the main's stored host is not its key: a publish names it as served
      ["example.org"],
    ]) {
      const response = await call({ body: { targets } });
      expect(response.status, targets.join()).toBe(409);
      expect(await response.json()).toEqual({
        ok: false,
        error: "unknown_target",
      });
    }
    expectNothingWritten();
  });

  test("a read that failed answers 503 addresses_unavailable, and one without targets 503 targets_unavailable", async () => {
    state.row = undefined;
    let response = await call();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      error: "addresses_unavailable",
    });

    state.row = { ...fixtureRow, targets: undefined };
    response = await call();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      error: "targets_unavailable",
    });

    state.row = fixtureRow;
    state.owner = { failed: true };
    response = await call();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      error: "addresses_unavailable",
    });
    expectNothingWritten();
  });

  test("with no publisher configured it answers 503 publish_unavailable and writes no build", async () => {
    state.publisher = false;
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      error: "publish_unavailable",
    });
    expectNothingWritten();
  });

  test("a build the builder refuses answers 422 and dispatches nothing", async () => {
    state.buildError = new Error(
      "Cannot publish: the property of instance 1234 is broken"
    );
    const response = await call();
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      ok: false,
      error: "build_refused",
    });
    expect(dispatches).toEqual([]);
    expect(logged.mock.calls).toEqual([
      ["[organizeos-publish] build_refused Error"],
    ]);
  });

  test("a dispatch failure answers 502 with the publisher's own message", async () => {
    state.publishResult = {
      success: false,
      error: "Publishing could not be started. Please try again.",
    };
    const response = await call();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      ok: false,
      error: "dispatch_failed",
      message: "Publishing could not be started. Please try again.",
    });

    state.publishResult = new Error("socket hang up at api.example: detail");
    const thrown = await call();
    expect(thrown.status).toBe(502);
    expect(await thrown.json()).toEqual({
      ok: false,
      error: "dispatch_failed",
    });
  });

  test("a build the publisher resolves to another org answers 409", async () => {
    state.publishResult = {
      success: false,
      error: "This project cannot be published.",
      organizationMismatch: true,
    };
    const response = await call();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false });
  });

  test("no answer or log line carries a host, the org id or an upstream message", async () => {
    const answers: string[] = [];
    const scenarios: Array<Partial<State> & { body?: unknown }> = [
      {},
      { body: { targets: ["another-org.example"] } },
      { row: undefined },
      { row: { ...fixtureRow, targets: undefined } },
      { publisher: false },
      { buildError: new Error("detail-from-upstream example.net") },
      { publishResult: new Error("detail-from-upstream example.net") },
      { outcome: "dead" },
    ];
    for (const { body, ...change } of scenarios) {
      Object.assign(state, change);
      const response = await call(body === undefined ? {} : { body });
      answers.push(await response.text());
      state.row = fixtureRow;
      state.publisher = true;
      state.buildError = undefined;
      state.publishResult = { success: true };
      state.outcome = "live";
    }
    const lines = logged.mock.calls.map((args) => args.join(" "));
    for (const text of [...answers, ...lines]) {
      for (const secret of [
        organizationId,
        "example.org",
        "example.net",
        "another-org.example",
        "detail-from-upstream",
        projectId,
      ]) {
        expect(text).not.toContain(secret);
      }
    }
  });

  test("every answer is private and never stored", async () => {
    for (const response of [
      await call(),
      await call({ body: {} }),
      await (async () => {
        state.admin = false;
        return call();
      })(),
    ]) {
      const cacheControl = response.headers.get("Cache-Control") ?? "";
      expect(cacheControl).toContain("private");
      expect(cacheControl).toContain("no-store");
    }
  });

  test("a GET answers 405 and does nothing", async () => {
    const response = await call({ method: "GET" });
    expect(response.status).toBe(405);
    expectNothingWritten();
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
    expectNothingWritten();
  });
});

vi.mock("~/shared/context.server", () => ({
  createContext: async () => {
    throw new Error("the route module's test never reads a context");
  },
}));

describe("the route module", () => {
  test("answers a GET with 405, private, and has an action for the POST", async () => {
    const route = await import("../routes/rest.organizeos-publish.$projectId");
    const response = route.loader();
    expect(response.status).toBe(405);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(typeof route.action).toBe("function");
    // The first import of the route's graph (the build and session modules)
    // takes seconds, too close to the default 5 s on a busy machine.
  }, 30_000);
});

// The organization's old site: its custom main still serves it. The built-in
// alone is a trial copy; any custom address replaces the old site, which needs
// the admin's confirm and the address serving it.
describe("rest.organizeos-publish: replacing the old site", () => {
  const oldSiteRow = oldSiteFixture[0] as SiteAddressesRow;

  test("publishes the built-in alone as a trial copy, with no flag", async () => {
    state.row = oldSiteRow;
    const response = await call({ body: { targets: ["builtin"] } });
    expect(response.status).toBe(200);
    expect(dispatches).toHaveLength(1);
    expect(dispatches[0].targets).toEqual(["builtin"]);
    expect("replacePages" in dispatches[0]).toBe(false);
  });

  test("refuses a custom address without the confirm, writing nothing", async () => {
    state.row = oldSiteRow;
    const response = await call({ body: { targets: ["www.example.org"] } });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: "replace_unconfirmed",
    });
    expectNothingWritten();
  });

  test("dispatches replacePages with the confirm and the address serving the old site", async () => {
    state.row = oldSiteRow;
    const response = await call({
      body: { targets: ["builtin", "www.example.org"], replacePages: true },
    });
    expect(response.status).toBe(200);
    expect(dispatches[0]).toMatchObject({
      targets: ["builtin", "www.example.org"],
      replacePages: true,
    });
  });

  test("refuses a replace without the address serving the old site", async () => {
    const [source] = oldSiteFixture;
    state.row = {
      ...source,
      targets: [
        ...source.targets,
        {
          key: "example.net",
          host: "example.net",
          main: false,
          published_at: null,
          unpublished_at: null,
          live: false,
          serving: false,
        },
      ],
    } as SiteAddressesRow;
    const response = await call({
      body: { targets: ["example.net"], replacePages: true },
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: "old_site_needs_main",
    });
    expectNothingWritten();
  });

  test("with the built-in serving the old site, the built-in needs the confirm too", async () => {
    state.row = { ...oldSiteRow, old_site_key: "builtin" } as SiteAddressesRow;
    expect((await call({ body: { targets: ["builtin"] } })).status).toBe(409);
    expectNothingWritten();
    const response = await call({
      body: { targets: ["builtin"], replacePages: true },
    });
    expect(response.status).toBe(200);
    expect(dispatches[0]).toMatchObject({ replacePages: true });
  });

  test("refuses the flag when the organization no longer shows an old site", async () => {
    const response = await call({
      body: { targets: ["builtin"], replacePages: true },
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: "old_site_changed",
    });
    expectNothingWritten();
  });

  test("refuses replacePages false by the strict body", async () => {
    state.row = oldSiteRow;
    expect(
      (await call({ body: { targets: ["builtin"], replacePages: false } }))
        .status
    ).toBe(400);
    expectNothingWritten();
  });
});
