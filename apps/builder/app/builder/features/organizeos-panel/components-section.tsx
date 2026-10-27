import { computed } from "nanostores";
import { useStore } from "@nanostores/react";
import { matchSorter } from "match-sorter";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import type { GeneratedTemplateMeta } from "@webstudio-is/template";
import { theme, Flex, Link, Text } from "@webstudio-is/design-system";
import {
  $organizeosSite,
  $registeredComponentMetas,
  $registeredTemplates,
} from "~/shared/nano-states";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { platformName, platformUrl } from "~/shared/branding";
import { getInstanceLabel } from "~/builder/shared/instance-label";
import { organizeosNamespace } from "./insert-organizeos-block";

/**
 * The OrganizeOS blocks as one section of upstream's Components panel
 * (features/components/components.tsx), after General. Their metas stay
 * `category: "hidden"`, since the category list is in @webstudio-is/sdk, which
 * this fork keeps byte-identical to upstream, so upstream's grouping skips
 * them. A few marked lines in the Components panel add this module's group,
 * heading and links, and send a click or Enter on a block to
 * insertOrganizeosBlock, which binds it to the project's data as it inserts
 * it; the canvas routes a drop there by name (canvas/shared/use-drag-drop.ts).
 *
 * Offered only to orgs on the rollout allowlist (`blocksEnabled`), and never
 * on an XML page.
 */

export type OrganizeosCategory = "organizeos";

/** The shape of the Components panel's own `Meta`, which it keeps private. */
export type ComponentsPanelMeta = {
  name: string;
  category: string;
  order: undefined | number;
  label: string;
  description: undefined | string;
  icon?: string;
  firstInstance: { component: string; tag?: string };
};

type Section = {
  label: string;
  /** Block names without the namespace, in the order they are listed. */
  blocks: string[];
  /** The workspace area where the org makes what these blocks act on. */
  area?: { label: string; path: string };
};

// Signups, Events, Membership and Donations in the spec; so far the Signup
// Form, the Events blocks, Rotating Tabs, Marquee, Convergence Field and Rich
// Text. A section names its blocks in the order they are listed, and one that
// is not registered (yet) is skipped.
const sections: Section[] = [
  {
    // Page sections that read no platform data, so the insert binds nothing.
    label: "Sections",
    blocks: ["RotatingTabs", "Marquee", "ConvergenceField"],
  },
  {
    // Shows a collection item's rich text. The insert binds nothing: a
    // designer binds its value to an item's field inside a collection.
    label: "Content",
    blocks: ["RichText"],
  },
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

export type OrganizeosComponentGroup = {
  category: OrganizeosCategory;
  metas: ComponentsPanelMeta[];
  /** The workspace areas of the group's blocks, shown at its foot. */
  links: Array<NonNullable<Section["area"]>>;
};

/**
 * The OrganizeOS groups of the Components panel: none off the allowlist, for
 * a project no org owns, or while no block is registered; otherwise one,
 * holding every section's blocks in order ("More" last) and the sections'
 * workspace links in order. groupOrganizeosBlocks keeps its per-section
 * result, so a group per section would change only this flattening.
 */
export const $organizeosComponentGroups = computed(
  [$registeredTemplates, $registeredComponentMetas, $organizeosSite],
  (templates, metas, site): OrganizeosComponentGroup[] => {
    if (site?.blocksEnabled !== true) {
      return [];
    }
    const blockSections = groupOrganizeosBlocks(templates, metas);
    if (blockSections.length === 0) {
      return [];
    }
    return [
      {
        category: "organizeos",
        metas: blockSections.flatMap((section) =>
          section.blocks.map((block) => ({
            name: block.name,
            category: "organizeos",
            order: undefined,
            label: block.label,
            description: block.description,
            icon: block.icon,
            firstInstance: block.firstInstance,
          }))
        ),
        links: blockSections.flatMap((section) =>
          section.area === undefined ? [] : [section.area]
        ),
      },
    ];
  }
);

type Group<Category> = {
  category: Category;
  metas: ComponentsPanelMeta[];
};

/**
 * Upstream's groups with the OrganizeOS groups added: unchanged on an XML
 * page or with no OrganizeOS group; with no search, each OrganizeOS group
 * after General (first when General is absent); with a search, one "found"
 * group ranking upstream's matches and the blocks together, with upstream's
 * keys, or none when nothing matches. It builds that group itself, since
 * upstream drops an empty group, so a search only blocks match arrives as [].
 */
export const withOrganizeosGroups = <Category extends string>(
  groups: Array<Group<Category | "found" | OrganizeosCategory>>,
  organizeosGroups: ReadonlyArray<Group<OrganizeosCategory>>,
  { documentType, search }: { documentType?: string; search: string }
): Array<Group<Category | "found" | OrganizeosCategory>> => {
  if (documentType === "xml" || organizeosGroups.length === 0) {
    return groups;
  }
  if (search.length === 0) {
    const general = groups.findIndex((group) => group.category === "general");
    const placed = [...groups];
    // after General, or first when there is none (findIndex gives -1)
    placed.splice(
      general + 1,
      0,
      ...organizeosGroups.map(({ category, metas }) => ({ category, metas }))
    );
    return placed;
  }
  const found = groups.find((group) => group.category === "found")?.metas ?? [];
  const organizeosMetas = organizeosGroups.flatMap((group) => group.metas);
  const metas = matchSorter([...found, ...organizeosMetas], search, {
    keys: ["label"],
  });
  return metas.length === 0 ? [] : [{ category: "found", metas }];
};

/** The heading of an OrganizeOS group; undefined for upstream's categories. */
export const organizeosGroupLabel = (category: string) =>
  category === "organizeos" ? platformName : undefined;

/**
 * The workspace links at the foot of a group: the OrganizeOS group's, and
 * nothing for a category without links.
 */
export const OrganizeosGroupFooter = ({ category }: { category: string }) => {
  const organizeosGroups = useStore($organizeosComponentGroups);
  const site = useStore($organizeosSite);
  const links =
    organizeosGroups.find((group) => group.category === category)?.links ?? [];
  if (links.length === 0) {
    return;
  }
  return (
    <Flex
      direction="column"
      data-organizeos-links
      css={{ paddingInline: theme.panel.paddingInline }}
    >
      {links.map((link) => (
        <Text color="subtle" key={link.path}>
          <Link
            href={getWorkspaceAreaUrl(site, link.path)}
            target="_blank"
            rel="noreferrer"
            color="inherit"
            variant="inherit"
          >
            {link.label}
          </Link>
        </Text>
      ))}
    </Flex>
  );
};
