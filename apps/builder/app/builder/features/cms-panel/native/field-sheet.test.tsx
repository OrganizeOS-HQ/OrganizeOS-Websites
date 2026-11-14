// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { toast } from "@webstudio-is/design-system";
import { $cmsNativeDirty } from "./cms-native-stores";
import type { CmsFieldKind } from "./cms-source";
import {
  FIELD_KIND_LABELS,
  FIELD_KINDS,
  STRUCTURE_FAILURE_TOAST,
} from "./cms-structure-logic";
import type { CmsStructureField } from "./cms-structure-source";
import { PEOPLE, POSTS, VERSION } from "./fake-cms-source";
import { POSTS_STRUCTURE } from "./fake-cms-structure-source";
import {
  buttonByText,
  byLabel,
  click,
  fieldRow,
  harness,
  hasText,
  menuItem,
  mount,
  resetHarness,
  rowOf,
  settle,
  tab,
  typeInto,
  unmount,
  keepEditing,
} from "./structure-test-harness";

beforeEach(resetHarness);
afterEach(unmount);

const NEXT = "2026-11-12T10:05:00.123456+00:00";

const FIELDS: CmsStructureField[] = [
  { key: "title", label: "Title", kind: "text", isTitle: true, required: true },
  { key: "summary", label: "Summary", kind: "textarea" },
  {
    key: "author",
    label: "Author",
    kind: "reference",
    reference: { collectionId: PEOPLE.id, multiple: false },
  },
  {
    key: "stage",
    label: "Stage",
    kind: "option",
    options: [
      { value: "won", label: "Won" },
      { value: "lost", label: "Lost" },
    ],
  },
  { key: "role", label: "Role", kind: "text", locked: true },
  {
    key: "team",
    label: "Team",
    kind: "reference",
    locked: true,
    reference: { collectionId: PEOPLE.id, multiple: false },
  },
  { key: "body", label: "Body", kind: "richtext" },
];

const withFields = (fields: CmsStructureField[] = FIELDS) =>
  harness.structure.getCollectionStructure.mockResolvedValue({
    collection: { ...POSTS_STRUCTURE, fields },
  });

/** E24 answers with what it was sent, at a new version. */
const answerSchema = () =>
  harness.structure.updateSchema.mockImplementation(async (_id, body) => ({
    fields: body.fields,
    updatedAt: NEXT,
  }));

const sheet = () =>
  document.querySelector<HTMLElement>("[data-cms-field-sheet]");
const header = () =>
  document.querySelector<HTMLElement>("[data-cms-structure-header]");
const control = <Element extends HTMLElement = HTMLInputElement>(id: string) =>
  document.querySelector<Element>(`#cms-field-sheet-${id}`);
const errorOf = (id: string) =>
  document.querySelector(`#cms-field-sheet-${id}-error`)?.textContent;
const primary = () =>
  buttonByText("Save", header()!) ?? buttonByText("Add field", header()!);
const crumb = () =>
  [...document.querySelectorAll<HTMLElement>("[data-cms-crumb] > *")].map(
    (part) => part.textContent
  );
const optionInputs = () => [
  ...document.querySelectorAll<HTMLInputElement>("[data-cms-option-row] input"),
];
const lastSchema = () => harness.structure.updateSchema.mock.lastCall?.[1];
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

const openField = async (key: string) => {
  mount();
  await settle();
  await click(tab("Fields"));
  await click(fieldRow(key)!.querySelector("button"));
  expect(sheet()).not.toBeNull();
};

const openNew = async (kind: CmsFieldKind) => {
  mount();
  await settle();
  await click(tab("Fields"));
  await click(byLabel("Add field"));
  await click(menuItem(FIELD_KIND_LABELS[kind]));
  expect(sheet()).not.toBeNull();
};

describe("the field sheet", () => {
  test.each(FIELD_KINDS)("a new %s field shows its controls", async (kind) => {
    withFields();
    await openNew(kind);
    expect(control("label")).not.toBeNull();
    expect(control("key")).not.toBeNull();
    expect(control("kind")).not.toBeNull();
    expect(control("help")).not.toBeNull();
    expect(control("options") !== null).toBe(kind === "option");
    expect(control("reference") !== null).toBe(
      kind === "reference" || kind === "multireference"
    );
    expect(control("max-length") !== null).toBe(
      kind === "text" || kind === "textarea"
    );
    expect(control("title") !== null).toBe(kind === "text");
    expect(crumb()).toEqual([
      "Posts",
      "/",
      `New ${FIELD_KIND_LABELS[kind].toLowerCase()} field`,
    ]);
  });

  test("Key follows the name by keyFromLabel until typed; Kind and Key are disabled once saved", async () => {
    withFields();
    await openNew("text");
    await typeInto(control("label"), "Reading time (min)");
    expect(control("key")?.value).toBe("readingTimeMin");
    await typeInto(control("key"), "minutes");
    await typeInto(control("label"), "Time");
    expect(control("key")?.value).toBe("minutes");
    unmount();
    resetHarness();
    withFields();
    await openField("summary");
    expect(control("key")?.disabled).toBe(true);
    expect(control<HTMLButtonElement>("kind")?.disabled).toBe(true);
  });

  test("options by label: a saved option keeps its value, a new one sends its label as its value; Enter in the last adds one", async () => {
    withFields();
    answerSchema();
    await openField("stage");
    expect(optionInputs().map((input) => input.value)).toEqual(["Won", "Lost"]);
    await typeInto(optionInputs()[0], "Victory");
    await act(async () => {
      optionInputs()[1].focus();
      await userEvent.keyboard("{Enter}");
    });
    await settle();
    expect(optionInputs()).toHaveLength(3);
    expect(document.activeElement).toBe(optionInputs()[2]);
    await act(async () => userEvent.type(optionInputs()[2], "Paused"));
    await click(primary());
    expect(
      lastSchema()?.fields.find((field) => field.key === "stage")?.options
    ).toEqual([
      { value: "won", label: "Victory" },
      { value: "lost", label: "Lost" },
      { value: "Paused", label: "Paused" },
    ]);
  });

  test("option rows move by drag and by Alt+ArrowUp/Down in the input; the moved row keeps the focus; nothing is sent before Save, and Save sends the options in the new order with their values", async () => {
    withFields();
    answerSchema();
    await openField("stage");
    await act(async () => {
      optionInputs()[0].focus();
      await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    });
    await settle();
    expect(optionInputs().map((input) => input.value)).toEqual(["Lost", "Won"]);
    expect(document.activeElement).toBe(optionInputs()[1]);
    // a drag by the grip puts Won back first
    const rows = [
      ...document.querySelectorAll<HTMLElement>("[data-cms-option-row]"),
    ];
    const grip = rows[1].querySelector<HTMLElement>("[data-grip]")!;
    const from = rows[1].getBoundingClientRect();
    const to = rows[0].getBoundingClientRect();
    const pointer = { pointerId: 1, pointerType: "mouse", isPrimary: true };
    act(() => {
      grip.dispatchEvent(
        new PointerEvent("pointerdown", {
          ...pointer,
          bubbles: true,
          button: 0,
          clientX: from.left + 4,
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
            clientX: from.left + 4,
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
    expect(optionInputs().map((input) => input.value)).toEqual(["Won", "Lost"]);
    // past the drag's click guard
    await new Promise((resolve) => setTimeout(resolve, 350));
    await act(async () => {
      optionInputs()[1].focus();
      await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    });
    await settle();
    expect(harness.structure.updateSchema).not.toHaveBeenCalled();
    await click(primary());
    expect(
      lastSchema()?.fields.find((field) => field.key === "stage")?.options
    ).toEqual([
      { value: "lost", label: "Lost" },
      { value: "won", label: "Won" },
    ]);
  });

  test("a new reference starts on the first listed collection; Name has the focus in a new sheet", async () => {
    withFields();
    await openNew("reference");
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(control("label"))
    );
    expect(control<HTMLButtonElement>("reference")?.textContent).toContain(
      POSTS.name
    );
  });

  test("a long collection name truncates in Collection within the sheet, whole in its tooltip", async () => {
    const long = `Speakers ${"and their sessions ".repeat(8)}`.trim();
    harness.fake.listCollections.mockResolvedValue({
      collections: [{ ...POSTS, name: long }, PEOPLE],
    });
    withFields();
    await openNew("reference");
    const trigger = control<HTMLButtonElement>("reference")!;
    expect(trigger.textContent).toContain(long);
    expect(trigger.getBoundingClientRect().right).toBeLessThanOrEqual(
      sheet()!.getBoundingClientRect().right
    );
    const text = [...trigger.querySelectorAll<HTMLElement>("*")].find(
      (element) => element.textContent === long && element.children.length === 0
    )!;
    expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
    await act(async () => {
      text.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" })
      );
    });
    await vi.waitFor(() =>
      expect(document.querySelector('[role="tooltip"]')?.textContent).toContain(
        long
      )
    );
  });

  test("Collection: disabled for a template reference and for any saved reference, as Kind is; enabled for a new one", async () => {
    withFields();
    await openField("team");
    expect(control<HTMLButtonElement>("reference")?.disabled).toBe(true);
    unmount();
    resetHarness();
    withFields();
    await openField("author");
    expect(control<HTMLButtonElement>("reference")?.disabled).toBe(true);
    unmount();
    resetHarness();
    withFields();
    await openNew("reference");
    expect(control<HTMLButtonElement>("reference")?.disabled).toBe(false);
  });

  test("Title moves: turning it on elsewhere moves it; the old title stays required", async () => {
    withFields();
    answerSchema();
    await openField("role");
    expect(control<HTMLButtonElement>("title")?.disabled).toBe(false);
    await click(control("title"));
    expect(control<HTMLButtonElement>("required")?.disabled).toBe(true);
    await click(primary());
    const fields = lastSchema()!.fields;
    expect(fields.filter((field) => field.isTitle).map((f) => f.key)).toEqual([
      "role",
    ]);
    expect(fields[0]).toEqual({
      key: "title",
      label: "Title",
      kind: "text",
      required: true,
    });
  });

  test("Table column: disabled with no tooltip for the title, Rich text, Image, Multi-reference and a fifth", async () => {
    const columns: CmsStructureField[] = [
      ...FIELDS,
      ...[1, 2, 3, 4].map((n) => ({
        key: `c${n}`,
        label: `C${n}`,
        kind: "text" as const,
        showInTable: true,
      })),
    ];
    withFields(columns);
    await openField("title");
    const column = () => control<HTMLButtonElement>("column")!;
    expect(column().disabled).toBe(true);
    expect(column().parentElement?.getAttribute("data-state")).toBeNull();
    await click(fieldRow("body")!.querySelector("button"));
    expect(column().disabled).toBe(true);
    await click(fieldRow("summary")!.querySelector("button"));
    expect(column().disabled).toBe(true);
    await click(fieldRow("c1")!.querySelector("button"));
    expect(column().disabled).toBe(false);
    await act(async () => userEvent.hover(column()));
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    for (const kind of ["image", "multireference"] as const) {
      await click(byLabel("Add field"));
      await click(menuItem(FIELD_KIND_LABELS[kind]));
      expect(column().disabled).toBe(true);
    }
  });

  // Review Focus 3
  test("Max length 200000 saves; the sheet then shows 100000 and is clean", async () => {
    withFields();
    harness.structure.updateSchema.mockImplementation(async (_id, body) => ({
      fields: body.fields,
      updatedAt: NEXT,
    }));
    await openField("summary");
    await typeInto(control("max-length"), "200000");
    expect(errorOf("max-length")).toBeUndefined();
    await click(primary());
    expect(
      lastSchema()?.fields.find((field) => field.key === "summary")?.maxLength
    ).toBe(100_000);
    expect(control("max-length")?.value).toBe("100000");
    expect(primary()?.disabled).toBe(true);
    expect($cmsNativeDirty.get()).toBe(false);
  });

  test("every client error string of 4.8 under its control", async () => {
    withFields();
    await openNew("option");
    await click(primary());
    expect(errorOf("label")).toBe("Required");
    expect(errorOf("key")).toBe("Required");
    expect(errorOf("options")).toBe("Add an option");
    await typeInto(control("label"), "x".repeat(80));
    await typeInto(control("key"), "1a");
    await click(primary());
    expect(errorOf("key")).toBe("Letters and digits, from a letter");
    await typeInto(control("key"), "a".repeat(40));
    await typeInto(optionInputs()[0], "Red");
    await act(async () => {
      optionInputs()[0].focus();
      await userEvent.keyboard("{Enter}");
    });
    await act(async () => userEvent.type(optionInputs()[1], "Red"));
    await click(primary());
    expect(errorOf("options")).toBe("Options repeat");
    await typeInto(control("key"), "Stage");
    await click(primary());
    expect(errorOf("key")).toBe("Key in use");
    unmount();
    resetHarness();
    withFields();
    await openNew("text");
    await typeInto(control("label"), "Teaser");
    await typeInto(control("max-length"), "1.5");
    await click(primary());
    expect(errorOf("max-length")).toBe("A whole number");
  });

  test("invalid naming a new field: Key in use when the reread E21 holds its key in any case, else Not valid", async () => {
    withFields();
    await openNew("text");
    await typeInto(control("label"), "Teaser");
    harness.structure.updateSchema.mockResolvedValue({
      error: "invalid",
      field: "teaser",
    });
    await click(primary());
    expect(errorOf("key")).toBeUndefined();
    expect(
      document.querySelector("[data-cms-structure-invalid]")?.textContent
    ).toBe("Not valid");
    withFields([...FIELDS, { key: "TEASER", label: "Teaser", kind: "text" }]);
    await typeInto(control("label"), "Teaser");
    expect(document.querySelector("[data-cms-structure-invalid]")).toBeNull();
    await click(primary());
    expect(errorOf("key")).toBe("Key in use");
  });

  test("reference_invalid: Collection not found under Collection, and E1 refetched", async () => {
    withFields();
    await openField("author");
    await typeInto(control("label"), "Writer");
    const lists = harness.fake.listCollections.mock.calls.length;
    harness.structure.updateSchema.mockResolvedValueOnce({
      error: "reference_invalid",
      field: "author",
    });
    await click(primary());
    expect(errorOf("reference")).toBe("Collection not found");
    expect(harness.fake.listCollections.mock.calls.length).toBe(lists + 1);
  });

  test("a new reference field typed with spaces around its key takes its own reference_invalid under Collection (round 4)", async () => {
    withFields();
    await openNew("reference");
    await typeInto(control("label"), "Editor");
    await typeInto(control("key"), " editor ");
    harness.structure.updateSchema.mockResolvedValueOnce({
      error: "reference_invalid",
      field: "editor",
    });
    await click(primary());
    expect(errorOf("reference")).toBe("Collection not found");
  });

  test("invalid with no field, or naming a field the sheet does not show: the toast Not saved, and E21 refetched", async () => {
    const error = vi.spyOn(toast, "error");
    withFields();
    await openField("summary");
    await typeInto(control("label"), "Teaser");
    for (const field of [undefined, "stage"]) {
      const reads = harness.structure.getCollectionStructure.mock.calls.length;
      harness.structure.updateSchema.mockResolvedValueOnce({
        error: "invalid",
        ...(field === undefined ? {} : { field }),
      });
      await click(primary());
      expect(error).toHaveBeenLastCalledWith(
        "Not saved",
        STRUCTURE_FAILURE_TOAST
      );
      expect(harness.structure.getCollectionStructure.mock.calls.length).toBe(
        reads + 1
      );
    }
  });

  test("limit: the toast Field limit reached, and E20 refetched; not_found: the toast Collection not found, and E1 refetched", async () => {
    const error = vi.spyOn(toast, "error");
    withFields();
    await openNew("text");
    await typeInto(control("label"), "Teaser");
    const structures = harness.structure.getStructure.mock.calls.length;
    harness.structure.updateSchema.mockResolvedValueOnce({ error: "limit" });
    await click(primary());
    expect(error).toHaveBeenLastCalledWith(
      "Field limit reached",
      STRUCTURE_FAILURE_TOAST
    );
    expect(harness.structure.getStructure.mock.calls.length).toBe(
      structures + 1
    );
    const lists = harness.fake.listCollections.mock.calls.length;
    harness.structure.updateSchema.mockResolvedValueOnce({
      error: "not_found",
    });
    await click(primary());
    expect(error).toHaveBeenLastCalledWith(
      "Collection not found",
      STRUCTURE_FAILURE_TOAST
    );
    expect(harness.fake.listCollections.mock.calls.length).toBe(lists + 1);
  });

  test("conflict and Reload rebase per property; a field removed meanwhile closes the sheet with Field not found", async () => {
    const error = vi.spyOn(toast, "error");
    withFields();
    answerSchema();
    await openField("summary");
    await typeInto(control<HTMLTextAreaElement>("help"), "Mine");
    harness.structure.updateSchema.mockResolvedValueOnce({ error: "conflict" });
    await click(primary());
    expect(
      document.querySelector("[data-cms-structure-conflict]")?.textContent
    ).toContain("Changed by someone else");
    withFields(
      FIELDS.map((field) =>
        field.key === "summary"
          ? { ...field, label: "Teaser", required: true }
          : field
      )
    );
    await click(buttonByText("Reload"));
    expect(control("label")?.value).toBe("Teaser");
    expect(control<HTMLTextAreaElement>("help")?.value).toBe("Mine");
    await click(primary());
    expect(
      lastSchema()?.fields.find((field) => field.key === "summary")
    ).toEqual({
      key: "summary",
      label: "Teaser",
      kind: "textarea",
      required: true,
      help: "Mine",
    });
    // the field removed meanwhile
    await typeInto(control<HTMLTextAreaElement>("help"), "Again");
    harness.structure.updateSchema.mockResolvedValueOnce({ error: "conflict" });
    await click(primary());
    withFields(FIELDS.filter((field) => field.key !== "summary"));
    await click(buttonByText("Reload"));
    expect(error).toHaveBeenLastCalledWith(
      "Field not found",
      STRUCTURE_FAILURE_TOAST
    );
    expect(sheet()).toBeNull();
  });

  test("Remove field confirms Remove Summary from 2 items?, then sends removeKeys [summary] and closes", async () => {
    withFields();
    answerSchema();
    await openField("summary");
    await click(byLabel("Field menu"));
    await click(menuItem("Remove field"));
    expect(
      dialog()?.querySelector("[data-cms-dialog-title]")?.textContent
    ).toBe("Remove Summary from 2 items?");
    expect(document.activeElement?.textContent).toBe("Cancel");
    await click(buttonByText("Remove", dialog()!));
    expect(lastSchema()?.removeKeys).toEqual(["summary"]);
    expect(lastSchema()?.expectedUpdatedAt).toBe(VERSION);
    expect(lastSchema()?.fields.some((field) => field.key === "summary")).toBe(
      false
    );
    expect(sheet()).toBeNull();
  });

  test('Remove field is in the header\'s "...", named and tooltipped Field menu; it is absent for the title and a template field', async () => {
    withFields();
    await openField("summary");
    await act(async () => userEvent.hover(byLabel("Field menu")!));
    await vi.waitFor(() =>
      expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
        "Field menu"
      )
    );
    await click(fieldRow("title")!.querySelector("button"));
    expect(byLabel("Field menu")).toBeNull();
    await click(fieldRow("role")!.querySelector("button"));
    expect(byLabel("Field menu")).toBeNull();
  });

  test("without canManageSettings every control is disabled and the header has no button or menu", async () => {
    harness.fake.getAccess.mockResolvedValue({
      canEdit: true,
      canPublish: true,
      canManageSettings: false,
    });
    withFields();
    await openField("stage");
    for (const id of ["label", "key", "kind", "help", "required"]) {
      expect(control<HTMLButtonElement>(id)?.disabled, id).toBe(true);
    }
    expect(optionInputs().every((input) => input.disabled)).toBe(true);
    expect(primary()).toBeUndefined();
    expect(byLabel("Field menu")).toBeNull();
  });

  test("a dirty sheet sets $cmsNativeDirty; Back, another field, another collection and Classic CMS ask first", async () => {
    withFields();
    await openField("summary");
    const leaves: Array<() => Promise<void>> = [
      () => click(byLabel("Back")),
      () => click(fieldRow("title")!.querySelector("button")),
      async () => {
        await click(tab("Collections"));
        await click(rowOf("people")?.querySelector("button"));
      },
      async () => {
        await click(byLabel("CMS menu"));
        await click(menuItem("Classic CMS"));
      },
    ];
    for (const leave of leaves) {
      if (tab("Fields")?.getAttribute("aria-selected") !== "true") {
        await click(tab("Fields"));
      }
      await typeInto(control("label"), "Teaser");
      expect($cmsNativeDirty.get()).toBe(true);
      await leave();
      expect(hasText("Discard unsaved changes?")).toBe(true);
      await keepEditing();
      expect(control("label")?.value).toBe("Teaser");
    }
    expect(harness.props.onShowClassic).not.toHaveBeenCalled();
  });

  test("no toast after a save; the sheet stays open on the saved field, clean", async () => {
    const error = vi.spyOn(toast, "error");
    const success = vi.spyOn(toast, "success");
    withFields();
    answerSchema();
    await openNew("email");
    await typeInto(control("label"), "Contact");
    await click(primary());
    expect(error).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(sheet()).not.toBeNull();
    expect(crumb()).toEqual(["Posts", "/", "Contact"]);
    expect(buttonByText("Save", header()!)?.disabled).toBe(true);
    expect(control("key")?.disabled).toBe(true);
    expect($cmsNativeDirty.get()).toBe(false);
    expect(lastSchema()?.fields.at(-1)).toEqual({
      key: "contact",
      label: "Contact",
      kind: "email",
    });
  });
});

// Round 4, item 13: one toast per failure
test("a Remove whose count read fails shows its toast and no dialog", async () => {
  const error = vi.spyOn(toast, "error");
  withFields();
  await openField("summary");
  harness.structure.getCollectionStructure.mockResolvedValueOnce({
    error: "unavailable",
  });
  await click(byLabel("Field menu"));
  await click(menuItem("Remove field"));
  await settle();
  expect(error).toHaveBeenCalledTimes(1);
  expect(error).toHaveBeenLastCalledWith(
    "Try again in a minute",
    STRUCTURE_FAILURE_TOAST
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
