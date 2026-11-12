import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import type { CssProperty } from "@webstudio-is/css-engine";
import type { RegistryVariable } from "@webstudio-is/project-build";
import { createCommandsEmitter } from "~/shared/commands-emitter";
import { serverSyncStore } from "~/shared/sync/sync-stores";
import { $openRailOverlay } from "~/builder/features/rail-overlay/rail-overlay";
import { root } from "~/builder/features/organizeos-panel/test-fixtures";
import { allDecls, boxStyle, css, registry, rootStyle, v } from "./test-stores";
import {
  BRAND_SIX,
  cleanupManager,
  manager,
  press,
  renderManager,
  rowNames,
  rowOf,
  setupVariables,
  undoDepth,
} from "./test-utils";
import { validateVariableValue } from "./value-types";

const entry = (
  cssName: string,
  type: RegistryVariable["type"],
  name: string,
  collectionId = "site"
): RegistryVariable => ({ cssName, collectionId, type, name });

const registryOf = (...variables: RegistryVariable[]) => ({
  version: 1,
  collections: [
    { id: "site", name: "Site", system: "site" },
    { id: "c1", name: "Spacing" },
  ],
  variables,
});

const color = (text: string) => {
  const result = validateVariableValue("color", text);
  if (result.ok === false) {
    throw new Error(result.error);
  }
  return result.value;
};

const menuItems = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    (item) => item.textContent
  );

const chooseMenuItem = async (label: string) => {
  const item = Array.from(
    document.querySelectorAll<HTMLElement>('[role="menuitem"]')
  ).find((element) => element.textContent === label);
  expect(item, label).toBeTruthy();
  await act(async () => userEvent.click(item!));
};

const actionsOf = (cssName: string) =>
  rowOf(cssName)?.querySelector<HTMLButtonElement>('[aria-label="Actions"]');

const openRowMenu = async (cssName: string) => {
  await act(async () => userEvent.click(actionsOf(cssName)!));
};

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

const dialogButton = (label: string) =>
  Array.from(dialog()?.querySelectorAll("button") ?? []).find(
    (button) => button.textContent === label
  );

const toolbarButton = (label: string) =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      "[data-variables-toolbar] button"
    )
  ).find((button) => button.textContent === label);

const checkboxOf = (cssName: string) =>
  rowOf(cssName)?.querySelector<HTMLButtonElement>('[role="checkbox"]');

const checked = () =>
  rowNames().filter(
    (cssName) => checkboxOf(cssName!)?.getAttribute("aria-checked") === "true"
  );

const startSelect = async () => {
  await act(async () => userEvent.click(toolbarButton("Select")!));
};

const selectCollection = async (id: string) => {
  await act(async () =>
    userEvent.click(document.querySelector(`[data-collection="${id}"]`)!)
  );
};

const brandBlue = {
  styles: css({ "--brand-blue": "#1597b0" }),
  registry: registryOf(entry("brand-blue", "color", "Brand Blue")),
};

const usedBlack = {
  styles: [
    ...css({ "--black": "#000000", "--gap": "8px" }),
    { on: "box", property: "color" as CssProperty, value: v("black") },
    {
      on: "box",
      property: "border-top-color" as CssProperty,
      value: v("black"),
    },
    { on: "box", property: "margin-top" as CssProperty, value: v("gap") },
  ],
  registry: registryOf(
    entry("black", "color", "Black"),
    entry("gap", "size", "Gap"),
    entry("unused", "size", "Unused")
  ),
};

beforeEach(() => {
  setupVariables();
});

afterEach(() => {
  cleanupManager();
  vi.restoreAllMocks();
});

test("the row menu offers Rename, Duplicate, Copy CSS name, Move to collection, Delete; Copy CSS name writes var(--brand-blue)", async () => {
  const writeText = vi.fn(() => Promise.resolve());
  vi.spyOn(navigator, "clipboard", "get").mockReturnValue({
    writeText,
  } as unknown as Clipboard);
  setupVariables(brandBlue);
  renderManager();
  await openRowMenu("brand-blue");
  expect(menuItems()).toEqual([
    "Rename",
    "Duplicate",
    "Copy CSS name",
    "Move to collection",
    "Delete",
  ]);
  await chooseMenuItem("Copy CSS name");
  expect(writeText).toHaveBeenCalledWith("var(--brand-blue)");
});

test("Duplicate adds 'Brand Blue copy' after it, same type and value; Move to collection moves it to Spacing", async () => {
  setupVariables(brandBlue);
  renderManager();
  await openRowMenu("brand-blue");
  await chooseMenuItem("Duplicate");
  expect(rowNames()).toEqual(["brand-blue", "brand-blue-copy"]);
  expect(registry().variables[1]).toEqual(
    entry("brand-blue-copy", "color", "Brand Blue copy")
  );
  expect(rootStyle("--brand-blue-copy")).toEqual(rootStyle("--brand-blue"));
  await openRowMenu("brand-blue-copy");
  await act(async () =>
    userEvent.hover(
      Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"]')
      ).find((item) => item.textContent === "Move to collection")!
    )
  );
  await vi.waitFor(() => expect(menuItems()).toContain("Spacing"));
  // into the submenu by keyboard: a pointer crossing to it trips its grace
  await act(async () => userEvent.keyboard("{ArrowRight}"));
  await vi.waitFor(() =>
    expect(document.activeElement?.textContent).toBe("Spacing")
  );
  await act(async () => userEvent.keyboard("{Enter}"));
  expect(
    registry().variables.find((item) => item.cssName === "brand-blue-copy")
      ?.collectionId
  ).toBe("c1");
});

test("an unused variable is deleted at once; Black, used twice, asks 'Delete Black?' 'Used in 2 places.'", async () => {
  setupVariables(usedBlack);
  // --unused is registered with no declaration: give it one
  setupVariables({
    ...usedBlack,
    styles: [...usedBlack.styles, ...css({ "--unused": "1px" })],
  });
  renderManager();
  await openRowMenu("unused");
  await chooseMenuItem("Delete");
  expect(dialog()).toBeNull();
  expect(rowOf("unused")).toBeNull();
  await openRowMenu("black");
  await chooseMenuItem("Delete");
  expect(dialog()?.textContent).toContain("Delete Black?");
  expect(dialog()?.textContent).toContain("Used in 2 places.");
});

test("Cancel keeps it; Delete removes it, its references take #000000, one undo step", async () => {
  setupVariables(usedBlack);
  renderManager();
  await openRowMenu("black");
  await chooseMenuItem("Delete");
  await act(async () => userEvent.click(dialogButton("Cancel")!));
  expect(rowOf("black")).not.toBeNull();
  expect(undoDepth()).toBe(0);
  await openRowMenu("black");
  await chooseMenuItem("Delete");
  await act(async () => userEvent.click(dialogButton("Delete")!));
  expect(rowOf("black")).toBeNull();
  expect(boxStyle("color")).toEqual(color("#000000"));
  expect(undoDepth()).toBe(1);
});

test("Escape in the delete dialog closes only the dialog", async () => {
  setupVariables(usedBlack);
  renderManager();
  await openRowMenu("black");
  await chooseMenuItem("Delete");
  expect(dialog()).not.toBeNull();
  await act(async () => userEvent.keyboard("{Escape}"));
  // onOpenChange runs a frame later
  await act(
    async () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  );
  expect(dialog()).toBeNull();
  expect($openRailOverlay.get()).toBe("variables");
});

test("Select: a checkbox per unlocked row; Shift-click selects the range; the header checkbox selects every visible row; a group header's its group", async () => {
  setupVariables({
    styles: [
      ...BRAND_SIX,
      ...css({
        "--a": "1px",
        "--b": "2px",
        "--c": "3px",
        "--space--x": "4px",
        "--space--y": "5px",
      }),
    ],
    registry: registryOf(
      entry("a", "size", "A"),
      entry("b", "size", "B"),
      entry("c", "size", "C"),
      entry("space--x", "size", "Space/X"),
      entry("space--y", "size", "Space/Y")
    ),
  });
  renderManager();
  await selectCollection("site");
  await startSelect();
  for (const cssName of ["a", "b", "c", "space--x", "space--y"]) {
    expect(checkboxOf(cssName), cssName).toBeTruthy();
  }
  await act(async () => userEvent.click(checkboxOf("a")!));
  // a click with Shift held
  await act(async () => userEvent.keyboard("{Shift>}"));
  await act(async () => userEvent.click(checkboxOf("c")!));
  await act(async () => userEvent.keyboard("{/Shift}"));
  expect(checked()).toEqual(["a", "b", "c"]);
  const header = document.querySelector<HTMLElement>(
    '[data-variables-header] [role="checkbox"]'
  );
  await act(async () => userEvent.click(header!));
  expect(checked()).toEqual(["a", "b", "c", "space--x", "space--y"]);
  await act(async () => userEvent.click(header!));
  expect(checked()).toEqual([]);
  await act(async () =>
    userEvent.click(
      document.querySelector<HTMLElement>(
        '[data-variable-group="Space"] [role="checkbox"]'
      )!
    )
  );
  expect(checked()).toEqual(["space--x", "space--y"]);
});

test("Escape leaves select mode and keeps the overlay open, also with focus on a row's Actions button", async () => {
  setupVariables(brandBlue);
  renderManager();
  await startSelect();
  expect(checkboxOf("brand-blue")).toBeTruthy();
  press("Escape", manager());
  expect(checkboxOf("brand-blue")).toBeFalsy();
  expect($openRailOverlay.get()).toBe("variables");
  await startSelect();
  act(() => actionsOf("brand-blue")!.focus());
  press("Escape", actionsOf("brand-blue"));
  expect(checkboxOf("brand-blue")).toBeFalsy();
  expect($openRailOverlay.get()).toBe("variables");
});

test("with focus on a row's Actions button, meta+z undoes the last edit and Escape closes the overlay", async () => {
  const { subscribeCommands } = createCommandsEmitter({
    source: "variables-rows-test",
    commands: [
      {
        name: "undo",
        defaultHotkeys: ["meta+z"],
        handler: () => serverSyncStore.undo(),
      },
    ],
  });
  const unsubscribe = subscribeCommands();
  try {
    setupVariables(usedBlack);
    renderManager();
    await openRowMenu("gap");
    await chooseMenuItem("Duplicate");
    expect(rowOf("gap-copy")).not.toBeNull();
    act(() => actionsOf("gap")!.focus());
    press("z", actionsOf("gap"), { metaKey: true });
    expect(rowOf("gap-copy")).toBeNull();
    press("Escape", actionsOf("gap"));
    expect($openRailOverlay.get()).toBe(undefined);
  } finally {
    unsubscribe();
  }
});

test("bulk Move to collection moves three rows to Spacing, one undo step", async () => {
  setupVariables({
    styles: css({ "--a": "1px", "--b": "2px", "--c": "3px" }),
    registry: registryOf(
      entry("a", "size", "A"),
      entry("b", "size", "B"),
      entry("c", "size", "C")
    ),
  });
  renderManager();
  await startSelect();
  for (const cssName of ["a", "b", "c"]) {
    await act(async () => userEvent.click(checkboxOf(cssName)!));
  }
  await act(async () => userEvent.click(toolbarButton("Move to collection")!));
  await chooseMenuItem("Spacing");
  expect(registry().variables.map((item) => item.collectionId)).toEqual([
    "c1",
    "c1",
    "c1",
  ]);
  expect(undoDepth()).toBe(1);
  expect(rowNames()).toEqual([]);
});

test("bulk Group 'Spacing' renames Gap to Spacing/Gap (--spacing--gap) and var(--gap) to var(--spacing--gap), one undo step", async () => {
  setupVariables(usedBlack);
  renderManager();
  await startSelect();
  await act(async () => userEvent.click(checkboxOf("gap")!));
  await act(async () => userEvent.click(toolbarButton("Group")!));
  const field = document.querySelector<HTMLInputElement>(
    'input[aria-label="Group name"]'
  );
  await act(async () => userEvent.fill(field!, "Spacing"));
  await act(async () => userEvent.keyboard("{Enter}"));
  expect(
    registry().variables.find((item) => item.cssName === "spacing--gap")?.name
  ).toBe("Spacing/Gap");
  expect(boxStyle("marginTop")).toEqual({
    type: "var",
    value: "spacing--gap",
  });
  expect(undoDepth()).toBe(1);
});

test("bulk Delete asks 'Delete 2 variables?' 'Used in 3 places.' and deletes both, one undo step", async () => {
  setupVariables(usedBlack);
  renderManager();
  await startSelect();
  await act(async () => userEvent.click(checkboxOf("black")!));
  await act(async () => userEvent.click(checkboxOf("gap")!));
  await act(async () => userEvent.click(toolbarButton("Delete")!));
  expect(dialog()?.textContent).toContain("Delete 2 variables?");
  expect(dialog()?.textContent).toContain("Used in 3 places.");
  await act(async () => userEvent.click(dialogButton("Delete")!));
  expect(rowOf("black")).toBeNull();
  expect(rowOf("gap")).toBeNull();
  expect(undoDepth()).toBe(1);
});

test("Brand lists Base, Accent 1, Accent 2, Text, Heading font, Body font; locked: no rename, no handle, no checkbox, menu Copy CSS name only", async () => {
  setupVariables({ styles: BRAND_SIX });
  renderManager();
  expect(
    Array.from(
      document.querySelectorAll<HTMLElement>("[data-name-cell]"),
      (cell) => cell.textContent
    )
  ).toEqual([
    "Base",
    "Accent 1",
    "Accent 2",
    "Text",
    "Heading font",
    "Body font",
  ]);
  expect(rowOf("base")?.querySelector("[data-id]")).toBeNull();
  await act(async () =>
    userEvent.dblClick(rowOf("base")!.querySelector("[data-name-cell]")!)
  );
  expect(
    rowOf("base")!
      .querySelector("[data-name-cell]")!
      .hasAttribute("contenteditable")
  ).toBe(false);
  expect(toolbarButton("Select")).toBeUndefined();
  await openRowMenu("base");
  expect(menuItems()).toEqual(["Copy CSS name"]);
});

test("a missing Accent 2 is an empty row in its place; '#ff0000' restores --accent-2 on Global Root's local source at base", async () => {
  setupVariables({
    styles: BRAND_SIX.filter((style) => style.property !== "--accent-2"),
  });
  renderManager();
  expect(rowNames()).toEqual([
    "base",
    "accent-1",
    "accent-2",
    "text",
    "font-heading",
    "font-body",
  ]);
  const input = rowOf("accent-2")!.querySelector<HTMLInputElement>(
    "[data-value-cell] input"
  )!;
  expect(input.value).toBe("");
  await act(async () => userEvent.fill(input, "#ff0000"));
  await act(async () => userEvent.keyboard("{Enter}"));
  expect(rootStyle("--accent-2")).toEqual(color("#ff0000"));
});

test("the contrast line shows 'Base on Accent 1 3.4:1' only while the pair fails, resolving --accent-1: var(--teal)", async () => {
  setupVariables({
    styles: [
      ...BRAND_SIX.filter((style) => style.property !== "--accent-1"),
      ...css({ "--teal": "#1597b0" }),
      { on: root, property: "--accent-1" as CssProperty, value: v("teal") },
    ],
  });
  renderManager();
  const line = () =>
    document.querySelector<HTMLElement>("[data-brand-contrast]");
  expect(line()?.textContent).toBe("Base on Accent 1 3.4:1");
  await selectCollection("site");
  const input = rowOf("teal")!.querySelector<HTMLInputElement>(
    "[data-value-cell] input"
  );
  await act(async () => userEvent.fill(input!, "#0b5394"));
  await act(async () => userEvent.keyboard("{Enter}"));
  await selectCollection("brand");
  expect(line()).toBeNull();
});

test("an alias to a deleted name and a two-variable cycle render empty swatches, the line ignores them, nothing throws", async () => {
  setupVariables({
    styles: [
      ...BRAND_SIX.filter((style) => style.property !== "--accent-1"),
      { on: root, property: "--accent-1" as CssProperty, value: v("gone") },
      { on: root, property: "--a" as CssProperty, value: v("b") },
      { on: root, property: "--b" as CssProperty, value: v("a") },
    ],
    registry: registryOf(entry("a", "color", "A"), entry("b", "color", "B")),
  });
  renderManager();
  expect(
    rowOf("accent-1")?.querySelector('[data-swatch="empty"]')
  ).not.toBeNull();
  expect(document.querySelector("[data-brand-contrast]")).toBeNull();
  await selectCollection("site");
  for (const cssName of ["a", "b"]) {
    expect(
      rowOf(cssName)?.querySelector('[data-swatch="empty"]'),
      cssName
    ).not.toBeNull();
  }
  expect(allDecls().length).toBeGreaterThan(0);
});
