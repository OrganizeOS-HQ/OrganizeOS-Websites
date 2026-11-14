import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import type { Deployment, Instance, Pages, Prop } from "@webstudio-is/sdk";
import formsVector from "~/shared/__fixtures__/forms-actor-assertion.json";
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
import type { BuildForms } from "~/shared/db/organizeos-build-forms.server";
import {
  hashCmsBytes,
  type CmsForwardAnswer,
  type CmsForwardRequest,
} from "~/shared/organizeos-cms.server";
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
  buildForms: BuildForms | undefined;
  formsSecret: string | undefined;
  stageAnswer: CmsForwardAnswer;
};

const ns = "@organizeos/site-components";
const FORM_A = "51000000-0000-4000-8000-000000000001";
const FORM_B = "52000000-0000-4000-8000-000000000002";

type RootSpec = {
  id: string;
  page?: number;
  label?: string;
  marked?: boolean;
  record?: [Prop["type"], unknown];
  fields: Array<[string, Prop["type"], unknown, boolean?]>;
};

/** A build whose pages each hold their roots, each root its Fields. */
const formsBuild = (
  roots: RootSpec[],
  pageNames: string[] = ["Home", "Events"]
): BuildForms => {
  const instances = new Map<string, Instance>();
  const props = new Map<string, Prop>();
  const addProp = (
    instanceId: string,
    name: string,
    type: Prop["type"],
    value: unknown
  ) =>
    props.set(`${instanceId}:${name}`, {
      id: `${instanceId}:${name}`,
      instanceId,
      name,
      type,
      value,
    } as Prop);
  pageNames.forEach((_, index) =>
    instances.set(`body${index}`, {
      type: "instance",
      id: `body${index}`,
      component: "Body",
      children: roots
        .filter((root) => (root.page ?? 0) === index)
        .map((root) => ({ type: "id", value: root.id })),
    })
  );
  for (const root of roots) {
    instances.set(root.id, {
      type: "instance",
      id: root.id,
      component: `${ns}:SignupForm`,
      ...(root.label === undefined ? {} : { label: root.label }),
      children: root.fields.map((_, index) => ({
        type: "id",
        value: `${root.id}-f${index}`,
      })),
    });
    if (root.marked !== false) {
      addProp(root.id, "siteForm", "string", "contact-signup");
    }
    const [recordType, recordValue] = root.record ?? ["string", FORM_A];
    addProp(root.id, "record", recordType, recordValue);
    root.fields.forEach(([key, type, value, required], index) => {
      const id = `${root.id}-f${index}`;
      instances.set(id, {
        type: "instance",
        id,
        component: `${ns}:Field`,
        children: [],
      });
      addProp(id, "field", type, value ?? key);
      if (required !== undefined) {
        addProp(id, "required", "boolean", required);
      }
    });
  }
  const pages = {
    homePageId: "page0",
    rootFolderId: "root",
    folders: new Map(),
    pages: new Map(
      pageNames.map((name, index) => [
        `page${index}`,
        {
          id: `page${index}`,
          name,
          path: index === 0 ? "" : `/p${index}`,
          title: `"${name}"`,
          rootInstanceId: `body${index}`,
          meta: {},
        },
      ])
    ),
  } as unknown as Pages;
  return { instances, props, pages };
};

const emptyBuild = () => formsBuild([]);

let state: State;
let builds: Array<{ projectId: string; deployment: Deployment }>;
let dispatches: OrganizeosPublishInput[];
let addressReads: string[];
let staged: CmsForwardRequest[];
let failedBuilds: string[];
let order: string[];
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
              order.push("dispatch");
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
  loadBuildForms: async () => {
    order.push("load");
    return state.buildForms;
  },
  markBuildFailed: async (buildId) => {
    failedBuilds.push(buildId);
  },
  formsSecret: state.formsSecret,
  now: () => formsVector.payload.iat * 1000,
  randomId: () => formsVector.payload.jti,
  stageForms: async (request) => {
    order.push("stage");
    staged.push(request);
    return state.stageAnswer;
  },
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
    buildForms: emptyBuild(),
    formsSecret: formsVector.secret,
    stageAnswer: {
      kind: "answer",
      status: 200,
      bytes: new TextEncoder().encode('{"forms":[]}'),
    },
  };
  builds = [];
  dispatches = [];
  addressReads = [];
  staged = [];
  failedBuilds = [];
  order = [];
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

// OrganizeOS fork: the publish step (builder forms spec 7.4; plan
// 2026-11-13-builder-forms-fork-p2, Task 3, P2, P3, P6, P7). After the build
// row is written and before the dispatch, the build's marked site-form roots
// are staged with the forms door's F5; an unmarked root publishes as today.
describe("rest.organizeos-publish: staging site forms", () => {
  const org = formsVector.payload.org;
  const target = `/api/internal/websites2/forms/${org}/builds/build-1/fields`;
  const liveSession: SessionData = {
    userId,
    createdAt: 1,
    organizeosUserId: formsVector.payload.sub,
    organizeosSid: formsVector.payload.sid,
  };
  const twoForms = () =>
    formsBuild([
      {
        id: "a",
        label: "Email & SMS updates",
        fields: [
          ["email", "string", undefined, true],
          ["first_name", "string", undefined],
        ],
      },
      {
        id: "b",
        page: 1,
        label: "Contact us",
        record: ["string", FORM_B],
        fields: [["email", "string", undefined, true]],
      },
    ]);
  const refusal = async (response: Response) => ({
    status: response.status,
    body: (await response.json()) as {
      ok: boolean;
      error?: string;
      message?: string;
    },
  });
  const answerOf = (status: number, body: unknown): CmsForwardAnswer => ({
    kind: "answer",
    status,
    bytes: new TextEncoder().encode(JSON.stringify(body)),
  });
  const claimsOf = (header: string) =>
    JSON.parse(Buffer.from(header.split(".")[1], "base64url").toString("utf8"));

  beforeEach(() => {
    state.owner = { organizationId: org };
    state.session = liveSession;
    state.buildForms = twoForms();
  });

  const expectRefused = (failed = true) => {
    expect(dispatches).toEqual([]);
    expect(failedBuilds).toEqual(failed ? ["build-1"] : []);
  };

  test("unmarked roots publish as today: two on one CRM form with different Fields, a bound record, a pass session", async () => {
    state.session = { userId, createdAt: 1 };
    state.outcome = "pass";
    state.buildForms = formsBuild([
      {
        id: "a",
        marked: false,
        fields: [["email", "string", undefined, true]],
      },
      {
        id: "b",
        marked: false,
        fields: [["phone", "expression", "$ws$x"]],
      },
      {
        id: "c",
        marked: false,
        record: ["expression", "$ws$dataSource$y"],
        fields: [["email", "string", undefined]],
      },
    ]);
    const response = await call();
    expect(response.status).toBe(200);
    expect(staged).toEqual([]);
    expect(dispatches).toHaveLength(1);
    expect(failedBuilds).toEqual([]);
  });

  test("a build with no marked roots dispatches without staging", async () => {
    state.buildForms = emptyBuild();
    expect((await call()).status).toBe(200);
    expect(staged).toEqual([]);
    expect(dispatches).toHaveLength(1);
  });

  test("stages before it dispatches, once, with the forms assertion", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(order).toEqual(["load", "stage", "dispatch"]);
    expect(staged).toHaveLength(1);
    const [request] = staged;
    const body = JSON.stringify({
      forms: [
        {
          formId: FORM_A,
          fields: [
            { key: "email", required: true },
            { key: "first_name", required: false },
          ],
        },
        { formId: FORM_B, fields: [{ key: "email", required: true }] },
      ],
    });
    expect(request.method).toBe("PUT");
    expect(request.target).toBe(target);
    expect(new TextDecoder().decode(request.body)).toBe(body);
    expect(request.contentType).toBe("application/json");
    expect(request.timeoutMs).toBe(8_000);
    const claims = claimsOf(request.header);
    expect(claims).toMatchObject({
      aud: "forms",
      org,
      sub: formsVector.payload.sub,
      sid: formsVector.payload.sid,
      m: "PUT",
      p: hashCmsBytes(target),
      h: hashCmsBytes(body),
      jti: formsVector.payload.jti,
      iat: formsVector.payload.iat,
      exp: formsVector.payload.iat + 60,
    });
  });

  test("lower-cases the org in the target and the claim", async () => {
    state.owner = { organizationId: org.toUpperCase() };
    await call();
    expect(staged[0].target).toBe(target);
    expect(claimsOf(staged[0].header).org).toBe(org);
  });

  test("F5's 200 with not_site_form for a marked root dispatches", async () => {
    state.stageAnswer = answerOf(200, {
      forms: [{ formId: FORM_A, outcome: "not_site_form" }],
    });
    expect((await call()).status).toBe(200);
    expect(dispatches).toHaveLength(1);
  });

  test.each([
    [
      "a record bound to an expression",
      { record: ["expression", "$ws$x"] as [Prop["type"], unknown] },
      "Pick a form for Newsletter on Home.",
    ],
    [
      "a blank record",
      { record: ["string", " "] as [Prop["type"], unknown] },
      "Pick a form for Newsletter on Home.",
    ],
    [
      "a Field bound to an expression",
      { fields: [["email", "expression", "$ws$y"]] as RootSpec["fields"] },
      "Pick a field in Newsletter on Home.",
    ],
    [
      "no Field with a key",
      { fields: [] as RootSpec["fields"] },
      "Pick a field in Newsletter on Home.",
    ],
  ])("%s refuses naming the block and page", async (_case, change, line) => {
    state.buildForms = formsBuild([
      {
        id: "a",
        label: "Newsletter",
        fields: [["email", "string", undefined, true]],
        ...change,
      },
    ]);
    expect(await refusal(await call())).toEqual({
      status: 409,
      body: { ok: false, error: "forms", message: line },
    });
    expect(staged).toEqual([]);
    expectRefused();
  });

  test("two roots on one site form that differ refuse, naming both blocks and pages", async () => {
    state.buildForms = formsBuild([
      {
        id: "a",
        label: "Email & SMS updates",
        fields: [["email", "string", undefined, true]],
      },
      {
        id: "b",
        page: 1,
        label: "Email & SMS updates",
        fields: [
          ["email", "string", undefined, true],
          ["phone", "string", undefined],
        ],
      },
    ]);
    expect(await refusal(await call())).toEqual({
      status: 409,
      body: {
        ok: false,
        error: "forms",
        message:
          "Email & SMS updates on Home and Email & SMS updates on Events share a form. Make their fields match or give one a new form.",
      },
    });
    expectRefused();
  });

  test("names are cut to 60 characters, so the message stays under 500", async () => {
    const long = "N".repeat(200);
    state.buildForms = formsBuild(
      [
        { id: "a", label: long, fields: [["email", "string", undefined]] },
        {
          id: "b",
          label: long,
          fields: [["email", "string", undefined, true]],
        },
      ],
      [long]
    );
    const { body } = await refusal(await call());
    expect(body.message).toBe(
      `${"N".repeat(60)} on ${"N".repeat(60)} and ${"N".repeat(60)} on ${"N".repeat(60)} share a form. Make their fields match or give one a new form.`
    );
    expect((body.message ?? "").length).toBeLessThan(500);
  });

  test("too many forms refuses with its own line", async () => {
    state.buildForms = formsBuild([
      {
        id: "a",
        fields: Array.from(
          { length: 51 },
          (_, i) => [`k${i}`, "string", undefined] as RootSpec["fields"][number]
        ),
      },
    ]);
    expect(await refusal(await call())).toEqual({
      status: 409,
      body: {
        ok: false,
        error: "forms",
        message: "Too many forms on this site to publish.",
      },
    });
    expectRefused();
  });

  test.each([
    ["a pass binding", { outcome: "pass" as const }],
    [
      "a live binding without the OrganizeOS session",
      { session: { userId, createdAt: 1, organizeosUserId: "u" } },
    ],
  ])(
    "%s refuses with the sign-in line, staging nothing",
    async (_case, change) => {
      Object.assign(state, change);
      expect(await refusal(await call())).toEqual({
        status: 403,
        body: {
          ok: false,
          error: "forms",
          message: "Sign in through OrganizeOS to publish forms.",
        },
      });
      expect(staged).toEqual([]);
      expectRefused();
    }
  );

  test.each([
    [
      "mfa_required",
      403,
      403,
      "Turn on two-step verification to publish forms.",
    ],
    ["forbidden", 403, 403, "You can't publish forms."],
    // stage two's dead OrganizeOS session, not a permission
    ["unauthorized", 401, 403, "Sign in through OrganizeOS to publish forms."],
    ["plan", 403, 403, "Your plan doesn't include forms."],
    ["rate_limited", 429, 429, "Too many publishes. Try again in a minute."],
    ["replayed", 409, 502, "Forms could not be saved. Try again."],
    ["unavailable", 503, 502, "Forms could not be saved. Try again."],
    ["refused", 401, 502, "Forms could not be saved. Try again."],
  ])("F5 %s answers its line", async (code, status, ours, line) => {
    state.stageAnswer = answerOf(status, { error: code });
    expect(await refusal(await call())).toEqual({
      status: ours,
      body: { ok: false, error: "forms", message: line },
    });
    expectRefused();
  });

  test.each(["invalid_field", "conflict"])(
    "F5 %s with a formId names the first block on that form",
    async (code) => {
      state.stageAnswer = answerOf(code === "conflict" ? 409 : 422, {
        error: code,
        formId: FORM_B.toUpperCase(),
        field: "favourite",
      });
      expect(await refusal(await call())).toEqual({
        status: 409,
        body: {
          ok: false,
          error: "forms",
          message: "Forms could not be saved: Contact us on Events.",
        },
      });
      expectRefused();
    }
  );

  test.each([
    [
      "the door dark (404, empty body)",
      { kind: "not_json" } as CmsForwardAnswer,
    ],
    ["a timeout", { kind: "timeout" } as CmsForwardAnswer],
    ["a failed send", { kind: "failed" } as CmsForwardAnswer],
    ["an unknown code", answerOf(400, { error: "invalid_request" })],
  ])("%s answers the generic line", async (_case, answer) => {
    state.stageAnswer = answer;
    expect(await refusal(await call())).toEqual({
      status: 502,
      body: {
        ok: false,
        error: "forms",
        message: "Forms could not be saved. Try again.",
      },
    });
    expectRefused();
  });

  test("no forms secret answers the generic line, sending nothing", async () => {
    state.formsSecret = " ";
    const { body } = await refusal(await call());
    expect(body.message).toBe("Forms could not be saved. Try again.");
    expect(staged).toEqual([]);
    expectRefused();
  });

  test("a failed build read answers the generic line", async () => {
    state.buildForms = undefined;
    const { status, body } = await refusal(await call());
    expect(status).toBe(502);
    expect(body.message).toBe("Forms could not be saved. Try again.");
    expect(staged).toEqual([]);
    expectRefused();
  });

  test("logs a refusal's code, never its line", async () => {
    state.stageAnswer = answerOf(403, { error: "plan" });
    await call();
    const lines = logged.mock.calls.map((args) => args.join(" "));
    expect(lines).toContain("[organizeos-publish] forms_refused plan");
    expect(lines.join("\n")).not.toContain("include forms");
  });
});
