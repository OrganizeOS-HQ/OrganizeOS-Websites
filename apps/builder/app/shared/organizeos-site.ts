/**
 * What the builder knows about the OrganizeOS org behind a project. Resolved
 * server-side for projects owned by an org's synthetic service account (see
 * shared/db/organizeos-site.server.ts) and handed to the client with the rest
 * of the builder loader data, so the chrome can point back at OrganizeOS. The
 * site's address is not here: the Publish dialog reads it from OrganizeOS when
 * it opens (rest.organizeos-site), the one source of where the site is served.
 */
export type OrganizeosSite = {
  organizationId: string;
  /**
   * The org's platform subdomain, when OrganizeOS has told the builder what it
   * is (provisioning or SSO). Absent for a project provisioned by an older
   * OrganizeOS, which still knows only the derived placeholder domain.
   */
  subdomain?: string;
  /** The org's Website area in OrganizeOS: publish state, domains, settings. */
  manageUrl: string;
  /** OrganizeOS app home, for a plain "back to OrganizeOS" affordance. */
  platformUrl: string;
  /**
   * Whether the org is on the rollout allowlist for the OrganizeOS blocks and
   * the rest of the OrganizeOS builder UI (`ORGANIZEOS_BLOCKS_ORG_IDS`). When
   * false none of it is offered, and a block's insert is refused.
   */
  blocksEnabled: boolean;
  /**
   * Whether the deployment offers the CMS panel (`ORGANIZEOS_CMS_PANEL` is
   * exactly `true`). The panel also needs the plan's `allowDynamicData` and a
   * role above viewer (builder/features/cms-panel).
   */
  cmsPanelEnabled?: boolean;
};
