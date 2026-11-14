// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { STRUCTURE_FAILURE_TOAST } from "./cms-structure-logic";
import { userEvent } from "@vitest/browser/context";
import { toast } from "@webstudio-is/design-system";
import type { CmsResult } from "./cms-source";
import { PEOPLE, POSTS, POSTS_DETAIL, VERSION } from "./fake-cms-source";
import { POSTS_STRUCTURE } from "./fake-cms-structure-source";
import { $cmsNativeDirty } from "./cms-native-stores";
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
  rowOf,
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

  test("a refused reorder puts back the last accepted order and rereads E21; a conflict rereads and retries once, and a second conflict puts it back and toasts", async () => {
    const error = vi.spyOn(toast, "error");
    await openFields();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    harness.structure.updateSchema.mockResolvedValueOnce({ error: "invalid" });
    await moveRow("title", "ArrowDown");
    await pass(600);
    expect(fieldKeys()).toEqual(["title", "summary", "author"]);
    expect(error).toHaveBeenLastCalledWith(
      "Not saved",
      STRUCTURE_FAILURE_TOAST
    );
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
    expect(error).toHaveBeenLastCalledWith(
      "Changed by someone else",
      STRUCTURE_FAILURE_TOAST
    );
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

// Round 4, item 12: a move made during a sheet's Save stays drawn when that
// Save answers, until the move's own answer
test("a move made while a sheet's Save is in flight stays drawn when the Save answers", async () => {
  const saveAnswer =
    deferred<CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>>();
  const moveAnswer =
    deferred<CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>>();
  let saved: CmsStructureField[] = [];
  harness.structure.updateSchema
    .mockImplementationOnce(async (_id, body) => {
      saved = body.fields;
      return saveAnswer.promise;
    })
    .mockImplementationOnce(async () => moveAnswer.promise);
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
  expect(fieldKeys()).toEqual(["summary", "title", "author"]);
  await act(async () => saveAnswer.resolve({ fields: saved, updatedAt: NEXT }));
  await settle();
  expect(fieldKeys()).toEqual(["summary", "title", "author"]);
  expect(harness.structure.updateSchema).toHaveBeenCalledTimes(2);
});

// Round 5, item 10: a reorder answered conflict whose reread fails
test("a reorder answered conflict whose reread fails puts the order back with the read's one toast (round 5)", async () => {
  const error = vi.spyOn(toast, "error");
  await openFields();
  harness.structure.updateSchema.mockResolvedValueOnce({ error: "conflict" });
  harness.structure.getCollectionStructure.mockResolvedValueOnce({
    error: "unavailable",
  });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  await moveRow("title", "ArrowDown");
  await pass(600);
  await pass(0);
  vi.useRealTimers();
  await settle();
  expect(fieldKeys()).toEqual(["title", "summary", "author"]);
  expect(error).toHaveBeenCalledTimes(1);
  expect(error).toHaveBeenCalledWith(
    "Try again in a minute",
    STRUCTURE_FAILURE_TOAST
  );
  expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
});

// Round 5, item 7: a Save that carried an earlier move leaves a later move
// pending, drawn until its own answer
test("a move made after a Save that carried an earlier one stays drawn when the Save answers (round 5)", async () => {
  const saveAnswer =
    deferred<CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>>();
  const moveAnswer =
    deferred<CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>>();
  let saved: CmsStructureField[] = [];
  harness.structure.updateSchema
    .mockImplementationOnce(async (_id, body) => {
      saved = body.fields;
      return saveAnswer.promise;
    })
    .mockImplementationOnce(async () => moveAnswer.promise);
  await openFields();
  await click(fieldRow("summary")!.querySelector("button"));
  await typeInto(
    document.querySelector<HTMLInputElement>("#cms-field-sheet-label"),
    "Teaser"
  );
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  // the first move, still in its pause: the Save carries it
  await moveRow("title", "ArrowDown");
  vi.useRealTimers();
  await click(
    [...sheet()!.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Save"
    )
  );
  expect(saved.map((field) => field.key)).toEqual([
    "summary",
    "title",
    "author",
  ]);
  // a later move, sent once its pause ends, behind the Save
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  await moveRow("title", "ArrowDown");
  await pass(600);
  vi.useRealTimers();
  expect(fieldKeys()).toEqual(["summary", "author", "title"]);
  await act(async () => saveAnswer.resolve({ fields: saved, updatedAt: NEXT }));
  await settle();
  expect(fieldKeys()).toEqual(["summary", "author", "title"]);
  expect(harness.structure.updateSchema).toHaveBeenCalledTimes(2);
});

// Round 4, item 1: a reorder's conflict retry never takes the version from
// under a view with unsaved values; a clean view is drawn again from the
// fresh read, so its next Save keeps another person's change
describe("a reorder conflict beside an open view", () => {
  /** A platform that answers conflict on any write at a stale version. */
  const world = () => {
    const state = {
      version: 1,
      fields: structuredClone(POSTS_STRUCTURE.fields),
      settings: {
        name: POSTS_STRUCTURE.name,
        singularName: POSTS_STRUCTURE.singularName,
        slug: POSTS_STRUCTURE.slug,
        isPublic: POSTS_STRUCTURE.isPublic,
      },
    };
    const at = () => `2026-11-14T10:00:0${state.version}.000000+00:00`;
    harness.structure.getCollectionStructure.mockImplementation(async () => ({
      collection: {
        ...POSTS_STRUCTURE,
        ...state.settings,
        fields: structuredClone(state.fields),
        updatedAt: at(),
      },
    }));
    harness.structure.updateSchema.mockImplementation(
      async (_id, { fields: sent, expectedUpdatedAt }) => {
        if (expectedUpdatedAt !== at()) {
          return { error: "conflict" };
        }
        state.fields = structuredClone(sent);
        state.version += 1;
        return { fields: sent, updatedAt: at() };
      }
    );
    harness.structure.updateCollection.mockImplementation(
      async (id, { expectedUpdatedAt, ...settings }) => {
        if (expectedUpdatedAt !== at()) {
          return { error: "conflict" };
        }
        state.settings = { ...state.settings, ...settings };
        state.version += 1;
        return { collection: { id, ...settings, updatedAt: at() } };
      }
    );
    return {
      state,
      /** Another person's change, straight on the platform. */
      other: (change: () => void) => {
        change();
        state.version += 1;
      },
    };
  };
  const labelOf = (fields: CmsStructureField[], key: string) =>
    fields.find((field) => field.key === key)?.label;

  test("a clean sheet is drawn again from the retry's read, and its Save keeps the other person's rename", async () => {
    const platform = world();
    await openFields();
    await click(fieldRow("summary")!.querySelector("button"));
    expect(sheet()).not.toBeNull();
    platform.other(() => {
      platform.state.fields[1].label = "Excerpt";
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await moveRow("title", "ArrowDown");
    await pass(600);
    await pass(0);
    vi.useRealTimers();
    await settle();
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(2);
    expect(labelOf(platform.state.fields, "summary")).toBe("Excerpt");
    expect(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-label")?.value
    ).toBe("Excerpt");
    await typeInto(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-help"),
      "Shown under the title"
    );
    await click(buttonByText("Save", sheet()!));
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(3);
    expect(labelOf(platform.state.fields, "summary")).toBe("Excerpt");
    expect(
      platform.state.fields.find((field) => field.key === "summary")?.help
    ).toBe("Shown under the title");
  });

  test("clean settings are drawn again from the retry's read, and their Save keeps the other person's name", async () => {
    const platform = world();
    await openFields();
    await click(tab("Collections"));
    await click(byLabel("Posts menu"));
    await click(menuItem("Settings"));
    platform.other(() => {
      platform.state.settings.name = "Articles";
      platform.state.settings.isPublic = false;
    });
    await click(tab("Fields"));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await moveRow("title", "ArrowDown");
    await pass(600);
    await pass(0);
    vi.useRealTimers();
    await settle();
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(2);
    const singular = document.querySelector<HTMLInputElement>(
      "#cms-settings-singular"
    );
    expect(singular).not.toBeNull();
    await typeInto(singular, "Article");
    await click(
      buttonByText(
        "Save",
        document.querySelector<HTMLElement>("[data-cms-structure-header]")!
      )
    );
    expect(harness.structure.updateCollection).toHaveBeenCalledTimes(1);
    expect(platform.state.settings.name).toBe("Articles");
    expect(platform.state.settings.isPublic).toBe(false);
    expect(platform.state.settings.singularName).toBe("Article");
  });

  test("a sheet with unsaved values keeps its version: the reorder is put back and toasts, and its Save conflicts rather than revert the rename", async () => {
    const error = vi.spyOn(toast, "error");
    const platform = world();
    await openFields();
    await click(fieldRow("summary")!.querySelector("button"));
    await typeInto(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-help"),
      "Mine"
    );
    platform.other(() => {
      platform.state.fields[1].label = "Excerpt";
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await moveRow("title", "ArrowDown");
    await pass(600);
    await pass(0);
    vi.useRealTimers();
    await settle();
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      "Changed by someone else",
      STRUCTURE_FAILURE_TOAST
    );
    expect(fieldKeys()).toEqual(["title", "summary", "author"]);
    await click(buttonByText("Save", sheet()!));
    expect(
      document.querySelector("[data-cms-structure-conflict]")
    ).not.toBeNull();
    expect(labelOf(platform.state.fields, "summary")).toBe("Excerpt");
  });

  // round 5, item 1: the view counts as clean only once the reread lands
  /** Holds the next E21 until `release`. */
  const holdNextRead = () => {
    const real =
      harness.structure.getCollectionStructure.getMockImplementation()!;
    const gate = deferred<void>();
    harness.structure.getCollectionStructure.mockImplementationOnce(
      async (id) => {
        await gate.promise;
        return real(id);
      }
    );
    return () => gate.resolve();
  };

  test("text typed in a clean sheet while the conflict's reread runs stays; the order goes back and the sheet's Save meets conflict (round 5)", async () => {
    const error = vi.spyOn(toast, "error");
    const platform = world();
    await openFields();
    await click(fieldRow("summary")!.querySelector("button"));
    platform.other(() => {
      platform.state.fields[1].label = "Excerpt";
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await moveRow("title", "ArrowDown");
    const release = holdNextRead();
    await pass(600);
    await pass(0);
    vi.useRealTimers();
    await settle();
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
    await typeInto(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-help"),
      "Typed meanwhile"
    );
    await act(async () => release());
    await settle();
    expect(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-help")?.value
    ).toBe("Typed meanwhile");
    expect(fieldKeys()).toEqual(["title", "summary", "author"]);
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      "Changed by someone else",
      STRUCTURE_FAILURE_TOAST
    );
    await click(buttonByText("Save", sheet()!));
    expect(
      document.querySelector("[data-cms-structure-conflict]")
    ).not.toBeNull();
    expect(labelOf(platform.state.fields, "summary")).toBe("Excerpt");
  });

  test("text typed in clean settings while the conflict's reread runs stays; their Save meets conflict (round 5)", async () => {
    const platform = world();
    await openFields();
    await click(tab("Collections"));
    await click(byLabel("Posts menu"));
    await click(menuItem("Settings"));
    platform.other(() => {
      platform.state.settings.name = "Articles";
    });
    await click(tab("Fields"));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await moveRow("title", "ArrowDown");
    const release = holdNextRead();
    await pass(600);
    await pass(0);
    vi.useRealTimers();
    await settle();
    const singular = () =>
      document.querySelector<HTMLInputElement>("#cms-settings-singular");
    await typeInto(singular(), "Typed meanwhile");
    await act(async () => release());
    await settle();
    expect(singular()?.value).toBe("Typed meanwhile");
    expect(fieldKeys()).toEqual(["title", "summary", "author"]);
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
    await click(
      buttonByText(
        "Save",
        document.querySelector<HTMLElement>("[data-cms-structure-header]")!
      )
    );
    expect(harness.structure.updateCollection).toHaveBeenCalledTimes(1);
    expect(platform.state.settings.singularName).not.toBe("Typed meanwhile");
    expect(platform.state.settings.name).toBe("Articles");
  });

  test("a move flushed by opening another collection, answered conflict, is sent again with the other writer's change (item 2)", async () => {
    const platform = world();
    const posts =
      harness.structure.getCollectionStructure.getMockImplementation()!;
    harness.structure.getCollectionStructure.mockImplementation(async (id) =>
      id === PEOPLE.id
        ? {
            collection: {
              ...POSTS_STRUCTURE,
              id: PEOPLE.id,
              slug: PEOPLE.slug,
              name: PEOPLE.name,
            },
          }
        : posts(id)
    );
    await openFields();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await moveRow("title", "ArrowDown");
    platform.other(() => {
      platform.state.fields[1].label = "Excerpt";
    });
    // another collection opens inside the pause: the move is sent then
    await click(tab("Collections"));
    await click(rowOf("people")?.querySelector("button"));
    await pass(0);
    await pass(0);
    vi.useRealTimers();
    await settle();
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(2);
    expect(platform.state.fields.map((field) => field.key)).toEqual([
      "summary",
      "title",
      "author",
    ]);
    expect(labelOf(platform.state.fields, "summary")).toBe("Excerpt");
  });
});

// Round 4, item 10: each collection's reorder has its own pause, so a move
// in another collection never drops the first one's answer
test("a move in Posts, then another in People: Posts' refused reorder still puts its order back and toasts", async () => {
  const error = vi.spyOn(toast, "error");
  const posts =
    harness.structure.getCollectionStructure.getMockImplementation();
  harness.structure.getCollectionStructure.mockImplementation(async (id) =>
    id === PEOPLE.id
      ? {
          collection: {
            ...POSTS_STRUCTURE,
            id: PEOPLE.id,
            slug: PEOPLE.slug,
            name: PEOPLE.name,
          },
        }
      : posts!(id)
  );
  // Posts' answer is held until People's move has started its pause
  const postsAnswer = deferred<void>();
  harness.structure.updateSchema.mockImplementation(async (id, body) => {
    if (id === POSTS.id) {
      await postsAnswer.promise;
      return { error: "invalid" };
    }
    return { fields: body.fields, updatedAt: NEXT };
  });
  await openFields();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  await moveRow("title", "ArrowDown");
  await click(tab("Collections"));
  await click(rowOf("people")?.querySelector("button"));
  await click(tab("Fields"));
  await moveRow("title", "ArrowDown");
  await act(async () => postsAnswer.resolve());
  await pass(0);
  await pass(600);
  await pass(0);
  vi.useRealTimers();
  await settle();
  const sentTo = harness.structure.updateSchema.mock.calls.map(([id]) => id);
  expect(sentTo).toContain(POSTS.id);
  expect(sentTo).toContain(PEOPLE.id);
  expect(error).toHaveBeenCalled();
});

// Round 4, item 14: the sheet's conflict line goes only once Reload's
// reread has landed
test("a sheet's conflict Reload whose reread fails keeps the conflict line", async () => {
  harness.structure.updateSchema.mockResolvedValue({ error: "conflict" });
  await openFields();
  await click(fieldRow("summary")!.querySelector("button"));
  await typeInto(
    document.querySelector<HTMLInputElement>("#cms-field-sheet-label"),
    "Teaser"
  );
  await click(
    buttonByText("Save", document.querySelector("[data-cms-structure-header]")!)
  );
  expect(
    document.querySelector("[data-cms-structure-conflict]")
  ).not.toBeNull();
  harness.structure.getCollectionStructure.mockResolvedValueOnce({
    error: "unavailable",
  });
  await click(
    buttonByText(
      "Reload",
      document.querySelector<HTMLElement>("[data-cms-structure-conflict]")!
    )
  );
  await settle();
  expect(
    document.querySelector("[data-cms-structure-conflict]")
  ).not.toBeNull();
});

// Round 4, item 3: Discard while a view's own Save is under way never draws
// the view on the values from before that Save
describe("Discard during a structure view's own Save", () => {
  const header = () =>
    document.querySelector<HTMLElement>("[data-cms-structure-header]")!;
  /** The New collection dialog "+" opened, closed again. */
  const closeNewCollection = async () => {
    const cancel = [
      ...document.querySelectorAll<HTMLElement>('[role="dialog"] button'),
    ].find((button) => button.textContent === "Cancel");
    if (cancel !== undefined) {
      await click(cancel);
    }
  };
  const leaves: Array<[string, () => Promise<void>]> = [
    [
      "Classic CMS",
      async () => {
        await click(byLabel("CMS menu"));
        await click(menuItem("Classic CMS"));
      },
    ],
    [
      '"+"',
      async () => {
        await click(tab("Collections"));
        await click(byLabel("New collection"));
      },
    ],
  ];

  test.each(leaves)(
    "a sheet's held Save, then Discard through %s: the sheet shows the saved name",
    async (_name, leave) => {
      await openFields();
      await click(fieldRow("summary")!.querySelector("button"));
      await typeInto(
        document.querySelector<HTMLInputElement>("#cms-field-sheet-label"),
        "Teaser"
      );
      const held = deferred<{
        fields: CmsStructureField[];
        updatedAt: string;
      }>();
      let sent: CmsStructureField[] = [];
      harness.structure.updateSchema.mockImplementationOnce(
        async (_id, body) => {
          sent = body.fields;
          return held.promise;
        }
      );
      await click(buttonByText("Save", header()));
      await leave();
      if (hasText("Discard unsaved changes?")) {
        await discardChanges();
      }
      await act(async () => held.resolve({ fields: sent, updatedAt: NEXT }));
      await settle();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      await settle();
      await closeNewCollection();
      if (sheet() === null) {
        await click(tab("Fields"));
        await click(fieldRow("summary")!.querySelector("button"));
      }
      expect(
        document.querySelector<HTMLInputElement>("#cms-field-sheet-label")
          ?.value
      ).toBe("Teaser");
    }
  );

  test.each(leaves)(
    "a settings view's held Save, then Discard through %s: the view shows the saved name",
    async (_name, leave) => {
      await openFields();
      await click(tab("Collections"));
      await click(byLabel("Posts menu"));
      await click(menuItem("Settings"));
      await typeInto(
        document.querySelector<HTMLInputElement>("#cms-settings-name"),
        "Articles"
      );
      const held =
        deferred<
          Awaited<ReturnType<typeof harness.structure.updateCollection>>
        >();
      let sent: Record<string, unknown> = {};
      harness.structure.updateCollection.mockImplementationOnce(
        async (id, { expectedUpdatedAt: _, ...settings }) => {
          sent = { id, ...settings };
          return held.promise;
        }
      );
      await click(buttonByText("Save", header()));
      await leave();
      if (hasText("Discard unsaved changes?")) {
        await discardChanges();
      }
      await act(async () =>
        held.resolve({
          collection: {
            ...(sent as { id: string }),
            ...sent,
            updatedAt: NEXT,
          } as never,
        })
      );
      await settle();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      await settle();
      await closeNewCollection();
      if (document.querySelector("[data-cms-collection-settings]") === null) {
        await click(tab("Collections"));
        await click(byLabel("Posts menu"));
        await click(menuItem("Settings"));
      }
      expect(
        document.querySelector<HTMLInputElement>("#cms-settings-name")?.value
      ).toBe("Articles");
    }
  );

  // round 5, item 2: whatever the answer, the view is drawn again once the
  // collection's queue settles
  const plus = async () => {
    await click(tab("Collections"));
    await click(byLabel("New collection"));
    if (hasText("Discard unsaved changes?")) {
      await discardChanges();
    }
  };
  const afterAnswer = async () => {
    await settle();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await settle();
    await closeNewCollection();
  };

  test('a sheet\'s held Save answered conflict, after Discard through "+": the sheet shows the saved name, and nothing is unsaved (round 5)', async () => {
    await openFields();
    await click(fieldRow("summary")!.querySelector("button"));
    await typeInto(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-label"),
      "Teaser"
    );
    const held =
      deferred<CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>>();
    harness.structure.updateSchema.mockImplementationOnce(() => held.promise);
    await click(buttonByText("Save", header()));
    await plus();
    await act(async () => held.resolve({ error: "conflict" }));
    await afterAnswer();
    if (sheet() === null) {
      await click(tab("Fields"));
      await click(fieldRow("summary")!.querySelector("button"));
    }
    expect(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-label")?.value
    ).toBe("Summary");
    expect($cmsNativeDirty.get()).toBe(false);
  });

  test('a settings view\'s held Save answered conflict, after Discard through "+": the view shows the saved name (round 5)', async () => {
    await openFields();
    await click(tab("Collections"));
    await click(byLabel("Posts menu"));
    await click(menuItem("Settings"));
    await typeInto(
      document.querySelector<HTMLInputElement>("#cms-settings-name"),
      "Articles"
    );
    const held =
      deferred<
        Awaited<ReturnType<typeof harness.structure.updateCollection>>
      >();
    harness.structure.updateCollection.mockImplementationOnce(
      () => held.promise
    );
    await click(buttonByText("Save", header()));
    await plus();
    await act(async () => held.resolve({ error: "conflict" }));
    await afterAnswer();
    if (document.querySelector("[data-cms-collection-settings]") === null) {
      await click(tab("Collections"));
      await click(byLabel("Posts menu"));
      await click(menuItem("Settings"));
    }
    expect(
      document.querySelector<HTMLInputElement>("#cms-settings-name")?.value
    ).toBe("Posts");
    expect($cmsNativeDirty.get()).toBe(false);
  });

  test('a dirty sheet with a reorder\'s E24 in flight, after Discard through "+": the sheet shows the saved name once it answers (round 5)', async () => {
    await openFields();
    await click(fieldRow("summary")!.querySelector("button"));
    await typeInto(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-label"),
      "Teaser"
    );
    const held =
      deferred<CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>>();
    let sent: CmsStructureField[] = [];
    harness.structure.updateSchema.mockImplementationOnce(async (_id, body) => {
      sent = body.fields;
      return held.promise;
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await moveRow("title", "ArrowDown");
    await pass(600);
    await pass(0);
    vi.useRealTimers();
    await settle();
    expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
    await plus();
    await act(async () => held.resolve({ fields: sent, updatedAt: NEXT }));
    await afterAnswer();
    if (sheet() === null) {
      await click(tab("Fields"));
      await click(fieldRow("summary")!.querySelector("button"));
    }
    expect(
      document.querySelector<HTMLInputElement>("#cms-field-sheet-label")?.value
    ).toBe("Summary");
    expect($cmsNativeDirty.get()).toBe(false);
  });
});

// round 5 verification, R5-1: a replaced view never acts on the screen's
// state, and a view Discarded during its own write stays frozen until it is
// drawn again from a fresh read
describe("Discard during a view's own write keeps another person's change", () => {
  const header = () =>
    document.querySelector<HTMLElement>("[data-cms-structure-header]")!;
  const plusThenCancel = async () => {
    await click(tab("Collections"));
    await click(byLabel("New collection"));
    if (hasText("Discard unsaved changes?")) {
      await discardChanges();
    }
    const cancel = [
      ...document.querySelectorAll<HTMLElement>('[role="dialog"] button'),
    ].find((button) => button.textContent === "Cancel");
    if (cancel !== undefined) {
      await click(cancel);
    }
  };
  const drain = async () => {
    for (let round = 0; round < 3; round += 1) {
      await settle();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    await settle();
  };
  const input = (id: string) =>
    document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
  /**
   * E21 from now on answers `collection` once `gate` opens: the rereads land
   * after the write's answer, as on a network.
   */
  const rereadsAfter = (collection: typeof POSTS_STRUCTURE) => {
    const gate = deferred<void>();
    harness.structure.getCollectionStructure.mockImplementation(async () => {
      await gate.promise;
      return { collection };
    });
    return gate;
  };
  /** Summary as another person left it: with a help text, at LATER. */
  const theirs = (label = "Summary") =>
    rereadsAfter({
      ...POSTS_STRUCTURE,
      fields: POSTS_DETAIL.fields.map((field) =>
        field.key === "summary" ? { ...field, label, help: "Theirs" } : field
      ),
      updatedAt: LATER,
    });
  const sentSummary = () =>
    (
      harness.structure.updateSchema.mock.lastCall?.[1].fields as
        | CmsStructureField[]
        | undefined
    )?.find((field) => field.key === "summary");

  test("a sheet's Save answered unavailable: the view is frozen, then drawn with the other person's help, and the next Save keeps it", async () => {
    await openFields();
    await click(fieldRow("summary")!.querySelector("button"));
    await typeInto(input("cms-field-sheet-label"), "Teaser");
    const gate = theirs();
    const held =
      deferred<CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>>();
    harness.structure.updateSchema.mockImplementationOnce(() => held.promise);
    await click(buttonByText("Save", header()));
    await plusThenCancel();
    expect(sheet()).not.toBeNull();
    await act(async () => held.resolve({ error: "unavailable" }));
    await drain();
    // answered, and the reread not yet: nothing can be typed
    expect(input("cms-field-sheet-label")?.disabled).toBe(true);
    await act(async () => gate.resolve());
    await drain();
    expect(input("cms-field-sheet-label")?.disabled).toBe(false);
    expect(input("cms-field-sheet-label")?.value).toBe("Summary");
    expect(input("cms-field-sheet-help")?.value).toBe("Theirs");
    await typeInto(input("cms-field-sheet-label"), "Excerpt mine");
    answerSchema(NEXT);
    await click(buttonByText("Save", header()));
    await drain();
    expect(harness.structure.updateSchema.mock.lastCall?.[1]).toMatchObject({
      expectedUpdatedAt: LATER,
    });
    expect(sentSummary()?.help).toBe("Theirs");
  });

  test("a sheet's Save answered unavailable that landed: the view is drawn with what landed", async () => {
    await openFields();
    await click(fieldRow("summary")!.querySelector("button"));
    await typeInto(input("cms-field-sheet-label"), "Teaser");
    const gate = theirs("Teaser");
    const held =
      deferred<CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>>();
    harness.structure.updateSchema.mockImplementationOnce(() => held.promise);
    await click(buttonByText("Save", header()));
    await plusThenCancel();
    await act(async () => held.resolve({ error: "unavailable" }));
    await drain();
    await act(async () => gate.resolve());
    await drain();
    expect(input("cms-field-sheet-label")?.value).toBe("Teaser");
    expect($cmsNativeDirty.get()).toBe(false);
  });

  test("a settings view's Save answered unavailable: drawn with the other person's address, and the next Save keeps it", async () => {
    await openFields();
    await click(tab("Collections"));
    await click(byLabel("Posts menu"));
    await click(menuItem("Settings"));
    await typeInto(input("cms-settings-name"), "Articles");
    const gate = rereadsAfter({
      ...POSTS_STRUCTURE,
      slug: "news",
      updatedAt: LATER,
    });
    const held =
      deferred<
        Awaited<ReturnType<typeof harness.structure.updateCollection>>
      >();
    harness.structure.updateCollection.mockImplementationOnce(
      () => held.promise
    );
    await click(buttonByText("Save", header()));
    await plusThenCancel();
    await act(async () => held.resolve({ error: "unavailable" }));
    await drain();
    expect(input("cms-settings-name")?.disabled).toBe(true);
    await act(async () => gate.resolve());
    await drain();
    expect(input("cms-settings-name")?.value).toBe("Posts");
    expect(input("cms-settings-slug")?.value).toBe("news");
    await typeInto(input("cms-settings-singular"), "Story");
    let sent: Record<string, unknown> = {};
    harness.structure.updateCollection.mockImplementationOnce(
      async (_id, body) => {
        sent = body;
        return { error: "conflict" };
      }
    );
    await click(buttonByText("Save", header()));
    await drain();
    expect(sent).toMatchObject({ expectedUpdatedAt: LATER, slug: "news" });
  });

  /** Back from the open view, through the guard's Discard. */
  const backDiscarding = async () => {
    await click(header().querySelector<HTMLElement>('[aria-label="Back"]'));
    if (hasText("Discard unsaved changes?")) {
      await discardChanges();
    }
  };

  // round 6, K9: a view closed during its own Save never opens again
  test("a sheet closed with Back during its own Save stays closed when the Save lands", async () => {
    await openFields();
    await click(fieldRow("summary")!.querySelector("button"));
    await typeInto(input("cms-field-sheet-label"), "Teaser");
    const held =
      deferred<CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>>();
    let sent: CmsStructureField[] = [];
    harness.structure.updateSchema.mockImplementationOnce(async (_id, body) => {
      sent = body.fields;
      return held.promise;
    });
    await click(buttonByText("Save", header()));
    await backDiscarding();
    expect(sheet()).toBeNull();
    await act(async () => held.resolve({ fields: sent, updatedAt: NEXT }));
    await drain();
    expect(sheet()).toBeNull();
  });

  // round 6, K10: a sheet reopened while its earlier Save runs waits for it
  test("a sheet reopened while its earlier Save runs is drawn from what landed, and its next Save keeps it", async () => {
    await openFields();
    await click(fieldRow("summary")!.querySelector("button"));
    await typeInto(input("cms-field-sheet-label"), "Teaser");
    const held =
      deferred<CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>>();
    let sent: CmsStructureField[] = [];
    harness.structure.updateSchema.mockImplementationOnce(async (_id, body) => {
      sent = body.fields;
      return held.promise;
    });
    await click(buttonByText("Save", header()));
    await backDiscarding();
    await click(fieldRow("summary")!.querySelector("button"));
    expect(sheet()).not.toBeNull();
    harness.structure.getCollectionStructure.mockResolvedValue({
      collection: { ...POSTS_STRUCTURE, fields: sent, updatedAt: NEXT },
    });
    await act(async () => held.resolve({ fields: sent, updatedAt: NEXT }));
    await drain();
    expect(input("cms-field-sheet-label")?.value).toBe("Teaser");
    await typeInto(input("cms-field-sheet-help"), "Help mine");
    answerSchema(LATER);
    await click(buttonByText("Save", header()));
    await drain();
    expect(sentSummary()?.label).toBe("Teaser");
  });

  // round 6, K22: a frozen sheet offers no Remove
  test("a sheet frozen by Discard during its own Save offers no Remove field", async () => {
    await openFields();
    await click(fieldRow("summary")!.querySelector("button"));
    await typeInto(input("cms-field-sheet-label"), "Teaser");
    const gate = theirs();
    const held =
      deferred<CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>>();
    harness.structure.updateSchema.mockImplementationOnce(() => held.promise);
    await click(buttonByText("Save", header()));
    await plusThenCancel();
    await act(async () => held.resolve({ error: "unavailable" }));
    await drain();
    expect(input("cms-field-sheet-label")?.disabled).toBe(true);
    expect(header().querySelector('[aria-label="Field menu"]')).toBeNull();
    await act(async () => gate.resolve());
    await drain();
    expect(header().querySelector('[aria-label="Field menu"]')).not.toBeNull();
  });

  test.each(["ok", "conflict", "unavailable"] as const)(
    "a dirty sheet with a reorder's E24 in flight (%s), after Discard: drawn at once, and text typed then stays",
    async (answer) => {
      await openFields();
      await click(fieldRow("summary")!.querySelector("button"));
      await typeInto(input("cms-field-sheet-label"), "Teaser");
      const held =
        deferred<
          CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>
        >();
      let sent: CmsStructureField[] = [];
      harness.structure.updateSchema.mockImplementationOnce(
        async (_id, body) => {
          sent = body.fields;
          return held.promise;
        }
      );
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      await moveRow("title", "ArrowDown");
      await pass(600);
      await pass(0);
      vi.useRealTimers();
      await settle();
      expect(harness.structure.updateSchema).toHaveBeenCalledTimes(1);
      await plusThenCancel();
      expect(input("cms-field-sheet-label")?.value).toBe("Summary");
      expect($cmsNativeDirty.get()).toBe(false);
      await typeInto(input("cms-field-sheet-label"), "Mine");
      await act(async () =>
        held.resolve(
          answer === "ok"
            ? { fields: sent, updatedAt: NEXT }
            : { error: answer }
        )
      );
      await drain();
      expect(input("cms-field-sheet-label")?.value).toBe("Mine");
      expect($cmsNativeDirty.get()).toBe(true);
    }
  );
});
