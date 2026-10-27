import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import { createDefaultPages } from "@webstudio-is/project-build";
import { getStyleDeclKey, ROOT_INSTANCE_ID } from "@webstudio-is/sdk";
import { camelCaseProperty } from "@webstudio-is/css-data";
import { registerContainers } from "~/shared/sync/sync-stores";
import {
  $organizeosSite,
  $selectedInstanceRenderState,
  $selectedPageId,
  $selectedStyleSources,
  $selectedStyleState,
  selectInstance,
} from "~/shared/nano-states";
import { $pages, $styles } from "~/shared/sync/data-stores";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { CollapsibleProvider } from "~/builder/shared/collapsible-section";
import { setSetting } from "~/builder/shared/client-settings";
import { StylePanel } from "~/builder/features/style-panel/style-panel";
import { sections } from "~/builder/features/style-panel/sections";
import { Inspector } from "~/builder/inspector";
import { checkSectionContrast } from "./backgrounds/contrast";
import {
  el,
  localId,
  registerTestMetas,
  setupProject,
  toStyleValue,
  type Node,
  type TestStyle,
} from "./backgrounds/test-fixtures";
import { Section } from "./background-presets-section";

vi.mock("./backgrounds/contrast", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./backgrounds/contrast")>();
  return {
    ...actual,
    checkSectionContrast: vi.fn(actual.checkSectionContrast),
  };
});

// The Inspector's neighbours, as markers: only its tabs are under test. The
// index modules are mocked, so StylePanel itself still renders from its own
// module above.
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

const site: OrganizeosSite = {
  organizationId: "org-1",
  manageUrl: "https://app.organizeos.org/dashboard",
  platformUrl: "https://app.organizeos.org",
  blocksEnabled: true,
};

let root: Root | undefined;
let container: HTMLElement | undefined;

// body > section > text, and body > other > otherText
const sectionSelector = ["section", "body"];
const otherSelector = ["other", "body"];

const project = ({
  styles = [],
  extra = [],
}: { styles?: TestStyle[]; extra?: Node[] } = {}) => {
  setupProject({
    tree: el("body", "Body", [
      el("section", "Box", [el("text", "Text", ["Hello"])]),
      el("other", "Box", [el("otherText", "Text", ["Hi"])]),
      ...extra,
    ]),
    styles,
  });
  const pages = createDefaultPages({ rootInstanceId: "body" });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
};

const style = (
  on: string,
  property: TestStyle["property"],
  value: string
): TestStyle => ({ on, property, value });

/** Sets a decl on an instance's local source, as a style panel edit would. */
const setLocalStyle = (
  instanceId: string,
  property: TestStyle["property"],
  value: string
) => {
  const styles = new Map($styles.get());
  const decl = {
    styleSourceId: localId(instanceId),
    breakpointId: "base",
    property: camelCaseProperty(property),
    value: toStyleValue(property, value),
  };
  styles.set(getStyleDeclKey(decl), decl);
  $styles.set(styles);
};

const render = (element: ReactNode) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(createElement(TooltipProvider, null, element));
  });
  return container;
};

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const contrastLine = (host: HTMLElement) =>
  host.querySelector("[data-contrast-line]")?.textContent;

const contrastCalls = () => vi.mocked(checkSectionContrast).mock.calls.length;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  registerTestMetas();
  selectInstance(undefined);
  $selectedStyleSources.set(new Map());
  $selectedStyleState.set(undefined);
  $organizeosSite.set(site);
  vi.mocked(checkSectionContrast).mockClear();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  $selectedInstanceRenderState.set("notMounted");
});

describe("Background presets", () => {
  test("renders nothing for a denied org", () => {
    project();
    selectInstance(sectionSelector);
    $organizeosSite.set({ ...site, blocksEnabled: false });
    const host = render(createElement(Section));
    advance(150);
    expect(host.innerHTML).toBe("");
    expect(checkSectionContrast).not.toHaveBeenCalled();
  });

  test("nothing for a project no org owns", () => {
    project();
    selectInstance(sectionSelector);
    $organizeosSite.set(undefined);
    const host = render(createElement(Section));
    advance(150);
    expect(host.innerHTML).toBe("");
    expect(checkSectionContrast).not.toHaveBeenCalled();
  });

  test("nothing for the Body, the page root and Global Root", () => {
    // a Body that is not the page root, beside the page root "body"
    project({ extra: [el("innerBody", "Body")] });
    const host = render(createElement(Section));
    for (const selector of [
      ["body"],
      ["innerBody", "body"],
      [ROOT_INSTANCE_ID],
    ]) {
      act(() => selectInstance(selector));
      advance(150);
      expect(host.innerHTML, String(selector)).toBe("");
    }
    expect(checkSectionContrast).not.toHaveBeenCalled();
  });

  test("Background presets for an element", () => {
    project({ styles: [style("text", "color", "#aaaaaa")] });
    selectInstance(sectionSelector);
    const host = render(createElement(Section));
    expect(host.textContent).toContain("Background presets");
    expect(host.querySelector("[data-preset-grid]")).not.toBeNull();
    advance(150);
    expect(contrastLine(host)).toBe("Text below AA contrast");
  });

  test("computes nothing while closed", () => {
    project({ styles: [style("text", "color", "#333333")] });
    selectInstance(sectionSelector);
    // focus mode: an accordion with Layout open
    const host = render(
      <CollapsibleProvider accordion initialOpen="Layout">
        <Section />
      </CollapsibleProvider>
    );
    advance(1000);
    expect(host.textContent).toContain("Background presets");
    expect(host.querySelector("[data-preset-grid]")).toBeNull();
    expect(checkSectionContrast).not.toHaveBeenCalled();
    // a style edit while closed computes nothing either
    act(() => setLocalStyle("text", "color", "#aaaaaa"));
    advance(1000);
    expect(checkSectionContrast).not.toHaveBeenCalled();

    const trigger = host.querySelector<HTMLButtonElement>(
      "button[aria-expanded]"
    );
    act(() => trigger?.click());
    expect(host.querySelector("[data-preset-grid]")).not.toBeNull();
    expect(checkSectionContrast).not.toHaveBeenCalled();
    expect(contrastLine(host)).toBeUndefined();
    advance(149);
    expect(checkSectionContrast).not.toHaveBeenCalled();
    advance(1);
    expect(checkSectionContrast).toHaveBeenCalledTimes(1);
    expect(contrastLine(host)).toBe("Text below AA contrast");
  });

  test("a style change updates the report after the scheduled run, not synchronously", () => {
    project({ styles: [style("text", "color", "#aaaaaa")] });
    selectInstance(sectionSelector);
    const host = render(createElement(Section));
    advance(150);
    expect(contrastLine(host)).toBe("Text below AA contrast");
    const calls = contrastCalls();

    act(() => setLocalStyle("text", "color", "#333333"));
    // the last report stays on screen until the run lands
    expect(contrastCalls()).toBe(calls);
    expect(contrastLine(host)).toBe("Text below AA contrast");
    advance(149);
    expect(contrastLine(host)).toBe("Text below AA contrast");
    advance(1);
    expect(contrastCalls()).toBe(calls + 1);
    expect(contrastLine(host)).toBeUndefined();
  });

  test("two quick changes cause one run", () => {
    project({ styles: [style("text", "color", "#333333")] });
    selectInstance(sectionSelector);
    const host = render(createElement(Section));
    advance(150);
    const calls = contrastCalls();

    act(() => setLocalStyle("text", "color", "#aaaaaa"));
    advance(100);
    act(() => setLocalStyle("text", "color", "#000000"));
    advance(100);
    // the first change's run was replaced
    expect(contrastCalls()).toBe(calls);
    advance(50);
    expect(contrastCalls()).toBe(calls + 1);
    expect(contrastLine(host)).toBeUndefined();
    advance(1000);
    expect(contrastCalls()).toBe(calls + 1);
  });

  test("without requestIdleCallback (jsdom 20, and deleted from globalThis explicitly) it renders, nothing throws, and the report lands through setTimeout after 150 ms", () => {
    const scope = globalThis as {
      requestIdleCallback?: unknown;
      cancelIdleCallback?: unknown;
    };
    // jsdom 20 has none; delete it anyway, in case a later jsdom adds it
    const saved = {
      requestIdleCallback: scope.requestIdleCallback,
      cancelIdleCallback: scope.cancelIdleCallback,
    };
    delete scope.requestIdleCallback;
    delete scope.cancelIdleCallback;
    try {
      expect("requestIdleCallback" in globalThis).toBe(false);
      project({ styles: [style("text", "color", "#aaaaaa")] });
      selectInstance(sectionSelector);
      const host = render(createElement(Section));
      expect(host.querySelector("[data-preset-grid]")).not.toBeNull();
      expect(contrastLine(host)).toBeUndefined();
      advance(149);
      expect(contrastLine(host)).toBeUndefined();
      advance(1);
      expect(contrastLine(host)).toBe("Text below AA contrast");
    } finally {
      if (saved.requestIdleCallback !== undefined) {
        scope.requestIdleCallback = saved.requestIdleCallback;
      }
      if (saved.cancelIdleCallback !== undefined) {
        scope.cancelIdleCallback = saved.cancelIdleCallback;
      }
    }
  });

  test("with requestIdleCallback and cancelIdleCallback stubbed (vi.stubGlobal), the run is scheduled through them with { timeout: 150 }, and a newer change cancels the pending one", () => {
    const pending = new Map<number, IdleRequestCallback>();
    let nextHandle = 1;
    const requestIdleCallback = vi.fn(
      (callback: IdleRequestCallback, _options?: IdleRequestOptions) => {
        const handle = nextHandle++;
        pending.set(handle, callback);
        return handle;
      }
    );
    const cancelIdleCallback = vi.fn((handle: number) => {
      pending.delete(handle);
    });
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    vi.stubGlobal("cancelIdleCallback", cancelIdleCallback);
    const runPending = () => {
      act(() => {
        for (const [handle, callback] of pending) {
          pending.delete(handle);
          callback({ didTimeout: false, timeRemaining: () => 10 });
        }
      });
    };

    project({ styles: [style("text", "color", "#aaaaaa")] });
    selectInstance(sectionSelector);
    const host = render(createElement(Section));
    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 150,
    });
    // nothing went through setTimeout: time alone lands no report
    advance(1000);
    expect(contrastLine(host)).toBeUndefined();
    runPending();
    expect(contrastLine(host)).toBe("Text below AA contrast");

    act(() => setLocalStyle("text", "color", "#bbbbbb"));
    expect(requestIdleCallback).toHaveBeenCalledTimes(2);
    act(() => setLocalStyle("text", "color", "#333333"));
    expect(requestIdleCallback).toHaveBeenCalledTimes(3);
    // the second run was cancelled by the third
    expect(cancelIdleCallback).toHaveBeenLastCalledWith(
      requestIdleCallback.mock.results[1].value
    );
    expect(pending.size).toBe(1);
    const calls = contrastCalls();
    advance(1000);
    expect(contrastCalls()).toBe(calls);
    runPending();
    expect(contrastCalls()).toBe(calls + 1);
    expect(contrastLine(host)).toBeUndefined();
  });

  test("a selection change drops the previous line at once, shows none until the new section's run lands, and never the first report's line in between", () => {
    project({
      styles: [
        style("text", "color", "#aaaaaa"),
        style("otherText", "color", "#bbbbbb"),
      ],
    });
    selectInstance(sectionSelector);
    const host = render(createElement(Section));
    advance(150);
    expect(contrastLine(host)).toBe("Text below AA contrast");

    // every DOM change from here on, read synchronously with takeRecords
    const observer = new MutationObserver(() => {});
    observer.observe(host, { childList: true, subtree: true });

    act(() => selectInstance(otherSelector));
    expect(contrastLine(host)).toBeUndefined();
    advance(149);
    expect(contrastLine(host)).toBeUndefined();
    // no line was added, even for a moment, before the new run landed
    const records = observer.takeRecords();
    observer.disconnect();
    expect(records.length).toBeGreaterThan(0);
    const lineAdded = records.some((record) =>
      Array.from(record.addedNodes).some(
        (node) =>
          node instanceof Element &&
          (node.matches("[data-contrast-line]") ||
            node.querySelector("[data-contrast-line]") !== null)
      )
    );
    expect(lineAdded).toBe(false);

    advance(1);
    expect(contrastLine(host)).toBe("Text below AA contrast");
  });
});

describe("Background presets in the Style panel", () => {
  /** The section headings, in order: each title's own label. */
  const headings = (host: HTMLElement) =>
    Array.from(
      host.querySelectorAll("[data-state] > button[aria-expanded]"),
      (button) => button.parentElement?.textContent ?? ""
    );

  test("StylePanel lists Background presets directly after Backgrounds, and none in advanced mode", () => {
    project();
    selectInstance(sectionSelector);
    $selectedInstanceRenderState.set("mounted");
    setSetting("stylePanelMode", "default");
    const host = render(createElement(StylePanel));
    const titles = headings(host);
    const backgrounds = titles.indexOf("Backgrounds");
    expect(backgrounds).toBeGreaterThan(-1);
    expect(titles[backgrounds + 1]).toBe("Background presets");
    expect(titles.filter((title) => title === "Background presets")).toEqual([
      "Background presets",
    ]);
    // the map itself, as the panel walks it
    const keys = [...sections.keys()];
    expect(keys[keys.indexOf("backgrounds") + 1]).toBe(
      "organizeosBackgroundPresets"
    );

    act(() => setSetting("stylePanelMode", "advanced"));
    expect(headings(host)).not.toContain("Background presets");
    expect(host.textContent).not.toContain("Background presets");
    act(() => setSetting("stylePanelMode", "default"));
  });

  test("an Inspector with a Slot selected offers no Style tab, so no Background presets", () => {
    project({ extra: [el("slot", "Slot", [el("inSlot", "Box")])] });
    selectInstance(["slot", "body"]);
    const host = render(
      createElement(Inspector, { navigatorLayout: "docked" })
    );
    const tabs = () =>
      Array.from(host.querySelectorAll('[role="tab"]'), (tab) =>
        tab.textContent?.trim()
      );
    // no Style tab (the Motion tab is offered to the org)
    expect(tabs()).toEqual(["Settings", "Motion"]);
    expect(host.querySelector('[data-marker="style-panel"]')).toBeNull();
    // StylePanel is a marker here, so the tab list is what this case pins:
    // with no Style tab, Background presets has nowhere to render
    // where the Style tab is offered, the Inspector does offer it
    act(() => selectInstance(sectionSelector));
    expect(tabs()).toEqual(["Style", "Settings", "Motion"]);
  });
});
