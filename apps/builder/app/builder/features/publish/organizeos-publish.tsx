import { useEffect, useRef, useState } from "react";
import { computed } from "nanostores";
import { useStore } from "@nanostores/react";
import {
  Button,
  Flex,
  Grid,
  IconButton,
  Link,
  PanelBanner,
  Separator,
  Text,
  Tooltip,
  css,
  rawTheme,
  textVariants,
  theme,
  toast,
} from "@webstudio-is/design-system";
import {
  AlertIcon,
  CheckCircleIcon,
  CopyIcon,
  ExternalLinkIcon,
} from "@webstudio-is/icons";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import {
  $dataSources,
  $instances,
  $pages,
  $project,
  $props,
} from "~/shared/sync/data-stores";
import {
  $editingPageId,
  $permissions,
  $selectedPageId,
  selectInstance,
} from "~/shared/nano-states";
import { setActiveSidebarPanel } from "~/builder/shared/nano-states";
import { nativeClient } from "~/shared/trpc/trpc-client";
import { CopyToClipboard } from "~/shared/copy-to-clipboard";
import { RelativeTime } from "~/builder/shared/relative-time";
import { platformName } from "~/shared/branding";
import { getRestrictedFeatures } from "./restricted-features";
import { $openProjectSettings } from "~/shared/nano-states/project-settings";
import {
  findPausedScript,
  pausedScriptExplanation,
} from "./organizeos-publish-paused-script";
import {
  getOrganizeosPublishState,
  type OrganizeosPublishState,
} from "./organizeos-publish-status";

/**
 * The Publish dialog for an OrganizeOS site.
 *
 * Upstream's dialog is built around Webstudio hosting: a <project>.wstd.work
 * staging domain you can rename, staging credentials, custom domains verified
 * through Entri, per-domain checkboxes, plan upgrade banners and a static
 * export. None of that applies to an org's site: it is served by OrganizeOS
 * at the org's subdomain and its custom domains, which are managed there. So
 * this dialog shows the site's real address, points at OrganizeOS for
 * everything else, and has one Publish button whose status follows the
 * executor (see organizeos-publish-status.ts).
 */

const POLL_INTERVAL_MS = 10_000;

const $restrictedFeatures = computed(
  [$pages, $dataSources, $instances, $permissions],
  (pages, dataSources, instances, permissions) =>
    getRestrictedFeatures({ pages, dataSources, instances, permissions })
);

// OrganizeOS fork: what publishing leaves out while org script is paused
const $pausedScript = computed(
  [$pages, $instances, $props],
  (pages, instances, props) => findPausedScript({ pages, instances, props })
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

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

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
          <CheckCircleIcon color={rawTheme.colors.foregroundSuccessText} />
          <Text>
            Published <RelativeTime time={state.at} />
          </Text>
        </Flex>
      );
    case "failed":
      return (
        <Flex gap="1" align="center">
          <AlertIcon color={rawTheme.colors.foregroundDestructive} />
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
 * Lists the embeds, animations, unsafe values and custom code that this publish
 * leaves out while an org's own script is paused (docs/ORGANIZEOS-FORK.md
 * section 10).
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
      <Text as="ul" css={{ paddingLeft: "1em" }}>
        {pausedScript.map(({ label, navigate, view }, index) => (
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
      <Text>{pausedScriptExplanation}</Text>
    </PanelBanner>
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

  const state = getOrganizeosPublishState(project?.latestBuildVirtual);
  const previousStatus = useRef(state.status);

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
  // open; a dialog opened onto an old result stays quiet.
  useEffect(() => {
    if (previousStatus.current === "pending") {
      if (state.status === "published") {
        toast.success(
          site.siteUrl === undefined
            ? "Your site is live. Changes can take up to a minute to appear."
            : `Your site is live. Changes can take up to a minute to appear at ${hostOf(site.siteUrl)}.`,
          { duration: 10000 }
        );
      } else if (state.status === "failed") {
        toast.error("Publishing failed. Please try again.");
      }
    }
    previousStatus.current = state.status;
  }, [state.status, site.siteUrl]);

  if (project === undefined) {
    return;
  }

  const handlePublish = async () => {
    setIsSubmitting(true);
    setError(undefined);
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
      <Grid gap={1}>
        <Text variant="labels" color="main">
          Your site
        </Text>
        {site.siteUrl === undefined ? (
          <Text color="subtle">
            Your site&apos;s address is set in {platformName}.
          </Text>
        ) : (
          <Flex align="center" gap="1" css={{ minWidth: 0 }}>
            <Link
              href={site.siteUrl}
              target="_blank"
              rel="noreferrer"
              css={{
                flexGrow: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {hostOf(site.siteUrl)}
            </Link>
            <CopyToClipboard text={site.siteUrl} copyText="Copy link">
              <IconButton type="button" aria-label="Copy site link">
                <CopyIcon />
              </IconButton>
            </CopyToClipboard>
            <Tooltip content="Open site">
              <IconButton
                type="button"
                aria-label="Open site"
                onClick={() => {
                  window.open(site.siteUrl, "_blank", "noreferrer");
                }}
              >
                <ExternalLinkIcon />
              </IconButton>
            </Tooltip>
          </Flex>
        )}
        <Text color="subtle">
          <Link
            href={site.manageUrl}
            target="_blank"
            rel="noreferrer"
            color="inherit"
            variant="inherit"
          >
            Site settings ↗
          </Link>
        </Text>
      </Grid>

      <Separator />

      <StatusLine state={state} />
      {error !== undefined && <Text color="destructive">{error}</Text>}
      <RestrictedFeaturesBanner manageUrl={site.manageUrl} />
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
