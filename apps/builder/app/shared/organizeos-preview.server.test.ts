import { beforeEach, describe, expect, test, vi } from "vitest";
import { ORGANIZEOS_SERVICE_PROVIDER } from "@webstudio-is/trpc-interface/index.server";
import type { SessionData } from "~/services/auth.server.utils";
import vector from "./__fixtures__/preview-assertion.json";
import {
  createPreviewAssertion,
  isPreviewableUrl,
  mintPreviewAssertion,
  PREVIEW_HEADER,
  resetPreviewOrgCache,
  type PreviewDeps,
} from "./organizeos-preview.server";

const appUrl = "https://app.organizeos.org";
const projectId = "11111111-1111-4111-8111-111111111111";
const orgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sub = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const sid = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const builderRequest = new Request(
  `https://p-${projectId}.builder.organizeos.org/rest/resources-loader`,
  { method: "POST" }
);
const collectionsUrl = `${appUrl}/api/public/v1/collections/news/items`;
const nowMs = 1_793_016_000_500;

const session: SessionData = {
  userId: "builder-user-1",
  createdAt: 0,
  organizeosSid: sid,
  organizeosUserId: sub,
};

const makeDeps = (overrides: Partial<PreviewDeps> = {}): PreviewDeps => ({
  secret: vector.secret,
  appUrl,
  now: () => nowMs,
  readSession: vi.fn(async () => session),
  isSessionLive: vi.fn(async () => true),
  canViewProject: vi.fn(async () => true),
  loadProjectOwner: vi.fn(async () => ({
    provider: ORGANIZEOS_SERVICE_PROVIDER,
    email: `org+${orgId}@svc.organizeos.internal`,
  })),
  ...overrides,
});

const headerOf = (init: RequestInit | undefined) =>
  new Headers(init?.headers).get(PREVIEW_HEADER);

const decode = (header: string) =>
  JSON.parse(Buffer.from(header.split(".")[1], "base64url").toString("utf8"));

beforeEach(() => {
  resetPreviewOrgCache();
});

describe("mintPreviewAssertion", () => {
  test("matches the platform's test vector byte for byte", () => {
    const header = mintPreviewAssertion(vector.payload, vector.secret);
    expect(header).toBe(vector.header);
    const [version, segment, mac] = header.split(".");
    expect(version).toBe("v1");
    expect(segment).toBe(vector.payloadSegment);
    expect(mac).toBe(vector.mac);
  });

  test("writes the keys in the order org, sub, sid, iat, exp", () => {
    const header = mintPreviewAssertion(
      // a different insertion order must not change the bytes
      {
        exp: vector.payload.exp,
        iat: vector.payload.iat,
        sid: vector.payload.sid,
        sub: vector.payload.sub,
        org: vector.payload.org,
      },
      vector.secret
    );
    expect(header).toBe(vector.header);
  });
});

describe("isPreviewableUrl", () => {
  test.each([
    `${appUrl}/api/public/v1/collections/news/items`,
    `${appUrl}/api/public/v1/collections/news/items?limit=10`,
    // an item page's Resource (organizeos-panel/collection-pages.ts)
    `${appUrl}/api/public/v1/collections/news/items/first-post`,
    `${appUrl}/api/public/v1/collections/`,
    "https://APP.organizeos.org:443/api/public/v1/collections/news",
  ])("accepts %s", (href) => {
    expect(isPreviewableUrl(href, appUrl)).toBe(true);
  });

  test.each([
    ["another /v1 path", `${appUrl}/api/public/v1/events`],
    ["the collections list itself", `${appUrl}/api/public/v1/collections`],
    ["another host", "https://evil.example/api/public/v1/collections/news"],
    [
      "an app subdomain",
      "https://acme.app.organizeos.org/api/public/v1/collections/news",
    ],
    [
      "userinfo naming the app",
      "https://app.organizeos.org@evil.example/api/public/v1/collections/news",
    ],
    [
      "userinfo on the app's own host",
      "https://user:pass@app.organizeos.org/api/public/v1/collections/news",
    ],
    ["plain http", "http://app.organizeos.org/api/public/v1/collections/news"],
    ["another port", `${appUrl}:8443/api/public/v1/collections/news`],
    [
      "an encoded slash",
      `${appUrl}/api/public/v1/collections/news%2F..%2F..%2Fadmin`,
    ],
    [
      "an encoded dot segment",
      `${appUrl}/api/public/v1/collections/%2e%2e/%2e%2e/admin`,
    ],
    ["an encoded backslash", `${appUrl}/api/public/v1/collections/a%5cb`],
    ["a relative URL", "/api/public/v1/collections/news"],
    ["a local resource", "/$resources/assets"],
    ["garbage", "not a url"],
  ])("refuses %s", (_case, href) => {
    expect(isPreviewableUrl(href, appUrl)).toBe(false);
  });
});

describe("createPreviewAssertion", () => {
  test("mints under every condition, with exp 60 s after iat in Unix seconds", async () => {
    const deps = makeDeps();
    const init = await createPreviewAssertion(builderRequest, deps)(
      collectionsUrl,
      { method: "get", headers: new Headers({ Authorization: "Bearer t" }) }
    );
    const header = headerOf(init);
    expect(header).not.toBeNull();
    expect(decode(header!)).toEqual({
      org: orgId,
      sub,
      sid,
      iat: 1_793_016_000,
      exp: 1_793_016_060,
    });
    expect(Object.keys(decode(header!))).toEqual([
      "org",
      "sub",
      "sid",
      "iat",
      "exp",
    ]);
    expect(header).toBe(
      mintPreviewAssertion(
        { org: orgId, sub, sid, iat: 1_793_016_000, exp: 1_793_016_060 },
        vector.secret
      )
    );
    // the stored headers and the method are kept
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer t");
    expect(init?.method).toBe("get");
    expect(deps.canViewProject).toHaveBeenCalledWith(
      builderRequest,
      "builder-user-1",
      projectId
    );
  });

  test("replaces a stored X-OOS-Preview under any casing, never appends", async () => {
    const stored = new Headers();
    stored.append("x-oos-preview", "v1.forged.one");
    stored.append("X-OOS-PREVIEW", "v1.forged.two");
    const init = await createPreviewAssertion(builderRequest, makeDeps())(
      collectionsUrl,
      { headers: stored }
    );
    const header = headerOf(init);
    expect(header).not.toContain(",");
    expect(header).not.toContain("forged");
    expect(header?.split(".")).toHaveLength(3);
  });

  test.each([
    ["no secret", { secret: undefined }],
    ["a blank secret", { secret: "" }],
    ["no builder session", { readSession: async () => null }],
    [
      "a session with no OrganizeOS binding",
      {
        readSession: async () => ({ userId: "builder-user-1", createdAt: 0 }),
      },
    ],
    ["a binding that is not live", { isSessionLive: async () => false }],
    ["no view access to the project", { canViewProject: async () => false }],
    ["a project no org owns", { loadProjectOwner: async () => null }],
    [
      "a project a human owns",
      {
        loadProjectOwner: async () => ({
          provider: "google",
          email: `org+${orgId}@svc.organizeos.internal`,
        }),
      },
    ],
    [
      "a service owner whose email names no org",
      {
        loadProjectOwner: async () => ({
          provider: ORGANIZEOS_SERVICE_PROVIDER,
          email: "someone@example.com",
        }),
      },
    ],
    [
      "a lookup that fails",
      {
        loadProjectOwner: async () => {
          throw new Error("postgrest down");
        },
      },
    ],
  ])("does not mint with %s", async (_case, overrides) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const init = { headers: new Headers({ Accept: "application/json" }) };
    const result = await createPreviewAssertion(
      builderRequest,
      makeDeps(overrides as Partial<PreviewDeps>)
    )(collectionsUrl, init);
    expect(result).toBe(init);
    expect(headerOf(result)).toBeNull();
  });

  test("does not mint off the p-{projectId} host", async () => {
    const deps = makeDeps();
    const result = await createPreviewAssertion(
      new Request("https://builder.organizeos.org/rest/resources-loader"),
      deps
    )(collectionsUrl, undefined);
    expect(headerOf(result)).toBeNull();
    expect(deps.canViewProject).not.toHaveBeenCalled();
  });

  test.each([
    `${appUrl}/api/public/v1/events`,
    "https://evil.example/api/public/v1/collections/news/items",
    "https://app.organizeos.org@evil.example/api/public/v1/collections/news",
  ])("does not mint, or read the session, for %s", async (href) => {
    const deps = makeDeps();
    const result = await createPreviewAssertion(builderRequest, deps)(
      href,
      undefined
    );
    expect(headerOf(result)).toBeNull();
    expect(deps.readSession).not.toHaveBeenCalled();
  });

  test("resolves the grant once per request and mints per fetch", async () => {
    let now = nowMs;
    const deps = makeDeps({ now: () => now });
    const withPreview = createPreviewAssertion(builderRequest, deps);
    const first = headerOf(await withPreview(collectionsUrl, undefined));
    now += 5_000;
    const second = headerOf(
      await withPreview(`${appUrl}/api/public/v1/collections/team/items`)
    );
    expect(decode(first!).iat).toBe(1_793_016_000);
    expect(decode(second!).iat).toBe(1_793_016_005);
    expect(deps.readSession).toHaveBeenCalledTimes(1);
    expect(deps.canViewProject).toHaveBeenCalledTimes(1);
  });

  test("caches the project's org for 60 s", async () => {
    let now = nowMs;
    const deps = makeDeps({ now: () => now });
    await createPreviewAssertion(builderRequest, deps)(collectionsUrl);
    now += 59_000;
    await createPreviewAssertion(builderRequest, deps)(collectionsUrl);
    expect(deps.loadProjectOwner).toHaveBeenCalledTimes(1);
    now += 2_000;
    await createPreviewAssertion(builderRequest, deps)(collectionsUrl);
    expect(deps.loadProjectOwner).toHaveBeenCalledTimes(2);
  });
});
