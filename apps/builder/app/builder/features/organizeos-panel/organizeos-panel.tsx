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
  $dataSources,
  $instances,
  $pages,
  $props,
  $resources,
} from "~/shared/sync/data-stores";
import {
  addCatalogResourceToPage,
  isCatalogResourceOnPage,
} from "./organizeos-data";
import { findCollectionItemPage } from "./collection-pages";
import { CollectionRow, OrphanRow } from "./collection-row-menu";
import {
  getCollectionSlug,
  joinCatalog,
  useCatalog,
} from "./collection-catalog";

/**
 * The OrganizeOS data tab of the left sidebar: the org's data catalog, which a
 * page can add (organizeos-data.ts), until the CMS tab takes this slot. The
 * blocks are listed in the Components panel's OrganizeOS section
 * (components-section.tsx), Section background is the Style panel's
 * Background presets section (background-presets-section.tsx), and Motion is
 * the Inspector's Motion tab (motion-tab.tsx).
 *
 * Offered only to orgs the deny list does not deny: the sidebar hides the tab
 * otherwise ($isOrganizeosPanelAvailable).
 */

/** Whether the sidebar offers the tab: the org is not denied the blocks. */
export const $isOrganizeosPanelAvailable = computed(
  $organizeosSite,
  (site) => site?.blocksEnabled === true
);

const DataSection = () => {
  const catalog = useCatalog();
  const dataSources = useStore($dataSources);
  const resources = useStore($resources);
  const pages = useStore($pages);
  const instances = useStore($instances);
  const props = useStore($props);
  const page = useStore($selectedPage);
  if (page === undefined || pages === undefined || catalog === undefined) {
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
  const data = { pages, instances, props, dataSources, resources };
  const { catalogSlugs, isStaleFor, unmatchedStalePages, sitemapOrphans } =
    joinCatalog(catalog, data);
  return (
    <Flex
      direction="column"
      gap="1"
      css={{ paddingInline: theme.panel.paddingInline }}
      data-organizeos-data
    >
      {catalog.map((entry) => {
        const { resource } = entry;
        const isOnPage = isCatalogResourceOnPage({
          page,
          dataSources,
          resourceId: resource.id,
        });
        const slug = getCollectionSlug(entry);
        if (slug !== undefined) {
          return (
            <CollectionRow
              key={resource.id}
              resource={resource}
              slug={slug}
              itemPage={findCollectionItemPage(slug, pages)}
              isOnPage={isOnPage}
              isStale={isStaleFor(resource)}
              isSitemapOrphan={sitemapOrphans.includes(slug)}
            />
          );
        }
        return (
          <Flex key={resource.id} align="center" justify="between" gap="2">
            <Text truncate>{resource.name}</Text>
            {isOnPage ? (
              <Text color="subtle" css={{ flexShrink: 0 }}>
                On this page
              </Text>
            ) : (
              <Button
                color="neutral"
                css={{ flexShrink: 0 }}
                onClick={() => void addCatalogResourceToPage(resource.id)}
              >
                Add to this page
              </Button>
            )}
          </Flex>
        );
      })}
      {unmatchedStalePages.map(({ page }) => (
        <OrphanRow key={page.id} name={page.name} isStale={true} />
      ))}
      {sitemapOrphans
        .filter((slug) => catalogSlugs.has(slug) === false)
        .map((slug) => (
          <OrphanRow
            key={`sitemap:${slug}`}
            name={slug}
            isStale={false}
            sitemapSlug={slug}
          />
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
