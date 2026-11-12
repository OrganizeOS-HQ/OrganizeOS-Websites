// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { atom } from "nanostores";
import { useStore } from "@nanostores/react";
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
  TooltipProvider,
} from "@webstudio-is/design-system";
import {
  $builderMode,
  $canvasIframeState,
  $selectedInstanceRenderState,
} from "~/shared/nano-states";
import { createCommandsEmitter } from "~/shared/commands-emitter";
import {
  $activeSidebarPanel,
  $dataLoadingState,
  $isUiHidden,
  setActiveSidebarPanel,
} from "~/builder/shared/nano-states";
import { setSetting } from "~/builder/shared/client-settings";
import { IDLE, POTENTIAL } from "~/builder/shared/assets/drag-monitor";
import {
  $openRailOverlay,
  isEditableTarget,
  RailOverlay,
  RailOverlayButton,
  registerRail,
} from "./rail-overlay";

// A test source for the external drag state, as cms-panel.test.tsx's: `set`
// calls each subscriber synchronously, in subscription order.
const drag = vi.hoisted(() => {
  const source = {
    state: 0 as 0 | 1,
    listeners: [] as Array<(state: 0 | 1) => void>,
    set(state: 0 | 1) {
      source.state = state;
      for (const listener of [...source.listeners]) {
        listener(state);
      }
    },
  };
  return source;
});

vi.mock("~/builder/shared/assets/drag-monitor", async (importOriginal) => {
  const { useEffect, useRef } = await import("react");
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
  return {
    ...(await importOriginal<
      typeof import("~/builder/shared/assets/drag-monitor")
    >()),
    useExternalDragStateEffect,
  };
});

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const $available = atom(true);
const $children = atom<ReactNode>(null);

const VariablesHarness = () => (
  <RailOverlay
    name="variables"
    isAvailable={useStore($available)}
    allowCommands={["undo"]}
  >
    {useStore($children)}
  </RailOverlay>
);

const Harness = () => (
  <TooltipProvider>
    <div ref={registerRail} data-testid="rail">
      <RailOverlayButton name="cms" label="CMS" isAvailable>
        c
      </RailOverlayButton>
      <RailOverlayButton
        name="variables"
        label="Variables"
        isAvailable={useStore($available)}
      >
        v
      </RailOverlayButton>
    </div>
    <RailOverlay name="cms" isAvailable>
      <div data-cms-child tabIndex={-1} />
    </RailOverlay>
    <VariablesHarness />
  </TooltipProvider>
);

let root: Root | undefined;
let container: HTMLElement | undefined;

const render = () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(createElement(Harness));
  });
};

const button = (name: "cms" | "variables") =>
  document.querySelector<HTMLButtonElement>(`[data-rail-button="${name}"]`);

const overlay = (name: "cms" | "variables") =>
  document.querySelector<HTMLElement>(`[data-rail-overlay="${name}"]`);

const isShown = (name: "cms" | "variables") =>
  overlay(name)?.style.display === "block";

const click = (name: "cms" | "variables") => {
  act(() => {
    button(name)?.click();
  });
};

const mount = (node: ReactNode) => {
  act(() => {
    $children.set(node);
  });
};

const press = (
  key: string,
  target: EventTarget = document.body,
  init: KeyboardEventInit = {}
) => {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
};

// No PointerEvent is needed: the listener reads only the target.
const pointerDown = (target: EventTarget) => {
  act(() => {
    target.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  });
};

// The suite's viewport is narrow and its rail unstyled: pin the rail's box
// as the builder lays it out.
const pinRail = () => {
  const rail = document.querySelector<HTMLElement>('[data-testid="rail"]');
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
};

const bodyChildOf = (node: Element) => {
  let current = node;
  while (current.parentElement !== document.body) {
    current = current.parentElement!;
  }
  return current;
};

const follows = (a: Node, b: Node) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

beforeEach(() => {
  // The sidebar's panel reads "none" until the builder has loaded.
  $dataLoadingState.set("loaded");
  $selectedInstanceRenderState.set("mounted");
  $canvasIframeState.set("ready");
  $builderMode.set("design");
  $isUiHidden.set(false);
  $available.set(true);
  $children.set(null);
  $openRailOverlay.set(undefined);
});

afterEach(() => {
  act(() => {
    $openRailOverlay.set(undefined);
    setActiveSidebarPanel("none");
    root?.unmount();
    setSetting("navigatorLayout", "undocked");
    drag.set(IDLE);
  });
  container?.remove();
  root = undefined;
  container = undefined;
  vi.restoreAllMocks();
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
    ["a color-input", "<color-input></color-input>"],
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

describe("a rail overlay", () => {
  test("its rail button opens and hides it, aria-pressed while open, display block or none", () => {
    render();
    expect(button("variables")?.getAttribute("aria-label")).toBe("Variables");
    expect(isShown("variables")).toBe(false);
    click("variables");
    expect(isShown("variables")).toBe(true);
    expect(button("variables")?.getAttribute("aria-pressed")).toBe("true");
    click("variables");
    expect(overlay("variables")?.style.display).toBe("none");
    expect(button("variables")?.getAttribute("aria-pressed")).toBe("false");
  });

  test("opening one hides the other; $openRailOverlay names the open one", () => {
    render();
    click("cms");
    expect($openRailOverlay.get()).toBe("cms");
    click("variables");
    expect($openRailOverlay.get()).toBe("variables");
    expect(isShown("cms")).toBe(false);
    expect(isShown("variables")).toBe(true);
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
      click("variables");
      expect($activeSidebarPanel.get()).toBe("none");
      expect(isShown("variables")).toBe(true);
    }
  );

  test("a panel activated any other way hides whichever is open", () => {
    render();
    click("variables");
    act(() => setActiveSidebarPanel("assets"));
    expect($openRailOverlay.get()).toBe(undefined);
    click("cms");
    act(() => setActiveSidebarPanel("pages"));
    expect($openRailOverlay.get()).toBe(undefined);
  });

  test("an external drag never hides it: POTENTIAL, then IDLE, then a drop; after the drag a panel change does", async () => {
    render();
    click("variables");
    // The sidebar switches to Assets on a drag and restores its tab after it.
    act(() => {
      drag.set(POTENTIAL);
      setActiveSidebarPanel("assets");
    });
    expect(isShown("variables")).toBe(true);
    act(() => {
      drag.set(IDLE);
      setActiveSidebarPanel("pages");
    });
    expect(isShown("variables")).toBe(true);
    await Promise.resolve();
    act(() => setActiveSidebarPanel("navigator"));
    expect(isShown("variables")).toBe(false);
  });

  test("preview mode and the hidden UI hide it, and it stays hidden after", () => {
    render();
    click("variables");
    act(() => $builderMode.set("preview"));
    expect($openRailOverlay.get()).toBe(undefined);
    act(() => $builderMode.set("design"));
    expect(isShown("variables")).toBe(false);
    click("variables");
    act(() => $isUiHidden.set(true));
    expect($openRailOverlay.get()).toBe(undefined);
    act(() => $isUiHidden.set(false));
    expect(isShown("variables")).toBe(false);
  });

  test("isAvailable false hides it and renders nothing", () => {
    render();
    click("variables");
    act(() => $available.set(false));
    expect($openRailOverlay.get()).toBe(undefined);
    expect(overlay("variables")).toBeNull();
    expect(button("variables")).toBeNull();
  });

  test("it has no z-index", () => {
    render();
    click("variables");
    expect(overlay("variables")?.style.zIndex).toBe("");
    expect(getComputedStyle(overlay("variables")!).zIndex).toBe("auto");
  });

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
  ])("a %s opened inside it is a later body child", (_kind, node, selector) => {
    render();
    click("variables");
    mount(node);
    const popup = document.querySelector(selector);
    expect(popup).not.toBeNull();
    expect(follows(overlay("variables")!, bodyChildOf(popup!))).toBe(true);
  });

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
      click("variables");
      const { left, top, width, height } =
        overlay("variables")!.getBoundingClientRect();
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(
        overlay("variables")!.contains(
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
    click("variables");
    mount(
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
    // The open Select turns off pointer events outside it: turn them back on
    // for the overlay, so the element at the point is the one painted there.
    overlay("variables")!.style.pointerEvents = "auto";
    const r = option.getBoundingClientRect();
    const hit = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2
    );
    expect(overlay("variables")!.contains(hit)).toBe(false);
    expect(option.contains(hit)).toBe(true);
  });

  test("focus moves to its root on open", () => {
    render();
    button("variables")?.focus();
    click("variables");
    expect(document.activeElement).toBe(overlay("variables"));
  });

  test("Escape at the top level hides it and returns focus to its rail button", () => {
    render();
    click("variables");
    press("Escape", overlay("variables")!);
    expect(isShown("variables")).toBe(false);
    expect(document.activeElement).toBe(button("variables"));
  });

  test.each([
    ["input", <input key="field" data-field />],
    ["textarea", <textarea key="field" data-field />],
    ["select", <select key="field" data-field />],
    [
      "color-input",
      createElement("color-input", { key: "field", "data-field": "" }),
    ],
    [
      "contenteditable",
      <div
        key="field"
        data-field
        contentEditable
        suppressContentEditableWarning
      />,
    ],
  ])("Escape in a %s inside it leaves it open", (_kind, node) => {
    render();
    click("variables");
    mount(node);
    press("Escape", document.querySelector("[data-field]")!);
    expect(isShown("variables")).toBe(true);
  });

  test("Escape a popup prevented leaves it open", () => {
    render();
    click("variables");
    mount(
      <button
        key="popup"
        data-popup
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
          }
        }}
      />
    );
    press("Escape", document.querySelector("[data-popup]")!);
    expect(isShown("variables")).toBe(true);
  });

  test("Escape in an open Select inside it closes only the Select", async () => {
    render();
    pinRail();
    click("variables");
    mount(<Select options={["One", "Two"]} value="One" onChange={() => {}} />);
    await act(async () =>
      userEvent.click(overlay("variables")!.querySelector("button")!)
    );
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    await act(async () => userEvent.keyboard("{Escape}"));
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(isShown("variables")).toBe(true);
  });

  test("while shown only allowCommands run; hidden, every command runs", () => {
    const handlers = { undo: vi.fn(), components: vi.fn() };
    const { subscribeCommands } = createCommandsEmitter({
      source: "rail-overlay-test",
      commands: [
        { name: "undo", defaultHotkeys: ["meta+z"], handler: handlers.undo },
        {
          name: "railTestComponents",
          defaultHotkeys: ["a"],
          handler: handlers.components,
        },
      ],
    });
    const unsubscribe = subscribeCommands();
    try {
      render();
      click("cms");
      press("a");
      press("z", document.body, { metaKey: true });
      expect(handlers.components).not.toHaveBeenCalled();
      expect(handlers.undo).not.toHaveBeenCalled();
      click("variables");
      press("a");
      press("z", document.body, { metaKey: true });
      expect(handlers.components).not.toHaveBeenCalled();
      expect(handlers.undo).toHaveBeenCalledTimes(1);
      click("variables");
      press("a");
      expect(handlers.components).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  test("copy, cut and paste on a non-editable target stop at the window; an input's reach the document", () => {
    const reached = vi.fn();
    const types = ["copy", "cut", "paste"] as const;
    for (const type of types) {
      document.addEventListener(type, reached, true);
    }
    try {
      render();
      click("variables");
      mount(<input key="field" data-field />);
      for (const type of types) {
        act(() => {
          overlay("variables")!.dispatchEvent(
            new ClipboardEvent(type, { bubbles: true, cancelable: true })
          );
        });
      }
      expect(reached).not.toHaveBeenCalled();
      for (const type of types) {
        act(() => {
          document
            .querySelector("[data-field]")!
            .dispatchEvent(
              new ClipboardEvent(type, { bubbles: true, cancelable: true })
            );
        });
      }
      expect(reached).toHaveBeenCalledTimes(3);
    } finally {
      for (const type of types) {
        document.removeEventListener(type, reached, true);
      }
    }
  });

  test("a cut or paste from a colour input's shadow field stops at the window, so the builder never takes it for the canvas; Escape there still keeps the overlay", () => {
    const reached = vi.fn();
    const types = ["cut", "paste"] as const;
    for (const type of types) {
      document.addEventListener(type, reached, true);
    }
    try {
      render();
      click("variables");
      mount(createElement("color-input", { key: "color", "data-color": "" }));
      const host = document.querySelector<HTMLElement>("[data-color]")!;
      const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
      const field = document.createElement("input");
      shadow.appendChild(field);
      for (const type of types) {
        act(() => {
          // at the document the event's target is the host, not the input
          field.dispatchEvent(
            new ClipboardEvent(type, {
              bubbles: true,
              cancelable: true,
              composed: true,
            })
          );
        });
      }
      expect(reached).not.toHaveBeenCalled();
      press("Escape", field, { composed: true });
      expect(isShown("variables")).toBe(true);
    } finally {
      for (const type of types) {
        document.removeEventListener(type, reached, true);
      }
    }
  });

  test("a press on a nav hides it; a press inside it or on its rail button does not", () => {
    render();
    const nav = document.createElement("nav");
    const trigger = document.createElement("button");
    nav.appendChild(trigger);
    document.body.appendChild(nav);
    try {
      click("variables");
      pointerDown(overlay("variables")!);
      pointerDown(button("variables")!);
      expect(isShown("variables")).toBe(true);
      pointerDown(trigger);
      expect(isShown("variables")).toBe(false);
    } finally {
      nav.remove();
    }
  });
});
