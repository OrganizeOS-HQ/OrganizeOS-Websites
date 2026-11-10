/**
 * The structure screens' rules, copied as pure functions from the platform
 * (`client/lib/collections/schema.ts` `validateFieldSchema` and
 * `keyFromLabel`, `client/components/cms/field-draft.ts`) so the field sheet
 * and the collection settings refuse what the platform refuses, before a
 * call. No React, no data access.
 *
 * The rules kept:
 * - a field's key is an identifier, unique case-insensitively, derived from
 *   its name until typed, and fixed once saved; its kind is fixed too;
 * - exactly one title field, of kind text, always required;
 * - an option field has 1 to 50 options, values unique;
 * - a reference field names its target collection;
 * - a template (locked) field and the title field are never removed, and a
 *   locked reference keeps its target;
 * - at most 4 table columns, never the title, never richtext, image or
 *   multireference;
 * - the plan's field cap, and the hard 60.
 */
import { getToastText, isSlug } from "./cms-logic";
import type { CmsErrorCode, CmsFieldKind, CmsFieldOption } from "./cms-source";
import type {
  CmsCollectionSettings,
  CmsRawStructureCollection,
  CmsStructureCollection,
  CmsStructureField,
  CmsTemplate,
} from "./cms-structure-source";

export const FIELD_KEY_RE = /^[a-zA-Z][a-zA-Z0-9]*$/;
export const FIELD_KEY_MAX = 40;
export const FIELD_LABEL_MAX = 80;
export const FIELD_HELP_MAX = 240;
export const OPTION_VALUE_MAX = 80;
export const OPTIONS_MAX = 50;
export const FIELDS_HARD_MAX = 60;
export const TABLE_FIELDS_MAX = 4;
/** The platform's `maxLength` ceiling. */
export const MAX_LENGTH_MAX = 100_000;

/** `field-kinds.ts` `FIELD_KIND_LABELS`. */
export const FIELD_KIND_LABELS: Readonly<Record<CmsFieldKind, string>> = {
  text: "Plain text",
  textarea: "Long text",
  richtext: "Rich text",
  image: "Image",
  link: "Link",
  email: "Email",
  phone: "Phone",
  number: "Number",
  date: "Date",
  datetime: "Date and time",
  switch: "Switch",
  color: "Color",
  option: "Option",
  reference: "Reference",
  multireference: "Multi-reference",
};

/** The classic "Add field" menu's groups, in order (`field-draft.ts`). */
export const FIELD_KIND_GROUPS: ReadonlyArray<{
  label: string;
  kinds: readonly CmsFieldKind[];
}> = [
  { label: "Text", kinds: ["text", "textarea", "richtext"] },
  { label: "Media and links", kinds: ["image", "link", "email", "phone"] },
  {
    label: "Values",
    kinds: ["number", "date", "datetime", "switch", "color", "option"],
  },
  { label: "Relations", kinds: ["reference", "multireference"] },
];

export const FIELD_KINDS: readonly CmsFieldKind[] = FIELD_KIND_GROUPS.flatMap(
  (group) => group.kinds
);

const TABLE_HIDDEN_KINDS: ReadonlySet<CmsFieldKind> = new Set([
  "richtext",
  "image",
  "multireference",
]);

export const isReferenceKind = (kind: CmsFieldKind) =>
  kind === "reference" || kind === "multireference";

/** Kinds whose control takes `maxLength` (the item editor applies it). */
export const takesMaxLength = (kind: CmsFieldKind) =>
  kind === "text" || kind === "textarea";

/** The platform's `FIELD_KIND_ALIASES`: legacy spellings still stored. */
const kindAliases: Readonly<Record<string, CmsFieldKind>> = {
  url: "link",
  boolean: "switch",
};

export const normalizeFieldKind = (kind: string): CmsFieldKind =>
  kindAliases[kind] ?? (kind as CmsFieldKind);

/** As the structure screens use it: every kind normalised once. */
export const normalizeStructureCollection = (
  raw: CmsRawStructureCollection
): CmsStructureCollection => ({
  ...raw,
  fields: raw.fields.map((field) => ({
    ...field,
    kind: normalizeFieldKind(field.kind),
  })),
});

/** camelCase key from a name: "Reading time (min)" -> "readingTimeMin". */
export const keyFromLabel = (label: string) => {
  const words = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) {
    return "";
  }
  const [first, ...rest] = words;
  const key =
    first.toLowerCase() +
    rest
      .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
      .join("");
  const safe = /^[0-9]/.test(key) ? `f${key}` : key;
  return safe.slice(0, FIELD_KEY_MAX);
};

/** One option row: `value` is undefined until saved, then fixed. */
export type OptionDraft = {
  id: string;
  value: string | undefined;
  label: string;
};

export type FieldDraft = {
  key: string;
  label: string;
  kind: CmsFieldKind;
  required: boolean;
  isTitle: boolean;
  help: string;
  options: OptionDraft[];
  referenceId: string;
  /** As typed; empty is no cap. */
  maxLength: string;
  showInTable: boolean;
  locked: boolean;
  /** Not saved yet: the key and kind can still change. */
  isNew: boolean;
  /** The person typed a key, so the name no longer derives it. */
  keyTouched: boolean;
};

let optionSequence = 0;
const nextOptionId = () => {
  optionSequence += 1;
  return `option-${optionSequence}`;
};

export const newOption = (label = ""): OptionDraft => ({
  id: nextOptionId(),
  value: undefined,
  label,
});

export const draftFromField = (field: CmsStructureField): FieldDraft => ({
  key: field.key,
  label: field.label,
  kind: field.kind,
  required: field.required === true || field.isTitle === true,
  isTitle: field.isTitle === true,
  help: field.help ?? "",
  options: (field.options ?? []).map((option) => ({
    id: nextOptionId(),
    value: option.value,
    label: option.label,
  })),
  referenceId: field.reference?.collectionId ?? "",
  maxLength: field.maxLength === undefined ? "" : String(field.maxLength),
  showInTable: field.showInTable === true,
  locked: field.locked === true,
  isNew: false,
  keyTouched: true,
});

export const newDraft = (kind: CmsFieldKind, referenceId = ""): FieldDraft => ({
  key: "",
  label: "",
  kind,
  required: false,
  isTitle: false,
  help: "",
  options: kind === "option" ? [newOption()] : [],
  referenceId: isReferenceKind(kind) ? referenceId : "",
  maxLength: "",
  showInTable: false,
  locked: false,
  isNew: true,
  keyTouched: false,
});

/** A name edit; a new field's key follows it until the key is typed. */
export const withLabel = (draft: FieldDraft, label: string): FieldDraft => ({
  ...draft,
  label,
  ...(draft.isNew && draft.keyTouched === false
    ? { key: keyFromLabel(label) }
    : {}),
});

/** A new field's kind change: what the new kind cannot carry is dropped. */
export const withKind = (
  draft: FieldDraft,
  kind: CmsFieldKind,
  referenceId = ""
): FieldDraft => ({
  ...draft,
  kind,
  isTitle: kind === "text" ? draft.isTitle : false,
  showInTable: TABLE_HIDDEN_KINDS.has(kind) ? false : draft.showInTable,
  referenceId: isReferenceKind(kind) ? draft.referenceId || referenceId : "",
  options:
    kind === "option" && draft.options.length === 0
      ? [newOption()]
      : draft.options,
  maxLength: takesMaxLength(kind) ? draft.maxLength : "",
});

/** The title is always required and always the table's Name column. */
export const withTitle = (draft: FieldDraft, isTitle: boolean): FieldDraft => ({
  ...draft,
  isTitle,
  required: isTitle ? true : draft.required,
  showInTable: isTitle ? false : draft.showInTable,
});

const optionValue = (option: OptionDraft) =>
  option.value ?? option.label.trim();

/** The field the schema stores, from a draft. */
export const draftToField = (draft: FieldDraft): CmsStructureField => {
  const field: CmsStructureField = {
    key: draft.key.trim(),
    label: draft.label.trim(),
    kind: draft.kind,
  };
  if (draft.required || draft.isTitle) {
    field.required = true;
  }
  if (draft.isTitle) {
    field.isTitle = true;
  }
  if (draft.help.trim() !== "") {
    field.help = draft.help.trim();
  }
  if (draft.kind === "option") {
    field.options = draft.options
      .filter((option) => optionValue(option) !== "")
      .map(
        (option): CmsFieldOption => ({
          value: optionValue(option),
          label: option.label.trim() || optionValue(option),
        })
      );
  }
  if (isReferenceKind(draft.kind)) {
    field.reference = {
      collectionId: draft.referenceId,
      multiple: draft.kind === "multireference",
    };
  }
  const maxLength = Number(draft.maxLength);
  if (
    takesMaxLength(draft.kind) &&
    draft.maxLength.trim() !== "" &&
    Number.isInteger(maxLength) &&
    maxLength > 0
  ) {
    field.maxLength = Math.min(maxLength, MAX_LENGTH_MAX);
  }
  if (draft.locked) {
    field.locked = true;
  }
  if (draft.showInTable && draft.isTitle === false) {
    field.showInTable = true;
  }
  return field;
};

/**
 * The whole schema with the draft saved: in place of `originalKey`, or added
 * at the end. A draft that becomes the title takes the flag from the old
 * title, which stays required.
 */
export const schemaWithDraft = (
  fields: readonly CmsStructureField[],
  draft: FieldDraft,
  originalKey: string | undefined
): CmsStructureField[] => {
  const next = draftToField(draft);
  const rows = fields.map((field) => {
    if (originalKey !== undefined && field.key === originalKey) {
      return next;
    }
    if (draft.isTitle && field.isTitle) {
      const { isTitle: _, ...rest } = field;
      return { ...rest, required: true };
    }
    return field;
  });
  if (originalKey === undefined) {
    rows.push(next);
  }
  return rows;
};

export const schemaWithout = (
  fields: readonly CmsStructureField[],
  key: string
) => fields.filter((field) => field.key !== key);

/** The schema with one field moved to `toIndex`; out of range is a no-op. */
export const moveField = (
  fields: readonly CmsStructureField[],
  key: string,
  toIndex: number
): CmsStructureField[] => {
  const from = fields.findIndex((field) => field.key === key);
  if (from < 0 || toIndex < 0 || toIndex >= fields.length || from === toIndex) {
    return [...fields];
  }
  const next = [...fields];
  const [moved] = next.splice(from, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

export type FieldDraftErrors = Partial<
  Record<"label" | "key" | "options" | "reference" | "maxLength", string>
>;

/** Each problem in two or three words, under its control (4.3.2). */
export const getFieldDraftErrors = (
  fields: readonly CmsStructureField[],
  draft: FieldDraft,
  originalKey: string | undefined
): FieldDraftErrors => {
  const errors: FieldDraftErrors = {};
  const label = draft.label.trim();
  if (label === "") {
    errors.label = "Required";
  } else if (label.length > FIELD_LABEL_MAX) {
    errors.label = `At most ${FIELD_LABEL_MAX} characters`;
  }
  if (draft.isNew) {
    const key = draft.key.trim();
    if (key === "") {
      errors.key = "Required";
    } else if (FIELD_KEY_RE.test(key) === false) {
      errors.key = "Letters and digits, from a letter";
    } else if (key.length > FIELD_KEY_MAX) {
      errors.key = `At most ${FIELD_KEY_MAX} characters`;
    } else if (
      fields.some(
        (field) =>
          field.key !== originalKey &&
          field.key.toLowerCase() === key.toLowerCase()
      )
    ) {
      errors.key = "Key in use";
    }
  }
  if (draft.kind === "option") {
    const values = draft.options
      .map(optionValue)
      .filter((value) => value !== "");
    if (values.length === 0) {
      errors.options = "Add an option";
    } else if (values.length > OPTIONS_MAX) {
      errors.options = `At most ${OPTIONS_MAX} options`;
    } else if (new Set(values).size !== values.length) {
      errors.options = "Options repeat";
    } else if (values.some((value) => value.length > OPTION_VALUE_MAX)) {
      errors.options = `At most ${OPTION_VALUE_MAX} characters each`;
    }
  }
  if (isReferenceKind(draft.kind) && draft.referenceId === "") {
    errors.reference = "Choose a collection";
  }
  if (takesMaxLength(draft.kind) && draft.maxLength.trim() !== "") {
    const value = Number(draft.maxLength);
    if (Number.isInteger(value) === false || value < 1) {
      errors.maxLength = "A whole number";
    }
  }
  return errors;
};

export const isSameField = (
  left: CmsStructureField,
  right: CmsStructureField
) => JSON.stringify(left) === JSON.stringify(right);

/** Whether the sheet holds anything a Save would change. */
export const isFieldDraftDirty = (
  original: CmsStructureField | undefined,
  draft: FieldDraft
) => {
  if (original === undefined) {
    return (
      draft.label.trim() !== "" ||
      draft.help.trim() !== "" ||
      draft.options.some((option) => option.label.trim() !== "")
    );
  }
  return isSameField(original, draftToField(draft)) === false;
};

/** Why the table-column switch is off and fixed, or undefined. */
export const getColumnBlock = (
  fields: readonly CmsStructureField[],
  draft: FieldDraft,
  originalKey: string | undefined
) => {
  if (draft.showInTable) {
    return undefined;
  }
  if (draft.isTitle) {
    return "The title is the Name column";
  }
  if (TABLE_HIDDEN_KINDS.has(draft.kind)) {
    return `${FIELD_KIND_LABELS[draft.kind]} fields have no column`;
  }
  const others = fields.filter(
    (field) => field.key !== originalKey && field.showInTable === true
  ).length;
  if (others >= TABLE_FIELDS_MAX) {
    return `${TABLE_FIELDS_MAX} columns already`;
  }
  return undefined;
};

/** A field the sheet may remove: not from a template, not the title. */
export const canRemoveField = (field: CmsStructureField) =>
  field.locked !== true && field.isTitle !== true;

/** The plan's cap, never past the hard 60. */
export const getFieldCap = (planFields: number) =>
  Math.min(planFields, FIELDS_HARD_MAX);

/** Template types a template references, in field order, once each. */
export const getTemplateReferenceTypes = (template: CmsTemplate) => {
  const types: string[] = [];
  for (const field of template.fields) {
    if (
      field.referenceType !== undefined &&
      types.includes(field.referenceType) === false
    ) {
      types.push(field.referenceType);
    }
  }
  return types;
};

export type SettingsErrors = Partial<
  Record<keyof CmsCollectionSettings, string>
>;

export const getSettingsErrors = (
  settings: CmsCollectionSettings
): SettingsErrors => {
  const errors: SettingsErrors = {};
  if (settings.name.trim() === "") {
    errors.name = "Required";
  }
  if (settings.singularName.trim() === "") {
    errors.singularName = "Required";
  }
  if (isSlug(settings.slug) === false) {
    errors.slug = "Lower-case letters, digits, hyphens";
  }
  return errors;
};

export const isSameSettings = (
  left: CmsCollectionSettings,
  right: CmsCollectionSettings
) =>
  left.name === right.name &&
  left.singularName === right.singularName &&
  left.slug === right.slug &&
  left.isPublic === right.isPublic;

/** A structure write's failure in a few words, for a toast. */
export const getStructureToastText = (
  code: CmsErrorCode,
  what: "field" | "collection"
) => {
  if (code === "limit") {
    return what === "field"
      ? "Field limit reached"
      : "Collection limit reached";
  }
  if (code === "slug_taken") {
    return "Address in use";
  }
  return getToastText(code);
};
