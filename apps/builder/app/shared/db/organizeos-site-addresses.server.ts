import { z } from "zod";
import { createClient } from "@webstudio-is/postgrest/index.server";
import env from "~/env/env.server";
import {
  ORG_SUBDOMAIN_PATTERN,
  organizeosWebsiteAreaUrl,
} from "./organizeos-site.server";

/**
 * The site's addresses and launch state, as OrganizeOS knows them, for the
 * Publish dialog (docs/ORGANIZEOS-FORK.md section 5).
 *
 * OrganizeOS's `websites2_site_addresses(p_org)` is the one source: it answers
 * an array of one row, or `[]` for an unknown org, with the org's `subdomain`,
 * its custom main host in the form it is served (`main_host`, or null), every
 * such host (`website_hosts`), the launch `status` (`not_launched`, `live` or
 * `offline`) and, once the platform sends it, `launchable`: whether the build
 * the org's pointer names can go live now. It is service-role only, called
 * with the builder's PostgREST key (`POSTGREST_API_KEY`) and only from the
 * server, for a signed-in user (`routes/rest.organizeos-site.$projectId.ts`).
 * The platform's copy of the answer is `shared/__fixtures__/site-addresses.json`.
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
const HOST_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

const hostSchema = z
  .string()
  .transform(asciiLowerCase)
  .pipe(z.string().regex(HOST_PATTERN));

const siteStatusSchema = z.enum(["not_launched", "live", "offline"]);

export type SiteStatus = z.infer<typeof siteStatusSchema>;

const rowSchema = z.object({
  subdomain: z.string().regex(ORG_SUBDOMAIN_PATTERN),
  main_host: hostSchema.nullable(),
  website_hosts: z.array(z.string()),
  status: siteStatusSchema,
  // Optional both ways, so either side can deploy first
  launchable: z.boolean().nullish(),
});

export type SiteAddressesRow = z.infer<typeof rowSchema>;

const answerSchema = z.array(rowSchema).max(1);

type LogCode =
  | "addresses_rpc_failed"
  | "addresses_invalid"
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
  return parsed.data[0];
};

export type SiteAddresses = {
  /** Where the site is published: its custom main, else its platform address. */
  host: string;
  origin: string;
  status: SiteStatus;
  /** The org's domain settings in OrganizeOS. */
  manageDomainsUrl: string;
  /** The org's Website area in OrganizeOS, where it launches. */
  websiteUrl: string;
  /** Present only when the platform sent a boolean. */
  launchable?: boolean;
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
  const host = row.main_host ?? `${row.subdomain}.${publisherHost}`;
  const base = platformUrl.replace(/\/+$/, "");
  return {
    host,
    origin: `https://${host}`,
    status: row.status,
    manageDomainsUrl: `${base}/${row.subdomain}/settings/domain`,
    websiteUrl: organizeosWebsiteAreaUrl(platformUrl, row.subdomain),
    ...(typeof row.launchable === "boolean"
      ? { launchable: row.launchable }
      : {}),
  };
};
