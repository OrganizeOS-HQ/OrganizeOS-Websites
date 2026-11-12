// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { toast, TooltipProvider } from "@webstudio-is/design-system";
import { CmsScreen, type CmsScreenProps } from "./cms-screen";
import { $cmsNativeDirty, refreshCmsNative } from "./cms-native-stores";
import type { CmsErrorCode, CmsItem, CmsResult } from "./cms-source";
import {
  createFakeCmsSource,
  itemOf,
  PEOPLE,
  POSTS,
  POSTS_DETAIL,
  type FakeCmsSource,
} from "./fake-cms-source";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;
let fake: FakeCmsSource;
let props: CmsScreenProps;

const draw = (overrides: Partial<CmsScreenProps> = {}) => {
  props = { ...props, ...overrides };
  act(() => {
    root?.render(
      createElement(TooltipProvider, null, createElement(CmsScreen, props))
    );
  });
};

const mount = (overrides: Partial<CmsScreenProps> = {}) => {
  container = document.createElement("div");
  // the overlay's box: everything right of the rail
  container.style.width = "1200px";
  container.style.height = "800px";
  document.body.appendChild(container);
  root = createRoot(container);
  draw(overrides);
};

// Lets the fake source's answers, and what they set, land.
const settle = async () => {
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

const screen = () =>
  document.querySelector<HTMLElement>("[data-cms-native-screen]");

const rowOf = (slug: string) =>
  document.querySelector<HTMLElement>(`[data-cms-collection="${slug}"]`);

const rowSlugs = () =>
  [...document.querySelectorAll<HTMLElement>("[data-cms-collection]")].map(
    (row) => row.dataset.cmsCollection
  );

const currentSlug = () =>
  document.querySelector<HTMLElement>("[data-cms-collection][data-current]")
    ?.dataset.cmsCollection;

const titleInput = () =>
  document.querySelector<HTMLInputElement>("#cms-field-title");

const byLabel = (label: string) =>
  document.querySelector<HTMLElement>(`[aria-label="${label}"]`);

const buttonByText = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === text
  );

const hasText = (text: string) =>
  document.body.textContent?.includes(text) ?? false;

const reopen = async () => {
  draw({ isVisible: false });
  draw({ isVisible: true });
  await settle();
};

/** Opens the Posts item and types "Mine" over its Title. */
const editTitle = async () => {
  await act(async () =>
    userEvent.click(document.querySelector<HTMLElement>("[data-cms-item-id]")!)
  );
  await settle();
  expect(titleInput()?.value).toBe("Hello");
  await act(async () => userEvent.clear(titleInput()!));
  await act(async () => userEvent.type(titleInput()!, "Mine"));
  await settle();
  expect(titleInput()?.value).toBe("Mine");
  expect($cmsNativeDirty.get()).toBe(true);
};

beforeEach(() => {
  fake = createFakeCmsSource();
  props = {
    source: fake,
    hidden: false,
    isVisible: true,
    onClose: vi.fn(),
    onShowClassic: vi.fn(),
  };
  $cmsNativeDirty.set(false);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  vi.restoreAllMocks();
});

describe("the screen in the overlay", () => {
  test("keeps W1's root, column title and main", async () => {
    mount();
    await settle();
    const root = screen();
    expect(root).not.toBeNull();
    expect(root?.hasAttribute("data-floating-panel-container")).toBe(true);
    expect(root?.getAttribute("tabindex")).toBe("-1");
    expect(root?.style.display).toBe("flex");
    const column = document.querySelector<HTMLElement>(
      "[data-cms-collections]"
    );
    expect(column?.getBoundingClientRect().width).toBe(240);
    expect(
      [...(column?.querySelectorAll<HTMLElement>("*") ?? [])].some(
        (element) =>
          element.childElementCount === 0 && element.textContent === "CMS"
      )
    ).toBe(true);
    expect(column?.querySelector('[aria-label="CMS menu"]')).not.toBeNull();
    expect(column?.querySelector('[aria-label="Close"]')).not.toBeNull();
    expect(root?.querySelector("[data-cms-native-main]")).not.toBeNull();
  });

  test("hidden, it is display none and keeps its state", async () => {
    mount();
    await settle();
    await act(async () => userEvent.click(rowOf("people")!));
    await settle();
    expect(currentSlug()).toBe("people");
    draw({ hidden: true, isVisible: false });
    await settle();
    expect(screen()?.style.display).toBe("none");
    expect(currentSlug()).toBe("people");
    draw({ hidden: false, isVisible: true });
    await settle();
    expect(screen()?.style.display).toBe("flex");
    expect(currentSlug()).toBe("people");
  });

  test("without a source it draws the column title only and calls nothing", async () => {
    mount({ source: undefined });
    await settle();
    expect(screen()).not.toBeNull();
    expect(byLabel("CMS menu")).not.toBeNull();
    expect(rowSlugs()).toEqual([]);
    for (const method of Object.values(fake)) {
      expect(method).not.toHaveBeenCalled();
    }
  });

  test("lists every collection with its count, private ones included, and opens the first", async () => {
    mount();
    await settle();
    expect(rowSlugs()).toEqual(["posts", "people"]);
    expect(rowOf("posts")?.textContent).toBe("Posts2");
    expect(rowOf("people")?.textContent).toBe("People1");
    expect(currentSlug()).toBe("posts");
    expect(fake.listItems).toHaveBeenCalledWith(POSTS.id, {
      q: undefined,
      page: 1,
    });
  });

  test("arrow keys move between rows, and Enter opens one", async () => {
    mount();
    await settle();
    const button = (slug: string) =>
      rowOf(slug)?.querySelector<HTMLElement>("button") ?? rowOf(slug);
    act(() => {
      button("posts")?.focus();
    });
    await act(async () => userEvent.keyboard("{ArrowDown}"));
    expect(rowOf("people")?.contains(document.activeElement)).toBe(true);
    await act(async () => userEvent.keyboard("{Enter}"));
    await settle();
    expect(currentSlug()).toBe("people");
    expect(fake.listItems).toHaveBeenCalledWith(PEOPLE.id, {
      q: undefined,
      page: 1,
    });
  });

  test("reads E0 and E1 on open, and on each reopen refetches E0, E1, the open fields and the open page", async () => {
    mount();
    await settle();
    expect(fake.getAccess).toHaveBeenCalledTimes(1);
    expect(fake.listCollections).toHaveBeenCalledTimes(1);
    expect(fake.getCollection).toHaveBeenCalledTimes(1);
    expect(fake.listItems).toHaveBeenCalledTimes(1);
    await reopen();
    expect(fake.getAccess).toHaveBeenCalledTimes(2);
    expect(fake.listCollections).toHaveBeenCalledTimes(2);
    expect(fake.getCollection).toHaveBeenCalledTimes(2);
    expect(fake.getCollection).toHaveBeenLastCalledWith(POSTS.id);
    expect(fake.listItems).toHaveBeenCalledTimes(2);
    expect(fake.listItems).toHaveBeenLastCalledWith(POSTS.id, {
      q: undefined,
      page: 1,
    });
  });

  test("a write in the classic frame refetches E1, the open fields and the open page, not E0", async () => {
    mount();
    await settle();
    act(() => refreshCmsNative());
    await settle();
    expect(fake.getAccess).toHaveBeenCalledTimes(1);
    expect(fake.listCollections).toHaveBeenCalledTimes(2);
    expect(fake.getCollection).toHaveBeenCalledTimes(2);
    expect(fake.listItems).toHaveBeenCalledTimes(2);
  });

  test("Close calls onClose", async () => {
    mount();
    await settle();
    await act(async () => userEvent.click(byLabel("Close")!));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  test("a 120-character name with no space truncates in its row, with the full name in a tooltip", async () => {
    const name = "N".repeat(120);
    fake.listCollections.mockResolvedValue({
      collections: [{ ...POSTS, name }],
    });
    mount();
    await settle();
    const row = rowOf("posts")!;
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
    const nameElement = [...row.querySelectorAll<HTMLElement>("*")].find(
      (element) =>
        element.childElementCount === 0 && element.textContent === name
    )!;
    expect(nameElement).toBeDefined();
    expect(nameElement.scrollWidth).toBeGreaterThan(nameElement.clientWidth);
    await act(async () => userEvent.hover(nameElement));
    await vi.waitFor(
      () => {
        const tooltip = document.querySelector('[role="tooltip"]');
        expect(tooltip?.textContent).toBe(name);
      },
      { timeout: 3000 }
    );
  });
});

describe("a background refetch never drops an edit", () => {
  test("a background refetch that fails keeps the open editor and its edits", async () => {
    const error = vi.spyOn(toast, "error");
    mount();
    await settle();
    await editTitle();
    fake.getCollection.mockResolvedValue({ error: "unavailable" });
    fake.listItems.mockResolvedValue({ error: "unavailable" });
    act(() => refreshCmsNative());
    await settle();
    expect(fake.getCollection).toHaveBeenCalledTimes(2);
    expect(titleInput()?.value).toBe("Mine");
    expect($cmsNativeDirty.get()).toBe(true);
    expect(hasText("Try again in a minute")).toBe(false);
    expect(error).not.toHaveBeenCalled();

    await reopen();
    expect(fake.getCollection).toHaveBeenCalledTimes(3);
    expect(titleInput()?.value).toBe("Mine");
    expect($cmsNativeDirty.get()).toBe(true);
    expect(hasText("Try again in a minute")).toBe(false);
    expect(error).not.toHaveBeenCalled();
  });

  test("a reopen whose E1 no longer lists the open collection keeps the open editor", async () => {
    mount();
    await settle();
    await editTitle();
    fake.listCollections.mockResolvedValue({ collections: [PEOPLE] });
    await reopen();
    expect(titleInput()?.value).toBe("Mine");
    expect($cmsNativeDirty.get()).toBe(true);
    expect(currentSlug()).toBeUndefined();
    await act(async () => userEvent.click(byLabel("Back")!));
    await settle();
    await act(async () => userEvent.click(buttonByText("Discard")!));
    await settle();
    expect(titleInput()).toBeNull();
    expect(currentSlug()).toBe("people");
    expect(fake.listItems).toHaveBeenLastCalledWith(PEOPLE.id, {
      q: undefined,
      page: 1,
    });
  });
});

const HOME = "https://app.example.org/acme";

const line = () => document.querySelector<HTMLElement>("[data-cms-refusal]");

const lineButtons = () =>
  [...(line()?.querySelectorAll<HTMLButtonElement>("button") ?? [])].map(
    (button) => button.textContent
  );

const click = async (element: HTMLElement | null | undefined) => {
  expect(element).toBeTruthy();
  await act(async () => userEvent.click(element!));
  await settle();
};

/** Whether the editor is drawn: a view hidden under a line is not. */
const isEditorShown = () =>
  document.querySelector<HTMLElement>("[data-cms-editor]")?.checkVisibility() ??
  false;

describe("refusals on a load", () => {
  test("unauthorized: Signed out of OrganizeOS, one button Open OrganizeOS, no Retry; it goes to the home address", async () => {
    fake.getAccess.mockResolvedValue({ error: "unauthorized" });
    const navigate = vi.fn();
    mount({ homeUrl: HOME, navigate });
    await settle();
    expect(line()?.textContent).toContain("Signed out of OrganizeOS");
    expect(lineButtons()).toEqual(["Open OrganizeOS"]);
    await click(buttonByText("Open OrganizeOS"));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(HOME);
  });

  test("mfa_required: Two-step sign-in required, Open OrganizeOS in a new tab, then Retry, which asks E0 again", async () => {
    fake.getAccess.mockResolvedValue({ error: "mfa_required" });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const navigate = vi.fn();
    mount({ homeUrl: HOME, navigate });
    await settle();
    expect(line()?.textContent).toContain("Two-step sign-in required");
    expect(lineButtons()).toEqual(["Open OrganizeOS", "Retry"]);
    await click(buttonByText("Open OrganizeOS"));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(HOME, "_blank", "noopener,noreferrer");
    expect(navigate).not.toHaveBeenCalled();
    expect(fake.getAccess).toHaveBeenCalledTimes(1);
    await click(buttonByText("Retry"));
    expect(fake.getAccess).toHaveBeenCalledTimes(2);
  });

  test("forbidden: No access to the CMS, with Retry", async () => {
    fake.getAccess.mockResolvedValue({ error: "forbidden" });
    mount({ homeUrl: HOME });
    await settle();
    expect(line()?.textContent).toBe("No access to the CMSRetry");
    expect(lineButtons()).toEqual(["Retry"]);
    fake.getAccess.mockResolvedValue({
      canEdit: true,
      canPublish: true,
      canManageSettings: true,
    });
    await click(buttonByText("Retry"));
    expect(line()).toBeNull();
    expect(rowSlugs()).toEqual(["posts", "people"]);
  });

  test("plan: the Not in plan chip, no button, and no line text", async () => {
    fake.getAccess.mockResolvedValue({ error: "plan" });
    mount({ homeUrl: HOME });
    await settle();
    const chip = line()?.querySelector<HTMLElement>("[data-cms-chip]");
    expect(chip?.tagName).toBe("SPAN");
    expect(chip?.textContent).toBe("Not in plan");
    expect(line()?.textContent).toBe("Not in plan");
    expect(lineButtons()).toEqual([]);
    expect(hasText("Not in your plan")).toBe(false);
  });

  test.each(["unavailable", "refused", "rate_limited", "updating"] as const)(
    "a first load answered %s: Try again in a minute, with Retry",
    async (error) => {
      fake.getAccess.mockResolvedValue({ error });
      mount({ homeUrl: HOME });
      await settle();
      expect(line()?.textContent).toBe("Try again in a minute" + "Retry");
      expect(lineButtons()).toEqual(["Retry"]);
    }
  );
});

describe("refusals on a write", () => {
  test.each([
    "rate_limited",
    "unavailable",
    "updating",
    "replayed",
    "refused",
  ] as const)(
    "a Save answered %s: the toast Try again in a minute; the editor keeps its values",
    async (error) => {
      const toastError = vi.spyOn(toast, "error");
      mount({ homeUrl: HOME });
      await settle();
      await editTitle();
      fake.updateItem.mockResolvedValue({ error });
      await click(buttonByText("Save"));
      expect(toastError).toHaveBeenCalledWith("Try again in a minute");
      expect(line()).toBeNull();
      expect(isEditorShown()).toBe(true);
      expect(titleInput()?.value).toBe("Mine");
      expect($cmsNativeDirty.get()).toBe(true);
    }
  );

  test.each([
    ["limit", "Item limit reached"],
    ["forbidden", "No access"],
    ["plan", "Not in plan"],
    ["not_found", "Item not found"],
  ] as const)(
    "a Save answered %s: the toast %s, no line; the editor keeps its values",
    async (error, text) => {
      const toastError = vi.spyOn(toast, "error");
      mount({ homeUrl: HOME });
      await settle();
      await editTitle();
      fake.updateItem.mockResolvedValue({ error: error as CmsErrorCode });
      await click(buttonByText("Save"));
      expect(toastError).toHaveBeenCalledWith(text);
      expect(line()).toBeNull();
      expect(isEditorShown()).toBe(true);
      expect(titleInput()?.value).toBe("Mine");
      expect($cmsNativeDirty.get()).toBe(true);
    }
  );

  test("an upload answered unauthorized shows Signed out of OrganizeOS, and the edits are kept", async () => {
    fake.getCollection.mockResolvedValue({
      collection: {
        ...POSTS_DETAIL,
        fields: [
          ...POSTS_DETAIL.fields,
          { key: "cover", label: "Cover", kind: "image" },
        ],
      },
    });
    fake.uploadImage.mockResolvedValue({ error: "unauthorized" });
    mount({ homeUrl: HOME, navigate: vi.fn() });
    await settle();
    await editTitle();
    const input = document
      .querySelector<HTMLElement>('[data-cms-field="cms-field-cover"]')
      ?.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" })
    );
    await act(async () => {
      input!.files = transfer.files;
      input!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    await vi.waitFor(() =>
      expect(line()?.textContent).toContain("Signed out of OrganizeOS")
    );
    expect(isEditorShown()).toBe(false);
    expect(titleInput()?.value).toBe("Mine");
    expect($cmsNativeDirty.get()).toBe(true);
    expect(hasText("Not uploaded")).toBe(false);
  });

  // Review Focus 4
  test("a Save answered unauthorized hides the view, keeps the edits, and Open OrganizeOS asks first", async () => {
    let dirtyAtNavigate: boolean | undefined;
    const navigate = vi.fn(() => {
      dirtyAtNavigate = $cmsNativeDirty.get();
    });
    mount({ homeUrl: HOME, navigate });
    await settle();
    await editTitle();
    fake.updateItem.mockResolvedValue({ error: "unauthorized" });
    await click(buttonByText("Save"));
    expect(line()?.textContent).toContain("Signed out of OrganizeOS");
    expect(lineButtons()).toEqual(["Open OrganizeOS"]);
    expect(isEditorShown()).toBe(false);
    expect(titleInput()?.value).toBe("Mine");
    expect($cmsNativeDirty.get()).toBe(true);

    await click(buttonByText("Open OrganizeOS"));
    expect(hasText("Discard unsaved changes?")).toBe(true);
    await click(buttonByText("Keep editing"));
    expect(navigate).not.toHaveBeenCalled();
    expect($cmsNativeDirty.get()).toBe(true);
    await vi.waitFor(() =>
      expect(hasText("Discard unsaved changes?")).toBe(false)
    );

    await click(buttonByText("Open OrganizeOS"));
    expect(hasText("Discard unsaved changes?")).toBe(true);
    await click(buttonByText("Discard"));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(HOME);
    expect(dirtyAtNavigate).toBe(false);
  });

  test("after a write, the counts and the open page refetch", async () => {
    mount({ homeUrl: HOME });
    await settle();
    await editTitle();
    fake.updateItem.mockResolvedValue({
      item: itemOf({
        data: { title: "Mine", summary: null, author: null },
        updatedAt: "2026-11-12T10:00:02.5+00:00",
      }),
    });
    const collections = fake.listCollections.mock.calls.length;
    const pages = fake.listItems.mock.calls.length;
    await click(buttonByText("Save"));
    expect(fake.updateItem).toHaveBeenCalledTimes(1);
    expect(fake.listCollections).toHaveBeenCalledTimes(collections + 1);
    expect(fake.listItems).toHaveBeenCalledTimes(pages + 1);
    expect(fake.listItems).toHaveBeenLastCalledWith(POSTS.id, {
      q: undefined,
      page: 1,
    });
  });
});

const ID = itemOf().id;

const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (item) => item.textContent === label
  );

/** Opens the column's CMS menu and chooses one of its items. */
const chooseMenuItem = async (menu: string, label: string) => {
  await click(byLabel(menu));
  await click(menuItem(label));
};

const openItem = async () => {
  await click(document.querySelector<HTMLElement>("[data-cms-item-id]"));
  expect(titleInput()?.value).toBe("Hello");
};

const dialogShown = () => hasText("Discard unsaved changes?");

const waitForNoDialog = () =>
  vi.waitFor(() => expect(dialogShown()).toBe(false));

describe("the unsaved guard, and Classic CMS's deep link", () => {
  test.each([
    [
      "Back",
      () => click(byLabel("Back")),
      () => expect(titleInput()).toBeNull(),
    ],
    [
      "another collection",
      () => click(rowOf("people")?.querySelector("button")),
      () => {
        expect(titleInput()).toBeNull();
        expect(currentSlug()).toBe("people");
      },
    ],
    [
      "the open collection's row",
      () => click(rowOf("posts")?.querySelector("button")),
      () => {
        expect(titleInput()).toBeNull();
        expect(currentSlug()).toBe("posts");
      },
    ],
    [
      "Classic CMS",
      () => chooseMenuItem("CMS menu", "Classic CMS"),
      () => {
        expect(props.onShowClassic).toHaveBeenCalledTimes(1);
        expect(props.onShowClassic).toHaveBeenCalledWith({
          collection: "posts",
          item: ID,
        });
      },
    ],
  ] as const)(
    "%s asks Discard unsaved changes?; Keep editing stays, Discard goes",
    async (_name, run, ran) => {
      mount();
      await settle();
      await editTitle();

      await run();
      expect(dialogShown()).toBe(true);
      await click(buttonByText("Keep editing"));
      await waitForNoDialog();
      expect(titleInput()?.value).toBe("Mine");
      expect($cmsNativeDirty.get()).toBe(true);
      expect(props.onShowClassic).not.toHaveBeenCalled();

      await run();
      expect(dialogShown()).toBe(true);
      await click(buttonByText("Discard"));
      expect($cmsNativeDirty.get()).toBe(false);
      // Classic CMS runs once the dialog has closed
      await vi.waitFor(ran);
    }
  );

  test("nothing unsaved: no dialog", async () => {
    mount();
    await settle();
    await openItem();
    await click(byLabel("Back"));
    expect(dialogShown()).toBe(false);
    expect(titleInput()).toBeNull();
    await openItem();
    await chooseMenuItem("CMS menu", "Classic CMS");
    expect(dialogShown()).toBe(false);
    expect(props.onShowClassic).toHaveBeenCalledTimes(1);
  });

  test("Classic CMS passes the open collection and item, once the menu has closed", async () => {
    mount();
    await settle();
    // from the table: the open collection only
    await chooseMenuItem("CMS menu", "Classic CMS");
    expect(props.onShowClassic).toHaveBeenCalledTimes(1);
    expect(props.onShowClassic).toHaveBeenLastCalledWith({
      collection: "posts",
    });
    await vi.waitFor(() => expect(menuItem("Classic CMS")).toBeUndefined());

    await openItem();
    await chooseMenuItem("CMS menu", "Classic CMS");
    expect(props.onShowClassic).toHaveBeenCalledTimes(2);
    expect(props.onShowClassic).toHaveBeenLastCalledWith({
      collection: "posts",
      item: ID,
    });
    await vi.waitFor(() => expect(menuItem("Classic CMS")).toBeUndefined());

    // a new item: the collection only
    await click(byLabel("Back"));
    await click(buttonByText("New item"));
    expect(titleInput()?.value).toBe("");
    await chooseMenuItem("CMS menu", "Classic CMS");
    expect(props.onShowClassic).toHaveBeenCalledTimes(3);
    expect(props.onShowClassic).toHaveBeenLastCalledWith({
      collection: "posts",
    });
  });

  test("hiding never discards: a hidden and reshown screen keeps the edit and $cmsNativeDirty", async () => {
    mount();
    await settle();
    await editTitle();
    expect(fake.getItem).toHaveBeenCalledTimes(1);
    draw({ hidden: true, isVisible: false });
    await settle();
    expect($cmsNativeDirty.get()).toBe(true);
    draw({ hidden: false, isVisible: true });
    await settle();
    expect(titleInput()?.value).toBe("Mine");
    expect($cmsNativeDirty.get()).toBe(true);
    expect(fake.getItem).toHaveBeenCalledTimes(1);
  });

  test("Discard before Classic CMS resets the editor, so the discarded edit is gone when the screen shows again", async () => {
    mount();
    await settle();
    await editTitle();
    await chooseMenuItem("CMS menu", "Classic CMS");
    expect(dialogShown()).toBe(true);
    await click(buttonByText("Discard"));
    await vi.waitFor(() =>
      expect(props.onShowClassic).toHaveBeenCalledTimes(1)
    );
    draw({ hidden: true, isVisible: false });
    await settle();
    draw({ hidden: false, isVisible: true });
    await settle();
    expect(titleInput()?.value).toBe("Hello");
    expect(buttonByText("Save")?.disabled).toBe(true);
    expect($cmsNativeDirty.get()).toBe(false);
    await waitForNoDialog();
    await click(byLabel("Back"));
    expect(dialogShown()).toBe(false);
    expect(titleInput()).toBeNull();
  });

  test("a clean editor refetches its item when the screen shows again", async () => {
    mount();
    await settle();
    await openItem();
    expect(fake.getItem).toHaveBeenCalledTimes(1);
    draw({ hidden: true, isVisible: false });
    await settle();
    fake.getItem.mockResolvedValue({
      item: itemOf({
        data: { title: "Theirs", summary: null, author: null },
        status: "published",
        hasStagedChanges: true,
        updatedAt: "2026-11-12T10:00:05+00:00",
      }),
    });
    act(() => refreshCmsNative());
    draw({ hidden: false, isVisible: true });
    await settle();
    expect(fake.getItem.mock.calls.length).toBeGreaterThan(1);
    expect(titleInput()?.value).toBe("Theirs");
    expect(
      document.querySelector("[data-cms-editor-header] [data-cms-status]")
        ?.textContent
    ).toBe("Staged changes");
    expect(buttonByText("Publish changes")?.disabled).toBe(false);
    expect($cmsNativeDirty.get()).toBe(false);
  });

  test("the read-only rich text's Classic CMS runs the guard and passes the open item", async () => {
    fake.getCollection.mockResolvedValue({
      collection: {
        ...POSTS_DETAIL,
        fields: [
          ...POSTS_DETAIL.fields,
          { key: "body", label: "Body", kind: "richtext" },
        ],
      },
    });
    fake.getItem.mockResolvedValue({
      item: itemOf({
        data: {
          title: "Hello",
          summary: null,
          author: null,
          body: {
            html: '<p>Text</p><p><img src="https://example.org/a.png" alt="A" /></p>',
          },
        },
      }),
    });
    mount();
    await settle();
    await editTitle();
    await vi.waitFor(() =>
      expect(hasText("Has images; edit in Classic CMS")).toBe(true)
    );
    await click(buttonByText("Classic CMS"));
    expect(dialogShown()).toBe(true);
    expect(props.onShowClassic).not.toHaveBeenCalled();
    await click(buttonByText("Discard"));
    await vi.waitFor(() =>
      expect(props.onShowClassic).toHaveBeenCalledTimes(1)
    );
    expect(props.onShowClassic).toHaveBeenCalledWith({
      collection: "posts",
      item: ID,
    });
  });
});

const conflictLine = () =>
  document.querySelector<HTMLElement>("[data-cms-conflict]");

/** Edits the Title to "Mine", then a Save answered `conflict`. */
const editIntoConflict = async () => {
  await editTitle();
  fake.updateItem.mockResolvedValue({ error: "conflict" });
  await click(buttonByText("Save"));
  expect(conflictLine()?.textContent).toContain("Changed by someone else");
  expect(buttonByText("Reload")).toBeTruthy();
};

/** Edits the Title to "Mine", then a Save whose answer was lost. */
const editIntoUnknownOutcome = async () => {
  await editTitle();
  fake.updateItem.mockResolvedValue({ error: "unavailable" });
};

describe("refusals on the reads that hold the person's values", () => {
  test.each([
    ["forbidden", "No access"],
    ["plan", "Not in plan"],
  ] as const)(
    "a Reload answered %s: the toast %s; the editor, its values and the conflict line stay",
    async (error, text) => {
      const toastError = vi.spyOn(toast, "error");
      mount({ homeUrl: HOME });
      await settle();
      await editIntoConflict();
      fake.getItem.mockResolvedValue({ error });
      await click(buttonByText("Reload"));
      expect(toastError).toHaveBeenCalledWith(text);
      expect(line()).toBeNull();
      expect(isEditorShown()).toBe(true);
      expect(titleInput()?.value).toBe("Mine");
      expect($cmsNativeDirty.get()).toBe(true);
      expect(conflictLine()?.textContent).toContain("Changed by someone else");
      expect(buttonByText("Reload")).toBeTruthy();
    }
  );

  test("a Reload answered unauthorized shows Signed out of OrganizeOS, and the edits are kept", async () => {
    mount({ homeUrl: HOME, navigate: vi.fn() });
    await settle();
    await editIntoConflict();
    fake.getItem.mockResolvedValue({ error: "unauthorized" });
    await click(buttonByText("Reload"));
    expect(line()?.textContent).toContain("Signed out of OrganizeOS");
    expect(isEditorShown()).toBe(false);
    expect(titleInput()?.value).toBe("Mine");
    expect($cmsNativeDirty.get()).toBe(true);
  });

  test.each([
    ["forbidden", "No access"],
    ["plan", "Not in plan"],
  ] as const)(
    "the read after a lost answer, answered %s: the toast %s; the editor, its values and the conflict line stay",
    async (error, text) => {
      const toastError = vi.spyOn(toast, "error");
      mount({ homeUrl: HOME });
      await settle();
      await editIntoUnknownOutcome();
      fake.getItem.mockResolvedValue({ error });
      await click(buttonByText("Save"));
      expect(toastError).toHaveBeenCalledWith(text);
      expect(line()).toBeNull();
      expect(isEditorShown()).toBe(true);
      expect(titleInput()?.value).toBe("Mine");
      expect(conflictLine()?.textContent).toContain("Changed by someone else");
      expect(buttonByText("Reload")).toBeTruthy();
    }
  );

  test("the read after a lost answer, answered unauthorized, shows Signed out of OrganizeOS, and the edits are kept", async () => {
    mount({ homeUrl: HOME, navigate: vi.fn() });
    await settle();
    await editIntoUnknownOutcome();
    fake.getItem.mockResolvedValue({ error: "unauthorized" });
    await click(buttonByText("Save"));
    expect(line()?.textContent).toContain("Signed out of OrganizeOS");
    expect(isEditorShown()).toBe(false);
    expect(titleInput()?.value).toBe("Mine");
    expect($cmsNativeDirty.get()).toBe(true);
  });

  test("opening an item answered forbidden still shows the screen's line", async () => {
    fake.getItem.mockResolvedValue({ error: "forbidden" });
    mount({ homeUrl: HOME });
    await settle();
    await click(document.querySelector<HTMLElement>("[data-cms-item-id]"));
    expect(line()?.textContent).toContain("No access to the CMS");
  });
});

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("answers that arrive after the screen moved on", () => {
  test("an item's first load survives a refetch of the fields while it is in flight", async () => {
    mount();
    await settle();
    const held = deferred<CmsResult<{ item: CmsItem }>>();
    fake.getItem.mockReturnValueOnce(held.promise);
    await click(document.querySelector<HTMLElement>("[data-cms-item-id]"));
    const fieldCalls = fake.getCollection.mock.calls.length;
    act(() => refreshCmsNative());
    await settle();
    expect(fake.getCollection.mock.calls.length).toBeGreaterThan(fieldCalls);
    await act(async () => held.resolve({ item: itemOf() }));
    await settle();
    expect(titleInput()?.value).toBe("Hello");
  });
});

describe("the builder's colour scheme", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-color-scheme");
  });

  const colorOf = (element: Element | null | undefined, property: string) => {
    expect(element).toBeTruthy();
    return getComputedStyle(element as Element).getPropertyValue(property);
  };

  // Label eases its color for 150 ms after the scheme changes; 300 ms covers it.
  const untilTransitionsEnd = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
  };

  const columnTitle = () =>
    [...document.querySelectorAll<HTMLElement>("*")].find(
      (element) =>
        element.children.length === 0 && element.textContent === "CMS"
    );

  const nameHeader = () =>
    [...document.querySelectorAll<HTMLElement>('[role="columnheader"] *')].find(
      (element) => element.textContent === "Name"
    );

  const readItemsView = () => [
    colorOf(columnTitle(), "color"),
    colorOf(nameHeader(), "color"),
  ];

  const readEditor = () => [
    colorOf(document.querySelector('label[for="cms-field-title"]'), "color"),
    colorOf(
      document.querySelector('[data-cms-status="Staged changes"]'),
      "background-color"
    ),
    colorOf(document.querySelector("#cms-field-slug"), "color"),
  ];

  // The chip is the design system's accent, the same in both schemes.
  const sameInBothSchemes = new Set(["editor:1"]);

  test("the screen follows the builder's scheme", async () => {
    fake.getItem.mockResolvedValue({
      item: itemOf({ status: "published", hasStagedChanges: true }),
    });
    mount();
    await settle();

    const itemsView: Record<string, string[]> = {};
    for (const scheme of ["light", "dark"]) {
      document.documentElement.setAttribute("data-color-scheme", scheme);
      await untilTransitionsEnd();
      itemsView[scheme] = readItemsView();
    }

    await openItem();
    const editor: Record<string, string[]> = {};
    for (const scheme of ["light", "dark"]) {
      document.documentElement.setAttribute("data-color-scheme", scheme);
      await untilTransitionsEnd();
      editor[scheme] = readEditor();
    }

    for (const [name, light, dark] of [
      ["items", itemsView.light, itemsView.dark],
      ["editor", editor.light, editor.dark],
    ] as const) {
      expect(light).toHaveLength(name === "items" ? 2 : 3);
      light.forEach((color, index) => {
        expect(color).not.toBe("");
        expect(color).not.toBe("rgba(0, 0, 0, 0)");
        expect(dark[index]).not.toBe("");
        expect(dark[index]).not.toBe("rgba(0, 0, 0, 0)");
        if (sameInBothSchemes.has(`${name}:${index}`) === false) {
          expect(color).not.toBe(dark[index]);
        }
      });
    }
  });
});
