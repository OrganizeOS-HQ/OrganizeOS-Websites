import { json } from "@remix-run/server-runtime";
import { z } from "zod";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import type { SessionData } from "~/services/auth.server.utils";
import type { OrganizeosBindingOutcome } from "~/services/auth-strategy/organizeos-session.server";
import { privateNoStoreResponseHeaders } from "~/services/cache-control.server";
import { preventCrossOriginCookie } from "~/services/no-cross-origin-cookie";
import { allowedDestinations } from "~/services/destinations.server";
import type { ProjectOrganization } from "~/shared/db/organizeos-project-org.server";
import {
  CMS_ACTOR_LIFETIME_SECONDS,
  CMS_PLATFORM_BASE_PATH,
  cmsCanonicalTarget,
  hashCmsBytes,
  mintCmsActorAssertion,
  readCmsActorIp,
  type CmsForwardAnswer,
  type CmsForwardRequest,
} from "~/shared/organizeos-cms.server";

/**
 * OrganizeOS fork: the native CMS screen's door to OrganizeOS
 * (docs/ORGANIZEOS-FORK.md section 5, "The CMS door").
 *
 * The route's steps, in order, each refusing before any later work
 * (spec 5.3 of the platform's native CMS design). Every refusal is
 * `{ error: code }`, `private, no-store`:
 *
 * 0. Any method but GET, POST and PUT is 405 `invalid`, with nothing read.
 * 1. A fetch only, same-origin, with the page's CSRF token: a cross-origin
 *    request, a document or iframe load and a bad token are each refused
 *    with 403. No project id is 404 `not_found`.
 * 2. A user signed in as a user: an anonymous request or no session is 401
 *    `unauthorized`; a share link's token, a service call or a session of
 *    another user is 403 `forbidden`.
 * 3. A `live` OrganizeOS binding carrying the OrganizeOS user and session:
 *    a failed binding check is 503 `unavailable`; `pass`, `missing`, `dead`
 *    or a binding without the user or the session is 401 `unauthorized`.
 * 4. The project's `view` permit for a GET, `edit` for a POST or a PUT, else
 *    403 `forbidden`.
 * 5. `WEBSITES2_CMS_SECRET` set and not blank, else 503 `unavailable`, with
 *    nothing minted.
 * 6. The org is the project owner's, never the request's, lower-cased: a
 *    failed owner read is 503 `unavailable`, a project no org owns 403
 *    `forbidden`.
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
 *    request's own path and query are never forwarded. The request's own
 *    path must also hold no encoded slash, backslash or dot and no
 *    backslash, and must end in the rebuilt path.
 * 8. A write's body is JSON; an upload's body is multipart. In this
 *    version no body is accepted: such a request is 400 `invalid`.
 * 9. The assertion is minted for the session's OrganizeOS user and session,
 *    the org, the method, the canonical target of the rebuilt path and
 *    query, the body bytes, a fresh `jti`, 60 seconds of life and the
 *    person's address, and sent once to OrganizeOS with a 15 second timeout
 *    (30 for an upload), never retried.
 * 10. A JSON answer is relayed as its status and exact bytes, `private,
 *    no-store`; a timeout, a failed send or any other answer is 502
 *    `unavailable`.
 * 11. A failure logs one code, never a value.
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
    // A repeated key, or a key no plain object can hold as its own, is no match.
    if (Object.hasOwn(query, key) || key === "__proto__") {
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

export type CmsRouteDeps = {
  checkCsrf: (request: Request) => Promise<void>;
  createContext: (request: Request) => Promise<AppContext>;
  readSession: (request: Request) => Promise<SessionData | null>;
  bindingOutcome: (session: SessionData) => Promise<OrganizeosBindingOutcome>;
  hasPermit: (
    projectId: string,
    permit: "view" | "edit",
    context: AppContext
  ) => Promise<boolean>;
  resolveOrganization: (
    projectId: string,
    context: AppContext
  ) => Promise<ProjectOrganization>;
  secret: string | undefined;
  /** Milliseconds. */
  now: () => number;
  /** The assertion's `jti`. */
  randomId: () => string;
  send: (request: CmsForwardRequest) => Promise<CmsForwardAnswer>;
};

export type CmsDoorErrorCode =
  | "invalid"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "unavailable";

type LogCode =
  | "binding_refused"
  | "binding_error"
  | "no_secret"
  | "owner_read_failed"
  | "timeout"
  | "forward_failed"
  | "bad_answer";

const log = (code: LogCode) => {
  console.error(`[organizeos-cms] ${code}`);
};

const refuse = (error: CmsDoorErrorCode, status: number) =>
  json({ error }, { status, headers: privateNoStoreResponseHeaders });

const REQUEST_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 30_000;

/** An encoded slash, backslash or dot. */
const ENCODED_SEPARATOR = /%(?:2f|5c|2e)/i;

type CmsBody = { bytes: Uint8Array; contentType?: string };

/** The bytes to forward, or undefined to refuse with 400. */
const readCmsBody = async (
  _request: Request,
  match: CmsPathMatch
): Promise<CmsBody | undefined> => {
  if (match.body === "none") {
    return { bytes: new Uint8Array() };
  }
  return;
};

export const handleCmsRequest = async (
  request: Request,
  projectId: string | undefined,
  splat: string | undefined,
  deps: CmsRouteDeps
): Promise<Response> => {
  const method = request.method;
  if (method !== "GET" && method !== "POST" && method !== "PUT") {
    return refuse("invalid", 405);
  }
  preventCrossOriginCookie(request);
  allowedDestinations(request, ["empty"]);
  await deps.checkCsrf(request);
  if (projectId === undefined) {
    return refuse("not_found", 404);
  }

  const context = await deps.createContext(request);
  if (context.authorization.type === "anonymous") {
    return refuse("unauthorized", 401);
  }
  if (context.authorization.type !== "user") {
    return refuse("forbidden", 403);
  }
  const session = await deps.readSession(request);
  if (session === null) {
    return refuse("unauthorized", 401);
  }
  if (session.userId !== context.authorization.userId) {
    return refuse("forbidden", 403);
  }

  const outcome = await deps.bindingOutcome(session);
  if (outcome === "error") {
    log("binding_error");
    return refuse("unavailable", 503);
  }
  const sub = session.organizeosUserId;
  const sid = session.organizeosSid;
  if (
    outcome !== "live" ||
    sub === undefined ||
    sub === "" ||
    sid === undefined ||
    sid === ""
  ) {
    log("binding_refused");
    return refuse("unauthorized", 401);
  }

  const permit = method === "GET" ? "view" : "edit";
  if ((await deps.hasPermit(projectId, permit, context)) === false) {
    return refuse("forbidden", 403);
  }

  const secret = deps.secret;
  if (secret === undefined || secret.trim() === "") {
    log("no_secret");
    return refuse("unavailable", 503);
  }

  const owner = await deps.resolveOrganization(projectId, context);
  if ("failed" in owner) {
    log("owner_read_failed");
    return refuse("unavailable", 503);
  }
  if ("none" in owner) {
    return refuse("forbidden", 403);
  }
  const org = owner.organizationId.toLowerCase();

  const url = new URL(request.url);
  if (ENCODED_SEPARATOR.test(url.pathname) || url.pathname.includes("\\")) {
    return refuse("not_found", 404);
  }
  const match = matchCmsPath(method, splat ?? "", url.searchParams);
  // The request's own path ends in the rebuilt one, so a path the URL parser
  // normalised (a dot segment, encoded or not) cannot stand for another.
  if (
    match === undefined ||
    url.pathname.endsWith(`/${match.path}`) === false
  ) {
    return refuse("not_found", 404);
  }

  const body = await readCmsBody(request, match);
  if (body === undefined) {
    return refuse("invalid", 400);
  }

  const target = cmsCanonicalTarget(
    `${CMS_PLATFORM_BASE_PATH}/${org}/${match.path}`,
    match.query
  );
  const iat = Math.floor(deps.now() / 1000);
  const header = mintCmsActorAssertion(
    {
      aud: "cms",
      org,
      sub,
      sid,
      m: match.method,
      p: hashCmsBytes(target),
      h: hashCmsBytes(body.bytes),
      jti: deps.randomId(),
      iat,
      exp: iat + CMS_ACTOR_LIFETIME_SECONDS,
      ip: readCmsActorIp(request.headers),
    },
    secret
  );

  const answer = await deps.send({
    method: match.method,
    target,
    header,
    ...(match.body === "none"
      ? {}
      : { body: body.bytes, contentType: body.contentType }),
    timeoutMs: match.endpoint === "E9" ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
  });
  switch (answer.kind) {
    case "answer":
      return new Response(answer.bytes as Uint8Array<ArrayBuffer>, {
        status: answer.status,
        headers: {
          "Content-Type": "application/json",
          ...privateNoStoreResponseHeaders,
        },
      });
    case "timeout":
      log("timeout");
      break;
    case "failed":
      log("forward_failed");
      break;
    case "not_json":
      log("bad_answer");
      break;
  }
  return refuse("unavailable", 502);
};
