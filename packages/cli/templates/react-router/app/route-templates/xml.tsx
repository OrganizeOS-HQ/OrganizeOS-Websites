import { renderToString } from "react-dom/server";
import { type LoaderFunctionArgs, redirect } from "react-router";
import { isLocalResource, loadResources, getSystemSearch } from "@webstudio-is/sdk/runtime";
import { authenticateRequest } from "@webstudio-is/wsauth";
import {
  ReactSdkContext,
  xmlNodeTagSuffix,
} from "@webstudio-is/react-sdk/runtime";
import { Page, breakpoints, siteName } from "__CLIENT__";
import { getPageMeta, getRemixParams, getResources } from "__SERVER__";
import { assetBaseUrl, imageLoader } from "__CONSTANTS__";
import { sitemap } from "__SITEMAP__";
import { authRoutes } from "__AUTH__";
import { createGeneratedAssetResourceFetch } from "__ASSET_QUERY_RUNTIME__";
import { siteResourceCache } from "../organizeos-resource-cache";

/**
 * A realm the browser can show to the site's own visitors.
 *
 * wsauth is kept byte-identical to upstream (ORGANIZEOS-FORK.md §1), and its
 * 401 sends `Basic realm="Webstudio"`. The browser prints a realm verbatim in
 * its password prompt, so that is the one upstream string that reaches past an
 * admin to the org's AUDIENCE -- a visitor to acme.organizeos.org being asked
 * to sign in to a product they have never heard of. Naming the site itself
 * beats naming any platform here: it tells the visitor what they are
 * authenticating to.
 *
 * A realm is a quoted-string (RFC 7235), so anything that could terminate or
 * escape the quoting is dropped rather than encoded, and an empty or missing
 * site name falls back to a neutral word.
 */
const authRealm = () => {
  const cleaned = (siteName ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"\\]/g, "")
    .trim();
  return cleaned === "" ? "Protected" : cleaned;
};

/** Re-issue a wsauth 401 with our realm, leaving status, body and cache alone. */
const withSiteRealm = (response: Response) => {
  const headers = new Headers(response.headers);
  headers.set("WWW-Authenticate", `Basic realm="${authRealm()}"`);
  return new Response(response.body, { status: response.status, headers });
};

const authenticateProductionRequest = (request: Request) => {
  // OrganizeOS fork: upstream skipped page authentication whenever the request
  // host was projectDomain or a subdomain of it, because projectDomain was the
  // Webstudio staging label and staging carries its own separate credentials.
  // Here Project.domain IS the org's platform subdomain, so "acme" matched
  // "acme.organizeos.org" -- the site's PRIMARY PUBLIC HOST -- and every
  // password-protected page was readable by anyone there, while the same page
  // stayed protected on a custom domain. There is no staging host in this fork,
  // so the skip has nothing left to protect and is gone.
  //
  // This is safe for unprotected sites: authenticateRequest returns early when
  // no auth route matches the pathname, so only pages the org explicitly
  // protected are ever challenged.
  try {
    return authenticateRequest(request, authRoutes);
  } catch (thrown) {
    if (thrown instanceof Response && thrown.status === 401) {
      throw withSiteRealm(thrown);
    }
    throw thrown;
  }
};

const customFetch: typeof fetch = (input, init) => {
  if (typeof input !== "string") {
    return fetch(input, init);
  }

  if (isLocalResource(input, "sitemap.xml")) {
    // @todo: dynamic import sitemap ???
    const response = new Response(JSON.stringify(sitemap));
    response.headers.set("content-type", "application/json; charset=utf-8");
    return Promise.resolve(response);
  }

  if (isLocalResource(input, "current-date")) {
    const now = new Date();
    // Normalize to midnight UTC to prevent hydration mismatches
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const data = {
      iso: startOfDay.toISOString(),
      year: startOfDay.getUTCFullYear(),
      month: startOfDay.getUTCMonth() + 1, // 1-12 instead of 0-11
      day: startOfDay.getUTCDate(),
      timestamp: startOfDay.getTime(),
    };
    const response = new Response(JSON.stringify(data));
    response.headers.set("content-type", "application/json; charset=utf-8");
    return Promise.resolve(response);
  }

  // OrganizeOS fork: through the site's in-memory resource cache
  // (organizeos-resource-cache.ts), one per server instance for every route,
  // which keeps each response only as long as its own Cache-Control allows.
  // Behind it is the global fetch, as before.
  return siteResourceCache(input, init);
};

export const loader = async (arg: LoaderFunctionArgs) => {
  const authRoute = authenticateProductionRequest(arg.request);

  const url = new URL(arg.request.url);
  const host =
    arg.request.headers.get("x-forwarded-host") ||
    arg.request.headers.get("host") ||
    "";
  url.host = host;
  url.protocol = "https";

  const params = getRemixParams(arg.params);

  const system = {
    params,
    ...getSystemSearch(url.searchParams),
    origin: url.origin,
    pathname: url.pathname,
  };

  const generatedFetch = await createGeneratedAssetResourceFetch({
    request: arg.request,
    context: arg.context,
    fallback: customFetch,
  });
  const resources = await loadResources(
    generatedFetch,
    getResources({ system }).data,
    url,
    { signal: arg.request.signal }
  );
  Object.assign(
    resources,
    await loadResources(
      generatedFetch,
      getResources({ system, resources }).contentData ?? new Map(),
      url,
      { signal: arg.request.signal }
    )
  );
  const pageMeta = getPageMeta({ system, resources });

  if (pageMeta.redirect) {
    const status =
      pageMeta.status === 301 || pageMeta.status === 302
        ? pageMeta.status
        : 302;
    return redirect(pageMeta.redirect, status);
  }

  // typecheck
  arg.context.EXCLUDE_FROM_SEARCH satisfies boolean;

  let text = renderToString(
    <ReactSdkContext.Provider
      value={{
        imageLoader,
        assetBaseUrl,
        resources,
        breakpoints,
        onError: console.error,
      }}
    >
      <Page system={system} />
    </ReactSdkContext.Provider>
  );

  // Xml is wrapped with <svg> to prevent React from hoisting elements like <title>, <meta>, and <link> out of their intended scope during rendering.
  // More details: https://github.com/facebook/react/blob/7c8e5e7ab8bb63de911637892392c5efd8ce1d0f/packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js#L3083
  text = text.replace(/^<svg>/g, "").replace(/<\/svg>$/g, "");

  // React has issues rendering certain elements, such as errors when a <link> element has children.
  // To render XML, we wrap it with an <svg> tag and add a suffix to avoid React's default behavior on these elements.
  text = text.replaceAll(xmlNodeTagSuffix, "");

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${text}`, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control":
        authRoute === undefined ? "public, max-age=600" : "private, no-store",
      // OrganizeOS fork: an XML element can be a script in another namespace,
      // so the page answers sandboxed and is never read as another type, and
      // nothing it carries runs on the org host (docs/ORGANIZEOS-FORK.md
      // section 8). Crawlers and feed readers ignore the policy.
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
