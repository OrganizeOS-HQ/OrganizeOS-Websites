import { z } from "zod";

/**
 * OrganizeOS fork: the native CMS screen's door to OrganizeOS
 * (docs/ORGANIZEOS-FORK.md section 5, "The CMS door").
 *
 * The route's steps, in order, each refusing before any later work
 * (spec 5.3 of the platform's native CMS design):
 *
 * 7. The request's path must match one of a fixed list of endpoints, E0 to
 *    E9, with the platform's base path removed; anything else is 404. The
 *    path is matched segment by segment: fixed words exactly, ids as
 *    lower-case UUIDs, so a dot segment, an encoded segment, an empty
 *    segment or a trailing slash matches nothing. The query is parsed with
 *    the endpoint's strict schema: an unknown or repeated key matches
 *    nothing, `q` is 1 to 200 characters, `page` is its canonical decimal
 *    from 1 to 10,000, and `ids` is 1 to 100 lower-case UUIDs joined by
 *    `,`. The outgoing path is rebuilt from the endpoint's pattern and the
 *    parsed ids, and the query from the parsed values, its keys sorted; the
 *    request's own path and query are never forwarded.
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
  | "E9";

export type CmsPathMatch = {
  endpoint: CmsEndpoint;
  method: "GET" | "POST" | "PUT";
  /** Rebuilt from the pattern and the parsed ids, no leading slash. */
  path: string;
  /** Rebuilt from the parsed values, sorted by key. */
  query: Array<[string, string]>;
  body: "none" | "json" | "multipart";
};

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
  })
  .strict();

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

type QuerySchema = z.ZodType<Record<string, string | string[] | undefined>>;

type Pattern = {
  endpoint: CmsEndpoint;
  method: CmsPathMatch["method"];
  /** Fixed words, or `{c}` and `{i}` for a collection's and an item's id. */
  segments: string[];
  query: QuerySchema;
  body: CmsPathMatch["body"];
};

const patterns: Pattern[] = [
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
    endpoint: "E9",
    method: "POST",
    segments: ["uploads", "image"],
    query: noQuery,
    body: "multipart",
  },
];

const isIdSegment = (segment: string) => segment === "{c}" || segment === "{i}";

/** The rebuilt segments, or undefined when the splat does not fit. */
const matchSegments = (
  pattern: string[],
  splat: string[]
): string[] | undefined => {
  if (pattern.length !== splat.length) {
    return;
  }
  const rebuilt: string[] = [];
  for (let index = 0; index < pattern.length; index += 1) {
    const expected = pattern[index];
    const actual = splat[index];
    if (isIdSegment(expected)) {
      if (UUID_PATTERN.test(actual) === false) {
        return;
      }
    } else if (actual !== expected) {
      return;
    }
    rebuilt.push(actual);
  }
  return rebuilt;
};

const readQuery = (
  search: URLSearchParams
): Record<string, string> | undefined => {
  const pairs = [...search];
  const query: Record<string, string> = {};
  for (const [key, value] of pairs) {
    if (Object.hasOwn(query, key)) {
      return;
    }
    query[key] = value;
  }
  return query;
};

const rebuildQuery = (
  parsed: Record<string, string | string[] | undefined>
): Array<[string, string]> =>
  Object.entries(parsed)
    .flatMap(([key, value]): Array<[string, string]> => {
      if (value === undefined) {
        return [];
      }
      return [[key, Array.isArray(value) ? value.join(",") : value]];
    })
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

export const matchCmsPath = (
  method: string,
  splat: string,
  search: URLSearchParams
): CmsPathMatch | undefined => {
  const segments = splat.split("/");
  const query = readQuery(search);
  if (query === undefined) {
    return;
  }
  for (const pattern of patterns) {
    if (pattern.method !== method) {
      continue;
    }
    const rebuilt = matchSegments(pattern.segments, segments);
    if (rebuilt === undefined) {
      continue;
    }
    const parsed = pattern.query.safeParse(query);
    if (parsed.success === false) {
      return;
    }
    return {
      endpoint: pattern.endpoint,
      method: pattern.method,
      path: rebuilt.join("/"),
      query: rebuildQuery(parsed.data),
      body: pattern.body,
    };
  }
};
