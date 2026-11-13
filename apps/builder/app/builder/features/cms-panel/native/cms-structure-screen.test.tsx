// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { refreshCmsNative } from "./cms-native-stores";
import { $cmsNativeDirty } from "./cms-native-stores";
import { PEOPLE, POSTS } from "./fake-cms-source";
import { POSTS_STRUCTURE } from "./fake-cms-structure-source";
import {
  buttonByText,
  byLabel,
  click,
  currentSlug,
  editItemTitle,
  menuItem,
  menuItems,
  harness,
  hasText,
  mount,
  reopen,
  resetHarness,
  settle,
  tab,
  unmount,
} from "./structure-test-harness";

beforeEach(resetHarness);
afterEach(unmount);

const column = () =>
  document.querySelector<HTMLElement>("[data-cms-collections]");

describe("the tabs and the structure reads", () => {
  test("the tabs: Collections and Fields under the title; Fields disabled with nothing open", async () => {
    harness.fake.listCollections.mockResolvedValue({ collections: [] });
    mount();
    await settle();
    expect(tab("Collections")).toBeDefined();
    expect(tab("Fields")).toBeDefined();
    expect(tab("Fields")?.hasAttribute("disabled")).toBe(true);
    unmount();
    resetHarness();
    mount();
    await settle();
    expect(tab("Fields")?.hasAttribute("disabled")).toBe(false);
    await click(tab("Fields"));
    expect(document.querySelector('[aria-label="Fields"]')).not.toBeNull();
  });

  test('"+" is New collection on Collections and Add field on Fields, only with canManageSettings', async () => {
    mount();
    await settle();
    expect(byLabel("New collection")).not.toBeNull();
    expect(byLabel("Add field")).toBeNull();
    await click(tab("Fields"));
    expect(byLabel("Add field")).not.toBeNull();
    expect(byLabel("New collection")).toBeNull();
    unmount();
    resetHarness();
    harness.fake.getAccess.mockResolvedValue({
      canEdit: true,
      canPublish: true,
      canManageSettings: false,
    });
    mount();
    await settle();
    expect(byLabel("New collection")).toBeNull();
    await click(tab("Fields"));
    expect(byLabel("Add field")).toBeNull();
  });

  test("E20 and E21 read on open; each reopen and each $cmsNativeRefresh refetches them", async () => {
    mount();
    await settle();
    expect(harness.structure.getStructure).toHaveBeenCalledTimes(1);
    expect(harness.structure.getCollectionStructure).toHaveBeenCalledTimes(1);
    expect(harness.structure.getCollectionStructure).toHaveBeenLastCalledWith(
      POSTS.id
    );
    await reopen();
    expect(harness.structure.getStructure).toHaveBeenCalledTimes(2);
    expect(harness.structure.getCollectionStructure).toHaveBeenCalledTimes(2);
    refreshCmsNative();
    await settle();
    expect(harness.structure.getStructure).toHaveBeenCalledTimes(3);
    expect(harness.structure.getCollectionStructure).toHaveBeenCalledTimes(3);
  });

  test("a background E21 that fails changes nothing on screen", async () => {
    mount();
    await settle();
    await click(tab("Fields"));
    expect(
      document.querySelector('[data-cms-field-row="title"]')
    ).not.toBeNull();
    harness.structure.getCollectionStructure.mockResolvedValue({
      error: "unavailable",
    });
    await reopen();
    expect(
      document.querySelector('[data-cms-field-row="title"]')
    ).not.toBeNull();
    expect(hasText("Try again in a minute")).toBe(false);
  });

  test('E21 not_found shows "Collection not found" in the Fields tab and refetches E1', async () => {
    harness.structure.getCollectionStructure.mockResolvedValue({
      error: "not_found",
    });
    mount();
    await settle();
    const lists = harness.fake.listCollections.mock.calls.length;
    await click(tab("Fields"));
    expect(
      document.querySelector("[data-cms-structure-not-found]")?.textContent
    ).toBe("Collection not found");
    expect(lists).toBeGreaterThanOrEqual(2);
  });

  test("a foreground E21 that fails shows Try again in a minute with Retry in the Fields tab", async () => {
    harness.structure.getCollectionStructure.mockResolvedValueOnce({
      error: "unavailable",
    });
    mount();
    await settle();
    await click(tab("Fields"));
    expect(hasText("Try again in a minute")).toBe(true);
    await click(
      [...document.querySelectorAll("button")].find(
        (button) => button.textContent === "Retry"
      )
    );
    expect(
      document.querySelector('[data-cms-field-row="title"]')
    ).not.toBeNull();
  });

  test("E20 unauthorized shows the line with cause structure; the next E20 answer clears it", async () => {
    harness.structure.getStructure.mockResolvedValueOnce({
      error: "unauthorized",
    });
    mount();
    await settle();
    expect(hasText("Signed out of OrganizeOS")).toBe(true);
    await reopen();
    expect(hasText("Signed out of OrganizeOS")).toBe(false);
  });

  test('the column stays 240 px with both tabs and the "+"', async () => {
    mount();
    await settle();
    expect(column()?.getBoundingClientRect().width).toBe(240);
    const list = document.querySelector<HTMLElement>('[role="tablist"]');
    expect(list?.parentElement?.scrollWidth).toBeLessThanOrEqual(240);
    await click(tab("Fields"));
    expect(column()?.getBoundingClientRect().width).toBe(240);
  });
});

const PEOPLE_STRUCTURE = {
  ...POSTS_STRUCTURE,
  id: PEOPLE.id,
  slug: PEOPLE.slug,
  name: PEOPLE.name,
  singularName: PEOPLE.singularName,
  isPublic: PEOPLE.isPublic,
  total: 1,
  fields: [
    {
      key: "name",
      label: "Name",
      kind: "text" as const,
      isTitle: true,
      required: true,
    },
  ],
};

const answerBoth = () =>
  harness.structure.getCollectionStructure.mockImplementation(async (id) =>
    id === PEOPLE.id
      ? { collection: structuredClone(PEOPLE_STRUCTURE) }
      : { collection: structuredClone(POSTS_STRUCTURE) }
  );

describe("the row menu", () => {
  test("Settings and Delete, for a manager, with no collection actions", async () => {
    mount();
    await settle();
    await click(byLabel("People menu"));
    expect(menuItems()).toEqual(["Settings", "Delete"]);
  });

  test("Settings opens the settings view behind the guard, opening that collection first", async () => {
    answerBoth();
    mount();
    await settle();
    await editItemTitle();
    await click(byLabel("People menu"));
    await click(menuItem("Settings"));
    expect(hasText("Discard unsaved changes?")).toBe(true);
    await click(buttonByText("Keep editing"));
    expect(document.querySelector("[data-cms-collection-settings]")).toBeNull();
    expect(
      document.querySelector<HTMLInputElement>("#cms-field-title")?.value
    ).toBe("Mine");
    await click(byLabel("People menu"));
    await click(menuItem("Settings"));
    await click(buttonByText("Discard"));
    expect($cmsNativeDirty.get()).toBe(false);
    expect(currentSlug()).toBe("people");
    expect(
      document.querySelector("[data-cms-collection-settings]")
    ).not.toBeNull();
    expect(
      document.querySelector<HTMLInputElement>("#cms-settings-name")?.value
    ).toBe("People");
  });

  test("Delete opens the delete dialog for that collection", async () => {
    answerBoth();
    mount();
    await settle();
    await click(byLabel("People menu"));
    await click(menuItem("Delete"));
    expect(harness.structure.getCollectionStructure).toHaveBeenLastCalledWith(
      PEOPLE.id
    );
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Delete People and its 1 item?"
    );
  });
});
