import { z } from "zod";
import { createClient } from "@webstudio-is/postgrest/index.server";
import env from "~/env/env.server";
import { ORG_SUBDOMAIN_PATTERN } from "./organizeos-site.server";

/**
 * The site's addresses and launch state, as OrganizeOS knows them, for the
 * Publish dialog (docs/ORGANIZEOS-FORK.md section 5).
 *
 * OrganizeOS's `websites2_site_addresses(p_org)` is the one source: it answers
 * an array of one row, or `[]` for an unknown org, with the org's `subdomain`,
 * its custom main host in the form it is served (`main_host`, or null), every
 * such host (`website_hosts`), the launch `status` (`not_launched`, `live` or
 * `offline`), `launchable` (whether the build the org's pointer names can go
 * live now) and `targets`: every address the org can publish to, the built-in
 * one first (key `builtin`, host null: the builder composes it), then each
 * Website-use domain, the main first (key its stored host, host its served
 * form), each with `main`, `published_at`, `unpublished_at` and `live`. The
 * last two fields are optional, so either side can deploy first. It is
 * service-role only, called with the builder's PostgREST key
 * (`POSTGREST_API_KEY`) and only from the server, for a signed-in user
 * (`routes/rest.organizeos-site.$projectId.ts`, and the publish route's check
 * of the ticked addresses, `services/organizeos-publish-route.server.ts`).
 * The platform's copies of the answer are
 * `shared/__fixtures__/site-addresses.json` and `site-addresses-targets.json`.
 *
 * Every answer is validated, and anything else gives nothing: the dialog then
 * shows nothing extra. A failure logs one code and never the answer or the
 * error.
 */

export const SITE_ADDRESSES_RPC = "websites2_site_addresses";

/**
 * A-Z only. A Unicode lower-casing can turn a non-ASCII letter into an ASCII
 * one (U+212A KELVIN SIGN becomes "k"), which would pass a host the platform
 * never sent.
 */
const asciiLowerCase = (value: string) =>
  value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());

/** Dot-separated labels of [a-z0-9-]: no scheme, port, path, userinfo or non-ASCII. */
export const HOST_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

const hostSchema = z
  .string()
  .transform(asciiLowerCase)
  .pipe(z.string().regex(HOST_PATTERN));

/** The key of the org's built-in address, the one target with no stored host. */
export const BUILTIN_TARGET_KEY = "builtin";

/** At most this many targets in one read. */
const MAX_TARGETS = 50;

const timeSchema = z.string().datetime({ offset: true }).nullable();

const targetFields = {
  main: z.boolean(),
  published_at: timeSchema,
  unpublished_at: timeSchema,
  live: z.boolean(),
  // Whether the address serves that build now; a platform before it sends
  // none, and then it is the target's own live.
  serving: z.boolean().optional(),
};

const targetRowSchema = z.union([
  z.object({
    key: z.literal(BUILTIN_TARGET_KEY),
    host: z.null(),
    ...targetFields,
  }),
  z.object({ key: hostSchema, host: hostSchema, ...targetFields }),
]);

const siteStatusSchema = z.enum(["not_launched", "live", "offline"]);

export type SiteStatus = z.infer<typeof siteStatusSchema>;

const rowSchema = z.object({
  subdomain: z.string().regex(ORG_SUBDOMAIN_PATTERN),
  main_host: hostSchema.nullable(),
  website_hosts: z.array(z.string()),
  status: siteStatusSchema,
  // Optional both ways, so either side can deploy first
  launchable: z.boolean().nullish(),
  // Optional both ways too: a platform without publish targets sends none
  targets: z.array(targetRowSchema).max(MAX_TARGETS).nullish(),
  // Read leniently (fetchSiteAddresses): an unknown shape is treated as
  // absent and logged, and never fails the read.
  old_site_key: z.unknown().optional(),
});

export type SiteAddressesRow = z.infer<typeof rowSchema>;

const answerSchema = z.array(rowSchema).max(1);

type LogCode =
  | "addresses_rpc_failed"
  | "addresses_invalid"
  /** old_site_key had an unknown shape: read as absent. */
  | "old_site_key_invalid"
  /** The route could not read the project or its owner. */
  | "owner_read_failed";

/** One code, never the answer or the error. */
export const logSiteAddressesFailure = (code: LogCode) => {
  console.error(`[organizeos-site-addresses] ${code}`);
};

const log = logSiteAddressesFailure;

/** The one PostgREST call made here: the RPC is not in the fork's typed schema. */
export type SiteAddressesClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

let client: SiteAddressesClient | undefined;

export const getSiteAddressesClient = (): SiteAddressesClient => {
  if (client === undefined) {
    client = createClient(
      env.POSTGREST_URL,
      env.POSTGREST_API_KEY
    ) as unknown as SiteAddressesClient;
  }
  return client;
};

/** The org's row, validated, or undefined for none, an error or a bad answer. */
export const fetchSiteAddresses = async (
  client: SiteAddressesClient,
  organizationId: string
): Promise<SiteAddressesRow | undefined> => {
  let answer: { data: unknown; error: unknown };
  try {
    answer = await client.rpc(SITE_ADDRESSES_RPC, { p_org: organizationId });
  } catch {
    log("addresses_rpc_failed");
    return;
  }
  if (answer.error) {
    log("addresses_rpc_failed");
    return;
  }
  const parsed = answerSchema.safeParse(answer.data);
  if (parsed.success === false) {
    log("addresses_invalid");
    return;
  }
  const row = parsed.data[0];
  if (row === undefined) {
    return;
  }
  // The address that serves the organization's old site, while it shows one:
  // `builtin` or a host. Anything else reads as absent, so the dialog marks
  // nothing and offers no replace.
  const oldSiteKey = row.old_site_key;
  if (oldSiteKey === undefined || oldSiteKey === null) {
    return { ...row, old_site_key: null };
  }
  if (
    typeof oldSiteKey === "string" &&
    (oldSiteKey === BUILTIN_TARGET_KEY || HOST_PATTERN.test(oldSiteKey))
  ) {
    return row;
  }
  log("old_site_key_invalid");
  return { ...row, old_site_key: null };
};

/** One address the Publish dialog lists. */
export type SiteTarget = {
  /**
   * What a publish names it by: `builtin`, or the host it is served on, which
   * OrganizeOS maps back to the domain in either form.
   */
  key: string;
  /** For display: the served host, composed for the built-in address. */
  host: string;
  builtin: boolean;
  main: boolean;
  publishedAt: string | null;
  /** When it was taken down, or null while its recorded build stands. */
  unpublishedAt: string | null;
  /** The target's own state: a build passing the checks, not taken down. */
  live: boolean;
  /** The address serves that build now (the row's Live word). */
  serving: boolean;
};

export type SiteAddresses = {
  /** Where the site is published: its custom main, else its platform address. */
  host: string;
  origin: string;
  status: SiteStatus;
  /** The org's domain settings in OrganizeOS. */
  manageDomainsUrl: string;
  /** Present only when the platform sent a boolean. */
  launchable?: boolean;
  /** Present only when the platform sent them. */
  targets?: SiteTarget[];
  /**
   * While the organization's addresses show its old site: the key of the
   * address that serves it, which a replace must include. Absent otherwise.
   */
  oldSiteKey?: string;
};

export const composeSiteAddresses = ({
  row,
  publisherHost,
  platformUrl,
}: {
  row: SiteAddressesRow;
  publisherHost: string;
  platformUrl: string;
}): SiteAddresses => {
  const builtinHost = `${row.subdomain}.${publisherHost}`;
  const host = row.main_host ?? builtinHost;
  const base = platformUrl.replace(/\/+$/, "");
  return {
    host,
    origin: `https://${host}`,
    status: row.status,
    manageDomainsUrl: `${base}/${row.subdomain}/settings/domain`,
    ...(typeof row.launchable === "boolean"
      ? { launchable: row.launchable }
      : {}),
    ...(row.targets == null
      ? {}
      : {
          ...(typeof row.old_site_key === "string"
            ? { oldSiteKey: row.old_site_key }
            : {}),
          targets: row.targets.map((target) => ({
            key: target.host ?? BUILTIN_TARGET_KEY,
            host: target.host ?? builtinHost,
            builtin: target.host === null,
            main: target.main,
            publishedAt: target.published_at,
            unpublishedAt: target.unpublished_at,
            live: target.live,
            serving: target.serving ?? target.live,
          })),
        }),
  };
};
