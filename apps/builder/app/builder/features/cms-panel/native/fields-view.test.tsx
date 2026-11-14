// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { toast } from "@webstudio-is/design-system";
import type { CmsResult } from "./cms-source";
import { POSTS, POSTS_DETAIL, VERSION } from "./fake-cms-source";
import { POSTS_STRUCTURE } from "./fake-cms-structure-source";
import type { CmsStructureField } from "./cms-structure-source";
import {
  buttonByText,
  byLabel,
  click,
  deferred,
  editItemTitle,
  fieldKeys,
  fieldRow,
  harness,
  hasText,
  menuItem,
  menuItems,
  mount,
  reopen,
  resetHarness,
  settle,
  tab,
  typeInto,
  unmount,
  keepEditing,
  discardChanges,
} from "./structure-test-harness";

beforeEach(resetHarness);
afterEach(() => {
  vi.useRealTimers();
  unmount();
});

const NEXT = "2026-11-12T10:05:00.123456+00:00";
const LATER = "2026-11-12T10:06:00.123456+00:00";

const fields: CmsStructureField[] = [
  ...POSTS_DETAIL.fields,
  {
    key: "role",
    label: "Role",
    kind: "text",
    required: true,
    locked: true,
  },
];

const withFields = (list: CmsStructureField[]) =>
  harness.structure.getCollectionStructure.mockResolvedValue({
    collection: { ...POSTS_STRUCTURE, fields: list },
  });

const openFields = async () => {
  mount();
  await settle();
  await click(tab("Fields"));
};

const sheet = () =>
  document.querySelector<HTMLElement>("[data-cms-field-sheet]");

/** Alt+Arrow on a row's button. */
const moveRow = async (key: string, key2: "ArrowUp" | "ArrowDown") => {
  const button = fieldRow(key)!.querySelector("button")!;
  button.focus();
  await act(async () => userEvent.keyboard(`{Alt>}{${key2}}{/Alt}`));
};

/** Runs the reorder's pause out. */
const pass = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await settle();
};

/** E24 answers with what it was sent; E21 holds it from then on. */
const answerSchema = (version = NEXT) =>
  harness.structure.updateSchema.mockImplementation(async (_id, body) => {
    harness.structure.getCollectionStructure.mockResolvedValue({
      collection: {
        ...POSTS_STRUCTURE,
        fields: body.fields,
        updatedAt: version,
      },
    });
    return { fields: body.fields, updatedAt: version };
  });

const manyFields = (count: number): CmsStructureField[] => [
  { key: "title", label: "Title", kind: "text", isTitle: true, required: true },
  ...Array.from({ length: count - 1 }, (_, index) => ({
    key: `f${index}`,
    label: `F${index}`,
    kind: "text" as const,
  })),
];

describe("the Fields tab", () => {
  test('rows: icon, name with " *" when required, the lock named From the template, then the Title chip or the kind', async () => {
    withFields(fields);
    await openFields();
    expect(fieldKeys()).toEqual(["title", "summary", "author", "role"]);
    const title = fieldRow("title")!;
    expect(title.querySelector("[data-kind-icon] svg")).not.toBeNull();
    expect(title.textContent).toContain("Title *");
    expect(title.textContent).toMatch(/Title$/);
    expect(fieldRow("summary")!.textContent).toBe("SummaryLong text");
    const role = fieldRow("role")!;
    expect(role.textContent).toContain("Role *");
    expect(
      role.querySelector('[aria-label="From the template"]')
    ).not.toBeNull();
    expect(role.textContent).toMatch(/Plain text$/);
  });

  test("a row opens its sheet behind the guard, and the open one is highlighted", async () => {
    mount();
    await settle();
    await editItemTitle();
    await click(tab("Fields"));
    await click(fieldRow("summary")!.querySelector("button"));
    expect(hasText("Discard unsaved changes?")).toBe(true);
    await keepEditing();
    expect(sheet()).toBeNull();
    await click(fieldRow("summary")!.querySelector("button"));
    await discardChanges();
    expect(sheet()).not.toBeNull();
    expect(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-label")?.value
    ).toBe("Summary");
    expect(
      fieldRow("summary")!.querySelector("button")?.getAttribute("aria-current")
    ).toBe("true");
  });

  test("Add field: Text, Media and links, Values, Relations with their kinds and icons; a choice opens a new sheet", async () => {
    await openFields();
    await click(byLabel("Add field"));
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    const groups = [...menu.querySelectorAll('[role="group"]')].map(
      (group) =>
        [...group.children].find(
          (child) =>
            child.getAttribute("role") !== "separator" &&
            child.getAttribute("role") !== "menuitem"
        )?.textContent
    );
    expect(groups).toEqual(["Text", "Media and links", "Values", "Relations"]);
    expect(menuItems()).toEqual([
      "Plain text",
      "Long text",
      "Rich text",
      "Image",
      "Link",
      "Email",
      "Phone",
      "Number",
      "Date",
      "Date and time",
      "Switch",
      "Color",
      "Option",
      "Reference",
      "Multi-reference",
    ]);
    expect(
      [...menu.querySelectorAll('[role="menuitem"]')].every(
        (item) => item.querySelector("svg") !== null
      )
    ).toBe(true);
    await click(menuItem("Email"));
    expect(sheet()).not.toBeNull();
    expect(
      [...document.querySelectorAll("[data-cms-crumb] > *")].map(
        (part) => part.textContent
      )
    ).toEqual(["Posts", "/", "New email field"]);
  });

  test("with an item editor holding unsaved values, choosing a kind in Add field asks Discard unsaved changes? first: Keep editing keeps the values and opens no sheet; Discard opens it", async () => {
    mount();
    await settle();
    await editItemTitle();
    await click(tab("Fields"));
    await click(byLabel("Add field"));
    await click(menuItem("Number"));
    expect(hasText("Discard unsaved changes?")).toBe(true);
    await keepEditing();
    expect(sheet()).toBeNull();
    await click(tab("Collections"));
    expect(
      document.querySelector<HTMLInputElement>("#cms-field-title")?.value
    ).toBe("Mine");
    await click(tab("Fields"));
    await click(byLabel("Add field"));
    await click(menuItem("Number"));
    await discardChanges();
    await vi.waitFor(() => expect(sheet()).not.toBeNull());
  });

  test("Alt+ArrowDown moves the focused row and keeps its focus; a drag by the grip moves it", async () => {
    await openFields();
    await moveRow("title", "ArrowDown");
    await settle();
    expect(fieldKeys()).toEqual(["summary", "title", "author"]);
    expect(document.activeElement).toBe(
      fieldRow("title")!.querySelector("button")
    );
    const grip = fieldRow("author")!.querySelector<HTMLElement>("[data-grip]")!;
    const from = fieldRow("author")!.getBoundingClientRect();
    const to = fieldRow("summary")!.getBoundingClientRect();
    const pointer = { pointerId: 1, pointerType: "mouse", isPrimary: true };
    act(() => {
      grip.dispatchEvent(
        new PointerEvent("pointerdown", {
          ...pointer,
          bubbles: true,
          button: 0,
          clientX: from.left + 10,
          clientY: from.top + from.height / 2,
        })
      );
    });
    for (const y of [from.top, to.top + to.height / 2, to.top + 2]) {
      act(() => {
        window.dispatchEvent(
          new PointerEvent("pointermove", {
            ...pointer,
            bubbles: true,
            clientX: from.left + 10,
            clientY: y,
          })
        );
      });
    }
    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointerup", { ...pointer, bubbles: true })
      );
    });
    await settle();
    expect(fieldKeys()).toEqual(["author", "summary", "title"]);
  });

  test("three moves within the pause send one E24 with the last order", async () => {
    answerSchema();
    await openFields();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await moveRow("title", "ArrowDown");
    await pass(200);
    await moveRow("title", "ArrowDown");
    await pass(200);
    await moveRow("summary", "ArrowDown");
    await pass(200);
    expect(harness.structure.updateSchema).not.toHaveBeenCalled();
    await pass(500);
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
    const [id, body] = harness.structure.updateSchema.mock.calls[0];
    expect(id).toBe(POSTS.id);
    expect(body.fields.map((field) => field.key)).toEqual([
      "author",
      "summary",
      "title",
    ]);
    expect(body.expectedUpdatedAt).toBe(VERSION);
    expect(body.removeKeys).toBeUndefined();
  });

  test("a settings Save after a reorder sends the reorder's updatedAt; no conflict", async () => {
    // E24 answers at NEXT; no E21 answers from the move on, so the version
    // can come only from E24's answer, through the queue
    harness.structure.updateSchema.mockImplementation(async (_id, body) => ({
      fields: body.fields,
      updatedAt: NEXT,
    }));
    harness.structure.updateCollection.mockImplementation(
      async (id, { expectedUpdatedAt, ...settings }) =>
        expectedUpdatedAt === NEXT
          ? { collection: { id, ...settings, updatedAt: LATER } }
          : { error: "conflict" }
    );
    await openFields();
    const held = deferred<never>();
    harness.structure.getCollectionStructure.mockReturnValue(held.promise);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await moveRow("title", "ArrowDown");
    await pass(600);
    vi.useRealTimers();
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
    await click(tab("Collections"));
    await click(byLabel("Posts menu"));
    await click(menuItem("Settings"));
    await typeInto(
      document.querySelector<HTMLInputElement>("#cms-settings-name"),
      "Articles"
    );
    await click(buttonByText("Save"));
    expect(harness.structure.updateCollection).toHaveBeenLastCalledWith(
      POSTS.id,
      expect.objectContaining({ expectedUpdatedAt: NEXT })
    );
    expect(hasText("Changed by someone else")).toBe(false);
  });

  test("a sheet Save during the pause carries the order and cancels the timer", async () => {
    answerSchema();
    await openFields();
    await click(fieldRow("summary")!.querySelector("button"));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await moveRow("author", "ArrowUp");
    await typeInto(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-label"),
      "Teaser"
    );
    await click(
      buttonByText(
        "Save",
        document.querySelector("[data-cms-structure-header]")!
      )
    );
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
    expect(
      harness.structure.updateSchema.mock.calls[0][1].fields.map(
        (field) => `${field.key}:${field.label}`
      )
    ).toEqual(["title:Title", "author:Author", "summary:Teaser"]);
    await pass(1000);
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
  });

  test("a read during the pause keeps the person's order over the read's fields; E24 sends both with the read's version", async () => {
    answerSchema(LATER);
    await openFields();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await moveRow("title", "ArrowDown");
    // another person renamed Summary meanwhile
    harness.structure.getCollectionStructure.mockResolvedValue({
      collection: {
        ...POSTS_STRUCTURE,
        updatedAt: NEXT,
        fields: POSTS_STRUCTURE.fields.map((field) =>
          field.key === "summary" ? { ...field, label: "Excerpt" } : field
        ),
      },
    });
    await reopen();
    expect(fieldKeys()).toEqual(["summary", "title", "author"]);
    await pass(600);
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
    const [, body] = harness.structure.updateSchema.mock.calls[0];
    expect(body.fields.map((field) => `${field.key}:${field.label}`)).toEqual([
      "summary:Excerpt",
      "title:Title",
      "author:Author",
    ]);
    expect(body.expectedUpdatedAt).toBe(NEXT);
  });

  test("a read during the pause that adds a field drops the reorder: nothing is sent and the read's order stands", async () => {
    answerSchema();
    await openFields();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await moveRow("title", "ArrowDown");
    harness.structure.getCollectionStructure.mockResolvedValue({
      collection: {
        ...POSTS_STRUCTURE,
        updatedAt: NEXT,
        fields: [
          ...POSTS_STRUCTURE.fields,
          { key: "extra", label: "Extra", kind: "text" },
        ],
      },
    });
    await reopen();
    await pass(1000);
    expect(harness.structure.updateSchema).not.toHaveBeenCalled();
    expect(fieldKeys()).toEqual(["title", "summary", "author", "extra"]);
  });

  test("an open sheet keeps the version it was built from: a read meanwhile makes its Save a conflict, and the read's version applies once it closes", async () => {
    harness.structure.updateSchema.mockResolvedValue({ error: "conflict" });
    await openFields();
    await click(fieldRow("summary")!.querySelector("button"));
    harness.structure.getCollectionStructure.mockResolvedValue({
      collection: {
        ...POSTS_STRUCTURE,
        updatedAt: NEXT,
        fields: POSTS_STRUCTURE.fields.map((field) =>
          field.key === "summary" ? { ...field, label: "Excerpt" } : field
        ),
      },
    });
    await reopen();
    await typeInto(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-label"),
      "Teaser"
    );
    await click(
      buttonByText(
        "Save",
        document.querySelector("[data-cms-structure-header]")!
      )
    );
    expect(
      harness.structure.updateSchema.mock.calls[0][1].expectedUpdatedAt
    ).toBe(VERSION);
    expect(
      document.querySelector("[data-cms-structure-conflict]")?.textContent
    ).toContain("Changed by someone else");
    // Reload rebases the sheet on the read, and its Save sends that version
    await click(buttonByText("Reload"));
    await click(
      buttonByText(
        "Save",
        document.querySelector("[data-cms-structure-header]")!
      )
    );
    expect(
      harness.structure.updateSchema.mock.lastCall?.[1].expectedUpdatedAt
    ).toBe(NEXT);
  });

  test("a read while a sheet is open applies once it closes: a reorder then sends the read's version", async () => {
    answerSchema(LATER);
    await openFields();
    await click(fieldRow("summary")!.querySelector("button"));
    harness.structure.getCollectionStructure.mockResolvedValue({
      collection: { ...POSTS_STRUCTURE, updatedAt: NEXT },
    });
    await reopen();
    await click(byLabel("Back"));
    expect(sheet()).toBeNull();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await moveRow("title", "ArrowDown");
    await pass(600);
    expect(
      harness.structure.updateSchema.mock.calls[0][1].expectedUpdatedAt
    ).toBe(NEXT);
  });

  test("a refused reorder puts back the last accepted order and rereads E21; conflict also toasts", async () => {
    const error = vi.spyOn(toast, "error");
    await openFields();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    harness.structure.updateSchema.mockResolvedValueOnce({ error: "invalid" });
    await moveRow("title", "ArrowDown");
    await pass(600);
    expect(fieldKeys()).toEqual(["title", "summary", "author"]);
    expect(error).toHaveBeenLastCalledWith("Not saved");
    // a conflict rereads E21, takes its version and sends the order once
    // more; a second conflict puts the order back and toasts
    const reads = harness.structure.getCollectionStructure.mock.calls.length;
    harness.structure.updateSchema
      .mockResolvedValueOnce({ error: "conflict" })
      .mockResolvedValueOnce({ error: "conflict" });
    await moveRow("title", "ArrowDown");
    await pass(600);
    await pass(0);
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(3);
    expect(fieldKeys()).toEqual(["title", "summary", "author"]);
    expect(error).toHaveBeenLastCalledWith("Changed by someone else");
    expect(harness.structure.getCollectionStructure).toHaveBeenCalledTimes(
      reads + 2
    );
  });

  test("a reorder answered conflict once is sent again on the reread version, and the moved order stays", async () => {
    answerSchema();
    await openFields();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    harness.structure.updateSchema.mockResolvedValueOnce({ error: "conflict" });
    await moveRow("title", "ArrowDown");
    await pass(600);
    await pass(0);
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(2);
    expect(fieldKeys()).toEqual(["summary", "title", "author"]);
  });

  test("a reorder refused for sign-in shows its line and reads nothing more", async () => {
    await openFields();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const reads = harness.structure.getCollectionStructure.mock.calls.length;
    harness.structure.updateSchema.mockResolvedValueOnce({
      error: "mfa_required",
    });
    await moveRow("title", "ArrowDown");
    await pass(600);
    expect(fieldKeys()).toEqual(["title", "summary", "author"]);
    expect(hasText("Two-step sign-in required")).toBe(true);
    expect(harness.structure.getCollectionStructure).toHaveBeenCalledTimes(
      reads
    );
  });

  test("rate_limited keeps the order and sends once more 15 s later; a second refusal puts it back", async () => {
    vi.spyOn(toast, "error");
    await openFields();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    harness.structure.updateSchema.mockResolvedValue({ error: "rate_limited" });
    await moveRow("title", "ArrowDown");
    await pass(600);
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
    expect(fieldKeys()).toEqual(["summary", "title", "author"]);
    await pass(14_000);
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
    await pass(1_000);
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(2);
    expect(fieldKeys()).toEqual(["title", "summary", "author"]);
  });

  test('the cap: at 30 of 30 "+" is disabled with "30 of 30 fields" and Not in plan; at 60 of 60 no chip', async () => {
    withFields(manyFields(30));
    await openFields();
    expect((byLabel("Add field") as HTMLButtonElement).disabled).toBe(true);
    const cap = () =>
      document.querySelector<HTMLElement>("[data-cms-field-cap]")?.textContent;
    expect(cap()).toBe("30 of 30 fieldsNot in plan");
    unmount();
    resetHarness();
    withFields(manyFields(60));
    harness.structure.getStructure.mockResolvedValue({
      templates: [],
      limits: { fields: 60, customCollections: null, customCount: 0 },
    });
    await openFields();
    expect((byLabel("Add field") as HTMLButtonElement).disabled).toBe(true);
    expect(cap()).toBe("60 of 60 fields");
  });

  test('above the cap: "45 of 30 fields", each row editable, movable and removable', async () => {
    answerSchema();
    withFields(manyFields(45));
    await openFields();
    expect(document.querySelector("[data-cms-field-cap]")?.textContent).toBe(
      "45 of 30 fieldsNot in plan"
    );
    expect((byLabel("Add field") as HTMLButtonElement).disabled).toBe(true);
    expect(fieldRow("f3")!.hasAttribute("data-movable")).toBe(true);
    await click(fieldRow("f3")!.querySelector("button"));
    // a rename saves above the cap: no field is added
    await typeInto(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-label"),
      "Renamed"
    );
    const header = () =>
      document.querySelector<HTMLElement>("[data-cms-structure-header]")!;
    await click(buttonByText("Save", header()));
    const renamed = harness.structure.updateSchema.mock.lastCall?.[1].fields;
    expect(renamed).toHaveLength(45);
    expect(renamed?.find((field) => field.key === "f3")?.label).toBe("Renamed");
    // and so does a removal
    await click(byLabel("Field menu"));
    await click(menuItem("Remove field"));
    await click(
      buttonByText(
        "Remove",
        document.querySelector<HTMLElement>('[role="dialog"]')!
      )
    );
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(2);
    const removed = harness.structure.updateSchema.mock.lastCall?.[1].fields;
    expect(removed).toHaveLength(44);
    expect(removed?.some((field) => field.key === "f3")).toBe(false);
  });

  test("without canManageSettings the rows open read-only and do not move", async () => {
    harness.fake.getAccess.mockResolvedValue({
      canEdit: true,
      canPublish: true,
      canManageSettings: false,
    });
    await openFields();
    expect(fieldRow("title")!.hasAttribute("data-movable")).toBe(false);
    await moveRow("title", "ArrowDown");
    await settle();
    expect(fieldKeys()).toEqual(["title", "summary", "author"]);
    await click(fieldRow("summary")!.querySelector("button"));
    expect(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-label")
        ?.disabled
    ).toBe(true);
  });

  test("a failed load shows Try again in a minute with Retry", async () => {
    harness.structure.getCollectionStructure.mockResolvedValueOnce({
      error: "unavailable",
    });
    await openFields();
    expect(hasText("Try again in a minute")).toBe(true);
    expect(buttonByText("Retry")).toBeDefined();
  });

  // Review Focus 5
  test("a 120-character field name truncates in its row with a tooltip", async () => {
    const long = "W".repeat(120);
    withFields([
      { key: "title", label: long, kind: "text", isTitle: true },
      { key: "summary", label: "Summary", kind: "textarea" },
    ]);
    await openFields();
    const row = fieldRow("title")!;
    const name = [...row.querySelectorAll<HTMLElement>("*")].find(
      (element) => element.textContent === long
    )!;
    expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
    const column = document.querySelector("[data-cms-collections]")!;
    expect(row.getBoundingClientRect().right).toBeLessThanOrEqual(
      column.getBoundingClientRect().right
    );
    await act(async () => userEvent.hover(name));
    await vi.waitFor(
      () =>
        expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
          long
        ),
      { timeout: 2000 }
    );
  });
});

test("a reorder waits in the queue behind a write in flight", async () => {
  const held =
    deferred<CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>>();
  answerSchema(LATER);
  harness.structure.updateSchema.mockReturnValueOnce(held.promise);
  await openFields();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  await moveRow("title", "ArrowDown");
  await pass(600);
  await moveRow("title", "ArrowDown");
  await pass(600);
  expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
  held.resolve({ fields: [], updatedAt: NEXT });
  await settle();
  expect(harness.structure.updateSchema).toHaveBeenCalledTimes(2);
  expect(
    harness.structure.updateSchema.mock.calls[1][1].expectedUpdatedAt
  ).toBe(NEXT);
});

test("a move made while a sheet's Save is in flight keeps that Save's edit in its own E24", async () => {
  const held =
    deferred<CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>>();
  let saved: CmsStructureField[] = [];
  harness.structure.updateSchema
    .mockImplementationOnce(async (_id, body) => {
      saved = body.fields;
      return held.promise;
    })
    .mockImplementation(async (_id, body) => ({
      fields: body.fields,
      updatedAt: LATER,
    }));
  await openFields();
  await click(fieldRow("summary")!.querySelector("button"));
  await typeInto(
    document.querySelector<HTMLInputElement>("#cms-field-sheet-label"),
    "Teaser"
  );
  await click(
    [...sheet()!.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Save"
    )
  );
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  await moveRow("title", "ArrowDown");
  await pass(600);
  expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
  held.resolve({ fields: saved, updatedAt: NEXT });
  await settle();
  expect(harness.structure.updateSchema).toHaveBeenCalledTimes(2);
  const second = harness.structure.updateSchema.mock.calls[1][1].fields;
  expect(second.find((field) => field.key === "summary")?.label).toBe("Teaser");
  expect(second.map((field) => field.key)).toEqual([
    "summary",
    "title",
    "author",
  ]);
});
