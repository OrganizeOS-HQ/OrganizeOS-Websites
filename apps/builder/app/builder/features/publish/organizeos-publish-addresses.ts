import { z } from "zod";
import { fetch } from "~/shared/fetch.client";

/**
 * The Publish dialog's read of the site's addresses and launch state, from
 * the builder's own `rest.organizeos-site` route, which asks OrganizeOS
 * (shared/db/organizeos-site-addresses.server.ts). Anything but a valid answer
 * is undefined, and the dialog then shows nothing extra.
 */

// An address the dialog links to: never another scheme
const linkSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//.test(value));

const answerSchema = z.object({
  ok: z.literal(true),
  host: z.string().min(1),
  origin: linkSchema.refine((value) => value.startsWith("https://")),
  status: z.enum(["not_launched", "live", "offline"]),
  manageDomainsUrl: linkSchema,
  websiteUrl: linkSchema,
  launchable: z.boolean().optional(),
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

/**
 * Whether the dialog may say the site is live: it is launched and online, and
 * OrganizeOS did not say that the version its pointer names cannot go live.
 */
export const servesThisVersion = (
  addresses: SiteAddresses | undefined
): addresses is SiteAddresses =>
  addresses?.status === "live" && addresses.launchable !== false;
