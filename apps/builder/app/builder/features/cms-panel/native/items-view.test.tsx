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
import { isCmsFailure, type CmsItemsPage, type CmsResult } from "./cms-source";
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

/** Sets an input's value as a keystroke does, inside the caller's act. */
const typeInto = (field: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
};

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
      // the checkbox, then the drag handle: the whole collection is one page
    ).toEqual(["", "", "Name", "Status", "Modified", "Published"]);
    expect(itemRows()).toHaveLength(3);
    for (const row of itemRows()) {
      expect(row.getBoundingClientRect().height).toBe(32);
    }
  });

  test("search asks E3 for page 1 with the term 250 ms after the last keystroke", async () => {
    mount();
    await settle();
    fake.listItems.mockClear();
    // the debounce runs on a clock the test moves, so a slow keystroke
    // never lets an earlier one's timer fire
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      // each keystroke restarts the pause
      await act(async () => userEvent.type(searchInput()!, "n"));
      act(() => {
        vi.advanceTimersByTime(200);
      });
      await act(async () => userEvent.type(searchInput()!, "e"));
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(fake.listItems).not.toHaveBeenCalled();
      await act(async () => userEvent.type(searchInput()!, "w"));
      act(() => {
        vi.advanceTimersByTime(249);
      });
      expect(fake.listItems).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
    } finally {
      vi.useRealTimers();
    }
    await settle();
    expect(fake.listItems.mock.calls).toEqual([
      [POSTS.id, { q: "new", page: 1 }],
    ]);
    expect(searchInput()?.value).toBe("new");
  });

  test("a trailing space stays in the field and is not sent", async () => {
    mount();
    await settle();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await act(async () => userEvent.type(searchInput()!, "new "));
      act(() => {
        vi.advanceTimersByTime(250);
      });
    } finally {
      vi.useRealTimers();
    }
    await settle();
    expect(searchInput()?.value).toBe("new ");
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: "new", page: 1 }]);
  });

  test("a key typed after the debounce sent the search is kept", async () => {
    mount();
    await settle();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await act(async () => userEvent.type(searchInput()!, "n"));
      // the debounce sends "n", and "e" is typed before the echo of "n"
      // comes back
      const field = searchInput()!;
      act(() => {
        vi.advanceTimersByTime(250);
        typeInto(field, "ne");
      });
      await act(async () => userEvent.type(searchInput()!, "w"));
      act(() => {
        vi.advanceTimersByTime(250);
      });
    } finally {
      vi.useRealTimers();
    }
    await settle();
    expect(searchInput()?.value).toBe("new");
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: "new", page: 1 }]);
  });

  test("a key typed while the sent search's answer lands is kept", async () => {
    const base = fake.listItems.getMockImplementation();
    const held = deferred<CmsItemsPage>();
    mount();
    await settle();
    fake.listItems.mockImplementation(async (c, q) =>
      q.q === "n" ? held.promise : base!(c, q)
    );
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await act(async () => userEvent.type(searchInput()!, "n"));
      // "e" is typed before the echo of the sent "n" comes back, and the
      // answer for "n" lands before "w"
      const field = searchInput()!;
      act(() => {
        vi.advanceTimersByTime(250);
        typeInto(field, "ne");
      });
      expect(lastListItemsCall()).toEqual([POSTS.id, { q: "n", page: 1 }]);
      await act(async () => held.resolve(pageOf(1, 3)));
      await act(async () => userEvent.type(searchInput()!, "w"));
      act(() => {
        vi.advanceTimersByTime(250);
      });
    } finally {
      vi.useRealTimers();
    }
    await settle();
    expect(searchInput()?.value).toBe("new");
    expect(lastListItemsCall()).toEqual([POSTS.id, { q: "new", page: 1 }]);
  });

  test("Escape clears the search", async () => {
    mount();
    await settle();
    // the debounce runs on a clock the test moves
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await act(async () => userEvent.type(searchInput()!, "new"));
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(lastListItemsCall()).toEqual([POSTS.id, { q: "new", page: 1 }]);
      await act(async () => userEvent.keyboard("{Escape}"));
      act(() => {
        vi.advanceTimersByTime(0);
      });
    } finally {
      vi.useRealTimers();
    }
    await settle();
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
    // a short date in the browser's locale
    expect(published?.textContent).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: "short" }).format(
        new Date("2026-11-05T09:00:00+00:00")
      )
    );
  });

  test("a draft's Published cell is empty", async () => {
    await mountEvents(
      eventsPage(["kind"], [eventRow({ status: "draft", publishedAt: null })])
    );
    const published = document.querySelector<HTMLElement>(
      '[data-cms-item] [role="cell"]:last-child'
    );
    expect(published?.textContent).toBe("");
  });

  test("field columns drop as the main area narrows, and nothing scrolls sideways", async () => {
    await mountEvents();
    const table = document.querySelector<HTMLElement>('[role="table"]')!;
    const wide = fitFieldColumns({
      width: tableWidth(),
      wanted: 3,
      checkbox: true,
      handle: true,
    });
    expect(fieldColumnCount()).toBe(wide);
    expect(table.scrollWidth).toBe(table.clientWidth);

    container!.style.width = "640px";
    await wait(50);
    const narrow = fitFieldColumns({
      width: tableWidth(),
      wanted: 3,
      checkbox: true,
      handle: true,
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
    await mountEvents(
      itemsPageOf([eventRow()], 60, 1, {
        columns: ["kind"],
        filterField: "kind",
      })
    );
    await click(byLabel("Next"));
    expect(lastListItemsCall()?.[1]).toMatchObject({ page: 2 });
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
    act(() => {
      root?.unmount();
    });
    container?.remove();

    // a filter on and no rows: one line, and the top bar keeps its controls
    fake = createFakeCmsSource();
    fake.listCollections.mockResolvedValue({ collections: [EVENTS] });
    fake.listItems.mockImplementation(async (_c, q) =>
      itemsPageOf([], 0, 1, {
        columns: ["kind"],
        filterField: "kind",
        applied: {
          status: q.status ?? "all",
          sort: "order",
          direction: "asc",
          optionKey: null,
          optionValue: null,
        },
      })
    );
    mount({
      initialView: {
        collectionId: EVENTS.id,
        list: {
          status: "draft",
          sort: "order",
          direction: "asc",
          option: null,
        },
      },
    });
    await settle();
    expect(document.querySelector("[data-cms-no-matches]")?.textContent).toBe(
      "No matches"
    );
    expect(buttonByText("Filter 1")).not.toBeUndefined();
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
    await act(async () => userEvent.hover(text!));
    await vi.waitFor(
      () => {
        expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
          longKey
        );
      },
      { timeout: 3000 }
    );
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
    expect(filterButton()?.textContent).toBe("Filter 1");
    await click(filterButton());
    await click(menuItemByText("Café"));
    expect(filterButton()?.textContent).toBe("Filter 2");
    // the count sits beside the word, inside the button's one line
    const box = filterButton()!.getBoundingClientRect();
    const countBox = filterButton()!
      .querySelector<HTMLElement>("[data-cms-filter-count]")!
      .getBoundingClientRect();
    expect(countBox.top).toBeGreaterThanOrEqual(box.top);
    expect(countBox.bottom).toBeLessThanOrEqual(box.bottom);
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
    const fits = (menu: HTMLElement) => {
      expect(menu.getBoundingClientRect().width).toBeLessThanOrEqual(
        main.getBoundingClientRect().width + 1
      );
      expect(menu.scrollWidth).toBeLessThanOrEqual(menu.clientWidth);
      for (const item of menu.querySelectorAll<HTMLElement>(
        '[role="menuitemradio"]'
      )) {
        expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth);
      }
    };
    /** The element holding `text` set to truncate, so its tooltip carries it. */
    const truncated = (menu: HTMLElement, text: string) =>
      [...menu.querySelectorAll<HTMLElement>("*")].find(
        (element) =>
          element.textContent === text &&
          getComputedStyle(element).textOverflow === "ellipsis"
      );

    await click(buttonByText("Sort"));
    const sortMenu = document.querySelector<HTMLElement>('[role="menu"]')!;
    fits(sortMenu);
    const sortLabel = truncated(sortMenu, longKey);
    expect(sortLabel).not.toBeUndefined();
    await act(async () => userEvent.hover(sortLabel!));
    await vi.waitFor(
      () => {
        expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
          longKey
        );
      },
      { timeout: 3000 }
    );
    // the tooltip's Escape, then the menu's
    await act(async () => userEvent.keyboard("{Escape}"));
    await settle();
    if (document.querySelector('[role="menu"]') !== null) {
      await act(async () => userEvent.keyboard("{Escape}"));
    }
    await settle();

    await click(buttonByText("Filter"));
    const filterMenu = document.querySelector<HTMLElement>('[role="menu"]')!;
    fits(filterMenu);
    // the group heading, the option and Any {label} each truncate
    const heading = [
      ...filterMenu.querySelectorAll<HTMLElement>('[role="group"], *'),
    ].find(
      (element) =>
        element.getAttribute("role") !== "menuitemradio" &&
        element.closest('[role="menuitemradio"]') === null &&
        element.textContent === longKey &&
        getComputedStyle(element).textOverflow === "ellipsis"
    );
    expect(heading).not.toBeUndefined();
    expect(truncated(filterMenu, `Any ${longKey}`)).not.toBeUndefined();
    await act(async () => userEvent.hover(heading!));
    await vi.waitFor(
      () => {
        expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
          longKey
        );
      },
      { timeout: 3000 }
    );
  });
});

const ROW_IDS = [
  "00000000-0000-4000-8000-00000000000a",
  "00000000-0000-4000-8000-00000000000b",
  "00000000-0000-4000-8000-00000000000c",
];

/** Three POSTS rows a, b and c, each with its own version. */
const threeRows = () =>
  ["a", "b", "c"].map((name, index) =>
    rowOf(
      itemOf({
        id: ROW_IDS[index],
        slug: name,
        data: { title: name.toUpperCase() },
        updatedAt: `2026-11-12T10:00:0${index}.000000+00:00`,
      })
    )
  );

const mountThree = async (overrides: Partial<CmsScreenProps> = {}) => {
  fake.listItems.mockImplementation(async () => itemsPageOf(threeRows(), 3, 1));
  mount(overrides);
  await settle();
};

const checkbox = (label: string) => byLabel(label) as HTMLButtonElement | null;

const toolbar = () =>
  document.querySelector<HTMLElement>(
    '[role="toolbar"][aria-label="Bulk actions"]'
  );

const toolbarButton = (text: string) =>
  [...(toolbar()?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(
    (button) => button.textContent === text
  );

const dialogButton = (text: string) =>
  [
    ...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  ].find((button) => button.textContent === text);

/** Records, per Escape that reaches the document, whether it was handled. */
const watchEscapes = () => {
  const handled: boolean[] = [];
  const listener = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      handled.push(event.defaultPrevented);
    }
  };
  document.addEventListener("keydown", listener);
  return {
    handled,
    stop: () => document.removeEventListener("keydown", listener),
  };
};

describe("selection and the bulk bar (Task 17)", () => {
  test.each(["click", "Space"])(
    "a row checkbox toggles by %s and opens nothing",
    async (how) => {
      await mountThree();
      const box = checkbox("Select A")!;
      if (how === "click") {
        await click(box);
      } else {
        act(() => {
          box.focus();
        });
        await act(async () => userEvent.keyboard(" "));
        await settle();
      }
      expect(box.getAttribute("data-state")).toBe("checked");
      expect(box.closest("[data-cms-item]")?.getAttribute("data-state")).toBe(
        "selected"
      );
      expect(fake.getItem).not.toHaveBeenCalled();
      expect(toolbar()?.textContent).toContain("1 selected");
    }
  );

  test("select all on the page, and its indeterminate state", async () => {
    await mountThree();
    const all = () => checkbox("Select all on this page")!;
    await click(checkbox("Select B"));
    expect(all().getAttribute("data-state")).toBe("indeterminate");
    await click(all());
    expect(all().getAttribute("data-state")).toBe("checked");
    for (const name of ["A", "B", "C"]) {
      expect(checkbox(`Select ${name}`)?.getAttribute("data-state")).toBe(
        "checked"
      );
    }
    await click(all());
    expect(all().getAttribute("data-state")).toBe("unchecked");
    expect(toolbar()).toBeNull();
  });

  test("the bulk bar replaces the search, Filter, Sort and New item, and Clear brings them back", async () => {
    await mountThree();
    expect(searchInput()).not.toBeNull();
    await click(checkbox("Select A"));
    await click(checkbox("Select C"));
    expect(toolbar()?.textContent).toContain("2 selected");
    expect(searchInput()).toBeNull();
    expect(buttonByText("Filter")).toBeUndefined();
    expect(buttonByText("Sort")).toBeUndefined();
    expect(buttonByText("New item")).toBeUndefined();
    for (const text of ["Publish", "Unpublish", "Archive", "Delete", "Clear"]) {
      expect(toolbarButton(text)).not.toBeUndefined();
    }
    await click(toolbarButton("Clear"));
    expect(toolbar()).toBeNull();
    expect(searchInput()).not.toBeNull();
    expect(buttonByText("Filter")).not.toBeUndefined();
    expect(buttonByText("Sort")).not.toBeUndefined();
    expect(buttonByText("New item")).not.toBeUndefined();
  });

  test("no checkboxes without canEdit; Publish and Unpublish only with canPublish", async () => {
    fake.getAccess.mockImplementation(async () => ({
      canEdit: false,
      canPublish: false,
      canManageSettings: false,
    }));
    await mountThree();
    expect(itemRows()).toHaveLength(3);
    expect(checkbox("Select A")).toBeNull();
    expect(checkbox("Select all on this page")).toBeNull();
    act(() => {
      root?.unmount();
    });
    container?.remove();

    fake = createFakeCmsSource();
    fake.getAccess.mockImplementation(async () => ({
      canEdit: true,
      canPublish: false,
      canManageSettings: false,
    }));
    await mountThree();
    await click(checkbox("Select A"));
    expect(toolbarButton("Publish")).toBeUndefined();
    expect(toolbarButton("Unpublish")).toBeUndefined();
    for (const text of ["Archive", "Delete", "Clear"]) {
      expect(toolbarButton(text)).not.toBeUndefined();
    }
  });

  test("Publish sends E10 with each row's version, refetches, clears, and toasts conflicts and failures", async () => {
    const error = vi.spyOn(toast, "error");
    const onItemWritten = vi.fn();
    await mountThree({ onItemWritten });
    const rows = threeRows();
    fake.publishItems.mockResolvedValue({
      published: [ROW_IDS[0]],
      unchanged: [],
      conflicts: [ROW_IDS[1]],
      failed: [ROW_IDS[2]],
    });
    await click(checkbox("Select all on this page"));
    const calls = fake.listItems.mock.calls.length;
    await click(toolbarButton("Publish"));
    expect(fake.publishItems).toHaveBeenCalledWith(POSTS.id, {
      items: rows.map((row) => ({ id: row.id, updatedAt: row.updatedAt })),
    });
    expect(fake.listItems.mock.calls.length).toBeGreaterThan(calls);
    expect(onItemWritten).toHaveBeenCalledWith("posts", undefined);
    expect(toolbar()).toBeNull();
    expect(error).toHaveBeenCalledWith("1 changed by someone else");
    expect(error).toHaveBeenCalledWith("1 not published");
  });

  test("a stopped Publish refetches and keeps the selection still shown", async () => {
    const error = vi.spyOn(toast, "error");
    await mountThree();
    fake.publishItems.mockResolvedValue({ error: "forbidden" });
    await click(checkbox("Select A"));
    await click(checkbox("Select B"));
    const calls = fake.listItems.mock.calls.length;
    await click(toolbarButton("Publish"));
    expect(error).toHaveBeenCalledWith("No access");
    expect(fake.listItems.mock.calls.length).toBeGreaterThan(calls);
    expect(toolbar()?.textContent).toContain("2 selected");
  });

  test("Unpublish and Archive send E11; slug_taken toasts Address in use", async () => {
    const error = vi.spyOn(toast, "error");
    await mountThree();
    fake.setItemsStatus.mockResolvedValueOnce({ changed: [ROW_IDS[0]] });
    await click(checkbox("Select A"));
    await click(toolbarButton("Unpublish"));
    expect(fake.setItemsStatus).toHaveBeenLastCalledWith(POSTS.id, {
      ids: [ROW_IDS[0]],
      status: "draft",
    });
    expect(toolbar()).toBeNull();

    fake.setItemsStatus.mockResolvedValueOnce({ error: "slug_taken" });
    await click(checkbox("Select B"));
    await click(toolbarButton("Archive"));
    expect(fake.setItemsStatus).toHaveBeenLastCalledWith(POSTS.id, {
      ids: [ROW_IDS[1]],
      status: "archived",
    });
    expect(error).toHaveBeenCalledWith("Address in use");
    expect(toolbar()?.textContent).toContain("1 selected");
  });

  test("Delete asks Delete 2 events?, Cancel is focused, Delete sends E12", async () => {
    const rows = [
      eventRow({ id: ROW_IDS[0], title: "One" }),
      eventRow({ id: ROW_IDS[1], title: "Two" }),
    ];
    await mountEvents(eventsPage(["kind"], rows));
    fake.deleteItems.mockResolvedValue({ deleted: [ROW_IDS[0], ROW_IDS[1]] });
    await click(checkbox("Select all on this page"));
    await click(toolbarButton("Delete"));
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.textContent).toContain("Delete 2 events?");
    expect(document.activeElement?.textContent).toBe("Cancel");
    expect(fake.deleteItems).not.toHaveBeenCalled();
    await click(dialogButton("Delete"));
    expect(fake.deleteItems).toHaveBeenCalledWith(EVENTS.id, {
      ids: [ROW_IDS[0], ROW_IDS[1]],
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(toolbar()).toBeNull();
  });

  test("Escape clears a selection and keeps the overlay; a second Escape is the overlay's", async () => {
    await mountThree();
    await click(checkbox("Select A"));
    const escapes = watchEscapes();
    await act(async () => userEvent.keyboard("{Escape}"));
    await settle();
    expect(toolbar()).toBeNull();
    expect(checkbox("Select A")?.getAttribute("data-state")).toBe("unchecked");
    await act(async () => userEvent.keyboard("{Escape}"));
    await settle();
    escapes.stop();
    expect(escapes.handled).toEqual([true, false]);
  });

  // Review Focus 5
  test("deleting every row of the last page of a filtered list shows the new last page", async () => {
    let total = 120;
    fake.listItems.mockImplementation(async (_c, query) => {
      const last = Math.max(1, Math.ceil(total / 50));
      return {
        ...pageOf(Math.min(query.page ?? 1, last), total),
        applied: {
          status: query.status ?? "all",
          sort: "order",
          direction: "asc",
          optionKey: null,
          optionValue: null,
        },
      };
    });
    mount({
      initialView: {
        collectionId: POSTS.id,
        page: 3,
        list: {
          status: "draft",
          sort: "order",
          direction: "asc",
          option: null,
        },
      },
    });
    await settle();
    expect(pagerText()).toBe("101-120 of 120");
    fake.deleteItems.mockImplementation(async (_c, { ids }) => {
      total -= ids.length;
      return { deleted: ids };
    });
    await click(checkbox("Select all on this page"));
    await click(toolbarButton("Delete"));
    await click(dialogButton("Delete"));
    expect(fake.deleteItems.mock.calls[0][1].ids).toHaveLength(20);
    expect(lastListItemsCall()?.[1]).toMatchObject({ status: "draft" });
    expect(pagerText()).toBe("51-100 of 100");
    expect(itemRows()).toHaveLength(50);
    expect(toolbar()).toBeNull();
    expect(document.querySelector("[data-cms-no-matches]")).toBeNull();
  });

  test("Escape in the bulk Delete dialog closes the dialog only: the selection and the overlay stay", async () => {
    await mountThree();
    await click(checkbox("Select A"));
    await click(checkbox("Select B"));
    await click(toolbarButton("Delete"));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    const escapes = watchEscapes();
    await act(async () => userEvent.keyboard("{Escape}"));
    await wait(100);
    escapes.stop();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(toolbar()?.textContent).toContain("2 selected");
    // no Escape reaches the overlay unhandled
    expect(escapes.handled).not.toContain(false);
    // the focus goes back to the bulk bar's Delete
    expect(document.activeElement).toBe(toolbarButton("Delete"));
    expect(fake.deleteItems).not.toHaveBeenCalled();
  });

  test("Escape in an open Filter menu with no selection closes the menu only, and the overlay stays", async () => {
    await mountThree();
    await click(buttonByText("Filter"));
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    const escapes = watchEscapes();
    await act(async () => userEvent.keyboard("{Escape}"));
    await settle();
    escapes.stop();
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(escapes.handled).toEqual([true]);
  });

  test("every bulk button is disabled while a call is in flight", async () => {
    await mountThree();
    const answer = deferred<
      CmsResult<{
        published: string[];
        unchanged: string[];
        conflicts: string[];
        failed: string[];
      }>
    >();
    fake.publishItems.mockImplementation(() => answer.promise);
    await click(checkbox("Select A"));
    await click(toolbarButton("Publish"));
    for (const text of ["Publish", "Unpublish", "Archive", "Delete", "Clear"]) {
      expect(toolbarButton(text)?.disabled).toBe(true);
    }
    answer.resolve({
      published: [ROW_IDS[0]],
      unchanged: [],
      conflicts: [],
      failed: [],
    });
    await settle();
    expect(toolbar()).toBeNull();
  });

  test("a selection change asks E3 nothing and counts no page answer", async () => {
    await mountThree();
    const answers = () =>
      document.querySelector<HTMLElement>("[data-cms-page-answers]")?.dataset;
    const calls = fake.listItems.mock.calls.length;
    const count = answers()?.cmsPageAnswers;
    await click(checkbox("Select A"));
    await click(toolbarButton("Clear"));
    expect(fake.listItems.mock.calls.length).toBe(calls);
    expect(answers()?.cmsPageAnswers).toBe(count);

    // a failed refetch counts one answer, not ok
    fake.listItems.mockResolvedValueOnce({ error: "rate_limited" });
    act(() => {
      refreshCmsNative();
    });
    await settle();
    expect(Number(answers()?.cmsPageAnswers)).toBe(Number(count) + 1);
    expect(answers()?.cmsPageAnswerOk).toBe("false");
  });

  test("Enter on a row checkbox opens nothing", async () => {
    await mountThree();
    act(() => {
      checkbox("Select A")!.focus();
    });
    await act(async () => userEvent.keyboard("{Enter}"));
    await settle();
    expect(fake.getItem).not.toHaveBeenCalled();
  });
});

/**
 * A collection of three rows a, b and c whose door keeps their order: E13
 * stores the order and renews the version of every row it moves.
 */
/** A row's version after `n` renewals: a valid timestamp, one second per renewal. */
const versionOf = (id: string, n: number) =>
  `2026-11-12T10:0${ROW_IDS.indexOf(id)}:0${n}.000000+00:00`;
const renewals = (version: string) => Number(version.slice(18, 19));

const reorderWorld = () => {
  const names: Record<string, string> = {
    [ROW_IDS[0]]: "a",
    [ROW_IDS[1]]: "b",
    [ROW_IDS[2]]: "c",
  };
  const world = {
    ids: [...ROW_IDS],
    versions: Object.fromEntries(ROW_IDS.map((id) => [id, versionOf(id, 0)])),
    rows: () =>
      world.ids.map((id) =>
        rowOf(
          itemOf({
            id,
            slug: names[id],
            data: { title: names[id].toUpperCase() },
            updatedAt: world.versions[id],
          })
        )
      ),
  };
  fake.listItems.mockImplementation(async (_c, q) => ({
    ...itemsPageOf(world.rows(), world.ids.length, 1),
    applied: {
      status: q.status ?? "all",
      sort: q.sort ?? "order",
      direction: q.direction ?? (q.sort === "updated" ? "desc" : "asc"),
      optionKey: q.optionKey ?? null,
      optionValue: q.optionValue ?? null,
    },
  }));
  fake.reorderItems.mockImplementation(async (_c, { ids }) => {
    ids.forEach((id, index) => {
      if (world.ids[index] !== id) {
        world.versions[id] = versionOf(id, renewals(world.versions[id]) + 1);
      }
    });
    world.ids = [...ids];
    return { changed: ids.length };
  });
  return world;
};

const handles = () => [
  ...document.querySelectorAll<HTMLElement>('[aria-label="Drag to reorder"]'),
];

const rowEl = (slug: string) =>
  document.querySelector<HTMLElement>(`[data-cms-item="${slug}"]`);

const altMove = async (key: "ArrowUp" | "ArrowDown") => {
  await act(async () => userEvent.keyboard(`{Alt>}{${key}}{/Alt}`));
};

const focusRow = (slug: string) => {
  act(() => {
    rowEl(slug)!.focus();
  });
};

const pointer = (target: EventTarget, type: string, x: number, y: number) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      pointerId: 1,
      isPrimary: true,
      clientX: x,
      clientY: y,
    })
  );

/** Drags a row's handle to below the row `toSlug`. */
const dragBelow = async (fromSlug: string, toSlug: string) => {
  const handle = rowEl(fromSlug)!.querySelector<HTMLElement>(
    '[aria-label="Drag to reorder"]'
  )!;
  const start = handle.getBoundingClientRect();
  const x = start.left + start.width / 2;
  const target = rowEl(toSlug)!.getBoundingClientRect();
  act(() => {
    pointer(handle, "pointerdown", x, start.top + start.height / 2);
  });
  for (const y of [
    start.top + start.height / 2 + 6,
    target.top + target.height * 0.5,
    target.top + target.height * 0.9,
  ]) {
    act(() => {
      pointer(window, "pointermove", x, y);
    });
    await settle();
  }
  act(() => {
    pointer(window, "pointerup", x, target.top + target.height * 0.9);
    // the click a browser fires after the drag's pointer up
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle();
};

const reorderCalls = () =>
  fake.reorderItems.mock.calls.map(([, body]) => body.ids);

describe("drag reorder (Task 18)", () => {
  test("the handle shows only with canEdit, Manual order, no search, no filter and E3's total at most 50", async () => {
    reorderWorld();
    mount();
    await settle();
    expect(handles()).toHaveLength(3);

    // a sort other than Manual order
    await click(
      [
        ...document.querySelectorAll<HTMLElement>(
          '[role="columnheader"] button'
        ),
      ].find((button) => button.textContent?.startsWith("Name"))
    );
    expect(handles()).toHaveLength(0);
    await click(buttonByText("Sort"));
    await click(menuItemByText("Manual order"));
    expect(handles()).toHaveLength(3);

    // a filter
    await click(buttonByText("Filter"));
    await click(menuItemByText("Draft"));
    expect(handles()).toHaveLength(0);
    await click(buttonByText("Filter 1"));
    await click(menuItemByText("All items"));
    expect(handles()).toHaveLength(3);

    // a search
    await act(async () => userEvent.type(searchInput()!, "a"));
    await wait(300);
    expect(handles()).toHaveLength(0);
    act(() => {
      root?.unmount();
    });
    container?.remove();

    // more than 50 items
    fake = createFakeCmsSource();
    fake.listItems.mockImplementation(async () => pageOf(1, 51));
    mount();
    await settle();
    expect(itemRows()).toHaveLength(50);
    expect(handles()).toHaveLength(0);
    act(() => {
      root?.unmount();
    });
    container?.remove();

    // no canEdit
    fake = createFakeCmsSource();
    reorderWorld();
    fake.getAccess.mockImplementation(async () => ({
      canEdit: false,
      canPublish: false,
      canManageSettings: false,
    }));
    mount();
    await settle();
    expect(itemRows()).toHaveLength(3);
    expect(handles()).toHaveLength(0);
  });

  test("a pointer drop sends E13 with the page's ids in the new order", async () => {
    reorderWorld();
    mount();
    await settle();
    await dragBelow("a", "c");
    expect(reorderCalls()).toEqual([[ROW_IDS[1], ROW_IDS[2], ROW_IDS[0]]]);
    expect(itemSlugs()).toEqual(["b", "c", "a"]);
    expect(fake.getItem).not.toHaveBeenCalled();
  });

  test("Alt+Arrow moves are batched and sent 500 ms after the last", async () => {
    reorderWorld();
    mount();
    await settle();
    focusRow("a");
    await altMove("ArrowDown");
    await altMove("ArrowDown");
    expect(itemSlugs()).toEqual(["b", "c", "a"]);
    await wait(300);
    expect(fake.reorderItems).not.toHaveBeenCalled();
    await wait(400);
    expect(reorderCalls()).toEqual([[ROW_IDS[1], ROW_IDS[2], ROW_IDS[0]]]);
  });

  test("the pause runs from the last move, not the first", async () => {
    reorderWorld();
    mount();
    await settle();
    focusRow("a");
    await altMove("ArrowDown");
    await wait(300);
    await altMove("ArrowDown");
    await wait(300);
    // 600 ms after the first move, 300 ms after the last: nothing yet
    expect(fake.reorderItems).not.toHaveBeenCalled();
    await wait(300);
    expect(reorderCalls()).toEqual([[ROW_IDS[1], ROW_IDS[2], ROW_IDS[0]]]);
  });

  test("Alt+Arrow keeps the focus on the moved row, so a second Alt+Arrow moves it again", async () => {
    reorderWorld();
    mount();
    await settle();
    focusRow("a");
    await altMove("ArrowDown");
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
    expect(document.activeElement).toBe(rowEl("a"));
    await altMove("ArrowDown");
    expect(itemSlugs()).toEqual(["b", "c", "a"]);
    expect(document.activeElement).toBe(rowEl("a"));
  });

  test("Alt+Arrow, then Enter, sends E13 at once and opens the editor after E13 and its refetch; Save then succeeds", async () => {
    const world = reorderWorld();
    fake.getItem.mockImplementation(async (_c, id) => ({
      item: itemOf({
        id,
        slug: "a",
        data: { title: "A", summary: null, author: null },
        updatedAt: world.versions[id],
      }),
    }));
    fake.updateItem.mockImplementation(async (_c, id, body) => ({
      item: itemOf({
        id,
        slug: "a",
        data: body.data,
        updatedAt: versionOf(id, 9),
      }),
    }));
    mount();
    await settle();
    focusRow("a");
    await altMove("ArrowDown");
    await act(async () => userEvent.keyboard("{Enter}"));
    await settle();
    // sent at once, not after 500 ms
    expect(reorderCalls()).toEqual([[ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]]]);
    expect(fake.getItem).toHaveBeenCalledTimes(1);
    const refetch = fake.listItems.mock.invocationCallOrder.at(-1)!;
    expect(fake.reorderItems.mock.invocationCallOrder[0]).toBeLessThan(refetch);
    expect(fake.getItem.mock.invocationCallOrder[0]).toBeGreaterThan(refetch);

    const title = document.querySelector<HTMLInputElement>("#cms-field-title")!;
    await act(async () => userEvent.type(title, "!"));
    await click(buttonByText("Save"));
    expect(fake.updateItem).toHaveBeenCalledTimes(1);
    expect(fake.updateItem.mock.calls[0][2].expectedUpdatedAt).toBe(
      world.versions[ROW_IDS[0]]
    );
    expect(world.versions[ROW_IDS[0]]).toBe(versionOf(ROW_IDS[0], 1));
  });

  test("a bulk Publish pressed right after a drop sends the refetched versions", async () => {
    const world = reorderWorld();
    const held = deferred<CmsResult<{ changed: number }>>();
    const store = fake.reorderItems.getMockImplementation()!;
    fake.reorderItems.mockImplementation(async (c, body) => {
      const answer = await held.promise;
      await store(c, body);
      return answer;
    });
    fake.publishItems.mockImplementation(async (_c, { items }) => ({
      published: items.map((item) => item.id),
      unchanged: [],
      conflicts: [],
      failed: [],
    }));
    mount();
    await settle();
    await click(checkbox("Select all on this page"));
    await dragBelow("a", "c");
    expect(fake.reorderItems).toHaveBeenCalledTimes(1);
    await click(toolbarButton("Publish"));
    expect(fake.publishItems).not.toHaveBeenCalled();
    expect(toolbarButton("Publish")?.disabled).toBe(true);
    held.resolve({ changed: 3 });
    await settle();
    expect(fake.publishItems).toHaveBeenCalledTimes(1);
    expect(fake.publishItems.mock.calls[0][1].items).toEqual(
      world.ids.map((id) => ({ id, updatedAt: world.versions[id] }))
    );
    expect(world.versions[ROW_IDS[0]]).toBe(versionOf(ROW_IDS[0], 1));
  });

  test.each([
    ["conflict", "Not moved"],
    ["rate_limited", "Try again in a minute"],
  ] as const)(
    "a failed E13 (%s) restores the server's order and toasts %s",
    async (code, text) => {
      const error = vi.spyOn(toast, "error");
      reorderWorld();
      fake.reorderItems.mockResolvedValue({ error: code });
      mount();
      await settle();
      const calls = fake.listItems.mock.calls.length;
      await dragBelow("a", "c");
      expect(fake.reorderItems).toHaveBeenCalledTimes(1);
      expect(fake.listItems.mock.calls.length).toBeGreaterThan(calls);
      expect(itemSlugs()).toEqual(["a", "b", "c"]);
      expect(error).toHaveBeenCalledWith(text);
    }
  );

  test("Alt+Down then Alt+Up sends nothing; Alt+Up on the first row does nothing", async () => {
    reorderWorld();
    mount();
    await settle();
    focusRow("a");
    await altMove("ArrowDown");
    await altMove("ArrowUp");
    expect(itemSlugs()).toEqual(["a", "b", "c"]);
    await altMove("ArrowUp");
    expect(itemSlugs()).toEqual(["a", "b", "c"]);
    await wait(700);
    expect(fake.reorderItems).not.toHaveBeenCalled();
  });

  test("a further move while E13 is in flight sends only the latest order after it", async () => {
    const world = reorderWorld();
    const held = deferred<CmsResult<{ changed: number }>>();
    const store = fake.reorderItems.getMockImplementation()!;
    fake.reorderItems
      .mockImplementationOnce(async (c, body) => {
        const answer = await held.promise;
        await store(c, body);
        return answer;
      })
      .mockImplementation(store);
    mount();
    await settle();
    focusRow("a");
    await altMove("ArrowDown");
    await wait(600);
    expect(fake.reorderItems).toHaveBeenCalledTimes(1);
    // b, a, c is in flight: two more moves of c, each past the pause
    focusRow("c");
    await altMove("ArrowUp");
    await wait(600);
    await altMove("ArrowUp");
    await wait(600);
    expect(itemSlugs()).toEqual(["c", "b", "a"]);
    expect(fake.reorderItems).toHaveBeenCalledTimes(1);
    held.resolve({ changed: 2 });
    await settle();
    expect(reorderCalls()).toEqual([
      [ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]],
      [ROW_IDS[2], ROW_IDS[1], ROW_IDS[0]],
    ]);
    expect(world.ids).toEqual([ROW_IDS[2], ROW_IDS[1], ROW_IDS[0]]);
  });

  test("pending keyboard moves are sent when focus leaves the table", async () => {
    reorderWorld();
    mount();
    await settle();
    focusRow("a");
    await altMove("ArrowDown");
    expect(fake.reorderItems).not.toHaveBeenCalled();
    act(() => {
      searchInput()!.focus();
    });
    await settle();
    expect(reorderCalls()).toEqual([[ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]]]);
  });

  test("a second open asked for during the wait replaces the first", async () => {
    reorderWorld();
    const held = deferred<CmsResult<{ changed: number }>>();
    const store = fake.reorderItems.getMockImplementation()!;
    fake.reorderItems.mockImplementation(async (c, body) => {
      const answer = await held.promise;
      await store(c, body);
      return answer;
    });
    mount();
    await settle();
    focusRow("a");
    await altMove("ArrowDown");
    await act(async () => userEvent.keyboard("{Enter}"));
    focusRow("b");
    await act(async () => userEvent.keyboard("{Enter}"));
    await settle();
    expect(fake.getItem).not.toHaveBeenCalled();
    held.resolve({ changed: 2 });
    await settle();
    expect(fake.getItem).toHaveBeenCalledTimes(1);
    expect(fake.getItem).toHaveBeenCalledWith(POSTS.id, ROW_IDS[1]);
  });

  test.each([
    ["E13 200", "ok"],
    ["E13 failed", "unavailable"],
  ] as const)(
    "%s, then a failed refetch: rows open again and the bulk bar is enabled",
    async (_name, answer) => {
      const error = vi.spyOn(toast, "error");
      reorderWorld();
      const held = deferred<CmsResult<{ changed: number }>>();
      fake.reorderItems.mockImplementation(() => held.promise);
      mount();
      await settle();
      await click(checkbox("Select C"));
      focusRow("a");
      await altMove("ArrowDown");
      // a bulk Publish waits on the reorder
      await click(toolbarButton("Publish"));
      expect(fake.reorderItems).toHaveBeenCalledTimes(1);
      expect(toolbarButton("Publish")?.disabled).toBe(true);
      // the refetch after E13 fails
      fake.listItems.mockResolvedValueOnce({ error: "rate_limited" });
      held.resolve(answer === "ok" ? { changed: 2 } : { error: "unavailable" });
      await settle();
      expect(fake.publishItems).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith("Try again in a minute");
      expect(toolbar()?.textContent).toContain("1 selected");
      expect(toolbarButton("Publish")?.disabled).toBe(false);
      // E13's accepted order stays shown; a refused one goes back
      expect(itemSlugs()).toEqual(
        answer === "ok" ? ["b", "a", "c"] : ["a", "b", "c"]
      );
      focusRow("b");
      await act(async () => userEvent.keyboard("{Enter}"));
      await settle();
      expect(fake.getItem).toHaveBeenCalledTimes(1);
    }
  );
});

describe("the reorder settles on the order it sent", () => {
  /** E13 calls held one by one; each stores its order once released. */
  const holdReorders = () => {
    const store = fake.reorderItems.getMockImplementation()!;
    const held: Array<() => void> = [];
    fake.reorderItems.mockImplementation(
      (c, body) =>
        new Promise((resolve) => {
          held.push(() => void store(c, body).then(resolve));
        })
    );
    return {
      release: async () => {
        held.shift()?.();
        await settle();
      },
      count: () => held.length,
    };
  };

  test("a move back while E13 is in flight is sent, and the list ends in the server's order", async () => {
    const world = reorderWorld();
    const reorders = holdReorders();
    mount();
    await settle();
    focusRow("a");
    await altMove("ArrowDown");
    await wait(600);
    expect(reorderCalls()).toEqual([[ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]]]);
    // back to a, b, c while the first is in flight
    focusRow("a");
    await altMove("ArrowUp");
    await wait(600);
    expect(itemSlugs()).toEqual(["a", "b", "c"]);
    const reads = fake.listItems.mock.calls.length;
    await reorders.release();
    await reorders.release();
    await settle();
    expect(reorderCalls()).toEqual([
      [ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]],
      [ROW_IDS[0], ROW_IDS[1], ROW_IDS[2]],
    ]);
    expect(world.ids).toEqual(ROW_IDS);
    expect(fake.listItems.mock.calls.length).toBeGreaterThan(reads);
    expect(itemSlugs()).toEqual(["a", "b", "c"]);
  });

  test("a move while the refetch after E13 is in flight is sent, never lost", async () => {
    const world = reorderWorld();
    mount();
    await settle();
    const echo = fake.listItems.getMockImplementation()!;
    const heldRead = deferred<void>();
    let holdNext = false;
    fake.listItems.mockImplementation(async (c, q) => {
      if (holdNext) {
        holdNext = false;
        await heldRead.promise;
      }
      return echo(c, q);
    });
    focusRow("a");
    await altMove("ArrowDown");
    holdNext = true;
    await wait(600);
    expect(reorderCalls()).toHaveLength(1);
    // the refetch is held: a further move
    focusRow("a");
    await altMove("ArrowDown");
    expect(itemSlugs()).toEqual(["b", "c", "a"]);
    heldRead.resolve();
    await settle();
    await wait(600);
    expect(reorderCalls()).toEqual([
      [ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]],
      [ROW_IDS[1], ROW_IDS[2], ROW_IDS[0]],
    ]);
    expect(world.ids).toEqual([ROW_IDS[1], ROW_IDS[2], ROW_IDS[0]]);
    expect(itemSlugs()).toEqual(["b", "c", "a"]);
  });

  test("Alt+Arrow moves around fast E13 answers and refetches keep the screen on the server's order", async () => {
    const world = reorderWorld();
    mount();
    await settle();
    focusRow("a");
    await altMove("ArrowDown");
    await wait(550);
    focusRow("a");
    await altMove("ArrowDown");
    await wait(30);
    focusRow("c");
    await altMove("ArrowUp");
    await wait(700);
    expect(itemSlugs().map((slug) => slug)).toEqual(
      world.ids.map(
        (id) =>
          ({ [ROW_IDS[0]]: "a", [ROW_IDS[1]]: "b", [ROW_IDS[2]]: "c" })[id]
      )
    );
  });

  test("a bulk Publish waiting across two reorders sends the second refetch's versions", async () => {
    const world = reorderWorld();
    const reorders = holdReorders();
    fake.publishItems.mockImplementation(async (_c, { items }) => ({
      published: items.map((item) => item.id),
      unchanged: [],
      conflicts: [],
      failed: [],
    }));
    mount();
    await settle();
    await click(checkbox("Select all on this page"));
    focusRow("a");
    await altMove("ArrowDown");
    await wait(600);
    focusRow("a");
    await altMove("ArrowDown");
    await click(toolbarButton("Publish"));
    expect(fake.publishItems).not.toHaveBeenCalled();
    await reorders.release();
    // the first refetch lands while the second E13 is in flight
    expect(reorderCalls()).toHaveLength(2);
    expect(fake.publishItems).not.toHaveBeenCalled();
    await reorders.release();
    await settle();
    expect(fake.publishItems).toHaveBeenCalledTimes(1);
    expect(fake.publishItems.mock.calls[0][1].items).toEqual(
      world.ids.map((id) => ({ id, updatedAt: world.versions[id] }))
    );
    expect(world.versions[ROW_IDS[0]]).toBe(versionOf(ROW_IDS[0], 2));
  });
});

describe("the list's review findings", () => {
  test("a bulk call answered after another collection opened invalidates the collection it wrote", async () => {
    const onItemWritten = vi.fn();
    const answer = deferred<
      CmsResult<{
        published: string[];
        unchanged: string[];
        conflicts: string[];
        failed: string[];
      }>
    >();
    fake.publishItems.mockImplementation(() => answer.promise);
    await mountThree({ onItemWritten });
    await click(checkbox("Select A"));
    await click(toolbarButton("Publish"));
    await click(
      document
        .querySelector<HTMLElement>('[data-cms-collection="people"]')
        ?.querySelector<HTMLElement>("button")
    );
    onItemWritten.mockClear();
    answer.resolve({
      published: [ROW_IDS[0]],
      unchanged: [],
      conflicts: [],
      failed: [],
    });
    await settle();
    expect(onItemWritten.mock.calls).toEqual([["posts", undefined]]);
  });

  test("Clear and a successful bulk call put the focus on the table's first row", async () => {
    fake.publishItems.mockResolvedValue({
      published: [ROW_IDS[1]],
      unchanged: [],
      conflicts: [],
      failed: [],
    });
    await mountThree();
    await click(checkbox("Select B"));
    await click(toolbarButton("Clear"));
    expect(document.activeElement).toBe(rowEl("a"));
    await click(checkbox("Select B"));
    await click(toolbarButton("Publish"));
    expect(document.activeElement).toBe(rowEl("a"));
  });

  test("a confirmed bulk Delete of every row puts the focus on New item", async () => {
    let rows = threeRows();
    fake.listItems.mockImplementation(async () =>
      itemsPageOf(rows, rows.length, 1)
    );
    fake.deleteItems.mockImplementation(async (_c, { ids }) => {
      rows = [];
      return { deleted: ids };
    });
    mount();
    await settle();
    await click(checkbox("Select all on this page"));
    await click(toolbarButton("Delete"));
    await click(dialogButton("Delete"));
    await wait(100);
    expect(document.activeElement?.textContent).toBe("New item");
  });

  test("the bulk Delete dialog closes when its waiting call is dropped", async () => {
    reorderWorld();
    const held = deferred<CmsResult<{ changed: number }>>();
    fake.reorderItems.mockImplementation(() => held.promise);
    mount();
    await settle();
    await click(checkbox("Select C"));
    focusRow("a");
    await altMove("ArrowDown");
    await click(toolbarButton("Delete"));
    await click(dialogButton("Delete"));
    expect(fake.reorderItems).toHaveBeenCalledTimes(1);
    fake.listItems.mockResolvedValueOnce({ error: "rate_limited" });
    held.resolve({ changed: 2 });
    await wait(100);
    expect(fake.deleteItems).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(toolbar()?.textContent).toContain("1 selected");
  });

  test("a row opened while a bulk call is in flight opens after it", async () => {
    const answer = deferred<CmsResult<{ changed: string[] }>>();
    fake.setItemsStatus.mockImplementation(() => answer.promise);
    await mountThree();
    await click(checkbox("Select A"));
    await click(toolbarButton("Archive"));
    focusRow("b");
    await act(async () => userEvent.keyboard("{Enter}"));
    await settle();
    expect(fake.getItem).not.toHaveBeenCalled();
    answer.resolve({ changed: [ROW_IDS[0]] });
    await settle();
    expect(fake.getItem).toHaveBeenCalledWith(POSTS.id, ROW_IDS[1]);
  });

  test("a move past the end leaves no mark, so leaving the table still sends pending moves", async () => {
    reorderWorld();
    mount();
    await settle();
    focusRow("a");
    await altMove("ArrowDown");
    await altMove("ArrowDown");
    // a is last: one more does nothing
    await altMove("ArrowDown");
    expect(fake.reorderItems).not.toHaveBeenCalled();
    act(() => {
      searchInput()!.focus();
    });
    await settle();
    expect(reorderCalls()).toEqual([[ROW_IDS[1], ROW_IDS[2], ROW_IDS[0]]]);
  });
});

describe("the table's grid", () => {
  test("the header and the rows share one grid: lead columns of 24 px, headers on one line above their cells", async () => {
    await mountEvents();
    const header = document.querySelector<HTMLElement>(
      '[role="table"] [role="row"]'
    )!;
    const row = itemRows()[0];
    for (const element of [header, row]) {
      const columns = getComputedStyle(element).gridTemplateColumns.split(" ");
      expect(columns[0]).toBe("24px");
    }
    const headers = [
      ...header.querySelectorAll<HTMLElement>('[role="columnheader"]'),
    ];
    // one line: every header centred on the same height
    const middles = headers.map((cell) => {
      const box = cell.getBoundingClientRect();
      return box.top + box.height / 2;
    });
    expect(Math.max(...middles) - Math.min(...middles)).toBeLessThanOrEqual(1);
    const cells = [...row.querySelectorAll<HTMLElement>('[role="cell"]')];
    expect(cells).toHaveLength(headers.length);
    cells.forEach((cell, index) => {
      expect(
        Math.abs(
          cell.getBoundingClientRect().left -
            headers[index].getBoundingClientRect().left
        )
      ).toBeLessThanOrEqual(1);
    });
  });
});

describe("the drag handle's click", () => {
  test("a click on the handle with no drag opens the row, as a click elsewhere on it does", async () => {
    reorderWorld();
    mount();
    await settle();
    await click(
      rowEl("b")!.querySelector<HTMLElement>('[aria-label="Drag to reorder"]')
    );
    expect(fake.getItem).toHaveBeenCalledWith(POSTS.id, ROW_IDS[1]);
  });
});

/**
 * Holds the next E3 calls until `release` or `fail`; calls made before
 * `hold` answer at once.
 */
const holdListItems = () => {
  const base = fake.listItems.getMockImplementation()!;
  let gate: ReturnType<typeof deferred<boolean>> | undefined;
  fake.listItems.mockImplementation(async (c, q) => {
    const current = gate;
    if (current !== undefined && (await current.promise) === false) {
      return { error: "unavailable" };
    }
    return base(c, q);
  });
  return {
    hold: () => {
      gate = deferred<boolean>();
    },
    release: async () => {
      const current = gate;
      gate = undefined;
      await act(async () => current?.resolve(true));
      await settle();
    },
    fail: async () => {
      const current = gate;
      gate = undefined;
      await act(async () => current?.resolve(false));
      await settle();
    },
  };
};

describe("drag is offered only on the order the table draws", () => {
  test("clearing a filter: no handle and no E13 until the unfiltered page answers", async () => {
    const world = reorderWorld();
    const base = fake.listItems.getMockImplementation()!;
    // Draft answers a and c only
    fake.listItems.mockImplementation(async (c, q) => {
      const answer = await base(c, q);
      if (q.status !== "draft" || isCmsFailure(answer)) {
        return answer;
      }
      const items = answer.items.filter((row) => row.slug !== "b");
      return { ...answer, items, total: items.length };
    });
    const gate = holdListItems();
    mount();
    await settle();
    await click(buttonByText("Filter"));
    await click(menuItemByText("Draft"));
    expect(itemSlugs()).toEqual(["a", "c"]);
    expect(handles()).toHaveLength(0);

    gate.hold();
    await click(buttonByText("Filter 1"));
    await click(menuItemByText("All items"));
    // the filtered rows still show, with no handle
    expect(itemSlugs()).toEqual(["a", "c"]);
    expect(handles()).toHaveLength(0);
    focusRow("a");
    await altMove("ArrowDown");
    expect(itemSlugs()).toEqual(["a", "c"]);
    await gate.release();
    await wait(600);
    expect(itemSlugs()).toEqual(["a", "b", "c"]);
    expect(handles()).toHaveLength(3);
    expect(fake.reorderItems).not.toHaveBeenCalled();
    expect(world.ids).toEqual(ROW_IDS);
  });

  test("clearing a search: no handle until the page answers, and none while that answer fails", async () => {
    reorderWorld();
    const base = fake.listItems.getMockImplementation()!;
    // a search for "a" answers a alone
    fake.listItems.mockImplementation(async (c, q) => {
      const answer = await base(c, q);
      if (q.q === undefined || isCmsFailure(answer)) {
        return answer;
      }
      const items = answer.items.filter((row) => row.slug === "a");
      return { ...answer, items, total: items.length };
    });
    const gate = holdListItems();
    mount();
    await settle();
    await act(async () => userEvent.type(searchInput()!, "a"));
    await wait(300);
    expect(itemSlugs()).toEqual(["a"]);
    expect(handles()).toHaveLength(0);

    gate.hold();
    await act(async () => userEvent.clear(searchInput()!));
    await wait(300);
    expect(itemSlugs()).toEqual(["a"]);
    expect(handles()).toHaveLength(0);

    // the read fails: the searched rows stay, still with no handle
    await gate.fail();
    expect(itemSlugs()).toEqual(["a"]);
    expect(handles()).toHaveLength(0);
    focusRow("a");
    await altMove("ArrowDown");
    await wait(600);
    expect(fake.reorderItems).not.toHaveBeenCalled();
  });

  test("Sort > Manual order: the Name order shows no handle, and Alt+Arrow sends nothing", async () => {
    const world = reorderWorld();
    // the manual order is c, a, b
    world.ids = [ROW_IDS[2], ROW_IDS[0], ROW_IDS[1]];
    const base = fake.listItems.getMockImplementation()!;
    fake.listItems.mockImplementation(async (c, q) => {
      const answer = await base(c, q);
      if (q.sort !== "name" || isCmsFailure(answer)) {
        return answer;
      }
      const items = [...answer.items].sort((left, right) =>
        left.slug.localeCompare(right.slug)
      );
      return { ...answer, items };
    });
    const gate = holdListItems();
    mount();
    await settle();
    expect(itemSlugs()).toEqual(["c", "a", "b"]);
    await click(
      [
        ...document.querySelectorAll<HTMLElement>(
          '[role="columnheader"] button'
        ),
      ].find((button) => button.textContent?.startsWith("Name"))
    );
    expect(itemSlugs()).toEqual(["a", "b", "c"]);

    gate.hold();
    await click(buttonByText("Sort"));
    await click(menuItemByText("Manual order"));
    // the Name order still shows, with no handle
    expect(itemSlugs()).toEqual(["a", "b", "c"]);
    expect(handles()).toHaveLength(0);
    focusRow("a");
    await altMove("ArrowDown");
    expect(itemSlugs()).toEqual(["a", "b", "c"]);
    await gate.release();
    await wait(600);
    expect(itemSlugs()).toEqual(["c", "a", "b"]);
    expect(handles()).toHaveLength(3);
    expect(fake.reorderItems).not.toHaveBeenCalled();
  });

  test("a pending keyboard order is dropped when the page's rows change", async () => {
    const world = reorderWorld();
    mount();
    await settle();
    focusRow("a");
    await altMove("ArrowDown");
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
    // a refetch draws another set of rows before the order is sent
    world.ids = [ROW_IDS[0], ROW_IDS[2]];
    refreshCmsNative();
    await settle();
    expect(itemSlugs()).toEqual(["a", "c"]);
    await wait(600);
    expect(fake.reorderItems).not.toHaveBeenCalled();
    expect(itemSlugs()).toEqual(["a", "c"]);
  });

  test("a pending keyboard order is sent when a column header changes the sort", async () => {
    const world = reorderWorld();
    const gate = holdListItems();
    mount();
    await settle();
    focusRow("a");
    await altMove("ArrowDown");
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
    // the sort changes from the keyboard's own Name header, with the focus
    // kept in the table
    gate.hold();
    const name = [
      ...document.querySelectorAll<HTMLElement>('[role="columnheader"] button'),
    ].find((button) => button.textContent?.startsWith("Name"))!;
    act(() => {
      name.click();
    });
    await settle();
    expect(reorderCalls()).toEqual([[ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]]]);
    await wait(600);
    await gate.release();
    await wait(600);
    expect(reorderCalls()).toEqual([[ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]]]);
    expect(world.ids).toEqual([ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]]);
  });

  test("an order queued behind an E13 in flight is sent after it when a column header changes the sort", async () => {
    const world = reorderWorld();
    const held = deferred<CmsResult<{ changed: number }>>();
    const store = fake.reorderItems.getMockImplementation()!;
    fake.reorderItems
      .mockImplementationOnce(async (c, body) => {
        const answer = await held.promise;
        await store(c, body);
        return answer;
      })
      .mockImplementation(store);
    const base = fake.listItems.getMockImplementation()!;
    fake.listItems.mockImplementation(async (c, q) => {
      const answer = await base(c, q);
      if (q.sort !== "name" || isCmsFailure(answer)) {
        return answer;
      }
      const items = [...answer.items].sort((left, right) =>
        left.slug.localeCompare(right.slug)
      );
      return { ...answer, items };
    });
    mount();
    await settle();
    await dragBelow("a", "b");
    expect(reorderCalls()).toEqual([[ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]]]);
    // b, a, c is in flight: a keyboard move, then the Name header at once
    focusRow("c");
    await altMove("ArrowUp");
    expect(itemSlugs()).toEqual(["b", "c", "a"]);
    const name = [
      ...document.querySelectorAll<HTMLElement>('[role="columnheader"] button'),
    ].find((button) => button.textContent?.startsWith("Name"))!;
    act(() => {
      name.click();
    });
    await settle();
    await wait(600);
    expect(fake.reorderItems).toHaveBeenCalledTimes(1);
    await act(async () => held.resolve({ changed: 2 }));
    await settle();
    await wait(600);
    expect(reorderCalls()).toEqual([
      [ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]],
      [ROW_IDS[1], ROW_IDS[2], ROW_IDS[0]],
    ]);
    expect(world.ids).toEqual([ROW_IDS[1], ROW_IDS[2], ROW_IDS[0]]);
    // the Name order is drawn
    expect(itemSlugs()).toEqual(["a", "b", "c"]);
  });
});

const PEOPLE_IDS = [
  "00000000-0000-4000-8000-0000000000f1",
  "00000000-0000-4000-8000-0000000000f2",
];

/** People answers rows x and y; Posts is the reorder world's. */
const withPeople = () => {
  const base = fake.listItems.getMockImplementation()!;
  fake.listItems.mockImplementation(async (c, q) =>
    c === PEOPLE.id
      ? itemsPageOf(
          ["x", "y"].map((name, index) =>
            rowOf(
              itemOf({
                id: PEOPLE_IDS[index],
                slug: name,
                data: { title: name.toUpperCase() },
              })
            )
          ),
          2,
          1
        )
      : base(c, q)
  );
};

const collectionRow = (slug: string) =>
  document.querySelector<HTMLElement>(`[data-cms-collection="${slug}"]`);

describe("another collection while a list call is in flight", () => {
  test("an E13 held in one collection blocks nothing in the next: a reorder, a bulk Publish and a row open run there", async () => {
    reorderWorld();
    withPeople();
    const held = deferred<CmsResult<{ changed: number }>>();
    const store = fake.reorderItems.getMockImplementation()!;
    fake.reorderItems.mockImplementationOnce(async (c, body) => {
      const answer = await held.promise;
      await store(c, body);
      return answer;
    });
    mount();
    await settle();
    await dragBelow("a", "c");
    expect(fake.reorderItems).toHaveBeenCalledTimes(1);

    await click(collectionRow("people"));
    expect(itemSlugs()).toEqual(["x", "y"]);
    // a drop there is sent there (item 7)
    await dragBelow("x", "y");
    expect(fake.reorderItems).toHaveBeenCalledTimes(2);
    expect(fake.reorderItems.mock.calls[1]).toEqual([
      PEOPLE.id,
      { ids: [PEOPLE_IDS[1], PEOPLE_IDS[0]] },
    ]);
    // an Alt+Arrow there is sent there
    expect(itemSlugs()).toEqual(["x", "y"]);
    focusRow("x");
    await altMove("ArrowDown");
    await wait(600);
    expect(fake.reorderItems).toHaveBeenCalledTimes(3);
    expect(fake.reorderItems.mock.calls[2][0]).toBe(PEOPLE.id);

    // a bulk Publish runs
    await click(checkbox("Select X"));
    expect(toolbarButton("Publish")?.disabled).toBe(false);
    await click(toolbarButton("Publish"));
    expect(fake.publishItems).toHaveBeenCalledWith(
      PEOPLE.id,
      expect.anything()
    );

    // the Posts answer lands, and a row open still runs
    await act(async () => held.resolve({ changed: 3 }));
    await settle();
    focusRow("y");
    await act(async () => userEvent.keyboard("{Enter}"));
    await settle();
    expect(fake.getItem).toHaveBeenCalledWith(PEOPLE.id, PEOPLE_IDS[1]);
  });

  test("back in a collection whose E13 is still in flight, a row open and a bulk Publish wait for it and its refetch", async () => {
    const world = reorderWorld();
    withPeople();
    const held = deferred<CmsResult<{ changed: number }>>();
    const store = fake.reorderItems.getMockImplementation()!;
    fake.reorderItems.mockImplementationOnce(async (c, body) => {
      const answer = await held.promise;
      await store(c, body);
      return answer;
    });
    fake.publishItems.mockImplementation(async (_c, { items }) => ({
      published: items.map((item) => item.id),
      unchanged: [],
      conflicts: [],
      failed: [],
    }));
    mount();
    await settle();
    await dragBelow("a", "c");
    expect(fake.reorderItems).toHaveBeenCalledTimes(1);
    await click(collectionRow("people"));
    expect(itemSlugs()).toEqual(["x", "y"]);
    await click(collectionRow("posts"));
    expect(itemSlugs()).toEqual(["b", "c", "a"]);

    await click(checkbox("Select A"));
    await click(toolbarButton("Publish"));
    focusRow("b");
    await act(async () => userEvent.keyboard("{Enter}"));
    await settle();
    expect(fake.publishItems).not.toHaveBeenCalled();
    expect(fake.getItem).not.toHaveBeenCalled();

    await act(async () => held.resolve({ changed: 3 }));
    await settle();
    expect(fake.publishItems).toHaveBeenCalledTimes(1);
    expect(fake.publishItems.mock.calls[0][1].items).toEqual([
      { id: ROW_IDS[0], updatedAt: world.versions[ROW_IDS[0]] },
    ]);
    expect(world.versions[ROW_IDS[0]]).toBe(versionOf(ROW_IDS[0], 1));
    expect(fake.getItem).toHaveBeenCalledWith(POSTS.id, ROW_IDS[1]);
  });

  test("a row opened while a bulk call is in flight is dropped when another collection opens", async () => {
    reorderWorld();
    withPeople();
    const held = deferred<Awaited<ReturnType<FakeCmsSource["publishItems"]>>>();
    fake.publishItems.mockImplementation(() => held.promise);
    mount();
    await settle();
    await click(checkbox("Select A"));
    await click(toolbarButton("Publish"));
    await click(rowEl("b"));
    await click(collectionRow("people"));
    await act(async () =>
      held.resolve({
        published: [ROW_IDS[0]],
        unchanged: [],
        conflicts: [],
        failed: [],
      })
    );
    await settle();
    expect(fake.getItem).not.toHaveBeenCalled();
    expect(itemSlugs()).toEqual(["x", "y"]);
  });
});

/** The Name sort answers the rows by slug. */
const sortByName = () => {
  const base = fake.listItems.getMockImplementation()!;
  fake.listItems.mockImplementation(async (c, q) => {
    const answer = await base(c, q);
    if (q.sort !== "name" || isCmsFailure(answer)) {
      return answer;
    }
    const items = [...answer.items].sort((left, right) =>
      left.slug.localeCompare(right.slug)
    );
    return { ...answer, items };
  });
};

/** The first E13 is held until resolved, then stores its order. */
const holdFirstReorder = () => {
  const held = deferred<CmsResult<{ changed: number }>>();
  const store = fake.reorderItems.getMockImplementation()!;
  fake.reorderItems
    .mockImplementationOnce(async (c, body) => {
      const answer = await held.promise;
      await store(c, body);
      return answer;
    })
    .mockImplementation(store);
  return held;
};

/** The Name header, clicked with the focus kept in the table. */
const clickNameHeader = async () => {
  const name = [
    ...document.querySelectorAll<HTMLElement>('[role="columnheader"] button'),
  ].find((button) => button.textContent?.startsWith("Name"))!;
  act(() => {
    name.click();
  });
  await settle();
};

describe("the order E13 accepted is provisional", () => {
  test("after E13 200 and a failed refetch, the next page drawn and another sort show the server's order", async () => {
    const world = reorderWorld();
    const base = fake.listItems.getMockImplementation()!;
    fake.listItems.mockImplementation(async (c, q) => {
      const answer = await base(c, q);
      if (q.sort !== "name" || isCmsFailure(answer)) {
        return answer;
      }
      const items = [...answer.items].sort((left, right) =>
        left.slug.localeCompare(right.slug)
      );
      return { ...answer, items };
    });
    mount();
    await settle();
    fake.listItems.mockResolvedValueOnce({ error: "rate_limited" });
    await dragBelow("a", "b");
    expect(world.ids).toEqual([ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]]);
    // the refetch failed: the accepted order shows
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
    // the next page drawn is the server's order, whatever it holds now
    world.ids = [ROW_IDS[2], ROW_IDS[0], ROW_IDS[1]];
    refreshCmsNative();
    await settle();
    expect(itemSlugs()).toEqual(["c", "a", "b"]);
    world.ids = [ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]];

    await click(
      [
        ...document.querySelectorAll<HTMLElement>(
          '[role="columnheader"] button'
        ),
      ].find((button) => button.textContent?.startsWith("Name"))
    );
    expect(itemSlugs()).toEqual(["a", "b", "c"]);
    await click(buttonByText("Sort"));
    await click(menuItemByText("Manual order"));
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
  });

  test("after E13 200 and a failed refetch, moves that cancel out keep the accepted order and send nothing", async () => {
    reorderWorld();
    mount();
    await settle();
    fake.listItems.mockResolvedValueOnce({ error: "rate_limited" });
    await dragBelow("a", "b");
    expect(reorderCalls()).toEqual([[ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]]]);
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
    focusRow("a");
    await altMove("ArrowDown");
    await altMove("ArrowUp");
    await wait(600);
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
    expect(fake.reorderItems).toHaveBeenCalledTimes(1);
  });

  test("E13 in flight, then the Name header: E13 200 and a failed refetch keep the Name order", async () => {
    const world = reorderWorld();
    sortByName();
    const held = holdFirstReorder();
    mount();
    await settle();
    await dragBelow("a", "b");
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
    await clickNameHeader();
    expect(itemSlugs()).toEqual(["a", "b", "c"]);
    fake.listItems.mockResolvedValueOnce({ error: "rate_limited" });
    await act(async () => held.resolve({ changed: 3 }));
    await settle();
    expect(world.ids).toEqual([ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]]);
    expect(itemSlugs()).toEqual(["a", "b", "c"]);
  });

  test("on a second visit, E13 in flight, then the Name header: E13 200 and a failed refetch keep the Name order", async () => {
    const world = reorderWorld();
    sortByName();
    withPeople();
    const held = holdFirstReorder();
    mount();
    await settle();
    await dragBelow("a", "b");
    await click(collectionRow("people"));
    await click(collectionRow("posts"));
    // the moved order shows while its E13 is in flight
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
    await clickNameHeader();
    expect(itemSlugs()).toEqual(["a", "b", "c"]);
    fake.listItems.mockResolvedValueOnce({ error: "rate_limited" });
    await act(async () => held.resolve({ changed: 3 }));
    await settle();
    expect(world.ids).toEqual([ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]]);
    expect(itemSlugs()).toEqual(["a", "b", "c"]);
  });

  test("after E13 200 and a failed refetch, a newer order drawn during the pause is the one moves that cancel out return to", async () => {
    const world = reorderWorld();
    mount();
    await settle();
    fake.listItems.mockResolvedValueOnce({ error: "rate_limited" });
    await dragBelow("a", "b");
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
    focusRow("a");
    await altMove("ArrowDown");
    expect(itemSlugs()).toEqual(["b", "c", "a"]);
    // another person reorders to c, b, a; a refresh answers it in the pause
    world.ids = [ROW_IDS[2], ROW_IDS[1], ROW_IDS[0]];
    refreshCmsNative();
    await settle();
    focusRow("a");
    await altMove("ArrowUp");
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
    await wait(600);
    // the server holds c, b, a: the order shown is sent
    expect(reorderCalls()).toEqual([
      [ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]],
      [ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]],
    ]);
    expect(world.ids).toEqual([ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]]);
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
  });
});

describe("the top bar at 1024 px", () => {
  test("an 80-character collection name leaves Filter and Sort whole", async () => {
    const name = "Long name ".repeat(8);
    fake.listCollections.mockResolvedValue({
      collections: [{ ...POSTS, name }],
    });
    await mountThree();
    container!.style.width = "1024px";
    await wait(50);
    for (const selector of ["[data-cms-filter]", "[data-cms-sort]"]) {
      const button = document.querySelector<HTMLElement>(selector)!;
      expect(button).not.toBeNull();
      expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
      for (const element of button.querySelectorAll<HTMLElement>("*")) {
        expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth);
      }
    }
  });
});

describe("bulk Publish's partial results", () => {
  const D_ID = "00000000-0000-4000-8000-00000000000d";
  const fourRows = () => [
    ...threeRows(),
    rowOf(itemOf({ id: D_ID, slug: "d", data: { title: "D" } })),
  ];

  test("counts several conflicts and failures in one toast each", async () => {
    const error = vi.spyOn(toast, "error");
    fake.listItems.mockImplementation(async () =>
      itemsPageOf(fourRows(), 4, 1)
    );
    mount();
    await settle();
    fake.publishItems.mockResolvedValue({
      published: [ROW_IDS[0]],
      unchanged: [],
      conflicts: [ROW_IDS[1], ROW_IDS[2]],
      failed: [D_ID],
    });
    await click(checkbox("Select all on this page"));
    await click(toolbarButton("Publish"));
    expect(error).toHaveBeenCalledWith("2 changed by someone else");
    expect(error).toHaveBeenCalledWith("1 not published");
    expect(error).toHaveBeenCalledTimes(2);
  });

  test("a clean Publish shows no toast", async () => {
    const error = vi.spyOn(toast, "error");
    fake.listItems.mockImplementation(async () =>
      itemsPageOf(fourRows(), 4, 1)
    );
    mount();
    await settle();
    fake.publishItems.mockResolvedValue({
      published: [ROW_IDS[0], ROW_IDS[1], ROW_IDS[2], D_ID],
      unchanged: [],
      conflicts: [],
      failed: [],
    });
    await click(checkbox("Select all on this page"));
    await click(toolbarButton("Publish"));
    expect(fake.publishItems).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });
});

describe("a list write answered by a sign-in refusal", () => {
  test.each(["unauthorized", "mfa_required"] as const)(
    "a bulk call answered %s shows the line, with no toast",
    async (code) => {
      const error = vi.spyOn(toast, "error");
      await mountThree();
      fake.publishItems.mockResolvedValue({ error: code });
      await click(checkbox("Select A"));
      await click(toolbarButton("Publish"));
      expect(
        document.body.textContent?.includes(
          code === "unauthorized"
            ? "Signed out of OrganizeOS"
            : "Two-step sign-in required"
        )
      ).toBe(true);
      expect(error).not.toHaveBeenCalled();
    }
  );

  test.each(["unauthorized", "mfa_required"] as const)(
    "E13 answered %s shows the line, with no toast",
    async (code) => {
      const error = vi.spyOn(toast, "error");
      reorderWorld();
      fake.reorderItems.mockResolvedValue({ error: code });
      mount();
      await settle();
      await dragBelow("a", "b");
      expect(
        document.body.textContent?.includes(
          code === "unauthorized"
            ? "Signed out of OrganizeOS"
            : "Two-step sign-in required"
        )
      ).toBe(true);
      expect(error).not.toHaveBeenCalled();
    }
  );
});

describe("a filter change goes back to page 1", () => {
  test("from page 2, a status and then an option filter each ask page 1", async () => {
    await mountEvents(
      itemsPageOf([eventRow()], 60, 1, {
        columns: ["kind"],
        filterField: "kind",
      })
    );
    await click(byLabel("Next"));
    expect(lastListItemsCall()?.[1]).toMatchObject({ page: 2 });
    await click(buttonByText("Filter"));
    await click(menuItemByText("Draft"));
    expect(lastListItemsCall()?.[1]).toMatchObject({
      page: 1,
      status: "draft",
    });

    await click(byLabel("Next"));
    expect(lastListItemsCall()?.[1]).toMatchObject({ page: 2 });
    await click(buttonByText("Filter 1"));
    await click(menuItemByText("Café"));
    expect(lastListItemsCall()?.[1]).toMatchObject({
      page: 1,
      status: "draft",
      optionKey: "kind",
      optionValue: "Café",
    });
  });
});

describe("an option filter whose field is not loaded", () => {
  test("still shows in the Filter, which can clear it", async () => {
    fake.listCollections.mockResolvedValue({ collections: [EVENTS] });
    fake.getCollection.mockResolvedValue({ error: "unavailable" });
    fake.listItems.mockImplementation(async (_c, q) => ({
      ...itemsPageOf([eventRow()], 1, 1, { filterField: "kind" }),
      applied: {
        status: q.status ?? "all",
        sort: q.sort ?? "order",
        direction: q.direction ?? "asc",
        optionKey: q.optionKey ?? null,
        optionValue: q.optionValue ?? null,
      },
    }));
    mount({
      initialView: {
        collectionId: EVENTS.id,
        list: {
          status: "all",
          sort: "order",
          direction: "asc",
          option: { key: "kind", value: "Café" },
        },
      },
    });
    await settle();
    expect(lastListItemsCall()?.[1]).toMatchObject({ optionKey: "kind" });
    await click(buttonByText("Filter 1"));
    await click(menuItemByText("Any kind"));
    expect(lastListItemsCall()?.[1].optionKey).toBeUndefined();
    expect(buttonByText("Filter")).not.toBeUndefined();
  });
});

describe("the reorder's state outlives the table (W3g)", () => {
  test("back in a collection whose E13 is in flight, a move then the Name header sends the order after it, and a waiting bulk Publish still waits", async () => {
    const world = reorderWorld();
    sortByName();
    withPeople();
    const held = holdFirstReorder();
    fake.publishItems.mockImplementation(async (_c, { items }) => ({
      published: items.map((item) => item.id),
      unchanged: [],
      conflicts: [],
      failed: [],
    }));
    mount();
    await settle();
    await dragBelow("a", "c");
    expect(reorderCalls()).toEqual([[ROW_IDS[1], ROW_IDS[2], ROW_IDS[0]]]);
    await click(collectionRow("people"));
    await click(collectionRow("posts"));
    // the moved order shows, and moves start from it
    expect(itemSlugs()).toEqual(["b", "c", "a"]);

    await click(checkbox("Select A"));
    await click(toolbarButton("Publish"));
    focusRow("c");
    await altMove("ArrowUp");
    expect(itemSlugs()).toEqual(["c", "b", "a"]);
    await clickNameHeader();
    await wait(600);
    expect(fake.publishItems).not.toHaveBeenCalled();
    expect(fake.reorderItems).toHaveBeenCalledTimes(1);

    await act(async () => held.resolve({ changed: 3 }));
    await settle();
    await wait(600);
    expect(reorderCalls()).toEqual([
      [ROW_IDS[1], ROW_IDS[2], ROW_IDS[0]],
      [ROW_IDS[2], ROW_IDS[1], ROW_IDS[0]],
    ]);
    expect(world.ids).toEqual([ROW_IDS[2], ROW_IDS[1], ROW_IDS[0]]);
    expect(fake.publishItems).toHaveBeenCalledTimes(1);
    expect(fake.publishItems.mock.calls[0][1].items).toEqual([
      { id: ROW_IDS[0], updatedAt: world.versions[ROW_IDS[0]] },
    ]);
  });

  test("an order queued behind an E13 in flight is sent after it when a filter draws other rows first", async () => {
    const world = reorderWorld();
    const base = fake.listItems.getMockImplementation()!;
    // Draft answers a and c only
    fake.listItems.mockImplementation(async (c, q) => {
      const answer = await base(c, q);
      if (q.status !== "draft" || isCmsFailure(answer)) {
        return answer;
      }
      const items = answer.items.filter((row) => row.slug !== "b");
      return { ...answer, items, total: items.length };
    });
    const held = holdFirstReorder();
    mount();
    await settle();
    await dragBelow("a", "b");
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
    focusRow("c");
    await altMove("ArrowUp");
    expect(itemSlugs()).toEqual(["b", "c", "a"]);
    await wait(600);
    expect(fake.reorderItems).toHaveBeenCalledTimes(1);
    await click(buttonByText("Filter"));
    await click(menuItemByText("Draft"));
    expect(itemSlugs()).toEqual(["a", "c"]);

    await act(async () => held.resolve({ changed: 2 }));
    await settle();
    expect(reorderCalls()).toEqual([
      [ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]],
      [ROW_IDS[1], ROW_IDS[2], ROW_IDS[0]],
    ]);
    expect(world.ids).toEqual([ROW_IDS[1], ROW_IDS[2], ROW_IDS[0]]);
  });

  test("after an item visit while E13 is in flight, the moved order shows and a move is made from it and sent after the E13", async () => {
    const world = reorderWorld();
    const held = holdFirstReorder();
    mount();
    await settle();
    await dragBelow("a", "c");
    expect(itemSlugs()).toEqual(["b", "c", "a"]);
    // the table unmounts for the editor and mounts again on Back
    await click(buttonByText("New item"));
    expect(itemRows()).toHaveLength(0);
    await click(byLabel("Back"));
    expect(itemSlugs()).toEqual(["b", "c", "a"]);
    expect(handles()).toHaveLength(3);

    // a move starts from the order sent, and waits for its E13
    focusRow("a");
    await altMove("ArrowUp");
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
    await wait(600);
    expect(fake.reorderItems).toHaveBeenCalledTimes(1);
    // a row open waits for the E13 and its refetch
    focusRow("b");
    await act(async () => userEvent.keyboard("{Enter}"));
    await settle();
    expect(fake.getItem).not.toHaveBeenCalled();

    await act(async () => held.resolve({ changed: 3 }));
    await settle();
    await wait(600);
    expect(reorderCalls()).toEqual([
      [ROW_IDS[1], ROW_IDS[2], ROW_IDS[0]],
      [ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]],
    ]);
    expect(world.ids).toEqual([ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]]);
    expect(fake.getItem).toHaveBeenCalledWith(POSTS.id, ROW_IDS[1]);
  });
});

describe("the reorder's state across visits (W3g round 3)", () => {
  const B_C_A = [ROW_IDS[1], ROW_IDS[2], ROW_IDS[0]];
  const B_A_C = [ROW_IDS[1], ROW_IDS[0], ROW_IDS[2]];

  /** Drag a below c while E13 is held, then Alt+ArrowUp on a: b, a, c. */
  const moveTwice = async () => {
    const world = reorderWorld();
    withPeople();
    const held = holdFirstReorder();
    mount();
    await settle();
    await dragBelow("a", "c");
    focusRow("a");
    await altMove("ArrowUp");
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
    return { world, held };
  };

  test("an order queued behind E13 is sent when the E13 answers while the editor shows", async () => {
    const { world, held } = await moveTwice();
    await click(buttonByText("New item"));
    expect(itemRows()).toHaveLength(0);
    await act(async () => held.resolve({ changed: 3 }));
    await settle();
    expect(reorderCalls()).toEqual([B_C_A, B_A_C]);
    expect(world.ids).toEqual(B_A_C);
  });

  test("an order queued behind E13 is sent when the E13 answers after another collection opened from the editor", async () => {
    const { world, held } = await moveTwice();
    await click(buttonByText("New item"));
    await click(collectionRow("people"));
    expect(itemSlugs()).toEqual(["x", "y"]);
    await act(async () => held.resolve({ changed: 3 }));
    await settle();
    expect(reorderCalls()).toEqual([B_C_A, B_A_C]);
    expect(world.ids).toEqual(B_A_C);
  });

  test("an order queued behind E13 is sent when the E13 answers after another collection opened from the table", async () => {
    const { world, held } = await moveTwice();
    await click(collectionRow("people"));
    expect(itemSlugs()).toEqual(["x", "y"]);
    await act(async () => held.resolve({ changed: 3 }));
    await settle();
    expect(reorderCalls()).toEqual([B_C_A, B_A_C]);
    expect(world.ids).toEqual(B_A_C);
    // back in Posts, the server's order
    await click(collectionRow("posts"));
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
  });

  test("a drop made while E13 is in flight shows at once, and is sent after it", async () => {
    const world = reorderWorld();
    const held = holdFirstReorder();
    mount();
    await settle();
    await dragBelow("a", "b");
    expect(itemSlugs()).toEqual(["b", "a", "c"]);
    await dragBelow("b", "a");
    expect(itemSlugs()).toEqual(["a", "b", "c"]);
    expect(fake.reorderItems).toHaveBeenCalledTimes(1);
    await act(async () => held.resolve({ changed: 2 }));
    await settle();
    expect(reorderCalls()).toEqual([B_A_C, ROW_IDS]);
    expect(world.ids).toEqual(ROW_IDS);
  });

  test("a bulk call waiting on the reorder is dropped with a toast when another collection opens", async () => {
    reorderWorld();
    withPeople();
    const held = holdFirstReorder();
    const error = vi.spyOn(toast, "error");
    mount();
    await settle();
    await dragBelow("a", "b");
    await click(checkbox("Select C"));
    await click(toolbarButton("Publish"));
    expect(error).not.toHaveBeenCalled();
    await click(collectionRow("people"));
    expect(error).toHaveBeenCalledWith("Try again in a minute");
    await act(async () => held.resolve({ changed: 2 }));
    await settle();
    expect(fake.publishItems).not.toHaveBeenCalled();
  });
});

describe("a bulk call waiting on the reorder when the table unmounts (W3g round 4)", () => {
  test("an item visit drops it with one toast, and it never runs", async () => {
    reorderWorld();
    const held = holdFirstReorder();
    const error = vi.spyOn(toast, "error");
    mount();
    await settle();
    await dragBelow("a", "b");
    await click(checkbox("Select C"));
    await click(toolbarButton("Publish"));
    // Escape clears the selection; the call still waits
    act(() => {
      rowEl("a")!.focus();
    });
    await act(async () => userEvent.keyboard("{Escape}"));
    await settle();
    expect(error).not.toHaveBeenCalled();
    await click(buttonByText("New item"));
    expect(itemRows()).toHaveLength(0);
    expect(
      error.mock.calls.filter(([text]) => text === "Try again in a minute")
    ).toHaveLength(1);
    await act(async () => held.resolve({ changed: 2 }));
    await settle();
    expect(fake.publishItems).not.toHaveBeenCalled();
  });
});

describe("the search box stays while a cleared search reads (W3g round 3)", () => {
  /** "zzz" matches nothing; the next read waits until released. */
  const searchNothing = async () => {
    fake.listItems.mockImplementation(async (_c, q) =>
      q.q === "zzz" ? itemsPageOf([], 0, 1) : pageOf(1, 3)
    );
    const gate = holdListItems();
    mount();
    await settle();
    await act(async () => userEvent.type(searchInput()!, "zzz"));
    await wait(300);
    expect(itemRows()).toHaveLength(0);
    expect(hasNoMatches()).toBe(true);
    gate.hold();
    return gate;
  };
  const hasNoMatches = () =>
    document.querySelector("[data-cms-no-matches]") !== null;

  test("erasing a search with no match keeps the search box and its focus", async () => {
    const gate = await searchNothing();
    const field = searchInput()!;
    await act(async () => userEvent.clear(field));
    await wait(300);
    expect(searchInput()).toBe(field);
    expect(document.activeElement).toBe(field);
    await gate.release();
    expect(itemRows()).toHaveLength(3);
    expect(document.activeElement).toBe(field);
  });

  test("Escape on a search with no match keeps the search box and its focus", async () => {
    const gate = await searchNothing();
    const field = searchInput()!;
    act(() => {
      field.focus();
    });
    await act(async () => userEvent.keyboard("{Escape}"));
    await wait(50);
    expect(searchInput()).toBe(field);
    expect(document.activeElement).toBe(field);
    await gate.release();
    expect(itemRows()).toHaveLength(3);
  });
});
