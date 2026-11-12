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
import type { CmsErrorCode } from "./cms-source";
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
