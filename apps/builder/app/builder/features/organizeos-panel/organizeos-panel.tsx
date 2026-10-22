import { useEffect, useMemo, useState } from "react";
import { computed } from "nanostores";
import { useStore } from "@nanostores/react";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import type { GeneratedTemplateMeta } from "@webstudio-is/template";
import {
  theme,
  Button,
  ComponentCard,
  Flex,
  Link,
  List,
  ListItem,
  PanelTitle,
  ScrollArea,
  Separator,
  Text,
} from "@webstudio-is/design-system";
import type { Publish } from "~/shared/pubsub";
import {
  $organizeosSite,
  $registeredComponentMetas,
  $registeredTemplates,
  $selectedPage,
} from "~/shared/nano-states";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { platformName, platformUrl } from "~/shared/branding";
import {
  type CatalogEntry,
  findCatalogResources,
} from "~/shared/organizeos-preset-ids";
import { $dataSources, $project, $resources } from "~/shared/sync/data-stores";
import { CollapsibleSection } from "~/builder/shared/collapsible-section";
import {
  getInstanceLabel,
  InstanceIcon,
} from "~/builder/shared/instance-label";
import {
  dragItemAttribute,
  useDraggable,
} from "~/builder/features/components/use-draggable";
import {
  insertOrganizeosBlock,
  organizeosNamespace,
} from "./insert-organizeos-block";
import {
  addCatalogResourceToPage,
  isCatalogResourceOnPage,
} from "./organizeos-data";

/**
 * The OrganizeOS panel (spec section 3.1): the blocks registered under the
 * @organizeos/site-components namespace, in sections. Their metas are hidden,
 * so the Components panel never lists them; this one does, and inserts each
 * through insertOrganizeosBlock so it arrives bound to the project's data.
 * Then the org's data catalog, which a page can add (organizeos-data.ts).
 *
 * Offered only to orgs on the rollout allowlist: the sidebar hides the tab
 * otherwise ($isOrganizeosPanelAvailable).
 */

/** Whether the sidebar offers the panel: the org is on the blocks' allowlist. */
export const $isOrganizeosPanelAvailable = computed(
  $organizeosSite,
  (site) => site?.blocksEnabled === true
);

type Section = {
  label: string;
  /** Block names without the namespace, in the order they are listed. */
  blocks: string[];
  /** The workspace area where the org makes what these blocks act on. */
  area?: { label: string; path: string };
};

// Signups, Events, Membership and Donations in the spec; so far the Signup
// Form and the Events blocks. A section names its blocks in the order they are
// listed, and one that is not registered (yet) is skipped.
const sections: Section[] = [
  {
    label: "Events",
    blocks: ["EventList", "EventCard", "RsvpForm"],
    // The workspace's events area, where the org makes the events these list.
    area: { label: `Manage events in ${platformName}`, path: "events" },
  },
  {
    label: "Signups",
    blocks: ["SignupForm"],
    // The workspace's Embeds hub, where the org makes its signup forms.
    area: { label: `Manage forms in ${platformName}`, path: "pages/embeds" },
  },
];

type Block = {
  name: string;
  label: string;
  description: undefined | string;
  icon: undefined | string;
  firstInstance: { component: string; tag?: string };
};

export type BlockSection = {
  label: string;
  area?: Section["area"];
  blocks: Block[];
};

export const groupOrganizeosBlocks = (
  templates: Map<string, GeneratedTemplateMeta>,
  metas: Map<string, WsComponentMeta>
): BlockSection[] => {
  const prefix = `${organizeosNamespace}:`;
  const toBlock = (name: string, meta: GeneratedTemplateMeta): Block => ({
    name,
    label:
      meta.label ??
      metas.get(name)?.label ??
      getInstanceLabel({ component: name }),
    description: meta.description,
    icon: meta.icon,
    firstInstance: meta.template.instances[0],
  });
  const listed = new Set<string>();
  const grouped: BlockSection[] = sections.map(({ label, area, blocks }) => {
    const sectionBlocks: Block[] = [];
    for (const block of blocks) {
      const name = `${prefix}${block}`;
      const meta = templates.get(name);
      if (meta !== undefined) {
        sectionBlocks.push(toBlock(name, meta));
        listed.add(name);
      }
    }
    return { label, area, blocks: sectionBlocks };
  });
  // A block no section names yet is still offered, after the others.
  const unlisted = [...templates].filter(
    ([name]) => name.startsWith(prefix) && listed.has(name) === false
  );
  if (unlisted.length > 0) {
    grouped.push({
      label: "More",
      blocks: unlisted.map(([name, meta]) => toBlock(name, meta)),
    });
  }
  return grouped.filter((section) => section.blocks.length > 0);
};

/**
 * A link into the org's workspace on the app host,
 * <platform URL>/<subdomain>/<path>, beside the Website area the builder's
 * menu links to (<platform URL>/<subdomain>/website). Without a known
 * subdomain it is the Website area's own URL, which is then the platform
 * dashboard; for a project no org owns, the platform home.
 */
export const getWorkspaceAreaUrl = (
  site: undefined | OrganizeosSite,
  path: string
) => {
  if (site === undefined) {
    return platformUrl;
  }
  if (site.subdomain === undefined) {
    return site.manageUrl;
  }
  return `${site.platformUrl}/${site.subdomain}/${path}`;
};

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

const $blockSections = computed(
  [$registeredTemplates, $registeredComponentMetas],
  groupOrganizeosBlocks
);

export const OrganizeosPanel = ({
  publish,
  onClose,
}: {
  publish: Publish;
  onClose: () => void;
}) => {
  const blockSections = useStore($blockSections);
  const site = useStore($organizeosSite);
  const selectedPage = useStore($selectedPage);
  const availableComponents = useMemo(
    () =>
      new Set(
        blockSections.flatMap((section) =>
          section.blocks.map((block) => block.name)
        )
      ),
    [blockSections]
  );
  const { dragCard, draggableContainerRef, isDragging } = useDraggable({
    publish,
    availableComponents,
  });

  const handleInsert = (component: string) => {
    void insertOrganizeosBlock(component);
    onClose();
  };

  return (
    <>
      <PanelTitle>{platformName}</PanelTitle>
      <Separator />

      <ScrollArea ref={draggableContainerRef}>
        {selectedPage?.meta.documentType === "xml" ? (
          <Text color="subtle" css={{ padding: theme.panel.padding }}>
            {platformName} blocks go on HTML pages.
          </Text>
        ) : (
          blockSections.map((section) => (
            <CollapsibleSection
              label={section.label}
              key={section.label}
              fullWidth
            >
              <List asChild>
                <Flex
                  gap="1"
                  wrap="wrap"
                  css={{
                    paddingInline: theme.panel.paddingInline,
                    overflow: "auto",
                  }}
                >
                  {section.blocks.map((block, index) => (
                    <ListItem
                      asChild
                      index={index}
                      key={block.name}
                      onSelect={() => handleInsert(block.name)}
                    >
                      <ComponentCard
                        {...{ [dragItemAttribute]: block.name }}
                        // the Components panel's card width: three to a row
                        css={{ width: 69 }}
                        label={block.label}
                        description={block.description}
                        disableTooltip={isDragging}
                        icon={
                          <InstanceIcon
                            size="auto"
                            instance={block.firstInstance}
                            icon={block.icon}
                          />
                        }
                      />
                    </ListItem>
                  ))}
                </Flex>
              </List>
              {section.area && (
                <Text
                  color="subtle"
                  css={{ paddingInline: theme.panel.paddingInline }}
                >
                  <Link
                    href={getWorkspaceAreaUrl(site, section.area.path)}
                    target="_blank"
                    rel="noreferrer"
                    color="inherit"
                    variant="inherit"
                  >
                    {section.area.label}
                  </Link>
                </Text>
              )}
            </CollapsibleSection>
          ))
        )}
        <DataSection />
        {dragCard}
      </ScrollArea>
    </>
  );
};
