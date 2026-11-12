// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { toast, TooltipProvider } from "@webstudio-is/design-system";
import { CmsScreen, type CmsScreenProps } from "./cms-screen";
import { refreshCmsNative } from "./cms-native-stores";
import type { CmsItemsPage, CmsResult } from "./cms-source";
import {
  createFakeCmsSource,
  itemOf,
  PEOPLE,
  POSTS,
  rowOf,
  type FakeCmsSource,
} from "./fake-cms-source";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;
let fake: FakeCmsSource;

const mount = (overrides: Partial<CmsScreenProps> = {}) => {
  container = document.createElement("div");
  // the overlay's box: everything right of the rail
  container.style.width = "1200px";
  container.style.height = "800px";
  document.body.appendChild(container);
  root = createRoot(container);
  const props: CmsScreenProps = {
    source: fake,
    hidden: false,
    isVisible: true,
    onClose: vi.fn(),
    onShowClassic: vi.fn(),
    ...overrides,
  };
  act(() => {
    root?.render(
      createElement(TooltipProvider, null, createElement(CmsScreen, props))
    );
  });
};

// Lets the fake source's answers, and what they set, land.
const settle = async () => {
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

const wait = async (ms: number) => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
  await settle();
};

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const byLabel = (label: string) =>
  document.querySelector<HTMLElement>(`[aria-label="${label}"]`);

const itemRows = () => [
  ...document.querySelectorAll<HTMLElement>("[data-cms-item]"),
];

const itemSlugs = () => itemRows().map((row) => row.dataset.cmsItem);

const buttonByText = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === text
  );

const pagerText = () =>
  document.querySelector<HTMLElement>("[data-cms-pager]")?.textContent;

const searchInput = () =>
  byLabel("Search Posts")?.querySelector("input") ??
  (byLabel("Search Posts") as HTMLInputElement | null);

const lastListItemsCall = () => fake.listItems.mock.calls.at(-1);

/** E3's answer for a page of `total` items, 50 to a page. */
const pageOf = (page: number, total: number): CmsItemsPage => {
  const first = (page - 1) * 50;
  const count = Math.max(0, Math.min(50, total - first));
  return {
    items: Array.from({ length: count }, (_, index) =>
      rowOf(
        itemOf({
          id: `00000000-0000-4000-8000-${String(first + index).padStart(12, "0")}`,
          slug: `item-${first + index + 1}`,
          data: { title: `Item ${first + index + 1}` },
        })
      )
    ),
    total,
    page,
  };
};

const crumbParts = () => {
  const crumb = document.querySelector<HTMLElement>("[data-cms-crumb]");
  const parts = [...(crumb?.children ?? [])].map(
    (element) => element.textContent
  );
  // the collection part, then the item part, apart from the "/" between
  return { collection: parts[0], item: parts[2] };
};

beforeEach(() => {
  fake = createFakeCmsSource();
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

describe("the items view", () => {
  test("the table has Name, Status and Modified, 32 px rows", async () => {
    fake.listItems.mockImplementation(async () => pageOf(1, 3));
    mount();
    await settle();
    expect(
      [...document.querySelectorAll('[role="columnheader"]')].map(
        (header) => header.textContent
      )
    ).toEqual(["Name", "Status", "Modified"]);
    expect(itemRows()).toHaveLength(3);
    for (const row of itemRows()) {
      expect(row.getBoundingClientRect().height).toBe(32);
    }
  });

  test("search asks E3 for page 1 with the term 250 ms after the last keystroke", async () => {
    mount();
    await settle();
    fake.listItems.mockClear();
    await act(async () => userEvent.type(searchInput()!, "new"));
    expect(fake.listItems).not.toHaveBeenCalled();
    await wait(300);
    expect(fake.listItems.mock.calls).toEqual([
      [POSTS.id, { q: "new", page: 1 }],
    ]);
  });

  test("Escape clears the search", async () => {
    mount();
    await settle();
    await act(async () => userEvent.type(searchInput()!, "new"));
    await wait(300);
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: "new", page: 1 }]);
    await act(async () => userEvent.keyboard("{Escape}"));
    await wait(50);
    expect(searchInput()?.value).toBe("");
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: undefined, page: 1 }]);
  });

  test("paging shows 1-50 of 120, Next asks page 2 and shows 51-100 of 120", async () => {
    fake.listItems.mockImplementation(async (_, { page }) =>
      pageOf(page ?? 1, 120)
    );
    mount();
    await settle();
    expect(pagerText()).toBe("1-50 of 120");
    expect(itemRows()).toHaveLength(50);
    expect((byLabel("Previous") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => userEvent.click(byLabel("Next")!));
    await settle();
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: undefined, page: 2 }]);
    expect(pagerText()).toBe("51-100 of 120");
    await act(async () => userEvent.click(byLabel("Next")!));
    await settle();
    expect(pagerText()).toBe("101-120 of 120");
    expect(itemRows()).toHaveLength(20);
    expect((byLabel("Next") as HTMLButtonElement).disabled).toBe(true);
  });

  test("a page change that fails keeps the drawn page, and Next asks the next page again", async () => {
    const toastError = vi.spyOn(toast, "error");
    fake.listItems.mockImplementation(async (_, { page }) =>
      pageOf(page ?? 1, 120)
    );
    mount();
    await settle();
    expect(pagerText()).toBe("1-50 of 120");
    const calls = fake.listItems.mock.calls.length;
    fake.listItems.mockResolvedValueOnce({ error: "unavailable" });
    await act(async () => userEvent.click(byLabel("Next")!));
    await settle();
    expect(fake.listItems).toHaveBeenCalledTimes(calls + 1);
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: undefined, page: 2 }]);
    expect(toastError).toHaveBeenCalledWith("Try again in a minute");
    expect(pagerText()).toBe("1-50 of 120");
    await act(async () => userEvent.click(byLabel("Next")!));
    await settle();
    expect(fake.listItems).toHaveBeenCalledTimes(calls + 2);
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: undefined, page: 2 }]);
    expect(pagerText()).toBe("51-100 of 120");
  });

  test("after a failed search, a failed page change keeps the pager working", async () => {
    fake.listItems.mockImplementation(async (_, { page }) =>
      pageOf(page ?? 1, 120)
    );
    mount();
    await settle();
    expect(pagerText()).toBe("1-50 of 120");
    fake.listItems.mockResolvedValueOnce({ error: "unavailable" });
    await act(async () => userEvent.type(searchInput()!, "x"));
    await wait(300);
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: "x", page: 1 }]);
    fake.listItems.mockResolvedValueOnce({ error: "unavailable" });
    await act(async () => userEvent.click(byLabel("Next")!));
    await settle();
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: "x", page: 2 }]);
    const calls = fake.listItems.mock.calls.length;
    await act(async () => userEvent.click(byLabel("Next")!));
    await settle();
    expect(fake.listItems).toHaveBeenCalledTimes(calls + 1);
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: "x", page: 2 }]);
  });

  test("with page 2 drawn, a failed search keeps Previous working", async () => {
    fake.listItems.mockImplementation(async (_, { page }) =>
      pageOf(page ?? 1, 120)
    );
    mount();
    await settle();
    await act(async () => userEvent.click(byLabel("Next")!));
    await settle();
    expect(pagerText()).toBe("51-100 of 120");
    fake.listItems.mockResolvedValueOnce({ error: "unavailable" });
    await act(async () => userEvent.type(searchInput()!, "x"));
    await wait(300);
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: "x", page: 1 }]);
    expect(pagerText()).toBe("51-100 of 120");
    const calls = fake.listItems.mock.calls.length;
    await act(async () => userEvent.click(byLabel("Previous")!));
    await settle();
    expect(fake.listItems).toHaveBeenCalledTimes(calls + 1);
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: "x", page: 1 }]);
  });

  test.each(["click", "Enter"])("a row opens its editor by %s", async (how) => {
    mount();
    await settle();
    const row = document.querySelector<HTMLElement>("[data-cms-item-id]")!;
    const id = row.dataset.cmsItemId;
    if (how === "click") {
      await act(async () => userEvent.click(row));
    } else {
      act(() => {
        row.focus();
      });
      await act(async () => userEvent.keyboard("{Enter}"));
    }
    await settle();
    expect(fake.getItem).toHaveBeenCalledWith(POSTS.id, id);
    expect(crumbParts()).toEqual({ collection: "Posts", item: "Hello" });
  });

  test("New item shows only with canEdit", async () => {
    mount();
    await settle();
    expect(buttonByText("New item")).toBeDefined();
    act(() => {
      root?.unmount();
    });
    container?.remove();
    fake = createFakeCmsSource();
    fake.getAccess.mockImplementation(async () => ({
      canEdit: false,
      canPublish: false,
      canManageSettings: false,
    }));
    mount();
    await settle();
    expect(itemRows()).toHaveLength(1);
    expect(buttonByText("New item")).toBeUndefined();
  });

  test("a search with no match shows one line, No matches; an empty collection shows New item and no line", async () => {
    fake.listItems.mockImplementation(async (_, { q }) =>
      q === undefined ? pageOf(1, 1) : { items: [], total: 0, page: 1 }
    );
    mount();
    await settle();
    await act(async () => userEvent.type(searchInput()!, "zzz"));
    await wait(300);
    const main = document.querySelector<HTMLElement>("[data-cms-native-main]");
    expect(itemRows()).toHaveLength(0);
    expect(main?.textContent).toContain("No matches");
    expect(main?.textContent?.split("No matches")).toHaveLength(2);
    expect(document.querySelector('[role="columnheader"]')).toBeNull();

    act(() => {
      root?.unmount();
    });
    container?.remove();
    fake = createFakeCmsSource();
    fake.listCollections.mockImplementation(async () => ({
      collections: [{ ...POSTS, total: 0 }, PEOPLE],
    }));
    fake.listItems.mockImplementation(async () => ({
      items: [],
      total: 0,
      page: 1,
    }));
    mount();
    await settle();
    const emptyMain = document.querySelector<HTMLElement>(
      "[data-cms-native-main]"
    );
    expect(buttonByText("New item")).toBeDefined();
    expect(emptyMain?.textContent).not.toContain("No matches");
    expect(emptyMain?.querySelector("input")).toBeNull();
    expect(emptyMain?.querySelector('[role="columnheader"]')).toBeNull();
  });

  // Review Focus 2
  test("only the latest choice's answer is drawn", async () => {
    const postsAnswer = deferred<CmsResult<CmsItemsPage>>();
    const peopleAnswer = deferred<CmsResult<CmsItemsPage>>();
    fake.listItems.mockImplementation((collectionId) =>
      collectionId === POSTS.id ? postsAnswer.promise : peopleAnswer.promise
    );
    mount();
    await settle();
    expect(fake.listItems).toHaveBeenLastCalledWith(POSTS.id, {
      q: undefined,
      page: 1,
    });
    const peopleButton =
      document
        .querySelector<HTMLElement>('[data-cms-collection="people"]')
        ?.querySelector<HTMLElement>("button") ?? null;
    await act(async () => userEvent.click(peopleButton!));
    await settle();
    expect(fake.listItems).toHaveBeenLastCalledWith(PEOPLE.id, {
      q: undefined,
      page: 1,
    });
    peopleAnswer.resolve({
      items: [rowOf(itemOf({ id: PEOPLE.id, slug: "ada" }))],
      total: 1,
      page: 1,
    });
    await settle();
    postsAnswer.resolve(pageOf(1, 3));
    await settle();
    expect(itemSlugs()).toEqual(["ada"]);
  });

  // Review Focus 3
  test("a page past the end shows the page E3 answered", async () => {
    let total = 120;
    fake.listItems.mockImplementation(async (_, { page = 1 }) => {
      const last = Math.ceil(total / 50);
      return pageOf(Math.min(page, last), total);
    });
    mount();
    await settle();
    await act(async () => userEvent.click(byLabel("Next")!));
    await settle();
    await act(async () => userEvent.click(byLabel("Next")!));
    await settle();
    expect(pagerText()).toBe("101-120 of 120");
    // items deleted in Classic CMS: 60 left, two pages
    total = 60;
    act(() => {
      refreshCmsNative();
    });
    await settle();
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: undefined, page: 3 }]);
    expect(pagerText()).toBe("51-60 of 60");
    expect(itemRows()).toHaveLength(10);
    expect((byLabel("Next") as HTMLButtonElement).disabled).toBe(true);
    act(() => {
      refreshCmsNative();
    });
    await settle();
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: undefined, page: 2 }]);
    expect(pagerText()).toBe("51-60 of 60");
    await act(async () => userEvent.click(byLabel("Previous")!));
    await settle();
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: undefined, page: 1 }]);
    expect(pagerText()).toBe("1-50 of 60");
  });
});
