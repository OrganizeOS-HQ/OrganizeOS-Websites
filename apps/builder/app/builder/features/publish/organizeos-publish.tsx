import { useEffect, useId, useRef, useState } from "react";
import { computed } from "nanostores";
import { useStore } from "@nanostores/react";
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Flex,
  Grid,
  IconButton,
  Label,
  Link,
  PanelBanner,
  Text,
  Tooltip,
  css,
  cssVar,
  textVariants,
  theme,
  useIsTruncated,
} from "@webstudio-is/design-system";
import { AlertIcon, CheckCircleIcon, EllipsesIcon } from "@webstudio-is/icons";
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
import { planBadgeLabel } from "~/shared/branding";
import { getRestrictedFeatures } from "./restricted-features";
import { $openProjectSettings } from "~/shared/nano-states/project-settings";
import {
  findMdxBlocks,
  findPausedScript,
  type PausedScriptItem,
} from "./organizeos-publish-paused-script";
import { tickedCheckboxCss } from "./organizeos-publish-checkbox";
import { findPublishBlocker } from "./organizeos-publish-code-check";
import {
  getOrganizeosPublishState,
  type OrganizeosPublishState,
} from "./organizeos-publish-status";
import {
  loadSiteAddresses,
  publishToTargets,
  unpublishTarget,
  type SiteAddresses,
  type SiteTarget,
} from "./organizeos-publish-addresses";
import {
  canUnpublish,
  cannotGoLive,
  isServing,
  manageDomainsUrlOf,
  newTabLink,
  nextTicks,
  publishErrorLine,
  replaceState,
  rowLabel,
  rowWord,
  unpublishErrorLine,
} from "./organizeos-publish-targets";

/**
 * The Publish dialog for an OrganizeOS site.
 *
 * Upstream's dialog is built around Webstudio hosting: a <project>.wstd.work
 * staging domain you can rename, staging credentials, custom domains verified
 * through Entri, plan upgrade banners and a static export. None of that
 * applies to an org's site: it is served by OrganizeOS at the org's built-in
 * address and its domains, which are managed there. So this dialog lists the
 * addresses OrganizeOS reports (organizeos-publish-addresses.ts), one row
 * each with a checkbox, whether it is live and when it was last published,
 * and publishes to the ticked ones (organizeos-publish-targets.ts). Its status
 * row follows the executor (organizeos-publish-status.ts).
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

/** The latest build's state, once; nothing before the first publish. */
const StatusRow = ({ state }: { state: OrganizeosPublishState }) => {
  switch (state.status) {
    case "idle":
      return;
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
 * admin knows what will not work once it is live. Each one selects its
 * element, or opens its settings, when clicked.
 */
const RestrictedFeaturesBanner = () => {
  const restrictedFeatures = useStore($restrictedFeatures);
  if (restrictedFeatures.size === 0) {
    return;
  }
  return (
    <PanelBanner variant="warning">
      <Text variant="regularBold">{planBadgeLabel}</Text>
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

const exactTime = (time: string) => new Date(time).toLocaleString();

/**
 * One address: a checkbox, the host (linked while it serves the site,
 * truncated with its full text in a tooltip), and under it its label, its word
 * (Live, Not live or Shows your old site) and when it was last published. A
 * row with a recorded build has Unpublish in its menu, while the builder can
 * ask; choosing it turns the second line into a confirm, its buttons on a
 * row of their own so they fit the panel.
 */
const TargetRow = ({
  target,
  word,
  ticked,
  onTickedChange,
  unpublish,
}: {
  target: SiteTarget;
  word: string;
  ticked: boolean;
  onTickedChange: (ticked: boolean) => void;
  unpublish?: {
    confirming: boolean;
    disabled: boolean;
    onAsk: () => void;
    onCancel: () => void;
    onConfirm: () => void;
  };
}) => {
  const id = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const truncated = useIsTruncated(hostRef, target.host);
  const label = rowLabel(target);
  const serving = isServing(target);
  const host = (
    <Text ref={hostRef} truncate css={{ minWidth: 0 }}>
      {serving ? (
        <Link href={`https://${target.host}`} {...newTabLink}>
          {target.host}
        </Link>
      ) : (
        <Label htmlFor={id} css={{ display: "inline" }}>
          {target.host}
        </Label>
      )}
    </Text>
  );
  return (
    <Grid
      css={{
        gridTemplateColumns:
          unpublish === undefined
            ? "auto minmax(0, 1fr)"
            : "auto minmax(0, 1fr) auto",
        columnGap: theme.spacing[5],
        alignItems: "start",
      }}
    >
      <Checkbox
        id={id}
        aria-label={target.host}
        css={tickedCheckboxCss}
        checked={ticked}
        onCheckedChange={(value) => onTickedChange(value === true)}
      />
      <Grid css={{ minWidth: 0 }}>
        {truncated ? <Tooltip content={target.host}>{host}</Tooltip> : host}
        {unpublish?.confirming ? (
          <Grid css={{ minWidth: 0, rowGap: theme.spacing[3] }}>
            <Text truncate css={{ minWidth: 0 }}>
              Unpublish {target.host}?
            </Text>
            <Flex justify="end" gap="2">
              <Button
                type="button"
                color="neutral"
                autoFocus
                onClick={unpublish.onCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                color="destructive"
                disabled={unpublish.disabled}
                onClick={unpublish.onConfirm}
              >
                Unpublish
              </Button>
            </Flex>
          </Grid>
        ) : (
          <Text color="subtle" truncate>
            {label === undefined ? "" : `${label} · `}
            {word}
            {target.publishedAt === null ? undefined : (
              <>
                {" · "}
                <Tooltip content={exactTime(target.publishedAt)}>
                  <span>
                    <RelativeTime time={new Date(target.publishedAt)} />
                  </span>
                </Tooltip>
              </>
            )}
          </Text>
        )}
      </Grid>
      {unpublish === undefined ? undefined : (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <IconButton
              type="button"
              aria-label={`${target.host} menu`}
              disabled={unpublish.disabled}
            >
              <EllipsesIcon />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem withIndicator={false} onSelect={unpublish.onAsk}>
              Unpublish
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </Grid>
  );
};

type Read = "loading" | "failed" | "ready";

export const OrganizeosPublishContent = ({
  site,
}: {
  site: OrganizeosSite;
}) => {
  const project = useStore($project);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const [addresses, setAddresses] = useState<SiteAddresses>();
  const [read, setRead] = useState<Read>("loading");
  // undefined until the first read with targets sets the live addresses
  const [ticks, setTicks] = useState<Set<string>>();
  // Unpublish: the row awaiting its confirm, one in flight, and whether
  // OrganizeOS said the action is not available (hidden for this session)
  const [confirmingKey, setConfirmingKey] = useState<string>();
  const [unpublishing, setUnpublishing] = useState(false);
  const [unpublishHidden, setUnpublishHidden] = useState(false);
  // The replace confirm, open above the footer
  const [confirmingReplace, setConfirmingReplace] = useState(false);

  const state = getOrganizeosPublishState(project?.latestBuildVirtual);
  const previousStatus = useRef(state.status);
  const projectId = project?.id;
  const mounted = useRef(true);
  // Reads can finish out of order (a slow first read after a publish's
  // refetch): only the latest one is shown.
  const latestRead = useRef(0);
  const readAddresses = (id: string, { reset }: { reset: boolean }) => {
    latestRead.current += 1;
    const current = latestRead.current;
    return loadSiteAddresses(id).then((loaded) => {
      if (mounted.current === false || current !== latestRead.current) {
        return;
      }
      if (loaded === undefined) {
        setRead("failed");
        return;
      }
      setAddresses(loaded);
      setRead("ready");
      const targets = loaded.targets;
      if (targets !== undefined) {
        setTicks((previous) => nextTicks(previous, targets, { reset }));
      }
    });
  };

  // The addresses, read when the dialog opens
  useEffect(() => {
    mounted.current = true;
    if (projectId !== undefined) {
      readAddresses(projectId, { reset: false });
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

  // A publish that was pending while the dialog was open settled: read the
  // addresses again, and tick what is live now. A dialog opened onto an old
  // result reads nothing more.
  useEffect(() => {
    if (
      previousStatus.current === "pending" &&
      projectId !== undefined &&
      (state.status === "published" || state.status === "failed")
    ) {
      readAddresses(projectId, { reset: true });
    }
    previousStatus.current = state.status;
  }, [state.status, projectId]);

  if (project === undefined) {
    return;
  }

  const targets = read === "ready" ? addresses?.targets : undefined;
  const tickedKeys = (targets ?? [])
    .filter((target) => ticks?.has(target.key))
    .map((target) => target.key);
  const isPending = isSubmitting || unpublishing || state.status === "pending";
  const oldSiteKey = read === "ready" ? addresses?.oldSiteKey : undefined;
  const actions = read === "ready" && addresses?.actions === true;
  const replace = replaceState(tickedKeys, targets ?? [], oldSiteKey);
  const anchorHost = (targets ?? []).find(
    (target) => target.key === oldSiteKey
  )?.host;

  const handleUnpublish = async (key: string) => {
    setError(undefined);
    setUnpublishing(true);
    try {
      const outcome = await unpublishTarget(project.id, key);
      if (outcome.ok === false) {
        if (outcome.error === "unavailable") {
          setUnpublishHidden(true);
        }
        const line = unpublishErrorLine(outcome);
        if (line !== undefined) {
          setError(line);
        }
      }
      // Whatever the answer, the rows show what OrganizeOS reports now
      await refreshProject().catch(() => undefined);
      await readAddresses(project.id, { reset: false });
    } finally {
      setConfirmingKey(undefined);
      setUnpublishing(false);
    }
  };

  const handlePublish = async ({
    replacePages = false,
  }: { replacePages?: boolean } = {}) => {
    setError(undefined);
    setConfirmingReplace(false);
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
      const outcome = await publishToTargets(project.id, tickedKeys, {
        replacePages,
      });
      if (outcome.ok === false) {
        setError(publishErrorLine(outcome));
      }
      // Whatever the answer, the rows show what OrganizeOS reports now
      await refreshProject().catch(() => undefined);
      await readAddresses(project.id, { reset: false });
    } finally {
      setIsSubmitting(false);
    }
  };

  const manageDomainsUrl = manageDomainsUrlOf(site, addresses);

  return (
    <Grid css={{ padding: theme.panel.padding }} gap={3}>
      <StatusRow state={state} />

      {targets !== undefined && targets.length > 0 && (
        <Grid gap={2}>
          {targets.map((target) => (
            <TargetRow
              key={target.key}
              target={target}
              word={rowWord(target, oldSiteKey)}
              unpublish={
                canUnpublish(target, { actions, hidden: unpublishHidden })
                  ? {
                      confirming: confirmingKey === target.key,
                      disabled: isPending,
                      onAsk: () => setConfirmingKey(target.key),
                      onCancel: () => setConfirmingKey(undefined),
                      onConfirm: () => {
                        handleUnpublish(target.key).catch(() => undefined);
                      },
                    }
                  : undefined
              }
              ticked={ticks?.has(target.key) ?? false}
              onTickedChange={(ticked) => {
                setTicks((previous) => {
                  const next = new Set(previous);
                  if (ticked) {
                    next.add(target.key);
                  } else {
                    next.delete(target.key);
                  }
                  return next;
                });
              }}
            />
          ))}
        </Grid>
      )}
      {read === "ready" && addresses?.targets === undefined && (
        <Text color="subtle">Addresses unavailable.</Text>
      )}
      {read === "failed" && (
        <Text color="destructive">
          Couldn&apos;t load your addresses.{" "}
          <button
            className={buttonLinkClass}
            type="button"
            onClick={() => {
              setRead("loading");
              readAddresses(project.id, { reset: false });
            }}
          >
            Retry
          </button>
        </Text>
      )}
      {cannotGoLive(read === "ready" ? addresses : undefined, state) && (
        <Flex gap="1" align="center">
          <AlertIcon color={cssVar("--foreground-warning")} />
          <Text css={{ color: cssVar("--foreground-warning") }}>
            This version can&apos;t go live. Publish again.
          </Text>
        </Flex>
      )}
      {replace === "needs_anchor" && anchorHost !== undefined && (
        <Text color="subtle">Tick {anchorHost} to replace your old site.</Text>
      )}
      {error !== undefined && <Text color="destructive">{error}</Text>}

      <RestrictedFeaturesBanner />
      <MdxBlocksBanner />
      <PausedScriptBanner />

      {confirmingReplace && replace === "confirm" && (
        <Flex align="center" gap="1" css={{ minWidth: 0 }}>
          <Text css={{ minWidth: 0, flexGrow: 1 }}>
            Replace your old site at {anchorHost} and your other addresses?
          </Text>
          <Button
            type="button"
            color="neutral"
            autoFocus
            onClick={() => setConfirmingReplace(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            color="destructive"
            disabled={isPending}
            onClick={() => {
              handlePublish({ replacePages: true }).catch(() => undefined);
            }}
          >
            Replace
          </Button>
        </Flex>
      )}

      <Flex align="center" justify="between" gap="2">
        {manageDomainsUrl === undefined ? (
          <span />
        ) : (
          <Text color="subtle" css={{ flexShrink: 0 }}>
            <Link
              href={manageDomainsUrl}
              color="inherit"
              variant="inherit"
              {...newTabLink}
            >
              Manage domains ↗
            </Link>
          </Text>
        )}
        <Button
          type="button"
          color="positive"
          disabled={
            tickedKeys.length === 0 ||
            isPending ||
            replace === "needs_anchor" ||
            confirmingReplace
          }
          state={isPending ? "pending" : undefined}
          onClick={() => {
            if (replace === "confirm") {
              setConfirmingReplace(true);
              return;
            }
            handlePublish().catch(() => undefined);
          }}
        >
          Publish to selected
        </Button>
      </Flex>
    </Grid>
  );
};
