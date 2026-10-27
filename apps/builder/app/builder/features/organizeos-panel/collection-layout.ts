/**
 * The layout map of a collection's generated pages and lists (OrganizeOS
 * design `2026-10-27-cms-page-templates-design.md` section 3.3): which field
 * plays which part, read from the collection's public schema
 * (collection-schema.ts). Pure, so every curated template's result is pinned
 * by its test.
 */

/** A field of a collection's public schema, as `GET /v1/collections` sends it. */
export type CollectionField = {
  key: string;
  label: string;
  kind: string;
  isTitle?: boolean;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  reference?: { collectionSlug: string; multiple: boolean };
};

/** The kinds the "rest" of an item shows, one Text (or Link) per field. */
export type RestKind =
  | "text"
  | "textarea"
  | "link"
  | "email"
  | "phone"
  | "number"
  | "option";

const restKinds = new Set<string>([
  "text",
  "textarea",
  "link",
  "email",
  "phone",
  "number",
  "option",
]);

/**
 * A field's kind, with the platform's legacy spellings read as the kinds they
 * stand for (`url` is `link`, `boolean` is `switch`), as `/v1` normalises them.
 */
export const normalizeFieldKind = (kind: string) => {
  if (kind === "url") {
    return "link";
  }
  if (kind === "boolean") {
    return "switch";
  }
  return kind;
};

/**
 * The first `textarea` field, an item's summary wherever it sits: the item
 * page's description and a list card's text read it, even beside a rich text
 * field, which neither can show.
 */
export const findSummaryField = (fields: CollectionField[]) =>
  fields.find((field) => normalizeFieldKind(field.kind) === "textarea");

export type CollectionRoles = {
  /** The `isTitle` field. Its value is the item's `name`. */
  title?: CollectionField;
  /** The first `date` or `datetime` field, else the item's `publishedAt`. */
  date: CollectionField | "publishedAt";
  /** The first `image` field. */
  image?: CollectionField;
  /** The first `richtext` field. */
  body?: CollectionField;
  /** The first `textarea` field, only when there is no `richtext` field. */
  summary?: CollectionField;
  /** The remaining text-like fields, in schema order. */
  rest: Array<{ field: CollectionField; kind: RestKind }>;
  /** The single `reference` fields, each shown by its item's name. */
  references: CollectionField[];
  /** Everything else, left for the designer. */
  unplaced: CollectionField[];
};

export const pickRoles = (fields: CollectionField[]): CollectionRoles => {
  const kindOf = (field: CollectionField) => normalizeFieldKind(field.kind);
  const title = fields.find((field) => field.isTitle === true);
  const date = fields.find((field) =>
    ["date", "datetime"].includes(kindOf(field))
  );
  const image = fields.find((field) => kindOf(field) === "image");
  const body = fields.find((field) => kindOf(field) === "richtext");
  const summary =
    body === undefined
      ? fields.find((field) => kindOf(field) === "textarea")
      : undefined;
  const placed = new Set(
    [title, date, image, body, summary].filter(
      (field): field is CollectionField => field !== undefined
    )
  );
  const rest: CollectionRoles["rest"] = [];
  const references: CollectionField[] = [];
  const unplaced: CollectionField[] = [];
  for (const field of fields) {
    if (placed.has(field)) {
      continue;
    }
    const kind = kindOf(field);
    if (restKinds.has(kind)) {
      rest.push({ field, kind: kind as RestKind });
    } else if (kind === "reference") {
      references.push(field);
    } else {
      unplaced.push(field);
    }
  }
  return {
    title,
    date: date ?? "publishedAt",
    image,
    body,
    summary,
    rest,
    references,
    unplaced,
  };
};
