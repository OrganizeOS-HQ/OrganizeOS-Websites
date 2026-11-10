/**
 * The native CMS screen's data seam (OrganizeOS design
 * docs/superpowers/specs/2026-11-07-native-cms-in-the-builder-design.md,
 * 5.4 and 5.7).
 *
 * One method per door endpoint, returning exactly what the endpoint returns:
 * the success body, or `{ error: code, field? }`. W2's implementation calls
 * the builder routes under `/rest/organizeos-cms/{projectId}/...`; the
 * storybook preview uses the in-memory `createSampleCmsSource`.
 */

/** Every field kind a collection schema may use (`client/lib/collections`). */
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

/** 5.7 */
export const cmsErrorCodes = [
  "invalid",
  "unauthorized",
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
  /** E5 `GET /collections/{collectionId}/items/search`: `q`, `ids`, or both. */
  searchItems: (
    collectionId: string,
    query: { q?: string; ids?: string[] }
  ) => Promise<CmsResult<{ items: CmsSearchResult[] }>>;
  /** E6 `POST /collections/{collectionId}/items` */
  createItem: (
    collectionId: string,
    body: { slug?: string; data: CmsItemData }
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
  /** E9 `POST /uploads/image`: JPEG, PNG, GIF or WebP, at most 4 MB. */
  uploadImage: (
    file: File
  ) => Promise<CmsResult<{ url: string; path: string }>>;
};

/**
 * The builder's side of a collection row (4.5): what the build's catalog
 * says about it. Not from the platform: W2 derives it from `useCatalog`,
 * `findStaleItemPages` and the sitemap lookup, keyed by collection slug.
 */
export type CmsCatalogRow = {
  hasItemPage: boolean;
  isStale: boolean;
  isSitemapOrphan: boolean;
};

export type CmsCatalogOrphan = {
  name: string;
  isStale: boolean;
  sitemapSlug?: string;
};

export type CmsCatalogView = {
  /** Design mode, the deny list allows, and the plan allows dynamic data. */
  actionsEnabled: boolean;
  /** By collection slug. A private collection has no row, so no menu. */
  rows: Record<string, CmsCatalogRow>;
  orphans: CmsCatalogOrphan[];
};

/** The collection actions of 4.5; W2 binds them to the existing handlers. */
export type CmsCollectionActions = {
  onCreateItemPage?: (slug: string) => void;
  onOpenItemPage?: (slug: string) => void;
  onAddList?: (slug: string) => void;
  onRemoveFromSitemap?: (slug: string) => void;
};
