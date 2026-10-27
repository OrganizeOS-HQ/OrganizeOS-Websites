import { useEffect, useState } from "react";
import { computed } from "nanostores";
import { useStore } from "@nanostores/react";
import {
  theme,
  Box,
  Button,
  Flex,
  PanelTitle,
  ScrollArea,
  Separator,
  Text,
} from "@webstudio-is/design-system";
import { $organizeosSite, $selectedPage } from "~/shared/nano-states";
import { platformName } from "~/shared/branding";
import {
  type CatalogEntry,
  findCatalogResources,
} from "~/shared/organizeos-preset-ids";
import { $dataSources, $project, $resources } from "~/shared/sync/data-stores";
import {
  addCatalogResourceToPage,
  isCatalogResourceOnPage,
} from "./organizeos-data";

/**
 * The OrganizeOS data tab of the left sidebar: the org's data catalog, which a
 * page can add (organizeos-data.ts), until the CMS tab takes this slot. The
 * blocks are listed in the Components panel's OrganizeOS section
 * (components-section.tsx), Section background is the Style panel's
 * Background presets section (background-presets-section.tsx), and Motion is
 * the Inspector's Motion tab (motion-tab.tsx).
 *
 * Offered only to orgs on the rollout allowlist: the sidebar hides the tab
 * otherwise ($isOrganizeosPanelAvailable).
 */

/** Whether the sidebar offers the tab: the org is on the blocks' allowlist. */
export const $isOrganizeosPanelAvailable = computed(
  $organizeosSite,
  (site) => site?.blocksEnabled === true
);

/**
 * The project's catalog, found by its deterministic ids, which take a hash to
 * derive, so it is refreshed asynchronously whenever the resources change.
 * Undefined until it first resolves, and with no project.
 */
const useCatalog = () => {
  const project = useStore($project);
  const resources = useStore($resources);
  const [catalog, setCatalog] = useState<CatalogEntry[]>();
  useEffect(() => {
    if (project === undefined) {
      setCatalog(undefined);
      return;
    }
    let isCurrent = true;
    findCatalogResources(project.id, resources.values()).then(
      (entries) => {
        if (isCurrent) {
          setCatalog(entries);
        }
      },
      (error) => console.error(error)
    );
    return () => {
      isCurrent = false;
    };
  }, [project, resources]);
  return catalog;
};

const DataSection = () => {
  const catalog = useCatalog();
  const dataSources = useStore($dataSources);
  const page = useStore($selectedPage);
  if (page === undefined || catalog === undefined) {
    return;
  }
  if (catalog.length === 0) {
    return (
      <Text
        color="subtle"
        css={{ paddingInline: theme.panel.paddingInline }}
        data-organizeos-data-empty
      >
        No data connected
      </Text>
    );
  }
  return (
    <Flex
      direction="column"
      gap="1"
      css={{ paddingInline: theme.panel.paddingInline }}
      data-organizeos-data
    >
      {catalog.map(({ resource }) => (
        <Flex key={resource.id} align="center" justify="between" gap="2">
          <Text truncate>{resource.name}</Text>
          {isCatalogResourceOnPage({
            page,
            dataSources,
            resourceId: resource.id,
          }) ? (
            <Text color="subtle" css={{ flexShrink: 0 }}>
              On this page
            </Text>
          ) : (
            <Button
              color="neutral"
              css={{ flexShrink: 0 }}
              onClick={() => addCatalogResourceToPage(resource.id)}
            >
              Add to this page
            </Button>
          )}
        </Flex>
      ))}
    </Flex>
  );
};

/**
 * The data list, without a title, under the OrganizeOS data tab's title.
 */
export const OrganizeosDataBody = () => {
  return (
    <ScrollArea>
      <Box
        css={{ paddingBlock: theme.panel.paddingBlock }}
        data-organizeos-data-body
      >
        <DataSection />
      </Box>
    </ScrollArea>
  );
};

export const OrganizeosPanel = () => {
  return (
    <>
      <PanelTitle>{`${platformName} data`}</PanelTitle>
      <Separator />
      <OrganizeosDataBody />
    </>
  );
};
