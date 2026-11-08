import { z } from "zod";
import { fetch } from "~/shared/fetch.client";

/**
 * The Publish dialog's read of the site's addresses and launch state, from
 * the builder's own `rest.organizeos-site` route, which asks OrganizeOS
 * (shared/db/organizeos-site-addresses.server.ts), and its publish to the
 * ticked addresses, through `rest.organizeos-publish`
 * (services/organizeos-publish-route.server.ts). Anything but a valid answer
 * is undefined, and the dialog then shows that the read failed.
 */

// An address the dialog links to: never another scheme
const linkSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//.test(value));

const targetSchema = z.object({
  key: z.string().min(1),
  host: z.string().min(1),
  builtin: z.boolean(),
  main: z.boolean(),
  publishedAt: z.string().nullable(),
  live: z.boolean(),
});

export type SiteTarget = z.infer<typeof targetSchema>;

const answerSchema = z.object({
  ok: z.literal(true),
  host: z.string().min(1),
  origin: linkSchema.refine((value) => value.startsWith("https://")),
  status: z.enum(["not_launched", "live", "offline"]),
  manageDomainsUrl: linkSchema,
  launchable: z.boolean().optional(),
  targets: z.array(targetSchema).optional(),
});

export type SiteAddresses = Omit<z.infer<typeof answerSchema>, "ok">;

export const organizeosSitePath = (projectId: string) =>
  `/rest/organizeos-site/${encodeURIComponent(projectId)}`;

export const loadSiteAddresses = async (
  projectId: string
): Promise<SiteAddresses | undefined> => {
  try {
    const response = await fetch(organizeosSitePath(projectId));
    if (response.ok === false) {
      return;
    }
    const parsed = answerSchema.safeParse(await response.json());
    if (parsed.success === false) {
      return;
    }
    const { ok: _ok, ...addresses } = parsed.data;
    return addresses;
  } catch {
    return;
  }
};

export const organizeosPublishPath = (projectId: string) =>
  `/rest/organizeos-publish/${encodeURIComponent(projectId)}`;

/** How long the dialog waits for the publish route before it gives up. */
export const PUBLISH_REQUEST_TIMEOUT_MS = 30_000;

export type PublishOutcome =
  | { ok: true }
  | {
      ok: false;
      /** The route's code, `forbidden`, `timeout` or `failed`. */
      error: string;
      /** The publisher's own message, for a dispatch that failed. */
      message?: string;
    };

const publishAnswerSchema = z.object({
  ok: z.boolean(),
  error: z.string().max(64).optional(),
  message: z.string().max(500).optional(),
});

/**
 * Publishes to the ticked addresses, by key. Never throws: every outcome,
 * the client's own timeout included, is an answer.
 */
export const publishToTargets = async (
  projectId: string,
  keys: string[]
): Promise<PublishOutcome> => {
  let response: Response;
  try {
    response = await fetch(organizeosPublishPath(projectId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets: keys }),
      signal: AbortSignal.timeout(PUBLISH_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
          ? "timeout"
          : "failed",
    };
  }
  const parsed = publishAnswerSchema.safeParse(
    await response.json().catch(() => undefined)
  );
  if (response.ok && parsed.success && parsed.data.ok) {
    return { ok: true };
  }
  if (parsed.success && parsed.data.error !== undefined) {
    return {
      ok: false,
      error: parsed.data.error,
      ...(parsed.data.message === undefined
        ? {}
        : { message: parsed.data.message }),
    };
  }
  return { ok: false, error: response.status === 403 ? "forbidden" : "failed" };
};
