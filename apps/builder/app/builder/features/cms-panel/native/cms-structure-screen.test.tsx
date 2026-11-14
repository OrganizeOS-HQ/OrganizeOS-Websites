// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { toast } from "@webstudio-is/design-system";
import type { CmsCollectionSummary } from "./cms-source";
import { refreshCmsNative } from "./cms-native-stores";
import { $cmsNativeDirty } from "./cms-native-stores";
import {
  itemOf,
  itemsPageOf,
  PEOPLE,
  POSTS,
  POSTS_DETAIL,
  rowOf as itemRowOf,
} from "./fake-cms-source";
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
  fieldRow,
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
  keepEditing,
  discardChanges,
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
    await keepEditing();
    expect(document.querySelector("[data-cms-collection-settings]")).toBeNull();
    expect(
      document.querySelector<HTMLInputElement>("#cms-field-title")?.value
    ).toBe("Mine");
    await click(byLabel("People menu"));
    await click(menuItem("Settings"));
    await discardChanges();
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
    await keepEditing();
    expect(hasText("New collection")).toBe(false);
    expect(
      document.querySelector<HTMLInputElement>("#cms-field-title")?.value
    ).toBe("Mine");
    await click(byLabel("New collection"));
    await discardChanges();
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

describe("after a structure write", () => {
  const NEXT = "2026-11-12T10:05:00.123456+00:00";
  const header = () =>
    document.querySelector<HTMLElement>("[data-cms-structure-header]");

  const answerSchema = () =>
    harness.structure.updateSchema.mockImplementation(async (_id, body) => ({
      fields: body.fields,
      updatedAt: NEXT,
    }));

  /** E23 lands: E1 and E21 answer the saved settings from then on. */
  const answerSettings = () =>
    harness.structure.updateCollection.mockImplementation(
      async (id, { expectedUpdatedAt: _, ...settings }) => {
        harness.fake.listCollections.mockResolvedValue({
          collections: [{ ...POSTS, ...settings }, PEOPLE],
        });
        harness.structure.getCollectionStructure.mockResolvedValue({
          collection: { ...POSTS_STRUCTURE, ...settings, updatedAt: NEXT },
        });
        return { collection: { id, ...settings, updatedAt: NEXT } };
      }
    );

  const removeSummary = async () => {
    await click(tab("Fields"));
    await click(fieldRow("summary")!.querySelector("button"));
    await click(byLabel("Field menu"));
    await click(menuItem("Remove field"));
    await click(
      buttonByText("Remove", document.querySelector('[role="dialog"]')!)
    );
  };

  const openSettings = async () => {
    await click(tab("Collections"));
    await click(byLabel("Posts menu"));
    await click(menuItem("Settings"));
  };

  const settingsInput = (id: string) =>
    document.querySelector<HTMLInputElement>(`#cms-settings-${id}`);

  // the review focus line on removals
  test("after a field removal an open item editor saves without the removed key", async () => {
    answerSchema();
    harness.structure.updateSchema.mockImplementation(async (_id, body) => {
      harness.fake.getCollection.mockResolvedValue({
        collection: {
          ...POSTS_DETAIL,
          fields: POSTS_DETAIL.fields.filter(
            (field) => field.key !== "summary"
          ),
        },
      });
      return { fields: body.fields, updatedAt: NEXT };
    });
    harness.fake.updateItem.mockImplementation(async () => ({
      item: itemOf({ updatedAt: NEXT }),
    }));
    const stale = vi.fn();
    mount({ onCollectionCanvasStale: stale });
    await settle();
    await click(document.querySelector<HTMLElement>("[data-cms-item-id]"));
    await removeSummary();
    await click(tab("Collections"));
    const title = document.querySelector<HTMLInputElement>("#cms-field-title");
    expect(title).not.toBeNull();
    await typeInto(title, "Mine");
    await click(buttonByText("Save"));
    expect(harness.fake.updateItem).toHaveBeenCalledTimes(1);
    const [, , body] = harness.fake.updateItem.mock.calls[0];
    expect(Object.keys(body.data)).not.toContain("summary");
  });

  test("the canvas is invalidated by the old slug after a removal, an address change, a switch to private and a delete", async () => {
    answerSchema();
    answerSettings();
    const stale = vi.fn();
    mount({ onCollectionCanvasStale: stale });
    await settle();
    await removeSummary();
    expect(stale).toHaveBeenLastCalledWith("posts");
    expect(stale).toHaveBeenCalledTimes(1);
    await openSettings();
    await typeInto(settingsInput("slug"), "articles");
    await click(buttonByText("Save", header()!));
    expect(stale).toHaveBeenLastCalledWith("posts");
    expect(stale).toHaveBeenCalledTimes(2);
    await click(settingsInput("public"));
    await click(buttonByText("Save", header()!));
    expect(stale).toHaveBeenLastCalledWith("articles");
    expect(stale).toHaveBeenCalledTimes(3);
    harness.structure.deleteCollection.mockResolvedValue({});
    await click(byLabel("Collection menu"));
    await click(menuItem("Delete collection"));
    await click(
      buttonByText("Delete", document.querySelector('[role="dialog"]')!)
    );
    expect(stale).toHaveBeenLastCalledWith("articles");
    expect(stale).toHaveBeenCalledTimes(4);
  });

  test("a rename, a reorder and a new field invalidate nothing on the canvas", async () => {
    answerSchema();
    answerSettings();
    const stale = vi.fn();
    mount({ onCollectionCanvasStale: stale });
    await settle();
    await openSettings();
    await typeInto(settingsInput("name"), "Articles");
    await click(buttonByText("Save", header()!));
    await click(tab("Fields"));
    const button = fieldRow("title")!.querySelector("button")!;
    button.focus();
    await act(async () => userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}"));
    await new Promise((resolve) => setTimeout(resolve, 700));
    await settle();
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
    await click(byLabel("Add field"));
    await click(menuItem("Email"));
    await typeInto(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-label"),
      "Contact"
    );
    await click(buttonByText("Add field", header()!));
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(2);
    expect(stale).not.toHaveBeenCalled();
  });

  test("no reload toast after any native structure write", async () => {
    const calls = [
      vi.spyOn(toast, "success"),
      vi.spyOn(toast, "info"),
      vi.spyOn(toast, "error"),
      vi.spyOn(toast, "warn"),
    ];
    answerSchema();
    answerSettings();
    createSpeakers();
    mount();
    await settle();
    await openNewCollection();
    await click(radio("cms-new-collection", "custom"));
    await typeInto(nameInput(), "Speakers");
    await click(createButton());
    await openSettings();
    await typeInto(settingsInput("name"), "Articles");
    await click(buttonByText("Save", header()!));
    await removeSummary();
    for (const call of calls) {
      expect(call).not.toHaveBeenCalled();
    }
  });

  test("the frame's cms.collection_changed refetches E20 and the open E21", async () => {
    mount();
    await settle();
    const structures = harness.structure.getStructure.mock.calls.length;
    const details = harness.structure.getCollectionStructure.mock.calls.length;
    refreshCmsNative();
    await settle();
    expect(harness.structure.getStructure).toHaveBeenCalledTimes(
      structures + 1
    );
    expect(harness.structure.getCollectionStructure).toHaveBeenCalledTimes(
      details + 1
    );
    expect(harness.structure.getCollectionStructure).toHaveBeenLastCalledWith(
      POSTS.id
    );
  });
});

// slice 2's list beside slice 3's structure (slice 3 spec 7.5)
describe("the list across a structure write", () => {
  const VENUE = { key: "venue", label: "Venue", kind: "text" as const };
  const radioItem = (label: string) =>
    [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
      (item) => item.textContent === label
    );

  const removeSummary = async () => {
    harness.structure.updateSchema.mockImplementation(async (_id, body) => ({
      fields: body.fields,
      updatedAt: "2026-11-12T10:05:00.123456+00:00",
    }));
    await click(tab("Fields"));
    await click(fieldRow("summary")!.querySelector("button"));
    await click(byLabel("Field menu"));
    await click(menuItem("Remove field"));
    await click(
      buttonByText("Remove", document.querySelector('[role="dialog"]')!)
    );
  };

  test("a structure write asks E3 again with the list's filter and sort, and adopts the answer's", async () => {
    // E3 runs what it was asked
    harness.fake.listItems.mockResolvedValue(
      itemsPageOf([itemRowOf(itemOf())], 1, 1, {
        applied: {
          status: "draft",
          sort: "name",
          direction: "desc",
          optionKey: null,
          optionValue: null,
        },
      })
    );
    mount({
      initialView: {
        collectionId: POSTS.id,
        list: {
          status: "draft",
          sort: "name",
          direction: "desc",
          option: null,
        },
      },
    });
    await settle();
    expect(harness.fake.listItems).toHaveBeenLastCalledWith(POSTS.id, {
      q: undefined,
      page: 1,
      status: "draft",
      sort: "name",
      direction: "desc",
    });
    // the schema change's E3 answers the manual order: the list adopts it
    harness.fake.listItems.mockResolvedValue(
      itemsPageOf([itemRowOf(itemOf())], 1, 1, {
        applied: {
          status: "draft",
          sort: "order",
          direction: "asc",
          optionKey: null,
          optionValue: null,
        },
      })
    );
    await removeSummary();
    expect(harness.fake.listItems).toHaveBeenLastCalledWith(POSTS.id, {
      q: undefined,
      page: 1,
      status: "draft",
      sort: "name",
      direction: "desc",
    });
    await click(tab("Collections"));
    await reopen();
    expect(harness.fake.listItems).toHaveBeenLastCalledWith(POSTS.id, {
      q: undefined,
      page: 1,
      status: "draft",
    });
  });

  test("opening a structure view clears the list's selection", async () => {
    mount();
    await settle();
    await click(byLabel("Select all on this page"));
    expect(
      document.querySelector('[role="toolbar"][aria-label="Bulk actions"]')
    ).not.toBeNull();
    await click(byLabel("Posts menu"));
    await click(menuItem("Settings"));
    expect(
      document.querySelector("[data-cms-collection-settings]")
    ).not.toBeNull();
    await click(byLabel("Back"));
    expect(
      document.querySelector('[role="toolbar"][aria-label="Bulk actions"]')
    ).toBeNull();
    expect(
      byLabel("Select all on this page")?.getAttribute("aria-checked")
    ).not.toBe("true");
  });

  test("a field sort whose column no longer shows stays in Sort, checked, and can be cleared", async () => {
    harness.fake.getCollection.mockResolvedValue({
      collection: { ...POSTS_DETAIL, fields: [...POSTS_DETAIL.fields, VENUE] },
    });
    harness.structure.getCollectionStructure.mockResolvedValue({
      collection: {
        ...POSTS_STRUCTURE,
        fields: [...POSTS_DETAIL.fields, VENUE],
      },
    });
    // E3 sorts by Venue, which is not among the answer's columns
    harness.fake.listItems.mockResolvedValue(
      itemsPageOf([itemRowOf(itemOf())], 1, 1, {
        columns: [],
        applied: {
          status: "all",
          sort: "field:venue",
          direction: "asc",
          optionKey: null,
          optionValue: null,
        },
      })
    );
    mount({
      initialView: {
        collectionId: POSTS.id,
        list: {
          status: "all",
          sort: "field:venue",
          direction: "asc",
          option: null,
        },
      },
    });
    await settle();
    await click(buttonByText("Sort"));
    expect(radioItem("Venue")?.getAttribute("aria-checked")).toBe("true");
    harness.fake.listItems.mockResolvedValue(
      itemsPageOf([itemRowOf(itemOf())], 1, 1)
    );
    await click(radioItem("Manual order"));
    expect(harness.fake.listItems).toHaveBeenLastCalledWith(POSTS.id, {
      q: undefined,
      page: 1,
    });
  });
});

describe("the structure reads and views, from W4's review", () => {
  test("a first run whose E20 fails shows Try again in a minute; Retry reads E20 and shows the options", async () => {
    harness.fake.listCollections.mockResolvedValue({ collections: [] });
    harness.structure.getStructure.mockResolvedValueOnce({
      error: "unavailable",
    });
    mount();
    await settle();
    expect(firstRun()).toBeNull();
    expect(hasText("Try again in a minute")).toBe(true);
    await click(buttonByText("Retry"));
    expect(firstRun()).not.toBeNull();
    expect(radio("cms-first-run", "blog")).not.toBeNull();
  });

  test("with E20 failed, New collection shows its line in place of the options, and Retry brings them", async () => {
    harness.structure.getStructure.mockResolvedValueOnce({
      error: "unavailable",
    });
    mount();
    await settle();
    await openNewCollection();
    expect(dialog()?.textContent).toContain("Try again in a minute");
    expect(radio("cms-new-collection", "blog")).toBeNull();
    await click(buttonByText("Retry", dialog()!));
    expect(radio("cms-new-collection", "blog")).not.toBeNull();
  });

  test("Discard before another action shows the open settings view's saved values again, and nothing stays unsaved", async () => {
    answerBoth();
    mount();
    await settle();
    await click(byLabel("Posts menu"));
    await click(menuItem("Settings"));
    await typeInto(
      document.querySelector<HTMLInputElement>("#cms-settings-name"),
      "Edited"
    );
    expect($cmsNativeDirty.get()).toBe(true);
    await click(byLabel("New collection"));
    await discardChanges();
    await click(buttonByText("Cancel", dialog()!));
    await vi.waitFor(() => expect(dialog()).toBeNull());
    expect($cmsNativeDirty.get()).toBe(false);
    expect(
      document.querySelector<HTMLInputElement>("#cms-settings-name")?.value
    ).toBe("Posts");
  });

  test("a settings view closes when its collection leaves E1, and never moves to another collection", async () => {
    answerBoth();
    mount();
    await settle();
    await click(byLabel("Posts menu"));
    await click(menuItem("Settings"));
    expect(
      document.querySelector("[data-cms-collection-settings]")
    ).not.toBeNull();
    harness.fake.listCollections.mockResolvedValue({ collections: [PEOPLE] });
    await reopen();
    expect(document.querySelector("[data-cms-collection-settings]")).toBeNull();
    expect($cmsNativeDirty.get()).toBe(false);
  });

  test("Retry on E20's refusal line reads E20 again and clears the line once it answers", async () => {
    harness.structure.getStructure.mockResolvedValueOnce({
      error: "forbidden",
    });
    mount();
    await settle();
    expect(hasText("No access to the CMS")).toBe(true);
    await click(buttonByText("Retry"));
    expect(hasText("No access to the CMS")).toBe(false);
  });
});
