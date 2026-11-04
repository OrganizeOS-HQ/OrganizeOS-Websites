import { json } from "@remix-run/server-runtime";
import { parsePages } from "@webstudio-is/project-build/persistence";
import { getStaticSiteMapXml } from "@webstudio-is/sdk";
import { pagesForSitemap } from "@organizeos/site-components/org-script";
import { parseBuilderUrl } from "@webstudio-is/protocol";
import { isBuilder } from "../router-utils";
import { createContext } from "../context.server";

/**
 * This should be a route in SvelteKit, as it can be fetched server-side without an actual HTTP request.
 * Consider moving it to routes if Remix supports similar functionality in the future.
 * Note: Fetching own routes using request.origin is prohibited on Cloudflare Workers.
 * Note: We are not moving this to routes to avoid generating an additional 30MB function on deploy.
 */
export const loader = async ({ request }: { request: Request }) => {
  if (isBuilder(request) === false) {
    throw new Error("Only builder requests are allowed");
  }

  const { projectId } = parseBuilderUrl(request.url);

  if (projectId === undefined) {
    throw new Error("projectId is required");
  }

  const context = await createContext(request);

  const buildResult = await context.postgrest.client
    .from("Build")
    .select("pages, updatedAt")
    .eq("projectId", projectId)
    .is("deployment", null)
    .single();

  if (buildResult.error) {
    throw json({ message: buildResult.error.message }, { status: 404 });
  }

  const build = buildResult.data;

  const pages = parsePages(build.pages);

  // OrganizeOS fork: the sitemap reads each page's excludePageFromSearch as
  // upstream does since webstudio-is/webstudio#6614, without evaluating it
  // (pagesForSitemap, docs/ORGANIZEOS-FORK.md section 7).
  const siteMap = getStaticSiteMapXml(pagesForSitemap(pages), build.updatedAt);

  return json(siteMap);
};
