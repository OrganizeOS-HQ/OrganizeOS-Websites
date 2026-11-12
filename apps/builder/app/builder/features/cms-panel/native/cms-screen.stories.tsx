import type { Meta, StoryObj } from "@storybook/react";
import { cssVar, Toaster } from "@webstudio-is/design-system";
import { CmsScreen, type CmsScreenView } from "./cms-screen";
import type { CmsAccess } from "./cms-source";
import {
  renderSampleCollectionActions,
  sampleCatalog,
  SampleOrphanRows,
  type SampleCatalog,
} from "./sample-collection-actions";
import {
  createSampleCmsSource,
  SAMPLE_COLLECTION_IDS,
  SAMPLE_ITEM_IDS,
  sampleCatalogView,
  type SampleCmsFlags,
  type SampleCmsSource,
} from "./sample-cms-source";

type Loaded = { source: SampleCmsSource };

const meta: Meta = {
  // "Builder/" comes from the story source's title prefix
  title: "CMS (native)",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<{
  view?: CmsScreenView;
  longNames?: boolean;
}>;

const loadSource =
  ({
    flags = {},
    access,
    longNames = false,
  }: {
    flags?: SampleCmsFlags;
    access?: Partial<CmsAccess>;
    longNames?: boolean;
  } = {}) =>
  async (): Promise<Loaded> => ({
    source: createSampleCmsSource({
      flags: { ...flags },
      access: {
        canEdit: true,
        canPublish: true,
        canManageSettings: true,
        ...access,
      },
      longNames,
    }),
  });

const longSampleCatalog: SampleCatalog = {
  ...sampleCatalog,
  orphans: [
    {
      name: "Press releases from the communications team, archived before the 2026 site",
      isStale: false,
      sitemapSlug: "press-releases",
    },
    {
      name: "Events and actions calendar for every local, unit and chapter in the region",
      isStale: true,
    },
  ],
};

/**
 * Full size, as the overlay shows it: everything right of the builder's
 * rail, full height.
 */
const Overlay = ({
  source,
  view,
  longNames = false,
}: {
  source: SampleCmsSource;
  view?: CmsScreenView;
  longNames?: boolean;
}) => {
  const catalog = longNames ? longSampleCatalog : sampleCatalog;
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
        catalog={sampleCatalogView}
        renderCollectionActions={renderSampleCollectionActions(catalog)}
        collectionsFooter={<SampleOrphanRows catalog={catalog} />}
        initialView={view}
        homeUrl="https://app.organizeos.org/dashboard"
        onClose={() => {}}
        onOpenClassic={() => {}}
      />
      <Toaster />
    </div>
  );
};

const render: Story["render"] = (args, { loaded }) => (
  <Overlay
    source={(loaded as Loaded).source}
    view={args.view}
    longNames={args.longNames}
  />
);

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

/** Types into a React-controlled field as a person would. */
const typeInto = (
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
) => {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(
    element,
    value
  );
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

const clickButton = async (root: HTMLElement, label: string) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const button = Array.from(
      root.ownerDocument.querySelectorAll<HTMLButtonElement>("button")
    ).find(
      (candidate) =>
        (candidate.textContent?.trim() === label ||
          candidate.getAttribute("aria-label") === label) &&
        candidate.disabled === false
    );
    if (button !== undefined) {
      button.click();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`No button: ${label}`);
};

const editSummary = async (root: HTMLElement) => {
  const summary = await waitFor<HTMLTextAreaElement>(
    root,
    "#cms-field-summary"
  );
  typeInto(
    summary,
    "A first contract that sets pay scales, seniority and a grievance process for every member."
  );
};

const fairContract: CmsScreenView = {
  collectionId: SAMPLE_COLLECTION_IDS.campaigns,
  itemId: SAMPLE_ITEM_IDS.fairContract2027,
};

const safeStaffing: CmsScreenView = {
  collectionId: SAMPLE_COLLECTION_IDS.campaigns,
  itemId: SAMPLE_ITEM_IDS.safeStaffingNow,
};

/** The column and the first page of a long collection. */
export const CollectionsAndItems: Story = {
  render,
  loaders: [loadSource()],
  args: { view: { collectionId: SAMPLE_COLLECTION_IDS.news } },
};

export const LongCollectionPageTwo: Story = {
  render,
  loaders: [loadSource()],
  args: { view: { collectionId: SAMPLE_COLLECTION_IDS.news, page: 2 } },
};

/** No items yet: New item in its place, no search, nothing else. */
export const EmptyCollection: Story = {
  render,
  loaders: [loadSource()],
  args: { view: { collectionId: SAMPLE_COLLECTION_IDS.locals } },
};

export const SearchWithNoResults: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: { collectionId: SAMPLE_COLLECTION_IDS.news, query: "picket fence" },
  },
};

/** Names of about 80 characters, in the column, the top bar and the rows. */
export const LongNames: Story = {
  render,
  loaders: [loadSource({ longNames: true })],
  args: {
    view: { collectionId: SAMPLE_COLLECTION_IDS.campaigns },
    longNames: true,
  },
};

/** The crumb with both names long: the collection gives way first. */
export const LongNamesEditor: Story = {
  render,
  loaders: [loadSource({ longNames: true })],
  args: { view: safeStaffing, longNames: true },
};

/** Campaigns use all 15 field kinds. */
export const EditorEveryFieldKind: Story = {
  render,
  loaders: [loadSource()],
  args: { view: fairContract },
};

export const NewItem: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: { collectionId: SAMPLE_COLLECTION_IDS.campaigns, itemId: null },
  },
};

export const StagedItem: Story = {
  render,
  loaders: [loadSource()],
  args: { view: safeStaffing },
};

/** Discard changes on a staged item: the dialog opens on Cancel. */
export const StagedDiscardDialog: Story = {
  render,
  loaders: [loadSource()],
  args: { view: safeStaffing },
  play: async ({ canvasElement }) => {
    await clickButton(canvasElement, "Discard changes");
    await waitFor(canvasElement, "[role=dialog]");
  },
};

/** A story saved with a picture: read-only until slice 3. */
export const ReadOnlyRichText: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: {
      collectionId: SAMPLE_COLLECTION_IDS.campaigns,
      itemId: SAMPLE_ITEM_IDS.childcareStipend,
    },
  },
};

/** A Lite-era bare URL photo. */
export const LiteImage: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: {
      collectionId: SAMPLE_COLLECTION_IDS.leadership,
      itemId: SAMPLE_ITEM_IDS.lenaFischer,
    },
  },
};

/** Without `pages.edit`: every control disabled, no buttons. */
export const ReadOnlyEditor: Story = {
  render,
  loaders: [loadSource({ access: { canEdit: false, canPublish: false } })],
  args: { view: fairContract },
};

/** Without `pages.publish`: Save is the primary button. */
export const EditorWithoutPublish: Story = {
  render,
  loaders: [loadSource({ access: { canPublish: false } })],
  args: { view: safeStaffing },
};

/** The client checks, each in a few words under its field. */
export const FieldErrors: Story = {
  render,
  loaders: [loadSource()],
  args: { view: fairContract },
  play: async ({ canvasElement }) => {
    typeInto(
      await waitFor<HTMLInputElement>(canvasElement, "#cms-field-name"),
      ""
    );
    typeInto(
      await waitFor<HTMLInputElement>(canvasElement, "#cms-field-contactEmail"),
      "campaigns at eastbrookworkers"
    );
    typeInto(
      await waitFor<HTMLInputElement>(canvasElement, "#cms-field-petition"),
      "eastbrookworkers petitions"
    );
    await clickButton(canvasElement, "Save");
    await waitFor(canvasElement, "[data-cms-field] [role=alert]");
  },
};

/** The rich text's Link popover. */
export const LinkPopover: Story = {
  render,
  loaders: [loadSource()],
  args: { view: fairContract },
  play: async ({ canvasElement }) => {
    await waitFor(canvasElement, "[data-cms-rich-text]");
    await clickButton(canvasElement, "Link");
    await waitFor(canvasElement, "[data-radix-popper-content-wrapper] input");
  },
};

/** Someone else saved first: the save comes back `conflict`. */
export const Conflict: Story = {
  render,
  loaders: [loadSource({ flags: { conflictOnNextWrite: true } })],
  args: { view: fairContract },
  play: async ({ canvasElement }) => {
    await editSummary(canvasElement);
    await clickButton(canvasElement, "Save");
    await waitFor(canvasElement, "[data-cms-conflict]");
  },
};

/**
 * After Reload: the other edit shows, the line stays while an edit is set
 * aside, and "Use my edit" puts it back.
 */
export const ConflictReloaded: Story = {
  render,
  loaders: [loadSource({ flags: { conflictOnNextWrite: true } })],
  args: Conflict.args,
  play: async (context) => {
    await Conflict.play?.(context);
    await clickButton(context.canvasElement, "Reload");
    await waitFor(context.canvasElement, "[data-cms-use-mine]");
  },
};

/**
 * A save whose answer was lost although it landed: the editor reads the
 * item back and ends clean, with no conflict line (4.3.2).
 */
export const UnknownOutcome: Story = {
  render,
  loaders: [loadSource({ flags: { lostAnswerOnNextWrite: true } })],
  args: { view: fairContract },
  play: async ({ canvasElement }) => {
    await editSummary(canvasElement);
    await clickButton(canvasElement, "Save");
    await waitFor(canvasElement, '[data-cms-status="Staged changes"]');
  },
};

/** Back with unsaved edits runs the guard; it opens on Keep editing. */
export const DiscardDialog: Story = {
  render,
  loaders: [loadSource()],
  args: { view: fairContract },
  play: async ({ canvasElement }) => {
    await editSummary(canvasElement);
    await clickButton(canvasElement, "Back");
    await waitFor(canvasElement, "[role=dialog]");
  },
};

export const SignedOut: Story = {
  render,
  loaders: [loadSource({ flags: { refuse: "unauthorized" } })],
};

export const TwoStepSignInRequired: Story = {
  render,
  loaders: [loadSource({ flags: { refuse: "mfa_required" } })],
};

export const NoAccess: Story = {
  render,
  loaders: [loadSource({ flags: { refuse: "forbidden" } })],
};

export const PlanRefusal: Story = {
  render,
  loaders: [loadSource({ flags: { refuse: "plan" } })],
};
