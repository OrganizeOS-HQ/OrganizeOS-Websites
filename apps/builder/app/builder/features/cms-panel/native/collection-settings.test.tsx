// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { toast } from "@webstudio-is/design-system";
import { $cmsNativeDirty } from "./cms-native-stores";
import { PEOPLE, POSTS, VERSION } from "./fake-cms-source";
import { POSTS_STRUCTURE } from "./fake-cms-structure-source";
import type { CmsStructureCollection } from "./cms-structure-source";
import {
  buttonByText,
  byLabel,
  click,
  currentSlug,
  harness,
  hasText,
  keepEditing,
  menuItem,
  mount,
  resetHarness,
  settle,
  typeInto,
  unmount,
} from "./structure-test-harness";

beforeEach(resetHarness);
afterEach(unmount);

const NEXT = "2026-11-12T10:05:00.123456+00:00";

const input = (id: string) =>
  document.querySelector<HTMLInputElement>(`#cms-settings-${id}`);
const settingsView = () =>
  document.querySelector<HTMLElement>("[data-cms-collection-settings]");
const header = () =>
  document.querySelector<HTMLElement>("[data-cms-structure-header]");
const saveButton = () => buttonByText("Save", header() ?? document);
const errorOf = (id: string) =>
  document.querySelector(`#cms-settings-${id}-error`)?.textContent;
const crumb = () =>
  [...document.querySelectorAll<HTMLElement>("[data-cms-crumb] > *")].map(
    (part) => part.textContent
  );
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

/** E23 answers with what it was sent, at a new version. */
const answerSaves = (version = NEXT) =>
  harness.structure.updateCollection.mockImplementation(
    async (id, { expectedUpdatedAt: _, ...settings }) => ({
      collection: { id, ...settings, updatedAt: version },
    })
  );

const openSettings = async () => {
  mount();
  await settle();
  await click(byLabel("Posts menu"));
  await click(menuItem("Settings"));
  expect(settingsView()).not.toBeNull();
};

const PEOPLE_STRUCTURE: CmsStructureCollection = {
  ...POSTS_STRUCTURE,
  id: PEOPLE.id,
  slug: PEOPLE.slug,
  name: PEOPLE.name,
  singularName: PEOPLE.singularName,
  isPublic: PEOPLE.isPublic,
  total: 1,
};

describe("collection settings", () => {
  test('the view: crumb Collection / Settings, Back, "..." named and tooltipped Collection menu with Delete collection, Save enabled only when changed', async () => {
    await openSettings();
    expect(crumb()).toEqual(["Posts", "/", "Settings"]);
    expect(byLabel("Back")).not.toBeNull();
    expect(input("name")?.value).toBe("Posts");
    expect(input("singular")?.value).toBe("Post");
    expect(input("slug")?.value).toBe("posts");
    expect(saveButton()?.disabled).toBe(true);
    await act(async () => userEvent.hover(byLabel("Collection menu")!));
    await vi.waitFor(() =>
      expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
        "Collection menu"
      )
    );
    await click(byLabel("Collection menu"));
    expect(menuItem("Delete collection")).toBeDefined();
    await act(async () => userEvent.keyboard("{Escape}"));
    await settle();
    await typeInto(input("name"), "Articles");
    expect(saveButton()?.disabled).toBe(false);
    await typeInto(input("name"), "Posts");
    expect(saveButton()?.disabled).toBe(true);
  });

  test("errors under their controls: Required, Lower-case letters, digits, hyphens, Address in use (slug_taken)", async () => {
    await openSettings();
    await typeInto(input("name"), " ");
    await typeInto(input("singular"), "");
    await click(saveButton());
    expect(errorOf("name")).toBe("Required");
    expect(errorOf("singular")).toBe("Required");
    expect(harness.structure.updateCollection).not.toHaveBeenCalled();
    await typeInto(input("name"), "Posts");
    await typeInto(input("singular"), "Post");
    harness.structure.updateCollection.mockResolvedValueOnce({
      error: "invalid",
      field: "slug",
    });
    await typeInto(input("slug"), "news");
    await click(saveButton());
    expect(errorOf("slug")).toBe("Lower-case letters, digits, hyphens");
    harness.structure.updateCollection.mockResolvedValueOnce({
      error: "slug_taken",
    });
    await typeInto(input("slug"), "people");
    await click(saveButton());
    expect(errorOf("slug")).toBe("Address in use");
  });

  test("Address slugifies on blur", async () => {
    await openSettings();
    await typeInto(input("slug"), "My Posts");
    await click(input("name"));
    expect(input("slug")?.value).toBe("my-posts");
    await typeInto(input("slug"), "");
    await click(input("name"));
    expect(input("slug")?.value).toBe("posts");
  });

  // Review Focus 2
  test("Enter in Address, or Save while it has focus, sends the slugified address", async () => {
    answerSaves();
    await openSettings();
    await typeInto(input("slug"), "My Posts{Enter}");
    expect(harness.structure.updateCollection).toHaveBeenLastCalledWith(
      POSTS.id,
      expect.objectContaining({ slug: "my-posts" })
    );
    await typeInto(input("slug"), "Your Posts");
    expect(document.activeElement).toBe(input("slug"));
    await click(saveButton());
    expect(harness.structure.updateCollection).toHaveBeenLastCalledWith(
      POSTS.id,
      expect.objectContaining({ slug: "your-posts" })
    );
  });

  test("conflict: the line Changed by someone else with Reload; Reload rebases", async () => {
    await openSettings();
    await typeInto(input("slug"), "my-posts");
    harness.structure.updateCollection.mockResolvedValueOnce({
      error: "conflict",
    });
    await click(saveButton());
    expect(
      document.querySelector("[data-cms-structure-conflict]")?.textContent
    ).toContain("Changed by someone else");
    // the other writer changed the name
    harness.structure.getCollectionStructure.mockResolvedValue({
      collection: { ...POSTS_STRUCTURE, name: "Articles", updatedAt: NEXT },
    });
    await click(buttonByText("Reload"));
    expect(document.querySelector("[data-cms-structure-conflict]")).toBeNull();
    expect(input("name")?.value).toBe("Articles");
    expect(input("slug")?.value).toBe("my-posts");
    answerSaves();
    await click(saveButton());
    expect(harness.structure.updateCollection).toHaveBeenLastCalledWith(
      POSTS.id,
      {
        name: "Articles",
        singularName: "Post",
        slug: "my-posts",
        isPublic: true,
        expectedUpdatedAt: NEXT,
      }
    );
  });

  test("an unknown outcome rereads E21: landed -> clean; not landed -> rebased, Save on again", async () => {
    vi.spyOn(toast, "error");
    await openSettings();
    await typeInto(input("name"), "Articles");
    harness.structure.updateCollection.mockResolvedValueOnce({
      error: "unavailable",
    });
    harness.structure.getCollectionStructure.mockResolvedValueOnce({
      collection: { ...POSTS_STRUCTURE, name: "Articles", updatedAt: NEXT },
    });
    await click(saveButton());
    expect(input("name")?.value).toBe("Articles");
    expect(saveButton()?.disabled).toBe(true);
    expect($cmsNativeDirty.get()).toBe(false);

    await typeInto(input("name"), "Stories");
    harness.structure.updateCollection.mockResolvedValueOnce({
      error: "unavailable",
    });
    harness.structure.getCollectionStructure.mockResolvedValueOnce({
      collection: {
        ...POSTS_STRUCTURE,
        name: "Articles",
        singularName: "Article",
        updatedAt: NEXT,
      },
    });
    await click(saveButton());
    expect(input("name")?.value).toBe("Stories");
    expect(input("singular")?.value).toBe("Article");
    expect(saveButton()?.disabled).toBe(false);
  });

  test("forbidden and plan on a write are toasts, and the view keeps its values", async () => {
    const error = vi.spyOn(toast, "error");
    await openSettings();
    await typeInto(input("name"), "Articles");
    harness.structure.updateCollection.mockResolvedValueOnce({
      error: "forbidden",
    });
    await click(saveButton());
    expect(error).toHaveBeenLastCalledWith("No access");
    harness.structure.updateCollection.mockResolvedValueOnce({
      error: "plan",
    });
    await click(saveButton());
    expect(error).toHaveBeenLastCalledWith("Not in plan");
    expect(input("name")?.value).toBe("Articles");
    expect(settingsView()).not.toBeNull();
  });

  test("no toast after a save", async () => {
    const error = vi.spyOn(toast, "error");
    const success = vi.spyOn(toast, "success");
    answerSaves();
    await openSettings();
    await typeInto(input("name"), "Articles");
    await click(saveButton());
    expect(error).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(saveButton()?.disabled).toBe(true);
    expect(crumb()[0]).toBe("Articles");
    expect(harness.structure.updateCollection).toHaveBeenLastCalledWith(
      POSTS.id,
      expect.objectContaining({ expectedUpdatedAt: VERSION })
    );
  });

  test("the delete dialog: Delete Posts and its 2 items?, its 1 item, Delete Posts?; focus on Cancel", async () => {
    harness.structure.getCollectionStructure.mockImplementation(async (id) =>
      id === PEOPLE.id
        ? { collection: structuredClone(PEOPLE_STRUCTURE) }
        : { collection: structuredClone(POSTS_STRUCTURE) }
    );
    await openSettings();
    await click(byLabel("Collection menu"));
    await click(menuItem("Delete collection"));
    expect(dialog()?.textContent).toContain("Delete Posts and its 2 items?");
    expect(document.activeElement?.textContent).toBe("Cancel");
    await click(buttonByText("Cancel", dialog()!));
    await click(byLabel("People menu"));
    await click(menuItem("Delete"));
    expect(dialog()?.textContent).toContain("Delete People and its 1 item?");
    await click(buttonByText("Cancel", dialog()!));
    harness.structure.getCollectionStructure.mockResolvedValue({
      collection: { ...PEOPLE_STRUCTURE, total: 0 },
    });
    await click(byLabel("People menu"));
    await click(menuItem("Delete"));
    expect(
      dialog()?.querySelector("[data-cms-dialog-title]")?.textContent
    ).toBe("Delete People?");
  });

  test("in use: Posts is in use, Used by A, B and C, and Close alone", async () => {
    harness.structure.getCollectionStructure.mockResolvedValue({
      collection: {
        ...POSTS_STRUCTURE,
        referencedBy: [
          { id: "a", name: "A" },
          { id: "b", name: "B" },
          { id: "c", name: "C" },
        ],
      },
    });
    await openSettings();
    await click(byLabel("Collection menu"));
    await click(menuItem("Delete collection"));
    expect(dialog()?.textContent).toContain("Posts is in use");
    expect(
      dialog()?.querySelector("[data-cms-delete-blocked]")?.textContent
    ).toBe("Used by A, B and C");
    expect(buttonByText("Delete", dialog()!)).toBeUndefined();
    expect(buttonByText("Close", dialog()!)).toBeDefined();
  });

  test("referenced after opening rereads E21 and shows the in-use state, with no toast", async () => {
    const error = vi.spyOn(toast, "error");
    await openSettings();
    await click(byLabel("Collection menu"));
    await click(menuItem("Delete collection"));
    harness.structure.deleteCollection.mockResolvedValueOnce({
      error: "referenced",
    });
    harness.structure.getCollectionStructure.mockResolvedValue({
      collection: {
        ...POSTS_STRUCTURE,
        referencedBy: [{ id: "a", name: "Events" }],
      },
    });
    await click(buttonByText("Delete", dialog()!));
    expect(dialog()?.textContent).toContain("Posts is in use");
    expect(dialog()?.textContent).toContain("Used by Events");
    expect(error).not.toHaveBeenCalled();
  });

  test("deleting the open collection closes its view, clears $cmsNativeDirty, and slice 1 opens the first listed", async () => {
    await openSettings();
    await typeInto(input("name"), "Articles");
    expect($cmsNativeDirty.get()).toBe(true);
    harness.structure.deleteCollection.mockImplementation(async () => {
      harness.fake.listCollections.mockResolvedValue({ collections: [PEOPLE] });
      return {};
    });
    await click(byLabel("Collection menu"));
    await click(menuItem("Delete collection"));
    await click(buttonByText("Delete", dialog()!));
    expect(dialog()).toBeNull();
    expect(settingsView()).toBeNull();
    expect($cmsNativeDirty.get()).toBe(false);
    expect(currentSlug()).toBe("people");
    expect(hasText("Discard unsaved changes?")).toBe(false);
  });

  test("not_found on E25 after an unknown outcome reads as done", async () => {
    vi.spyOn(toast, "error");
    await openSettings();
    await click(byLabel("Collection menu"));
    await click(menuItem("Delete collection"));
    harness.structure.deleteCollection.mockResolvedValueOnce({
      error: "unavailable",
    });
    await click(buttonByText("Delete", dialog()!));
    expect(dialog()).not.toBeNull();
    harness.structure.deleteCollection.mockImplementation(async () => {
      harness.fake.listCollections.mockResolvedValue({ collections: [PEOPLE] });
      return { error: "not_found" };
    });
    await click(buttonByText("Delete", dialog()!));
    expect(dialog()).toBeNull();
    expect(currentSlug()).toBe("people");
  });

  // Review Focus 5
  test("a 120-character name: the crumb truncates; the delete title wraps inside the dialog", async () => {
    const long = "W".repeat(120);
    harness.fake.listCollections.mockResolvedValue({
      collections: [{ ...POSTS, name: long }, PEOPLE],
    });
    harness.structure.getCollectionStructure.mockResolvedValue({
      collection: { ...POSTS_STRUCTURE, name: long },
    });
    mount();
    await settle();
    await click(byLabel(`${long} menu`));
    await click(menuItem("Settings"));
    const name = document.querySelector<HTMLElement>("[data-cms-crumb] > *")!;
    expect(name.textContent).toBe(long);
    expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
    expect(header()!.scrollWidth).toBeLessThanOrEqual(header()!.clientWidth);
    await click(byLabel("Collection menu"));
    await click(menuItem("Delete collection"));
    const title = dialog()!.querySelector<HTMLElement>(
      "[data-cms-dialog-title]"
    )!;
    expect(title.textContent).toBe(`Delete ${long} and its 2 items?`);
    expect(title.getBoundingClientRect().right).toBeLessThanOrEqual(
      dialog()!.getBoundingClientRect().right
    );
    expect(dialog()!.scrollWidth).toBeLessThanOrEqual(dialog()!.clientWidth);
  });
});

test("dirty settings set $cmsNativeDirty; Back, another collection and Classic CMS ask first (review)", async () => {
  await openSettings();
  const leaves: Array<() => Promise<void>> = [
    () => click(byLabel("Back")),
    () =>
      click(
        document.querySelector<HTMLElement>(
          '[data-cms-collection="people"] button'
        )
      ),
    async () => {
      await click(byLabel("CMS menu"));
      await click(menuItem("Classic CMS"));
    },
  ];
  for (const leave of leaves) {
    await typeInto(input("name"), "Articles");
    expect($cmsNativeDirty.get()).toBe(true);
    await leave();
    expect(hasText("Discard unsaved changes?")).toBe(true);
    await keepEditing();
    expect(settingsView()).not.toBeNull();
    expect(input("name")?.value).toBe("Articles");
    expect(currentSlug()).toBe("posts");
  }
  expect(harness.props.onShowClassic).not.toHaveBeenCalled();
});
