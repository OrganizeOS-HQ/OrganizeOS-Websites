// A server build with the builder's own entry, for the tests of
// organizeos-legacy-session.server.ts. Nothing is built at import: call
// createHandler() once the globals the test wants are in place.
import { createRequestHandler, type ServerBuild } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import * as entry from "~/entry.server";

// A root with an error boundary, a document route standing in for the canvas
// (it sets a cookie of its own, as builder routes do), a document route that
// throws while rendering (Remix then renders the boundary with the same
// headers), and a resource route standing in for an asset.
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
  hasErrorBoundary: id === "root",
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

const RootError = () => (
  <html>
    <body>
      <p>error</p>
    </body>
  </html>
);

const Broken = (): never => {
  throw new Error("render failed");
};

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
      module: { default: Root, ErrorBoundary: RootError },
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
    broken: {
      id: "broken",
      parentId: "root",
      path: "broken",
      module: { loader: () => ({}), default: Broken },
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
      broken: routeEntry("broken", {
        parentId: "root",
        path: "broken",
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

export const createHandler = () => {
  const handle = createRequestHandler(build, "production");
  return (url: string, cookie: string) =>
    handle(new Request(url, { headers: { Cookie: cookie } }));
};

export const canvasHost = "https://p-0b7a5f2e-builder.builder.organizeos.org";

export const carried =
  "sb-abc-auth-token.0=x; sb-abc-auth-token.1=y; _ga=GA1.2.3";

export const chunkDeletes = [
  "sb-abc-auth-token.0=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure; Domain=.organizeos.org",
  "sb-abc-auth-token.0=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure",
  "sb-abc-auth-token.1=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure; Domain=.organizeos.org",
  "sb-abc-auth-token.1=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure",
];

/**
 * The Set-Cookie values on a response, one per cookie, from Node's Headers
 * (getSetCookie) or Remix's polyfill (raw), whichever the test runs with.
 */
export const setCookies = (headers: Headers): string[] => {
  const either = headers as Headers & {
    getSetCookie?: () => string[];
    raw?: () => Record<string, string[]>;
  };
  if (typeof either.getSetCookie === "function") {
    return either.getSetCookie();
  }
  return either.raw?.()["set-cookie"] ?? [];
};
