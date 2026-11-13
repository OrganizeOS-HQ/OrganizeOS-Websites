// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { toast } from "@webstudio-is/design-system";
import type { CmsCollectionSummary } from "./cms-source";
import { refreshCmsNative } from "./cms-native-stores";
import { $cmsNativeDirty } from "./cms-native-stores";
import { PEOPLE, POSTS } from "./fake-cms-source";
import { POSTS_STRUCTURE } from "./fake-cms-structure-source";
import {
  buttonByText,
  byLabel,
  click,
  currentSlug,
  deferred,
  rowOf,
  typeInto,
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

const SPEAKERS: CmsCollectionSummary = {
  id: "66666666-6666-4666-8666-000000000001",
  slug: "speakers",
  name: "Speakers",
  singularName: "Speakers",
  isPublic: true,
  total: 0,
};

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const firstRun = () =>
  document.querySelector<HTMLElement>("[data-cms-first-run]");
const radio = (prefix: string, type: string) =>
  document.querySelector<HTMLButtonElement>(`#${prefix}-type-${type}`);
const nameInput = (prefix = "cms-new-collection") =>
  document.querySelector<HTMLInputElement>(`#${prefix}-name`);
const createButton = () => buttonByText("Create", dialog() ?? document);
const sentClientIds = () =>
  harness.structure.createCollection.mock.calls.map(([body]) => body.clientId);

/** The open collection, read from the Collections tab. */
const openSlug = async () => {
  if (tab("Collections")?.getAttribute("aria-selected") !== "true") {
    await click(tab("Collections"));
  }
  return currentSlug();
};

const openNewCollection = async () => {
  if (tab("Collections")?.getAttribute("aria-selected") !== "true") {
    await click(tab("Collections"));
  }
  await click(byLabel("New collection"));
  expect(dialog()?.textContent).toContain("New collection");
};

const SPEAKERS_STRUCTURE = {
  ...POSTS_STRUCTURE,
  ...SPEAKERS,
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

/** E22 makes Speakers, and E1 and E21 list it from then on. */
const createSpeakers = (status: "created" | "found" = "created") => {
  harness.structure.createCollection.mockImplementation(async () => {
    harness.fake.listCollections.mockResolvedValue({
      collections: [POSTS, PEOPLE, SPEAKERS],
    });
    return { collection: SPEAKERS, created: status === "created" };
  });
  harness.structure.getCollectionStructure.mockImplementation(async (id) =>
    id === SPEAKERS.id
      ? { collection: structuredClone(SPEAKERS_STRUCTURE) }
      : { collection: structuredClone(POSTS_STRUCTURE) }
  );
};

describe("New collection and the first run", () => {
  test('the first run: E1 empty, canManageSettings, E20 answered -> the form as a page with "New collection" and Create', async () => {
    harness.fake.listCollections.mockResolvedValue({ collections: [] });
    mount();
    await settle();
    expect(firstRun()).not.toBeNull();
    expect(firstRun()?.textContent).toContain("New collection");
    expect(buttonByText("Create", firstRun()!)).toBeDefined();
    expect(radio("cms-first-run", "blog")).not.toBeNull();
  });

  test("no first run without canManageSettings: the main area stays empty", async () => {
    harness.fake.listCollections.mockResolvedValue({ collections: [] });
    harness.fake.getAccess.mockResolvedValue({
      canEdit: true,
      canPublish: true,
      canManageSettings: false,
    });
    mount();
    await settle();
    expect(firstRun()).toBeNull();
    expect(document.querySelector("[data-cms-native-main]")?.textContent).toBe(
      ""
    );
  });

  test('with an item editor holding unsaved values, "+" asks Discard unsaved changes? first: Keep editing keeps the values and opens no dialog; Discard opens it', async () => {
    mount();
    await settle();
    await editItemTitle();
    await click(byLabel("New collection"));
    expect(hasText("Discard unsaved changes?")).toBe(true);
    await click(buttonByText("Keep editing"));
    expect(hasText("New collection")).toBe(false);
    expect(
      document.querySelector<HTMLInputElement>("#cms-field-title")?.value
    ).toBe("Mine");
    await click(byLabel("New collection"));
    await click(buttonByText("Discard"));
    await vi.waitFor(() =>
      expect(dialog()?.textContent).toContain("New collection")
    );
  });

  test("the options: seven templates in E20's order, then Custom, two columns", async () => {
    mount();
    await settle();
    await openNewCollection();
    const options = [
      ...dialog()!.querySelectorAll<HTMLElement>('[role="radio"]'),
    ].map((option) => option.getAttribute("value"));
    expect(options).toEqual([
      "blog",
      "team",
      "endorsements",
      "issues",
      "faq",
      "testimonials",
      "categories",
      "custom",
    ]);
    const grid = dialog()!.querySelector<HTMLElement>(
      "[data-cms-template-options]"
    );
    expect(getComputedStyle(grid!).gridTemplateColumns.split(" ")).toHaveLength(
      2
    );
  });

  test("Name takes the template's label until typed; switching templates keeps a typed name; Enter submits", async () => {
    createSpeakers();
    mount();
    await settle();
    await openNewCollection();
    expect(nameInput()?.disabled).toBe(true);
    await click(radio("cms-new-collection", "blog"));
    expect(nameInput()?.value).toBe("Blog posts");
    await click(radio("cms-new-collection", "team"));
    expect(nameInput()?.value).toBe("Team Members");
    await typeInto(nameInput(), "Organizers");
    await click(radio("cms-new-collection", "faq"));
    expect(nameInput()?.value).toBe("Organizers");
    await typeInto(nameInput(), "Organizers{Enter}");
    expect(harness.structure.createCollection).toHaveBeenCalledWith(
      expect.objectContaining({ type: "faq", name: "Organizers" })
    );
  });

  test('Custom at customCollections is disabled with the "Not in plan" chip; templates are not', async () => {
    harness.structure.getStructure.mockResolvedValue({
      templates: [
        { type: "blog", label: "Blog posts" },
        { type: "faq", label: "FAQ" },
      ],
      limits: { fields: 30, customCollections: 5, customCount: 5 },
    });
    mount();
    await settle();
    await openNewCollection();
    expect(radio("cms-new-collection", "custom")?.disabled).toBe(true);
    expect(
      dialog()?.querySelector("[data-cms-custom-option]")?.textContent
    ).toContain("Not in plan");
    expect(radio("cms-new-collection", "blog")?.disabled).toBe(false);
  });

  test("Singular name for Custom only, sent only when typed", async () => {
    createSpeakers();
    mount();
    await settle();
    await openNewCollection();
    await click(radio("cms-new-collection", "blog"));
    expect(document.querySelector("#cms-new-collection-singular")).toBeNull();
    await click(radio("cms-new-collection", "custom"));
    const singular = document.querySelector<HTMLInputElement>(
      "#cms-new-collection-singular"
    );
    expect(singular).not.toBeNull();
    await typeInto(nameInput(), "Speakers");
    expect(singular?.placeholder).toBe("Speakers");
    await click(createButton());
    expect(harness.structure.createCollection.mock.calls[0][0]).toEqual({
      clientId: expect.any(String),
      type: "custom",
      name: "Speakers",
    });
    await openNewCollection();
    await click(radio("cms-new-collection", "custom"));
    await typeInto(nameInput(), "Speakers");
    await typeInto(
      document.querySelector<HTMLInputElement>("#cms-new-collection-singular"),
      "Speaker"
    );
    await click(createButton());
    expect(harness.structure.createCollection.mock.calls[1][0]).toMatchObject({
      singularName: "Speaker",
    });
  });

  test("a timeout, then Create again: the same clientId; a 200 opens that collection", async () => {
    vi.spyOn(toast, "error");
    mount();
    await settle();
    await openNewCollection();
    await click(radio("cms-new-collection", "custom"));
    await typeInto(nameInput(), "Speakers");
    await click(createButton());
    expect(dialog()).not.toBeNull();
    createSpeakers("found");
    await click(createButton());
    const [first, second] = sentClientIds();
    expect(second).toBe(first);
    expect(dialog()).toBeNull();
    expect(await openSlug()).toBe("speakers");
  });

  test("after replayed or a timeout, an E1 refetch holding a new collection of that type and name opens it and closes the form", async () => {
    harness.structure.createCollection.mockImplementation(async () => {
      harness.fake.listCollections.mockResolvedValue({
        collections: [POSTS, PEOPLE, SPEAKERS],
      });
      return { error: "replayed" };
    });
    createSpeakers();
    harness.structure.createCollection.mockImplementation(async () => {
      harness.fake.listCollections.mockResolvedValue({
        collections: [POSTS, PEOPLE, SPEAKERS],
      });
      return { error: "replayed" };
    });
    mount();
    await settle();
    await openNewCollection();
    await click(radio("cms-new-collection", "custom"));
    await typeInto(nameInput(), "Speakers");
    await click(createButton());
    expect(dialog()).toBeNull();
    expect(tab("Fields")?.getAttribute("aria-selected")).toBe("true");
    expect(await openSlug()).toBe("speakers");
  });

  test("not_found on E22 resets the form with a new clientId", async () => {
    vi.spyOn(toast, "error");
    harness.structure.createCollection.mockResolvedValueOnce({
      error: "not_found",
    });
    mount();
    await settle();
    await openNewCollection();
    await click(radio("cms-new-collection", "custom"));
    await typeInto(nameInput(), "Speakers");
    await click(createButton());
    expect(nameInput()?.value).toBe("");
    await click(radio("cms-new-collection", "custom"));
    await typeInto(nameInput(), "Speakers");
    await click(createButton());
    const [first, second] = sentClientIds();
    expect(second).not.toBe(first);
  });

  test("Custom opens its Fields tab; a template opens its items", async () => {
    createSpeakers();
    mount();
    await settle();
    await openNewCollection();
    await click(radio("cms-new-collection", "custom"));
    await typeInto(nameInput(), "Speakers");
    await click(createButton());
    expect(tab("Fields")?.getAttribute("aria-selected")).toBe("true");
    expect(harness.structure.getCollectionStructure).toHaveBeenLastCalledWith(
      SPEAKERS.id
    );
    expect(await openSlug()).toBe("speakers");
    unmount();
    resetHarness();
    createSpeakers();
    mount();
    await settle();
    await openNewCollection();
    await click(radio("cms-new-collection", "blog"));
    await click(createButton());
    expect(currentSlug()).toBe("speakers");
    expect(tab("Collections")?.getAttribute("aria-selected")).toBe("true");
    expect(harness.fake.listItems).toHaveBeenLastCalledWith(SPEAKERS.id, {
      q: undefined,
      page: 1,
    });
  });

  test("after Create, the new row is listed and stays open while the E1 refetch is held", async () => {
    mount();
    await settle();
    const held = deferred<{ collections: CmsCollectionSummary[] }>();
    harness.structure.createCollection.mockImplementation(async () => {
      harness.fake.listCollections.mockReturnValue(held.promise);
      return { collection: SPEAKERS, created: true };
    });
    await openNewCollection();
    await click(radio("cms-new-collection", "custom"));
    await typeInto(nameInput(), "Speakers");
    await click(createButton());
    await click(tab("Collections"));
    expect(rowOf("speakers")).not.toBeNull();
    expect(currentSlug()).toBe("speakers");
    held.resolve({ collections: [POSTS, PEOPLE, SPEAKERS] });
    await settle();
    expect(currentSlug()).toBe("speakers");
  });

  test('limit is the toast "Collection limit reached" and refetches E20; slug_taken is "Try again in a minute"', async () => {
    const error = vi.spyOn(toast, "error");
    harness.structure.createCollection.mockResolvedValueOnce({
      error: "limit",
    });
    harness.structure.createCollection.mockResolvedValueOnce({
      error: "slug_taken",
    });
    mount();
    await settle();
    const reads = harness.structure.getStructure.mock.calls.length;
    await openNewCollection();
    await click(radio("cms-new-collection", "custom"));
    await typeInto(nameInput(), "Speakers");
    await click(createButton());
    expect(error).toHaveBeenLastCalledWith("Collection limit reached");
    expect(harness.structure.getStructure).toHaveBeenCalledTimes(reads + 1);
    await click(createButton());
    expect(error).toHaveBeenLastCalledWith("Try again in a minute");
  });

  // Review Focus 5
  test("a 120-character template label or name truncates in its radio and its row", async () => {
    const long = "W".repeat(120);
    harness.structure.getStructure.mockResolvedValue({
      templates: [{ type: "blog", label: long }],
      limits: { fields: 30, customCollections: 5, customCount: 0 },
    });
    harness.fake.listCollections.mockResolvedValue({
      collections: [{ ...POSTS, name: long }, PEOPLE],
    });
    mount();
    await settle();
    const row = rowOf("posts")!;
    const name = row.querySelector<HTMLElement>("button > *")!;
    expect(name.textContent).toBe(long);
    expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
    expect(row.getBoundingClientRect().right).toBeLessThanOrEqual(
      column()!.getBoundingClientRect().right
    );
    await openNewCollection();
    const option = radio("cms-new-collection", "blog")!.parentElement!;
    const text = option.querySelector<HTMLElement>("label > *")!;
    expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
    expect(option.getBoundingClientRect().right).toBeLessThanOrEqual(
      dialog()!.getBoundingClientRect().right
    );
    expect(dialog()!.scrollWidth).toBeLessThanOrEqual(dialog()!.clientWidth);
  });
});
