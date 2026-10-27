import { json, type ActionFunctionArgs } from "@remix-run/server-runtime";
import { z } from "zod";
import {
  createClient,
  type Client,
} from "@webstudio-is/postgrest/index.server";
import env from "~/env/env.server";
import { isAuthorizedInternalCall } from "~/services/internal-auth.server";
import {
  listImages,
  readOverview,
  readPage,
  resolveAgentProject,
} from "~/shared/db/organizeos-agent.server";

/**
 * OrganizeOS's website agent (OrganizeOS spec
 * docs/superpowers/specs/2026-10-27-builder-agent-tools-design.md, 4.5).
 *
 * Server to server only, with its own secret, ORGANIZEOS_AGENT_TOKEN. The fork
 * trusts OrganizeOS for who may act, as provisioning does: `actorUserId` is
 * never used for authorization. Every id comes from `organizationId`, through
 * deriveProjectId; ids in `args` are matched only inside that project's build.
 * The operation list is closed: these reads, and nothing that publishes.
 */

// Like provisioning, this acts as the system: it needs only a Postgres client,
// built as internal.provision.tsx builds it.
const createAgentClient = (): Client =>
  createClient(env.POSTGREST_URL, env.POSTGREST_API_KEY);

const envelope = {
  organizationId: z.string().min(1),
  actorUserId: z.string().uuid(),
};

const noArgs = z.object({}).strict();

const agentInput = z.discriminatedUnion("operation", [
  z
    .object({
      ...envelope,
      operation: z.literal("website_overview"),
      args: noArgs,
    })
    .strict(),
  z
    .object({
      ...envelope,
      operation: z.literal("website_read_page"),
      args: z.object({ pageId: z.string().min(1).max(64) }).strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      operation: z.literal("website_list_images"),
      args: noArgs,
    })
    .strict(),
]);

type AgentInput = z.infer<typeof agentInput>;

type AgentAnswer =
  | { ok: true; result: unknown }
  | { ok: false; code: "not_found" };

const runOperation = async (
  client: Client,
  input: AgentInput
): Promise<AgentAnswer> => {
  switch (input.operation) {
    case "website_overview": {
      const project = await resolveAgentProject(client, input.organizationId);
      return project.ok
        ? { ok: true, result: readOverview(project.result) }
        : project;
    }
    case "website_read_page": {
      const project = await resolveAgentProject(client, input.organizationId);
      return project.ok ? readPage(project.result, input.args) : project;
    }
    case "website_list_images":
      return listImages(client, input.organizationId);
  }
};

// Unset, the route is not there: 404 before any other check, so it cannot be
// discovered by probing.
const isEnabled = () =>
  env.ORGANIZEOS_AGENT_TOKEN !== undefined &&
  env.ORGANIZEOS_AGENT_TOKEN.length > 0;

const notFound = () => new Response("Not Found", { status: 404 });

export const loader = () =>
  isEnabled()
    ? json({ error: "Method not allowed" }, { status: 405 })
    : notFound();

export const action = async ({ request }: ActionFunctionArgs) => {
  if (isEnabled() === false) {
    return notFound();
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  // The agent token, compared in constant time, and never a cookie.
  if (isAuthorizedInternalCall(request, env.ORGANIZEOS_AGENT_TOKEN) === false) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = agentInput.safeParse(body);
  if (parsed.success === false) {
    return json({ ok: false, code: "invalid_input" }, { status: 400 });
  }

  try {
    return json(await runOperation(createAgentClient(), parsed.data));
  } catch (error) {
    // The operation name and the error's kind only: no ids, no body, no
    // message (a store message can quote a value).
    console.error("organizeos-agent: operation failed", {
      operation: parsed.data.operation,
      error: error instanceof Error ? error.name : typeof error,
      code:
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : undefined,
    });
    return json({ ok: false, code: "unavailable" }, { status: 500 });
  }
};
