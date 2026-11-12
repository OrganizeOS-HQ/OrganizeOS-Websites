import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/server-runtime";
import { randomUUID } from "node:crypto";
import { authorizeProject } from "@webstudio-is/trpc-interface/index.server";
import env from "~/env/env.server";
import { createContext } from "~/shared/context.server";
import { checkCsrf } from "~/services/csrf-session.server";
import {
  checkOrganizeosBinding,
  readBuilderSession,
} from "~/services/auth-strategy/organizeos-session.server";
import {
  handleCmsRequest,
  type CmsRouteDeps,
} from "~/services/organizeos-cms-route.server";
import {
  resolveProjectOrganization,
  type ProjectOrganizationClient,
} from "~/shared/db/organizeos-project-org.server";
import { forwardCmsRequest } from "~/shared/organizeos-cms.server";

/**
 * OrganizeOS fork: the native CMS screen's door to OrganizeOS
 * (docs/ORGANIZEOS-FORK.md section 5, "The CMS door"). The checks and
 * answers are in services/organizeos-cms-route.server.ts; this wires them to
 * the builder's own session, permits, database, secret and OrganizeOS.
 */

const deps = (): CmsRouteDeps => ({
  checkCsrf,
  createContext,
  readSession: readBuilderSession,
  bindingOutcome: async (session) =>
    (await checkOrganizeosBinding(session)).outcome,
  hasPermit: (projectId, permit, context) =>
    authorizeProject.hasProjectPermit({ projectId, permit }, context),
  resolveOrganization: (projectId, context) =>
    resolveProjectOrganization(
      context.postgrest.client as unknown as ProjectOrganizationClient,
      projectId
    ),
  secret: env.WEBSITES2_CMS_SECRET,
  now: Date.now,
  randomId: randomUUID,
  send: (outgoing) =>
    forwardCmsRequest({ appUrl: env.ORGANIZEOS_APP_URL, ...outgoing }),
});

export const loader = ({ request, params }: LoaderFunctionArgs) =>
  handleCmsRequest(request, params.projectId, params["*"], deps());

export const action = ({ request, params }: ActionFunctionArgs) =>
  handleCmsRequest(request, params.projectId, params["*"], deps());
