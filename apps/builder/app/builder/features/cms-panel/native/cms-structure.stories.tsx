import type { Meta, StoryObj } from "@storybook/react";
import {
  cssVar,
  DropdownMenuItem,
  toast,
  Toaster,
} from "@webstudio-is/design-system";
import { CmsScreen, type CmsScreenView } from "./cms-screen";
import type { CmsAccess, CmsCollectionSummary, CmsSource } from "./cms-source";
import type { CmsStructureSource } from "./cms-structure-source";
import { sampleCatalog, SampleOrphanRows } from "./sample-collection-actions";
import { createSampleCmsSource, sampleCatalogView } from "./sample-cms-source";
import {
  createSampleCmsStructure,
  SAMPLE_STRUCTURE_IDS,
  type SampleStructureOptions,
} from "./sample-cms-structure-source";

type Loaded = { source: CmsSource; structure: CmsStructureSource };

const meta: Meta = {
  // "Builder/" comes from the story source's title prefix
  title: "CMS (native)/Structure",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<{ view?: CmsScreenView }>;

const loadSource =
  ({
    access,
    longNames = false,
    ...options
  }: SampleStructureOptions & {
    access?: Partial<CmsAccess>;
    longNames?: boolean;
  } = {}) =>
  async (): Promise<Loaded> =>
    createSampleCmsStructure(
      createSampleCmsSource({
        access: {
          canEdit: true,
          canPublish: true,
          canManageSettings: true,
          ...access,
        },
        longNames,
      }),
      options
    );

/** The collection actions (4.5) as menu items, drawn as the data tab's. */
const renderActionItems = (collection: CmsCollectionSummary) => {
  const row = sampleCatalog.rows[collection.slug];
  if (row === undefined) {
    return null;
  }
  return (
    <>
      <DropdownMenuItem>
        {row.hasItemPage ? "Open item page" : "Create item page"}
      </DropdownMenuItem>
      <DropdownMenuItem>Add list</DropdownMenuItem>
      {row.isSitemapOrphan && (
        <DropdownMenuItem
          onSelect={() => toast.success("Removed from sitemap")}
        >
          Remove from sitemap
        </DropdownMenuItem>
      )}
    </>
  );
};

const render: Story["render"] = (args, { loaded }) => {
  const { source, structure } = loaded as Loaded;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: cssVar("--background-primary"),
      }}
    >
      <CmsScreen
        source={source}
        structure={structure}
        catalog={sampleCatalogView}
        renderCollectionActionItems={renderActionItems}
        collectionsFooter={<SampleOrphanRows catalog={sampleCatalog} />}
        initialView={args.view}
        homeUrl="https://app.organizeos.org/dashboard"
        onClose={() => {}}
        onOpenClassic={() => {}}
      />
      <Toaster />
    </div>
  );
};

const waitFor = async <Found extends Element>(
  root: HTMLElement,
  selector: string
): Promise<Found> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const found = root.ownerDocument.querySelector<Found>(selector);
    if (found !== null) {
      return found;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Not found: ${selector}`);
};

/** `scope`: a selector the button sits in, when a label repeats. */
const findButton = async (root: HTMLElement, label: string, scope = "") => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const button = Array.from(
      root.ownerDocument.querySelectorAll<HTMLButtonElement>(`${scope} button`)
    ).find(
      (candidate) =>
        (candidate.textContent?.trim() === label ||
          candidate.getAttribute("aria-label") === label) &&
        candidate.disabled === false
    );
    if (button !== undefined) {
      return button;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`No button: ${label}`);
};

const clickButton = async (root: HTMLElement, label: string, scope = "") =>
  (await findButton(root, label, scope)).click();

/** Radix menus open on pointerdown, not click. */
const openMenu = async (root: HTMLElement, label: string, scope = "") => {
  const trigger = await findButton(root, label, scope);
  trigger.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerType: "mouse",
    })
  );
  await waitFor(root, "[role=menu]");
};

const clickMenuItem = async (root: HTMLElement, label: string) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const item = Array.from(
      root.ownerDocument.querySelectorAll<HTMLElement>("[role=menuitem]")
    ).find((candidate) => candidate.textContent?.trim() === label);
    if (item !== undefined) {
      item.click();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`No menu item: ${label}`);
};

/** Types into a React-controlled field as a person would. */
const typeInto = (element: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

const news = SAMPLE_STRUCTURE_IDS.news;

/** The sheet's and settings' header, whose labels the column repeats. */
const header = "[data-cms-structure-header]";

/** The Fields tab: News's fields in order, the title marked. */
export const FieldsView: Story = {
  render,
  loaders: [loadSource()],
  args: { view: { collectionId: news, structure: { tab: "fields" } } },
};

/** The kinds, names with icons, grouped. */
export const AddFieldMenu: Story = {
  render,
  loaders: [loadSource()],
  args: { view: { collectionId: news, structure: { tab: "fields" } } },
  play: async ({ canvasElement }) => {
    await openMenu(canvasElement, "Add field");
  },
};

/** A saved field: key and kind fixed, Remove field in "...". */
export const FieldSheet: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: {
      collectionId: news,
      structure: {
        tab: "fields",
        view: { type: "field", target: { key: "summary" } },
      },
    },
  },
};

export const OptionField: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: {
      collectionId: news,
      structure: {
        tab: "fields",
        view: { type: "field", target: { key: "category" } },
      },
    },
  },
};

export const ReferenceField: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: {
      collectionId: news,
      structure: {
        tab: "fields",
        view: { type: "field", target: { key: "author" } },
      },
    },
  },
};

/** Leadership came from the Team template: its Role stays. */
export const TemplateField: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: {
      collectionId: SAMPLE_STRUCTURE_IDS.leadership,
      structure: {
        tab: "fields",
        view: { type: "field", target: { key: "role" } },
      },
    },
  },
};

export const NewField: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: {
      collectionId: news,
      structure: {
        tab: "fields",
        view: { type: "field", target: { kind: "text" } },
      },
    },
  },
};

/** "Summary" derives the key `summary`, which News already has. */
export const KeyInUse: Story = {
  render,
  loaders: [loadSource()],
  args: NewField.args,
  play: async ({ canvasElement }) => {
    const name = await waitFor<HTMLInputElement>(
      canvasElement,
      "#cms-field-sheet-label"
    );
    typeInto(name, "Summary");
    await clickButton(canvasElement, "Add field", header);
    await waitFor(canvasElement, "#cms-field-sheet-key-error");
  },
};

/** Removing a field strips it from every item: the count is the title. */
export const RemoveFieldDialog: Story = {
  render,
  loaders: [loadSource()],
  args: FieldSheet.args,
  play: async ({ canvasElement }) => {
    await openMenu(canvasElement, "More", header);
    await clickMenuItem(canvasElement, "Remove field");
    await waitFor(canvasElement, "[role=dialog]");
  },
};

/** A Core plan's 30 fields, all used. */
export const FieldCapReached: Story = {
  render,
  loaders: [loadSource({ plan: "core" })],
  args: {
    view: {
      collectionId: SAMPLE_STRUCTURE_IDS.survey,
      structure: { tab: "fields" },
    },
  },
};

/** A field name of about 80 characters, in the list and the crumb. */
export const LongFieldName: Story = {
  render,
  loaders: [loadSource({ longFieldName: true, longNames: true })],
  args: {
    view: {
      collectionId: SAMPLE_STRUCTURE_IDS.campaigns,
      structure: {
        tab: "fields",
        view: { type: "field", target: { key: "signatureGoal" } },
      },
    },
  },
};

export const CollectionSettings: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: { collectionId: news, structure: { view: { type: "settings" } } },
  },
};

export const CollectionSettingsLongName: Story = {
  render,
  loaders: [loadSource({ longNames: true })],
  args: CollectionSettings.args,
};

/** Campaigns already has the address `campaigns`. */
export const AddressInUse: Story = {
  render,
  loaders: [loadSource()],
  args: CollectionSettings.args,
  play: async ({ canvasElement }) => {
    const address = await waitFor<HTMLInputElement>(
      canvasElement,
      "#cms-settings-slug"
    );
    typeInto(address, "campaigns");
    await clickButton(canvasElement, "Save", header);
    await waitFor(canvasElement, "#cms-settings-slug-error");
  },
};

/** Settings, the collection actions, then Delete. */
export const RowMenu: Story = {
  render,
  loaders: [loadSource()],
  args: { view: { collectionId: news } },
  play: async ({ canvasElement }) => {
    await openMenu(canvasElement, "News menu");
  },
};

export const NewCollection: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: {
      collectionId: news,
      structure: { dialog: "new-collection", newCollectionType: "blog" },
    },
  },
};

/** A Core plan's 5 custom collections, all made: Custom is not offered. */
export const NewCollectionCustomCap: Story = {
  render,
  loaders: [loadSource({ plan: "core" })],
  args: {
    view: { collectionId: news, structure: { dialog: "new-collection" } },
  },
};

/** No collections yet: the templates, and nothing else. */
export const FirstRun: Story = {
  render,
  loaders: [loadSource({ empty: true })],
  args: { view: {} },
};

export const DeleteCollection: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: {
      collectionId: SAMPLE_STRUCTURE_IDS.shifts,
      structure: { dialog: "delete" },
    },
  },
};

/** News and Campaigns reference Leadership: no Delete until they stop. */
export const DeleteReferencedCollection: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: {
      collectionId: SAMPLE_STRUCTURE_IDS.leadership,
      structure: { dialog: "delete" },
    },
  },
};

/** Without `pages.manage_settings`: the fields, read-only. */
export const ReadOnlyFields: Story = {
  render,
  loaders: [loadSource({ access: { canManageSettings: false } })],
  args: FieldSheet.args,
};
