import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import type { CssProperty } from "@webstudio-is/css-engine";
import {
  $openRailOverlay,
  hideRailOverlay,
  openRailOverlay,
} from "~/builder/features/rail-overlay/rail-overlay";
import { css, v } from "./test-stores";
import {
  BRAND_SIX,
  cleanupManager,
  renderManager,
  setupVariables,
} from "./test-utils";
import { writeSelectedCollection } from "./collection-memory";

const three = {
  version: 1,
  collections: [
    { id: "site", name: "Site", system: "site" },
    { id: "c1", name: "Spacing" },
    { id: "c2", name: "Motion" },
  ],
  variables: [
    { cssName: "gap", collectionId: "c1", type: "size", name: "Gap" },
    { cssName: "pad", collectionId: "c1", type: "size", name: "Pad" },
  ],
};

const usedTwice = [
  ...css({ "--gap": "8px", "--pad": "4px" }),
  { on: "box", property: "margin-top" as CssProperty, value: v("gap") },
  { on: "box", property: "padding-top" as CssProperty, value: v("gap") },
  { on: "box", property: "row-gap" as CssProperty, value: v("pad") },
];

const collection = (id: string) =>
  document.querySelector<HTMLElement>(`[data-collection="${id}"]`);

const collectionIds = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-collection]"),
    (item) => item.dataset.collection
  );

const collectionNames = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-collection]"),
    (item) => item.textContent
  );

const selected = () =>
  document.querySelector<HTMLElement>('[data-collection][aria-selected="true"]')
    ?.dataset.collection;

const newCollectionButton = () =>
  document.querySelector<HTMLButtonElement>('[aria-label="New collection"]');

const nameField = () =>
  document.querySelector<HTMLInputElement>("[data-collections-column] input");

const openMenu = async (id: string) => {
  const trigger = collection(id)?.querySelector<HTMLElement>(
    '[aria-label="Actions"]'
  );
  expect(trigger, `the Actions button of ${id}`).toBeTruthy();
  await act(async () => userEvent.click(trigger!));
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

beforeEach(() => {
  setupVariables();
});

afterEach(() => {
  cleanupManager();
});

test("lists Brand, Site, then the designer's collections in registry order; without the six, Site first", () => {
  setupVariables({ styles: BRAND_SIX, registry: three });
  renderManager();
  expect(collectionIds()).toEqual(["brand", "site", "c1", "c2"]);
  expect(collectionNames()).toEqual(["Brand", "Site", "Spacing", "Motion"]);
  cleanupManager();
  setupVariables({ registry: three });
  renderManager();
  expect(collectionIds()).toEqual(["site", "c1", "c2"]);
});

test("+ (tooltip New collection) opens a name field; Enter creates and selects; Escape cancels and the overlay stays open", async () => {
  renderManager();
  expect(selected()).toBe("site");
  await act(async () => userEvent.click(newCollectionButton()!));
  expect(document.activeElement).toBe(nameField());
  await act(async () => userEvent.keyboard("Effects{Enter}"));
  expect(nameField()).toBeNull();
  expect(collectionNames()).toEqual(["Site", "Effects"]);
  expect(selected()).toBe(collectionIds()[1]);

  await act(async () => userEvent.click(newCollectionButton()!));
  await act(async () => userEvent.keyboard("Draft{Escape}"));
  expect(nameField()).toBeNull();
  expect(collectionNames()).toEqual(["Site", "Effects"]);
  expect($openRailOverlay.get()).toBe("variables");
});

test("Brand has no menu, Site's has Rename, a designer collection's has Rename and Delete", async () => {
  setupVariables({ styles: BRAND_SIX, registry: three });
  renderManager();
  expect(
    collection("brand")?.querySelector('[aria-label="Actions"]')
  ).toBeNull();
  await openMenu("site");
  expect(menuItems()).toEqual(["Rename"]);
  await act(async () => userEvent.keyboard("{Escape}"));
  await openMenu("c1");
  expect(menuItems()).toEqual(["Rename", "Delete"]);
  await chooseMenuItem("Rename");
  expect(nameField()?.value).toBe("Spacing");
  await act(async () => userEvent.keyboard("{Control>}a{/Control}Gaps{Enter}"));
  expect(collectionNames()).toEqual(["Brand", "Site", "Gaps", "Motion"]);
});

test("deleting a collection with variables confirms 'Delete Spacing and its 2 variables?' 'Used in 3 places.'; an empty one goes at once", async () => {
  setupVariables({ styles: usedTwice, registry: three });
  renderManager();
  await openMenu("c2");
  await chooseMenuItem("Delete");
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(collectionIds()).toEqual(["site", "c1"]);

  await openMenu("c1");
  await chooseMenuItem("Delete");
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  expect(dialog?.textContent).toContain("Delete Spacing and its 2 variables?");
  expect(dialog?.textContent).toContain("Used in 3 places.");
  const confirm = Array.from(dialog!.querySelectorAll("button")).find(
    (button) => button.textContent === "Delete"
  );
  await act(async () => userEvent.click(confirm!));
  expect(collectionIds()).toEqual(["site"]);
  expect(selected()).toBe("site");
});

test("the selection survives a reopen; a remembered collection that is gone falls back to the first", async () => {
  setupVariables({ registry: three });
  renderManager();
  await act(async () => userEvent.click(collection("c2")!));
  expect(selected()).toBe("c2");
  act(() => {
    hideRailOverlay("variables");
  });
  act(() => {
    openRailOverlay("variables");
  });
  expect(selected()).toBe("c2");
  cleanupManager();

  setupVariables({ styles: BRAND_SIX, registry: three });
  writeSelectedCollection("project-1", "gone");
  renderManager();
  expect(selected()).toBe("brand");
});

test("a view permit shows no + and no menus", () => {
  setupVariables({ registry: three, permit: "view" });
  renderManager();
  expect(newCollectionButton()).toBeNull();
  expect(document.querySelector('[aria-label="Actions"]')).toBeNull();
});
