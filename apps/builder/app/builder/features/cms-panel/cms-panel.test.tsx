import { createElement, isValidElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { toast, TooltipProvider } from "@webstudio-is/design-system";
import { defaultPlanFeatures } from "@webstudio-is/plans";
import type { ResourceRequest } from "@webstudio-is/sdk";
import { createDefaultPages } from "@webstudio-is/project-build";
import {
  $authPermit,
  $builderMode,
  $canvasIframeState,
  $computedResourceRequests,
  $organizeosSite,
  $planFeatures,
  $selectedInstanceRenderState,
  $workspaceRole,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { $pages } from "~/shared/sync/data-stores";
import { registerContainers } from "~/shared/sync/sync-stores";
import { invalidateResource } from "~/shared/resources";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import {
  $activeSidebarPanel,
  $dataLoadingState,
  setActiveSidebarPanel,
} from "~/builder/shared/nano-states";
import {
  getAvailablePanels,
  SidebarLeft,
} from "../../sidebar-left/sidebar-left";
import {
  $cmsDirty,
  $cmsFrameMounted,
  $cmsPanelView,
  $isCmsPanelAvailable,
  CMS_FRAME_SANDBOX,
  COLLECTION_CHANGED_NOTICE,
  DISCARD_MESSAGE,
  getCmsPanelSrc,
} from "./cms-panel";

vi.mock("~/shared/resources", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/shared/resources")>()),
  invalidateResource: vi.fn(),
}));

enableMapSet();
registerContainers();

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const orgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const platformUrl = "https://app.organizeos.org";

const site: OrganizeosSite = {
  organizationId: orgId,
  manageUrl: `${platformUrl}/acme/website`,
  platformUrl,
  blocksEnabled: true,
  cmsPanelEnabled: true,
};

const setAvailable = () => {
  $organizeosSite.set(site);
  $planFeatures.set({ ...defaultPlanFeatures, allowDynamicData: true });
  $workspaceRole.set("administrators");
  $authPermit.set("admin");
};

describe("$isCmsPanelAvailable", () => {
  beforeEach(setAvailable);

  test("is offered for an OrganizeOS project with the switch, the plan and a role above viewer", () => {
    expect($isCmsPanelAvailable.get()).toBe(true);
  });

  test.each([
    ["a project no org owns", () => $organizeosSite.set(undefined)],
    [
      "the switch off",
      () => $organizeosSite.set({ ...site, cmsPanelEnabled: false }),
    ],
    [
      "a site from before the switch",
      () => $organizeosSite.set({ ...site, cmsPanelEnabled: undefined }),
    ],
    [
      "a plan without dynamic data",
      () =>
        $planFeatures.set({ ...defaultPlanFeatures, allowDynamicData: false }),
    ],
    ["the viewers relation", () => $workspaceRole.set("viewers")],
    ["a view-only permit", () => $authPermit.set("view")],
  ])("is hidden for %s", (_case, change) => {
    change();
    expect($isCmsPanelAvailable.get()).toBe(false);
  });

  test("is offered to editors, the content-mode relation", () => {
    $workspaceRole.set("editors");
    $authPermit.set("edit");
    expect($isCmsPanelAvailable.get()).toBe(true);
  });
});

describe("getAvailablePanels", () => {
  const names = (organizeos: boolean, cms: boolean) =>
    getAvailablePanels(organizeos, cms).map(({ name }) => name);

  test("the CMS panel takes the OrganizeOS data tab's slot", () => {
    expect(names(true, true)).toEqual([
      "components",
      "cms",
      "pages",
      "navigator",
      "assets",
    ]);
    expect(names(false, true)).toEqual([
      "components",
      "cms",
      "pages",
      "navigator",
      "assets",
    ]);
  });

  test("without the CMS panel the OrganizeOS data tab is unchanged", () => {
    expect(names(true, false)).toEqual([
      "components",
      "organizeos",
      "pages",
      "navigator",
      "assets",
    ]);
    expect(names(false, false)).toEqual([
      "components",
      "pages",
      "navigator",
      "assets",
    ]);
  });

  test("the CMS panel shows in Design and Content modes, wider than the others", () => {
    const cms = getAvailablePanels(true, true).find(
      ({ name }) => name === "cms"
    );
    expect(cms?.label).toBe("CMS");
    expect(cms?.visibility).toEqual({ content: true });
    expect(cms?.maxWidth).toBe("min(960px, 70vw)");
    expect(cms?.defaultWidth).toBe(448);
    for (const panel of getAvailablePanels(true, true)) {
      if (panel.name !== "cms") {
        expect(panel.maxWidth).toBeUndefined();
        expect(panel.defaultWidth).toBeUndefined();
      }
    }
  });
});

describe("the CMS panel in the left sidebar", () => {
  let root: Root | undefined;
  let container: HTMLElement | undefined;

  const render = () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        createElement(
          TooltipProvider,
          null,
          createElement(SidebarLeft, { publish: () => {} })
        )
      );
    });
  };

  const frame = () =>
    document.querySelector<HTMLIFrameElement>("iframe[data-cms-frame]");

  const post = (data: unknown, overrides: Partial<MessageEventInit> = {}) => {
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data,
          origin: platformUrl,
          source: frame()?.contentWindow ?? null,
          ...overrides,
        })
      );
    });
  };

  const open = (panel: "cms" | "pages" | "none") => {
    act(() => {
      setActiveSidebarPanel(panel);
    });
  };

  // The sidebar's tab content observes its size, and jsdom 20 has no
  // ResizeObserver.
  class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    // The Pages panel scrolls its selected page into view; jsdom has no
    // layout to scroll.
    if (typeof Element.prototype.scrollIntoView !== "function") {
      Element.prototype.scrollIntoView = () => {};
    }
    setAvailable();
    $builderMode.set("design");
    $dataLoadingState.set("loaded");
    $selectedInstanceRenderState.set("mounted");
    $canvasIframeState.set("ready");
    const pages = createDefaultPages({ rootInstanceId: "body" });
    $pages.set(pages);
    $selectedPageId.set(pages.homePageId);
    $cmsPanelView.set("content");
    $cmsFrameMounted.set(false);
    $cmsDirty.set(false);
    vi.mocked(invalidateResource).mockClear();
  });

  afterEach(() => {
    act(() => {
      setActiveSidebarPanel("none");
      root?.unmount();
    });
    container?.remove();
    root = undefined;
    container = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("frames the CMS screen of the loader's org, sandboxed", () => {
    render();
    expect(frame()).toBeNull();
    open("cms");
    const iframe = frame();
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toBe(
      `${platformUrl}/cms-panel/${orgId}?theme=light`
    );
    expect(iframe?.getAttribute("src")).toBe(getCmsPanelSrc(site, "light"));
    expect(iframe?.getAttribute("title")).toBe("CMS");
    expect(iframe?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(iframe?.hasAttribute("allow")).toBe(false);
    expect(iframe?.getAttribute("sandbox")).toBe(
      "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation"
    );
    expect(CMS_FRAME_SANDBOX.split(" ")).toContain("allow-modals");
    expect(iframe?.style.display).toBe("block");
  });

  test("takes the org from $organizeosSite, never from the page URL", () => {
    window.history.replaceState(
      null,
      "",
      "/?organizationId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    );
    render();
    open("cms");
    expect(frame()?.getAttribute("src")).toContain(`/cms-panel/${orgId}?`);
    window.history.replaceState(null, "", "/");
  });

  test("the frame survives a tab switch and Escape", () => {
    render();
    open("cms");
    const iframe = frame();
    expect(iframe).not.toBeNull();

    open("pages");
    expect(frame()).toBe(iframe);
    expect(iframe?.isConnected).toBe(true);
    expect(iframe?.style.display).toBe("none");

    open("cms");
    expect(frame()).toBe(iframe);
    expect(iframe?.style.display).toBe("block");

    const slot = document.querySelector("[data-cms-frame-slot]");
    act(() => {
      slot?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    expect($activeSidebarPanel.get()).not.toBe("cms");
    expect(frame()).toBe(iframe);
    expect(iframe?.style.display).toBe("none");
  });

  test("the Data view shows the data list and hides the frame without unmounting it", () => {
    render();
    open("cms");
    const iframe = frame();
    const dataButton = document.querySelector<HTMLButtonElement>(
      '[data-cms-view="data"]'
    );
    expect(dataButton).not.toBeNull();
    act(() => {
      dataButton?.click();
    });
    expect(
      document.querySelector("[data-organizeos-data-body]")
    ).not.toBeNull();
    expect(frame()).toBe(iframe);
    expect(iframe?.style.display).toBe("none");
  });

  test("offers no Data view to an org off the blocks' allowlist", () => {
    $organizeosSite.set({ ...site, blocksEnabled: false });
    render();
    open("cms");
    expect(document.querySelector('[data-cms-view="data"]')).toBeNull();
    expect(frame()).not.toBeNull();
  });

  test("cms.item_saved invalidates only that collection's current requests", () => {
    const request = (url: string): ResourceRequest => ({
      name: url,
      method: "get",
      url,
      searchParams: [],
      headers: [],
    });
    const news = request(`${platformUrl}/api/public/v1/collections/news/items`);
    const team = request(`${platformUrl}/api/public/v1/collections/team/items`);
    const lookalike = request(
      `${platformUrl}/api/public/v1/collections/news-archive/items`
    );
    const elsewhere = request(
      "https://evil.example/api/public/v1/collections/news/items"
    );
    vi.spyOn($computedResourceRequests, "get").mockReturnValue([
      news,
      team,
      lookalike,
      elsewhere,
    ]);
    render();
    open("cms");
    post({ type: "cms.item_saved", collection: "news" });
    expect(vi.mocked(invalidateResource).mock.calls).toEqual([[news]]);
  });

  test("ignores a message from another origin, another window, or of another shape", () => {
    const news: ResourceRequest = {
      name: "news",
      method: "get",
      url: `${platformUrl}/api/public/v1/collections/news/items`,
      searchParams: [],
      headers: [],
    };
    vi.spyOn($computedResourceRequests, "get").mockReturnValue([news]);
    render();
    open("cms");
    post(
      { type: "cms.item_saved", collection: "news" },
      { origin: "https://evil.example" }
    );
    post({ type: "cms.item_saved", collection: "news" }, { source: window });
    post({ type: "cms.item_saved", payload: { collection: "news" } });
    post(
      { type: "cms.dirty", dirty: true },
      { origin: "https://evil.example" }
    );
    expect(invalidateResource).not.toHaveBeenCalled();
    expect($cmsDirty.get()).toBe(false);
  });

  test("cms.collection_changed shows the reload notice", () => {
    const info = vi.spyOn(toast, "info").mockImplementation(() => "id");
    render();
    open("cms");
    post({ type: "cms.collection_changed", collection: null });
    expect(info).toHaveBeenCalledTimes(1);
    const [content, options] = info.mock.calls[0];
    expect(options).toMatchObject({ id: "cms-collection-changed" });
    expect(isValidElement(content)).toBe(true);

    const noticeContainer = document.createElement("div");
    const noticeRoot = createRoot(noticeContainer);
    act(() => {
      noticeRoot.render(content as ReactElement);
    });
    expect(noticeContainer.textContent).toContain(COLLECTION_CHANGED_NOTICE);
    const buttons = Array.from(noticeContainer.querySelectorAll("button"));
    expect(buttons.map((button) => button.textContent)).toEqual(["Reload"]);
    act(() => {
      noticeRoot.unmount();
    });
  });

  test("cms.dirty guards a reload of the builder", () => {
    render();
    open("cms");
    const before = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(false);

    post({ type: "cms.dirty", dirty: true });
    expect($cmsDirty.get()).toBe(true);
    const guarded = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(guarded);
    expect(guarded.defaultPrevented).toBe(true);

    post({ type: "cms.dirty", dirty: false });
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  test("the panel's close asks before discarding unsaved changes", () => {
    render();
    open("cms");
    const iframe = frame();
    post({ type: "cms.dirty", dirty: true });
    const close = () =>
      act(() => {
        document.querySelector<HTMLButtonElement>("[data-cms-close]")?.click();
      });

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    close();
    expect(confirm).toHaveBeenCalledWith(DISCARD_MESSAGE);
    expect($activeSidebarPanel.get()).toBe("cms");
    expect(frame()).toBe(iframe);

    confirm.mockReturnValue(true);
    close();
    expect($activeSidebarPanel.get()).not.toBe("cms");
    expect(frame()).toBeNull();
    expect($cmsDirty.get()).toBe(false);

    // opening it again starts a fresh frame
    open("cms");
    expect(frame()).not.toBeNull();
    expect(frame()).not.toBe(iframe);
  });

  test("the panel's close needs no confirm without unsaved changes", () => {
    const confirm = vi.spyOn(window, "confirm");
    render();
    open("cms");
    act(() => {
      document.querySelector<HTMLButtonElement>("[data-cms-close]")?.click();
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(frame()).toBeNull();
  });

  test("renders no frame where the panel is not offered", () => {
    $organizeosSite.set({ ...site, cmsPanelEnabled: false });
    render();
    open("cms");
    expect(frame()).toBeNull();
  });
});
