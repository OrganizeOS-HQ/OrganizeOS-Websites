/**
 * The native CMS screen's pure logic: status chips, the address rule, dirty
 * tracking, paging and field checks. No React, no stores, no I/O.
 */
import type {
  CmsErrorCode,
  CmsField,
  CmsFieldKind,
  CmsItemData,
  CmsItemStatus,
} from "./cms-source";

export type CmsChipColor = "neutral" | "green" | "purple";

export type CmsStatusChip = {
  label: "Draft" | "Published" | "Staged changes" | "Archived";
  color: CmsChipColor;
};

/** The status chip of an item (4.1 item 4), by its live status. */
export const getStatusChip = ({
  status,
  hasStagedChanges,
}: {
  status: CmsItemStatus;
  hasStagedChanges: boolean;
}): CmsStatusChip => {
  if (status === "published") {
    return hasStagedChanges
      ? { label: "Staged changes", color: "purple" }
      : { label: "Published", color: "green" };
  }
  if (status === "archived") {
    return { label: "Archived", color: "neutral" };
  }
  return { label: "Draft", color: "neutral" };
};

/** The platform's slug shape (`client/lib/collections/slug.ts`). */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Generated slugs stop here, so a numeric suffix still fits under 63. */
const GENERATED_MAX = 48;

export const isSlug = (value: unknown): value is string =>
  typeof value === "string" && SLUG_RE.test(value);

/**
 * The platform's `slugify`, copied as a pure function (4.3.2): accents
 * folded to ASCII, anything else that is not a-z0-9 one hyphen, capped at
 * 48 characters. Empty input yields the fallback.
 */
export const slugify = (input: string, fallback = "item") => {
  const folded = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const capped = folded.slice(0, GENERATED_MAX).replace(/-+$/g, "");
  return capped || fallback;
};

/**
 * Whether the address follows the title: for a new item, and for an item
 * whose address still equals its title's derivation, until the person edits
 * the address.
 */
export const slugFollowsTitle = ({
  isNew,
  slug,
  title,
}: {
  isNew: boolean;
  slug: string;
  title: string;
}) => isNew || slug === slugify(title);

/** The title field: the schema's `isTitle` field, else its first text field. */
export const getTitleField = (fields: readonly CmsField[]) =>
  fields.find((field) => field.isTitle) ??
  fields.find((field) => field.kind === "text");

export const getItemTitle = (
  data: CmsItemData,
  fields: readonly CmsField[]
) => {
  const field = getTitleField(fields);
  const value = field === undefined ? undefined : data[field.key];
  return typeof value === "string" ? value : "";
};

/** The value an unset field carries: false, [] or null. */
export const emptyValueFor = (kind: CmsFieldKind): unknown => {
  if (kind === "switch") {
    return false;
  }
  if (kind === "multireference") {
    return [];
  }
  return null;
};

/** Every field at its empty value: a new item's data. */
export const emptyItemData = (fields: readonly CmsField[]): CmsItemData =>
  Object.fromEntries(
    fields.map((field) => [field.key, emptyValueFor(field.kind)])
  );

/** Unset and blank compare equal: undefined, null and "" are one value. */
const normalizeForCompare = (value: unknown): unknown =>
  value === undefined || value === "" ? null : value;

export const isSameValue = (left: unknown, right: unknown): boolean => {
  const a = normalizeForCompare(left);
  const b = normalizeForCompare(right);
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((entry, index) => isSameValue(entry, b[index]))
    );
  }
  if (
    typeof a === "object" &&
    a !== null &&
    typeof b === "object" &&
    b !== null
  ) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (
        isSameValue(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        ) === false
      ) {
        return false;
      }
    }
    return true;
  }
  return false;
};

/** The keys, in schema order, whose value differs from the baseline. */
export const getChangedFieldKeys = (
  fields: readonly CmsField[],
  baseline: CmsItemData,
  values: CmsItemData
) =>
  fields
    .filter(
      (field) => isSameValue(baseline[field.key], values[field.key]) === false
    )
    .map((field) => field.key);

/** Dirty: a field or the address differs from what was loaded. */
export const isItemDirty = ({
  fields,
  baseline,
  values,
  baselineSlug,
  slug,
}: {
  fields: readonly CmsField[];
  baseline: CmsItemData;
  values: CmsItemData;
  baselineSlug: string;
  slug: string;
}) =>
  slug !== baselineSlug ||
  getChangedFieldKeys(fields, baseline, values).length > 0;

export const getPageCount = (total: number, pageSize: number) =>
  Math.max(1, Math.ceil(total / pageSize));

/** "1-50 of 120"; an empty list has no range. */
export const formatPageRange = (
  page: number,
  pageSize: number,
  total: number
) => {
  if (total <= 0) {
    return "";
  }
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return `${first}-${last} of ${total}`;
};

const pad = (value: number) => String(value).padStart(2, "0");

/** An ISO timestamp to a `datetime-local` value, in the browser's zone. */
export const isoToLocalInput = (iso: unknown) => {
  if (typeof iso !== "string" || iso === "") {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** A `datetime-local` value, in the browser's zone, to an ISO timestamp. */
export const localInputToIso = (local: string) => {
  if (local === "") {
    return null;
  }
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const isBlank = (kind: CmsFieldKind, value: unknown) => {
  if (kind === "multireference") {
    return Array.isArray(value) === false || value.length === 0;
  }
  if (kind === "richtext") {
    const text = (value as { text?: unknown } | null)?.text;
    return typeof text !== "string" || text.trim() === "";
  }
  if (kind === "image") {
    return (
      value === null ||
      value === undefined ||
      value === "" ||
      (typeof value === "object" && (value as { url?: unknown }).url === "")
    );
  }
  if (kind === "switch") {
    return false;
  }
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
};

const isUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Client-side checks, in two or three words a field (4.3.2). The platform
 * checks again; its `invalid` with a `field` key marks that field.
 */
export const validateItem = (
  fields: readonly CmsField[],
  values: CmsItemData,
  slug: string
) => {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (isBlank(field.kind, value)) {
      if (field.required) {
        errors[field.key] = "Required";
      }
      continue;
    }
    if (typeof value === "string") {
      if (field.kind === "email" && EMAIL_RE.test(value.trim()) === false) {
        errors[field.key] = "Not an email";
      }
      if (field.kind === "link" && isUrl(value.trim()) === false) {
        errors[field.key] = "Not a link";
      }
      if (field.kind === "color" && COLOR_RE.test(value.trim()) === false) {
        errors[field.key] = "Not a color";
      }
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        errors[field.key] = "Too long";
      }
    }
  }
  if (slug !== "" && isSlug(slug) === false) {
    errors.slug = "Not an address";
  }
  return errors;
};

/** A field-level code's few words (4.3.2), or undefined for other codes. */
export const getFieldErrorText = (code: CmsErrorCode) => {
  switch (code) {
    case "slug_taken":
      return "Address in use";
    case "reference_invalid":
      return "Item not found";
    case "invalid":
      return "Not valid";
    default:
      return undefined;
  }
};

/** The few words of a failure that is not a field's own, for a toast. */
export const getToastText = (code: CmsErrorCode) => {
  switch (code) {
    case "rate_limited":
    case "unavailable":
    case "updating":
    case "replayed":
      return "Try again in a minute";
    case "limit":
      return "Item limit reached";
    case "not_found":
      return "Item not found";
    case "forbidden":
      return "No access";
    default:
      return "Not saved";
  }
};

export type CmsRefusal = "unauthorized" | "mfa_required" | "forbidden" | "plan";

/** The codes that replace the screen with one line (4.3.4). */
export const getRefusal = (code: CmsErrorCode): CmsRefusal | undefined =>
  code === "unauthorized" ||
  code === "mfa_required" ||
  code === "forbidden" ||
  code === "plan"
    ? code
    : undefined;
