import { describe, expect, test } from "vitest";
import type { CmsField, CmsItemsApplied } from "./cms-source";
import {
  adoptApplied,
  canDragRows,
  defaultDirection,
  defaultListState,
  filterCount,
  fitFieldColumns,
  getCellText,
  getChangedSincePublish,
  getDeleteTitle,
  getListFailureText,
  isSortableField,
  keepSelection,
  moveRow,
  nextSort,
  resolveColumns,
  toItemsQuery,
  type CmsListState,
} from "./cms-list-logic";

const COLLECTION = "44444444-4444-4444-8444-444444444444";

const field = (
  overrides: Partial<CmsField> & Pick<CmsField, "key" | "kind">
): CmsField => ({
  label: overrides.key,
  ...overrides,
});

const online = field({ key: "online", label: "Online", kind: "switch" });
const kind = field({
  key: "kind",
  label: "Kind",
  kind: "option",
  options: [
    { value: "Q&A night", label: "Q&A night" },
    { value: "Café", label: "Café" },
  ],
});

const stateOf = (overrides: Partial<CmsListState> = {}): CmsListState => ({
  ...defaultListState(COLLECTION),
  ...overrides,
});

describe("defaultDirection", () => {
  test("is desc for updated, else asc", () => {
    expect(defaultDirection("updated")).toBe("desc");
    expect(defaultDirection("order")).toBe("asc");
    expect(defaultDirection("name")).toBe("asc");
    expect(defaultDirection("field:online")).toBe("asc");
  });
});

describe("toItemsQuery", () => {
  test("carries the list state, leaving out each key at its default", () => {
    expect(toItemsQuery(defaultListState(COLLECTION), undefined, 1)).toEqual({
      q: undefined,
      page: 1,
    });
    expect(
      toItemsQuery(
        stateOf({
          status: "archived",
          sort: "name",
          direction: "desc",
          option: { key: "kind", value: "Café" },
        }),
        "x",
        2
      )
    ).toEqual({
      q: "x",
      page: 2,
      status: "archived",
      sort: "name",
      direction: "desc",
      optionKey: "kind",
      optionValue: "Café",
    });
    expect(
      toItemsQuery(
        stateOf({ sort: "updated", direction: "desc" }),
        undefined,
        3
      )
    ).toEqual({ q: undefined, page: 3, sort: "updated" });
  });
});

describe("adoptApplied", () => {
  const applied: CmsItemsApplied = {
    status: "archived",
    sort: "name",
    direction: "desc",
    optionKey: "kind",
    optionValue: "Café",
  };

  test("returns the same state when applied matches, else the applied filter and sort", () => {
    const matching = stateOf({
      status: "archived",
      sort: "name",
      direction: "desc",
      option: { key: "kind", value: "Café" },
    });
    expect(adoptApplied(matching, applied)).toBe(matching);

    const adopted = adoptApplied(defaultListState(COLLECTION), applied);
    expect(adopted).not.toBe(applied);
    expect(adopted).toMatchObject({
      status: "archived",
      sort: "name",
      direction: "desc",
      option: { key: "kind", value: "Café" },
    });

    const cleared = adoptApplied(stateOf({ status: "draft" }), {
      status: "all",
      sort: "order",
      direction: "asc",
      optionKey: null,
      optionValue: null,
    });
    expect(cleared.status).toBe("all");
    expect(cleared.option).toBeNull();
  });
});

describe("resolveColumns", () => {
  test("skips a key the fields lack and reports it", () => {
    const resolved = resolveColumns([online, kind], ["online", "gone"]);
    expect(resolved.fields).toEqual([online]);
    expect(resolved.missing).toBe(true);
    expect(resolveColumns([online], ["online"])).toEqual({
      fields: [online],
      missing: false,
    });
  });
});

describe("fitFieldColumns", () => {
  test.each([
    [1040, 4, true, false, 3],
    [800, 4, true, false, 1],
    [600, 4, true, false, 0],
    [1280, 4, false, false, 4],
    [1280, 2, false, false, 2],
  ])(
    "at %i px, %i wanted (checkbox %s, handle %s), %i field columns fit",
    (width, wanted, checkbox, handle, expected) => {
      expect(fitFieldColumns({ width, wanted, checkbox, handle })).toBe(
        expected
      );
    }
  );
});

describe("getCellText", () => {
  const reference = field({
    key: "host",
    kind: "reference",
    reference: { collectionId: COLLECTION, multiple: false },
  });
  const date = field({ key: "day", kind: "date" });
  const number = field({ key: "seats", kind: "number" });
  const text = field({ key: "title", kind: "text" });

  test.each([
    [online, true, "Yes"],
    [online, false, "No"],
    [online, null, ""],
    [online, "yes", "No"],
    [kind, "Q&A night", "Q&A night"],
    [kind, "gone", "gone"],
    [reference, "11111111-1111-4111-8111-111111111111", "Linked"],
    [date, "2026-11-13", "2026-11-13"],
    [text, "", ""],
    [number, null, ""],
  ])("a %s cell of %j reads %j", (cell, value, expected) => {
    expect(getCellText(cell, value)).toBe(expected);
  });

  test("a number reads in the locale's format, a datetime as a medium date and a short time", () => {
    expect(getCellText(number, 1200)).toBe(
      new Intl.NumberFormat().format(1200)
    );
    const datetime = field({ key: "starts", kind: "datetime" });
    const iso = "2026-11-13T18:30:00+00:00";
    expect(getCellText(datetime, iso)).toBe(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso))
    );
  });
});

describe("keepSelection", () => {
  test("keeps only the ids still shown", () => {
    const kept = keepSelection(new Set(["a", "b", "c"]), [
      { id: "b" },
      { id: "d" },
    ]);
    expect([...kept]).toEqual(["b"]);
  });
});

describe("nextSort", () => {
  test("flips the active header and sets the first direction on another", () => {
    expect(nextSort({ sort: "name", direction: "asc" }, "name")).toEqual({
      sort: "name",
      direction: "desc",
    });
    expect(nextSort({ sort: "name", direction: "asc" }, "updated")).toEqual({
      sort: "updated",
      direction: "desc",
    });
    expect(nextSort({ sort: "name", direction: "asc" }, "status")).toEqual({
      sort: "status",
      direction: "asc",
    });
  });
});

describe("filterCount", () => {
  test("counts status and option", () => {
    expect(filterCount(defaultListState(COLLECTION))).toBe(0);
    expect(filterCount(stateOf({ status: "draft" }))).toBe(1);
    expect(
      filterCount(stateOf({ option: { key: "kind", value: "Café" } }))
    ).toBe(1);
    expect(
      filterCount(
        stateOf({ status: "draft", option: { key: "kind", value: "Café" } })
      )
    ).toBe(2);
  });
});

describe("canDragRows", () => {
  const base = {
    canEdit: true,
    state: defaultListState(COLLECTION),
    q: "",
    total: 10,
  };
  test("only with canEdit, Manual order, no search, no filter and a total of at most 50", () => {
    expect(canDragRows(base)).toBe(true);
    expect(canDragRows({ ...base, canEdit: false })).toBe(false);
    expect(canDragRows({ ...base, state: stateOf({ sort: "name" }) })).toBe(
      false
    );
    expect(canDragRows({ ...base, q: "x" })).toBe(false);
    expect(canDragRows({ ...base, state: stateOf({ status: "draft" }) })).toBe(
      false
    );
    expect(
      canDragRows({
        ...base,
        state: stateOf({ option: { key: "kind", value: "Café" } }),
      })
    ).toBe(false);
    expect(canDragRows({ ...base, total: 51 })).toBe(false);
    expect(canDragRows({ ...base, total: 50 })).toBe(true);
  });
});

describe("moveRow", () => {
  test("moves one id", () => {
    expect(moveRow(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveRow(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
});

describe("getChangedSincePublish", () => {
  const fields = [
    field({ key: "title", kind: "text", isTitle: true }),
    field({ key: "body", kind: "richtext" }),
  ];
  const live = {
    slug: "a",
    data: { title: "A", body: { html: "<p>x</p>", text: "x" } },
  };

  test("compares the stored forms, and the address", () => {
    expect(
      getChangedSincePublish({
        fields,
        live,
        values: { title: "A", body: { html: "<p>x</p>", text: "x" } },
        slug: "a",
      })
    ).toEqual({ keys: new Set(), address: false });
    expect(
      getChangedSincePublish({
        fields,
        live,
        values: { title: "B", body: { html: "<p>x</p>", text: "x" } },
        slug: "a",
      })
    ).toEqual({ keys: new Set(["title"]), address: false });
    expect(
      getChangedSincePublish({
        fields,
        live,
        values: { title: "A", body: { html: "<p>x</p>", text: "x" } },
        slug: "b",
      })
    ).toEqual({ keys: new Set(), address: true });
    expect(
      getChangedSincePublish({
        fields,
        live: null,
        values: { title: "Z" },
        slug: "z",
      })
    ).toEqual({ keys: new Set(), address: false });
  });
});

describe("getDeleteTitle", () => {
  test.each([
    [1, "Delete 1 event?"],
    [3, "Delete 3 events?"],
  ])("getDeleteTitle(%i)", (count, expected) => {
    expect(
      getDeleteTitle(count, { name: "Events", singularName: "Event" })
    ).toBe(expected);
  });
});

describe("getListFailureText", () => {
  test.each([
    ["publish", "forbidden", "No access"],
    ["publish", "invalid", "Not published"],
    ["status", "slug_taken", "Address in use"],
    ["status", "invalid", "Not changed"],
    ["delete", "invalid", "Not deleted"],
    ["order", "conflict", "Not moved"],
    ["delete", "not_found", "Collection not found"],
    ["order", "not_found", "Collection not found"],
    ["order", "unavailable", "Try again in a minute"],
    ["status", "plan", "Not in plan"],
  ] as const)("getListFailureText(%s, %s) is %s", (action, code, expected) => {
    expect(getListFailureText(action, code)).toBe(expected);
  });
});

describe("isSortableField", () => {
  test.each([
    ["text", false, true],
    ["date", false, true],
    ["switch", false, true],
    ["option", false, true],
    ["number", false, false],
    ["datetime", false, false],
    ["reference", false, false],
    ["text", true, false],
  ] as const)("a %s field (title %s) sorts: %s", (kind, isTitle, sorts) => {
    expect(isSortableField({ key: "k", label: "K", kind, isTitle })).toBe(
      sorts
    );
  });
});
