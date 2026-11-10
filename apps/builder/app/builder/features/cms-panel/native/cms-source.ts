/**
 * The native CMS screen's data seam (OrganizeOS design
 * docs/superpowers/specs/2026-11-07-native-cms-in-the-builder-design.md,
 * 5.4 and 5.7).
 *
 * One method per door endpoint, returning exactly what the endpoint returns:
 * the success body, or `{ error: code, field? }`. `createCmsApi`
 * (`cms-api.ts`) calls the builder routes under
 * `/rest/organizeos-cms/{projectId}/...`; the storybook preview uses the
 * in-memory `createSampleCmsSource`.
 */

/** Every canonical field kind, in `FIELD_KINDS`' order (`client/lib/collections/field-kinds.ts`). */
export const cmsFieldKinds = [
  "text",
  "textarea",
  "richtext",
  "image",
  "link",
  "email",
  "phone",
  "number",
  "date",
  "datetime",
  "switch",
  "color",
  "option",
  "reference",
  "multireference",
] as const;

export type CmsFieldKind = (typeof cmsFieldKinds)[number];

export type CmsFieldOption = { value: string; label: string };

/** E2 sends every kind canonical (`url` is `link`, `boolean` is `switch`). */
export type CmsField = {
  /** Immutable once created. */
  key: string;
  label: string;
  kind: CmsFieldKind;
  required?: boolean;
  /** Org-authored; shown in the label's tooltip, never under the field. */
  help?: string;
  /** Exactly one per schema, of kind text: the item's name. */
  isTitle?: boolean;
  /** Required for `option`. */
  options?: CmsFieldOption[];
  /** Required for `reference` and `multireference`. */
  reference?: { collectionId: string; multiple: boolean };
  maxLength?: number;
};

export type CmsItemStatus = "draft" | "published" | "archived";

/** Stored shape of an `image` field. A Lite-era row holds a bare URL. */
export type CmsImageValue = {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  path?: string;
};

/** E9's types and cap. */
export const CMS_IMAGE_TYPES: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};
export const CMS_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** Stored shape of a `richtext` field: sanitised HTML and its plain text. */
export type CmsRichTextValue = { html: string; text: string };

export type CmsItemData = Record<string, unknown>;

/** E0 */
export type CmsAccess = {
  canEdit: boolean;
  canPublish: boolean;
  canManageSettings: boolean;
};

/** E1, one row */
export type CmsCollectionSummary = {
  id: string;
  slug: string;
  name: string;
  singularName: string;
  isPublic: boolean;
  total: number;
};

/** E2 */
export type CmsCollection = Omit<CmsCollectionSummary, "total"> & {
  fields: CmsField[];
};

/** E3, one row */
export type CmsItemRow = {
  id: string;
  slug: string;
  title: string;
  status: CmsItemStatus;
  hasStagedChanges: boolean;
  /** The raw PostgREST string: the edit lock. Never parsed for writes. */
  updatedAt: string;
};

/** E3 */
export type CmsItemsPage = {
  items: CmsItemRow[];
  total: number;
  page: number;
};

/** E4 */
export type CmsItem = {
  id: string;
  slug: string;
  status: CmsItemStatus;
  hasStagedChanges: boolean;
  data: CmsItemData;
  updatedAt: string;
  createdAt: string;
  publishedAt: string | null;
};

/** E5, one row */
export type CmsSearchResult = {
  id: string;
  title: string;
  status: CmsItemStatus;
};

/** E5 takes at most this many `ids` a call. */
export const CMS_SEARCH_IDS_MAX = 100;

/** 5.7: the keys of the platform's `CMS_ERROR_STATUS`. */
export const cmsErrorCodes = [
  "invalid",
  "unauthorized",
  "refused",
  "forbidden",
  "plan",
  "mfa_required",
  "limit",
  "not_found",
  "conflict",
  "slug_taken",
  "replayed",
  "reference_invalid",
  "rate_limited",
  "unavailable",
  "updating",
] as const;

export type CmsErrorCode = (typeof cmsErrorCodes)[number];

export type CmsFailure = { error: CmsErrorCode; field?: string };

export type CmsResult<Value> = Value | CmsFailure;

export const isCmsFailure = <Value>(
  result: CmsResult<Value>
): result is CmsFailure =>
  typeof result === "object" &&
  result !== null &&
  "error" in result &&
  typeof (result as CmsFailure).error === "string";

/** 50 rows a page (E3). */
export const CMS_PAGE_SIZE = 50;

export type CmsSource = {
  /** E0 `GET /access` */
  getAccess: () => Promise<CmsResult<CmsAccess>>;
  /** E1 `GET /collections` */
  listCollections: () => Promise<
    CmsResult<{ collections: CmsCollectionSummary[] }>
  >;
  /** E2 `GET /collections/{collectionId}` */
  getCollection: (
    collectionId: string
  ) => Promise<CmsResult<{ collection: CmsCollection }>>;
  /** E3 `GET /collections/{collectionId}/items` */
  listItems: (
    collectionId: string,
    query: { q?: string; page?: number }
  ) => Promise<CmsResult<CmsItemsPage>>;
  /** E4 `GET /collections/{collectionId}/items/{itemId}` */
  getItem: (
    collectionId: string,
    itemId: string
  ) => Promise<CmsResult<{ item: CmsItem }>>;
  /**
   * E5 `GET /collections/{collectionId}/items/search`: `q`, `ids`, or both.
   * - `ids`: at most `CMS_SEARCH_IDS_MAX`; the screen asks in chunks.
   * - `q` is trimmed and cut to 200 UTF-16 units (`cmsSearchTerm`); a `q` of
   *   spaces only is left out. With neither, the answer is no items.
   */
  searchItems: (
    collectionId: string,
    query: { q?: string; ids?: string[] }
  ) => Promise<CmsResult<{ items: CmsSearchResult[] }>>;
  /**
   * E6 `POST /collections/{collectionId}/items`. `clientId` is minted once
   * when a new item's editor opens and sent with every attempt until one
   * succeeds: a repeat answers 200 with the item the first one made.
   */
  createItem: (
    collectionId: string,
    body: { clientId: string; slug?: string; data: CmsItemData }
  ) => Promise<CmsResult<{ item: CmsItem }>>;
  /** E7 `PUT /collections/{collectionId}/items/{itemId}` */
  updateItem: (
    collectionId: string,
    itemId: string,
    body: { slug?: string; data: CmsItemData; expectedUpdatedAt: string }
  ) => Promise<CmsResult<{ item: CmsItem }>>;
  /** E8a `POST /collections/{collectionId}/items/{itemId}/publish` */
  publishItem: (
    collectionId: string,
    itemId: string,
    body: { expectedUpdatedAt: string }
  ) => Promise<CmsResult<{ item: CmsItem }>>;
  /** E8b `POST /collections/{collectionId}/items/{itemId}/discard` */
  discardItemChanges: (
    collectionId: string,
    itemId: string,
    body: { expectedUpdatedAt: string }
  ) => Promise<CmsResult<{ item: CmsItem }>>;
  /** E9 `POST /uploads/image`: `CMS_IMAGE_TYPES`, at most 4 MB. */
  uploadImage: (
    file: File
  ) => Promise<CmsResult<{ url: string; path: string }>>;
};

/**
 * What the column itself draws from the build's catalog (4.5): the stale
 * line under a row. W2 derives it from `findStaleItemPages` and the stale
 * join, keyed by collection slug. The menus and the orphan rows are W2's
 * own components, passed in as render slots.
 */
export type CmsCatalogView = {
  /** Collections one of whose item pages reads an old address. */
  staleSlugs: readonly string[];
};
