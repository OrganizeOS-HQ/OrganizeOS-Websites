import { createHash } from "node:crypto";
import { createClient } from "@webstudio-is/postgrest/index.server";
import env from "~/env/env.server";
import type { SessionData } from "~/services/auth.server.utils";

/**
 * OrganizeOS session binding: the check (see `organizeos-session.server.ts`
 * for the session readers that call it).
 *
 * Given a builder user and the OrganizeOS session (`organizeosSid`) and user
 * (`organizeosUserId`) bound to it, decide whether the read stands. Session
 * reads pass their session's binding; collaboration writes pass the binding a
 * collab token carries (`shared/sync/patch/patch-auth.server.ts`).
 *
 * LEAF MODULE: imports only what is above, and never the Authenticators,
 * `createContext` or `~/shared/context.server` (a test holds this). Callers
 * reached from `createContext` import it without a cycle.
 */

export type OrganizeosBindingOutcome =
  // SSO is not configured (upstream dev, GitHub, Google logins): no check.
  | "pass"
  | "live"
  // SSO is configured but the session carries no binding (opened before the
  // binding shipped, or by a non-SSO login).
  | "missing"
  | "dead"
  // The liveness RPC failed or answered something other than a boolean.
  | "error";

export type OrganizeosBindingMode = "observe" | "enforce";

export type OrganizeosBindingDecision = {
  outcome: OrganizeosBindingOutcome;
  allow: boolean;
};

type BindingLogEntry = {
  organizeosBinding: Exclude<OrganizeosBindingOutcome, "pass" | "live">;
  mode: OrganizeosBindingMode;
  userId: string;
  sidHash?: string;
  reason?: string;
};

export type OrganizeosBindingDeps = {
  ssoConfigured: boolean;
  mode: OrganizeosBindingMode;
  /** Resolves the RPC's answer; throws when it cannot be had. */
  isSessionLive: (sessionId: string, userId: string) => Promise<boolean>;
  now: () => number;
  log: (entry: BindingLogEntry) => void;
};

const RPC_NAME = "websites2_sso_session_live";

// A verdict is reused for this long per (sid, user) on this instance. Each
// serverless instance keeps its own map, which only shortens the window.
const LIVENESS_TTL_MS = 60_000;
// An RPC failure is reused briefly, so an outage is not one RPC per request.
const ERROR_TTL_MS = 5_000;
const CACHE_MAX_ENTRIES = 1000;

type CachedVerdict = { verdict: "live" | "dead" | "error"; at: number };

const cache = new Map<string, CachedVerdict>();
// When each (outcome, user, sid) was last logged: a session that is read
// several times per request, and on every request, logs once a minute.
const logged = new Map<string, number>();

/** Test seam: forget every cached verdict and log mark. */
export const resetOrganizeosBindingCache = () => {
  cache.clear();
  logged.clear();
};

const remember = <Value>(
  map: Map<string, Value>,
  key: string,
  value: Value
) => {
  // Re-inserting moves the key to the end, so the first key is the oldest.
  map.delete(key);
  map.set(key, value);
  while (map.size > CACHE_MAX_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    map.delete(oldest);
  }
};

const hashSid = (sid: string) =>
  createHash("sha256").update(sid).digest("hex").slice(0, 12);

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

let rpcClient: RpcClient | undefined;

const getRpcClient = (): RpcClient => {
  if (rpcClient === undefined) {
    // The RPC lives in the OrganizeOS schema, which the fork's typed client
    // does not know about, so narrow it to the one call made here (as
    // consumeSsoJti does for its insert).
    rpcClient = createClient(
      env.POSTGREST_URL,
      env.POSTGREST_API_KEY
    ) as unknown as RpcClient;
  }
  return rpcClient;
};

const isSessionLiveViaRpc = async (
  sessionId: string,
  userId: string
): Promise<boolean> => {
  const { data, error } = await getRpcClient().rpc(RPC_NAME, {
    p_session_id: sessionId,
    p_user_id: userId,
  });
  if (error) {
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "unknown error";
    throw new Error(`${RPC_NAME} failed: ${message}`);
  }
  if (typeof data !== "boolean") {
    throw new Error(`${RPC_NAME} answered a non-boolean`);
  }
  return data;
};

const defaultDeps = (): OrganizeosBindingDeps => ({
  ssoConfigured: Boolean(env.ORGANIZEOS_SSO_PUBLIC_KEY),
  // Anything but an explicit `enforce` observes.
  mode: env.ORGANIZEOS_SESSION_BINDING === "enforce" ? "enforce" : "observe",
  isSessionLive: isSessionLiveViaRpc,
  now: Date.now,
  // Builder user id and a sid hash only: never an email, never the raw sid.
  log: (entry) => console.warn(entry),
});

const resolveVerdict = async (
  sid: string,
  userId: string,
  deps: OrganizeosBindingDeps
): Promise<{ verdict: "live" | "dead" | "error"; reason?: string }> => {
  const key = `${sid}:${userId}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    const ttl = cached.verdict === "error" ? ERROR_TTL_MS : LIVENESS_TTL_MS;
    if (deps.now() - cached.at < ttl) {
      return { verdict: cached.verdict };
    }
  }
  try {
    const live = await deps.isSessionLive(sid, userId);
    const verdict = live ? "live" : "dead";
    remember(cache, key, { verdict, at: deps.now() });
    return { verdict };
  } catch (error) {
    remember(cache, key, { verdict: "error", at: deps.now() });
    return {
      verdict: "error",
      reason: error instanceof Error ? error.message : "unknown error",
    };
  }
};

/**
 * Decide whether a read stands, given a builder user and the OrganizeOS
 * binding it carries (from a session or from a collab token).
 */
export const checkOrganizeosBindingClaims = async (
  userId: string,
  sid: string | undefined,
  organizeosUserId: string | undefined,
  deps: OrganizeosBindingDeps = defaultDeps()
): Promise<OrganizeosBindingDecision> => {
  if (deps.ssoConfigured === false) {
    return { outcome: "pass", allow: true };
  }

  let outcome: Exclude<OrganizeosBindingOutcome, "pass">;
  let reason: string | undefined;
  if (
    sid === undefined ||
    sid === "" ||
    organizeosUserId === undefined ||
    organizeosUserId === ""
  ) {
    outcome = "missing";
  } else {
    const result = await resolveVerdict(sid, organizeosUserId, deps);
    outcome = result.verdict;
    reason = result.reason;
  }

  if (outcome === "live") {
    return { outcome, allow: true };
  }

  const logKey = `${outcome}:${userId}:${sid ?? ""}`;
  const lastLogged = logged.get(logKey);
  if (lastLogged === undefined || deps.now() - lastLogged >= LIVENESS_TTL_MS) {
    remember(logged, logKey, deps.now());
    deps.log({
      organizeosBinding: outcome,
      mode: deps.mode,
      userId,
      ...(sid ? { sidHash: hashSid(sid) } : {}),
      ...(reason === undefined ? {} : { reason }),
    });
  }

  return { outcome, allow: deps.mode !== "enforce" };
};

/**
 * Decide whether a session read stands, given its OrganizeOS binding.
 */
export const checkOrganizeosBinding = async (
  sessionData: SessionData,
  deps: OrganizeosBindingDeps = defaultDeps()
): Promise<OrganizeosBindingDecision> =>
  checkOrganizeosBindingClaims(
    sessionData.userId,
    sessionData.organizeosSid,
    sessionData.organizeosUserId,
    deps
  );
