import { useEffect, useState } from "react";
import { computed } from "nanostores";
import { useStore } from "@nanostores/react";
import {
  theme,
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
import { CollapsibleSection } from "~/builder/shared/collapsible-section";
import {
  addCatalogResourceToPage,
  isCatalogResourceOnPage,
} from "./organizeos-data";
import { SectionBackground } from "./section-background";
import { Motion } from "./motion";

/**
 * The OrganizeOS tab of the left sidebar: Section background, Motion and the
 * org's data catalog, which a page can add (organizeos-data.ts). The blocks
 * are listed in the Components panel's OrganizeOS section
 * (components-section.tsx).
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
 */
const useCatalog = () => {
  const project = useStore($project);
  const resources = useStore($resources);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  useEffect(() => {
    if (project === undefined) {
      setCatalog([]);
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
  if (catalog.length === 0 || page === undefined) {
    return;
  }
  return (
    <CollapsibleSection label="Data" fullWidth>
      <Flex
        direction="column"
        gap="1"
        css={{ paddingInline: theme.panel.paddingInline }}
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
    </CollapsibleSection>
  );
};

export const OrganizeosPanel = () => {
  const selectedPage = useStore($selectedPage);

  return (
    <>
      <PanelTitle>{platformName}</PanelTitle>
      <Separator />

      <ScrollArea>
        {selectedPage?.meta.documentType !== "xml" && (
          <>
            <SectionBackground />
            <Motion />
          </>
        )}
        <DataSection />
      </ScrollArea>
    </>
  );
};
