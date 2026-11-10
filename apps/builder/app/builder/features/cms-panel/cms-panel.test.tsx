// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { createElement, isValidElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  rawTheme,
  toast,
  TooltipProvider,
} from "@webstudio-is/design-system";
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
import { setSetting } from "~/builder/shared/client-settings";
import { IDLE, POTENTIAL } from "~/builder/shared/assets/drag-monitor";
import { SidebarLeft } from "../../sidebar-left/sidebar-left";
import { sidebarPanelNames } from "../../sidebar-left/types";
import {
  $cmsClassicDeepLink,
  $cmsDirty,
  $cmsFrameMounted,
  $isClassicCmsShown,
  $isCmsOverlayOpen,
  $isCmsPanelAvailable,
  CMS_FRAME_SANDBOX,
  COLLECTION_CHANGED_NOTICE,
  getCmsPanelSrc,
  isEditableTarget,
  showClassicCms,
  showNativeCms,
} from "./cms-panel";
import { CmsIcon } from "./cms-icon";
// Read as text through Vite: the suite runs in the browser, without node:fs
import topbarSource from "../../shared/topbar.tsx?raw";
import toastSource from "../../../../../../packages/design-system/src/components/toast.tsx?raw";

// A test source for the external drag state and drops. The real monitor
// never starts in this suite (the canvas API is not initialised). `set` calls
// each subscriber synchronously, in subscription order.
const drag = vi.hoisted(() => {
  const source = {
    state: 0 as 0 | 1,
    listeners: [] as Array<(state: 0 | 1) => void>,
    drops: [] as Array<() => void>,
    set(state: 0 | 1) {
      source.state = state;
      for (const listener of [...source.listeners]) {
        listener(state);
      }
    },
    drop() {
      for (const listener of [...source.drops]) {
        listener();
      }
    },
  };
  return source;
});

vi.mock("~/builder/shared/assets/drag-monitor", async (importOriginal) => {
  const { useEffect, useRef } = await import("react");
  // As upstream's hooks: the latest callback in a ref, one subscription for
  // the component's life; the drag state calls back at once.
  const useExternalDragStateEffect = (callback: (state: 0 | 1) => void) => {
    const ref = useRef(callback);
    ref.current = callback;
    useEffect(() => {
      const listener = (state: 0 | 1) => ref.current(state);
      drag.listeners.push(listener);
      listener(drag.state);
      return () => {
        drag.listeners.splice(drag.listeners.indexOf(listener), 1);
      };
    }, []);
  };
  const useOnDropEffect = (callback: () => void) => {
    const ref = useRef(callback);
    ref.current = callback;
    useEffect(() => {
      const listener = () => ref.current();
      drag.drops.push(listener);
      return () => {
        drag.drops.splice(drag.drops.indexOf(listener), 1);
      };
    }, []);
  };
  return {
    ...(await importOriginal<
      typeof import("~/builder/shared/assets/drag-monitor")
    >()),
    useExternalDragStateEffect,
    useOnDropEffect,
  };
});

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
// Chromium loads the frame's src, which is built from this. A loopback port
// nothing listens on refuses it at once; the live platform here would be
// fetched on every run, and the suite would depend on the network.
const platformUrl = "http://127.0.0.1:9";

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

describe("getCmsPanelSrc", () => {
  test("without a deep link is today's address", () => {
    expect(getCmsPanelSrc(site, "light")).toBe(
      `${platformUrl}/cms-panel/${orgId}?theme=light`
    );
  });

  test("adds the collection and the item, encoded", () => {
    expect(
      getCmsPanelSrc(site, "light", { collection: "news", item: "a b" })
    ).toBe(
      `${platformUrl}/cms-panel/${orgId}?theme=light&collection=news&item=a%20b`
    );
  });

  test("adds only what is defined", () => {
    expect(getCmsPanelSrc(site, "light", { collection: "news" })).toBe(
      `${platformUrl}/cms-panel/${orgId}?theme=light&collection=news`
    );
  });
});

describe("isEditableTarget", () => {
  const make = (html: string) => {
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    return host;
  };

  test.each([
    ["an input", "<input>"],
    ["a textarea", "<textarea></textarea>"],
    ["a select", "<select></select>"],
    ["a contenteditable element", '<div contenteditable="true"></div>'],
  ])("is true for %s", (_kind, html) => {
    const host = make(html);
    try {
      expect(isEditableTarget(host.firstElementChild)).toBe(true);
    } finally {
      host.remove();
    }
  });

  test("is true for a child of a contenteditable element", () => {
    const host = make('<div contenteditable="true"><span>text</span></div>');
    try {
      expect(isEditableTarget(host.querySelector("span"))).toBe(true);
    } finally {
      host.remove();
    }
  });

  test.each([
    ["a div", "<div></div>"],
    ["a button", "<button></button>"],
    [
      'a contenteditable="false" element',
      '<div contenteditable="false"></div>',
    ],
  ])("is false for %s", (_kind, html) => {
    const host = make(html);
    try {
      expect(isEditableTarget(host.firstElementChild)).toBe(false);
    } finally {
      host.remove();
    }
  });

  test("is false for the document and for null", () => {
    expect(isEditableTarget(document)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("the overlay's stacking", () => {
  test("has no z-index, the toast layer above it", () => {
    expect(topbarSource.match(/zIndex: (\d+)/g)).toEqual([
      "zIndex: 1",
      "zIndex: 1",
    ]);
    expect(toastSource).toMatch(/zIndex: theme\.zIndices\.max/);
    expect(rawTheme.zIndices.max).toBe("999");
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

  // The suite's viewport is narrow and its rail unstyled: pin the rail's box
  // as the builder lays it out, so what the overlay holds is in the viewport.
  const pinRail = (right = 41) => {
    const rail =
      railButton()?.closest<HTMLElement>('[role="tablist"]')?.parentElement
        ?.parentElement;
    expect(rail).toBeTruthy();
    vi.spyOn(rail as HTMLElement, "getBoundingClientRect").mockReturnValue({
      top: 40,
      bottom: 800,
      left: right - 41,
      right,
      width: 41,
      height: 760,
      x: right - 41,
      y: 40,
      toJSON: () => ({}),
    });
  };

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
      setSetting("navigatorLayout", "undocked");
      drag.set(IDLE);
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
      expect(railButton()?.getAttribute("aria-pressed")).toBe("false");
      const closed = getComputedStyle(railButton()!).backgroundColor;

      clickRail();
      expect($isCmsOverlayOpen.get()).toBe(true);
      expect(isShown()).toBe(true);
      expect(railButton()?.getAttribute("aria-pressed")).toBe("true");
      // IconButton styles aria-pressed; a data-state of its own styles nothing
      const open = getComputedStyle(railButton()!).backgroundColor;
      expect(open).not.toBe("rgba(0, 0, 0, 0)");
      expect(open).not.toBe(closed);
      expect(railButton()?.hasAttribute("data-state")).toBe(false);

      clickRail();
      expect($isCmsOverlayOpen.get()).toBe(false);
      expect(isShown()).toBe(false);
      expect(railButton()?.getAttribute("aria-pressed")).toBe("false");
      expect(getComputedStyle(railButton()!).backgroundColor).toBe(closed);
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
    test("paints its box and the corner under the rail like the rail, in either colour scheme", () => {
      render();
      clickRail();
      const corner = document.querySelector<HTMLElement>(
        "[data-cms-overlay-corner]"
      );
      const probe = document.createElement("div");
      probe.style.background = "var(--background-primary)";
      document.body.appendChild(probe);
      const painted: string[] = [];
      try {
        for (const scheme of ["light", "dark"]) {
          document.documentElement.dataset.colorScheme = scheme;
          const panel = getComputedStyle(probe).backgroundColor;
          expect(panel, scheme).not.toBe("rgba(0, 0, 0, 0)");
          expect(getComputedStyle(overlay()!).backgroundColor, scheme).toBe(
            panel
          );
          expect(getComputedStyle(corner!).backgroundColor, scheme).toBe(panel);
          painted.push(panel);
        }
      } finally {
        probe.remove();
        delete document.documentElement.dataset.colorScheme;
      }
      expect(painted[0]).not.toBe(painted[1]);
    });

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

    test("frames the CMS light while the builder is dark", () => {
      // owner decision D2: the frame stays light until the native CMS
      document.documentElement.dataset.colorScheme = "dark";
      try {
        render();
        clickRail();
        expect(frame()?.getAttribute("src")).toBe(
          `${platformUrl}/cms-panel/${orgId}?theme=light`
        );
      } finally {
        delete document.documentElement.dataset.colorScheme;
      }
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

    test("covers from the rail's right edge to the viewport's, top to bottom, with no z-index", () => {
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
      expect(element?.style.zIndex).toBe("");
      expect(getComputedStyle(element!).zIndex).toBe("auto");
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
        // Opening closed the panel; from inside the overlay.
        press("Escape", overlay()!);
        expect(isShown()).toBe(false);
        expect(escape).not.toHaveBeenCalled();
        expect($activeSidebarPanel.get()).toBe("none");

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

    test("Escape in the builder hides it and returns focus to the rail button", () => {
      render();
      clickRail();
      expect(document.activeElement).toBe(frame());
      press("Escape");
      expect(isShown()).toBe(false);
      expect(document.activeElement).toBe(railButton());
    });

    test("cms.close_requested hides it and returns focus to the rail button", () => {
      render();
      clickRail();
      expect(document.activeElement).toBe(frame());
      post({ type: "cms.close_requested" });
      expect(isShown()).toBe(false);
      expect(document.activeElement).toBe(railButton());
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

    test.each([
      ["pages", "undocked"],
      ["pages", "docked"],
      ["navigator", "undocked"],
      ["assets", "docked"],
    ] as const)(
      "opening it from %s (%s navigator) sets the sidebar panel to none",
      (panel, layout) => {
        act(() => setSetting("navigatorLayout", layout));
        render();
        act(() => setActiveSidebarPanel(panel));
        expect($activeSidebarPanel.get()).toBe(panel);
        clickRail();
        expect($activeSidebarPanel.get()).toBe("none");
        expect(isShown()).toBe(true);
      }
    );

    describe.each(["undocked", "docked"] as const)(
      "an external drag, %s navigator, with Pages open before the overlay",
      (layout) => {
        beforeEach(() => {
          act(() => setSetting("navigatorLayout", layout));
          render();
          // The sidebar switches to Assets and keeps a drop only while its
          // tabs are not covered: lay the rail out at the viewport's left
          // edge, as the builder does, whichever panel is open.
          container!.style.width = "max-content";
          pinRail();
          act(() => setActiveSidebarPanel("pages"));
          clickRail();
        });

        test("does not hide it when the drag starts: the overlay's drag-state subscriber runs before the sidebar's", () => {
          act(() => drag.set(POTENTIAL));
          expect($activeSidebarPanel.get()).toBe("assets");
          expect(isShown()).toBe(true);
        });

        test("does not hide it when the drag leaves and the sidebar restores its tab", () => {
          act(() => drag.set(POTENTIAL));
          act(() => drag.set(IDLE));
          expect(isShown()).toBe(true);
        });

        test("does not hide it on a drop; Assets shows once it closes", () => {
          act(() => drag.set(POTENTIAL));
          act(() => drag.drop());
          act(() => drag.set(IDLE));
          expect(isShown()).toBe(true);
          expect($activeSidebarPanel.get()).toBe("assets");
          clickRail();
          expect(isShown()).toBe(false);
          expect($activeSidebarPanel.get()).toBe("assets");
        });

        test("after the drag, a panel activated any other way hides it again", async () => {
          act(() => drag.set(POTENTIAL));
          act(() => drag.set(IDLE));
          await Promise.resolve();
          act(() => setActiveSidebarPanel("pages"));
          expect(isShown()).toBe(false);
        });
      }
    );

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
      expect(overlay()?.style.zIndex).toBe("");
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

  describe("the native screen (ORGANIZEOS_CMS_NATIVE)", () => {
    const itemId = "33333333-3333-4333-8333-333333333333";

    const nativeScreen = () =>
      document.querySelector<HTMLElement>("[data-cms-native-screen]");

    const menuItem = (label: string) =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        (item) => item.textContent === label
      );

    const titleText = () =>
      [...(nativeScreen()?.querySelectorAll<HTMLElement>("*") ?? [])].find(
        (element) =>
          element.childElementCount === 0 && element.textContent === "CMS"
      );

    // Content rendered by a root of its own into the native screen's main
    // region, as the screen's regions will be. Returns its unmount.
    const mounted: Array<() => void> = [];
    const mountInScreen = (node: ReactElement) => {
      const main = document.querySelector("[data-cms-native-main]");
      expect(main).not.toBeNull();
      const host = document.createElement("div");
      main!.appendChild(host);
      const hostRoot = createRoot(host);
      act(() => {
        hostRoot.render(createElement(TooltipProvider, null, node));
      });
      let isMounted = true;
      const unmount = () => {
        if (isMounted === false) {
          return;
        }
        isMounted = false;
        act(() => {
          hostRoot.unmount();
        });
        host.remove();
      };
      mounted.push(unmount);
      return unmount;
    };

    beforeEach(() => {
      $organizeosSite.set({ ...site, cmsNativeEnabled: true });
      $isClassicCmsShown.set(false);
      $cmsClassicDeepLink.set(undefined);
      $cmsFrameMounted.set(false);
    });

    afterEach(() => {
      for (const unmount of mounted.splice(0)) {
        unmount();
      }
    });

    test("the overlay shows the native screen and frames nothing", () => {
      render();
      clickRail();
      expect(isShown()).toBe(true);
      expect(nativeScreen()).not.toBeNull();
      expect(nativeScreen()?.style.display).toBe("flex");
      expect(frame()).toBeNull();
    });

    test("focus moves to the screen on open and on reopen", () => {
      render();
      railButton()?.focus();
      clickRail();
      expect(document.activeElement).toBe(nativeScreen());
      clickRail();
      railButton()?.focus();
      clickRail();
      expect(document.activeElement).toBe(nativeScreen());
    });

    test("its root is a floating-panel container", () => {
      render();
      clickRail();
      expect(
        nativeScreen()?.hasAttribute("data-floating-panel-container")
      ).toBe(true);
      expect(nativeScreen()?.getAttribute("tabindex")).toBe("-1");
    });

    test("follows the builder's colour scheme", () => {
      render();
      clickRail();
      const title = titleText();
      expect(title).toBeDefined();
      const colors: string[] = [];
      try {
        for (const scheme of ["light", "dark"]) {
          document.documentElement.dataset.colorScheme = scheme;
          const color = getComputedStyle(title!).color;
          expect(color, scheme).not.toBe("rgba(0, 0, 0, 0)");
          colors.push(color);
        }
      } finally {
        delete document.documentElement.dataset.colorScheme;
      }
      expect(colors[0]).not.toBe(colors[1]);
    });

    test("Classic CMS mounts the frame once and shows it in place of the screen", async () => {
      render();
      // The suite's viewport is narrow and its rail unstyled: pin the rail's
      // box as the builder lays it out, so the menu is within the viewport.
      const rail =
        railButton()?.closest<HTMLElement>('[role="tablist"]')?.parentElement
          ?.parentElement;
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
      await act(async () =>
        userEvent.click(
          nativeScreen()!.querySelector<HTMLElement>('[aria-label="CMS menu"]')!
        )
      );
      await act(async () => userEvent.click(menuItem("Classic CMS")!));
      const iframe = frame();
      expect(iframe?.getAttribute("src")).toBe(
        `${platformUrl}/cms-panel/${orgId}?theme=light`
      );
      expect(iframe?.style.display).toBe("block");
      expect(nativeScreen()?.style.display).toBe("none");
      expect(document.activeElement).toBe(iframe);
      act(() => showNativeCms());
      act(() => showClassicCms({ collection: "news", item: itemId }));
      expect(frame()).toBe(iframe);
      expect(frame()?.getAttribute("src")).toBe(
        `${platformUrl}/cms-panel/${orgId}?theme=light`
      );
    });

    test("a first Classic CMS with something open carries the deep link", () => {
      render();
      clickRail();
      act(() => showClassicCms({ collection: "news", item: itemId }));
      expect(frame()?.getAttribute("src")).toBe(
        `${platformUrl}/cms-panel/${orgId}?theme=light&collection=news&item=${itemId}`
      );
    });

    test("cms.close_requested from the frame returns to the native screen, not out of the overlay", () => {
      render();
      clickRail();
      act(() => showClassicCms({}));
      const iframe = frame();
      post({ type: "cms.close_requested" });
      expect(isShown()).toBe(true);
      expect($isClassicCmsShown.get()).toBe(false);
      expect(nativeScreen()?.style.display).toBe("flex");
      expect(iframe?.isConnected).toBe(true);
      expect(frame()).toBe(iframe);
      expect(document.activeElement).toBe(nativeScreen());
    });

    test("the frame's messages still act while it exists", () => {
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
      act(() => showClassicCms({}));
      post({ type: "cms.item_saved", collection: "news" });
      expect(vi.mocked(invalidateResource).mock.calls).toEqual([[news]]);
      post({ type: "cms.dirty", dirty: true });
      expect($cmsDirty.get()).toBe(true);
    });

    test("reopening shows the screen that was showing", () => {
      render();
      clickRail();
      act(() => showClassicCms({}));
      const iframe = frame();
      press("Escape");
      expect(isShown()).toBe(false);
      clickRail();
      expect(isShown()).toBe(true);
      expect(frame()).toBe(iframe);
      expect(frame()?.style.display).toBe("block");
      expect(nativeScreen()?.style.display).toBe("none");
      expect(document.activeElement).toBe(iframe);
    });

    const bodyChildOf = (node: Element) => {
      let current = node;
      while (current.parentElement !== document.body) {
        current = current.parentElement!;
      }
      return current;
    };

    const follows = (a: Node, b: Node) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

    test.each([
      [
        "Select",
        <Select
          key="select"
          open
          options={["One", "Two"]}
          value="One"
          onChange={() => {}}
        />,
        '[role="listbox"]',
      ],
      [
        "DropdownMenu",
        <DropdownMenu key="menu" open>
          <DropdownMenuTrigger>t</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>i</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
        '[role="menu"]',
      ],
      [
        "Popover",
        <Popover key="popover" open>
          <PopoverTrigger>t</PopoverTrigger>
          <PopoverContent>p</PopoverContent>
        </Popover>,
        "[data-radix-popper-content-wrapper]",
      ],
      [
        "Dialog",
        <Dialog key="dialog" open>
          <DialogContent>
            <DialogTitle>d</DialogTitle>
          </DialogContent>
        </Dialog>,
        '[role="dialog"]',
      ],
    ])(
      "a %s opened inside it is a later body child than it",
      (_kind, node, selector) => {
        render();
        clickRail();
        mountInScreen(node);
        const popup = document.querySelector(selector);
        expect(popup).not.toBeNull();
        expect(follows(overlay()!, bodyChildOf(popup!))).toBe(true);
      }
    );

    test("it paints over the builder", () => {
      // A stand-in for builder.tsx's Main, which isolates its stacking.
      const main = document.createElement("div");
      main.style.position = "relative";
      main.style.isolation = "isolate";
      main.style.width = "100vw";
      main.style.height = "100vh";
      document.body.appendChild(main);
      try {
        render();
        pinRail();
        clickRail();
        const { left, top, width, height } = overlay()!.getBoundingClientRect();
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
        expect(
          overlay()!.contains(
            document.elementFromPoint(left + width / 2, top + height / 2)
          )
        ).toBe(true);
      } finally {
        main.remove();
      }
    });

    test("an open Select's option inside it paints over it", async () => {
      render();
      pinRail();
      clickRail();
      mountInScreen(
        <Select open options={["One", "Two"]} value="One" onChange={() => {}} />
      );
      const option = [...document.querySelectorAll('[role="option"]')].at(-1)!;
      expect(option).toBeDefined();
      // The popper places its content off screen until it has measured it.
      await vi.waitFor(() => {
        const { top, left } = option.getBoundingClientRect();
        expect(top).toBeGreaterThanOrEqual(0);
        expect(left).toBeGreaterThanOrEqual(0);
      });
      // The open Select turns off pointer events outside it, and hit testing
      // skips such elements: turn them back on for the overlay, so the
      // element at the point is the one painted there.
      expect(getComputedStyle(overlay()!).pointerEvents).toBe("none");
      overlay()!.style.pointerEvents = "auto";
      const r = option.getBoundingClientRect();
      expect(
        overlay()!.contains(
          document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        )
      ).toBe(false);
      expect(
        option.contains(
          document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        )
      ).toBe(true);
    });

    describe("Escape", () => {
      const escape = vi.fn();
      let unsubscribe: (() => void) | undefined;

      beforeEach(() => {
        escape.mockClear();
        const { subscribeCommands } = createCommandsEmitter({
          source: "cms-native-escape-test",
          commands: [
            {
              name: "cmsNativeTestEscape",
              defaultHotkeys: ["escape"],
              preventDefault: false,
              handler: escape,
            },
          ],
        });
        unsubscribe = subscribeCommands();
      });

      afterEach(() => {
        unsubscribe?.();
        unsubscribe = undefined;
      });

      test("Escape in an open Select inside it closes only the Select", async () => {
        render();
        pinRail();
        clickRail();
        mountInScreen(
          <Select options={["One", "Two"]} value="One" onChange={() => {}} />
        );
        await act(async () =>
          userEvent.click(
            nativeScreen()!.querySelector<HTMLElement>(
              "[data-cms-native-main] button"
            )!
          )
        );
        expect(document.querySelector('[role="listbox"]')).not.toBeNull();
        await act(async () => userEvent.keyboard("{Escape}"));
        expect(document.querySelector('[role="listbox"]')).toBeNull();
        expect(isShown()).toBe(true);
        expect(escape).not.toHaveBeenCalled();
      });

      test("Escape in the open CMS menu closes only the menu", async () => {
        render();
        pinRail();
        clickRail();
        await act(async () =>
          userEvent.click(
            nativeScreen()!.querySelector<HTMLElement>(
              '[aria-label="CMS menu"]'
            )!
          )
        );
        expect(document.querySelector('[role="menu"]')).not.toBeNull();
        await act(async () => userEvent.keyboard("{Escape}"));
        expect(document.querySelector('[role="menu"]')).toBeNull();
        expect(isShown()).toBe(true);
        expect(nativeScreen()?.style.display).toBe("flex");
        expect(escape).not.toHaveBeenCalled();
      });

      test.each([
        ["input", <input key="input" data-editable />],
        ["textarea", <textarea key="textarea" data-editable />],
        [
          "select",
          <select key="select" data-editable>
            <option>One</option>
          </select>,
        ],
        [
          "contenteditable",
          <div
            key="editable"
            data-editable
            contentEditable
            suppressContentEditableWarning
          >
            text
          </div>,
        ],
      ])("Escape in a %s inside it does nothing", (_kind, node) => {
        render();
        clickRail();
        mountInScreen(node);
        const element = document.querySelector<HTMLElement>("[data-editable]");
        expect(element).not.toBeNull();
        press("Escape", element!);
        expect(isShown()).toBe(true);
        expect(escape).not.toHaveBeenCalled();
      });

      test("Escape a layer took is left alone", () => {
        render();
        clickRail();
        mountInScreen(<div data-layer tabIndex={-1} />);
        const layer = document.querySelector<HTMLElement>("[data-layer]")!;
        layer.addEventListener("keydown", (event) => event.preventDefault());
        press("Escape", layer);
        expect(isShown()).toBe(true);
        expect(escape).not.toHaveBeenCalled();
      });

      test("Escape at the top level hides it and returns focus to the rail button", () => {
        render();
        clickRail();
        expect(document.activeElement).toBe(nativeScreen());
        press("Escape", nativeScreen()!);
        expect(isShown()).toBe(false);
        expect(document.activeElement).toBe(railButton());
        expect(escape).not.toHaveBeenCalled();
      });

      test("the close button hides it and returns focus to the rail button", () => {
        render();
        clickRail();
        const close = nativeScreen()!.querySelector<HTMLElement>(
          '[aria-label="Close"]'
        )!;
        close.focus();
        act(() => {
          close.click();
        });
        expect(isShown()).toBe(false);
        expect(document.activeElement).toBe(railButton());
      });
    });

    test("the close button hides the overlay", () => {
      render();
      clickRail();
      act(() => {
        nativeScreen()
          ?.querySelector<HTMLElement>('[aria-label="Close"]')
          ?.click();
      });
      expect(isShown()).toBe(false);
      expect($isCmsOverlayOpen.get()).toBe(false);
    });
  });
});
