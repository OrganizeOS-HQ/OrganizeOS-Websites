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
import { getToastText, isSlug, slugify } from "./cms-logic";
import type { CmsErrorCode, CmsFieldKind, CmsFieldOption } from "./cms-source";
import type {
  CmsCollectionSettings,
  CmsStructureField,
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
/** A run of reorders is one write, this long after the last move. */
export const REORDER_PAUSE_MS = 500;
/** A reorder answered `rate_limited` is sent once more after this. */
export const RATE_LIMIT_RETRY_MS = 15_000;
/** The collection settings' caps (E23). */
export const COLLECTION_NAME_MAX = 120;
export const COLLECTION_SLUG_MAX = 63;

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
  /** Required as it was before the title switch forced it on. */
  requiredBeforeTitle: boolean;
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
  requiredBeforeTitle: field.required === true,
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
  requiredBeforeTitle: false,
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
  // a title the kind change clears gives back the Required it forced
  required:
    kind !== "text" && draft.isTitle
      ? draft.requiredBeforeTitle
      : draft.required,
});

/** The title is always required and always the table's Name column. */
export const withTitle = (draft: FieldDraft, isTitle: boolean): FieldDraft => ({
  ...draft,
  isTitle,
  requiredBeforeTitle: isTitle ? draft.required : draft.requiredBeforeTitle,
  required: isTitle ? true : draft.requiredBeforeTitle,
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
  const maxLength = parseMaxLength(draft.maxLength);
  // kept on any kind, as the platform keeps it; the sheet edits it on two
  if (maxLength !== undefined) {
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

/** A positive whole number as typed, or undefined. */
const parseMaxLength = (typed: string) => {
  const trimmed = typed.trim();
  if (/^[0-9]+$/.test(trimmed) === false) {
    return undefined;
  }
  const value = Number(trimmed);
  return value >= 1 ? value : undefined;
};

/**
 * The option list's problem, as the platform's rules (`validateFieldSchema`)
 * and the label rule (spec 4.5): values are unique, case-sensitive, a new
 * option's value being its trimmed label; a label new or changed in this
 * draft may not equal another option's label (a saved option's label being
 * its label, else its value). Labels the draft left alone are exempt.
 */
const getOptionsError = (
  fields: readonly CmsStructureField[],
  draft: FieldDraft,
  originalKey: string | undefined
): string | undefined => {
  const savedLabels = new Map(
    (fields.find((field) => field.key === originalKey)?.options ?? []).map(
      (option) => [option.value, option.label.trim() || option.value]
    )
  );
  const rows = draft.options
    .map((option) => {
      const value = optionValue(option);
      const label = option.label.trim() || value;
      const isTouched =
        option.value === undefined || savedLabels.get(option.value) !== label;
      return { value, label, isTouched };
    })
    .filter((row) => row.value !== "");
  if (rows.length === 0) {
    return "Add an option";
  }
  if (rows.length > OPTIONS_MAX) {
    return `At most ${OPTIONS_MAX} options`;
  }
  const values = rows.map((row) => row.value);
  if (new Set(values).size !== values.length) {
    return "Options repeat";
  }
  const repeatsLabel = rows.some(
    (row, index) =>
      row.isTouched &&
      rows.some((other, at) => at !== index && other.label === row.label)
  );
  if (repeatsLabel) {
    return "Options repeat";
  }
  if (
    rows.some(
      (row) =>
        row.value.length > OPTION_VALUE_MAX ||
        (row.isTouched && row.label.length > OPTION_VALUE_MAX)
    )
  ) {
    return `At most ${OPTION_VALUE_MAX} characters each`;
  }
  return undefined;
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
    const options = getOptionsError(fields, draft, originalKey);
    if (options !== undefined) {
      errors.options = options;
    }
  }
  if (isReferenceKind(draft.kind) && draft.referenceId === "") {
    errors.reference = "Choose a collection";
  }
  if (
    takesMaxLength(draft.kind) &&
    draft.maxLength.trim() !== "" &&
    parseMaxLength(draft.maxLength) === undefined
  ) {
    errors.maxLength = "A whole number";
  }
  return errors;
};

/** A stable form: keys sorted at every level, so order never counts. */
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
    );
  }
  return value;
};

export const isSameField = (
  left: CmsStructureField,
  right: CmsStructureField
) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

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
  // both through the draft, so what the sheet cannot hold never counts
  return (
    isSameField(draftToField(draftFromField(original)), draftToField(draft)) ===
    false
  );
};

/**
 * Whether the Table column switch is enabled: never for the title, rich
 * text, an image or a multi-reference, nor for a fifth column; a field that
 * is on can always be turned off.
 */
export const canShowInTable = (
  fields: readonly CmsStructureField[],
  draft: FieldDraft,
  originalKey: string | undefined
) => {
  if (draft.showInTable) {
    return true;
  }
  if (draft.isTitle || TABLE_HIDDEN_KINDS.has(draft.kind)) {
    return false;
  }
  const others = fields.filter(
    (field) => field.key !== originalKey && field.showInTable === true
  ).length;
  return others < TABLE_FIELDS_MAX;
};

/** A field the sheet may remove: not from a template, not the title. */
export const canRemoveField = (field: CmsStructureField) =>
  field.locked !== true && field.isTitle !== true;

/** The plan's cap, never past the hard 60. */
export const getFieldCap = (planFields: number) =>
  Math.min(planFields, FIELDS_HARD_MAX);

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

/**
 * What Save sends: the names trimmed, and an address that is not one
 * slugified, falling back to the name's slug (the blur rule).
 */
export const toSettingsToSave = (
  settings: CmsCollectionSettings
): CmsCollectionSettings => {
  const name = settings.name.trim();
  return {
    name,
    singularName: settings.singularName.trim(),
    slug: isSlug(settings.slug)
      ? settings.slug
      : slugify(settings.slug, slugify(name, "collection")),
    isPublic: settings.isPublic,
  };
};

/**
 * After a fresh read replaced the baseline (Reload after a conflict, or the
 * reread after an unknown outcome): each control still equal to the old
 * baseline takes the fresh value; the ones the person changed keep theirs.
 */
export const rebaseSettings = (
  baseline: CmsCollectionSettings,
  fresh: CmsCollectionSettings,
  values: CmsCollectionSettings
): CmsCollectionSettings => ({
  name: values.name === baseline.name ? fresh.name : values.name,
  singularName:
    values.singularName === baseline.singularName
      ? fresh.singularName
      : values.singularName,
  slug: values.slug === baseline.slug ? fresh.slug : values.slug,
  isPublic:
    values.isPublic === baseline.isPublic ? fresh.isPublic : values.isPublic,
});

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
  if (code === "not_found") {
    return "Collection not found";
  }
  // only E22 toasts it: the person typed no address, and Create again
  // derives a new one
  if (code === "slug_taken") {
    return "Try again in a minute";
  }
  return getToastText(code);
};
