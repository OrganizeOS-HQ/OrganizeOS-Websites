import { describe, expect, test } from "vitest";
import {
  canRemoveField,
  draftFromField,
  draftToField,
  getColumnBlock,
  getFieldCap,
  getFieldDraftErrors,
  getSettingsErrors,
  getTemplateReferenceTypes,
  isFieldDraftDirty,
  keyFromLabel,
  moveField,
  newDraft,
  newOption,
  normalizeStructureCollection,
  schemaWithDraft,
  withKind,
  withLabel,
  withTitle,
} from "./cms-structure-logic";
import type { CmsStructureField } from "./cms-structure-source";

const fields: CmsStructureField[] = [
  {
    key: "title",
    label: "Headline",
    kind: "text",
    isTitle: true,
    required: true,
  },
  { key: "summary", label: "Summary", kind: "textarea" },
  { key: "date", label: "Date", kind: "date", showInTable: true },
  { key: "role", label: "Role", kind: "text", locked: true },
];

describe("keys", () => {
  test("a key is camelCase from the name, as the platform derives it", () => {
    expect(keyFromLabel("Reading time (min)")).toBe("readingTimeMin");
    expect(keyFromLabel("2027 goal")).toBe("f2027Goal");
    expect(keyFromLabel("Café owner")).toBe("cafeOwner");
    expect(keyFromLabel("  ")).toBe("");
  });

  test("a new field's key follows the name until typed", () => {
    const draft = withLabel(newDraft("text"), "Reading time");
    expect(draft.key).toBe("readingTime");
    const typed = withLabel(
      { ...draft, key: "minutes", keyTouched: true },
      "Time"
    );
    expect(typed.key).toBe("minutes");
  });

  test("a saved field's key never follows the name", () => {
    const draft = withLabel(draftFromField(fields[1]), "Teaser");
    expect(draft.key).toBe("summary");
  });

  test("a key in use, case-insensitively, is refused", () => {
    const draft = withLabel(newDraft("text"), "Summary");
    expect(getFieldDraftErrors(fields, draft, undefined).key).toBe(
      "Key in use"
    );
    const upper = { ...draft, key: "SUMMARY", keyTouched: true };
    expect(getFieldDraftErrors(fields, upper, undefined).key).toBe(
      "Key in use"
    );
  });

  test("a key that is not an identifier is refused", () => {
    const draft = {
      ...newDraft("text"),
      label: "A",
      key: "1a",
      keyTouched: true,
    };
    expect(getFieldDraftErrors(fields, draft, undefined).key).toBe(
      "Letters and digits, from a letter"
    );
  });
});

describe("kinds and settings", () => {
  test("an option field needs an option, and values do not repeat", () => {
    const draft = { ...newDraft("option"), label: "Stage", key: "stage" };
    expect(getFieldDraftErrors(fields, draft, undefined).options).toBe(
      "Add an option"
    );
    const repeated = {
      ...draft,
      options: [newOption("Won"), newOption("Won")],
    };
    expect(getFieldDraftErrors(fields, repeated, undefined).options).toBe(
      "Options repeat"
    );
  });

  test("a new option's value is its label; a saved one keeps its value", () => {
    const saved = draftFromField({
      key: "stage",
      label: "Stage",
      kind: "option",
      options: [{ value: "won", label: "Won" }],
    });
    const draft = {
      ...saved,
      options: [{ ...saved.options[0], label: "Victory" }, newOption("Paused")],
    };
    expect(draftToField(draft).options).toEqual([
      { value: "won", label: "Victory" },
      { value: "Paused", label: "Paused" },
    ]);
  });

  test("a reference names its collection, and multiple follows the kind", () => {
    const draft = { ...newDraft("multireference"), label: "News", key: "news" };
    expect(getFieldDraftErrors(fields, draft, undefined).reference).toBe(
      "Choose a collection"
    );
    expect(draftToField({ ...draft, referenceId: "c1" }).reference).toEqual({
      collectionId: "c1",
      multiple: true,
    });
  });

  test("changing kind drops what the new kind cannot carry", () => {
    const draft = withTitle({ ...newDraft("text"), maxLength: "80" }, true);
    const image = withKind(draft, "image");
    expect(image.isTitle).toBe(false);
    expect(image.maxLength).toBe("");
  });

  test("max length is a whole number, capped", () => {
    const draft = {
      ...newDraft("text"),
      label: "A",
      key: "a",
      maxLength: "2.5",
    };
    expect(getFieldDraftErrors(fields, draft, undefined).maxLength).toBe(
      "A whole number"
    );
    expect(draftToField({ ...draft, maxLength: "999999" }).maxLength).toBe(
      100_000
    );
  });
});

describe("the schema", () => {
  test("a new title takes the flag from the old one, which stays required", () => {
    const draft = withTitle(draftFromField(fields[3]), true);
    const schema = schemaWithDraft(fields, draft, "role");
    expect(
      schema.filter((field) => field.isTitle).map((field) => field.key)
    ).toEqual(["role"]);
    expect(schema[0]).toEqual({
      key: "title",
      label: "Headline",
      kind: "text",
      required: true,
    });
  });

  test("a new field goes last", () => {
    const draft = withLabel(newDraft("email"), "Contact");
    expect(schemaWithDraft(fields, draft, undefined).at(-1)?.key).toBe(
      "contact"
    );
  });

  test("moving a field reorders the schema; out of range changes nothing", () => {
    expect(moveField(fields, "date", 0).map((field) => field.key)).toEqual([
      "date",
      "title",
      "summary",
      "role",
    ]);
    expect(moveField(fields, "date", 9)).toEqual(fields);
  });

  test("the title and template fields are never removed", () => {
    expect(fields.map(canRemoveField)).toEqual([false, true, true, false]);
  });

  test("an unchanged saved field is not dirty; a template field keeps its lock", () => {
    expect(isFieldDraftDirty(fields[3], draftFromField(fields[3]))).toBe(false);
    expect(
      isFieldDraftDirty(
        fields[1],
        withLabel(draftFromField(fields[1]), "Teaser")
      )
    ).toBe(true);
    expect(draftToField(draftFromField(fields[3])).locked).toBe(true);
  });

  test("the table column is refused where the platform refuses it", () => {
    expect(getColumnBlock(fields, draftFromField(fields[0]), "title")).toBe(
      "The title is the Name column"
    );
    expect(getColumnBlock(fields, newDraft("richtext"), undefined)).toBe(
      "Rich text fields have no column"
    );
    const full: CmsStructureField[] = [1, 2, 3, 4].map((index) => ({
      key: `f${index}`,
      label: `F${index}`,
      kind: "text",
      showInTable: true,
    }));
    expect(getColumnBlock(full, newDraft("text"), undefined)).toBe(
      "4 columns already"
    );
  });

  test("the cap is the plan's, never past 60", () => {
    expect(getFieldCap(30)).toBe(30);
    expect(getFieldCap(Number.POSITIVE_INFINITY)).toBe(60);
  });
});

test("legacy kinds normalise", () => {
  const collection = normalizeStructureCollection({
    id: "c",
    slug: "c",
    name: "C",
    singularName: "C",
    isPublic: true,
    kind: "custom",
    total: 0,
    referencedBy: [],
    fields: [
      { key: "a", label: "A", kind: "url", locked: true },
      { key: "b", label: "B", kind: "boolean" },
    ],
  });
  expect(collection.fields).toEqual([
    { key: "a", label: "A", kind: "link", locked: true },
    { key: "b", label: "B", kind: "switch" },
  ]);
});

test("a template's references, in field order, once each", () => {
  expect(
    getTemplateReferenceTypes({
      type: "blog",
      label: "Blog posts",
      itemLabel: "Blog post",
      fields: [
        { key: "a", label: "A", kind: "reference", referenceType: "team" },
        {
          key: "b",
          label: "B",
          kind: "multireference",
          referenceType: "categories",
        },
        { key: "c", label: "C", kind: "reference", referenceType: "team" },
      ],
    })
  ).toEqual(["team", "categories"]);
});

test("collection settings need a name, a singular name and an address", () => {
  expect(
    getSettingsErrors({
      name: " ",
      singularName: "",
      slug: "Bad slug",
      isPublic: true,
    })
  ).toEqual({
    name: "Required",
    singularName: "Required",
    slug: "Lower-case letters, digits, hyphens",
  });
});

test("an untouched field is not dirty, in any property order", () => {
  const platformOrder: CmsStructureField = {
    key: "question",
    label: "Question",
    kind: "text",
    required: true,
    locked: true,
    isTitle: true,
  };
  expect(isFieldDraftDirty(platformOrder, draftFromField(platformOrder))).toBe(
    false
  );
  const reference: CmsStructureField = {
    key: "author",
    label: "Author",
    kind: "reference",
    locked: true,
    reference: { multiple: false, collectionId: "c1" },
  };
  expect(isFieldDraftDirty(reference, draftFromField(reference))).toBe(false);
});

test("maxLength stays on a kind the sheet does not edit it on", () => {
  const field: CmsStructureField = {
    key: "a",
    label: "A",
    kind: "email",
    maxLength: 80,
  };
  expect(draftToField(draftFromField(field)).maxLength).toBe(80);
});

test("a kind change that clears the title gives Required back", () => {
  const draft = withTitle({ ...newDraft("text"), required: false }, true);
  expect(draft.required).toBe(true);
  expect(withKind(draft, "number").required).toBe(false);
});
