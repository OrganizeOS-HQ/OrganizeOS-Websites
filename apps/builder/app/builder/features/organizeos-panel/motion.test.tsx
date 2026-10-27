import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider, toast } from "@webstudio-is/design-system";
import { createDefaultPages } from "@webstudio-is/project-build";
import { $, renderData, ws } from "@webstudio-is/template";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import * as organizeosMetas from "@organizeos/site-components/metas";
import {
  ROOT_INSTANCE_ID,
  coreMetas,
  type Instance,
  type Prop,
} from "@webstudio-is/sdk";
import {
  $registeredComponentMetas,
  $selectedInstanceSelector,
  registerComponentLibrary,
  selectInstance,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
import { $instances, $pages, $props } from "~/shared/sync/data-stores";
import {
  $selectedInstanceInitialPropNames,
  $selectedInstancePropsMetas,
} from "~/builder/features/settings-panel/shared";
import {
  Motion,
  animateChildrenComponent,
  applyMotionPreset,
  getMotionTarget,
  motionRefusal,
  setMotionStagger,
} from "./motion";
import { motionPresets } from "./motion/presets";

enableMapSet();
registerContainers();

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

$registeredComponentMetas.set(
  new Map(Object.entries({ ...defaultMetas, ...coreMetas }))
);
registerComponentLibrary({
  namespace: "@organizeos/site-components",
  components: {},
  metas: organizeosMetas,
  templates: {},
});

const [reveal, revealStaggered, parallax] = motionPresets;
const AnimateChildren = $[animateChildrenComponent];

let root: Root | undefined;
let container: HTMLElement | undefined;

/**
 * body > section > card, a list, and an Animate Children with a child;
 * `wrapperProps` are the existing wrapper's own props.
 */
const project = (wrapperProps: Prop[] = []) => {
  const data = renderData(
    <ws.element ws:tag="body" ws:id="body">
      <ws.element ws:tag="section" ws:id="section">
        <ws.element ws:tag="div" ws:id="card"></ws.element>
      </ws.element>
      <ws.element ws:tag="ul" ws:id="list">
        <ws.element ws:tag="li" ws:id="item"></ws.element>
      </ws.element>
      <AnimateChildren ws:id="wrapper">
        <ws.element ws:tag="div" ws:id="child"></ws.element>
      </AnimateChildren>
    </ws.element>
  );
  $instances.set(data.instances);
  $props.set(new Map(wrapperProps.map((prop) => [prop.id, prop])));
  const pages = createDefaultPages({ rootInstanceId: "body" });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
};

const getStores = () => ({ instances: $instances.get(), props: $props.get() });

const propsOf = (instanceId: Instance["id"]) =>
  Object.fromEntries(
    Array.from($props.get().values())
      .filter((prop) => prop.instanceId === instanceId)
      .map((prop) => [prop.name, { type: prop.type, value: prop.value }])
  );

const render = () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(createElement(TooltipProvider, null, createElement(Motion)));
  });
  return container;
};

const click = (host: HTMLElement, presetId: string) => {
  const button = host.querySelector<HTMLButtonElement>(
    `[data-motion-preset="${presetId}"]`
  );
  expect(button).not.toBeNull();
  act(() => {
    button?.click();
  });
};

beforeEach(() => {
  selectInstance(undefined);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("getMotionTarget", () => {
  test("a plain element is wrapped", () => {
    project();
    expect(
      getMotionTarget(["section", "body"], $instances.get(), {
        rootInstanceId: "body",
      })
    ).toEqual({ kind: "wrap", instanceId: "section" });
  });

  test("an Animate Children, or a child of one, is the existing wrapper", () => {
    project();
    const page = { rootInstanceId: "body" };
    expect(
      getMotionTarget(["wrapper", "body"], $instances.get(), page)
    ).toEqual({ kind: "wrapper", instanceId: "wrapper" });
    expect(
      getMotionTarget(["child", "wrapper", "body"], $instances.get(), page)
    ).toEqual({ kind: "wrapper", instanceId: "wrapper" });
  });

  test("nothing, the page root, the Body and Global Root are refused", () => {
    project();
    const instances = new Map($instances.get());
    instances.set("BodyComponent", {
      type: "instance",
      id: "BodyComponent",
      component: "Body",
      children: [],
    });
    const page = { rootInstanceId: "body" };
    for (const selector of [
      undefined,
      [],
      ["body"],
      [ROOT_INSTANCE_ID],
      ["BodyComponent", "body"],
      ["missing", "body"],
    ]) {
      expect(
        getMotionTarget(selector, instances, page),
        String(selector)
      ).toEqual({ kind: "refused" });
    }
  });
});

describe("the Motion area", () => {
  test.each([
    ["no selection", undefined],
    ["the page root", ["body"]],
    ["Global Root", [ROOT_INSTANCE_ID]],
  ])("refuses %s", (_, selector) => {
    project();
    if (selector) {
      selectInstance(selector);
    }
    const host = render();
    // the empty state, and nothing else
    expect(host.textContent).toBe("Select a section");
    expect(motionRefusal).toBe("Select a section");
    expect(host.querySelector("[data-motion-presets]")).toBeNull();
  });

  test("a preset wraps a plain element, with both props, in one undo step", () => {
    project();
    selectInstance(["section", "body"]);
    const before = getStores();
    const host = render();
    expect(
      host
        .querySelector("[data-motion-target]")
        ?.getAttribute("data-motion-target")
    ).toBe("wrap");
    // no Stagger field until there is a wrapper
    expect(host.querySelector("[data-motion-stagger]")).toBeNull();

    click(host, revealStaggered.id);

    const [wrapperId, ...parent] = $selectedInstanceSelector.get() ?? [];
    expect(parent).toEqual(["body"]);
    const wrapper = $instances.get().get(wrapperId);
    expect(wrapper?.component).toBe(animateChildrenComponent);
    expect(wrapper?.children).toEqual([{ type: "id", value: "section" }]);
    expect($instances.get().get("body")?.children[0]).toEqual({
      type: "id",
      value: wrapperId,
    });
    expect(propsOf(wrapperId)).toEqual({
      action: { type: "animationAction", value: revealStaggered.action },
      stagger: { type: "number", value: 8 },
    });
    // the wrapper is now the target: the Stagger field shows
    expect(host.querySelector("[data-motion-stagger]")).not.toBeNull();

    act(() => {
      serverSyncStore.undo();
    });
    expect(getStores()).toEqual(before);
  });

  test("a preset replaces an existing wrapper's action and stagger", () => {
    project([
      {
        id: "actionProp",
        instanceId: "wrapper",
        name: "action",
        type: "animationAction",
        value: { type: "view", animations: [] },
      },
      {
        id: "staggerProp",
        instanceId: "wrapper",
        name: "stagger",
        type: "number",
        value: 12,
      },
    ]);
    // selecting the wrapper's child acts on the wrapper
    selectInstance(["child", "wrapper", "body"]);
    const before = getStores();
    const host = render();
    expect(
      host
        .querySelector("[data-motion-target]")
        ?.getAttribute("data-motion-target")
    ).toBe("wrapper");

    click(host, parallax.id);

    // no second wrapper, the same props, both replaced
    expect($instances.get().size).toBe(before.instances.size);
    expect($props.get().get("actionProp")).toEqual({
      id: "actionProp",
      instanceId: "wrapper",
      name: "action",
      type: "animationAction",
      value: parallax.action,
    });
    expect($props.get().get("staggerProp")).toMatchObject({ value: 0 });
    expect($props.get().size).toBe(2);

    act(() => {
      serverSyncStore.undo();
    });
    expect(getStores()).toEqual(before);
  });

  test("a preset on a wrapper without props writes both", () => {
    project();
    selectInstance(["wrapper", "body"]);
    applyMotionPreset(reveal);
    expect(propsOf("wrapper")).toEqual({
      action: { type: "animationAction", value: reveal.action },
      stagger: { type: "number", value: 0 },
    });
  });

  test("the written action is a copy, not the preset itself", () => {
    project();
    selectInstance(["wrapper", "body"]);
    applyMotionPreset(reveal);
    const prop = Array.from($props.get().values()).find(
      (prop) => prop.name === "action"
    );
    expect(prop?.value).toEqual(reveal.action);
    expect(prop?.value).not.toBe(reveal.action);
    expect(Object.isFrozen(reveal.action)).toBe(false);
  });

  test("the Stagger field edits an existing wrapper's stagger, clamped to 0..20", () => {
    project();
    selectInstance(["wrapper", "body"]);
    const host = render();
    const input = host.querySelector<HTMLInputElement>(
      "[data-motion-stagger] input"
    );
    expect(input?.value).toBe("0");

    const enter = (value: string) => {
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        )?.set;
        setter?.call(input, value);
        input?.dispatchEvent(new Event("input", { bubbles: true }));
      });
      act(() => {
        input?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        );
      });
    };

    enter("6");
    expect(propsOf("wrapper").stagger).toEqual({ type: "number", value: 6 });
    enter("35");
    expect(propsOf("wrapper").stagger).toEqual({ type: "number", value: 20 });
    expect(input?.value).toBe("20");
    // one prop, edited in place
    expect($props.get().size).toBe(1);

    // one undo step per edit
    act(() => {
      serverSyncStore.undo();
    });
    expect(propsOf("wrapper").stagger).toEqual({ type: "number", value: 6 });
  });

  test("Stagger has no caption: its range is the label's tooltip, 0–20 %", () => {
    vi.useFakeTimers();
    // the open tooltip measures its arrow
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    project();
    selectInstance(["wrapper", "body"]);
    const host = render();
    const field = host.querySelector("[data-motion-stagger]");
    // the label and the input, nothing under them
    expect(field?.textContent).toBe("Stagger");
    expect(field?.querySelector("input")?.getAttribute("aria-label")).toBe(
      "Stagger"
    );
    expect(document.body.textContent).not.toContain("0–20 %");
    // hovering the label opens its tooltip, as the Animation editor's do
    const label = Array.from(field?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent === "Stagger"
    );
    act(() => {
      label?.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    });
    act(() => {
      vi.runAllTimers();
    });
    expect(document.body.textContent).toContain("0–20 %");
  });

  test("setMotionStagger clamps below 0 and non-finite values to 0", () => {
    project();
    setMotionStagger("wrapper", -3);
    expect(propsOf("wrapper").stagger).toEqual({ type: "number", value: 0 });
    setMotionStagger("wrapper", 7.5);
    expect(propsOf("wrapper").stagger).toEqual({ type: "number", value: 7.5 });
    setMotionStagger("wrapper", Number.NaN);
    expect(propsOf("wrapper").stagger).toEqual({ type: "number", value: 0 });
  });

  test("a list item is refused by wrapInstance's content-model toast, writing nothing", () => {
    const toastError = vi.spyOn(toast, "error");
    project();
    selectInstance(["item", "list", "body"]);
    const before = getStores();
    applyMotionPreset(reveal);
    expect(toastError).toHaveBeenCalledWith("Cannot wrap in Animate Children");
    expect(getStores()).toEqual(before);
    expect($selectedInstanceSelector.get()).toEqual(["item", "list", "body"]);
  });
});

describe("upstream's Animation section", () => {
  // props-section.tsx shows the Animation section, in place of the props
  // panel, for an instance whose initial props include an animationAction
  test("shows for an Animate Children", () => {
    project();
    selectInstance(["wrapper", "body"]);
    const initialProps = $selectedInstanceInitialPropNames.get();
    const metas = $selectedInstancePropsMetas.get();
    const animationProps = Array.from(initialProps).filter(
      (name) => metas.get(name)?.type === "animationAction"
    );
    expect(animationProps).toEqual(["action"]);
    // stagger is edited in the Motion area, not there
    expect(initialProps.has("stagger")).toBe(false);
  });
});
