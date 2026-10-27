import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import { createDefaultPages } from "@webstudio-is/project-build";
import { $, renderData, ws } from "@webstudio-is/template";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import * as organizeosMetas from "@organizeos/site-components/metas";
import { coreMetas, type Breakpoint } from "@webstudio-is/sdk";
import {
  $builderMode,
  $organizeosSite,
  $registeredComponentMetas,
  $selectedBreakpointId,
  $selectedInstanceSelector,
  registerComponentLibrary,
  selectInstance,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { registerContainers } from "~/shared/sync/sync-stores";
import {
  $breakpoints,
  $instances,
  $pages,
  $props,
} from "~/shared/sync/data-stores";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { $activeInspectorPanel } from "~/builder/shared/nano-states";
import { Inspector } from "~/builder/inspector";
import { animateChildrenComponent, motionRefusal } from "./motion";
import { motionPresets } from "./motion/presets";
import { $isMotionTabAvailable } from "./motion-tab";

// The Inspector's neighbours, as markers; upstream's PropsSectionContainer,
// which the Motion tab embeds, is real.
vi.mock("~/builder/features/style-panel", () => ({
  StylePanel: () => createElement("div", { "data-marker": "style-panel" }),
  ModeMenu: () => null,
}));
vi.mock("~/builder/features/settings-panel", () => ({
  SettingsPanel: () => createElement("div", { "data-marker": "settings" }),
}));
vi.mock("~/builder/features/navigator", () => ({
  NavigatorTree: () => createElement("div", { "data-marker": "navigator" }),
}));

enableMapSet();
registerContainers();

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Radix's ScrollArea observes its viewport, and jsdom 20 has no
// ResizeObserver.
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

$registeredComponentMetas.set(
  new Map(Object.entries({ ...defaultMetas, ...coreMetas }))
);
registerComponentLibrary({
  namespace: "@organizeos/site-components",
  components: {},
  metas: organizeosMetas,
  templates: {},
});

const [reveal] = motionPresets;
const AnimateChildren = $[animateChildrenComponent];

const site: OrganizeosSite = {
  organizationId: "org-1",
  manageUrl: "https://app.organizeos.org/dashboard",
  platformUrl: "https://app.organizeos.org",
  blocksEnabled: true,
};

const base: Breakpoint = { id: "base", label: "Base" };

let root: Root | undefined;
let container: HTMLElement | undefined;

/** body > section > card, and an Animate Children with a child. */
const project = ({
  documentType = "html",
  breakpoints = [base],
}: {
  documentType?: "html" | "xml" | "text";
  breakpoints?: Breakpoint[];
} = {}) => {
  const data = renderData(
    <$.Body ws:id="body">
      <$.Box ws:id="section">
        <$.Box ws:id="card"></$.Box>
      </$.Box>
      <AnimateChildren ws:id="wrapper">
        <$.Box ws:id="child"></$.Box>
      </AnimateChildren>
      <ws.element ws:tag="div" ws:id="plain"></ws.element>
    </$.Body>
  );
  $instances.set(data.instances);
  $props.set(new Map());
  $breakpoints.set(
    new Map(breakpoints.map((breakpoint) => [breakpoint.id, breakpoint]))
  );
  $selectedBreakpointId.set(breakpoints[0]?.id);
  const pages = createDefaultPages({ rootInstanceId: "body" });
  const home = pages.pages.get(pages.homePageId)!;
  pages.pages.set(home.id, { ...home, meta: { ...home.meta, documentType } });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
};

const render = () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(Inspector, { navigatorLayout: "docked" })
      )
    );
  });
  return container;
};

const tabs = (host: HTMLElement) =>
  Array.from(host.querySelectorAll('[role="tab"]'), (tab) =>
    tab.textContent?.trim()
  );

const activeTab = (host: HTMLElement) =>
  host.querySelector('[role="tab"][data-state="active"]')?.textContent?.trim();

const motionTarget = (host: HTMLElement) =>
  host
    .querySelector("[data-motion-target]")
    ?.getAttribute("data-motion-target");

// The panel shows options only: none of the lines it used to explain them in.
const explanations = [
  "A preset wraps",
  "A preset replaces",
  "inside an Animate Children",
  "Edit it below",
  "Plays on the published page",
  "reduced motion",
  "Percent of the",
];

const explains = (host: HTMLElement) =>
  explanations.filter((line) => host.textContent?.includes(line));

const runOnCanvas = (host: HTMLElement) =>
  host.textContent?.includes("Run on canvas") ?? false;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  $organizeosSite.set(site);
  $builderMode.set("design");
  $activeInspectorPanel.set("style");
  selectInstance(undefined);
  project();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("$isMotionTabAvailable", () => {
  test("true for an org not denied the blocks, in design mode, on an HTML page", () => {
    expect($isMotionTabAvailable.get()).toBe(true);
  });

  test.each([
    [
      "for a denied org",
      () => $organizeosSite.set({ ...site, blocksEnabled: false }),
    ],
    ["for no org", () => $organizeosSite.set(undefined)],
    ["in content mode", () => $builderMode.set("content")],
    ["on an XML page", () => project({ documentType: "xml" })],
    ["on a text page", () => project({ documentType: "text" })],
  ])("false %s", (_case, change) => {
    change();
    expect($isMotionTabAvailable.get()).toBe(false);
  });
});

describe("the Inspector's Motion tab", () => {
  test("an Inspector shows Style, Settings and Motion, in that order, for an element of an org not denied the blocks, in design mode on an HTML page", () => {
    selectInstance(["section", "body"]);
    const host = render();
    expect(tabs(host)).toEqual(["Style", "Settings", "Motion"]);
  });

  test("the Motion tab sits in a bare div, as Style and Settings do, with no tooltip of its own", () => {
    vi.useFakeTimers();
    selectInstance(["section", "body"]);
    const host = render();
    const tab = (label: string) =>
      Array.from(host.querySelectorAll('[role="tab"]')).find(
        (tab) => tab.textContent?.trim() === label
      );
    const motion = tab("Motion");
    // upstream's tabs sit in the div their Tooltip needs, so Motion's hover
    // box matches theirs
    for (const label of ["Style", "Settings", "Motion"]) {
      const wrapper = tab(label)?.parentElement;
      expect(wrapper?.tagName, label).toBe("DIV");
      expect(wrapper?.parentElement?.getAttribute("role"), label).toBe(
        "tablist"
      );
    }
    // Motion's div is bare: no Tooltip trigger state on it
    expect(motion?.parentElement?.attributes).toHaveLength(0);
    // and hovering Motion shows nothing new
    const before = document.body.textContent;
    act(() => {
      motion?.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    });
    act(() => {
      vi.runAllTimers();
    });
    expect(document.body.textContent).toBe(before);
  });

  test("content mode and XML keep upstream's Settings only, and for a denied org upstream's Style and Settings", () => {
    selectInstance(["section", "body"]);
    $builderMode.set("content");
    let host = render();
    expect(tabs(host)).toEqual(["Settings"]);
    act(() => root?.unmount());
    container?.remove();

    $builderMode.set("design");
    project({ documentType: "xml" });
    selectInstance(["section", "body"]);
    host = render();
    expect(tabs(host)).toEqual(["Settings"]);
    act(() => root?.unmount());
    container?.remove();

    project();
    selectInstance(["section", "body"]);
    $organizeosSite.set({ ...site, blocksEnabled: false });
    host = render();
    expect(tabs(host)).toEqual(["Style", "Settings"]);
  });

  test("for a denied org the Inspector has exactly two tabpanels, as upstream's", () => {
    selectInstance(["section", "body"]);
    $organizeosSite.set({ ...site, blocksEnabled: false });
    let host = render();
    expect(host.querySelectorAll('[role="tabpanel"]')).toHaveLength(2);
    act(() => root?.unmount());
    container?.remove();

    // for an org not denied the blocks, the Motion tab's panel is the third
    $organizeosSite.set(site);
    host = render();
    expect(host.querySelectorAll('[role="tabpanel"]')).toHaveLength(3);
  });

  test("a stored motion falls back to Settings where Motion is not offered", () => {
    selectInstance(["section", "body"]);
    $activeInspectorPanel.set("motion");
    $organizeosSite.set({ ...site, blocksEnabled: false });
    const host = render();
    expect(activeTab(host)).toBe("Settings");
    expect(host.querySelector('[data-marker="settings"]')).not.toBeNull();
    expect(host.querySelector("[data-motion-presets]")).toBeNull();
  });

  test("a preset on a plain element selects the new wrapper, and the tab then shows Stagger and upstream's Run on canvas switch", () => {
    selectInstance(["section", "body"]);
    $activeInspectorPanel.set("motion");
    const host = render();
    expect(activeTab(host)).toBe("Motion");
    expect(motionTarget(host)).toBe("wrap");
    expect(explains(host)).toEqual([]);
    expect(host.querySelector("[data-motion-stagger]")).toBeNull();
    expect(runOnCanvas(host)).toBe(false);

    const button = host.querySelector<HTMLButtonElement>(
      `[data-motion-preset="${reveal.id}"]`
    );
    act(() => button?.click());

    const [wrapperId] = $selectedInstanceSelector.get() ?? [];
    expect($instances.get().get(wrapperId)?.component).toBe(
      animateChildrenComponent
    );
    expect(activeTab(host)).toBe("Motion");
    expect(motionTarget(host)).toBe("wrapper");
    expect(explains(host)).toEqual([]);
    expect(host.querySelector("[data-motion-stagger]")).not.toBeNull();
    expect(runOnCanvas(host)).toBe(true);
    // the editor sits below Stagger
    const text = host.textContent ?? "";
    expect(text.indexOf("Stagger")).toBeLessThan(text.indexOf("Run on canvas"));
  });

  test("with a child of a wrapper selected, the presets, no Stagger, and Select Animate Children selects the wrapper", () => {
    selectInstance(["child", "wrapper", "body"]);
    $activeInspectorPanel.set("motion");
    const host = render();
    expect(motionTarget(host)).toBe("wrapper");
    expect(explains(host)).toEqual([]);
    expect(host.querySelector("[data-motion-presets]")).not.toBeNull();
    expect(host.querySelector("[data-motion-stagger]")).toBeNull();
    expect(runOnCanvas(host)).toBe(false);

    const select = host.querySelector<HTMLButtonElement>(
      "[data-motion-select-wrapper]"
    );
    expect(select?.textContent).toBe("Select Animate Children");
    act(() => select?.click());
    expect($selectedInstanceSelector.get()).toEqual(["wrapper", "body"]);
    expect(host.querySelector("[data-motion-select-wrapper]")).toBeNull();
    expect(host.querySelector("[data-motion-stagger]")).not.toBeNull();
    expect(runOnCanvas(host)).toBe(true);
  });

  test("the Body shows the refusal", () => {
    selectInstance(["body"]);
    $activeInspectorPanel.set("motion");
    const host = render();
    expect(tabs(host)).toContain("Motion");
    expect(host.querySelector("[data-motion-refusal]")?.textContent).toBe(
      motionRefusal
    );
    expect(host.querySelector("[data-motion-presets]")).toBeNull();
  });

  test("Settings and Motion are never mounted together", () => {
    selectInstance(["wrapper", "body"]);
    $activeInspectorPanel.set("motion");
    const host = render();
    expect(runOnCanvas(host)).toBe(true);
    expect(host.querySelector('[data-marker="settings"]')).toBeNull();

    act(() => $activeInspectorPanel.set("settings"));
    expect(activeTab(host)).toBe("Settings");
    expect(host.querySelector('[data-marker="settings"]')).not.toBeNull();
    expect(host.querySelector("[data-motion-presets]")).toBeNull();
    expect(runOnCanvas(host)).toBe(false);

    act(() => $activeInspectorPanel.set("motion"));
    expect(host.querySelector('[data-marker="settings"]')).toBeNull();
    expect(runOnCanvas(host)).toBe(true);
  });

  test("with no breakpoints an Animate Children shows Stagger and nothing below: no Properties & attributes and no Animation editor", () => {
    project({ breakpoints: [] });
    selectInstance(["wrapper", "body"]);
    $activeInspectorPanel.set("motion");
    const host = render();
    expect(host.querySelector("[data-motion-stagger]")).not.toBeNull();
    expect(motionTarget(host)).toBe("wrapper");
    expect(explains(host)).toEqual([]);
    expect(host.textContent).not.toContain("Properties & attributes");
    expect(runOnCanvas(host)).toBe(false);
  });
});
