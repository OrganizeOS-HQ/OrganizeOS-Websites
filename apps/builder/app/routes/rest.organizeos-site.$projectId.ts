import { json, type LoaderFunctionArgs } from "@remix-run/server-runtime";
import {
  authorizeProject,
  ORGANIZEOS_SERVICE_PROVIDER,
} from "@webstudio-is/trpc-interface/index.server";
import env from "~/env/env.server";
import { createContext } from "~/shared/context.server";
import { preventCrossOriginCookie } from "~/services/no-cross-origin-cookie";
import { checkCsrf } from "~/services/csrf-session.server";
import { allowedDestinations } from "~/services/destinations.server";
import { privateNoStoreResponseHeaders } from "~/services/cache-control.server";
import { parseOrganizationIdFromServiceEmail } from "~/services/organizeos-publisher.server";
import {
  composeSiteAddresses,
  fetchSiteAddresses,
  getSiteAddressesClient,
} from "~/shared/db/organizeos-site-addresses.server";

/**
 * OrganizeOS fork: the Publish dialog's read of the site's addresses and
 * launch state (docs/ORGANIZEOS-FORK.md section 5), fetched when the dialog
 * opens and again when a publish settles.
 *
 * A fetch only, for a user signed in as a user (never through a share link's
 * token) who may view the project. The org is the project owner's, resolved
 * as the builder loader resolves it, and never comes from the request. The
 * answer is `{ ok: true, host, origin, status, manageDomainsUrl, websiteUrl,
 * launchable? }`, or `{ ok: false }` for a project no org owns and for any
 * failure, which the dialog shows as nothing extra.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const answer = (body: object, status = 200) =>
  json(body, { status, headers: privateNoStoreResponseHeaders });

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  preventCrossOriginCookie(request);
  allowedDestinations(request, ["empty"]);
  await checkCsrf(request);

  const projectId = params.projectId;
  if (projectId === undefined) {
    throw new Error("Project id undefined");
  }
  const context = await createContext(request);
  if (context.authorization.type !== "user") {
    return answer({ ok: false }, 403);
  }
  const permitted = await authorizeProject.hasProjectPermit(
    { projectId, permit: "view" },
    context
  );
  if (permitted === false) {
    return answer({ ok: false }, 403);
  }

  const client = context.postgrest.client;
  const project = await client
    .from("Project")
    .select("userId")
    .eq("id", projectId)
    .eq("isDeleted", false)
    .maybeSingle();
  if (project.error) {
    throw project.error;
  }
  if (project.data === null || project.data.userId === null) {
    return answer({ ok: false });
  }
  const owner = await client
    .from("User")
    .select("provider, email")
    .eq("id", project.data.userId)
    .maybeSingle();
  if (owner.error) {
    throw owner.error;
  }
  if (
    owner.data === null ||
    owner.data.provider !== ORGANIZEOS_SERVICE_PROVIDER ||
    owner.data.email === null
  ) {
    return answer({ ok: false });
  }
  const organizationId = parseOrganizationIdFromServiceEmail(owner.data.email);
  if (organizationId === null || UUID_PATTERN.test(organizationId) === false) {
    return answer({ ok: false });
  }

  const row = await fetchSiteAddresses(
    getSiteAddressesClient(),
    organizationId
  );
  if (row === undefined) {
    return answer({ ok: false });
  }
  return answer({
    ok: true,
    ...composeSiteAddresses({
      row,
      publisherHost: env.PUBLISHER_HOST,
      platformUrl: env.ORGANIZEOS_APP_URL,
    }),
  });
};
