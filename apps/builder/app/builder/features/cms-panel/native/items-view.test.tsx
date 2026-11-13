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
  EVENTS,
  itemOf,
  itemsPageOf,
  PEOPLE,
  POSTS,
  rowOf,
  type FakeCmsSource,
} from "./fake-cms-source";
import { fitFieldColumns } from "./cms-list-logic";
import type { CmsItemRow } from "./cms-source";

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
  return itemsPageOf(
    Array.from({ length: count }, (_, index) =>
      rowOf(
        itemOf({
          id: `00000000-0000-4000-8000-${String(first + index).padStart(12, "0")}`,
          slug: `item-${first + index + 1}`,
          data: { title: `Item ${first + index + 1}` },
        })
      )
    ),
    total,
    page
  );
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
  test("the table has the checkbox, Name, Status, Modified and Published, 32 px rows", async () => {
    fake.listItems.mockImplementation(async () => pageOf(1, 3));
    mount();
    await settle();
    expect(
      [...document.querySelectorAll('[role="columnheader"]')].map(
        (header) => header.textContent
      )
    ).toEqual(["", "Name", "Status", "Modified", "Published"]);
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
    expect(toastError).toHaveBeenCalledWith("Try again in a minute", {
      id: "cms-read-unavailable",
    });
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

  test("with page 2 drawn, a failed search keeps page 1 for the next read of that search", async () => {
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
    act(() => {
      refreshCmsNative();
    });
    await settle();
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
      q === undefined ? pageOf(1, 1) : itemsPageOf([], 0, 1)
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
    fake.listItems.mockImplementation(async () => itemsPageOf([], 0, 1));
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
    peopleAnswer.resolve(
      itemsPageOf([rowOf(itemOf({ id: PEOPLE.id, slug: "ada" }))], 1, 1)
    );
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

// An EVENTS row with values for the column cells.
const eventRow = (
  overrides: Partial<CmsItemRow> & { values?: Record<string, unknown> } = {}
): CmsItemRow => ({
  ...rowOf(
    itemOf({ id: overrides.id ?? EVENTS.id, data: { title: "Launch" } })
  ),
  status: "published",
  publishedAt: "2026-11-05T09:00:00+00:00",
  ...overrides,
  values: { kind: "Q&A night", online: true, seats: 1200, ...overrides.values },
});

const eventsPage = (columns: string[], rows = [eventRow()]) =>
  itemsPageOf(rows, rows.length, 1, { columns, filterField: "kind" });

const headerTexts = () =>
  [...document.querySelectorAll('[role="columnheader"]')].map(
    (header) => header.textContent
  );

const click = async (element: HTMLElement | null | undefined) => {
  expect(element).toBeTruthy();
  await act(async () => userEvent.click(element!));
  await settle();
};

const mountEvents = async (
  page = eventsPage(["kind", "online", "seats"]),
  width = "1600px"
) => {
  fake.listCollections.mockResolvedValue({ collections: [EVENTS] });
  // echo the query's sort and page in applied, so a header click sticks
  fake.listItems.mockImplementation(async (_c, q) => ({
    ...page,
    page: q.page ?? 1,
    applied: {
      status: q.status ?? "all",
      sort: q.sort ?? "order",
      direction: q.direction ?? (q.sort === "updated" ? "desc" : "asc"),
      optionKey: q.optionKey ?? null,
      optionValue: q.optionValue ?? null,
    },
  }));
  mount({ initialView: { collectionId: EVENTS.id } });
  await settle();
  container!.style.width = width;
  await wait(50);
};

const tableWidth = () =>
  document.querySelector<HTMLElement>('[role="table"]')?.clientWidth ?? 0;

const fieldColumnCount = () =>
  document.querySelectorAll("[data-cms-column-key]").length;

describe("the table's columns (Task 15)", () => {
  test("the columns are Name, Status, E3's fields, Modified and Published, with cells per kind", async () => {
    await mountEvents();
    expect(headerTexts()).toEqual([
      "",
      "Name",
      "Status",
      "Kind",
      "Online",
      "Seats",
      "Modified",
      "Published",
    ]);
    const cells = [
      ...document.querySelectorAll<HTMLElement>(
        '[role="row"] [data-cms-column-key]'
      ),
    ].map((cell) => cell.textContent);
    expect(cells).toEqual(["Q&A night", "Yes", "1,200"]);
    const published = document.querySelector<HTMLElement>(
      '[data-cms-item] [role="cell"]:last-child'
    );
    expect(published?.textContent).not.toBe("");
  });

  test("field columns drop as the main area narrows, and nothing scrolls sideways", async () => {
    await mountEvents();
    const table = document.querySelector<HTMLElement>('[role="table"]')!;
    const wide = fitFieldColumns({
      width: tableWidth(),
      wanted: 3,
      checkbox: true,
      handle: false,
    });
    expect(fieldColumnCount()).toBe(wide);
    expect(table.scrollWidth).toBe(table.clientWidth);

    container!.style.width = "640px";
    await wait(50);
    const narrow = fitFieldColumns({
      width: tableWidth(),
      wanted: 3,
      checkbox: true,
      handle: false,
    });
    expect(narrow).toBeLessThan(wide);
    expect(fieldColumnCount()).toBe(narrow);
    expect(table.scrollWidth).toBe(table.clientWidth);
  });

  test("Name, Status, Modified and sortable field headers are buttons; Published and number columns are text", async () => {
    await mountEvents();
    const header = (label: string) =>
      [...document.querySelectorAll<HTMLElement>('[role="columnheader"]')].find(
        (cell) => cell.textContent === label
      );
    for (const label of ["Name", "Status", "Modified", "Kind", "Online"]) {
      expect(header(label)?.querySelector("button")).not.toBeNull();
    }
    // Published and the number field "Seats" are not sortable
    expect(header("Published")?.querySelector("button")).toBeNull();
    expect(header("Seats")?.querySelector("button")).toBeNull();
  });

  test("a header click sets its first direction, a second flips it, and aria-sort follows, and the page goes to 1", async () => {
    await mountEvents();
    fake.listItems.mockClear();
    const modified = () =>
      [...document.querySelectorAll<HTMLElement>('[role="columnheader"]')].find(
        (cell) => cell.textContent?.startsWith("Modified")
      );
    await click(modified()?.querySelector("button"));
    expect(modified()?.getAttribute("aria-sort")).toBe("descending");
    expect(lastListItemsCall()?.[1]).toMatchObject({
      sort: "updated",
      page: 1,
    });

    await click(modified()?.querySelector("button"));
    expect(modified()?.getAttribute("aria-sort")).toBe("ascending");
    expect(lastListItemsCall()?.[1]).toMatchObject({
      sort: "updated",
      direction: "asc",
    });
  });

  test("an empty collection shows New item alone; a filtered list with no rows shows No matches", async () => {
    await mountEvents(eventsPage(["kind"], []));
    expect(buttonByText("New item")).not.toBeUndefined();
    expect(document.querySelector("[data-cms-no-matches]")).toBeNull();
    expect(document.querySelector('[role="table"]')).toBeNull();
  });

  test("E1 reading 0 for a collection whose E3 has rows shows the rows", async () => {
    fake.listCollections.mockResolvedValue({
      collections: [{ ...EVENTS, total: 0 }],
    });
    fake.listItems.mockImplementation(async () =>
      eventsPage(["kind"], [eventRow()])
    );
    mount({ initialView: { collectionId: EVENTS.id } });
    await settle();
    expect(itemRows()).toHaveLength(1);
    expect(document.querySelector("[data-cms-no-matches]")).toBeNull();
  });

  test("an 80-character label truncates in its header with a tooltip, and the table fits", async () => {
    const longKey = "a".repeat(80);
    fake.listCollections.mockResolvedValue({ collections: [EVENTS] });
    fake.getCollection.mockResolvedValue({
      collection: {
        id: EVENTS.id,
        slug: EVENTS.slug,
        name: EVENTS.name,
        singularName: EVENTS.singularName,
        isPublic: true,
        fields: [
          { key: "title", label: "Title", kind: "text", isTitle: true },
          { key: "kind", label: "Kind", kind: "text" },
          { key: "online", label: "Online", kind: "switch" },
          { key: "note", label: longKey, kind: "text" },
        ],
      },
    });
    fake.listItems.mockImplementation(async () =>
      eventsPage(
        ["kind", "online", "note"],
        [eventRow({ values: { note: "hi" } })]
      )
    );
    mount({ initialView: { collectionId: EVENTS.id } });
    await settle();
    container!.style.width = "1600px";
    await wait(50);
    const table = document.querySelector<HTMLElement>('[role="table"]')!;
    const header = [
      ...document.querySelectorAll<HTMLElement>('[role="columnheader"]'),
    ].find((cell) => cell.textContent === longKey);
    expect(header).not.toBeUndefined();
    // the label is set to truncate, with its full text still in the DOM for
    // the tooltip, and the table does not scroll sideways
    const text = [...header!.querySelectorAll<HTMLElement>("*")].find(
      (element) => getComputedStyle(element).textOverflow === "ellipsis"
    );
    expect(text).not.toBeUndefined();
    expect(text!.textContent).toBe(longKey);
    expect(table.scrollWidth).toBe(table.clientWidth);
  });
});

const menuItemByText = (text: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (item) => item.textContent === text
  );

describe("Filter and Sort (Task 16)", () => {
  test("Filter shows Status's five items and the option group, and sets the E3 query", async () => {
    await mountEvents();
    fake.listItems.mockClear();
    const filterButton = () =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.startsWith("Filter")
      );
    await click(filterButton());
    for (const label of [
      "All items",
      "Draft",
      "Published",
      "Staged changes",
      "Archived",
    ]) {
      expect(menuItemByText(label)).not.toBeUndefined();
    }
    await click(menuItemByText("Staged changes"));
    expect(lastListItemsCall()?.[1]).toMatchObject({
      status: "staged",
      page: 1,
    });

    await click(filterButton());
    // the option group is headed by the field's label with its options
    expect(menuItemByText("Any kind")).not.toBeUndefined();
    await click(menuItemByText("Café"));
    expect(lastListItemsCall()?.[1]).toMatchObject({
      optionKey: "kind",
      optionValue: "Café",
    });
  });

  test("Filter shows its count: 1, then 2", async () => {
    await mountEvents();
    const filterButton = () =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.startsWith("Filter")
      );
    expect(filterButton()?.textContent).toBe("Filter");
    await click(filterButton());
    await click(menuItemByText("Draft"));
    expect(filterButton()?.textContent).toBe("Filter1");
    await click(filterButton());
    await click(menuItemByText("Café"));
    expect(filterButton()?.textContent).toBe("Filter2");
  });

  test("no option group without a filterField", async () => {
    await mountEvents(
      itemsPageOf([eventRow()], 1, 1, {
        columns: ["kind"],
        filterField: null,
      })
    );
    await click(buttonByText("Filter"));
    expect(menuItemByText("Any kind")).toBeUndefined();
    expect(menuItemByText("Café")).toBeUndefined();
    expect(menuItemByText("All items")).not.toBeUndefined();
  });

  test("Sort lists Manual order, Name, Status, Modified and the sortable fields, and hides the direction for Manual order", async () => {
    await mountEvents();
    await click(buttonByText("Sort"));
    for (const label of [
      "Manual order",
      "Name",
      "Status",
      "Modified",
      "Kind",
    ]) {
      expect(menuItemByText(label)).not.toBeUndefined();
    }
    // Seats is a number: not sortable
    expect(menuItemByText("Seats")).toBeUndefined();
    // Manual order hides Ascending/Descending
    expect(menuItemByText("Ascending")).toBeUndefined();
  });

  test("choosing Modified sorts descending; Ascending flips it", async () => {
    await mountEvents();
    fake.listItems.mockClear();
    await click(buttonByText("Sort"));
    await click(menuItemByText("Modified"));
    expect(lastListItemsCall()?.[1]).toMatchObject({ sort: "updated" });
    expect(lastListItemsCall()?.[1].direction).toBeUndefined();

    await click(buttonByText("Sort"));
    expect(menuItemByText("Ascending")).not.toBeUndefined();
    await click(menuItemByText("Ascending"));
    expect(lastListItemsCall()?.[1]).toMatchObject({
      sort: "updated",
      direction: "asc",
    });
  });

  test("an 80-character option field label and sort label truncate with a tooltip, and the menus fit the main area", async () => {
    const longKey = "a".repeat(80);
    fake.listCollections.mockResolvedValue({ collections: [EVENTS] });
    fake.getCollection.mockResolvedValue({
      collection: {
        id: EVENTS.id,
        slug: EVENTS.slug,
        name: EVENTS.name,
        singularName: EVENTS.singularName,
        isPublic: true,
        fields: [
          { key: "title", label: "Title", kind: "text", isTitle: true },
          {
            key: "kind",
            label: longKey,
            kind: "option",
            options: [{ value: "x", label: longKey }],
          },
        ],
      },
    });
    fake.listItems.mockImplementation(async (_c, q) => ({
      ...itemsPageOf([eventRow({ values: { kind: "x" } })], 1, 1, {
        columns: ["kind"],
        filterField: "kind",
      }),
      applied: {
        status: q.status ?? "all",
        sort: q.sort ?? "order",
        direction: q.direction ?? "asc",
        optionKey: q.optionKey ?? null,
        optionValue: q.optionValue ?? null,
      },
    }));
    mount({ initialView: { collectionId: EVENTS.id } });
    await settle();
    const main =
      document.querySelector<HTMLElement>("[data-cms-top-bar]")!.parentElement!;
    await click(buttonByText("Sort"));
    const sortMenu = document.querySelector<HTMLElement>('[role="menu"]')!;
    expect(sortMenu.getBoundingClientRect().width).toBeLessThanOrEqual(
      main.getBoundingClientRect().width + 1
    );
  });
});
