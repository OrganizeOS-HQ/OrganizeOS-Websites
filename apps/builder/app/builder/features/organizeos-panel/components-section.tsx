import { computed } from "nanostores";
import { matchSorter } from "match-sorter";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import type { GeneratedTemplateMeta } from "@webstudio-is/template";
import {
  $organizeosSite,
  $registeredComponentMetas,
  $registeredTemplates,
} from "~/shared/nano-states";
import { getInstanceLabel } from "~/builder/shared/instance-label";
import { organizeosNamespace } from "./insert-organizeos-block";

/**
 * The OrganizeOS blocks as one section of upstream's Components panel
 * (features/components/components.tsx), after General. Their metas stay
 * `category: "hidden"`, since the category list is in @webstudio-is/sdk, which
 * this fork keeps byte-identical to upstream, so upstream's grouping skips
 * them. A few marked lines in the Components panel add this module's group,
 * and heading, and send a click or Enter on a block to
 * insertOrganizeosBlock, which binds it to the project's data as it inserts
 * it; the canvas routes a drop there by name (canvas/shared/use-drag-drop.ts).
 *
 * Offered only to orgs the deny list does not deny (`blocksEnabled`), and
 * never on an XML page. The Shop blocks also need the deployment's switch
 * (`shopBlocksEnabled`).
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
};

/**
 * The site forms (docs/ORGANIZEOS-FORK.md section 9, "Site forms"; builder
 * forms spec 5.1): with `ORGANIZEOS_SITE_FORMS` on, the "Signups" section is
 * "Forms", listing the cards and the Email bar under the insert names, and the
 * stacked Signup Form is not offered; with it off, the cards are not offered.
 */
const formsSection: Section = {
  label: "Forms",
  blocks: ["SignupFormCard", "SignupFormInline", "ContactFormCard"],
};

const formsLabels: Record<string, string> = {
  SignupFormCard: "Email & SMS updates",
  SignupFormInline: "Email bar",
  ContactFormCard: "Contact us",
};

const siteFormCards = ["SignupFormCard", "ContactFormCard"];

/**
 * The Shop blocks, by name without the namespace. They are offered only while
 * the deployment's switch is on (`shopBlocksEnabled`, `ORGANIZEOS_SHOP_BLOCKS`).
 */
export const shopBlocks = ["ProductGrid", "ProductCard"];

const isShopBlock = (name: string) =>
  shopBlocks.some((block) => name === `${organizeosNamespace}:${block}`);

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
  },
  // the forms section: "Signups" here, or "Forms" with the site forms switch
  // on (formsSection)
  {
    label: "Signups",
    blocks: ["SignupForm", "SignupFormInline"],
  },
  {
    // listed only while the Shop blocks are offered ($organizeosComponentGroups)
    label: "Shop",
    blocks: shopBlocks,
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
  blocks: Block[];
};

export const groupOrganizeosBlocks = (
  allTemplates: Map<string, GeneratedTemplateMeta>,
  metas: Map<string, WsComponentMeta>,
  { siteForms = false }: { siteForms?: boolean } = {}
): BlockSection[] => {
  const prefix = `${organizeosNamespace}:`;
  const hidden = new Set(
    (siteForms ? ["SignupForm"] : siteFormCards).map(
      (block) => `${prefix}${block}`
    )
  );
  const templates = new Map(
    [...allTemplates].filter(([name]) => hidden.has(name) === false)
  );
  const sectionsOffered = siteForms
    ? sections.map((section) =>
        section.label === "Signups" ? formsSection : section
      )
    : sections;
  const toBlock = (name: string, meta: GeneratedTemplateMeta): Block => ({
    name,
    label:
      (siteForms ? formsLabels[name.slice(prefix.length)] : undefined) ??
      meta.label ??
      metas.get(name)?.label ??
      getInstanceLabel({ component: name }),
    description: meta.description,
    icon: meta.icon,
    firstInstance: meta.template.instances[0],
  });
  const listed = new Set<string>();
  const grouped: BlockSection[] = sectionsOffered.map(({ label, blocks }) => {
    const sectionBlocks: Block[] = [];
    for (const block of blocks) {
      const name = `${prefix}${block}`;
      const meta = templates.get(name);
      if (meta !== undefined) {
        sectionBlocks.push(toBlock(name, meta));
        listed.add(name);
      }
    }
    return { label, blocks: sectionBlocks };
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

export type OrganizeosComponentGroup = {
  category: OrganizeosCategory;
  metas: ComponentsPanelMeta[];
};

/**
 * The OrganizeOS groups of the Components panel: none for a denied org, for
 * a project no org owns, or while no block is registered; otherwise one,
 * holding every section's blocks in order ("More" last). groupOrganizeosBlocks keeps
 * its per-section result, so a group per section would change only this
 * flattening.
 */
export const $organizeosComponentGroups = computed(
  [$registeredTemplates, $registeredComponentMetas, $organizeosSite],
  (templates, metas, site): OrganizeosComponentGroup[] => {
    if (site?.blocksEnabled !== true) {
      return [];
    }
    // Without the Shop blocks switch, neither the Shop section nor "More"
    // lists them, and "Find components" finds neither.
    const offered =
      site.shopBlocksEnabled === true
        ? templates
        : new Map(
            [...templates].filter(([name]) => isShopBlock(name) === false)
          );
    const blockSections = groupOrganizeosBlocks(offered, metas, {
      siteForms: site.siteFormsEnabled === true,
    });
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
  category === "organizeos" ? "Blocks" : undefined;
