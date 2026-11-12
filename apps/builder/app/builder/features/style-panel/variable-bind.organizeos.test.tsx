// OrganizeOS fork: the variable "+" in the Style panel (docs/ORGANIZEOS-FORK.md section 7).
import { createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { TooltipProvider } from "@webstudio-is/design-system";
import { toValue, type CssProperty } from "@webstudio-is/css-engine";
import { ROOT_INSTANCE_ID, getStyleDeclKey } from "@webstudio-is/sdk";
import { readVariablesRegistry } from "@webstudio-is/project-build";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
import {
  $selectedBreakpointId,
  $selectedInstanceRenderState,
  $selectedStyleSources,
  $selectedStyleState,
  selectInstance,
} from "~/shared/nano-states";
import {
  $projectSettings,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import { $ephemeralStyles } from "~/canvas/stores";
import { setSetting } from "~/builder/shared/client-settings";
import { getComputedStyleDecl } from "~/shared/style-object-model";
import {
  registerTestMetas,
  type TestStyle,
} from "~/builder/features/organizeos-panel/test-fixtures";
import {
  localSourceOf,
  project,
  undoDepth,
} from "~/builder/features/variables/test-stores";
import { $styleObjectModel } from "./shared/model";
import { ReadonlyProvider } from "./shared/readonly";
import { PropertyLabel } from "./property-label";
import { StylePanel } from "./style-panel";
import { InputPopover } from "./sections/shared/input-popover";

enableMapSet();
registerContainers();

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Radix's ScrollArea observes its viewport.
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let reactRoot: Root | undefined;
let container: HTMLElement | undefined;

const render = (element: ReactNode) => {
  // The browser runner keeps each finished test file's frame in its page, so
  // a later file's frame can sit below the fold, where the picker (position:
  // fixed) cannot be scrolled into view for a click.
  window.frameElement?.scrollIntoView({ block: "start", inline: "start" });
  container = document.createElement("div");
  document.body.appendChild(container);
  reactRoot = createRoot(container);
  act(() => {
    reactRoot?.render(createElement(TooltipProvider, null, element));
  });
  return container;
};

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  registerTestMetas();
  selectInstance(undefined);
  $selectedStyleSources.set(new Map());
  $selectedStyleState.set(undefined);
});

afterEach(() => {
  act(() => {
    reactRoot?.unmount();
  });
  container?.remove();
  reactRoot = undefined;
  container = undefined;
  vi.unstubAllGlobals();
  $selectedInstanceRenderState.set("notMounted");
  $ephemeralStyles.set([]);
});

const rootVariables: TestStyle[] = [
  ["--brand", "#1597b0"],
  ["--layer", "2"],
  ["--ratio", "1.5"],
  ["--gap", "8px"],
  ["--half", "50%"],
].map(([property, value]) => ({
  on: ROOT_INSTANCE_ID,
  property: property as CssProperty,
  value,
}));

/**
 * The plan's store setup: body > box, flex on the body, the five root
 * variables, Brand registered in Site, the box selected.
 */
const setup = ({
  styles = [],
  token = false,
  breakpoint = "base",
  state,
}: {
  styles?: TestStyle[];
  token?: boolean;
  breakpoint?: string;
  state?: string;
} = {}) => {
  registerTestMetas();
  project({
    styles: [
      { on: "box", property: "width", value: "10px" },
      { on: "body", property: "display", value: "flex" },
      ...rootVariables,
      ...styles,
    ],
    tokens: token ? [{ id: "token1", name: "Primary", on: ["box"] }] : [],
  });
  $selectedBreakpointId.set(breakpoint);
  $projectSettings.set({
    meta: {},
    compiler: {},
    organizeos: {
      variables: {
        version: 1,
        collections: [{ id: "site", name: "Site", system: "site" }],
        variables: [
          {
            cssName: "brand",
            collectionId: "site",
            type: "color",
            name: "Brand",
          },
        ],
      },
    },
  });
  selectInstance(["box", "body"]);
  $selectedStyleSources.set(
    token ? new Map([["box", "token1"]]) : new Map<string, string>()
  );
  $selectedStyleState.set(state);
};

const label = (labelText: string, properties: CssProperty[]) =>
  createElement(PropertyLabel, {
    label: labelText,
    properties: properties as [CssProperty, ...CssProperty[]],
  });

const trigger = (properties: string[]) =>
  document.querySelector<HTMLElement>(
    `[data-variable-bind="${properties.join(" ")}"]`
  );

// The picker, not a per-side popover (Radix gives both role="dialog").
const dialog = () =>
  document.querySelector<HTMLElement>("[data-variable-picker]");

const openPicker = async (properties: string[]) => {
  await act(async () => userEvent.click(trigger(properties)!));
  // the design system's Dialog opens a frame after the click
  await vi.waitFor(() => {
    expect(dialog()).not.toBeNull();
  });
};

const options = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-variable-option]"),
    (option) => option.dataset.variableOption
  );

const option = (cssName: string) =>
  document.querySelector<HTMLElement>(`[data-variable-option="${cssName}"]`);

const button = (text: string) =>
  Array.from(dialog()?.querySelectorAll("button") ?? []).find(
    (item) => item.textContent === text
  );

const decl = (key: string) => $styles.get().get(key);

const boxDecl = (property: string) =>
  decl(
    getStyleDeclKey({
      styleSourceId: "local-box",
      breakpointId: "base",
      property: property as never,
    })
  );

const computed = (property: CssProperty) =>
  getComputedStyleDecl({
    model: $styleObjectModel.get(),
    // the panel's path, which ends at Global Root, where variables live
    instanceSelector: ["box", "body", ROOT_INSTANCE_ID],
    property,
  }).computedValue;

test('the "+" shows on the rows of spec 6.2 and on none of 6.3', () => {
  setup({
    styles: [{ on: "box", property: "outline-style", value: "solid" }],
  });
  $selectedInstanceRenderState.set("mounted");
  setSetting("stylePanelMode", "default");
  render(createElement(StylePanel));
  const attrs = Array.from(
    document.querySelectorAll<HTMLElement>("[data-variable-bind]"),
    (item) => item.dataset.variableBind
  );
  const sides = (pattern: string) =>
    ["top", "right", "bottom", "left"].map((side) =>
      pattern.replace("*", side)
    );
  expect(attrs).toEqual(
    expect.arrayContaining([
      "width",
      "height",
      "min-width",
      "min-height",
      "max-width",
      "max-height",
      "font-family",
      "color",
      "font-size",
      "line-height",
      "letter-spacing",
      "background-color",
      "outline-color",
      "outline-width",
      "outline-offset",
      "z-index",
      "order",
      sides("border-*-color").join(" "),
      "border-top-width border-right-width border-left-width border-bottom-width",
      "border-top-left-radius border-top-right-radius border-bottom-left-radius border-bottom-right-radius",
    ])
  );
  for (const excluded of [
    "display",
    "aspect-ratio",
    "overflow-x overflow-y",
    "font-weight",
    "outline-style",
    "position",
    "flex-grow flex-shrink flex-basis",
    "align-self",
    sides("border-*-style").join(" "),
  ]) {
    expect(attrs, excluded).not.toContain(excluded);
  }
});

test("picking a variable writes to the selected source, breakpoint and state, in one undo step", async () => {
  setup({ token: true, breakpoint: "tablet", state: ":hover" });
  render(label("Color", ["color"]));
  const before = undoDepth();
  await openPicker(["color"]);
  await act(async () => userEvent.click(option("brand")!));
  const key = getStyleDeclKey({
    styleSourceId: "token1",
    breakpointId: "tablet",
    property: "color",
    state: ":hover",
  });
  expect(decl(key)?.value).toEqual({ type: "var", value: "brand" });
  expect(dialog()).toBeNull();
  expect(undoDepth()).toBe(before + 1);
  act(() => serverSyncStore.undo());
  expect(decl(key)).toBe(undefined);
});

test("hovering an option previews it and leaving clears the preview", async () => {
  setup();
  render(label("Color", ["color"]));
  await openPicker(["color"]);
  const styles = $styles.get();
  await act(async () => userEvent.hover(option("brand")!));
  expect($ephemeralStyles.get()).toEqual([
    expect.objectContaining({
      styleSourceId: "local-box",
      breakpointId: "base",
      property: "color",
      value: { type: "var", value: "brand" },
    }),
  ]);
  await act(async () => userEvent.unhover(option("brand")!));
  expect($ephemeralStyles.get()).toEqual([]);
  expect($styles.get()).toBe(styles);
});

test("the picker offers the row's types and only integer Numbers on z-index and order", async () => {
  setup();
  const cases: Array<[CssProperty, string[]]> = [
    ["width", ["gap", "half"]],
    ["line-height", ["layer", "ratio", "gap", "half"]],
    ["z-index", ["layer"]],
    ["order", ["layer"]],
  ];
  for (const [property, expected] of cases) {
    render(label(property, [property]));
    await openPicker([property]);
    expect(options(), property).toEqual(expected);
    expect(dialog()?.textContent).toContain("Site");
    if (property === "width") {
      const search = dialog()!.querySelector<HTMLInputElement>(
        'input[placeholder="Search variables"]'
      )!;
      await act(async () => userEvent.fill(search, "half"));
      expect(options()).toEqual(["half"]);
    }
    act(() => {
      reactRoot?.unmount();
    });
    container?.remove();
  }
});

test("a per-side popover binds its one side, and the picker survives inside it", async () => {
  setup();
  const onClose = vi.fn();
  render(
    createElement(InputPopover, {
      styleSource: "default",
      property: "margin-top",
      value: { type: "unit", unit: "px", value: 0 },
      getActiveProperties: (): CssProperty[] => ["margin-top"],
      isOpen: true,
      onClose,
    })
  );
  await openPicker(["margin-top"]);
  const search = dialog()!.querySelector<HTMLInputElement>(
    'input[placeholder="Search variables"]'
  )!;
  await act(async () => userEvent.click(search));
  expect(onClose).not.toHaveBeenCalled();
  expect(trigger(["margin-top"])).not.toBeNull();
  await act(async () => userEvent.click(option("gap")!));
  expect(boxDecl("marginTop")?.value).toEqual({ type: "var", value: "gap" });
  for (const side of ["marginRight", "marginBottom", "marginLeft"]) {
    expect(boxDecl(side), side).toBe(undefined);
  }
  expect(onClose).not.toHaveBeenCalled();
});

test("New variable from this value creates a Site variable and binds it, in one undo step", async () => {
  setup({ styles: [{ on: "box", property: "color", value: "#ff0000" }] });
  render(label("Color", ["color"]));
  const styles = $styles.get();
  const settings = $projectSettings.get();
  const before = undoDepth();
  await openPicker(["color"]);
  await act(async () =>
    userEvent.click(button("New variable from this value")!)
  );
  const nameField = dialog()!.querySelector<HTMLInputElement>(
    'input[aria-label="Name"]'
  )!;
  const valueField = dialog()!.querySelector<HTMLInputElement>(
    'input[aria-label="Value"]'
  )!;
  const colour = toValue(computed("color"));
  expect(valueField.value).toBe(colour);
  await act(async () => userEvent.fill(nameField, "Brand red"));
  await act(async () => userEvent.click(button("Create")!));
  const rootDecl = Array.from($styles.get().values()).find(
    (item) => item.property === "--brand-red"
  );
  expect(rootDecl?.styleSourceId).toBe(localSourceOf(ROOT_INSTANCE_ID));
  expect(toValue(rootDecl!.value)).toBe(colour);
  expect(boxDecl("color")?.value).toEqual({
    type: "var",
    value: "brand-red",
  });
  const registry = readVariablesRegistry($projectSettings.get()?.organizeos);
  expect(
    registry.status === "readable"
      ? registry.registry.variables.at(-1)
      : undefined
  ).toEqual({
    cssName: "brand-red",
    collectionId: "site",
    type: "color",
    name: "Brand red",
  });
  expect(undoDepth()).toBe(before + 1);
  act(() => serverSyncStore.undo());
  expect($styles.get()).toEqual(styles);
  expect($projectSettings.get()).toEqual(settings);
});

test("New variable from this value refuses a fractional Number on z-index", async () => {
  setup();
  render(label("Z index", ["z-index"]));
  const styles = $styles.get();
  const settings = $projectSettings.get();
  const before = undoDepth();
  await openPicker(["z-index"]);
  await act(async () =>
    userEvent.click(button("New variable from this value")!)
  );
  const field = (name: string) =>
    dialog()!.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`)!;
  await act(async () => userEvent.fill(field("Name"), "Layer half"));
  await act(async () => userEvent.fill(field("Value"), "1.5"));
  await act(async () => userEvent.click(button("Create")!));
  expect(document.body.textContent).toContain("Use a whole number");
  expect(button("Create")).toBeDefined();
  expect($styles.get()).toBe(styles);
  expect($projectSettings.get()).toBe(settings);
  expect(undoDepth()).toBe(before);
});

test("a bound row shows the dot, named in its tooltip, and Detach writes the computed value", async () => {
  setup({
    styles: [{ on: "box", property: "color", value: "var(--brand)" }],
  });
  render(label("Color", ["color"]));
  expect(trigger(["color"])?.dataset.variant).toBe("bound");
  await act(async () => userEvent.hover(trigger(["color"])!));
  await vi.waitFor(() => {
    expect(
      document.querySelector("[data-radix-popper-content-wrapper]")?.textContent
    ).toContain("Brand");
  });
  const before = undoDepth();
  await openPicker(["color"]);
  expect(button("Edit variable")).toBeDefined();
  expect(button("Detach")).toBeDefined();
  await act(async () => userEvent.click(button("Detach")!));
  expect(boxDecl("color")?.value.type).not.toBe("var");
  expect(toValue(boxDecl("color")!.value)).toBe("#1597b0");
  expect(undoDepth()).toBe(before + 1);
});

test("a binding to a variable not listed is named by its CSS name; one declared nowhere offers Detach, which writes what it computes to", async () => {
  setup({
    styles: [
      { on: "body", property: "--legacy" as CssProperty, value: "#000000" },
      { on: "box", property: "color", value: "var(--legacy)" },
    ],
  });
  render(label("Color", ["color"]));
  await act(async () => userEvent.hover(trigger(["color"])!));
  await vi.waitFor(() => {
    expect(
      document.querySelector("[data-radix-popper-content-wrapper]")?.textContent
    ).toContain("--legacy");
  });
  act(() => {
    reactRoot?.unmount();
  });
  container?.remove();

  setup({
    styles: [{ on: "box", property: "color", value: "var(--missing)" }],
  });
  render(label("Color", ["color"]));
  const fallback = computed("color");
  await openPicker(["color"]);
  expect(button("Edit variable")).toBe(undefined);
  await act(async () => userEvent.click(button("Detach")!));
  expect(boxDecl("color")?.value).toEqual(fallback);
});

test("Edit variable writes the root value", async () => {
  setup({
    styles: [{ on: "box", property: "color", value: "var(--brand)" }],
  });
  render(label("Color", ["color"]));
  await openPicker(["color"]);
  await act(async () => userEvent.click(button("Edit variable")!));
  const valueField = dialog()!.querySelector<HTMLInputElement>(
    "[data-value-cell] input"
  )!;
  await act(async () => userEvent.fill(valueField, "#000000"));
  await act(async () => userEvent.keyboard("{Enter}"));
  const rootDecl = Array.from($styles.get().values()).find(
    (item) =>
      item.property === "--brand" &&
      item.styleSourceId === localSourceOf(ROOT_INSTANCE_ID)
  );
  expect(toValue(rootDecl!.value)).toBe("#000000");
  expect(boxDecl("color")?.value).toEqual({ type: "var", value: "brand" });
});

test("nothing renders when read-only, on a locked token, or on a row with no type", () => {
  setup();
  const host = render(
    createElement(ReadonlyProvider, { value: true }, label("Color", ["color"]))
  );
  expect(host.textContent).toContain("Color");
  expect(host.querySelector("[data-variable-bind]")).toBeNull();
  act(() => {
    reactRoot?.unmount();
  });
  container?.remove();

  setup({ token: true });
  $styleSources.set(
    new Map(
      Array.from($styleSources.get(), ([id, source]) => [
        id,
        id === "token1" && source.type === "token"
          ? { ...source, locked: true }
          : source,
      ])
    )
  );
  const locked = render(label("Color", ["color"]));
  expect(locked.textContent).toContain("Color");
  expect(locked.querySelector("[data-variable-bind]")).toBeNull();
  act(() => {
    reactRoot?.unmount();
  });
  container?.remove();

  setup();
  const display = render(label("Display", ["display"]));
  expect(display.textContent).toContain("Display");
  expect(display.querySelector("[data-variable-bind]")).toBeNull();
});
