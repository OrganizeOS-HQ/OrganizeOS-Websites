import { json, type ActionFunctionArgs } from "@remix-run/server-runtime";
import { randomUUID } from "node:crypto";
import { authorizeProject } from "@webstudio-is/trpc-interface/index.server";
import env from "~/env/env.server";
import { createContext } from "~/shared/context.server";
import { checkCsrf } from "~/services/csrf-session.server";
import { privateNoStoreResponseHeaders } from "~/services/cache-control.server";
import {
  checkOrganizeosBinding,
  readBuilderSession,
} from "~/services/auth-strategy/organizeos-session.server";
import {
  handleSiteActionRequest,
  type SiteActionRouteDeps,
} from "~/services/organizeos-site-action-route.server";
import {
  resolveProjectOrganization,
  type ProjectOrganizationClient,
} from "~/shared/db/organizeos-project-org.server";
import {
  fetchSiteAddresses,
  getSiteAddressesClient,
} from "~/shared/db/organizeos-site-addresses.server";
import { postSiteAction } from "~/shared/organizeos-site-action.server";

/**
 * OrganizeOS fork: the Publish dialog's Unpublish of one address
 * (docs/ORGANIZEOS-FORK.md section 5). The checks and answers are in
 * services/organizeos-site-action-route.server.ts; this wires them to the
 * builder's own session, permits, database, secret and OrganizeOS.
 */

const deps = (): SiteActionRouteDeps => ({
  checkCsrf,
  createContext,
  readSession: readBuilderSession,
  bindingOutcome: async (session) =>
    (await checkOrganizeosBinding(session)).outcome,
  hasAdminPermit: (projectId, context) =>
    authorizeProject.hasProjectPermit({ projectId, permit: "admin" }, context),
  resolveOrganization: (projectId, context) =>
    resolveProjectOrganization(
      context.postgrest.client as unknown as ProjectOrganizationClient,
      projectId
    ),
  fetchAddresses: (organizationId) =>
    fetchSiteAddresses(getSiteAddressesClient(), organizationId),
  secret: env.WEBSITES2_SITE_ACTION_SECRET,
  now: Date.now,
  randomId: randomUUID,
  send: (header) => postSiteAction({ appUrl: env.ORGANIZEOS_APP_URL, header }),
  publisherHost: env.PUBLISHER_HOST,
  platformUrl: env.ORGANIZEOS_APP_URL,
});

export const action = ({ request, params }: ActionFunctionArgs) =>
  handleSiteActionRequest(request, params.projectId, deps());

/** An Unpublish is a POST from the dialog; nothing is read here. */
export const loader = () =>
  json({ ok: false }, { status: 405, headers: privateNoStoreResponseHeaders });
