import { z } from "zod";
import {
  type DoorConfig,
  type DoorErrorCode,
  type DoorPattern,
  type DoorRouteDeps,
  handleDoorRequest,
  matchDoorPath,
} from "~/services/organizeos-door-route.server";
import { CMS_PLATFORM_BASE_PATH } from "~/shared/organizeos-cms.server";

/**
 * OrganizeOS fork: the native CMS screen's door to OrganizeOS
 * (docs/ORGANIZEOS-FORK.md section 5, "The CMS door"). Its steps are the
 * builder door's (organizeos-door-route.server.ts); this is its config: the
 * `cms` audience, the platform's CMS base path, the endpoints E0 to E13, a
 * write's JSON body of at most 2 MB and an upload (E9) of one file of at most
 * 4 MB in a body of at most 4 MB plus 64 KB, sent with a 30 second timeout.
 * The query schemas: `q` is 1 to 200 characters, `page` is its canonical
 * decimal from 1 to 10,000, and `ids` is 1 to 100 lower-case UUIDs joined by
 * `,`.
 */

export type CmsEndpoint =
  | "E0"
  | "E1"
  | "E2"
  | "E3"
  | "E4"
  | "E5"
  | "E6"
  | "E7"
  | "E8a"
  | "E8b"
  | "E10"
  | "E11"
  | "E12"
  | "E13"
  | "E9"
  | "E20"
  | "E21"
  | "E22"
  | "E23"
  | "E24"
  | "E25";

export type CmsPathMatch = {
  endpoint: CmsEndpoint;
  method: "GET" | "POST" | "PUT";
  /** Rebuilt from the pattern and the parsed ids, no leading slash. */
  path: string;
  /** Rebuilt from the parsed values, sorted by key. */
  query: Array<[string, string]>;
  body: "none" | "json" | "multipart";
};

/** A write's JSON body: 2 MB (1 MB is 1,048,576 bytes, as /api/uploads counts it). */
export const CMS_JSON_BODY_MAX_BYTES = 2_097_152;
/** An upload's whole multipart body: 4 MB plus 64 KB. */
export const CMS_UPLOAD_BODY_MAX_BYTES = 4_259_840;
/** An upload's one file: 4 MB. */
export const CMS_UPLOAD_FILE_MAX_BYTES = 4_194_304;

const UPLOAD_TIMEOUT_MS = 30_000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const MAX_PAGE = 10_000;
const MAX_IDS = 100;

const searchText = z.string().min(1).max(200);

const noQuery = z.object({}).strict();

const itemsQuery = z
  .object({
    q: searchText.optional(),
    page: z
      .string()
      .regex(/^[1-9][0-9]{0,4}$/)
      .refine((page) => Number(page) <= MAX_PAGE)
      .optional(),
    status: z
      .enum(["all", "draft", "published", "archived", "staged"])
      .optional(),
    sort: z
      .string()
      .regex(/^(order|updated|name|status|field:[a-zA-Z][a-zA-Z0-9]{0,39})$/)
      .optional(),
    direction: z.enum(["asc", "desc"]).optional(),
    optionKey: z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/)
      .optional(),
    optionValue: z.string().min(1).max(80).optional(),
  })
  .strict()
  // An option filter names both its field and its value, or neither.
  .refine(
    (query) =>
      (query.optionKey === undefined) === (query.optionValue === undefined)
  );

const searchQuery = z
  .object({
    q: searchText.optional(),
    ids: z
      .string()
      .transform((joined) => joined.split(","))
      .pipe(z.array(z.string().regex(UUID_PATTERN)).min(1).max(MAX_IDS))
      .optional(),
  })
  .strict()
  .refine((query) => query.q !== undefined || query.ids !== undefined);

const patterns: DoorPattern<CmsEndpoint>[] = [
  {
    endpoint: "E0",
    method: "GET",
    segments: ["access"],
    query: noQuery,
    body: "none",
  },
  {
    endpoint: "E1",
    method: "GET",
    segments: ["collections"],
    query: noQuery,
    body: "none",
  },
  {
    endpoint: "E2",
    method: "GET",
    segments: ["collections", "{c}"],
    query: noQuery,
    body: "none",
  },
  {
    endpoint: "E3",
    method: "GET",
    segments: ["collections", "{c}", "items"],
    query: itemsQuery,
    body: "none",
  },
  {
    endpoint: "E4",
    method: "GET",
    segments: ["collections", "{c}", "items", "{i}"],
    query: noQuery,
    body: "none",
  },
  {
    endpoint: "E5",
    method: "GET",
    segments: ["collections", "{c}", "items", "search"],
    query: searchQuery,
    body: "none",
  },
  {
    endpoint: "E6",
    method: "POST",
    segments: ["collections", "{c}", "items"],
    query: noQuery,
    body: "json",
  },
  {
    endpoint: "E7",
    method: "PUT",
    segments: ["collections", "{c}", "items", "{i}"],
    query: noQuery,
    body: "json",
  },
  {
    endpoint: "E8a",
    method: "POST",
    segments: ["collections", "{c}", "items", "{i}", "publish"],
    query: noQuery,
    body: "json",
  },
  {
    endpoint: "E8b",
    method: "POST",
    segments: ["collections", "{c}", "items", "{i}", "discard"],
    query: noQuery,
    body: "json",
  },
  {
    endpoint: "E10",
    method: "POST",
    segments: ["collections", "{c}", "items", "publish"],
    query: noQuery,
    body: "json",
  },
  {
    endpoint: "E11",
    method: "POST",
    segments: ["collections", "{c}", "items", "status"],
    query: noQuery,
    body: "json",
  },
  {
    endpoint: "E12",
    method: "POST",
    segments: ["collections", "{c}", "items", "delete"],
    query: noQuery,
    body: "json",
  },
  {
    endpoint: "E13",
    method: "POST",
    segments: ["collections", "{c}", "items", "order"],
    query: noQuery,
    body: "json",
  },
  {
    endpoint: "E9",
    method: "POST",
    segments: ["uploads", "image"],
    query: noQuery,
    body: "multipart",
  },
  {
    endpoint: "E20",
    method: "GET",
    segments: ["structure"],
    query: noQuery,
    body: "none",
  },
  {
    endpoint: "E21",
    method: "GET",
    segments: ["collections", "{c}", "structure"],
    query: noQuery,
    body: "none",
  },
  {
    endpoint: "E22",
    method: "POST",
    segments: ["collections"],
    query: noQuery,
    body: "json",
  },
  {
    endpoint: "E23",
    method: "PUT",
    segments: ["collections", "{c}"],
    query: noQuery,
    body: "json",
  },
  {
    endpoint: "E24",
    method: "PUT",
    segments: ["collections", "{c}", "schema"],
    query: noQuery,
    body: "json",
  },
  {
    endpoint: "E25",
    method: "POST",
    segments: ["collections", "{c}", "delete"],
    query: noQuery,
    body: "json",
  },
];

export const matchCmsPath = (
  method: string,
  splat: string,
  search: URLSearchParams
): CmsPathMatch | undefined => {
  const match = matchDoorPath(patterns, method, splat, search);
  if (match === undefined) {
    return;
  }
  // The timeout is the door's business, not the match's.
  const { timeoutMs: _timeoutMs, ...rest } = match;
  return rest;
};

export type CmsRouteDeps = DoorRouteDeps;

export type CmsDoorErrorCode = DoorErrorCode;

export const cmsDoor: DoorConfig = {
  audience: "cms",
  basePath: CMS_PLATFORM_BASE_PATH,
  // An upload (E9) waits 30 seconds; every other call the door's 15. Kept
  // here rather than on E9's entry, so the endpoint list reads as upstream's
  // CMS door branches write it.
  patterns: patterns.map((pattern) =>
    pattern.endpoint === "E9"
      ? { ...pattern, timeoutMs: UPLOAD_TIMEOUT_MS }
      : pattern
  ),
  jsonBodyMaxBytes: CMS_JSON_BODY_MAX_BYTES,
  upload: {
    bodyMaxBytes: CMS_UPLOAD_BODY_MAX_BYTES,
    fileMaxBytes: CMS_UPLOAD_FILE_MAX_BYTES,
  },
  logTag: "cms",
  enabled: true,
};

export const handleCmsRequest = (
  request: Request,
  projectId: string | undefined,
  splat: string | undefined,
  deps: CmsRouteDeps
): Promise<Response> =>
  handleDoorRequest(request, projectId, splat, deps, cmsDoor);
