import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import type { CssProperty } from "@webstudio-is/css-engine";
import type { RegistryVariable } from "@webstudio-is/project-build";
import { $openRailOverlay } from "~/builder/features/rail-overlay/rail-overlay";
import { root } from "~/builder/features/organizeos-panel/test-fixtures";
import { boxStyle, css, registry, rootStyle, v } from "./test-stores";
import {
  BRAND_SIX,
  cleanupManager,
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

const siteOf = (...variables: RegistryVariable[]) => ({
  version: 1,
  collections: [{ id: "site", name: "Site", system: "site" }],
  variables,
});

const valid = (
  type: Parameters<typeof validateVariableValue>[0],
  text: string
) => {
  const result = validateVariableValue(type, text);
  if (result.ok === false) {
    throw new Error(result.error);
  }
  return result.value;
};

const toolbarButton = (label: string) =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      "[data-variables-toolbar] button"
    )
  ).find((button) => button.textContent === label);

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

const draftInput = () =>
  document.querySelector<HTMLInputElement>("[data-variable-draft] input");

const valueCell = (cssName: string) =>
  rowOf(cssName)?.querySelector<HTMLElement>("[data-value-cell]");

const valueInput = (cssName: string) =>
  valueCell(cssName)?.querySelector<HTMLInputElement>("input");

const nameCell = (cssName: string) =>
  rowOf(cssName)?.querySelector<HTMLElement>("[data-name-cell]");

const searchInput = () =>
  document.querySelector<HTMLInputElement>(
    'input[placeholder="Search variables"]'
  );

const type = async (input: HTMLInputElement, text: string) => {
  await act(async () => userEvent.fill(input, text));
  await act(async () => userEvent.keyboard("{Enter}"));
};

const startRename = async (cssName: string) => {
  await act(async () => userEvent.dblClick(nameCell(cssName)!));
  await vi.waitFor(() => {
    expect(document.activeElement).toBe(nameCell(cssName));
  });
};

const newVariable = async (label: string) => {
  await act(async () => userEvent.click(toolbarButton("New variable")!));
  await chooseMenuItem(label);
};

beforeEach(() => {
  setupVariables();
});

afterEach(() => {
  cleanupManager();
});

test("New variable lists Color, Size, Percentage, Number, Font family; Color adds a draft row, name focused; Enter writes --color #000000 to Global Root and registers it in the selected collection, one undo step", async () => {
  renderManager();
  await act(async () => userEvent.click(toolbarButton("New variable")!));
  expect(menuItems()).toEqual([
    "Color",
    "Size",
    "Percentage",
    "Number",
    "Font family",
  ]);
  await chooseMenuItem("Color");
  await vi.waitFor(() => {
    expect(document.activeElement).toBe(draftInput());
  });
  expect(draftInput()?.value).toBe("Color");
  await act(async () => userEvent.keyboard("{Enter}"));
  expect(rootStyle("--color")).toEqual(valid("color", "#000000"));
  expect(registry().variables).toEqual([entry("color", "color", "Color")]);
  expect(undoDepth()).toBe(1);
  expect(draftInput()).toBeNull();
});

test.each([
  ["Size", "size", "16px"],
  ["Percentage", "percentage", "100%"],
  ["Number", "number", "1"],
] as const)("New %s defaults to %s", async (label, cssName, text) => {
  renderManager();
  await newVariable(label);
  await act(async () => userEvent.keyboard("{Enter}"));
  expect(rootStyle(`--${cssName}`)).toEqual(valid(cssName, text));
});

test("Font family defaults to the body font's first family, Public Sans; with no --font-body, System UI (system-ui, sans-serif)", async () => {
  setupVariables({ styles: BRAND_SIX });
  renderManager();
  // Brand is selected first, and takes no new variable
  await act(async () =>
    userEvent.click(document.querySelector('[data-collection="site"]')!)
  );
  await newVariable("Font family");
  await act(async () => userEvent.keyboard("{Enter}"));
  expect(rootStyle("--font-family")).toEqual(
    valid("fontFamily", "Public Sans")
  );
  cleanupManager();

  setupVariables();
  renderManager();
  await newVariable("Font family");
  await act(async () => userEvent.keyboard("{Enter}"));
  expect(rootStyle("--font-family")).toEqual(valid("fontFamily", "System UI"));
});

test("a colour edit '#ff0000' + Enter is one undo step; 'nope' shows the error tooltip and writes nothing", async () => {
  setupVariables({
    styles: css({ "--brand-blue": "#1597b0" }),
    registry: siteOf(entry("brand-blue", "color", "Brand Blue")),
  });
  renderManager();
  await type(valueInput("brand-blue")!, "#ff0000");
  expect(rootStyle("--brand-blue")).toEqual(valid("color", "#ff0000"));
  expect(undoDepth()).toBe(1);
  await type(valueInput("brand-blue")!, "nope");
  expect(document.body.textContent).toContain("Invalid color");
  expect(rootStyle("--brand-blue")).toEqual(valid("color", "#ff0000"));
  expect(undoDepth()).toBe(1);
});

test("a Size of -8 rem writes -8rem", async () => {
  setupVariables({
    styles: css({ "--gap": "8px" }),
    registry: siteOf(entry("gap", "size", "Gap")),
  });
  renderManager();
  await type(valueInput("gap")!, "-8");
  const unit = valueCell("gap")!.querySelector<HTMLElement>(
    '[aria-label="Unit"]'
  );
  await act(async () => userEvent.click(unit!));
  const rem = Array.from(
    document.querySelectorAll<HTMLElement>('[role="option"]')
  ).find((option) => option.textContent === "rem");
  await act(async () => userEvent.click(rem!));
  expect(rootStyle("--gap")).toEqual({ type: "unit", value: -8, unit: "rem" });
});

test("renaming Old Blue to Brand Blue makes --brand-blue and rewrites a bound color: var(--old-blue)", async () => {
  setupVariables({
    styles: [
      ...css({ "--old-blue": "#0000ff" }),
      { on: "box", property: "color" as CssProperty, value: v("old-blue") },
    ],
    registry: siteOf(entry("old-blue", "color", "Old Blue")),
  });
  renderManager();
  await startRename("old-blue");
  await act(async () => userEvent.keyboard("Brand Blue{Enter}"));
  expect(rootStyle("--brand-blue")).toEqual(valid("color", "#0000ff"));
  expect(boxStyle("color")).toEqual({ type: "var", value: "brand-blue" });
});

test("a grouped row reads its leaf under the group header; its edit field holds the full name", async () => {
  setupVariables({
    styles: css({ "--spacing--large": "32px" }),
    registry: siteOf(entry("spacing--large", "size", "Spacing/Large")),
  });
  renderManager();
  expect(
    document.querySelector('[data-variable-group="Spacing"]')
  ).not.toBeNull();
  expect(nameCell("spacing--large")?.textContent).toBe("Large");
  await startRename("spacing--large");
  expect(nameCell("spacing--large")?.textContent).toBe("Spacing/Large");
});

test("search by name, by '#f00' and by 'red' filters the rows; clearing restores them", async () => {
  setupVariables({
    styles: css({ "--accent": "#ff0000", "--gap": "8px", "--teal": "#1597b0" }),
    registry: siteOf(
      entry("accent", "color", "Accent"),
      entry("gap", "size", "Gap"),
      entry("teal", "color", "Teal")
    ),
  });
  renderManager();
  expect(rowNames()).toEqual(["accent", "gap", "teal"]);
  await act(async () => userEvent.fill(searchInput()!, "gap"));
  expect(rowNames()).toEqual(["gap"]);
  await act(async () => userEvent.fill(searchInput()!, "#f00"));
  expect(rowNames()).toEqual(["accent"]);
  await act(async () => userEvent.fill(searchInput()!, "red"));
  expect(rowNames()).toEqual(["accent"]);
  await act(async () => userEvent.fill(searchInput()!, ""));
  expect(rowNames()).toEqual(["accent", "gap", "teal"]);
});

test("Link to variable lists same-type variables but not the row or one that would cycle; picking writes var(); the cell shows the target's name; Unlink writes its resolved value", async () => {
  setupVariables({
    styles: [
      ...css({ "--x": "#000000", "--z": "#ffffff", "--gap": "8px" }),
      { on: root, property: "--y" as CssProperty, value: v("x") },
    ],
    registry: siteOf(
      entry("x", "color", "X"),
      entry("y", "color", "Y"),
      entry("z", "color", "Z"),
      entry("gap", "size", "Gap")
    ),
  });
  renderManager();
  const openValueMenu = async () =>
    act(async () =>
      userEvent.click(
        valueCell("x")!.querySelector<HTMLElement>(
          '[aria-label="Value actions"]'
        )!
      )
    );
  await openValueMenu();
  await chooseMenuItem("Link to variable");
  const targets = () =>
    Array.from(
      document.querySelectorAll<HTMLElement>("[data-link-target]"),
      (target) => target.textContent
    );
  expect(targets()).toEqual(["Z"]);
  await act(async () =>
    userEvent.click(document.querySelector<HTMLElement>("[data-link-target]")!)
  );
  expect(rootStyle("--x")).toEqual({ type: "var", value: "z" });
  expect(valueCell("x")?.textContent).toContain("Z");
  await openValueMenu();
  await chooseMenuItem("Unlink");
  expect(rootStyle("--x")).toEqual(valid("color", "#ffffff"));
});

test("ArrowDown moves focus to the next row; Alt+ArrowDown moves it down in the registry, one undo step", async () => {
  setupVariables({
    styles: css({ "--a": "1px", "--b": "2px", "--c": "3px" }),
    registry: siteOf(
      entry("a", "size", "A"),
      entry("b", "size", "B"),
      entry("c", "size", "C")
    ),
  });
  renderManager();
  act(() => rowOf("a")!.focus());
  await act(async () => userEvent.keyboard("{ArrowDown}"));
  expect(document.activeElement).toBe(rowOf("b"));
  act(() => rowOf("a")!.focus());
  await act(async () => userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}"));
  expect(registry().variables.map((item) => item.cssName)).toEqual([
    "b",
    "a",
    "c",
  ]);
  expect(undoDepth()).toBe(1);
});

test("rows render with content-visibility: auto", () => {
  setupVariables({ styles: css({ "--a": "1px" }) });
  renderManager();
  expect(getComputedStyle(rowOf("a")!).contentVisibility).toBe("auto");
});

test.each(["the colour picker", "the font combobox", "the link menu"])(
  "Escape inside %s closes only it",
  async (popup) => {
    setupVariables({
      styles: css({ "--accent": "#ff0000", "--face": '"Public Sans"' }),
      registry: siteOf(
        entry("accent", "color", "Accent"),
        entry("face", "fontFamily", "Face")
      ),
    });
    renderManager();
    if (popup === "the colour picker") {
      await act(async () =>
        userEvent.click(
          valueCell("accent")!.querySelector<HTMLElement>("button")!
        )
      );
      expect(
        document.querySelector("[data-radix-popper-content-wrapper]")
      ).not.toBeNull();
      await act(async () => userEvent.keyboard("{Escape}"));
      expect(
        document.querySelector("[data-radix-popper-content-wrapper]")
      ).toBeNull();
    }
    if (popup === "the font combobox") {
      await act(async () => userEvent.click(valueInput("face")!));
      await act(async () => userEvent.keyboard("{ArrowDown}"));
      // the collections column is a listbox too
      const fontOptions = () =>
        document.querySelectorAll(
          '[role="listbox"]:not([aria-label="Collections"]) [role="option"]'
        );
      expect(fontOptions().length).toBeGreaterThan(0);
      await act(async () => userEvent.keyboard("{Escape}"));
      expect(fontOptions()).toHaveLength(0);
    }
    if (popup === "the link menu") {
      await act(async () =>
        userEvent.click(
          valueCell("accent")!.querySelector<HTMLElement>(
            '[aria-label="Value actions"]'
          )!
        )
      );
      expect(document.querySelector('[role="menu"]')).not.toBeNull();
      await act(async () => userEvent.keyboard("{Escape}"));
      expect(document.querySelector('[role="menu"]')).toBeNull();
    }
    expect($openRailOverlay.get()).toBe("variables");
  }
);

test("500 variables: 500 rows render, 'v-42' leaves 11, an edit commits as one undo step", async () => {
  setupVariables({
    styles: css(
      Object.fromEntries(
        Array.from({ length: 500 }, (_, index) => [
          `--v-${index}`,
          `${index}px`,
        ])
      )
    ),
  });
  renderManager();
  expect(rowNames()).toHaveLength(500);
  await act(async () => userEvent.fill(searchInput()!, "v-42"));
  expect(rowNames()).toHaveLength(11);
  await type(valueInput("v-42")!, "7");
  expect(rootStyle("--v-42")).toEqual({ type: "unit", value: 7, unit: "px" });
  expect(undoDepth()).toBe(1);
});

test("a view permit, or an unreadable registry: no New variable, no Select, every field read-only", async () => {
  for (const setup of [
    () =>
      setupVariables({
        styles: css({ "--accent": "#ff0000", "--gap": "8px" }),
        permit: "view",
      }),
    () =>
      setupVariables({
        styles: css({ "--accent": "#ff0000", "--gap": "8px" }),
        registry: { version: 2 },
      }),
  ]) {
    setup();
    renderManager();
    expect(toolbarButton("New variable")).toBeUndefined();
    expect(toolbarButton("Select")).toBeUndefined();
    const fields = Array.from(
      document.querySelectorAll<HTMLInputElement>("[data-variable-row] input")
    );
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.readOnly || field.disabled).toBe(true);
    }
    expect(
      document.querySelector('[data-variable-row] [aria-label="Value actions"]')
    ).toBeNull();
    await act(async () => userEvent.dblClick(nameCell("accent")!));
    expect(nameCell("accent")?.hasAttribute("contenteditable")).toBe(false);
    cleanupManager();
  }
});
