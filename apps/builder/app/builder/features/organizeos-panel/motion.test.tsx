import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider, toast } from "@webstudio-is/design-system";
import { createDefaultPages } from "@webstudio-is/project-build";
import { BuilderRuntimeError } from "@webstudio-is/project-build/runtime";
import {
  createTemplateComponentFixture,
  renderData,
  ws,
} from "@webstudio-is/template";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import * as organizeosMetas from "@organizeos/site-components/metas";
import {
  ROOT_INSTANCE_ID,
  blockComponent,
  blockTemplateComponent,
  coreMetas,
  type Instance,
  type Prop,
} from "@webstudio-is/sdk";
import {
  $authPermit,
  $registeredComponentMetas,
  $selectedInstanceSelector,
  registerComponentLibrary,
  selectInstance,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
import { $instances, $pages, $props } from "~/shared/sync/data-stores";
import {
  type RuntimeMutationAccumulator,
  executeStagedRuntimeMutation,
} from "~/shared/instance-utils/data";
import { $externalContentRoots } from "~/shared/external-content-mutations";
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

// The staged commit, real unless a test stands in for it (a factory that
// imports the original deadlocks in the browser runner)
vi.mock("~/shared/instance-utils/data", { spy: true });

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
const AnimateChildren = createTemplateComponentFixture(
  animateChildrenComponent
);
const Block = createTemplateComponentFixture(blockComponent);
const BlockTemplate = createTemplateComponentFixture(blockTemplateComponent);

// the permit the suite starts with, restored after each test
const initialAuthPermit = $authPermit.get();

let root: Root | undefined;
let container: HTMLElement | undefined;

/**
 * body > section > card, a list, and an animation group with a child;
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
      <ws.element ws:tag="p" ws:id="paragraph">
        {"Some "}
        <ws.element ws:tag="b" ws:id="bold">
          bold
        </ws.element>
        {" text"}
      </ws.element>
      <Block ws:id="block">
        <BlockTemplate ws:id="templates"></BlockTemplate>
        <ws.element ws:tag="div" ws:id="note"></ws.element>
      </Block>
    </ws.element>
  );
  $instances.set(data.instances);
  $props.set(new Map(wrapperProps.map((prop) => [prop.id, prop])));
  $externalContentRoots.set(new Map());
  const pages = createDefaultPages({ rootInstanceId: "body" });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
  // build access, which only a page template asks for
  $authPermit.set("own");
};

/**
 * The Content Block's content as MDX content: the block's root owns `note`,
 * and its Templates hold nothing, so the commit refuses any new instance
 * there (commitRuntimeMutation in shared/instance-utils/data.ts).
 */
const asMdxContent = () => {
  $externalContentRoots.set(
    new Map([
      [
        "root",
        {
          blockInstanceId: "block",
          renderScope: JSON.stringify(["block", "body"]),
          instanceIds: new Set(["note"]),
          mutationRevision: 0,
        },
      ],
    ])
  );
};

const mdxRefusal =
  "This component is not in this Content Block’s Templates and cannot be added to MDX content. Add it to Templates first, or keep it outside MDX content.";

/**
 * Runs Motion's own stage on an accumulator whose `execute` refuses the
 * operation `refused` with a BuilderRuntimeError, as the runtime refuses a
 * wrap or a prop update it does not accept.
 */
const refuseWhileStaging = async (refused: string) => {
  const actual = await vi.importActual<
    typeof import("~/shared/instance-utils/data")
  >("~/shared/instance-utils/data");
  vi.mocked(executeStagedRuntimeMutation).mockImplementationOnce((stage) =>
    actual.executeStagedRuntimeMutation((accumulator) =>
      stage({
        get state() {
          return accumulator.state;
        },
        stage: accumulator.stage,
        execute: ((operation) => {
          if (operation.id === refused) {
            throw new BuilderRuntimeError("BAD_REQUEST", "Refused here.");
          }
          return accumulator.execute(operation);
        }) as RuntimeMutationAccumulator["execute"],
      })
    )
  );
};

/**
 * Runs Motion's whole stage, then refuses the commit the way
 * commitRuntimeMutation does: it toasts its message, then throws it.
 */
const refuseTheCommit = async () => {
  const actual = await vi.importActual<
    typeof import("~/shared/instance-utils/data")
  >("~/shared/instance-utils/data");
  vi.mocked(executeStagedRuntimeMutation).mockImplementationOnce((stage) =>
    actual.executeStagedRuntimeMutation(async (accumulator) => {
      await stage(accumulator);
      toast.error("Refused by the commit.");
      throw new BuilderRuntimeError("BAD_REQUEST", "Refused by the commit.");
    })
  );
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

// A wrap commits after its staged mutation resolves, a few microtasks later.
const click = async (host: HTMLElement, presetId: string) => {
  const button = host.querySelector<HTMLButtonElement>(
    `[data-motion-preset="${presetId}"]`
  );
  expect(button).not.toBeNull();
  await act(async () => {
    button?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const undoDepth = () => serverSyncStore.transactionManager.currentStack.length;

// A page template, selected without build access: the one place the runtime
// layer refuses a commit (shared/instance-utils/data.ts).
const selectPageTemplateWithoutBuildAccess = () => {
  const pages = $pages.get()!;
  $pages.set({
    ...pages,
    pageTemplates: new Map([
      [
        "template",
        {
          id: "template",
          name: "Template",
          title: "Template",
          rootInstanceId: "body",
          meta: {},
        },
      ],
    ]),
  });
  $selectedPageId.set("template");
  $authPermit.set("view");
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
  $authPermit.set(initialAuthPermit);
  $externalContentRoots.set(new Map());
  // drops a stand-in a test did not use, back to the real staged commit
  vi.mocked(executeStagedRuntimeMutation).mockReset();
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

  test("an animation group, or a child of one, is the existing wrapper", () => {
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

  test("a preset wraps a plain element, with both props, in one undo step", async () => {
    project();
    selectInstance(["section", "body"]);
    const before = getStores();
    const stack = undoDepth();
    const host = render();
    expect(
      host
        .querySelector("[data-motion-target]")
        ?.getAttribute("data-motion-target")
    ).toBe("wrap");
    // no Stagger field until there is a wrapper
    expect(host.querySelector("[data-motion-stagger]")).toBeNull();

    await click(host, revealStaggered.id);

    // the wrap and both props: one transaction
    expect(undoDepth()).toBe(stack + 1);
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

  test("a preset replaces an existing wrapper's action and stagger", async () => {
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

    const stack = undoDepth();
    await click(host, parallax.id);

    // one transaction
    expect(undoDepth()).toBe(stack + 1);
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

  test("a preset on a wrapper without props writes both", async () => {
    project();
    selectInstance(["wrapper", "body"]);
    await applyMotionPreset(reveal);
    expect(propsOf("wrapper")).toEqual({
      action: { type: "animationAction", value: reveal.action },
      stagger: { type: "number", value: 0 },
    });
  });

  test("the written action is a copy, not the preset itself", async () => {
    project();
    selectInstance(["wrapper", "body"]);
    await applyMotionPreset(reveal);
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

  // The runtime's wrap alone accepts it (its registry has no OrganizeOS metas,
  // so the wrapper is tagless and fits anywhere): the builder's metas refuse it.
  test("a list item is refused with the content model's toast, writing nothing", async () => {
    const toastError = vi.spyOn(toast, "error");
    project();
    selectInstance(["item", "list", "body"]);
    const before = getStores();
    const stack = undoDepth();
    await applyMotionPreset(reveal);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("Cannot wrap in Animation group");
    // neither the wrapper nor its props
    expect(getStores()).toEqual(before);
    expect($props.get().size).toBe(0);
    expect(undoDepth()).toBe(stack);
    expect($selectedInstanceSelector.get()).toEqual(["item", "list", "body"]);
  });

  test("a wrap without build access toasts the refusal and writes nothing", async () => {
    const toastError = vi.spyOn(toast, "error");
    project();
    selectPageTemplateWithoutBuildAccess();
    selectInstance(["section", "body"]);
    const before = getStores();
    const stack = undoDepth();
    await expect(applyMotionPreset(reveal)).resolves.toBeUndefined();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "Page templates can be edited only in design mode, with build access."
    );
    expect(getStores()).toEqual(before);
    expect(undoDepth()).toBe(stack);
    expect($selectedInstanceSelector.get()).toEqual(["section", "body"]);
  });

  test("text inside rich text is refused with one toast, writing nothing", async () => {
    const toastError = vi.spyOn(toast, "error");
    project();
    selectInstance(["bold", "paragraph", "body"]);
    expect(
      getMotionTarget($selectedInstanceSelector.get(), $instances.get(), {
        rootInstanceId: "body",
      })
    ).toEqual({ kind: "wrap", instanceId: "bold" });
    const before = getStores();
    const stack = undoDepth();
    await applyMotionPreset(reveal);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("Cannot wrap textual content");
    expect(getStores()).toEqual(before);
    expect(undoDepth()).toBe(stack);
    expect($selectedInstanceSelector.get()).toEqual([
      "bold",
      "paragraph",
      "body",
    ]);
  });

  // The commit's own refusal: commitRuntimeMutation toasts it, then throws
  // it, and Motion does not toast it again (ruling data OQ7).
  test("a wrap inside MDX content is refused by the commit with one toast, writing nothing", async () => {
    const toastError = vi.spyOn(toast, "error");
    project();
    asMdxContent();
    selectInstance(["note", "block", "body"]);
    const before = getStores();
    const stack = undoDepth();
    await applyMotionPreset(reveal);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(mdxRefusal);
    expect(getStores()).toEqual(before);
    expect(undoDepth()).toBe(stack);
    expect($selectedInstanceSelector.get()).toEqual(["note", "block", "body"]);
  });

  test.each([
    ["a wrap", ["section", "body"]],
    ["an existing wrapper's props", ["wrapper", "body"]],
  ])(
    "the commit's own refusal of %s is toasted once, by the commit, and nothing is written",
    async (_case, selector) => {
      const toastError = vi.spyOn(toast, "error");
      await refuseTheCommit();
      project();
      selectInstance(selector);
      const before = getStores();
      const stack = undoDepth();
      await applyMotionPreset(reveal);
      expect(toastError).toHaveBeenCalledTimes(1);
      expect(toastError).toHaveBeenCalledWith("Refused by the commit.");
      expect(getStores()).toEqual(before);
      expect(undoDepth()).toBe(stack);
      expect($selectedInstanceSelector.get()).toEqual(selector);
    }
  );

  // A runtime refusal inside Motion's own stage is toasted by nobody else.
  test.each([
    ["a wrap", "instances.wrap", ["section", "body"]],
    ["a wrap's props", "instances.updateProps", ["section", "body"]],
    [
      "an existing wrapper's props",
      "instances.updateProps",
      ["wrapper", "body"],
    ],
  ])(
    "the runtime's refusal of %s while staging is toasted once, and nothing is written",
    async (_case, refused, selector) => {
      const toastError = vi.spyOn(toast, "error");
      await refuseWhileStaging(refused);
      project();
      selectInstance(selector);
      const before = getStores();
      const stack = undoDepth();
      await applyMotionPreset(reveal);
      expect(toastError).toHaveBeenCalledTimes(1);
      expect(toastError).toHaveBeenCalledWith("Refused here.");
      expect(getStores()).toEqual(before);
      expect(undoDepth()).toBe(stack);
      expect($selectedInstanceSelector.get()).toEqual(selector);
    }
  );

  test("a preset on an existing wrapper without build access toasts the refusal and writes nothing", async () => {
    const toastError = vi.spyOn(toast, "error");
    project();
    selectPageTemplateWithoutBuildAccess();
    selectInstance(["wrapper", "body"]);
    const before = getStores();
    const stack = undoDepth();
    await expect(applyMotionPreset(reveal)).resolves.toBeUndefined();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "Page templates can be edited only in design mode, with build access."
    );
    expect(getStores()).toEqual(before);
    expect(undoDepth()).toBe(stack);
  });
});

describe("upstream's Animation section", () => {
  // props-section.tsx shows the Animation section, in place of the props
  // panel, for an instance whose initial props include an animationAction
  test("shows for an animation group", () => {
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
