import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRequestHandler, type ServerBuild } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import * as entry from "~/entry.server";
import {
  expireLegacySessionCookies,
  legacySessionCookieNames,
  legacySessionDeletes,
} from "./organizeos-legacy-session.server";

const flag = "ORGANIZEOS_EXPIRE_LEGACY_SESSION";

// A server build with the builder's own entry: a root, a document route
// standing in for the canvas (it sets a cookie of its own, as builder routes
// do), and a resource route standing in for an asset.
const routeEntry = (
  id: string,
  init: { parentId?: string; path?: string; hasLoader: boolean }
) => ({
  id,
  parentId: init.parentId,
  path: init.path,
  index: undefined,
  caseSensitive: undefined,
  hasAction: false,
  hasLoader: init.hasLoader,
  hasClientAction: false,
  hasClientLoader: false,
  hasErrorBoundary: false,
  module: `/${id}.js`,
  imports: [],
});

const Root = () => (
  <html>
    <body>
      <Outlet />
    </body>
  </html>
);

const build = {
  mode: "production",
  basename: undefined,
  publicPath: "/build/",
  assetsBuildDirectory: "build/client",
  isSpaMode: false,
  future: {},
  entry: { module: entry },
  routes: {
    root: {
      id: "root",
      path: "",
      module: { default: Root },
    },
    canvas: {
      id: "canvas",
      parentId: "root",
      path: "canvas",
      module: {
        loader: () => ({}),
        headers: () => ({ "Set-Cookie": "_csrf=1; Path=/; HttpOnly" }),
        default: () => <p>canvas</p>,
      },
    },
    asset: {
      id: "asset",
      parentId: "root",
      path: "cgi/asset/*",
      module: {
        loader: () =>
          new Response("asset", { headers: { "Content-Type": "image/png" } }),
      },
    },
  },
  assets: {
    entry: { imports: [], module: "/entry.client.js" },
    routes: {
      root: routeEntry("root", { path: "", hasLoader: false }),
      canvas: routeEntry("canvas", {
        parentId: "root",
        path: "canvas",
        hasLoader: true,
      }),
      asset: routeEntry("asset", {
        parentId: "root",
        path: "cgi/asset/*",
        hasLoader: true,
      }),
    },
    url: "/manifest.js",
    version: "1",
  },
} as unknown as ServerBuild;

const handle = createRequestHandler(build, "production");

const canvasHost = "https://p-0b7a5f2e-builder.builder.organizeos.org";

const get = (url: string, cookie: string) =>
  handle(new Request(url, { headers: { Cookie: cookie } }));

const carried = "sb-abc-auth-token.0=x; sb-abc-auth-token.1=y; _ga=GA1.2.3";

const chunkDeletes = [
  "sb-abc-auth-token.0=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure; Domain=.organizeos.org",
  "sb-abc-auth-token.0=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure",
  "sb-abc-auth-token.1=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure; Domain=.organizeos.org",
  "sb-abc-auth-token.1=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure",
];

describe("old session cookies, flag on", () => {
  beforeEach(() => {
    vi.stubEnv(flag, "true");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("a canvas document deletes each chunk twice, after the route's own cookie, and nothing for _ga", async () => {
    const response = await get(`${canvasHost}/canvas`, carried);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html");
    expect(response.headers.getSetCookie()).toEqual([
      "_csrf=1; Path=/; HttpOnly",
      ...chunkDeletes,
    ]);
    expect(response.headers.getSetCookie().join("\n")).not.toContain("_ga");
  });

  test("the builder's own host deletes them too", async () => {
    const response = await get(
      "https://builder.organizeos.org/canvas",
      carried
    );

    expect(response.headers.getSetCookie()).toEqual([
      "_csrf=1; Path=/; HttpOnly",
      ...chunkDeletes,
    ]);
  });

  test("an asset response carries no deletes", async () => {
    const response = await get(`${canvasHost}/cgi/asset/logo.png`, carried);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  test("a host outside organizeos.org carries no deletes", async () => {
    for (const host of [
      "https://builder.example.org",
      "https://organizeos.org.example.com",
      "https://notorganizeos.org",
    ]) {
      const response = await get(`${host}/canvas`, carried);
      expect(response.headers.getSetCookie(), host).toEqual([
        "_csrf=1; Path=/; HttpOnly",
      ]);
    }
  });

  test("a document for a request without old cookies carries none", async () => {
    const response = await get(`${canvasHost}/canvas`, "_ga=GA1.2.3");

    expect(response.headers.getSetCookie()).toEqual([
      "_csrf=1; Path=/; HttpOnly",
    ]);
  });

  test("a second render with the same headers adds no second copy", () => {
    // Remix renders a document again with the same headers after an error.
    const headers = new Headers();
    const request = new Request(`${canvasHost}/canvas`, {
      headers: { Cookie: carried },
    });
    expireLegacySessionCookies(request, headers);
    expireLegacySessionCookies(request, headers);

    expect(headers.getSetCookie()).toEqual(chunkDeletes);
  });
});

describe("old session cookies, flag off", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test.each([
    ["unset", undefined],
    ["empty", ""],
    ["false", "false"],
    ["1", "1"],
  ])(
    "a canvas document carries no deletes when the flag is %s",
    async (_label, value) => {
      vi.stubEnv(flag, value);

      const response = await get(`${canvasHost}/canvas`, carried);

      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie()).toEqual([
        "_csrf=1; Path=/; HttpOnly",
      ]);
    }
  );
});

describe("legacySessionCookieNames", () => {
  const names = (cookie: string) =>
    legacySessionCookieNames(
      new Request("https://builder.organizeos.org/", {
        headers: { Cookie: cookie },
      })
    );

  test("matches the old session, its chunks and its code verifier", () => {
    expect(
      names(
        [
          "sb-btncogjbqwvbprsllonl-auth-token=a",
          "sb-btncogjbqwvbprsllonl-auth-token.0=b",
          "sb-btncogjbqwvbprsllonl-auth-token.12=c",
          "sb-btncogjbqwvbprsllonl-auth-token-code-verifier=d",
          "sb-staging1-auth-token-code-verifier.0=e",
        ].join("; ")
      )
    ).toEqual([
      "sb-btncogjbqwvbprsllonl-auth-token",
      "sb-btncogjbqwvbprsllonl-auth-token.0",
      "sb-btncogjbqwvbprsllonl-auth-token.12",
      "sb-btncogjbqwvbprsllonl-auth-token-code-verifier",
      "sb-staging1-auth-token-code-verifier.0",
    ]);
  });

  test("leaves every other name alone, the new session's among them", () => {
    expect(
      names(
        [
          "__Host-oos-auth=a",
          "oos-auth=b",
          "_ga=c",
          "_session=d",
          "sb-ABC-auth-token=e",
          "sb--auth-token=f",
          "sb-abc-auth-token.01=g",
          "sb-abc-auth-token.=h",
          "sb-abc-auth-token-x=i",
          "xsb-abc-auth-token=j",
          "sb-abc-auth-tokens=k",
          "sb-abc-refresh-token=l",
        ].join("; ")
      )
    ).toEqual([]);
  });

  test("names a cookie the request carried twice once", () => {
    expect(names("sb-abc-auth-token=a; sb-abc-auth-token=b")).toEqual([
      "sb-abc-auth-token",
    ]);
  });

  test("reads nothing from a request without cookies", () => {
    expect(
      legacySessionCookieNames(new Request("https://builder.organizeos.org/"))
    ).toEqual([]);
  });
});

describe("legacySessionDeletes", () => {
  test("is the domain-wide delete, then the host-only one", () => {
    expect(legacySessionDeletes("sb-abc-auth-token")).toEqual([
      "sb-abc-auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure; Domain=.organizeos.org",
      "sb-abc-auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure",
    ]);
  });
});
