import type { Meta, StoryObj } from "@storybook/react";
import { cssVar, Toaster } from "@webstudio-is/design-system";
import { CmsScreen, type CmsScreenView } from "./cms-screen";
import {
  createSampleCmsSource,
  SAMPLE_COLLECTION_IDS,
  sampleCatalogView,
  type SampleCmsFlags,
  type SampleCmsSource,
} from "./sample-cms-source";

/** Sample items the stories open (`sample-cms-source.ts` ids). */
const SAFE_STAFFING_NOW = "00000002-0000-4000-8000-000000000001";
const FAIR_CONTRACT_2027 = "00000002-0000-4000-8000-000000000002";

type Loaded = { source: SampleCmsSource };

const meta: Meta = {
  // "Builder/" comes from the story source's title prefix
  title: "CMS (native)",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<{
  view?: CmsScreenView;
  flags?: SampleCmsFlags;
}>;

const loadSource =
  (flags: SampleCmsFlags = {}) =>
  async (): Promise<Loaded> => ({
    source: createSampleCmsSource({ flags: { ...flags } }),
  });

/**
 * Full size, as the overlay shows it: everything right of the builder's
 * rail, full height.
 */
const Overlay = ({
  source,
  view,
}: {
  source: SampleCmsSource;
  view?: CmsScreenView;
}) => (
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
      initialView={view}
      homeUrl="https://app.organizeos.org/dashboard"
      onClose={() => {}}
      onOpenClassic={() => {}}
    />
    <Toaster />
  </div>
);

const render: Story["render"] = (args, { loaded }) => (
  <Overlay source={(loaded as Loaded).source} view={args.view} />
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

export const EmptyCollection: Story = {
  render,
  loaders: [loadSource()],
  args: { view: { collectionId: SAMPLE_COLLECTION_IDS.locals } },
};

/** Campaigns use all 15 field kinds. */
export const EditorEveryFieldKind: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: {
      collectionId: SAMPLE_COLLECTION_IDS.campaigns,
      itemId: FAIR_CONTRACT_2027,
    },
  },
};

export const StagedItem: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: {
      collectionId: SAMPLE_COLLECTION_IDS.campaigns,
      itemId: SAFE_STAFFING_NOW,
    },
  },
};

/** Someone else saved first: the save comes back `conflict`. */
export const Conflict: Story = {
  render,
  loaders: [loadSource({ conflictOnNextWrite: true })],
  args: {
    view: {
      collectionId: SAMPLE_COLLECTION_IDS.campaigns,
      itemId: FAIR_CONTRACT_2027,
    },
  },
  play: async ({ canvasElement }) => {
    await editSummary(canvasElement);
    await clickButton(canvasElement, "Save");
    await waitFor(canvasElement, "[data-cms-conflict]");
  },
};

/** After Reload: the other edit shows, and "Use my edit" puts mine back. */
export const ConflictReloaded: Story = {
  render,
  loaders: [loadSource({ conflictOnNextWrite: true })],
  args: Conflict.args,
  play: async (context) => {
    await Conflict.play?.(context);
    await clickButton(context.canvasElement, "Reload");
    await waitFor(context.canvasElement, "[data-cms-use-mine]");
  },
};

export const PlanRefusal: Story = {
  render,
  loaders: [loadSource({ refuse: "plan" })],
};

/** Back with unsaved edits runs the guard. */
export const DiscardDialog: Story = {
  render,
  loaders: [loadSource()],
  args: {
    view: {
      collectionId: SAMPLE_COLLECTION_IDS.campaigns,
      itemId: FAIR_CONTRACT_2027,
    },
  },
  play: async ({ canvasElement }) => {
    await editSummary(canvasElement);
    await clickButton(canvasElement, "Back");
    await waitFor(canvasElement, "[role=dialog]");
  },
};
