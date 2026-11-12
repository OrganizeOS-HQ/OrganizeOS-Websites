import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { rawTheme } from "@webstudio-is/design-system";
import { $builderMode } from "~/shared/nano-states";
import { createCommandsEmitter } from "~/shared/commands-emitter";
import {
  $openRailOverlay,
  hideRailOverlay,
} from "~/builder/features/rail-overlay/rail-overlay";
import {
  cleanupManager,
  manager,
  press,
  renderManager,
  setupVariables,
} from "./test-utils";
import { VariablesIcon } from "./variables-icon";

const railButton = () =>
  document.querySelector<HTMLButtonElement>('[data-rail-button="variables"]');

const overlay = () =>
  document.querySelector<HTMLElement>('[data-rail-overlay="variables"]');

beforeEach(() => {
  setupVariables();
});

afterEach(() => {
  cleanupManager();
});

describe("VariablesIcon", () => {
  test("is drawn on the 16px grid with a 1px currentColor stroke", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(createElement(VariablesIcon));
    });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("fill")).toBe("none");
    const shapes = Array.from(svg?.querySelectorAll("path, rect") ?? []);
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
        createElement(VariablesIcon, {
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

test("the rail button reads Variables and is pressed while open; the overlay's header says Variables", () => {
  renderManager();
  expect(railButton()?.getAttribute("aria-label")).toBe("Variables");
  expect(railButton()?.getAttribute("aria-pressed")).toBe("true");
  expect(overlay()?.style.display).toBe("block");
  expect(manager()?.textContent).toContain("Variables");
});

test.each(["content", "preview"] as const)(
  "no button in %s mode, and entering it closes the overlay",
  (mode) => {
    renderManager();
    act(() => {
      $builderMode.set(mode);
    });
    expect(railButton()).toBeNull();
    expect($openRailOverlay.get()).toBe(undefined);
  }
);

test("Backspace, Delete and 1 reach no builder command while open; undo and redo do", () => {
  const handlers = {
    undo: vi.fn(),
    redo: vi.fn(),
    testDelete: vi.fn(),
    testBreakpoint: vi.fn(),
  };
  const { subscribeCommands } = createCommandsEmitter({
    source: "variables-overlay-test",
    commands: [
      { name: "undo", defaultHotkeys: ["meta+z"], handler: handlers.undo },
      {
        name: "redo",
        defaultHotkeys: ["meta+shift+z"],
        handler: handlers.redo,
      },
      {
        name: "testDelete",
        defaultHotkeys: ["backspace", "delete"],
        handler: handlers.testDelete,
      },
      {
        name: "testBreakpoint",
        defaultHotkeys: ["1"],
        handler: handlers.testBreakpoint,
      },
    ],
  });
  const unsubscribe = subscribeCommands();
  try {
    renderManager();
    press("Backspace");
    press("Delete");
    press("1");
    press("z", manager(), { metaKey: true });
    press("z", manager(), { metaKey: true, shiftKey: true });
    expect(handlers.testDelete).not.toHaveBeenCalled();
    expect(handlers.testBreakpoint).not.toHaveBeenCalled();
    expect(handlers.undo).toHaveBeenCalledTimes(1);
    expect(handlers.redo).toHaveBeenCalledTimes(1);
  } finally {
    unsubscribe();
  }
});

test("an unreadable registry shows 'Reload to edit variables'", () => {
  setupVariables({ registry: { version: 2 } });
  renderManager();
  expect(manager()?.textContent).toContain("Reload to edit variables");
  cleanupManager();
  setupVariables({
    registry: { version: 1, collections: [], variables: [] },
  });
  renderManager();
  expect(manager()?.textContent).not.toContain("Reload to edit variables");
  cleanupManager();
  setupVariables();
  renderManager();
  expect(manager()?.textContent).not.toContain("Reload to edit variables");
});

test("the manager renders nothing inside the overlay while it is hidden", () => {
  renderManager();
  expect(manager()).not.toBeNull();
  act(() => {
    hideRailOverlay("variables");
  });
  expect(overlay()).not.toBeNull();
  expect(manager()).toBeNull();
});

test("at a narrow width every toolbar control keeps its label and stays inside the manager", () => {
  renderManager();
  const root = manager();
  if (root === null) {
    throw new Error("no manager");
  }
  // a narrow overlay: the collections column leaves the table little room
  root.style.width = "414px";
  const right = root.getBoundingClientRect().right;
  const toolbar = root.querySelector<HTMLElement>("[data-variables-toolbar]");
  const buttons = Array.from(
    toolbar?.querySelectorAll<HTMLElement>("button") ?? []
  ).filter((button) => button.textContent !== "");
  expect(buttons.map((button) => button.textContent)).toEqual([
    "Select",
    "New variable",
  ]);
  for (const control of toolbar?.querySelectorAll<HTMLElement>(
    "button, input"
  ) ?? []) {
    expect(
      control.getBoundingClientRect().right,
      control.textContent || control.getAttribute("placeholder") || ""
    ).toBeLessThanOrEqual(right + 0.5);
  }
  for (const button of buttons) {
    // the label is not cut: no part of the button is narrower than its text
    for (const part of [button, ...button.querySelectorAll<HTMLElement>("*")]) {
      expect(part.scrollWidth, button.textContent ?? "").toBeLessThanOrEqual(
        part.clientWidth + 1
      );
    }
  }
  expect(toolbar?.scrollWidth).toBeLessThanOrEqual(toolbar?.clientWidth ?? 0);
});
