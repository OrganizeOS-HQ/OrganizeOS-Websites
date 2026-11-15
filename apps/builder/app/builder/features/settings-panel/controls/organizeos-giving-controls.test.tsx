import {
  afterEach,
  beforeEach,
  describe,
  expect,
  onTestFinished,
  test,
  vi,
} from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { page, userEvent } from "@vitest/browser/context";
import { enableMapSet } from "immer";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import { renderData } from "@webstudio-is/template";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import {
  type DataSource,
  type Instance,
  type Resource,
  coreMetas,
} from "@webstudio-is/sdk";
import * as organizeosMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import { $ } from "@organizeos/site-components/site-templates";
import fundraisersBody from "../../../../../../../packages/sdk-components-organizeos/src/__fixtures__/fundraisers.json";
import {
  $organizeosSite,
  $propValuesByInstanceSelector,
  $registeredComponentMetas,
  $selectedInstanceSelector,
  getInstanceKey,
  registerComponentLibrary,
  selectInstance,
  subscribeResourceRequestPlan,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { $authPermit, $builderMode } from "~/shared/nano-states/misc";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
import {
  $assets,
  $breakpoints,
  $dataSources,
  $instances,
  $pages,
  $project,
  $props,
  $resources,
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import {
  $resourcesCache,
  computeResourceRequest,
  getResourceKey,
} from "~/shared/resources";
import { buildOrgResourcePresets } from "~/shared/db/resource-presets.server";
import {
  getOrganizeosPresetIds,
  insertOrganizeosBlock,
} from "~/builder/features/organizeos-panel/insert-organizeos-block";
import { PropsSectionContainer } from "../props-section/props-section";

const { loaderFetch } = vi.hoisted(() => ({ loaderFetch: vi.fn() }));
vi.mock("~/shared/fetch.client", () => ({ fetch: loaderFetch }));
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: vi.fn(), info: vi.fn() } },
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

enableMapSet();
registerContainers();
$registeredComponentMetas.set(
  new Map(Object.entries({ ...defaultMetas, ...coreMetas }))
);
registerComponentLibrary({
  namespace: "@organizeos/site-components",
  components: {},
  metas: organizeosMetas,
  templates: organizeosTemplates,
});

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const ns = "@organizeos/site-components";
const base = "https://staging.example.org/api/public/v1";
const provisioned = await buildOrgResourcePresets({
  projectId: "project-1",
  apiBaseUrl: base,
  readToken: "osk_eventstoken",
});

let root: Root | undefined;
let container: HTMLElement | undefined;

const settle = () =>
  act(async () => {
    for (let turn = 0; turn < 5; turn += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });

const setProject = () => {
  const data = renderData(<$.Body ws:id="bodyId"></$.Body>);
  $instances.set(data.instances);
  $props.set(data.props);
  $breakpoints.set(new Map());
  $styles.set(new Map());
  $styleSources.set(new Map());
  $styleSourceSelections.set(new Map());
  $assets.set(new Map());
  $resources.set(
    new Map(provisioned.resources.map((resource) => [resource.id, resource]))
  );
  $dataSources.set(new Map());
  const pages = createDefaultPages({ rootInstanceId: "bodyId" });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
  $builderMode.set("design");
  $authPermit.set("build");
  selectInstance(["bodyId"]);
  $project.set({ id: "project-1" } as Project);
  serverSyncStore.transactionManager.currentStack = [];
  serverSyncStore.transactionManager.undoneStack = [];
  $organizeosSite.set({
    organizationId: "org-1",
    manageUrl: "https://app.example.org/dashboard",
    platformUrl: "https://app.example.org",
    subdomain: "acme",
    blocksEnabled: true,
    givingBlocksEnabled: true,
  });
};

const insert = async (component: string) => {
  expect(await insertOrganizeosBlock(component)).toBe(true);
  const instance = [...$instances.get().values()].find(
    (item) => item.component === component
  ) as Instance;
  selectInstance([instance.id, "bodyId"]);
  return instance;
};

const renderPanel = async (rootId: string, width = 240) => {
  container = document.createElement("div");
  container.style.width = `${width}px`;
  document.body.appendChild(container);
  root = createRoot(container);
  const instance = $instances.get().get(rootId) as Instance;
  await act(async () =>
    root?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(PropsSectionContainer, {
          selectedInstance: instance,
          selectedInstanceKey: getInstanceKey([rootId, "bodyId"]),
        })
      )
    )
  );
  await settle();
  return container;
};

const stores = () => ({
  instances: $instances.get(),
  props: $props.get(),
  dataSources: $dataSources.get(),
  resources: $resources.get(),
});

const answer = (body: unknown, ok = true) =>
  loaderFetch.mockImplementation(async (_url: string, init: RequestInit) => {
    const [request] = JSON.parse(String(init.body));
    return {
      ok: true,
      json: async () => [
        [
          getResourceKey(request),
          { ok, status: ok ? 200 : 503, statusText: "", data: body },
        ],
      ],
    };
  });

const control = (host: HTMLElement, kind: string) =>
  host.querySelector<HTMLElement>(`[data-organizeos-control="${kind}"]`);

const undoDepth = () => serverSyncStore.transactionManager.currentStack.length;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  loaderFetch.mockReset();
  setProject();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
});

const SPRING = fundraisersBody.data[0].id;

const propOf = (instanceId: string, name: string) =>
  [...$props.get().values()].find(
    (prop) => prop.instanceId === instanceId && prop.name === name
  );

const optionTexts = () =>
  Array.from(
    document.querySelectorAll('[role="option"]'),
    (option) => option.textContent
  );

// builder donations spec 7.4; plan F1, task 7
describe("the Donation Form's rows", () => {
  test("Give to lists General giving first and marks drafts", async () => {
    answer(fundraisersBody);
    const form = await insert(`${ns}:DonationForm`);
    const host = await renderPanel(form.id);
    await vi.waitFor(() => expect(loaderFetch).toHaveBeenCalledTimes(1));
    const row = control(host, "giving-target");
    expect(row?.querySelector('[role="combobox"]')?.textContent).toBe(
      "General giving"
    );
    await userEvent.click(
      row?.querySelector('[role="combobox"]') as HTMLElement
    );
    expect(optionTexts()).toEqual([
      "General giving",
      "Spring Drive",
      "Flood Relief",
      "Year-End Match (draft)",
    ]);
  });

  test("one undo per change", async () => {
    answer(fundraisersBody);
    const form = await insert(`${ns}:DonationForm`);
    const host = await renderPanel(form.id);
    await vi.waitFor(() => expect(loaderFetch).toHaveBeenCalledTimes(1));
    const depth = undoDepth();
    await userEvent.click(
      control(host, "giving-target")?.querySelector(
        '[role="combobox"]'
      ) as HTMLElement
    );
    await userEvent.click(
      page.getByRole("option", { name: "Spring Drive", exact: true })
    );
    await settle();
    expect(propOf(form.id, "target")?.value).toBe(SPRING);
    expect(undoDepth()).toBe(depth + 1);
    await act(async () => serverSyncStore.undo());
    expect(propOf(form.id, "target")?.value).toBe("general");
  });

  test("Open in Fundraising follows the selection, in a new tab", async () => {
    answer(fundraisersBody);
    const form = await insert(`${ns}:DonationForm`);
    const host = await renderPanel(form.id);
    await vi.waitFor(() => expect(loaderFetch).toHaveBeenCalledTimes(1));
    const link = () =>
      control(host, "giving-target")?.querySelector<HTMLAnchorElement>(
        "a[aria-label='Open in Fundraising']"
      );
    expect(link()?.getAttribute("href")).toBe(
      "https://app.example.org/acme/fundraisers"
    );
    expect(link()?.getAttribute("target")).toBe("_blank");
    expect(link()?.getAttribute("rel")).toBe("noopener noreferrer");
    await userEvent.click(
      control(host, "giving-target")?.querySelector(
        '[role="combobox"]'
      ) as HTMLElement
    );
    await userEvent.click(
      page.getByRole("option", { name: "Spring Drive", exact: true })
    );
    await settle();
    expect(link()?.getAttribute("href")).toBe(
      `https://app.example.org/acme/fundraisers/${SPRING}/edit`
    );
  });

  test("no Open in Fundraising without a subdomain", async () => {
    answer(fundraisersBody);
    const form = await insert(`${ns}:DonationForm`);
    $organizeosSite.set({ ...$organizeosSite.get()!, subdomain: undefined });
    const host = await renderPanel(form.id);
    await vi.waitFor(() => expect(loaderFetch).toHaveBeenCalledTimes(1));
    expect(
      control(host, "giving-target")?.querySelector(
        "a[aria-label='Open in Fundraising']"
      )
    ).toBeNull();
  });

  test("the warning line: Re-insert this block, then Fundraiser not found", async () => {
    answer(fundraisersBody);
    const form = await insert(`${ns}:DonationForm`);
    const host = await renderPanel(form.id);
    await vi.waitFor(() => expect(loaderFetch).toHaveBeenCalledTimes(1));
    const warning = () =>
      control(host, "giving-target")?.querySelector("[data-giving-warning]");
    expect(warning()).toBeNull();
    await act(async () =>
      $organizeosSite.set({
        ...$organizeosSite.get()!,
        organizationId: "another-org",
      })
    );
    await settle();
    expect(warning()?.textContent).toBe("Re-insert this block");
  });

  test("an unknown fundraiser reads Fundraiser not found once the list loaded", async () => {
    answer(fundraisersBody);
    const form = await insert(`${ns}:DonationForm`);
    const unknown = "b1c2d3e4-0000-4000-8000-0000000000ff";
    const target = propOf(form.id, "target")!;
    $props.set(
      new Map($props.get()).set(target.id, { ...target, value: unknown })
    );
    const host = await renderPanel(form.id);
    await vi.waitFor(() =>
      expect(
        control(host, "giving-target")?.querySelector("[data-giving-warning]")
          ?.textContent
      ).toBe("Fundraiser not found")
    );
  });

  test("a failed read says so, and Reload reads again", async () => {
    let resolve: (value: unknown) => void = () => {};
    loaderFetch.mockImplementation(
      () => new Promise((done) => (resolve = done))
    );
    const form = await insert(`${ns}:DonationForm`);
    const host = await renderPanel(form.id);
    const line = () =>
      control(host, "giving-target")?.querySelector("[data-giving-load]");
    expect(line()).toBeNull();
    await act(async () => resolve({ ok: false, json: async () => [] }));
    await settle();
    expect(line()?.textContent).toBe("Fundraisers didn't load. Reload");
    expect(
      control(host, "giving-target")?.querySelector("[data-giving-warning]")
    ).toBeNull();
    answer(fundraisersBody);
    await userEvent.click(page.getByRole("button", { name: "Reload" }));
    await settle();
    expect(loaderFetch).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(line()).toBeNull());
  });

  test("State writes ready and unavailable", async () => {
    answer(fundraisersBody);
    const form = await insert(`${ns}:DonationForm`);
    const host = await renderPanel(form.id);
    const row = control(host, "giving-state");
    expect(row?.querySelector('[role="combobox"]')?.textContent).toBe("Ready");
    await userEvent.click(
      row?.querySelector('[role="combobox"]') as HTMLElement
    );
    expect(optionTexts()).toEqual(["Ready", "Not taking gifts"]);
    await userEvent.click(
      page.getByRole("option", { name: "Not taking gifts", exact: true })
    );
    await settle();
    expect(propOf(form.id, "state")?.value).toBe("unavailable");
  });

  test("After the gift: Message, or Page with its page picker", async () => {
    answer(fundraisersBody);
    const form = await insert(`${ns}:DonationForm`);
    const host = await renderPanel(form.id);
    const row = () => control(host, "giving-after-gift");
    expect(row()?.textContent).toContain("Message");
    expect(row()?.querySelector("[data-after-gift-page]")).toBeNull();
    await userEvent.click(page.getByRole("radio", { name: "Page" }));
    await settle();
    expect(propOf(form.id, "afterGift")?.value).toBe("page");
    expect(row()?.querySelector("[data-after-gift-page]")).not.toBeNull();
  });

  test("the rows fit the panel, and the org and origin have none", async () => {
    answer(fundraisersBody);
    const form = await insert(`${ns}:DonationForm`);
    const host = await renderPanel(form.id);
    await settle();
    expect(
      Array.from(host.querySelectorAll("[data-organizeos-control]"), (row) =>
        row.getAttribute("data-organizeos-control")
      )
    ).toEqual(["giving-target", "giving-state", "giving-after-gift"]);
    for (const row of host.querySelectorAll("[data-organizeos-control]")) {
      expect((row as HTMLElement).scrollWidth).toBeLessThanOrEqual(240);
    }
  });
});

describe("Goal Progress's rows", () => {
  test("Give to lists the bound fundraisers, with the open link, and a change invalidates the read", async () => {
    // a resource's value is computed only while its request plan is
    // subscribed, as builder.tsx subscribes it
    const unsubscribe = subscribeResourceRequestPlan(() => {});
    onTestFinished(unsubscribe);
    answer(fundraisersBody);
    const progress = await insert(`${ns}:GoalProgress`);
    // the bound read, as the builder's loader would have cached it
    const { fundraisers } = await getOrganizeosPresetIds("project-1");
    const resource = $resources.get().get(fundraisers.resourceId)!;
    const request = await computeResourceRequest(resource, new Map());
    $resourcesCache.set(
      new Map([
        [
          getResourceKey(request),
          { ok: true, status: 200, statusText: "", data: fundraisersBody },
        ],
      ])
    );
    const host = await renderPanel(progress.id);
    await vi.waitFor(() =>
      expect(
        $propValuesByInstanceSelector
          .get()
          .get(getInstanceKey([progress.id, "bodyId"]))
          ?.get("data")
      ).toEqual(fundraisersBody)
    );
    await settle();
    const calls = loaderFetch.mock.calls.length;
    const row = control(host, "giving-record");
    await vi.waitFor(() =>
      expect(row?.querySelector('[role="combobox"]')).not.toBeNull()
    );
    await userEvent.click(
      row?.querySelector('[role="combobox"]') as HTMLElement
    );
    expect(optionTexts()).toEqual([
      "Spring Drive",
      "Flood Relief",
      "Year-End Match (draft)",
    ]);
    await userEvent.click(
      page.getByRole("option", { name: "Spring Drive", exact: true })
    );
    await settle();
    expect(propOf(progress.id, "record")?.value).toBe(SPRING);
    expect(
      row
        ?.querySelector("a[aria-label='Open in Fundraising']")
        ?.getAttribute("href")
    ).toBe(`https://app.example.org/acme/fundraisers/${SPRING}/edit`);
    await vi.waitFor(() =>
      expect(loaderFetch.mock.calls.length).toBeGreaterThan(calls)
    );
  });
});
