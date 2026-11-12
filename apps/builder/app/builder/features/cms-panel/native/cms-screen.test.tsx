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
import {
  createFakeCmsSource,
  PEOPLE,
  POSTS,
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
