import { ORGANIZEOS_SERVICE_PROVIDER } from "@webstudio-is/trpc-interface/index.server";
import { parseOrganizationIdFromServiceEmail } from "~/services/organizeos-publisher.server";

/**
 * OrganizeOS fork: the org that owns a project, as the builder loader
 * resolves it (docs/ORGANIZEOS-FORK.md section 5). An org's project is owned
 * by its service account, `User.provider = organizeos-service`, whose email
 * carries the organization id. The id is read from there, never from a
 * request, and must be a UUID.
 *
 * Answers `{ organizationId }`, `{ none: true }` for a project no org owns
 * (a deleted project, a human owner, an id that is not a UUID) and
 * `{ failed: true }` when the project or its owner could not be read.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown> | null;

type Query = {
  eq: (column: string, value: unknown) => Query;
  maybeSingle: () => PromiseLike<{ data: Row; error: unknown }>;
};

/** The slice of the builder's PostgREST client this reads. */
export type ProjectOrganizationClient = {
  from: (table: string) => { select: (columns: string) => Query };
};

export type ProjectOrganization =
  | { organizationId: string }
  | { none: true }
  | { failed: true };

export const resolveProjectOrganization = async (
  client: ProjectOrganizationClient,
  projectId: string
): Promise<ProjectOrganization> => {
  const project = await client
    .from("Project")
    .select("userId")
    .eq("id", projectId)
    .eq("isDeleted", false)
    .maybeSingle();
  if (project.error) {
    return { failed: true };
  }
  const userId = project.data?.userId;
  if (typeof userId !== "string") {
    return { none: true };
  }
  const owner = await client
    .from("User")
    .select("provider, email")
    .eq("id", userId)
    .maybeSingle();
  if (owner.error) {
    return { failed: true };
  }
  if (
    owner.data === null ||
    owner.data.provider !== ORGANIZEOS_SERVICE_PROVIDER ||
    typeof owner.data.email !== "string"
  ) {
    return { none: true };
  }
  const organizationId = parseOrganizationIdFromServiceEmail(owner.data.email);
  if (organizationId === null || UUID_PATTERN.test(organizationId) === false) {
    return { none: true };
  }
  return { organizationId };
};
