import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement, isValidElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { rawTheme, toast, TooltipProvider } from "@webstudio-is/design-system";
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
import { createCommandsEmitter } from "~/shared/commands-emitter";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import {
  $activeSidebarPanel,
  $dataLoadingState,
  $isUiHidden,
  setActiveSidebarPanel,
} from "~/builder/shared/nano-states";
import { SidebarLeft } from "../../sidebar-left/sidebar-left";
import { sidebarPanelNames } from "../../sidebar-left/types";
import {
  $cmsDirty,
  $cmsFrameMounted,
  $isCmsOverlayOpen,
  $isCmsPanelAvailable,
  CMS_FRAME_SANDBOX,
  CMS_OVERLAY_Z_INDEX,
  COLLECTION_CHANGED_NOTICE,
  getCmsPanelSrc,
} from "./cms-panel";
import { CmsIcon } from "./cms-icon";

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

const unavailableCases: Array<[string, () => void]> = [
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
];

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("$isCmsPanelAvailable", () => {
  beforeEach(setAvailable);

  test("is offered for an OrganizeOS project with the switch, the plan and a role above viewer", () => {
    expect($isCmsPanelAvailable.get()).toBe(true);
  });

  test.each(unavailableCases)("is hidden for %s", (_case, change) => {
    change();
    expect($isCmsPanelAvailable.get()).toBe(false);
  });

  test("is offered to editors, the content-mode relation", () => {
    $workspaceRole.set("editors");
    $authPermit.set("edit");
    expect($isCmsPanelAvailable.get()).toBe(true);
  });
});

describe("the sidebar's panels", () => {
  test("cms is no longer a panel name, and the OrganizeOS data tab is", () => {
    expect(sidebarPanelNames).not.toContain("cms");
    expect(sidebarPanelNames).toContain("organizeos");
  });
});

describe("CmsIcon", () => {
  test("is a database on the 16px grid with a 1px currentColor stroke", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(createElement(CmsIcon));
    });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("fill")).toBe("none");
    const shapes = Array.from(svg?.querySelectorAll("path, ellipse") ?? []);
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      expect(shape.getAttribute("stroke")).toBe("currentColor");
      // No stroke width: the SVG default, 1px on the 16px grid.
      expect(shape.hasAttribute("stroke-width")).toBe(false);
    }
    act(() => {
      root.unmount();
    });
  });

  test("takes upstream IconComponent's size and color, and other SVG props", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        createElement(CmsIcon, {
          size: rawTheme.spacing[10],
          color: "red",
          "aria-hidden": true,
        })
      );
    });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe(rawTheme.spacing[10]);
    expect(svg?.getAttribute("height")).toBe(rawTheme.spacing[10]);
    expect(svg?.getAttribute("color")).toBe("red");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    act(() => {
      root.unmount();
    });
  });
});

describe("the overlay's stacking", () => {
  test("sits above the top bar and below the toast layer", () => {
    const topbar = readSource("../../shared/topbar.tsx");
    const toastSource = readSource(
      "../../../../../../packages/design-system/src/components/toast.tsx"
    );
    expect(topbar.match(/zIndex: (\d+)/g)).toEqual(["zIndex: 1", "zIndex: 1"]);
    expect(toastSource).toMatch(/zIndex: theme\.zIndices\.max/);
    expect(rawTheme.zIndices.max).toBe("999");
    expect(CMS_OVERLAY_Z_INDEX).toBe(2);
    expect(CMS_OVERLAY_Z_INDEX).toBeGreaterThan(1);
    expect(CMS_OVERLAY_Z_INDEX).toBeLessThan(Number(rawTheme.zIndices.max));
  });
});

describe("the CMS overlay in the builder", () => {
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

  const railButton = () =>
    document.querySelector<HTMLButtonElement>("[data-cms-rail-button]");

  const overlay = () =>
    document.querySelector<HTMLElement>("[data-cms-overlay]");

  const frame = () =>
    document.querySelector<HTMLIFrameElement>("iframe[data-cms-frame]");

  const tab = (label: string) =>
    document.querySelector<HTMLButtonElement>(
      `[role="tab"][aria-label="${label}"]`
    );

  const railLabels = () =>
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[role="tab"], [data-cms-rail-button]'
      )
    ).map((button) => button.getAttribute("aria-label"));

  const clickRail = () => {
    act(() => {
      railButton()?.click();
    });
  };

  const isShown = () => overlay()?.style.display === "block";

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

  const press = (key: string, target: EventTarget = document.body) => {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      target.dispatchEvent(event);
    });
    return event;
  };

  // jsdom has no PointerEvent constructor; the listener reads only the target.
  const pointerDown = (target: EventTarget) => {
    act(() => {
      target.dispatchEvent(new Event("pointerdown", { bubbles: true }));
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
    $isUiHidden.set(false);
    $dataLoadingState.set("loaded");
    $selectedInstanceRenderState.set("mounted");
    $canvasIframeState.set("ready");
    const pages = createDefaultPages({ rootInstanceId: "body" });
    $pages.set(pages);
    $selectedPageId.set(pages.homePageId);
    $isCmsOverlayOpen.set(false);
    $cmsFrameMounted.set(false);
    $cmsDirty.set(false);
    vi.mocked(invalidateResource).mockClear();
  });

  afterEach(() => {
    act(() => {
      $isCmsOverlayOpen.set(false);
      $builderMode.set("design");
      setActiveSidebarPanel("none");
      root?.unmount();
    });
    container?.remove();
    root = undefined;
    container = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("the rail button", () => {
    test("shows on the rail, labelled CMS with the database icon", () => {
      render();
      const button = railButton();
      expect(button).not.toBeNull();
      expect(button?.getAttribute("aria-label")).toBe("CMS");
      expect(button?.querySelector("svg")?.getAttribute("width")).toBe(
        rawTheme.spacing[10]
      );
    });

    test.each(unavailableCases)("is not shown for %s", (_case, change) => {
      change();
      render();
      expect(railButton()).toBeNull();
      expect(frame()).toBeNull();
    });

    test("shows in Content mode too", () => {
      $builderMode.set("content");
      render();
      expect(railButton()).not.toBeNull();
    });

    test("is not on the rail in preview mode, which hides the rail", () => {
      $builderMode.set("preview");
      render();
      expect(railButton()).toBeNull();
    });

    test("opens and hides the overlay, with an active state while open", () => {
      render();
      expect(frame()).toBeNull();
      expect(railButton()?.getAttribute("data-state")).toBe("inactive");
      expect(railButton()?.getAttribute("aria-pressed")).toBe("false");

      clickRail();
      expect($isCmsOverlayOpen.get()).toBe(true);
      expect(isShown()).toBe(true);
      expect(railButton()?.getAttribute("data-state")).toBe("active");
      expect(railButton()?.getAttribute("aria-pressed")).toBe("true");

      clickRail();
      expect($isCmsOverlayOpen.get()).toBe(false);
      expect(isShown()).toBe(false);
      expect(railButton()?.getAttribute("data-state")).toBe("inactive");
    });
  });

  describe("the data tab", () => {
    test("is back in its own slot after Components, with the CMS on the rail too", () => {
      render();
      expect(tab("OrganizeOS data")).not.toBeNull();
      expect(railLabels()).toEqual([
        "Components",
        "OrganizeOS data",
        "Pages",
        "Navigator",
        "Assets",
        "CMS",
      ]);
    });

    test("keeps its rules: only for an org not denied the blocks", () => {
      $organizeosSite.set({ ...site, blocksEnabled: false });
      render();
      expect(tab("OrganizeOS data")).toBeNull();
      expect(railButton()).not.toBeNull();
    });

    test("keeps its rules: hidden in Content mode", () => {
      $builderMode.set("content");
      render();
      expect(tab("OrganizeOS data")).toBeNull();
    });

    test("is listed without the CMS", () => {
      $organizeosSite.set({ ...site, cmsPanelEnabled: false });
      render();
      expect(tab("OrganizeOS data")).not.toBeNull();
      expect(railButton()).toBeNull();
    });
  });

  describe("the overlay", () => {
    test("frames the CMS screen of the loader's org, sandboxed", () => {
      render();
      clickRail();
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
    });

    test("takes the org from $organizeosSite, never from the page URL", () => {
      window.history.replaceState(
        null,
        "",
        "/?organizationId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      );
      render();
      clickRail();
      expect(frame()?.getAttribute("src")).toContain(`/cms-panel/${orgId}?`);
      window.history.replaceState(null, "", "/");
    });

    test("covers from the rail's right edge to the viewport's, top to bottom, at z-index 2", () => {
      render();
      // The rail: the tab list, in its display: contents wrapper, in the
      // bordered column.
      const rail =
        railButton()?.closest<HTMLElement>('[role="tablist"]')?.parentElement
          ?.parentElement;
      expect(rail).toBeTruthy();
      vi.spyOn(rail as HTMLElement, "getBoundingClientRect").mockReturnValue({
        top: 40,
        bottom: 800,
        left: 0,
        right: 41,
        width: 41,
        height: 760,
        x: 0,
        y: 40,
        toJSON: () => ({}),
      });
      clickRail();
      const element = overlay();
      expect(element?.parentElement).toBe(document.body);
      expect(element?.style.position).toBe("fixed");
      expect(element?.style.left).toBe("41px");
      expect(element?.style.right).toBe("0px");
      expect(element?.style.top).toBe("0px");
      expect(element?.style.bottom).toBe("0px");
      expect(element?.style.zIndex).toBe("2");
      expect(frame()?.style.width).toBe("100%");
      expect(frame()?.style.height).toBe("100%");
      // The corner below the rail, over the footer's left end.
      const corner = element?.querySelector<HTMLElement>(
        "[data-cms-overlay-corner]"
      );
      expect(corner?.style.position).toBe("fixed");
      expect(corner?.style.left).toBe("0px");
      expect(corner?.style.width).toBe("41px");
      expect(corner?.style.top).toBe("800px");
      expect(corner?.style.bottom).toBe("0px");
    });

    test("a press on the top bar hides it, so the builder's menu opens over the canvas", () => {
      render();
      const nav = document.createElement("nav");
      const trigger = document.createElement("button");
      nav.appendChild(trigger);
      document.body.appendChild(nav);
      clickRail();
      expect(overlay()?.style.display).toBe("block");
      pointerDown(trigger);
      expect(overlay()?.style.display).toBe("none");
      nav.remove();
    });

    test("a press inside the overlay or on the CMS button does not hide it", () => {
      render();
      clickRail();
      pointerDown(frame() as HTMLElement);
      expect(overlay()?.style.display).toBe("block");
      pointerDown(railButton() as HTMLElement);
      expect(overlay()?.style.display).toBe("block");
    });

    test("moves focus into the frame on open", () => {
      render();
      railButton()?.focus();
      expect(document.activeElement).toBe(railButton());
      clickRail();
      expect(document.activeElement).toBe(frame());
    });

    test("suppresses builder shortcuts while open, and restores them after", () => {
      const handlers = {
        components: vi.fn(),
        navigator: vi.fn(),
        deleteInstance: vi.fn(),
      };
      const { subscribeCommands } = createCommandsEmitter({
        source: "cms-overlay-test",
        commands: [
          {
            name: "cmsTestComponents",
            defaultHotkeys: ["a"],
            handler: handlers.components,
          },
          {
            name: "cmsTestNavigator",
            defaultHotkeys: ["z"],
            handler: handlers.navigator,
          },
          {
            name: "cmsTestDelete",
            defaultHotkeys: ["delete"],
            handler: handlers.deleteInstance,
          },
        ],
      });
      const unsubscribe = subscribeCommands();
      try {
        render();
        clickRail();
        for (const key of ["a", "z", "Delete"]) {
          press(key);
        }
        expect(handlers.components).not.toHaveBeenCalled();
        expect(handlers.navigator).not.toHaveBeenCalled();
        expect(handlers.deleteInstance).not.toHaveBeenCalled();
        expect(isShown()).toBe(true);

        clickRail();
        for (const key of ["a", "z", "Delete"]) {
          press(key);
        }
        expect(handlers.components).toHaveBeenCalledTimes(1);
        expect(handlers.navigator).toHaveBeenCalledTimes(1);
        expect(handlers.deleteInstance).toHaveBeenCalledTimes(1);
      } finally {
        unsubscribe();
      }
    });

    test("Escape with the overlay open hides it and emits no command", () => {
      const escape = vi.fn();
      const { subscribeCommands } = createCommandsEmitter({
        source: "cms-overlay-escape-test",
        commands: [
          {
            name: "cmsTestEscape",
            defaultHotkeys: ["escape"],
            preventDefault: false,
            handler: escape,
          },
        ],
      });
      const unsubscribe = subscribeCommands();
      try {
        render();
        act(() => {
          setActiveSidebarPanel("pages");
        });
        clickRail();
        // From inside the sidebar's tab content, whose own Escape closes
        // the open panel.
        const inPanel = document.querySelector('[role="tabpanel"]');
        expect(inPanel).not.toBeNull();
        press("Escape", inPanel ?? document.body);
        expect(isShown()).toBe(false);
        expect(escape).not.toHaveBeenCalled();
        expect($activeSidebarPanel.get()).toBe("pages");

        // Hidden, Escape is the builder's again.
        press("Escape");
        expect(escape).toHaveBeenCalledTimes(1);
      } finally {
        unsubscribe();
      }
    });

    test("Escape in the builder hides it", () => {
      render();
      clickRail();
      const iframe = frame();
      press("Escape");
      expect($isCmsOverlayOpen.get()).toBe(false);
      expect(isShown()).toBe(false);
      expect(frame()).toBe(iframe);
    });

    test("another rail tab hides it and shows its panel", () => {
      render();
      clickRail();
      act(() => {
        tab("Pages")?.click();
      });
      expect($isCmsOverlayOpen.get()).toBe(false);
      expect(isShown()).toBe(false);
      expect($activeSidebarPanel.get()).toBe("pages");
    });

    test("the open tab, clicked over it, hides it and stays open", () => {
      render();
      act(() => {
        setActiveSidebarPanel("pages");
      });
      clickRail();
      act(() => {
        tab("Pages")?.click();
      });
      expect(isShown()).toBe(false);
      expect($activeSidebarPanel.get()).toBe("pages");
    });

    test("a panel activated any other way hides it", () => {
      render();
      clickRail();
      act(() => {
        setActiveSidebarPanel("assets");
      });
      expect($isCmsOverlayOpen.get()).toBe(false);
      expect(isShown()).toBe(false);
    });

    test("preview mode hides it, and leaving preview keeps it hidden", () => {
      render();
      clickRail();
      const iframe = frame();
      act(() => {
        $builderMode.set("preview");
      });
      expect($isCmsOverlayOpen.get()).toBe(false);
      expect(isShown()).toBe(false);
      expect(frame()).toBe(iframe);
      act(() => {
        $builderMode.set("design");
      });
      expect(isShown()).toBe(false);
    });

    test("cms.close_requested hides it", () => {
      render();
      clickRail();
      post({ type: "cms.close_requested" });
      expect($isCmsOverlayOpen.get()).toBe(false);
      expect(isShown()).toBe(false);
    });

    test("cms.close_requested from another origin or window, or with a payload, is dropped", () => {
      render();
      clickRail();
      post({ type: "cms.close_requested" }, { origin: "https://evil.example" });
      post({ type: "cms.close_requested" }, { source: window });
      post({ type: "cms.close_requested", payload: {} });
      expect(isShown()).toBe(true);
    });

    test("reopening shows the same frame, its state kept", () => {
      render();
      clickRail();
      const iframe = frame();
      post({ type: "cms.dirty", dirty: true });
      press("Escape");
      expect(iframe?.isConnected).toBe(true);
      clickRail();
      expect(frame()).toBe(iframe);
      expect(isShown()).toBe(true);
      expect($cmsDirty.get()).toBe(true);
      expect(document.activeElement).toBe(iframe);
    });

    test("the toast shows above it", () => {
      render();
      clickRail();
      expect(Number(overlay()?.style.zIndex)).toBeLessThan(
        Number(rawTheme.zIndices.max)
      );
    });
  });

  describe("messages", () => {
    test("cms.item_saved invalidates only that collection's current requests", () => {
      const request = (url: string): ResourceRequest => ({
        name: url,
        method: "get",
        url,
        searchParams: [],
        headers: [],
      });
      const news = request(
        `${platformUrl}/api/public/v1/collections/news/items`
      );
      const team = request(
        `${platformUrl}/api/public/v1/collections/team/items`
      );
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
      clickRail();
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
      clickRail();
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
      clickRail();
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

    test("cms.dirty guards a reload of the builder, open or hidden", () => {
      render();
      clickRail();
      const before = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(before);
      expect(before.defaultPrevented).toBe(false);

      post({ type: "cms.dirty", dirty: true });
      expect($cmsDirty.get()).toBe(true);
      const guarded = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(guarded);
      expect(guarded.defaultPrevented).toBe(true);

      clickRail();
      const hidden = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(hidden);
      expect(hidden.defaultPrevented).toBe(true);

      post({ type: "cms.dirty", dirty: false });
      const after = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(after);
      expect(after.defaultPrevented).toBe(false);
    });

    test("there is no confirm and no discard: hiding never asks", () => {
      const confirm = vi.spyOn(window, "confirm");
      render();
      clickRail();
      const iframe = frame();
      post({ type: "cms.dirty", dirty: true });
      clickRail();
      press("Escape");
      expect(confirm).not.toHaveBeenCalled();
      expect(frame()).toBe(iframe);
    });
  });
});
