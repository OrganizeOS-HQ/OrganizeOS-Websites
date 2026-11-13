import { z } from "zod";
import { fetch } from "~/shared/fetch.client";
import {
  cmsErrorCodes,
  cmsFieldKinds,
  type CmsAccess,
  type CmsCollection,
  type CmsCollectionSummary,
  type CmsFailure,
  type CmsItem,
  type CmsItemsPage,
  type CmsResult,
  type CmsSearchResult,
  type CmsSource,
} from "./cms-source";

/**
 * The native CMS screen's calls to the door (fork doc section 5, "The CMS
 * door"), through the builder's `rest.organizeos-cms` route with the page's
 * CSRF token. Never throws: every answer is the endpoint's success body or
 * `{ error: code, field? }`, and anything it cannot read, a client timeout
 * included, is `unavailable`. E6's success adds `created`, true on a 201
 * and false on a 200, a replay.
 */

export const CMS_REQUEST_TIMEOUT_MS = 20_000;
export const CMS_UPLOAD_TIMEOUT_MS = 35_000;

/** The door refuses a longer `q` (E3, E5). */
export const CMS_SEARCH_MAX_LENGTH = 200;

/**
 * A search term as the door takes it: trimmed, left out when empty, and cut
 * to its first 200 UTF-16 units without leaving half a surrogate pair.
 */
export const cmsSearchTerm = (q: string | undefined): string | undefined => {
  const term = q?.trim();
  if (term === undefined || term === "") {
    return;
  }
  if (term.length <= CMS_SEARCH_MAX_LENGTH) {
    return term;
  }
  const cut = term.slice(0, CMS_SEARCH_MAX_LENGTH);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
};

/**
 * The builder route for one door path, with the query's defined, non-empty
 * values in the record's key order.
 */
export const cmsDoorPath = (
  projectId: string,
  path: string,
  query?: Record<string, string | undefined>
): string => {
  const route = `/rest/organizeos-cms/${encodeURIComponent(projectId)}/${path}`;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") {
      search.append(key, value);
    }
  }
  const serialized = search.toString();
  return serialized === "" ? route : `${route}?${serialized}`;
};

const statusSchema = z.enum(["draft", "published", "archived"]);

const accessSchema: z.ZodType<CmsAccess> = z.object({
  canEdit: z.boolean(),
  canPublish: z.boolean(),
  canManageSettings: z.boolean(),
});

const collectionSummarySchema: z.ZodType<CmsCollectionSummary> = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  singularName: z.string(),
  isPublic: z.boolean(),
  total: z.number(),
});

const fieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(cmsFieldKinds),
  required: z.boolean().optional(),
  help: z.string().optional(),
  isTitle: z.boolean().optional(),
  options: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .optional(),
  reference: z
    .object({ collectionId: z.string(), multiple: z.boolean() })
    .optional(),
  maxLength: z.number().optional(),
});

const collectionSchema: z.ZodType<CmsCollection> = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  singularName: z.string(),
  isPublic: z.boolean(),
  fields: z.array(fieldSchema),
});

const itemsPageSchema: z.ZodType<CmsItemsPage> = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      status: statusSchema,
      hasStagedChanges: z.boolean(),
      updatedAt: z.string(),
    })
  ),
  total: z.number(),
  page: z.number(),
});

const itemSchema: z.ZodType<CmsItem> = z.object({
  id: z.string(),
  slug: z.string(),
  status: statusSchema,
  hasStagedChanges: z.boolean(),
  data: z.record(z.string(), z.unknown()),
  updatedAt: z.string(),
  createdAt: z.string(),
  publishedAt: z.string().nullable(),
});

const searchResultSchema: z.ZodType<CmsSearchResult> = z.object({
  id: z.string(),
  title: z.string(),
  status: statusSchema,
});

const collectionsAnswer = z.object({
  collections: z.array(collectionSummarySchema),
});
const collectionAnswer = z.object({ collection: collectionSchema });
const itemAnswer = z.object({ item: itemSchema });
const searchAnswer = z.object({ items: z.array(searchResultSchema) });
const uploadAnswer = z.object({ url: z.string(), path: z.string() });

const failureSchema: z.ZodType<CmsFailure> = z.object({
  error: z.enum(cmsErrorCodes),
  field: z.string().max(64).optional(),
});

const unavailable: CmsFailure = { error: "unavailable" };

type Send =
  | { method: "GET" }
  | { method: "POST" | "PUT"; json: unknown }
  | { method: "POST"; form: FormData };

export const request = async <Value, Answer = Value>(
  path: string,
  schema: z.ZodType<Value>,
  send: Send,
  read: (value: Value, status: number) => Answer = (value) =>
    value as unknown as Answer
): Promise<CmsResult<Answer>> => {
  try {
    const init: RequestInit = {
      method: send.method,
      signal: AbortSignal.timeout(
        "form" in send ? CMS_UPLOAD_TIMEOUT_MS : CMS_REQUEST_TIMEOUT_MS
      ),
    };
    if ("json" in send) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(send.json);
    }
    if ("form" in send) {
      init.body = send.form;
    }
    const response = await fetch(path, init);
    const body: unknown = await response.json();
    if (response.ok) {
      const parsed = schema.safeParse(body);
      return parsed.success ? read(parsed.data, response.status) : unavailable;
    }
    const failure = failureSchema.safeParse(body);
    return failure.success ? failure.data : unavailable;
  } catch {
    return unavailable;
  }
};

export const createCmsApi = (projectId: string): CmsSource => {
  const path = (rest: string, query?: Record<string, string | undefined>) =>
    cmsDoorPath(projectId, rest, query);
  const collection = (c: string) => `collections/${encodeURIComponent(c)}`;
  const item = (c: string, i: string) =>
    `${collection(c)}/items/${encodeURIComponent(i)}`;

  return {
    getAccess: () => request(path("access"), accessSchema, { method: "GET" }),
    listCollections: () =>
      request(path("collections"), collectionsAnswer, { method: "GET" }),
    getCollection: (c) =>
      request(path(collection(c)), collectionAnswer, { method: "GET" }),
    listItems: (c, { q, page }) =>
      request(
        path(`${collection(c)}/items`, {
          q: cmsSearchTerm(q),
          page: page === undefined ? undefined : String(page),
        }),
        itemsPageSchema,
        { method: "GET" }
      ),
    getItem: (c, i) => request(path(item(c, i)), itemAnswer, { method: "GET" }),
    searchItems: async (c, { q, ids }) => {
      const term = cmsSearchTerm(q);
      const joined =
        ids !== undefined && ids.length > 0 ? ids.join(",") : undefined;
      if (term === undefined && joined === undefined) {
        return { items: [] };
      }
      return request(
        path(`${collection(c)}/items/search`, { q: term, ids: joined }),
        searchAnswer,
        { method: "GET" }
      );
    },
    // E6 answers 201 when it created the item, 200 when it replayed one
    createItem: (c, body) =>
      request(
        path(`${collection(c)}/items`),
        itemAnswer,
        { method: "POST", json: body },
        ({ item }, status) => ({ item, created: status === 201 })
      ),
    updateItem: (c, i, body) =>
      request(path(item(c, i)), itemAnswer, { method: "PUT", json: body }),
    publishItem: (c, i, body) =>
      request(path(`${item(c, i)}/publish`), itemAnswer, {
        method: "POST",
        json: body,
      }),
    discardItemChanges: (c, i, body) =>
      request(path(`${item(c, i)}/discard`), itemAnswer, {
        method: "POST",
        json: body,
      }),
    uploadImage: (file) => {
      const form = new FormData();
      form.append("file", file);
      return request(path("uploads/image"), uploadAnswer, {
        method: "POST",
        form,
      });
    },
  };
};
