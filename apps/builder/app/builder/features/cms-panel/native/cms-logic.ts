/**
 * The native CMS screen's pure logic: status chips, kinds, the address rule,
 * dirty tracking, kept values, paging and field checks. No React, no stores,
 * no I/O.
 */
import { planBadgeLabel } from "~/shared/branding";
import type { CmsDeepLink } from "../cms-panel";
import type {
  CmsCollectionSummary,
  CmsErrorCode,
  CmsField,
  CmsFieldKind,
  CmsItemData,
  CmsItemStatus,
} from "./cms-source";

/** `outline`: a neutral chip with a border and no fill. */
export type CmsChipColor = "neutral" | "purple" | "outline";

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
      : { label: "Published", color: "outline" };
  }
  if (status === "archived") {
    return { label: "Archived", color: "outline" };
  }
  return { label: "Draft", color: "neutral" };
};

/** The platform's slug shape (`client/lib/collections/slug.ts`). */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

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

/**
 * A rich-text value's HTML, or null when it holds neither text nor an image,
 * by the platform's rule for what it stores (`rich-text.ts`). A value is a
 * string or `{ html, text? }`; anything else is no value.
 */
const richTextHtmlOrNull = (value: unknown): string | null => {
  let html: string;
  let text: string | undefined;
  if (typeof value === "string") {
    html = value;
  } else if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { html?: unknown }).html === "string"
  ) {
    html = (value as { html: string }).html;
    const given = (value as { text?: unknown }).text;
    text = typeof given === "string" ? given : undefined;
  } else {
    return null;
  }
  const plain =
    text ??
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;|&#(?:160|x0*a0);/gi, " ")
      .replace(/&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi, "x");
  if (plain.trim() === "" && /<img\b/i.test(html) === false) {
    return null;
  }
  return html;
};

/**
 * The `data` of a write: exactly the schema's keys, in its order, a key the
 * values lack at its empty value; rich text as `{ html }`, or null when it
 * holds neither text nor an image.
 */
export const toItemData = (
  fields: readonly CmsField[],
  values: CmsItemData
): CmsItemData =>
  Object.fromEntries(
    fields.map((field) => {
      const value = values[field.key];
      if (field.kind === "richtext") {
        const html = richTextHtmlOrNull(value);
        return [field.key, html === null ? null : { html }];
      }
      return [
        field.key,
        value === undefined ? emptyValueFor(field.kind) : value,
      ];
    })
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

/** The platform's rich-text sanitiser allowlist (`rich-text.ts`). */
const RICH_TEXT_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "a",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "code",
  "pre",
  "hr",
  "img",
  "figure",
  "figcaption",
]);

const RICH_TEXT_ATTRIBUTES = new Set([
  "href",
  "target",
  "rel",
  "src",
  "alt",
  "width",
  "height",
  "title",
]);

/** Tags the sanitiser drops with their content; any other is unwrapped. */
const RICH_TEXT_DROPPED = new Set([
  "script",
  "style",
  "textarea",
  "option",
  "noscript",
]);

const keepStoredMarkup = (parent: Node) => {
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === node.COMMENT_NODE) {
      node.remove();
      continue;
    }
    if (node.nodeType !== node.ELEMENT_NODE) {
      continue;
    }
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if (RICH_TEXT_DROPPED.has(tag)) {
      element.remove();
      continue;
    }
    keepStoredMarkup(element);
    if (RICH_TEXT_TAGS.has(tag) === false) {
      element.replaceWith(...element.childNodes);
      continue;
    }
    // a link that opens a new tab without a rel gets the platform's rel
    if (
      tag === "a" &&
      (element.getAttribute("target") ?? "").toLowerCase() === "_blank" &&
      (element.getAttribute("rel") ?? "") === ""
    ) {
      element.setAttribute("rel", "noopener noreferrer");
    }
    for (const { name, value } of [...element.attributes]) {
      if (
        RICH_TEXT_ATTRIBUTES.has(name) === false ||
        // the platform drops an empty attribute, an empty alt aside
        (value === "" && name !== "alt")
      ) {
        element.removeAttribute(name);
      }
    }
  }
};

/**
 * Rich-text HTML as the platform keeps it, for comparison only: parsed
 * inertly, spans and other tags outside the allowlist unwrapped, attributes
 * outside it and empty ones dropped, a new-tab link's missing rel added, then
 * serialised. Without a DOM parser, the HTML as it
 * is.
 */
const toStoredRichTextHtml = (html: string) => {
  if (typeof DOMParser === "undefined") {
    return html;
  }
  const { body } = new DOMParser().parseFromString(html, "text/html");
  keepStoredMarkup(body);
  return body.innerHTML;
};

/** The kinds the platform trims, storing blank as null (`trimOrNull`). */
const trimmedKinds: readonly CmsFieldKind[] = [
  "text",
  "textarea",
  "phone",
  "link",
  "email",
  "date",
  "datetime",
  "option",
  "reference",
];

const trimOrNull = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/**
 * A value in the form the platform stores it (`validation.ts`), for
 * comparison only: string kinds trimmed, colours upper-cased, an image's url
 * and alt trimmed, rich text as its kept HTML or null.
 */
export const toStoredForm = (kind: CmsFieldKind, value: unknown): unknown => {
  if (trimmedKinds.includes(kind)) {
    return trimOrNull(value);
  }
  if (kind === "color") {
    const trimmed = trimOrNull(value);
    return typeof trimmed === "string" ? trimmed.toUpperCase() : trimmed;
  }
  if (kind === "richtext") {
    const html = richTextHtmlOrNull(value);
    return html === null ? null : toStoredRichTextHtml(html);
  }
  if (kind === "image" && typeof value === "object" && value !== null) {
    const image = value as Record<string, unknown>;
    return {
      ...image,
      url: trimOrNull(image.url),
      alt: typeof image.alt === "string" ? image.alt.trim() : image.alt,
    };
  }
  return value;
};

/** Whether two values of a kind are stored alike. */
export const isSameStoredValue = (
  kind: CmsFieldKind,
  left: unknown,
  right: unknown
) => isSameValue(toStoredForm(kind, left), toStoredForm(kind, right));

/** A field's value; a key the data lacks reads as the field's empty value. */
const valueOf = (data: CmsItemData, field: CmsField) =>
  field.key in data ? data[field.key] : emptyValueFor(field.kind);

/** The keys, in schema order, whose value differs from the baseline. */
export const getChangedFieldKeys = (
  fields: readonly CmsField[],
  baseline: CmsItemData,
  values: CmsItemData
) =>
  fields
    .filter(
      (field) =>
        isSameValue(valueOf(baseline, field), valueOf(values, field)) === false
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

/**
 * Whether the values or the address differ from a stored item, each value
 * compared in the platform's stored form: what a write of them would change.
 */
export const differsFromStored = ({
  fields,
  stored,
  values,
  storedSlug,
  slug,
}: {
  fields: readonly CmsField[];
  stored: CmsItemData;
  values: CmsItemData;
  storedSlug: string;
  slug: string;
}) =>
  slug !== storedSlug ||
  fields.some(
    (field) =>
      isSameStoredValue(
        field.kind,
        valueOf(stored, field),
        valueOf(values, field)
      ) === false
  );

/**
 * The person's values, set aside by Reload (4.3.2): only the fields they
 * changed, and the address when they changed it. A field or an address
 * absent here has nothing kept.
 */
export type CmsKeptValues = { values: CmsItemData; slug: string | undefined };

/**
 * What Reload sets aside: each field whose value differs from the baseline
 * it was edited from, and the address when it differs from its baseline. For
 * a field untouched since an earlier Reload, that Reload's kept value stays,
 * so a second Reload never drops an edit still waiting for "Use my edit".
 */
export const keepAside = ({
  fields,
  kept,
  baseline,
  baselineSlug,
  values,
  slug,
}: {
  fields: readonly CmsField[];
  kept: CmsKeptValues | undefined;
  baseline: CmsItemData;
  baselineSlug: string;
  values: CmsItemData;
  slug: string;
}): CmsKeptValues => {
  const next: CmsItemData = {};
  for (const field of fields) {
    if (
      isSameStoredValue(
        field.kind,
        valueOf(values, field),
        valueOf(baseline, field)
      ) === false
    ) {
      next[field.key] = structuredClone(valueOf(values, field));
    } else if (kept !== undefined && field.key in kept.values) {
      next[field.key] = structuredClone(kept.values[field.key]);
    }
  }
  return {
    values: next,
    slug: slug === baselineSlug ? kept?.slug : slug,
  };
};

/** The keys, address included as `slug`, whose kept value differs. */
export const getKeptDifferences = ({
  fields,
  kept,
  values,
  slug,
}: {
  fields: readonly CmsField[];
  kept: CmsKeptValues | undefined;
  values: CmsItemData;
  slug: string;
}) => {
  if (kept === undefined) {
    return [];
  }
  const keys = fields
    .filter(
      (field) =>
        field.key in kept.values &&
        isSameStoredValue(
          field.kind,
          kept.values[field.key],
          values[field.key]
        ) === false
    )
    .map((field) => field.key);
  return kept.slug === undefined || kept.slug === slug
    ? keys
    : [...keys, "slug"];
};

/** Splits E5's `ids` into calls of at most `size`. */
export const chunk = <Value>(values: readonly Value[], size: number) => {
  const chunks: Value[][] = [];
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size));
  }
  return chunks;
};

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

/** The kinds whose `maxLength` the platform applies (`validation.ts`). */
const maxLengthKinds: readonly CmsFieldKind[] = ["text", "textarea", "phone"];

export const appliesMaxLength = (kind: CmsFieldKind) =>
  maxLengthKinds.includes(kind);

const isBlank = (kind: CmsFieldKind, value: unknown) => {
  if (kind === "multireference") {
    return Array.isArray(value) === false || value.length === 0;
  }
  if (kind === "richtext") {
    return richTextHtmlOrNull(value) === null;
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

/** The platform's link rule: any value a URL parse takes. */
const isUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

/** The first check a string value fails, in two or three words. */
const checkText = (field: CmsField, value: string) => {
  const trimmed = value.trim();
  if (field.kind === "email" && EMAIL_RE.test(trimmed) === false) {
    return "Not an email";
  }
  if (field.kind === "link" && isUrl(trimmed) === false) {
    return "Not a link";
  }
  if (field.kind === "color" && COLOR_RE.test(trimmed) === false) {
    return "Not a color";
  }
  if (
    appliesMaxLength(field.kind) &&
    field.maxLength !== undefined &&
    field.maxLength > 0 &&
    trimmed.length > field.maxLength
  ) {
    return "Too long";
  }
};

/**
 * Client-side checks, in two or three words a field (4.3.2). The platform
 * checks again; its `invalid` with a `field` key marks that field. An
 * existing item's address is required; a new item's empty address is
 * derived by the platform.
 */
export const validateItem = ({
  fields,
  values,
  slug,
  isNew,
}: {
  fields: readonly CmsField[];
  values: CmsItemData;
  slug: string;
  isNew: boolean;
}) => {
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
      const error = checkText(field, value);
      if (error !== undefined) {
        errors[field.key] = error;
      }
    }
  }
  if (slug === "") {
    if (isNew === false) {
      errors.slug = "Required";
    }
  } else if (isSlug(slug) === false) {
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
    case "refused":
      return "Try again in a minute";
    case "limit":
      return "Item limit reached";
    case "not_found":
    case "reference_invalid":
      return "Item not found";
    case "forbidden":
      return "No access";
    case "plan":
      return planBadgeLabel;
    default:
      return "Not saved";
  }
};

export type CmsRefusal = "unauthorized" | "mfa_required" | "forbidden" | "plan";

/**
 * The codes that replace the view with one line (4.3.4): `unauthorized` and
 * `mfa_required` on any call; `forbidden` and `plan` on a load only. A write
 * answered `forbidden` or `plan` is a toast, and the view stays.
 */
export const getRefusal = (
  code: CmsErrorCode,
  on: "load" | "write"
): CmsRefusal | undefined => {
  if (code === "unauthorized" || code === "mfa_required") {
    return code;
  }
  if ((code === "forbidden" || code === "plan") && on === "load") {
    return code;
  }
  return undefined;
};

/**
 * What Classic CMS opens on (4.6): the open collection, and the open item
 * when it is saved; nothing without a collection.
 */
export const getClassicDeepLink = (
  collection: Pick<CmsCollectionSummary, "slug"> | undefined,
  itemId: string | null | undefined
): CmsDeepLink => {
  if (collection === undefined) {
    return {};
  }
  if (itemId === null || itemId === undefined) {
    return { collection: collection.slug };
  }
  return { collection: collection.slug, item: itemId };
};
