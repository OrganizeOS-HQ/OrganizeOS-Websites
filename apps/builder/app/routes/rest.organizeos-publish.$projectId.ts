import { json, type ActionFunctionArgs } from "@remix-run/server-runtime";
import { authorizeProject } from "@webstudio-is/trpc-interface/index.server";
import { createProductionBuild } from "@webstudio-is/project-build/server";
import env from "~/env/env.server";
import { createContext } from "~/shared/context.server";
import { checkCsrf } from "~/services/csrf-session.server";
import { privateNoStoreResponseHeaders } from "~/services/cache-control.server";
import {
  checkOrganizeosBinding,
  readBuilderSession,
} from "~/services/auth-strategy/organizeos-session.server";
import { getOrganizeosPublisher } from "~/services/organizeos-publisher.server";
import {
  handlePublishRequest,
  type PublishRouteDeps,
} from "~/services/organizeos-publish-route.server";
import {
  resolveProjectOrganization,
  type ProjectOrganizationClient,
} from "~/shared/db/organizeos-project-org.server";
import {
  fetchSiteAddresses,
  getSiteAddressesClient,
} from "~/shared/db/organizeos-site-addresses.server";

/**
 * OrganizeOS fork: the Publish dialog's publish to the ticked addresses
 * (docs/ORGANIZEOS-FORK.md section 5). The checks and answers are in
 * services/organizeos-publish-route.server.ts; this wires them to the
 * builder's own session, permits, database and publisher.
 */

const deps = (): PublishRouteDeps => ({
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
  loadProjectDomain: async (projectId, context) => {
    const project = await context.postgrest.client
      .from("Project")
      .select("domain")
      .eq("id", projectId)
      .eq("isDeleted", false)
      .maybeSingle();
    if (project.error || project.data === null) {
      return;
    }
    return project.data.domain;
  },
  createBuild: createProductionBuild,
  getPublisher: getOrganizeosPublisher,
  publisherHost: env.PUBLISHER_HOST,
  platformUrl: env.ORGANIZEOS_APP_URL,
});

export const action = ({ request, params }: ActionFunctionArgs) =>
  handlePublishRequest(request, params.projectId, deps());

/** A publish is a POST from the dialog; nothing is read here. */
export const loader = () =>
  json({ ok: false }, { status: 405, headers: privateNoStoreResponseHeaders });
