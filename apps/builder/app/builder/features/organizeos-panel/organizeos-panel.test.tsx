import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Project } from "@webstudio-is/project";
import { TooltipProvider } from "@webstudio-is/design-system";
import { createDefaultPages } from "@webstudio-is/project-build";
import { $, renderData } from "@webstudio-is/template";
import { $organizeosSite, selectInstance } from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { registerContainers } from "~/shared/sync/sync-stores";
import {
  $dataSources,
  $instances,
  $pages,
  $project,
  $props,
  $resources,
} from "~/shared/sync/data-stores";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import {
  findCatalogResources,
  type CatalogEntry,
} from "~/shared/organizeos-preset-ids";
import { buildOrgResourcePresets } from "~/shared/db/resource-presets.server";
import { registerTestMetas } from "./backgrounds/test-fixtures";
import {
  $isOrganizeosPanelAvailable,
  OrganizeosPanel,
} from "./organizeos-panel";

vi.mock("~/shared/organizeos-preset-ids", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/shared/organizeos-preset-ids")>();
  return {
    ...actual,
    findCatalogResources: vi.fn(actual.findCatalogResources),
  };
});

enableMapSet();
registerContainers();

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("$isOrganizeosPanelAvailable", () => {
  const site: OrganizeosSite = {
    organizationId: "org-1",
    manageUrl: "https://app.organizeos.org/dashboard",
    platformUrl: "https://app.organizeos.org",
    blocksEnabled: true,
  };

  test.each([
    ["an org on the blocks' allowlist", site, true],
    ["an org off it", { ...site, blocksEnabled: false }, false],
    ["a project no org owns", undefined, false],
  ])("offers the panel to %s: %s", (_case, value, expected) => {
    $organizeosSite.set(value);
    expect($isOrganizeosPanelAvailable.get()).toBe(expected);
  });
});

describe("the OrganizeOS data tab", () => {
  // Radix's ScrollArea observes its viewport, and jsdom 20 has no
  // ResizeObserver.
  class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  const projectId = "project-1";
  const line =
    "Add your organization's data to this page, then bind it in Settings.";
  const empty = "No organization data is connected to this site yet.";

  let root: Root | undefined;
  let container: HTMLElement | undefined;

  const setProject = async ({ withCatalog }: { withCatalog: boolean }) => {
    const data = renderData(
      <$.Body ws:id="bodyId">
        <$.Box ws:id="boxId"></$.Box>
      </$.Body>
    );
    $instances.set(data.instances);
    $props.set(data.props);
    $dataSources.set(new Map());
    const { resources } = withCatalog
      ? await buildOrgResourcePresets({
          projectId,
          apiBaseUrl: "https://staging.example.org/api/public/v1",
          readToken: "osk_token",
        })
      : { resources: [] };
    $resources.set(
      new Map(resources.map((resource) => [resource.id, resource]))
    );
    const pages = createDefaultPages({ rootInstanceId: "bodyId" });
    $pages.set(pages);
    $selectedPageId.set(pages.homePageId);
    $project.set({ id: projectId } as Project);
    $organizeosSite.set({
      organizationId: "org-1",
      manageUrl: "https://app.organizeos.org/dashboard",
      platformUrl: "https://app.organizeos.org",
      blocksEnabled: true,
    });
  };

  const render = () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        createElement(TooltipProvider, null, createElement(OrganizeosPanel))
      );
    });
    return container;
  };

  /** Lets findCatalogResources resolve and the tab render it. */
  const settle = async () => {
    await act(async () => {
      await vi.mocked(findCatalogResources).mock.results.at(-1)?.value;
    });
  };

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    registerTestMetas();
    vi.mocked(findCatalogResources).mockClear();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = undefined;
    container = undefined;
    vi.unstubAllGlobals();
  });

  test("titled OrganizeOS data with its line, and only the data list: no component card, no Background presets, no Motion", async () => {
    await setProject({ withCatalog: true });
    // a selection Background presets and Motion would both act on
    selectInstance(["boxId", "bodyId"]);
    const host = render();
    await settle();
    // the panel's title, then its line
    expect(host.textContent?.startsWith(`OrganizeOS data${line}`)).toBe(true);
    expect(host.querySelector("[data-organizeos-data-line]")?.textContent).toBe(
      line
    );
    const rows = host.querySelector("[data-organizeos-data]");
    expect(rows?.textContent).toContain("Events");
    expect(rows?.textContent).toContain("Add to this page");
    // no "Data" heading of its own: the title says it
    expect(
      Array.from(host.querySelectorAll("label"), (label) => label.textContent)
    ).not.toContain("Data");
    expect(host.querySelector("[data-drag-component]")).toBeNull();
    expect(host.textContent).not.toContain("Background presets");
    expect(host.textContent).not.toContain("Section background");
    expect(host.querySelector("[data-preset-grid]")).toBeNull();
    expect(host.querySelector("[data-motion-presets]")).toBeNull();
    expect(host.querySelector("[data-motion-refusal]")).toBeNull();
  });

  test("the empty state shows only after the catalog resolves", async () => {
    await setProject({ withCatalog: false });
    let resolve: (entries: CatalogEntry[]) => void = () => {};
    vi.mocked(findCatalogResources).mockImplementationOnce(
      () =>
        new Promise((resolver) => {
          resolve = resolver;
        })
    );
    const host = render();
    expect(host.querySelector("[data-organizeos-data-line]")).not.toBeNull();
    expect(host.textContent).not.toContain(empty);
    await act(async () => {
      resolve([]);
    });
    expect(
      host.querySelector("[data-organizeos-data-empty]")?.textContent
    ).toBe(empty);
  });

  test("nothing below the line with no selected page", async () => {
    await setProject({ withCatalog: true });
    $selectedPageId.set(undefined);
    const host = render();
    await settle();
    expect(host.querySelector("[data-organizeos-data-line]")?.textContent).toBe(
      line
    );
    expect(host.querySelector("[data-organizeos-data]")).toBeNull();
    expect(host.querySelector("[data-organizeos-data-empty]")).toBeNull();
    expect(host.textContent).not.toContain("Add to this page");
  });
});
