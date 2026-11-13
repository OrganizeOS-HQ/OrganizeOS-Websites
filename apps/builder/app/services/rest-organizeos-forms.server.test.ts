import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import vector from "~/shared/__fixtures__/forms-actor-assertion.json";
import type { SessionData } from "~/services/auth.server.utils";
import type { OrganizeosBindingOutcome } from "~/services/auth-strategy/organizeos-session.server";
import type { ProjectOrganization } from "~/shared/db/organizeos-project-org.server";
import {
  FORMS_PLATFORM_BASE_PATH,
  cmsCanonicalTarget,
  hashCmsBytes,
  type CmsForwardAnswer,
  type CmsForwardRequest,
} from "~/shared/organizeos-cms.server";
import type { CmsRouteDeps } from "./organizeos-cms-route.server";
import { handleFormsRequest } from "./organizeos-forms-route.server";

// OrganizeOS fork: the forms door's relay (builder forms spec 7.1 and 7.3;
// plan 2026-11-13-builder-forms-fork-p2, Task 1). The CMS door's steps, with
// the forms audience, the forms base path and F0 to F4 only. F5 is the
// publish route's alone.

const projectId = "11111111-1111-4111-8111-111111111111";
const userId = "builder-user";
const org = vector.payload.org;
const base = `${FORMS_PLATFORM_BASE_PATH}/${org}`;
const formId = "51000000-0000-4000-8000-000000000001";

const utf8 = (text: string) => new TextEncoder().encode(text);

type State = {
  enabled: boolean;
  outcome: OrganizeosBindingOutcome;
  permits: { view: boolean; edit: boolean };
  owner: ProjectOrganization;
  answer: CmsForwardAnswer;
};

let state: State;
let sent: CmsForwardRequest[];
let asked: string[];

const session: SessionData = {
  userId,
  createdAt: 1,
  organizeosUserId: vector.payload.sub,
  organizeosSid: vector.payload.sid,
};

const deps = (): CmsRouteDeps & { enabled: boolean } => ({
  enabled: state.enabled,
  checkCsrf: async () => {},
  createContext: async () =>
    ({ authorization: { type: "user", userId } }) as unknown as AppContext,
  readSession: async () => session,
  bindingOutcome: async () => state.outcome,
  hasPermit: async (_projectId, permit) => {
    asked.push(permit);
    return state.permits[permit];
  },
  resolveOrganization: async () => state.owner,
  secret: vector.secret,
  now: () => vector.payload.iat * 1000,
  randomId: () => vector.payload.jti,
  send: async (request) => {
    sent.push(request);
    return state.answer;
  },
});

const call = ({
  method = "GET",
  splat = "access",
  search = "",
  body,
  headers = {},
}: {
  method?: string;
  splat?: string;
  search?: string;
  body?: BodyInit;
  headers?: Record<string, string>;
} = {}) =>
  handleFormsRequest(
    new Request(
      `https://p-${projectId}.builder.organizeos.org/rest/organizeos-forms/${projectId}/${splat}${search}`,
      {
        method,
        headers: {
          "sec-fetch-site": "same-origin",
          "sec-fetch-dest": "empty",
          ...headers,
        },
        ...(body === undefined ? {} : { body, duplex: "half" }),
      } as RequestInit
    ),
    projectId,
    splat,
    deps()
  );

const claimsOf = (header: string) =>
  JSON.parse(Buffer.from(header.split(".")[1], "base64url").toString("utf8"));

const errorOf = async (response: Response) =>
  ((await response.json()) as { error?: string }).error;

beforeEach(() => {
  state = {
    enabled: true,
    outcome: "live",
    permits: { view: true, edit: true },
    owner: { organizationId: org },
    answer: { kind: "answer", status: 200, bytes: utf8('{"ok":true}') },
  };
  sent = [];
  asked = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rest.organizeos-forms", () => {
  test("mints the forms fixture's assertion for its F2 request", async () => {
    const target = new URL(vector.target, "https://app.organizeos.org");
    const response = await call({
      splat: "forms",
      search: target.search,
      headers: { "x-real-ip": vector.payload.ip },
    });
    expect(response.status).toBe(200);
    expect(sent).toEqual([
      {
        method: "GET",
        target: vector.target,
        header: vector.header,
        timeoutMs: 15_000,
      },
    ]);
  });

  test.each([
    ["GET", "access", "", `${base}/access`],
    ["GET", "catalog", "?kind=membership", `${base}/catalog?kind=membership`],
    [
      "GET",
      "forms",
      "?kind=contact-signup",
      `${base}/forms?kind=contact-signup`,
    ],
    ["POST", "forms", "", `${base}/forms`],
    ["PUT", `forms/${formId}/settings`, "", `${base}/forms/${formId}/settings`],
  ])(
    "%s %s%s is sent once to the forms door, aud forms, and relayed as is",
    async (method, splat, search, target) => {
      const body = method === "GET" ? undefined : '{"optIn":"double"}';
      const response = await call({
        method,
        splat,
        search,
        body,
        headers:
          body === undefined ? {} : { "content-type": "application/json" },
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('{"ok":true}');
      expect(sent).toHaveLength(1);
      expect(sent[0].target).toBe(target);
      expect(sent[0].method).toBe(method);
      const claims = claimsOf(sent[0].header);
      expect(claims.aud).toBe("forms");
      expect(claims.org).toBe(org);
      expect(claims.p).toBe(hashCmsBytes(cmsCanonicalTarget(target, [])));
      expect(claims.h).toBe(hashCmsBytes(body ?? ""));
      if (body !== undefined) {
        expect(new TextDecoder().decode(sent[0].body)).toBe(body);
        expect(sent[0].contentType).toBe("application/json");
      }
    }
  );

  test("lower-cases the org in the target and the claim", async () => {
    state.owner = { organizationId: org.toUpperCase() };
    await call();
    expect(sent[0].target).toBe(`${base}/access`);
    expect(claimsOf(sent[0].header).org).toBe(org);
  });

  test("answers 404 not_found with nothing sent while the switch is off", async () => {
    state.enabled = false;
    const response = await call();
    expect(response.status).toBe(404);
    expect(await errorOf(response)).toBe("not_found");
    expect(sent).toEqual([]);
    expect(asked).toEqual([]);
  });

  test.each([
    ["GET", "collections", ""],
    ["PUT", "builds/b1/fields", ""],
    ["GET", "forms", "?kind=other"],
    ["GET", "forms", "?kind=membership&x=1"],
    ["GET", "forms", ""],
    ["GET", "catalog", ""],
    ["GET", "access", "?kind=membership"],
    ["PUT", "forms/AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA/settings", ""],
    ["POST", `forms/${formId}/settings`, ""],
  ])("%s %s%s answers 404 with nothing sent", async (method, splat, search) => {
    const body = method === "GET" ? undefined : "{}";
    const response = await call({
      method,
      splat,
      search,
      body,
      headers: body === undefined ? {} : { "content-type": "application/json" },
    });
    expect(response.status).toBe(404);
    expect(sent).toEqual([]);
  });

  test("a GET needs the view permit, a POST or PUT the edit permit", async () => {
    state.permits = { view: false, edit: true };
    expect((await call()).status).toBe(403);
    state.permits = { view: true, edit: false };
    const post = await call({
      method: "POST",
      splat: "forms",
      body: "{}",
      headers: { "content-type": "application/json" },
    });
    expect(post.status).toBe(403);
    expect(asked).toEqual(["view", "edit"]);
    expect(sent).toEqual([]);
  });

  test("a JSON body over 65,536 bytes is 400 invalid", async () => {
    const big = `{"title":"${"a".repeat(65_536)}"}`;
    const response = await call({
      method: "POST",
      splat: "forms",
      body: big,
      headers: { "content-type": "application/json" },
    });
    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe("invalid");
    expect(sent).toEqual([]);
  });

  test("a binding that is not live is 401 unauthorized", async () => {
    state.outcome = "pass";
    const response = await call();
    expect(response.status).toBe(401);
    expect(sent).toEqual([]);
  });
});
