import { useEffect, useRef, useState } from "react";
import { computed } from "nanostores";
import { useStore } from "@nanostores/react";
import {
  Button,
  Flex,
  Grid,
  Link,
  PanelBanner,
  Separator,
  Text,
  Tooltip,
  css,
  cssVar,
  textVariants,
  theme,
  toast,
  useIsTruncated,
} from "@webstudio-is/design-system";
import { AlertIcon, CheckCircleIcon } from "@webstudio-is/icons";
import type { DataSource, DataSources } from "@webstudio-is/sdk";
import { isOrganizeosCatalogResourceId } from "@webstudio-is/project-build/runtime";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import {
  $assets,
  $dataSources,
  $instances,
  $pages,
  $project,
  $projectSettings,
  $props,
  $resources,
} from "~/shared/sync/data-stores";
import {
  $editingPageId,
  $permissions,
  $selectedPageId,
  selectInstance,
} from "~/shared/nano-states";
import { setActiveSidebarPanel } from "~/builder/shared/nano-states";
import { nativeClient } from "~/shared/trpc/trpc-client";
import { RelativeTime } from "~/builder/shared/relative-time";
import { platformName } from "~/shared/branding";
import { getRestrictedFeatures } from "./restricted-features";
import { $openProjectSettings } from "~/shared/nano-states/project-settings";
import {
  findMdxBlocks,
  findPausedScript,
  pausedScriptExplanation,
  type PausedScriptItem,
} from "./organizeos-publish-paused-script";
import { findPublishBlocker } from "./organizeos-publish-code-check";
import {
  getOrganizeosPublishState,
  type OrganizeosPublishState,
} from "./organizeos-publish-status";
import {
  loadSiteAddresses,
  servesThisVersion,
  type SiteAddresses,
} from "./organizeos-publish-addresses";

/**
 * The Publish dialog for an OrganizeOS site.
 *
 * Upstream's dialog is built around Webstudio hosting: a <project>.wstd.work
 * staging domain you can rename, staging credentials, custom domains verified
 * through Entri, per-domain checkboxes, plan upgrade banners and a static
 * export. None of that applies to an org's site: it is served by OrganizeOS
 * at the org's subdomain and its custom domains, which are managed there. So
 * this dialog shows where it publishes and whether the site is live, as
 * OrganizeOS answers (organizeos-publish-addresses.ts), points at OrganizeOS
 * for everything else, and has one Publish button whose status follows the
 * executor (see organizeos-publish-status.ts).
 */

const POLL_INTERVAL_MS = 10_000;

/**
 * A binding of the org's data catalog: a resource DataSource whose Resource is
 * one of the catalog's v5 ids. Every writer binds the catalog that way
 * (provisioning's block and :root bindings, a page's own binding). The
 * platform provides the catalog, so it is no plan feature; an org's own
 * Resources are, whatever their binding's id (controller ruling).
 */
const isCatalogBinding = (dataSource: DataSource) =>
  dataSource.type === "resource" &&
  isOrganizeosCatalogResourceId(dataSource.resourceId);

const withoutCatalogBindings = (dataSources: DataSources) =>
  new Map(
    Array.from(dataSources).filter(
      ([, dataSource]) => isCatalogBinding(dataSource) === false
    )
  );

// The stores upstream's dialog passes (publish.tsx): 0.309.0 reads the contact
// email, project auth and custom headers from the project's settings, and the
// Resources to name each resource binding
const $restrictedFeatures = computed(
  [
    $pages,
    $projectSettings,
    $dataSources,
    $resources,
    $instances,
    $permissions,
  ],
  (pages, projectSettings, dataSources, resources, instances, permissions) =>
    getRestrictedFeatures({
      pages,
      projectSettings,
      dataSources: withoutCatalogBindings(dataSources),
      resources,
      instances,
      permissions,
    })
);

// OrganizeOS fork: what publishing leaves out while org script is paused
const $pausedScript = computed(
  [$pages, $projectSettings, $instances, $props, $dataSources, $resources],
  (pages, projectSettings, instances, props, dataSources, resources) =>
    findPausedScript({
      pages,
      projectSettings,
      instances,
      props,
      dataSources,
      resources,
    })
);

// OrganizeOS fork: the Content Blocks that make publishing refuse the build
// while org script is paused (owner decision D7)
const $mdxBlocks = computed(
  [$pages, $instances, $props, $assets],
  (pages, instances, props, assets) =>
    findMdxBlocks({ pages, instances, props, assets })
);

const refreshProject = async () => {
  const project = $project.get();
  if (project === undefined) {
    return;
  }
  const result = await nativeClient.domain.project.query({
    projectId: project.id,
  });
  if (result.success) {
    $project.set(result.project);
  }
};

const buttonLinkClass = css({
  all: "unset",
  cursor: "pointer",
  ...textVariants.link,
}).toString();

const StatusLine = ({ state }: { state: OrganizeosPublishState }) => {
  switch (state.status) {
    case "idle":
      return <Text color="subtle">Not published yet.</Text>;
    case "pending":
      return (
        <Text color="subtle">
          Publishing, started <RelativeTime time={state.at} />
        </Text>
      );
    case "published":
      return (
        <Flex gap="1" align="center">
          <CheckCircleIcon color={cssVar("--foreground-positive")} />
          <Text>
            Published <RelativeTime time={state.at} />
          </Text>
        </Flex>
      );
    case "failed":
      return (
        <Flex gap="1" align="center">
          <AlertIcon color={cssVar("--foreground-negative")} />
          <Text color="destructive">
            {state.timedOut ? "Publishing did not finish" : "Publish failed"}{" "}
            <RelativeTime time={state.at} />
          </Text>
        </Flex>
      );
  }
};

/**
 * Names the features in this site that the org's plan does not cover, so the
 * admin knows what will not work once it is live. The pointer is the org's
 * Website area, not "ask your administrator": everyone who can open an org
 * project is one.
 */
const RestrictedFeaturesBanner = ({ manageUrl }: { manageUrl: string }) => {
  const restrictedFeatures = useStore($restrictedFeatures);
  if (restrictedFeatures.size === 0) {
    return;
  }
  return (
    <PanelBanner variant="warning">
      <Text variant="regularBold">
        This site uses features your plan does not include:
      </Text>
      <Text as="ul" css={{ paddingLeft: "1em" }}>
        {Array.from(restrictedFeatures).map(([message, feature], index) => (
          <li key={index}>
            {feature?.navigate ? (
              <button
                className={buttonLinkClass}
                type="button"
                onClick={() => {
                  const { navigate, view } = feature;
                  if (navigate === undefined) {
                    return;
                  }
                  $selectedPageId.set(navigate.pageId);
                  selectInstance(navigate.instanceSelector);
                  if (view === "pageSettings") {
                    setActiveSidebarPanel("pages");
                    $editingPageId.set(navigate.pageId);
                  }
                }}
              >
                {message}
              </button>
            ) : (
              message
            )}
          </li>
        ))}
      </Text>
      <Text>
        <Link
          href={manageUrl}
          target="_blank"
          rel="noreferrer"
          color="inherit"
          variant="inherit"
        >
          Open in {platformName} ↗
        </Link>
      </Text>
    </PanelBanner>
  );
};

/**
 * Lists the embeds, JSON-LD, animations, unsafe values and custom code that
 * this publish leaves out while an org's own script is paused
 * (docs/ORGANIZEOS-FORK.md section 10).
 * Information only: Publish still runs, and drops them. What the org saved is
 * kept, so the list empties when the switch is turned on.
 */
export const PausedScriptBanner = () => {
  const pausedScript = useStore($pausedScript);
  if (pausedScript.length === 0) {
    return;
  }
  return (
    <PanelBanner variant="warning">
      <Text variant="regularBold">Paused, not published</Text>
      <PausedItemList items={pausedScript} />
      <Text>{pausedScriptExplanation}</Text>
    </PanelBanner>
  );
};

/**
 * The Content Blocks bound to Markdown or MDX, which publishing refuses while
 * org script is paused (findMdxBlocks). Publish stays enabled: publishing
 * decides, from more than the builder loads.
 */
const MdxBlocksBanner = () => {
  const mdxBlocks = useStore($mdxBlocks);
  if (mdxBlocks.length === 0) {
    return;
  }
  return (
    <PanelBanner variant="warning">
      <Text variant="regularBold">Publishing fails while these use MDX:</Text>
      <PausedItemList items={mdxBlocks} />
    </PanelBanner>
  );
};

/** Each item selects its element, or opens its settings, when clicked. */
const PausedItemList = ({ items }: { items: PausedScriptItem[] }) => (
  <Text as="ul" css={{ paddingLeft: "1em" }}>
    {items.map(({ label, navigate, view }, index) => (
      <li key={index}>
        {navigate !== undefined || view !== undefined ? (
          <button
            className={buttonLinkClass}
            type="button"
            onClick={() => {
              if (navigate !== undefined) {
                $selectedPageId.set(navigate.pageId);
                selectInstance(navigate.instanceSelector);
              }
              if (view === "projectSettings") {
                $openProjectSettings.set("general");
              }
              if (view === "pageSettings" && navigate !== undefined) {
                setActiveSidebarPanel("pages");
                $editingPageId.set(navigate.pageId);
              }
              if (view === "projectRedirects") {
                $openProjectSettings.set("redirects");
              }
            }}
          >
            {label}
          </button>
        ) : (
          label
        )}
      </li>
    ))}
  </Text>
);

const newTabLink = {
  target: "_blank",
  rel: "noreferrer",
  color: "inherit",
  variant: "inherit",
} as const;

/** Publishing to {host}, linked when the site is live, and Manage domains. */
const PublishingTo = ({ addresses }: { addresses: SiteAddresses }) => {
  const ref = useRef<HTMLDivElement>(null);
  const truncated = useIsTruncated(ref, addresses.host);
  const target = (
    <Text ref={ref} truncate css={{ flexGrow: 1, minWidth: 0 }}>
      Publishing to{" "}
      {addresses.status === "live" ? (
        <Link href={addresses.origin} target="_blank" rel="noreferrer">
          {addresses.host}
        </Link>
      ) : (
        addresses.host
      )}
    </Text>
  );
  return (
    <Flex align="center" gap="2" css={{ minWidth: 0 }}>
      {truncated ? (
        <Tooltip content={addresses.host}>{target}</Tooltip>
      ) : (
        target
      )}
      <Text color="subtle" css={{ flexShrink: 0 }}>
        <Link href={addresses.manageDomainsUrl} {...newTabLink}>
          Manage domains ↗
        </Link>
      </Text>
    </Flex>
  );
};

/** A site that is not live: where to launch it, or put it back, in OrganizeOS. */
const LaunchLine = ({ addresses }: { addresses: SiteAddresses }) => {
  if (addresses.status === "live") {
    return;
  }
  return (
    <Text color="subtle">
      {addresses.status === "offline"
        ? "Your website is offline."
        : "Not live yet."}{" "}
      <Link href={addresses.websiteUrl} {...newTabLink}>
        {addresses.status === "offline"
          ? `Put it back from ${platformName} ↗`
          : `Launch your website from ${platformName} ↗`}
      </Link>
    </Text>
  );
};

/** A live site whose current version OrganizeOS will not serve. */
const CannotGoLiveWarning = ({
  addresses,
}: {
  addresses: SiteAddresses | undefined;
}) => {
  if (addresses?.status !== "live" || addresses.launchable !== false) {
    return;
  }
  return (
    <Flex gap="1" align="center">
      <AlertIcon color={cssVar("--foreground-warning")} />
      <Text css={{ color: cssVar("--foreground-warning") }}>
        This version can&apos;t go live yet. Publish again after the next
        builder update.
      </Text>
    </Flex>
  );
};

export const OrganizeosPublishContent = ({
  site,
}: {
  site: OrganizeosSite;
}) => {
  const project = useStore($project);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const [addresses, setAddresses] = useState<SiteAddresses>();

  const state = getOrganizeosPublishState(project?.latestBuildVirtual);
  const previousStatus = useRef(state.status);
  const projectId = project?.id;
  const mounted = useRef(true);
  // Reads can finish out of order (a slow first read after a publish's
  // refetch): only the latest one is shown.
  const latestRead = useRef(0);
  const readAddresses = (id: string) => {
    latestRead.current += 1;
    const read = latestRead.current;
    return loadSiteAddresses(id).then((loaded) => {
      if (mounted.current && read === latestRead.current) {
        setAddresses(loaded);
      }
      return loaded;
    });
  };

  // Where it publishes and whether the site is live, read when the dialog
  // opens
  useEffect(() => {
    mounted.current = true;
    if (projectId !== undefined) {
      readAddresses(projectId);
    }
    return () => {
      mounted.current = false;
    };
  }, [projectId]);

  // While the executor runs, keep the status fresh so the dialog (and the
  // admin) learn the outcome without a reload.
  useEffect(() => {
    if (state.status !== "pending") {
      return;
    }
    const interval = setInterval(() => {
      refreshProject().catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [state.status]);

  // Announce the outcome of a publish that was pending while the dialog was
  // open, and read the addresses again; a dialog opened onto an old result
  // stays quiet. The site is called live only when OrganizeOS serves this
  // version.
  useEffect(() => {
    if (
      previousStatus.current === "pending" &&
      projectId !== undefined &&
      (state.status === "published" || state.status === "failed")
    ) {
      const settled = state.status;
      if (settled === "failed") {
        toast.error("Publishing failed. Please try again.");
      }
      readAddresses(projectId).then((loaded) => {
        if (settled === "published") {
          if (servesThisVersion(loaded)) {
            toast.success(
              `Your site is live. Changes can take up to a minute to appear at ${loaded.host}.`,
              { duration: 10000 }
            );
          } else {
            toast.success("Published.");
          }
        }
      });
    }
    previousStatus.current = state.status;
  }, [state.status, projectId]);

  if (project === undefined) {
    return;
  }

  const handlePublish = async () => {
    setError(undefined);
    // a value that fails input validation would stop the build; name it here
    const blocker = findPublishBlocker({
      pages: $pages.get(),
      instances: $instances.get(),
      props: $props.get(),
      resources: $resources.get(),
      dataSources: $dataSources.get(),
    });
    if (blocker !== undefined) {
      setError(blocker);
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await nativeClient.domain.publish.mutate({
        projectId: project.id,
        domains: [project.domain],
        destination: "saas",
      });
      if (result.success === false) {
        const message =
          result.error === "NOT_IMPLEMENTED"
            ? "Publishing is not set up on this builder yet."
            : result.error;
        setError(message);
        toast.error(message);
      }
      // Either way the project's latest build changed; show it.
      await refreshProject();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Publishing failed.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPending = isSubmitting || state.status === "pending";

  return (
    <Grid css={{ padding: theme.panel.padding }} gap={3}>
      {addresses !== undefined && (
        <>
          <Grid gap={1}>
            <PublishingTo addresses={addresses} />
            <LaunchLine addresses={addresses} />
          </Grid>
          <Separator />
        </>
      )}

      <StatusLine state={state} />
      <CannotGoLiveWarning addresses={addresses} />
      {error !== undefined && <Text color="destructive">{error}</Text>}
      <RestrictedFeaturesBanner manageUrl={site.manageUrl} />
      <MdxBlocksBanner />
      <PausedScriptBanner />

      <Button
        type="button"
        color="positive"
        state={isPending ? "pending" : undefined}
        onClick={() => {
          handlePublish().catch(() => undefined);
        }}
      >
        {state.status === "published" ? "Publish changes" : "Publish"}
      </Button>
    </Grid>
  );
};
