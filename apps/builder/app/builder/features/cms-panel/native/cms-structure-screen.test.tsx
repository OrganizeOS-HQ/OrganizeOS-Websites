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
    // a refresh whose other reads answer, with E20 still unauthorized: the
    // line is E20's, so it stays
    harness.structure.getStructure.mockResolvedValueOnce({
      error: "unauthorized",
    });
    act(() => refreshCmsNative());
    await settle();
    expect(harness.fake.listCollections.mock.calls.length).toBeGreaterThan(1);
    expect(harness.structure.getStructure).toHaveBeenCalledTimes(2);
    expect(hasText("Signed out of OrganizeOS")).toBe(true);
    await reopen();
    expect(hasText("Signed out of OrganizeOS")).toBe(false);
  });

  test("E20's line is its own: a refresh whose list reads answer while E20 is still in flight keeps it; E20's answer clears it (M12(f), round 4)", async () => {
    harness.structure.getStructure.mockResolvedValueOnce({
      error: "unauthorized",
    });
    mount();
    await settle();
    expect(hasText("Signed out of OrganizeOS")).toBe(true);
    const answer =
      deferred<Awaited<ReturnType<typeof harness.structure.getStructure>>>();
    harness.structure.getStructure.mockReturnValueOnce(answer.promise);
    const listed = harness.fake.listCollections.mock.calls.length;
    act(() => refreshCmsNative());
    await settle();
    // the list's reads answered; a line of theirs would be gone
    expect(harness.fake.listCollections.mock.calls.length).toBeGreaterThan(
      listed
    );
    expect(hasText("Signed out of OrganizeOS")).toBe(true);
    await act(async () =>
      answer.resolve({
        templates: [],
        limits: { fields: 30, customCollections: 5, customCount: 0 },
      })
    );
    await settle();
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

/** E22 makes Speakers, and E1, E2 and E21 serve it from then on. */
const createSpeakers = (status: "created" | "found" = "created") => {
  const read = harness.fake.getCollection.getMockImplementation();
  harness.structure.createCollection.mockImplementation(async () => {
    harness.fake.listCollections.mockResolvedValue({
      collections: [POSTS, PEOPLE, SPEAKERS],
    });
    harness.fake.getCollection.mockImplementation(async (id) =>
      id === SPEAKERS.id
        ? {
            collection: {
              ...structuredClone(POSTS_DETAIL),
              id: SPEAKERS.id,
              slug: SPEAKERS.slug,
              name: SPEAKERS.name,
              fields: structuredClone(SPEAKERS_STRUCTURE.fields),
            },
          }
        : read!(id)
    );
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

  test.each(["replayed", "unavailable"] as const)(
    "after %s, the new row of that name opens, not an older one of the same name (review)",
    async (error) => {
      vi.spyOn(toast, "error");
      const older = {
        ...PEOPLE,
        id: "older-speakers",
        slug: "older-speakers",
        name: "Speakers",
      };
      harness.fake.listCollections.mockResolvedValue({
        collections: [POSTS, PEOPLE, older],
      });
      createSpeakers();
      harness.structure.createCollection.mockImplementation(async () => {
        harness.fake.listCollections.mockResolvedValue({
          collections: [POSTS, PEOPLE, older, SPEAKERS],
        });
        return { error };
      });
      mount();
      await settle();
      await openNewCollection();
      await click(radio("cms-new-collection", "custom"));
      await typeInto(nameInput(), "Speakers");
      await click(createButton());
      await settle();
      expect(dialog()).toBeNull();
      expect(await openSlug()).toBe("speakers");
    }
  );

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

  test.each(["Keep editing", "Discard"])(
    "a Create answered after the item editor gained unsaved values asks first: %s",
    async (choice) => {
      harness.fake.getCollection.mockResolvedValue({
        collection: {
          ...POSTS_DETAIL,
          fields: [
            ...POSTS_DETAIL.fields,
            { key: "cover", label: "Cover", kind: "image" },
          ],
        },
      });
      createSpeakers();
      mount();
      await settle();
      await click(document.querySelector<HTMLElement>("[data-cms-item-id]"));
      await settle();
      const upload = deferred<{ url: string; path: string }>();
      harness.fake.uploadImage.mockReturnValueOnce(upload.promise);
      const file = document
        .querySelector<HTMLElement>('[data-cms-field="cms-field-cover"]')
        ?.querySelector<HTMLInputElement>('input[type="file"]');
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" })
      );
      await act(async () => {
        file!.files = transfer.files;
        file!.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await settle();
      expect($cmsNativeDirty.get()).toBe(false);
      await openNewCollection();
      await click(radio("cms-new-collection", "custom"));
      await typeInto(nameInput(), "Speakers");
      await act(async () => {
        upload.resolve({ url: "https://cdn.example.org/a.png", path: "a.png" });
      });
      await vi.waitFor(() => expect($cmsNativeDirty.get()).toBe(true));
      await click(createButton());
      expect(hasText("Discard unsaved changes?")).toBe(true);
      if (choice === "Keep editing") {
        await keepEditing();
        expect(
          document.querySelector('[data-cms-field="cms-field-cover"] img')
        ).not.toBeNull();
        expect(await openSlug()).toBe("posts");
        expect(rowOf("speakers")).not.toBeNull();
      } else {
        await discardChanges();
        await vi.waitFor(async () => expect(await openSlug()).toBe("speakers"));
      }
    }
  );

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

  test("a settings rename shows in the item editor behind the view after Back, from one E2 refetch (M18, round 4)", async () => {
    answerSettings();
    const save = harness.structure.updateCollection.getMockImplementation()!;
    harness.structure.updateCollection.mockImplementation(async (...args) => {
      harness.fake.getCollection.mockResolvedValue({
        collection: { ...POSTS_DETAIL, name: "Articles" },
      });
      return save(...args);
    });
    mount();
    await settle();
    await click(document.querySelector<HTMLElement>("[data-cms-item-id]"));
    expect(document.querySelector("#cms-field-title")).not.toBeNull();
    await openSettings();
    await typeInto(settingsInput("name"), "Articles");
    const reads = harness.fake.getCollection.mock.calls.length;
    await click(buttonByText("Save", header()!));
    await settle();
    await click(byLabel("Back"));
    await settle();
    expect(document.querySelector("#cms-field-title")).not.toBeNull();
    const crumb = document.querySelector("[data-cms-crumb]")?.textContent;
    expect(crumb).toContain("Articles");
    expect(crumb).not.toContain("Posts");
    expect(harness.fake.getCollection.mock.calls.length - reads).toBe(1);
  });

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

  test("a new field made the title invalidates the canvas (review)", async () => {
    answerSchema();
    const stale = vi.fn();
    mount({ onCollectionCanvasStale: stale });
    await settle();
    await click(tab("Fields"));
    await click(byLabel("Add field"));
    await click(menuItem("Plain text"));
    await typeInto(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-label"),
      "Headline"
    );
    await click(document.querySelector<HTMLElement>("#cms-field-sheet-title"));
    await click(buttonByText("Add field", header()!));
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
    expect(stale).toHaveBeenLastCalledWith("posts");
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

  test("while Retry's E20 is in flight, New collection shows no options and Create stays disabled (round 4)", async () => {
    harness.structure.getStructure.mockResolvedValueOnce({
      error: "unavailable",
    });
    mount();
    await settle();
    await openNewCollection();
    const answer =
      deferred<Awaited<ReturnType<typeof harness.structure.getStructure>>>();
    harness.structure.getStructure.mockReturnValueOnce(answer.promise);
    await click(buttonByText("Retry", dialog()!));
    expect(radio("cms-new-collection", "custom")).toBeNull();
    expect(createButton()?.disabled).toBe(true);
    await act(async () =>
      answer.resolve({
        templates: [],
        limits: { fields: 30, customCollections: 5, customCount: 0 },
      })
    );
    await settle();
    expect(radio("cms-new-collection", "custom")).not.toBeNull();
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

describe("the focus as views and dialogs close (review)", () => {
  const settleFrame = async () => {
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    await settle();
  };

  test("a field's view takes the focus; Back gives it to that field's row", async () => {
    mount();
    await settle();
    await click(tab("Fields"));
    await click(fieldRow("summary")!.querySelector("button"));
    await settleFrame();
    const header = document.querySelector("[data-cms-structure-header]");
    expect(header).not.toBeNull();
    expect(header!.parentElement!.contains(document.activeElement)).toBe(true);
    await click(byLabel("Back"));
    await settleFrame();
    expect(document.activeElement).toBe(
      fieldRow("summary")!.querySelector("button")
    );
  });

  test("the settings' Back gives the focus to the collection's row", async () => {
    mount();
    await settle();
    await click(tab("Collections"));
    await click(byLabel("Posts menu"));
    await click(menuItem("Settings"));
    await settleFrame();
    expect(document.activeElement).toBe(byLabel("Back"));
    await click(byLabel("Back"));
    await settleFrame();
    expect(document.activeElement).toBe(
      document.querySelector('[data-cms-collection="posts"] button')
    );
  });

  test("Cancel in the delete dialog gives the focus to the row's menu", async () => {
    answerBoth();
    mount();
    await settle();
    await click(byLabel("People menu"));
    await click(menuItem("Delete"));
    await click(
      buttonByText("Cancel", document.querySelector('[role="dialog"]')!)
    );
    await settleFrame();
    expect(document.activeElement).toBe(byLabel("People menu"));
  });

  test("Cancel in Remove field returns the focus to the field's menu (round 4)", async () => {
    mount();
    await settle();
    await click(tab("Fields"));
    await click(fieldRow("summary")!.querySelector("button"));
    await click(byLabel("Field menu"));
    await click(menuItem("Remove field"));
    await click(buttonByText("Cancel", dialog()!));
    await settleFrame();
    expect(document.activeElement).toBe(byLabel("Field menu"));
  });

  test('Escape on a row\'s menu returns the focus to its "..." (round 4)', async () => {
    answerBoth();
    mount();
    await settle();
    await click(byLabel("People menu"));
    expect(menuItem("Settings")).toBeDefined();
    await act(async () => userEvent.keyboard("{Escape}"));
    await settleFrame();
    expect(document.activeElement).toBe(byLabel("People menu"));
  });

  test('Cancel in New collection returns the focus to "+" (round 4)', async () => {
    mount();
    await settle();
    await openNewCollection();
    await click(buttonByText("Cancel", dialog()!));
    await settleFrame();
    expect(document.activeElement).toBe(byLabel("New collection"));
  });

  test("Create gives the focus to the new row, or to Add field for Custom (round 4)", async () => {
    createSpeakers();
    mount();
    await settle();
    await openNewCollection();
    await click(radio("cms-new-collection", "blog"));
    await click(createButton());
    await settleFrame();
    await settleFrame();
    expect(document.activeElement).toBe(
      document.querySelector('[data-cms-collection="speakers"] button')
    );
    unmount();
    resetHarness();
    createSpeakers();
    mount();
    await settle();
    await openNewCollection();
    await click(radio("cms-new-collection", "custom"));
    await typeInto(nameInput(), "Speakers");
    await click(createButton());
    await settleFrame();
    await settleFrame();
    expect(document.activeElement).toBe(byLabel("Add field"));
  });
});

test("the Fields list fills its tab's width (review)", async () => {
  mount();
  await settle();
  await click(tab("Fields"));
  const list = document.querySelector<HTMLElement>('[aria-label="Fields"]')!;
  const panel = list.closest<HTMLElement>('[role="tabpanel"]')!;
  expect(panel).not.toBeNull();
  expect(
    Math.abs(
      list.getBoundingClientRect().width - panel.getBoundingClientRect().width
    )
  ).toBeLessThanOrEqual(1);
});

test("Alt+Arrow keeps the moved field's row focused, for the next move (review)", async () => {
  mount();
  await settle();
  await click(tab("Fields"));
  const titleButton = () => fieldRow("title")!.querySelector("button")!;
  titleButton().focus();
  for (let move = 0; move < 2; move += 1) {
    await act(async () => userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}"));
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(document.activeElement).toBe(titleButton());
  }
  const keys = [
    ...document.querySelectorAll<HTMLElement>("[data-cms-field-row]"),
  ].map((row) => row.dataset.cmsFieldRow);
  expect(keys).toEqual(["summary", "author", "title"]);
});

test("a moved row's refocus leaves the focus where it went before its frame (round 4)", async () => {
  mount();
  await settle();
  await click(tab("Fields"));
  const titleButton = () => fieldRow("title")!.querySelector("button")!;
  titleButton().focus();
  // hold the frames: the refocus is still waiting when the focus moves
  const held: FrameRequestCallback[] = [];
  const frame = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => {
      held.push(callback);
      return held.length;
    });
  try {
    await act(async () => userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}"));
    expect(held.length).toBeGreaterThan(0);
    const elsewhere = fieldRow("author")!.querySelector("button")!;
    elsewhere.focus();
    expect(document.activeElement).toBe(elsewhere);
    frame.mockRestore();
    await act(async () => {
      for (const callback of held.splice(0)) {
        callback(performance.now());
      }
    });
    expect(document.activeElement).toBe(elsewhere);
  } finally {
    frame.mockRestore();
  }
});

// I11: the structure entries wait for the editor's running Save, Publish or
// create, then run the guard on what it left (fork #103's chain)
describe("structure entries wait for the editor's running write (merge round)", () => {
  const editor = () => document.querySelector("[data-cms-editor]");

  type Held = { resolve: () => void };
  const starts: Array<[string, () => Promise<Held>]> = [
    [
      "Save",
      async () => {
        await editItemTitle();
        const held =
          deferred<Awaited<ReturnType<typeof harness.fake.updateItem>>>();
        harness.fake.updateItem.mockReturnValueOnce(held.promise);
        await click(buttonByText("Save"));
        expect(harness.fake.updateItem).toHaveBeenCalledTimes(1);
        return {
          resolve: () =>
            held.resolve({
              item: itemOf({
                data: { title: "Mine", summary: null, author: null },
                updatedAt: "2026-11-14T05:00:00.000000+00:00",
              }),
            }),
        };
      },
    ],
    [
      "Publish",
      async () => {
        await click(document.querySelector<HTMLElement>("[data-cms-item-id]"));
        const held =
          deferred<Awaited<ReturnType<typeof harness.fake.publishItem>>>();
        harness.fake.publishItem.mockReturnValueOnce(held.promise);
        await click(buttonByText("Publish"));
        expect(harness.fake.publishItem).toHaveBeenCalledTimes(1);
        return {
          resolve: () =>
            held.resolve({
              item: itemOf({
                status: "published",
                updatedAt: "2026-11-14T05:00:00.000000+00:00",
              }),
            }),
        };
      },
    ],
    [
      "create",
      async () => {
        await click(buttonByText("New item"));
        await typeInto(
          document.querySelector<HTMLInputElement>("#cms-field-title"),
          "Fresh"
        );
        const held =
          deferred<Awaited<ReturnType<typeof harness.fake.createItem>>>();
        harness.fake.createItem.mockReturnValueOnce(held.promise);
        await click(buttonByText("Save"));
        expect(harness.fake.createItem).toHaveBeenCalledTimes(1);
        return {
          resolve: () =>
            held.resolve({
              item: itemOf({
                id: "55555555-5555-4555-8555-555555555555",
                slug: "fresh",
                data: { title: "Fresh", summary: null, author: null },
              }),
              created: true,
            }),
        };
      },
    ],
  ];

  const entries: Array<[string, () => Promise<void>, () => Element | null]> = [
    [
      "a field row",
      async () => {
        await click(tab("Fields"));
        await click(fieldRow("summary")!.querySelector("button"));
      },
      () => document.querySelector("[data-cms-field-sheet]"),
    ],
    [
      "Add field",
      async () => {
        await click(tab("Fields"));
        await click(byLabel("Add field"));
        await click(menuItem("Email"));
      },
      () => document.querySelector("[data-cms-field-sheet]"),
    ],
    [
      "Settings",
      async () => {
        await click(tab("Collections"));
        await click(byLabel("Posts menu"));
        await click(menuItem("Settings"));
      },
      () => document.querySelector("[data-cms-collection-settings]"),
    ],
    [
      '"+"',
      async () => {
        await click(tab("Collections"));
        await click(byLabel("New collection"));
      },
      () =>
        [...document.querySelectorAll('[role="dialog"]')].find((dialog) =>
          dialog.textContent?.includes("New collection")
        ) ?? null,
    ],
  ];

  const cases = starts.flatMap(([write, start]) =>
    entries.map(
      ([entry, enter, opened]) => [write, entry, start, enter, opened] as const
    )
  );

  test.each(cases)(
    "during a held %s, %s waits for it, then opens without asking",
    async (_write, _entry, start, enter, opened) => {
      mount();
      await settle();
      const held = await start();
      await enter();
      // the editor stays while the write runs, and nothing opens or asks
      expect(editor()).not.toBeNull();
      expect(opened()).toBeNull();
      expect(hasText("Discard unsaved changes?")).toBe(false);
      await act(async () => held.resolve());
      await settle();
      await vi.waitFor(() => expect(opened()).not.toBeNull());
      expect(hasText("Discard unsaved changes?")).toBe(false);
    }
  );
});

// Round 4, item 4: an entry that waited for the editor opens on the
// collection it was asked for in, or not at all
test("Add field during a held Publish, then Posts deleted: no sheet opens when the Publish answers", async () => {
  mount();
  await settle();
  await click(document.querySelector<HTMLElement>("[data-cms-item-id]"));
  const held = deferred<Awaited<ReturnType<typeof harness.fake.publishItem>>>();
  harness.fake.publishItem.mockReturnValueOnce(held.promise);
  await click(buttonByText("Publish"));
  await click(tab("Fields"));
  await click(byLabel("Add field"));
  await click(menuItem("Email"));
  expect(document.querySelector("[data-cms-field-sheet]")).toBeNull();
  // Posts is deleted while the Publish runs
  harness.structure.deleteCollection.mockImplementation(async () => {
    harness.fake.listCollections.mockResolvedValue({ collections: [PEOPLE] });
    return {};
  });
  await click(tab("Collections"));
  await click(byLabel("Posts menu"));
  await click(menuItem("Delete"));
  await click(
    buttonByText(
      "Delete",
      document.querySelector<HTMLElement>('[role="dialog"]')!
    )
  );
  await settle();
  await act(async () =>
    held.resolve({
      item: itemOf({
        status: "published",
        updatedAt: "2026-11-14T05:00:00.000000+00:00",
      }),
    })
  );
  await settle();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  await settle();
  expect(document.querySelector("[data-cms-field-sheet]")).toBeNull();
  expect(harness.structure.updateSchema).not.toHaveBeenCalled();
});

// Round 4, item 9: a structure view's Back returns the focus to its own row
// even after an item's Back marked an item row
describe("the focus after an item's Back, then a structure view (round 4)", () => {
  const settleFrame = async () => {
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    await settle();
  };
  const itemBack = async () => {
    await click(document.querySelector<HTMLElement>("[data-cms-item-id]"));
    await click(byLabel("Back"));
    await settleFrame();
  };

  test("a field view's Back focuses that field's row", async () => {
    mount();
    await settle();
    await itemBack();
    await click(tab("Fields"));
    await click(fieldRow("summary")!.querySelector("button"));
    await settleFrame();
    await click(byLabel("Back"));
    await settleFrame();
    await settleFrame();
    expect(document.activeElement).toBe(
      fieldRow("summary")!.querySelector("button")
    );
  });

  test("the settings' Back focuses the collection's row", async () => {
    mount();
    await settle();
    await itemBack();
    await click(byLabel("Posts menu"));
    await click(menuItem("Settings"));
    await settleFrame();
    await click(byLabel("Back"));
    await settleFrame();
    await settleFrame();
    expect(document.activeElement).toBe(
      document.querySelector('[data-cms-collection="posts"] button')
    );
  });
});

// round 5, item 5: one focus keeper for the screen
describe("a focus lost to the page comes back to the screen (round 5)", () => {
  const twoFrames = async () => {
    for (let frame = 0; frame < 3; frame += 1) {
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      });
    }
    await settle();
  };
  const header = () =>
    document.querySelector<HTMLElement>("[data-cms-structure-header]")!;
  const openSettings = async () => {
    await click(tab("Collections"));
    await click(byLabel("Posts menu"));
    await click(menuItem("Settings"));
  };
  const cases: Array<[string, () => Promise<void>]> = [
    [
      "Settings' Back after the column switched to Fields",
      async () => {
        await openSettings();
        await click(tab("Fields"));
        await click(byLabel("Back"));
      },
    ],
    [
      "Keep editing, when a menu item opened the guard",
      async () => {
        answerBoth();
        await editItemTitle();
        await click(byLabel("People menu"));
        await click(menuItem("Settings"));
        await keepEditing();
      },
    ],
    [
      "a failed Save in the field sheet",
      async () => {
        await click(tab("Fields"));
        await click(fieldRow("summary")!.querySelector("button"));
        await typeInto(
          document.querySelector<HTMLInputElement>("#cms-field-sheet-label"),
          "Teaser"
        );
        harness.structure.updateSchema.mockResolvedValueOnce({
          error: "unavailable",
        });
        await click(buttonByText("Save", header()));
      },
    ],
    [
      "a failed Save in Settings",
      async () => {
        await openSettings();
        await typeInto(
          document.querySelector<HTMLInputElement>("#cms-settings-name"),
          "Articles"
        );
        harness.structure.updateCollection.mockResolvedValueOnce({
          error: "unavailable",
        });
        await click(buttonByText("Save", header()));
      },
    ],
    [
      "a successful Reload in the field sheet",
      async () => {
        await click(tab("Fields"));
        await click(fieldRow("summary")!.querySelector("button"));
        await typeInto(
          document.querySelector<HTMLInputElement>("#cms-field-sheet-label"),
          "Teaser"
        );
        harness.structure.updateSchema.mockResolvedValueOnce({
          error: "conflict",
        });
        await click(buttonByText("Save", header()));
        await click(buttonByText("Reload"));
      },
    ],
    [
      "a Delete whose count read fails",
      async () => {
        answerBoth();
        harness.structure.getCollectionStructure.mockResolvedValueOnce({
          error: "unavailable",
        });
        await click(tab("Collections"));
        await click(byLabel("People menu"));
        await click(menuItem("Delete"));
      },
    ],
  ];

  test.each(cases)("%s", async (_name, run) => {
    mount();
    await settle();
    await run();
    await twoFrames();
    const active = document.activeElement;
    expect(active).not.toBe(document.body);
    expect(active?.isConnected).toBe(true);
    expect(
      active?.closest("[data-cms-native-screen], [role='dialog']")
    ).not.toBeNull();
  });
});
